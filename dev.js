import { spawn } from "node:child_process";
import { createServer } from "vite";

const apiPort = process.env.CATCAM_DEV_API_PORT || "3000";
const apiOrigin = `http://127.0.0.1:${apiPort}`;
let backend;
let vite;
let stopping = false;

async function isBackendReady() {
  try {
    const response = await fetch(`${apiOrigin}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackend() {
  if (await isBackendReady()) return;

  backend = spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "app.js"],
    {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: apiPort,
        APP_ORIGIN: "",
      },
      stdio: "inherit",
    },
  );

  backend.once("error", (error) => {
    console.error("Could not start the local CatCam API:", error);
    void stop(1);
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (backend.exitCode !== null) {
      throw new Error(`The local CatCam API exited with code ${backend.exitCode}.`);
    }
    if (await isBackendReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The local CatCam API did not start on port ${apiPort}.`);
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await vite?.close();
  if (backend && backend.exitCode === null) backend.kill();
  process.exitCode = exitCode;
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

try {
  await startBackend();
  vite = await createServer();
  await vite.listen();
  vite.printUrls();
} catch (error) {
  console.error(error);
  await stop(1);
}
