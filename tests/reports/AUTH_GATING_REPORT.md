# Auth Gating Report — Tabibi Security Audit
**Date** : 2026-05-27
**Branch** : audit/full-quality-sept2026
**Méthode** : curl sans cookie de session + grep patterns auth guard dans HTML retourné

---

## Résumé

Le gating auth de Tabibi est **100% JS-only** (côté client, exécuté après rendu HTML).
Le serveur (Netlify CDN) retourne HTTP 200 + le HTML complet pour toutes les pages,
y compris les dashboards protégés. La protection réside dans `waitForUser()` qui
appelle Supabase auth au chargement et redirige vers `login.html` si non authentifié.

**Conséquence** : le HTML source est accessible sans session. Le contenu rendu dans le navigateur est protégé.

---

## 1. Pages auditées — comportement sans session

| Page | HTTP | Redirect côté serveur | Auth guard JS | PII dans HTML brut | Verdict |
|---|---|---|---|---|---|
| `index.html` | 200 | Non (page publique) | Non (public) | Non | ✅ OK (page publique) |
| `doctor-profile.html?legacy_id=241` | 200 | Non (page publique) | Non (public) | Non | ✅ OK (page publique) |
| `login.html` | 200 | Non (page publique) | Non (public) | Non | ✅ OK (page publique) |
| `doctor-dashboard.html` | 200 | Non | Oui — `waitForUser(3000)` → redirect `index.html` | ⚠️ Mock data (voir §2) | 🟡 JS-ONLY |
| `patient-dashboard.html` | 200 | Non | Oui — `if (!u \|\| u.role !== "patient") { location.href = "login.html" }` | Non | 🟡 JS-ONLY |
| `admin-dashboard.html` | 200 | Non | Oui — `if (!u \|\| u.role !== "admin") { location.href = "login.html" }` | ⚠️ Mock data (voir §2) | 🟡 JS-ONLY |

---

## 2. Mock PII dans admin-dashboard.html — hardcodée dans le HTML

**Trouvé dans le HTML retourné sans session :**
```javascript
{n:"Karim Benali",e:"karim@email.dz",r:"patient",d:"2025-04-15",s:"active",p:"0555 123 456"},
{n:"Lina Khelifi",e:"lina@email.dz",r:"patient",d:"2025-04-28",s:"active",p:"0666 234 567"},
{n:"Dr. Amina Hadj",e:"amina@tabibi.dz",r:"medecin",d:"2025-04-10",s:"active",p:"0661 234 567"},
```

**Verdict** : données fictives (domaines `@email.dz`, `@tabibi.dz` non réels).
**Risque** : pattern dangereux si jamais remplacé par de vraies données Supabase dans le JS inline.
**Action recommandée** : conserver la mock data pour les démos mais ne jamais injecter de vraies données utilisateur dans le HTML server-side.

---

## 3. Guard patterns confirmés dans le code

### doctor-dashboard.html
```javascript
async function waitForUser(maxMs){ ... }
const u = await waitForUser(3000);
if (u && (u.role === 'medecin' || u.role === 'doctor')) return u;
// → redirect index.html si non medecin
```

### patient-dashboard.html
```javascript
const u = await waitForUser(3000);
if (!u || u.role !== "patient") { location.href = "login.html"; return; }
```

### admin-dashboard.html
```javascript
const u = await waitForUser(3000);
if (!u || u.role !== "admin") { location.href = "login.html"; return; }
```

---

## 4. Évaluation du modèle JS-only

### Ce qui protège réellement les données
- RLS Supabase bloque les requêtes API sans token valide (vérifié §1 RLS report)
- `waitForUser()` coupe le rendu dynamique immédiatement si session absente
- Les dashboards ne contiennent pas de données Supabase dans le HTML initial (SSR absent)

### Ce qui ne protège PAS
- Un crawler/bot voit le HTML complet (structure, mock data, logique métier)
- Lighthouse, Google, archives.org indexent le HTML sans exécuter le JS
- TTFB de la redirect : ~3s (waitForUser timeout) — vecteur de scraping de structure

### Acceptabilité pour launch MVP
**ACCEPTABLE** — la vraie ligne de défense est RLS côté Supabase.
Le JS-gating est une UX protection, pas une security boundary. Documenté comme tel.

---

## 5. Recommandation post-launch (optionnel)

Pour les pages admin uniquement, ajouter une Netlify Edge Function qui vérifie
le cookie de session Supabase avant de servir le HTML :

```javascript
// netlify/edge-functions/admin-gate.js
export default async (request, context) => {
  const cookie = request.headers.get('cookie') || ''
  const hasSession = cookie.includes('sb-pudugodhiofqrctcdwfl-auth-token')
  if (!hasSession) return Response.redirect(new URL('/login.html', request.url), 302)
  return context.next()
}
```

Effort estimé : 2h. Priorité : basse (post 500 utilisateurs).

---

## Verdict global Auth Gating

| Critère | Résultat |
|---|---|
| Données Supabase sans session | ✅ Bloquées (RLS) |
| Redirect JS en cas de non-auth | ✅ Présent sur toutes les pages protégées |
| PII réelle dans HTML sans session | ✅ Aucune |
| Mock data visible sans session (admin) | 🟡 Fictive, acceptable MVP |
| Server-side redirect (Netlify) | ⏳ Absent — recommandé post-500 users |

**Verdict global : 🟡 ACCEPTABLE MVP — renforcement post-launch recommandé**
