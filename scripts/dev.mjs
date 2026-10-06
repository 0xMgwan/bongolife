// Starts the API server (with --watch) and the Vite dev server together.
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const apiPort = process.env.API_PORT || '8787';
const procs = [
  // PORT may be set by the host for the web app; the API always gets its own port.
  ['server', process.execPath, ['--watch', '--env-file-if-exists=.env', 'src/index.js'], path.join(root, 'server'), { PORT: apiPort }],
  ['client', process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '--port', process.env.PORT || '5173'], path.join(root, 'client'), { API_URL: `http://localhost:${apiPort}` }],
];
const children = procs.map(([name, cmd, args, cwd, env]) => {
  const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const tag = (d) => d.toString().split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', tag);
  p.stderr.on('data', tag);
  p.on('exit', (code) => {
    console.log(`[${name}] exited with ${code}`);
    children.forEach((c) => c.kill());
    process.exit(code ?? 0);
  });
  return p;
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { children.forEach((c) => c.kill()); process.exit(0); });
