import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const round = process.argv[2] ?? 'round6';
if (!/^round\d+$/.test(round)) throw new Error('Expected roundN report name');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const files = (await readdir(resolve(root, 'tests'))).filter(name => name.endsWith('.test.js')).sort().map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: root, encoding: 'utf8' });
if (result.error) throw result.error;
const reportDirectory = resolve(root, 'docs/validation');
await mkdir(reportDirectory, { recursive: true });
await writeFile(resolve(reportDirectory, `${round}.tap`), result.stdout + result.stderr);
const sourceHash = createHash('sha256'), sourceFiles = [];
async function collect(path) {
  for (const entry of (await readdir(resolve(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${path}/${entry.name}`;
    if (entry.isDirectory()) await collect(name);
    else sourceFiles.push(name);
  }
}
for (const folder of ['src', 'public', 'tests', 'scripts', '.github']) await collect(folder);
sourceFiles.push('server.js', 'package.json', 'Dockerfile', '.dockerignore', '.env.example', 'configure-deepseek.cmd', 'start-local.cmd');
for (const name of sourceFiles.sort()) sourceHash.update(name).update('\0').update(await readFile(resolve(root, name))).update('\0');
const report = {
  generated_at: new Date().toISOString(), version: pkg.version, node: process.version,
  command: 'node --test --test-reporter=tap tests/*.test.js',
  source_sha256: sourceHash.digest('hex'), source_files: sourceFiles,
  tests: Number(result.stdout.match(/^# tests (\d+)/m)?.[1] ?? 0),
  passed: Number(result.stdout.match(/^# pass (\d+)/m)?.[1] ?? 0),
  failed: Number(result.stdout.match(/^# fail (\d+)/m)?.[1] ?? 0),
  exit_code: result.status, status: result.status === 0 ? 'passed' : 'failed',
  separate_evidence: { browser_qa: `${round}-browser.json`, core_regression: `${round}-regression.json`, editing_regression: `${round}-editing.json`, release_qa: `${round}-release.json`, real_ai: `${round}-ai.json` },
  pending: { remaining_interaction_cases: 0, real_ai_cases: 24, github_deployment: 'not_run' },
};
await writeFile(resolve(reportDirectory, `${round}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = result.status ?? 1;
