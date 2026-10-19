import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsdoc from 'eslint-plugin-jsdoc'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/App.tsx'],
    ignores: ['src/components/ui/**', 'src/components/theme-provider.tsx'],
    plugins: { jsdoc },
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'FunctionDeclaration[id.name=/^[A-Z]/]', message: '自定义组件请使用箭头函数。' },
        { selector: 'VariableDeclarator[id.name=/^[A-Z]/] > FunctionExpression.init', message: '自定义组件请使用箭头函数。' },
      ],
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: true,
        contexts: ['VariableDeclaration', 'TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSEnumDeclaration'],
        require: { FunctionDeclaration: true },
        enableFixer: false,
      }],
      'jsdoc/require-description': ['error', {
        contexts: ['any'],
      }],
    },
  },
])
