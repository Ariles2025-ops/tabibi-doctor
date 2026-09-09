import { Routes, Route, Navigate } from 'react-router';
import { useSession } from './lib/useSession';
import { CONFIG } from './lib/config';
import Agenda from './pages/Agenda';
import Connexion from './pages/Connexion';

export default function App() {
  const { session, chargement } = useSession();

  if (chargement) {
    return <div style={{ padding: 40, color: 'var(--texte)' }}>Chargement…</div>;
  }

  if (!session) {
    // [CORRIGE 2026-09-09] En production, on renvoie vers la connexion du site
    // v1 au lieu d'afficher le formulaire local.
    //
    // POURQUOI : ce formulaire demande un EMAIL et un mot de passe. Or les
    // médecins s'inscrivent et se connectent par TELEPHONE + code SMS — le
    // champ email de login.html vit dans un écran admin masqué (vérifié le
    // 09/09/2026). Un médecin déconnecté serait tombé sur un formulaire qui
    // ne peut pas fonctionner pour lui.
    //
    // Le formulaire local reste utile en développement : la v2 tourne alors
    // sur un autre port que la v1 et ne voit pas son localStorage.
    if (!import.meta.env.DEV) {
      const retour = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`${CONFIG.V1_BASE}login.html?next=${retour}`);
      return <div style={{ padding: 40, color: 'var(--texte)' }}>Redirection vers la connexion…</div>;
    }
    return <Connexion />;
  }

  return (
    <Routes>
      <Route path="/agenda" element={<Agenda />} />
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  );
}
