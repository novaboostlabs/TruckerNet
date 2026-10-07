import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests run the app's real database layer (src/db/database.ts) against
// Node's built-in SQLite. Only the native seams are swapped out.
export default defineConfig({
  resolve: {
    alias: [
      // database.ts imports './sqlite' (expo-sqlite on device) — use node:sqlite.
      { find: /^\.\/sqlite$/, replacement: path.resolve(__dirname, 'test/support/nodeSqlite.ts') },
      { find: 'react-native-get-random-values', replacement: path.resolve(__dirname, 'test/support/empty.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/support/setup.ts'],
    // Drivers are US-based; a non-UTC zone also catches UTC-vs-local date bugs.
    env: { TZ: 'America/Chicago' },
  },
});
