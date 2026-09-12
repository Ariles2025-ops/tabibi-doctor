import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { clientRequete } from './lib/requete';
import './styles/tokens.css';

const racine = document.getElementById('root');
if (!racine) throw new Error('#root introuvable dans index.html');

createRoot(racine).render(
  <StrictMode>
    <QueryClientProvider client={clientRequete}>
      {/* basename /v2 : la v2 vit sous tabibi.doctor/v2/ et n'écrase rien */}
      <BrowserRouter basename="/v2">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
