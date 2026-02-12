import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src/api-client'] },
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
      // Enforce stricter type checking - set to warn for now due to pre-existing issues
      // TODO: Change to 'error' after fixing pre-existing unused vars in ClipLibrary, TrimPreview, ProfilePage
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // TODO: Enable when logger migration is complete (currently 36 violations in electron/)
      // 'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Enforce consistent return types
      '@typescript-eslint/explicit-function-return-type': 'off',
      // TODO: Enable when codebase is cleaned up
      // '@typescript-eslint/consistent-type-imports': ['warn', {
      //   prefer: 'type-imports',
      //   disallowTypeAnnotations: false,
      // }],
    },
  },
)
