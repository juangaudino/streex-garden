import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
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

const plantFiles = [
  'data/plants.json',
  'data/plants-current-gardens.json',
  'data/plants-owned-seeds.json',
];

const plantGroups = await Promise.all(
  plantFiles.map(async (file) => JSON.parse(await readFile(resolve(source, file), 'utf8'))),
);
const plants = plantGroups.flat();
const plantIds = plants.map((plant) => plant.id);
const uniquePlantIds = new Set(plantIds);

if (plants.length !== 29 || uniquePlantIds.size !== 29) {
  throw new Error(
    `Grow Guide Lab catalog validation failed: expected 29 unique plants, got ${plants.length} records / ${uniquePlantIds.size} unique IDs.`,
  );
}

const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
const approvedIconPath = './assets/lab-icon-512.png';
if (!manifest.icons?.some((icon) => icon.src === approvedIconPath)) {
  throw new Error('Grow Guide Lab manifest is not using the approved flask-leaf PWA icon.');
}
await access(resolve(source, 'assets/lab-icon-512.png'));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of files) {
  await cp(resolve(source, file), resolve(destination, file));
}

await cp(resolve(source, 'assets'), resolve(destination, 'assets'), { recursive: true });
await cp(resolve(source, 'data'), resolve(destination, 'data'), { recursive: true });

console.log(`Validated ${plants.length} unique Grow Guide Lab seed records.`);
console.log('Validated approved flask-leaf PWA icon.');
console.log('Synced Grow Guide Lab to public/grow-guide-lab');
