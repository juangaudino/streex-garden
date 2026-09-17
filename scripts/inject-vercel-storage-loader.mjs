import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const file=resolve(process.cwd(),'public/grow-guide-lab/index.html');
let html=await readFile(file,'utf8');
const tag='<script src="./vercel-storage-loader-v1.js"></script>';
if(!html.includes(tag)) html=html.replace('<script src="./sites-storage-bootstrap.js"></script>',`${tag}\n  <script src="./sites-storage-bootstrap.js"></script>`);
await writeFile(file,html);
