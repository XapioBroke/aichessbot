import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registrado:', registration);
      })
      .catch((error) => {
        console.log('❌ Error registrando Service Worker:', error);
      });
  });
}

// Detectar si puede instalarse como PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('💡 App puede instalarse como PWA');
  
  // Mostrar banner de instalación (opcional)
  // showInstallPromotion();
});

// Detectar cuando se instala
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA instalada exitosamente');
  deferredPrompt = null;
});

reportWebVitals();