if (import.meta.env.PROD && 'serviceWorker' in navigator) { void navigator.serviceWorker.register(new URL('./sw.js',window.location.href),{scope:new URL('./',window.location.href).pathname}).catch(()=>undefined); }
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
