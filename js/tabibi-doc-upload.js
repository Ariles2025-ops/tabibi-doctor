/* ====================================================================
 * Tabibi — Doc upload component (Phase 16.5)
 * --------------------------------------------------------------------
 * Composant réutilisable pour upload des 2 docs de validation
 * (carte Conseil de l'Ordre + pièce d'identité) vers le bucket privé
 * `doctor-docs` puis UPDATE doctor_profiles.
 *
 * Utilisé par :
 *   - doctor-claim.html      : flow claim atomique
 *   - medecin-profile.html   : modal recovery (banner "docs manquants")
 *
 * Contrat :
 *   tabibiDocUpload.setup({
 *     container: HTMLElement | string (id),
 *     onValidChange: function(isValid) {},
 *   })
 *   → returns { submit(profileId), reset(), isValid(), files() }
 *
 * submit() retourne :
 *   { ok: true, ordrePath, identitePath }
 *   { ok: false, error: <code>, detail?: <msg> }
 *
 * Codes erreur submit :
 *   no_supabase_client, not_authenticated, files_missing,
 *   upload_ordre_failed, upload_identite_failed, update_paths_failed
 *
 * Storage path convention (Phase 16.1 policy `doctor-docs`) :
 *   <auth.uid()>/ordre_<timestamp>.<ext>
 *   <auth.uid()>/identite_<timestamp>.<ext>
 * ==================================================================== */
(function (global) {
  'use strict';

  var MIME_OK   = ['image/jpeg', 'image/png', 'application/pdf'];
  var MAX_SIZE  = 5 * 1024 * 1024;   // 5 MB
  var BUCKET    = 'doctor-docs';

  function _sb() { return global.tabibi && global.tabibi.supabase; }
  function _ext(file) {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'image/png')        return 'png';
    return 'jpg';
  }
  function _humanSize(bytes) {
    if (bytes < 1024)            return bytes + ' B';
    if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function _isFileValid(file) {
    if (!file) return false;
    if (MIME_OK.indexOf(file.type) === -1) return false;
    if (file.size > MAX_SIZE) return false;
    return true;
  }
  function _esc(s) { return String(s || '').replace(/[<>&"]/g, function(c){ return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]; }); }

  function _renderZone(zoneEl, key, label) {
    zoneEl.innerHTML =
      '<label style="display:block;font-size:12px;font-weight:700;color:#0f172a;margin:10px 0 6px">' +
        _esc(label) + ' <span style="color:#d21010">*</span>' +
      '</label>' +
      '<div class="docup-drop" data-key="' + key + '" style="border:2px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;background:#f8fafc;cursor:pointer;transition:border-color .15s">' +
        '<input type="file" accept="image/jpeg,image/png,application/pdf" style="display:none">' +
        '<div class="docup-placeholder" style="font-size:13px;color:#475569">' +
          '<i class="fa fa-upload" style="margin-right:6px"></i> Cliquez ou déposez un fichier (JPEG/PNG/PDF, 5 MB max)' +
        '</div>' +
        '<div class="docup-content" style="display:none;text-align:left"></div>' +
      '</div>' +
      '<div class="docup-error" data-key-err="' + key + '" style="display:none;color:#d21010;font-size:12px;margin-top:6px"></div>';
  }

  function _showPreview(file, contentEl) {
    if (file.type === 'application/pdf') {
      contentEl.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;font-size:13px">' +
          '<i class="fa fa-file-pdf" style="color:#d21010;font-size:28px"></i>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(file.name) + '</div>' +
            '<div style="font-size:11px;color:#64748b">' + _humanSize(file.size) + ' · PDF</div>' +
          '</div>' +
          '<button type="button" class="docup-clear" aria-label="Retirer" style="background:transparent;border:none;color:#64748b;font-size:18px;cursor:pointer">×</button>' +
        '</div>';
      return;
    }
    // Image : thumbnail via FileReader
    var reader = new FileReader();
    reader.onload = function (e) {
      contentEl.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;font-size:13px">' +
          '<img src="' + e.target.result + '" alt="" style="width:56px;height:56px;border-radius:6px;object-fit:cover;flex-shrink:0">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(file.name) + '</div>' +
            '<div style="font-size:11px;color:#64748b">' + _humanSize(file.size) + '</div>' +
          '</div>' +
          '<button type="button" class="docup-clear" aria-label="Retirer" style="background:transparent;border:none;color:#64748b;font-size:18px;cursor:pointer">×</button>' +
        '</div>';
    };
    reader.readAsDataURL(file);
  }

  function setup(opts) {
    opts = opts || {};
    var container = (typeof opts.container === 'string')
      ? document.getElementById(opts.container)
      : opts.container;
    if (!container) { console.warn('[doc-upload] container introuvable'); return null; }
    var onValidChange = (typeof opts.onValidChange === 'function') ? opts.onValidChange : function(){};

    container.innerHTML =
      '<div data-zone="ordre"></div>' +
      '<div data-zone="identite"></div>';
    var zOrdre    = container.querySelector('[data-zone="ordre"]');
    var zIdentite = container.querySelector('[data-zone="identite"]');
    _renderZone(zOrdre,    'ordre',    "Carte du Conseil de l'Ordre");
    _renderZone(zIdentite, 'identite', "Pièce d'identité (CIN / passeport)");

    var state = { ordre: null, identite: null };

    function _setError(key, msg) {
      var el = container.querySelector('[data-key-err="' + key + '"]');
      if (!el) return;
      if (msg) { el.textContent = msg; el.style.display = ''; }
      else     { el.textContent = '';  el.style.display = 'none'; }
    }
    function _clearFile(key, drop) {
      state[key] = null;
      _setError(key, '');
      drop.querySelector('.docup-placeholder').style.display = '';
      drop.querySelector('.docup-content').style.display     = 'none';
      drop.querySelector('input[type=file]').value           = '';
      onValidChange(isValid());
    }
    function _handleFile(key, file, drop) {
      if (!file) { _clearFile(key, drop); return; }
      if (MIME_OK.indexOf(file.type) === -1) {
        _setError(key, 'Format non supporté. Utilisez JPEG, PNG ou PDF.');
        _clearFile(key, drop); return;
      }
      if (file.size > MAX_SIZE) {
        _setError(key, 'Fichier trop volumineux (max 5 MB).');
        _clearFile(key, drop); return;
      }
      _setError(key, '');
      state[key] = file;
      drop.querySelector('.docup-placeholder').style.display = 'none';
      var content = drop.querySelector('.docup-content');
      content.style.display = '';
      _showPreview(file, content);
      onValidChange(isValid());
    }

    // Wire up clicks + drag-drop + remove
    [zOrdre, zIdentite].forEach(function (z) {
      var drop  = z.querySelector('.docup-drop');
      var input = z.querySelector('input[type=file]');
      var key   = drop.dataset.key;
      drop.addEventListener('click', function (e) {
        if (e.target.classList && e.target.classList.contains('docup-clear')) return;
        input.click();
      });
      input.addEventListener('change', function (e) { _handleFile(key, e.target.files[0], drop); });
      drop.addEventListener('dragover',  function (e) { e.preventDefault(); drop.style.borderColor = '#10b981'; });
      drop.addEventListener('dragleave', function ()  { drop.style.borderColor = '#cbd5e1'; });
      drop.addEventListener('drop',      function (e) { e.preventDefault(); drop.style.borderColor = '#cbd5e1'; _handleFile(key, e.dataTransfer.files[0], drop); });
      // Bouton "×" pour retirer le fichier
      z.addEventListener('click', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('docup-clear')) {
          e.stopPropagation();
          _clearFile(key, drop);
        }
      });
    });

    function isValid() {
      return _isFileValid(state.ordre) && _isFileValid(state.identite);
    }

    async function submit(profileId) {
      var sb = _sb();
      if (!sb) return { ok: false, error: 'no_supabase_client' };
      var sess = await sb.auth.getSession();
      var user = sess && sess.data && sess.data.session && sess.data.session.user;
      if (!user) return { ok: false, error: 'not_authenticated' };
      if (!isValid()) return { ok: false, error: 'files_missing' };

      var uid = user.id;
      var ts  = Date.now();
      var ordrePath    = uid + '/ordre_'    + ts + '.' + _ext(state.ordre);
      var identitePath = uid + '/identite_' + ts + '.' + _ext(state.identite);

      // 1. Upload carte Ordre
      var up1 = await sb.storage.from(BUCKET).upload(ordrePath, state.ordre, {
        upsert: false,
        contentType: state.ordre.type
      });
      if (up1.error) {
        console.warn('[doc-upload] upload ordre fail:', up1.error.message);
        return { ok: false, error: 'upload_ordre_failed', detail: up1.error.message };
      }

      // 2. Upload pièce identité — si échec, rollback fichier 1
      var up2 = await sb.storage.from(BUCKET).upload(identitePath, state.identite, {
        upsert: false,
        contentType: state.identite.type
      });
      if (up2.error) {
        console.warn('[doc-upload] upload identité fail, rollback ordre:', up2.error.message);
        try { await sb.storage.from(BUCKET).remove([ordrePath]); } catch (e) {}
        return { ok: false, error: 'upload_identite_failed', detail: up2.error.message };
      }

      // 3. UPDATE doctor_profiles avec les 2 paths + timestamp
      var upd = await sb.from('doctor_profiles').update({
        ordre_card_path: ordrePath,
        id_card_path: identitePath,
        validation_docs_uploaded_at: new Date().toISOString()
      }).eq('id', profileId);
      if (upd.error) {
        console.warn('[doc-upload] UPDATE paths fail, rollback uploads:', upd.error.message);
        try { await sb.storage.from(BUCKET).remove([ordrePath, identitePath]); } catch (e) {}
        return { ok: false, error: 'update_paths_failed', detail: upd.error.message };
      }

      return { ok: true, ordrePath: ordrePath, identitePath: identitePath };
    }

    function reset() {
      state = { ordre: null, identite: null };
      _renderZone(zOrdre,    'ordre',    "Carte du Conseil de l'Ordre");
      _renderZone(zIdentite, 'identite', "Pièce d'identité (CIN / passeport)");
      onValidChange(false);
    }

    return {
      submit: submit,
      reset:  reset,
      isValid: isValid,
      files:  function () { return { ordre: state.ordre, identite: state.identite }; }
    };
  }

  global.tabibiDocUpload = { setup: setup };
})(window);
