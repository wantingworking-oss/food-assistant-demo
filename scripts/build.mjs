import { mkdir, cp, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
// Only public assets and the browser-safe domain are copied. Server, secrets,
// tests and oracle answers never enter the GitHub Pages artifact.
await cp(resolve(root, 'public'), output, { recursive: true });
const apiBase=process.env.PUBLIC_API_BASE?.trim()??'';
if(apiBase){const url=new URL(apiBase);if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('PUBLIC_API_BASE must be an HTTPS origin (local HTTP allowed for testing)');}
await writeFile(resolve(output,'config.js'),`export const API_BASE = ${JSON.stringify(apiBase?new URL(apiBase).origin:'')};\n`);
await cp(resolve(root, 'src/domain'), resolve(output, 'src/domain'), { recursive: true });
await cp(resolve(root, 'src/state'), resolve(output, 'src/state'), { recursive: true });
await mkdir(resolve(output, 'data'), { recursive: true });
await cp(resolve(root, 'fixtures/mock-data.json'), resolve(output, 'data/mock-data.json'));
await writeFile(resolve(output, '.nojekyll'), '');
const allowed = new Set(['index.html', 'status.js', 'styles.css', 'app.js', 'panels.js', 'ai-ui.js', 'api.js', 'config.js', 'src/state/store.js', 'src/state/requirements.js', 'src/state/ai-operations.js', 'src/domain/ai-contract.js', '.nojekyll', 'data/mock-data.json',
  'src/domain/requirements.js', 'src/domain/history.js', 'src/domain/context.js',
  'src/domain/configurations.js', 'src/domain/recommend.js', 'src/domain/cart.js']);
async function inspect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await inspect(resolve(directory, entry.name), `${name}/`);
    else if (!entry.isFile() || !allowed.has(name)) throw new Error(`Unexpected build asset: ${name}. Use a new clean dist directory.`);
  }
}
await inspect(output);
console.log('Static artifact ready: dist/ (manual experience; AI requires the Node backend)');
