/* Operational health screen and storage diagnostics. */
const SystemHealth = {
    bytes(value) {
        const size = Number(value || 0);
        if (size < 1024) return `${size} B`;
        if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1024 ** 2).toFixed(1)} MB`;
    },

    async collect() {
        const sync = Storage.getSyncStatus();
        const backups = Storage.getAutoBackups();
        const attachments = Storage.getAttachments();
        const documents = Storage.getDocuments();
        const media = Object.values(Storage._get(Storage.MEDIA_KEY) || {});
        const attachmentBytes = [...attachments, ...documents, ...media].reduce((sum, item) => sum + Number(item.size || item.dataUrl?.length * .75 || 0), 0);
        let quota = { usage: 0, quota: 0 };
        try { quota = await navigator.storage?.estimate?.() || quota; } catch {}
        const lastHistory = Storage.getSyncHistory()[0] || null;
        const settings = Storage.getSettings();
        return {
            database: { available: Boolean(Storage._db), mode: Storage._db ? 'IndexedDB + espelho local' : 'Fallback localStorage', cacheKeys: Object.keys(Storage._cache || {}).length },
            backups: { count: backups.length, lastAt: backups[0]?.createdAt || null, reason: backups[0]?.reason || '' },
            sync: { ...sync, lastResult: lastHistory, fixedProject: Boolean(Storage.DEFAULT_SUPABASE?.fixed), authenticated: Boolean(settings.sync?.accessToken), account: settings.sync?.email || '' },
            storage: { usage: quota.usage || 0, quota: quota.quota || 0, attachmentBytes, attachments: attachments.length, documents: documents.length, media: media.length },
            counts: { notes: Storage.getNotes().length, bookmarks: Storage.getBookmarks().length, technical: Storage.getProfessionalRecords().length, personal: Object.values(Storage.getPersonalData()).filter(Array.isArray).reduce((sum, items) => sum + items.length, 0) }
        };
    },

    statusCard(label, value, detail, tone = '') {
        return `<article class="health-status-card ${tone}"><span>${App.escapeHtml(label)}</span><strong>${App.escapeHtml(String(value))}</strong><small>${App.escapeHtml(detail || '')}</small></article>`;
    },

    async backupNow() {
        Storage.createAutoBackup('manual');
        Storage.exportAll();
        App.toast('Snapshot local e backup JSON criados.', 'success');
        await this.render(document.getElementById('main-content'));
    },

    async render(main) {
        main.innerHTML = '<div class="module-page"><div class="empty-state"><div class="empty-icon">◌</div><p>Analisando armazenamento local…</p></div></div>';
        const health = await this.collect();
        const quotaPct = health.storage.quota ? Math.round(health.storage.usage / health.storage.quota * 100) : 0;
        const lastResult = health.sync.lastResult;
        main.innerHTML = `<div class="module-page system-health-page"><div class="module-hero"><div><span class="module-kicker">Diagnóstico local</span><h2>◌ Saúde do Sistema</h2><p>Armazenamento, backups, sincronização e volume dos seus dados em um só lugar.</p></div><div class="row-actions"><button class="btn btn-secondary" onclick="SystemHealth.render(document.getElementById('main-content'))">Atualizar</button><button class="btn btn-primary" onclick="SystemHealth.backupNow()">Fazer backup agora</button></div></div><div class="health-status-grid">${this.statusCard('Banco local', health.database.available ? 'Operacional' : 'Fallback', health.database.mode, health.database.available ? 'ok' : 'warning')}${this.statusCard('Último backup', health.backups.lastAt ? new Date(health.backups.lastAt).toLocaleString('pt-BR') : 'Nunca', health.backups.count ? `${health.backups.count} snapshots locais` : 'Crie seu primeiro backup', health.backups.lastAt ? 'ok' : 'warning')}${this.statusCard('Sincronização', health.sync.status, `${health.sync.dirtyCount} alteração(ões) pendente(s)`, health.sync.dirtyCount ? 'warning' : 'ok')}${this.statusCard('Conta Supabase', health.sync.authenticated ? 'Autenticada' : 'Login pendente', `${health.sync.fixedProject ? 'Projeto fixo' : 'Projeto configurável'} · ${health.sync.account || 'sem conta'}`, health.sync.authenticated ? 'ok' : 'warning')}${this.statusCard('Espaço estimado', quotaPct ? `${quotaPct}% usado` : this.bytes(health.storage.usage), health.storage.quota ? `${this.bytes(health.storage.usage)} de ${this.bytes(health.storage.quota)}` : 'Quota não informada pelo navegador')}</div><div class="dash-sections"><section class="dash-section"><div class="dash-section-header"><h2>Conteúdo local</h2></div><div class="health-detail-list"><span>Notas <strong>${health.counts.notes}</strong></span><span>Bookmarks <strong>${health.counts.bookmarks}</strong></span><span>Registros técnicos <strong>${health.counts.technical}</strong></span><span>Itens pessoais <strong>${health.counts.personal}</strong></span></div></section><section class="dash-section"><div class="dash-section-header"><h2>Anexos e documentos</h2></div><div class="health-detail-list"><span>Anexos <strong>${health.storage.attachments}</strong></span><span>Documentos <strong>${health.storage.documents}</strong></span><span>Imagens sincronizadas <strong>${health.storage.media}</strong></span><span>Volume aproximado <strong>${this.bytes(health.storage.attachmentBytes)}</strong></span></div></section></div><section class="dash-section"><div class="dash-section-header"><h2>Sincronização</h2>${health.sync.enabled ? '<button class="btn btn-sm btn-primary" onclick="App.syncNow()">Sincronizar agora</button>' : '<button class="btn btn-sm btn-secondary" onclick="App.navigate(\'settings\')">Configurar</button>'}</div><div class="health-sync-summary"><p>${App.escapeHtml(health.sync.message || '')}</p><small>Última sincronização: ${health.sync.lastSyncAt ? new Date(health.sync.lastSyncAt).toLocaleString('pt-BR') : 'ainda não realizada'}.</small>${lastResult ? `<div class="health-last-result ${lastResult.status === 'success' ? 'ok' : 'warning'}"><strong>${lastResult.status === 'success' ? 'Último resultado: concluído' : 'Último resultado: erro'}</strong><span>${App.escapeHtml(lastResult.message || '')}</span><small>${Number(lastResult.pulled || 0)} recebido(s) · ${Number(lastResult.pushed || 0)} enviado(s)</small></div>` : '<div class="health-last-result"><span>Nenhuma sincronização registrada.</span></div>'}</div></section></div>`;
    }
};
window.SystemHealth = SystemHealth;
