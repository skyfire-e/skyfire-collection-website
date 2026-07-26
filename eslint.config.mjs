import globals from 'globals';

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^next$' }],
      'no-console': 'off',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-self-assign': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { allowTemplateLiterals: true }]
    },
    ignores: ['node_modules/', 'uploads/', 'data/', 'public/js/admin/main.js']
  }
];
