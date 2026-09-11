/* Single command palette implementation. Loaded after App and replaces legacy variants. */
const CommandPalette = {
    selectedIndex: 0,
    commands: [],
    timer: null,

    open() {
        this.close();
        const backdrop = document.createElement('div');
        backdrop.id = 'command-palette-backdrop';
        backdrop.className = 'command-palette-backdrop active';
        backdrop.innerHTML = `<div class="command-palette-container" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onclick="event.stopPropagation()"><div class="command-palette-input-wrapper"><span aria-hidden="true">⌕</span><input id="command-input-premium" placeholder="Buscar comandos, notas ou bookmarks..." autocomplete="off"></div><div id="command-palette-results" class="command-palette-results"></div><div class="command-palette-footer"><span><kbd>↑↓</kbd> navegar · <kbd>Enter</kbd> executar · <kbd>Esc</kbd> fechar</span><span>Ctrl + K</span></div></div>`;
        backdrop.addEventListener('click', () => this.close());
        document.body.appendChild(backdrop);
        const input = backdrop.querySelector('input');
        input.addEventListener('input', event => this.searchDebounced(event.target.value));
        input.addEventListener('keydown', event => this.onKeydown(event));
        this.render(App.getCommands(''));
        requestAnimationFrame(() => input.focus());
    },

    close() { document.getElementById('command-palette-backdrop')?.remove(); },

    searchDebounced(query) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.search(query), 100);
    },

    search(query) {
        const commands = App.getCommands(query);
        this.render(commands);
        if (!query.trim() || !window.WebAI?._pipeline) return;
        const requested = query.trim();
        const items = [...Storage.getBookmarks().map(item => ({ ...item, type: 'bookmark', docText: `${item.title} ${item.description} ${item.url}` })), ...Storage.getNotes().map(item => ({ ...item, type: 'note', docText: `${item.title} ${Notes.stripHtml(item.content)}` }))];
        WebAI.searchSemantic(requested, items, 3).then(results => {
            if (document.getElementById('command-input-premium')?.value.trim() !== requested) return;
            const semantic = results.map(item => ({ label: item.title || 'Sem título', hint: 'Resultado semântico', type: 'semantic', run: () => item.type === 'bookmark' ? window.open(UI.isSafeUrl(item.url) ? item.url : '#', '_blank', 'noopener') : App.afterNavigate('notes', () => Notes.openEditor(item.id)) }));
            this.render([...commands, ...semantic]);
        }).catch(error => console.warn('[CommandPalette] Busca semântica indisponível:', error));
    },

    render(commands) {
        const source = commands || [];
        this.commands = ['command','note','bookmark','semantic'].flatMap(type => source.filter(command => (command.type || 'command') === type));
        this.selectedIndex = 0;
        const target = document.getElementById('command-palette-results');
        if (!target) return;
        if (!this.commands.length) { target.innerHTML = '<p class="text-muted" style="padding:20px;text-align:center">Nada encontrado.</p>'; return; }
        const labels = { command: 'Comandos', note: 'Notas', bookmark: 'Bookmarks', semantic: 'Resultados semânticos' };
        let index = 0;
        target.innerHTML = ['command','note','bookmark','semantic'].map(type => {
            const items = this.commands.filter(command => (command.type || 'command') === type);
            if (!items.length) return '';
            return `<div class="command-palette-category">${labels[type]}</div>${items.map(command => { const current = index++; return `<button class="command-result-premium ${current === 0 ? 'mui-focused' : ''}" data-command-index="${current}" onclick="CommandPalette.execute(${current})"><span class="command-result-premium-content"><strong class="command-result-premium-label">${App.escapeHtml(command.label)}</strong><small class="command-result-premium-hint">${App.escapeHtml(command.hint || '')}</small></span></button>`; }).join('')}`;
        }).join('');
    },

    onKeydown(event) {
        if (!this.commands.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            this.selectedIndex = (this.selectedIndex + delta + this.commands.length) % this.commands.length;
            document.querySelectorAll('[data-command-index]').forEach((node, index) => node.classList.toggle('mui-focused', index === this.selectedIndex));
            document.querySelector(`[data-command-index="${this.selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter') { event.preventDefault(); this.execute(this.selectedIndex); }
        else if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    },

    execute(index) {
        const command = this.commands[index];
        this.close();
        command?.run?.();
    }
};

Object.assign(App, {
    openCommandPalette: () => CommandPalette.open(),
    closeCommandPalette: () => CommandPalette.close(),
    renderCommands: query => CommandPalette.search(query),
    renderCommandsDebounced: query => CommandPalette.searchDebounced(query),
    runCommandPremium: index => CommandPalette.execute(index)
});
window.CommandPalette = CommandPalette;
