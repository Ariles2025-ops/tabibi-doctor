// functions/seo/[[path]].js
// =====================================================================
// Barrière sur /seo/* — intercepte une copie périmée servie par la couche
// d'assets de Cloudflare Pages elle-même.
// ---------------------------------------------------------------------
// LE MÉCANISME — identifié le 06/08/2026, après deux mois d'observations
// contradictoires consignées dans DEPLOY_FRONTEND.md § « À investiguer ».
//
//   La couche d'assets de Cloudflare Pages continue de servir un fichier
//   SUPPRIMÉ du déploiement, pour l'URL exacte SANS query string — et cette
//   copie reste atteignable DEPUIS L'INTÉRIEUR d'une Pages Function, via
//   `context.next()`.
//
// Ce n'est donc ni le cache de zone, ni un Worker, ni le service worker.
// C'est pourquoi :
//   • Purge Everything et purge par préfixe sont sans effet — l'objet ne
//     réside pas dans le cache que le dashboard purge ;
//   • `?<n_importe_quoi>` renvoie 404 — la query string fait manquer
//     l'entrée périmée (comportement noté « reproductible six fois » en
//     août pour /supabase/, revérifié ici) ;
//   • www.tabibi.doctor et tabibi-doctor.pages.dev renvoient 404 — chaque
//     hostname a ses propres entrées, et les leurs sont correctes ;
//   • la barrière posée en août sur /supabase/ a « fonctionné » : cette
//     Function-là est un 404 sec qui n'appelle JAMAIS `context.next()`.
//     Elle n'a pas contourné le mécanisme, elle a évité de le solliciter.
//
// En-têtes de la réponse fautive, mesurés sur /seo/alger-cardiologie :
//     HTTP 200 · cf-cache-status: DYNAMIC · age: 7406 croissant
//     cache-control: public, s-maxage=604800
// `s-maxage=604800` n'est émis par AUCUNE configuration actuelle : `_headers`
// pose `no-cache, no-store, must-revalidate` sur `/*.html`, Pages sert
// `public, max-age=0, must-revalidate`. L'en-tête est gravé dans l'objet
// périmé, hérité d'un hébergeur antérieur — 7 jours de rétention.
//
// CE QUE FAIT CETTE FUNCTION
// Elle ne peut pas empêcher `context.next()` de renvoyer la copie périmée.
// Elle INSPECTE donc la réponse : toute page HTML portant les marqueurs des
// anciennes fiches nominatives est convertie en 404 au lieu d'être servie.
// C'est un filtre de sortie, pas une correction de la couche d'assets.
//
// POURQUOI CE FILTRE EST SÛR
// Les 576 pages régénérées ne contiennent aucun `itemprop="name"` ni
// `schema.org/Physician` — vérifié sur les 576. L'ancienne page en portait
// 20 de chaque. Aucun faux positif possible.
//
// ⚠️ LES AUTRES CHEMINS RESTENT EXPOSÉS. Tout fichier supprimé sous /blog/,
// /legal/ ou à la racine peut être servi pendant s-maxage = 7 jours, sans
// aucune barrière. La règle qui en découle : **ne jamais supprimer un
// fichier public contenant des données personnelles en comptant sur le
// déploiement pour le faire disparaître.** Le remplacer par un contenu vide
// de même nom est sûr ; le supprimer ne l'est pas.
//
// COÛT : une invocation par requête sur /seo/* (576 pages), sous les quotas.
// À retirer quand la couche d'assets aura cessé de servir la copie périmée —
// vérifiable en testant que `/seo/alger-cardiologie?x=1` et `/seo/alger-
// cardiologie` renvoient tous deux la page 404 de 7 352 octets, et non le
// « Not Found » de 9 octets émis ici.
// =====================================================================

/** Statuts pour lesquels la spec interdit un corps de réponse. */
const BODYLESS = new Set([101, 204, 205, 304]);

/** Marqueurs des anciennes fiches nominatives. Chaque praticien y était rendu
 *  par un `<article class="doc-card" itemscope itemtype=".../Physician">`
 *  contenant `<h3 itemprop="name">`. Les pages actuelles n'en ont aucun. */
const NOMINATIVE = /<h3[^>]*itemprop="name"[^>]*>|schema\.org\/Physician/;

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const isHead = request.method === 'HEAD';

  // Résoudre TOUJOURS par un GET, y compris pour un HEAD.
  // Mesuré le 06/08 : sur /seo/alger-cardiologie, `context.next()` renvoyait
  // 404 en GET (le filtre ci-dessous ayant fait son travail) mais 200 en HEAD,
  // parce qu'un HEAD n'a pas de corps à inspecter — le filtre était aveugle.
  // Un `curl -sI` concluait donc que la page était toujours servie.
  const res = isHead
    ? await context.next(new Request(request.url, { method: 'GET', headers: request.headers }))
    : await context.next();

  if (BODYLESS.has(res.status)) return res;

  const headers = new Headers(res.headers);

  // `age` héritée de l'amont : la retirer évite qu'un intermédiaire s'en serve
  // pour calculer une fraîcheur qui n'a plus de sens.
  headers.delete('age');

  // En-tête de cache explicite, qui écrase tout `s-maxage` hérité.
  headers.set('cache-control', res.status === 200
    ? 'public, max-age=0, must-revalidate'
    : 'no-store');

  const type = headers.get('content-type') || '';

  // Seul cas à inspecter : une page HTML servie en 200.
  if (res.status === 200 && type.includes('text/html')) {
    const body = await res.text();
    if (NOMINATIVE.test(body)) {
      console.error('[seo] copie perimee nominative interceptee:',
        request.method, new URL(request.url).pathname);
      return notFound();
    }
    // HEAD : même statut, mêmes en-têtes, sans corps.
    return new Response(isHead ? null : body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return new Response(isHead ? null : res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
