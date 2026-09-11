import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['js', 'scripts', 'tests', 'browser-extension'];
const files = [];
const walk = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(file);
    }
};
roots.forEach(walk);
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }
}
console.log(`${files.length} arquivos JavaScript verificados.`);
