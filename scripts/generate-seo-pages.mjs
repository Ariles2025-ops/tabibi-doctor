#!/usr/bin/env node
/**
 * generate-seo-pages.mjs — régénération des pages SEO locales (Phase 10.1)
 * =====================================================================
 * Outil de build. Ne fait PARTIE D'AUCUN bundle servi au navigateur.
 *
 *     node scripts/generate-seo-pages.mjs [--dry-run]
 *
 * ---------------------------------------------------------------------
 * POURQUOI CE SCRIPT EXISTE
 *
 * Les pages SEO générées avant août 2026 affichaient le NOM RÉEL de chaque
 * praticien — 891 patronymes distincts sur 490 pages — alors qu'aucun de ces
 * praticiens n'avait consenti à quoi que ce soit : les fiches proviennent d'un
 * fonds de sources publiques, et au 06/08/2026 la base compte
 * **0 fiche revendiquée sur 75 034**. C'est la raison du garde-fou
 * `Disallow: /seo/` posé en phase 2 dans robots.txt.
 *
 * ⚠️ Le commentaire de PROGRESS.md qui affirmait que la vue `public_doctors`
 * « retourne des noms anonymisés si is_claimed=false » était FAUX. Vérifié le
 * 06/08/2026 sur la définition de la vue :
 *     COALESCE(NULLIF(TRIM(dp.full_name), ''), 'Praticien') AS full_name
 * La vue masque `address`, `latitude` et `longitude` pour les fiches non
 * revendiquées — jamais le nom. Régénérer « depuis public_doctors » sans plus
 * de précaution aurait reproduit exactement les mêmes 891 noms.
 *
 * L'anonymisation est donc faite ICI, et elle est totale : ce script
 * n'écrit AUCUN nom de praticien dans les pages. Il ne produit que des
 * AGRÉGATS (comptages, répartition par commune), qui ne sont pas des données
 * à caractère personnel.
 *
 * ---------------------------------------------------------------------
 * DEUX AFFIRMATIONS FAUSSES SUPPRIMÉES AU PASSAGE
 *
 * Les anciennes pages affichaient « N praticiens certifiés » et « Tous
 * certifiés Tabibi », et un bouton « Prendre RDV » par praticien. Or au
 * 06/08/2026 : `is_verified` = 0 sur 75 034 fiches, `is_claimed` = 0, et
 * aucun de ces praticiens n'est joignable via la plateforme. Les deux
 * mentions étaient donc fausses, et le bouton menait à une impasse.
 * `docs/marketing/STRATEGIE_CONTENU.md` §6 interdit explicitement les
 * « promesses commerciales irréalistes ». Ne pas les réintroduire.
 *
 * ---------------------------------------------------------------------
 * SI UN JOUR DES FICHES SONT REVENDIQUÉES
 *
 * Un médecin qui signe le Contrat de Partenariat concède à Tabibi (article
 * 8.2) une licence d'affichage de ses données. Son nom devient alors
 * publiable. Le jour où `is_claimed` cesse d'être à zéro, ce script pourra
 * lister nominativement les SEULES fiches `is_claimed = true AND
 * validation_status = 'approved'` — voir CLAIMED_ONLY plus bas, qui isole
 * déjà ce filtre. Toute autre fiche reste anonyme.
 */

import { writeFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'seo');
const SITEMAP = join(ROOT, 'sitemaps', 'sitemap-seo-local.xml');
const BASE = 'https://tabibi.doctor';
const DRY = process.argv.includes('--dry-run');

/** Seuil de publication. En dessous, la page n'a pas assez de matière pour
 *  justifier une URL indexable — mieux vaut 576 pages utiles que 1 211 pages
 *  dont la moitié annonce « 3 praticiens » sans autre contenu. */
const MIN_PRACTITIONERS = 10;

/** Entrées du fonds qui ne sont pas des praticiens : pharmacies, opticiens,
 *  laboratoires, structures hospitalières. Elles représentent 42 144 des
 *  75 034 fiches et n'ont rien à faire sur une page « Médecin X à Y ».
 *  `autre` (22 095 fiches) est exclu car la spécialité n'y est pas qualifiée. */
const NON_PRACTITIONER = new Set([
  'autre', 'pharmacie', 'opticien', 'laboratoire',
  'hopital', 'clinique-privee', 'centre-sante',
]);

/** Filtre à appliquer le jour où l'on voudra afficher des noms. Voir en-tête. */
const CLAIMED_ONLY = (d) => d.is_claimed === true && d.validation_status === 'approved';

// ── Couleurs de marque (CLAUDE.md) ───────────────────────────────────
// Les anciennes pages utilisaient un vert #047857/#10b981 sans rapport avec
// l'identité. Or et encre sont les couleurs de marque à préserver.
const GOLD = '#d4a437';
const INK = '#556070';

// ─────────────────────────────────────────────────────────────────────
// Récupération des données
// ─────────────────────────────────────────────────────────────────────

/** Lit URL et clé anon depuis js/config.js — la clé anon est publique par
 *  conception (elle est servie à chaque visiteur). Aucun secret ici : la
 *  service_role key ne doit JAMAIS apparaître dans ce script (CLAUDE.md règle 4). */
async function readConfig() {
  const src = await readFile(join(ROOT, 'js', 'config.js'), 'utf8');
  const url = src.match(/SUPABASE_URL:\s*'([^']+)'/)?.[1];
  const key = src.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)?.[1];
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY introuvables dans js/config.js');
  return { url, key };
}

/** [C1 2026-09-09] La vue public_doctors n'est plus lisible par la clé anon.
 *  La RPC seo_couples() renvoie l'agrégat (wilaya, spécialité, commune, n) :
 *  ~6 300 lignes au lieu de 75 034, et aucun nom ne transite. */
async function fetchAll({ url, key }) {
  const res = await fetch(`${url}/rest/v1/rpc/seo_couples`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`PostgREST ${res.status} : ${await res.text()}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('seo_couples : réponse inattendue');
  process.stdout.write(`  ${rows.length} couples (wilaya, spécialité, commune) lus\n`);
  return rows;
}

/** Agrège en couples (wilaya, spécialité). Aucun nom ne survit à cette étape. */
function aggregate(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.wilaya_fr || !r.specialty_slug) continue;
    if (NON_PRACTITIONER.has(r.specialty_slug)) continue;
    const k = `${r.wilaya_code}|${r.specialty_slug}`;
    let e = map.get(k);
    if (!e) {
      e = {
        wilaya_code: r.wilaya_code, wilaya_fr: r.wilaya_fr,
        specialty_slug: r.specialty_slug, specialty_fr: r.specialty_fr,
        n: 0, cities: new Map(),
      };
      map.set(k, e);
    }
    const n = Number(r.n) || 0;          // effectif du couple (agrégé côté SQL)
    e.n += n;
    const city = (r.city || '').trim();
    if (city) e.cities.set(city, (e.cities.get(city) || 0) + n);
  }
  return [...map.values()]
    .filter((e) => e.n >= MIN_PRACTITIONERS)
    .map((e) => {
      const cities = [...e.cities.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
        .slice(0, 12)
        .map(([city, cn]) => ({ city, cn }));
      // Nombre de praticiens dont la commune est connue — sert à ne jamais
      // présenter une répartition partielle comme si elle était complète.
      const known = [...e.cities.values()].reduce((a, b) => a + b, 0);
      return { ...e, cities, known };
    })
    .sort((a, b) => a.wilaya_fr.localeCompare(b.wilaya_fr, 'fr')
      || a.specialty_fr.localeCompare(b.specialty_fr, 'fr'));
}

// ─────────────────────────────────────────────────────────────────────
// Rendu
// ─────────────────────────────────────────────────────────────────────

const slug = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/['’]/g, '-')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Les noms de wilaya algériens ne prennent pas d'article : « à Alger ». */
const at = (w) => `à ${w}`;

/** Élision du « de » devant voyelle : « la wilaya d'Alger », pas « de Alger ».
 *  Le h de « Hassi » etc. est aspiré en usage algérien courant — on ne l'élide
 *  donc pas. Testé sur les 48 wilayas produites. */
const of_ = (w) => (/^[aeiouyàâäéèêëîïôöûü]/i.test(w) ? `d'${w}` : `de ${w}`);

/** Nom de la DISCIPLINE, pas du praticien : on ne peut pas écrire « réservables
 *  en cardiologue ». Faute de table des disciplines en base, on ne tente aucune
 *  dérivation morphologique (cardiologue→cardiologie marcherait, mais
 *  dentiste→dentisterie ou sage-femme→? non) : les formulations du template
 *  sont construites pour n'employer que le nom du praticien. */

function faq(e) {
  const spec = e.specialty_fr.toLowerCase();
  return [
    {
      q: `Comment prendre rendez-vous avec un ${spec} ${at(e.wilaya_fr)} ?`,
      a: `Tabibi permet de réserver en ligne auprès des praticiens inscrits sur la plateforme. `
       + `L'inscription des ${spec}s ${of_(e.wilaya_fr)} est en cours : tant qu'un praticien n'a pas `
       + `rejoint Tabibi, sa fiche est présente dans l'annuaire mais la réservation en ligne n'est `
       + `pas encore disponible pour lui. Utilisez la recherche pour voir les praticiens réservables aujourd'hui.`,
    },
    {
      q: `Combien de ${spec}s exercent ${at(e.wilaya_fr)} ?`,
      a: `Notre annuaire recense ${e.n} ${spec}s dans la wilaya ${of_(e.wilaya_fr)}, à partir de sources `
       + `publiques. Ce nombre reflète notre fonds documentaire et non un recensement officiel : il peut `
       + `comporter des fiches obsolètes ou en omettre. Toute correction peut nous être signalée.`,
    },
    {
      q: `Quel est le tarif d'une consultation de ${spec} ${at(e.wilaya_fr)} ?`,
      a: `Tabibi ne publie pas de tarif pour ces praticiens : l'information n'est pas disponible dans `
       + `notre fonds. Les tarifs affichés sur la plateforme le sont uniquement par les médecins qui ont `
       + `rejoint Tabibi et renseigné eux-mêmes leur fiche. Renseignez-vous directement auprès du cabinet.`,
    },
    {
      q: `Je suis ${spec} ${at(e.wilaya_fr)} — comment reprendre la main sur ma fiche ?`,
      a: `Votre fiche vous appartient. Écrivez-nous sur WhatsApp au +213 777 169 074 avec votre nom : `
       + `après vérification de votre carte de l'Ordre des Médecins, nous vous remettons le contrôle de `
       + `votre fiche. Le service est gratuit, sans engagement et sans exclusivité, et Tabibi ne perçoit `
       + `aucune commission sur vos honoraires.`,
    },
  ];
}

function render(e, siblings, others) {
  // URL SANS extension : Cloudflare Pages sert /seo/x.html en 308 vers /seo/x.
  // Declarer le .html ferait pointer canonical, og:url et sitemap vers une URL
  // qui redirige — Google suit, mais chaque URL coute un saut et la canonique
  // designe alors une adresse qui n'est pas celle servie. Les FICHIERS restent
  // ecrits en .html : c'est l'hote qui masque l'extension, pas nous.
  const url = `${BASE}/seo/${e.slug}`;
  const spec = e.specialty_fr.toLowerCase();
  const title = `${e.specialty_fr} ${at(e.wilaya_fr)} — annuaire et prise de rendez-vous | Tabibi`;
  const desc = `${e.n} ${spec}s recensés dans la wilaya ${of_(e.wilaya_fr)}. `
    + `Consultez l'annuaire Tabibi et réservez en ligne auprès des praticiens inscrits.`;
  const F = faq(e);

  // Répartition par commune — affichée seulement si elle porte sur une part
  // significative, et TOUJOURS accompagnée de son taux de couverture.
  const showCities = e.cities.length > 0 && e.known >= 3;
  const citiesBlock = !showCities ? '' : `
  <section class="block">
    <h2>Où exercent-ils dans la wilaya ${esc(of_(e.wilaya_fr))} ?</h2>
    <p class="note">Répartition établie sur les <strong>${e.known}</strong> fiches
    ${e.known < e.n ? `(sur ${e.n}) ` : ''}dont la commune est renseignée dans notre fonds.</p>
    <ul class="cities">
      ${e.cities.map((c) => `<li><span>${esc(c.city)}</span><b>${c.cn}</b></li>`).join('\n      ')}
    </ul>
  </section>`;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: F.map((f) => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  // CollectionPage et non MedicalBusiness : cette page est une page d'annuaire
  // éditée par Tabibi, pas un établissement de santé situé dans la wilaya.
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title, description: desc, url,
    inLanguage: 'fr',
    isPartOf: { '@type': 'WebSite', name: 'Tabibi', url: BASE },
    about: { '@type': 'Thing', name: `${e.specialty_fr} — ${e.wilaya_fr}, Algérie` },
    publisher: { '@type': 'Organization', name: 'Tabibi', url: BASE },
  };
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: e.wilaya_fr, item: `${BASE}/wilayas.html#${slug(e.wilaya_fr)}` },
      { '@type': 'ListItem', position: 3, name: e.specialty_fr, item: url },
    ],
  };

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="fr_DZ">
<link rel="alternate" hreflang="fr-DZ" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<style>
:root{--gold:${GOLD};--ink:${INK}}
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#fbfaf8;color:var(--ink);line-height:1.6}
.container{max-width:880px;margin:0 auto;padding:0 20px}
header.top{background:#fff;border-bottom:1px solid #ece7dd;padding:14px 0}
header.top a{color:var(--ink);text-decoration:none;font-weight:600;font-size:14px}
header.top a.brand{color:var(--gold);font-weight:800;font-size:18px}
header.top .sep{color:#cfc7ba;margin:0 8px}
nav.crumb{font-size:13px;color:#8b8378;margin:18px 0 6px}
nav.crumb a{color:var(--gold);text-decoration:none}
h1{font-size:30px;line-height:1.25;margin:6px 0 10px;color:#3d4550}
h2{font-size:19px;margin:0 0 10px;color:#3d4550}
.lede{font-size:17px;margin:0 0 6px}
.count{font-weight:700;color:var(--gold)}
.block{background:#fff;border:1px solid #ece7dd;border-radius:12px;padding:20px;margin:20px 0}
.note{font-size:13px;color:#8b8378;margin:0 0 12px}
ul.cities{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
ul.cities li{display:flex;justify-content:space-between;background:#fbfaf8;border:1px solid #f0ebe2;border-radius:8px;padding:8px 12px;font-size:14px}
ul.cities b{color:var(--gold)}
.cta{background:#fff;border:2px solid var(--gold);border-radius:12px;padding:22px;margin:24px 0;text-align:center}
.cta p{margin:0 0 14px}
.btn{display:inline-block;background:var(--gold);color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:4px}
.btn.ghost{background:#fff;color:var(--ink);border:1px solid #ddd5c8}
details{border-top:1px solid #f0ebe2;padding:12px 0}
details:first-of-type{border-top:0}
summary{cursor:pointer;font-weight:600;color:#3d4550}
details p{margin:10px 0 0;font-size:15px}
.links{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}
.links ul{list-style:none;padding:0;margin:0;font-size:14px}
.links li{margin:6px 0}
.links a{color:var(--gold);text-decoration:none}
.links a:hover{text-decoration:underline}
footer{border-top:1px solid #ece7dd;margin-top:32px;padding:20px 0;font-size:13px;color:#8b8378}
footer a{color:var(--gold);text-decoration:none}
@media(max-width:600px){.links{grid-template-columns:1fr}h1{font-size:24px}}
</style>
<script type="application/ld+json">${JSON.stringify(pageLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
<header class="top"><div class="container">
  <a class="brand" href="${BASE}/">Tabibi</a><span class="sep">·</span>
  <a href="${BASE}/specialites.html">Spécialités</a><span class="sep">·</span>
  <a href="${BASE}/wilayas.html">Wilayas</a>
</div></header>
<main class="container">
  <nav class="crumb">
    <a href="${BASE}/">Accueil</a> &rsaquo;
    <a href="${BASE}/wilayas.html#${slug(e.wilaya_fr)}">${esc(e.wilaya_fr)}</a> &rsaquo;
    <span>${esc(e.specialty_fr)}</span>
  </nav>

  <h1>${esc(e.specialty_fr)} ${at(esc(e.wilaya_fr))}</h1>
  <p class="lede">Notre annuaire recense <span class="count">${e.n} ${esc(spec)}s</span>
  dans la wilaya ${esc(of_(e.wilaya_fr))}.</p>
  <p class="note">Ces fiches sont constituées à partir de sources publiques. Elles ne
  constituent ni un recensement officiel, ni une recommandation, ni un classement. Les
  praticiens ayant rejoint Tabibi gèrent eux-mêmes leur fiche et sont réservables en ligne.</p>
${citiesBlock}

  <div class="cta">
    <p><strong>Prendre rendez-vous en ligne</strong><br>
    Consultez les ${esc(spec)}s réservables aujourd'hui ${at(esc(e.wilaya_fr))}.</p>
    <a class="btn" href="${BASE}/index.html?specialty=${encodeURIComponent(e.specialty_slug)}&amp;wilaya=${encodeURIComponent(slug(e.wilaya_fr))}">Voir les disponibilités</a>
  </div>

  <section class="block">
    <h2>Questions fréquentes</h2>
    ${F.map((f) => `<details>
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join('\n    ')}
  </section>

  <div class="cta">
    <p><strong>Vous exercez ${at(esc(e.wilaya_fr))} ?</strong><br>
    Reprenez le contrôle de votre fiche : gratuit, sans engagement, sans exclusivité,
    et sans aucune commission sur vos honoraires.</p>
    <a class="btn" href="${BASE}/signup.html?role=medecin">Revendiquer ma fiche</a>
    <a class="btn ghost" href="https://wa.me/213777169074">Nous écrire sur WhatsApp</a>
  </div>

  <div class="links">
    <div>
      <h2>Autres spécialités ${at(esc(e.wilaya_fr))}</h2>
      <ul>${siblings.map((s) => `<li><a href="${BASE}/seo/${s.slug}">${esc(s.specialty_fr)} ${at(esc(e.wilaya_fr))}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2>${esc(e.specialty_fr)} dans d'autres wilayas</h2>
      <ul>${others.map((o) => `<li><a href="${BASE}/seo/${o.slug}">${esc(e.specialty_fr)} ${at(esc(o.wilaya_fr))}</a></li>`).join('')}</ul>
    </div>
  </div>
</main>
<footer><div class="container">
  <a href="${BASE}/">Tabibi</a> — plateforme algérienne de prise de rendez-vous médical.
  <a href="${BASE}/legal/mentions-legales.html">Mentions légales</a> ·
  <a href="${BASE}/legal/confidentialite.html">Confidentialité</a><br>
  Une fiche vous concerne et vous souhaitez sa correction ou sa suppression ?
  Écrivez à <a href="mailto:dpo@tabibi.doctor">dpo@tabibi.doctor</a>.
</div></footer>
</body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

const cfg = await readConfig();
console.log('→ lecture de l’agrégat seo_couples()…');
const rows = await fetchAll(cfg);

const entries = aggregate(rows);
// Slug des DEUX composants : `specialty_slug` vaut « ORL » en base, et une URL
// à casse mixte se traduit par des doublons d'indexation.
for (const e of entries) e.slug = `${slug(e.wilaya_fr)}-${slug(e.specialty_slug)}`;

// Garde-fou anti-collision : deux couples ne doivent jamais viser le même fichier.
const seen = new Map();
for (const e of entries) {
  if (seen.has(e.slug)) throw new Error(`collision de slug : ${e.slug}`);
  seen.set(e.slug, e);
}

const byWilaya = new Map();
const bySpecialty = new Map();
for (const e of entries) {
  if (!byWilaya.has(e.wilaya_fr)) byWilaya.set(e.wilaya_fr, []);
  byWilaya.get(e.wilaya_fr).push(e);
  if (!bySpecialty.has(e.specialty_slug)) bySpecialty.set(e.specialty_slug, []);
  bySpecialty.get(e.specialty_slug).push(e);
}

console.log(`→ ${entries.length} pages à produire `
  + `(${entries.reduce((a, e) => a + e.n, 0)} praticiens, `
  + `${byWilaya.size} wilayas, ${bySpecialty.size} spécialités)`);

if (DRY) {
  console.log('→ --dry-run : rien n\'est écrit.');
  console.log(entries.slice(0, 5).map((e) => `   ${e.slug}.html  (${e.n} praticiens, ${e.cities.length} communes)`).join('\n'));
  process.exit(0);
}

// Purge des anciennes pages. Elles portent 891 noms réels : les laisser en
// place reviendrait à ne rien avoir corrigé. Elles restent récupérables dans
// l'historique git.
await mkdir(OUT_DIR, { recursive: true });
const old = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.html'));
for (const f of old) await unlink(join(OUT_DIR, f));
console.log(`→ ${old.length} anciennes pages supprimées`);

let written = 0;
for (const e of entries) {
  const siblings = (byWilaya.get(e.wilaya_fr) || [])
    .filter((s) => s.slug !== e.slug).slice(0, 10);
  const others = (bySpecialty.get(e.specialty_slug) || [])
    .filter((o) => o.slug !== e.slug)
    .sort((a, b) => b.n - a.n).slice(0, 10);
  await writeFile(join(OUT_DIR, `${e.slug}.html`), render(e, siblings, others), 'utf8');
  written++;
}
console.log(`→ ${written} pages écrites dans seo/`);

// Sitemap — regénéré depuis la liste réelle, jamais tenu à la main.
// L'ancien sitemap déclarait 450 URL pour 490 fichiers présents : un sitemap
// écrit séparément des pages diverge toujours.
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${BASE}/seo/${e.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>
`;
await mkdir(dirname(SITEMAP), { recursive: true });
await writeFile(SITEMAP, xml, 'utf8');
console.log(`→ sitemap-seo-local.xml regénéré (${entries.length} URL)`);

// Contrôle final : aucun nom ne doit avoir fui dans les pages produites.
const suspicious = [];
for (const e of entries) {
  const html = await readFile(join(OUT_DIR, `${e.slug}.html`), 'utf8');
  if (/\bDr[.\s]|\bPr[.\s]|itemtype="https:\/\/schema\.org\/Physician"/.test(html)) {
    suspicious.push(e.slug);
  }
}
if (suspicious.length) {
  console.error(`✗ ÉCHEC : ${suspicious.length} pages contiennent un motif nominatif`);
  console.error(suspicious.slice(0, 10).join(', '));
  process.exit(1);
}
console.log('✓ contrôle anti-nom : aucune occurrence de « Dr »/« Pr »/Physician');
