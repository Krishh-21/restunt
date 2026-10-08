if (import.meta.env.PROD && 'serviceWorker' in navigator) { void navigator.serviceWorker.register(new URL('./sw.js',window.location.href),{scope:new URL('./',window.location.href).pathname}).catch(()=>undefined); }
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
