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

// Si quieres medir el rendimiento de tu app
// https://bit.ly/CRA-vitals
reportWebVitals();

// Service Worker para PWA (opcional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registrado:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Service Worker falló:', error);
      });
  });
}

// PWA: Evento para instalar la app (opcional)
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que Chrome 67 y anteriores muestren el prompt automáticamente
  e.preventDefault();
  // Guardar el evento para usarlo después
  deferredPrompt = e;
  
  // Mostrar botón de instalación (si tienes uno en tu UI)
  const installButton = document.getElementById('install-button');
  if (installButton) {
    installButton.style.display = 'block';
    
    installButton.addEventListener('click', () => {
      // Ocultar el botón
      installButton.style.display = 'none';
      // Mostrar el prompt
      deferredPrompt.prompt();
      // Esperar a que el usuario responda
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ Usuario aceptó instalar la PWA');
        } else {
          console.log('❌ Usuario rechazó instalar la PWA');
        }
        deferredPrompt = null;
      });
    });
  }
});

// Detectar cuando la app fue instalada
window.addEventListener('appinstalled', () => {
  console.log('🎉 ¡App instalada exitosamente!');
  deferredPrompt = null;
});