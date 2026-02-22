import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      GROQ_API_KEY: 'gsk_dummy_test_key_for_ci_to_pass'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/services/**', 'src/utils/**', 'src/middleware/**'],
      exclude: ['src/**/*.test.ts', 'node_modules/**', 'dist/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
