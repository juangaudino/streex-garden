import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'public/grow-guide-lab');
const destination = resolve(root, 'dist');

// The prototype/grow-guide branch is a Garden Labs deployment target.
// Vite first validates/builds the main app; then this branch-only step replaces
// the deploy artifact with the already validated Garden Labs bundle.
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log('Published Garden Labs as the root Vercel artifact for prototype/grow-guide.');
