// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['dev-server/**/*.mjs', 'tests/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', setTimeout: 'readonly' } },
  },
  {
    ignores: ['dist/*', 'demo-dist/*', 'dist-demo-build/*', 'src/demo/sql.generated.ts', 'dist-native/*', 'dev-server/.data/*', 'test-results/*', 'supabase/functions/*', '.expo/*'],
  },
]);
