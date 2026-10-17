import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; children.forEach(child => { if (!child.killed) child.kill(); }); };
const run = (args, env = {}) => {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', code => { if (!stopping) { stop(); process.exitCode = code ?? 1; } });
  child.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
run(['--env-file-if-exists=.env', 'server/index.mjs'], { NODE_ENV: 'development', HOST: '127.0.0.1', APP_ORIGIN: 'http://127.0.0.1:4173', PORT: '3000' });
run(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1']);
