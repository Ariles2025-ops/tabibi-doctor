// =====================================================================
// Agenda médecin — premier écran migré en React
// ---------------------------------------------------------------------
// Trois différences de fond avec la version v1 (js/tabibi-agenda.js) :
//
//   1. Il filtre sur `scheduled_at` (NOT NULL) et non `starts_at` (nullable).
//      La v1 masquait silencieusement tout rendez-vous sans `starts_at`.
//   2. Aucune erreur n'est avalée. Une requête qui échoue s'affiche à
//      l'écran et part dans Sentry, au lieu de produire une grille vide
//      qu'un médecin prend pour une journée sans patient.
//   3. Les types viennent du schéma réel, pas d'une hypothèse.
//
// Aucun changement de schéma, aucune policy RLS touchée.
// =====================================================================
import { useMemo, useState } from 'react';
import { useSession } from '../lib/useSession';
import {
  useProfilMedecin, useAgendaSemaine, usePatients, useChangerStatut,
} from '../donnees/agenda';
import {
  debutSemaine, decalerSemaine, repartirParJour, instantRdv,
  estAnnule, rdvActifs, nomPatient, JOURS_SEMAINE,
} from '../domaine/agenda';
import type { RendezVous } from '../domaine/agenda';

const heure = new Intl.DateTimeFormat('fr-DZ', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers',
});
const jourMois = new Intl.DateTimeFormat('fr-DZ', {
  day: 'numeric', month: 'short', timeZone: 'Africa/Algiers',
});
const moisAnnee = new Intl.DateTimeFormat('fr-DZ', {
  month: 'long', year: 'numeric', timeZone: 'Africa/Algiers',
});

/** Message d'erreur visible. La v1 n'en affichait aucun : c'est le sujet. */
function Erreur({ quoi, erreur }: { quoi: string; erreur: unknown }) {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  return (
    <div role="alert" style={{
      background: '#fdecea', border: '1px solid #f3b7b1', color: '#8c2f26',
      borderRadius: 'var(--rayon)', padding: '12px 14px', margin: '12px 0', fontSize: 14,
    }}>
      <strong>{quoi} n’a pas pu être chargé.</strong>
      <div style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{message}</div>
    </div>
  );
}

function Creneau({ rdv, nom }: { rdv: RendezVous; nom: string }) {
  const annule = estAnnule(rdv);
  const changer = useChangerStatut();
  return (
    <li style={{
      background: 'var(--carte)', border: '1px solid var(--bordure)',
      borderInlineStart: `3px solid ${annule ? '#c9c4b8' : 'var(--vert)'}`,
      borderRadius: 10, padding: '8px 10px', listStyle: 'none',
      opacity: annule ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{heure.format(instantRdv(rdv))}</strong>
        <span style={{ fontSize: 11, color: 'var(--texte)' }}>{rdv.duration_minutes} min</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2, textDecoration: annule ? 'line-through' : 'none' }}>
        {nom}
      </div>
      {rdv.reason && (
        <div style={{ fontSize: 12, color: 'var(--texte)', marginTop: 2 }}>{rdv.reason}</div>
      )}
      {!annule && (
        <button
          onClick={() => changer.mutate({ id: rdv.id, statut: 'no_show' })}
          disabled={changer.isPending}
          style={{
            marginTop: 6, fontSize: 11, padding: '3px 8px', cursor: 'pointer',
            border: '1px solid var(--bordure)', borderRadius: 6,
            background: 'transparent', color: 'var(--texte)',
          }}
        >
          {changer.isPending ? '…' : 'Absent'}
        </button>
      )}
    </li>
  );
}

export default function Agenda() {
  const { session } = useSession();
  const authUid = session?.user?.id;
  const [debut, setDebut] = useState(() => debutSemaine());

  const profil = useProfilMedecin(authUid);
  const agenda = useAgendaSemaine(profil.data?.id, authUid, debut);

  const idsPatients = useMemo(
    () => (agenda.data ?? []).map((r) => r.patient_id).filter(Boolean),
    [agenda.data],
  );
  const patients = usePatients(idsPatients);

  const jours = useMemo(
    () => repartirParJour(agenda.data ?? [], debut),
    [agenda.data, debut],
  );
  const total = rdvActifs(agenda.data ?? []).length;

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px 60px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Agenda</h1>
          <p style={{ margin: '2px 0 0', color: 'var(--texte)', fontSize: 14 }}>
            {profil.data ? profil.data.full_name : 'Chargement du profil…'}
            {' · '}
            <span style={{ textTransform: 'capitalize' }}>{moisAnnee.format(debut)}</span>
            {' · '}
            {total} rendez-vous
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setDebut((d) => decalerSemaine(d, -1))} style={boutonNav}>← Semaine précédente</button>
          <button onClick={() => setDebut(debutSemaine())} style={boutonNav}>Cette semaine</button>
          <button onClick={() => setDebut((d) => decalerSemaine(d, 1))} style={boutonNav}>Semaine suivante →</button>
        </div>
      </header>

      {profil.isError && <Erreur quoi="Le profil médecin" erreur={profil.error} />}
      {agenda.isError && <Erreur quoi="L’agenda" erreur={agenda.error} />}
      {patients.isError && <Erreur quoi="L’identité des patients" erreur={patients.error} />}

      {profil.isSuccess && profil.data === null && (
        <div role="status" style={{
          background: '#fff8e6', border: '1px solid #efd79a', borderRadius: 'var(--rayon)',
          padding: '12px 14px', margin: '12px 0', fontSize: 14,
        }}>
          Aucune fiche médecin n’est rattachée à ce compte. L’agenda restera vide
          tant que la fiche n’est pas revendiquée.
        </div>
      )}

      <div style={{
        display: 'grid', gap: 10, marginTop: 18,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        {jours.map((rdvsDuJour, i) => {
          const date = new Date(debut);
          date.setDate(date.getDate() + i);
          return (
            <section key={i} style={{
              background: 'rgba(255,255,255,.55)', border: '1px solid var(--bordure)',
              borderRadius: 'var(--rayon)', padding: 10, minHeight: 120,
            }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--texte)' }}>
                {JOURS_SEMAINE[i]}{' '}
                <span style={{ color: 'var(--texte-fort)' }}>{jourMois.format(date)}</span>
              </h2>
              {agenda.isPending ? (
                <p style={{ fontSize: 12, color: 'var(--texte)' }}>Chargement…</p>
              ) : rdvsDuJour.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--texte)', opacity: .7 }}>—</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0 }}>
                  {rdvsDuJour.map((r) => (
                    <Creneau key={r.id} rdv={r} nom={nomPatient(patients.data?.[r.patient_id])} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

const boutonNav: React.CSSProperties = {
  border: '1px solid var(--bordure)', background: 'var(--carte)',
  borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13,
};
