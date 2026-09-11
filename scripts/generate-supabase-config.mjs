import fs from 'node:fs';

const sourcePath = 'supa.txt';
const targetPath = 'js/config.js';
if (!fs.existsSync(sourcePath)) {
    if (fs.existsSync(targetPath)) {
        console.log('supa.txt ausente; usando a configuração pública já gerada em js/config.js.');
        process.exit(0);
    }
    throw new Error('supa.txt e js/config.js não encontrados.');
}

const raw = fs.readFileSync(sourcePath, 'utf8');
const read = name => raw.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+?)\\s*$`, 'mi'))?.[1]?.trim() || '';
const url = read('url');
const anonKey = read('anon_key');
const email = read('login');
if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) throw new Error('URL do Supabase inválida.');
if (!anonKey || (!anonKey.startsWith('eyJ') && !anonKey.startsWith('sb_publishable_'))) throw new Error('Anon key pública não encontrada.');

const config = { supabase: { fixed: true, url, anonKey, email } };
const output = `/* Gerado por scripts/generate-supabase-config.mjs. Não inclui senha. */\nwindow.BookListConfig = Object.freeze(${JSON.stringify(config, null, 4)});\n`;
fs.writeFileSync(targetPath, output);
console.log('Configuração pública do Supabase gerada sem armazenar a senha.');
