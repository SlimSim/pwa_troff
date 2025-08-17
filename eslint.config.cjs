// eslint.config.cjs
const js = require('@eslint/js');
const globals = require('globals');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-plugin-prettier');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // your scripts load via <script> tags
      globals: {
        ...globals.browser,
        ...globals.es2021,
        $: 'readonly',
        // Add your known app globals here as needed to avoid no-undef:
        // scriptTroffClass: 'writable',
        // firebase: 'readonly',
      },
    },
    plugins: {
      'unused-imports': unusedImports,
      prettier,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-implied-eval': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
      'prettier/prettier': 'off',
    },
    ignores: ['node_modules/', 'assets/external/**', 'dist/', 'build/'],
  },
];