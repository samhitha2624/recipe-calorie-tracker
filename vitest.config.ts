import { defineConfig } from "vitest/config";

// "unit" tests need nothing else. "rules" tests check firestore.rules and need the Firestore emulator,
// so run them with `npm run test:rules` (it starts the emulator for you).
export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/**/*.test.ts"], exclude: ["tests/rules.test.ts"] } },
      { test: { name: "rules", include: ["tests/rules.test.ts"], testTimeout: 20000 } },
    ],
  },
});
