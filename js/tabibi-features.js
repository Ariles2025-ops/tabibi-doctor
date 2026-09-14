/* ====================================================================
 * Tabibi — Feature Flags (frontend pur, lecture localStorage en option)
 * --------------------------------------------------------------------
 * Phase 7.4 + Phase 8.4 + Phase 9.5 + Phase 10.5 + Phase 12.1
 *
 * Source unique de vérité pour activer/désactiver les fonctionnalités
 * dont les dépendances backend (RPC / Edge Function / API tierce) ne
 * sont pas encore prêtes en M0.
 *
 * Lecture :
 *   window.TABIBI_FEATURES.video
 *   window.TABIBI_FEATURES.payments
 *   window.TABIBI_FEATURES.notifications
 *   window.TABIBI_FEATURES.reviews
 *   window.TABIBI_FEATURES.analytics
 *   window.TABIBI_FEATURES.sentry
 *   window.TABIBI_FEATURES.dawini
 *
 * Override runtime (debug / QA, jamais en prod) :
 *   localStorage.setItem('tabibi_features_override', JSON.stringify({video:true}))
 *   → reload, le flag est ON
 *
 * Activer une feature pour de bon :
 *   1. Mettre `true` dans ce fichier (default ci-dessous)
 *   2. Vérifier que la dépendance backend / tierce est prête
 *      (cf SQL_TODO.md + Phase 13)
 *   3. Tester staging avant prod
 *
 * Idempotent : si chargé 2 fois, le 2e load no-op.
 * ==================================================================== */
(function () {
  'use strict';

  if (window.TABIBI_FEATURES && typeof window.TABIBI_FEATURES === 'object'
      && Object.isFrozen(window.TABIBI_FEATURES)) {
    return;  // déjà chargé
  }

  // ─── Defaults M0 — tout OFF sauf le core ────────────────────────────
  // Activer feature par feature en Phase 13 après validation backend.
  var defaults = {
    // Téléconsultation Daily.co (Phase 7) :
    //   [14/09/2026] LE MOTIF ECRIT ICI ETAIT FAUX. Il disait « RPC
    //   get_video_session ❌ inexistante en DB » et idem pour
    //   set_video_recording_consent. **Les deux EXISTENT** (mesuré sur pg_proc
    //   le 14/09). Quelqu'un qui lisait ces lignes et vérifiait en base
    //   concluait qu'on pouvait ouvrir le drapeau.
    //
    //   LA VRAIE RAISON, elle, tient toujours :
    //   - le SDK Daily n'a JAMAIS chargé : la balise pointait sur
    //     @daily-co/daily-js@0.66.1, une version jamais publiée. Vendorisé
    //     depuis en 0.92.2, mais le flux n'a jamais tourné de bout en bout.
    //   - `video_sessions.daily_room_url` est une URL PLACEHOLDER
    //     (`https://placeholder.daily.co/…`, cf. create_video_session) : il n'y
    //     a pas de fournisseur vidéo réel, pas de clé, pas de salle.
    //   → Reste OFF jusqu'à une séance dédiée avec le fournisseur réel.
    video: true,

    // Paiements (Phase 8) :
    //   - Stripe Test : compte non créé
    //   - Edge Function webhook : non déployée
    //   → Bloquer côté UI (cards paiement = "Bientôt disponible")
    payments: false,

    // Notifications in-app (Phase 9) — ACTIF (étape 1) :
    //   - Table public.notifications (type/message/title/data) recréée + RLS
    //   - Triggers tg_notify_appointment AFTER INSERT/UPDATE actifs
    //   - Notifs : rdv_new (médecin), rdv_confirmed (patient), rdv_cancelled (routage auth.uid)
    //   - Étape 2 (à venir) : rappel veille J-1 via pg_cron
    notifications: true,

    // Messagerie patient<->medecin (MSG step1) :
    //   - DB prod : tables conversations + messages + RLS + RPC ensure_conversation
    //   - Front : messages.html + conversation.html + js/tabibi-messaging.js
    //   - OFF tant que les 2 pages ne sont pas testées + points d'entrée ajoutés
    messaging: false,

    // Avis (Phase 9) :
    //   [14/09/2026] LE MOTIF ECRIT ICI ETAIT FAUX. Il disait « Table reviews :
    //   non créée ». **Elle existe**, ainsi que la vue
    //   `my_reviewable_appointments` (mesuré le 14/09). Elles contiennent
    //   0 ligne — ce qui est normal avant lancement, mais n'est pas « non créée ».
    //   LA RAISON QUI RESTE : le parcours d'avis n'a jamais été exercé de bout
    //   en bout, et `fn_verify_review` / `validate_review_eligibility` n'ont
    //   jamais tourné sur des données. C'est un manque de RECETTE, pas de schéma.
    reviews: false,

    // Ordonnances numériques :
    //   - Front : medecin-ordonnance.html (rédaction/signature) +
    //     patient-ordonnances.html (consultation/téléchargement)
    //   [14/09/2026] LE MOTIF ECRIT ICI ETAIT FAUX. Il disait « les 4 RPC sont
    //   ABSENTES (vérifié le 2026-07-29) ». **Elles existent depuis le
    //   14/09/2026** (20260914_ordonnances_rpc.sql, appliquée, plpgsql_check à
    //   0 défaut). L'ancienne mesure était vraie le 29/07 ; elle ne l'est plus.
    //
    //   DEUX VERROUS TENAIENT CE DRAPEAU FERMÉ. **Les deux sont levés le
    //   14/09/2026 au soir**, et c'est pour ça — et seulement ça — qu'il ouvre.
    //
    //   1. ~~les edge functions ne sont pas déployées~~ → **DÉPLOYÉES** :
    //      `generate-prescription-pdf` (verify_jwt=true) et
    //      `verify-prescription` (verify_jwt=false). **Essai de bout en bout
    //      passé** : médecin de test → génération → `signed` → vérification
    //      publique « valid », signature `v1`, PDF au bucket privé, et AUCUN
    //      médicament dans la réponse publique (initiales patient seulement).
    //      Semis de test nettoyé derrière.
    //   2. ~~la RLS s'annule elle-même~~ → **corrigée** par
    //      `20260914_rls_prescriptions.sql` (#118) : une seule politique par
    //      commande d'écriture. Relevé le 14/09 après application —
    //      INSERT 1 · SELECT 2 · UPDATE 1, et `authenticated` n'a toujours que
    //      `SELECT` sur la table.
    //
    //   CE QUI FAIT QUE LE BOUTON NE MENT PAS, mesuré avant d'ouvrir :
    //     bucket `prescriptions` : privé, 10 Mo, `application/pdf` seul
    //     une seule politique de stockage, en lecture (`presc_pdf_select`)
    //     `create_prescription_draft` / `update_prescription_draft` /
    //     `request_prescription_signature` / `mark_prescription_delivered` :
    //     toutes SECURITY DEFINER et exécutables par `authenticated`.
    //   Le brouillon passe donc par RPC, pas par la table — ce qui compte,
    //   puisque `authenticated` n'a aucun droit d'écriture dessus.
    //
    //   ⚠️ CE QUI RESTE VRAI ET QU'IL NE FAUT PAS OUBLIER : le PDF ne sait
    //   imprimer que du latin. Une ordonnance saisie en arabe est REFUSÉE à la
    //   signature (`unsupported_characters`) — elle n'est pas mutilée en
    //   silence. Voir docs/A_FAIRE_AGHILES.md.
    prescriptions: true,

    // Analytics Plausible (Phase 10) :
    //   - Compte Plausible non créé
    //   - Script injection désactivé pour éviter erreur 404 + bruit
    analytics: false,

    // [DAWINI 2026-07-08] Localisation de medicaments (« Dawini ») :
    //   - DB : migrations/DAWINI_step1_schema.sql — A EXECUTER (SQL Editor)
    //   - Front : dawini.html + dawini-pharmacie.html + js/tabibi-dawini.js
    //   - Zones : table dawini_zones (activation wilaya par wilaya)
    //   - Push FCM : en attente du projet Firebase dz.tabibi.app
    //   → ON (decision fondateur 2026-07-08) : design v4 valide en local.
    //     ⚠️ AVANT deploiement : executer la migration + creer 1 pharmacie test,
    //     sinon les pages afficheront des erreurs reseau (tables absentes).
    dawini: true,

    // Sentry frontend errors (Phase 12) :
    //   - Projet Sentry CRÉÉ. DSN réel présent dans js/config.js
    //     (o4511831260987392.ingest.de.sentry.io), déjà autorisé par la CSP de
    //     _headers ET de netlify.toml (script-src browser.sentry-cdn.com,
    //     connect-src sur l'ingest) — vérifié le 2026-09-08.
    //   ⚠️ CE FLAG N'EST LU PAR PERSONNE : js/tabibi-sentry.js s'active sur la
    //     seule présence d'un DSN ne contenant pas "REPLACE_". Sentry est donc
    //     DÉJÀ actif sur les 28 pages qui incluent le script. Le flag valait
    //     false et mentait sur l'état réel (AUDIT_RESTANT le listait comme
    //     « Sentry inactif »). Remis à true pour que la lecture des flags
    //     cesse d'induire en erreur. Aucun élément DOM n'est piloté par ce
    //     flag (0 occurrence de data-feature="sentry") : changement sans effet
    //     visuel.
    sentry: true,

    // Statistiques médecin (doctor-analytics.html) :
    //   - Page 100 % factice : aucun appel Supabase, chiffres écrits en dur
    //     (doctor-analytics.html:199,291). L'entrée « Statistiques » de la
    //     sidebar pro y menait sans aucune bannière d'avertissement — un
    //     médecin y lisait des chiffres inventés comme s'ils étaient les siens.
    //   → OFF : l'entrée n'est plus rendue (js/tabibi-pro-sidebar.js).
    //     Repasser à true le jour où la page interroge vraiment la base.
    doctorStats: false
  };

  // ─── Override runtime (QA / debug) ──────────────────────────────────
  var overrides = {};
  try {
    var raw = localStorage.getItem('tabibi_features_override') || '';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') overrides = parsed;
    }
  } catch (e) { /* localStorage indispo / JSON cassé → no override */ }

  var merged = {};
  Object.keys(defaults).forEach(function (k) {
    merged[k] = (k in overrides) ? !!overrides[k] : defaults[k];
  });

  window.TABIBI_FEATURES = Object.freeze(merged);

  // ─── Helper : afficher / masquer des éléments par flag ──────────────
  // Usage HTML : <button data-feature="video">Téléconsulter</button>
  //  → masqué si TABIBI_FEATURES.video === false
  //  Inverse : data-feature-not="video" → visible UNIQUEMENT si video=false
  function _applyFeatureVisibility() {
    var nodes = document.querySelectorAll('[data-feature]');
    Array.prototype.forEach.call(nodes, function (el) {
      var key = el.getAttribute('data-feature');
      if (key && merged[key] === false) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      }
    });
    var antiNodes = document.querySelectorAll('[data-feature-not]');
    Array.prototype.forEach.call(antiNodes, function (el) {
      var key = el.getAttribute('data-feature-not');
      if (key && merged[key] === true) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyFeatureVisibility);
  } else {
    _applyFeatureVisibility();
  }
  window.tabibiApplyFeatureVisibility = _applyFeatureVisibility;
})();
