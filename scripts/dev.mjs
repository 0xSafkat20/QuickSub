// Start Vite and its API together; reuse an existing QuickSub API on port 4000.
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function start(file, args = [], env = process.env, watch = false) {
  const child = spawn(process.execPath, [...(watch ? ["--watch"] : []), file, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { children.delete(child); if (!stopping) stop(code ?? 1); });
  return child;
}
const listening = () => new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port: 4000 });
  socket.setTimeout(500);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => { socket.destroy(); resolve(false); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
});
try {
  if (await listening()) {
    const response = await fetch('http://127.0.0.1:4000/api/payments/config', { signal: AbortSignal.timeout(3000) });
    const data = response.ok ? await response.json() : null;
    if (typeof data?.enabled !== 'boolean') throw new Error('Port 4000 is occupied by another service. Stop it before starting QuickSub.');
    console.log('Using the running QuickSub backend on port 4000.');
  } else {
    start('server/index.js', [], { ...process.env, PORT: '4000' }, true);
    let ready = false;
    for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
      if (await listening()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('QuickSub backend did not start. Check its error above and run npm ci --prefix server if dependencies are missing.');
  }
  if (!stopping) start('node_modules/vite/bin/vite.js', process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  stop(1);
}
