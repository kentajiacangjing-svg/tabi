import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Runs against a production build. Three server processes share one fresh database (.e2e-storage):
//   3200, 3201 — demo mode (two independent servers: tests drive the customer and the company through
//                different processes, including simultaneous confirmations)
//   3202       — DEMO_MODE=false on the same data: sample companies and demo accounts must not appear or sign in
// Usage: npm run build && npm run test:e2e
const wait3200 = `node -e "(async()=>{for(;;){try{await fetch('http://localhost:3200/');process.exit(0)}catch{await new Promise(r=>setTimeout(r,500))}}})()"`;
// One throwaway encryption key per test run, shared by the three servers (never stored in the repository).
const env = { STORAGE_DIR: ".e2e-storage", NODE_NO_WARNINGS: "1", DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64") };

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      // Only the throwaway e2e store is removed — never ./storage. This server seeds the demo data.
      command: "node -e \"require('fs').rmSync('.e2e-storage',{recursive:true,force:true})\" && npx next start -p 3200",
      url: "http://localhost:3200",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...env, DEMO_MODE: "true" },
    },
    {
      command: `${wait3200} && npx next start -p 3201`,
      url: "http://localhost:3201",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...env, DEMO_MODE: "true" },
    },
    {
      command: `${wait3200} && npx next start -p 3202`,
      url: "http://localhost:3202",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...env, DEMO_MODE: "false" },
    },
  ],
});
