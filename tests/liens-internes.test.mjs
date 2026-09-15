// =====================================================================
// tests/liens-internes.test.mjs — un lien qui ne mene nulle part
// =====================================================================
// `blog/index.html` annoncait SIX articles, avec leurs titres, leurs dates et
// leurs temps de lecture. **Aucun des six fichiers n'existait.** Six liens sur
// six menaient a un 404 — sur la page publique, indexee, dont la seule
// fonction est de mener quelque part.
//
// Et deux liens de plus, dans le meme pied de page : `../cgu.html` et
// `../confidentialite.html`, alors que les fichiers sont dans `legal/`. Deux
// 404 sur des mentions legales.
//
// ⚠️ CE N'EST PAS SEULEMENT UNE AFFAIRE DE LIENS. Les six cartes decrivaient
// des articles INVENTES — meme famille que les « 4 medecins verifies · ★ 4,9 »
// de l'accueil (P-27) : du contenu fabrique, presente comme reel.
//
// Ce test verifie le fait verifiable : **chaque lien interne mene a un fichier
// qui existe**. Il ne peut pas dire si le titre annonce correspond au contenu.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, normalize } from 'node:path';

const PAGES = execSync('git ls-files "*.html" ":!:seo/**" ":!:dist*/**" ":!:www/**" ":!:tests/**" ":!:node_modules/**"')
  .toString().trim().split('\n').filter(Boolean);

function sansCommentaires(src) {
  return src.replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * Resout un chemin RELATIF A LA PAGE qui l'ecrit.
 *
 * ⚠️ Deux pieges, tous deux rencontres en ecrivant l'outil d'audit :
 *   - une URL ABSOLUE (`https://tabibi.doctor/...`, canonique ou partage)
 *     n'est pas un lien interne. Les compter cassees ajoutait 60 fausses
 *     alertes, et un rapport qui se trompe 60 fois n'est pas lu ;
 *   - un chemin relatif se resout depuis LE REPERTOIRE DE LA PAGE, pas depuis
 *     la racine. `blog/index.html` -> `../index.html` est parfaitement valide.
 */
function resoudre(depuis, cible) {
  if (/^https?:|^\/\/|^mailto:|^tel:|^data:|^#/.test(cible)) return null;
  const c = cible.split(/[?#]/)[0];
  if (!c) return null;
  return normalize(c.startsWith('/') ? c.slice(1) : join(dirname(depuis), c));
}

test('chaque lien interne vers une page mene a un fichier qui existe', () => {
  const casses = [];
  let total = 0;
  for (const page of PAGES) {
    const html = sansCommentaires(readFileSync(page, 'utf8'));
    for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']+\.html)(?:[?#][^"']*)?["']/gi)) {
      const cible = resoudre(page, m[1]);
      if (!cible) continue;
      total++;
      if (!existsSync(cible)) {
        casses.push(`${page}:${html.slice(0, m.index).split('\n').length} -> ${m[1]}`);
      }
    }
  }
  assert.ok(total > 100, `seulement ${total} liens releves : le motif de recherche a change`);
  assert.deepEqual(casses, [], `lien(s) interne(s) casse(s) :\n  ${casses.join('\n  ')}`);
});

test('les six articles du blog sont ceux qui existent vraiment', () => {
  const index = sansCommentaires(readFileSync('blog/index.html', 'utf8'));
  const lies = [...index.matchAll(/href="(articles\/[^"]+\.html)"/g)].map((m) => m[1]);
  assert.equal(lies.length, 6, "l'index du blog n'annonce plus six articles");
  for (const a of lies) {
    assert.ok(existsSync(join('blog', a)), `${a} n'existe pas`);
  }
  // Et aucun doublon : six cartes, six articles distincts.
  assert.equal(new Set(lies).size, 6);
});

test("l'index n'annonce aucune date de publication", () => {
  // Les articles n'en portent AUCUNE. Les six dates affichees avant
  // (« 12 mai 2026 »…) etaient inventees, comme les titres. En reafficher une
  // serait recommencer la meme chose, en plus discret.
  const index = sansCommentaires(readFileSync('blog/index.html', 'utf8'));
  const dates = index.match(/\b\d{1,2}\s+(janv|f[ée]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)[a-z]*\.?\s+20\d\d/gi) || [];
  assert.deepEqual(dates, [], `date(s) affichee(s) sans source : ${dates.join(', ')}`);
});

test('les categories annoncees correspondent a des articles reels', () => {
  const index = sansCommentaires(readFileSync('blog/index.html', 'utf8'));
  // `class="cat"` ou `class="cat active"` — et surtout PAS `class="cats"`,
  // le conteneur, que le motif large attrapait en rendant une categorie vide.
  const chips = [...index.matchAll(/class="cat(?: active)?">([^<]+)</g)].map((m) => m[1].trim());
  assert.ok(chips.length >= 3, `seulement ${chips.length} categorie(s) relevee(s) : le motif a change`);
  const posees = new Set([...index.matchAll(/class="post-cat">([^<]+)</g)].map((m) => m[1].trim()));
  for (const c of chips) {
    if (c === 'Tous') continue;
    assert.ok(posees.has(c),
      `la categorie « ${c} » n'a aucun article : une rubrique vide est une promesse vide`);
  }
});
