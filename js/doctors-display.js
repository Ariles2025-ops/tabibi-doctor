// Tabibi Doctors Display
// IMPORTANT : ne fait RIEN si app.js a déjà chargé DOCTORS (les 14 000 médecins).
// Ne s'active QUE comme fallback sur les pages qui n'ont PAS app.js.
(function() {
  // Si app.js a chargé DOCTORS (que ce soit avec 0 ou 14000), on le laisse faire
  // app.js définit `let DOCTORS = []` au plus haut niveau, donc ça existe forcément
  // dès qu'app.js est chargé.

  function appJsLoaded() {
    // Si app.js a chargé, la fonction loadDoctorsIntoApp est définie
    return typeof window.loadDoctorsIntoApp === 'function';
  }

  // Attendre un peu pour laisser app.js charger les vrais médecins
  setTimeout(function() {
    if (appJsLoaded()) {
      /* [FIX-PROD-2026-05-19] log d'init retiré */
      return;
    }

    // app.js absent => fallback : charger des médecins via l'API du bridge
    if (!window.tabibi || !window.tabibi.api) {
      console.warn('[Tabibi/display] api.js non charge, et pas d app.js');
      return;
    }

    // Charger TOUS les médecins par batches (pas de limite à 100)
    loadAllDoctorsViaApi();
  }, 2000);

  async function loadAllDoctorsViaApi() {
    try {
      const allDocs = [];
      let offset = 0;
      const BATCH = 1000;
      while (true) {
        const { data } = await window.tabibi.api.searchDoctors({ limit: BATCH, offset: offset });
        if (!data || data.length === 0) break;
        allDocs.push(...data);
        if (data.length < BATCH) break;
        offset += BATCH;
      }
      /* [FIX-PROD-2026-05-19] log d'init retiré */

      // Convertir au format attendu par les vues
      window.DOCTORS = allDocs.map(convertDoctor);

      // Tenter les rendus connus
      ['renderDoctors', 'applyFilters', 'renderHome', 'init'].forEach(fn => {
        if (typeof window[fn] === 'function') try { window[fn](); } catch (e) {}
      });
    } catch (e) {
      console.warn('[Tabibi/display] Erreur:', e && e.message);
    }
  }

  function convertDoctor(doc) {
    const initials = (doc.full_name || '').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase() || 'MD';
    // [I18N-UNIFY-2026] Lit specialty_ar/en et wilaya_ar/en depuis la vue public_doctors
    // (générées par le JOIN sur specialties/wilayas via slug et code).
    // Fallback FR si la migration SQL n'a pas encore été exécutée.
    return {
      id: doc.id,
      fr: doc.full_name || 'Médecin',
      ar: doc.full_name_ar || doc.full_name || '',
      en: doc.full_name || 'Doctor',
      spec: doc.specialty_name_fr || doc.specialty_fr || 'Généraliste',
      sAr: doc.specialty_ar || doc.specialty_fr || '',
      sEn: doc.specialty_en || doc.specialty_fr || '',
      ville: doc.wilaya_fr || 'Algérie',
      vAr: doc.wilaya_ar || doc.wilaya_fr || '',
      vEn: doc.wilaya_en || doc.wilaya_fr || '',
      note: Number(doc.rating) || 4.5,
      prix: doc.consultation_fee_dzd || 1500,
      urgent: false,
      cert: doc.is_verified || false,
      in: initials,
      bg: '#E0F2FE',
      tc: '#0066CC',
      g: 'H',
      avis: doc.review_count || 0,
      langs: ['FR', 'AR'],
      desc: 'Médecin certifié en Algérie. Profil vérifié.',
      addr: doc.address || (doc.wilaya_fr || 'Algérie'),
      diplomes: ['Doctorat en Médecine']
    };
  }
})();
