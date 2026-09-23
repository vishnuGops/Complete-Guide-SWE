// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'data/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      /*
       * A scrollable region has to be focusable (ROADMAP P4-13).
       *
       * axe's `scrollable-region-focusable` is a `serious` finding, and the fix
       * is `tabindex="0"` on the scrolling element - which this rule forbids by
       * default because the element is not interactive. Both are right: the
       * element is not a control, and a keyboard user still has to be able to
       * scroll it. Allowing the two grouping roles is how the two rules agree,
       * and it is narrow enough that a `div` with a stray tabIndex is still
       * caught.
       */
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['group', 'region', 'tabpanel'] }],
    },
  },
  {
    // CLIs talk to the user through stdout by design.
    files: [
      'apps/server/src/problems/cli/**/*.ts',
      '**/*.config.{ts,js}',
      '**/scripts/**/*.{ts,js,mjs}',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/web/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      /*
       * A test that measures something has to say what it measured (P8-2).
       *
       * The performance budgets are only useful with the number beside them -
       * "under 4000 ms" says nothing about whether there is headroom or the
       * next commit will trip it - and a test runner's stdout is exactly where
       * that belongs. Application code still may not print.
       */
      'no-console': 'off',
    },
  },
  prettier,
);
