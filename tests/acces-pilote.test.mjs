// =====================================================================
// tests/acces-pilote.test.mjs — ce qui garde l'acces pilote par numero
// =====================================================================
// ⚠️ RAPPEL, PARCE QU'IL DOIT ETRE PARTOUT : un numero de telephone n'est pas
// un secret. Ce mode d'acces est une DETTE DE SECURITE ASSUMEE (registre
// P-40), reservee au pilote ferme, sur donnees de test, derriere un
// interrupteur. Ces essais ne le rendent pas sur — ils verifient que les
// quatre gardes qui le tiennent sont bien la, et qu'aucune n'a disparu.
//
// Ce que ce fichier PEUT essayer : le code qui ne depend pas de Deno.
// Ce qu'il ne peut pas : la fonction elle-meme (elle appelle `Deno.serve()`
// au chargement). Les parcours de bout en bout sont dans
// `tests/e2e/acces-pilote.spec.js`.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('supabase/functions/acces-pilote/index.ts', 'utf8');
const PAGE = readFileSync('medecin-pilote.html', 'utf8');
const SQL = readFileSync('supabase/migrations/20260915_acces_pilote_numero.sql', 'utf8');
const CONFIG = readFileSync('supabase/config.toml', 'utf8');

const M = await import('../supabase/functions/_partage/sms-rappels.ts');

/** Le code, sans ses commentaires : une garde ecrite dans un commentaire n'en est pas une. */
function sansCommentaires(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1 ');
}
const CODE = sansCommentaires(SRC);

// ─────────────────────────────────────────────────────────────────────
// 1. LA NORMALISATION — une seule, partagee, et elle REFUSE
// ─────────────────────────────────────────────────────────────────────
test('la fonction n a PAS sa propre normalisation : elle reprend celle des rappels', () => {
  assert.match(CODE, /import\s*\{\s*normalizePhoneDZ\s*\}\s*from\s*'\.\.\/_partage\/sms-rappels\.ts'/,
    'deux normalisations = deux verites pour un meme numero');
  assert.doesNotMatch(CODE, /function\s+normaliserNumero/,
    'une copie locale a ete reintroduite — elle derivera');
});

test('un numero douteux est REFUSE, jamais repare', () => {
  // Reparer, ici, ce serait ouvrir la session de quelqu un d autre.
  for (const mauvais of ['021123456', '33612345678', '05551234', '0555123456789', '', 'abcdefghij']) {
    assert.equal(M.normalizePhoneDZ(mauvais), null, `« ${mauvais} » aurait du etre refuse`);
  }
});

test('les formes qu un medecin tape vraiment sont acceptees, et rendent la meme chose', () => {
  for (const [entree, attendu] of [
    ['0555123456', '213555123456'],
    ['+213555123456', '213555123456'],
    ['00213555123456', '213555123456'],
    ['0555 12 34 56', '213555123456'],
    ['(0555) 12-34-56', '213555123456'],
    ['555123456', '213555123456'],
  ]) {
    assert.equal(M.normalizePhoneDZ(entree), attendu, `« ${entree} »`);
  }
});

// ─────────────────────────────────────────────────────────────────────
// 2. LES QUATRE GARDES — chacune doit etre dans le code
// ─────────────────────────────────────────────────────────────────────
test('GARDE 1 — l interrupteur, et il est FERME par defaut', () => {
  assert.match(CODE, /ACCES_PILOTE_NUMERO_ENABLED/, "l'interrupteur a disparu");
  // `!== 'true'` : tout ce qui n'est pas exactement « true » ferme la porte.
  // Un `=== 'false'` laisserait passer une variable absente ou mal orthographiee.
  assert.match(CODE, /ACCES_PILOTE_NUMERO_ENABLED'\)\s*!==\s*'true'/,
    "l'interrupteur doit etre FERME par defaut : absent = ferme");
});

test('GARDE 2 — la liste blanche, et elle exige actif = true', () => {
  assert.match(CODE, /from\('pilote_acces_numero'\)/, 'la liste blanche n est plus consultee');
  assert.match(CODE, /\.eq\('actif',\s*true\)/, 'un numero revoque passerait');
});

test('GARDE 3 — Turnstile est verifie AVANT de regarder le numero', () => {
  const iTurnstile = CODE.indexOf('turnstileValide(');
  const iListe = CODE.indexOf("from('pilote_acces_numero')");
  assert.ok(iTurnstile > -1, 'Turnstile n est plus verifie');
  assert.ok(iListe > -1, 'la liste blanche n est plus consultee');
  assert.ok(iTurnstile < iListe,
    'verifier le numero avant le captcha permettrait de sonder la liste sans resoudre un seul defi');
  // Fail-closed : pas de secret, pas d acces.
  assert.match(CODE, /TURNSTILE_SECRET_KEY/);
  assert.match(CODE, /captcha_not_configured/);
});

test('GARDE 4 — la limitation porte sur l IP ET sur le numero', () => {
  assert.match(CODE, /pilote_compter_tentative/, 'la limitation a disparu');
  assert.match(CODE, /sha256Hex\('ip:'/, "la limitation par IP a disparu");
  assert.match(CODE, /sha256Hex\('tel:'/, "la limitation par numero a disparu");
  assert.match(CODE, /trop_de_tentatives/);
  // Une limitation indisponible ne doit pas ouvrir la porte.
  assert.match(CODE, /limitation indisponible[\s\S]{0,200}return panne/,
    'sans compteur, on doit refuser — pas laisser passer');
});

// ─────────────────────────────────────────────────────────────────────
// 3. L ENUMERATION — un seul refus, et il prend le meme temps
// ─────────────────────────────────────────────────────────────────────
test('un seul code de refus, quelle que soit la raison', () => {
  const codes = [...CODE.matchAll(/return refus\(/g)];
  assert.ok(codes.length >= 3, 'il doit y avoir plusieurs chemins vers LE MEME refus');
  // Et aucun message plus precis ne doit sortir.
  for (const bavard of ['numero_inconnu', 'non_whiteliste', 'numero_revoque', 'not_found']) {
    assert.doesNotMatch(CODE, new RegExp(bavard),
      `« ${bavard} » transforme la fonction en annuaire des medecins testeurs`);
  }
});

test('le refus a un plancher de duree — sinon l horloge dit ce que le message tait', () => {
  assert.match(CODE, /PLANCHER_MS/);
  assert.match(CODE, /async function refus[\s\S]{0,320}setTimeout/,
    'sans attente, un numero absent repond plus vite qu un numero present');
});

// ─────────────────────────────────────────────────────────────────────
// 4. LE SECRET NE SORT PAS
// ─────────────────────────────────────────────────────────────────────
test('le mot de passe ephemere n est ni renvoye ni journalise', () => {
  // On cherche la VARIABLE en position d'argument, pas le mot dans un libelle :
  // `console.error('… pose du mot de passe ephemere :', err)` est legitime,
  // `console.error('…', passe)` ne l'est pas. Premiere version du test : un
  // simple `\bpasse\b` — il accusait le libelle francais. Une garde qui crie
  // sur du code correct finit desactivee.
  assert.doesNotMatch(CODE, /console\.\w+\((?:[^()]|\([^()]*\))*[,(]\s*passe\s*[,)]/,
    'un mot de passe dans un journal n est plus ephemere');
  // La reponse de succes : on enumere ce qu'elle contient, et `passe` n y est pas.
  const succes = CODE.slice(CODE.lastIndexOf('ok: true'));
  assert.doesNotMatch(succes, /\bpasse\b/, 'le mot de passe ephemere fuit dans la reponse');
  assert.match(succes, /access_token/);
  assert.match(succes, /refresh_token/);
});

test('il est remplace APRES usage, que la connexion reussisse ou non', () => {
  // Deux appels a updateUserById avec un mot de passe : la pose, et la rotation.
  const poses = [...CODE.matchAll(/updateUserById\([^)]*\{\s*password:/g)];
  assert.equal(poses.length, 2,
    'il faut exactement deux ecritures de mot de passe : la pose et la rotation');
  // La rotation doit venir AVANT le test de reussite de la connexion.
  const iRotation = CODE.indexOf('motDePasseEphemere()', CODE.indexOf('signInWithPassword'));
  const iTestSession = CODE.indexOf('if (errSession');
  assert.ok(iRotation > -1 && iRotation < iTestSession,
    'un echec de connexion laisserait sinon un compte ouvert avec un mot de passe ecrit');
});

test('aucune cle en clair dans le code, ni dans la page', () => {
  // Meme controle que pour la cle Daily : on cherche des chaines EN FORME de
  // secret, pas le mot « secret ».
  const FORME_DE_SECRET = /['"][A-Za-z0-9_\-]{32,}['"]/g;
  for (const [nom, src] of [['fonction', CODE], ['page', sansCommentaires(PAGE)]]) {
    for (const m of src.match(FORME_DE_SECRET) ?? []) {
      // Les seules longues chaines admises sont des noms de nos propres champs.
      assert.ok(/^['"](acces_non_autorise|trop_de_tentatives|captcha_not_configured|server_misconfigured|ACCES_PILOTE_NUMERO_ENABLED|SUPABASE_SERVICE_ROLE_KEY|TURNSTILE_SECRET_KEY|SUPABASE_ANON_KEY|method_not_allowed|feature_disabled|pilote_compter_tentative|pilote_acces_numero|pilote_noter_entree|doctor_profile_id|x-client-info, apikey, content-type)['"]$/.test(m),
        `${nom} : chaine en forme de secret — ${m.slice(0, 12)}…`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────
// 5. CE QUI DOIT ETRE ECRIT NOIR SUR BLANC
// ─────────────────────────────────────────────────────────────────────
test('verify_jwt = false est DECLARE dans config.toml', () => {
  // P-05 : le cron des rappels a ete casse 47 jours parce que ce reglage
  // n'etait ecrit nulle part et qu'un deploiement l'a remis a `true`.
  assert.match(CONFIG, /\[functions\.acces-pilote\]\s*\nverify_jwt\s*=\s*false/,
    'sans cette entree, un deploiement remettra verify_jwt a true et la fonction repondra 401 a tout le monde');
});

test('la dette est ecrite dans les trois fichiers, pas seulement au registre', () => {
  // ⚠️ On aplatit les marqueurs de commentaire et les retours a la ligne avant
  // de chercher. Sans ca, la phrase coupee en deux par un retour a la ligne
  // (« ... n'est\n# pas un secret ») echappait au test — et le test aurait
  // reclame une reecriture du commentaire pour de mauvaises raisons.
  const aplati = (t) => t.replace(/\n\s*(#|\/\/|--)?\s*/g, ' ');
  for (const [nom, src] of [['fonction', SRC], ['migration', SQL], ['config.toml', CONFIG]]) {
    assert.match(src, /P-40/, `${nom} : le renvoi au registre a disparu`);
    assert.match(aplati(src), /n'est pas un secret|N'EST PAS UN SECRET/i,
      `${nom} : l'avertissement a disparu — c'est la premiere chose qu'un relecteur doit lire`);
  }
});

test('la liste blanche est hors de portee de anon et authenticated', () => {
  assert.match(SQL, /ALTER TABLE public\.pilote_acces_numero ENABLE ROW LEVEL SECURITY/);
  assert.match(SQL, /REVOKE ALL ON TABLE public\.pilote_acces_numero FROM anon, authenticated/);
  // Les portes d'administration : retirees a PUBLIC d'abord (lecon P-32).
  assert.match(SQL, /REVOKE EXECUTE ON FUNCTION public\.admin_ajouter_medecin_pilote\(text, uuid\)\s+FROM public, anon/);
  assert.match(SQL, /REVOKE EXECUTE ON FUNCTION public\.pilote_compter_tentative[^;]*FROM public, anon, authenticated/);
});

test('les RPC d administration verifient is_admin, pas seulement la session', () => {
  for (const fn of ['admin_ajouter_medecin_pilote', 'admin_revoquer_medecin_pilote', 'admin_lister_medecins_pilote']) {
    const i = SQL.indexOf('FUNCTION public.' + fn);
    assert.ok(i > -1, `${fn} a disparu`);
    const corps = SQL.slice(i, SQL.indexOf('$function$;', i));
    assert.match(corps, /is_admin\(\)/, `${fn} : etre connecte ne suffit pas`);
  }
});

test('le compteur de tentatives ne stocke ni numero ni IP en clair', () => {
  const i = SQL.indexOf('CREATE TABLE IF NOT EXISTS public.pilote_acces_tentatives');
  const table = SQL.slice(i, SQL.indexOf(');', i));
  assert.match(table, /cle_sha256/);
  assert.doesNotMatch(table, /\bphone\b|\bip\b/,
    'ce qu on ne stocke pas ne fuit pas — une table de limitation a besoin de COMBIEN, pas de QUI');
});
