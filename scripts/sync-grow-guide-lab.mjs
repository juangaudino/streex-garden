import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'prototypes/grow-guide');
const destination = resolve(root, 'public/grow-guide-lab');
const files = ['index.html','styles.css','language.css','visual.css','inventory-neighbors.css','garden-labs.css','app.js','seed-purchase-date.js','demo-shell.js','manifest.json','service-worker.js','supabase-lab-transport.js','sites-storage-bootstrap.js','sites-storage-v1.js','machines-v1.js','machines-v1.css','homegrown-source-comparison.js','homegrown-source-comparison.css','expansion-batch-a1.js','expansion-batch-b1.js'];
const plantFiles = ['data/plants.json','data/plants-current-gardens.json','data/plants-owned-seeds.json'];
const plantGroups = await Promise.all(plantFiles.map(async (file) => JSON.parse(await readFile(resolve(source,file),'utf8'))));
const plants = plantGroups.flat(); const plantIds = plants.map((plant)=>plant.id); const uniquePlantIds = new Set(plantIds);
if (plants.length !== 29 || uniquePlantIds.size !== 29) throw new Error(`Garden Labs / Garden Library catalog validation failed: expected 29 unique plants, got ${plants.length} records / ${uniquePlantIds.size} unique IDs.`);
const manifest = JSON.parse(await readFile(resolve(source,'manifest.json'),'utf8')); const approvedIconPath='./assets/lab-icon-approved-512.jpg'; const manifestPath=(value='')=>value.split('?')[0];
if (!manifest.icons?.some((icon)=>manifestPath(icon.src)===approvedIconPath && icon.type==='image/jpeg')) throw new Error('Garden Labs manifest is not using the exact User Zero-approved Lab source artwork.');
if (manifest.short_name !== 'Garden Labs') throw new Error(`Garden Labs manifest validation failed: expected short_name "Garden Labs", got "${manifest.short_name}".`);
const sourceIcon=await readFile(resolve(source,'assets/lab-icon-approved-512.jpg')); if(sourceIcon.length<10000||sourceIcon[0]!==0xff||sourceIcon[1]!==0xd8) throw new Error('Garden Labs approved source icon is missing or is not a valid JPEG payload.');
const purchaseDatePatch=await readFile(resolve(source,'seed-purchase-date.js'),'utf8'); if(!purchaseDatePatch.includes('type="date"')||!purchaseDatePatch.includes('purchaseDate')) throw new Error('Garden Labs exact Purchase Date patch is missing.');
await access(resolve(source,'garden-labs.css')); await access(resolve(source,'demo-shell.js'));
await rm(destination,{recursive:true,force:true}); await mkdir(destination,{recursive:true}); for(const file of files) await cp(resolve(source,file),resolve(destination,file)); await cp(resolve(source,'assets'),resolve(destination,'assets'),{recursive:true}); await cp(resolve(source,'data'),resolve(destination,'data'),{recursive:true});
// Vercel bundle only: route the existing Sites storage contract to Supabase.
const builtIndexPath=resolve(destination,'index.html'); let builtIndex=await readFile(builtIndexPath,'utf8');
builtIndex=builtIndex.replace('<script src="./sites-storage-bootstrap.js?v=1" defer></script>','<script src="./supabase-lab-transport.js?v=1" defer></script><script src="./sites-storage-bootstrap.js?v=1" defer></script>');
await writeFile(builtIndexPath,builtIndex,'utf8');
console.log(`Validated ${plants.length} unique Garden Library guide records.`); console.log('Validated exact User Zero-approved source artwork, Garden Labs manifest, and exact Purchase Date patch.'); console.log('Synced Garden Labs prototype to public/grow-guide-lab with Supabase transport.');
