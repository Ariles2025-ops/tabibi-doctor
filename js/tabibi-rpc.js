/* =====================================================================
 * tabibi-rpc.js — le point de passage unique des appels RPC
 * =====================================================================
 * Une reponse PostgREST a DEUX moities, et il faut lire les deux :
 *
 *   res.error       l'erreur de TRANSPORT   — reseau, 404, RLS, SQL qui leve
 *   res.data.error  l'erreur METIER          — la fonction a refuse, poliment
 *
 * Une fonction qui rend `{"error":"no_pending_invitation"}` a REUSSI au sens du
 * transport : `res.error` vaut null. Qui ne lit que cette moitie-la voit un
 * succes la ou la base a dit non.
 *
 * Mesure du 13/09/2026 : sur 44 RPC appelees, 8 peuvent rendre une erreur
 * metier, et DEUX sites ne lisaient que `.error` :
 *   signup.html:499                   -> compte secretaire cree en etat faux
 *   admin-doctor-validation.html:371  -> e-mail « fiche validee » envoye au
 *                                        medecin alors que rien n'etait valide
 *
 * CE QUE FAIT CE POINT DE PASSAGE. Il NORMALISE, il ne leve pas :
 *
 *   { ok: true,  data: <la reponse>, erreur: null }
 *   { ok: false, data: null,         erreur: '<cause>' }
 *
 * `data` vaut NULL des que `ok` est faux — et c'est le coeur du dispositif.
 * Normaliser sans cela n'obligerait personne a regarder `ok` ; avec, celui qui
 * l'ignore casse VISIBLEMENT au lieu de continuer sur un mensonge.
 *
 * Il n'impose pas la reaction. Lever aurait force les cinq sites qui lisent
 * DEJA correctement `data.error` — et qui en font un toast cible, pas une
 * exception — a s'entourer d'un try/catch pour retrouver leur comportement.
 * On aurait remplace cinq lectures justes par cinq catch, dont certains
 * seraient devenus muets : la faute d'a cote.
 *
 *   const r = await tabibiRpc('invite_cabinet_member', { ... });
 *   if (!r.ok) { toast(r.erreur, 'error'); return; }   // une COMMANDE qui echoue
 *   utiliser(r.data);
 *
 * UNE COMMANDE QUI ECHOUE ET UNE QUESTION QUI REPOND NON NE SONT PAS LA MEME
 * CHOSE. `can_review_doctor` qui dit non, `accept_cabinet_invitation` qui rend
 * `no_pending_invitation` sur un code deja consomme : ce sont des REPONSES, pas
 * des pannes. Elles arrivent en `ok:false` ici, ce qui est correct — mais
 * l'appelant les traite comme un resultat, jamais comme un incident. Lever
 * dessus fabriquerait des alertes qu'on finit par ignorer.
 * ===================================================================== */
(function () {
  'use strict';

  function client() {
    return (window.tabibi && window.tabibi.supabase) || null;
  }

  function cause(e) {
    if (!e) return 'erreur inconnue';
    if (typeof e === 'string') return e;
    return e.message || e.error_description || e.code || 'erreur inconnue';
  }

  /**
   * Appelle une RPC et rend { ok, data, erreur }.
   * `data` est null des que `ok` est faux : ignorer `ok` casse visiblement.
   */
  async function tabibiRpc(nom, args) {
    var sb = client();
    if (!sb) return { ok: false, data: null, erreur: 'client_indisponible' };

    var res;
    try {
      res = await sb.rpc(nom, args || {});
    } catch (e) {
      // Rejet du client : reseau coupe, jeton expire, RPC absente.
      if (window.tabibiErreur) window.tabibiErreur(e, 'tabibiRpc:' + nom);
      return { ok: false, data: null, erreur: cause(e) };
    }

    // Moitie 1 : le transport.
    if (res && res.error) {
      if (window.tabibiErreur) window.tabibiErreur(res.error, 'tabibiRpc:' + nom);
      return { ok: false, data: null, erreur: cause(res.error) };
    }

    // Moitie 2 : le metier. Une fonction peut refuser par `error`, par
    // `ok:false`, ou par les deux — on couvre les trois.
    var d = res ? res.data : null;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      if (d.error) return { ok: false, data: null, erreur: String(d.error) };
      if (d.ok === false) return { ok: false, data: null, erreur: 'refus' };
    }

    return { ok: true, data: d, erreur: null };
  }

  window.tabibiRpc = tabibiRpc;
})();
