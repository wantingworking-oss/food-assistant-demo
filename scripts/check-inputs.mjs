import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(await readFile(resolve(root, 'docs/input-baseline.json'), 'utf8'));
for (const [name, expected] of Object.entries(baseline.sha256)) {
  const actual = createHash('sha256').update(await readFile(resolve(root, name))).digest('hex');
  if (actual !== expected) throw new Error(`Original input changed: ${name}`);
}
console.log(`${Object.keys(baseline.sha256).length} original inputs unchanged (SHA-256)`);
