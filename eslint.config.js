// ESLint flat config（ESLint v9+，替代 .eslintrc.js）
// 零额外依赖：内联各环境 globals，手动提供 recommended 核心规则集
// 迁移自 .eslintrc.js，规则保持一致并补全 miniprogram 全局 getApp

// --- 各运行环境 globals（不依赖 globals 包）---
const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'writable',
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  global: 'writable',
  __dirname: 'readonly',
  __filename: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  queueMicrotask: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  XMLHttpRequest: 'readonly',
  URL: 'readonly',
  location: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  navigator: 'readonly',
  history: 'readonly',
  HTMLElement: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
};

const miniprogramGlobals = {
  wx: 'readonly',
  App: 'readonly',
  Page: 'readonly',
  Component: 'readonly',
  Behavior: 'readonly',
  getCurrentPages: 'readonly',
  getApp: 'readonly',
  // 小程序也使用 CommonJS
  require: 'readonly',
  module: 'readonly',
  exports: 'writable',
  console: 'readonly',
};

// --- eslint:recommended 核心规则（无 @eslint/js 依赖时手动提供）---
const recommendedRules = {
  'no-undef': 'error',
  'no-cond-assign': 'error',
  'no-constant-condition': 'warn',
  'no-control-regex': 'error',
  'no-debugger': 'error',
  // 安全规则：禁止动态代码执行（注入/供应链常见攻击面），flat config 迁移时补回
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-dupe-keys': 'error',
  'no-empty': 'warn',
  'no-extra-boolean-cast': 'warn',
  'no-extra-semi': 'error',
  'no-fallthrough': 'error',
  'no-irregular-whitespace': 'error',
  'no-redeclare': 'error',
  'no-sparse-arrays': 'warn',
  'no-unreachable': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-mixed-spaces-and-tabs': 'error',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
};

module.exports = [
  // 全局忽略（替代 .eslintignore）
  {
    ignores: [
      'node_modules/',
      'test_archive/',
      '*.min.js',
      'miniprogram/images/',
      'cloudfunctions/*/node_modules/',
      'cloudfunctions/*/common/', // 各云函数 common/ 副本由 sync-common.sh 生成，源码见 cloudfunctions/common/
      'admin/dist/',
      'admin/lib/',
    ],
  },
  // 基础配置（默认按 Node 环境；各区域用 files 覆盖）
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: { ...nodeGlobals },
    },
    rules: {
      ...recommendedRules,
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-duplicate-imports': 'warn',
    },
  },
  // 小程序前端：禁 console
  {
    files: ['miniprogram/**/*.js'],
    languageOptions: {
      globals: { ...miniprogramGlobals },
    },
    rules: {
      'no-console': 'error',
    },
  },
  // logger.js 是唯一允许 console 的前端文件
  {
    files: ['miniprogram/utils/logger.js'],
    rules: {
      'no-console': 'off',
    },
  },
  // 云函数：Node 环境，允许 console
  {
    files: ['cloudfunctions/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...nodeGlobals },
    },
    rules: {
      'no-console': 'off',
    },
  },
  // 管理后台：浏览器环境
  {
    files: ['admin/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...browserGlobals },
    },
    rules: {
      'no-console': 'warn',
    },
  },
];
