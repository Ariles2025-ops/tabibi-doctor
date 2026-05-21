/**
 * Tabibi — Composant Avatar (upload, resize, crop, affichage)
 *
 * Usage côté HTML :
 *   <div id="ava" class="tabibi-avatar" data-clickable="true">KB</div>
 *
 * Usage côté JS (init) :
 *   TabibiAvatar.init({
 *     containerId: 'ava',        // ID de l'élément qui affiche l'avatar
 *     fallbackText: 'KB',        // Initiales si pas de photo
 *     fallbackBg: '#0F7560',     // Fond pour les initiales
 *     fallbackColor: '#fff',     // Couleur du texte initiales
 *     allowUpload: true,         // Cliquer dessus = ouvre le dialog upload
 *   });
 *
 * Le composant :
 *  - Affiche l'image depuis users.photo_url si présente, sinon les initiales
 *  - Au clic, ouvre un dialog d'upload (fichier local)
 *  - Resize l'image à 400×400 max, centre-crop carré
 *  - Upload vers Supabase Storage bucket "avatars"
 *  - Met à jour users.photo_url
 *  - Affiche immédiatement la nouvelle photo
 */
(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  const STORAGE_BUCKET = 'avatars';
  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB avant resize
  const TARGET_SIZE = 400; // px, carré final
  const QUALITY = 0.85;    // JPEG quality
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // ─── helpers Supabase ───
  function _supabase() {
    return (window.tabibi && window.tabibi.supabase) || null;
  }
  async function _getUserId() {
    try {
      const sb = _supabase();
      if (!sb) return null;
      const { data: { session } } = await sb.auth.getSession();
      return session?.user?.id || null;
    } catch(e) { return null; }
  }

  // ─── Toast minimal ───
  function _toast(msg, type) {
    type = type || 'info';
    if (typeof window.toastM === 'function') { window.toastM(msg, type); return; }
    if (typeof window.toast === 'function') { window.toast(msg, type); return; }
    console.log('[Tabibi/Avatar]', msg);
  }

  // ─── Resize + crop carré centré via Canvas ───
  function _resizeAndCropImage(file, targetSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        // Crop carré centré : on prend le min des 2 dimensions
        const minSide = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - minSide) / 2;
        const sy = (img.naturalHeight - minSide) / 2;
        // Canvas final = targetSize × targetSize
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        // High quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
        // Vers Blob JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Resize failed'));
            resolve(blob);
          },
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Image loading failed'));
      };
      img.src = url;
    });
  }

  // ─── Validation fichier ───
  function _validateFile(file) {
    if (!file) return { ok: false, msg: 'Aucun fichier sélectionné' };
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, msg: 'Format non supporté. Utilisez JPG, PNG ou WebP.' };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, msg: 'Fichier trop volumineux (max 5 MB)' };
    }
    return { ok: true };
  }

  // ─── Upload Supabase Storage ───
  async function _uploadToStorage(blob, userId) {
    const sb = _supabase();
    if (!sb) throw new Error('Supabase non disponible');
    // Chemin : <userId>/avatar-<timestamp>.jpg
    // Le nom changeant à chaque upload évite les problèmes de cache navigateur
    const filename = userId + '/avatar-' + Date.now() + '.jpg';
    const { data, error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(filename, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });
    if (error) throw error;
    // Récupérer l'URL publique
    const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
    return { path: data.path, publicUrl: urlData.publicUrl };
  }

  // ─── Mettre à jour users.photo_url + supprimer ancien ───
  async function _updateUserPhotoUrl(userId, photoUrl, oldPath) {
    const sb = _supabase();
    if (!sb) throw new Error('Supabase non disponible');
    // Update DB
    const { error } = await sb.from('users').update({ photo_url: photoUrl }).eq('id', userId);
    if (error) throw error;
    // Supprimer ancien avatar (best effort, on n'échoue pas si ça rate)
    if (oldPath) {
      try { await sb.storage.from(STORAGE_BUCKET).remove([oldPath]); } catch(_) {}
    }
    // Mettre à jour le localStorage pour refléter immédiatement
    try {
      const u = JSON.parse(localStorage.getItem('tabibi_user') || '{}');
      u.photo_url = photoUrl;
      localStorage.setItem('tabibi_user', JSON.stringify(u));
    } catch(_) {}
  }

  // ─── Rendu de l'avatar (photo ou initiales) ───
  function _renderAvatar(container, opts) {
    const photoUrl = opts.photoUrl;
    const fallbackText = opts.fallbackText || '?';
    const fallbackBg = opts.fallbackBg || '#0F7560';
    const fallbackColor = opts.fallbackColor || '#fff';
    const allowUpload = opts.allowUpload !== false;

    // Récupérer le style existant pour le conserver (taille, border-radius)
    const existing = container.getAttribute('style') || '';
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    if (photoUrl) {
      const img = document.createElement('img');
      img.src = photoUrl;
      img.alt = 'Photo de profil';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      img.loading = 'lazy';
      img.onerror = () => {
        // Si l'image foire, on retombe sur les initiales
        _renderAvatar(container, { ...opts, photoUrl: null });
      };
      container.appendChild(img);
    } else {
      // Initiales
      container.style.background = fallbackBg;
      container.style.color = fallbackColor;
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      const span = document.createElement('span');
      span.textContent = fallbackText;
      span.style.cssText = 'font-weight:800';
      container.appendChild(span);
    }

    // Overlay cliquable (icône caméra)
    if (allowUpload) {
      container.style.cursor = 'pointer';
      container.setAttribute('title', 'Cliquez pour changer la photo');
      const overlay = document.createElement('div');
      overlay.className = '_avatar-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none';
      overlay.innerHTML = '<i class="fa fa-camera" style="font-size:22px"></i>';
      container.appendChild(overlay);
      // Hover effect
      container.onmouseenter = () => overlay.style.opacity = '1';
      container.onmouseleave = () => overlay.style.opacity = '0';
      // Click handler
      container.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        _openFilePicker(container, opts);
      };
    }
  }

  // ─── Ouvre le sélecteur de fichier + workflow upload ───
  function _openFilePicker(container, opts) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      document.body.removeChild(input);
      if (!file) return;
      await _handleFile(file, container, opts);
    };
    input.click();
  }

  // ─── Workflow complet : valider → resize → upload → update DB → re-render ───
  async function _handleFile(file, container, opts) {
    const v = _validateFile(file);
    if (!v.ok) { _toast(v.msg, 'error'); return; }

    // Loading state
    const old = container.innerHTML;
    container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.1)"><i class="fa fa-circle-notch fa-spin" style="font-size:24px;color:#0F7560"></i></div>';

    try {
      // 1. Resize + crop
      const blob = await _resizeAndCropImage(file, TARGET_SIZE);

      // 2. Récupérer l'user ID
      const userId = await _getUserId();
      if (!userId) {
        // Mode démo / non connecté : on ne fait que stocker en local (en base64)
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          // Sauvegarder dans le user local
          try {
            const u = JSON.parse(localStorage.getItem('tabibi_user') || '{}');
            u.photo_url = dataUrl;
            localStorage.setItem('tabibi_user', JSON.stringify(u));
          } catch(_) {}
          _renderAvatar(container, { ...opts, photoUrl: dataUrl });
          _toast('Photo mise à jour (mode démo)', 'success');
        };
        reader.readAsDataURL(blob);
        return;
      }

      // 3. Upload Supabase Storage
      const { publicUrl } = await _uploadToStorage(blob, userId);

      // 4. Mettre à jour users.photo_url
      await _updateUserPhotoUrl(userId, publicUrl);

      // 5. Re-rendre l'avatar
      _renderAvatar(container, { ...opts, photoUrl: publicUrl });
      _toast('Photo de profil mise à jour ✓', 'success');

    } catch (e) {
      console.error('[Tabibi/Avatar]', e);
      container.innerHTML = old; // Restaurer l'ancien
      _toast('Erreur upload : ' + (e.message || 'inconnue'), 'error');
    }
  }

  // ─── API publique ───
  const TabibiAvatar = {
    /**
     * Initialise un conteneur avatar
     * @param {object} opts
     *   - containerId: string  ID de l'élément
     *   - fallbackText: string Initiales (ex: 'KB')
     *   - fallbackBg: string   Couleur fond initiales
     *   - fallbackColor: string Couleur texte initiales
     *   - photoUrl: string|null URL de la photo (override)
     *   - allowUpload: bool    True pour permettre le clic upload
     */
    init(opts) {
      const container = document.getElementById(opts.containerId);
      if (!container) return;
      // Récupérer photo_url depuis localStorage si pas fourni
      let photoUrl = opts.photoUrl;
      if (photoUrl === undefined) {
        try {
          const u = JSON.parse(localStorage.getItem('tabibi_user') || '{}');
          photoUrl = u.photo_url || null;
        } catch(_) { photoUrl = null; }
      }
      _renderAvatar(container, { ...opts, photoUrl });
    },

    /** Force le re-rendu avec une nouvelle photo */
    setPhoto(containerId, photoUrl, opts) {
      const container = document.getElementById(containerId);
      if (!container) return;
      _renderAvatar(container, { ...opts, photoUrl });
    },

    /** Affiche la photo d'un user spécifique (read-only) */
    show(containerId, photoUrl, fallbackText, fallbackBg, fallbackColor) {
      this.init({
        containerId,
        photoUrl,
        fallbackText: fallbackText || '?',
        fallbackBg: fallbackBg || '#0F7560',
        fallbackColor: fallbackColor || '#fff',
        allowUpload: false
      });
    }
  };

  window.TabibiAvatar = TabibiAvatar;
  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();
