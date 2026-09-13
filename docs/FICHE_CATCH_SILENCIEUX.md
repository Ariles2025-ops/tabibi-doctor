# Fiche — les `try/catch` silencieux (mesure du 13/09/2026)

> Un `catch` qui avale sans signaler est la meme faute que le badge vert par defaut, que le
> `|| 'Pending'` et que le bouton qui annonce sans agir : **un defaut qui se presente comme un etat
> normal.**

## L'angle mort de cet inventaire : le SQL

**Ce document ne compte que le JavaScript.** `EXCEPTION WHEN OTHERS THEN NULL` est l'orthographe
Postgres de `catch(e){}`, et aucune des 226 lignes ci-dessous ne le voit.

Exemple trouve le 13/09/2026 dans `public.accept_cabinet_invitation` :

```sql
BEGIN
  INSERT INTO public.audit_log(actor_id, action, target_type, target_id, payload)
  VALUES (v_user, 'cabinet_member:accept', 'cabinet', p_cabinet_id,
          jsonb_build_object('role', v_role));
EXCEPTION WHEN OTHERS THEN NULL; END;
```

Le handler avale l'echec de l'ecriture du **journal d'audit** — la trace que la loi 25-11 exige.
L'adhesion est enregistree, l'audit ne l'est pas, et rien ne le dit.

Mesure en cours : `scratchpad/catch-sql-mesure.sql`, en lecture seule, a lancer par Aghiles.
Quatre requetes : les fonctions porteuses d'un `EXCEPTION WHEN OTHERS`, le compte global, le corps
exact des handlers pour les qualifier a la main, et **celles qui ecrivent dans `audit_log` avec un
handler nu**.

## Un defaut voisin, trouve en lisant la meme fonction

`accept_cabinet_invitation` rend `{"error": "no_pending_invitation"}` quand l'UPDATE ne touche
**aucune** ligne — elle ne ment pas. Mais `signup.html:499` ne lit que `acceptRes.error`, qui est
l'erreur de **transport** du client PostgREST, pas le contenu de la reponse. Un appel qui reussit en
renvoyant `{"error": ...}` a `acceptRes.error === null`.

Le code enchaine donc sur `_persistAndGo(..., "secretaire", "active", ...)`, le toast
« Compte cree avec succes ! » et la redirection vers le tableau de bord secretaire — **sans aucune
adhesion au cabinet**. Idem pour `not_authenticated`.

Ce n'est pas un `catch` muet : c'est **la mauvaise moitie de la reponse qui est lue**. Meme famille,
autre mecanisme — la fonction dit non, personne ne l'ecoute.

## Le compte

**465 blocs `catch` dans le depot. 226 n'ecrivent RIEN** — ni `console.warn/error`, ni
`window.tabibiErreur`, ni `captureErr`, ni `toastM`, ni `throw`, ni `reject`.

| Categorie | Nombre | Ce qui devient invisible |
|---|---|---|
| **A — ecriture** | 20 | un echec d'ecriture passe pour un succes |
| **B — rendu** | 31 | l'ecran reste vide, la console propre |
| **C — lecture de stockage** | 74 | repli sur une valeur par defaut ; generalement benin |
| **D — autre** | 101 | a qualifier une par une |

## Pourquoi cette fiche existe

Le 13/09/2026, un `${dt.getDate()}` laisse dans un gabarit a lance une `ReferenceError`. Elle a ete
avalee par **six `try/catch` silencieux de `doctor-dashboard.html`** (lignes 463, 544, 671, 672,
1010, 1011), tous de la forme `try { renderAgenda(); } catch(e){}`. Resultat : grille VIDE en
production, console PROPRE, deux verifications passees a cote.

En dressant cet inventaire, un **second** defaut du meme type est apparu : `submitReview()` de
`patient-dashboard.html` appelait `filtRdv(...)`, supprimee le meme jour avec le panneau
neutralise. Le chemin est atteignable — `openReview` retombe sur l'ancienne modale quand le
`doctor_id` n'est pas un UUID — et « Publier mon avis » levait une `ReferenceError`. Corrige.

**L'inventaire a trouve un bug que les tests n'avaient pas trouve.** C'est l'argument pour le tenir
a jour.


## Le chemin d'ECRITURE — la mesure resserree du 13/09/2026

Aghiles a demande « les 20, pas les 226 ». En les lisant un par un, **20 etait encore trop large** :
ma classification comptait `rpc(...)` comme une ecriture, or PostgREST poste aussi les **lectures**
(`stats_publiques` rend des listes de wilayas). Et elle comptait les `.catch()` de promesse comme des
`try/catch`.

Apres tri : **11 catch non signalants entourent un appel qui mute**, et de ces onze,
**5 rendent l'erreur a l'appelant** — ce qui est une reponse valable.

Les cinq rendus ont ete verifies **cote appelant**, ce que la mesure automatique ne peut pas faire :

| Rendu | Appelant | L'utilisateur voit-il ? |
|---|---|---|
| `js/tabibi-dawini.js:246` `dawini_create_request` | `dawini.html:472` | **oui** — `toastM(errorMessage(r.error), 'error')` |
| `js/tabibi-doctor-dashboard.js:102` `update_my_doctor_profile` | `medecin-profile.html:915` | **oui** — trois branches d'erreur nommees, chacune avec son toast |
| `js/tabibi-dawini.js:306` `.update({status:'closed'})` | idem module | rend `{ ok:false, error }` |
| `js/tabibi-dawini.js:403` `dawini_respond` | idem | rend `{ ok:false, error }` |
| `js/tabibi-dawini.js:444` `dawini_expire_old` | idem | rend `{ ok:false }` **sans la cause** — a durcir |

## Les TROIS qui restent vraiment muets

C'est la vraie reponse a « que se passe-t-il si l'ecriture echoue ? ».

### 1. `js/tabibi-messaging.js:199` — `messages.update({ read_at })`

```js
} catch (e) { /* ignore */ }
```

**Si ca echoue** : les messages restent marques non-lus en base. Le badge de la cloche ne se vide
pas, et revient au rechargement suivant. **L'utilisateur le VOIT** — il ne comprend simplement pas
pourquoi. Genant, pas dangereux : aucune donnee n'est perdue, l'ecran ne ment pas sur un succes.

### 2. `patient-ordonnances.html:243` — `mark_prescription_delivered`

```js
} catch (e) { /* tracage non bloquant */ }
```

**Si ca echoue** : rien n'est trace. Et **ca echoue TOUJOURS** : cette RPC n'existe pas en base
(`docs/FICHE_R3_APPELS_DANS_LE_VIDE.md`, section A). Le commentaire « tracage non bloquant » decrit
une degradation acceptable ; la realite est une fonction qui n'a jamais rien fait. Le drapeau
`prescriptions: false` la masque aujourd'hui.

### 3. `signup.html:498` — `validate_cabinet_invitation`

```js
} catch(_v){}
```

**Si ca echoue** : l'inscription continue vers `accept_cabinet_invitation`, qui existe. Et **ca
echoue toujours aussi** : cette RPC est absente de la base (meme fiche). C'est donc un appel mort
dans un chemin d'inscription — la validation du code de cabinet n'a jamais eu lieu. Ce que
`accept_cabinet_invitation` refuse ensuite reste refuse ; ce qu'elle accepte n'a pas ete pre-valide.

## La regle

> **Un catch sur une ecriture ne peut JAMAIS etre muet.** Il signale a l'utilisateur, il rend
> l'erreur a l'appelant, ou il releve. Jamais il n'avale.

Sans quoi **l'ecran dit oui pendant que la base dit non, et personne ne le sait**. C'est la faute la
plus grave de la famille : contrairement au badge vert par defaut ou au bouton qui ment, elle ne
laisse aucune trace a l'ecran. Le patient croit son rendez-vous pris ; il ne l'est pas.

Et un commentaire n'est pas un signalement. `/* tracage non bloquant */` explique une intention ; il
ne dit rien a l'utilisateur, ni au journal, ni a l'appelant.

**La garde** : `npm run verifier:catch`, branchee dans `verification.yml`. Elle ne garde QUE le
chemin d'ecriture — on ne met pas 226 lignes sous un chiffre, on garde ce qui peut mentir sur une
donnee. Plafond **3**, justifie ligne par ligne dans le script. Contre-epreuve : un `catch(e){}`
autour d'un `PATCH` la fait sortir en 1 ; le meme avec `window.tabibiErreur(e, 'x')` passe.

---

## Categorie A — ECRITURE — un echec passerait pour un succes

**20 blocs.**

| Fichier:ligne | Ce que le `try` entoure |
|---|---|
| `dawini.html:709` | `try { var both = await Promise.all([ s.rpc('dawini_top_missing', { p_days: days, p_wilaya: wilaya }), s.rpc('d` |
| `doctor-claim.html:326` | `try { var r = await fetch(_SB_URL + '/rest/v1/rpc/stats_publiques', { method:'POST', headers:{ apikey:_SB_KEY,` |
| `js/doctors-display.js:172` | `try { var res = await sb.rpc('praticien', { p_id: String(id) }).maybeSingle(); if (res.error) return { data: n` |
| `js/doctors-display.js:188` | `try { var res = await sb.rpc('praticien', { p_legacy_id: n }).maybeSingle(); if (res.error) return { data: nul` |
| `js/doctors-display.js:206` | `try { var res = await sb.rpc('chercher_praticiens', _rpcArgs(opts, 1, 1)); if (res.error) return { count: 0, e` |
| `js/doctors-display.js:223` | `try { var res = await sb.rpc('praticiens_par_ids', { p_ids: safeIds }); if (res.error) return { data: [], erro` |
| `js/tabibi-agenda.js:173` | `try { var s = localStorage.getItem('tabibi_lang'); if (s === 'fr' \|\| s === 'ar' \|\| s === 'en') return s; } cat` |
| `js/tabibi-agenda.js:524` | `try { var s = localStorage.getItem('tabibi_lang'); if (s === 'fr' \|\| s === 'ar' \|\| s === 'en') return s; } cat` |
| `js/tabibi-dawini.js:246` | `try { var r = await _withTimeout( s.rpc('dawini_create_request', { p_medicaments: meds, p_wilaya: wilaya, p_im` |
| `js/tabibi-dawini.js:306` | `try { var r = await _withTimeout( s.from('dawini_requests').update({ status: 'closed' }).eq('id', requestId), ` |
| `js/tabibi-dawini.js:403` | `try { var r = await _withTimeout( s.rpc('dawini_respond', { p_request_id: opts.requestId, p_status: opts.accep` |
| `js/tabibi-dawini.js:421` | `try { var r = await _withTimeout( s.rpc('dawini_get_patient_contact', { p_request_id: requestId }), 8000, 'daw` |
| `js/tabibi-dawini.js:434` | `try { var r = await _withTimeout(s.rpc('dawini_pharmacy_stats'), 8000, 'dawini_stats'); if (r.error) return { ` |
| `js/tabibi-dawini.js:444` | `try { await _withTimeout(s.rpc('dawini_expire_old'), 6000, 'dawini_expire'); return { ok: true }; }` |
| `js/tabibi-doctor-dashboard.js:102` | `try { var r = await s.rpc('update_my_doctor_profile', params); if (r.error) { var code = (r.error.message \|\| '` |
| `js/tabibi-messaging.js:70` | `try { if (doctorIds.length) { // [C1 2026-09-09] RPC praticiens_par_ids (≤ 100 UUID connus) — la vue n'est plu` |
| `js/tabibi-messaging.js:199` | `try { await sb.from('messages').update({ read_at: new Date().toISOString() }) .eq('conversation_id', convId).n` |
| `legal/rgpd-droits.html:222` | `try { var med = await sb.rpc('get_patient_medical_data'); if (med.error) payload.errors.push('medical: ' + med` |
| `patient-ordonnances.html:243` | `try { await window.tabibi.supabase.rpc('mark_prescription_delivered', { p_prescription_id: prescriptionId, p_c` |
| `signup.html:498` | `try{ await window.tabibi.supabase.rpc("validate_cabinet_invitation", { p_code: P.cabinetCode }); }` |

## Categorie B — RENDU — l'ecran resterait vide, console propre

**31 blocs.**

| Fichier:ligne | Ce que le `try` entoure |
|---|---|
| `404.html:126` | `try { document.getElementById("bad-url").textContent = location.pathname + location.search; }` |
| `admin-dashboard.html:531` | `try { const { count } = await window.tabibi.supabase .from('reviews') .select('id', { count: 'exact', head: tr` |
| `conversation.html:138` | `try { var c = await M.getConversation(CONV_ID); if(!c){ document.getElementById('conv-title').textContent = _t` |
| `doctor-dashboard.html:463` | `try { renderAgenda(); }` |
| `doctor-dashboard.html:544` | `try { renderAgenda(); }` |
| `doctor-dashboard.html:671` | `try { renderToday(); }` |
| `doctor-dashboard.html:672` | `try { if (typeof renderAgenda === 'function') renderAgenda(); }` |
| `doctor-dashboard.html:677` | `try { const activeBtn = document.querySelector('[data-fr].active'); const f = activeBtn ? activeBtn.dataset.fr` |
| `doctor-dashboard.html:1010` | `try { renderToday(); }` |
| `doctor-dashboard.html:1011` | `try { renderAgenda(); }` |
| `doctor-dashboard.html:1012` | `try { var _ab = document.querySelector("[data-fr].active"); filtMRdv(_ab ? _ab.dataset.fr : "all", _ab); }` |
| `doctor-dashboard.html:1013` | `try { renderPatients(); }` |
| `doctor-dashboard.html:1014` | `try { renderProfile(); }` |
| `doctor-profile.html:669` | `try { if (currentDoc) { if (typeof _injectPhase13Sections === 'function') _injectPhase13Sections(currentDoc); ` |
| `js/tabibi-i18n.js:177` | `try { const meta = document.querySelector('meta[name="tabibi-page-key"]'); if (!meta) return; const key = meta` |
| `js/tabibi-prelang.js:53` | `try { var _cs = document.currentScript, _base = 'js/'; if (_cs && _cs.getAttribute('src')) _base = _cs.getAttr` |
| `js/tabibi-reviews.js:443` | `try { await api.submitReview({ doctorId, appointmentId, ratingOverall: overall, ratingPunctuality: get('punctu` |
| `js/tabibi-reviews.js:491` | `try { await api.reportReview(reviewId, checked.value, details \|\| null); modal.querySelector('.box').innerHTML ` |
| `js/tabibi-seo-anonymize.js:94` | `try { var data = JSON.parse(s.textContent); if (data && data['@type'] === 'Physician') { // Remplace par versi` |
| `medecin-profile.html:61` | `try":"DZ" }, "url": location.href }; if (detail.rating && detail.reviewCount) { schema.aggregateRating = { "@t` |
| `medecin-profile.html:999` | `try { var ordre = localStorage.getItem('tabibi_claim_ordre'); var f_ordre = document.getElementById('f_ordre')` |
| `medecin-profile.html:1075` | `try{renderSchedule();}` |
| `medecin-profile.html:1075` | `try{renderDiplomas();}` |
| `mes-rdv.html:652` | `try { if(!document.querySelector('.rdv-skeleton')) _renderAll(); }` |
| `patient-profile.html:563` | `try { renderFamily(); renderCards(); }` |
| `reservation.html:674` | `try { if (typeof renderDoctorSummary === 'function') renderDoctorSummary(); if (calMonth && typeof renderCalen` |
| `secretaire-dashboard.html:458` | `try{renderWeek();}` |
| `signup.html:663` | `try { // [C3] var r = await _up.submit(profileId); // [C3] if (r && r.ok) { // [C3] var _ul = document.getElem` |
| `teleconsultation.html:659` | `try { var sid = parseSessionId(); if (!sid) { showError('Lien invalide. Verifiez l\'URL ou retournez a votre t` |
| `verify-email.html:124` | `try { if (typeof tabibiT === 'function') { var _lbl0 = document.getElementById('vm-resend-label'); if (_lbl0) ` |
| `waiting-list.html:824` | `try { if (!window.tabibi \|\| !window.tabibi.supabase) { document.getElementById('stat-total').textContent = '50` |

## Categorie C — LECTURE de stockage — repli sur une valeur par defaut, generalement benin

**74 blocs.**

| Fichier:ligne | Ce que le `try` entoure |
|---|---|
| `admin-dashboard.html:164` | `try { localStorage.removeItem("tabibi_user"); localStorage.removeItem("tabibi_role"); sessionStorage.setItem("` |
| `api-docs.html:304` | `try { localStorage.setItem("tabibi_api_docs_lang", lang); }` |
| `api-docs.html:309` | `try { const saved = localStorage.getItem("tabibi_api_docs_lang"); if (saved) setLang(saved); }` |
| `conversation.html:116` | `try{ _r=(JSON.parse(localStorage.getItem('tabibi_user')\|\|'{}').role\|\|''); }` |
| `doctor-analytics.html:502` | `try { const u = JSON.parse(localStorage.getItem('tabibi_user') \|\| 'null'); if (!u \|\| (u.role !== 'medecin' && ` |
| `doctor-claim.html:428` | `try { localStorage.setItem('tabibi_claim_ordre', document.getElementById('dc-ordre').value.trim()); }` |
| `doctor-claim.html:497` | `try { localStorage.removeItem('tabibi_pending_claim_legacy_id'); }` |
| `doctor-dashboard.html:385` | `try { localStorage.removeItem("tabibi_user"); localStorage.removeItem("tabibi_role"); // Flag temporaire pour ` |
| `doctor-dashboard.html:459` | `try { localStorage.removeItem('tabibi_doctor_schedule'); localStorage.removeItem('tabibi_doc_slots'); }` |
| `doctor-dashboard.html:989` | `try { cu = JSON.parse(localStorage.getItem('tabibi_user') \|\| 'null'); }` |
| `doctor-dashboard.html:998` | `try { localStorage.setItem('tabibi_user', JSON.stringify(cu)); }` |
| `doctor-profile.html:561` | `try { var favs = JSON.parse(localStorage.getItem("tabibi_favs") \|\| "[]"); if (favs.includes(d.id)) { var fb = ` |
| `doctor-profile.html:636` | `try { u = JSON.parse(localStorage.getItem("tabibi_user") \|\| "null"); }` |
| `index.html:977` | `try { // Re-check du flag (au cas où il s'est ajouté entre temps) if (sessionStorage.getItem("tabibi_just_logg` |
| `index.html:979` | `try { // Re-check du flag (au cas où il s'est ajouté entre temps) if (sessionStorage.getItem("tabibi_just_logg` |
| `index.html:1309` | `try{ u=JSON.parse(localStorage.getItem("tabibi_user")\|\|"null"); }` |
| `js/auth.js:76` | `try { return JSON.parse(localStorage.getItem('tabibi_user')\|\|'null'); }` |
| `js/capacitor-bridge.js:271` | `try { const Preferences = _plug('Preferences'); if (!Preferences) return localStorage.getItem(key); const { va` |
| `js/capacitor-bridge.js:285` | `try { const Preferences = _plug('Preferences'); if (!Preferences) { localStorage.setItem(key, value); return; ` |
| `js/capacitor-bridge.js:297` | `try { const Preferences = _plug('Preferences'); if (!Preferences) { localStorage.removeItem(key); return; } aw` |
| `js/home-app.js:398` | `try { const s = localStorage.getItem("tabibi_user"); if (s) user = JSON.parse(s); }` |
| `js/home-app.js:588` | `try{return JSON.parse(localStorage.getItem("tabibi_favs")\|\|"[]");}` |
| `js/home-app.js:712` | `try{ sessionStorage.setItem('tb_stats_v2', JSON.stringify({t:Date.now(), v:v})); }catch (e) { (window.tabibiEr` |
| `js/tabibi-analytics.js:34` | `try { var raw = localStorage.getItem('tabibi_cookie_consent'); if (raw) { var c = JSON.parse(raw); if (c && c.` |
| `js/tabibi-avatar.js:290` | `try { const u = JSON.parse(localStorage.getItem('tabibi_user') \|\| '{}'); photoUrl = u.photo_url \|\| null; }` |
| `js/tabibi-beta.js:115` | `try { const ts = parseInt(localStorage.getItem(DISMISS_KEY) \|\| '0', 10); return ts && (Date.now() - ts) < DISM` |
| `js/tabibi-claim.js:139` | `try { localStorage.removeItem(ORDRE_KEY); } catch (e) { (window.tabibiErreur \|\| console.warn)(e, 'tabibi-claim` |
| `js/tabibi-cookies.js:27` | `try { const raw = localStorage.getItem(KEY); if (!raw) return null; const parsed = JSON.parse(raw); if (!parse` |
| `js/tabibi-desktop-nav.js:45` | `try { return localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `js/tabibi-features.js:133` | `try { var raw = localStorage.getItem('tabibi_features_override') \|\| ''; if (raw) { var parsed = JSON.parse(raw` |
| `js/tabibi-i18n.js:91` | `try { const l = localStorage.getItem('tabibi_lang'); if (['fr', 'ar', 'en'].includes(l)) return l; }` |
| `js/tabibi-messaging.js:29` | `try { var u = JSON.parse(localStorage.getItem('tabibi_user') \|\| 'null'); return (u && u.id) \|\| null; }` |
| `js/tabibi-network.js:93` | `try { return JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) \|\| '[]'); }` |
| `js/tabibi-temps.js:49` | `try { l = (window.tabibiLang && window.tabibiLang.get()) \|\| localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `legal/cgu.html:495` | `try { localStorage.setItem('tabibi_lang', lang); }` |
| `legal/cgu.html:525` | `try { // [FIX 2026-05-18] Bug operator precedence: \|\| a une priorite > ?: donc l'ancien code // ( ls \|\| nav.st` |
| `legal/confidentialite.html:362` | `try { localStorage.setItem('tabibi_lang', lang); }` |
| `legal/confidentialite.html:380` | `try { const saved = localStorage.getItem('tabibi_lang') \|\| ((navigator.language \|\| '').startsWith('ar') ? 'ar'` |
| `legal/cookies.html:271` | `try { return JSON.parse(localStorage.getItem(CONSENT_KEY)) \|\| { analytics: false, marketing: false, ts: null }` |
| `legal/cookies.html:274` | `try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, ts: Date.now() })); }` |
| `legal/cookies.html:321` | `try { localStorage.setItem('tabibi_lang', lang); }` |
| `legal/cookies.html:339` | `try { const saved = localStorage.getItem('tabibi_lang') \|\| ((navigator.language \|\| '').startsWith('ar') ? 'ar'` |
| `legal/mentions-legales.html:251` | `try { localStorage.setItem('tabibi_lang', lang); }` |
| `legal/mentions-legales.html:269` | `try { const saved = localStorage.getItem('tabibi_lang') \|\| ((navigator.language \|\| '').startsWith('ar') ? 'ar'` |
| `legal/rgpd-droits.html:229` | `try { payload.appointments = JSON.parse(localStorage.getItem('tabibi_rdv') \|\| '[]'); }` |
| `legal/rgpd-droits.html:233` | `try { payload.appointments = JSON.parse(localStorage.getItem('tabibi_rdv') \|\| '[]'); } catch (e) {} } else { p` |
| `legal/rgpd-droits.html:236` | `try { payload.favorites = JSON.parse(localStorage.getItem('tabibi_favs') \|\| '[]'); }` |
| `medecin-profile.html:471` | `try { var _cu = JSON.parse(localStorage.getItem('tabibi_user') \|\| 'null'); if (_cu) { _cu._validation_status =` |
| `medecin-profile.html:518` | `try { u = JSON.parse(localStorage.getItem('tabibi_user') \|\| 'null'); }` |
| `medecin-profile.html:579` | `try { localStorage.setItem('tabibi_user', JSON.stringify(u)); }` |
| `medecin-profile.html:636` | `try{u=JSON.parse(localStorage.getItem("tabibi_user")\|\|"null");}` |
| `medecin-profile.html:670` | `try { localStorage.setItem("tabibi_user", JSON.stringify(u)); }` |
| `medecin-profile.html:1064` | `try { localStorage.removeItem('tabibi_claim_ordre'); }` |
| `mes-rdv.html:210` | `try { l = (window.tabibiLang && window.tabibiLang.get()) \|\| localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `messages.html:107` | `try { role = (JSON.parse(localStorage.getItem('tabibi_user')\|\|'{}').role \|\| ''); }` |
| `messages.html:115` | `try{ _r=(JSON.parse(localStorage.getItem('tabibi_user')\|\|'{}').role\|\|''); }` |
| `notifications.html:75` | `try { l = (window.tabibiLang && window.tabibiLang.get()) \|\| localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `onboarding-medecin.html:391` | `try { const apps = JSON.parse(localStorage.getItem('tabibi_doctor_applications') \|\| '[]'); apps.push(data); lo` |
| `patient-dashboard.html:257` | `try { localStorage.removeItem("tabibi_user"); localStorage.removeItem("tabibi_role"); sessionStorage.setItem("` |
| `patient-dashboard.html:628` | `try { var _r=(JSON.parse(localStorage.getItem('tabibi_user')\|\|'{}').role\|\|'').toLowerCase(); if(_r==='medecin'` |
| `patient-dashboard.html:792` | `try { var raw = localStorage.getItem('tabibi_favs') \|\| '[]'; var arr = JSON.parse(raw); return Array.isArray(a` |
| `patient-profile.html:278` | `try{u=JSON.parse(localStorage.getItem("tabibi_user")\|\|"null");}` |
| `payment.html:139` | `try { l = (window.tabibiLang && window.tabibiLang.get()) \|\| localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `payment.html:206` | `try{ localStorage.setItem('tabibi_payment_method', _selectedMethod); }` |
| `reservation.html:280` | `try { return (localStorage.getItem('tabibi_lang') \|\| document.documentElement.lang) === 'ar'; }` |
| `reservation.html:284` | `try { return (localStorage.getItem('tabibi_lang') \|\| document.documentElement.lang) === 'en'; }` |
| `signup.html:525` | `try{ localStorage.setItem('tabibi_pending_claim_legacy_id', String(claimLegacyId)); }` |
| `signup.html:527` | `try{ localStorage.setItem('tabibi_pending_claim_legacy_id', String(claimLegacyId)); }` |
| `signup.html:574` | `try{ localStorage.setItem("tabibi_user", JSON.stringify({ id: id, email: "", role: role, status: status, name:` |
| `signup.html:694` | `try { localStorage.removeItem('tabibi_user'); localStorage.removeItem('tabibi_role'); }` |
| `signup.html:696` | `try { localStorage.removeItem('tabibi_user'); localStorage.removeItem('tabibi_role'); } catch(e){} if (window.` |
| `success.html:52` | `try { l = (window.tabibiLang && window.tabibiLang.get()) \|\| localStorage.getItem('tabibi_lang') \|\| 'fr'; }` |
| `waiting-list.html:737` | `try { localStorage.setItem('tabibi_lang', lang); }` |
| `waiting-list.html:773` | `try { preferredLang = localStorage.getItem('tabibi_lang') \|\| preferredLang; }` |

## Categorie D — AUTRE — a qualifier une par une

**101 blocs.**

| Fichier:ligne | Ce que le `try` entoure |
|---|---|
| `admin-dashboard.html:159` | `try { if (window.tabibi && window.tabibi.auth) { await window.tabibi.auth.signOut(); } else if (window.tabibi ` |
| `admin-dashboard.html:362` | `try { const { data: udata } = await window.tabibi.supabase .from('users') .select('preferred_language') .eq('i` |
| `admin-dashboard.html:417` | `try { const { data: udata } = await window.tabibi.supabase .from('users') .select('preferred_language') .eq('i` |
| `admin-doctor-validation.html:168` | `try{return new Date(iso).toLocaleDateString('fr-DZ',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit'` |
| `admin-doctor-validation.html:501` | `try{await window.tabibi.auth.signOut();}` |
| `admin-reviews.html:200` | `try { await window.tabibi.reviews.moderate(id, newStatus, reason); const card = document.getElementById('rv-' ` |
| `conversation.html:151` | `try { if(M && CONV_ID) loadThread(false); }` |
| `dawini-pharmacie.html:208` | `try { when = (typeof tabibiFormatDate === 'function') ? tabibiFormatDate(req.created_at, {day:'numeric',month:` |
| `dawini-pharmacie.html:350` | `try { session = s ? (await s.auth.getSession()).data.session : null; }` |
| `dawini.html:542` | `try { when = (typeof tabibiFormatDate === 'function') ? tabibiFormatDate(req.created_at, {day:'numeric',month:` |
| `dawini.html:791` | `try { session = s ? (await s.auth.getSession()).data.session : null; }` |
| `doctor-analytics.html:508` | `try { render(); }` |
| `doctor-claim.html:208` | `try{_dcAbort.abort();}` |
| `doctor-claim.html:358` | `try { var info = await window.tabibiClaim.getCurrentUserInfo(); isAuth = !!(info && info.isAuth); }` |
| `doctor-claim.html:410` | `try { if (typeof window.toastM === 'function') return window.toastM(msg, kind \|\| 'info'); if (typeof window.to` |
| `doctor-claim.html:494` | `try { var sb = window.tabibi && window.tabibi.supabase; if (sb) { var s = await sb.auth.getSession(); email = ` |
| `doctor-claim.html:535` | `try { return new URL(location.href).searchParams.get(k) \|\| ''; }` |
| `doctor-dashboard.html:788` | `try { dateLbl = window.tabibiTemps.jourCalendaire(r.date, {weekday:'long',day:'numeric',month:'long',year:'num` |
| `doctor-dashboard.html:935` | `try { var s = Math.floor((Date.now() - new Date(iso).getTime())/1000); if(s < 60) return tabibiT('ntf_now', "à` |
| `doctor-dashboard.html:1048` | `try { if (window.tabibiClaim.pushOrdre) await window.tabibiClaim.pushOrdre(); }` |
| `doctor-dashboard.html:1114` | `try { var d = new Date(iso); var opts = allDay ? { weekday: 'short', day: 'numeric', month: 'long' } : { weekd` |
| `doctor-profile.html:183` | `` |
| `doctor-profile.html:552` | `try { loadRealReviews(d.id); }` |
| `index.html:11` | `try { var h = window.location.hash \|\| ''; if (/[#&]type=recovery/.test(h) && window.location.pathname.indexOf(` |
| `js/home-app.js:795` | `try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) \|\| window.navigato` |
| `js/home-app.js:1340` | `try { return (window.tabibiFormatDate ? window.tabibiFormatDate(isoDate, {weekday:'long', day:'numeric', month` |
| `js/home-app.js:1961` | `try { // [C1] compteurs servis par la RPC stats_publiques (agrégat, aucun nom). // Le total "référencés" reste` |
| `js/tabibi-avatar.js:44` | `try { const sb = _supabase(); if (!sb) return null; const { data: { session } } = await sb.auth.getSession(); ` |
| `js/tabibi-booking.js:209` | `try { var r = await _withTimeout(s.auth.getSession(), 5000, 'get_session'); var sess = (r && r.data && r.data.` |
| `js/tabibi-brevo.js:630` | `try { if (!window.tabibi \|\| !window.tabibi.supabase) { throw new Error('Supabase client non disponible'); } co` |
| `js/tabibi-dawini.js:151` | `try { var r = await _withTimeout(s.auth.getSession(), 5000, 'get_session'); if (!r.data \|\| !r.data.session) re` |
| `js/tabibi-dawini.js:210` | `try { var r = await _withTimeout( s.storage.from('dawini-ordonnances').upload(path, file, { contentType: file.` |
| `js/tabibi-dawini.js:291` | `try { var rq = await _withTimeout( s.from('dawini_requests').select('*') .eq('patient_id', sess.session.user.i` |
| `js/tabibi-dawini.js:328` | `try { var r = await _withTimeout( s.from('pharmacies').select('*').eq('user_id', sess.session.user.id).maybeSi` |
| `js/tabibi-dawini.js:357` | `try { var rq = await _withTimeout( s.from('dawini_requests').select('*') .in('status', ['pending', 'answered']` |
| `js/tabibi-dawini.js:375` | `try { var r = await _withTimeout( s.storage.from('dawini-ordonnances').createSignedUrl(imagePath, 3600), 8000,` |
| `js/tabibi-doctor-dashboard.js:66` | `try { var r = await s.auth.getSession(); return !!(r && r.data && r.data.session); }` |
| `js/tabibi-doctor-dashboard.js:220` | `try { var u = await s.auth.getUser(); var user = u && u.data && u.data.user; if (!user) return { ok: false, er` |
| `js/tabibi-i18n.js:83` | `try { const nav = (navigator.language \|\| navigator.userLanguage \|\| 'fr').toLowerCase().slice(0, 2); if (['fr',` |
| `js/tabibi-i18n.js:140` | `try { // [13/09/2026] Rendait la date dans le fuseau du NAVIGATEUR. Aiguille // desormais vers js/tabibi-temps` |
| `js/tabibi-i18n.js:158` | `try { // Une heure est toujours celle d'un INSTANT : fuseau du cabinet. var T2 = (typeof window !== 'undefined` |
| `js/tabibi-messaging.js:46` | `try { var s = Math.floor((Date.now() - new Date(iso).getTime())/1000); if (s < 60) return "à l'instant"; var m` |
| `js/tabibi-messaging.js:51` | `try { return new Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Algiers' })` |
| `js/tabibi-messaging.js:136` | `try { var rm = await sb.from('messages') .select('conversation_id,body,created_at,sender_id,read_at') .order('` |
| `js/tabibi-network.js:110` | `try { const res = await fetch(item.url, item.opts); if (!res.ok && res.status >= 500) { remaining.push(item); ` |
| `js/tabibi-pixel.js:110` | `try { if (window.tabibiCookies && window.tabibiCookies.hasConsent('marketing')) enable(); }` |
| `js/tabibi-sentry.js:14` | `try. // // A inclure en bas de chaque page HTML AVANT </body> et APRES config.js. // [2026-09-09] Point d'entr` |
| `js/tabibi-sentry.js:23` | `try.captureException(erreur, { tags: { contexte: contexte \|\| 'inconnu' } }); } else { console.warn('[Tabibi]',` |
| `js/tabibi-sentry.js:139` | `try.setUser({ id: r.data.user.id }); } }).` |
| `js/tabibi-sms.js:167` | `try { if (!window.tabibi \|\| !window.tabibi.supabase) { throw new Error('Supabase client non disponible'); } co` |
| `js/tabibi-turnstile.js:225` | `try { return window.turnstile.getResponse(widgetId); }` |
| `legal/cgu.html:501` | `try { if (window.tabibiLang && typeof window.tabibiLang.set === 'function') { if (window.tabibiLang.get() !== ` |
| `legal/cgu.html:508` | `try { const newLang = (e && e.detail && e.detail.lang) \|\| (window.tabibiLang && window.tabibiLang.get()) \|\| 'f` |
| `legal/confidentialite.html:368` | `try { if (window.tabibiLang && typeof window.tabibiLang.set === 'function') { if (window.tabibiLang.get() !== ` |
| `legal/confidentialite.html:375` | `try { const newLang = (e && e.detail && e.detail.lang) \|\| (window.tabibiLang && window.tabibiLang.get()) \|\| 'f` |
| `legal/cookies.html:327` | `try { if (window.tabibiLang && typeof window.tabibiLang.set === 'function') { if (window.tabibiLang.get() !== ` |
| `legal/cookies.html:334` | `try { const newLang = (e && e.detail && e.detail.lang) \|\| (window.tabibiLang && window.tabibiLang.get()) \|\| 'f` |
| `legal/mentions-legales.html:257` | `try { if (window.tabibiLang && typeof window.tabibiLang.set === 'function') { if (window.tabibiLang.get() !== ` |
| `legal/mentions-legales.html:264` | `try { const newLang = (e && e.detail && e.detail.lang) \|\| (window.tabibiLang && window.tabibiLang.get()) \|\| 'f` |
| `legal/rgpd-droits.html:242` | `try { var rev = await sb.from('reviews').select('*').eq('patient_id', user.id); if (!rev.error) payload.review` |
| `login.html:447` | `try { await window.tabibi.auth.signOut(); }` |
| `login.html:452` | `try { await window.tabibi.auth.signOut(); }` |
| `login.html:457` | `try { await window.tabibi.auth.signOut(); }` |
| `login.html:519` | `try { var u = new URL(location.href); var n = u.searchParams.get('next'); if (!n) return null; if (n.indexOf('` |
| `login.html:585` | `try { await window.tabibi.auth.signOut(); }` |
| `login.html:592` | `try { await window.tabibi.auth.signOut(); }` |
| `login.html:599` | `try { await window.tabibi.auth.signOut(); }` |
| `medecin-profile.html:985` | `try { return new URL(location.href).searchParams.get('onboarding') === '1'; }` |
| `medecin-profile.html:1078` | `try { render2FAStatus(); }` |
| `mes-rdv.html:218` | `try { return new Intl.DateTimeFormat(_dateLocale(), { weekday:'long', day:'numeric', month:'long', year:'numer` |
| `mes-rdv.html:225` | `try { return new Intl.DateTimeFormat(_dateLocale(), { hour:'2-digit', minute:'2-digit', hour12:false, timeZone` |
| `mes-rdv.html:407` | `try { var convId = await window.tabibiMessaging.ensureConversation(doctorId); if(convId){ window.location.href` |
| `notifications.html:95` | `try { var ms = Date.now() - new Date(iso).getTime(); var s = Math.floor(ms/1000); if(s < 60) return _t('ntf_no` |
| `notifications.html:181` | `try { var _s = window.tabibi && window.tabibi.supabase; _session = _s ? (await _s.auth.getSession()).data.sess` |
| `notifications.html:192` | `try { loadNotifications(); }` |
| `patient-dashboard.html:766` | `try { return _DF_DAY.format(new Date(iso)); }` |
| `patient-dashboard.html:767` | `try { return _DF_TIME.format(new Date(iso)); }` |
| `patient-ordonnances.html:204` | `try { return (window.tabibiLang && window.tabibiLang.get()) \|\| 'fr'; }` |
| `patient-ordonnances.html:210` | `try { return new Date(iso).toLocaleDateString(DATE_LOCALES[curLang()] \|\| 'fr-FR', { day: '2-digit', month: 'sh` |
| `payment.html:173` | `try { return new URL(location.href).searchParams.get(k) \|\| ''; }` |
| `payment.html:221` | `try { init(); }` |
| `reservation.html:232` | `try { return new URLSearchParams(window.location.search).get(k) \|\| ""; }` |
| `reservation.html:279` | `try { if (window.tabibiI18n && typeof tabibiI18n.lang === 'function') return tabibiI18n.lang() === 'ar'; }` |
| `secretaire-dashboard.html:204` | `try { return window.tabibiTemps.jourCalendaire(jour, opts); }` |
| `secretaire-dashboard.html:213` | `try { if (window.tabibi && window.tabibi.supabase) await window.tabibi.supabase.auth.signOut(); }` |
| `secretaire-dashboard.html:458` | `try{loadDay(SELECTED_DAY);}` |
| `secretaire-dashboard.html:458` | `try{loadPending();}` |
| `signup.html:222` | `try { var u = new URL(window.location.href); var raw = u.searchParams.get('claim_legacy_id'); if (!raw) return` |
| `signup.html:226` | `try { return (new URL(window.location.href)).searchParams.get('role') \|\| null; }` |
| `signup.html:525` | `try{ var _claimRes = await window.tabibiClaim.autoClaim(claimLegacyId); // [C3] capturer le retour (jeté aupar` |
| `signup.html:729` | `try { selRole('medecin', medBtn); }` |
| `success.html:82` | `try { loadReceipt(); }` |
| `teleconsultation.html:324` | `try.captureException(e, { tags: { feature: 'teleconsult' }, extra: ctx \|\| {} }); } }` |
| `teleconsultation.html:348` | `try { var d = new Date(iso); var dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', mo` |
| `teleconsultation.html:430` | `try { body = await res.json(); }` |
| `teleconsultation.html:609` | `try { if (state.callFrame) { state.callFrame.destroy(); state.callFrame = null; } }` |
| `verify-email.html:106` | `try { return new URL(location.href).searchParams.get(k) \|\| ''; }` |
| `waiting-list.html:746` | `try { if (window.tabibiLang && typeof window.tabibiLang.set === 'function') { // Évite la boucle : on ne re-dé` |
| `waiting-list.html:755` | `try { const newLang = (e && e.detail && e.detail.lang) \|\| (window.tabibiLang && window.tabibiLang.get()) \|\| 'f` |
| `waiting-list.html:927` | `try { await window.tabibiBrevo.sendEmail('waiting_list_welcome', email, { count: formatNumber(500), lang: curr` |
| `waiting-list.html:933` | `try { await window.tabibiBrevo.sendEmail('waiting_list_welcome', email, { count: formatNumber(500), lang: curr` |

---

**Rien n'est corrige ici** hors les deux defauts nommes plus haut : cette fiche est une mesure,
pas un chantier. Ce qu'on en fait reste a decider.
