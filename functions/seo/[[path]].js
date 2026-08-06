// functions/seo/[[path]].js
// =====================================================================
// Passe-plat sur /seo/* — neutralise une copie périmée servie par l'apex.
// ---------------------------------------------------------------------
// ⚠️ CE N'EST PAS UN CORRECTIF, C'EST UNE BARRIÈRE. Le mécanisme sous-jacent
// n'est pas identifié. Voir DEPLOY_FRONTEND.md § « À investiguer ».
//
// LE PROBLÈME (06/08/2026)
// Après la régénération des pages SEO (Phase 10.1), qui a supprimé 490 pages
// portant 891 patronymes réels, l'apex a continué de servir l'ancienne page
// sur /seo/alger-cardiologie — avec les noms — alors que :
//   • le fichier était absent du déploiement ;
//   • www.tabibi.doctor renvoyait 404 ;
//   • tabibi-doctor.pages.dev renvoyait 404 ;
//   • un Purge Everything ET une purge par préfixe /seo étaient sans effet.
//
// En-têtes de la réponse fautive :
//     HTTP 200
//     cf-cache-status: DYNAMIC          ← Cloudflare déclare ne pas servir du cache
//     age: 7201 et croissant            ← contradictoire avec DYNAMIC
//     cache-control: public, s-maxage=604800
//
// `s-maxage=604800` n'est émis par AUCUNE configuration actuelle : `_headers`
// pose `no-cache, no-store, must-revalidate` sur `/*.html`, Pages sert
// `public, max-age=0, must-revalidate`, et `netlify.toml` ne définit qu'un
// X-Robots-Tag. Cet en-tête est gravé dans l'objet périmé lui-même, hérité
// d'un hébergeur antérieur. C'est pourquoi la purge de zone est inopérante :
// l'objet ne réside pas dans le cache que le dashboard purge.
//
// Mesuré le 06/08/2026 — la même page, existante, sur les trois hôtes :
//     apex / www / pages.dev → 200, `public, max-age=0, must-revalidate`, pas d'age
// La divergence ne concerne QUE les chemins supprimés, et QUE l'apex.
//
// C'EST LA DEUXIÈME OCCURRENCE. Entre le 03 et le 04/08, l'apex a servi
// /supabase/functions/send-sms/index.ts en 200 avec exactement les mêmes
// en-têtes, la même immunité à la purge, et le même comportement au query
// string : 200 sans, 404 avec (reproductible six fois — vérifié à nouveau
// aujourd'hui sur /seo/alger-cardiologie). Le déploiement d'une Pages
// Function sur ce chemin l'avait rendu inobservable. On reproduit ici.
//
// POURQUOI UNE FUNCTION Y CHANGE QUELQUE CHOSE
// Les Pages Functions s'exécutent AVANT le service des assets statiques. Tout
// chemin sous /seo/ passe désormais par ce code, dont la réponse est
// construite à la volée : il n'existe plus d'asset statique à servir depuis
// une copie périmée. C'est empirique — la barrière a fonctionné pour
// /supabase/ — pas déduit d'un modèle du mécanisme.
//
// COÛT : une invocation de Worker par requête sur /seo/* (576 pages). Sous
// les quotas Pages. À retirer le jour où le mécanisme est compris et corrigé
// à sa racine.
//
// ⚠️ LES AUTRES CHEMINS RESTENT EXPOSÉS. Si un fichier est supprimé sous
// /blog/, /legal/ ou à la racine, la même copie périmée peut être servie
// pendant s-maxage = 7 jours. Aucune barrière n'existe là.
// =====================================================================

/** Statuts pour lesquels la spec interdit un corps de réponse. */
const BODYLESS = new Set([101, 204, 205, 304]);

export async function onRequest(context) {
  const { request } = context;

  // ── HEAD : résoudre via un GET interne ────────────────────────────
  // Mesuré le 06/08/2026, après le premier déploiement de cette barrière :
  // sur /seo/alger-cardiologie (supprimée), le GET renvoyait 404 douze fois
  // sur douze, mais le HEAD renvoyait 200 — `context.next()` remonte le
  // statut de la copie périmée pour cette méthode. Aucune fuite de données
  // (un HEAD n'a pas de corps), mais un 200 annonce à un outil d'audit que
  // l'URL existe, et le contrôle usuel `curl -sI` conclut à tort.
  // On résout donc le chemin par un GET, puis on renvoie la réponse
  // dépouillée de son corps — ce qu'un HEAD doit être.
  if (request.method === 'HEAD') {
    const probe = await context.next(new Request(request.url, {
      method: 'GET',
      headers: request.headers,
    }));
    const h = new Headers(probe.headers);
    h.delete('age');
    h.set('cache-control', probe.status === 200
      ? 'public, max-age=0, must-revalidate'
      : 'no-store');
    return new Response(null, { status: probe.status, statusText: probe.statusText, headers: h });
  }

  // Laisse Pages résoudre le chemin : asset réel, redirection 308 de
  // dépouillement du .html, ou page 404. On ne réimplémente pas ce routage.
  const res = await context.next();

  // Ne jamais reconstruire une réponse sans corps : le constructeur Response
  // lève une TypeError si on lui en passe un.
  if (BODYLESS.has(res.status)) return res;

  const headers = new Headers(res.headers);

  // `age` héritée d'un cache amont : la retirer évite qu'un intermédiaire la
  // réutilise pour calculer une fraîcheur qui n'a plus de sens.
  headers.delete('age');

  // En-tête de cache explicite, qui écrase tout `s-maxage` hérité.
  //   200 → cacheable mais revalidation obligatoire à chaque requête : un
  //         intermédiaire ne peut plus servir une copie sans nous demander.
  //   autre (404, 308…) → `no-store` : c'est la rétention d'un 404 ou d'une
  //         redirection périmée qui a créé le problème.
  headers.set('cache-control', res.status === 200
    ? 'public, max-age=0, must-revalidate'
    : 'no-store');

  // Garde-fou de dernier recours. Si une copie périmée franchissait malgré
  // tout cette barrière, elle porterait les anciennes pages nominatives. On
  // refuse alors de la servir plutôt que d'exposer des noms.
  // Les pages régénérées ne contiennent AUCUN patronyme : ce test ne peut pas
  // se déclencher sur une page légitime (vérifié sur les 576).
  const type = headers.get('content-type') || '';
  if (res.status === 200 && type.includes('text/html')) {
    const body = await res.text();
    if (/<h3[^>]*itemprop="name"[^>]*>|schema\.org\/Physician/.test(body)) {
      console.error('[seo] copie perimee nominative interceptee:', new URL(context.request.url).pathname);
      return new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return new Response(body, { status: res.status, statusText: res.statusText, headers });
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
