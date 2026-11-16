// Собирает клиент в один самодостаточный index.html (для встроенных просмотрщиков и быстрой раздачи файлом).
// Использование: npm run build:single  →  apps/client/dist-single/index.html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dist = 'apps/client/dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, src) =>
  `<script type="module">\n${readFileSync(join(dist, src), 'utf8').replace(/<\/script/g, '<\\/script')}\n</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, href) =>
  `<style>\n${readFileSync(join(dist, href), 'utf8')}\n</style>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('not everything was inlined');
const out = 'apps/client/dist-single/index.html';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(1)} KB`);
