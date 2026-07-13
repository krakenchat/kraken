import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

// jsx-a11y's own "recommended" preset ships most rules at 'error'. This repo
// wants it advisory (warn) rather than build-breaking while the codebase
// catches up — downgrade every enabled rule's severity to 'warn' but keep
// each rule's own options (and leave anything explicitly 'off' alone).
function toWarnOnly(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([ruleId, config]) => {
      if (Array.isArray(config)) {
        const [severity, ...options] = config
        return [ruleId, severity === 'off' ? config : ['warn', ...options]]
      }
      return [ruleId, config === 'off' ? config : 'warn']
    }),
  )
}

export default tseslint.config(
  { ignores: ['dist', 'src/api-client', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  // Exempt Electron main/preload and service worker from no-console
  // (these run outside the browser app context where the logger utility is unavailable)
  {
    files: ['electron/**/*.ts', 'src/sw-custom.ts', 'src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // jsx-a11y recommended ruleset, downgraded to warnings (see toWarnOnly).
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: toWarnOnly(jsxA11y.flatConfigs.recommended.rules),
  },
)
