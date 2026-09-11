import fs from 'node:fs';

const sourcePath = 'supa.txt';
if (!fs.existsSync(sourcePath)) throw new Error('supa.txt não encontrado; a verificação ao vivo é local e não roda no CI.');
const raw = fs.readFileSync(sourcePath, 'utf8');
const read = name => raw.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+?)\\s*$`, 'mi'))?.[1]?.trim() || '';
const url = read('url').replace(/\/+$/, '');
const anonKey = read('anon_key');
const email = read('login');
const password = read('senha') || read('password');
if (!url || !anonKey || !email || !password) throw new Error('supa.txt está incompleto.');

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
});
if (!auth.ok) throw new Error(`Falha de autenticação (${auth.status}).`);
const session = await auth.json();
const response = await fetch(`${url}/rest/v1/booklist_sync_documents?select=doc_key&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` }
});
if (!response.ok) throw new Error(`Tabela de sincronização indisponível (${response.status}).`);
const shares = await fetch(`${url}/rest/v1/booklist_public_shares?select=share_id&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` }
});
if (!shares.ok) throw new Error(`Tabela de compartilhamento público indisponível (${shares.status}).`);
console.log('Supabase verificado: autenticação, sincronização e compartilhamento público operacionais.');
