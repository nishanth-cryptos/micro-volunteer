// Vite configuration.
// Governs: memory-bank/techContext.md (build tooling).
// Responsibilities: React plugin + Tailwind v4 plugin. No app logic.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
