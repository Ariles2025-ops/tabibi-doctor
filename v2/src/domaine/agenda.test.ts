// =====================================================================
// Tests des règles métier de l'agenda
// ---------------------------------------------------------------------
// Chaque test correspond à un mode de panne RÉEL, constaté dans le produit
// ou dans son historique. Ce ne sont pas des tests de couverture.
// =====================================================================
import { describe, it, expect } from 'vitest';
import {
  resoudreIdsMedecin, debutSemaine, finSemaine, decalerSemaine,
  repartirParJour, instantRdv, estAnnule, rdvActifs, nomPatient,
  JOURS_SEMAINE, COLONNE_TEMPS,
} from './agenda';
import type { RendezVous } from './agenda';

// Fabrique un rendez-vous minimal mais conforme au schéma réel.
function rdv(partiel: Partial<RendezVous> & { scheduled_at: string }): RendezVous {
  return {
    id: crypto.randomUUID(), short_id: 'AB12', doctor_id: 'doc-1', patient_id: 'pat-1',
    starts_at: null, ends_at: null,
    duration_minutes: 30, status: 'confirmed', cabinet_id: null,
    cancellation_reason: null, cancelled_at: null, cancelled_by_user_id: null,
    confirmation_sent_at: null, consult_type: null, created_at: '2026-01-01T00:00:00Z',
    diagnostic_enc: null, notes_doctor: null, notes_medecin_enc: null,
    notes_patient: null, pay_method: null, prix: null, reason: null,
    reminder_h1_sent_at: null, reminder_j1_sent_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...partiel,
  } as RendezVous;
}

describe('resoudreIdsMedecin — le piège de la double identité', () => {
  it('interroge les DEUX espaces d’identifiants quand ils diffèrent', () => {
    // C'est le cœur du sujet : n'en interroger qu'un renvoie un agenda
    // partiel, sans erreur. Un médecin voit une journée vide et y croit.
    expect(resoudreIdsMedecin('profil-1', 'auth-1')).toEqual(['profil-1', 'auth-1']);
  });

  it('ne duplique pas quand les deux identifiants coïncident', () => {
    // Un .in('doctor_id', [x, x]) fonctionne, mais dupliquer une valeur dans
    // une clé de cache produit deux entrées pour la même donnée.
    expect(resoudreIdsMedecin('meme', 'meme')).toEqual(['meme']);
  });

  it('survit à un profil non encore chargé', () => {
    expect(resoudreIdsMedecin(null, 'auth-1')).toEqual(['auth-1']);
    expect(resoudreIdsMedecin(undefined, 'auth-1')).toEqual(['auth-1']);
  });

  it('renvoie une liste vide plutôt que ["undefined"] quand rien n’est connu', () => {
    // Sans ce filtrage, la requête partirait avec un identifiant bidon et
    // renverrait 0 ligne : impossible à distinguer d'un agenda vide.
    expect(resoudreIdsMedecin(null, null)).toEqual([]);
    expect(resoudreIdsMedecin('', '')).toEqual([]);
  });
});

describe('la colonne de temps', () => {
  it('est scheduled_at, jamais starts_at', () => {
    // starts_at est NULLABLE dans le schéma réel. La v1 filtre dessus et
    // masque donc les rendez-vous dont il est nul.
    expect(COLONNE_TEMPS).toBe('scheduled_at');
  });

  it('lit un instant valide même quand starts_at est nul', () => {
    const r = rdv({ scheduled_at: '2026-09-13T09:30:00Z', starts_at: null });
    expect(instantRdv(r).toISOString()).toBe('2026-09-13T09:30:00.000Z');
    expect(Number.isNaN(instantRdv(r).getTime())).toBe(false);
  });
});

describe('la semaine algérienne', () => {
  it('commence le dimanche', () => {
    // Un calcul calé sur le lundi décalerait la grille d'un jour pour tout le pays.
    const mercredi = new Date('2026-09-09T15:00:00');
    expect(debutSemaine(mercredi).getDay()).toBe(0);
    expect(JOURS_SEMAINE[0]).toBe('Dimanche');
  });

  it('est déjà au début quand on est dimanche', () => {
    const dimanche = new Date('2026-09-13T23:59:00');
    const d = debutSemaine(dimanche);
    expect(d.getDay()).toBe(0);
    expect(d.getDate()).toBe(13);
  });

  it('remet l’heure à minuit', () => {
    const d = debutSemaine(new Date('2026-09-09T15:47:23'));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it('couvre exactement 7 jours', () => {
    const d = debutSemaine(new Date('2026-09-09T12:00:00'));
    expect(Math.round((finSemaine(d).getTime() - d.getTime()) / 86_400_000)).toBe(7);
  });

  it('franchit un changement de mois sans se perdre', () => {
    const d = debutSemaine(new Date('2026-09-30T12:00:00'));
    const suivante = decalerSemaine(d, 1);
    expect(suivante.getMonth()).toBe(9);  // octobre
    expect(suivante.getDay()).toBe(0);
  });

  it('recule aussi bien qu’il avance', () => {
    const d = debutSemaine(new Date('2026-09-09T12:00:00'));
    expect(decalerSemaine(decalerSemaine(d, -3), 3).getTime()).toBe(d.getTime());
  });
});

describe('repartirParJour', () => {
  const debut = debutSemaine(new Date('2026-09-09T12:00:00')); // dimanche 6 sept.

  it('rend toujours 7 cases, même sans aucun rendez-vous', () => {
    // Une grille dont le nombre de colonnes dépend des données saute
    // visuellement d'une semaine à l'autre.
    const jours = repartirParJour([], debut);
    expect(jours).toHaveLength(7);
    expect(jours.every((j) => j.length === 0)).toBe(true);
  });

  it('place chaque rendez-vous sur son jour', () => {
    const d0 = new Date(debut); d0.setHours(9);
    const d3 = new Date(debut); d3.setDate(d3.getDate() + 3); d3.setHours(14);
    const jours = repartirParJour(
      [rdv({ scheduled_at: d0.toISOString() }), rdv({ scheduled_at: d3.toISOString() })],
      debut,
    );
    expect(jours[0]).toHaveLength(1);
    expect(jours[3]).toHaveLength(1);
    expect(jours[1]).toHaveLength(0);
  });

  it('ignore ce qui tombe hors de la semaine au lieu de l’empiler sur dimanche', () => {
    // Un index négatif arrondi finirait en case 0 : le médecin verrait des
    // rendez-vous de la semaine passée apparaître le dimanche.
    const avant = new Date(debut); avant.setDate(avant.getDate() - 2);
    const apres = new Date(debut); apres.setDate(apres.getDate() + 9);
    const jours = repartirParJour(
      [rdv({ scheduled_at: avant.toISOString() }), rdv({ scheduled_at: apres.toISOString() })],
      debut,
    );
    expect(jours.flat()).toHaveLength(0);
  });

  it('trie chaque journée par heure croissante', () => {
    const tard = new Date(debut); tard.setHours(16);
    const tot  = new Date(debut); tot.setHours(8);
    const jours = repartirParJour(
      [rdv({ scheduled_at: tard.toISOString() }), rdv({ scheduled_at: tot.toISOString() })],
      debut,
    );
    expect(jours[0].map((r) => instantRdv(r).getHours())).toEqual([8, 16]);
  });
});

describe('statuts', () => {
  it('reconnaît une annulation et un no-show', () => {
    expect(estAnnule(rdv({ scheduled_at: '2026-09-13T09:00:00Z', status: 'cancelled' }))).toBe(true);
    expect(estAnnule(rdv({ scheduled_at: '2026-09-13T09:00:00Z', status: 'no_show' }))).toBe(true);
  });

  it('ne compte pas les annulés comme des créneaux occupés', () => {
    const liste = [
      rdv({ scheduled_at: '2026-09-13T09:00:00Z', status: 'confirmed' }),
      rdv({ scheduled_at: '2026-09-13T10:00:00Z', status: 'cancelled' }),
    ];
    expect(rdvActifs(liste)).toHaveLength(1);
  });
});

describe('nomPatient', () => {
  it('compose prénom et nom', () => {
    expect(nomPatient({ id: '1', first_name: 'Amina', last_name: 'Belkacem', phone: null }))
      .toBe('Amina Belkacem');
  });

  it('se contente de ce qui existe', () => {
    expect(nomPatient({ id: '1', first_name: 'Amina', last_name: null, phone: null })).toBe('Amina');
  });

  it('affiche un repli explicite plutôt qu’un nom vide ou « undefined »', () => {
    // C'est le fameux « Patient » de l'agenda v1 : il est ASSUMÉ ici, et il
    // signifie « la vue n'a rien renvoyé », pas « ce patient n'a pas de nom ».
    expect(nomPatient(undefined)).toBe('Patient');
    expect(nomPatient({ id: '1', first_name: null, last_name: null, phone: null })).toBe('Patient');
    expect(nomPatient({ id: '1', first_name: '  ', last_name: '', phone: null })).toBe('Patient');
  });
});
