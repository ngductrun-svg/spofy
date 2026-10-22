import parser from '@typescript-eslint/parser';
export default [{ ignores: ['netlify/generated/**', 'src/spofyGlyphs.json'] }, {
  files: ['**/*.{js,mjs,ts,tsx}'],
  languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: { 'no-eval':'error', 'no-implied-eval':'error', 'no-new-func':'error', 'no-async-promise-executor':'error', 'no-constant-binary-expression':'error', 'valid-typeof':'error', 'constructor-super':'error', 'no-unreachable':'error' }
}];
