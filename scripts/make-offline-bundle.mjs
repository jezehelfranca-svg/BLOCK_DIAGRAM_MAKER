import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const input = resolve(dist, 'index.html');
const output = resolve(root, 'Telecom_Block_Diagram_Maker_ReactFlow_Offline.html');

let html = readFileSync(input, 'utf8');

const cssMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/i)
  || html.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/i);
if (cssMatch) {
  const cssPath = resolve(dist, cssMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
  const css = readFileSync(cssPath, 'utf8');
  html = html.replace(cssMatch[0], '<style>\n' + css + '\n</style>');
}

const jsMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i)
  || html.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/i);
if (!jsMatch) throw new Error('Could not locate Vite JavaScript bundle in dist/index.html');

const jsPath = resolve(dist, jsMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
let js = readFileSync(jsPath, 'utf8');
js = js.replace(/\/\/# sourceMappingURL=.*$/m, '');
html = html.replace(jsMatch[0], '<script type="module">\n' + js + '\n</script>');

html = html.replace(
  '<title>HEC Telecom Block Diagram Maker - React Flow</title>',
  '<title>HEC Telecom Block Diagram Maker - React Flow Offline</title>'
);
html = html.replace(
  '</head>',
  '<meta name="generator" content="HEC Block Diagram Maker offline React Flow bundle">\n</head>'
);

writeFileSync(output, html);
console.log('Created offline bundle: ' + output);
console.log('Bundle size: ' + Buffer.byteLength(html).toLocaleString() + ' bytes');
