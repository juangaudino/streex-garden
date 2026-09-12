import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'prototypes/grow-guide');
const destination = resolve(root, 'public/grow-guide-lab');

const files = [
  'index.html',
  'styles.css',
  'language.css',
  'visual.css',
  'inventory-neighbors.css',
  'app.js',
  'manifest.json',
  'service-worker.js',
];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of files) {
  await cp(resolve(source, file), resolve(destination, file));
}

await cp(resolve(source, 'assets'), resolve(destination, 'assets'), { recursive: true });
await cp(resolve(source, 'data'), resolve(destination, 'data'), { recursive: true });

console.log('Synced Grow Guide Lab to public/grow-guide-lab');
