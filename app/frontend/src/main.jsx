/**
 * main.jsx — Application entry point.
 *
 * Renders the root App component into the DOM.
 * Imports global CSS design system.
 *
 * @module main
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
