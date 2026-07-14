import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/zen-dots/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import './theme/reset.css';
import './theme/tokens.css';
import './theme/fonts.css';
import './theme/glass.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);