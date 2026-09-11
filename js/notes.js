// ============================================
// NOTES MODULE - Multi-category + Rich Text
// ============================================
const Notes = {
    currentFolder: 'all',
    currentCategory: 'all',
    searchQuery: '',
    sortBy: 'newest',
    editingId: null,
    markdownMode: false,

    init() {
        this.renderList();
        this.renderFolderSidebar();
        this.renderCategoryFilter();
    },

    getFiltered() {
        let items = Storage.getNotes();
        if (this.currentFolder === 'pinned') items = items.filter(n => n.pinned);
        else if (this.currentFolder !== 'all') items = items.filter(n => n.folderId === this.currentFolder);
        if (this.currentCategory !== 'all') items = items.filter(n => (n.categoryIds || []).includes(this.currentCategory));
        if (this.searchQuery) {
            items = items.filter(n => FuzzySearch.matches(this.searchQuery, [
                { text: n.title || '', weight: 3 },
                { text: this.stripHtml(n.content || ''), weight: 1 }
            ]));
        }
        items = items.filter(n => App.contextMatches('note', n));
        items.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            switch (this.sortBy) {
                case 'newest': return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'oldest': return new Date(a.updatedAt) - new Date(b.updatedAt);
                case 'alpha': return a.title.localeCompare(b.title);
                case 'manual': return (a.manualOrder ?? 999999) - (b.manualOrder ?? 999999);
                default: return 0;
            }
        });
        return items;
    },

    renderList() {
        const container = document.getElementById('notes-list-items');
        if (!container) return;
        const items = this.getFiltered();
        const categories = Storage.getNtCategories();
        document.getElementById('nt-count').textContent = `${items.length} nota${items.length !== 1 ? 's' : ''}`;

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128221;</div><h3>Nenhuma nota encontrada</h3><p>Crie sua primeira nota!</p></div>`;
            return;
        }

        container.innerHTML = items.map(n => {
            const nCats = (n.categoryIds || []).map(cid => categories.find(c => c.id === cid)).filter(Boolean);
            const preview = this.escapeHtml(this.stripHtml(n.content || '').substring(0, 120));
            const catsHtml = nCats.length > 0
                ? nCats.map(c => `<span class="bk-category" style="--cat-color: ${c.color}">${c.icon} ${c.name}</span>`).join('')
                : `<span class="bk-category" style="--cat-color: #78909C">&#128221; Sem cat.</span>`;
            return `
            <div class="note-card ${n.pinned ? 'is-pinned' : ''} ${this.editingId === n.id ? 'active' : ''}" onclick="Notes.openEditor('${n.id}')" data-id="${n.id}" draggable="true" ondragstart="Notes.dragStart(event,'${n.id}')" ondragover="event.preventDefault()" ondrop="Notes.dropOn(event,'${n.id}')">
                <div class="note-card-header">
                    <h4 class="note-card-title">${n.pinned ? '&#128204; ' : ''}${this.escapeHtml(n.title)}</h4>
                    <div class="note-card-actions">
                        <button class="btn-icon-sm" onclick="event.stopPropagation();Notes.togglePin('${n.id}')" title="${n.pinned ? 'Desafixar' : 'Fixar'}">&#128204;</button>
                        <button class="btn-icon-sm" onclick="event.stopPropagation();Notes.delete('${n.id}')" title="Apagar">&#128465;</button>
                    </div>
                </div>
                <p class="note-card-preview">${preview || '<em>Nota vazia</em>'}...</p>
                <div class="note-card-meta">
                    <div class="bk-cats-wrap compact">${catsHtml}</div>
                    <span class="note-date">${this.formatDate(n.updatedAt)}</span>
                </div>
            </div>`;
        }).join('');
    },

    renderFolderSidebar() {
        const el = document.getElementById('nt-folders-list');
        if (!el) return;
        const folders = Storage.getNtFolders();
        const notes = Storage.getNotes();
        el.innerHTML = `
            <li class="folder-item ${this.currentFolder === 'all' ? 'active' : ''}" onclick="Notes.setFolder('all')">
                <span>&#128221; Todas</span><span class="badge">${notes.length}</span>
            </li>
            <li class="folder-item ${this.currentFolder === 'pinned' ? 'active' : ''}" onclick="Notes.setFolder('pinned')">
                <span>&#128204; Fixadas</span><span class="badge">${notes.filter(n => n.pinned).length}</span>
            </li>
            ${folders.map(f => {
                const count = notes.filter(n => n.folderId === f.id).length;
                return `<li class="folder-item ${this.currentFolder === f.id ? 'active' : ''}" onclick="Notes.setFolder('${f.id}')">
                    <span>${f.icon} ${f.name}</span>
                    <span class="badge">${count}</span>
                </li>`;
            }).join('')}
        `;
    },

    renderCategoryFilter() {
        const el = document.getElementById('nt-category-filter');
        if (!el) return;
        const cats = Storage.getNtCategories();
        el.innerHTML = `<button class="cat-btn ${this.currentCategory === 'all' ? 'active' : ''}" onclick="Notes.setCategory('all')">Todas</button>` +
            cats.map(c => `<button class="cat-btn ${this.currentCategory === c.id ? 'active' : ''}" onclick="Notes.setCategory('${c.id}')" style="--cat-color:${c.color}">${c.icon} ${c.name}</button>`).join('');
    },

    dragStart(event, id) {
        event.dataTransfer.setData('text/plain', id);
        event.stopPropagation();
    },

    dropOn(event, targetId) {
        event.stopPropagation();
        const sourceId = event.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === targetId) return;
        const all = Storage.getNotes();
        const visible = this.getFiltered().map(n => n.id);
        const from = visible.indexOf(sourceId), to = visible.indexOf(targetId);
        if (from < 0 || to < 0) return;
        visible.splice(to, 0, visible.splice(from, 1)[0]);
        visible.forEach((id, index) => {
            const item = all.find(n => n.id === id);
            if (item) item.manualOrder = index;
        });
        Storage.saveNotes(all);
        this.sortBy = 'manual';
        this.renderList();
    },

    setFolder(id) {
        this.currentFolder = id;
        this.renderFolderSidebar(); this.renderList();
    },
    setCategory(id) { this.currentCategory = id; this.renderCategoryFilter(); this.renderList(); },
    search(q) { this.searchQuery = q; this.renderList(); },
    searchDebounced(q) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.search(q), 160);
    },

    // Multi-category chip selector for notes
    _renderCatChips(selectedIds, prefix) {
        const cats = Storage.getNtCategories();
        return `<div class="multi-cat-selector" id="${prefix}-cats">
            <label>Categorias <span class="text-muted">(clique para selecionar)</span></label>
            <div class="cat-chips">
                ${cats.map(c => `<button type="button" class="cat-chip ${(selectedIds || []).includes(c.id) ? 'selected' : ''}" data-cat-id="${c.id}" style="--cat-color:${c.color}" onclick="Notes.toggleCatChip(this)">${c.icon} ${c.name}</button>`).join('')}
            </div>
        </div>`;
    },

    toggleCatChip(btn) { btn.classList.toggle('selected'); },

    getSelectedCatIds(prefix) {
        const chips = document.querySelectorAll(`#${prefix}-cats .cat-chip.selected`);
        return Array.from(chips).map(c => c.dataset.catId);
    },

    showCreateModal() {
        const folders = Storage.getNtFolders();
        const customTemplates = Storage.getCustomTemplates ? Storage.getCustomTemplates() : [];
        App.showModal('Nova Nota', `
            ${App.modalContextHtml({
                icon: '📝',
                title: 'Nova nota',
                description: 'Crie a nota com pasta, categorias e uma data de timeline antes de abrir o editor completo.',
                meta: ['Editor rico', 'Notas'],
                tone: 'notes'
            })}
            <form id="nt-create-form" onsubmit="Notes.createFromModal(event)" class="settings-entity-form module-form">
                <div class="form-group note-title-field"><label>Título *</label><input type="text" id="nt-new-title" required autofocus placeholder="Dê um nome claro para encontrar depois"></div>
                <div class="note-create-section">
                    <div class="note-create-section-head"><strong>Como você quer começar?</strong><span>Opcional</span></div>
                    <div class="note-template-quickpick" role="group" aria-label="Escolha um modelo de nota">
                        <button type="button" class="note-template-choice selected" data-template="" onclick="Notes.selectCreateTemplate(this)"><b>✦</b><span>Em branco</span></button>
                        <button type="button" class="note-template-choice" data-template="estudo" onclick="Notes.selectCreateTemplate(this)"><b>📖</b><span>Estudo</span></button>
                        <button type="button" class="note-template-choice" data-template="reuniao" onclick="Notes.selectCreateTemplate(this)"><b>👥</b><span>Reunião</span></button>
                        <button type="button" class="note-template-choice" data-template="projeto" onclick="Notes.selectCreateTemplate(this)"><b>🔧</b><span>Projeto</span></button>
                        <button type="button" class="note-template-choice" data-template="diario" onclick="Notes.selectCreateTemplate(this)"><b>☀️</b><span>Diário</span></button>
                    </div>
                    <select id="nt-new-template" class="note-template-select" aria-label="Modelo de nota">
                        <option value="">Em branco</option>
                        <option value="estudo">📖 Estudo</option><option value="reuniao">👥 Reunião</option><option value="projeto">🔧 Projeto</option><option value="diario">☀️ Diário</option>
                        ${customTemplates.map(t => `<option value="custom:${t.id}">📋 ${App.escapeHtml(t.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Pasta</label><select id="nt-new-folder">${folders.map(f => `<option value="${f.id}">${f.icon} ${f.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Data do evento / timeline</label><input type="date" id="nt-new-event-date"></div>
                </div>
                ${this._renderCatChips([], 'nt-new')}
                <div class="form-actions" style="margin-top: 15px;"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Criar</button></div>
            </form>
        `);
    },

    selectCreateTemplate(button) {
        document.querySelectorAll('.note-template-choice').forEach(item => item.classList.toggle('selected', item === button));
        const select = document.getElementById('nt-new-template');
        if (select) select.value = button.dataset.template || '';
    },

    createFromModal(e) {
        e.preventDefault();
        const templateVal = document.getElementById('nt-new-template')?.value || '';
        let initialContent = '';
        if (templateVal) {
            if (templateVal.startsWith('custom:')) {
                const tplId = templateVal.replace('custom:', '');
                const tpl = Storage.getCustomTemplates ? Storage.getCustomTemplates().find(t => t.id === tplId) : null;
                if (tpl) initialContent = tpl.content || '';
            } else {
                const stdTemplates = {
                    estudo: `<h2>📖 Tópico de Estudo</h2><p><strong>Objetivo:</strong> </p><hr><h3>🧠 Conceitos-Chave</h3><ul><li>Conceito 1: Explicação</li></ul><h3>📝 Notas & Exemplos</h3><p></p><h3>❓ Dúvidas / Próximos Passos</h3><ul><li></li></ul>`,
                    reuniao: `<h2>👥 Ata de Reunião</h2><p><strong>Data:</strong>  | <strong>Participantes:</strong> </p><hr><h3>📋 Pauta</h3><p></p><h3>💬 Discussão & Decisões</h3><ul><li></li></ul><h3>⚡ Ações & Responsáveis</h3><ul><li>[ ] Tarefa 1 - Responsável</li></ul>`,
                    projeto: `<h2>🔧 Planejamento de Projeto</h2><p><strong>Status:</strong> Em Planejamento | <strong>Prazo:</strong> </p><hr><h3>🎯 Metas & Escopo</h3><p></p><h3>📅 Cronograma / Etapas</h3><ul><li>[ ] Fase 1: </li></ul><h3>⚠️ Riscos & Impedimentos</h3><p></p>`,
                    diario: `<h2>☀️ Diário Pessoal</h2><p><strong>Data:</strong> </p><hr><h3>💭 Como foi o dia?</h3><p></p><h3>🌟 Três coisas pelas quais sou grato:</h3><ol><li></li><li></li><li></li></ol><h3>🎯 Foco para amanhã:</h3><p></p>`
                };
                initialContent = stdTemplates[templateVal] || '';
            }
        }

        const note = Storage.addNote({
            title: document.getElementById('nt-new-title').value.trim(),
            content: initialContent,
            categoryIds: this.getSelectedCatIds('nt-new'),
            folderId: document.getElementById('nt-new-folder').value,
            eventDate: document.getElementById('nt-new-event-date')?.value || ''
        });
        App.closeModal();
        this.init();
        this.openEditor(note.id);
        App.toast('Nota criada com sucesso!', 'success');
    },

    openEditor(id) {
        const note = Storage.getNotes().find(n => n.id === id);
        if (!note) return;
        this.editingId = id;
        const cats = Storage.getNtCategories();
        const folders = Storage.getNtFolders();
        const editorArea = document.getElementById('note-editor-area');
        const readonlyPrivate = Boolean(note.isPrivate);
        this.markdownMode = !readonlyPrivate && Boolean(Storage.getSettings().pureMarkdownDefault);

        // Multi-category chips for editor
        const editorCatsHtml = cats.map(c =>
            `<button type="button" class="cat-chip ${(note.categoryIds || []).includes(c.id) ? 'selected' : ''}" data-cat-id="${c.id}" style="--cat-color:${c.color}" ${readonlyPrivate ? 'disabled' : 'onclick="Notes.toggleCatChip(this);Notes.autoSave()"'}>${c.icon} ${c.name}</button>`
        ).join('');

        let lpContent = '';
        if (!this.markdownMode) {
            if (!readonlyPrivate) {
                const lines = this.htmlToMd(note.content || '').split('\n');
                lpContent = lines.map(line => this.renderLpLine(line)).join('');
                if (!lpContent) lpContent = this.renderLpLine('');
            } else {
                lpContent = UI.sanitizeHtml(note.content || '<p>Comece a escrever...</p>');
            }
        }
        const isZen = document.body.classList.contains('is-focus-mode');
        const zenBtnHtml = `<button class="btn btn-sm btn-secondary btn-zen-mode ${isZen ? 'active' : ''}" onclick="Notes.toggleZenMode()" title="Modo Zen Hyper-Focus" style="background: rgba(0, 150, 136, 0.15); color: #009688;"><i class="${isZen ? 'fas fa-eye-slash' : 'fas fa-eye'}"></i> ${isZen ? 'Sair Foco' : 'Modo Zen'}</button>`;

        editorArea.innerHTML = `
            <div class="editor-header">
                <input type="text" id="editor-title" class="editor-title-input" value="${this.escapeHtml(note.title)}" placeholder="Título da nota" onchange="Notes.autoSave()" ${readonlyPrivate ? 'readonly' : ''}>
                <div class="editor-meta-bar">
                    <div class="cat-chips compact" id="editor-cats">${editorCatsHtml}</div>
                    <select id="editor-folder" onchange="Notes.autoSave()" ${readonlyPrivate ? 'disabled' : ''}>${folders.map(f => `<option value="${f.id}" ${note.folderId === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}</select>
                    <label class="editor-date-field">Timeline <input type="date" id="editor-event-date" value="${this.escapeHtml((note.eventDate || '').slice(0, 10))}" onchange="Notes.autoSave()" ${readonlyPrivate ? 'disabled' : ''}></label>
                    <div class="editor-export-group">
                        ${zenBtnHtml}
                        <button class="btn btn-sm btn-secondary" onclick="Notes.toggleTimeMachine()" style="background: rgba(124, 77, 255, 0.15); color: var(--accent);"><i class="fas fa-history"></i> ⌛ Histórico</button>
                        <button class="btn btn-sm btn-secondary" onclick="Notes.exportAs('txt','${id}')">TXT</button>
                        <button class="btn btn-sm btn-secondary" onclick="Notes.exportAs('html','${id}')">HTML</button>
                        <button class="btn btn-sm btn-secondary" onclick="Notes.exportAs('md','${id}')">MD</button>
                    </div>
                </div>
            </div>
            ${readonlyPrivate ? '<div class="private-readonly-banner">Nota privada aberta em modo leitura. Para editar com seguranca, torne publica ou use uma edicao criptografada dedicada em uma proxima melhoria.</div>' : ''}
            <div class="editor-toolbar" id="editor-toolbar">
                <button onclick="Notes.execCmd('bold')" title="Negrito (Ctrl+B)"><b>B</b></button>
                <button onclick="Notes.execCmd('italic')" title="Itálico (Ctrl+I)"><i>I</i></button>
                <button onclick="Notes.execCmd('underline')" title="Sublinhado (Ctrl+U)"><u>U</u></button>
                <button onclick="Notes.execCmd('strikeThrough')" title="Tachado"><s>S</s></button>
                <span class="toolbar-sep"></span>
                <button onclick="Notes.execCmd('formatBlock','<h1>')" title="Título 1">H1</button>
                <button onclick="Notes.execCmd('formatBlock','<h2>')" title="Título 2">H2</button>
                <button onclick="Notes.execCmd('formatBlock','<h3>')" title="Título 3">H3</button>
                <button onclick="Notes.execCmd('formatBlock','<p>')" title="Parágrafo">P</button>
                <span class="toolbar-sep"></span>
                <button onclick="Notes.execCmd('insertUnorderedList')" title="Lista">?</button>
                <button onclick="Notes.execCmd('insertOrderedList')" title="Lista numerada">1.</button>
                <button onclick="Notes.insertTaskItem()" title="Checklist">?</button>
                <button onclick="Notes.execCmd('indent')" title="Indentar">?</button>
                <button onclick="Notes.execCmd('outdent')" title="Desindentar">?</button>
                <span class="toolbar-sep"></span>
                <button onclick="Notes.execCmd('justifyLeft')" title="Esquerda">L</button>
                <button onclick="Notes.execCmd('justifyCenter')" title="Centro">=</button>
                <button onclick="Notes.execCmd('justifyRight')" title="Direita">R</button>
                <span class="toolbar-sep"></span>
                <button onclick="Notes.insertLink()" title="Link">&#128279;</button>
                <button onclick="Notes.insertBookmarkLink()" title="Inserir bookmark">&#128278;</button>
                <button onclick="Notes.execCmd('removeFormat')" title="Limpar formatação">Tx</button>
                <span class="toolbar-sep"></span>
                <button class="toolbar-wide" onclick="Notes.toggleMarkdownMode()" title="Modo Markdown">MD</button>
                <button class="toolbar-wide" onclick="Notes.insertTable()" title="Tabela">Tbl</button>
                <button class="toolbar-wide" onclick="Notes.insertCodeBlock()" title="Code block">{ }</button>
                <button class="toolbar-wide" onclick="Notes.insertMermaidBlock()" title="Diagrama Mermaid">Diag</button>
                <button class="toolbar-wide" onclick="Notes.insertMarkmapBlock()" title="Mapa Mental">MindMap</button>
                <button class="toolbar-wide" onclick="Notes.insertQueryBlock()" title="Dataview Query">Qry</button>
                <button class="toolbar-wide" onclick="Notes.insertEmbed()" title="Embed">Embed</button>
                <button class="toolbar-wide" onclick="Notes.pickInlineImage()" title="Imagem inline">Img</button>
                <button class="toolbar-wide" onclick="Whiteboard.open()" title="Quadro Branco (Desenho)">🎨 Desenho</button>
                <span class="toolbar-sep"></span>
                <button class="toolbar-wide toolbar-ai-action" onclick="Notes.summarizeWithAi()" title="Resumir com IA">🤖 Resumir</button>
                <button class="toolbar-wide toolbar-ai-action" onclick="Notes.suggestTagsWithAi()" title="Sugerir Tags com IA">🏷️ Tags IA</button>
                <span class="toolbar-sep"></span>
                <input type="file" id="inline-image-input" accept="image/*" style="display:none" onchange="Notes.insertInlineImage(this.files[0])">
                <button onclick="Notes.insertEmoji()" title="Emoji" class="emoji-btn">?</button>
                <input type="color" id="editor-color" onchange="Notes.execCmd('foreColor',this.value)" title="Cor do texto" value="#ffffff" class="color-picker">
                <input type="color" id="editor-bg-color" onchange="Notes.execCmd('hiliteColor',this.value)" title="Cor de fundo" value="#7C4DFF" class="color-picker">
                <span class="toolbar-sep"></span>
                <select onchange="Notes.execCmd('fontSize',this.value);this.value=''" title="Tamanho">
                    <option value="" selected disabled>Tam.</option>
                    <option value="1">Pequeno</option>
                    <option value="3">Normal</option>
                    <option value="5">Grande</option>
                    <option value="7">Enorme</option>
                </select>
            </div>
            <div class="editor-body">
                <aside class="editor-toc" id="editor-toc"></aside>
                ${this.markdownMode
                    ? `<textarea id="editor-markdown" class="editor-markdown" oninput="Notes.autoSave()">${this.escapeHtml(this.htmlToMd(note.content || ''))}</textarea>`
                    : `<div class="editor-content ${readonlyPrivate ? 'readonly' : ''}" id="editor-content" contenteditable="${readonlyPrivate ? 'false' : 'true'}">${lpContent}</div>`}
                <div id="editor-time-machine" class="editor-time-machine" style="display: none;"></div>
            </div>
            <div class="editor-footer">
                <span class="char-count" id="char-count"></span>
                <span class="save-status" id="save-status">Salvo ✓</span>
            </div>
        `;

        this.updateCharCount();
        this.renderEditorToc();
        this.renderDynamicBlocks();
        this.renderList();

        if (!this.markdownMode && !readonlyPrivate) {
            this.initLivePreview(document.getElementById('editor-content'), readonlyPrivate);
        }

        const installMedia = () => {
            const contentEl = document.getElementById('editor-content');
            const mdEl = document.getElementById('editor-markdown');
            const editorEl = contentEl || mdEl;
            if (editorEl && typeof MediaManager !== 'undefined') {
                MediaManager.install(editorEl, (markdownTag) => {
                    if (this.markdownMode) {
                        const start = mdEl.selectionStart || mdEl.value.length;
                        mdEl.value = mdEl.value.slice(0, start) + '\n' + markdownTag + '\n' + mdEl.value.slice(start);
                        this.autoSave();
                    } else {
                        const selection = window.getSelection();
                        const activeLine = contentEl.querySelector('.lp-line.lp-active');
                        if (activeLine) {
                            const before = activeLine.textContent;
                            activeLine.textContent = before + '\n' + markdownTag;
                        } else {
                            this.execCmd('insertHTML', `<p>${markdownTag}</p>`);
                        }
                        this.autoSave();
                    }
                });
            }
        };
        setTimeout(installMedia, 100);

        (document.getElementById('editor-content') || document.getElementById('editor-markdown'))?.focus();
        document.dispatchEvent(new CustomEvent('booklist:note-opened', { detail: { id } }));
    },

    execCmd(cmd, value) {
        if (this.markdownMode) return;
        const contentEl = document.getElementById('editor-content');
        const activeLine = contentEl?.querySelector('.lp-line.lp-active');

        if (activeLine) {
            if (cmd === 'bold') {
                this.insertTextAtCursor('**', '**');
                return;
            }
            if (cmd === 'italic') {
                this.insertTextAtCursor('*', '*');
                return;
            }
            if (cmd === 'strikeThrough') {
                this.insertTextAtCursor('~~', '~~');
                return;
            }
            if (cmd === 'formatBlock') {
                let prefix = '';
                if (value === '<h1>') prefix = '# ';
                else if (value === '<h2>') prefix = '## ';
                else if (value === '<h3>') prefix = '### ';

                const currentText = activeLine.textContent.replace(/^#+\s+/, '');
                activeLine.textContent = prefix + currentText;
                this.autoSave();
                return;
            }
        }

        document.execCommand(cmd, false, value || null);
        contentEl?.focus();
        this.autoSave();
        this.renderEditorToc();
    },

    async insertLink() {
        if (this.markdownMode) return;
        const url = await BookListDialogs.prompt('URL do link', 'https://', { title: 'Inserir link', type: 'url' });
        if (url) { this.execCmd('createLink', url); }
    },

    async insertBookmarkLink() {
        if (this.markdownMode) return;
        const bookmarks = Storage.getBookmarks();
        if (!bookmarks.length) return App.toast('Nenhum bookmark salvo para inserir.', 'info');
        const options = bookmarks.slice(0, 50).map(b => ({ value: b.id, label: b.title }));
        const result = await BookListDialogs.open({ title: 'Inserir bookmark', description: 'Escolha um link da sua biblioteca.', fields: [{ name: 'id', label: 'Bookmark', type: 'select', options }], confirmText: 'Inserir' });
        const bk = bookmarks.find(item => item.id === result?.id);
        if (!bk) return;
        this.execCmd('insertHTML', `<a href="${this.escapeHtml(bk.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(bk.title)}</a>`);
    },

    insertTaskItem() {
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            const start = md.selectionStart || md.value.length;
            md.value = `${md.value.slice(0, start)}\n- [ ] Nova tarefa${md.value.slice(start)}`;
            md.focus();
            this.autoSave();
            return;
        }
        const contentEl = document.getElementById('editor-content');
        const activeLine = contentEl?.querySelector('.lp-line.lp-active');
        if (activeLine) {
            const currentText = activeLine.textContent.replace(/^([-*]?\s*\[[ x]\]|[-*])\s*/i, '');
            activeLine.textContent = '- [ ] ' + currentText;
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', '<p>- [ ] Nova tarefa</p>');
    },

    insertTable() {
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            md.setRangeText('\n| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n|  |  |  |\n', md.selectionStart, md.selectionEnd, 'end');
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', '<table><thead><tr><th>Coluna 1</th><th>Coluna 2</th><th>Coluna 3</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr></tbody></table><p></p>');
    },

    async insertCodeBlock() {
        const result = await BookListDialogs.open({ title: 'Inserir bloco de código', fields: [{ name: 'lang', label: 'Linguagem', value: 'javascript', placeholder: 'javascript, python, sql...' }, { name: 'code', label: 'Código', type: 'textarea', rows: 10, required: true }], confirmText: 'Inserir' });
        if (!result) return;
        const { code = '', lang = '' } = result;
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            md.setRangeText(`\n\`\`\`${lang}\n${code}\n\`\`\`\n`, md.selectionStart, md.selectionEnd, 'end');
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', `<pre class="code-block"><code data-lang="${this.escapeHtml(lang)}">${this.escapeHtml(code)}</code></pre><p></p>`);
    },

    insertMermaidBlock() {
        const sample = 'graph TD\\n  R[Roteador] --> S[Switch]\\n  S --> AP[Access Point]\\n  S --> PC[Computador]';
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            md.setRangeText(`\n\`\`\`mermaid\n${sample.replace(/\\n/g, '\n')}\n\`\`\`\n`, md.selectionStart, md.selectionEnd, 'end');
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', `<pre class="code-block"><code data-lang="mermaid">${this.escapeHtml(sample.replace(/\\n/g, '\n'))}</code></pre><p></p>`);
        this.renderMermaid();
    },

    insertMarkmapBlock() {
        const sample = '# Ideia Principal\\n## Tópico 1\\n- Detalhe A\\n- Detalhe B\\n## Tópico 2\\n- Detalhe C';
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            md.setRangeText(`\n\`\`\`markmap\n${sample.replace(/\\n/g, '\n')}\n\`\`\`\n`, md.selectionStart, md.selectionEnd, 'end');
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', `<pre class="code-block"><code data-lang="markmap">${this.escapeHtml(sample.replace(/\\n/g, '\n'))}</code></pre><p></p>`);
        if (typeof MarkmapLite !== 'undefined') MarkmapLite.renderAll();
    },

    insertQueryBlock() {
        const sample = 'MOSTRAR tickets ONDE status = aberto';
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (!md) return;
            md.setRangeText(`\n\`\`\`query\n${sample}\n\`\`\`\n`, md.selectionStart, md.selectionEnd, 'end');
            this.autoSave();
            return;
        }
        this.execCmd('insertHTML', `<pre class="code-block"><code data-lang="query">${this.escapeHtml(sample)}</code></pre><p></p>`);
        this.renderQueryViews();
    },

    async insertEmbed() {
        const url = await BookListDialogs.prompt('URL do YouTube, X/Twitter ou PDF', 'https://', { title: 'Incorporar conteúdo', type: 'url' });
        if (!url) return;
        let html = `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(url)}</a>`;
        if (/youtube\.com|youtu\.be/.test(url)) {
            const id = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/)?.[1];
            if (id) html = `<iframe class="note-embed" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>`;
        } else if (/\.pdf($|\?)/i.test(url)) {
            html = `<object class="note-embed pdf" data="${this.escapeHtml(url)}" type="application/pdf"><a href="${this.escapeHtml(url)}">Abrir PDF</a></object>`;
        } else if (/twitter\.com|x\.com/.test(url)) {
            html = `<blockquote class="note-embed social"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(url)}</a></blockquote>`;
        }
        this.execCmd('insertHTML', `${html}<p></p>`);
    },

    pickInlineImage() {
        if (this.markdownMode) return App.toast('Insira imagens no modo visual.', 'info');
        document.getElementById('inline-image-input')?.click();
    },

    async insertInlineImage(file) {
        if (!file) return;
        if (file.size > 1024 * 1024 * 2 && !await BookListDialogs.confirm('Imagem maior que 2MB pode pesar no pendrive/sync. Inserir mesmo assim?', { title: 'Imagem grande', confirmText: 'Inserir' })) return;
        const reader = new FileReader();
        reader.onload = () => this.execCmd('insertHTML', `<img class="note-inline-image" src="${reader.result}" alt="${this.escapeHtml(file.name)}"><p></p>`);
        reader.readAsDataURL(file);
    },

    renderEditorToc() {
        const toc = document.getElementById('editor-toc');
        const content = document.getElementById('editor-content');
        if (!toc || !content || this.markdownMode) return;
        const headings = Array.from(content.querySelectorAll('h1,h2,h3')).map((h, index) => {
            if (!h.id) h.id = `note-heading-${index}`;
            return { id: h.id, depth: Number(h.tagName.slice(1)), text: h.textContent.trim() };
        }).filter(h => h.text);
        if (!headings.length) {
            toc.innerHTML = '<span class="text-muted">Sem indice</span>';
            return;
        }
        toc.innerHTML = `<strong>Indice</strong>${headings.map(h => `<button class="toc-item depth-${h.depth}" onclick="document.getElementById('${h.id}')?.scrollIntoView({behavior:'smooth',block:'start'})">${this.escapeHtml(h.text)}</button>`).join('')}`;
    },

    toggleMarkdownMode() {
        const editorArea = document.getElementById('note-editor-area');
        const content = document.getElementById('editor-content');
        const md = document.getElementById('editor-markdown');
        if (!editorArea || (!content && !md)) return;
        this.markdownMode = !this.markdownMode;
        if (this.markdownMode) {
            const html = this.cleanEditorHtml();
            content.outerHTML = `<textarea id="editor-markdown" class="editor-markdown" oninput="Notes.autoSave()">${this.escapeHtml(this.htmlToMd(html))}</textarea>`;
            const toc = document.getElementById('editor-toc');
            if (toc) toc.innerHTML = '<span class="text-muted">Indice volta no modo visual</span>';
            document.getElementById('editor-markdown').focus();
        } else {
            const markdown = md?.value || '';
            const lines = markdown.split('\n');
            const contentHtml = lines.map(line => this.renderLpLine(line)).join('');
            md.outerHTML = `<div class="editor-content" id="editor-content" contenteditable="true">${contentHtml || this.renderLpLine('')}</div>`;
            const contentEl = document.getElementById('editor-content');
            this.initLivePreview(contentEl, false);
            contentEl.focus();
            this.renderEditorToc();
            this.renderDynamicBlocks();
        }
        this.autoSave();
    },

    insertEmoji() {
        const emojis = ['\u{1F600}','\u{1F525}','\u2B50','\u{1F4DA}','\u{1F4DD}','\u{1F516}','\u{1F4A1}','\u2705','\u26A1','\u{1F3AF}','\u{1F9E0}','\u{1F680}','\u{1F517}','\u{1F4CC}','\u{1F4C1}','\u{1F4AC}'];
        const emojiPicker = document.createElement('div');
        emojiPicker.className = 'emoji-picker';
        emojiPicker.innerHTML = emojis.map(e => `<button class="emoji-item" onclick="Notes.execCmd('insertText','${e}');this.parentElement.remove()">${e}</button>`).join('');
        const toolbar = document.getElementById('editor-toolbar');
        const existing = toolbar.querySelector('.emoji-picker');
        if (existing) { existing.remove(); return; }
        toolbar.appendChild(emojiPicker);
        setTimeout(() => { document.addEventListener('click', function handler(e) { if (!emojiPicker.contains(e.target)) { emojiPicker.remove(); document.removeEventListener('click', handler); } }, { once: false }); }, 100);
    },

    autoSave() {
        if (!this.editingId) return;
        clearTimeout(this._saveTimeout);
        const statusEl = document.getElementById('save-status');
        const current = Storage.getNotes({ includePrivate: true }).find(n => n.id === this.editingId);
        if (current?.isPrivate) {
            if (statusEl) statusEl.textContent = 'Somente leitura';
            return;
        }
        if (statusEl) statusEl.textContent = 'Salvando...';
        this._saveTimeout = setTimeout(() => {
            const title = document.getElementById('editor-title')?.value.trim() || 'Sem título';
            const content = this.markdownMode
                ? this.mdToHtml(document.getElementById('editor-markdown')?.value || '')
                : this.cleanEditorHtml();
            const folderId = document.getElementById('editor-folder')?.value;
            const eventDate = document.getElementById('editor-event-date')?.value || '';
            // Get multi-cat from editor chips
            const catChips = document.querySelectorAll('#editor-cats .cat-chip.selected');
            const categoryIds = Array.from(catChips).map(c => c.dataset.catId);
            Storage.updateNote(this.editingId, { title, content, categoryIds, folderId, eventDate });
            if (statusEl) statusEl.textContent = 'Salvo ✓';
            this.updateCharCount();
            this.renderList();
            this.renderFolderSidebar();
        }, 500);
    },

    updateCharCount() {
        const el = document.getElementById('editor-content');
        const md = document.getElementById('editor-markdown');
        const counter = document.getElementById('char-count');
        if ((el || md) && counter) {
            const text = md ? md.value : (el.innerText || '');
            const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            counter.textContent = `${text.length} caracteres · ${words} palavras`;
        }
    },

    renderMermaid() {
        MermaidLite.renderAll(document.getElementById('editor-content') || document);
    },

    renderWikiLinks() {
        WikiLinks.renderAll(document.getElementById('editor-content') || document);
    },

    renderQueryViews() {
        QueryView.renderAll(document.getElementById('editor-content') || document);
    },

    renderDynamicBlocks() {
        const root = document.getElementById('editor-content') || document;
        MermaidLite.renderAll(root);
        QueryView.renderAll(root);
        WikiLinks.renderAll(root);
        if (typeof MarkmapLite !== 'undefined') MarkmapLite.renderAll(root);
    },

    renderDynamicBlocksDebounced() {
        clearTimeout(this._dynamicBlocksTimeout);
        this._dynamicBlocksTimeout = setTimeout(() => this.renderDynamicBlocks(), 350);
    },

    cleanEditorHtml() {
        const el = document.getElementById('editor-content');
        if (!el) return '';

        const lines = el.querySelectorAll('.lp-line');
        if (!lines.length) return UI.sanitizeHtml(el.innerHTML || '');

        const mdLines = [];
        lines.forEach(line => {
            if (line.classList.contains('lp-active')) {
                mdLines.push(line.textContent);
            } else {
                mdLines.push(line.getAttribute('data-raw') || '');
            }
        });

        const markdown = mdLines.join('\n');
        const compiledHtml = this.mdToHtml(markdown);

        const temp = document.createElement('div');
        temp.innerHTML = compiledHtml;

        MermaidLite.stripGenerated(temp);
        WikiLinks.stripGenerated(temp);
        QueryView.stripGenerated(temp);
        if (typeof MarkmapLite !== 'undefined') MarkmapLite.stripGenerated(temp);

        return UI.sanitizeHtml(temp.innerHTML || '');
    },

    togglePin(id) {
        const n = Storage.getNotes().find(x => x.id === id);
        if (n) { Storage.updateNote(id, { pinned: !n.pinned }); this.init(); }
    },

    delete(id) {
        App.confirmAction('Deseja apagar esta nota?', () => {
        const trash = Storage.deleteNote(id);
        if (this.editingId === id) {
            this.editingId = null;
            const editorArea = document.getElementById('note-editor-area');
            if (editorArea) editorArea.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128221;</div><h3>Selecione uma nota</h3><p>Ou crie uma nova para começar!</p></div>`;
        }
        this.init();
        App.toast('Nota movida para a lixeira.', 'info', trash ? {
            label: 'Desfazer',
            onClick: () => {
                Storage.restoreTrashItem(trash.id);
                Notes.init();
                App.toast('Nota restaurada!', 'success');
            }
        } : null);
        }, { title: 'Apagar nota', confirmText: 'Apagar', danger: true });
    },

    exportAs(format, id) {
        const note = Storage.getNotes().find(n => n.id === id);
        if (!note) return;
        let content, ext, type;
        switch (format) {
            case 'txt':
                content = `${note.title}\n${'='.repeat(note.title.length)}\n\n${this.stripHtml(note.content || '')}`;
                ext = 'txt'; type = 'text/plain'; break;
            case 'html':
                content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escapeHtml(note.title)}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333;line-height:1.6}h1{border-bottom:2px solid #7C4DFF;padding-bottom:10px}</style></head><body><h1>${this.escapeHtml(note.title)}</h1>${UI.sanitizeHtml(note.content || '')}<footer><p><small>Exportado em ${new Date().toLocaleString('pt-BR')}</small></p></footer></body></html>`;
                ext = 'html'; type = 'text/html'; break;
            case 'md':
                content = `# ${note.title}\n\n${this.htmlToMd(note.content || '')}\n\n---\n*Exportado em ${new Date().toLocaleString('pt-BR')}*`;
                ext = 'md'; type = 'text/markdown'; break;
        }
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${note.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        a.click(); URL.revokeObjectURL(url);
        App.toast(`Nota exportada como ${format.toUpperCase()}!`, 'success');
    },

    exportFiltered() {
        const items = this.getFiltered();
        const blob = new Blob([JSON.stringify({ type: 'notes', exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booklist_notes_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        App.toast(`${items.length} nota(s) exportadas.`, 'success');
    },

    stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; },

    htmlToMd(html) {
        return html
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
            .replace(/<img[^>]+data-media-ref="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
            .replace(/<img[^>]+alt="([^"]*)"[^>]+data-media-ref="([^"]*)"[^>]*>/gi, '![$1]($2)')
            .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
            .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)')
            .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<[^>]+>/g, '');
    },

    mdToHtml(md) {
        const codeBlocks = [];
        let safe = this.escapeHtml(md).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const token = `@@CODE${codeBlocks.length}@@`;
            codeBlocks.push(`<pre class="code-block"><code data-lang="${lang || ''}">${code}</code></pre>`);
            return token;
        });
        safe = safe.replace(/((?:^\|.*\|\n?)+)/gm, block => {
            const lines = block.trim().split('\n').filter(line => !/^\|\s*-/.test(line));
            if (lines.length < 2) return block;
            const rows = lines.map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
            return `<table><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        });
        safe = safe
            .replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
                const resolvedUrl = (url.startsWith('media:') && typeof MediaManager !== 'undefined') ? MediaManager.resolveMediaUrlSync(url) : url;
                return `<img class="note-inline-image" data-media-ref="${url}" src="${resolvedUrl}" alt="${alt}">`;
            })
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/^- (.*)$/gm, '<li>$1</li>')
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/s, '<p>$1</p>')
            .replace(/<p><h/g, '<h')
            .replace(/<\/h([1-3])><\/p>/g, '</h$1>');
        codeBlocks.forEach((html, i) => safe = safe.replace(`@@CODE${i}@@`, html));
        return safe;
    },

    renderLpLine(lineText) {
        let tag = 'p';
        let raw = lineText;
        let cleanText = lineText;
        let prefixSyntax = '';

        if (lineText.startsWith('# ')) {
            tag = 'h1';
            prefixSyntax = '# ';
            cleanText = lineText.substring(2);
        } else if (lineText.startsWith('## ')) {
            tag = 'h2';
            prefixSyntax = '## ';
            cleanText = lineText.substring(3);
        } else if (lineText.startsWith('### ')) {
            tag = 'h3';
            prefixSyntax = '### ';
            cleanText = lineText.substring(4);
        } else if (lineText.startsWith('- [ ] ') || lineText.startsWith('- [x] ')) {
            tag = 'div';
            const checked = lineText.startsWith('- [x] ');
            prefixSyntax = checked ? '- [x] ' : '- [ ] ';
            const itemText = lineText.substring(6);
            const parsedInner = this.parseInlineLp(itemText);
            const checkboxHtml = `<input type="checkbox" class="lp-task-check" ${checked ? 'checked' : ''} onchange="Notes.toggleLpTask(this)">`;
            const textContentHtml = checked ? `<s>${parsedInner}</s>` : parsedInner;
            return `<div class="lp-line" data-raw="${this.escapeHtml(raw)}"><span class="lp-syntax">${prefixSyntax}</span>${checkboxHtml}${textContentHtml}</div>`;
        } else if (lineText.startsWith('- ')) {
            tag = 'div';
            prefixSyntax = '- ';
            cleanText = lineText.substring(2);
        }

        const parsedInner = this.parseInlineLp(cleanText);
        const syntaxPrefixHtml = prefixSyntax ? `<span class="lp-syntax">${prefixSyntax}</span>` : '';
        return `<${tag} class="lp-line" data-raw="${this.escapeHtml(raw)}">${syntaxPrefixHtml}${parsedInner}</${tag}>`;
    },

    parseInlineLp(text) {
        let html = this.escapeHtml(text);
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
            const resolvedUrl = (url.startsWith('media:') && typeof MediaManager !== 'undefined') ? MediaManager.resolveMediaUrlSync(url) : url;
            return `<span class="lp-syntax">![</span><img class="note-inline-image" data-media-ref="${url}" src="${resolvedUrl}" alt="${alt}" style="max-width:100%; border-radius: 8px;" /><span class="lp-syntax">](${url})</span>`;
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<span class="lp-syntax">**</span><strong>$1</strong><span class="lp-syntax">**</span>');
        html = html.replace(/\*(.*?)\*/g, '<span class="lp-syntax">*</span><em>$1</em><span class="lp-syntax">*</span>');
        html = html.replace(/~~(.*?)~~/g, '<span class="lp-syntax">~~</span><s>$1</s><span class="lp-syntax">~~</span>');
        html = html.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<span class="lp-syntax">[</span><a href="$2" target="_blank" rel="noopener noreferrer">$1</a><span class="lp-syntax">]($2)</span>');
        return html;
    },

    initLivePreview(contentEl, readonlyPrivate) {
        if (readonlyPrivate || !contentEl) return;
        
        let currentActiveLine = null;
        
        const updateActiveLine = () => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            let node = selection.anchorNode;
            
            while (node && node !== contentEl) {
                if (node.classList && node.classList.contains('lp-line')) {
                    break;
                }
                node = node.parentNode;
            }
            
            if (node && node.classList && node.classList.contains('lp-line')) {
                if (currentActiveLine === node) return;
                
                if (currentActiveLine && contentEl.contains(currentActiveLine)) {
                    const rawText = currentActiveLine.textContent;
                    const renderedHtml = this.renderLpLine(rawText);
                    const temp = document.createElement('div');
                    temp.innerHTML = renderedHtml;
                    const renderedNode = temp.firstChild;
                    currentActiveLine.replaceWith(renderedNode);
                }
                
                currentActiveLine = node;
                currentActiveLine.classList.add('lp-active');
                const rawText = currentActiveLine.getAttribute('data-raw') || currentActiveLine.textContent;
                const caretOffset = selection.anchorOffset;
                currentActiveLine.textContent = rawText;
                currentActiveLine.removeAttribute('data-raw');
                
                const range = document.createRange();
                if (currentActiveLine.firstChild) {
                    const newOffset = Math.min(caretOffset, currentActiveLine.firstChild.length);
                    range.setStart(currentActiveLine.firstChild, newOffset);
                } else {
                    range.setStart(currentActiveLine, 0);
                }
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };

        contentEl.addEventListener('click', () => {
            updateActiveLine();
        });

        contentEl.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                updateActiveLine();
            }
            this.updateCharCount();
        });
        
        contentEl.addEventListener('keydown', (e) => {
            const selection = window.getSelection();
            
            if (e.key === 'Enter') {
                e.preventDefault();
                const activeLine = contentEl.querySelector('.lp-line.lp-active');
                if (!activeLine) return;
                
                const offset = selection.anchorOffset;
                const text = activeLine.textContent;
                const before = text.substring(0, offset);
                const after = text.substring(offset);
                
                activeLine.textContent = before;
                activeLine.setAttribute('data-raw', before);
                const renderedBefore = this.renderLpLine(before);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderedBefore;
                const newActiveLine = tempDiv.firstChild;
                activeLine.replaceWith(newActiveLine);
                
                const newLineHtml = this.renderLpLine(after);
                tempDiv.innerHTML = newLineHtml;
                const newLineNode = tempDiv.firstChild;
                
                newActiveLine.after(newLineNode);
                
                newLineNode.classList.add('lp-active');
                newLineNode.textContent = after;
                currentActiveLine = newLineNode;
                
                const range = document.createRange();
                range.setStart(newLineNode, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                this.autoSave();
            }
            
            if (e.key === 'Backspace' && selection.anchorOffset === 0) {
                const activeLine = contentEl.querySelector('.lp-line.lp-active');
                if (!activeLine) return;
                const prevLine = activeLine.previousElementSibling;
                if (prevLine && prevLine.classList.contains('lp-line')) {
                    e.preventDefault();
                    const prevRaw = prevLine.getAttribute('data-raw') || prevLine.textContent;
                    const currentRaw = activeLine.textContent;
                    const mergedText = prevRaw + currentRaw;
                    
                    prevLine.textContent = mergedText;
                    prevLine.classList.add('lp-active');
                    prevLine.removeAttribute('data-raw');
                    currentActiveLine = prevLine;
                    
                    activeLine.remove();
                    
                    const range = document.createRange();
                    if (prevLine.firstChild) {
                        range.setStart(prevLine.firstChild, prevRaw.length);
                    } else {
                        range.setStart(prevLine, 0);
                    }
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    this.autoSave();
                }
            }
        });
        
        contentEl.addEventListener('blur', () => {
            const activeLine = contentEl.querySelector('.lp-line.lp-active');
            if (activeLine) {
                const rawText = activeLine.textContent;
                const renderedHtml = this.renderLpLine(rawText);
                const temp = document.createElement('div');
                temp.innerHTML = renderedHtml;
                const renderedNode = temp.firstChild;
                activeLine.replaceWith(renderedNode);
                currentActiveLine = null;
            }
        });
    },

    toggleLpTask(checkbox) {
        const lineNode = checkbox.closest('.lp-line');
        if (!lineNode) return;
        const checked = checkbox.checked;
        let raw = lineNode.getAttribute('data-raw') || '';
        if (checked) {
            raw = raw.replace(/^-\s*\[\s*\]/, '- [x]');
            if (typeof window.SoundEffects !== 'undefined') {
                window.SoundEffects.playComplete();
            }
        } else {
            raw = raw.replace(/^-\s*\[x\]/i, '- [ ]');
        }
        lineNode.setAttribute('data-raw', raw);
        
        const renderedHtml = this.renderLpLine(raw);
        const temp = document.createElement('div');
        temp.innerHTML = renderedHtml;
        const renderedNode = temp.firstChild;
        lineNode.replaceWith(renderedNode);
        
        this.autoSave();
    },

    insertTextAtCursor(textBefore, textAfter = '') {
        const contentEl = document.getElementById('editor-content');
        if (!contentEl) return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        
        const activeLine = contentEl.querySelector('.lp-line.lp-active');
        if (!activeLine) return;
        
        const selectedText = selection.toString();
        const replacement = textBefore + selectedText + textAfter;
        
        range.deleteContents();
        const textNode = document.createTextNode(replacement);
        range.insertNode(textNode);
        
        range.setStart(textNode, textBefore.length);
        range.setEnd(textNode, textBefore.length + selectedText.length);
        selection.removeAllRanges();
        selection.addRange(range);
        
        this.autoSave();
    },

    formatDate(iso) { return UI.relativeTime(iso) || new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; },

    summarizeWithAi() {
        if (!this.editingId) return;
        const title = document.getElementById('editor-title')?.value.trim() || 'Sem título';
        const content = this.markdownMode
            ? (document.getElementById('editor-markdown')?.value || '')
            : this.cleanEditorHtml();

        const rawText = this.stripHtml(content);
        if (rawText.trim().length < 30) {
            return App.toast('Texto muito curto para ser resumido por IA.', 'info');
        }

        App.toast('Gerando resumo local...', 'info');
        
        // Wait a tiny bit so the toast renders
        setTimeout(() => {
            try {
                const summary = WebAI.summarize(rawText);
                App.showModal('Resumo com IA', `
                    <div class="ai-summary-modal" style="padding: 10px 0;">
                        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: var(--text-main); background: var(--bg-hover); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent);">${this.escapeHtml(summary)}</p>
                        <div class="form-actions" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${this.escapeJs(summary)}');App.toast('Copiado para o clipboard!','success');">📋 Copiar</button>
                            <button class="btn btn-primary" onclick="Notes.insertSummaryAtStart('${this.escapeJs(summary)}');App.closeModal();">✍️ Inserir no Início</button>
                            <button class="btn btn-secondary" onclick="App.closeModal()">Fechar</button>
                        </div>
                    </div>
                `);
            } catch (err) {
                App.toast('Erro na sumarização: ' + err.message, 'error');
            }
        }, 100);
    },

    insertSummaryAtStart(summary) {
        const textToInsert = `**Resumo IA:** ${summary}\n\n`;
        if (this.markdownMode) {
            const md = document.getElementById('editor-markdown');
            if (md) {
                md.value = textToInsert + md.value;
                this.autoSave();
            }
        } else {
            const contentEl = document.getElementById('editor-content');
            if (contentEl) {
                const newHtml = this.renderLpLine(`**Resumo IA:** ${summary}`);
                const spacerHtml = this.renderLpLine('');
                const temp = document.createElement('div');
                
                temp.innerHTML = newHtml;
                const summaryNode = temp.firstChild;
                
                temp.innerHTML = spacerHtml;
                const spacerNode = temp.firstChild;
                
                const firstLine = contentEl.querySelector('.lp-line');
                if (firstLine) {
                    firstLine.before(summaryNode);
                    summaryNode.after(spacerNode);
                } else {
                    contentEl.appendChild(summaryNode);
                    contentEl.appendChild(spacerNode);
                }
                this.autoSave();
            }
        }
        App.toast('Resumo inserido com sucesso!', 'success');
    },

    suggestTagsWithAi() {
        if (!this.editingId) return;
        const title = document.getElementById('editor-title')?.value.trim() || 'Sem título';
        const content = this.markdownMode
            ? (document.getElementById('editor-markdown')?.value || '')
            : this.cleanEditorHtml();

        const rawText = this.stripHtml(content);
        const suggestedTokens = WebAI.suggestTags(rawText, title);
        const cats = Storage.getNtCategories();
        
        let matchedCount = 0;
        cats.forEach(c => {
            const catTokens = WebAI.tokenize(c.name);
            const matches = catTokens.some(ct => suggestedTokens.includes(ct));
            const matchesSubstring = suggestedTokens.some(st => c.name.toLowerCase().includes(st));
            if (matches || matchesSubstring) {
                const chip = document.querySelector(`#editor-cats .cat-chip[data-cat-id="${c.id}"]`);
                if (chip) {
                    if (!chip.classList.contains('selected')) {
                        chip.classList.add('selected');
                        matchedCount++;
                    }
                }
            }
        });
        
        if (matchedCount > 0) {
            this.autoSave();
            App.toast(`${matchedCount} categoria(s) sugerida(s) e ativada(s)!`, 'success');
        } else {
            App.toast('Nenhuma categoria correspondente encontrada nos termos da nota.', 'info');
        }
    },

    escapeJs(str = '') {
        return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
    },

    toggleZenMode() {
        document.body.classList.toggle('is-focus-mode');
        if (window.SoundEffects) window.SoundEffects.playClick();
        
        const isZen = document.body.classList.contains('is-focus-mode');
        if (isZen && typeof Gamification !== 'undefined') {
            Gamification.awardZenFocus();
        }
        
        const btn = document.querySelector('.btn-zen-mode');
        if (btn) {
            btn.innerHTML = `<i class="${isZen ? 'fas fa-eye-slash' : 'fas fa-eye'}"></i> ${isZen ? 'Sair Foco' : 'Modo Zen'}`;
            btn.classList.toggle('active', isZen);
        }
    },

    toggleTimeMachine() {
        const el = document.getElementById('editor-time-machine');
        if (!el) return;
        if (el.style.display === 'none') {
            el.style.display = 'flex';
            this.renderTimeMachine();
        } else {
            el.style.display = 'none';
        }
    },

    renderTimeMachine() {
        const el = document.getElementById('editor-time-machine');
        if (!el) return;
        const note = Storage.getNotes().find(n => n.id === this.editingId);
        if (!note) return;
        const versions = note.versions || [];
        if (versions.length === 0) {
            el.innerHTML = `
                <div class="tm-header"><span>⌛ Linha do Tempo</span><button class="btn btn-sm btn-icon" onclick="Notes.toggleTimeMachine()">✕</button></div>
                <div class="tm-timeline" style="justify-content: center; align-items: center; color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
                    Nenhuma revisão anterior gravada. Versões são salvas a cada 45s de alterações.
                </div>`;
            return;
        }
        const versionsHtml = versions.map(v => {
            const dateStr = new Date(v.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' });
            return `
                <div class="tm-version-item" id="tm-version-${v.id}" onclick="Notes.previewVersion('${v.id}')">
                    <div class="tm-version-meta"><span>${dateStr}</span><span>v${versions.indexOf(v) + 1}</span></div>
                    <div class="tm-version-title">${this.escapeHtml(v.title || 'Sem Título')}</div>
                    <div class="tm-version-actions"><button class="btn btn-xs btn-primary" onclick="Notes.restoreVersion(event, '${v.id}')">Restaurar</button></div>
                </div>`;
        }).join('');
        el.innerHTML = `
            <div class="tm-header"><span>⌛ Linha do Tempo (${versions.length})</span><button class="btn btn-sm btn-icon" onclick="Notes.toggleTimeMachine()">✕</button></div>
            <div class="tm-timeline">${versionsHtml}</div>
            <div class="tm-preview-pane" id="tm-preview-pane">
                <div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding-top: 40px;">Selecione uma revisão para ver o Diff Git-Like</div>
            </div>`;
    },

    previewVersion(versionId) {
        const note = Storage.getNotes().find(n => n.id === this.editingId);
        if (!note || !note.versions) return;
        const version = note.versions.find(v => v.id === versionId);
        if (!version) return;
        document.querySelectorAll('.tm-version-item').forEach(item => item.classList.remove('active'));
        document.getElementById(`tm-version-${versionId}`)?.classList.add('active');
        const diffLines = (oldText, newText) => {
            const oldLines = oldText.split('\n');
            const newLines = newText.split('\n');
            const matrix = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
            for (let i = 1; i <= oldLines.length; i++) {
                for (let j = 1; j <= newLines.length; j++) {
                    if (oldLines[i - 1] === newLines[j - 1]) matrix[i][j] = matrix[i - 1][j - 1] + 1;
                    else matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
                }
            }
            let i = oldLines.length, j = newLines.length;
            const diff = [];
            while (i > 0 || j > 0) {
                if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) { diff.unshift({ type: 'normal', line: oldLines[i - 1] }); i--; j--; }
                else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) { diff.unshift({ type: 'added', line: newLines[j - 1] }); j--; }
                else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) { diff.unshift({ type: 'removed', line: oldLines[i - 1] }); i--; }
            }
            return diff;
        };
        const oldContentText = this.htmlToMd(version.content || '');
        const currentContentText = this.markdownMode ? (document.getElementById('editor-markdown')?.value || '') : this.htmlToMd(this.cleanEditorHtml() || '');
        const diff = diffLines(oldContentText, currentContentText);
        const previewPane = document.getElementById('tm-preview-pane');
        if (previewPane) {
            previewPane.innerHTML = diff.length === 0 
                ? '<div style="color: var(--text-muted); text-align: center; padding-top: 40px;">Sem alterações.</div>' 
                : diff.map(p => `<div class="diff-line diff-${p.type === 'added' ? 'added' : p.type === 'removed' ? 'removed' : 'normal'}">${p.type === 'added' ? '+' : p.type === 'removed' ? '-' : ' '} ${this.escapeHtml(p.line)}</div>`).join('');
        }
    },

    restoreVersion(event, versionId) {
        if (event) event.stopPropagation();
        const note = Storage.getNotes().find(n => n.id === this.editingId);
        if (!note || !note.versions) return;
        const version = note.versions.find(v => v.id === versionId);
        if (!version) return;
        App.confirmAction(`Deseja restaurar esta versão gravada em ${new Date(version.createdAt).toLocaleString('pt-BR')}? Isso sobrescreverá o editor.`, () => {
            const titleInput = document.getElementById('editor-title');
            if (titleInput) titleInput.value = version.title || 'Sem Título';
            if (this.markdownMode) {
                const mdText = this.htmlToMd(version.content || '');
                const markdownEl = document.getElementById('editor-markdown');
                if (markdownEl) markdownEl.value = mdText;
            } else {
                const contentEl = document.getElementById('editor-content');
                if (contentEl) {
                    const lines = this.htmlToMd(version.content || '').split('\n');
                    const lpContent = lines.map(line => this.renderLpLine(line)).join('');
                    contentEl.innerHTML = lpContent || this.renderLpLine('');
                }
            }
            this.autoSave();
            App.toast('Versão restaurada com sucesso!', 'success');
            this.toggleTimeMachine();
        });
    },

    showTemplatesModal() {
        const customTemplates = Storage.getCustomTemplates ? Storage.getCustomTemplates() : [];
        App.showModal('Modelos de Nota', `
            ${App.modalContextHtml({
                icon: '📋',
                title: 'Modelos de Nota',
                description: 'Gerencie seus modelos de notas customizados para estruturar seus pensamentos e fluxos de trabalho.',
                meta: ['Power Templates', 'Notas local-first'],
                tone: 'notes'
            })}
            <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Modelos Customizados</h4>
                <button class="btn btn-primary btn-sm" onclick="Notes.showCreateTemplateForm()">+ Novo Modelo</button>
            </div>
            <div class="custom-templates-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: var(--bg-card);">
                ${customTemplates.map(t => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--border); margin-bottom:5px;">
                        <div>
                            <strong>${App.escapeHtml(t.name)}</strong>
                            <div style="font-size:11px; color:var(--text-muted);">Criado em ${new Date(t.createdAt).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-danger" onclick="Notes.deleteCustomTemplate('${t.id}')">Excluir</button>
                        </div>
                    </div>
                `).join('') || '<div style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum modelo customizado criado ainda.</div>'}
            </div>
            <div class="form-actions" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="App.closeModal()">Fechar</button>
            </div>
        `);
    },

    showCreateTemplateForm() {
        App.showModal('Criar Novo Modelo', `
            ${App.modalContextHtml({
                icon: '➕',
                title: 'Criar Novo Modelo',
                description: 'Insira o nome do modelo e o conteúdo inicial (aceita HTML e Markdown).',
                meta: ['Templates', 'Customizado'],
                tone: 'notes'
            })}
            <form id="nt-template-form" onsubmit="Notes.saveCustomTemplate(event)" class="settings-entity-form module-form">
                <div class="form-group">
                    <label>Nome do Modelo *</label>
                    <input type="text" id="nt-tpl-name" required placeholder="Ex: Diário de Gratidão, Ata de Standup...">
                </div>
                <div class="form-group">
                    <label>Conteúdo Inicial (HTML/Markdown)</label>
                    <textarea id="nt-tpl-content" rows="8" style="width: 100%; padding: 8px; font-family: monospace; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px;" placeholder="Digite o esqueleto do modelo de nota..."></textarea>
                </div>
                <div class="form-actions" style="margin-top: 15px;">
                    <button type="button" class="btn btn-secondary" onclick="Notes.showTemplatesModal()">Voltar</button>
                    <button type="submit" class="btn btn-primary">Salvar Modelo</button>
                </div>
            </form>
        `);
    },

    saveCustomTemplate(e) {
        e.preventDefault();
        const name = document.getElementById('nt-tpl-name').value.trim();
        const content = document.getElementById('nt-tpl-content').value;
        if (!name) return;
        if (Storage.addCustomTemplate) {
            Storage.addCustomTemplate({ name, content });
        } else {
            const all = Storage.getCustomTemplates();
            all.push({ id: 'tpl_' + Date.now(), name, content, createdAt: Date.now() });
            Storage.saveCustomTemplates(all);
        }
        App.toast('Modelo criado com sucesso!', 'success');
        this.showTemplatesModal();
    },

    deleteCustomTemplate(id) {
        App.confirmAction('Deseja realmente excluir este modelo?', () => {
            if (Storage.deleteCustomTemplate) {
                Storage.deleteCustomTemplate(id);
            } else {
                const all = Storage.getCustomTemplates().filter(t => t.id !== id);
                Storage.saveCustomTemplates(all);
            }
            App.toast('Modelo excluído!', 'success');
            this.showTemplatesModal();
        });
    }
};
