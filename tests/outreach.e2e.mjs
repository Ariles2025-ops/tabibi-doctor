/**
 * Test navigateur de bout en bout de tools/outreach.html (Chromium réel).
 *
 *   npm i --no-save playwright-core
 *   node tests/outreach.e2e.mjs
 *
 * Variables d'environnement :
 *   CHROMIUM   chemin de l'exécutable (défaut : /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
 *   CDN_DIR    dossier contenant papaparse.min.js et xlsx.full.min.js — servis en
 *              local à la place de cdnjs pour que le test soit déterministe et
 *              utilisable hors ligne. Sans lui, le cas .xlsx est ignoré.
 *
 * La page est servie en http://127.0.0.1 (contexte sécurisé) : c'est la condition
 * de navigator.clipboard, cf. le repli execCommand pour l'usage en file://.
 *
 * Les jeux d'essai sont ÉCRITS À L'EXÉCUTION dans un dossier temporaire, jamais
 * versionnés : .gitignore interdit `**\/medecins*.csv` (PII médecins, RGPD) et
 * cette règle ne se contourne pas pour un test. Les noms ci-dessous sont fictifs.
 */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CDN_DIR = process.env.CDN_DIR || '';

/* ── jeu d'essai (5 lignes, noms fictifs) écrit dans un dossier temporaire ── */
const TMP = mkdtempSync(join(tmpdir(), 'outreach-'));
const LIGNES_ESSAI = [
  ['Nom', 'Prénom', 'Spécialité', 'Wilaya', 'Téléphone'],
  ['Dr. BENAÏSSA', 'mohamed', 'Oto-rhino-laryngologie', 'Béjaïa', '0550 12 34 56'],
  ["d'AMICO", 'grégoire', 'Cardiologie', 'Alger', '+213 661 23 45 67'],
  ["Docteur N'DIAYE", 'aïcha', 'Pédiatrie', 'Sétif', '00213770112233'],
  ['DRISSI', 'jean-pierre', 'Médecine générale', 'Oran', '021 23 45 67'],
  ['BEN ACHOUR', 'yacine', 'Dermatologie', 'Constantine', '05501234']
];

// CSV « ; » + BOM UTF-8 : exactement ce que produit un export Excel francophone.
const CHEMIN_CSV = join(TMP, 'essai.csv');
writeFileSync(CHEMIN_CSV, '﻿' + LIGNES_ESSAI.map((l) => l.join(';')).join('\n') + '\n', 'utf8');

// Le .xlsx est fabriqué avec le SheetJS de CDN_DIR, chargé hors navigateur.
let CHEMIN_XLSX = '';
if (CDN_DIR && existsSync(join(CDN_DIR, 'xlsx.full.min.js'))) {
  const bac = { console, Date, Math, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, Buffer, process };
  bac.global = bac; bac.globalThis = bac; bac.window = bac;
  vm.createContext(bac);
  vm.runInContext(readFileSync(join(CDN_DIR, 'xlsx.full.min.js'), 'utf8'), bac, { filename: 'xlsx.js' });
  const wb = bac.XLSX.utils.book_new();
  bac.XLSX.utils.book_append_sheet(wb, bac.XLSX.utils.aoa_to_sheet(LIGNES_ESSAI), 'Medecins');
  CHEMIN_XLSX = join(TMP, 'essai.xlsx');
  writeFileSync(CHEMIN_XLSX, Buffer.from(bac.XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
}

let reussis = 0;
const echecs = [];
async function bloc(nom, fn) {
  try { await fn(); reussis++; console.log('  ok   ' + nom); }
  catch (e) { echecs.push(nom); console.log('  ÉCHEC ' + nom + '\n        ' + String(e.message).split('\n').join('\n        ')); }
}

/* ── serveur statique minimal ─────────────────────────────────────────────── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const serveur = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const chemin = join(RACINE, url.replace(/^\/+/, ''));
  if (!chemin.startsWith(RACINE) || !existsSync(chemin)) { res.writeHead(404); return res.end('404'); }
  const ext = chemin.slice(chemin.lastIndexOf('.'));
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
  res.end(readFileSync(chemin));
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + serveur.address().port;
console.log('Serveur : ' + BASE + '  (contexte sécurisé, navigator.clipboard actif)\n');

const navigateur = await chromium.launch({ executablePath: CHROMIUM });

async function nouvellePage() {
  const ctx = await navigateur.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();

  // window.open capturé : on vérifie l'URL WhatsApp sans jamais ouvrir WhatsApp.
  await page.addInitScript(() => {
    window.__ouvertures = [];
    window.open = (url) => { window.__ouvertures.push(url); return { closed: false, focus() {} }; };
  });

  // cdnjs n'est jamais joint pour de vrai : servi depuis le disque si CDN_DIR est
  // fourni, coupé net sinon. Dans les deux cas le test est déterministe et ne
  // dépend d'aucun accès réseau — sans quoi la page attendrait le CDN jusqu'au
  // timeout au lieu de basculer sur son parseur interne.
  await page.route('https://cdnjs.cloudflare.com/**', (route) => {
    if (!CDN_DIR) return route.abort();
    const f = join(CDN_DIR, route.request().url().split('/').pop());
    return existsSync(f)
      ? route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(f) })
      : route.abort();
  });
  page.on('pageerror', (e) => { echecs.push('erreur JS console : ' + e.message); });
  return { ctx, page };
}

const attendre = (page, sel) => page.waitForSelector(sel, { timeout: 8000 });
async function charger(page, chemin) {
  await page.goto(BASE + '/tools/outreach.html');
  await page.setInputFiles('#fichier', chemin);
  await attendre(page, '.ligne');
}
const lignes = (page) => page.$$eval('.ligne', (ns) => ns.map((n) => ({
  nom: n.querySelector('.fiche b').textContent,
  meta: n.querySelector('.fiche .meta').textContent,
  tel: n.querySelector('.fiche .tel').textContent,
  motif: n.querySelector('.fiche .motif') ? n.querySelector('.fiche .motif').textContent : '',
  message: n.querySelector('pre').textContent,
  rouge: n.classList.contains('tel-ko'),
  faite: n.classList.contains('faite'),
  waDesactive: n.querySelectorAll('.actions button')[1].disabled
})));

const NOMS = ['Mohamed Benaïssa', "Grégoire D'Amico", "Aïcha N'Diaye", 'Jean-Pierre Drissi', 'Yacine Ben Achour'];

/* ═══════════════════════ 1 · CSV : chargement et normalisation ═══════════ */
console.log('CSV « ; » + BOM + accents (5 lignes)');
{
  const { ctx, page } = await nouvellePage();
  await charger(page, CHEMIN_CSV);
  const L = await lignes(page);

  await bloc('les 5 lignes sont rendues', () => assert.equal(L.length, 5));

  await bloc('colonnes détectées automatiquement malgré le BOM et les accents', async () => {
    const avis = await page.textContent('#avisMapping');
    assert.match(avis, /détectées automatiquement/i);
    const map = await page.$$eval('#mapGrille select', (s) => s.map((x) => [x.dataset.champ, x.value]));
    assert.deepEqual(Object.fromEntries(map), { nom: '0', prenom: '1', specialite: '2', wilaya: '3', telephone: '4' });
  });

  await bloc('titres retirés, capitalisation, apostrophes et traits d’union conservés', () => {
    assert.deepEqual(L.map((l) => l.nom), NOMS);
  });

  await bloc('téléphones normalisés en 213XXXXXXXXX', async () => {
    const bruts = await page.$$eval('.ligne .tel', (n) => n.map((x) => x.textContent.replace(/\s/g, '')));
    assert.deepEqual(bruts.slice(0, 3), ['213550123456', '213661234567', '213770112233']);
  });

  await bloc('fixe et numéro invalide marqués en rouge, WhatsApp désactivé', () => {
    assert.deepEqual(L.map((l) => l.rouge), [false, false, false, true, true]);
    assert.deepEqual(L.map((l) => l.waDesactive), [false, false, false, true, true]);
    assert.match(L[3].motif, /fixe/i);
    assert.match(L[4].motif, /non reconnu/i);
  });

  await bloc('le compteur annonce 0 / 5 traités', async () => {
    assert.equal((await page.textContent('#compteur')).trim(), '0 / 5 traités');
  });

  await bloc('le message rendu contient bien les 4 variables substituées', () => {
    const m = L[0].message;
    assert.ok(m.startsWith('Bonjour Dr Mohamed Benaïssa,'), 'nom : ' + m.slice(0, 40));
    assert.ok(m.includes('Oto-rhino-laryngologie'), 'spécialité');
    assert.ok(m.includes('à Béjaïa'), 'wilaya');
    assert.match(m, /code d’accès prioritaire : TBB-[0-9A-Z]{5}/, 'code');
    assert.ok(!/\{\w+\}/.test(m), 'aucune variable non substituée');
  });

  /* ═════════ 2 · exigence 16 : accents, apostrophes, retours à la ligne ═══ */
  await bloc('URL wa.me : le message revient identique après décodage', async () => {
    for (const i of [0, 1, 2]) {
      await page.$$eval('.ligne', (ns, k) => ns[k].querySelectorAll('.actions button')[1].click(), i);
      const urls = await page.evaluate(() => window.__ouvertures);
      const url = urls[urls.length - 1];
      assert.ok(url.startsWith('https://wa.me/213'), 'schéma wa.me : ' + url.slice(0, 40));
      const recu = decodeURIComponent(url.split('?text=')[1]);
      assert.equal(recu, L[i].message, 'ligne ' + (i + 1) + ' : message altéré par l’encodage');
      assert.ok(recu.includes('\n'), 'les retours à la ligne doivent survivre');
    }
  });

  await bloc('les caractères qui cassent une query sont bien encodés', async () => {
    const urls = await page.evaluate(() => window.__ouvertures);
    const q = urls[0].split('?text=')[1];
    for (const [brut, code] of [['\n', '%0A'], [' ', '%20'], ['’', '%E2%80%99'], ['é', '%C3%A9'], [':', '%3A']]) {
      assert.ok(!q.includes(brut), 'caractère brut « ' + brut + ' » présent dans la query');
      assert.ok(q.includes(code), 'attendu ' + code + ' pour « ' + brut + ' »');
    }
  });

  await bloc('l’URL du numéro composé est bien le e164 sans + ni espace', async () => {
    const urls = await page.evaluate(() => window.__ouvertures);
    assert.equal(urls[0].split('?')[0], 'https://wa.me/213550123456');
    assert.equal(urls[2].split('?')[0], 'https://wa.me/213770112233');
  });

  /* ═════════ 3 · copie presse-papier ═════════════════════════════════════ */
  await bloc('« Copier » place le message dans le presse-papier', async () => {
    await page.$$eval('.ligne', (ns) => ns[0].querySelectorAll('.actions button')[0].click());
    await page.waitForFunction(() => document.querySelector('.ligne .actions button').textContent === 'Copié', null, { timeout: 3000 });
    const presse = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(presse, L[0].message);
  });

  /* ═════════ 4 · suivi localStorage ══════════════════════════════════════ */
  await bloc('cocher « Traité » écrit dans tabibi_outreach_done, indexé par numéro', async () => {
    await page.$$eval('.ligne', (ns) => ns[0].querySelector('input[type=checkbox]').click());
    await page.waitForFunction(() => document.querySelector('#compteur').textContent.trim() === '1 / 5 traités', null, { timeout: 3000 });
    const suivi = await page.evaluate(() => JSON.parse(localStorage.getItem('tabibi_outreach_done')));
    assert.deepEqual(Object.keys(suivi), ['213550123456'], 'clé = numéro normalisé');
    assert.match(suivi['213550123456'], /^\d{4}-\d{2}-\d{2}T/, 'date de traitement ISO');
  });

  await bloc('la ligne cochée est grisée et repoussée en bas', async () => {
    const L2 = await lignes(page);
    assert.equal(L2[4].nom, 'Mohamed Benaïssa', 'la ligne traitée doit passer en dernier');
    assert.equal(L2[4].faite, true, 'classe « faite » (grisé) attendue');
    assert.equal(L2[0].nom, "Grégoire D'Amico", 'les non traités remontent');
  });

  await bloc('le suivi survit à un rechargement complet', async () => {
    await charger(page, CHEMIN_CSV);
    assert.equal((await page.textContent('#compteur')).trim(), '1 / 5 traités');
    const L3 = await lignes(page);
    assert.equal(L3[4].nom, 'Mohamed Benaïssa');
    assert.equal(L3[4].faite, true);
  });

  /* ═════════ 5 · export CSV ══════════════════════════════════════════════ */
  await bloc('l’export produit les 5 colonnes demandées et survit à la relecture', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExport')]);
    const csv = readFileSync(await dl.path(), 'utf8');
    assert.ok(csv.charCodeAt(0) === 0xFEFF, 'BOM attendu pour Excel');
    assert.match(dl.suggestedFilename(), /^tabibi-demarchage-\d{8}\.csv$/);

    const relu = await page.evaluate((t) => window.OutreachCore.parserCsv(t, ';'), csv);
    assert.deepEqual(relu.entetes, ['nom', 'telephone', 'message', 'traite', 'date_traitement']);
    assert.equal(relu.lignes.length, 5);

    const traitee = relu.lignes.find((l) => l[0] === 'Mohamed Benaïssa');
    assert.ok(traitee, 'ligne traitée absente de l’export');
    assert.equal(traitee[1], '213550123456');
    assert.ok(traitee[2].includes('\n'), 'le message multi-ligne doit survivre au CSV');
    assert.ok(traitee[2].includes('Béjaïa'), 'accents préservés dans l’export');
    assert.equal(traitee[3], 'oui');
    assert.match(traitee[4], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const nonTraitee = relu.lignes.find((l) => l[0] === "Aïcha N'Diaye");
    assert.equal(nonTraitee[3], 'non');
    assert.equal(nonTraitee[4], '');
  });

  /* ═════════ 6 · réinitialisation ════════════════════════════════════════ */
  await bloc('« Réinitialiser » vide le suivi après confirmation, sans toucher au gabarit', async () => {
    await page.evaluate(() => { document.querySelector('#gabarit').value += '\nSignature test.'; document.querySelector('#gabarit').dispatchEvent(new Event('input')); });
    page.once('dialog', (d) => d.accept());
    await page.click('#btnReset');
    await page.waitForFunction(() => document.querySelector('#compteur').textContent.trim() === '0 / 5 traités', null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => localStorage.getItem('tabibi_outreach_done')), null);
    assert.ok((await page.inputValue('#gabarit')).includes('Signature test.'), 'le gabarit ne doit pas être effacé');
    assert.equal((await lignes(page))[0].nom, 'Mohamed Benaïssa', 'ordre initial rétabli');
  });

  await bloc('« Réinitialiser » annulé laisse le suivi intact', async () => {
    await page.$$eval('.ligne', (ns) => ns[0].querySelector('input[type=checkbox]').click());
    page.once('dialog', (d) => d.dismiss());
    await page.click('#btnReset');
    await page.waitForTimeout(200);
    assert.equal((await page.textContent('#compteur')).trim(), '1 / 5 traités');
  });

  await ctx.close();
}

/* ═══════════════════════ 7 · pagination (25 par page) ════════════════════ */
console.log('\nPagination');
{
  const { ctx, page } = await nouvellePage();
  await page.goto(BASE + '/tools/outreach.html');
  // 60 lignes injectées via le même chemin de code que le fichier réel.
  const gros = ['Nom;Prenom;Specialite;Wilaya;Telephone']
    .concat(Array.from({ length: 60 }, (_, i) =>
      `MEDECIN${i};test;Cardiologie;Alger;05501${String(i).padStart(5, '0')}`)).join('\n');
  await page.setInputFiles('#fichier', { name: 'gros.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + gros, 'utf8') });
  await attendre(page, '.ligne');

  await bloc('page 1 : 25 lignes sur 60', async () => {
    assert.equal((await page.$$('.ligne')).length, 25);
    assert.match(await page.textContent('.pagination .pos'), /Page 1 \/ 3 — lignes 1–25 sur 60/);
  });

  await bloc('« Précédent » désactivé en page 1', async () => {
    assert.equal(await page.$eval('.pagination button', (b) => b.disabled), true);
  });

  await bloc('page 3 : les 10 dernières lignes', async () => {
    await page.click('.pagination button:last-child');
    await page.click('.pagination button:last-child');
    assert.equal((await page.$$('.ligne')).length, 10);
    assert.match(await page.textContent('.pagination .pos'), /Page 3 \/ 3 — lignes 51–60 sur 60/);
    assert.equal(await page.$eval('.pagination button:last-child', (b) => b.disabled), true);
  });

  await ctx.close();
}

/* ═══════════════════════ 8 · mapping manuel de secours ═══════════════════ */
console.log('\nColonnes non reconnues → mapping manuel');
{
  const { ctx, page } = await nouvellePage();
  await page.goto(BASE + '/tools/outreach.html');
  const opaque = 'champ_a;champ_b;champ_c\nBENALI;Cardiologie;0550123456\nAMRANI;Pédiatrie;0661234567';
  await page.setInputFiles('#fichier', { name: 'opaque.csv', mimeType: 'text/csv', buffer: Buffer.from(opaque, 'utf8') });
  await attendre(page, '#mapGrille select');

  await bloc('détection en échec → avertissement et sélecteurs vides', async () => {
    assert.match(await page.textContent('#avisMapping'), /Détection incomplète/i);
    const map = await page.$$eval('#mapGrille select', (s) => Object.fromEntries(s.map((x) => [x.dataset.champ, x.value])));
    assert.equal(map.nom, '-1');
    assert.equal(map.telephone, '-1');
    assert.equal((await page.$$('#mapGrille label.manquant')).length, 2, 'nom + téléphone signalés en rouge');
  });

  await bloc('le mapping manuel régénère la liste immédiatement', async () => {
    await page.selectOption('#mapGrille select[data-champ=nom]', '0');
    await page.selectOption('#mapGrille select[data-champ=specialite]', '1');
    await page.selectOption('#mapGrille select[data-champ=telephone]', '2');
    await attendre(page, '.ligne');
    const L = await lignes(page);
    assert.equal(L.length, 2);
    assert.equal(L[0].nom, 'Benali');
    assert.equal(L[0].tel.replace(/\s/g, ''), '213550123456');
    assert.ok(L[0].message.includes('Cardiologie'));
    assert.match(await page.textContent('#avisMapping'), /complète/i);
  });

  await ctx.close();
}

/* ═══════════════════════ 9 · fichier .xlsx ═══════════════════════════════ */
console.log('\nFichier Excel (.xlsx)');
if (CHEMIN_XLSX) {
  const { ctx, page } = await nouvellePage();
  await charger(page, CHEMIN_XLSX);
  await bloc('un .xlsx donne exactement le même résultat que le CSV', async () => {
    const L = await lignes(page);
    assert.equal(L.length, 5);
    assert.deepEqual(L.map((l) => l.nom), NOMS);
    assert.deepEqual(L.map((l) => l.rouge), [false, false, false, true, true]);
    assert.ok(L[0].message.includes('Béjaïa'));
  });
  await ctx.close();
} else {
  console.log('  (ignoré — CDN_DIR non fourni, SheetJS indisponible pour fabriquer le .xlsx)');
}

/* ═══════════════════ 10 · repli quand cdnjs est injoignable ══════════════ */
console.log('\ncdnjs injoignable → parseur CSV interne');
{
  const ctx = await navigateur.newContext();
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', (r) => r.abort());
  await page.goto(BASE + '/tools/outreach.html');
  await page.setInputFiles('#fichier', CHEMIN_CSV);
  await attendre(page, '.ligne');

  await bloc('le CSV reste exploitable sans PapaParse', async () => {
    const L = await lignes(page);
    assert.equal(L.length, 5);
    assert.deepEqual(L.map((l) => l.nom), NOMS);
    assert.match(await page.textContent('#avisFichier'), /parseur CSV interne/i);
  });
  await ctx.close();
}

await navigateur.close();
serveur.close();

console.log('\n────────────────────────────────');
console.log(reussis + ' réussis, ' + echecs.length + ' échecs');
if (echecs.length) { echecs.forEach((e) => console.log('  ✗ ' + e)); process.exit(1); }
console.log('Tout est vert.');
