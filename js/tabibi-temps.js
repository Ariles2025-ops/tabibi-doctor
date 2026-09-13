/* =====================================================================
 * tabibi-temps.js — INSTANT et JOUR CALENDAIRE sont deux types differents
 * =====================================================================
 * Un rendez-vous a lieu a un INSTANT. Des horaires d'ouverture portent sur un
 * JOUR CALENDAIRE. Tout bug de fuseau nait a l'endroit ou l'un est converti en
 * l'autre par `new Date()`.
 *
 * Mesure du 13/09/2026 : les neuf colonnes de temps de `appointments` sont
 * TOUTES en `timestamp with time zone`, le serveur est en UTC, et AUCUNE
 * colonne de fuseau n'existe nulle part. Le defaut etait donc 100 % dans
 * l'affichage — rien a migrer.
 *
 * Ce que faisait le code : `dt.toISOString().split('T')[0]` pour la date, et
 * `dt.getHours()` pour l'heure, sur le meme objet. La date sortait en UTC,
 * l'heure dans le fuseau du navigateur. A Paris, un rendez-vous a 00h30 heure
 * d'Alger s'affichait « mardi 15, 01:30 » au lieu de « mercredi 16, 00:30 » :
 * un jour d'ecart. Le fuseau n'y etait pour rien — c'est le MELANGE.
 *
 * Deux chemins, et deux seulement :
 *
 *   instant(v)        une valeur `timestamptz` venue de la base. Toujours
 *                     rendue dans le fuseau du CABINET. Seul chemin autorise
 *                     pour l'heure et la date d'un rendez-vous.
 *
 *   jourCalendaire(s) une chaine 'YYYY-MM-DD' qui designe un jour, pas un
 *                     instant. Aucun fuseau applique, et JAMAIS de `new Date()`
 *                     sur la chaine : la date est lue par composantes.
 *
 * La garde qui empeche la rechute : scripts/verifier-fuseau.mjs.
 * ===================================================================== */
(function () {
  'use strict';

  /* Le fuseau du CABINET — pas « le fuseau », pas celui du navigateur, pas
   * celui du serveur. Aujourd'hui tous les cabinets sont en Algerie, qui est a
   * UTC+1 sans heure d'ete. On ne code surtout pas « +1 » : le jour ou un
   * deuxieme pays arrive, ceci devient une colonne de `doctor_profiles` et
   * cette constante devient sa valeur par defaut.
   *
   * ATTENTION, DEUX COUCHES. La meme regle vit aussi en SQL, ou 'Africa/Algiers'
   * est ecrit en dur dans get_available_slots (PHASE5_1bis), la garde de
   * disponibilite (20260912_garde_disponibilite_rdv) et le trigger de
   * notifications (NOTIF_step1_event_triggers). Le jour ou le fuseau devient
   * une colonne, il faudra corriger LES DEUX couches, pas celle-ci seulement. */
  var FUSEAU_CABINET = 'Africa/Algiers';

  function locale() {
    var l = 'fr';
    try { l = (window.tabibiLang && window.tabibiLang.get()) || localStorage.getItem('tabibi_lang') || 'fr'; } catch { /* pas de storage : la langue reste 'fr' */ }
    return l === 'ar' ? 'ar-DZ-u-nu-latn' : (l === 'en' ? 'en-GB' : 'fr-FR');
  }

  var _cache = {};
  function fmt(loc, opts) {
    var cle = loc + '|' + JSON.stringify(opts);
    if (!_cache[cle]) _cache[cle] = new Intl.DateTimeFormat(loc, opts);
    return _cache[cle];
  }

  function versDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (v == null || v === '') return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // ---------------------------------------------------------------- INSTANT

  /** Le jour calendaire d'un instant, DANS LE FUSEAU DU CABINET. 'YYYY-MM-DD'.
   *  Remplace `dt.toISOString().split('T')[0]`, qui rendait le jour UTC. */
  function jourDe(v) {
    var d = versDate(v);
    if (!d) return '';
    var p = fmt('en-CA', { timeZone: FUSEAU_CABINET, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    return p.year + '-' + p.month + '-' + p.day;
  }

  /** L'heure d'un instant, DANS LE FUSEAU DU CABINET. 'HH:MM'.
   *  Remplace `getHours()`/`getMinutes()`, qui rendaient l'heure du navigateur. */
  function heureDe(v) {
    var d = versDate(v);
    if (!d) return '';
    return fmt('en-GB', { timeZone: FUSEAU_CABINET, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }

  /** Un instant, formate dans le fuseau du cabinet. */
  function instant(v, options) {
    var d = versDate(v);
    if (!d) return '';
    var o = {};
    var src = options || { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) o[k] = src[k];
    o.timeZone = FUSEAU_CABINET;   // jamais surchargeable : c'est le point de la fonction
    return fmt(locale(), o).format(d);
  }

  /** Aujourd'hui, dans le fuseau du cabinet. 'YYYY-MM-DD'.
   *  Remplace `new Date().toISOString().split('T')[0]`. */
  function aujourdhui() { return jourDe(new Date()); }

  // -------------------------------------------------------- JOUR CALENDAIRE

  var RE_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** Formate une chaine 'YYYY-MM-DD'. AUCUN fuseau : un jour calendaire n'en a
   *  pas. On passe par Date.UTC + timeZone UTC pour que le rendu soit le meme
   *  partout — c'est un calcul, pas une conversion. */
  function jourCalendaire(s, options) {
    var m = RE_JOUR.exec(String(s || '').slice(0, 10));
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var o = {};
    var src = options || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) o[k] = src[k];
    o.timeZone = 'UTC';
    return fmt(locale(), o).format(d);
  }

  /* Le decalage du fuseau du cabinet, en millisecondes, A UN INSTANT DONNE.
   * Calcule, jamais code en dur : le jour ou le cabinet sera ailleurs qu'en
   * Algerie, un fuseau a heure d'ete fonctionnera sans changer une ligne. */
  function decalageCabinet(d) {
    var p = fmt('en-CA', {
      timeZone: FUSEAU_CABINET, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    var mur = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return mur - d.getTime();
  }

  /** Un JOUR CALENDAIRE + une HEURE MURALE du cabinet -> un INSTANT ISO (UTC).
   *  Remplace `new Date(jour + 'T' + heure).toISOString()`, qui interpretait
   *  l'heure dans le fuseau du NAVIGATEUR : depuis Paris, un RDV saisi a 09:00
   *  partait a 07:00 UTC, soit 08:00 heure cabinet. Une ECRITURE fausse. */
  function instantDepuisJourEtHeure(jour, heure) {
    var m = RE_JOUR.exec(String(jour || '').slice(0, 10));
    var t = /^(\d{1,2}):(\d{2})/.exec(String(heure || ''));
    if (!m || !t) return '';
    var brut = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
    // Deux passes : la premiere corrige le decalage, la seconde le verifie a
    // l'instant corrige (utile aux frontieres de changement d'heure).
    var i = brut - decalageCabinet(new Date(brut));
    i = brut - decalageCabinet(new Date(i));
    return new Date(i).toISOString();
  }

  /** Arithmetique sur un jour calendaire, sans derive de fuseau. */
  function ajouterJours(s, n) {
    var m = RE_JOUR.exec(String(s || '').slice(0, 10));
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + (n | 0));
    return d.toISOString().slice(0, 10);
  }

  /** Jour de la semaine d'un jour calendaire : 0 dimanche … 6 samedi. */
  function jourSemaine(s) {
    var m = RE_JOUR.exec(String(s || '').slice(0, 10));
    if (!m) return -1;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  }

  /** Le lundi de la semaine d'un jour calendaire. */
  function lundiDe(s) {
    var j = jourSemaine(s);
    if (j < 0) return '';
    return ajouterJours(s, j === 0 ? -6 : 1 - j);
  }

  window.tabibiTemps = {
    FUSEAU_CABINET: FUSEAU_CABINET,
    instant: instant,
    jourDe: jourDe,
    heureDe: heureDe,
    aujourdhui: aujourdhui,
    jourCalendaire: jourCalendaire,
    instantDepuisJourEtHeure: instantDepuisJourEtHeure,
    ajouterJours: ajouterJours,
    jourSemaine: jourSemaine,
    lundiDe: lundiDe
  };
})();
