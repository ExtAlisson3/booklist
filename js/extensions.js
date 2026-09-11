// ============================================
// EXTENSIONS - Features novas (v1)
// Mantém os módulos existentes intactos via patches.
// ============================================
const Extensions = {
    SETTINGS_KEY: 'booklist_extensions_settings',
    HLJS_CDN: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
    HLJS_LANGS: ['javascript','python','sql','bash','json','html','css','typescript'],
    _hljsLoaded: false,

    init() {
        this.loadSettings();
        this.patchEditor();
        this.patchApp();
        this.bindGlobalShortcuts();
        this.maybeStartOnboarding();
        this.installToolbarFAB();
    },

    // ============================================
    // Settings
    // ============================================
    getSettings() {
        try {
            const raw = localStorage.getItem(this.SETTINGS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    },
    saveSettings(patch) {
        const next = { ...this.getSettings(), ...patch };
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(next));
        return next;
    },
    loadSettings() { return this.getSettings(); },

    // ============================================
    // #15 Code blocks + highlight.js
    // ============================================
    async loadHighlightJs() {
        if (this._hljsLoaded || window.hljs) { this._hljsLoaded = true; return; }
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css';
            document.head.appendChild(link);
            const s = document.createElement('script');
            s.src = this.HLJS_CDN;
            s.onload = () => { this._hljsLoaded = true; resolve(); };
            s.onerror = () => { this._hljsLoaded = false; resolve(); };
            document.head.appendChild(s);
        });
    },
    async insertCodeBlock() {
        await this.loadHighlightJs();
        const result = await BookListDialogs.open({ title: 'Inserir bloco de código', fields: [{ name: 'lang', label: 'Linguagem', value: 'javascript' }, { name: 'code', label: 'Código', type: 'textarea', rows: 10, required: true }], confirmText: 'Inserir' });
        if (!result) return;
        const lang = result.lang || 'plaintext';
        const code = result.code || '';
        const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const block = `<pre class="code-block"><code class="language-${lang}">${escaped}</code></pre><p><br></p>`;
        document.execCommand('insertHTML', false, block);
        this.highlightCodeIn(document.getElementById('editor-content'));
        Notes.autoSave?.();
    },
    highlightCodeIn(root) {
        if (!root || !window.hljs) return;
        root.querySelectorAll('pre code').forEach(el => {
            try { window.hljs.highlightElement(el); } catch {}
        });
    },

    // ============================================
    // #14 Inline images (paste/drop/upload)
    // ============================================
    async insertImagePrompt() {
        const result = await BookListDialogs.open({ title: 'Inserir imagem', fields: [{ name: 'source', label: 'Origem', type: 'select', value: 'url', options: [{ value: 'url', label: 'URL da imagem' }, { value: 'file', label: 'Arquivo do dispositivo' }] }], confirmText: 'Continuar' });
        if (result?.source === 'url') {
            const url = await BookListDialogs.prompt('URL da imagem', 'https://', { title: 'Imagem por URL', type: 'url' });
            if (url) document.execCommand('insertHTML', false, `<img src="${this.escape(url)}" alt="">`);
        } else if (result?.source === 'file') {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = (e) => {
                const f = e.target.files[0];
                if (f) this.fileToBase64Insert(f);
            };
            inp.click();
        }
    },
    fileToBase64Insert(file) {
        if (file.size > 2 * 1024 * 1024) {
            return App.toast('Imagem maior que 2MB. Use URL ou redimensione.', 'error');
        }
        const reader = new FileReader();
        reader.onload = () => {
            document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="${this.escape(file.name)}">`);
            Notes.autoSave?.();
        };
        reader.readAsDataURL(file);
    },
    handleEditorPaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const it of items) {
            if (it.type.startsWith('image/')) {
                e.preventDefault();
                const f = it.getAsFile();
                if (f) this.fileToBase64Insert(f);
                return;
            }
        }
    },
    handleEditorDrop(e) {
        if (!e.dataTransfer?.files?.length) return;
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
            e.preventDefault();
            this.fileToBase64Insert(f);
        }
    },

    // ============================================
    // #13 Tables
    // ============================================
    async insertTable() {
        const result = await BookListDialogs.open({ title: 'Inserir tabela', fields: [{ name: 'rows', label: 'Linhas (incluindo cabeçalho)', type: 'number', value: '3', min: 1, max: 50 }, { name: 'cols', label: 'Colunas', type: 'number', value: '3', min: 1, max: 20 }], confirmText: 'Inserir' });
        if (!result) return;
        const rows = parseInt(result.rows, 10);
        const cols = parseInt(result.cols, 10);
        if (!rows || !cols || rows < 1 || cols < 1) return;
        let html = '<table><thead><tr>';
        for (let c = 0; c < cols; c++) html += `<th>Col ${c+1}</th>`;
        html += '</tr></thead><tbody>';
        for (let r = 1; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
            html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';
        document.execCommand('insertHTML', false, html);
        Notes.autoSave?.();
    },

    // ============================================
    // #12 Embeds
    // ============================================
    async insertEmbed() {
        const url = await BookListDialogs.prompt('URL (YouTube, Vimeo, Twitter/X ou PDF)', 'https://', { title: 'Incorporar conteúdo', type: 'url' });
        if (!url) return;
        let html = '';
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
        const vi = url.match(/vimeo\.com\/(\d+)/);
        const tw = url.match(/(?:twitter|x)\.com\/.+\/status\/(\d+)/);
        if (yt) {
            html = `<div class="embed-wrapper video"><iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe></div><p><br></p>`;
        } else if (vi) {
            html = `<div class="embed-wrapper video"><iframe src="https://player.vimeo.com/video/${vi[1]}" allowfullscreen></iframe></div><p><br></p>`;
        } else if (tw) {
            html = `<div class="embed-wrapper tweet"><a class="embed-link" href="${this.escape(url)}" target="_blank" rel="noopener">📢 Tweet ${tw[1]} — abrir no X</a></div><p><br></p>`;
        } else if (/\.pdf(\?|$)/i.test(url)) {
            html = `<div class="embed-wrapper pdf"><iframe src="${this.escape(url)}"></iframe><p><a class="embed-link" href="${this.escape(url)}" target="_blank">Abrir PDF</a></p></div><p><br></p>`;
        } else {
            html = `<div class="embed-wrapper"><a class="embed-link" href="${this.escape(url)}" target="_blank" rel="noopener">🔗 ${this.escape(url)}</a></div><p><br></p>`;
        }
        document.execCommand('insertHTML', false, html);
        Notes.autoSave?.();
    },

    // ============================================
    // Editor patches
    // ============================================
    patchEditor() {
        document.addEventListener('booklist:note-opened', () => {
            this.bindEditorEvents();
            this.highlightCodeIn(document.getElementById('editor-content'));
        });
    },
    bindEditorEvents() {
        const ed = document.getElementById('editor-content');
        if (!ed || ed.__extBound) return;
        ed.__extBound = true;
        ed.addEventListener('paste', (e) => this.handleEditorPaste(e));
        ed.addEventListener('drop', (e) => this.handleEditorDrop(e));
        ed.addEventListener('dragover', (e) => e.preventDefault());
    },

    // ============================================
    // #11 Markdown improvements (better mdToHtml)
    // ============================================
    enhancedMdToHtml(md) {
        let out = md
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
                const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                return `<pre class="code-block"><code class="language-${lang||'plaintext'}">${escaped}</code></pre>`;
            })
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        return out;
    },

    // ============================================
    // #21 Shortcuts cheatsheet
    // ============================================
    showShortcutsCheatsheet() {
        const groups = [
            ['Navegação', [
                ['Ctrl', 'K'], 'Command palette / busca rápida'
            ]],
            ['Criação', [
                [['Ctrl', 'N'], 'Nova nota'],
                [['Ctrl', 'L'], 'Novo bookmark']
            ]],
            ['Editor de notas', [
                [['Ctrl', 'B'], 'Negrito'],
                [['Ctrl', 'I'], 'Itálico'],
                [['Ctrl', 'U'], 'Sublinhado']
            ]],
            ['Avançado', [
                [['Ctrl', '/'], 'Mostrar este painel'],
                [['Ctrl', 'Shift', 'T'], 'Trocar tema'],
                [['Ctrl', 'Shift', 'F'], 'Foco / Power Hub'],
                [['Esc'], 'Fechar modal']
            ]]
        ];
        let body = '<div class="shortcuts-grid">';
        groups.forEach(([title, items]) => {
            body += `<div class="shortcut-section-title">${title}</div>`;
            items.forEach(([keys, desc]) => {
                body += `<div class="shortcut-row"><span>${desc}</span><div class="shortcut-keys">${keys.map(k => `<span class="kbd">${k}</span>`).join('')}</div></div>`;
            });
        });
        body += '</div>';
        App.showModal('⌨️ Atalhos de teclado', body);
    },

    bindGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isTyping = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
            if (e.ctrlKey && e.key === '/') { e.preventDefault(); this.showShortcutsCheatsheet(); }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); App.navigate('power'); }
        });
    },

    // ============================================
    // #22 Onboarding
    // ============================================
    maybeStartOnboarding() {
        const s = this.getSettings();
        if (s.onboardingDone) return;
        const hasData = Storage.getBookmarks().length || Storage.getNotes().length;
        if (hasData) { this.saveSettings({ onboardingDone: true }); return; }
        setTimeout(() => this.startOnboarding(), 800);
    },
    startOnboarding(step = 0) {
        const steps = [
            { title: 'Bem-vindo ao BookList! 📚', body: 'Vamos te mostrar as principais features em 5 passos rápidos. Você pode pular a qualquer momento.' },
            { title: '🔖 Bookmarks', body: 'Salve links favoritos com categorias, pastas, status de leitura (não lido / lendo / lido) e barra de progresso. Ctrl+L cria um novo.' },
            { title: '📝 Notas com editor rico', body: 'Editor com negrito, itálico, títulos, listas, tabelas, código com syntax highlight, imagens (cole/arraste!), embeds (YouTube/PDF) e markdown.' },
            { title: '⚡ Power Hub', body: 'Inbox, projetos, flashcards, vault criptografado, kanban, calendário, relações, anotações e muito mais. Veja em "⚡ Power Hub" no menu.' },
            { title: '☁️ Sync com Supabase', body: 'Tudo é local-first (IndexedDB). Configure Supabase em Configurações para sincronizar entre dispositivos. Ctrl+/ mostra todos os atalhos.' }
        ];
        const cur = steps[step]; if (!cur) return this.endOnboarding();
        const total = steps.length;
        let ov = document.getElementById('onboard-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'onboard-overlay';
            ov.className = 'onboard-overlay';
            document.body.appendChild(ov);
        }
        ov.innerHTML = `
            <div class="onboard-card">
                <div class="onboard-progress">${steps.map((_,i) => `<div class="onboard-dot ${i<=step?'active':''}"></div>`).join('')}</div>
                <h2>${cur.title}</h2>
                <p>${cur.body}</p>
                <div class="onboard-actions">
                    <button class="btn btn-secondary" onclick="Extensions.endOnboarding()">Pular tour</button>
                    <div style="display:flex;gap:8px">
                        ${step>0?`<button class="btn btn-secondary" onclick="Extensions.startOnboarding(${step-1})">‹ Voltar</button>`:''}
                        <button class="btn btn-primary" onclick="Extensions.startOnboarding(${step+1})">${step===total-1?'Concluir 🎉':'Próximo ›'}</button>
                    </div>
                </div>
            </div>
        `;
    },
    endOnboarding() {
        this.saveSettings({ onboardingDone: true });
        document.getElementById('onboard-overlay')?.remove();
    },

    // ============================================
    // FAB on every page
    // ============================================
    installToolbarFAB() {
        if (document.getElementById('ext-fab')) return;
        const fab = document.createElement('div');
        fab.id = 'ext-fab';
        fab.style.cssText = 'position:fixed;bottom:18px;right:18px;display:flex;flex-direction:column;gap:8px;z-index:50';
        fab.innerHTML = `
            <button class="btn btn-secondary" title="Atalhos (Ctrl+/)" onclick="Extensions.showShortcutsCheatsheet()" style="border-radius:50%;width:44px;height:44px;font-size:18px">⌨️</button>
        `;
        document.body.appendChild(fab);
    },

    // ============================================
    // #7 Duplicates detection
    // ============================================
    renderDuplicates() {
        const bks = Storage.getBookmarks();
        const notes = Storage.getNotes();

        // bookmark URL duplicates
        const urlGroups = {};
        bks.forEach(b => {
            const norm = (b.url || '').replace(/\/$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
            if (!norm) return;
            (urlGroups[norm] = urlGroups[norm] || []).push(b);
        });
        const dupUrls = Object.values(urlGroups).filter(g => g.length > 1);

        // note title duplicates
        const titleGroups = {};
        notes.forEach(n => {
            const t = (n.title || '').trim().toLowerCase();
            if (!t) return;
            (titleGroups[t] = titleGroups[t] || []).push(n);
        });
        const dupNotes = Object.values(titleGroups).filter(g => g.length > 1);

        const dupHtml = dupUrls.map(g => `
            <div class="dup-group">
                <h4>🔗 ${this.escape(g[0].url)} <small>(${g.length} cópias)</small></h4>
                ${g.map((b, i) => `<div class="dup-item">
                    <span>${this.escape(b.title)} · ${new Date(b.createdAt).toLocaleDateString('pt-BR')}</span>
                    ${i>0?`<button class="btn btn-sm btn-danger" onclick="Extensions.deleteBookmark('${b.id}')">Apagar</button>`:'<small class="text-muted">manter</small>'}
                </div>`).join('')}
            </div>
        `).join('');

        const noteHtml = dupNotes.map(g => `
            <div class="dup-group">
                <h4>📝 ${this.escape(g[0].title)} <small>(${g.length} notas)</small></h4>
                ${g.map((n, i) => `<div class="dup-item">
                    <span>${new Date(n.updatedAt).toLocaleString('pt-BR')} · ${this.escape((Notes.stripHtml?.(n.content)||'').substring(0,40))}</span>
                    ${i>0?`<button class="btn btn-sm btn-danger" onclick="Extensions.deleteNote('${n.id}')">Apagar</button>`:'<small class="text-muted">manter</small>'}
                </div>`).join('')}
            </div>
        `).join('');

        return `
            <div class="feature-section">
                <h3>🔍 Detector de duplicatas</h3>
                <p class="text-muted">Encontra bookmarks com mesma URL e notas com mesmo título.</p>
                <div style="margin-top:12px">
                    <h4>Bookmarks duplicados (${dupUrls.length} grupos)</h4>
                    ${dupUrls.length ? dupHtml : '<p class="text-muted">Nenhuma URL duplicada encontrada. ✓</p>'}
                </div>
                <div style="margin-top:20px">
                    <h4>Notas com título igual (${dupNotes.length} grupos)</h4>
                    ${dupNotes.length ? noteHtml : '<p class="text-muted">Nenhum título duplicado. ✓</p>'}
                </div>
            </div>
        `;
    },
    deleteBookmark(id) {
        App.confirmAction('Apagar duplicata?', () => {
            Storage.deleteBookmark(id);
            App.renderPage('power'); App.toast('Duplicata removida.', 'success');
        }, { title: 'Apagar duplicata', confirmText: 'Apagar', danger: true });
    },
    deleteNote(id) {
        App.confirmAction('Apagar nota duplicada?', () => {
            Storage.deleteNote(id);
            App.renderPage('power'); App.toast('Nota removida.', 'success');
        }, { title: 'Apagar nota', confirmText: 'Apagar', danger: true });
    },

    // ============================================
    // #8 Reading list with progress
    // ============================================

    // ============================================
    // #9 Global Kanban
    // ============================================
    kanbanDragStart(e, kind, id) {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind, id }));
        e.target.classList.add('dragging');
    },
    kanbanDrop(e, colId) {
        e.preventDefault();
        const col = e.currentTarget;
        col.classList.remove('drag-target');
        try {
            const { kind, id } = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (kind === 'bookmark') Storage.updateBookmark(id, { kanbanCol: colId });
            else Storage.updateNote(id, { kanbanCol: colId });
            App.renderPage('power');
            App.toast(`Movido para ${colId}`, 'success');
        } catch {}
    },

    // ============================================
    // #10 Calendar view
    // ============================================
    renderCalendarView(month, year) {
        const now = new Date();
        const m = month ?? now.getMonth();
        const y = year ?? now.getFullYear();
        const first = new Date(y, m, 1);
        const last = new Date(y, m+1, 0);
        const startDay = first.getDay();
        const daysInMonth = last.getDate();
        const today = new Date();

        // Group items by date
        const byDate = {};
        Storage.getBookmarks().forEach(b => {
            const d = new Date(b.createdAt).toDateString();
            (byDate[d] = byDate[d] || []).push({type:'bookmark', item: b});
        });
        Storage.getNotes().forEach(n => {
            const d = new Date(n.createdAt).toDateString();
            (byDate[d] = byDate[d] || []).push({type:'note', item: n});
        });

        const cells = [];
        for (let i = 0; i < startDay; i++) cells.push('<div class="calendar-cell empty"></div>');
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m, d);
            const isToday = date.toDateString() === today.toDateString();
            const dayItems = byDate[date.toDateString()] || [];
            cells.push(`
                <div class="calendar-cell ${isToday?'today':''}" onclick="Extensions.showDayDetails('${date.toISOString()}')">
                    <span class="day-num">${d}</span>
                    ${dayItems.length ? `<span class="day-count">${dayItems.length}</span>` : ''}
                </div>
            `);
        }

        const monthName = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return `<div class="feature-section">
            <h3>📅 Calendário</h3>
            <div class="calendar-view">
                <div class="calendar-header">
                    <button class="btn btn-secondary btn-sm" onclick="Extensions.calNav(${m-1},${y})">‹ Anterior</button>
                    <h4 style="text-transform:capitalize">${monthName}</h4>
                    <button class="btn btn-secondary btn-sm" onclick="Extensions.calNav(${m+1},${y})">Próximo ›</button>
                </div>
                <div class="calendar-grid">
                    ${['D','S','T','Q','Q','S','S'].map(d=>`<div class="calendar-day-header">${d}</div>`).join('')}
                    ${cells.join('')}
                </div>
            </div>
        </div>`;
    },
    calNav(month, year) {
        if (month < 0) { month = 11; year--; }
        if (month > 11) { month = 0; year++; }
        const el = document.getElementById('feature-content');
        if (el) el.innerHTML = this.renderCalendarView(month, year);
    },
    showDayDetails(iso) {
        const date = new Date(iso);
        const dStr = date.toDateString();
        const items = [
            ...Storage.getBookmarks().filter(b => new Date(b.createdAt).toDateString() === dStr).map(b => ({...b, type:'🔖'})),
            ...Storage.getNotes().filter(n => new Date(n.createdAt).toDateString() === dStr).map(n => ({...n, type:'📝'}))
        ];
        if (!items.length) return App.toast('Nada criado neste dia', 'info');
        App.showModal(`📅 ${date.toLocaleDateString('pt-BR')}`, `
            <div style="max-height:60vh;overflow-y:auto">
                ${items.map(i => `<div class="dup-item"><span>${i.type} ${this.escape(i.title)}</span></div>`).join('')}
            </div>
        `);
    },

    // ============================================
    // #5 Extended Import (Pocket, Raindrop, Browser HTML)
    // ============================================
    renderExtendedImport() {
        return `<div class="feature-section">
            <h3>📥 Importar de outros apps</h3>
            <p class="text-muted">Importe bookmarks de browsers, Pocket, Raindrop, Notion (markdown) etc.</p>
            <div class="import-source-grid">
                <div class="import-source-card" onclick="Extensions.importBrowserHtml()">
                    <div class="icon">🌐</div>
                    <strong>Browser (HTML)</strong>
                    <small class="text-muted">Chrome / Firefox / Edge bookmarks.html</small>
                </div>
                <div class="import-source-card" onclick="Extensions.importPocket()">
                    <div class="icon">📕</div>
                    <strong>Pocket</strong>
                    <small class="text-muted">ril_export.html</small>
                </div>
                <div class="import-source-card" onclick="Extensions.importRaindrop()">
                    <div class="icon">💧</div>
                    <strong>Raindrop.io</strong>
                    <small class="text-muted">CSV export</small>
                </div>
                <div class="import-source-card" onclick="Extensions.importMarkdown()">
                    <div class="icon">📝</div>
                    <strong>Markdown</strong>
                    <small class="text-muted">Obsidian / Notion exports</small>
                </div>
            </div>
        </div>`;
    },
    _pickFile(accept) {
        return new Promise((resolve) => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = accept;
            inp.onchange = () => resolve(inp.files[0]);
            inp.click();
        });
    },
    async _readText(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = () => rej(r.error);
            r.readAsText(file);
        });
    },
    async importBrowserHtml() {
        const file = await this._pickFile('.html,.htm');
        if (!file) return;
        const text = await this._readText(file);
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href]'));
        let added = 0;
        const existing = new Set(Storage.getBookmarks().map(b => (b.url||'').toLowerCase()));
        links.forEach(a => {
            const url = a.getAttribute('href');
            if (!url || !/^https?:/i.test(url)) return;
            if (existing.has(url.toLowerCase())) return;
            Storage.addBookmark({ title: a.textContent.trim() || url, url, description: '', categoryIds: [], folderId: 'default' });
            added++;
        });
        App.toast(`${added} bookmark(s) importados do browser.`, 'success');
        App.renderPage('power');
    },
    async importPocket() {
        const file = await this._pickFile('.html,.htm');
        if (!file) return;
        const text = await this._readText(file);
        const doc = new DOMParser().parseFromString(text, 'text/html');
        // Pocket HTML: <li><a href="..." time_added="..." tags="...">Title</a>
        const links = Array.from(doc.querySelectorAll('a[href]'));
        const existing = new Set(Storage.getBookmarks().map(b => (b.url||'').toLowerCase()));
        let added = 0;
        links.forEach(a => {
            const url = a.getAttribute('href');
            if (!url || existing.has(url.toLowerCase())) return;
            const tags = (a.getAttribute('tags') || '').split(',').filter(Boolean);
            Storage.addBookmark({
                title: a.textContent.trim() || url,
                url,
                description: tags.length ? `Pocket tags: ${tags.join(', ')}` : '',
                categoryIds: [], folderId: 'default'
            });
            added++;
        });
        App.toast(`${added} item(ns) do Pocket importados.`, 'success');
    },
    async importRaindrop() {
        const file = await this._pickFile('.csv');
        if (!file) return;
        const text = await this._readText(file);
        const lines = text.split(/\r?\n/);
        const headers = (lines.shift() || '').split(',').map(h => h.replace(/"/g,'').trim());
        const idxUrl = headers.findIndex(h => /url|link/i.test(h));
        const idxTitle = headers.findIndex(h => /title/i.test(h));
        const idxNote = headers.findIndex(h => /note/i.test(h));
        const idxTags = headers.findIndex(h => /tag/i.test(h));
        let added = 0;
        const existing = new Set(Storage.getBookmarks().map(b => (b.url||'').toLowerCase()));
        const parseRow = (row) => {
            const cells = []; let cur = ''; let inQ = false;
            for (let i = 0; i < row.length; i++) {
                const c = row[i];
                if (c === '"') { inQ = !inQ; continue; }
                if (c === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
                cur += c;
            }
            cells.push(cur);
            return cells;
        };
        lines.forEach(line => {
            if (!line.trim()) return;
            const cells = parseRow(line);
            const url = cells[idxUrl];
            if (!url || existing.has(url.toLowerCase())) return;
            Storage.addBookmark({
                title: cells[idxTitle] || url,
                url,
                description: (cells[idxNote] || '') + (cells[idxTags] ? ` [tags: ${cells[idxTags]}]` : ''),
                categoryIds: [], folderId: 'default'
            });
            added++;
        });
        App.toast(`${added} item(ns) do Raindrop importados.`, 'success');
    },
    async importMarkdown() {
        const file = await this._pickFile('.md,.markdown,.txt');
        if (!file) return;
        const text = await this._readText(file);
        const title = file.name.replace(/\.[^.]+$/, '');
        const html = this.enhancedMdToHtml(this.escape(text)).replace(/\n/g,'<br>');
        Storage.addNote({ title, content: `<p>${html}</p>`, categoryIds: [], folderId: 'default' });
        App.toast('Markdown importado como nota!', 'success');
    },

    patchApp() {
        // No-op hook for future patches
    },

    // ============================================
    // #6 AI tagging panel
    // ============================================
    saveAISettings() {
        const ai = {
            provider: document.getElementById('ai-provider').value,
            apiKey: document.getElementById('ai-key').value.trim(),
            model: document.getElementById('ai-model').value.trim()
        };
        this.saveSettings({ ai });
        App.toast('Config AI salva.', 'success');
    },
    async aiSuggestTagsForNote(id) {
        const cfg = this.getSettings().ai || {};
        if (!cfg.apiKey) return App.toast('Configure a API key primeiro.', 'error');
        const note = Storage.getNotes().find(n => n.id === id);
        if (!note) return;
        const text = (Notes.stripHtml?.(note.content) || '').slice(0, 4000);
        const out = document.getElementById('ai-suggestions');
        if (out) out.innerHTML = '<p class="text-muted">⏳ Pensando...</p>';
        try {
            let tags;
            if (cfg.provider === 'anthropic') {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': cfg.apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: cfg.model || 'claude-sonnet-4-6',
                        max_tokens: 200,
                        messages: [{ role: 'user', content: `Sugira 5 tags curtas (1-2 palavras, em português) para esta nota. Retorne apenas as tags separadas por vírgula.\n\nTítulo: ${note.title}\n\nConteúdo:\n${text}` }]
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Erro API');
                tags = (data.content?.[0]?.text || '').split(',').map(t => t.trim()).filter(Boolean);
            } else {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: cfg.model || 'gpt-4o-mini',
                        messages: [{ role: 'user', content: `Sugira 5 tags curtas em português, separadas por vírgula, para:\n\n${note.title}\n\n${text}` }]
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Erro API');
                tags = (data.choices?.[0]?.message?.content || '').split(',').map(t => t.trim()).filter(Boolean);
            }
            if (out) {
                out.innerHTML = `<strong>Sugestões:</strong><br>${tags.map(t => `<span class="ai-suggestion-chip" onclick="Extensions.addTagToNote('${id}','${t.replace(/'/g,"\\'")}')">${this.escape(t)}</span>`).join('')}`;
            }
        } catch (err) {
            if (out) out.innerHTML = `<p style="color:var(--danger)">Erro: ${this.escape(err.message)}</p>`;
        }
    },
    addTagToNote(id, tag) {
        const cats = Storage.getNtCategories();
        let cat = cats.find(c => c.name.toLowerCase() === tag.toLowerCase());
        if (!cat) {
            cat = { id: crypto.randomUUID(), name: tag, icon: '🏷️', color: '#7C4DFF' };
            cats.push(cat); Storage.saveNtCategories(cats);
        }
        const notes = Storage.getNotes();
        const note = notes.find(n => n.id === id);
        if (!note) return;
        const ids = note.categoryIds || [];
        if (!ids.includes(cat.id)) ids.push(cat.id);
        Storage.updateNote(id, { categoryIds: ids });
        App.toast(`Tag "${tag}" adicionada.`, 'success');
    },

    // ============================================
    // #16 Drive backup (instructions + manual flow)
    // ============================================
    renderDriveBackup() {
        const cfg = this.getSettings().drive || {};
        return `<div class="feature-section">
            <h3>☁️ Backup para Google Drive</h3>
            <p class="text-muted">OAuth completo precisa de um Client ID do Google Cloud Console. Por simplicidade, oferecemos backup manual via download/upload aqui.</p>
            <div class="ai-config-card">
                <label>Client ID OAuth (Google Cloud Console > APIs & Services > Credentials)</label>
                <input type="text" id="drive-client" placeholder="xxxxxx.apps.googleusercontent.com" value="${this.escape(cfg.clientId||'')}">
                <small class="text-muted">Sem Client ID, use os botões manuais abaixo.</small>
                <div style="margin-top:8px"><button class="btn btn-secondary" onclick="Extensions.saveDriveSettings()">Salvar Client ID</button></div>
            </div>
            <h4 style="margin-top:14px">Backup manual</h4>
            <div class="settings-actions">
                <button class="btn btn-primary" onclick="Storage.exportAll()">📥 Baixar JSON (faça upload no Drive)</button>
                <label class="btn btn-secondary">📤 Restaurar de JSON do Drive<input type="file" accept=".json" style="display:none" onchange="App.handleImport(this.files[0])"></label>
            </div>
            <p class="text-muted" style="margin-top:8px">Sugestão: crie uma pasta "BookList Backups" no Drive, suba o JSON exportado periodicamente. O Power Hub também tem snapshots locais automáticos.</p>
        </div>`;
    },
    saveDriveSettings() {
        const clientId = document.getElementById('drive-client').value.trim();
        this.saveSettings({ drive: { clientId } });
        App.toast('Client ID salvo (recurso completo de OAuth pode ser ativado em versão futura).', 'info');
    },

    // ============================================
    // #17 2FA on Vault (TOTP)
    // ============================================
    renderTwoFA() {
        const cfg = this.getSettings().twofa || {};
        return `<div class="feature-section">
            <h3>🔐 2FA no Vault (TOTP)</h3>
            <p class="text-muted">Adiciona uma camada extra ao Vault: além da senha, exige código TOTP de 6 dígitos (Google Authenticator, Authy, 1Password).</p>
            <div class="ai-config-card">
                ${cfg.enabled ? `
                    <p><strong>2FA está ATIVO</strong></p>
                    <p class="text-muted">Secret: <code>${this.escape(cfg.secret)}</code></p>
                    <button class="btn btn-danger" onclick="Extensions.disable2FA()">Desativar 2FA</button>
                ` : `
                    <p>2FA está <strong>desativado</strong>.</p>
                    <button class="btn btn-primary" onclick="Extensions.enable2FA()">Gerar secret e ativar</button>
                    <p class="text-muted" style="margin-top:8px">Após gerar, escaneie o QR no seu app autenticador. Você precisará digitar o código de 6 dígitos junto com a senha do Vault.</p>
                `}
            </div>
            ${cfg.enabled ? `
            <h4 style="margin-top:14px">Verificar código</h4>
            <input type="text" id="totp-test" placeholder="123456" maxlength="6" style="font-size:1.4em;text-align:center;letter-spacing:8px">
            <button class="btn btn-primary" style="margin-top:8px" onclick="Extensions.verifyTotp()">Verificar</button>
            ` : ''}
        </div>`;
    },
    enable2FA() {
        // Generate base32 secret (16 chars)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        const bytes = crypto.getRandomValues(new Uint8Array(10));
        for (const b of bytes) secret += chars[b % 32];
        this.saveSettings({ twofa: { enabled: true, secret } });
        const otpauth = `otpauth://totp/BookList?secret=${secret}&issuer=BookList`;
        App.showModal('🔐 2FA ativado', `
            <p>Escaneie o QR no seu app autenticador:</p>
            <div style="text-align:center;margin:14px 0">
                <a class="btn btn-primary" href="${this.escape(otpauth)}">Abrir no aplicativo autenticador</a>
            </div>
            <p>Ou digite o secret manualmente:</p>
            <code style="display:block;text-align:center;font-size:1.1em;background:var(--bg-input);padding:12px;border-radius:6px;letter-spacing:2px">${secret}</code>
            <p class="text-muted" style="margin-top:12px">⚠️ Guarde este secret. Sem ele você não consegue mais abrir o Vault.</p>
        `);
    },
    async disable2FA() {
        if (!await BookListDialogs.confirm('Desativar 2FA? O Cofre voltará a usar apenas senha.', { title: 'Desativar autenticação em duas etapas', confirmText: 'Desativar' })) return;
        this.saveSettings({ twofa: { enabled: false, secret: null } });
        App.renderPage('power');
        App.toast('2FA desativado', 'info');
    },
    async verifyTotp() {
        const code = document.getElementById('totp-test').value.trim();
        const secret = this.getSettings().twofa?.secret;
        if (!secret || code.length !== 6) return App.toast('Código inválido', 'error');
        const valid = await this.totpVerify(secret, code);
        App.toast(valid ? '✓ Código válido!' : '✗ Código incorreto', valid ? 'success' : 'error');
    },
    // RFC 6238 TOTP
    async totpVerify(secret, token) {
        const counter = Math.floor(Date.now() / 30000);
        for (let off = -1; off <= 1; off++) {
            const c = counter + off;
            const code = await this.totpGenerate(secret, c);
            if (code === token) return true;
        }
        return false;
    },
    async totpGenerate(base32, counter) {
        const key = this._base32Decode(base32);
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(4, counter, false);
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf));
        const offset = sig[sig.length-1] & 0xf;
        const code = ((sig[offset] & 0x7f) << 24) | (sig[offset+1] << 16) | (sig[offset+2] << 8) | sig[offset+3];
        return String(code % 1000000).padStart(6, '0');
    },
    _base32Decode(b32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        for (const c of b32.toUpperCase().replace(/=+$/,'')) {
            const idx = alphabet.indexOf(c);
            if (idx < 0) continue;
            bits += idx.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.slice(i, i+8), 2));
        }
        return new Uint8Array(bytes);
    },

    // ============================================
    // Helpers
    // ============================================
    escape(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
};

// Bootstrap when ready
document.addEventListener('DOMContentLoaded', () => {
    const wait = () => {
        if (window.App && window.Storage && window.FeatureHub && window.Notes && window.Bookmarks) {
            try { Extensions.init(); } catch (err) { console.error('Extensions init failed:', err); }
        } else {
            setTimeout(wait, 50);
        }
    };
    wait();
});
