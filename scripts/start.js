#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// Helper to test if an HTTP port responds
function checkHttpService(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    let finished = false;
    const req = http.get(url, (res) => {
      if (!finished) {
        finished = true;
        resolve(true);
      }
      res.resume();
    });

    req.on('error', () => {
      if (!finished) {
        finished = true;
        resolve(false);
      }
    });

    req.setTimeout(timeoutMs, () => {
      if (!finished) {
        finished = true;
        req.destroy();
        resolve(false);
      }
    });
  });
}

// Poll until a service is reachable
async function waitForService(url, serviceName, maxAttempts = 30, intervalMs = 500) {
  for (let i = 1; i <= maxAttempts; i++) {
    const isUp = await checkHttpService(url, intervalMs);
    if (isUp) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  console.log('\x1b[33m%s\x1b[0m', `[Warning] ${serviceName} did not respond within expected timeout.`);
  return false;
}

// Open URL in default browser
function openBrowser(targetUrl) {
  console.log('\x1b[32m%s\x1b[0m', `-> Launching app in browser: ${targetUrl}`);
  const platform = process.platform;
  let command = 'xdg-open';
  let args = [targetUrl];

  if (platform === 'darwin') {
    command = 'open';
  } else if (platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '""', targetUrl];
  }

  const opener = spawn(command, args, { stdio: 'ignore', detached: true });
  opener.unref();
}

async function main() {
  console.log('\x1b[36m%s\x1b[0m', '==============================================');
  console.log('\x1b[36m%s\x1b[0m', ' D&D Campaign Planner & Co-DM Studio Launcher ');
  console.log('\x1b[36m%s\x1b[0m', '==============================================');

  const [backendAlreadyRunning, frontendAlreadyRunning] = await Promise.all([
    checkHttpService(`http://127.0.0.1:${BACKEND_PORT}/docs`),
    checkHttpService(FRONTEND_URL)
  ]);

  let backendProcess = null;
  let frontendProcess = null;

  // 1. Backend check & start
  if (backendAlreadyRunning) {
    console.log('\x1b[32m%s\x1b[0m', `[✓] Backend already active on port ${BACKEND_PORT}.`);
  } else {
    console.log('\x1b[34m%s\x1b[0m', `-> Starting Backend (FastAPI on http://127.0.0.1:${BACKEND_PORT})...`);

    const possiblePythons = [
      path.join(backendDir, 'venv', 'bin', 'python'),
      path.join(backendDir, '.venv', 'bin', 'python'),
      path.join(rootDir, 'venv', 'bin', 'python'),
      path.join(rootDir, '.venv', 'bin', 'python')
    ];

    let pythonBin = possiblePythons.find((p) => fs.existsSync(p)) || 'python3';
    const uvicornArgs = ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', String(BACKEND_PORT)];

    backendProcess = spawn(pythonBin, uvicornArgs, {
      cwd: backendDir,
      stdio: 'inherit',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    backendProcess.on('error', (err) => {
      console.error('\x1b[31m%s\x1b[0m', `Backend error: ${err.message}`);
    });
  }

  // 2. Frontend check & start
  if (frontendAlreadyRunning) {
    console.log('\x1b[32m%s\x1b[0m', `[✓] Frontend already active on port ${FRONTEND_PORT}.`);
  } else {
    console.log('\x1b[32m%s\x1b[0m', `-> Starting Frontend (Vite on ${FRONTEND_URL})...`);
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    frontendProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: frontendDir,
      stdio: 'inherit'
    });

    frontendProcess.on('error', (err) => {
      console.error('\x1b[31m%s\x1b[0m', `Frontend error: ${err.message}`);
    });
  }

  // 3. Cleanup handler when this launcher terminates
  const cleanup = (code) => {
    if (backendProcess || frontendProcess) {
      console.log('\n\x1b[33m%s\x1b[0m', 'Stopping started servers...');
      try {
        if (frontendProcess && !frontendProcess.killed) frontendProcess.kill('SIGTERM');
      } catch (e) {}
      try {
        if (backendProcess && !backendProcess.killed) backendProcess.kill('SIGTERM');
      } catch (e) {}
    }
    process.exit(code ?? 0);
  };

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  process.on('exit', () => cleanup(0));

  // 4. Wait for frontend to be ready before opening the browser
  if (!frontendAlreadyRunning) {
    console.log('\x1b[35m%s\x1b[0m', 'Waiting for servers to become ready...');
    await waitForService(FRONTEND_URL, 'Frontend', 40, 500);
  }

  // 5. Open browser app
  openBrowser(FRONTEND_URL);

  // If both were already running, we opened the browser and can exit gracefully
  if (!backendProcess && !frontendProcess) {
    console.log('\x1b[32m%s\x1b[0m', 'Servers are already running in background. Browser launched.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal launcher error:', err);
  process.exit(1);
});
