import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageEnvironment } from './helpers/storage-environment.mjs';

test('exportação e importação fazem round-trip dos dados principais', () => {
    const source = createStorageEnvironment();
    source.Storage.addNote({ title: 'Backup', content: '<p>Conteúdo</p>' });
    source.Storage.addProfessionalRecord({ moduleKey: 'tickets', title: 'Chamado 42', fields: { priority: 'alta' } });
    source.Storage.addAttachment({ noteId: 'n1', name: 'foto.jpg', size: 50 });
    source.Storage._set(source.Storage.MEDIA_KEY, { media1: { dataUrl: 'data:text/plain;base64,QQ==', size: 1 } });
    const payload = source.Portability.createPayload();

    const target = createStorageEnvironment();
    assert.equal(target.Portability.importPayload(payload), true);
    assert.equal(target.Storage.getNotes()[0].title, 'Backup');
    assert.equal(target.Storage.getProfessionalRecords()[0].title, 'Chamado 42');
    assert.equal(target.Storage.getAttachments()[0].name, 'foto.jpg');
    assert.ok(target.Storage._get(target.Storage.MEDIA_KEY).media1);
});

test('importação rejeita conteúdo que não é backup do BookList', () => {
    const { Portability } = createStorageEnvironment();
    assert.throws(() => Portability.importPayload({ qualquer: 'coisa' }), /backup válido/);
});

test('cofre desbloqueia apenas com a senha correta', async () => {
    const { Storage } = createStorageEnvironment();
    await Storage.setupVault('senha-segura');
    assert.equal(Storage.isVaultUnlocked(), true);
    Storage.lockVault();
    await assert.rejects(Storage.unlockVault('senha-errada'));
    await Storage.unlockVault('senha-segura');
    assert.equal(Storage.isVaultUnlocked(), true);
});
