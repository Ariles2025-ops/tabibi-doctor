// =====================================================================
// tests/reference-rpc.test.mjs — une porte qui compare a un etat perime
// =====================================================================
// `supabase/rpc/existantes.txt` est la liste des RPC que le front appelle ET
// qui existent en base. `verifier:rpc` la compare au code : toute RPC appelee
// doit y figurer, ou etre inscrite dans `ABSENCES_CONNUES` avec sa raison.
//
// ⚠️ LE PIEGE N'ETAIT PAS L'OUBLI, C'ETAIT LE MOTIF PERIME. Cinq RPC y
// restaient depuis le 14/09 avec la mention « EXISTE en base, hors reference :
// jeton --base revoque ». Elles existaient bel et bien ; ce qui manquait etait
// un jeton d'ECRITURE pour regenerer le fichier — alors que le MCP Supabase
// lit `pg_proc` en LECTURE, sans jeton.
//
// **Une porte qui compare a un etat perime finit par crier sur ce qui va bien,
// donc par etre eteinte.** Les cinq ont ete verifiees une par une le 15/09 et
// portees dans la reference ; `ABSENCES_CONNUES` est vide.
//
// Ce test ne peut pas verifier LA BASE : il tourne hors reseau. Il verifie ce
// qu'il peut — que les cinq ne retombent pas dans les exceptions sans qu'une
// personne le decide, et que la reference reste lisible.
// =====================================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const VERIFIEES_LE_15_09 = [
  'accepter_invitation_medecin',
  'create_prescription_draft',
  'update_prescription_draft',
  'request_prescription_signature',
  'mark_prescription_delivered',
];

function reference() {
  return readFileSync('supabase/rpc/existantes.txt', 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

function blocAbsences() {
  const script = readFileSync('scripts/verifier-rpc.mjs', 'utf8');
  const d = script.indexOf('const ABSENCES_CONNUES = {');
  assert.ok(d > -1, 'ABSENCES_CONNUES a disparu du script : ce test ne surveille plus rien');
  return script.slice(d, script.indexOf('};', d));
}

test('les cinq RPC verifiees le 15/09 sont dans la reference, pas dans les exceptions', () => {
  const ref = reference();
  const bloc = blocAbsences();
  for (const nom of VERIFIEES_LE_15_09) {
    assert.ok(ref.includes(nom), `${nom} a disparu de la reference`);
    assert.doesNotMatch(bloc, new RegExp(`^\\s*${nom}\\s*:`, 'm'),
      `${nom} est revenue dans ABSENCES_CONNUES : la liste doit MAIGRIR, jamais grossir`);
  }
});

test('la liste des exceptions est VIDE — toute nouvelle entree sera un choix visible', () => {
  // Elle n'est pas interdite : une RPC ecrite et non appliquee a sa place ici.
  // Mais elle doit se voir dans un diff, pas s'installer.
  const noms = [...blocAbsences().matchAll(/^\s*([a-z_0-9]+)\s*:/gm)].map((m) => m[1]);
  assert.deepEqual(noms, [],
    `exception(s) reintroduite(s) : ${noms.join(', ')} — verifier le MOTIF avant de l'accepter`);
});

test('la reference est triee et sans doublon — sinon elle devient illisible', () => {
  const ref = reference();
  assert.ok(ref.length > 40, `seulement ${ref.length} entrees : la reference a ete tronquee`);
  assert.deepEqual(ref, [...ref].sort(), 'la reference n est plus triee');
  assert.equal(new Set(ref).size, ref.length, 'doublon dans la reference');
});
