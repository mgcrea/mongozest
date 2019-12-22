module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:@typescript-eslint/recommended', 'prettier', 'prettier/@typescript-eslint'],
  plugins: ['@typescript-eslint', 'prettier'],
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module'
  },
  env: {
    es6: true,
    node: true
  },
  rules: {
    // typescript
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/prefer-interface': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    // airbnb
    'no-unused-expressions': 'off',
    'no-use-before-define': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'off',
    'import/prefer-default-export': 'off',
    'jsx-a11y/accessible-emoji': 'off',
    // prettier
    'prettier/prettier': 'error'
  },
  globals: {
    __DEV__: false
  },
  overrides: [
    {
      files: '*.spec.{ts,tsx}',
      env: {
        mocha: true,
        jest: true
      }
    }
  ]
};
