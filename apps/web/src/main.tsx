import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'highlight.js/styles/github-dark.css';
import App from './App.tsx';
import { ProvidersProvider } from './contexts/ProvidersContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvidersProvider>
      <App />
    </ProvidersProvider>
  </StrictMode>,
);
