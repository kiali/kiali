import baseConfig from './eslint.config.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(...baseConfig, {
  files: ['src/**/*.{ts,tsx,js}'],
  rules: {
    // Core ESLint rules
    'no-case-declarations': 'error',
    'no-useless-assignment': 'error',
    'prefer-const': 'error',

    // TypeScript rules
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports'
      }
    ],
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/explicit-module-boundary-types': ['error', { allowArgumentsExplicitlyTypedAsAny: true }],
    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: {},
        interfaces: { order: 'alphabetically' },
        typeLiterals: { order: 'alphabetically' }
      }
    ],
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ]
  }
});
