import { defineConfig, devices } from "@playwright/test";

// Runs against a production build with a fresh, seeded database.
// Usage: npm run build && npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Only the throwaway e2e store is removed — never ./storage.
    command: "node -e \"require('fs').rmSync('.e2e-storage',{recursive:true,force:true})\" && npx next start -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { STORAGE_DIR: ".e2e-storage", DEMO_MODE: "true", NODE_NO_WARNINGS: "1" },
  },
});
