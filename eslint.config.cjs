// eslint.config.cjs
const js = require('@eslint/js');
const globals = require('globals');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-plugin-prettier');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'assets/external/**',
      '**/*.min.js',
      // 'making list longer to avoid single row
      // 'assets/external/notify-js/notify.min.js',
      // 'assets/external/jquery-3.6.0.min.js',
      // 'assets/external/DataTables/js/jquery.dataTables.min.js',
      // 'assets/external/DataTables/js/jquery.dataTables.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
      prettier,
    },
    rules: {
      // Use the TS-aware rule and disable the base one so "_"-prefixed args are properly ignored
      'no-unused-vars': 'off',
      // Align with your JS rules and use TS-aware equivalents
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          argsIgnorePattern: '^_',
          args: 'after-used',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // TS handles undefined symbols via type checking
      'no-undef': 'off',
      'no-redeclare': 'error',
      'no-implied-eval': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
      'prettier/prettier': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', 'no-unused-vars': 'off', eqeqeq: 'off' },
  },
  {
    files: ['**/*.js', 'assets/internal/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // your scripts load via <script> tags
      globals: {
        ...globals.browser,
        ...globals.es2021,
        $: 'readonly',
        jQuery: 'readonly',
      },
    },
    plugins: {
      'unused-imports': unusedImports,
      prettier,
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          argsIgnorePattern: '^_',
          args: 'after-used',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-implied-eval': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
      'prettier/prettier': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
];
