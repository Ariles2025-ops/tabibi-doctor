// =====================================================================
// Connexion — utilisée uniquement quand aucune session n'existe.
// ---------------------------------------------------------------------
// En production, un médecin arrive ici déjà connecté (session partagée
// avec le site v1 via le même domaine). Cet écran sert donc surtout au
// développement local, où la v2 tourne sur un autre port que la v1 et
// ne voit donc pas son localStorage.
// =====================================================================
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CONFIG } from '../lib/config';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    setEnCours(false);
    if (error) setErreur(error.message);
    // Succès : onAuthStateChange met à jour la session, App re-rend l'agenda.
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
    }}>
      <form onSubmit={seConnecter} style={{
        width: '100%', maxWidth: 380, background: 'var(--carte)',
        border: '1px solid var(--bordure)', borderRadius: 'var(--rayon)',
        boxShadow: 'var(--ombre)', padding: 28,
      }}>
        <h1 style={{ fontSize: 22, margin: '0 0 6px', letterSpacing: '-.02em' }}>
          Tabibi <span style={{ color: 'var(--or)' }}>·</span> Espace pro
        </h1>
        <p style={{ color: 'var(--texte)', fontSize: 14, margin: '0 0 22px' }}>
          Connectez-vous avec votre compte médecin.
        </p>

        <Champ label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" />
        <Champ label="Mot de passe" type="password" value={motDePasse} onChange={setMotDePasse}
               autoComplete="current-password" />

        {erreur && (
          <p style={{
            background: '#fdecec', color: '#8a1f1f', padding: '10px 12px',
            borderRadius: 10, fontSize: 13, margin: '0 0 14px',
          }}>{erreur}</p>
        )}

        <button type="submit" disabled={enCours} style={{
          width: '100%', padding: '12px 16px', border: 0, borderRadius: 999,
          background: 'var(--vert)', color: '#fff', fontWeight: 700,
          fontSize: 15, cursor: enCours ? 'wait' : 'pointer', opacity: enCours ? .7 : 1,
        }}>
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>

        <p style={{ fontSize: 13, color: 'var(--texte)', margin: '18px 0 0', textAlign: 'center' }}>
          <a href={`${CONFIG.V1_BASE}login.html`}>Utiliser la connexion du site principal</a>
        </p>
      </form>
    </div>
  );
}

function Champ({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 13, color: 'var(--texte)', marginBottom: 6 }}>
        {label}
      </span>
      <input
        type={type} value={value} required autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '11px 13px', fontSize: 15,
          border: '1px solid var(--bordure)', borderRadius: 10,
          background: '#fff', color: 'var(--texte-fort)',
        }}
      />
    </label>
  );
}
