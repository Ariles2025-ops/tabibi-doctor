# Tests manuels — `js/tabibi-booking.js` (Phase 5.2.1)

> **Phase** : 5.2.1
> **Date** : 2026-05-22
> **Fichier testé** : `js/tabibi-booking.js`
> **Méthode** : tests **DevTools Console** dans un sandbox (le helper n'est
> encore inclus dans aucune page en 5.2.1 — l'inclusion arrivera en 5.2.3).
>
> **Durée** : ~15 min pour les 12 tests.

---

## 🛠 Setup sandbox (à faire UNE fois avant les tests)

1. Ouvre n'importe quelle page qui charge `js/supabase-client.js` (ex: `https://fascinating-seahorse-f1f2dd.netlify.app/login.html`)
2. Ouvre DevTools (F12) → onglet Console
3. Charge le helper à la volée :
   ```js
   const s = document.createElement('script');
   s.src = '/js/tabibi-booking.js';
   document.body.appendChild(s);
   await new Promise(r => s.onload = r);
   console.log('tabibiBooking chargé :', typeof window.tabibiBooking);
   // Attendu : "object"
   ```
4. Confirme API disponible :
   ```js
   Object.keys(window.tabibiBooking);
   // Attendu : ["getAvailableSlots","createAppointment","listMyAppointments","cancelMyAppointment","errorMessage","CODES"]
   ```

---

## Constantes

```js
const DOCTOR_ID = '023bbccc-e2ba-45ad-8c9a-8fca85da18fa';  // medecin.test, claim
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const NON_CLAIM_UUID = '<id d'une fiche non-claim, à récupérer via SQL si besoin>';
```

---

## T1 — `getAvailableSlots` jour ouvré (dimanche)

```js
// Anon ou patient loggé, peu importe (la RPC accepte les 2)
const r = await window.tabibiBooking.getAvailableSlots(DOCTOR_ID, '2026-06-07', 30);
console.log(r);
```

**Attendu ✅** :
```js
{ok: true, data: [{slot_start: "2026-06-07T08:00:00+00:00", slot_end: "..."}, ...]}
// 16 lignes (dim 09-13 + 14-18 en local Algeria = 08-12 + 13-17 en UTC)
```

**KO connu** : `{ok:false, error:'ERR_TIMEOUT'}` → RPC lente, augmenter timeout ou check réseau.

- [ ] ✅ Passé (___ slots)
- [ ] ❌ Échec :

---

## T2 — `getAvailableSlots` validation input

```js
// UUID invalide
console.log(await window.tabibiBooking.getAvailableSlots('not-a-uuid', '2026-06-07', 30));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}

// Date passée
console.log(await window.tabibiBooking.getAvailableSlots(DOCTOR_ID, '2020-01-01', 30));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}

// Date > J+90
const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 100);
console.log(await window.tabibiBooking.getAvailableSlots(DOCTOR_ID, farFuture, 30));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}

// slotDuration hors range
console.log(await window.tabibiBooking.getAvailableSlots(DOCTOR_ID, '2026-06-07', 3));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}
```

- [ ] ✅ Passé (4/4 retournent ERR_INVALID_INPUT)
- [ ] ❌ Échec :

---

## T3 — `getAvailableSlots` jour fermé (vendredi)

```js
const r = await window.tabibiBooking.getAvailableSlots(DOCTOR_ID, '2026-06-05', 30);
console.log(r);
// Attendu : {ok:true, data:[]}  (vendredi fermé en Algeria)
```

- [ ] ✅ Passé (data.length === 0)
- [ ] ❌ Échec :

---

## T4 — `getAvailableSlots` doctor inexistant

```js
const r = await window.tabibiBooking.getAvailableSlots(FAKE_UUID, '2026-06-07', 30);
console.log(r);
// Attendu : {ok:true, data:[]} (guard is_claimed côté RPC retourne vide)
// Note : on ne retourne PAS ERR_DOCTOR_NOT_CLAIMED ici car indistinguable
// d'un jour sans slot libre. UX patient : "Aucun créneau disponible".
```

- [ ] ✅ Passé
- [ ] ❌ Échec :

---

## T5 — `createAppointment` sans session = ERR_AUTH_REQUIRED

```js
// Si tu es loggé, déconnecte-toi d'abord :
// await window.tabibi.supabase.auth.signOut();

const r = await window.tabibiBooking.createAppointment({
  doctorId: DOCTOR_ID,
  scheduledAt: '2026-07-01T14:00:00+01:00',
  durationMinutes: 30,
  reason: 'Test consult'
});
console.log(r);
// Attendu : {ok:false, error:'ERR_AUTH_REQUIRED'}
```

- [ ] ✅ Passé
- [ ] ❌ Échec :

---

## T6 — `createAppointment` validation input

```js
// reason vide
console.log(await window.tabibiBooking.createAppointment({
  doctorId: DOCTOR_ID,
  scheduledAt: '2026-07-01T14:00:00+01:00',
  reason: '   '  // que des espaces
}));
// Attendu : {ok:false, error:'ERR_REASON_REQUIRED'}

// doctorId invalide
console.log(await window.tabibiBooking.createAppointment({
  doctorId: 'invalid',
  scheduledAt: '2026-07-01T14:00:00+01:00',
  reason: 'Test'
}));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}

// scheduledAt passé
console.log(await window.tabibiBooking.createAppointment({
  doctorId: DOCTOR_ID,
  scheduledAt: '2020-01-01T14:00:00+01:00',
  reason: 'Test'
}));
// Attendu : {ok:false, error:'ERR_INVALID_INPUT'}
```

- [ ] ✅ Passé (3/3)
- [ ] ❌ Échec :

---

## T7 — `createAppointment` succès (patient loggé)

**Pré-requis** : `await window.tabibi.auth.signIn('patient.test@tabibi.doctor', '<password>')` OU être déjà loggé patient.

```js
const r = await window.tabibiBooking.createAppointment({
  doctorId: DOCTOR_ID,
  scheduledAt: '2026-07-15T15:00:00+01:00',  // futur, dans working_hours
  durationMinutes: 30,
  reason: 'Test E2E Phase 5.2.1',
  notesPatient: 'Test auto'
});
console.log(r);
// Attendu : {ok:true, data: {id:"...", status:"pending", scheduled_at:"...", ...}}
```

**Cleanup** :
```sql
-- Dans Supabase SQL Editor (bypass RLS)
DELETE FROM public.appointments WHERE reason = 'Test E2E Phase 5.2.1';
```

- [ ] ✅ Passé (RDV créé avec id retourné)
- [ ] ❌ Échec :

---

## T8 — `listMyAppointments` sans session

```js
// Déconnecté
const r = await window.tabibiBooking.listMyAppointments();
console.log(r);
// Attendu : {ok:false, error:'ERR_AUTH_REQUIRED', data:[]}
```

- [ ] ✅ Passé
- [ ] ❌ Échec :

---

## T9 — `listMyAppointments` patient loggé

**Pré-requis** : être loggé + avoir au moins 1 RDV créé via T7 (ou un autre).

```js
const r = await window.tabibiBooking.listMyAppointments();
console.log(r);
// Attendu : {ok:true, data:[{id, scheduled_at, doctor_id, status, ...}, ...]}
```

- [ ] ✅ Passé (___ RDV)
- [ ] ❌ Échec :

---

## T10 — `cancelMyAppointment` succès

**Pré-requis** : avoir créé un RDV via T7, noter son `id`.

```js
const APPT_ID = '<id du RDV créé en T7>';
const r = await window.tabibiBooking.cancelMyAppointment(APPT_ID, 'Test cancel Phase 5.2.1');
console.log(r);
// Attendu : {ok:true, data: {id:..., status:"cancelled", cancelled_at:"...", ...}}
```

- [ ] ✅ Passé
- [ ] ❌ Échec :

---

## T11 — `cancelMyAppointment` RDV introuvable

```js
const r = await window.tabibiBooking.cancelMyAppointment(FAKE_UUID, 'no reason');
console.log(r);
// Attendu : {ok:false, error:'ERR_NOT_FOUND'}
```

- [ ] ✅ Passé
- [ ] ❌ Échec :

---

## T12 — `errorMessage(code)` mapping FR

```js
console.log(window.tabibiBooking.errorMessage('ERR_AUTH_REQUIRED'));
// Attendu : "Connexion requise pour confirmer le RDV."

console.log(window.tabibiBooking.errorMessage('ERR_SLOT_TAKEN'));
// Attendu : "Ce créneau n'est plus disponible. Choisissez-en un autre."

console.log(window.tabibiBooking.errorMessage('ERR_DOES_NOT_EXIST'));
// Attendu : "Erreur inattendue. Détails dans la console (F12)." (fallback)

console.log(Object.keys(window.tabibiBooking.CODES).length);
// Attendu : 13
```

- [ ] ✅ Passé (3 messages corrects + 13 codes)
- [ ] ❌ Échec :

---

## 📊 Récap

| # | Test | Status |
|---|---|---|
| T1 | getAvailableSlots ouvré → 16 | ☐ |
| T2 | getAvailableSlots 4 inputs invalides | ☐ |
| T3 | getAvailableSlots fermé → 0 | ☐ |
| T4 | getAvailableSlots doctor inexistant → 0 | ☐ |
| T5 | createAppointment sans session → ERR_AUTH_REQUIRED | ☐ |
| T6 | createAppointment 3 validations input | ☐ |
| T7 | createAppointment succès patient loggé | ☐ |
| T8 | listMyAppointments sans session | ☐ |
| T9 | listMyAppointments patient loggé | ☐ |
| T10 | cancelMyAppointment succès | ☐ |
| T11 | cancelMyAppointment introuvable → ERR_NOT_FOUND | ☐ |
| T12 | errorMessage + CODES | ☐ |

**Décision Phase 5.2.2** :
- **12/12 ✅** → GO bouton "Prendre RDV" dans doctor-profile.html
- **≤ 10/12 ✅** → STOP hotfix tabibi-booking.js avant suite

---

## 🔗 Références

- Helper : `js/tabibi-booking.js` (Phase 5.2.1)
- RPC sous-jacente : `migrations/PHASE5_1bis_get_available_slots_rpc.sql`
- Table : `appointments` (24 col + starts_at/ends_at GENERATED via trigger Phase 5.1bis)
- Enum statuses : `appointment_status` (pending/confirmed/cancelled/completed/no_show)
- Pattern référence : `js/tabibi-doctor-dashboard.js` (Phase 4.B.3-fix3)
- Compte test patient : à créer si pas existant (`patient.test@tabibi.doctor`)
