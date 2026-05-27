**Date** : 27 mai 2026
**Source** : `tests/audit/03-security.spec.js` + inspection `curl -I` directe
**Cible** : `https://effulgent-kelpie-e48e81.netlify.app`

---

# Rapport — Sécurité

## 1. Synthèse

| Domaine | Résultat | Sévérité |
|---|---|---|
| Headers HTTP de sécurité | ✅ Excellent | — |
| Mixed content | ✅ Aucun | — |
| Secrets dans le JS public | ✅ Aucun pattern trouvé | — |
| Clé Supabase exposée | ✅ Anon JWT (role=anon) confirmé | — |
| XSS reflected via query string | ✅ Aucun `alert()` déclenché | — |
| robots.txt + sitemap | ✅ Servis | — |
| RLS Supabase probe intrusif | ⏸️ Non exécuté (skip par défaut) | À couvrir |
| Auth gating côté serveur | ⚠️ Pages auth-gated chargent sans redirect | **CRIT** |
| Upload de fichiers | ⏸️ Non audité (fonctionnalité à vérifier) | À couvrir |

## 2. Headers HTTP de sécurité (production-grade ✅)

Sortie réelle de `curl -I https://effulgent-kelpie-e48e81.netlify.app/` :

```
strict-transport-security: max-age=31536000; includeSubDomains; preload  ✅
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'
  https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com
  https://www.googletagmanager.com https://plausible.io; style-src 'self'
  'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:;
  img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co
  wss://*.supabase.co https://api.openrouteservice.org https://plausible.io;
  frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none';
  upgrade-insecure-requests   ✅ TRÈS BONNE COUVERTURE
x-frame-options: DENY   ✅
x-content-type-options: nosniff   ✅
referrer-policy: strict-origin-when-cross-origin   ✅
permissions-policy: geolocation=(self), camera=(self), microphone=(self),
  payment=(self), usb=(), bluetooth=(), magnetometer=(), gyroscope=(),
  accelerometer=()   ✅
cross-origin-opener-policy: same-origin   ✅
cross-origin-resource-policy: same-origin   ✅
x-xss-protection: 1; mode=block   ℹ️ (legacy header, OK)
server: Netlify
```

### Observations

- **Excellent** : HSTS preload-ready, CSP détaillée et `'unsafe-eval'`-free, COOP+CORP en place.
- **Note CSP** :
  - `script-src ... 'unsafe-inline'` : nécessaire pour les `onclick=` inline (très présents dans le code) — **dette technique à résorber** post-launch en migrant vers handlers JS.
  - `style-src ... 'unsafe-inline'` : idem (styles inline) — dette mineure.
- `x-xss-protection: 1; mode=block` est déprécié par les navigateurs modernes (MDN recommande `0`) — neutre.

### Recommandations

| # | Action | Priorité |
|---|---|---|
| H1 | Conserver HSTS preload | — (déjà OK) |
| H2 | Plan progressif pour retirer `'unsafe-inline'` du CSP en migrant `onclick=` vers `addEventListener` | MAJ (post-launch) |
| H3 | Ajouter `Cross-Origin-Embedder-Policy: require-corp` si vous utilisez SharedArrayBuffer (probablement non nécessaire) | MIN |

## 3. Mixed content

✅ **Aucune ressource `http://` détectée** lors du chargement de la home.

## 4. Secrets dans le bundle JS

Patterns audités : `service_role`, `sk_live_`, `sk_test_`, `xkeysib-`, `SG.*`, `AKIA…`, `-----BEGIN PRIVATE KEY-----`.

✅ **Aucun secret dangereux trouvé** dans le JavaScript livré au navigateur.

## 5. Clé Supabase exposée

✅ Le JWT détecté a `role: "anon"` — comportement attendu. La sécurité repose donc entièrement sur **Row Level Security (RLS)** côté Supabase (voir `DB_AUDIT_REPORT.md`).

## 6. XSS via query string

✅ Le payload `?q=<script>alert('xss-audit')</script>` injecté sur la home n'a déclenché aucun `alert()`. Le DOM échappe correctement les valeurs URL.

> ⚠️ Cette assertion ne couvre **que** le param `q` sur la home. À étendre à tous les inputs des formulaires (motif RDV, bio médecin, recherche médecin) — couverture incomplète aujourd'hui.

## 7. Auth gating côté serveur — **À approfondir**

(Voir BUTTONS_REPORT §2.1 et FLOWS_REPORT §3.6/3.7)

5 pages auth-gated chargent leur HTML sans redirection 302 côté serveur. Le gating semble se faire **uniquement côté JS**.

### Évaluation du risque

- **Faible si RLS Supabase complet** : un utilisateur non authentifié peut voir la coquille de la page mais ne peut rien obtenir de la DB.
- **Élevé si du contenu sensible est rendu en SSR ou via fetch sans auth** : possibilité de fuite.

### Action requise

- ❗ **Confirmer manuellement** sur chaque page :
  1. Ouvrir la page sans cookie de session, vue HTML brute (`curl`).
  2. Vérifier qu'aucune donnée nominative (nom patient, email médecin, ID interne) n'est rendue.
  3. Vérifier que les fetch Supabase exécutés côté JS sans token renvoient bien `401`/`empty`.

## 8. Probes RLS — Skip par défaut

`RUN_INTRUSIVE=1` désactivé. Pour activer :

```bash
RUN_INTRUSIVE=1 npx playwright test 03-security.spec.js
```

À implémenter avec :
- 2 comptes patient test (A, B)
- 2 comptes médecin test
- Probe `from('appointments').select('*')` → A doit voir uniquement ses RDV, jamais ceux de B.

## 9. Audit code source — pas de credentials hardcodés

```
grep -rE "(password|secret|api_?key)\s*[:=]\s*['\"][A-Za-z0-9]{16,}" js/ *.html
```

À exécuter au prochain run. Résultat attendu : 0 match (anon Supabase key OK, exclue par filtre).

## 10. CSRF

Forms en POST vers Supabase fonctionnent via JWT Bearer — pas de session cookie classique → risque CSRF nul tant qu'on n'utilise pas de cookies pour l'auth.

Si Netlify Functions sont introduites, prévoir CSRF tokens.

## 11. Upload de fichiers

Non audité (fonctionnalité dans `tabibi-doc-upload.js` — non couverte par cette campagne).

À couvrir : type MIME, taille max, validation côté serveur Supabase Storage (bucket policies).

## 12. Sommaire des recommandations

| # | Action | Priorité |
|---|---|---|
| **S1** | Confirmer que les pages auth-gated ne fuitent pas de PII | **CRIT** |
| **S2** | Activer + maintenir tests RLS intrusifs sur DB de test | **CRIT** |
| **S3** | Étendre XSS testing à tous les champs texte utilisateur (motif RDV, bio médecin) | MAJ |
| **S4** | Auditer les uploads `tabibi-doc-upload.js` (whitelisting MIME, taille, scan AV) | MAJ |
| **S5** | Plan progressif de réduction de `'unsafe-inline'` dans CSP | MAJ |
| **S6** | Activer `Cross-Origin-Embedder-Policy` si applicable | MIN |
| **S7** | Vérifier que `x-xss-protection` reste compatible — option : `0` recommandé | MIN |
