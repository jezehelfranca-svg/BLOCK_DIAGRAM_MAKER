import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const legacyPath = resolve(root, 'Telecom_Block_Diagram_Maker_CAD_Editing_V19.html');
const outputPath = resolve(root, 'src/generated/presetSymbols.json');
const html = readFileSync(legacyPath, 'utf8');
const startMarker = 'const PRESET_SYMBOLS=';
const endMarker = ';\nconst KEY=';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Could not locate PRESET_SYMBOLS in the legacy editor.');
const json = html.slice(start + startMarker.length, end);
const presets = JSON.parse(json);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(presets));
console.log('Extracted ' + presets.length + ' preset symbols to ' + outputPath);
