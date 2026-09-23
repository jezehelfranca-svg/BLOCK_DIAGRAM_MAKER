import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const distIndex = resolve(dist, 'index.html');
const output = resolve(root, 'Telecom_Block_Diagram_Maker_ReactFlow_Offline.html');

const built = readFileSync(distIndex, 'utf8');

const cssMatch = built.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/i)
  || built.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/i);
if (!cssMatch) throw new Error('Could not locate Vite CSS bundle in dist/index.html');

const jsMatch = built.match(/<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/i);
if (!jsMatch) throw new Error('Could not locate Vite JavaScript bundle in dist/index.html');

const cssPath = resolve(dist, cssMatch[1].replace(/^\.\//, '').replace(/^\//, ''));
const jsPath = resolve(dist, jsMatch[1].replace(/^\.\//, '').replace(/^\//, ''));

let css = readFileSync(cssPath, 'utf8');
let js = readFileSync(jsPath, 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');

// Protect the HTML parser from a closing style sequence.
css = css.replace(/<\/style/gi, '<\\/style');

// Vite has already bundled application imports. The production bundle should
// therefore be executable as a classic script. Fail loudly if module-only
// syntax survives bundling rather than emitting a broken offline file.
if (/\bimport\.meta\b/.test(js) || /^\s*(?:import|export)\s/m.test(js)) {
  throw new Error('Production bundle still contains module-only syntax; cannot create classic offline bundle safely.');
}

// Base64 keeps ALL bundle text out of the HTML parser. This avoids premature
// </script> termination and works when the HTML is opened directly via file://.
const jsBase64 = Buffer.from(js, 'utf8').toString('base64');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HEC Telecom Block Diagram Maker - React Flow Offline</title>
<meta name="generator" content="HEC Block Diagram Maker offline React Flow bundle">
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
(function(){
  try {
    var binary = atob('${jsBase64}');
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var source = new TextDecoder('utf-8').decode(bytes);
    (0, eval)(source);
  } catch (error) {
    document.body.innerHTML =
      '<pre style="white-space:pre-wrap;padding:24px;font:14px/1.5 monospace;color:#fee2e2;background:#111827;min-height:100vh;margin:0">' +
      'React Flow offline startup error:\\n\\n' +
      String(error && (error.stack || error.message) || error)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
      '</pre>';
    throw error;
  }
})();
</script>
</body>
</html>
`;

const closingScripts = html.match(/<\/script>/gi) || [];
const externalRefs = html.match(/(?:src|href)=["'][^"']*assets\//gi) || [];
if (closingScripts.length !== 1) {
  throw new Error('Offline bundle validation failed: expected one closing script, found ' + closingScripts.length);
}
if (externalRefs.length !== 0) {
  throw new Error('Offline bundle validation failed: found external asset references.');
}

writeFileSync(output, html);
console.log('Created offline bundle: ' + output);
console.log('Bundle size: ' + Buffer.byteLength(html).toLocaleString() + ' bytes');
console.log('Self-contained asset check: PASS');
console.log('HTML script terminator check: PASS');
