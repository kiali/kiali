import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { importX } from 'eslint-plugin-import-x';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['build/**', 'cypress/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx,js}'],
    ...eslintReact.configs['recommended-typescript'],
    plugins: {
      ...eslintReact.configs['recommended-typescript'].plugins,
      'jsx-a11y': jsxA11y,
      'import-x': importX,
      'react-hooks': reactHooks
    },
    languageOptions: {
      ...eslintReact.configs['recommended-typescript'].languageOptions,
      globals: { ...globals.browser },
      parserOptions: {
        ...eslintReact.configs['recommended-typescript'].languageOptions?.parserOptions,
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...eslintReact.configs['recommended-typescript'].rules,
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
      ],

      // React rules
      '@eslint-react/dom-no-unknown-property': 'error',
      '@eslint-react/dom-no-unsafe-target-blank': 'error',
      '@eslint-react/jsx-no-children-prop': 'warn',
      '@eslint-react/no-access-state-in-setstate': 'off',
      '@eslint-react/no-create-ref': 'off',
      '@eslint-react/no-direct-mutation-state': 'warn',
      '@eslint-react/no-missing-component-display-name': 'error',
      '@eslint-react/no-missing-key': 'warn',
      '@eslint-react/no-nested-component-definitions': 'warn',
      '@eslint-react/static-components': 'off',
      '@eslint-react/unsupported-syntax': 'off',

      // Accessibility rules
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/no-static-element-interactions': 'warn'
    }
  }
);
