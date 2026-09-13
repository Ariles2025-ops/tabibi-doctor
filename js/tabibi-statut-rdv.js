/* =====================================================================
 * tabibi-statut-rdv.js — SOURCE UNIQUE du statut d'un rendez-vous
 * =====================================================================
 * Le 13/09/2026, six ecrans traduisaient le statut chacun chez soi, avec
 * six regles differentes. Le pire, doctor-dashboard.html:705 et :764 :
 *
 *   status==='Confirmed' ? 'badge-blue' : status==='Pending' ? 'badge-amber' : 'badge-green'
 *
 * Tout ce qui n'etait ni confirme ni en attente sortait VERT : un annule,
 * un absent, un statut inconnu. Le vert etait le defaut. Ici, le vert est
 * une autorisation : il faut le meriter.
 *
 * Le vocabulaire est celui de la base, et rien d'autre. `appointment_status`
 * est un ENUM Postgres NOT NULL, defaut 'pending', cinq valeurs MINUSCULES.
 * L'ancienne couche de capitalisation (STATUS_MAP, 'Confirmed', 'Pending')
 * inventait des valeurs qui n'existent nulle part en base : elle est morte.
 *
 * La liste ci-dessous est comparee aux valeurs reelles de l'enum par
 * scripts/verifier-statuts.mjs. Ajouter une valeur en base sans l'ajouter
 * ici fait ECHOUER le controle.
 * ===================================================================== */
(function () {
  'use strict';

  var VALEURS = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

  // compteConsultations : un acte a-t-il eu lieu ? (tranche par Aghiles le
  // 13/09/2026, option A) — seul `completed` compte. Un absent ne compte pas
  // comme consultation, mais il a son propre total : le medecin veut le voir.
  var TABLE = {
    pending:   { classe: 'badge-amber', cleI18n: 'statut_rdv_pending',
                 compteConsultations: false, compteAbsents: false,
                 actions: ['confirmer', 'annuler'] },
    confirmed: { classe: 'badge-blue',  cleI18n: 'statut_rdv_confirmed',
                 compteConsultations: false, compteAbsents: false,
                 actions: ['marquerTermine', 'marquerAbsent', 'annuler'] },
    completed: { classe: 'badge-green', cleI18n: 'statut_rdv_completed',
                 compteConsultations: true,  compteAbsents: false,
                 actions: [] },
    cancelled: { classe: 'badge-red',   cleI18n: 'statut_rdv_cancelled',
                 compteConsultations: false, compteAbsents: false,
                 actions: [] },
    no_show:   { classe: 'badge-gray',  cleI18n: 'statut_rdv_no_show',
                 compteConsultations: false, compteAbsents: true,
                 actions: [] }
  };

  function traduire(cle, defaut) {
    if (typeof window.tabibiT === 'function') {
      var v = window.tabibiT(cle, defaut);
      if (v && v !== cle) return v;
    }
    return defaut;
  }

  function normaliser(brut) {
    return String(brut == null ? '' : brut).trim().toLowerCase();
  }

  /**
   * Decrit un statut. Ne renvoie JAMAIS un etat valide pour une valeur
   * qu'il ne connait pas : ni vert, ni « En attente », ni action possible.
   */
  function decrire(brut) {
    var cle = normaliser(brut);
    var e = Object.prototype.hasOwnProperty.call(TABLE, cle) ? TABLE[cle] : null;
    if (!e) {
      return {
        cle: null,
        brut: cle,
        connu: false,
        libelle: traduire('statut_rdv_inconnu', 'Statut inconnu'),
        classe: 'badge-gray is-statut-inconnu',
        compteConsultations: false,
        compteAbsents: false,
        actions: [],
        peut: function () { return false; }
      };
    }
    return {
      cle: cle,
      brut: cle,
      connu: true,
      libelle: traduire(e.cleI18n, cle),
      classe: e.classe,
      compteConsultations: e.compteConsultations,
      compteAbsents: e.compteAbsents,
      actions: e.actions.slice(),
      peut: function (a) { return e.actions.indexOf(a) !== -1; }
    };
  }

  // Totaux — la seule definition de « consultations » et « absents ».
  function compter(lignes, champ) {
    var c = { consultations: 0, absents: 0, inconnus: 0, total: 0 };
    (lignes || []).forEach(function (l) {
      var d = decrire(l && (champ ? l[champ] : l.status));
      c.total++;
      if (!d.connu) { c.inconnus++; return; }
      if (d.compteConsultations) c.consultations++;
      if (d.compteAbsents) c.absents++;
    });
    return c;
  }

  window.tabibiStatutRdv = {
    VALEURS: VALEURS.slice(),
    decrire: decrire,
    compter: compter,
    estConnu: function (b) { return decrire(b).connu; }
  };
})();
