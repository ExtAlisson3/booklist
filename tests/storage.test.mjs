import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageEnvironment } from './helpers/storage-environment.mjs';

test('armazenamento cria, atualiza e remove notas e bookmarks', () => {
    const { Storage } = createStorageEnvironment();
    const note = Storage.addNote({ title: 'Teste', content: '<p>Inicial</p>' });
    const bookmark = Storage.addBookmark({ title: 'BookList', url: 'https://example.com' });
    assert.equal(Storage.getNotes()[0].title, 'Teste');
    assert.equal(Storage.getBookmarks()[0].url, 'https://example.com');
    Storage.updateNote(note.id, { title: 'Atualizada' });
    assert.equal(Storage.getNotes()[0].title, 'Atualizada');
    Storage.deleteBookmark(bookmark.id);
    assert.equal(Storage.getBookmarks().length, 0);
    assert.equal(Storage.getTrash()[0].type, 'bookmark');
});

test('fila de sincronização registra alterações locais', () => {
    const { Storage } = createStorageEnvironment();
    Storage.addNote({ title: 'Pendente', content: '' });
    const status = Storage.getSyncStatus();
    assert.ok(status.dirtyCount >= 1);
    assert.equal(status.status, 'off');
    const forced = Storage.forceLocalSync();
    assert.ok(forced >= status.dirtyCount);
});

test('anexos, mídia e preferências pertencem ao contrato de sincronização', () => {
    const { Storage } = createStorageEnvironment();
    assert.equal(Storage._isSyncableKey(Storage.ATTACHMENTS_KEY), true);
    assert.equal(Storage._isSyncableKey(Storage.MEDIA_KEY), true);
    assert.equal(Storage._isSyncableKey(Storage.PREFERENCES_KEY), true);
    Storage.addAttachment({ noteId: 'n1', name: 'evidencia.txt', size: 12 });
    Storage.saveSettings({ theme: 'light', workspaceMode: 'work' });
    const dirty = Storage._getMeta().dirtyKeys;
    assert.ok(dirty.includes(Storage.ATTACHMENTS_KEY));
    assert.ok(dirty.includes(Storage.PREFERENCES_KEY));
});

test('configuração pública fixa do Supabase não pode ser substituída localmente', () => {
    const fixed = { fixed: true, url: 'https://project.supabase.co', anonKey: 'public-anon', email: 'user@example.com' };
    const { Storage } = createStorageEnvironment({ BookListConfig: { supabase: fixed } });
    Storage.saveSyncConfig({ supabaseUrl: 'https://wrong.invalid', anonKey: 'wrong', email: 'wrong@example.com', enabled: false });
    const sync = Storage.getSettings().sync;
    assert.equal(sync.enabled, true);
    assert.equal(sync.supabaseUrl, fixed.url);
    assert.equal(sync.anonKey, fixed.anonKey);
    assert.equal(sync.email, fixed.email);
});

test('conflitos de mídia e preferências usam as regras canônicas de mesclagem', () => {
    const { Storage } = createStorageEnvironment();
    const media = Storage._mergeSyncPayload(Storage.MEDIA_KEY, { local: { dataUrl: 'data:x', updatedAt: '2026-01-02' } }, { remote: { dataUrl: 'data:y', updatedAt: '2026-01-01' } });
    assert.deepEqual(Object.keys(media).sort(), ['local', 'remote']);
    const preferences = Storage._mergeSyncPayload(Storage.PREFERENCES_KEY, { theme: 'light', updatedAt: '2026-01-02T00:00:00Z' }, { theme: 'dark', updatedAt: '2026-01-01T00:00:00Z' });
    assert.equal(preferences.theme, 'light');
});

test('registros técnicos preservam módulo e campos específicos', () => {
    const { Storage } = createStorageEnvironment();
    const record = Storage.addProfessionalRecord({ moduleKey: 'finance', title: 'Novo movimento', status: 'pago', fields: { type: 'entrada', amount: 150.5 } });
    assert.equal(Storage.getProfessionalRecords('finance')[0].fields.amount, 150.5);
    Storage.updateProfessionalRecord(record.id, { status: 'conciliado' });
    assert.equal(Storage.getProfessionalRecords('finance')[0].status, 'conciliado');
    Storage.deleteProfessionalRecord(record.id);
    assert.equal(Storage.getProfessionalRecords().length, 0);
});
