// ============================================
// BOOKMARKS MODULE - Multi-category support
// ============================================
const Bookmarks = {
    currentFolder: 'all',
    currentCategory: 'all',
    searchQuery: '',
    sortBy: 'newest',

    init() {
        this.render();
        this.renderFolderSidebar();
        this.renderCategoryFilter();
    },

    getFiltered() {
        let items = Storage.getBookmarks();
        if (this.currentFolder === 'favorites') items = items.filter(b => b.favorite);
        else if (this.currentFolder !== 'all') items = items.filter(b => b.folderId === this.currentFolder);
        if (this.currentCategory !== 'all') items = items.filter(b => (b.categoryIds || []).includes(this.currentCategory));
        if (this.searchQuery) {
            items = items.filter(b => FuzzySearch.matches(this.searchQuery, [
                { text: b.title || '', weight: 3 },
                { text: b.url || '', weight: 2 },
                { text: b.description || '', weight: 1 }
            ]));
        }
        items = items.filter(b => App.contextMatches('bookmark', b));
        switch (this.sortBy) {
            case 'newest': items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
            case 'oldest': items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
            case 'alpha': items.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'favorites': items.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)); break;
            case 'manual': items.sort((a, b) => (a.manualOrder ?? 999999) - (b.manualOrder ?? 999999)); break;
        }
        return items;
    },

    render() {
        const container = document.getElementById('bookmarks-grid');
        if (!container) return;
        const items = this.getFiltered();
        const categories = Storage.getBkCategories();
        const folders = Storage.getBkFolders();

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128278;</div><h3>Nenhum bookmark encontrado</h3><p>Adicione seu primeiro link favorito!</p></div>`;
            document.getElementById('bk-count').textContent = '0 links';
            return;
        }

        document.getElementById('bk-count').textContent = `${items.length} link${items.length !== 1 ? 's' : ''}`;

        container.innerHTML = items.map(bk => {
            const bkCats = (bk.categoryIds || []).map(cid => categories.find(c => c.id === cid)).filter(Boolean);
            const folder = folders.find(f => f.id === bk.folderId) || { name: 'Geral' };
            let favicon;
            try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(bk.url).hostname}&sz=32`; }
            catch { favicon = ''; }
            const primaryCat = bkCats[0] || { color: '#22D3EE' };
            const catsHtml = bkCats.length > 0
                ? bkCats.map(c => `<span class="bk-category" style="--cat-color: ${c.color}">${c.icon} ${c.name}</span>`).join('')
                : `<span class="bk-category" style="--cat-color: #78909C">&#128279; Sem categoria</span>`;
            return `
            <div class="bookmark-card ${bk.favorite ? 'is-favorite' : ''}" style="--cat-color:${primaryCat.color}" data-id="${bk.id}" draggable="true" ondragstart="Bookmarks.dragStart(event,'${bk.id}')" ondragover="event.preventDefault()" ondrop="Bookmarks.dropOn(event,'${bk.id}')">
                <div class="bk-card-header">
                    <img class="bk-favicon" src="${favicon}" alt="" onerror="this.style.display='none'">
                    <div class="bk-card-actions">
                        <button class="btn-icon btn-fav ${bk.favorite ? 'active' : ''}" onclick="Bookmarks.toggleFav('${bk.id}')" title="Favorito">&#9733;</button>
                        ${bk.isPrivate ? '' : `<button class="btn-icon" onclick="Bookmarks.edit('${bk.id}')" title="Editar">&#9998;</button>`}
                        <button class="btn-icon btn-del" onclick="Bookmarks.delete('${bk.id}')" title="Apagar">&#128465;</button>
                    </div>
                </div>
                <a href="${this.escapeHtml(bk.url)}" target="_blank" rel="noopener noreferrer" class="bk-link" title="${this.escapeHtml(bk.url)}" onclick="Bookmarks.recordOpen('${bk.id}')">
                    <h4 class="bk-title">${this.escapeHtml(bk.title)}</h4>
                </a>
                <p class="bk-desc">${this.escapeHtml(bk.description || '')}</p>
                <div class="bk-meta">
                    <div class="bk-cats-wrap">${catsHtml}</div>
                    <span class="bk-folder">&#128193; ${folder.name}</span>
                </div>
                <div class="bk-date">${this.formatDate(bk.createdAt)}</div>
            </div>`;
        }).join('');
    },

    renderFolderSidebar() {
        const el = document.getElementById('bk-folders-list');
        if (!el) return;
        const folders = Storage.getBkFolders();
        const bookmarks = Storage.getBookmarks();
        el.innerHTML = `
            <li class="folder-item ${this.currentFolder === 'all' ? 'active' : ''}" onclick="Bookmarks.setFolder('all')">
                <span>&#128218; Todos</span><span class="badge">${bookmarks.length}</span>
            </li>
            <li class="folder-item ${this.currentFolder === 'favorites' ? 'active' : ''}" onclick="Bookmarks.setFolder('favorites')">
                <span>&#9733; Favoritos</span><span class="badge">${bookmarks.filter(b => b.favorite).length}</span>
            </li>
            ${folders.map(f => {
                const count = bookmarks.filter(b => b.folderId === f.id).length;
                return `<li class="folder-item ${this.currentFolder === f.id ? 'active' : ''}" onclick="Bookmarks.setFolder('${f.id}')">
                    <span>${f.icon} ${f.name}</span>
                    <span class="badge">${count}</span>
                </li>`;
            }).join('')}
        `;
    },

    renderCategoryFilter() {
        const el = document.getElementById('bk-category-filter');
        if (!el) return;
        const cats = Storage.getBkCategories();
        el.innerHTML = `<button class="cat-btn ${this.currentCategory === 'all' ? 'active' : ''}" onclick="Bookmarks.setCategory('all')">Todos</button>` +
            cats.map(c => `<button class="cat-btn ${this.currentCategory === c.id ? 'active' : ''}" onclick="Bookmarks.setCategory('${c.id}')" style="--cat-color:${c.color}">${c.icon} ${c.name}</button>`).join('');
    },

    dragStart(event, id) {
        event.dataTransfer.setData('text/plain', id);
    },

    dropOn(event, targetId) {
        const sourceId = event.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === targetId) return;
        const all = Storage.getBookmarks();
        const visible = this.getFiltered().map(b => b.id);
        const from = visible.indexOf(sourceId), to = visible.indexOf(targetId);
        if (from < 0 || to < 0) return;
        visible.splice(to, 0, visible.splice(from, 1)[0]);
        visible.forEach((id, index) => {
            const item = all.find(b => b.id === id);
            if (item) item.manualOrder = index;
        });
        Storage.saveBookmarks(all);
        this.sortBy = 'manual';
        this.render();
    },

    setFolder(id) {
        this.currentFolder = id;
        if (id === 'favorites') this.sortBy = 'favorites';
        this.renderFolderSidebar(); this.render();
    },
    setCategory(id) { this.currentCategory = id; this.renderCategoryFilter(); this.render(); },
    setSort(val) { this.sortBy = val; this.render(); },
    search(q) { this.searchQuery = q; this.render(); },
    searchDebounced(q) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.search(q), 160);
    },

    // Multi-category chip selector HTML
    _renderCatChips(selectedIds, prefix) {
        const cats = Storage.getBkCategories();
        return `<div class="multi-cat-selector" id="${prefix}-cats">
            <label style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>Categorias <span class="text-muted">(clique para selecionar)</span></span>
                <button type="button" class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 2px 8px; margin: 0; background: var(--bg-hover);" onclick="Bookmarks.suggestTagsWithAi('${prefix}')">&#129302; Auto-Tag IA</button>
            </label>
            <div class="cat-chips">
                ${cats.map(c => `<button type="button" class="cat-chip ${(selectedIds || []).includes(c.id) ? 'selected' : ''}" data-cat-id="${c.id}" style="--cat-color:${c.color}" onclick="Bookmarks.toggleCatChip(this,'${prefix}')">${c.icon} ${c.name}</button>`).join('')}
            </div>
        </div>`;
    },

    toggleCatChip(btn, prefix) {
        btn.classList.toggle('selected');
    },

    suggestTagsWithAi(prefix) {
        const title = document.getElementById('bk-title')?.value || '';
        const desc = document.getElementById('bk-desc')?.value || '';
        const url = document.getElementById('bk-url')?.value || '';
        
        const content = `${title} ${desc} ${url}`;
        const suggestedTokens = WebAI.suggestTags(content, title);
        const cats = Storage.getBkCategories();
        
        let matchedCount = 0;
        cats.forEach(c => {
            const catTokens = WebAI.tokenize(c.name);
            const matches = catTokens.some(ct => suggestedTokens.includes(ct));
            const matchesSubstring = suggestedTokens.some(st => c.name.toLowerCase().includes(st));
            if (matches || matchesSubstring) {
                const chip = document.querySelector(`#${prefix}-cats .cat-chip[data-cat-id="${c.id}"]`);
                if (chip) {
                    if (!chip.classList.contains('selected')) {
                        chip.classList.add('selected');
                        matchedCount++;
                    }
                }
            }
        });
        
        if (matchedCount > 0) {
            App.toast(`${matchedCount} categoria(s) sugerida(s) e ativada(s)!`, 'success');
        } else {
            App.toast('Nenhuma categoria correspondente encontrada.', 'info');
        }
    },

    getSelectedCatIds(prefix) {
        const chips = document.querySelectorAll(`#${prefix}-cats .cat-chip.selected`);
        return Array.from(chips).map(c => c.dataset.catId);
    },

    suggestTitleFromUrl() {
        const titleEl = document.getElementById('bk-title');
        const urlEl = document.getElementById('bk-url');
        if (!titleEl || !urlEl || titleEl.value.trim()) return;
        try {
            const url = new URL(urlEl.value.trim());
            const host = url.hostname.replace(/^www\./, '');
            titleEl.value = host.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } catch {}
    },

    showAddModal() {
        const folders = Storage.getBkFolders();
        App.showModal('Novo Bookmark', `
            ${App.modalContextHtml({
                icon: '🔗',
                title: 'Novo bookmark',
                description: 'Salve um link com contexto, pasta e categorias para reencontrar depois sem depender do histórico do navegador.',
                meta: ['Link', 'Coleção de referências'],
                tone: 'bookmarks'
            })}
            <form id="bk-form" onsubmit="Bookmarks.save(event)" class="settings-entity-form module-form">
                <input type="hidden" id="bk-edit-id" value="">
                <div class="form-group"><label>Título *</label><input type="text" id="bk-title" required placeholder="Ex: Meu canal favorito"></div>
                <div class="form-group"><label>URL *</label><input type="url" id="bk-url" required placeholder="https://..." onblur="Bookmarks.suggestTitleFromUrl()"></div>
                <div class="form-group"><label>Descrição</label><textarea id="bk-desc" rows="3" placeholder="Por que este link é útil? O que você encontra nele?"></textarea></div>
                <div class="form-group"><label>Pasta</label><select id="bk-folder">${folders.map(f => `<option value="${f.id}">${f.icon} ${f.name}</option>`).join('')}</select></div>
                ${this._renderCatChips([], 'bk-add')}
                <label class="bookmark-favorite-toggle"><input type="checkbox" id="bk-favorite"> <span>Marcar como favorito</span></label>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    edit(id) {
        const bk = Storage.getBookmarks().find(b => b.id === id);
        if (!bk) return;
        const folders = Storage.getBkFolders();
        App.showModal('Editar Bookmark', `
            ${App.modalContextHtml({
                icon: '🔗',
                title: 'Editar bookmark',
                description: 'Ajuste o título, descrição, pasta e categorias mantendo o link dentro da sua biblioteca.',
                meta: [bk.url || 'URL cadastrada', 'Bookmark'],
                tone: 'bookmarks'
            })}
            <form id="bk-form" onsubmit="Bookmarks.save(event)" class="settings-entity-form module-form">
                <input type="hidden" id="bk-edit-id" value="${bk.id}">
                <div class="form-group"><label>Título *</label><input type="text" id="bk-title" required placeholder="Ex: Meu canal favorito" value="${this.escapeHtml(bk.title)}"></div>
                <div class="form-group"><label>URL *</label><input type="url" id="bk-url" required placeholder="https://..." value="${this.escapeHtml(bk.url)}" onblur="Bookmarks.suggestTitleFromUrl()"></div>
                <div class="form-group"><label>Descrição</label><textarea id="bk-desc" rows="3" placeholder="Por que este link é útil? O que você encontra nele?">${this.escapeHtml(bk.description || '')}</textarea></div>
                <div class="form-group"><label>Pasta</label><select id="bk-folder">${folders.map(f => `<option value="${f.id}" ${bk.folderId === f.id ? 'selected' : ''}>${f.icon} ${f.name}</option>`).join('')}</select></div>
                ${this._renderCatChips(bk.categoryIds || [], 'bk-add')}
                <label class="bookmark-favorite-toggle"><input type="checkbox" id="bk-favorite" ${bk.favorite ? 'checked' : ''}> <span>Marcar como favorito</span></label>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    async save(e) {
        e.preventDefault();
        const id = document.getElementById('bk-edit-id').value;
        const data = {
            title: document.getElementById('bk-title').value.trim(),
            url: document.getElementById('bk-url').value.trim(),
            description: document.getElementById('bk-desc').value.trim(),
            categoryIds: this.getSelectedCatIds('bk-add'),
            folderId: document.getElementById('bk-folder').value,
            favorite: Boolean(document.getElementById('bk-favorite')?.checked)
        };
        const normalizedUrl = data.url.replace(/\/$/, '').toLowerCase();
        const duplicate = Storage.getBookmarks().find(b => b.id !== id && (b.url || '').replace(/\/$/, '').toLowerCase() === normalizedUrl);
        if (duplicate && !await BookListDialogs.confirm(`Já existe um bookmark com essa URL: "${duplicate.title}". Salvar mesmo assim?`, { title: 'Bookmark duplicado', confirmText: 'Salvar mesmo assim', danger: false })) return;
        if (id) { Storage.updateBookmark(id, data); App.toast('Bookmark atualizado!', 'success'); }
        else { Storage.addBookmark(data); App.toast('Bookmark salvo!', 'success'); }
        App.closeModal(); this.init();
    },

    delete(id) {
        App.confirmAction('Deseja apagar este bookmark?', () => {
            const trash = Storage.deleteBookmark(id);
            App.toast('Bookmark movido para a lixeira.', 'info', trash ? {
                label: 'Desfazer',
                onClick: () => {
                    Storage.restoreTrashItem(trash.id);
                    Bookmarks.init();
                    App.toast('Bookmark restaurado!', 'success');
                }
            } : null);
            this.init();
        }, { title: 'Apagar bookmark', confirmText: 'Apagar', danger: true });
    },

    toggleFav(id) {
        const bk = Storage.getBookmarks().find(b => b.id === id);
        if (bk) { Storage.updateBookmark(id, { favorite: !bk.favorite }); this.render(); this.renderFolderSidebar(); }
    },

    recordOpen(id) {
        Storage.recordBookmarkOpen(id);
    },

    exportFiltered() {
        const items = this.getFiltered();
        const blob = new Blob([JSON.stringify({ type: 'bookmarks', exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booklist_bookmarks_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        App.toast(`${items.length} bookmark(s) exportados.`, 'success');
    },

    formatDate(iso) {
        return UI.relativeTime(iso) || new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    escapeHtml(str) {
        const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
    }
};
