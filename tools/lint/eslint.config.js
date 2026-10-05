// ESLint for the tools in this repository. The learner project, the lessons and the snapshots are not linted:
// they are written to match the lessons exactly and are checked by `tutorial check` and the integration test.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'course/**',
      'workspace/project-template/**',
      'platform/ui/vendor/**',
      'tools/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['platform/ui/**/*.js'],
    languageOptions: { globals: { ...globals.browser, hljs: 'readonly', SwaggerUIBundle: 'readonly' } },
  },
  {
    files: ['**/*.test.ts', '**/*.test.js', 'tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
