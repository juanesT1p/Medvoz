import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="shell">
      <p className="eyebrow">MedVoz</p>
      <h1>Entiende tu fórmula médica con claridad.</h1>
      <p className="intro">La captura y confirmación de medicamentos estarán disponibles en la siguiente fase.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
