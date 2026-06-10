module.exports = {
  env: {
    node: true,
    es2020: true,
    browser: true
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-var': 'error',
    'prefer-const': 'warn',
    'no-console': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'eqeqeq': ['error', 'always'],
    'no-debugger': 'error',
    'no-duplicate-imports': 'warn'
  },
  overrides: [
    {
      files: ['miniprogram/**/*.js'],
      env: { browser: true, node: false, es2020: true },
      globals: { wx: 'readonly', App: 'readonly', Page: 'readonly', Component: 'readonly', getCurrentPages: 'readonly' },
      rules: { 'no-console': 'error' }
    },
    {
      files: ['miniprogram/utils/logger.js'],
      rules: { 'no-console': 'off' }
    },
    {
      files: ['cloudfunctions/**/*.js'],
      env: { node: true, es2020: true },
      rules: { 'no-console': 'off' }
    },
    {
      files: ['admin/js/api.js'],
      rules: { 'no-console': 'warn' }
    }
  ],
  ignorePatterns: ['node_modules/', 'test_archive/', '*.min.js']
};
