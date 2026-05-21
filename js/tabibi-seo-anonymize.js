/* =====================================================================
   Tabibi — Anonymisation client-side des pages SEO
   =====================================================================
   Date     : 2026-05-21
   Mission  : Anonymiser les noms de medecins dans les pages /seo/*.html
              avant affichage utilisateur (overlay JS rapide en attendant
              la regeneration server-side via generate_seo_pages.py).

   Strategie B : "Dr KHALED BOUASRIA" -> "Dr K. B." + bandeau "Reclamer
              ma fiche" sur chaque carte medecin.

   ATTENTION RGPD : ce script NE protege QUE l'affichage utilisateur.
   Le HTML source contient toujours les vrais noms et est indexe par
   Google. Pour la protection RGPD COMPLETE :
     1. Garder X-Robots-Tag: noindex sur /seo/* (netlify.toml)
     2. Regenerer les pages avec scripts/generate_seo_pages.py patche
     3. Retirer noindex apres re-deploiement
   ===================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // Anonymise "Dr KHALED BOUASRIA" -> "Dr K. B."
  // Anonymise "Cabinet de cardiologie Dr Gaouaoui Fatima Zohra" -> "Dr G. F. Z."
  // Anonymise "Médecin spécialiste à Alger" -> "Médecin specialiste à Alger" (rien à anonymiser)
  function anonymizeName(name) {
    if (!name) return 'Médecin partenaire';
    var raw = String(name).trim();

    // Tente d'extraire "Dr <Prenom> <Nom>" depuis differentes formes
    // Cas 1 : commence par "Dr " ou "Docteur "
    var m1 = raw.match(/^(?:Dr|Docteur)\.?\s+(.+)$/i);
    if (m1) {
      return 'Dr ' + initialsOf(m1[1]);
    }
    // Cas 2 : contient "Dr " ou "Docteur " au milieu (ex: "Cabinet de cardiologie Dr Gaouaoui Fatima")
    var m2 = raw.match(/\b(?:Dr|Docteur)\.?\s+([A-Za-zÀ-ÿ\-\s]+?)(?:\s*[,;\-/].*)?$/i);
    if (m2) {
      return 'Dr ' + initialsOf(m2[1]);
    }
    // Cas 3 : pas de "Dr" detecte = c'est probablement un nom de cabinet
    // -> on ne touche pas, juste tronquer
    if (raw.length > 30) return raw.substring(0, 27) + '…';
    return raw;
  }

  // "Khaled BOUASRIA" -> "K. B."
  // "Fatima Zohra GAOUAOUI" -> "F. Z. G."
  function initialsOf(s) {
    if (!s) return '?';
    var parts = String(s)
      .replace(/[,;].*/, '') // retire ce qui vient apres une virgule (ex: "Khaled, Cardiologue")
      .trim()
      .split(/\s+/)
      .filter(function (p) { return p && p.length > 0; });
    if (parts.length === 0) return '?';
    return parts.map(function (p) {
      var ch = p[0];
      return (ch || '?').toUpperCase() + '.';
    }).join(' ');
  }

  // Retire l'adresse precise dans .doc-card .loc itemprop="address"
  // Garde uniquement la wilaya (region), retire la localite precise
  function anonymizeAddress(article) {
    var localityEl = article.querySelector('[itemprop="addressLocality"]');
    if (localityEl) {
      // On masque la localite precise (ex: "Bab Ezzouar") pour ne garder que la wilaya
      localityEl.textContent = '—';
    }
  }

  // Retire les JSON-LD Physician (sinon Google indexe quand meme les noms via schema.org)
  // On les remplace par un JSON-LD generique "MedicalBusiness"
  function neutralizeJsonLd(article) {
    var scripts = article.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach(function (s) {
      try {
        var data = JSON.parse(s.textContent);
        if (data && data['@type'] === 'Physician') {
          // Remplace par version anonymisee
          var addr = data.address || {};
          delete addr.addressLocality;
          var sanitized = {
            '@context': 'https://schema.org',
            '@type': 'MedicalBusiness',
            'name': 'Praticien Tabibi',
            'medicalSpecialty': data.medicalSpecialty || 'Medical',
            'address': addr,
            'url': data.url || ''
          };
          s.textContent = JSON.stringify(sanitized);
        }
      } catch (e) { /* swallow */ }
    });
  }

  // Ajoute un bandeau discret sur chaque card "Reclamer cette fiche"
  function addClaimBadge(article) {
    if (article.querySelector('.tabibi-claim-badge')) return; // idempotent
    var badge = document.createElement('div');
    badge.className = 'tabibi-claim-badge';
    badge.style.cssText = 'margin-top:8px;padding:6px 10px;background:#fef3c7;border-radius:6px;font-size:11px;color:#92400e;display:flex;align-items:center;gap:6px;flex-wrap:wrap';
    badge.innerHTML =
      '<span>🏥 Vous êtes ce médecin&nbsp;?</span>' +
      '<a href="https://tabibi.doctor/signup.html?role=medecin" ' +
         'style="color:#92400e;font-weight:700;text-decoration:underline" ' +
         'rel="nofollow">Réclamer ma fiche</a>';
    article.appendChild(badge);
  }

  function run() {
    var cards = document.querySelectorAll('article.doc-card');
    if (!cards.length) return;

    cards.forEach(function (article) {
      // 1. Anonymise le nom dans le <h3 itemprop="name">
      var h3 = article.querySelector('h3[itemprop="name"]');
      if (h3) {
        var original = h3.textContent;
        var anon = anonymizeName(original);
        if (anon !== original) {
          h3.textContent = anon;
          h3.dataset.tabibiAnonymized = '1';
        }
      }

      // 2. Anonymise l'adresse precise (garde juste la wilaya)
      anonymizeAddress(article);

      // 3. Neutralise les JSON-LD Physician (anti-indexation Google)
      neutralizeJsonLd(article);

      // 4. Ajoute le bandeau "Reclamer cette fiche"
      addClaimBadge(article);
    });

    if (window.console && console.info) {
      console.info('[Tabibi SEO Anonymize] ' + cards.length + ' fiches medecin anonymisees (B)');
    }
  }

  // Run le plus tot possible pour eviter le flash de contenu non-anonymise
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
