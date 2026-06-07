// ESLint flat config (ESLint 9.x — flat config is required).
// Governs: memory-bank/techContext.md (lint/format/typecheck).
// Strategy: type-aware lint only for src/**; non-type-aware for root config files.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'build',
      'functions/lib',
      '.firebase',
      'node_modules',
    ],
  },
  // Type-aware lint for application source.
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
    },
  },
  // Non-type-aware lint for tooling/config files (vite.config.ts, etc.).
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['*.{ts,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  prettierConfig,
);
