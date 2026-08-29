import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const HEALTH_URL = "http://127.0.0.1:8000/health";
const TIMEOUT_MS = 30_000;

async function waitForHealth(): Promise<boolean> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return true;
      }
    } catch {
      // the server is not listening yet
    }
    await delay(500);
  }
  return false;
}

const server = spawn("node", ["dist/main.js"], { stdio: "inherit" });

try {
  if (await waitForHealth()) {
    console.log(`OK: ${HEALTH_URL} answered 200`);
  } else {
    console.error(`FAIL: ${HEALTH_URL} never answered within ${TIMEOUT_MS}ms`);
    process.exitCode = 1;
  }
} finally {
  server.kill("SIGTERM");
}
