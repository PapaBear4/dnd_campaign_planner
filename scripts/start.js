#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

// Find Python venv executable
const possiblePythons = [
  path.join(backendDir, 'venv', 'bin', 'python'),
  path.join(backendDir, '.venv', 'bin', 'python'),
  path.join(rootDir, 'venv', 'bin', 'python'),
  path.join(rootDir, '.venv', 'bin', 'python')
];

let pythonBin = possiblePythons.find(p => fs.existsSync(p));
let uvicornArgs = [];

if (pythonBin) {
  uvicornArgs = ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'];
} else {
  console.log('\x1b[33m%s\x1b[0m', '[Warning] Virtual environment not found in backend/venv. Falling back to system python3.');
  pythonBin = 'python3';
  uvicornArgs = ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'];
}

console.log('\x1b[36m%s\x1b[0m', '==============================================');
console.log('\x1b[36m%s\x1b[0m', ' Starting D&D Campaign Planner & Co-DM Studio ');
console.log('\x1b[36m%s\x1b[0m', '==============================================');

// Spawn Backend
console.log('\x1b[34m%s\x1b[0m', '-> Launching Backend (FastAPI on http://127.0.0.1:8000)...');
const backend = spawn(pythonBin, uvicornArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
});

// Spawn Frontend
console.log('\x1b[32m%s\x1b[0m', '-> Launching Frontend (Vite on http://localhost:3000)...');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit'
});

const cleanup = (code) => {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down frontend and backend...');
  try {
    if (!frontend.killed) frontend.kill('SIGTERM');
  } catch (e) {}
  try {
    if (!backend.killed) backend.kill('SIGTERM');
  } catch (e) {}
  process.exit(code ?? 0);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
process.on('exit', () => cleanup(0));

backend.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `Backend process error: ${err.message}`);
});

frontend.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `Frontend process error: ${err.message}`);
});

backend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error('\x1b[31m%s\x1b[0m', `Backend exited with code ${code}`);
    cleanup(code);
  }
});

frontend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error('\x1b[31m%s\x1b[0m', `Frontend exited with code ${code}`);
    cleanup(code);
  }
});
