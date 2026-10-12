import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'reference/**',
      'apps/api/**',
      '.superpowers/**',
      '**/.turbo/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/dev-dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='eval']", message: 'No eval.' },
        { selector: "NewExpression[callee.name='Function']", message: 'No new Function.' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/scripts/**', '**/*.config.{js,ts,mjs}', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
