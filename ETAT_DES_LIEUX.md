**Version** : 1.0
**Date** : 25 juillet 2026 (mise à jour lors de l'état des lieux)
**Repo audité** : `/home/user/tabibi-doctor` (branche `claude/tabibi-documentary-ecosystem-1b2ON`)
**Auteur** : Claude — état des lieux post-audit

---

# État des lieux — Tabibi.doctor

## 0. Limite de cet état des lieux

Cet audit tourne dans un sandbox distant. **Je n'ai pas accès aux dossiers Bureau du Mac** (~/Desktop, ~/Bureau). J'ai audité :

- Le repo cloné dans `/home/user/tabibi-doctor` (branche `claude/tabibi-documentary-ecosystem-1b2ON`)
- Les fichiers de la branche `origin/audit/full-quality-sept2026` (via `git show`)
- **La prod Supabase en live** (via curl anon)

Si tu as plusieurs copies locales du repo sur ton Bureau, envoie-moi les chemins et je les cross-check.

---

## 1. Structure repo (branche `claude/tabibi-documentary-ecosystem-1b2ON`)

**Dernier commit** : `112d8c1 chore: rebuild APK signé depuis HEAD (correctifs sécurité/intégrité + versionCode 3)` (21 juillet 2026)

**Fichiers nouveaux depuis mon dernier passage** (que je n'avais pas créés) :
- `dawini.html` (51 KB) + `dawini-pharmacie.html` (23 KB) → feature localisation médicaments **implémentée en HTML**
- `conversation.html` → messagerie (?)
- `docs/mobile/` → 7 fichiers Capacitor (build, deployment, Firebase, push, testing, known issues)
- `docs/security/` → 3 fichiers **CRIT-4** (fix proposal, frontend impact, test plan)

**Branches** :
- `main`
- `claude/tabibi-documentary-ecosystem-1b2ON` (courante — écosystème doc)
- `audit/full-quality-sept2026` (audit Playwright complet)

---

## 2. Repo principal identifié

Un seul repo accessible ici : `/home/user/tabibi-doctor` avec `index.html` + `js/` + `migrations/`. Contient les 38 pages applicatives + 490 pages SEO. Impossible depuis ce sandbox de vérifier s'il y a des copies divergentes sur ton Bureau — à me confirmer.

---

## 3. A — État sécurité (5 CRIT)

| ID | Description | Statut aujourd'hui | Preuve |
|---|---|---|---|
| **CRIT-1** | RLS Supabase — dump prod complet | 🟡 **PARTIEL** | 9 tables probées, 7 propres (users/appointments/reviews/etc.). Dump exhaustif prod pas fait. Test cross-user A↔B pas fait (nécessite service_role) |
| **CRIT-2** | Gating auth pages applicatives | 🟢 **FERMÉ** | 5 pages testées, aucune PII rendue sans session (grep + validation live) |
| **CRIT-3** | Mass assignment `update_my_doctor_profile` | 🟢 **MITIGÉ (anon)** | INSERT users avec `is_admin` → 400 col inexistante ; RPC sans auth → 401. Test post-auth médecin toujours à faire |
| **CRIT-4** | `doctor_profiles` expose email/phone/*_path à anon | 🟢 **FERMÉ EN PROD** | Testé en live : `GET /rest/v1/doctor_profiles` → **HTTP 401** "permission denied for table doctor_profiles". `public_doctors` (vue) toujours accessible normalement. Docs fix dans `docs/security/CRIT-4_*.md` |
| **CRIT-5** | Signup contourne Turnstile côté REST | 🟢 **FERMÉ le 2026-07-29** | Captcha serveur actif : signup REST rejeté sans `captcha_token` (**HTTP 400 `captcha_failed`**). Vérifié sur les deux identifiants (email et téléphone) — aucun `access_token` retourné, aucun compte créé. |

### ✅ CRIT-5 — résolu (historique conservé)

**État actuel — 29/07/2026.** Le captcha serveur (Supabase Auth → Attack Protection)
est actif : la création de compte par REST est rejetée **avant** toute écriture.

```
POST /auth/v1/signup   (sans captcha_token)
  variante email    {"email":"…","password":"…"}   → HTTP 400
  variante téléphone {"phone":"+213…","password":"…"} → HTTP 400
→ {"code":400,"error_code":"captcha_failed",
   "msg":"captcha protection: request disallowed (no captcha_token found)"}
→ aucun access_token, aucun compte créé
```

**Reste à vérifier (2ᵉ ordre, sur staging)** : avec un `captcha_token` *valide*, le compte
est-il auto-confirmé (`phone_confirmed_at` / `email_confirmed_at` pré-remplis) et une session
est-elle rendue sans OTP ? Réglage à lire dans Authentication → Providers.

<details>
<summary>Historique — alerte du 25/07/2026 (périmée, conservée pour traçabilité)</summary>

Test du 25/07/2026 18h24 UTC, **avant** activation du captcha serveur :
`POST /auth/v1/signup` (email + password) → HTTP 200, `access_token` retourné directement,
`email_confirmed_at` rempli immédiatement. Le vecteur décrit ici n'est plus reproductible
(voir test du 29/07 ci-dessus).

</details>

Compte créé involontairement pendant le test du 25/07 (**toujours à nettoyer**) : `9d419394-0a16-452f-9517-aa01406fae66` (`probe_1785003856@tabibi.test`)

Ancien compte test aussi encore en base (audit mai) : `9df8df4f-a5b3-4d68-85cf-32ee08a32190`

Commande cleanup :
```sql
DELETE FROM auth.users WHERE id IN (
  '9df8df4f-a5b3-4d68-85cf-32ee08a32190',
  '9d419394-0a16-452f-9517-aa01406fae66'
);
```

---

## 4. B — Findings MAJ / MIN restants

**Lighthouse** (mesuré en mai, à re-mesurer post-fix) :
- Performance home : **67/100** (cible 80). Issues : CLS élevé, unused JS
- A11y home : **85/100** (cible 90). Issues : contrastes couleurs, labels formulaires
- Best Practices : 92-100 ✅
- SEO : 100 ✅

**Autres à faire :**
- Tests destructifs signup / prise RDV / claim → skip par défaut, nécessite DB de test isolée (`RUN_DESTRUCTIVE=1`)
- Test cross-user RLS A↔B → nécessite `service_role`
- Test mass-assignment post-auth médecin → session médecin requise
- Cross-browser WebKit → bloqué par libs sandbox (à faire sur poste local macOS)
- Screenshots tablet + mobile complets → partiels dans le run précédent

**Dette technique tracée dans PROGRESS.md :**
- Netlify non connecté à GitHub → deploy manuel par zip drag-drop (**priorité avant launch**)
- Erreur console `Failed to load /scripts/app.js 404` sur plusieurs pages
- `index.html.bak_20260523_183336` untracked à nettoyer
- TODO-SQL-008 : RPCs téléconsultation Daily.co (`get_video_session`, `set_video_recording_consent`)
- TODO-SQL-009 : Paiements Stripe Test + webhook Edge Function

---

## 5. C — État par domaine

### Écosystème documentaire (branche `claude/tabibi-documentary-ecosystem-1b2ON`)

| Dossier | Fichiers | Statut |
|---|---|---|
| `docs/legal/` | 7 (CGU, Confid, Cookies, Mentions, Chartes patient/médecin, Remboursement) | 🟡 DRAFT — attente validation avocat DZ |
| `docs/contrats/` | 4 (Partenariat médecin, NDA équipe, Prestataire, Consentement claim) | 🟡 DRAFT — attente avocat |
| `docs/operations/` | 6 (KPI, Onboarding équipe, Playbook crise, Incident tech, Modération, RGPD) | 🟢 EN VIGUEUR |
| `docs/marketing/` | 3 (Plan launch, Pitch médecin, Stratégie contenu) | 🟢 EN VIGUEUR — plan à re-caler pour décembre |
| `docs/guides-medecin/` | 4 (démarrage, gestion RDV, téléconsult, FAQ) | 🟢 EN VIGUEUR |
| `docs/guides-patient/` | 3 (démarrage, gestion RDV, FAQ) | 🟢 EN VIGUEUR |
| `docs/templates-emails/` | 8 (bienvenue, confirmation, rappel, annulation, no-show, suspension) | 🟢 EN VIGUEUR |
| `docs/mobile/` | 7 (Capacitor build, deployment, Firebase, push, tests) | 🟢 EN VIGUEUR (nouveau) |
| `docs/security/` | 3 (CRIT-4 fix proposal + frontend impact + test plan) | 🟢 APPLIQUÉ (fix effectif prod) |

### Audit Playwright (branche `origin/audit/full-quality-sept2026`)

Non-mergée. Contient :
- 6 test specs (buttons, flows, security, perf, a11y, screenshots)
- 8 rapports MD + Lighthouse HTML/JSON
- Registres RLS / RPC / Triggers dans `docs/audit/`
- 10 screenshots desktop
- **PR #2 en draft** sur GitHub

### Features produit

- ✅ Prise de RDV — existant
- ✅ Version arabe RTL — user confirmé fait
- ✅ **Dawini** (localisation médicaments) — `dawini.html` + `dawini-pharmacie.html` implémentés
- ✅ Refactor Phase 16.5 (bande passante) — validé
- 🚧 Cabine consultation en pharmacie — idée non codée
- 🚧 Tabibi Deuxième Avis — planifié Q1 2027 après launch
- 🚧 Téléconsultation (Daily.co) — front câblé, RPC backend manquantes
- 🚧 Paiement Stripe — page front prête, backend manquant

### Legal / Business

- ✅ SARL constituée
- ✅ Version arabe faite
- ✅ Congrès 3-5 décembre 2026 payé (stand inclus selon user)
- 🚧 Validation avocat DZ des 11 documents → à lancer
- 🚧 Nettoyage 79k fiches (dédoublonnage, normalisation)
- 🚧 Setup WhatsApp Business API + templates approuvés Meta
- 🚧 Assurance RC pro (à souscrire novembre)
- 🚧 Kit congrès (roll-up, flyers, cabine démo)

---

## 6. D — Top 5 actions prioritaires

| # | Action | Priorité | Effort |
|---|---|---|---|
| **1** | **Fixer CRIT-5 immédiatement** : réactiver la confirmation email OU implémenter Edge function `signup-secure` qui valide Turnstile server-side avant `auth.admin.createUser`. La faille est **aggravée** par rapport à mai. | 🔴 **CRITIQUE — cette semaine** | 4-6 h |
| **2** | **Cleanup 2 comptes test** dans `auth.users` (SQL dans §3 ci-dessus). Faisable en 1 min via Supabase Studio. | 🔴 Immédiat | 1 min |
| **3** | **Rdv avocat DZ** pour valider les 11 docs légaux/contrats (docs/legal + docs/contrats). Sans validation, tu ne peux pas faire signer un vrai contrat médecin au congrès. | 🟡 Cette semaine | 30 min (rdv) + 2-3 semaines délai retour |
| **4** | **Dump policies RLS prod complet** via `pg_policies` + versionner dans `migrations/PROD_RLS_DUMP.sql`. Puis test cross-user A↔B avec service_role. Ferme CRIT-1 résiduel. | 🟡 Cette semaine | 2-3 h |
| **5** | **Auto-deploy Netlify ← GitHub main** : plus jamais de deploy manuel par zip. Bloque un launch fiable. | 🟡 Cette semaine | 30 min |

---

## 7. En résumé — verdict

🟢 **Bonnes nouvelles :**
- CRIT-4 fermé en prod ✅ (le plus impactant PII)
- Dawini implémenté (feature killer marché DZ)
- App mobile Capacitor en place
- Écosystème doc + audit prêts

🔴 **Alerte immédiate :**
- **CRIT-5 est ouvert et pire qu'avant** (confirmation email désactivée = bots peuvent créer + logger + agir immédiatement). À traiter cette semaine sans faute.

🟡 **Reste :**
- Validation légale à lancer
- Nettoyage 79k fiches
- Fix Lighthouse Perf + A11y (~3 jours)
- Setup WhatsApp Business
- Auto-deploy Netlify

**Runway** : ~46k€ sur 3 ans, launch congrès 3-5 décembre 2026 = **4 mois pour tenir le plan**.

**Ma reco :** avant tout le reste, **fixe CRIT-5 aujourd'hui ou demain**. Le reste peut attendre 48h. Un signup ouvert non captcha + email auto-confirmé, c'est une porte ouverte à un DoS bot en 15 min.
