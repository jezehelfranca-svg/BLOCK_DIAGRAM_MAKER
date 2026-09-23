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
  let css = readFileSync(cssPath, 'utf8');
  // A literal </style> inside inlined CSS would terminate the style element.
  css = css.replace(/<\/style/gi, '<\\/style');
  html = html.replace(cssMatch[0], '<style>\n' + css + '\n</style>');
}

const jsMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/i)
  || html.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/i);
if (!jsMatch) throw new Error('Could not locate Vite JavaScript bundle in dist/index.html');

const jsPath = resolve(dist, jsMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
let js = readFileSync(jsPath, 'utf8');
js = js.replace(/\/\/# sourceMappingURL=.*$/m, '');

// Critical for a self-contained HTML file:
// HTML parsers recognize </script> even when that text appears inside a JS string.
// Escape every embedded closing-script sequence before placing the bundle inline.
js = js.replace(/<\/script/gi, '<\\/script');

html = html.replace(jsMatch[0], '<script type="module">\n' + js + '\n</script>');

html = html.replace(
  '<title>HEC Telecom Block Diagram Maker - React Flow</title>',
  '<title>HEC Telecom Block Diagram Maker - React Flow Offline</title>'
);
html = html.replace(
  '</head>',
  '<meta name="generator" content="HEC Block Diagram Maker offline React Flow bundle">\n</head>'
);

// Guard against the exact failure mode where the browser closes the inline
// bundle early and displays the rest of the minified JavaScript as page text.
const closingScripts = html.match(/<\/script>/gi) || [];
if (closingScripts.length !== 1) {
  throw new Error('Offline bundle is unsafe: expected exactly one literal </script>, found ' + closingScripts.length);
}

writeFileSync(output, html);
console.log('Created offline bundle: ' + output);
console.log('Bundle size: ' + Buffer.byteLength(html).toLocaleString() + ' bytes');
console.log('Inline script terminator check: PASS');
