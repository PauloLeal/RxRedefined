// Runs before Playwright starts the API (see playwright.config.ts).
// If Postgres is not reachable on port 5433, starts it with the root docker-compose.yml
// and waits until it accepts connections. If it is already running, does nothing.
import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 5433;
const MAX_WAIT_SECONDS = 60;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function isPostgresReady() {
  try {
    // -h 127.0.0.1: only the real server listens on TCP, not the temporary one used during first-time init
    execSync('docker compose exec -T postgres pg_isready -h 127.0.0.1 -U kitchen_queue', { cwd: REPO_ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (await isPortOpen(PORT)) {
  console.log(`Postgres already running on port ${PORT}`);
} else {
  console.log('Postgres is not running, starting it with docker compose...');
  execSync('docker compose up -d', { cwd: REPO_ROOT, stdio: 'inherit' });

  let seconds = 0;
  while (!isPostgresReady()) {
    if (++seconds > MAX_WAIT_SECONDS) {
      throw new Error(`Postgres did not become ready within ${MAX_WAIT_SECONDS}s`);
    }
    await sleep(1000);
  }
  console.log('Postgres is ready');
}
