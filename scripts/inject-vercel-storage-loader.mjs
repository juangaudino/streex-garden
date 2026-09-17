import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'public/grow-guide-lab/index.html');
let html = await readFile(file, 'utf8');
const tag = '<script src="./vercel-storage-loader-v1.js?v=2"></script>';
const bootstrap = '<script src="./sites-storage-bootstrap.js?v=1" defer></script>';

if (!html.includes(tag)) {
  if (!html.includes(bootstrap)) throw new Error('Garden Labs storage bootstrap tag not found; refusing to publish without Vercel persistence transport.');
  html = html.replace(bootstrap, `${tag}${bootstrap}`);
}

await writeFile(file, html, 'utf8');
