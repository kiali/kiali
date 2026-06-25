import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { importX } from 'eslint-plugin-import-x';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['build/**', 'cypress/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx,js}'],
    plugins: {
      'import-x': importX,
      'react-hooks': reactHooks
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Core ESLint rules
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'import-x/no-default-export': 'error',
      'no-case-declarations': 'off',
      'no-console': 'warn',
      'no-extra-boolean-cast': 'off',
      'no-prototype-builtins': 'off',
      'no-restricted-globals': ['error', 'event'],
      'no-undef': 'off',
      'no-useless-assignment': 'off',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'off',
      'prefer-template': 'error',

      // TypeScript rules
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  }
);
