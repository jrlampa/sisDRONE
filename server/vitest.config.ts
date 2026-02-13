import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      GROQ_API_KEY: 'gsk_dummy_test_key_for_ci_to_pass'
    }
  },
});
