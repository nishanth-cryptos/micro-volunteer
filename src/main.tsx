// Application entry point.
// Governs: memory-bank/fileIndex.md.
// Responsibilities: mount React root with <AuthProvider> + <RouterProvider>.
// No business logic here.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { AuthProvider } from './lib/auth-context';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
