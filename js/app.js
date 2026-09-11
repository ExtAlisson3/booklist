// ============================================
// APP MODULE - Main controller, routing, UI
// ============================================
const App = {
    currentPage: 'dashboard',
    splitEnabled: false,
    leftPage: 'notes',
    rightPage: 'bookmarks',
    focusedPanel: 'left',
    vaultFilter: { folderId: 'all', categoryId: 'all' },
    _pendingConfirm: null,
    async init() {
        await Storage.init();
        this.splitEnabled = localStorage.getItem('booklist_split_enabled') === '1';
        this.leftPage = localStorage.getItem('booklist_left_page') || 'notes';
        this.rightPage = localStorage.getItem('booklist_right_page') || 'bookmarks';
        this.focusedPanel = localStorage.getItem('booklist_focused_panel') || 'left';
        FeatureHub.initAutomationEngine?.();
        this.applyAppearance();
        this.renderContextToggle();
        this.initNavigation();
        const shareId = new URLSearchParams(location.search).get('share');
        if (shareId) {
            await this.renderPublicShare(shareId);
            return;
        }
        if (!Storage.hasData()) { this.showImportPrompt(); }
        else {
            if (this.splitEnabled) {
                this.renderSplitPanels();
            } else {
                this.renderPage('dashboard');
            }
        }

        // Intercept PDF drags globally
        window.addEventListener('dragover', (e) => {
            const items = e.dataTransfer?.items;
            if (items && items.length > 0) {
                const hasPdf = Array.from(items).some(item => item.kind === 'file' && (item.type === 'application/pdf' || item.name?.toLowerCase().endsWith('.pdf')));
                if (hasPdf) {
                    e.preventDefault();
                }
            }
        });
        window.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const pdfFile = Array.from(files).find(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                if (pdfFile) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.loadPdfReaderFile(pdfFile);
                }
            }
        });

        window.addEventListener('booklist:sync-complete', () => {
            if (this.splitEnabled) {
                const isEditingNotes = (this.leftPage === 'notes' || this.rightPage === 'notes') && Notes.editingId;
                if (isEditingNotes) return;
            } else {
                if (this.currentPage === 'notes' && Notes.editingId) return;
                if (this.currentPage === 'settings') return;
            }
            if (document.getElementById('modal-overlay')?.classList.contains('active')) return;
            if (document.getElementById('confirm-overlay')?.classList.contains('active')) return;
            const scrollY = window.scrollY;
            if (this.splitEnabled) {
                this.renderSplitPanels();
            } else {
                this.renderPage(this.currentPage);
            }
            requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
        });
        document.addEventListener('keydown', (e) => {
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
            if (e.key === 'Escape') {
                if (document.getElementById('confirm-overlay')?.classList.contains('active')) { e.preventDefault(); this.cancelConfirm(); return; }
                if (document.getElementById('modal-overlay')?.classList.contains('active')) { e.preventDefault(); this.closeModal(); return; }
                if (document.getElementById('command-palette-backdrop')?.classList.contains('active')) { e.preventDefault(); this.closeCommandPalette(); return; }
            }
            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                this.toggleSplitView();
            }
            if (e.ctrlKey && e.key === 'b' && Notes.editingId) { e.preventDefault(); Notes.execCmd('bold'); }
            if (e.ctrlKey && e.key === 'i' && Notes.editingId) { e.preventDefault(); Notes.execCmd('italic'); }
            if (e.ctrlKey && e.key === 'u' && Notes.editingId) { e.preventDefault(); Notes.execCmd('underline'); }
            if (e.ctrlKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.openCommandPalette();
            }
            if (!isTyping && e.ctrlKey && e.key.toLowerCase() === 'n') {
                e.preventDefault(); this.afterNavigate('notes', () => Notes.showCreateModal());
            }
            if (!isTyping && e.ctrlKey && e.key.toLowerCase() === 'l') {
                e.preventDefault(); this.afterNavigate('bookmarks', () => Bookmarks.showAddModal());
            }
            if (!isTyping && e.key === '?') {
                e.preventDefault(); FeatureHub.currentTab = 'shortcuts'; this.navigate('power');
            }
        });
    },
    applyAppearance() {
        const settings = Storage.getSettings();
        let theme = settings.theme || 'dark';
        let accent = settings.accent || '#7C4DFF';
        
        if (theme === 'circadian') {
            const hour = new Date().getHours();
            if (hour >= 18 || hour < 6) {
                // Noite: Tema escuro com accent roxo/indigo profundo
                theme = 'dark';
                accent = '#5c54ec';
            } else if (hour >= 16 && hour < 18) {
                // Entardecer: Tema escuro com accent sunset laranja/rosa vibrante
                theme = 'dark';
                accent = '#f97316';
            } else {
                // Dia: Tema claro com accent amarelo/ouro vibrante ou azul brilhante
                theme = 'light';
                accent = '#d97706';
            }
        }
        
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.style.setProperty('--accent', accent);
        document.body.dataset.workspaceMode = settings.workspaceMode || 'all';
    },
    getContextMode() {
        return Storage.getSettings().workspaceMode || 'all';
    },
    setContextMode(mode = 'all') {
        const safe = ['work', 'personal', 'all'].includes(mode) ? mode : 'all';
        Storage.saveSettings({ workspaceMode: safe });
        this.applyAppearance();
        this.renderContextToggle();
        if (this.splitEnabled) this.renderSplitPanels();
        else this.renderPage(this.currentPage || 'dashboard');
        this.toast(`Modo contexto: ${this.contextModeLabel(safe)}`, 'info');
    },
    contextModeLabel(mode = this.getContextMode()) {
        return { work: 'Trabalho', personal: 'Pessoal', all: 'Tudo' }[mode] || 'Tudo';
    },
    renderContextToggle() {
        const el = document.getElementById('workspace-context-toggle');
        if (!el) return;
        const mode = this.getContextMode();
        const modes = [
            ['work', '&#128188;', 'Trabalho'],
            ['personal', '&#127968;', 'Pessoal'],
            ['all', '&#127760;', 'Tudo']
        ];
        el.innerHTML = modes.map(([id, icon, label]) => `<button type="button" data-mode="${id}" aria-pressed="${mode === id}" class="${mode === id ? 'active' : ''}" onclick="App.setContextMode('${id}')" title="Modo ${label}"><span class="ctx-icon" aria-hidden="true">${icon}</span><span class="ctx-label">${label}</span></button>`).join('');
    },
    contextForItem(type, item = {}) {
        if (type === 'professional' || item.moduleKey) return 'work';
        if (type === 'personal' || ['money','journal','habits','habitLogs','goals','tracker','inbox'].includes(item.collection || '')) return 'personal';
        if (type === 'project') return item.context || item.workspaceMode || 'all';
        const cats = item.categoryIds || [];
        const hasWorkCat = cats.some(id => ['work', 'study'].includes(id));
        const hasPersonalCat = cats.includes('personal');
        if (hasWorkCat && !hasPersonalCat) return 'work';
        if (hasPersonalCat && !hasWorkCat) return 'personal';
        const text = `${item.title || item.name || ''} ${item.description || ''} ${item.url || ''} ${this.stripHtml(item.content || '')} ${(item.tags || []).join(' ')} ${cats.join(' ')}`.toLowerCase();
        const workTerms = ['work', 'trabalho', 'cliente', 'clientes', 'ticket', 'os', 'orcamento', 'orçamento', 'servidor', 'rede', 'router', 'roteador', 'backup', 'dev', 'supabase', 'api', 'codigo', 'código'];
        const personalTerms = ['personal', 'pessoal', 'diario', 'diário', 'habit', 'habito', 'hábito', 'lazer', 'jogo', 'games', 'social', 'youtube', 'filme', 'manga', 'mangá'];
        const isWork = workTerms.some(term => text.includes(term));
        const isPersonal = personalTerms.some(term => text.includes(term));
        if (isWork && !isPersonal) return 'work';
        if (isPersonal && !isWork) return 'personal';
        return 'all';
    },
    isContextAllowed(scope) {
        const mode = this.getContextMode();
        return mode === 'all' || mode === scope;
    },
    renderContextGate(main, scope, message) {
        const mode = this.getContextMode();
        const target = scope === 'personal' ? 'personal' : 'work';
        main.innerHTML = `<div class="module-page"><div class="feature-card context-mode-gate"><h3>Modo ${this.escapeHtml(this.contextModeLabel(mode))}</h3><p>${this.escapeHtml(message)}</p><div class="settings-actions"><button type="button" class="btn btn-primary" onclick="App.setContextMode('${target}')">Mudar para ${this.escapeHtml(this.contextModeLabel(target))}</button><button type="button" class="btn btn-secondary" onclick="App.setContextMode('all')">Ver tudo</button></div></div></div>`;
    },
    contextMatches(type, item = {}, mode = this.getContextMode()) {
        if (mode === 'all') return true;
        const scope = this.contextForItem(type, item);
        return scope === 'all' || scope === mode;
    },
    filterContextItems(items = [], typeResolver = null) {
        const mode = this.getContextMode();
        if (mode === 'all') return items;
        return items.filter(item => {
            const type = typeResolver ? typeResolver(item) : (item.type || item.openType || item.moduleKey ? 'professional' : '');
            const source = item.item || item;
            return this.contextMatches(type, source, mode);
        });
    },
    async renderPublicShare(shareId) {
        const main = document.getElementById('main-content');
        main.innerHTML = '<div class="dashboard"><div class="feature-card"><h2>Carregando compartilhamento...</h2></div></div>';
        try {
            const share = await Storage.fetchPublicShare(shareId);
            if (!share) throw new Error('Link publico nao encontrado ou desativado.');
            const payload = share.payload || {};
            const safeUrl = UI.isSafeUrl(payload.url || '#') ? payload.url || '#' : '#';
            main.innerHTML = `
            <article class="public-share-page">
                <header><strong>BookList publico</strong><h1>${this.escapeHtml(share.title || payload.title || 'Compartilhado')}</h1><p>${new Date(share.updated_at).toLocaleString('pt-BR')}</p></header>
                ${share.kind === 'bookmark'
                    ? `<section><p>${this.escapeHtml(payload.description || '')}</p><a class="btn btn-primary" href="${this.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Abrir link</a></section>`
                    : `<section class="public-note-content">${UI.sanitizeHtml(payload.content || '')}</section>`}
            </article>`;
            requestAnimationFrame(() => { MermaidLite.renderAll(main); QueryView.renderAll(main); WikiLinks.renderAll(main); });
        } catch (err) {
            main.innerHTML = `<div class="dashboard"><div class="feature-card"><h2>Compartilhamento indisponivel</h2><p>${this.escapeHtml(err.message)}</p></div></div>`;
        }
    },
    showImportPrompt() {
        const main = document.getElementById('main-content');
        main.innerHTML = `
        <div class="dashboard" style="display:flex;align-items:center;justify-content:center;min-height:80vh">
            <div class="import-prompt">
                <div class="empty-icon">📚</div>
                <h2>Bem-vindo ao <span class="gradient-text">BookList</span></h2>
                <p>Parece que não há dados salvos neste navegador.</p>
                <p class="text-muted">Se você já usou o BookList antes, importe seu backup para restaurar tudo.</p>
                <div class="import-prompt-actions">
                    <label class="btn btn-primary btn-lg">📤 Importar Backup<input type="file" accept=".json" style="display:none" onchange="App.handleImport(this.files[0])"></label>
                    <button class="btn btn-primary btn-lg" onclick="App.navigate('settings')">☁️ Entrar no Supabase</button>
                    <button class="btn btn-secondary btn-lg" onclick="App.navigate('dashboard')">🆕 Começar do Zero</button>
                </div>
            </div>
        </div>`;
    },
    navigate(page) {
        const updateDom = () => {
            if (this.splitEnabled) {
                this.setSplitPage(this.focusedPanel, page);
            } else {
                this.currentPage = page;
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
                this.syncNavigation(page);
                this.renderPage(page);
            }
        };

        if (document.startViewTransition) {
            document.startViewTransition(() => updateDom());
        } else {
            updateDom();
        }
    },
    initNavigation() {
        const nav = document.getElementById('app-nav');
        if (!nav) return;
        // v2 intentionally defaults to the fixed expanded navigation. The previous
        // hover/collapsed preference could leave people without a discoverable way back.
        const expanded = localStorage.getItem('booklist_nav_mode_v2') !== 'collapsed';
        nav.classList.toggle('nav-expanded', expanded);
        this.syncNavigationToggle(expanded);
        const storedGroup = localStorage.getItem('booklist_nav_group') || 'personal';
        this.setNavGroup(storedGroup, false);
        this.syncNavigation(this.currentPage);
    },
    toggleNavigation() {
        const nav = document.getElementById('app-nav');
        if (!nav) return;
        const expanded = !nav.classList.contains('nav-expanded');
        nav.classList.toggle('nav-expanded', expanded);
        localStorage.setItem('booklist_nav_mode_v2', expanded ? 'expanded' : 'collapsed');
        this.syncNavigationToggle(expanded);
    },
    syncNavigationToggle(expanded) {
        const button = document.querySelector('.nav-collapse');
        if (!button) return;
        button.innerHTML = expanded ? '&#10094;' : '&#10095;';
        button.setAttribute('aria-label', expanded ? 'Recolher menu lateral' : 'Expandir menu lateral');
        button.title = expanded ? 'Mostrar somente ícones' : 'Mostrar menu completo';
    },
    toggleNavGroup(group) {
        const section = document.querySelector(`.nav-section[data-nav-group="${group}"]`);
        this.setNavGroup(section?.classList.contains('is-open') ? '' : group);
    },
    setNavGroup(group, persist = true) {
        document.querySelectorAll('.nav-section[data-nav-group]').forEach(section => {
            const open = section.dataset.navGroup === group;
            section.classList.toggle('is-open', open);
            section.querySelector('.nav-group-trigger')?.setAttribute('aria-expanded', String(open));
        });
        if (persist) localStorage.setItem('booklist_nav_group', group || '');
    },
    syncNavigation(page = this.currentPage) {
        const active = document.querySelector(`.nav-item[data-page="${page}"]`);
        const group = active?.closest?.('.nav-section[data-nav-group]')?.dataset.navGroup;
        if (group) this.setNavGroup(group);
    },
    afterNavigate(page, fn) {
        this.navigate(page);
        requestAnimationFrame(() => requestAnimationFrame(() => fn?.()));
    },
    getPanelWidth(key, fallback) {
        const raw = Number(localStorage.getItem(`booklist_${key}_width`));
        return Number.isFinite(raw) && raw > 0 ? raw : fallback;
    },
    isPanelHidden(key) {
        return localStorage.getItem(`booklist_${key}_hidden`) === '1';
    },
    togglePanel(key) {
        const next = this.isPanelHidden(key) ? '0' : '1';
        localStorage.setItem(`booklist_${key}_hidden`, next);
        this.renderPage(this.currentPage);
    },
    startPanelResize(event, key, min = 220, max = 520) {
        event.preventDefault();
        const page = event.currentTarget.closest('.page-split-v2, .notes-layout');
        if (!page) return;
        const startX = event.clientX;
        const start = this.getPanelWidth(key, key.includes('notes_list') ? 370 : 275);
        const onMove = (moveEvent) => {
            const width = Math.max(min, Math.min(max, start + moveEvent.clientX - startX));
            localStorage.setItem(`booklist_${key}_width`, String(Math.round(width)));
            page.style.setProperty(`--${key.replace(/_/g, '-')}-width`, `${Math.round(width)}px`);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.classList.remove('is-resizing-panel');
        };
        document.body.classList.add('is-resizing-panel');
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp, { once: true });
    },
    renderPage(page, container = null) {
        if (this.splitEnabled && !container) {
            this.renderSplitPanels();
            return;
        }
        const main = container || document.getElementById('main-content');
        if (!main) return;
        if (window.PageRouter?.render(page, main)) return;
        switch (page) {
            case 'dashboard': this.renderDashboard(main); break;
            case 'bookmarks': this.renderBookmarksPage(main); break;
            case 'notes': this.renderNotesPage(main); break;
            case 'vault': this.renderVaultPage(main); break;
            case 'vault-media': this.renderVaultTrackerPage(main); break;
            case 'power': FeatureHub.render(main); break;
            case 'health': SystemHealth.render(main); break;
            case 'personal': PersonalHub.renderHome(main); break;
            case 'life': PersonalHub.renderLifeAreas(main); break;
            case 'journal': PersonalHub.renderJournal(main); break;
            case 'habits': PersonalHub.renderHabits(main); break;
            case 'goals': PersonalHub.renderGoals(main); break;
            case 'tracker': PersonalHub.renderTracker(main); break;
            case 'money': PersonalHub.renderMoney(main); break;
            case 'personal-inbox': PersonalHub.renderInbox(main); break;
            case 'tech': this.renderTechPage(main); break;
            case 'clients':
            case 'equipment':
            case 'tickets':
            case 'knowledge':
            case 'runbooks':
            case 'budgets':
            case 'finance':
            case 'schedule':
            case 'scripts':
            case 'toolbox':
            case 'networks':
                this.renderProfessionalModule(main, page);
                break;
            case 'settings': this.renderSettingsPage(main); break;
            case 'pdf-reader': this.renderPdfReaderPage(main); break;
        }
    },

    renderSplitPanels() {
        const main = document.getElementById('main-content');
        if (!main) return;

        let container = document.getElementById('split-container');
        if (!container) {
            const modules = [
                { value: 'dashboard', label: '🏠 Dashboard' },
                { value: 'bookmarks', label: '🔖 Bookmarks' },
                { value: 'notes', label: '📝 Notas' },
                { value: 'power', label: '⚡ Power Hub' },
                { value: 'personal', label: '📖 Diário' },
                { value: 'money', label: '💵 Money' },
                { value: 'clients', label: '👥 Clientes' },
                { value: 'tickets', label: '🔧 Atendimentos' },
                { value: 'knowledge', label: '🧠 Base Técnica' },
                { value: 'toolbox', label: '🛠️ Ferramentas' },
                { value: 'pdf-reader', label: '📄 Leitor de PDF' }
            ];

            const leftOptions = modules.map(m => `<option value="${m.value}" ${this.leftPage === m.value ? 'selected' : ''}>${m.label}</option>`).join('');
            const rightOptions = modules.map(m => `<option value="${m.value}" ${this.rightPage === m.value ? 'selected' : ''}>${m.label}</option>`).join('');

            main.innerHTML = `
                <div class="app-split-container" id="split-container">
                    <div class="split-panel" id="panel-left" onclick="App.focusPanel('left')">
                        <div class="split-panel-header">
                            <select class="split-module-select" onchange="App.setSplitPage('left', this.value)">
                                ${leftOptions}
                            </select>
                            <button class="btn-panel-focus" onclick="App.focusPanel('left')"><i class="fas fa-thumbtack"></i> Focar</button>
                        </div>
                        <div class="split-panel-body" id="panel-left-body"></div>
                    </div>
                    <div class="tiling-resizer" id="split-resizer"></div>
                    <div class="split-panel" id="panel-right" onclick="App.focusPanel('right')">
                        <div class="split-panel-header">
                            <select class="split-module-select" onchange="App.setSplitPage('right', this.value)">
                                ${rightOptions}
                            </select>
                            <button class="btn-panel-focus" onclick="App.focusPanel('right')"><i class="fas fa-thumbtack"></i> Focar</button>
                        </div>
                        <div class="split-panel-body" id="panel-right-body"></div>
                    </div>
                </div>
            `;
            
            this.setupSplitResizer();
        }

        const savedRatio = localStorage.getItem('booklist_split_ratio') || '50%';
        container = document.getElementById('split-container');
        if (container) {
            container.style.setProperty('--split-ratio', savedRatio);
        }

        const leftBody = document.getElementById('panel-left-body');
        const rightBody = document.getElementById('panel-right-body');
        
        if (leftBody) this.renderPage(this.leftPage, leftBody);
        if (rightBody) this.renderPage(this.rightPage, rightBody);

        this.focusPanel(this.focusedPanel);

        const splitBtn = document.getElementById('nav-split');
        if (splitBtn) splitBtn.classList.add('active');

        this.updateSplitNavActiveStates();
    },

    setupSplitResizer() {
        const resizer = document.getElementById('split-resizer');
        const container = document.getElementById('split-container');
        if (!resizer || !container) return;

        const onPointerDown = (e) => {
            e.preventDefault();
            const containerRect = container.getBoundingClientRect();
            
            const onPointerMove = (moveEvent) => {
                const clientX = moveEvent.clientX;
                const offset = clientX - containerRect.left;
                let percentage = (offset / containerRect.width) * 100;
                
                if (percentage < 15) percentage = 15;
                if (percentage > 85) percentage = 85;
                
                const ratioStr = `${percentage}%`;
                container.style.setProperty('--split-ratio', ratioStr);
                localStorage.setItem('booklist_split_ratio', ratioStr);
            };

            const onPointerUp = () => {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                document.body.classList.remove('is-resizing-split');
            };

            document.body.classList.add('is-resizing-split');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        };

        resizer.addEventListener('pointerdown', onPointerDown);
    },

    setSplitPage(panel, page) {
        if (panel === 'left') {
            this.leftPage = page;
            localStorage.setItem('booklist_left_page', page);
        } else {
            this.rightPage = page;
            localStorage.setItem('booklist_right_page', page);
        }
        
        const select = document.querySelector(`#panel-${panel} .split-module-select`);
        if (select) select.value = page;
        
        const bodyEl = document.getElementById(`panel-${panel}-body`);
        if (bodyEl) {
            this.renderPage(page, bodyEl);
        }
        
        this.updateSplitNavActiveStates();
    },

    focusPanel(panel) {
        this.focusedPanel = panel;
        localStorage.setItem('booklist_focused_panel', panel);

        const leftEl = document.getElementById('panel-left');
        const rightEl = document.getElementById('panel-right');

        if (leftEl && rightEl) {
            if (panel === 'left') {
                leftEl.classList.add('focused');
                rightEl.classList.remove('focused');
            } else {
                rightEl.classList.add('focused');
                leftEl.classList.remove('focused');
            }
        }
    },

    toggleSplitView() {
        this.splitEnabled = !this.splitEnabled;
        localStorage.setItem('booklist_split_enabled', this.splitEnabled ? '1' : '0');
        
        const btn = document.getElementById('nav-split');
        if (btn) {
            if (this.splitEnabled) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        
        if (this.splitEnabled) {
            this.renderSplitPanels();
        } else {
            const main = document.getElementById('main-content');
            if (main) main.innerHTML = '';
            
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.querySelector(`.nav-item[data-page="${this.currentPage}"]`)?.classList.add('active');
            this.renderPage(this.currentPage);
        }
    },

    updateSplitNavActiveStates() {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${this.leftPage}"]`)?.classList.add('active');
        document.querySelector(`.nav-item[data-page="${this.rightPage}"]`)?.classList.add('active');
    },
    renderDashboardLegacy(main) {
        const bks = Storage.getBookmarks().filter(b => this.contextMatches('bookmark', b));
        const notes = Storage.getNotes().filter(n => this.contextMatches('note', n));
        const widgets = Storage.getHomeWidgets();
        const showWidget = key => widgets[key] !== false;
        const bkFolders = Storage.getBkFolders(), ntFolders = Storage.getNtFolders();
        const bkCats = Storage.getBkCategories();
        const recentBks = [...bks].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
        const recentNotes = [...notes].sort((a,b) => new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,4);
        const inboxLinks = bks.filter(b => b.inbox).length;
        const inboxNotes = notes.filter(n => n.inbox).length;
        const cockpitHtml = showWidget('cockpit') ? `
            <div class="dash-section dash-activity power-cockpit">
                <div class="dash-section-header"><h2><span class="section-icon">&#9638;</span>Power Cockpit</h2><button class="btn btn-sm btn-primary" onclick="FeatureHub.currentTab='cockpit';App.navigate('power')">Abrir &#8599;</button></div>
                <div class="feature-grid">
                    <div class="feature-card cockpit-card cockpit-blue" onclick="FeatureHub.currentTab='inbox';App.navigate('power')" title="Links e notas capturados/importados que ainda nao foram processados"><h3><span>&#9993;</span>Capturas a organizar</h3><p>${inboxLinks + inboxNotes} <small>${inboxLinks} link(s) · ${inboxNotes} nota(s)</small></p><i></i></div>
                    <div class="feature-card cockpit-card cockpit-purple"><h3><span>&#8635;</span>Revisao</h3><p>${(Storage.getStudy().queue || []).filter(q => Date.parse(q.dueAt || 0) <= Date.now()).length} <small>vencido(s)</small></p><i></i></div>
                    <div class="feature-card cockpit-card cockpit-green"><h3><span>&#128193;</span>Projetos</h3><p>${Storage.getProjects().filter(p => p.status !== 'done').length} <small>ativo(s)</small></p><i></i></div>
                </div>
            </div>` : '';
        const statsHtml = showWidget('stats') ? `
            <div class="stats-grid">
                <div class="stat-card stat-red" onclick="App.navigate('bookmarks')"><div class="stat-icon">&#128278;</div><div class="stat-info"><div class="stat-number">${bks.length}</div><div class="stat-label">Bookmarks</div><div class="stat-wave"></div></div></div>
                <div class="stat-card stat-orange" onclick="App.navigate('notes')"><div class="stat-icon">&#128221;</div><div class="stat-info"><div class="stat-number">${notes.length}</div><div class="stat-label">Notas</div><div class="stat-wave"></div></div></div>
                <div class="stat-card stat-green"><div class="stat-icon">&#128193;</div><div class="stat-info"><div class="stat-number">${bkFolders.length+ntFolders.length}</div><div class="stat-label">Pastas</div><div class="stat-wave"></div></div></div>
                <div class="stat-card stat-violet"><div class="stat-icon">&#9734;</div><div class="stat-info"><div class="stat-number">${bks.filter(b=>b.favorite).length}</div><div class="stat-label">Favoritos</div><div class="stat-wave"></div></div></div>
            </div>` : '';
        const activityHtml = showWidget('activity') ? `
            <div class="dash-section dash-activity study-rhythm"><div class="dash-section-header"><h2><span class="section-icon">&#9618;</span>Ritmo de estudo</h2><button class="btn btn-sm btn-primary" onclick="FeatureHub.currentTab='calendar';App.navigate('power')">Abrir heatmap &#8599;</button></div>
                <div class="heatmap mini">${FeatureHub.getActivityDays(84).map(d => `<span class="heat-cell heat-${d.level}" title="${d.label}: ${d.count} atividade(s)"></span>`).join('')}</div>
            </div>` : '';
        const linksHtml = showWidget('recentLinks') ? `
                <div class="dash-section"><div class="dash-section-header"><h2>Links Recentes</h2><button class="btn btn-sm btn-primary" onclick="App.navigate('bookmarks')">Ver todos</button></div>
                <div class="dash-recent-grid">${recentBks.length ? recentBks.map(bk => {
                    const cat = bkCats.find(c => (bk.categoryIds||[]).includes(c.id)) || {icon:'',color:'#78909C'};
                    let fav; try{fav=`https://www.google.com/s2/favicons?domain=${new URL(bk.url).hostname}&sz=32`}catch{fav=''}
                    return `<a href="${this.escapeHtml(bk.url)}" target="_blank" rel="noopener noreferrer" class="dash-link-card" onclick="Storage.recordBookmarkOpen('${bk.id}')"><img class="dash-link-favicon" src="${fav}" alt="" onerror="this.style.display='none'"><div class="dash-link-info"><span class="dash-link-title">${this.escapeHtml(bk.title || 'Sem título')}</span><span class="dash-link-cat" style="--cat-color:${cat.color}">${cat.icon}</span></div></a>`;
                }).join('') : '<p class="text-muted">Nenhum bookmark. <a href="#" onclick="App.navigate(\'bookmarks\')">Adicionar</a></p>'}</div></div>` : '';
        const notesHtml = showWidget('recentNotes') ? `
                <div class="dash-section"><div class="dash-section-header"><h2>Notas Recentes</h2><button class="btn btn-sm btn-primary" onclick="App.navigate('notes')">Ver todas</button></div>
                <div class="dash-notes-grid">${recentNotes.length ? recentNotes.map(n => {
                    const preview = this.escapeHtml(this.stripHtml(n.content || '').substring(0,80));
                    return `<div class="dash-note-card" onclick="App.navigate('notes');setTimeout(()=>Notes.openEditor('${n.id}'),100)"><h4>${n.pinned?'Fixada: ':''}${this.escapeHtml(n.title || 'Sem título')}</h4><p>${preview}...</p><span class="note-date">${new Date(n.updatedAt).toLocaleDateString('pt-BR')}</span></div>`;
                }).join('') : '<p class="text-muted">Nenhuma nota. <a href="#" onclick="App.navigate(\'notes\')">Criar</a></p>'}</div></div>` : '';
        const quickHtml = showWidget('quickActions') ? `
            <div class="dash-quick-actions"><h3>Acoes Rapidas</h3><div class="quick-actions-grid">
                <button class="quick-action-btn" onclick="App.navigate('bookmarks');setTimeout(()=>Bookmarks.showAddModal(),100)">Novo Bookmark</button>
                <button class="quick-action-btn" onclick="App.navigate('notes');setTimeout(()=>Notes.showCreateModal(),100)">Nova Nota</button>
                <button class="quick-action-btn" onclick="Storage.exportAll()">Backup</button>
                <button class="quick-action-btn" onclick="App.navigate('power')">Power Hub</button>
                <button class="quick-action-btn" onclick="App.navigate('settings')">Configuracoes</button>
            </div></div>` : '';
        main.innerHTML = `
        <div class="dashboard">
            <div class="dash-topbar"><div></div><div class="dash-user-actions"><button class="btn-icon" title="Notificacoes">&#128276;</button><button class="user-avatar" title="Perfil">U<span></span></button></div></div>
            <div class="dash-welcome"><p class="welcome-kicker">Bem-vindo de volta! &#128075;</p><h1>Bem-vindo ao <span class="gradient-text">BookList</span></h1><p>Seu centro de organizacao pessoal: links, notas e ideias em um so lugar.</p></div>
            <div class="global-search-panel">
                <div class="search-box global-search-box"><span class="search-icon">&#128269;</span><input id="global-search-input" type="text" placeholder="Busca fuzzy em todo o sistema..." oninput="App.globalSearchDebounced(this.value)"><kbd>Ctrl + K</kbd></div>
                <div class="global-search-results" id="global-search-results"></div>
            </div>
            ${cockpitHtml}
            ${statsHtml}
            ${activityHtml}
            ${(linksHtml || notesHtml) ? `<div class="dash-sections">${linksHtml}${notesHtml}</div>` : ''}
            ${quickHtml}
        </div>`;
    },
    renderDashboard(main) {
        const today = new Date();
        const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        const bks = Storage.getBookmarks().filter(b => this.contextMatches('bookmark', b));
        const notes = Storage.getNotes().filter(n => this.contextMatches('note', n));
        const focus = Storage.getDailyFocus();
        const recentNotes = [...notes].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 5);
        const recentLinks = [...bks].sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt)).slice(0, 5);
        const projects = Storage.getProjects().filter(p => p.status !== 'done').slice(0, 4);
        const vault = Storage.getVaultSettings();
        const complete = focus.filter(item => item.done).length;
        const itemRow = item => `<li class="today-priority ${item.done ? 'is-done' : ''}">
            <label><input type="checkbox" ${item.done ? 'checked' : ''} onchange="App.toggleDailyFocus('${item.id}', this.checked)"><span>${this.escapeHtml(item.title)}</span></label>
            <button class="today-row-action" title="Remover" onclick="App.removeDailyFocus('${item.id}')">×</button>
        </li>`;
        const noteRow = note => `<button class="today-recent-row" onclick="App.navigate('notes');setTimeout(()=>Notes.openEditor('${note.id}'),100)"><span class="today-row-icon">▤</span><span>${this.escapeHtml(note.title || 'Sem título')}</span><time>${new Date(note.updatedAt || note.createdAt).toLocaleDateString('pt-BR')}</time></button>`;
        const linkRow = link => {
            let domain = 'link'; try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch (_) {}
            return `<a class="today-recent-row" href="${this.escapeHtml(link.url || '#')}" target="_blank" rel="noopener noreferrer" onclick="Storage.recordBookmarkOpen('${link.id}')"><span class="today-row-icon">↗</span><span>${this.escapeHtml(link.title || 'Sem título')}</span><time>${this.escapeHtml(domain)}</time></a>`;
        };
        main.innerHTML = `<div class="dashboard dashboard-today">
            <header class="today-header">
                <div><h1>Hoje</h1><p>${this.escapeHtml(dateLabel)}</p></div>
                <div class="today-header-actions"><button class="btn-icon" onclick="App.navigate('settings')" title="Configurações">⚙</button><button class="today-vault-status ${Storage.isVaultUnlocked() ? 'is-open' : ''}" onclick="App.openVault()" title="Abrir cofre">${Storage.isVaultUnlocked() ? '◉' : '◌'} <span>${Storage.isVaultUnlocked() ? 'Cofre aberto' : vault.enabled ? 'Cofre protegido' : 'Proteger dados'}</span></button></div>
            </header>
            <div class="today-layout">
                <section class="today-main">
                    <form class="today-capture" onsubmit="App.quickCapture(event)"><span>✎</span><input id="today-capture-input" autocomplete="off" placeholder="Capturar algo..."><button type="submit" aria-label="Salvar captura">→</button></form>
                    <section class="today-section"><div class="today-section-head"><div><h2>Prioridades</h2><p>${focus.length ? `${complete} de ${focus.length} concluída(s)` : 'Defina o foco do seu dia'}</p></div><button class="today-text-action" onclick="App.addDailyFocus()">+ Adicionar</button></div>
                        <ul class="today-priority-list">${focus.length ? focus.map(itemRow).join('') : '<li class="today-empty">Nenhuma prioridade por enquanto.</li>'}</ul>
                    </section>
                    <div class="today-recent-columns">
                        <section class="today-section"><div class="today-section-head"><h2>Notas recentes</h2><button class="today-text-action" onclick="App.navigate('notes')">Ver todas</button></div><div class="today-recent-list">${recentNotes.length ? recentNotes.map(noteRow).join('') : '<p class="today-empty">Nenhuma nota recente.</p>'}</div></section>
                        <section class="today-section"><div class="today-section-head"><h2>Links recentes</h2><button class="today-text-action" onclick="App.navigate('bookmarks')">Ver todos</button></div><div class="today-recent-list">${recentLinks.length ? recentLinks.map(linkRow).join('') : '<p class="today-empty">Nenhum link recente.</p>'}</div></section>
                    </div>
                </section>
                <aside class="today-agenda"><div class="today-section-head"><div><h2>Em andamento</h2><p>Projetos ativos</p></div><button class="today-text-action" onclick="FeatureHub.currentTab='projects';App.navigate('power')">Abrir</button></div>
                    <div class="today-project-list">${projects.length ? projects.map(p => `<button class="today-project-row" onclick="FeatureHub.currentTab='projects';App.navigate('power')"><span style="--project-color:${this.escapeHtml(p.color || '#6f7cff')}"></span><div><strong>${this.escapeHtml(p.name)}</strong><small>${this.escapeHtml(p.status || 'ativo')}</small></div><b>${(p.items || []).length}</b></button>`).join('') : '<p class="today-empty">Sem projetos ativos.</p>'}</div>
                    <div class="today-agenda-footer"><button onclick="App.navigate('notes');setTimeout(()=>Notes.showCreateModal(),100)">+ Nova nota</button><button onclick="App.navigate('bookmarks');setTimeout(()=>Bookmarks.showAddModal(),100)">+ Novo link</button></div>
                </aside>
            </div>
        </div>`;
    },
    quickCapture(event) {
        event.preventDefault();
        const input = document.getElementById('today-capture-input');
        const text = input?.value.trim();
        if (!text) return;
        const isUrl = /^https?:\/\//i.test(text);
        if (isUrl) Storage.addBookmark({ title: text.replace(/^https?:\/\//, '').slice(0, 80), url: text, folderId: 'default', inbox: true, readingStatus: 'novo' });
        else Storage.addNote({ title: text.slice(0, 80), content: `<p>${this.escapeHtml(text)}</p>`, folderId: 'default', inbox: true, status: 'ideias' });
        this.toast(isUrl ? 'Link capturado na Inbox.' : 'Nota capturada na Inbox.', 'success');
        input.value = '';
        this.renderPage('dashboard');
    },
    async addDailyFocus() {
        const title = await BookListDialogs.prompt('Qual é a prioridade?', '', { title: 'Nova prioridade diária', placeholder: 'Ex.: concluir relatório' });
        if (!title?.trim()) return;
        Storage.addDailyFocus(title);
        this.renderPage('dashboard');
    },
    toggleDailyFocus(id, done) { Storage.updateDailyFocus(id, { done }); this.renderPage('dashboard'); },
    removeDailyFocus(id) { Storage.deleteDailyFocus(id); this.renderPage('dashboard'); },
    openVault() {
        this.currentPage = 'vault';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector('.nav-item[data-page="vault"]')?.classList.add('active');
        this.renderPage('vault');
    },
    renderVaultPage(main) {
        const vault = Storage.getVaultSettings();
        const unlocked = Storage.isVaultUnlocked();
        if (!unlocked) {
            main.innerHTML = `<div class="vault-page vault-locked-page"><section class="vault-lock-card"><div class="vault-lock-mark">⌾</div><p class="vault-overline">Área protegida</p><h1>${vault.enabled ? 'Cofre bloqueado' : 'Criar Cofre'}</h1><p>${vault.enabled ? 'Desbloqueie para acessar sua biblioteca privada.' : 'Defina uma senha mestre para criar sua área privada.'}</p><form onsubmit="App.unlockVaultPage(event)"><input id="vault-page-password" type="password" required minlength="4" autocomplete="current-password" placeholder="Senha mestre" autofocus>${vault.totpEnabled ? '<input id="vault-2fa" inputmode="numeric" maxlength="6" placeholder="PIN de 6 dígitos">' : ''}<button class="btn btn-primary" type="submit">${vault.enabled ? 'Desbloquear Cofre' : 'Criar Cofre'}</button></form><small>O conteúdo permanece oculto até o desbloqueio.</small></section></div>`;
            return;
        }
        const folders = Storage.getVaultFolders();
        const categories = Storage.getVaultCategories();
        const notes = Storage.getNotes({ includePrivate: true }).filter(item => item.isPrivate).map(item => ({ ...item, type: 'note', preview: this.stripHtml(item.content || '') }));
        const links = Storage.getBookmarks({ includePrivate: true }).filter(item => item.isPrivate).map(item => ({ ...item, type: 'bookmark', preview: item.description || item.url || '' }));
        const items = [...notes, ...links].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        const folderName = id => folders.find(folder => folder.id === id)?.name || 'Sem pasta';
        const tagNames = item => [...(item.vaultTags || []), ...(item.categoryIds || []).map(id => categories.find(category => category.id === id)?.name).filter(Boolean)];
        const card = item => {
            const tags = tagNames(item);
            const search = `${item.title || ''} ${item.preview || ''} ${tags.join(' ')} ${folderName(item.folderId)}`.toLowerCase();
            return `<article class="vault-library-card" data-search="${this.escapeHtml(search)}" data-type="${item.type}" data-folder="${this.escapeHtml(item.folderId || 'default')}" data-categories="${this.escapeHtml((item.categoryIds || []).join(' '))}"><div class="vault-card-preview ${item.type}"><span>${item.type === 'note' ? '▤' : '↗'}</span><small>${item.type === 'note' ? 'Nota' : 'Link'}</small></div><div class="vault-card-body"><div class="vault-card-meta"><span>${this.escapeHtml(folderName(item.folderId))}</span><time>${new Date(item.updatedAt || item.createdAt).toLocaleDateString('pt-BR')}</time></div><h3>${this.escapeHtml(item.title || 'Sem título')}</h3><p>${this.escapeHtml(String(item.preview || 'Sem prévia').slice(0, 130))}</p><div class="vault-card-tags">${tags.map(tag => `<span>${this.escapeHtml(tag)}</span>`).join('')}</div></div><div class="vault-card-actions"><button class="btn btn-secondary btn-sm" onclick="App.showVaultEditor('${item.type}','${item.id}')">Editar</button>${item.type === 'bookmark' ? `<button class="vault-open-action" title="Visitar link" onclick="App.openVaultBookmark('${item.id}')">↗</button>` : ''}<button class="vault-public-action" title="Excluir" onclick="App.deleteVaultItem('${item.type}','${item.id}')">×</button></div></article>`;
        };
        const folderEntry = folder => `<div class="vault-taxonomy-row"><button class="${this.vaultFilter.folderId === folder.id ? 'active' : ''}" onclick="App.setVaultFilter('folderId','${folder.id}')"><i style="--folder-color:${this.escapeHtml(folder.color || '#6f7cff')}"></i>${this.escapeHtml(folder.name)}</button><button class="vault-taxonomy-delete" title="Excluir pasta" onclick="App.deleteVaultTaxonomy('folder','${folder.id}')">×</button></div>`;
        const categoryEntry = category => `<div class="vault-taxonomy-row"><button class="${this.vaultFilter.categoryId === category.id ? 'active' : ''}" onclick="App.setVaultFilter('categoryId','${category.id}')"><i style="--folder-color:${this.escapeHtml(category.color || '#a78bfa')}"></i>${this.escapeHtml(category.name)}</button><button class="vault-taxonomy-delete" title="Excluir categoria" onclick="App.deleteVaultTaxonomy('category','${category.id}')">×</button></div>`;
        main.innerHTML = `<div class="vault-page"><header class="vault-page-header"><div><p class="vault-overline">Área protegida</p><h1>Cofre</h1><p>Biblioteca privada organizada e disponível apenas nesta sessão.</p></div><div class="vault-header-actions"><span class="vault-session-status">● Protegido</span><button class="btn btn-secondary btn-sm" onclick="App.navigate('vault-media')">Mídias</button><button class="btn btn-secondary btn-sm" onclick="App.showVaultEditor('note')">+ Nota</button><button class="btn btn-secondary btn-sm" onclick="App.showVaultEditor('bookmark')">+ Link</button><button class="btn btn-secondary" onclick="App.lockVaultPage()">Trancar</button></div></header><div class="vault-shell"><aside class="vault-taxonomy"><section><div class="vault-taxonomy-head"><h2>Pastas</h2><button onclick="App.showVaultTaxonomyEditor('folder')">+</button></div><div class="vault-taxonomy-row"><button class="${this.vaultFilter.folderId === 'all' ? 'active' : ''}" onclick="App.setVaultFilter('folderId','all')">Todos os itens</button></div>${folders.map(folderEntry).join('') || '<p>Sem pastas.</p>'}</section><section><div class="vault-taxonomy-head"><h2>Categorias</h2><button onclick="App.showVaultTaxonomyEditor('category')">+</button></div><div class="vault-taxonomy-row"><button class="${this.vaultFilter.categoryId === 'all' ? 'active' : ''}" onclick="App.setVaultFilter('categoryId','all')">Todas as categorias</button></div>${categories.map(categoryEntry).join('') || '<p>Sem categorias.</p>'}</section></aside><div class="vault-library"><div class="vault-toolbar"><div class="vault-search"><span>⌕</span><input id="vault-library-search" placeholder="Buscar no cofre..." oninput="App.filterVaultLibrary(this.value)"></div><select id="vault-type-filter" onchange="App.filterVaultLibrary(document.getElementById('vault-library-search').value)"><option value="all">Todos os itens</option><option value="note">Notas</option><option value="bookmark">Links</option></select><span class="vault-count">${items.length} item(ns)</span></div><div class="vault-library-grid">${items.length ? items.map(card).join('') : '<div class="vault-empty"><strong>Seu cofre está pronto.</strong><p>Crie uma nota ou um link privado para começar sua biblioteca.</p></div>'}</div></div></div></div>`;
        const importInput = document.createElement('input');
        importInput.id = 'vault-bookmark-import';
        importInput.type = 'file';
        importInput.accept = '.html,.htm,text/html';
        importInput.hidden = true;
        importInput.addEventListener('change', () => this.importVaultBookmarks(importInput));
        const importButton = document.createElement('button');
        importButton.className = 'btn btn-secondary btn-sm';
        importButton.textContent = 'Importar links';
        importButton.addEventListener('click', () => importInput.click());
        document.querySelector('.vault-header-actions')?.insertBefore(importButton, document.querySelector('.vault-header-actions .btn:last-child'));
        document.querySelector('.vault-header-actions')?.appendChild(importInput);
        this.filterVaultLibrary();
    },
    async unlockVaultPage(event) {
        event.preventDefault();
        try {
            const password = document.getElementById('vault-page-password')?.value || '';
            if (Storage.getVaultSettings().enabled) await Storage.unlockVault(password);
            else await Storage.setupVault(password);
            this.toast('Cofre desbloqueado.', 'success');
            this.renderPage('vault');
        } catch (error) { this.toast(error.message || 'Não foi possível desbloquear o cofre.', 'error'); }
    },
    lockVaultPage() { Storage.lockVault(); this.renderPage('vault'); },
    openVaultBookmark(id) {
        const item = Storage.getBookmarks({ includePrivate: true }).find(bookmark => bookmark.id === id && bookmark.isPrivate);
        if (item?.url) window.open(item.url, '_blank', 'noopener');
    },
    async importVaultBookmarks(input) {
        const file = input?.files?.[0];
        if (!file) return;
        try {
            if (!Storage.isVaultUnlocked()) throw new Error('Desbloqueie o Cofre primeiro.');
            if (file.size > 10 * 1024 * 1024) throw new Error('Escolha um arquivo de favoritos de até 10 MB.');
            const parsed = new DOMParser().parseFromString(await file.text(), 'text/html');
            const existing = new Set(Storage.getBookmarks({ includePrivate: true }).filter(item => item.isPrivate).map(item => String(item.url || '').trim().toLowerCase()));
            const links = Array.from(parsed.querySelectorAll('a[href]')).map(anchor => ({ title: anchor.textContent.trim(), url: anchor.getAttribute('href')?.trim() || '' })).filter(link => UI.isSafeUrl(link.url));
            let imported = 0, skipped = 0;
            for (const link of links) {
                const key = link.url.toLowerCase();
                if (existing.has(key)) { skipped++; continue; }
                await Storage.savePrivateItem('bookmark', { title: link.title || link.url, url: link.url, description: 'Importado do navegador', folderId: 'default', categoryIds: [], vaultTags: ['importado'] });
                existing.add(key); imported++;
            }
            this.renderPage('vault');
            this.toast(`${imported} link(s) importado(s) para o Cofre${skipped ? ` · ${skipped} duplicado(s) ignorado(s)` : ''}.`, imported ? 'success' : 'info');
        } catch (error) { this.toast(error.message || 'Não foi possível importar os links.', 'error'); }
        finally { input.value = ''; }
    },
    showVaultEditor(type, id = '') {
        const isNote = type === 'note';
        const source = isNote ? Storage.getNotes({ includePrivate: true }) : Storage.getBookmarks({ includePrivate: true });
        const item = id ? source.find(entry => entry.id === id && entry.isPrivate) : null;
        if (id && !item) return this.toast('Item privado não encontrado.', 'error');
        const folders = Storage.getVaultFolders();
        const categories = Storage.getVaultCategories();
        const tags = (item?.vaultTags || []).join(', ');
        this.showModal(`${id ? 'Editar' : 'Nova'} ${isNote ? 'nota' : 'link'} privada`, `<form class="module-form vault-editor-form" onsubmit="App.saveVaultItem(event, '${type}', '${id}')"><div class="form-group"><label>Título</label><input id="vault-editor-title" required maxlength="160" value="${this.escapeHtml(item?.title || '')}" placeholder="Título"></div>${isNote ? `<div class="form-group"><label>Conteúdo</label><textarea id="vault-editor-content" rows="11" placeholder="Escreva sua nota privada...">${this.escapeHtml(item?.content || '')}</textarea></div>` : `<div class="form-group"><label>URL</label><input id="vault-editor-url" type="url" required value="${this.escapeHtml(item?.url || '')}" placeholder="https://..."></div><div class="form-group"><label>Descrição</label><textarea id="vault-editor-description" rows="5" placeholder="Prévia ou observações">${this.escapeHtml(item?.description || '')}</textarea></div>`}<div class="form-row"><div class="form-group"><label>Pasta do Cofre</label><select id="vault-editor-folder"><option value="default">Sem pasta</option>${folders.map(folder => `<option value="${this.escapeHtml(folder.id)}" ${item?.folderId === folder.id ? 'selected' : ''}>${this.escapeHtml(folder.name)}</option>`).join('')}</select></div><div class="form-group"><label>Tags</label><input id="vault-editor-tags" value="${this.escapeHtml(tags)}" placeholder="ex.: filme, favorito, privado"></div></div><div class="form-group"><label>Categorias do Cofre</label><div class="vault-category-picker" id="vault-editor-categories">${categories.map(category => `<label><input type="checkbox" value="${this.escapeHtml(category.id)}" ${(item?.categoryIds || []).includes(category.id) ? 'checked' : ''}><i style="--category-color:${this.escapeHtml(category.color || '#a78bfa')}"></i>${this.escapeHtml(category.name)}</label>`).join('') || '<small>Crie categorias na lateral para classificá-la.</small>'}</div></div><div class="form-actions">${id ? `<button type="button" class="btn btn-danger" onclick="App.closeModal();App.deleteVaultItem('${type}','${id}')">Apagar</button>` : ''}<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar no Cofre</button></div></form>`);
    },
    async saveVaultItem(event, type, id = '') {
        event.preventDefault();
        const tags = (document.getElementById('vault-editor-tags')?.value || '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20);
        const categoryIds = [...document.querySelectorAll('#vault-editor-categories input:checked')].map(input => input.value);
        const data = { title: document.getElementById('vault-editor-title')?.value.trim() || (type === 'note' ? 'Nota privada' : 'Link privado'), folderId: document.getElementById('vault-editor-folder')?.value || 'default', categoryIds, vaultTags: tags };
        if (type === 'note') data.content = document.getElementById('vault-editor-content')?.value || '';
        else { data.url = document.getElementById('vault-editor-url')?.value.trim() || ''; data.description = document.getElementById('vault-editor-description')?.value || ''; }
        try { await Storage.savePrivateItem(type, data, id); this.renderPage('vault'); this.closeModal(); this.toast(id ? 'Item privado atualizado.' : 'Item criado no Cofre.', 'success'); }
        catch (error) { this.toast(error.message || 'Não foi possível salvar o item.', 'error'); }
    },
    async deleteVaultItem(type, id) {
        if (!await BookListDialogs.confirm('Apagar este item privado? Esta ação não pode ser desfeita.', { title: 'Excluir item do Cofre', confirmText: 'Apagar' })) return;
        try { Storage.deletePrivateItem(type, id); this.toast('Item privado apagado.', 'info'); this.renderPage('vault'); }
        catch (error) { this.toast(error.message || 'Não foi possível apagar o item.', 'error'); }
    },
    showVaultTaxonomyEditor(type) {
        const label = type === 'folder' ? 'pasta' : 'categoria';
        this.showModal(`Nova ${label} do Cofre`, `<form class="module-form" onsubmit="App.saveVaultTaxonomy(event, '${type}')"><div class="form-group"><label>Nome</label><input id="vault-taxonomy-name" required maxlength="80" placeholder="Nome da ${label}"></div><div class="form-group"><label>Cor</label><input id="vault-taxonomy-color" type="color" value="${type === 'folder' ? '#6f7cff' : '#a78bfa'}"></div><div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" type="submit">Criar</button></div></form>`);
    },
    async saveVaultTaxonomy(event, type) {
        event.preventDefault();
        const data = { name: document.getElementById('vault-taxonomy-name')?.value.trim(), color: document.getElementById('vault-taxonomy-color')?.value };
        try { if (type === 'folder') await Storage.addVaultFolder(data); else await Storage.addVaultCategory(data); this.closeModal(); this.renderPage('vault'); this.toast(`${type === 'folder' ? 'Pasta' : 'Categoria'} criada no Cofre.`, 'success'); }
        catch (error) { this.toast(error.message || 'Não foi possível salvar.', 'error'); }
    },
    async deleteVaultTaxonomy(type, id) {
        if (!await BookListDialogs.confirm(`Excluir esta ${type === 'folder' ? 'pasta' : 'categoria'} do Cofre?`, { title: 'Excluir organização do Cofre', confirmText: 'Excluir' })) return;
        const folders = Storage.getVaultFolders().filter(item => !(type === 'folder' && item.id === id));
        const categories = Storage.getVaultCategories().filter(item => !(type === 'category' && item.id === id));
        try { await Storage.saveVaultLibrary({ folders, categories }); if (type === 'folder' && this.vaultFilter.folderId === id) this.vaultFilter.folderId = 'all'; if (type === 'category' && this.vaultFilter.categoryId === id) this.vaultFilter.categoryId = 'all'; this.renderPage('vault'); }
        catch (error) { this.toast(error.message || 'Não foi possível excluir.', 'error'); }
    },
    async removeFromVault(type, id) {
        try { await Storage.makePublic(type, id); this.toast('Item removido do cofre.', 'info'); this.renderPage('vault'); }
        catch (error) { this.toast(error.message || 'Não foi possível alterar o item.', 'error'); }
    },
    filterVaultLibrary(value = '') {
        const query = String(value).trim().toLowerCase();
        const type = document.getElementById('vault-type-filter')?.value || 'all';
        document.querySelectorAll('.vault-library-card').forEach(card => {
            const matchesText = !query || (card.dataset.search || '').includes(query);
            const matchesType = type === 'all' || card.dataset.type === type;
            const matchesFolder = this.vaultFilter.folderId === 'all' || card.dataset.folder === this.vaultFilter.folderId;
            const matchesCategory = this.vaultFilter.categoryId === 'all' || (card.dataset.categories || '').split(' ').includes(this.vaultFilter.categoryId);
            card.hidden = !(matchesText && matchesType && matchesFolder && matchesCategory);
        });
    },
    setVaultFilter(key, value) { this.vaultFilter[key] = value; this.renderPage('vault'); },
    renderVaultTrackerPage(main) {
        if (!Storage.isVaultUnlocked()) return this.renderVaultPage(main);
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelector('.nav-item[data-page="vault"]')?.classList.add('active');
        const items = [...Storage.getVaultTracker()].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        const categories = PersonalHub.trackerCategories();
        const stats = PersonalHub.trackerStats(items);
        const card = item => {
            const current = Number(item.currentChapter || 0), latest = Number(item.latestChapter || 0);
            const pending = latest > current;
            const pct = PersonalHub.trackerProgress(item);
            return `<article class="vault-media-card" data-title="${this.escapeHtml(item.title || '')}" data-type="${this.escapeHtml(item.type || '')}" data-status="${this.escapeHtml(item.status || '')}"><div class="vault-media-card-head"><span>${item.favorite ? '★' : '◈'}</span><div><h3>${this.escapeHtml(item.title || 'Obra sem título')}</h3><p>${this.escapeHtml(item.type || 'obra')} · ${this.escapeHtml(item.status || 'lendo')}${item.rating ? ` · ${this.escapeHtml(item.rating)}/10` : ''}</p></div></div><div class="vault-media-progress"><span style="width:${pct}%"></span></div><p class="vault-media-meta">Progresso ${current}${latest ? ` de ${latest}` : ''}${pending ? ` · faltam ${latest - current}` : ' · em dia'}</p>${item.note ? `<p class="vault-media-note">${this.escapeHtml(item.note).slice(0, 150)}</p>` : ''}<div class="vault-media-actions"><button class="btn btn-sm btn-primary" onclick="App.bumpVaultTracker('${item.id}')">+1</button>${item.url ? `<button class="btn btn-sm btn-secondary" onclick="App.openVaultTrackerUrl('${item.id}')">Abrir</button>` : ''}<button class="btn btn-sm btn-secondary" onclick="App.showVaultTrackerModal('${item.id}')">Editar</button><button class="vault-public-action" title="Excluir" onclick="App.deleteVaultTracker('${item.id}')">×</button></div></article>`;
        };
        main.innerHTML = `<div class="vault-page vault-media-page"><header class="vault-page-header"><div><p class="vault-overline">Área protegida</p><h1>Mídias</h1><p>Tracker privado de animes, mangás, filmes, séries, livros e outras obras.</p></div><div class="vault-header-actions"><span class="vault-session-status">● Protegido</span><button class="btn btn-secondary btn-sm" onclick="App.navigate('vault')">Biblioteca</button><button class="btn btn-primary btn-sm" onclick="App.showVaultTrackerModal()">+ Nova obra</button><button class="btn btn-secondary" onclick="App.lockVaultPage()">Trancar</button></div></header><div class="vault-media-stats"><div><strong>${stats.total}</strong><span>Obras</span></div><div><strong>${stats.reading}</strong><span>Em andamento</span></div><div><strong>${stats.pending}</strong><span>Pendentes</span></div><div><strong>${stats.favorites}</strong><span>Favoritas</span></div></div><div class="vault-media-toolbar"><input id="vault-media-search" placeholder="Buscar por título..." oninput="App.filterVaultTracker()"><select id="vault-media-status" onchange="App.filterVaultTracker()"><option value="">Todos os status</option>${['lendo','assistindo','em lancamento','hiato','finalizado','pausado','dropado','quero ler','quero assistir','assistido'].map(status => `<option value="${status}">${status}</option>`).join('')}</select></div><div class="vault-media-tabs"><button class="active" data-category="all" onclick="App.setVaultMediaCategory('all')">Tudo <span>${items.length}</span></button>${categories.map(category => `<button data-category="${category.id}" onclick="App.setVaultMediaCategory('${category.id}')">${category.icon} ${category.label} <span>${items.filter(item => PersonalHub.trackerCategory(item.type) === category.id).length}</span></button>`).join('')}</div><div class="vault-media-grid" id="vault-media-list" data-category="all">${items.length ? items.map(card).join('') : '<div class="vault-empty"><strong>Seu tracker privado está vazio.</strong><p>Adicione uma obra para acompanhar seu progresso com discrição.</p></div>'}</div></div>`;
    },
    filterVaultTracker() {
        const query = (document.getElementById('vault-media-search')?.value || '').toLowerCase().trim();
        const status = document.getElementById('vault-media-status')?.value || '';
        const category = document.getElementById('vault-media-list')?.dataset.category || 'all';
        document.querySelectorAll('.vault-media-card').forEach(card => {
            const matchesText = !query || (card.dataset.title || '').toLowerCase().includes(query);
            const matchesStatus = !status || card.dataset.status === status;
            const matchesCategory = category === 'all' || PersonalHub.trackerCategory(card.dataset.type || '') === category;
            card.hidden = !(matchesText && matchesStatus && matchesCategory);
        });
    },
    setVaultMediaCategory(category) {
        const list = document.getElementById('vault-media-list'); if (!list) return;
        list.dataset.category = category;
        document.querySelectorAll('.vault-media-tabs button').forEach(button => button.classList.toggle('active', button.dataset.category === category));
        this.filterVaultTracker();
    },
    showVaultTrackerModal(id = '') {
        const item = Storage.getVaultTracker().find(entry => entry.id === id) || {};
        const types = ['anime','manga','manhwa','manhua','filme','serie','livro','novel','web novel','quadrinho','outro'];
        const statuses = PersonalHub.trackerStatusOptions(item.type || 'manga');
        this.showModal(id ? 'Editar mídia privada' : 'Nova mídia privada', `<form class="module-form vault-editor-form" onsubmit="App.saveVaultTracker(event, '${id}')"><div class="form-group"><label>Título</label><input id="vault-media-title" required value="${this.escapeHtml(item.title || '')}" placeholder="One Piece, Interestelar, The Last of Us..."></div><div class="form-row"><div class="form-group"><label>Tipo</label><select id="vault-media-type" onchange="App.refreshVaultTrackerTypeFields();App.refreshVaultTrackerStatusOptions()">${types.map(type => `<option value="${type}" ${type === (item.type || 'manga') ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="form-group"><label>Status</label><select id="vault-media-status-editor">${statuses.map(status => `<option value="${status}" ${status === (item.status || 'lendo') ? 'selected' : ''}>${status}</option>`).join('')}</select></div></div><div id="vault-media-type-fields">${this.vaultTrackerTypeFields(item.type || 'manga', item)}</div><div class="form-row"><div class="form-group"><label>Avaliação</label><input id="vault-media-rating" type="number" min="0" max="10" step=".5" value="${this.escapeHtml(item.rating || '')}"></div><label class="checkbox-row"><input type="checkbox" id="vault-media-favorite" ${item.favorite ? 'checked' : ''}> Favorito</label></div><div class="form-group"><label>Observações</label><textarea id="vault-media-note" rows="4" placeholder="Onde parei, arco atual, observações...">${this.escapeHtml(item.note || '')}</textarea></div><div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar no Cofre</button></div></form>`);
    },
    vaultTrackerTypeFields(type = 'manga', item = {}) {
        const normalized = PersonalHub.normalize(type);
        const isManga = ['manga', 'manhwa', 'manhua'].includes(normalized);
        const isEpisodic = ['anime', 'serie', 'série'].includes(normalized);
        const isBook = ['livro', 'novel', 'web novel', 'quadrinho'].includes(normalized);
        const hasProgress = isManga || isEpisodic || isBook;
        const currentLabel = isManga ? 'Capítulo atual' : isEpisodic ? 'Episódio atual' : 'Capítulo ou página atual';
        const latestLabel = isManga ? 'Último capítulo lançado' : isEpisodic ? 'Episódios lançados ou total' : 'Total de capítulos ou páginas';
        const primaryLinkLabel = isManga || isBook ? 'Link de leitura' : isEpisodic ? 'Link para assistir' : 'Onde assistir';
        const progress = hasProgress ? `<div class="form-row"><div class="form-group"><label>${currentLabel}</label><input id="vault-media-current" type="number" min="0" step="1" value="${this.escapeHtml(item.currentChapter || 0)}"></div><div class="form-group"><label>${latestLabel}</label><input id="vault-media-latest" type="number" min="0" step="1" value="${this.escapeHtml(item.latestChapter || '')}"></div></div>` : `<input id="vault-media-current" type="hidden" value="${this.escapeHtml(item.currentChapter || 0)}"><input id="vault-media-latest" type="hidden" value="${this.escapeHtml(item.latestChapter || '')}">`;
        const raw = isManga ? `<div class="form-group"><label>Link da raw / original</label><input id="vault-media-raw-url" value="${this.escapeHtml(item.rawUrl || '')}" placeholder="https://..."></div>` : `<input id="vault-media-raw-url" type="hidden" value="${this.escapeHtml(item.rawUrl || '')}">`;
        return `${progress}<div class="form-group"><label>${primaryLinkLabel}</label><input id="vault-media-url" value="${this.escapeHtml(item.url || '')}" placeholder="https://..."></div><div class="form-row">${raw}<div class="form-group"><label>Wiki / informações</label><input id="vault-media-wiki-url" value="${this.escapeHtml(item.wikiUrl || '')}" placeholder="https://..."></div></div>`;
    },
    refreshVaultTrackerTypeFields() {
        const type = document.getElementById('vault-media-type')?.value || 'manga';
        const field = id => document.getElementById(id)?.value || '';
        const target = document.getElementById('vault-media-type-fields');
        if (!target) return;
        target.innerHTML = this.vaultTrackerTypeFields(type, { currentChapter: field('vault-media-current'), latestChapter: field('vault-media-latest'), url: field('vault-media-url'), rawUrl: field('vault-media-raw-url'), wikiUrl: field('vault-media-wiki-url') });
    },
    refreshVaultTrackerStatusOptions() {
        const type = document.getElementById('vault-media-type')?.value || 'manga';
        const select = document.getElementById('vault-media-status-editor');
        if (!select) return;
        const current = select.value;
        const statuses = PersonalHub.trackerStatusOptions(type);
        select.innerHTML = statuses.map(status => `<option value="${status}" ${status === current ? 'selected' : ''}>${status}</option>`).join('');
    },
    async saveVaultTracker(event, id = '') {
        event.preventDefault();
        const current = Number(document.getElementById('vault-media-current')?.value || 0);
        const latestRaw = document.getElementById('vault-media-latest')?.value;
        const data = { title: document.getElementById('vault-media-title')?.value.trim(), type: document.getElementById('vault-media-type')?.value || 'manga', status: document.getElementById('vault-media-status-editor')?.value || 'lendo', currentChapter: current, latestChapter: latestRaw === '' ? current : Number(latestRaw || current), rating: document.getElementById('vault-media-rating')?.value || '', url: document.getElementById('vault-media-url')?.value.trim() || '', rawUrl: document.getElementById('vault-media-raw-url')?.value.trim() || '', wikiUrl: document.getElementById('vault-media-wiki-url')?.value.trim() || '', favorite: Boolean(document.getElementById('vault-media-favorite')?.checked), note: document.getElementById('vault-media-note')?.value || '' };
        if (!data.title) return this.toast('Digite o título da obra.', 'error');
        await Storage.saveVaultTrackerItem(data, id); this.closeModal(); this.renderPage('vault-media'); this.toast('Mídia salva no Cofre.', 'success');
    },
    async bumpVaultTracker(id) { const item = Storage.getVaultTracker().find(entry => entry.id === id); if (!item) return; const next = Number(item.currentChapter || 0) + 1; await Storage.saveVaultTrackerItem({ ...item, currentChapter: next, latestChapter: Math.max(Number(item.latestChapter || 0), next) }, id); this.renderPage('vault-media'); },
    openVaultTrackerUrl(id) {
        const item = Storage.getVaultTracker().find(entry => entry.id === id);
        if (item?.url && UI.isSafeUrl(item.url)) window.open(item.url, '_blank', 'noopener');
    },
    async deleteVaultTracker(id) { if (!await BookListDialogs.confirm('Apagar esta mídia privada?', { title: 'Excluir mídia do Cofre', confirmText: 'Apagar' })) return; await Storage.deleteVaultTrackerItem(id); this.renderPage('vault-media'); },
    renderBookmarksPage(main) {
        const foldersHidden = this.isPanelHidden('bk_folders');
        const folderWidth = this.getPanelWidth('bk_folders', 275);
        main.innerHTML = `
        <div class="page-bookmarks page-split-v2 ${foldersHidden ? 'folders-collapsed' : ''}" style="--bk-folders-width:${folderWidth}px">
            ${foldersHidden ? `<button class="panel-reveal panel-reveal-folders" onclick="App.togglePanel('bk_folders')" title="Mostrar pastas">&#128193;</button>` : ''}
            <div class="page-sidebar">
                <div class="sidebar-header"><h3>&#128193; Pastas</h3><div class="panel-actions"><button class="panel-action-btn" onclick="App.togglePanel('bk_folders')" title="Ocultar pastas">&#10094;</button></div></div>
                <ul id="bk-folders-list" class="folders-list"></ul>
            </div>
            <div class="panel-resizer" onpointerdown="App.startPanelResize(event,'bk_folders',220,440)" title="Arraste para ajustar"></div>
            <div class="page-main">
                <div class="page-toolbar"><div class="toolbar-left"><h2>&#128278; Bookmarks</h2><span class="count-badge" id="bk-count">0 links</span></div>
                <div class="toolbar-right"><div class="search-box"><span class="search-icon">&#128269;</span><input type="text" placeholder="Buscar links..." oninput="Bookmarks.searchDebounced(this.value)" id="bk-search"></div>
                <select class="sort-select" onchange="Bookmarks.setSort(this.value)"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="alpha">A-Z</option><option value="favorites">Favoritos</option></select>
                <button class="btn btn-secondary" onclick="Bookmarks.exportFiltered()">Exportar</button>
                <button class="btn btn-primary" onclick="Bookmarks.showAddModal()">+ Novo Link</button></div></div>
                <div class="category-filter" id="bk-category-filter"></div>
                <div class="bookmarks-grid" id="bookmarks-grid"></div>
            </div>
        </div>`;
        Bookmarks.init();
    },
    renderNotesPage(main) {
        const foldersHidden = this.isPanelHidden('nt_folders');
        const listHidden = this.isPanelHidden('notes_list');
        const folderWidth = this.getPanelWidth('nt_folders', 275);
        const listWidth = this.getPanelWidth('notes_list', 370);
        main.innerHTML = `
        <div class="page-notes page-split-v2 ${foldersHidden ? 'folders-collapsed' : ''} ${listHidden ? 'notes-list-collapsed' : ''}" style="--nt-folders-width:${folderWidth}px;--notes-list-width:${listWidth}px">
            ${foldersHidden ? `<button class="panel-reveal panel-reveal-folders" onclick="App.togglePanel('nt_folders')" title="Mostrar pastas">&#128193;</button>` : ''}
            ${listHidden ? `<button class="panel-reveal panel-reveal-notes" onclick="App.togglePanel('notes_list')" title="Mostrar lista de notas">&#128221;</button>` : ''}
            <div class="page-sidebar">
                <div class="sidebar-header"><h3>&#128193; Pastas</h3><div class="panel-actions"><button class="panel-action-btn" onclick="App.togglePanel('nt_folders')" title="Ocultar pastas">&#10094;</button></div></div>
                <ul id="nt-folders-list" class="folders-list"></ul>
            </div>
            <div class="panel-resizer" onpointerdown="App.startPanelResize(event,'nt_folders',220,440)" title="Arraste para ajustar"></div>
            <div class="page-main notes-layout">
                <div class="notes-list-panel">
                    <div class="page-toolbar compact"><div class="toolbar-left"><h3>&#128221; Notas</h3><span class="count-badge" id="nt-count">0 notas</span></div><div class="toolbar-right"><button class="panel-action-btn" onclick="App.togglePanel('notes_list')" title="Ocultar lista">&#10094;</button><button class="btn btn-secondary btn-sm" onclick="Notes.exportFiltered()" style="margin-right:4px">Exportar</button><button class="btn btn-secondary btn-sm" onclick="Notes.showTemplatesModal()" style="margin-right:4px">📋 Modelos</button><button class="btn btn-primary btn-sm" onclick="Notes.showCreateModal()">+ Nova</button></div></div>
                    <div class="search-box" style="margin:0 12px 12px"><span class="search-icon">&#128269;</span><input type="text" placeholder="Buscar notas..." oninput="Notes.searchDebounced(this.value)"></div>
                    <div class="category-filter compact" id="nt-category-filter"></div>
                    <div class="notes-list" id="notes-list-items"></div>
                </div>
                <div class="panel-resizer panel-resizer-notes" onpointerdown="App.startPanelResize(event,'notes_list',300,620)" title="Arraste para ajustar"></div>
                <div class="note-editor-panel" id="note-editor-area"><div class="empty-state"><div class="empty-icon">&#128221;</div><h3>Selecione uma nota</h3><p>Ou crie uma nova para começar!</p></div></div>
            </div>
        </div>`;
        Notes.init();
    },
    getProfessionalModules() {
        return {
            clients: { icon: '👥', title: 'Clientes', subtitle: 'CRM pessoal para contatos, histórico e observações.', noteTitle: 'Cliente', statusLabel: 'Situação', statuses: ['ativo','prospect','recorrente','inativo','arquivado'], template: '<h2>Dados</h2><p><strong>Nome:</strong> </p><p><strong>Telefone/WhatsApp:</strong> </p><p><strong>Endereço:</strong> </p><h2>Histórico</h2><ul><li></li></ul><h2>Observações</h2><p></p>', stats: ['Contatos', 'Histórico', 'Retornos'] },
            equipment: { icon: '💻', title: 'Equipamentos', subtitle: 'Cadastro de notebooks, PCs, impressoras, roteadores e peças.', noteTitle: 'Equipamento', statusLabel: 'Estado', statuses: ['em uso','em manutenção','com cliente','baixado','arquivado'], template: '<h2>Identificação</h2><p><strong>Tipo:</strong> </p><p><strong>Marca/modelo:</strong> </p><p><strong>Número de série:</strong> </p><h2>Configuração</h2><p><strong>CPU/RAM/SSD:</strong> </p><p><strong>Sistema:</strong> </p><h2>Histórico de manutenção</h2><ul><li></li></ul>', stats: ['Máquinas', 'Garantias', 'Histórico'] },
            tickets: { icon: '🔧', title: 'Atendimentos', subtitle: 'Ordens de serviço, diagnóstico, status, garantia e entrega.', noteTitle: 'Atendimento', statusLabel: 'Status', statuses: ['recebido','diagnóstico','orçamento','aguardando cliente','em execução','finalizado','garantia'], template: '<h2>Entrada</h2><p><strong>Cliente:</strong> </p><p><strong>Equipamento:</strong> </p><p><strong>Problema relatado:</strong> </p><h2>Diagnóstico</h2><p></p><h2>Solução aplicada</h2><p></p><h2>Etapas</h2><ul><li>Recebido</li><li>Diagnóstico</li><li>Orçamento</li><li>Finalizado</li></ul>', stats: ['Abertos', 'Hoje', 'Garantia'] },
            knowledge: { icon: '🧠', title: 'Base Técnica', subtitle: 'Wiki de erros, soluções, drivers, comandos e procedimentos.', noteTitle: 'Artigo técnico', statusLabel: 'Maturidade', statuses: ['rascunho','testado','validado','obsoleto','arquivado'], template: '<h2>Problema</h2><p></p><h2>Causa provável</h2><p></p><h2>Solução</h2><ol><li></li></ol><h2>Comandos/links</h2><pre><code></code></pre>', stats: ['Artigos', 'Soluções', 'Drivers'] },
            runbooks: { icon: '✅', title: 'Runbooks', subtitle: 'Checklists executáveis para formatação, backup, limpeza e entrega.', noteTitle: 'Runbook', statusLabel: 'Versão', statuses: ['rascunho','ativo','em revisão','aposentado'], template: '<h2>Objetivo</h2><p></p><h2>Checklist</h2><ul><li><input type="checkbox"> Backup feito</li><li><input type="checkbox"> Diagnóstico inicial</li><li><input type="checkbox"> Execução</li><li><input type="checkbox"> Testes finais</li><li><input type="checkbox"> Entrega ao cliente</li></ul>', stats: ['Checklists', 'Execuções', 'Padrões'] },
            budgets: { icon: '🧾', title: 'Orçamentos', subtitle: 'Serviços, peças, mão de obra, aprovação e comprovantes.', noteTitle: 'Orçamento', statusLabel: 'Situação', statuses: ['rascunho','enviado','aprovado','recusado','pago','cancelado'], template: '<p></p>', stats: ['Pendentes', 'Aprovados', 'Pagos'] },
            finance: { icon: '💰', title: 'Financeiro', subtitle: 'Entradas, gastos, lucro estimado e valores a receber.', noteTitle: 'Registro financeiro', statusLabel: 'Pagamento', statuses: ['pendente','recebido','pago','atrasado','cancelado'], template: '<h2>Movimento</h2><p><strong>Tipo:</strong> Entrada / Saída</p><p><strong>Valor:</strong> R$ </p><p><strong>Cliente/serviço:</strong> </p><p><strong>Data:</strong> </p><h2>Observações</h2><p></p>', stats: ['Receitas', 'Gastos', 'A receber'] },
            schedule: { icon: '📅', title: 'Agenda Técnica', subtitle: 'Visitas, entregas, retornos, garantias e revisões.', noteTitle: 'Evento técnico', statusLabel: 'Agenda', statuses: ['agendado','confirmado','remarcado','concluído','cancelado'], template: '<h2>Evento</h2><p><strong>Data:</strong> </p><p><strong>Cliente:</strong> </p><p><strong>Tipo:</strong> Visita / Entrega / Retorno / Garantia</p><h2>Checklist</h2><ul><li></li></ul>', stats: ['Semana', 'Entregas', 'Retornos'] },
            scripts: { icon: '⌨️', title: 'Scripts e Comandos', subtitle: 'Biblioteca de PowerShell, CMD, Linux, rede e automação.', noteTitle: 'Script técnico', statusLabel: 'Confiabilidade', statuses: ['rascunho','testado','produção','obsoleto'], template: '<h2>Uso</h2><p></p><h2>Comando</h2><pre><code></code></pre><h2>Observações</h2><p></p>', stats: ['PowerShell', 'CMD', 'Linux'] },
            toolbox: { icon: '🧰', title: 'Ferramentas', subtitle: 'Catálogo de apps, ISOs, drivers e utilitários técnicos.', noteTitle: 'Ferramenta técnica', statusLabel: 'Uso', statuses: ['atual','favorita','testar','substituída','arquivada'], template: '<h2>Ferramenta</h2><p><strong>Nome:</strong> </p><p><strong>Link oficial:</strong> </p><p><strong>Categoria:</strong> </p><h2>Quando usar</h2><p></p><h2>Observações</h2><p></p>', stats: ['Apps', 'ISOs', 'Drivers'] },
            networks: { icon: '🌐', title: 'Redes e Infra', subtitle: 'Inventário estruturado de rede, sub-redes, Wi-Fi, CFTV e auditoria.', noteTitle: 'Mapa de rede', statusLabel: 'Versão da infra', statuses: ['atual','antigo','planejado','em implantação','arquivado'], template: '<h2>Visão geral</h2><p><strong>Cliente/local:</strong> </p><p><strong>Objetivo deste registro:</strong> </p><h2>Observações técnicas</h2><p></p><h2>Pendências</h2><ul><li></li></ul>', stats: ['Dispositivos', 'VLANs', 'Auditoria'] }
        };
    },
    modalContextHtml({ icon = '', title = '', description = '', meta = [], tone = 'neutral', accent = '' } = {}) {
        const safeTone = String(tone || 'neutral').replace(/[^a-z0-9_-]/gi, '') || 'neutral';
        const safeAccent = /^#[0-9a-f]{3,8}$/i.test(accent || '') ? ` style="--modal-accent:${this.escapeHtml(accent)}"` : '';
        const metaHtml = (meta || []).filter(Boolean).map(item => `<span>${this.escapeHtml(item)}</span>`).join('');
        return `<div class="modal-context modal-context-${safeTone}"${safeAccent}>
            <div class="modal-context-icon">${this.escapeHtml(icon || '✦')}</div>
            <div class="modal-context-copy">
                <h4>${this.escapeHtml(title || 'Registro')}</h4>
                ${description ? `<p>${this.escapeHtml(description)}</p>` : ''}
                ${metaHtml ? `<div class="modal-context-meta">${metaHtml}</div>` : ''}
            </div>
        </div>`;
    },
    professionalFieldsTitle(key) {
        return {
            clients: 'Dados do cliente',
            equipment: 'Identificação e configuração',
            tickets: 'Triagem do atendimento',
            knowledge: 'Resumo técnico',
            runbooks: 'Controle do procedimento',
            budgets: 'Condições do orçamento',
            finance: 'Dados financeiros',
            schedule: 'Detalhes da agenda',
            scripts: 'Contexto do script',
            toolbox: 'Dados da ferramenta',
            networks: 'Resumo da infraestrutura'
        }[key] || 'Campos do módulo';
    },
    renderTechPage(main) {
        if (!this.isContextAllowed('work')) {
            this.renderContextGate(main, 'work', 'O hub técnico fica disponível nos modos Trabalho ou Tudo.');
            return;
        }
        const modules = this.getProfessionalModules();
        const records = Storage.getProfessionalRecords();
        const notes = Storage.getNotes({ includePrivate: true });
        const bks = Storage.getBookmarks({ includePrivate: true });
        const openTickets = records.filter(r => r.moduleKey === 'tickets' && !['finalizado','arquivado'].includes(r.status)).length;
        const activeClients = records.filter(r => r.moduleKey === 'clients' && !['inativo','arquivado'].includes(r.status)).length;
        const equipment = records.filter(r => r.moduleKey === 'equipment').length;
        const pendingBudgets = records.filter(r => r.moduleKey === 'budgets' && ['rascunho','enviado','aprovado'].includes(r.status)).length;
        const receivable = records.filter(r => r.moduleKey === 'finance' && ['pendente','atrasado'].includes(r.status)).length;
        const upcoming = records.filter(r => r.moduleKey === 'schedule' && !['concluído','cancelado'].includes(r.status)).length;
        const recent = [...records].sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 8);
        main.innerHTML = `
        <div class="module-page">
            <div class="module-hero"><div><span class="module-kicker">Sistema profissional</span><h2>🛠 Técnico OS</h2><p>Central para transformar notas, links e processos em um sistema de trabalho para assistência técnica.</p></div><button class="btn btn-primary" onclick="App.createProfessionalRecord('tickets')">Novo atendimento</button></div>
            <div class="technical-search-panel">
                <div class="search-box global-search-box"><span class="search-icon">&#128269;</span><input id="tech-search-input" type="text" placeholder="Buscar cliente, equipamento, OS, rede, orçamento..." oninput="App.runProfessionalSearch(this.value)"></div>
                <div class="global-search-results" id="tech-search-results"></div>
            </div>
            <div class="module-stats">
                <div class="feature-card"><h3>${activeClients}</h3><p>Clientes ativos</p></div>
                <div class="feature-card"><h3>${openTickets}</h3><p>Atendimentos em aberto</p></div>
                <div class="feature-card"><h3>${equipment}</h3><p>Equipamentos cadastrados</p></div>
                <div class="feature-card"><h3>${pendingBudgets}</h3><p>Orçamentos pendentes</p></div>
                <div class="feature-card"><h3>${receivable}</h3><p>Financeiro a revisar</p></div>
                <div class="feature-card"><h3>${upcoming}</h3><p>Agenda técnica</p></div>
                <div class="feature-card"><h3>${notes.length}</h3><p>Notas livres separadas</p></div>
                <div class="feature-card"><h3>${bks.length}</h3><p>Links e referências salvas</p></div>
            </div>
            <div class="dash-section technical-timeline"><div class="dash-section-header"><h2>Atividade técnica recente</h2><button class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('clients')">Novo cliente</button></div>
                ${recent.length ? recent.map(r => {
                    const mod = modules[r.moduleKey] || {};
                    return this.professionalRecordButtonHtml(r, mod);
                }).join('') : '<p class="text-muted">Os registros técnicos aparecerão aqui sem bagunçar suas notas.</p>'}
            </div>
            <div class="module-grid">${Object.entries(modules).map(([key,m]) => this.moduleCardHtml(key,m)).join('')}</div>
        </div>`;
    },
    renderProfessionalModule(main, key) {
        if (!this.isContextAllowed('work')) {
            this.renderContextGate(main, 'work', 'Os módulos profissionais ficam disponíveis nos modos Trabalho ou Tudo.');
            return;
        }
        const records = Storage.getProfessionalRecords(key);
        
        if (key === 'networks' && typeof NetworkTopology !== 'undefined') {
            NetworkTopology.render(main, records);
            return;
        }
        
        if (key === 'clients') {
            this.renderClientsDashboard(main, records);
            return;
        }
        if (key === 'equipment') {
            this.renderEquipmentDashboard(main, records);
            return;
        }
        if (key === 'tickets') {
            this.renderTicketsDashboard(main, records);
            return;
        }
        if (key === 'knowledge') {
            this.renderKnowledgeDashboard(main, records);
            return;
        }
        if (key === 'runbooks') {
            this.renderRunbooksDashboard(main, records);
            return;
        }
        if (key === 'budgets') {
            this.renderBudgetsDashboard(main, records);
            return;
        }
        if (key === 'finance') {
            this.renderFinanceDashboard(main, records);
            return;
        }
        if (key === 'schedule') {
            this.renderScheduleDashboard(main, records);
            return;
        }
        if (key === 'scripts') {
            this.renderScriptsDashboard(main, records);
            return;
        }
        if (key === 'toolbox') {
            this.renderToolboxDashboard(main, records);
            return;
        }

        // FALLBACK
        const modules = this.getProfessionalModules();
        const mod = modules[key] || modules.tickets;
        const clientLinks = key === 'clients' ? this.clientLinksHtml(records) : '';
        main.innerHTML = `
        <div class="module-page tech-theme-${key}">
            <div class="module-hero"><div><span class="module-kicker">Módulo</span><h2>${mod.icon} ${this.escapeHtml(mod.title)}</h2><p>${this.escapeHtml(mod.subtitle)}</p></div><button class="btn btn-primary" onclick="App.createProfessionalRecord('${key}')">+ Criar registro</button></div>
            <div class="module-stats"><div class="feature-card"><h3>${records.length}</h3><p>Registros deste módulo</p></div>${mod.stats.map(s => `<div class="feature-card"><h3>${this.escapeHtml(s)}</h3><p>Pronto para estruturar</p></div>`).join('')}</div>
            <div class="dash-sections">
                <div class="dash-section"><div class="dash-section-header"><h2>Fluxo sugerido</h2></div>${this.moduleFlowHtml(key)}</div>
                <div class="dash-section"><div class="dash-section-header"><h2>Registros recentes</h2><button class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('${key}')">Novo</button></div>${records.length ? this.renderRichRecordListHtml(key, records, mod) : '<p class="text-muted">Nenhum registro deste módulo ainda. Ele ficará aqui, separado das suas notas.</p>'}</div>
            </div>
            ${clientLinks}
        </div>`;
    },

    renderClientsDashboard(main, records) {
        const active = records.filter(r => r.status === 'ativo').length;
        const prospects = records.filter(r => r.status === 'prospect').length;
        const recurring = records.filter(r => r.status === 'recorrente').length;
        const total = records.length;

        main.innerHTML = `
        <div class="module-page tech-theme-clients">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>👥 Clientes & CRM</h2>
                    <p>Controle de contatos, vínculos de equipamentos e histórico de atendimento técnico.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('clients')">+ Novo cliente</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Total de Contatos</p></div>
                <div class="feature-card" style="border-left:3px solid #9D4EDD;"><h3>${active}</h3><p>Clientes Ativos</p></div>
                <div class="feature-card" style="border-left:3px solid #F15BB5;"><h3>${prospects}</h3><p>Prospects</p></div>
                <div class="feature-card" style="border-left:3px solid #00B4D8;"><h3>${recurring}</h3><p>Recorrentes</p></div>
            </div>

            <div class="technical-search-panel" style="margin-bottom: 20px;">
                <div class="search-box global-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Filtrar clientes por nome, telefone ou CPF/CNPJ..." oninput="App.filterTechClients(this.value)">
                </div>
            </div>

            <div class="dash-sections" style="display:flex; flex-direction:column; gap:24px;">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>👥 Carteira de Clientes</h2>
                    </div>
                    <div id="tech-clients-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('clients', records) : '<p class="text-muted">Nenhum cliente cadastrado ainda. Cadastre o seu primeiro cliente para começar!</p>'}
                    </div>
                </div>
                ${this.clientLinksHtml(records)}
            </div>
        </div>`;
    },

    filterTechClients(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('#tech-clients-dashboard-list .tech-client-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    renderEquipmentDashboard(main, records) {
        const total = records.length;
        const notebooks = records.filter(r => (r.fields?.type || '').toLowerCase() === 'notebook').length;
        const desktops = records.filter(r => (r.fields?.type || '').toLowerCase().includes('desktop') || (r.fields?.type || '').toLowerCase().includes('pc')).length;
        const impressoras = records.filter(r => (r.fields?.type || '').toLowerCase().includes('impressora')).length;
        const outros = total - notebooks - desktops - impressoras;

        main.innerHTML = `
        <div class="module-page tech-theme-equipment">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>💻 Equipamentos & Inventário</h2>
                    <p>Controle de especificações de hardware, sistemas operacionais e diagnósticos.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('equipment')">+ Cadastrar equipamento</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Total de Equipamentos</p></div>
                <div class="feature-card"><h3>${notebooks}</h3><p>Notebooks 💻</p></div>
                <div class="feature-card"><h3>${desktops}</h3><p>Desktops 🖥️</p></div>
                <div class="feature-card"><h3>${impressoras + outros}</h3><p>Periféricos & Redes 🖨️</p></div>
            </div>

            <div class="technical-search-panel" style="margin-bottom: 20px;">
                <div class="search-box global-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Filtrar por marca, modelo, serial tag ou cliente..." oninput="App.filterTechEquipment(this.value)">
                </div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>💻 Máquinas e Dispositivos Registrados</h2>
                    </div>
                    <div id="tech-equip-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('equipment', records) : '<p class="text-muted">Nenhum equipamento cadastrado ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    filterTechEquipment(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('#tech-equip-dashboard-list .tech-equip-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    renderTicketsDashboard(main, records) {
        const total = records.length;
        const abertos = records.filter(r => !['finalizado','garantia','arquivado'].includes(r.status)).length;
        const finalizados = records.filter(r => r.status === 'finalizado').length;
        const garantia = records.filter(r => r.status === 'garantia').length;

        const col1 = records.filter(r => ['recebido', 'diagnóstico'].includes(r.status || 'recebido'));
        const col2 = records.filter(r => ['orçamento', 'aguardando cliente'].includes(r.status));
        const col3 = records.filter(r => r.status === 'em execução');
        const col4 = records.filter(r => ['finalizado', 'garantia'].includes(r.status));

        const renderKanbanColumn = (title, color, items, icon) => {
            return `
            <div class="kanban-column" style="flex: 1; min-width: 250px; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 12px;">
                <div class="kanban-column-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${color}; padding-bottom: 8px; margin-bottom: 4px;">
                    <h3 style="font-size: 0.95rem; font-weight: 700; margin: 0; display:flex; align-items:center; gap:6px;"><span>${icon}</span> ${title}</h3>
                    <span class="count-badge" style="background:${color}; color:#000; font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; font-weight: 800;">${items.length}</span>
                </div>
                <div class="kanban-items" style="display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; max-height: 500px; padding-right: 4px;">
                    ${items.length ? items.map(r => {
                        const fields = r.fields || {};
                        const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                        const equip = r.equipmentId ? Storage.getProfessionalRecords('equipment').find(e => e.id === r.equipmentId) : null;
                        
                        return `
                        <div class="kanban-item mui-glass" onclick="App.openProfessionalRecord('${r.id}')" style="padding: 10px; border-radius: 8px; cursor: pointer; transition: transform 0.2s, border-color 0.2s; border-left: 3px solid ${color};">
                            <h4 style="font-size: 0.85rem; font-weight: 700; margin: 0 0 6px 0; color: #fff;">${this.escapeHtml(r.title)}</h4>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 2px;">
                                <span>👥 ${client ? this.escapeHtml(client.title) : 'Sem cliente'}</span>
                                ${equip ? `<span>💻 ${this.escapeHtml(equip.title)}</span>` : ''}
                                <span style="font-size: 0.7rem; color: ${color}; text-transform: uppercase; font-weight: 700; margin-top:4px;">● ${r.status}</span>
                            </div>
                        </div>`;
                    }).join('') : '<p class="text-muted" style="font-size:0.8rem; text-align:center; padding: 20px 0;">Vazio</p>'}
                </div>
            </div>`;
        };

        main.innerHTML = `
        <div class="module-page tech-theme-tickets">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>🔧 Ordens de Serviço & Atendimentos</h2>
                    <p>Controle o fluxo técnico das ordens de serviço por fases, triagem e garantias.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('tickets')">+ Novo atendimento</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card" style="border-left: 3px solid #4EA8DE;"><h3>${abertos}</h3><p>Atendimentos Abertos</p></div>
                <div class="feature-card" style="border-left: 3px solid #38B000;"><h3>${finalizados}</h3><p>Finalizados</p></div>
                <div class="feature-card" style="border-left: 3px solid #06D6A0;"><h3>${garantia}</h3><p>Em Garantia</p></div>
                <div class="feature-card"><h3>${total}</h3><p>Histórico Total</p></div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header" style="margin-bottom:15px;">
                        <h2>📋 Fluxo Kanban de Ordens de Serviço</h2>
                    </div>
                    <div class="kanban-board-scroll-wrapper" style="overflow-x: auto; padding-bottom: 12px; margin: 0 -12px;">
                        <div class="kanban-board" style="display: flex; gap: 16px; min-width: 900px; padding: 0 12px;">
                            ${renderKanbanColumn('Triagem & Laudo', '#4EA8DE', col1, '🚨')}
                            ${renderKanbanColumn('Orçamento / Aprov', '#FFD166', col2, '🧾')}
                            ${renderKanbanColumn('Em Bancada / OS', '#3A86C8', col3, '⚡')}
                            ${renderKanbanColumn('Prontos & Garantia', '#38B000', col4, '🛡️')}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderKnowledgeDashboard(main, records) {
        const total = records.length;
        const validado = records.filter(r => r.status === 'validado').length;
        const testado = records.filter(r => r.status === 'testado').length;

        let allTags = new Set();
        records.forEach(r => {
            const tags = r.fields?.tags || '';
            tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => allTags.add(t));
        });
        const tagList = Array.from(allTags).slice(0, 15);

        main.innerHTML = `
        <div class="module-page tech-theme-knowledge">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>🧠 Base Técnica & Wiki</h2>
                    <p>Centralize soluções de erros comuns, procedimentos técnicos, documentações e links úteis.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('knowledge')">+ Novo artigo técnico</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Artigos Totais</p></div>
                <div class="feature-card" style="border-left: 3px solid #38B000;"><h3>${validado}</h3><p>Procedimentos Validados</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3>${testado}</h3><p>Artigos em Teste</p></div>
                <div class="feature-card"><h3>${allTags.size}</h3><p>Tags Criadas</p></div>
            </div>

            <div class="technical-search-panel" style="margin-bottom: 20px;">
                <div class="search-box global-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Pesquisar por erro, solução ou comando..." oninput="App.filterTechKnowledge(this.value)">
                </div>
            </div>

            <div class="quick-tags-filter-bar" style="margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="font-size:0.75rem; display:block; margin-bottom:8px; color:var(--text-secondary); font-weight:700;">🏷️ Filtrar por Tag Técnica:</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <button class="btn btn-sm btn-secondary btn-primary active-tag-filter" onclick="App.filterKnowledgeByTag('', this)" style="border-radius:12px; margin-top:0;">Todos</button>
                    ${tagList.map(tag => `<button class="btn btn-sm btn-secondary" onclick="App.filterKnowledgeByTag('${tag}', this)" style="border-radius:12px; margin-top:0;">#${tag}</button>`).join('')}
                </div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>📚 Procedimentos Documentados</h2>
                    </div>
                    <div id="tech-kb-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('knowledge', records) : '<p class="text-muted">Nenhum artigo técnico cadastrado ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    filterTechKnowledge(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('#tech-kb-dashboard-list .tech-kb-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    filterKnowledgeByTag(tag, btn) {
        document.querySelectorAll('.quick-tags-filter-bar button').forEach(b => {
            b.classList.remove('active-tag-filter', 'btn-primary');
        });
        btn.classList.add('btn-primary');
        
        const cards = document.querySelectorAll('#tech-kb-dashboard-list .tech-kb-card');
        cards.forEach(card => {
            if (!tag) {
                card.style.display = '';
                return;
            }
            const tagsText = card.querySelector('.kb-tags')?.textContent || '';
            if (tagsText.toLowerCase().includes(tag.toLowerCase())) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    renderRunbooksDashboard(main, records) {
        const total = records.length;
        const ativos = records.filter(r => r.status === 'ativo').length;
        const revisao = records.filter(r => r.status === 'em revisão').length;

        main.innerHTML = `
        <div class="module-page tech-theme-runbooks">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>✅ Runbooks & Processos</h2>
                    <p>Checklists estruturados para formatação, backups e inspeções periódicas de servidores.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('runbooks')">+ Criar novo checklist</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Modelos de Runbook</p></div>
                <div class="feature-card" style="border-left: 3px solid #06D6A0;"><h3>${ativos}</h3><p>Em Produção (Ativos)</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3>${revisao}</h3><p>Em Revisão</p></div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>📋 Checklists e Procedimentos Operacionais</h2>
                    </div>
                    <div id="tech-runbook-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('runbooks', records) : '<p class="text-muted">Nenhum checklist de runbook criado ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderBudgetsDashboard(main, records) {
        let totalEstimates = 0;
        let approvedTotal = 0;
        let pendingTotal = 0;
        
        records.forEach(r => {
            const items = r.fields?.budgetAdvanced?.items || [];
            const budgetVal = this.calculateBudgetTotal(items);
            totalEstimates += budgetVal;
            
            if (r.status === 'aprovado' || r.status === 'pago') {
                approvedTotal += budgetVal;
            } else if (r.status === 'rascunho' || r.status === 'enviado') {
                pendingTotal += budgetVal;
            }
        });

        main.innerHTML = `
        <div class="module-page tech-theme-budgets">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>🧾 Orçamentos & Faturamento</h2>
                    <p>Crie orçamentos detalhados de hardware e mão de obra, exporte para PDF e controle o caixa.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('budgets')">+ Novo orçamento</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${records.length}</h3><p>Orçamentos Emitidos</p></div>
                <div class="feature-card" style="border-left: 3px solid #38B000;"><h3 style="color:#38B000;">${this.formatCurrency(approvedTotal)}</h3><p>Aprovados / Faturados</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3 style="color:#FF9100;">${this.formatCurrency(pendingTotal)}</h3><p>Enviados / Aguardando</p></div>
                <div class="feature-card"><h3>${this.formatCurrency(totalEstimates)}</h3><p>Volume Estimado Total</p></div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>🧾 Orçamentos e Cotações Recentes</h2>
                    </div>
                    <div id="tech-budgets-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('budgets', records) : '<p class="text-muted">Nenhum orçamento emitido ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderFinanceDashboard(main, records) {
        let totalIncomes = 0;
        let totalExpenses = 0;
        let totalReceivables = 0;

        records.forEach(r => {
            const amount = Number(r.fields?.amount || 0);
            const movement = r.fields?.movement || 'entrada';
            
            if (movement === 'entrada') {
                if (r.status === 'recebido' || r.status === 'pago') {
                    totalIncomes += amount;
                } else if (r.status === 'pendente' || r.status === 'atrasado') {
                    totalReceivables += amount;
                }
            } else {
                if (r.status === 'pago' || r.status === 'recebido') {
                    totalExpenses += amount;
                }
            }
        });

        const netProfit = totalIncomes - totalExpenses;

        main.innerHTML = `
        <div class="module-page tech-theme-finance">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>💰 Financeiro & Fluxo de Caixa</h2>
                    <p>Controle o caixa da sua assistência técnica com entradas de serviços e custos de hardware.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('finance')">+ Novo movimento</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card" style="border-left: 3px solid #38B000;"><h3 style="color:#38B000;">+ ${this.formatCurrency(totalIncomes)}</h3><p>Entradas (Receitas)</p></div>
                <div class="feature-card" style="border-left: 3px solid #EF5350;"><h3 style="color:#EF5350;">- ${this.formatCurrency(totalExpenses)}</h3><p>Saídas (Despesas)</p></div>
                <div class="feature-card" style="border-left: 3px solid ${netProfit >= 0 ? '#38B000' : '#EF5350'};"><h3 style="color:${netProfit >= 0 ? '#38B000' : '#EF5350'};">${this.formatCurrency(netProfit)}</h3><p>Lucro Líquido</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3 style="color:#FF9100;">${this.formatCurrency(totalReceivables)}</h3><p>Valores a Receber</p></div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>💰 Livro de Lançamentos</h2>
                    </div>
                    <div id="tech-finance-dashboard-list" style="display:flex; flex-direction:column; gap:12px;">
                        ${records.length ? this.renderRichRecordListHtml('finance', records) : '<p class="text-muted">Nenhum lançamento financeiro registrado ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderScheduleDashboard(main, records) {
        const total = records.length;
        const activeEvents = records.filter(r => !['concluído', 'cancelado'].includes(r.status)).length;
        
        const sortedRecords = [...records].sort((a, b) => {
            const dateA = a.fields?.date ? new Date(a.fields.date) : new Date(0);
            const dateB = b.fields?.date ? new Date(b.fields.date) : new Date(0);
            return dateA - dateB;
        });

        main.innerHTML = `
        <div class="module-page tech-theme-schedule">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>📅 Agenda Técnica & Visitas</h2>
                    <p>Gerencie compromissos, visitas em campo a clientes e entregas programadas de equipamentos.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('schedule')">+ Novo compromisso</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Eventos Cadastrados</p></div>
                <div class="feature-card" style="border-left: 3px solid #F15BB5;"><h3>${activeEvents}</h3><p>Compromissos Pendentes</p></div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>📅 Cronograma Técnico e Entregas</h2>
                    </div>
                    <div id="tech-schedule-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('schedule', sortedRecords) : '<p class="text-muted">Nenhum agendamento técnico para os próximos dias.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderScriptsDashboard(main, records) {
        const total = records.length;
        const powershell = records.filter(r => (r.fields?.environment || '') === 'PowerShell').length;
        const bash = records.filter(r => (r.fields?.environment || '').includes('Bash')).length;
        const cmd = records.filter(r => (r.fields?.environment || '').includes('CMD')).length;

        main.innerHTML = `
        <div class="module-page tech-theme-scripts">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>⌨️ Scripts & Comandos Rápidos</h2>
                    <p>Biblioteca pessoal de scripts PowerShell, CMD, Bash e automações para técnicos de TI.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('scripts')">+ Salvar script</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Total de Scripts</p></div>
                <div class="feature-card" style="border-left:3px solid #00D8FF;"><h3>${powershell}</h3><p>PowerShell 💻</p></div>
                <div class="feature-card" style="border-left:3px solid #4EA8DE;"><h3>${cmd}</h3><p>CMD / Batch</p></div>
                <div class="feature-card" style="border-left:3px solid #06D6A0;"><h3>${bash}</h3><p>Bash / Linux 🐧</p></div>
            </div>

            <div class="technical-search-panel" style="margin-bottom: 20px;">
                <div class="search-box global-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Filtrar por nome do script, comando ou descrição..." oninput="App.filterTechScripts(this.value)">
                </div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>⌨️ Repositório de Automações</h2>
                    </div>
                    <div id="tech-scripts-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('scripts', records) : '<p class="text-muted">Nenhum script salvo ainda. Comece a catalogar seus comandos favoritos!</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    filterTechScripts(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('#tech-scripts-dashboard-list .tech-script-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    renderToolboxDashboard(main, records) {
        const total = records.length;
        const diagnostics = records.filter(r => (r.fields?.category || '') === 'Diagnóstico / Testes').length;
        const backup = records.filter(r => (r.fields?.category || '') === 'Backup / Clonagem').length;

        let cats = new Set();
        records.forEach(r => {
            if (r.fields?.category) cats.add(r.fields.category);
        });
        const catList = Array.from(cats);

        main.innerHTML = `
        <div class="module-page tech-theme-toolbox">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo</span>
                    <h2>🧰 Maleta de Ferramentas / Toolbox</h2>
                    <p>Catálogo de aplicativos portáteis, ISOs, BIOS e utilitários técnicos essenciais de bancada.</p>
                </div>
                <button class="btn btn-primary" onclick="App.createProfessionalRecord('toolbox')">+ Nova ferramenta</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${total}</h3><p>Downloads Salvos</p></div>
                <div class="feature-card" style="border-left: 3px solid #EF476F;"><h3>${diagnostics}</h3><p>Diagnóstico & Testes</p></div>
                <div class="feature-card" style="border-left: 3px solid #4EA8DE;"><h3>${backup}</h3><p>Backup & Clonagem</p></div>
                <div class="feature-card"><h3>${total - diagnostics - backup}</h3><p>Outros Utilitários</p></div>
            </div>

            <div class="technical-search-panel" style="margin-bottom: 20px;">
                <div class="search-box global-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" placeholder="Filtrar por nome de ferramenta, categoria ou descrição..." oninput="App.filterTechTools(this.value)">
                </div>
            </div>

            <div class="quick-tags-filter-bar" style="margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <label style="font-size:0.75rem; display:block; margin-bottom:8px; color:var(--text-secondary); font-weight:700;">📂 Filtrar por Categoria:</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <button class="btn btn-sm btn-secondary btn-primary active-tag-filter" onclick="App.filterToolsByCategory('', this)" style="border-radius:12px; margin-top:0;">Todos</button>
                    ${catList.map(cat => `<button class="btn btn-sm btn-secondary" onclick="App.filterToolsByCategory('${cat}', this)" style="border-radius:12px; margin-top:0;">${cat}</button>`).join('')}
                </div>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>🧰 Maleta Técnica (Utilidades)</h2>
                    </div>
                    <div id="tech-tools-dashboard-list">
                        ${records.length ? this.renderRichRecordListHtml('toolbox', records) : '<p class="text-muted">Nenhum utilitário cadastrado ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    filterTechTools(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('#tech-tools-dashboard-list .tech-tool-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    filterToolsByCategory(cat, btn) {
        document.querySelectorAll('.quick-tags-filter-bar button').forEach(b => {
            b.classList.remove('active-tag-filter', 'btn-primary');
        });
        btn.classList.add('btn-primary');
        
        const cards = document.querySelectorAll('#tech-tools-dashboard-list .tech-tool-card');
        cards.forEach(card => {
            if (!cat) {
                card.style.display = '';
                return;
            }
            const catBadge = card.querySelector('.tool-cat-badge')?.textContent || '';
            if (catBadge.toLowerCase().includes(cat.toLowerCase())) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },
    moduleCardHtml(key, mod) {
        return `<button class="module-card" onclick="App.navigate('${key}')"><span>${mod.icon}</span><strong>${this.escapeHtml(mod.title)}</strong><small>${this.escapeHtml(mod.subtitle)}</small></button>`;
    },
    moduleFlowHtml(key) {
        const flows = {
            clients: ['Cadastrar contato', 'Vincular equipamentos', 'Registrar histórico', 'Agendar retorno'],
            equipment: ['Identificar máquina', 'Registrar configuração', 'Anexar fotos/documentos', 'Vincular atendimentos'],
            tickets: ['Abrir atendimento', 'Diagnosticar', 'Orçar', 'Executar', 'Entregar e fechar garantia'],
            knowledge: ['Registrar erro', 'Documentar causa', 'Salvar solução', 'Relacionar links e scripts'],
            runbooks: ['Escolher procedimento', 'Executar checklist', 'Salvar evidências', 'Criar nota final'],
            budgets: ['Montar serviços/peças', 'Enviar ao cliente', 'Marcar aprovação', 'Vincular pagamento'],
            finance: ['Registrar entrada', 'Registrar custo', 'Marcar recebimento', 'Revisar mês'],
            schedule: ['Agendar visita', 'Definir entrega', 'Criar retorno', 'Avisar cliente'],
            scripts: ['Salvar comando', 'Categorizar ambiente', 'Testar', 'Vincular a procedimento'],
            toolbox: ['Cadastrar ferramenta', 'Salvar link oficial', 'Anotar uso', 'Revisar versão'],
            networks: ['Preencher visão geral', 'Cadastrar dispositivos', 'Mapear sub-redes/VLANs', 'Revisar auditoria']
        };
        return `<div class="module-flow">${(flows[key] || flows.tickets).map((item,i)=>`<div class="feature-row"><span><strong>${i+1}.</strong> ${this.escapeHtml(item)}</span></div>`).join('')}</div>`;
    },
    professionalRecordButtonHtml(record, mod = null) {
        const modules = this.getProfessionalModules();
        const moduleDef = mod || modules[record.moduleKey] || {};
        const client = record.clientId ? Storage.getProfessionalRecords().find(r => r.id === record.clientId) : null;
        const equipment = record.equipmentId ? Storage.getProfessionalRecords().find(r => r.id === record.equipmentId) : null;
        const detail = [record.status || 'aberto', client?.title, equipment?.title, new Date(record.updatedAt || record.createdAt).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ');
        const openAction = record.moduleKey === 'clients' ? `App.openClientDetail('${record.id}')` : `App.openProfessionalRecord('${record.id}')`;
        return `<button class="global-result" onclick="${openAction}"><span>${moduleDef.icon || '•'}</span><div><strong>${this.escapeHtml(record.title)}</strong><small>${this.escapeHtml(detail)}</small></div></button>`;
    },
    clientLinksHtml(clients) {
        const modules = this.getProfessionalModules();
        const records = Storage.getProfessionalRecords();
        return `<div class="dash-section module-links-section"><div class="dash-section-header"><h2>Vínculos por cliente</h2></div>${clients.map(client => {
            const linked = records.filter(r => r.clientId === client.id && r.id !== client.id);
            return `<div class="client-link-block"><div><button class="link-button" onclick="App.openClientDetail('${client.id}')"><strong>👥 ${this.escapeHtml(client.title)}</strong></button><small>${linked.length} vínculo(s)</small></div>${linked.length ? linked.map(r => {
                const mod = modules[r.moduleKey] || {};
                const equipment = r.equipmentId ? records.find(item => item.id === r.equipmentId) : null;
                return `<button class="global-result" onclick="App.openProfessionalRecord('${r.id}')"><span>${mod.icon || '•'}</span><div><strong>${this.escapeHtml(r.title)}</strong><small>${this.escapeHtml(mod.title || r.moduleKey)} · ${this.escapeHtml(r.status || '')}${equipment ? ` · ${this.escapeHtml(equipment.title)}` : ''}</small></div></button>`;
            }).join('') : '<p class="text-muted">Nenhum equipamento, orçamento, atendimento ou rede ligado ainda.</p>'}</div>`;
        }).join('') || '<p class="text-muted">Cadastre um cliente para começar a vincular registros.</p>'}</div>`;
    },
    professionalClientOptions(selected = '') {
        const clients = Storage.getProfessionalRecords('clients');
        return `<option value="">Sem cliente vinculado</option>${clients.map(c => `<option value="${c.id}" ${c.id===selected?'selected':''}>${this.escapeHtml(c.title)}</option>`).join('')}`;
    },
    professionalEquipmentOptions(clientId = '', selected = '') {
        const equipment = Storage.getProfessionalRecords('equipment')
            .filter(eq => !clientId || eq.clientId === clientId || eq.id === selected);
        return `<option value="">Sem equipamento vinculado</option>${equipment.map(eq => `<option value="${eq.id}" ${eq.id===selected?'selected':''}>${this.escapeHtml(eq.title)}</option>`).join('')}`;
    },
    refreshProfessionalEquipmentOptions(clientId = '', selected = '') {
        const select = document.getElementById('professional-equipment');
        if (!select) return;
        select.innerHTML = this.professionalEquipmentOptions(clientId, selected || select.value);
    },
    applyEquipmentClient(equipmentId = '') {
        if (!equipmentId) return;
        const equipment = Storage.getProfessionalRecords('equipment').find(eq => eq.id === equipmentId);
        const clientSelect = document.getElementById('professional-client');
        if (equipment?.clientId && clientSelect && !clientSelect.value) {
            clientSelect.value = equipment.clientId;
            this.refreshProfessionalEquipmentOptions(equipment.clientId, equipmentId);
        }
    },
    professionalFieldsConfig(key) {
        return {
            clients: [
                ['phone', 'Telefone/WhatsApp', 'tel'], ['email', 'E-mail', 'email'], ['address', 'Endereço', 'text'], ['document', 'CPF/CNPJ', 'text']
            ],
            equipment: [
                ['type', 'Tipo', 'text'], ['brandModel', 'Marca/modelo', 'text'], ['serial', 'Número de série', 'text'], ['os', 'Sistema', 'text'], ['specs', 'CPU/RAM/SSD', 'text']
            ],
            tickets: [
                ['reportedProblem', 'Problema relatado', 'text'], ['diagnosis', 'Diagnóstico curto', 'text'], ['solution', 'Solução aplicada', 'text'], ['warrantyUntil', 'Garantia até', 'date']
            ],
            knowledge: [
                ['problem', 'Problema', 'text'], ['cause', 'Causa provável', 'text'], ['tags', 'Tags técnicas', 'text']
            ],
            runbooks: [
                ['objective', 'Objetivo', 'text'], ['frequency', 'Frequência', 'text'], ['version', 'Versão', 'text']
            ],
            budgets: [
                ['validUntil', 'Validade', 'date'], ['payment', 'Condição de pagamento', 'text'], ['warranty', 'Garantia', 'text']
            ],
            finance: [
                ['amount', 'Valor', 'number'], ['movement', 'Tipo de movimento', 'text'], ['dueDate', 'Vencimento', 'date']
            ],
            schedule: [
                ['date', 'Data', 'datetime-local'], ['eventType', 'Tipo', 'text'], ['location', 'Local', 'text']
            ],
            scripts: [
                ['environment', 'Ambiente', 'text'], ['language', 'Linguagem', 'text'], ['risk', 'Risco/cuidados', 'text']
            ],
            toolbox: [
                ['url', 'Link oficial', 'url'], ['category', 'Categoria', 'text'], ['version', 'Versão', 'text']
            ],
            networks: [
                ['gateway', 'Gateway', 'text'], ['dhcp', 'DHCP', 'text'], ['wifi', 'Wi-Fi', 'text'], ['version', 'Versão da infra', 'text']
            ]
        }[key] || [];
    },
    professionalFieldsHtml(key, record = null) {
        const fields = record?.fields || {};
        
        // 1. CLIENTES (CRM)
        if (key === 'clients') {
            return `
            <div class="professional-fields tech-fields-clients">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>CPF / CNPJ</label>
                        <input data-prof-field="document" type="text" placeholder="000.000.000-00 ou 00.000.000/0000-00" value="${this.escapeHtml(fields.document || '')}" oninput="App.maskCpfCnpj(this)">
                    </div>
                    <div class="form-group">
                        <label>E-mail</label>
                        <input data-prof-field="email" type="email" placeholder="cliente@exemplo.com" value="${this.escapeHtml(fields.email || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Telefone / WhatsApp</label>
                        <div style="display:flex; gap:6px;">
                            <input id="client-field-phone" data-prof-field="phone" type="tel" placeholder="(00) 00000-0000" value="${this.escapeHtml(fields.phone || '')}" oninput="App.maskPhone(this)" style="flex:1;">
                            ${fields.phone ? `<a href="https://wa.me/55${fields.phone.replace(/\D/g, '')}" target="_blank" class="btn btn-secondary" style="padding: 0 12px; margin-top:0; display:flex; align-items:center; justify-content:center;" title="Abrir WhatsApp">💬</a>` : ''}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Endereço</label>
                        <div style="display:flex; gap:6px;">
                            <input data-prof-field="address" type="text" placeholder="Rua, Número, Bairro, Cidade" value="${this.escapeHtml(fields.address || '')}" style="flex:1;">
                            ${fields.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fields.address)}" target="_blank" class="btn btn-secondary" style="padding: 0 12px; margin-top:0; display:flex; align-items:center; justify-content:center;" title="Ver no Maps">📍</a>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        }

        // 2. EQUIPAMENTOS (HARDWARE)
        if (key === 'equipment') {
            const specs = fields.specs || '';
            let cpu = '', ram = '', disk = '';
            if (specs.includes(' / ')) {
                const parts = specs.split(' / ');
                cpu = parts[0] || '';
                ram = parts[1] || '';
                disk = parts[2] || '';
            } else {
                cpu = specs;
            }
            return `
            <div class="professional-fields tech-fields-equipment">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo de Equipamento</label>
                        <select data-prof-field="type">
                            ${['Notebook','Desktop / PC','Servidor','Impressora','Roteador / Rede','Smartphone / Tablet','Outro'].map(opt => `<option value="${opt}" ${opt === fields.type ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Marca / Modelo</label>
                        <input data-prof-field="brandModel" type="text" placeholder="Ex: Dell Inspiron 15" value="${this.escapeHtml(fields.brandModel || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Número de Série / Service Tag</label>
                        <div style="display:flex; gap:6px;">
                            <input id="field-prof-serial" data-prof-field="serial" type="text" placeholder="S/N ou Código de barras" value="${this.escapeHtml(fields.serial || '')}" style="flex:1;">
                            <button class="btn btn-secondary" type="button" onclick="Scanner.start('field-prof-serial')" style="padding: 0 12px; margin-top:0;" title="Escanear Código de Barras / QR Code">📷</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Sistema Operacional</label>
                        <select data-prof-field="os">
                            ${['Windows 11','Windows 10','Windows Server','Linux (Ubuntu/Debian)','macOS','Android / iOS','Sem OS / Firmware'].map(opt => `<option value="${opt}" ${opt === fields.os ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="equipment-specs-builder" style="margin-top: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,0.15);">
                    <label style="font-weight:700; display:block; margin-bottom: 8px; font-size:0.85rem;">🛠️ Seletor Rápido de Configuração (Specs)</label>
                    <div class="form-row" style="margin-bottom:0;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">Processador (CPU)</label>
                            <input id="spec-cpu" type="text" placeholder="Ex: Core i5 11ª Gen" value="${this.escapeHtml(cpu)}" oninput="App.updateSpecString()" list="cpu-suggestions">
                            <datalist id="cpu-suggestions">
                                <option value="Core i3"><option value="Core i5"><option value="Core i7"><option value="Core i9"><option value="Ryzen 3"><option value="Ryzen 5"><option value="Ryzen 7"><option value="Ryzen 9"><option value="Intel Celeron"><option value="Xeon CPU">
                            </datalist>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">Memória RAM</label>
                            <select id="spec-ram" onchange="App.updateSpecString()">
                                ${['','4GB DDR3','8GB DDR3','8GB DDR4','16GB DDR4','16GB DDR5','32GB DDR4','32GB DDR5','64GB'].map(opt => `<option value="${opt}" ${opt === ram ? 'selected' : ''}>${opt || 'Selecionar...'}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">Armazenamento</label>
                            <select id="spec-disk" onchange="App.updateSpecString()">
                                ${['','240GB SSD','480GB SSD','512GB NVMe','1TB NVMe','2TB NVMe','1TB HDD','2TB HDD','Sem Disco'].map(opt => `<option value="${opt}" ${opt === disk ? 'selected' : ''}>${opt || 'Selecionar...'}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <input type="hidden" id="field-prof-specs" data-prof-field="specs" value="${this.escapeHtml(specs)}">
                    <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-secondary);">String de Configuração Gerada: <strong id="spec-string-display" style="color:var(--accent);">${specs || 'Nenhuma'}</strong></div>
                </div>
            </div>`;
        }

        // 3. ATENDIMENTOS (ORDENS DE SERVIÇO)
        if (key === 'tickets') {
            const status = record?.status || 'recebido';
            const stages = ['recebido','diagnóstico','orçamento','aguardando cliente','em execução','finalizado','garantia'];
            return `
            <div class="professional-fields tech-fields-tickets">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                
                <div class="ticket-status-stepper" style="margin-bottom: 20px;">
                    <label style="font-weight:700; display:block; margin-bottom:10px; font-size:0.85rem;">🚦 Estágio do Atendimento (Clique para alterar)</label>
                    <div class="stepper-track">
                        ${stages.map((stg, idx) => {
                            const activeIdx = stages.indexOf(status);
                            const isCurrent = stg === status;
                            const isPassed = stages.indexOf(stg) < activeIdx;
                            let btnClass = 'stepper-step';
                            if (isCurrent) btnClass += ' current';
                            else if (isPassed) btnClass += ' passed';
                            return `<button type="button" class="${btnClass}" onclick="App.setTicketStatus('${stg}')" title="Mudar para ${stg}">${idx + 1}<span class="step-label">${stg}</span></button>`;
                        }).join('')}
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Problema Relatado</label>
                        <input data-prof-field="reportedProblem" type="text" placeholder="Sintomas informados pelo cliente" value="${this.escapeHtml(fields.reportedProblem || '')}">
                    </div>
                    <div class="form-group">
                        <label>Garantia até</label>
                        <input data-prof-field="warrantyUntil" type="date" value="${this.escapeHtml(fields.warrantyUntil || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Diagnóstico Técnico Curto</label>
                        <textarea data-prof-field="diagnosis" placeholder="O que foi constatado após análise?" rows="2">${this.escapeHtml(fields.diagnosis || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Solução Aplicada</label>
                        <textarea data-prof-field="solution" placeholder="O que foi feito para corrigir o problema?" rows="2">${this.escapeHtml(fields.solution || '')}</textarea>
                    </div>
                </div>
            </div>`;
        }

        // 4. BASE TÉCNICA (WIKI)
        if (key === 'knowledge') {
            const tags = fields.tags || '';
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            const defaultTags = ['rede', 'windows', 'formatacao', 'backup', 'hardware', 'impressora', 'seguranca', 'macOS', 'linux'];
            return `
            <div class="professional-fields tech-fields-knowledge">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-group">
                    <label>Título do Problema</label>
                    <input data-prof-field="problem" type="text" placeholder="Ex: Erro 0x800f081f na instalação do .NET Framework" value="${this.escapeHtml(fields.problem || '')}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Causa Provável</label>
                        <input data-prof-field="cause" type="text" placeholder="Ex: Arquivos de fonte corrompidos no Windows Update" value="${this.escapeHtml(fields.cause || '')}">
                    </div>
                    <div class="form-group">
                        <label>Tags Técnicas (Separadas por vírgula)</label>
                        <input id="field-prof-tags" data-prof-field="tags" type="text" placeholder="Ex: windows, updates, erro" value="${this.escapeHtml(tags)}" oninput="App.renderKnowledgeTagsPreview(this.value)">
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <label style="font-size:0.75rem; display:block; margin-bottom:4px; color:var(--text-secondary);">Sugestões de Tags Rápidas (Clique para adicionar)</label>
                    <div class="quick-tags-container" style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${defaultTags.map(t => `<button type="button" class="btn btn-sm btn-secondary" onclick="App.addQuickTag('${t}')" style="margin-top:0; border-radius:12px;">#${t}</button>`).join('')}
                    </div>
                    <div id="tags-preview-display" style="margin-top: 10px; display:flex; gap:6px; flex-wrap:wrap;"></div>
                </div>
            </div>`;
        }

        // 5. RUNBOOKS (CHECKLISTS)
        if (key === 'runbooks') {
            return `
            <div class="professional-fields tech-fields-runbooks">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Objetivo do Procedimento</label>
                        <input data-prof-field="objective" type="text" placeholder="Ex: Checklist completo de formatação segura" value="${this.escapeHtml(fields.objective || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Frequência Recomendada</label>
                        <select data-prof-field="frequency">
                            ${['Única','Diária','Semanal','Mensal','Preventiva','Sob Demanda'].map(opt => `<option value="${opt}" ${opt === fields.frequency ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Versão do Runbook</label>
                        <input data-prof-field="version" type="text" placeholder="Ex: v1.4" value="${this.escapeHtml(fields.version || '')}">
                    </div>
                </div>
            </div>`;
        }

        // 6. ORÇAMENTOS
        if (key === 'budgets') {
            return `
            <div class="professional-fields tech-fields-budgets">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Validade do Orçamento</label>
                        <input data-prof-field="validUntil" type="date" value="${this.escapeHtml(fields.validUntil || '')}">
                    </div>
                    <div class="form-group">
                        <label>Condição de Pagamento</label>
                        <select data-prof-field="payment">
                            ${['Pix / Dinheiro','Cartão de Crédito','Boleto Bancário','Faturado 15/30 Dias','50% de entrada + 50% na entrega'].map(opt => `<option value="${opt}" ${opt === fields.payment ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Garantia Inclusa</label>
                        <select data-prof-field="warranty">
                            ${['Sem garantia','30 dias','90 dias (Padrão Legal)','6 meses','1 ano','Outra (mencionada nas observações)'].map(opt => `<option value="${opt}" ${opt === fields.warranty ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>`;
        }

        // 7. FINANCEIRO
        if (key === 'finance') {
            const movement = fields.movement || 'entrada';
            return `
            <div class="professional-fields tech-fields-finance">
                <div class="finance-form-intro"><h4>Detalhes do movimento</h4><p>Registre valor, competência e pagamento para manter o fluxo de caixa confiável.</p></div>
                <div class="form-group"><label>Tipo de movimentação</label><div class="finance-type-switcher"><button type="button" id="fin-btn-entrada" class="btn btn-secondary ${movement === 'entrada' ? 'active-entrada' : ''}" onclick="App.setFinanceMovement('entrada')">🟢 Entrada <small>receita</small></button><button type="button" id="fin-btn-saida" class="btn btn-secondary ${movement === 'saida' ? 'active-saida' : ''}" onclick="App.setFinanceMovement('saida')">🔴 Saída <small>custo / despesa</small></button></div><input type="hidden" id="field-prof-movement" data-prof-field="movement" value="${this.escapeHtml(movement)}"></div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Valor (R$)</label>
                        <input data-prof-field="amount" type="number" step="0.01" placeholder="0.00" value="${this.escapeHtml(fields.amount || '')}">
                    </div>
                    <div class="form-group">
                        <label>Data de Vencimento</label>
                        <input data-prof-field="dueDate" type="date" value="${this.escapeHtml(fields.dueDate || '')}">
                    </div>
                </div>
                <div class="form-row"><div class="form-group"><label>Categoria</label><select data-prof-field="category">${['Serviço técnico','Venda de peça','Manutenção','Software / assinatura','Fornecedor / peça','Transporte','Impostos','Outros'].map(value => `<option ${fields.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="form-group"><label>Forma de pagamento</label><select data-prof-field="paymentMethod">${['Pix','Dinheiro','Cartão','Transferência','Boleto','Outro'].map(value => `<option ${fields.paymentMethod === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>
                <div class="form-row"><div class="form-group"><label>Competência</label><input data-prof-field="competenceDate" type="month" value="${this.escapeHtml(fields.competenceDate || '')}"></div><div class="form-group"><label>Recorrência</label><select data-prof-field="recurrence">${['Único','Mensal','Trimestral','Anual'].map(value => `<option ${fields.recurrence === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>
            </div>`;
        }

        // 8. AGENDA TÉCNICA
        if (key === 'schedule') {
            return `
            <div class="professional-fields tech-fields-schedule">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Data / Hora Compromisso</label>
                        <input data-prof-field="date" type="datetime-local" value="${this.escapeHtml(fields.date || '')}">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Evento</label>
                        <select data-prof-field="eventType">
                            ${['Visita Técnica','Entrega de Equipamento','Retirada / Coleta','Garantia / Suporte','Reunião Presencial','Reunião Online'].map(opt => `<option value="${opt}" ${opt === fields.eventType ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Local / Endereço Completo</label>
                    <div style="display:flex; gap:6px;">
                        <input data-prof-field="location" type="text" placeholder="Endereço da visita ou link da chamada virtual" value="${this.escapeHtml(fields.location || '')}" style="flex:1;">
                        ${fields.location ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fields.location)}" target="_blank" class="btn btn-secondary" style="padding: 0 12px; margin-top:0; display:flex; align-items:center; justify-content:center;" title="Ver Rota no Waze / Maps">📍</a>` : ''}
                    </div>
                </div>
            </div>`;
        }

        // 9. SCRIPTS
        if (key === 'scripts') {
            return `
            <div class="professional-fields tech-fields-scripts">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ambiente de Execução</label>
                        <select data-prof-field="environment">
                            ${['PowerShell','CMD (Batch)','Bash (Linux)','SQL / Banco','Python','Node.js / JS','HTML/CSS','Outro'].map(opt => `<option value="${opt}" ${opt === fields.environment ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Linguagem</label>
                        <input data-prof-field="language" type="text" placeholder="Ex: PowerShell 7" value="${this.escapeHtml(fields.language || '')}">
                    </div>
                    <div class="form-group">
                        <label>Nível de Risco / Impacto</label>
                        <select data-prof-field="risk" id="script-risk-select" onchange="App.updateScriptRiskAlert(this.value)">
                            ${['Baixo (Seguro)','Médio (Ajustes de config)','Alto / Crítico (Modifica arquivos/sistemas)'].map(opt => `<option value="${opt}" ${opt === fields.risk ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div id="script-risk-warning" class="script-risk-alert" style="display:none; padding:10px; border-radius:6px; margin-top:10px; font-weight:700; font-size:0.8rem;"></div>
            </div>`;
        }

        // 10. FERRAMENTAS (TOOLBOX)
        if (key === 'toolbox') {
            return `
            <div class="professional-fields tech-fields-toolbox">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Categoria de Utilitário</label>
                        <select data-prof-field="category">
                            ${['Diagnóstico / Testes','Backup / Clonagem','Segurança / Antivírus','Drivers / BIOS','Recuperação de Dados','Redes / Monitoramento','Produtividade','Outro'].map(opt => `<option value="${opt}" ${opt === fields.category ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Versão Recomendada</label>
                        <input data-prof-field="version" type="text" placeholder="Ex: v4.8.1" value="${this.escapeHtml(fields.version || '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Link Oficial de Download / Home</label>
                    <div style="display:flex; gap:6px;">
                        <input data-prof-field="url" type="url" placeholder="https://exemplo.com/download" value="${this.escapeHtml(fields.url || '')}" style="flex:1;">
                        ${fields.url ? `<a href="${fields.url}" target="_blank" class="btn btn-secondary" style="padding: 0 12px; margin-top:0; display:flex; align-items:center; justify-content:center;" title="Acessar URL Oficial">🌐</a>` : ''}
                    </div>
                </div>
            </div>`;
        }

        // 11. REDES (NETWORKS)
        if (key === 'networks') {
            return `
            <div class="professional-fields tech-fields-networks">
                <h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Endereço Gateway (Roteador)</label>
                        <input data-prof-field="gateway" type="text" placeholder="Ex: 192.168.1.1" value="${this.escapeHtml(fields.gateway || '')}">
                    </div>
                    <div class="form-group">
                        <label>Serviço DHCP</label>
                        <select data-prof-field="dhcp">
                            ${['Ativo (Roteador)','Ativo (Servidor Local)','Inativo (IP Estático/Manual)','Parcial'].map(opt => `<option value="${opt}" ${opt === fields.dhcp ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Wi-Fi SSID Principal</label>
                        <input data-prof-field="wifi" type="text" placeholder="Ex: MinhaRede_5G" value="${this.escapeHtml(fields.wifi || '')}">
                    </div>
                    <div class="form-group">
                        <label>Versão do Mapa/Infra</label>
                        <input data-prof-field="version" type="text" placeholder="Ex: v2.1" value="${this.escapeHtml(fields.version || '')}">
                    </div>
                </div>
            </div>`;
        }

        // FALLBACK
        const config = this.professionalFieldsConfig(key);
        if (!config.length) return '';
        return `<div class="professional-fields"><h4>${this.escapeHtml(this.professionalFieldsTitle(key))}</h4><div class="form-row">${config.map(([name,label,type]) => {
            if (name === 'serial') {
                return `<div class="form-group"><label>${this.escapeHtml(label)}</label><div style="display:flex;gap:6px;"><input id="field-prof-serial" data-prof-field="${this.escapeHtml(name)}" type="${type}" value="${this.escapeHtml(fields[name] || '')}" style="flex:1;"><button class="btn btn-secondary" type="button" onclick="Scanner.start('field-prof-serial')" style="padding: 0 12px; margin-top:0;" title="Escanear Código de Barras / QR Code">📷</button></div></div>`;
            }
            return `<div class="form-group"><label>${this.escapeHtml(label)}</label><input data-prof-field="${this.escapeHtml(name)}" type="${type}" value="${this.escapeHtml(fields[name] || '')}"></div>`;
        }).join('')}</div></div>`;
    },

    /* === NOVOS HELPERS E RENDERIZADORES RICH PARA TÉCNICO OS === */
    maskPhone(input) {
        let v = input.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 10) {
            input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        } else if (v.length > 5) {
            input.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
        } else if (v.length > 2) {
            input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        } else if (v.length > 0) {
            input.value = `(${v}`;
        }
    },
    maskCpfCnpj(input) {
        let v = input.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length > 11) {
            input.value = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
        } else if (v.length > 9) {
            input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
        } else if (v.length > 6) {
            input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
        } else if (v.length > 3) {
            input.value = `${v.slice(0, 3)}.${v.slice(3)}`;
        }
    },
    updateSpecString() {
        const cpu = document.getElementById('spec-cpu')?.value || '';
        const ram = document.getElementById('spec-ram')?.value || '';
        const disk = document.getElementById('spec-disk')?.value || '';
        const display = document.getElementById('spec-string-display');
        const hidden = document.getElementById('field-prof-specs');
        const parts = [cpu, ram, disk].filter(Boolean);
        const specStr = parts.join(' / ');
        if (hidden) hidden.value = specStr;
        if (display) display.innerText = specStr || 'Nenhuma';
    },
    setTicketStatus(status) {
        const select = document.getElementById('professional-status');
        if (select) {
            select.value = status;
            App.toast(`Status alterado para "${status}". Lembre-se de salvar!`, 'info');
            document.querySelectorAll('.stepper-step').forEach((btn, idx) => {
                const stages = ['recebido','diagnóstico','orçamento','aguardando cliente','em execução','finalizado','garantia'];
                const activeIdx = stages.indexOf(status);
                const stg = stages[idx];
                btn.className = 'stepper-step';
                if (stg === status) btn.classList.add('current');
                else if (stages.indexOf(stg) < activeIdx) btn.classList.add('passed');
            });
        }
    },
    addQuickTag(tag) {
        const input = document.getElementById('field-prof-tags');
        if (!input) return;
        let tags = input.value.split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.includes(tag)) {
            tags.push(tag);
            input.value = tags.join(', ');
            App.renderKnowledgeTagsPreview(input.value);
        }
    },
    renderKnowledgeTagsPreview(value) {
        const container = document.getElementById('tags-preview-display');
        if (!container) return;
        const tags = value.split(',').map(t => t.trim()).filter(Boolean);
        container.innerHTML = tags.map(t => `<span class="badge" style="background:var(--accent2); color:#fff; padding:4px 8px; border-radius:4px; font-size:0.75rem;">#${App.escapeHtml(t)}</span>`).join('');
    },
    setFinanceMovement(type) {
        const input = document.getElementById('field-prof-movement');
        const btnEntrada = document.getElementById('fin-btn-entrada');
        const btnSaida = document.getElementById('fin-btn-saida');
        if (input) {
            input.value = type;
            if (type === 'entrada') {
                btnEntrada?.classList.add('active-entrada');
                btnSaida?.classList.remove('active-saida');
            } else {
                btnSaida?.classList.add('active-saida');
                btnEntrada?.classList.remove('active-entrada');
            }
        }
    },
    updateScriptRiskAlert(val) {
        const warning = document.getElementById('script-risk-warning');
        if (!warning) return;
        if (val.includes('Alto')) {
            warning.style.display = 'block';
            warning.style.background = 'rgba(239, 83, 80, 0.15)';
            warning.style.border = '1px solid #EF5350';
            warning.style.color = '#EF5350';
            warning.innerHTML = '⚠️ ATENÇÃO: Script de Alto Risco! Revise antes de executar em ambiente de produção.';
        } else if (val.includes('Médio')) {
            warning.style.display = 'block';
            warning.style.background = 'rgba(255, 145, 0, 0.15)';
            warning.style.border = '1px solid #FF9100';
            warning.style.color = '#FF9100';
            warning.innerHTML = '⚡ CUIDADO: Este script altera configurações de sistema e serviços.';
        } else {
            warning.style.display = 'none';
        }
    },
    toggleRunbookCheckbox(recordId, idx, checked) {
        const record = Storage.getProfessionalRecords().find(r => r.id === recordId);
        if (!record) return;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(record.content, 'text/html');
        const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
        if (checkboxes[idx]) {
            if (checked) checkboxes[idx].setAttribute('checked', 'checked');
            else checkboxes[idx].removeAttribute('checked');
        }
        
        const newContent = doc.body.innerHTML;
        Storage.updateProfessionalRecord(recordId, { content: newContent });
        
        if (checked && typeof Gamification !== 'undefined') {
            Gamification.awardXp(5, 'Tarefa técnica concluída ✅');
        }
        
        const main = document.getElementById('main-content');
        if (main) {
            this.renderProfessionalModule(main, 'runbooks');
        }
        App.toast(checked ? 'Tarefa concluída!' : 'Tarefa desmarcada.', 'success');
    },
    copyToClipboard(text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            this.toast('Copiado para a área de transferência!', 'success');
        }).catch(() => {
            this.toast('Erro ao copiar.', 'error');
        });
    },
    renderRichRecordListHtml(key, records, mod) {
        // 1. CLIENTES (CRM)
        if (key === 'clients') {
            return `<div class="tech-clients-grid">${records.map(r => {
                const fields = r.fields || {};
                const name = r.title || 'Cliente sem nome';
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const phone = fields.phone || '';
                const email = fields.email || 'Sem email cadastrado';
                const doc = fields.document || 'Sem documento';
                const waLink = phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : '';
                
                const linkedCount = Storage.getProfessionalRecords().filter(pr => pr.clientId === r.id && pr.id !== r.id).length;

                return `
                <div class="tech-client-card mui-glass">
                    <div class="client-card-main" onclick="App.openClientDetail('${r.id}')">
                        <div class="client-avatar">${initials}</div>
                        <div class="client-info">
                            <h4>${this.escapeHtml(name)}</h4>
                            <span class="client-badge status-${r.status || 'ativo'}">${r.status || 'ativo'}</span>
                            <p class="client-meta">📂 ${linkedCount} Vínculo(s) · 💳 ${doc}</p>
                            <p class="client-email">📧 ${this.escapeHtml(email)}</p>
                        </div>
                    </div>
                    <div class="client-card-actions">
                        ${phone ? `<a href="${waLink}" target="_blank" class="client-wa-btn" title="Chamar no WhatsApp">💬 WhatsApp: ${this.escapeHtml(phone)}</a>` : '<span class="client-no-phone">Sem telefone</span>'}
                        <div class="client-shortcuts">
                            <button type="button" class="btn btn-sm btn-primary" onclick="App.createProfessionalRecord('tickets', '', '${r.id}')" title="Nova OS">+ OS</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('equipment', '', '${r.id}')" title="Novo Equipamento">+ Equip</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('budgets', '', '${r.id}')" title="Novo Orçamento">+ Orç</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('schedule', '', '${r.id}')" title="Agendar Visita">+ Agen</button>
                        </div>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 2. EQUIPAMENTOS (HARDWARE)
        if (key === 'equipment') {
            return `<div class="tech-equip-grid">${records.map(r => {
                const fields = r.fields || {};
                const type = fields.type || 'Notebook';
                const brandModel = fields.brandModel || 'Modelo indefinido';
                const serial = fields.serial || 'S/N Não cadastrado';
                const os = fields.os || 'Sem OS';
                const specs = fields.specs || '';
                
                const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                const iconMap = { 'Notebook': '💻', 'Desktop / PC': '🖥️', 'Servidor': '💾', 'Impressora': '🖨️', 'Roteador / Rede': '📶', 'Smartphone / Tablet': '📱', 'Outro': '🔌' };
                const icon = iconMap[type] || '🔌';

                const specParts = specs.split(' / ').filter(Boolean);

                return `
                <div class="tech-equip-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="equip-header">
                        <span class="equip-icon">${icon}</span>
                        <div>
                            <h4>${this.escapeHtml(brandModel)}</h4>
                            <span class="equip-type-badge">${type}</span>
                        </div>
                    </div>
                    <div class="equip-body">
                        <p class="equip-serial">Serial: <code>${this.escapeHtml(serial)}</code> <button class="copy-sn-btn" onclick="event.stopPropagation();App.copyToClipboard('${serial.replace(/'/g, "\\'")}')" title="Copiar Serial">📋</button> <button class="copy-sn-btn" onclick="event.stopPropagation();App.showEquipmentQr('${r.id}')" title="Gerar QR Code">QR</button></p>
                        ${client ? `<p class="equip-client">👥 Cliente: <strong>${this.escapeHtml(client.title)}</strong></p>` : '<p class="equip-client text-muted">Vínculo: Sem cliente</p>'}
                        <div class="equip-specs-chips">
                            ${specParts.map(sp => `<span>${this.escapeHtml(sp)}</span>`).join('') || '<span class="text-muted">Sem specs</span>'}
                            <span class="os-badge">${os}</span>
                        </div>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 3. ATENDIMENTOS (ORDENS DE SERVIÇO)
        if (key === 'tickets') {
            const stages = ['recebido','diagnóstico','orçamento','aguardando cliente','em execução','finalizado','garantia'];
            return `<div class="tech-tickets-grid">${records.map(r => {
                const fields = r.fields || {};
                const status = r.status || 'recebido';
                const reported = fields.reportedProblem || 'Problema não relatado';
                const diagnosis = fields.diagnosis || 'Sem diagnóstico';
                const warranty = fields.warrantyUntil ? new Date(fields.warrantyUntil).toLocaleDateString('pt-BR') : '';
                
                const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                const equip = r.equipmentId ? Storage.getProfessionalRecords('equipment').find(e => e.id === r.equipmentId) : null;

                const statusColors = {
                    'recebido': '#4EA8DE',
                    'diagnóstico': '#F77F00',
                    'orçamento': '#FFD166',
                    'aguardando cliente': '#F15BB5',
                    'em execução': '#3A86C8',
                    'finalizado': '#38B000',
                    'garantia': '#06D6A0'
                };
                const color = statusColors[status] || '#7C4DFF';
                const activeIdx = stages.indexOf(status);

                return `
                <div class="tech-ticket-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="ticket-card-header" style="border-left: 4px solid ${color};">
                        <div>
                            <h4>${this.escapeHtml(r.title)}</h4>
                            <small>${client ? `👥 ${this.escapeHtml(client.title)}` : 'Sem cliente'} ${equip ? `· 💻 ${this.escapeHtml(equip.title)}` : ''}</small>
                        </div>
                        <span class="ticket-status-badge" style="background:${color};">${status}</span>
                    </div>
                    <div class="ticket-card-body">
                        <p class="ticket-prob"><strong>🚨 Sintoma:</strong> ${this.escapeHtml(reported)}</p>
                        <p class="ticket-diag"><strong>🔍 Laudo:</strong> ${this.escapeHtml(diagnosis)}</p>
                        ${warranty ? `<p class="ticket-warranty">🛡️ Garantia até: <strong style="color:#06D6A0;">${warranty}</strong></p>` : ''}
                        
                        <div class="ticket-card-progress" style="margin-top: 12px; height: 4px; background: rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; display:flex;">
                            ${stages.map((stg, idx) => {
                                const isFilled = idx <= activeIdx;
                                return `<span style="flex:1; height:100%; background:${isFilled ? color : 'transparent'}; margin-right: 2px;"></span>`;
                            }).join('')}
                        </div>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 4. BASE TÉCNICA (WIKI)
        if (key === 'knowledge') {
            return `<div class="tech-kb-grid">${records.map(r => {
                const fields = r.fields || {};
                const problem = fields.problem || r.title || 'Artigo';
                const cause = fields.cause || 'Não documentada';
                const tags = fields.tags || '';
                const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
                const commands = r.content?.match(/<code>([\s\S]*?)<\/code>/)?.[1] || '';

                return `
                <div class="tech-kb-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="kb-header">
                        <h4>🧠 ${this.escapeHtml(problem)}</h4>
                        <div class="kb-tags">
                            ${tagList.map(t => `<span class="kb-tag">#${this.escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="kb-body">
                        <p><strong>Causa provável:</strong> ${this.escapeHtml(cause)}</p>
                        ${commands ? `
                            <div class="kb-code-box" onclick="event.stopPropagation();">
                                <pre><code>${this.escapeHtml(commands.trim())}</code></pre>
                                <button class="copy-cmd-btn" onclick="App.copyToClipboard('${commands.trim().replace(/\n/g, '\\n').replace(/'/g, "\\'")}')" title="Copiar Comando">Copiar</button>
                            </div>
                        ` : ''}
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 5. RUNBOOKS (CHECKLISTS)
        if (key === 'runbooks') {
            return `<div class="tech-runbooks-grid">${records.map(r => {
                const fields = r.fields || {};
                const obj = fields.objective || 'Procedimento Técnico';
                const freq = fields.frequency || 'Sob Demanda';
                const ver = fields.version || 'v1.0';

                const parser = new DOMParser();
                const doc = parser.parseFromString(r.content, 'text/html');
                const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'));
                const checkedCount = checkboxes.filter(cb => cb.checked || cb.hasAttribute('checked')).length;
                const totalCount = checkboxes.length;
                const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

                return `
                <div class="tech-runbook-card mui-glass">
                    <div class="runbook-card-main" onclick="App.openProfessionalRecord('${r.id}')">
                        <div class="runbook-head">
                            <h4>✅ ${this.escapeHtml(r.title)}</h4>
                            <span class="runbook-ver">${ver}</span>
                        </div>
                        <p class="runbook-obj"><strong>Objetivo:</strong> ${this.escapeHtml(obj)}</p>
                        <div class="runbook-meta"><span>📅 ${freq}</span><span style="color:#06D6A0; font-weight:700;">${checkedCount}/${totalCount} Concluído (${pct}%)</span></div>
                        
                        <div class="runbook-progress-bar" style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow:hidden; margin: 12px 0;">
                            <div style="width: ${pct}%; height: 100%; background: #06D6A0; border-radius: 3px; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    ${totalCount > 0 ? `
                        <details class="runbook-inline-tasks">
                            <summary>Ver lista de passos (${totalCount})</summary>
                            <div class="tasks-list-inline" style="padding:10px 0 0 0;">
                                ${checkboxes.map((cb, idx) => {
                                    const isChecked = cb.checked || cb.hasAttribute('checked');
                                    const li = cb.parentElement;
                                    const taskText = li ? li.innerText.trim() : `Item ${idx + 1}`;
                                    return `
                                    <label class="task-checkbox-row" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.85rem; cursor:pointer;">
                                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="App.toggleRunbookCheckbox('${r.id}', ${idx}, this.checked)">
                                        <span class="${isChecked ? 'task-done' : ''}">${App.escapeHtml(taskText)}</span>
                                    </label>`;
                                }).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>`;
            }).join('')}</div>`;
        }

        // 6. ORÇAMENTOS
        if (key === 'budgets') {
            return `<div class="tech-budgets-grid">${records.map(r => {
                const fields = r.fields || {};
                const payment = fields.payment || 'Pix';
                const warranty = fields.warranty || '90 dias';
                const valid = fields.validUntil ? new Date(fields.validUntil).toLocaleDateString('pt-BR') : 'Não informada';
                const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                
                const budgetAdvanced = fields.budgetAdvanced || {};
                const items = budgetAdvanced.items || [];
                const total = this.calculateBudgetTotal(items);

                const statusColors = {
                    'rascunho': '#ADB5BD',
                    'enviado': '#4EA8DE',
                    'aprovado': '#38B000',
                    'recusado': '#EF5350',
                    'pago': '#06D6A0',
                    'cancelado': '#6C757D'
                };
                const color = statusColors[r.status] || '#FFD166';

                return `
                <div class="tech-budget-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="budget-card-head">
                        <div>
                            <h4>🧾 Orçamento: ${this.escapeHtml(r.title)}</h4>
                            <p class="budget-client">Cliente: <strong>${client ? this.escapeHtml(client.title) : 'Não vinculado'}</strong></p>
                        </div>
                        <span class="budget-status-badge" style="background:${color};">${r.status || 'rascunho'}</span>
                    </div>
                    <div class="budget-card-body">
                        <div class="budget-pricing-summary">
                            <div class="price-box">
                                <span class="price-val" style="color:${color};">${this.formatCurrency(total)}</span>
                                <small>Valor total estimado</small>
                            </div>
                        </div>
                        <div class="budget-specs">
                            <span>💳 ${this.escapeHtml(payment)}</span>
                            <span>🛡️ ${this.escapeHtml(warranty)}</span>
                            <span>📅 Vence: ${valid}</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();App.exportProfessionalRecordHtml('${r.id}')" style="width:100%; margin-top:10px;">📋 Gerar PDF / Exportar Orçamento</button>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 7. FINANCEIRO
        if (key === 'finance') {
            return `<div class="tech-finance-grid">${records.map(r => {
                const fields = r.fields || {};
                const amount = Number(fields.amount || 0);
                const movement = fields.movement || 'entrada';
                const due = fields.dueDate ? new Date(fields.dueDate).toLocaleDateString('pt-BR') : '';
                const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                const isIncome = movement === 'entrada';

                return `
                <div class="tech-fin-row mui-glass ${isIncome ? 'income' : 'expense'}" onclick="App.openProfessionalRecord('${r.id}')">
                    <span class="fin-indicator">${isIncome ? '🟢' : '🔴'}</span>
                    <div class="fin-details">
                        <h4>${this.escapeHtml(r.title)}</h4>
                        <small>${client ? `Cliente: ${this.escapeHtml(client.title)}` : 'Sem vínculo'} ${due ? `· Vencimento: ${due}` : ''}</small>
                    </div>
                    <div class="fin-amount" style="color:${isIncome ? '#38B000' : '#EF5350'}; font-weight:800;">
                        ${isIncome ? '+' : '-'} ${this.formatCurrency(amount)}
                        <span class="fin-pay-status badge">${r.status || 'pendente'}</span>
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 8. AGENDA TÉCNICA
        if (key === 'schedule') {
            return `<div class="tech-schedule-grid">${records.map(r => {
                const fields = r.fields || {};
                const eventType = fields.eventType || 'Visita Técnica';
                const dateVal = fields.date || '';
                const location = fields.location || '';
                const client = r.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === r.clientId) : null;
                
                let dateDisplay = 'Não agendado';
                let timeDisplay = '';
                let isUpcoming = false;
                let daysLeft = '';

                if (dateVal) {
                    const d = new Date(dateVal);
                    dateDisplay = d.toLocaleDateString('pt-BR');
                    timeDisplay = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    
                    const now = new Date();
                    const diffTime = d - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffTime > 0) {
                        isUpcoming = true;
                        if (diffDays === 1) daysLeft = 'Amanhã';
                        else if (diffDays === 0) daysLeft = 'Hoje';
                        else daysLeft = `Em ${diffDays} dias`;
                    } else {
                        daysLeft = 'Passado';
                    }
                }

                return `
                <div class="tech-sched-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="sched-date-box">
                        <span class="sched-day-left">${daysLeft}</span>
                        <span class="sched-date">${dateDisplay}</span>
                        <span class="sched-time">${timeDisplay}</span>
                    </div>
                    <div class="sched-info">
                        <span class="sched-type-badge">${eventType}</span>
                        <h4>${this.escapeHtml(r.title)}</h4>
                        ${client ? `<p class="sched-client">👥 Cliente: <strong>${this.escapeHtml(client.title)}</strong></p>` : ''}
                        ${location ? `<p class="sched-loc">📍 ${this.escapeHtml(location)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}" target="_blank" onclick="event.stopPropagation();" class="sched-map-btn" title="Abrir Rota">🗺️ Rota</a></p>` : ''}
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 9. SCRIPTS
        if (key === 'scripts') {
            return `<div class="tech-scripts-grid">${records.map(r => {
                const fields = r.fields || {};
                const env = fields.environment || 'PowerShell';
                const risk = fields.risk || 'Baixo (Seguro)';
                const command = r.content?.match(/<code>([\s\S]*?)<\/code>/)?.[1] || '';

                const riskColors = {
                    'Baixo (Seguro)': '#38B000',
                    'Médio (Ajustes de config)': '#FF9100',
                    'Alto / Crítico (Modifica arquivos/sistemas)': '#EF5350'
                };
                const color = riskColors[risk] || '#EF5350';

                return `
                <div class="tech-script-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="script-header">
                        <div>
                            <h4>⌨️ ${this.escapeHtml(r.title)}</h4>
                            <span class="script-env-badge">${env}</span>
                        </div>
                        <span class="script-risk-badge" style="border: 1px solid ${color}; color:${color};">${risk.split(' ')[0]}</span>
                    </div>
                    <div class="script-body">
                        ${command ? `
                            <div class="script-code-wrap" onclick="event.stopPropagation();">
                                <pre><code>${this.escapeHtml(command.trim())}</code></pre>
                                <button class="btn btn-sm btn-primary copy-script-btn" onclick="App.copyToClipboard('${command.trim().replace(/\n/g, '\\n').replace(/'/g, "\\'")}')">📋 Copiar</button>
                            </div>
                        ` : '<p class="text-muted">Sem comando anexado no editor.</p>'}
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // 10. FERRAMENTAS (TOOLBOX)
        if (key === 'toolbox') {
            return `<div class="tech-tools-grid">${records.map(r => {
                const fields = r.fields || {};
                const url = fields.url || '';
                const cat = fields.category || 'Diagnóstico / Testes';
                const ver = fields.version || 'v1.0';

                return `
                <div class="tech-tool-card mui-glass" onclick="App.openProfessionalRecord('${r.id}')">
                    <div class="tool-card-head">
                        <span class="tool-app-avatar">🧰</span>
                        <div>
                            <h4>${this.escapeHtml(r.title)}</h4>
                            <span class="tool-cat-badge">${cat}</span>
                        </div>
                    </div>
                    <div class="tool-card-body">
                        <div class="tool-meta"><span>Versão: ${ver}</span></div>
                        ${url ? `<a href="${url}" target="_blank" onclick="event.stopPropagation();" class="tool-download-btn btn btn-primary" title="Ir para Página de Download">🌐 Baixar / Acessar Site</a>` : '<span class="text-muted">Sem link de download</span>'}
                    </div>
                </div>`;
            }).join('')}</div>`;
        }

        // FALLBACK
        return records.map(r => this.professionalRecordButtonHtml(r, mod)).join('');
    },

    collectProfessionalFields() {
        const fields = {};
        document.querySelectorAll('[data-prof-field]').forEach(input => {
            fields[input.dataset.profField] = input.value || '';
        });
        return fields;
    },
    networkBuilderConfig(section = '') {
        const configs = {
            devices: [
                ['type','Tipo','select',['roteador','switch','ap','servidor','nas','impressora','camera','dvr/nvr','pc','notebook','outro']],
                ['name','Nome','text'], ['ip','IP','text'], ['mac','MAC','text'], ['model','Modelo','text'], ['location','Local','text'],
                ['status','Status','select',['atual','antigo','trocar','revisar','offline']], ['notes','Obs.','text']
            ],
            subnets: [
                ['name','Nome','text'], ['cidr','Rede/CIDR','text'], ['gateway','Gateway','text'], ['dhcp','DHCP','text'], ['dns','DNS','text'], ['vlan','VLAN','text'], ['purpose','Finalidade','text']
            ],
            wifi: [
                ['ssid','SSID','text'], ['security','Segurança','text'], ['equipment','Equipamento/AP','text'], ['location','Local','text'], ['vaultRef','Cofre/ref. senha','text'], ['notes','Obs.','text']
            ],
            cameras: [
                ['name','Nome/canal','text'], ['ip','IP','text'], ['location','Local','text'], ['channel','Canal','text'], ['model','Modelo','text'], ['notes','Obs.','text']
            ]
        };
        return configs[section] || configs.devices;
    },
    networkSectionTitle(section = '') {
        return { devices: 'Dispositivos', subnets: 'Sub-redes / VLANs', wifi: 'Wi-Fi / APs', cameras: 'CFTV / Câmeras' }[section] || 'Itens';
    },
    networkAdvancedHtml(record = null) {
        const data = record?.fields?.networkAdvanced || {};
        const audit = data.audit || {};
        const auditItems = [
            ['ipsDocumented','IPs documentados'],
            ['configBackup','Backup de configuração'],
            ['firmwareChecked','Firmware revisado'],
            ['passwordsReviewed','Senhas revisadas'],
            ['equipmentLabeled','Equipamentos identificados'],
            ['criticalPoints','Pontos críticos anotados']
        ];
        const sections = ['devices','subnets','wifi','cameras'];
        return `<div class="network-builder">
            <div class="network-builder-head"><div><h4>Inventário avançado de rede</h4><p>Use as tabelas para redes grandes. O campo Registro fica para observações livres, histórico e detalhes que não entram nas colunas.</p></div></div>
            <details open><summary>Importação rápida por IP</summary>
                <div class="network-import">
                    <textarea id="network-import-raw" rows="4" placeholder="Cole uma lista, um por linha. Ex:&#10;192.168.0.1 Roteador principal&#10;192.168.0.10 Servidor arquivos&#10;192.168.0.50 Impressora recepção"></textarea>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="App.importNetworkDevices()">Transformar em dispositivos</button>
                </div>
            </details>
            ${sections.map(section => this.networkSectionHtml(section, data[section] || [])).join('')}
            <details open><summary>Checklist de auditoria</summary>
                <div class="network-audit-grid">${auditItems.map(([key,label]) => `<label class="checkbox-row"><input type="checkbox" data-network-audit="${key}" ${audit[key] ? 'checked' : ''}> ${this.escapeHtml(label)}</label>`).join('')}</div>
                <div class="form-group"><label>Pendências de auditoria</label><textarea id="network-audit-notes" rows="3" placeholder="O que ficou para revisar na próxima visita?">${this.escapeHtml(data.auditNotes || '')}</textarea></div>
            </details>
        </div>`;
    },
    networkSectionHtml(section, items = []) {
        const rows = items.length ? items : [this.emptyNetworkItem(section)];
        return `<details open><summary>${this.networkSectionTitle(section)} <button type="button" class="btn btn-sm btn-secondary" onclick="event.preventDefault();App.addNetworkRow('${section}')">Adicionar</button></summary>
            <div class="network-table-wrap"><table class="network-table" data-network-section="${section}">
                <thead><tr>${this.networkBuilderConfig(section).map(([,label]) => `<th>${this.escapeHtml(label)}</th>`).join('')}<th></th></tr></thead>
                <tbody>${rows.map(item => this.networkRowHtml(section, item)).join('')}</tbody>
            </table></div>
        </details>`;
    },
    emptyNetworkItem(section) {
        if (section === 'devices') return { type: 'outro', status: 'atual' };
        return {};
    },
    networkRowHtml(section, item = {}) {
        const cells = this.networkBuilderConfig(section).map(([key,label,type,options]) => {
            const value = item[key] || '';
            if (type === 'select') {
                return `<td><select data-network-field="${key}" aria-label="${this.escapeHtml(label)}">${options.map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${this.escapeHtml(opt)}</option>`).join('')}</select></td>`;
            }
            return `<td><input data-network-field="${key}" value="${this.escapeHtml(value)}" aria-label="${this.escapeHtml(label)}"></td>`;
        }).join('');
        return `<tr data-network-row>${cells}<td><button type="button" class="btn btn-sm btn-danger" onclick="App.removeNetworkRow(this)">Remover</button></td></tr>`;
    },
    addNetworkRow(section, item = null) {
        const table = document.querySelector(`.network-table[data-network-section="${section}"] tbody`);
        if (!table) return;
        table.insertAdjacentHTML('beforeend', this.networkRowHtml(section, item || this.emptyNetworkItem(section)));
    },
    removeNetworkRow(button) {
        const row = button.closest('[data-network-row]');
        const tbody = row?.parentElement;
        if (!row || !tbody) return;
        if (tbody.querySelectorAll('[data-network-row]').length <= 1) {
            row.querySelectorAll('input').forEach(input => input.value = '');
            row.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
            return;
        }
        row.remove();
    },
    collectNetworkAdvanced() {
        const data = {};
        document.querySelectorAll('.network-table').forEach(table => {
            const section = table.dataset.networkSection;
            data[section] = Array.from(table.querySelectorAll('[data-network-row]')).map(row => {
                const item = {};
                row.querySelectorAll('[data-network-field]').forEach(input => { item[input.dataset.networkField] = input.value.trim(); });
                return item;
            }).filter(item => Object.entries(item).some(([key, value]) => {
                if (!value) return false;
                if (key === 'type' && value === 'outro') return false;
                if (key === 'status' && value === 'atual') return false;
                return true;
            }));
        });
        data.audit = {};
        document.querySelectorAll('[data-network-audit]').forEach(input => { data.audit[input.dataset.networkAudit] = input.checked; });
        data.auditNotes = document.getElementById('network-audit-notes')?.value || '';
        return data;
    },
    importNetworkDevices() {
        const raw = document.getElementById('network-import-raw')?.value || '';
        const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        let count = 0;
        lines.forEach(line => {
            const ip = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0] || '';
            const name = line.replace(ip, '').replace(/^[\s\-:;|,]+/, '').trim();
            if (!ip && !name) return;
            this.addNetworkRow('devices', { type: this.guessNetworkDeviceType(name), name: name || ip, ip, status: 'atual' });
            count++;
        });
        const input = document.getElementById('network-import-raw');
        if (input) input.value = '';
        this.toast(`${count} dispositivo(s) importado(s).`, count ? 'success' : 'info');
    },
    guessNetworkDeviceType(text = '') {
        const value = text.toLowerCase();
        if (/roteador|router|gateway/.test(value)) return 'roteador';
        if (/switch/.test(value)) return 'switch';
        if (/\bap\b|access|wifi|wi-fi/.test(value)) return 'ap';
        if (/servidor|server/.test(value)) return 'servidor';
        if (/nas/.test(value)) return 'nas';
        if (/impressora|printer/.test(value)) return 'impressora';
        if (/camera|câmera|dvr|nvr|cftv/.test(value)) return 'camera';
        if (/notebook/.test(value)) return 'notebook';
        if (/\bpc\b|desktop/.test(value)) return 'pc';
        return 'outro';
    },
    budgetAdvancedHtml(record = null) {
        const data = record?.fields?.budgetAdvanced || {};
        const items = data.items?.length ? data.items : [this.emptyBudgetItem()];
        return `<div class="budget-builder">
            <div class="network-builder-head"><div><h4>Itens do orçamento</h4><p>Cadastre serviços, peças e descontos por linha. O campo abaixo fica apenas para observações livres.</p></div></div>
            <div class="network-table-wrap"><table class="network-table budget-table" data-budget-table>
                <thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th><th></th></tr></thead>
                <tbody>${items.map(item => this.budgetRowHtml(item)).join('')}</tbody>
            </table></div>
            <div class="budget-actions">
                <button type="button" class="btn btn-sm btn-secondary" onclick="App.addBudgetRow()">Adicionar item</button>
                <div class="budget-total"><span>Total</span><strong id="budget-total-display">${this.formatCurrency(this.calculateBudgetTotal(items))}</strong></div>
            </div>
        </div>`;
    },
    emptyBudgetItem() {
        return { type: 'serviço', description: '', qty: 1, unit: 0 };
    },
    budgetRowHtml(item = {}) {
        const type = item.type || 'serviço';
        const qty = Number(item.qty || 1);
        const unit = Number(item.unit || 0);
        const total = qty * unit;
        return `<tr data-budget-row>
            <td><select data-budget-field="type" onchange="App.updateBudgetTotals()">${['serviço','peça','desconto','taxa','outro'].map(opt => `<option value="${opt}" ${opt === type ? 'selected' : ''}>${this.escapeHtml(opt)}</option>`).join('')}</select></td>
            <td><input data-budget-field="description" value="${this.escapeHtml(item.description || '')}" placeholder="Descrição do item"></td>
            <td><input data-budget-field="qty" type="number" step="0.01" min="0" value="${this.escapeHtml(qty)}" oninput="App.updateBudgetTotals()"></td>
            <td><input data-budget-field="unit" type="number" step="0.01" value="${this.escapeHtml(unit)}" oninput="App.updateBudgetTotals()"></td>
            <td><strong data-budget-total>${this.formatCurrency(total)}</strong></td>
            <td><button type="button" class="btn btn-sm btn-danger" onclick="App.removeBudgetRow(this)">Remover</button></td>
        </tr>`;
    },
    addBudgetRow(item = null) {
        const body = document.querySelector('[data-budget-table] tbody');
        if (!body) return;
        body.insertAdjacentHTML('beforeend', this.budgetRowHtml(item || this.emptyBudgetItem()));
        this.updateBudgetTotals();
    },
    removeBudgetRow(button) {
        const row = button.closest('[data-budget-row]');
        const tbody = row?.parentElement;
        if (!row || !tbody) return;
        if (tbody.querySelectorAll('[data-budget-row]').length <= 1) {
            row.querySelector('[data-budget-field="description"]').value = '';
            row.querySelector('[data-budget-field="qty"]').value = '1';
            row.querySelector('[data-budget-field="unit"]').value = '0';
        } else {
            row.remove();
        }
        this.updateBudgetTotals();
    },
    collectBudgetAdvanced() {
        const items = Array.from(document.querySelectorAll('[data-budget-row]')).map(row => {
            const item = {};
            row.querySelectorAll('[data-budget-field]').forEach(input => {
                item[input.dataset.budgetField] = input.value.trim();
            });
            item.qty = Number(item.qty || 0);
            item.unit = Number(item.unit || 0);
            return item;
        }).filter(item => item.description || item.unit);
        return { items, total: this.calculateBudgetTotal(items) };
    },
    updateBudgetTotals() {
        document.querySelectorAll('[data-budget-row]').forEach(row => {
            const item = {};
            row.querySelectorAll('[data-budget-field]').forEach(input => { item[input.dataset.budgetField] = input.value.trim(); });
            const total = Number(item.qty || 0) * Number(item.unit || 0);
            const target = row.querySelector('[data-budget-total]');
            if (target) target.textContent = this.formatCurrency(total);
        });
        const display = document.getElementById('budget-total-display');
        if (display) display.textContent = this.formatCurrency(this.collectBudgetAdvanced().total);
    },
    calculateBudgetTotal(items = []) {
        return items.reduce((sum, item) => {
            const value = Number(item.qty || 0) * Number(item.unit || 0);
            return sum + (item.type === 'desconto' ? -Math.abs(value) : value);
        }, 0);
    },
    formatCurrency(value = 0) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    },
    professionalAttachmentsHtml(record = null) {
        if (!record?.id) return '<div class="professional-attachments"><p class="text-muted">Salve o registro para anexar arquivos, prints, PDFs ou comprovantes.</p></div>';
        const attachments = record.attachments || [];
        return `<div class="professional-attachments">
            <div class="dash-section-header"><h4>Anexos</h4><label class="btn btn-sm btn-secondary">Adicionar arquivo<input type="file" style="display:none" onchange="App.addProfessionalAttachment('${record.id}', this.files[0])"></label></div>
            ${attachments.length ? attachments.map(att => `<div class="attachment-row"><a href="${att.dataUrl}" download="${this.escapeHtml(att.name)}">${this.escapeHtml(att.name)}</a><small>${this.escapeHtml(att.type || 'arquivo')} · ${this.formatBytes(att.size || 0)}</small><button type="button" class="btn btn-sm btn-danger" onclick="App.deleteProfessionalAttachment('${record.id}','${att.id}')">Remover</button></div>`).join('') : '<p class="text-muted">Nenhum anexo ainda.</p>'}
        </div>`;
    },
    createProfessionalRecord(key, id = '', prefillClientId = '') {
        const mod = this.getProfessionalModules()[key];
        if (!mod) return;
        const record = id ? Storage.getProfessionalRecords().find(r => r.id === id) : null;
        const title = record?.title || `${mod.noteTitle} - ${new Date().toLocaleDateString('pt-BR')}`;
        const content = record?.content || '';
        const status = record?.status || mod.statuses?.[0] || 'aberto';
        const selectedClient = record?.clientId || record?.client || prefillClientId || '';
        const selectedEquipment = record?.equipmentId || record?.equipment || '';
        const clientField = key !== 'clients'
            ? `<div class="form-group"><label>Cliente vinculado</label><select id="professional-client" onchange="App.refreshProfessionalEquipmentOptions(this.value)">${this.professionalClientOptions(selectedClient)}</select></div>`
            : '';
        const equipmentField = !['clients','equipment','finance'].includes(key)
            ? `<div class="form-group"><label>Equipamento vinculado</label><select id="professional-equipment" onchange="App.applyEquipmentClient(this.value)">${this.professionalEquipmentOptions(selectedClient, selectedEquipment)}</select></div>`
            : '';
        const exportButton = id ? `<button type="button" class="btn btn-secondary" onclick="App.exportProfessionalRecordHtml('${id}')">Exportar HTML/PDF</button>` : '';
        const actionLabel = id ? 'Editar' : 'Novo';
        const modalTitle = `${actionLabel} ${mod.noteTitle.toLowerCase()}`;
        const contextMeta = [
            mod.statusLabel || 'Status',
            record ? `Atualizado em ${new Date(record.updatedAt || record.createdAt).toLocaleDateString('pt-BR')}` : 'Novo registro separado das notas',
            key !== 'clients' ? 'Pode vincular cliente' : 'Base para vínculos'
        ];
        this.showModal(modalTitle, `
            ${this.modalContextHtml({
                icon: mod.icon,
                title: `${actionLabel} ${mod.noteTitle}`,
                description: mod.subtitle,
                meta: contextMeta,
                tone: key
            })}
            <form onsubmit="App.saveProfessionalRecord('${key}','${id}');return false;" class="settings-entity-form module-form professional-record-form">
                <div class="form-group"><label>${key === 'finance' ? 'Descrição do movimento' : 'Título'}</label><input id="professional-title" value="${this.escapeHtml(title)}" required placeholder="${key === 'finance' ? 'Ex.: Troca de tela — cliente João' : ''}"></div>
                <div class="form-row">${clientField}${equipmentField}</div>
                <div class="form-row">
                    <div class="form-group"><label>${this.escapeHtml(mod.statusLabel || 'Status')}</label><select id="professional-status">${(mod.statuses || ['aberto','finalizado','arquivado']).map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Módulo</label><input value="${this.escapeHtml(mod.title)}" readonly></div>
                </div>
                ${this.professionalFieldsHtml(key, record)}
                ${key === 'budgets' ? this.budgetAdvancedHtml(record) : ''}
                ${key === 'networks' ? this.networkAdvancedHtml(record) : ''}
                <div class="form-group"><label>Observações / Detalhes Adicionais</label>${this.professionalEditorHtml(content)}</div>
                ${this.professionalAttachmentsHtml(record)}
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `${exportButton}<button type="button" class="btn btn-secondary" onclick="App.convertProfessionalRecordToNote('${id}')">Converter em nota</button><button type="button" class="btn btn-danger" onclick="App.deleteProfessionalRecord('${id}')">Apagar</button>` : ''}<button type="submit" class="btn btn-primary">Salvar</button></div>
            </form>
        `);
        setTimeout(() => {
            const contentEl = document.getElementById('professional-content') || document;
            MermaidLite.renderAll(contentEl);
            QueryView.renderAll(contentEl);
            WikiLinks.renderAll(contentEl);
            if (key === 'scripts') {
                App.updateScriptRiskAlert(document.getElementById('script-risk-select')?.value || '');
            }
            if (key === 'knowledge') {
                App.renderKnowledgeTagsPreview(document.getElementById('field-prof-tags')?.value || '');
            }
            App.bindProfessionalSnippetExpander();
        }, 0);
    },
    professionalEditorHtml(content = '') {
        return `
            <div class="professional-editor-shell">
                <div class="editor-toolbar professional-editor-toolbar">
                    <button type="button" onclick="App.professionalExec('bold')" title="Negrito"><b>B</b></button>
                    <button type="button" onclick="App.professionalExec('italic')" title="Itálico"><i>I</i></button>
                    <button type="button" onclick="App.professionalExec('underline')" title="Sublinhado"><u>U</u></button>
                    <span class="toolbar-sep"></span>
                    <button type="button" onclick="App.professionalExec('formatBlock','<h2>')" title="Título">H2</button>
                    <button type="button" onclick="App.professionalExec('formatBlock','<h3>')" title="Subtítulo">H3</button>
                    <button type="button" onclick="App.professionalExec('formatBlock','<p>')" title="Parágrafo">P</button>
                    <span class="toolbar-sep"></span>
                    <button type="button" onclick="App.professionalExec('insertUnorderedList')" title="Lista">•</button>
                    <button type="button" onclick="App.professionalExec('insertOrderedList')" title="Lista numerada">1.</button>
                    <button type="button" onclick="App.professionalExec('insertHTML','<p><input type=&quot;checkbox&quot;> Item</p>')" title="Checklist">☑</button>
                    <span class="toolbar-sep"></span>
                    <button type="button" onclick="App.insertProfessionalMermaid()" title="Diagrama Mermaid">Diag</button>
                    <button type="button" onclick="App.showSnippetLibrary()" title="Respostas rápidas">Snip</button>
                    <button type="button" onclick="App.professionalExec('removeFormat')" title="Limpar formatação">Tx</button>
                </div>
                <div id="professional-content" class="professional-editor-content" contenteditable="true">${UI.sanitizeHtml(content || '<p></p>')}</div>
            </div>
        `;
    },
    professionalExec(cmd, value = null) {
        const editor = document.getElementById('professional-content');
        if (!editor) return;
        editor.focus();
        document.execCommand(cmd, false, value);
        MermaidLite.renderAll(editor);
        QueryView.renderAll(editor);
        WikiLinks.renderAll(editor);
    },
    bindProfessionalSnippetExpander() {
        const editor = document.getElementById('professional-content');
        if (!editor || editor.dataset.snippetsReady === '1') return;
        editor.dataset.snippetsReady = '1';
        editor.addEventListener('keyup', event => {
            if (![' ', 'Enter', 'Tab'].includes(event.key)) return;
            this.expandSnippetAtCursor(editor);
        });
    },
    expandSnippetAtCursor(editor) {
        const sel = window.getSelection?.();
        if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return false;
        const node = sel.anchorNode;
        if (!node || node.nodeType !== Node.TEXT_NODE) return false;
        const text = node.nodeValue || '';
        const before = text.slice(0, sel.anchorOffset);
        const match = before.match(/(^|\s)(\/[a-z0-9_-]{2,24})[\s\n]?$/i);
        if (!match) return false;
        const snippet = Storage.getQuickSnippets().find(s => s.shortcut === match[2]);
        if (!snippet) return false;
        const start = before.lastIndexOf(match[2]);
        node.nodeValue = text.slice(0, start) + text.slice(sel.anchorOffset);
        const range = document.createRange();
        range.setStart(node, start);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.professionalExec('insertHTML', this.renderSnippetContent(snippet));
        this.toast(`Snippet ${snippet.shortcut} inserido.`, 'success');
        return true;
    },
    renderSnippetContent(snippet) {
        const clientId = document.getElementById('professional-client')?.value || '';
        const equipmentId = document.getElementById('professional-equipment')?.value || '';
        const client = clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === clientId) : null;
        const equipment = equipmentId ? Storage.getProfessionalRecords('equipment').find(e => e.id === equipmentId) : null;
        const vars = {
            nome_cliente: client?.title || 'cliente',
            equipamento: equipment?.title || 'equipamento',
            titulo: document.getElementById('professional-title')?.value || '',
            status: document.getElementById('professional-status')?.value || ''
        };
        const raw = String(snippet.content || '').replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key) => vars[key] || '');
        return UI.sanitizeHtml(raw.includes('<') ? raw : `<p>${this.escapeHtml(raw).replace(/\n/g, '<br>')}</p>`);
    },
    showSnippetLibrary() {
        const snippets = Storage.getQuickSnippets();
        this.showModal('Respostas rápidas', `
            ${this.modalContextHtml({
                icon: '⌨',
                title: 'Snippets e atalhos',
                description: 'Digite atalhos como /orc, /diag ou /ret dentro do editor para expandir modelos com dados do cliente.',
                meta: ['Tickets', 'Clientes', 'Orcamentos'],
                tone: 'scripts'
            })}
            <div class="feature-grid">
                <div class="feature-card">
                    <h3>Biblioteca</h3>
                    ${snippets.map(s => `<div class="feature-row"><div><strong>${this.escapeHtml(s.shortcut)} · ${this.escapeHtml(s.name)}</strong><small>${s.readonly ? 'Modelo padrão' : 'Personalizado'}</small></div><button type="button" class="btn btn-sm btn-primary" onclick="App.insertSnippetById('${s.id}')">Inserir</button></div>`).join('')}
                </div>
                <div class="feature-card">
                    <h3>Novo snippet</h3>
                    <div class="form-group"><label>Atalho</label><input id="snippet-shortcut" placeholder="/orc2"></div>
                    <div class="form-group"><label>Nome</label><input id="snippet-name" placeholder="Mensagem de orçamento"></div>
                    <div class="form-group"><label>Texto</label><textarea id="snippet-content" rows="6" placeholder="Olá {{nome_cliente}}, ..."></textarea></div>
                    <button type="button" class="btn btn-primary" onclick="App.saveQuickSnippet()">Salvar snippet</button>
                </div>
            </div>
        `);
    },
    insertSnippetById(id) {
        const snippet = Storage.getQuickSnippets().find(s => s.id === id);
        if (!snippet) return this.toast('Snippet não encontrado.', 'error');
        this.closeModal();
        setTimeout(() => this.professionalExec('insertHTML', this.renderSnippetContent(snippet)), 50);
    },
    saveQuickSnippet() {
        try {
            Storage.addQuickSnippet({
                shortcut: document.getElementById('snippet-shortcut')?.value || '',
                name: document.getElementById('snippet-name')?.value || '',
                content: document.getElementById('snippet-content')?.value || ''
            });
            this.toast('Snippet salvo.', 'success');
            this.showSnippetLibrary();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },
    insertProfessionalMermaid() {
        const sample = 'graph TD\n  R[Roteador] --> S[Switch]\n  S --> AP[Access Point]\n  S --> DVR[DVR/NVR]';
        this.professionalExec('insertHTML', `<pre class="code-block"><code data-lang="mermaid">${this.escapeHtml(sample)}</code></pre><p></p>`);
    },
    saveProfessionalRecord(key, id = '') {
        const title = document.getElementById('professional-title')?.value.trim();
        const content = this.cleanGeneratedContent(document.getElementById('professional-content'));
        const status = document.getElementById('professional-status')?.value || this.getProfessionalModules()[key]?.statuses?.[0] || 'aberto';
        const clientId = document.getElementById('professional-client')?.value || '';
        const equipmentId = document.getElementById('professional-equipment')?.value || '';
        const fields = this.collectProfessionalFields();
        if (key === 'budgets') fields.budgetAdvanced = this.collectBudgetAdvanced();
        if (key === 'networks') fields.networkAdvanced = this.collectNetworkAdvanced();
        if (!title) return this.toast('Digite um título.', 'error');
        const item = id
            ? Storage.updateProfessionalRecord(id, { title, content, status, clientId, equipmentId, fields })
            : Storage.addProfessionalRecord({ moduleKey: key, title, content, status, clientId, equipmentId, fields });
        if (!item) return this.toast('Registro não encontrado.', 'error');
        this.closeModal();
        this.toast(id ? 'Registro atualizado.' : 'Registro criado.', 'success');
        this.renderPage(key);
    },
    openProfessionalRecord(id) {
        const record = Storage.getProfessionalRecords().find(r => r.id === id);
        if (!record) return this.toast('Registro não encontrado.', 'error');
        this.createProfessionalRecord(record.moduleKey, id);
    },
    equipmentQrPayload(id) {
        return `booklist://equipment/${id}`;
    },
    openEquipmentFromCode(code = '') {
        const raw = String(code || '').trim();
        const id = raw.startsWith('booklist://equipment/')
            ? raw.replace('booklist://equipment/', '')
            : raw.startsWith('BL-EQUIP:')
                ? raw.replace('BL-EQUIP:', '')
                : '';
        if (!id) return false;
        const record = Storage.getProfessionalRecords('equipment').find(r => r.id === id);
        if (!record) return false;
        this.closeModal();
        this.navigate('equipment');
        setTimeout(() => this.openProfessionalRecord(id), 120);
        return true;
    },
    showEquipmentQr(id) {
        const record = Storage.getProfessionalRecords('equipment').find(r => r.id === id);
        if (!record) return this.toast('Equipamento não encontrado.', 'error');
        const payload = this.equipmentQrPayload(id);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
        const linkedTickets = Storage.getProfessionalRecords('tickets').filter(t => t.equipmentId === id).length;
        const linkedRunbooks = Storage.getProfessionalRecords('runbooks').filter(r => r.equipmentId === id || String(r.content || '').includes(record.title)).length;
        this.showModal('QR do equipamento', `
            ${this.modalContextHtml({
                icon: 'QR',
                title: record.title || 'Equipamento',
                description: 'Imprima e cole este QR na maquina. Ao escanear no BookList, o app abre o historico do equipamento.',
                meta: [`${linkedTickets} ticket(s)`, `${linkedRunbooks} runbook(s)`],
                tone: 'equipment'
            })}
            <div class="qr-equipment-card">
                <img src="${qrUrl}" alt="QR Code do equipamento">
                <div>
                    <strong>${this.escapeHtml(record.fields?.brandModel || record.title || 'Equipamento')}</strong>
                    <small>Codigo interno</small>
                    <code>${this.escapeHtml(payload)}</code>
                    <div class="settings-actions">
                        <button type="button" class="btn btn-primary" onclick="navigator.clipboard.writeText('${this.escapeJs(payload)}');App.toast('Codigo copiado.','success')">Copiar codigo</button>
                        <button type="button" class="btn btn-secondary" onclick="window.print()">Imprimir</button>
                    </div>
                </div>
            </div>
        `);
    },
    cleanGeneratedContent(el) {
        if (!el) return '';
        const clone = el.cloneNode(true);
        MermaidLite.stripGenerated(clone);
        WikiLinks.stripGenerated(clone);
        QueryView.stripGenerated(clone);
        return UI.sanitizeHtml(clone.innerHTML || '');
    },
    deleteProfessionalRecord(id) {
        const record = Storage.getProfessionalRecords().find(r => r.id === id);
        if (!record) return;
        this.confirmAction('Apagar este registro profissional?', () => {
            Storage.deleteProfessionalRecord(id);
            this.closeModal();
            this.toast('Registro apagado.', 'info');
            this.renderPage(record.moduleKey);
        }, { title: 'Confirmar exclusão', confirmText: 'Apagar', danger: true });
    },
    convertProfessionalRecordToNote(id) {
        const record = Storage.getProfessionalRecords().find(r => r.id === id);
        if (!record) return this.toast('Registro não encontrado.', 'error');
        const notes = Storage.getNotes({ includePrivate: true });
        const now = new Date().toISOString();
        const note = { id: crypto.randomUUID(), title: record.title, content: record.content, folderId: 'default', categoryIds: [], createdAt: now, updatedAt: now, pinned: false };
        notes.unshift(note);
        Storage.saveNotes(notes);
        this.closeModal();
        this.toast('Registro convertido em nota.', 'success');
        this.navigate('notes');
        setTimeout(()=>Notes.openEditor(note.id), 100);
    },
    linkedRecordsForClient(clientId) {
        return Storage.getProfessionalRecords().filter(r => r.clientId === clientId && r.id !== clientId);
    },
    openClientDetail(clientId) {
        const modules = this.getProfessionalModules();
        const client = Storage.getProfessionalRecords('clients').find(c => c.id === clientId);
        if (!client) return this.toast('Cliente não encontrado.', 'error');
        const linked = this.linkedRecordsForClient(clientId);
        const byModule = Object.keys(modules).filter(k => k !== 'clients').map(key => {
            const items = linked.filter(r => r.moduleKey === key);
            if (!items.length) return '';
            const mod = modules[key];
            return `<section class="client-detail-group"><h4>${mod.icon} ${this.escapeHtml(mod.title)} <span>${items.length}</span></h4>${items.map(r => this.professionalRecordButtonHtml(r, mod)).join('')}</section>`;
        }).join('');
        const timeline = [client, ...linked].sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        this.showModal(`Cliente: ${client.title}`, `
            <div class="client-detail">
                <div class="client-detail-head">
                    <div><span class="module-kicker">Página detalhada do cliente</span><h2>${this.escapeHtml(client.title)}</h2><p>${this.escapeHtml(client.status || 'ativo')}</p></div>
                    <button class="btn btn-secondary" onclick="App.openProfessionalRecord('${client.id}')">Editar cliente</button>
                </div>
                ${this.professionalFieldsSummaryHtml(client)}
                <div class="client-quick-actions">
                    <button class="btn btn-sm btn-primary" onclick="App.createProfessionalRecord('tickets', '', '${client.id}')">Nova OS</button>
                    <button class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('equipment', '', '${client.id}')">Novo equipamento</button>
                    <button class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('budgets', '', '${client.id}')">Novo orçamento</button>
                    <button class="btn btn-sm btn-secondary" onclick="App.createProfessionalRecord('schedule', '', '${client.id}')">Agendar retorno</button>
                </div>
                <div class="client-detail-content">
                    <section><h3>Registro do cliente</h3><div class="professional-preview">${UI.sanitizeHtml(client.content || '<p class="text-muted">Sem observações ainda.</p>')}</div></section>
                    <section><h3>Vínculos automáticos</h3>${byModule || '<p class="text-muted">Ainda não há equipamentos, OS, orçamento, agenda ou rede ligados a este cliente.</p>'}</section>
                    <section><h3>Timeline</h3><div class="client-timeline">${timeline.map(item => {
                        const mod = modules[item.moduleKey] || {};
                        return `<button class="timeline-item" onclick="${item.moduleKey === 'clients' ? `App.openProfessionalRecord('${item.id}')` : `App.openProfessionalRecord('${item.id}')`}"><span>${mod.icon || '•'}</span><div><strong>${this.escapeHtml(item.title)}</strong><small>${this.escapeHtml(mod.title || item.moduleKey)} · ${new Date(item.updatedAt || item.createdAt).toLocaleString('pt-BR')}</small></div></button>`;
                    }).join('')}</div></section>
                </div>
            </div>
        `);
        setTimeout(() => {
            const preview = document.querySelector('.client-detail .professional-preview');
            MermaidLite.renderAll(preview || document);
            QueryView.renderAll(preview || document);
            WikiLinks.renderAll(preview || document);
        }, 0);
    },
    professionalFieldsSummaryHtml(record) {
        const fields = record.fields || {};
        const entries = Object.entries(fields).filter(([,value]) => value);
        if (!entries.length) return '';
        const labels = Object.fromEntries(this.professionalFieldsConfig(record.moduleKey).map(([name,label]) => [name, label]));
        return `<div class="client-field-summary">${entries.map(([key,value]) => `<span><strong>${this.escapeHtml(labels[key] || key)}:</strong> ${this.escapeHtml(value)}</span>`).join('')}</div>`;
    },
    addProfessionalAttachment(id, file) {
        if (!id || !file) return;
        const record = Storage.getProfessionalRecords().find(r => r.id === id);
        if (!record) return this.toast('Salve o registro antes de anexar.', 'error');
        const reader = new FileReader();
        reader.onload = () => {
            const attachments = [...(record.attachments || []), {
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type || 'arquivo',
                size: file.size || 0,
                dataUrl: reader.result,
                createdAt: new Date().toISOString()
            }];
            Storage.updateProfessionalRecord(id, { attachments });
            this.toast('Anexo adicionado.', 'success');
            this.createProfessionalRecord(record.moduleKey, id);
        };
        reader.readAsDataURL(file);
    },
    deleteProfessionalAttachment(id, attachmentId) {
        const record = Storage.getProfessionalRecords().find(r => r.id === id);
        if (!record) return;
        this.confirmAction('Remover este anexo?', () => {
            const attachments = (record.attachments || []).filter(att => att.id !== attachmentId);
            Storage.updateProfessionalRecord(id, { attachments });
            this.toast('Anexo removido.', 'info');
            this.createProfessionalRecord(record.moduleKey, id);
        }, { title: 'Remover anexo', confirmText: 'Remover', danger: true });
    },
    runProfessionalSearch(query = '') {
        const target = document.getElementById('tech-search-results');
        if (!target) return;
        const q = (query || '').trim();
        if (!q) {
            target.innerHTML = '';
            return;
        }
        const modules = this.getProfessionalModules();
        const records = Storage.getProfessionalRecords();
        const docs = records.map(r => {
            const client = r.clientId ? records.find(item => item.id === r.clientId) : null;
            const equipment = r.equipmentId ? records.find(item => item.id === r.equipmentId) : null;
            return {
                record: r,
                fields: [
                    { text: r.title || '', weight: 4 },
                    { text: r.status || '', weight: 2 },
                    { text: modules[r.moduleKey]?.title || '', weight: 2 },
                    { text: client?.title || '', weight: 2 },
                    { text: equipment?.title || '', weight: 2 },
                    { text: r.content || '', weight: 1 },
                    { text: Object.values(r.fields || {}).map(value => typeof value === 'object' ? JSON.stringify(value) : value).join(' '), weight: 1 }
                ]
            };
        });
        const results = FuzzySearch.search(q, docs, { limit: 12, minScore: 28 }).map(doc => doc.record);
        target.innerHTML = results.length
            ? results.map(r => this.professionalRecordButtonHtml(r, modules[r.moduleKey])).join('')
            : '<p class="text-muted">Nenhum registro técnico encontrado.</p>';
    },
    networkAdvancedExportHtml(record) {
        const data = record.fields?.networkAdvanced || {};
        const sections = ['devices','subnets','wifi','cameras'];
        const tables = sections.map(section => {
            const items = data[section] || [];
            if (!items.length) return '';
            const cols = this.networkBuilderConfig(section);
            return `<h2>${this.escapeHtml(this.networkSectionTitle(section))}</h2><table><thead><tr>${cols.map(([,label]) => `<th>${this.escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${items.map(item => `<tr>${cols.map(([key]) => `<td>${this.escapeHtml(item[key] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        }).join('');
        const auditLabels = {
            ipsDocumented: 'IPs documentados',
            configBackup: 'Backup de configuração',
            firmwareChecked: 'Firmware revisado',
            passwordsReviewed: 'Senhas revisadas',
            equipmentLabeled: 'Equipamentos identificados',
            criticalPoints: 'Pontos críticos anotados'
        };
        const auditRows = Object.entries(data.audit || {}).map(([key, value]) => `<tr><th>${this.escapeHtml(auditLabels[key] || key)}</th><td>${value ? 'OK' : 'Pendente'}</td></tr>`).join('');
        const auditHtml = auditRows || data.auditNotes ? `<h2>Auditoria</h2><table>${auditRows}${data.auditNotes ? `<tr><th>Pendências</th><td>${this.escapeHtml(data.auditNotes)}</td></tr>` : ''}</table>` : '';
        return tables || auditHtml ? `<section class="content"><h1>Inventário de Rede</h1>${tables}${auditHtml}</section>` : '';
    },
    budgetAdvancedExportHtml(record) {
        const items = record.fields?.budgetAdvanced?.items || [];
        if (!items.length) return '';
        const rows = items.map(item => {
            const line = Number(item.qty || 0) * Number(item.unit || 0);
            const value = item.type === 'desconto' ? -Math.abs(line) : line;
            return `<tr><td>${this.escapeHtml(item.type || '')}</td><td>${this.escapeHtml(item.description || '')}</td><td>${this.escapeHtml(item.qty || '')}</td><td>${this.formatCurrency(item.unit || 0)}</td><td>${this.formatCurrency(value)}</td></tr>`;
        }).join('');
        const total = this.calculateBudgetTotal(items);
        return `<section class="content"><h1>Itens do Orçamento</h1><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>${rows}<tr><th colspan="4">Total geral</th><td><strong>${this.formatCurrency(total)}</strong></td></tr></tbody></table></section>`;
    },
    exportProfessionalRecordHtml(id) {
        const records = Storage.getProfessionalRecords();
        const record = records.find(r => r.id === id);
        if (!record) return this.toast('Registro não encontrado.', 'error');
        const modules = this.getProfessionalModules();
        const mod = modules[record.moduleKey] || {};
        const client = record.clientId ? records.find(r => r.id === record.clientId) : null;
        const equipment = record.equipmentId ? records.find(r => r.id === record.equipmentId) : null;
        const fieldLabels = Object.fromEntries(this.professionalFieldsConfig(record.moduleKey).map(([name,label]) => [name, label]));
        const fieldRows = Object.entries(record.fields || {}).filter(([,v]) => v && typeof v !== 'object').map(([k,v]) => `<tr><th>${this.escapeHtml(fieldLabels[k] || k)}</th><td>${this.escapeHtml(v)}</td></tr>`).join('');
        const title = record.moduleKey === 'tickets' ? 'Ordem de Serviço' : record.moduleKey === 'budgets' ? 'Orçamento' : 'Registro Técnico';
        const budgetHtml = record.moduleKey === 'budgets' ? this.budgetAdvancedExportHtml(record) : '';
        const networkHtml = record.moduleKey === 'networks' ? this.networkAdvancedExportHtml(record) : '';

        // Calculate amount to pre-fill PIX and value fields
        let prefilledAmount = 0;
        if (record.moduleKey === 'budgets') {
            const items = record.fields?.budgetAdvanced?.items || [];
            prefilledAmount = items.reduce((sum, item) => {
                const line = Number(item.qty || 0) * Number(item.unit || 0);
                return sum + (item.type === 'desconto' ? -Math.abs(line) : line);
            }, 0);
        } else if (record.moduleKey === 'finance') {
            prefilledAmount = Number(record.fields?.amount || 0);
        }

        const settings = Storage.getSettings();
        const accentColor = settings.accent || '#7C4DFF';
        const formattedDate = new Date(record.updatedAt || record.createdAt).toLocaleString('pt-BR');

        const html = `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Compositor: ${this.escapeHtml(title)} - ${this.escapeHtml(record.title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --accent: ${accentColor};
            --accent-glow: ${accentColor}1c;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --bg-body: #0f172a;
            --border-color: #e2e8f0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            color: var(--text-primary);
            background: var(--bg-body);
            display: flex;
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* --- Sidebar Control --- */
        .control-sidebar {
            width: 340px;
            background: #1e293b;
            border-right: 1px solid rgba(255,255,255,0.06);
            color: #f1f5f9;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            height: 100vh;
            position: fixed;
            left: 0;
            top: 0;
            overflow-y: auto;
            z-index: 100;
            box-shadow: 10px 0 30px rgba(0,0,0,0.25);
        }

        .control-sidebar h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.5px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .control-group label {
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .control-group input[type="text"],
        .control-group input[type="number"],
        .control-group textarea {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 8px 12px;
            color: #f8fafc;
            font-size: 13px;
            transition: all 0.2s;
        }

        .control-group input:focus,
        .control-group textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
        }

        .checkbox-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #cbd5e1;
            cursor: pointer;
            user-select: none;
        }

        .checkbox-row input {
            cursor: pointer;
            accent-color: var(--accent);
            width: 16px;
            height: 16px;
        }

        .btn-action {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            text-decoration: none;
            text-align: center;
        }

        .btn-print {
            background: var(--accent);
            color: #fff;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .btn-print:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }

        .btn-close {
            background: #334155;
            color: #cbd5e1;
            border: 1px solid #475569;
        }

        .btn-close:hover {
            background: #475569;
            color: #fff;
        }

        /* --- Copy PIX widget --- */
        .pix-copy-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: #38bdf8;
            word-break: break-all;
            max-height: 80px;
            overflow-y: auto;
            margin-top: 5px;
        }

        /* --- Document Area --- */
        .paper-container {
            flex: 1;
            margin-left: 340px;
            padding: 40px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            background: #0f172a;
            overflow-y: auto;
            min-height: 100vh;
        }

        /* --- A4 Sheet Styles --- */
        .invoice-sheet {
            width: 820px;
            background: #ffffff;
            border-radius: 8px;
            padding: 48px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            border: 1px solid #cbd5e1;
            position: relative;
            min-height: 297mm;
            display: flex;
            flex-direction: column;
        }

        .brand-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid var(--accent);
            padding-bottom: 24px;
            margin-bottom: 24px;
        }

        .brand-identity {
            display: flex;
            gap: 16px;
            align-items: center;
        }

        .logo-box {
            width: 54px;
            height: 54px;
            border-radius: 12px;
            background: var(--accent);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Outfit', sans-serif;
            font-size: 24px;
            font-weight: 800;
        }

        .brand-text h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
        }

        .brand-text p {
            font-size: 13px;
            color: var(--text-secondary);
        }

        .doc-meta {
            text-align: right;
        }

        .doc-meta h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: var(--accent);
        }

        .doc-meta p {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        /* Tables & Metadata */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
        }

        th, td {
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
        }

        th {
            background: #f8fafc;
            font-weight: 600;
            width: 180px;
            color: #334155;
        }

        .grid-blocks {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }

        .block-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            background: #f8fafc;
        }

        .block-card h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .block-card p {
            font-size: 13px;
            line-height: 1.6;
            color: #475569;
        }

        .section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin-top: 24px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }

        .content-body {
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
            margin-top: 15px;
            white-space: pre-wrap;
        }

        /* Signature block */
        .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 50px;
            page-break-inside: avoid;
        }

        .signature-line {
            border-top: 1px solid #475569;
            text-align: center;
            padding-top: 8px;
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
        }

        /* PIX Section in Doc */
        .pix-payment-box {
            margin-top: auto;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            padding: 20px;
            background: #f8fafc;
            display: flex;
            align-items: center;
            gap: 24px;
            page-break-inside: avoid;
        }

        .pix-qrcode-wrapper {
            background: white;
            border: 1px solid #cbd5e1;
            padding: 8px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .pix-qrcode-wrapper img {
            width: 140px;
            height: 140px;
        }

        .pix-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .pix-details h4 {
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .pix-details p {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
        }

        .pix-payload-static {
            background: #e2e8f0;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: #334155;
            word-break: break-all;
            max-height: 48px;
            overflow-y: auto;
        }

        /* --- Printing css override --- */
        @media print {
            body {
                background: #ffffff !important;
                color: #000000 !important;
            }

            .control-sidebar {
                display: none !important;
            }

            .paper-container {
                margin-left: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                width: 100% !important;
            }

            .invoice-sheet {
                width: 100% !important;
                max-width: 100% !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                min-height: auto !important;
            }

            .pix-payment-box {
                border: 1px dashed #000000 !important;
                background: #ffffff !important;
            }
        }
    </style>
</head>
<body>

    <!-- SIDEBAR CONTROL PANEL -->
    <aside class="control-sidebar no-print">
        <h2>🛠️ Compositor de OS/CRM</h2>
        
        <div class="control-group">
            <label>Texto da Logo</label>
            <input type="text" id="logo-text" value="BL" oninput="updateLogo(this.value)">
        </div>

        <div class="control-group">
            <label>Título da Empresa</label>
            <input type="text" id="company-name" value="BookList Serviços Técnicos" oninput="updateCompany(this.value)">
        </div>

        <div class="control-group">
            <label>Subtítulo da Fatura</label>
            <input type="text" id="company-subtitle" value="Soluções local-first inovadoras" oninput="updateSubtitle(this.value)">
        </div>

        <div class="control-group">
            <label>Valor de Cobrança (R$)</label>
            <input type="number" id="charge-amount" step="0.01" value="${prefilledAmount.toFixed(2)}" oninput="updateAmount(this.value)">
        </div>

        <!-- PIX parameters -->
        <div class="control-group">
            <label>Chave PIX</label>
            <input type="text" id="input-pix-key" value="${this.escapeHtml(settings.pixKey || '')}" placeholder="E-mail, CPF, Celular ou Chave Aleatória" oninput="updatePixConfig()">
            <div style="font-size:10px; color:#cbd5e1; margin-top:3px; line-height:1.4;" id="pix-key-helper">Ex: <code>12345678909</code> (sem pontos/traços para CPF), <code>+5511999999999</code> (Celular com +55), chave aleatória ou e-mail.</div>
            <div style="font-size:11px; color:#38bdf8; margin-top:4px; font-weight:600; display:none;" id="pix-key-sanitized-info"></div>
        </div>
        <div class="control-row" style="display:flex; gap:10px;">
            <div class="control-group" style="flex:1;">
                <label>Nome PIX</label>
                <input type="text" id="input-pix-name" value="${this.escapeHtml(settings.pixName || 'BL RECEBEDOR')}" oninput="updatePixConfig()">
            </div>
            <div class="control-group" style="flex:1;">
                <label>Cidade PIX</label>
                <input type="text" id="input-pix-city" value="${this.escapeHtml(settings.pixCity || 'SAO PAULO')}" oninput="updatePixConfig()">
            </div>
        </div>

        <div class="control-group">
            <label>PIX Copia e Cola</label>
            <div class="pix-copy-box" id="pix-string-display">Sem PIX configurado</div>
            <button class="btn-action btn-close" onclick="copyPixCode()" style="margin-top:6px; padding:6px 12px; font-size:11px;">📋 Copiar Código PIX</button>
        </div>

        <div class="control-group" style="margin-top:10px;">
            <label>Visibilidade das Seções</label>
            <label class="checkbox-row"><input type="checkbox" id="chk-client" checked onchange="toggleSec('client-sec', this.checked)"> Exibir Dados de Clientes</label>
            <label class="checkbox-row"><input type="checkbox" id="chk-equip" checked onchange="toggleSec('equip-sec', this.checked)"> Exibir Equipamentos</label>
            <label class="checkbox-row"><input type="checkbox" id="chk-signs" checked onchange="toggleSec('signs-sec', this.checked)"> Exibir Assinaturas</label>
            <label class="checkbox-row"><input type="checkbox" id="chk-pix" checked onchange="toggleSec('pix-sec', this.checked)"> Exibir Pagamento PIX</label>
        </div>

        <div class="control-group">
            <label>Anotações do Cliente / Termos</label>
            <textarea id="invoice-notes" rows="4" placeholder="Adicione termos de garantia, dados de conta bancária ou agradecimentos..." oninput="updateNotes(this.value)">Garantia de 90 dias para peças substituídas. Termos de recebimento válidos por 5 dias corridos.</textarea>
        </div>

        <button class="btn-action btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
        <button class="btn-action btn-close" onclick="window.close()">❌ Fechar Compositor</button>
    </aside>

    <!-- PAPER CONTAINER SHEET -->
    <div class="paper-container">
        <main class="invoice-sheet" id="invoice-sheet">
            
            <!-- HEADER -->
            <header class="brand-header">
                <div class="brand-identity">
                    <div class="logo-box" id="doc-logo-box">BL</div>
                    <div class="brand-text">
                        <h1 id="doc-company-name">BookList Serviços Técnicos</h1>
                        <p id="doc-company-subtitle">Soluções local-first inovadoras</p>
                    </div>
                </div>
                <div class="doc-meta">
                    <h2>${this.escapeHtml(title)}</h2>
                    <p><strong>Nº:</strong> ${record.id.substring(0, 8).toUpperCase()}</p>
                    <p><strong>Data:</strong> ${formattedDate}</p>
                    <p><strong>Status:</strong> ${this.escapeHtml(record.status || 'CONCLUÍDO')}</p>
                </div>
            </header>

            <!-- GENERAL TITLE & META -->
            <div style="margin-bottom: 20px;">
                <h2 style="font-family:'Outfit', sans-serif; font-size:16px; border-bottom:1px solid #cbd5e1; padding-bottom:6px; color:#334155;">INFORMAÇÕES GERAIS</h2>
                <table style="margin-top:10px; margin-bottom:10px;">
                    <tr>
                        <th style="width:130px;">Título do Serviço</th>
                        <td>${this.escapeHtml(record.title)}</td>
                    </tr>
                </table>
            </div>

            <!-- DUAL BLOCKS CLIENT & EQUIPMENT -->
            <div class="grid-blocks">
                <div class="block-card" id="client-sec">
                    <h3>👤 Cliente</h3>
                    <p><strong>Nome:</strong> ${this.escapeHtml(client?.title || 'Não Informado')}</p>
                    ${client && client.fields?.phone ? `<p><strong>Fone:</strong> ${this.escapeHtml(client.fields.phone)}</p>` : ''}
                    ${client && client.fields?.email ? `<p><strong>Email:</strong> ${this.escapeHtml(client.fields.email)}</p>` : ''}
                    ${client && client.fields?.document ? `<p><strong>CPF/CNPJ:</strong> ${this.escapeHtml(client.fields.document)}</p>` : ''}
                    ${client && client.fields?.address ? `<p><strong>Endereço:</strong> ${this.escapeHtml(client.fields.address)}</p>` : ''}
                </div>
                <div class="block-card" id="equip-sec">
                    <h3>💻 Equipamento</h3>
                    <p><strong>Dispositivo:</strong> ${this.escapeHtml(equipment?.title || 'Não Vinculado')}</p>
                    ${equipment && equipment.fields?.type ? `<p><strong>Tipo:</strong> ${this.escapeHtml(equipment.fields.type)}</p>` : ''}
                    ${equipment && equipment.fields?.brandModel ? `<p><strong>Modelo:</strong> ${this.escapeHtml(equipment.fields.brandModel)}</p>` : ''}
                    ${equipment && equipment.fields?.serial ? `<p><strong>Nº Série:</strong> ${this.escapeHtml(equipment.fields.serial)}</p>` : ''}
                    ${equipment && equipment.fields?.specs ? `<p><strong>Hardware:</strong> ${this.escapeHtml(equipment.fields.specs)}</p>` : ''}
                    ${equipment && equipment.fields?.os ? `<p><strong>Sistema OS:</strong> ${this.escapeHtml(equipment.fields.os)}</p>` : ''}
                </div>
            </div>

            <!-- TICKET CUSTOM FIELDS -->
            ${fieldRows ? `
            <div>
                <h3 class="section-title">Especificações e Parâmetros</h3>
                <table>
                    ${fieldRows}
                </table>
            </div>` : ''}

            <!-- ADVANCED CONTENT TABLES -->
            ${budgetHtml}
            ${networkHtml}

            <!-- NOTES / EDITOR TEXT -->
            <div style="margin-top: 20px;">
                <h3 class="section-title">Parecer Técnico / Notas</h3>
                <div class="content-body">${UI.sanitizeHtml(record.content || '<p class="text-muted">Nenhum detalhe adicional adicionado.</p>')}</div>
            </div>

            <!-- CUSTOM COMPOSER ANNOTATIONS -->
            <div style="margin-top:20px; page-break-inside:avoid;">
                <h3 class="section-title">Condições de Pagamento & Termos</h3>
                <div class="content-body" id="doc-custom-notes" style="font-style: italic; color: #475569; background: #f8fafc; padding: 12px; border-left: 3px solid var(--accent); border-radius: 0 4px 4px 0; margin-top: 10px;">Garantia de 90 dias para peças substituídas. Termos de recebimento válidos por 5 dias corridos.</div>
            </div>

            <!-- PIX BOX WIDGET -->
            <div class="pix-payment-box" id="pix-sec" style="margin-top: 30px;">
                <div class="pix-qrcode-wrapper">
                    <img id="pix-qrcode" src="" alt="QR Code PIX">
                </div>
                <div class="pix-details">
                    <h4>📱 Pague com PIX</h4>
                    <p>Escaneie o QR Code ao lado ou use o código Copia e Cola para efetuar o pagamento imediato no aplicativo do seu banco.</p>
                    <p style="font-size:11px;"><strong>Valor Cobrado:</strong> R$ <span id="pix-val-lbl">${prefilledAmount.toFixed(2)}</span></p>
                    <div class="pix-payload-static" id="pix-payload-lbl">Gerando código PIX...</div>
                </div>
            </div>

            <!-- SIGNATURES BLOCK -->
            <div class="signatures" id="signs-sec">
                <div class="signature-line">Responsável Técnico (Assinatura)</div>
                <div class="signature-line">Assinatura do Cliente</div>
            </div>

        </main>
    </div>

    <!-- CODE COMPILER SCRIPTS -->
    <script>
        // CRC16 CCITT standard used for PIX
        function crc16ccitt(str) {
            let crc = 0xFFFF;
            for (let c = 0; c < str.length; c++) {
                let code = str.charCodeAt(c);
                crc ^= (code << 8);
                for (let i = 0; i < 8; i++) {
                    if (crc & 0x8000) {
                        crc = (crc << 1) ^ 0x1021;
                    } else {
                        crc = crc << 1;
                    }
                }
            }
            return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
        }

        // Clean string from accents for EMV compliant names
        function cleanString(str) {
            return str.normalize("NFD")
                      .replace(/[\\u0300-\\u036f]/g, "")
                      .replace(/[^A-Za-z0-9\\s]/gi, "")
                      .toUpperCase();
        }

        function generatePixPayload(key, name, city, amount, txid = '***') {
            if (!key) return '';
            
            const cleanName = cleanString(name || 'BL RECEBEDOR').substring(0, 25);
            const cleanCity = cleanString(city || 'CIDADE').substring(0, 15);
            const cleanKey = key.trim();
            
            function emvTag(id, val) {
                return id.padStart(2, '0') + String(val.length).padStart(2, '0') + val;
            }
            
            // Merchant Information (Tag 26)
            const gui = emvTag('00', 'br.gov.bcb.pix');
            const k = emvTag('01', cleanKey);
            const merchantInfo = emvTag('26', gui + k);
            
            // Additional Data (Tag 62)
            const tx = emvTag('05', txid);
            const additionalData = emvTag('62', tx);
            
            let payload = '';
            payload += emvTag('00', '01'); // Format Indicator
            payload += merchantInfo;
            payload += emvTag('52', '0000'); // Merchant Category Code
            payload += emvTag('53', '986');  // Currency BRL
            if (amount && Number(amount) > 0) {
                payload += emvTag('54', Number(amount).toFixed(2)); // Amount
            }
            payload += emvTag('58', 'BR');   // Country
            payload += emvTag('59', cleanName);
            payload += emvTag('60', cleanCity);
            payload += additionalData;
            payload += '6304'; // CRC16 prefix
            
            const crc = crc16ccitt(payload);
            return payload + crc;
        }

        // Live visual synchronizers
        function updateLogo(val) {
            document.getElementById('doc-logo-box').textContent = val || 'BL';
        }

        function updateCompany(val) {
            document.getElementById('doc-company-name').textContent = val || 'BookList Serviços Técnicos';
        }

        function updateSubtitle(val) {
            document.getElementById('doc-company-subtitle').textContent = val || '';
        }

        function updateNotes(val) {
            document.getElementById('doc-custom-notes').textContent = val || '';
        }

        function toggleSec(id, visible) {
            document.getElementById(id).style.display = visible ? '' : 'none';
        }

        function updateAmount(val) {
            const num = Number(val) || 0;
            document.getElementById('pix-val-lbl').textContent = num.toFixed(2);
            updatePixConfig();
        }

        function sanitizePixKey(key) {
            if (!key) return '';
            let clean = key.trim();
            if (clean.indexOf('@') !== -1) return clean;
            let onlyDigits = clean.replace(/\\D/g, '');
            if (clean.indexOf('+') === 0) return '+' + onlyDigits;
            if (onlyDigits.length === 11 && ['1','2','3','4','5','6','7','8','9'].indexOf(onlyDigits.charAt(0)) !== -1) {
                return '+55' + onlyDigits;
            }
            if (onlyDigits.length === 10) return '+55' + onlyDigits;
            if (onlyDigits.length === 13 && onlyDigits.indexOf('55') === 0) return '+' + onlyDigits;
            if (onlyDigits.length === 11 || onlyDigits.length === 14) return onlyDigits;
            if (clean.replace(/[^a-fA-F0-9]/g, '').length === 32) {
                return clean.toLowerCase().replace(/[^a-z0-9-]/g, '');
            }
            return clean;
        }

        function updatePixConfig() {
            const key = document.getElementById('input-pix-key').value;
            const name = document.getElementById('input-pix-name').value;
            const city = document.getElementById('input-pix-city').value;
            const amount = Number(document.getElementById('charge-amount').value) || 0;
            
            const sanitizedKey = sanitizePixKey(key);
            const payload = generatePixPayload(sanitizedKey, name, city, amount);
            const display = document.getElementById('pix-string-display');
            const docPayloadLbl = document.getElementById('pix-payload-lbl');
            const docQrcode = document.getElementById('pix-qrcode');
            const pixSec = document.getElementById('pix-sec');
            const chkPix = document.getElementById('chk-pix').checked;
            
            const infoDiv = document.getElementById('pix-key-sanitized-info');
            if (key.trim() && sanitizedKey !== key.trim()) {
                infoDiv.style.display = 'block';
                infoDiv.innerHTML = '✨ Formatado: <code>' + sanitizedKey + '</code>';
            } else {
                infoDiv.style.display = 'none';
            }
            
            if (payload && chkPix) {
                display.textContent = payload;
                docPayloadLbl.textContent = payload;
                pixSec.style.display = '';
                docQrcode.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(payload);
            } else {
                display.textContent = 'PIX desabilitado ou sem chave.';
                docPayloadLbl.textContent = 'Sem dados PIX válidos.';
                pixSec.style.display = 'none';
            }
        }

        function copyPixCode() {
            const code = document.getElementById('pix-string-display').textContent;
            if (code && code !== 'Sem PIX configurado' && code !== 'PIX desabilitado ou sem chave.') {
                navigator.clipboard.writeText(code).then(() => {
                    alert('Código PIX Copia e Cola copiado com sucesso!');
                }).catch(err => {
                    console.error('Falha ao copiar:', err);
                });
            } else {
                alert('Código PIX não disponível.');
            }
        }

        // Boot PIX calculations
        updatePixConfig();
    </script>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            return this.toast('Por favor, ative a permissão de pop-ups neste navegador para poder compor a fatura.', 'error');
        }
        printWindow.document.write(html);
        printWindow.document.close();
        this.toast('Compositor de PDF aberto em uma nova guia.', 'success');
    },
    formatBytes(bytes = 0) {
        if (!bytes) return '0 KB';
        const units = ['B','KB','MB','GB'];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
    },
    renderSettingsPage(main) {
        const bkFolders = Storage.getBkFolders(), ntFolders = Storage.getNtFolders();
        const bkCats = Storage.getBkCategories(), ntCats = Storage.getNtCategories();
        const settings = Storage.getSettings();
        const sync = settings.sync;
        const syncStatus = Storage.getSyncStatus();
        const fixedSupabase = Boolean(Storage.DEFAULT_SUPABASE?.fixed);
        const backups = Storage.getAutoBackups();
        const trash = Storage.getTrash();
        main.innerHTML = `
        <div class="settings-page">
            <header class="settings-header">
                <div><h2>Configurações</h2><p>Personalize o BookList e gerencie seus dados.</p></div>
                <div class="settings-header-status"><span class="settings-status-dot"></span><span>Salvamento local automático</span></div>
            </header>
            <div class="settings-layout">
                <aside class="settings-sidebar" aria-label="Seções de configurações">
                    <label class="settings-filter"><span>⌕</span><input type="search" placeholder="Buscar configuração..." oninput="App.filterSettings(this.value)"></label>
                    <nav class="settings-section-nav">
                        <button class="active" data-settings-target="appearance" onclick="App.scrollSettingsSection('appearance', this)"><span>◐</span>Aparência</button>
                        <button data-settings-target="data" onclick="App.scrollSettingsSection('data', this)"><span>▣</span>Dados e backup</button>
                        <button data-settings-target="sync" onclick="App.scrollSettingsSection('sync', this)"><span>↻</span>Sincronização</button>
                        <button data-settings-target="ai" onclick="App.scrollSettingsSection('ai', this)"><span>✦</span>Inteligência artificial</button>
                        <button data-settings-target="organization" onclick="App.scrollSettingsSection('organization', this)"><span>◇</span>Organização</button>
                        <button data-settings-target="billing" onclick="App.scrollSettingsSection('billing', this)"><span>▤</span>Faturamento</button>
                        <button data-settings-target="trash" onclick="App.scrollSettingsSection('trash', this)"><span>♲</span>Lixeira e segurança</button>
                        <button data-settings-target="about" onclick="App.scrollSettingsSection('about', this)"><span>ⓘ</span>Sobre</button>
                    </nav>
                </aside>
                <main class="settings-content">
                <div class="settings-grid">
                <div class="settings-card" id="settings-data" data-settings-section="data"><h3>💾 Dados & Portabilidade</h3>
                    <p>Exporte seus dados para carregar em outro navegador ou PC. Backups automáticos locais são criados quando há alterações.</p>
                    <div class="settings-actions">
                        <button class="btn btn-primary" onclick="Storage.exportAll()">📥 Exportar Backup (JSON)</button>
                        <label class="btn btn-secondary">📤 Importar Backup<input type="file" accept=".json" style="display:none" onchange="App.handleImport(this.files[0])"></label>
                        <button class="btn btn-secondary" onclick="App.createManualBackup()">Criar Backup Local</button>
                    </div>
                    <div class="mini-list">${backups.length ? backups.slice(0,5).map(b => `
                        <div class="mini-list-item"><span>${new Date(b.createdAt).toLocaleString('pt-BR')} · ${b.counts.bookmarks} links · ${b.counts.notes} notas</span><button class="btn btn-sm btn-secondary" onclick="Storage.exportAutoBackup('${b.id}')">Exportar</button></div>
                    `).join('') : '<p class="text-muted">Nenhum backup automático local ainda.</p>'}</div>
                </div>

                <div class="settings-card" id="settings-sync" data-settings-section="sync"><h3>☁️ Sincronização Supabase</h3>
                    <p>Modo local-first: salva imediatamente neste dispositivo e sincroniza automaticamente todos os dados suportados com o Supabase.</p>
                    <div class="sync-status sync-${syncStatus.status}">
                        <span>${syncStatus.online ? 'Online' : 'Offline'}</span>
                        <strong>${this.escapeHtml(syncStatus.message)}</strong>
                        <small>${syncStatus.dirtyCount} alterações pendentes${syncStatus.lastSyncAt ? ` · Último sync: ${new Date(syncStatus.lastSyncAt).toLocaleString('pt-BR')}` : ''}</small>
                    </div>
                    <div class="form-group"><label>Projeto Supabase</label><input type="url" id="sync-url" value="${this.escapeHtml(sync.supabaseUrl)}" ${fixedSupabase ? 'readonly' : ''}></div>
                    <div class="form-group"><label>Chave pública</label><input type="password" id="sync-anon-key" value="${this.escapeHtml(sync.anonKey)}" ${fixedSupabase ? 'readonly' : ''}></div>
                    <div class="form-row">
                        <div class="form-group"><label>E-mail</label><input type="email" id="sync-email" value="${this.escapeHtml(sync.email)}" ${fixedSupabase ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Senha</label><input type="password" id="sync-password" placeholder="Senha do Supabase Auth"></div>
                    </div>
                    <label class="checkbox-row"><input type="checkbox" id="sync-enabled" ${sync.enabled ? 'checked' : ''} ${fixedSupabase ? 'disabled' : ''}> Sincronização automática ${fixedSupabase ? 'fixada para este projeto' : ''}</label>
                    <div class="settings-actions">
                        ${fixedSupabase ? '<span class="sync-fixed-badge">Configuração pública carregada</span>' : '<button class="btn btn-secondary" onclick="App.saveSyncSettings()">Salvar Configuração</button>'}
                        <button class="btn btn-primary" onclick="App.signInSupabase()">Entrar</button>
                        <button class="btn btn-secondary" onclick="App.syncNow()">Sincronizar Agora</button>
                        <button class="btn btn-secondary" onclick="App.forceLocalSync()">Reenviar Dados Locais</button>
                        <button class="btn btn-danger" onclick="App.disconnectSupabase()">Encerrar sessão</button>
                    </div>
                    <p class="text-muted"><small>Acesso restrito ao usuário já cadastrado. Novas contas estão desativadas no Supabase.</small></p>
                </div>

                <div class="settings-card" id="settings-ai" data-settings-section="ai"><h3>🤖 Inteligência Artificial Local (Web AI)</h3>
                    <p>Ative recursos inteligentes de NLP executados localmente em seu navegador usando heurísticas TF-IDF de alta velocidade e opcionalmente redes neurais do Hugging Face.</p>
                    
                    <label class="checkbox-row" style="margin-bottom: 12px;">
                        <input type="checkbox" id="ai-neural-search" ${settings.aiNeuralSearch ? 'checked' : ''} onchange="App.toggleNeuralSearch(this.checked)">
                        Ativar Busca Semântica Avançada (Transformers.js)
                    </label>
                    
                    <div id="ai-model-status" style="margin-bottom: 15px; font-size: 13px; color: var(--text-muted);">
                        ${settings.aiNeuralSearch ? 'Modelo pronto para download ou ativo.' : 'Modo TF-IDF rápido ativo (Sem download).'}
                    </div>
                    
                    <div class="progress-bar-container" id="ai-progress-container" style="display:none; background: var(--bg-card); border: 1px solid var(--border); border-radius: 4px; height: 8px; margin-bottom: 15px; overflow: hidden;">
                        <div id="ai-progress-bar" style="width: 0%; height: 100%; background: var(--accent); transition: width 0.1s ease;"></div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="btn btn-primary" onclick="App.initAiModel()">Baixar/Ativar Modelo Neural (120MB)</button>
                        <button class="btn btn-secondary" onclick="App.testAiSemanticSearch()">Testar Busca Semântica</button>
                    </div>
                </div>

                <div class="settings-card" id="settings-appearance" data-settings-section="appearance"><h3>🎨 Personalização & Efeitos Sonoros</h3>
                    <p>Personalize a estética do seu ambiente e sinta cada clique com feedback tátil orgânico e sintetizado em tempo real.</p>
                    <div class="form-group">
                        <label>Tema de Cores</label>
                        <select class="form-control" onchange="App.changeTheme(this.value)" style="width:100%; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); padding: 8px; border-radius: 6px;">
                            <option value="dark" ${settings.theme === 'dark' || (!settings.theme && settings.theme !== 'light' && settings.theme !== 'circadian') ? 'selected' : ''}>Escuro Futurista</option>
                            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro Elegante</option>
                            <option value="circadian" ${settings.theme === 'circadian' ? 'selected' : ''}>🕒 Ritmo Circadiano Biológico (Dinâmico)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label>Cor de Destaque (Accent)</label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="color" value="${settings.accent || '#7C4DFF'}" oninput="App.changeAccentColor(this.value)" style="width: 50px; height: 38px; border: 0; padding: 0; background: none; cursor: pointer; border-radius: 4px;">
                            <input type="text" id="accent-hex" value="${settings.accent || '#7C4DFF'}" onchange="App.changeAccentColor(this.value)" style="flex: 1; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px; text-transform: uppercase; font-family: monospace;">
                        </div>
                    </div>
                    <label class="checkbox-row" style="margin-top: 15px;">
                        <input type="checkbox" id="settings-sounds" ${settings.interfaceSounds !== false ? 'checked' : ''} onchange="App.toggleInterfaceSounds(this.checked)">
                        Ativar micro-efeitos sonoros hápticos (Web Audio API)
                    </label>
                    <label class="checkbox-row" style="margin-top: 10px;">
                        <input type="checkbox" id="settings-pure-md" ${settings.pureMarkdownDefault ? 'checked' : ''} onchange="App.togglePureMarkdown(this.checked)">
                        Markdown puro por padrão no editor
                    </label>
                </div>

                <div class="settings-card" id="settings-billing" data-settings-section="billing"><h3>📈 Faturamento PIX (Orçamentos/OS)</h3>
                    <p>Configure seus dados PIX para gerar faturas e ordens de serviço profissionais com QR Code estático offline e payload de Copia e Cola instantâneo.</p>
                    <div class="form-group">
                        <label>Chave PIX (E-mail, Telefone, CPF/CNPJ ou Chave Aleatória)</label>
                        <input type="text" id="pix-key" placeholder="pix@suaempresa.com ou 12345678-abcd..." value="${this.escapeHtml(settings.pixKey || '')}" style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border); border-radius:6px;">
                        <small style="display:block; margin-top:6px; color:var(--text-secondary); line-height:1.4;">
                            💡 <strong>Dicas de formato para evitar falhas no QR Code:</strong><br>
                            • <strong>CPF/CNPJ</strong>: Digite apenas números (ex: <code>12345678909</code>). Pontos, traços e barras serão removidos automaticamente.<br>
                            • <strong>Celular</strong>: Deve conter o código internacional <code>+55</code> e o DDD (ex: <code>+5511999999999</code>).<br>
                            • <strong>E-mail</strong>: Digite o endereço completo (ex: <code>seu@email.com</code>).<br>
                            • <strong>Chave Aleatória</strong>: Digite o código UUID completo com hífens (ex: <code>12345678-abcd...</code>).<br>
                            <em>O sistema corrigirá o formato automaticamente ao salvar.</em>
                        </small>
                    </div>
                    <div class="form-row" style="display: flex; gap: 15px; margin-top: 15px;">
                        <div class="form-group" style="flex: 1;">
                            <label>Nome do Beneficiário (Sem acentos, máx 25)</label>
                            <input type="text" id="pix-name" placeholder="JOAO SILVA" value="${this.escapeHtml(settings.pixName || '')}" style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border); border-radius:6px; text-transform: uppercase;">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Cidade (Sem acentos, máx 15)</label>
                            <input type="text" id="pix-city" placeholder="SAO PAULO" value="${this.escapeHtml(settings.pixCity || '')}" style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border); border-radius:6px; text-transform: uppercase;">
                        </div>
                    </div>
                    <div class="settings-actions" style="margin-top: 15px;">
                        <button class="btn btn-primary" onclick="App.savePixSettings()">Salvar Dados de Faturamento</button>
                    </div>
                </div>

                <div class="settings-card" id="settings-organization" data-settings-section="organization"><h3>📁 Pastas de Bookmarks</h3>
                    <div class="mgmt-list">${bkFolders.map(f => `
                        <div class="mgmt-item"><span>${f.icon} ${f.name}</span><div class="mgmt-actions">
                        ${f.id!=='default'?`<button class="btn btn-sm btn-secondary" onclick="App.editBkFolder('${f.id}')">✏️ Editar</button><button class="btn btn-sm btn-danger" onclick="App.deleteBkFolder('${f.id}')">🗑️</button>`:''}</div></div>`).join('')}
                    </div>
                    <div class="mgmt-add-form"><button class="btn btn-sm btn-primary" onclick="App.addBkFolder()">+ Nova pasta</button></div>
                </div>

                <div class="settings-card" data-settings-section="organization"><h3>🏷️ Categorias de Bookmarks</h3>
                    <div class="mgmt-list">${bkCats.map(c => `
                        <div class="mgmt-item"><span><span class="color-dot" style="background:${c.color}"></span>${c.icon} ${c.name}</span><div class="mgmt-actions">
                        <button class="btn btn-sm btn-secondary" onclick="App.editBkCat('${c.id}')">✏️ Editar</button><button class="btn btn-sm btn-danger" onclick="App.deleteBkCat('${c.id}')">🗑️</button></div></div>`).join('')}
                    </div>
                    <div class="mgmt-add-form"><button class="btn btn-sm btn-primary" onclick="App.addBkCat()">+ Nova categoria</button></div>
                </div>

                <div class="settings-card" data-settings-section="organization"><h3>📁 Pastas de Notas</h3>
                    <div class="mgmt-list">${ntFolders.map(f => `
                        <div class="mgmt-item"><span>${f.icon} ${f.name}</span><div class="mgmt-actions">
                        ${f.id!=='default'?`<button class="btn btn-sm btn-secondary" onclick="App.editNtFolder('${f.id}')">✏️ Editar</button><button class="btn btn-sm btn-danger" onclick="App.deleteNtFolder('${f.id}')">🗑️</button>`:''}</div></div>`).join('')}
                    </div>
                    <div class="mgmt-add-form"><button class="btn btn-sm btn-primary" onclick="App.addNtFolder()">+ Nova pasta</button></div>
                </div>

                <div class="settings-card" data-settings-section="organization"><h3>🏷️ Categorias de Notas</h3>
                    <div class="mgmt-list">${ntCats.map(c => `
                        <div class="mgmt-item"><span><span class="color-dot" style="background:${c.color}"></span>${c.icon} ${c.name}</span><div class="mgmt-actions">
                        <button class="btn btn-sm btn-secondary" onclick="App.editNtCat('${c.id}')">✏️ Editar</button><button class="btn btn-sm btn-danger" onclick="App.deleteNtCat('${c.id}')">🗑️</button></div></div>`).join('')}
                    </div>
                    <div class="mgmt-add-form"><button class="btn btn-sm btn-primary" onclick="App.addNtCat()">+ Nova categoria</button></div>
                </div>

                <div class="settings-card danger" id="settings-trash" data-settings-section="trash"><h3>⚠️ Zona de Perigo</h3><p>Ações irreversíveis. Use com cuidado!</p>
                    <div class="settings-actions"><button class="btn btn-danger" onclick="App.clearAll()">🗑️ Limpar Todos os Dados</button></div>
                </div>
                <div class="settings-card" data-settings-section="trash"><h3>🗑️ Lixeira</h3><p>Itens apagados ficam aqui para recuperação rápida.</p>
                    <div class="mini-list">${trash.length ? trash.slice(0,10).map(t => `
                        <div class="mini-list-item"><span>${t.type === 'bookmark' ? '🔖' : '📝'} ${this.escapeHtml(t.item?.title || 'Sem título')} · ${new Date(t.deletedAt).toLocaleString('pt-BR')}</span><button class="btn btn-sm btn-secondary" onclick="App.restoreTrash('${t.id}')">Restaurar</button></div>
                    `).join('') : '<p class="text-muted">Lixeira vazia.</p>'}</div>
                    ${trash.length ? '<div class="settings-actions"><button class="btn btn-danger" onclick="App.emptyTrash()">Esvaziar Lixeira</button></div>' : ''}
                </div>
                <div class="settings-card" id="settings-about" data-settings-section="about"><h3>ℹ️ Sobre</h3><p><strong>BookList</strong> v3.0 Local-first</p><p>Aplicação portátil para organização de links e notas, com IndexedDB offline e sync opcional via Supabase.</p><p class="text-muted">O backup JSON continua disponível, mas o salvamento principal agora é automático no banco local do navegador.</p></div>
                <div class="settings-no-results"><span>⌕</span><h3>Nenhuma configuração encontrada</h3><p>Tente buscar por tema, backup, sincronização ou pastas.</p></div>
                </div>
                </main>
            </div>
        </div>`;
    },

    scrollSettingsSection(section, button) {
        const target = document.getElementById(`settings-${section}`);
        if (!target) return;
        document.querySelectorAll('.settings-section-nav button').forEach(item => item.classList.toggle('active', item === button));
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    filterSettings(query) {
        const normalized = String(query || '').trim().toLocaleLowerCase('pt-BR');
        const cards = [...document.querySelectorAll('.settings-content .settings-card')];
        let visible = 0;
        cards.forEach(card => {
            const match = !normalized || card.textContent.toLocaleLowerCase('pt-BR').includes(normalized);
            card.hidden = !match;
            if (match) visible += 1;
        });
        const empty = document.querySelector('.settings-no-results');
        if (empty) empty.classList.toggle('visible', visible === 0);
        document.querySelectorAll('.settings-section-nav button').forEach(button => {
            const section = button.dataset.settingsTarget;
            const hasMatch = cards.some(card => card.dataset.settingsSection === section && !card.hidden);
            button.hidden = normalized && !hasMatch;
        });
    },

    changeTheme(theme) {
        Storage.saveSettings({ theme });
        this.applyAppearance();
        if (window.SoundEffects) window.SoundEffects.playClick();
        this.renderSettingsPage(document.getElementById('main-content'));
    },
    changeAccentColor(color) {
        if (/^#[0-9a-f]{3,8}$/i.test(color)) {
            Storage.saveSettings({ accent: color });
            this.applyAppearance();
            const txtInput = document.getElementById('accent-hex');
            if (txtInput) txtInput.value = color;
        }
    },
    toggleInterfaceSounds(enabled) {
        Storage.saveSettings({ interfaceSounds: enabled });
        if (window.SoundEffects) {
            window.SoundEffects.enabled = enabled;
            if (enabled) window.SoundEffects.playClick();
        }
    },
    togglePureMarkdown(enabled) {
        Storage.saveSettings({ pureMarkdownDefault: enabled });
        if (window.SoundEffects) window.SoundEffects.playClick();
    },
    savePixSettings() {
        const rawKey = document.getElementById('pix-key')?.value.trim() || '';
        const name = document.getElementById('pix-name')?.value.trim().toUpperCase() || '';
        const city = document.getElementById('pix-city')?.value.trim().toUpperCase() || '';

        // Clean PIX key automatically to ensure standard format
        function cleanPixKey(key) {
            if (!key) return '';
            let clean = key.trim();
            if (clean.indexOf('@') !== -1) return clean; // E-mail
            let onlyDigits = clean.replace(/\D/g, '');
            if (clean.indexOf('+') === 0) return '+' + onlyDigits; // Celular com +
            if (onlyDigits.length === 11 && ['1','2','3','4','5','6','7','8','9'].indexOf(onlyDigits.charAt(0)) !== -1) {
                return '+55' + onlyDigits; // Celular BR sem +55
            }
            if (onlyDigits.length === 10) return '+55' + onlyDigits; // Telefone Fixo sem +55
            if (onlyDigits.length === 13 && onlyDigits.indexOf('55') === 0) {
                return '+' + onlyDigits; // Celular BR com 55 mas sem +
            }
            if (onlyDigits.length === 11 || onlyDigits.length === 14) {
                return onlyDigits; // CPF ou CNPJ puro
            }
            if (clean.replace(/[^a-fA-F0-9]/g, '').length === 32) {
                return clean.toLowerCase().replace(/[^a-z0-9-]/g, ''); // Chave aleatória UUID
            }
            return clean;
        }

        const key = cleanPixKey(rawKey);

        Storage.saveSettings({
            pixKey: key,
            pixName: name,
            pixCity: city
        });
        
        this.toast('Configurações PIX atualizadas com sucesso!', 'success');
        if (window.SoundEffects) window.SoundEffects.playComplete();
        this.renderSettingsPage(document.getElementById('main-content'));
    },

    // --- Folder/Category CRUD in Settings ---
    addBkFolder() { this.showFolderModal('bk'); },
    editBkFolder(id) { this.showFolderModal('bk', id); },
    deleteBkFolder(id) {
        this.confirmAction('Apagar pasta? Bookmarks serão movidos para "Geral".', () => {
            const bks = Storage.getBookmarks(); bks.forEach(b=>{if(b.folderId===id)b.folderId='default';}); Storage.saveBookmarks(bks);
            Storage.saveBkFolders(Storage.getBkFolders().filter(f=>f.id!==id));
            this.toast('Pasta apagada!','info'); this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Apagar pasta', confirmText: 'Apagar', danger: true });
    },
    addBkCat() { this.showCategoryModal('bk'); },
    editBkCat(id) { this.showCategoryModal('bk', id); },
    deleteBkCat(id) {
        this.confirmAction('Apagar categoria?', () => {
            const bks = Storage.getBookmarks(); bks.forEach(b=>{b.categoryIds=(b.categoryIds||[]).filter(c=>c!==id);}); Storage.saveBookmarks(bks);
            Storage.saveBkCategories(Storage.getBkCategories().filter(c=>c.id!==id));
            this.toast('Categoria apagada!','info'); this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Apagar categoria', confirmText: 'Apagar', danger: true });
    },
    addNtFolder() { this.showFolderModal('nt'); },
    editNtFolder(id) { this.showFolderModal('nt', id); },
    deleteNtFolder(id) {
        this.confirmAction('Apagar pasta? Notas serão movidas para "Geral".', () => {
            const ns = Storage.getNotes(); ns.forEach(n=>{if(n.folderId===id)n.folderId='default';}); Storage.saveNotes(ns);
            Storage.saveNtFolders(Storage.getNtFolders().filter(f=>f.id!==id));
            this.toast('Pasta apagada!','info'); this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Apagar pasta', confirmText: 'Apagar', danger: true });
    },
    addNtCat() { this.showCategoryModal('nt'); },
    editNtCat(id) { this.showCategoryModal('nt', id); },
    deleteNtCat(id) {
        this.confirmAction('Apagar categoria?', () => {
            const ns = Storage.getNotes(); ns.forEach(n=>{n.categoryIds=(n.categoryIds||[]).filter(c=>c!==id);}); Storage.saveNotes(ns);
            Storage.saveNtCategories(Storage.getNtCategories().filter(c=>c.id!==id));
            this.toast('Categoria apagada!','info'); this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Apagar categoria', confirmText: 'Apagar', danger: true });
    },
    showFolderModal(scope, id = '') {
        const isNotes = scope === 'nt';
        const list = isNotes ? Storage.getNtFolders() : Storage.getBkFolders();
        const item = id ? list.find(x => x.id === id) : null;
        if (id && !item) return this.toast('Pasta não encontrada.', 'error');
        const title = `${id ? 'Editar' : 'Nova'} pasta de ${isNotes ? 'notas' : 'bookmarks'}`;
        const icon = item?.icon || '📁';
        const name = item?.name || '';
        this.showModal(title, `
            ${this.modalContextHtml({
                icon,
                title,
                description: isNotes ? 'Organize notas por cadernos, áreas ou fluxos de estudo.' : 'Agrupe links por assunto, cliente, pesquisa ou rotina.',
                meta: [isNotes ? 'Notas' : 'Bookmarks', id ? 'Edição' : 'Criação'],
                tone: isNotes ? 'notes' : 'bookmarks'
            })}
            <form onsubmit="App.saveFolderModal('${scope}','${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Nome</label><input id="entity-name" type="text" value="${this.escapeHtml(name)}" placeholder="Nome da pasta" required autofocus></div>
                ${this.emojiPickerHtml('entity-icon', icon)}
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },
    showCategoryModal(scope, id = '') {
        const isNotes = scope === 'nt';
        const list = isNotes ? Storage.getNtCategories() : Storage.getBkCategories();
        const item = id ? list.find(x => x.id === id) : null;
        if (id && !item) return this.toast('Categoria não encontrada.', 'error');
        const title = `${id ? 'Editar' : 'Nova'} categoria de ${isNotes ? 'notas' : 'bookmarks'}`;
        const icon = item?.icon || (isNotes ? '📝' : '🔗');
        const name = item?.name || '';
        const color = item?.color || '#7C4DFF';
        this.showModal(title, `
            ${this.modalContextHtml({
                icon,
                title,
                description: isNotes ? 'Use categorias para marcar temas, prioridades e tipos de conteúdo.' : 'Use categorias para classificar links por contexto de uso.',
                meta: [isNotes ? 'Notas' : 'Bookmarks', id ? 'Edição' : 'Criação'],
                tone: isNotes ? 'notes' : 'bookmarks',
                accent: color
            })}
            <form onsubmit="App.saveCategoryModal('${scope}','${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Nome</label><input id="entity-name" type="text" value="${this.escapeHtml(name)}" placeholder="Nome da categoria" required autofocus></div>
                ${this.emojiPickerHtml('entity-icon', icon)}
                <div class="form-group"><label>Cor</label><div class="color-field"><input id="entity-color" type="color" value="${this.escapeHtml(color)}"><span style="--preview-color:${this.escapeHtml(color)}"></span></div></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },
    saveFolderModal(scope, id = '') {
        const name = document.getElementById('entity-name')?.value.trim();
        const icon = document.getElementById('entity-icon')?.value.trim() || '📁';
        if (!name) return this.toast('Digite um nome.', 'error');
        const isNotes = scope === 'nt';
        const list = isNotes ? Storage.getNtFolders() : Storage.getBkFolders();
        if (id) {
            const item = list.find(x => x.id === id);
            if (!item) return this.toast('Pasta não encontrada.', 'error');
            item.name = name; item.icon = icon;
        } else {
            list.push({ id: crypto.randomUUID(), name, icon });
        }
        if (isNotes) Storage.saveNtFolders(list); else Storage.saveBkFolders(list);
        this.closeModal();
        this.toast(id ? 'Pasta atualizada!' : 'Pasta criada!', 'success');
        this.renderSettingsPage(document.getElementById('main-content'));
    },
    saveCategoryModal(scope, id = '') {
        const name = document.getElementById('entity-name')?.value.trim();
        const icon = document.getElementById('entity-icon')?.value.trim() || (scope === 'nt' ? '📝' : '🔗');
        const color = document.getElementById('entity-color')?.value || '#7C4DFF';
        if (!name) return this.toast('Digite um nome.', 'error');
        const isNotes = scope === 'nt';
        const list = isNotes ? Storage.getNtCategories() : Storage.getBkCategories();
        if (id) {
            const item = list.find(x => x.id === id);
            if (!item) return this.toast('Categoria não encontrada.', 'error');
            item.name = name; item.icon = icon; item.color = color;
        } else {
            list.push({ id: crypto.randomUUID(), name, icon, color });
        }
        if (isNotes) Storage.saveNtCategories(list); else Storage.saveBkCategories(list);
        this.closeModal();
        this.toast(id ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
        this.renderSettingsPage(document.getElementById('main-content'));
    },
    emojiPickerHtml(inputId, current = '📁') {
        const groups = this.getEmojiGroups();
        const buttons = groups.map(group => `
            <div class="emoji-group" data-group="${this.escapeHtml(group.name.toLowerCase())}">
                <strong>${this.escapeHtml(group.name)}</strong>
                <div class="emoji-grid">${group.items.map(item => `
                    <button type="button" class="emoji-choice ${item.emoji === current ? 'selected' : ''}" data-emoji="${this.escapeHtml(item.emoji)}" data-search="${this.escapeHtml((item.tags + ' ' + group.name).toLowerCase())}" onclick="App.selectEmoji('${inputId}', this)">${item.emoji}</button>
                `).join('')}</div>
            </div>
        `).join('');
        return `
            <div class="form-group emoji-picker-wrap">
                <label>Ícone</label>
                <div class="emoji-current-row"><input id="${inputId}" class="emoji-value-input" type="text" value="${this.escapeHtml(current)}" maxlength="8"><span class="emoji-preview">${this.escapeHtml(current)}</span></div>
                <input class="emoji-search" type="search" placeholder="Buscar emoji: pasta, estudo, trabalho, estrela..." oninput="App.filterEmojiPicker(this.value)">
                <div class="emoji-picker-panel">${buttons}</div>
            </div>
        `;
    },
    selectEmoji(inputId, button) {
        const emoji = button.dataset.emoji || button.textContent.trim();
        const input = document.getElementById(inputId);
        if (input) input.value = emoji;
        document.querySelectorAll('.emoji-choice').forEach(btn => btn.classList.toggle('selected', btn === button));
        const preview = document.querySelector('.emoji-preview');
        if (preview) preview.textContent = emoji;
    },
    filterEmojiPicker(query = '') {
        const q = query.trim().toLowerCase();
        document.querySelectorAll('.emoji-choice').forEach(btn => {
            btn.hidden = q && !btn.dataset.search.includes(q) && !btn.dataset.emoji.includes(q);
        });
        document.querySelectorAll('.emoji-group').forEach(group => {
            group.hidden = q && !Array.from(group.querySelectorAll('.emoji-choice')).some(btn => !btn.hidden);
        });
    },
    getEmojiGroups() {
        const make = (name, items) => ({ name, items: items.map(([emoji, tags]) => ({ emoji, tags })) });
        return [
            make('Organização', [['📁','pasta arquivo folder'],['📂','pasta aberta'],['🗂️','arquivo abas'],['🗃️','caixa arquivo'],['🏷️','tag etiqueta categoria'],['🔖','bookmark marcador favorito'],['📌','pin fixado'],['📍','local marcador'],['🧭','navegação direção'],['🗺️','mapa'],['🧩','módulo peça'],['🗄️','gaveta banco dados'],['📦','caixa pacote'],['🧰','ferramentas kit'],['🧱','bloco construção'],['🪄','magia automação']]),
            make('Notas e estudo', [['📝','nota escrever'],['📔','caderno'],['📓','caderno notas'],['📒','livro razão'],['📕','livro vermelho'],['📗','livro verde'],['📘','livro azul'],['📙','livro laranja'],['📚','livros biblioteca'],['📖','ler leitura'],['🔬','pesquisa ciência'],['🧪','experimento'],['🧠','mente cérebro ideia'],['💡','ideia luz'],['🎓','estudo faculdade'],['✏️','lápis editar'],['🖊️','caneta'],['🖋️','caneta tinteiro'],['📐','régua design'],['🧮','cálculo']]),
            make('Trabalho', [['💼','trabalho negócios'],['📊','gráfico estatística'],['📈','crescimento'],['📉','queda'],['🧾','recibo documento'],['📋','checklist prancheta'],['✅','feito concluído'],['☑️','checkbox'],['⏳','tempo aguardando'],['⏱️','cronômetro'],['📅','calendário'],['🗓️','agenda'],['🤝','reunião parceria'],['🎯','meta alvo'],['🚀','lançamento'],['⚡','rápido energia'],['🔥','prioridade quente'],['⭐','estrela importante'],['🏆','troféu'],['💎','premium']]),
            make('Tecnologia', [['💻','computador dev'],['🖥️','desktop tela'],['⌨️','teclado'],['🖱️','mouse'],['📱','celular mobile'],['🌐','web internet'],['🔗','link conexão'],['🛠️','ferramenta manutenção'],['⚙️','configuração engrenagem'],['🧑‍💻','programação dev'],['👨‍💻','programador'],['👩‍💻','programadora'],['🧬','dados estrutura'],['🗜️','compressão'],['🔐','segurança lock'],['🔑','chave senha'],['🛡️','proteção'],['☁️','cloud nuvem'],['📡','rede'],['🤖','ia robô']]),
            make('Mídia', [['🎬','filme cinema'],['🎥','câmera vídeo'],['📺','tv youtube'],['🎧','fone audio'],['🎵','música'],['🎤','microfone'],['📷','foto câmera'],['🖼️','imagem quadro'],['🎨','arte design'],['🖌️','pincel'],['🎮','jogo game'],['🕹️','arcade'],['📰','notícia jornal'],['📣','anúncio'],['📢','megafone'],['💬','chat comentário'],['💭','pensamento'],['📨','mensagem'],['✉️','email'],['🔔','alerta notificação']]),
            make('Vida', [['🏠','casa pessoal'],['🏢','empresa'],['🏫','escola'],['🏥','saúde hospital'],['🏦','finanças banco'],['🛒','compras'],['🍽️','comida refeição'],['☕','café'],['🏋️','treino academia'],['🧘','meditação foco'],['✈️','viagem'],['🚗','carro'],['🌱','crescimento hábito'],['🌿','natureza'],['❤️','amor coração'],['💜','roxo favorito'],['🙂','feliz'],['😎','cool'],['🤔','pensar'],['✨','brilho']]),
            make('Símbolos', [['➕','mais adicionar'],['➖','menos remover'],['❌','erro fechar'],['❗','importante'],['❓','pergunta dúvida'],['🔴','vermelho'],['🟠','laranja'],['🟡','amarelo'],['🟢','verde'],['🔵','azul'],['🟣','roxo'],['⚫','preto'],['⚪','branco'],['🟥','quadrado vermelho'],['🟧','quadrado laranja'],['🟨','quadrado amarelo'],['🟩','quadrado verde'],['🟦','quadrado azul'],['🟪','quadrado roxo'],['⬛','quadrado preto']])
        ];
    },    async handleImport(file) {
        if (!file) return;
        try { await Storage.importAll(file); this.toast('Dados importados com sucesso!','success'); this.renderPage(this.currentPage||'dashboard'); }
        catch(e) { this.toast('Erro ao importar: '+e.message,'error'); }
    },
    async clearAll() {
        this.confirmAction('Isso apagará TODOS os seus dados locais. Tem certeza absoluta?', async () => {
            await Storage.clearAll();
            this.toast('Dados apagados.','info'); this.renderPage(this.currentPage);
        }, { title: 'Limpar todos os dados', confirmText: 'Apagar tudo', danger: true });
    },
    createManualBackup() {
        Storage.createAutoBackup('manual');
        this.toast('Backup local criado.', 'success');
        this.renderSettingsPage(document.getElementById('main-content'));
    },
    restoreTrash(id) {
        if (Storage.restoreTrashItem(id)) {
            this.toast('Item restaurado.', 'success');
            this.renderSettingsPage(document.getElementById('main-content'));
        }
    },
    emptyTrash() {
        this.confirmAction('Esvaziar a lixeira?', () => {
            Storage.emptyTrash();
            this.toast('Lixeira esvaziada.', 'info');
            this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Esvaziar lixeira', confirmText: 'Esvaziar', danger: true });
    },
    globalSearchDebounced(query) {
        clearTimeout(this._globalSearchTimer);
        this._lastGlobalSearch = query;
        this._globalSearchTimer = setTimeout(() => this.globalSearch(query), 180);
    },
    globalSearch(query) {
        const el = document.getElementById('global-search-results');
        if (!el) return;
        const q = query.trim();
        this._lastGlobalSearch = q;
        if (q.length < 2) { el.innerHTML = ''; el.classList.remove('active'); return; }

        const results = FuzzySearch.search(q, this.buildSearchDocs(), { limit: 18, minScore: 28 });
        this._globalResults = results;

        if (!results.length) {
            el.innerHTML = '<div class="global-empty">Nenhum resultado encontrado.</div>';
            el.classList.add('active');
            return;
        }

        el.innerHTML = results.map((result, index) => this.searchResultHtml(result, index, q)).join('');
        el.classList.add('active');
    },
    buildSearchDocs() {
        const docs = [];
        const modules = this.getProfessionalModules();
        const records = Storage.getProfessionalRecords();
        const personal = Storage.getPersonalData();
        Storage.getBookmarks().forEach(b => docs.push({
            type: 'bookmark',
            icon: '&#128278;',
            title: b.title || 'Sem titulo',
            subtitle: b.url || '',
            run: () => { Storage.recordBookmarkOpen(b.id); window.open(UI.isSafeUrl(b.url) ? b.url : '#', '_blank', 'noopener'); },
            fields: [
                { text: b.title || '', weight: 4 },
                { text: b.url || '', weight: 2 },
                { text: b.description || '', weight: 1 }
            ]
        }));
        Storage.getNotes().forEach(n => docs.push({
            type: 'note',
            icon: '&#128221;',
            title: n.title || 'Sem titulo',
            subtitle: this.stripHtml(n.content || '').slice(0, 120),
            run: () => this.afterNavigate('notes', () => Notes.openEditor(n.id)),
            fields: [
                { text: n.title || '', weight: 4 },
                { text: this.stripHtml(n.content || ''), weight: 1 }
            ]
        }));
        records.forEach(r => {
            const client = r.clientId ? records.find(item => item.id === r.clientId) : null;
            const equipment = r.equipmentId ? records.find(item => item.id === r.equipmentId) : null;
            docs.push({
                type: 'professional',
                icon: modules[r.moduleKey]?.icon || '&#128736;',
                title: r.title || 'Registro tecnico',
                subtitle: [modules[r.moduleKey]?.title, r.status, client?.title, equipment?.title].filter(Boolean).join(' · '),
                run: () => r.moduleKey === 'clients' ? this.openClientDetail(r.id) : this.openProfessionalRecord(r.id),
                fields: [
                    { text: r.title || '', weight: 4 },
                    { text: modules[r.moduleKey]?.title || '', weight: 2 },
                    { text: r.status || '', weight: 2 },
                    { text: client?.title || '', weight: 2 },
                    { text: equipment?.title || '', weight: 2 },
                    { text: r.content || '', weight: 1 },
                    { text: Object.values(r.fields || {}).map(value => typeof value === 'object' ? JSON.stringify(value) : value).join(' '), weight: 1 }
                ]
            });
        });
        (personal.money || []).forEach(m => docs.push({
            type: 'money',
            icon: '&#128184;',
            title: m.title || 'Lancamento pessoal',
            subtitle: [m.type, m.category, UI.money(m.amount), UI.date(m.date || m.createdAt)].filter(Boolean).join(' · '),
            run: () => this.afterNavigate('money', () => PersonalHub.showMoneyModal(m.id)),
            fields: [
                { text: m.title || '', weight: 4 },
                { text: m.category || '', weight: 2 },
                { text: m.account || '', weight: 2 },
                { text: m.note || '', weight: 1 }
            ]
        }));
        (personal.tracker || []).forEach(t => docs.push({
            type: 'tracker',
            icon: '&#128218;',
            title: t.title || 'Obra no tracker',
            subtitle: [t.type, t.status, `cap ${t.currentChapter || 0}/${t.latestChapter || 0}`].filter(Boolean).join(' · '),
            run: () => this.afterNavigate('tracker', () => PersonalHub.showTrackerModal(t.id)),
            fields: [
                { text: t.title || '', weight: 4 },
                { text: t.type || '', weight: 2 },
                { text: t.status || '', weight: 2 },
                { text: t.note || '', weight: 1 },
                { text: [t.url, t.rawUrl, t.wikiUrl].filter(Boolean).join(' '), weight: 1 }
            ]
        }));
        (personal.inbox || []).forEach(i => docs.push({
            type: 'personal',
            icon: '&#128229;',
            title: i.text || 'Item da inbox',
            subtitle: `Inbox pessoal · ${i.status || 'aberto'}`,
            run: () => this.navigate('personal-inbox'),
            fields: [{ text: i.text || '', weight: 3 }]
        }));
        return docs;
    },
    searchResultHtml(result, index, query = '') {
        const typeLabels = {
            bookmark: 'Bookmark',
            note: 'Nota',
            professional: 'Profissional',
            money: 'Money',
            tracker: 'Tracker',
            personal: 'Pessoal'
        };
        return `<button class="global-result" onclick="App.runSearchResult(${index})"><span>${result.icon}</span><div><strong>${UI.highlight(result.title, query)}</strong><small>${this.escapeHtml(typeLabels[result.type] || 'Resultado')} · score ${result.score} · ${UI.highlight(result.subtitle || '', query)}</small></div></button>`;
    },
    runSearchResult(index) {
        const result = this._globalResults?.[index];
        result?.run?.();
        document.getElementById('global-search-results')?.classList.remove('active');
    },
    _readSyncForm() {
        return {
            supabaseUrl: document.getElementById('sync-url')?.value.trim() || '',
            anonKey: document.getElementById('sync-anon-key')?.value.trim() || '',
            email: document.getElementById('sync-email')?.value.trim() || '',
            password: document.getElementById('sync-password')?.value || '',
            enabled: Boolean(document.getElementById('sync-enabled')?.checked)
        };
    },
    saveSyncSettings() {
        const form = this._readSyncForm();
        Storage.saveSyncConfig({
            supabaseUrl: form.supabaseUrl,
            anonKey: form.anonKey,
            email: form.email,
            enabled: form.enabled
        });
        this.toast('Configuração de sync salva.', 'success');
        this.renderSettingsPage(document.getElementById('main-content'));
    },
    async signInSupabase() {
        const form = this._readSyncForm();
        if (!form.email || !form.password) return this.toast('Digite e-mail e senha.', 'error');
        try {
            Storage.saveSyncConfig({ supabaseUrl: form.supabaseUrl, anonKey: form.anonKey, email: form.email, enabled: true });
            await Storage.signInSupabase(form.email, form.password);
            this.toast('Login no Supabase feito. Sync ativado!', 'success');
            await this.syncNow(false);
        } catch (err) {
            this.toast('Erro no login: ' + err.message, 'error');
            this.renderSettingsPage(document.getElementById('main-content'));
        }
    },
    async signUpSupabase() {
        const form = this._readSyncForm();
        if (!form.email || !form.password) return this.toast('Digite e-mail e senha.', 'error');
        try {
            Storage.saveSyncConfig({ supabaseUrl: form.supabaseUrl, anonKey: form.anonKey, email: form.email, enabled: true });
            const data = await Storage.signUpSupabase(form.email, form.password);
            const msg = data.access_token ? 'Conta criada e sync ativado!' : 'Conta criada. Confirme o e-mail antes de entrar.';
            this.toast(msg, 'success');
            this.renderSettingsPage(document.getElementById('main-content'));
        } catch (err) {
            this.toast('Erro ao criar conta: ' + err.message, 'error');
        }
    },
    async syncNow(showToast = true) {
        try {
            const result = await Storage.syncNow();
            if (showToast) this.toast(result.message || 'Sincronizado com Supabase.', result.ok ? 'success' : 'info');
            if (result.ok && window.SoundEffects) window.SoundEffects.playSync();
            const modalActive = document.getElementById('modal-overlay')?.classList.contains('active') || document.getElementById('confirm-overlay')?.classList.contains('active');
            if (!modalActive) this.renderPage(this.currentPage);
        } catch (err) {
            this.toast('Erro no sync: ' + err.message, 'error');
            if (this.currentPage === 'settings') this.renderSettingsPage(document.getElementById('main-content'));
        }
    },
    async forceLocalSync() {
        const count = Storage.forceLocalSync();
        if (!count) return this.toast('Nao ha dados locais para reenviar.', 'info');
        this.toast(`${count} blocos locais marcados para reenvio.`, 'info');
        await this.syncNow(false);
    },
    disconnectSupabase() {
        this.confirmAction('Desconectar do Supabase neste navegador? Seus dados locais serão mantidos.', () => {
            Storage.disconnectSupabase();
            this.toast('Supabase desconectado. Dados locais mantidos.', 'info');
            this.renderSettingsPage(document.getElementById('main-content'));
        }, { title: 'Desconectar Supabase', confirmText: 'Desconectar', danger: true });
    },
    getCommands(query = '') {
        const base = [
            { label: 'Novo bookmark', hint: 'Captura', type: 'command', run: () => { this.navigate('bookmarks'); setTimeout(()=>Bookmarks.showAddModal(),100); this.closeCommandPalette(); } },
            { label: 'Nova nota', hint: 'Editor', type: 'command', run: () => { this.navigate('notes'); setTimeout(()=>Notes.showCreateModal(),100); this.closeCommandPalette(); } },
            { label: 'Abrir Power Hub', hint: 'Suite', type: 'command', run: () => { this.navigate('power'); this.closeCommandPalette(); } },
            { label: 'Hoje e Pendências', hint: 'Central operacional', type: 'command', run: () => { this.navigate('today-center'); this.closeCommandPalette(); } },
            { label: 'OS 360', hint: 'Jornada completa do atendimento técnico', type: 'command', run: () => { this.navigate('os360'); this.closeCommandPalette(); } },
            { label: 'Integrações', hint: 'Catálogos e APIs externas', type: 'command', run: () => { this.navigate('integrations'); this.closeCommandPalette(); } },
            { label: 'Central de Automações', hint: 'Regras, modelos e runbooks', type: 'command', run: () => { this.navigate('automation-center'); this.closeCommandPalette(); } },
            { label: 'Relatórios', hint: 'Visão consolidada pessoal e técnica', type: 'command', run: () => { this.navigate('reports'); this.closeCommandPalette(); } },
            { label: 'Abrir Pessoal', hint: 'Vida, diário, hábitos e metas', type: 'command', run: () => { this.navigate('personal'); this.closeCommandPalette(); } },
            { label: 'Diário', hint: 'Nova entrada pessoal', type: 'command', run: () => { this.navigate('journal'); setTimeout(()=>PersonalHub.showJournalModal(),100); this.closeCommandPalette(); } },
            { label: 'Hábitos', hint: 'Check-ins pessoais', type: 'command', run: () => { this.navigate('habits'); this.closeCommandPalette(); } },
            { label: 'Metas pessoais', hint: 'Objetivos por área', type: 'command', run: () => { this.navigate('goals'); this.closeCommandPalette(); } },
            { label: 'Minhas mídias', hint: 'Animes, mangás, filmes e séries', type: 'command', run: () => { this.navigate('tracker'); this.closeCommandPalette(); } },
            { label: 'Money pessoal', hint: 'Entradas, saídas e saldo', type: 'command', run: () => { this.navigate('money'); this.closeCommandPalette(); } },
            { label: 'Inbox pessoal', hint: 'Captura rápida', type: 'command', run: () => { this.navigate('personal-inbox'); this.closeCommandPalette(); } },
            { label: 'Cockpit executivo', hint: 'Suite pessoal', type: 'command', run: () => { FeatureHub.currentTab='cockpit'; this.navigate('power'); this.closeCommandPalette(); } },
            { label: 'Busca semantica', hint: 'Busca local leve', type: 'command', run: () => { FeatureHub.currentTab='semantic'; this.navigate('power'); this.closeCommandPalette(); } },
            { label: 'Snapshots', hint: 'Backup versionado', type: 'command', run: () => { FeatureHub.currentTab='snapshots'; this.navigate('power'); this.closeCommandPalette(); } },
            { label: 'Saúde do sistema', hint: 'Backups, banco local e sincronização', type: 'command', run: () => { this.navigate('health'); this.closeCommandPalette(); } },
            { label: 'Backup JSON', hint: 'Portabilidade', type: 'command', run: () => { Storage.exportAll(); this.closeCommandPalette(); } }
        ];
        const noteCommands = Storage.getNotes().filter(n => this.contextMatches('note', n)).map(n => ({ label: n.title || 'Nota sem título', hint: 'Nota', type: 'note', run: () => { this.closeCommandPalette(); this.afterNavigate('notes', () => Notes.openEditor(n.id)); } }));
        const bookmarkCommands = Storage.getBookmarks().filter(b => this.contextMatches('bookmark', b)).map(b => ({ label: b.title || 'Link sem título', hint: b.url || 'Bookmark', type: 'bookmark', run: () => { Storage.recordBookmarkOpen(b.id); window.open(UI.isSafeUrl(b.url) ? b.url : '#','_blank','noopener'); this.closeCommandPalette(); } }));
        
        const all = [...base, ...noteCommands, ...bookmarkCommands];
        if (!query.trim()) {
            return [
                ...base.slice(0, 6),
                ...noteCommands.slice(0, 5),
                ...bookmarkCommands.slice(0, 5)
            ];
        }
        return FuzzySearch.search(query, all.map(command => ({
            ...command,
            fields: [
                { text: command.label || '', weight: 4 },
                { text: command.hint || '', weight: 1 }
            ]
        })), { limit: 28, minScore: 24 });
    },
    escapeHtml(str) {
        const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML;
    },
    escapeJs(str = '') {
        return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
    },
    stripHtml(html) {
        const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || d.innerText || '';
    },
    showModal(title, content) {
        let ov = document.getElementById('modal-overlay');
        if(!ov){ov=document.createElement('div');ov.id='modal-overlay';ov.className='modal-overlay';document.body.appendChild(ov);}
        const lowerTitle = String(title || '').toLowerCase();
        const presentation = [
            ['finance', '&#128176;', 'Registre uma entrada ou saída com competência, pagamento e vínculo ao cliente.'],
            ['orçamento', '&#129534;', 'Monte uma proposta clara, com itens, condições e validade.'],
            ['atendimento', '&#128295;', 'Registre a ordem de serviço, diagnóstico e andamento do atendimento.'],
            ['equipamento', '&#128187;', 'Mantenha identificação, estado e histórico técnico do equipamento.'],
            ['cliente', '&#128101;', 'Centralize contato, contexto e relacionamento com este cliente.'],
            ['agenda', '&#128197;', 'Defina o compromisso, horário, local e responsável.'],
            ['runbook', '&#9989;', 'Estruture um procedimento repetível e fácil de executar.'],
            ['script', '&#9000;', 'Documente uso, risco e contexto antes de salvar o comando.'],
            ['rede', '&#127760;', 'Registre inventário, topologia e pontos importantes da infraestrutura.'],
            ['tracker', '&#127916;', 'Acompanhe progresso, detalhes e onde encontrar a obra.'],
            ['mídia', '&#127916;', 'Acompanhe progresso, detalhes e onde encontrar a obra.'],
            ['bookmark', '&#128278;', lowerTitle.includes('editar') ? 'Ajuste o contexto do link para encontrá-lo rapidamente depois.' : 'Salve um link com contexto para ele não se perder no histórico.'],
            ['nota', '&#128221;', 'Escolha como iniciar e organize a nota antes de abrir o editor.'],
            ['pasta', '&#128193;', 'Dê uma estrutura simples para os seus itens.'],
            ['categoria', '&#9679;', 'Crie uma classificação fácil de reconhecer nas listagens.']
        ].find(([match]) => lowerTitle.includes(match)) || ['neutral', '&#10022;', 'Preencha os dados necessários e revise antes de salvar.'];
        const [, icon, description] = presentation;
        ov.innerHTML = `<div class="modal modal-v2" role="dialog" aria-modal="true"><div class="modal-header"><div class="modal-title-wrap"><div class="modal-title-icon">${icon}</div><div><h3>${this.escapeHtml(title)}</h3><p>${this.escapeHtml(description)}</p></div></div><button class="btn-icon modal-close" onclick="App.closeModal()" aria-label="Fechar">✕</button></div><div class="modal-body">${content}</div></div>`;
        ov.classList.add('active');
        ov.onclick = (e) => { if (e.target === ov) App.closeModal(); };
    },
    closeModal() {
        const ov=document.getElementById('modal-overlay');
        if(ov) {
            ov.classList.remove('active');
            ov.onclick = null;
        }
    },
    confirmAction(message, onConfirm, options = {}) {
        this._pendingConfirm = typeof onConfirm === 'function' ? onConfirm : null;
        let ov = document.getElementById('confirm-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'confirm-overlay';
            ov.className = 'confirm-overlay';
            document.body.appendChild(ov);
        }
        const title = options.title || 'Confirmar ação';
        const confirmText = options.confirmText || 'Confirmar';
        const dangerClass = options.danger === false ? 'btn-primary' : 'btn-danger';
        ov.innerHTML = `
            <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
                <div class="confirm-header"><h3 id="confirm-title">${this.escapeHtml(title)}</h3></div>
                <p>${this.escapeHtml(message)}</p>
                <div class="confirm-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.cancelConfirm()">Cancelar</button>
                    <button type="button" class="btn ${dangerClass}" onclick="App.runConfirm()">${this.escapeHtml(confirmText)}</button>
                </div>
            </div>`;
        ov.classList.add('active');
        ov.onclick = (e) => { if (e.target === ov) this.cancelConfirm(); };
        setTimeout(() => ov.querySelector('.btn-danger,.btn-primary')?.focus(), 30);
    },
    cancelConfirm() {
        this._pendingConfirm = null;
        document.getElementById('confirm-overlay')?.classList.remove('active');
    },
    runConfirm() {
        const fn = this._pendingConfirm;
        this._pendingConfirm = null;
        document.getElementById('confirm-overlay')?.classList.remove('active');
        fn?.();
    },
    toast(msg,type='info', action = null) {
        let c=document.getElementById('toast-container');
        if(!c){c=document.createElement('div');c.id='toast-container';c.className='toast-container';document.body.appendChild(c);}
        const t=document.createElement('div');t.className=`toast toast-${type}`;
        const text=document.createElement('span');text.textContent=msg;t.appendChild(text);
        if(action){
            const btn=document.createElement('button');btn.className='toast-action';btn.textContent=action.label;
            btn.onclick=()=>{ action.onClick?.(); t.remove(); };
            t.appendChild(btn);
        }
        c.appendChild(t);
        setTimeout(()=>t.classList.add('show'),10);
        setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
    },

    toggleNeuralSearch(enabled) {
        Storage.saveSettings({ aiNeuralSearch: Boolean(enabled) });
        App.toast(enabled ? 'Busca semântica ativada. Lembre-se de inicializar o modelo neural para uso.' : 'Busca semântica desativada. Revertendo para TF-IDF rápido.', 'info');
        this.renderSettingsPage(document.getElementById('main-content'));
    },

    async initAiModel() {
        const btn = event?.currentTarget || document.querySelector('[onclick="App.initAiModel()"]');
        const progressContainer = document.getElementById('ai-progress-container');
        const progressBar = document.getElementById('ai-progress-bar');
        const statusText = document.getElementById('ai-model-status');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (statusText) statusText.textContent = 'Inicializando Transformers.js de CDN...';
        if (btn) btn.disabled = true;

        try {
            await WebAI.initTransformers((p) => {
                if (progressBar) progressBar.style.width = `${Math.round(p * 100)}%`;
                if (statusText) statusText.textContent = `Baixando modelo neural: ${Math.round(p * 100)}%`;
            });
            if (statusText) statusText.textContent = 'Modelo neural Xenova/all-MiniLM-L6-v2 carregado com sucesso na memória cache!';
            if (progressBar) progressBar.style.backgroundColor = '#00BFA5';
            App.toast('Modelo Neural IA inicializado com sucesso!', 'success');
            if (window.SoundEffects) window.SoundEffects.playAi();
        } catch (err) {
            if (statusText) statusText.textContent = 'Erro ao inicializar: ' + err.message;
            if (progressBar) progressBar.style.backgroundColor = '#D50000';
            App.toast('Erro ao inicializar IA: ' + err.message, 'error');
            console.error(err);
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    testAiSemanticSearch() {
        const hasModel = Boolean(WebAI._pipeline);
        const searchMethod = hasModel ? 'Semântico (Transformers.js)' : 'Heurístico (TF-IDF)';
        App.showModal('Testar Busca IA Local', `
            <div class="ai-test-modal" style="padding: 10px 0;">
                <p style="margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">
                    Status atual: <strong>${searchMethod}</strong>.
                    Insira um termo para testar a busca IA inteligente em todas as suas notas e bookmarks simultaneamente.
                </p>
                <div class="form-group" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" id="ai-test-query" placeholder="Ex: estudo de programação" style="flex: 1;" autofocus>
                    <button class="btn btn-primary" onclick="App.runAiTestSearch()" style="margin: 0;">Buscar</button>
                </div>
                <div id="ai-test-results" style="max-height: 250px; overflow-y: auto; background: var(--bg-hover); border-radius: 8px; padding: 10px; border: 1px solid var(--border);">
                    <p class="text-muted" style="text-align: center; margin: 20px 0;">Digite um termo e clique em Buscar</p>
                </div>
                <div class="form-actions" style="margin-top: 15px; display: flex; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="App.closeModal()">Fechar</button>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('ai-test-query')?.focus(), 50);
    },

    async runAiTestSearch() {
        const query = document.getElementById('ai-test-query')?.value.trim();
        const resultsContainer = document.getElementById('ai-test-results');
        if (!query) return App.toast('Digite um termo para pesquisar.', 'info');
        
        if (resultsContainer) resultsContainer.innerHTML = '<p class="text-muted" style="text-align: center; margin: 20px 0;">Processando busca inteligente local...</p>';
        
        const allItems = [
            ...Storage.getBookmarks().map(b => ({ ...b, type: 'bookmark', docText: `${b.title} ${b.description} ${b.url}` })),
            ...Storage.getNotes().map(n => ({ ...n, type: 'note', docText: `${n.title} ${Notes.stripHtml(n.content)}` }))
        ];
        
        try {
            const results = await WebAI.searchSemantic(query, allItems, 5);
            if (!results.length) {
                if (resultsContainer) resultsContainer.innerHTML = '<p class="text-muted" style="text-align: center; margin: 20px 0;">Nenhum resultado correspondente.</p>';
                return;
            }
            
            if (resultsContainer) {
                resultsContainer.innerHTML = results.map(r => `
                    <div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
                        <div>
                            <strong>${r.type === 'bookmark' ? '🔖' : '📝'} ${App.escapeHtml(r.title)}</strong><br>
                            <small style="color: var(--text-muted);">${App.escapeHtml(r.type === 'bookmark' ? r.url : Notes.stripHtml(r.content).substring(0, 80) + '...')}</small>
                        </div>
                        <button class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 2px 6px; margin: 0;" onclick="App.closeModal(); ${r.type === 'bookmark' ? `window.open('${r.url}', '_blank');` : `App.afterNavigate('notes', () => Notes.openEditor('${r.id}'));`}">Abrir</button>
                    </div>
                `).join('');
            }
        } catch (err) {
            if (resultsContainer) resultsContainer.innerHTML = `<p style="color: var(--color-danger); text-align: center; margin: 20px 0;">Erro: ${err.message}</p>`;
        }
    },
    renderPdfReaderPage(container) {
        if (!container) return;
        
        if (this.pdfFileUrl) {
            container.innerHTML = `
                <div class="pdf-viewer-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #0b0f19;">
                    <div class="pdf-viewer-toolbar" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <span style="font-size: 0.9rem; font-weight: 500; color: #cbd5e1;">📄 PDF Ativo</span>
                        <button class="btn btn-sm btn-secondary" onclick="App.clearPdfReader()" style="padding: 4px 10px;">Fechar PDF</button>
                    </div>
                    <div style="flex: 1; overflow: hidden; position: relative;">
                        <embed src="${this.pdfFileUrl}" type="application/pdf" style="width: 100%; height: 100%; border: none;">
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="pdf-drop-zone" id="pdf-drop-zone" style="width: 100%; height: 100%; min-height: 350px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 16px; border: 2px dashed rgba(124, 77, 255, 0.3); border-radius: 8px; margin: 0; padding: 40px; background: rgba(124, 77, 255, 0.02); text-align: center; cursor: pointer; transition: all 0.3s;" onclick="document.getElementById('pdf-file-picker').click()">
                    <span style="font-size: 3rem; filter: drop-shadow(0 0 10px rgba(124, 77, 255, 0.4));">📄</span>
                    <h3 style="margin: 0; font-size: 1.2rem; color: #fff;">Arraste um arquivo PDF aqui</h3>
                    <p style="margin: 0; font-size: 0.9rem; color: #cbd5e1;">ou clique para navegar nos seus arquivos locais</p>
                    <input type="file" id="pdf-file-picker" accept="application/pdf" style="display: none;" onchange="App.loadPdfReaderFile(this.files[0])">
                </div>
            `;
            
            // Setup local drag & drop listeners for this zone
            const zone = container.querySelector('#pdf-drop-zone');
            if (zone) {
                ['dragenter', 'dragover'].forEach(name => {
                    zone.addEventListener(name, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        zone.style.borderColor = 'var(--accent, #7C4DFF)';
                        zone.style.background = 'rgba(124, 77, 255, 0.06)';
                    });
                });
                ['dragleave', 'drop'].forEach(name => {
                    zone.addEventListener(name, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        zone.style.borderColor = 'rgba(124, 77, 255, 0.3)';
                        zone.style.background = 'rgba(124, 77, 255, 0.02)';
                    });
                });
                zone.addEventListener('drop', (e) => {
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        App.loadPdfReaderFile(files[0]);
                    }
                });
            }
        }
    },
    
    loadPdfReaderFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            return this.toast('Por favor, selecione um arquivo PDF válido.', 'error');
        }
        
        // Revoke old URL if it exists
        if (this.pdfFileUrl) {
            URL.revokeObjectURL(this.pdfFileUrl);
        }
        
        this.pdfFileUrl = URL.createObjectURL(file);
        
        // If split screen is NOT enabled, enable it automatically!
        if (!this.splitEnabled) {
            this.splitEnabled = true;
            this.leftPage = 'pdf-reader';
            this.rightPage = 'notes';
            localStorage.setItem('booklist_split_enabled', '1');
            
            const btn = document.getElementById('nav-split');
            if (btn) btn.classList.add('active');
            
            this.renderSplitPanels();
        } else {
            // If already in split view, set left panel or focused panel to pdf-reader
            const targetPanel = this.focusedPanel || 'left';
            if (targetPanel === 'left') {
                this.leftPage = 'pdf-reader';
            } else {
                this.rightPage = 'pdf-reader';
            }
            this.renderSplitPanels();
        }
        
        this.toast(`Carregado: ${file.name}`, 'success');
    },
    
    clearPdfReader() {
        if (this.pdfFileUrl) {
            URL.revokeObjectURL(this.pdfFileUrl);
            this.pdfFileUrl = null;
        }
        this.renderSplitPanels();
    }
};
document.addEventListener('DOMContentLoaded',()=>App.init());
