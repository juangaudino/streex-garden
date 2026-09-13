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
  'garden-labs.css',
  'app.js',
  'demo-shell.js',
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
    `Garden Labs / Garden Library catalog validation failed: expected 29 unique plants, got ${plants.length} records / ${uniquePlantIds.size} unique IDs.`,
  );
}

const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
const gardenTouchIconPath = '/apple-touch-icon.png';
if (!manifest.icons?.some((icon) => icon.src === gardenTouchIconPath && icon.type === 'image/png')) {
  throw new Error('Garden Labs manifest is not using the Garden PNG touch icon for install surfaces.');
}
if (manifest.short_name !== 'Garden Labs') {
  throw new Error(`Garden Labs manifest validation failed: expected short_name "Garden Labs", got "${manifest.short_name}".`);
}
await access(resolve(root, 'public/apple-touch-icon.png'));
await access(resolve(root, 'public/app-icon.svg'));
await access(resolve(source, 'garden-labs.css'));
await access(resolve(source, 'demo-shell.js'));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of files) {
  await cp(resolve(source, file), resolve(destination, file));
}

await cp(resolve(source, 'assets'), resolve(destination, 'assets'), { recursive: true });
await cp(resolve(source, 'data'), resolve(destination, 'data'), { recursive: true });

console.log(`Validated ${plants.length} unique Garden Library guide records.`);
console.log('Validated Garden Labs manifest name, Garden PNG install icon, and demo shell assets.');
console.log('Synced Garden Labs prototype to public/grow-guide-lab');
