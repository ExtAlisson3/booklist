import fs from 'node:fs';

const mode = process.argv[2] || '--check';
const indexPath = 'index.html';
const workerPath = 'sw.js';
let html = fs.readFileSync(indexPath, 'utf8');
let worker = fs.readFileSync(workerPath, 'utf8');
const cacheMatch = worker.match(/const CACHE_NAME = 'booklist-v(\d+)'/);
if (!cacheMatch) throw new Error('CACHE_NAME da PWA não encontrado.');
let version = Number(cacheMatch[1]);

const localAssets = source => [...source.matchAll(/(?:src|href)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=(\d+))?"/g)].map(match => ({ path: match[1], version: match[2] ? Number(match[2]) : null }));

if (mode === '--bump') {
    version += 1;
    html = html.replace(/((?:src|href)=")((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=\d+)?("\s*(?:defer)?)/g, `$1$2?v=${version}$3`);
    fs.writeFileSync(indexPath, html);
}

const assets = localAssets(html);
const wrongVersions = assets.filter(asset => asset.version !== version);
const shell = ['./', './index.html', ...assets.map(asset => `./${asset.path}?v=${version}`), './manifest.webmanifest', './icon.svg'];
const shellBlock = `const APP_SHELL = [\n${shell.map(item => `  '${item}'`).join(',\n')}\n];`;
const nextWorker = worker
    .replace(/const CACHE_NAME = 'booklist-v\d+'/, `const CACHE_NAME = 'booklist-v${version}'`)
    .replace(/const APP_SHELL = \[[\s\S]*?\n\];/, shellBlock);

if (mode === '--bump') {
    fs.writeFileSync(workerPath, nextWorker);
    console.log(`PWA atualizada para booklist-v${version}; ${assets.length} assets sincronizados.`);
    process.exit(0);
}
if (mode !== '--check') throw new Error('Use --check ou --bump.');
if (wrongVersions.length) throw new Error(`Assets fora da versão ${version}: ${wrongVersions.map(item => item.path).join(', ')}`);
if (nextWorker !== worker) throw new Error('APP_SHELL não corresponde aos assets declarados em index.html. Execute npm run pwa:bump.');
console.log(`PWA booklist-v${version}: cache e ${assets.length} assets estão sincronizados.`);
