import { defineConfig, devices } from "@playwright/test";

const PORT = 3217;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      // Stops Chromium leaving locked temp folders that hang teardown on Windows.
      args: [
        "--enable-features=NetworkServiceInProcess,NetworkServiceInProcess2",
        "--disable-features=NetworkServiceSandbox",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
