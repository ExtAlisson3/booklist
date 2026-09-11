// ============================================
// FEATURE HUB - advanced workflows
// ============================================
const FeatureHub = {
    currentTab: 'overview',
    currentGroup: 'daily',
    currentCollectionId: null,
    timelineFilter: 'all',
    searchQuery: '',
    _rulesReady: false,
    _applyingRules: false,

    get NAV_GROUPS() {
        return [
            ['daily', 'Visão Geral'],
            ['organize', 'Organizar'],
            ['views', 'Visualizar'],
            ['suite', 'Suíte Pessoal'],
            ['secure', 'Privado'],
            ['tools', 'Ferramentas']
        ];
    },

    get NAV_TABS() {
        return {
            daily: [['today','Hoje'], ['stats','Stats'], ['calendar','Calendario'], ['timeline','Timeline']],
            organize: [['inbox','Capturas'], ['duplicates','Duplicatas']],
            views: [['semantic','Busca semantica'], ['toc','TOC']],
            suite: [['cockpit','Cockpit'], ['share','Compartilhar'], ['editorplus','Editor+'], ['checklists','Checklists'], ['automations','Automacoes'], ['documents','Documentos'], ['privacyplus','Privacidade+']],
            secure: [['search','Busca'], ['export','Export Seguro']],
            tools: [['cleanup','Limpeza'], ['suggestions','Sugestoes'], ['import','Importar Dados'], ['exportplus','Export+'], ['sync','Sincronizacao'], ['snapshots','Snapshots'], ['shortcuts','Atalhos'], ['archive','Arquivo Morto'], ['attachments','Anexos'], ['versions','Versoes'], ['timetravel','Máquina do Tempo']]
        };
    },

    get TAB_CATALOG() {
        return {
            today: { label: 'Hoje', desc: 'Agenda, notas editadas e links salvos na data de hoje.', icon: '📝', color: '#00BFA5', glow: 'rgba(0, 191, 165, 0.4)', metric: () => { const todayStr = new Date().toDateString(); const todaysCount = Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() }).filter(b => new Date(b.createdAt || b.updatedAt).toDateString() === todayStr).length + Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).filter(n => new Date(n.updatedAt || n.createdAt).toDateString() === todayStr).length; return todaysCount + " itens hoje"; } },
            stats: { label: 'Stats', desc: 'Análise estatística completa e progresso de leitura.', icon: '📈', color: '#FF9100', glow: 'rgba(255, 145, 0, 0.4)', metric: () => { const total = Storage.getBookmarks().length + Storage.getNotes().length; return total + " itens salvos"; } },
            calendar: { label: 'Calendário', desc: 'Planejamento e controle de prazos de leitura.', icon: '📆', color: '#FF3D00', glow: 'rgba(255, 61, 0, 0.4)', metric: () => "Agenda active" },
            timeline: { label: 'Timeline', desc: 'Explore o histórico cronológico de suas adições.', icon: '⏳', color: '#7C4DFF', glow: 'rgba(124, 77, 255, 0.4)', metric: () => "Linha do tempo" },
            inbox: { label: 'Capturas', desc: 'Organize notas e links rápidos capturados pendentes.', icon: '📥', color: '#FF1744', glow: 'rgba(255, 23, 68, 0.4)', metric: () => { const count = Storage.getBookmarks().filter(b => b.inbox).length + Storage.getNotes().filter(n => n.inbox).length; return count + " pendentes"; } },
            duplicates: { label: 'Duplicatas', desc: 'Detecte e limpe links duplicados ou notas muito similares.', icon: '👥', color: '#CFD8DC', glow: 'rgba(207, 216, 220, 0.4)', metric: () => "Limpeza rápida" },
            semantic: { label: 'Busca Semântica', desc: 'Busque conceitos por similaridade de conteúdo.', icon: '🔍', color: '#FF9100', glow: 'rgba(255, 145, 0, 0.4)', metric: () => "Busca inteligente" },
            toc: { label: 'Sumário', desc: 'Visualize o sumário e estrutura das suas notas longas.', icon: '📖', color: '#E040FB', glow: 'rgba(224, 64, 251, 0.4)', metric: () => "Sumário ativo" },
            cockpit: { label: 'Cockpit', desc: 'Painel executivo com metas urgentes e próximos passos.', icon: '🎛️', color: '#7C4DFF', glow: 'rgba(124, 77, 255, 0.4)', metric: () => { const inboxCount = Storage.getBookmarks().filter(b => b.inbox).length + Storage.getNotes().filter(n => n.inbox).length; return inboxCount + " pendentes"; } },
            share: { label: 'Compartilhar', desc: 'Gere links públicos ou exporte conteúdos formatados.', icon: '📤', color: '#00BFA5', glow: 'rgba(0, 191, 165, 0.4)', metric: () => "Exportador" },
            editorplus: { label: 'Editor+', desc: 'Crie blocos estruturados: Callout, Tabelas, Códigos.', icon: '📝', color: '#FF1744', glow: 'rgba(255, 23, 68, 0.4)', metric: () => "Avançado" },
            checklists: { label: 'Checklists', desc: 'Listas de verificação dinâmicas e reutilizáveis.', icon: '☑️', color: '#00E676', glow: 'rgba(0, 230, 118, 0.4)', metric: () => "Checklists" },
            automations: { label: 'Automações', desc: 'Crie gatilhos e regras locais automáticas.', icon: '🔄', color: '#00E5FF', glow: 'rgba(0, 229, 255, 0.4)', metric: () => { const rulesCount = Storage.getRules().length; return rulesCount + " regras"; } },
            documents: { label: 'Documentos', desc: 'Anexe arquivos e gerencie documentos grandes.', icon: '📄', color: '#FF9100', glow: 'rgba(255, 145, 0, 0.4)', metric: () => { const docsCount = Storage.getDocuments().length; return docsCount + " arquivos"; } },
            privacyplus: { label: 'Privacidade+', desc: 'Controle de visibilidade e níveis avançados de cofre.', icon: '🛡️', color: '#7C4DFF', glow: 'rgba(124, 77, 255, 0.4)', metric: () => "Protegido" },
            vault: { label: 'Cofre', desc: 'Cofre local seguro protegido por senha e 2FA local.', icon: '🔒', color: '#FF1744', glow: 'rgba(255, 23, 68, 0.4)', metric: () => { return Storage.isVaultUnlocked() ? "Desbloqueado" : "Bloqueado"; } },
            search: { label: 'Busca', desc: 'Pesquisa segura dentro dos itens do cofre.', icon: '🔍', color: '#00E5FF', glow: 'rgba(0, 229, 255, 0.4)', metric: () => "Criptografado" },
            export: { label: 'Export Seguro', desc: 'Exportação criptografada da sua base com senha.', icon: '💾', color: '#00E676', glow: 'rgba(0, 230, 118, 0.4)', metric: () => "Exportador" },
            cleanup: { label: 'Limpeza', desc: 'Análise profunda de base: duplicados, vazios e sem tags.', icon: '🧼', color: '#CFD8DC', glow: 'rgba(207, 216, 220, 0.4)', metric: () => "Limpeza" },
            suggestions: { label: 'Sugestões', desc: 'Organização e melhorias inteligentes automáticas.', icon: '💡', color: '#FFC400', glow: 'rgba(255, 196, 0, 0.4)', metric: () => "Recomendações" },
            import: { label: 'Importar Dados', desc: 'Importe favoritos ou dados do Evernote, Notion e Keep.', icon: '📥', color: '#00E5FF', glow: 'rgba(0, 229, 255, 0.4)', metric: () => "Importador" },
            exportplus: { label: 'Export+', desc: 'Formate exportações de relatórios em PDF ou CSV.', icon: '📄', color: '#2979FF', glow: 'rgba(41, 121, 255, 0.4)', metric: () => "Exportador" },
            sync: { label: 'Sincronização', desc: 'Sincronização local-first com nuvem e histórico recente.', icon: '🔄', color: '#00BFA5', glow: 'rgba(0, 191, 165, 0.4)', metric: () => 'Sincronização' },
            snapshots: { label: 'Snapshots', desc: 'Gerencie snapshots automáticos da base local.', icon: '📷', color: '#FF1744', glow: 'rgba(255, 23, 68, 0.4)', metric: () => { const snapCount = Storage.getAutoBackups().length; return snapCount + " snapshots"; } },
            shortcuts: { label: 'Atalhos', desc: 'Cheatsheet visual de atalhos e dicas offline PWA.', icon: '⌨️', color: '#00E676', glow: 'rgba(0, 230, 118, 0.4)', metric: () => "Atalhos" },
            archive: { label: 'Arquivo Morto', desc: 'Gerencie notas e bookmarks arquivados da rotina.', icon: '🗄️', color: '#CFD8DC', glow: 'rgba(207, 216, 220, 0.4)', metric: () => { const archBks = Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() }).filter(b => b.readingStatus === 'arquivado' || b.archived).length; const archNotes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).filter(n => n.status === 'arquivado' || n.archived).length; return (archBks + archNotes) + " arquivados"; } },
            attachments: { label: 'Anexos', desc: 'Gerencie todos os anexos locais do app.', icon: '📎', color: '#00E5FF', glow: 'rgba(0, 229, 255, 0.4)', metric: () => { const attsCount = Storage.getAttachments().length; return attsCount + " anexos"; } },
            versions: { label: 'Versões', desc: 'Histórico de versões automáticas salvas de notas.', icon: '🕒', color: '#E040FB', glow: 'rgba(224, 64, 251, 0.4)', metric: () => "Versões" },
            timetravel: { label: 'Máquina do Tempo', desc: 'Explore sua base de conhecimento e finanças em qualquer ponto do passado.', icon: '⏳', color: '#E040FB', glow: 'rgba(224, 64, 251, 0.4)', metric: () => window.TimeTravelDate ? `Viagem Ativa: ${window.TimeTravelDate.toLocaleDateString('sv-SE')}` : 'Presente' }
        };
    },

    get TOOL_RENDERERS() {
        return {
            today: this.renderToday, calendar: this.renderCalendar, timeline: this.renderTimeline,
            stats: this.renderSmartStats, inbox: this.renderInbox, duplicates: this.renderDuplicates,
            toc: this.renderToc, semantic: this.renderSemanticSearch, cleanup: this.renderCleanup,
            suggestions: this.renderSuggestions, cockpit: this.renderCockpit, share: this.renderShareCenter,
            editorplus: this.renderEditorPlus, checklists: this.renderChecklists, automations: this.renderAutomations,
            documents: this.renderDocuments, privacyplus: this.renderPrivacyPlus, import: this.renderImport,
            exportplus: this.renderPrettyExport, sync: this.renderSync, snapshots: this.renderSnapshots,
            shortcuts: this.renderShortcuts, archive: this.renderArchive, attachments: this.renderAttachments,
            versions: this.renderVersions, export: this.renderSecureExport, vault: this.renderVault,
            search: this.renderAdvancedSearch, timetravel: this.renderTimeTravel
        };
    },

    render(main) {
        this.currentGroup = this.groupForTab(this.currentTab);
        const currentTabs = this.tabsForGroup(this.currentGroup);
        if (this.currentTab !== 'overview' && !currentTabs.some(([id]) => id === this.currentTab)) {
            this.currentTab = 'overview';
        }
        main.innerHTML = `
        <div class="feature-page">
            <div class="feature-header power-hub-header">
                <div class="power-hub-heading"><h2>&#9889; Power Hub</h2><p>Ferramentas avançadas organizadas por fluxo.</p></div>
                <div class="power-hub-actions">
                    <label class="power-search" aria-label="Buscar ferramenta no Power Hub">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" value="${App.escapeHtml(this.searchQuery)}" placeholder="Buscar ferramenta..." oninput="FeatureHub.setSearch(this.value)" autocomplete="off">
                        <kbd>Ctrl K</kbd>
                    </label>
                    <button class="btn btn-secondary power-sync-btn" onclick="Storage.scheduleSync(100);App.toast('Sync agendado.', 'info')">↻ <span>Forçar Sync</span></button>
                </div>
            </div>
            <div class="feature-nav-shell">
                <div class="feature-group-tabs" role="tablist" aria-label="Categorias do Power Hub">
                    ${this.NAV_GROUPS.map(([id,label]) => `<button role="tab" aria-selected="${this.currentGroup===id}" class="feature-group-btn ${this.currentGroup===id?'active':''}" onclick="FeatureHub.setGroup('${id}')"><span>${label}</span><small>${this.tabsForGroup(id).length}</small></button>`).join('')}
                </div>
            </div>
            <div id="feature-content"></div>
        </div>`;
        this.renderTab();
    },

    groupForTab(tab) {
        if (tab === 'overview') return this.currentGroup || 'daily';
        for (const [group, tabs] of Object.entries(this.NAV_TABS)) {
            if (tabs.filter(([id]) => this.moduleAllowsTab(id)).some(([id]) => id === tab)) return group;
        }
        return 'daily';
    },

    moduleAllowsTab(tab) {
        const modules = Storage.getModules ? Storage.getModules() : {};
        const moduleKey = {
            automations: 'automations', documents: 'documents',
            privacyplus: 'privacy', vault: 'privacy', search: 'privacy', export: 'privacy'
        }[tab];
        return !moduleKey || modules[moduleKey] !== false;
    },

    tabsForGroup(group) {
        return (this.NAV_TABS[group] || []).filter(([id]) => this.moduleAllowsTab(id));
    },

    setGroup(group) {
        this.currentGroup = group;
        this.currentTab = 'overview';
        this.searchQuery = '';
        App.renderPage('power');
    },

    setTab(tab) {
        if (tab !== 'overview') this.rememberRecent(tab);
        this.currentTab = tab;
        App.renderPage('power');
    },

    setSearch(query) {
        this.searchQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');
        const el = document.getElementById('feature-content');
        if (el && this.currentTab === 'overview') this.renderPortalGrid(el);
    },

    getFavorites() {
        try { return JSON.parse(localStorage.getItem('booklist_power_favorites') || '[]'); }
        catch (_) { return []; }
    },

    toggleFavorite(tab, event) {
        if (event) event.stopPropagation();
        const favorites = this.getFavorites();
        const next = favorites.includes(tab) ? favorites.filter(id => id !== tab) : [tab, ...favorites].slice(0, 8);
        localStorage.setItem('booklist_power_favorites', JSON.stringify(next));
        const el = document.getElementById('feature-content');
        if (el) this.renderPortalGrid(el);
    },

    rememberRecent(tab) {
        try {
            const recent = JSON.parse(localStorage.getItem('booklist_power_recent') || '[]');
            localStorage.setItem('booklist_power_recent', JSON.stringify([tab, ...recent.filter(id => id !== tab)].slice(0, 5)));
        } catch (_) {}
    },

    getRecent() {
        try { return JSON.parse(localStorage.getItem('booklist_power_recent') || '[]'); }
        catch (_) { return []; }
    },

    renderTab() {
        const el = document.getElementById('feature-content');
        if (!el) return;

        if (this.currentTab === 'overview') {
            this.renderPortalGrid(el);
            return;
        }

        const groupLabel = this.NAV_GROUPS.find(([id]) => id === this.currentGroup)?.[1] || '';
        const tabInfo = this.TAB_CATALOG[this.currentTab];
        const tabLabel = tabInfo?.label || '';
        const currentTabs = this.tabsForGroup(this.currentGroup);

        el.innerHTML = `
        <div class="power-breadcrumb-nav">
            <div class="power-breadcrumb-nav-left">
                <button class="breadcrumb-back-btn" onclick="FeatureHub.setTab('overview')">
                    ← Voltar ao Painel
                </button>
                <div class="breadcrumb-path">
                    ⚡ Power Hub 
                    <span class="divider">/</span> 
                    ${groupLabel} 
                    <span class="divider">/</span> 
                    <span class="active-tab">${tabLabel}</span>
                </div>
            </div>
            <div class="power-breadcrumb-nav-right">
                ${currentTabs.map(([id,label]) => `
                    <button class="power-quick-pill ${this.currentTab===id?'active':''}" onclick="FeatureHub.setTab('${id}')">
                        ${label}
                    </button>
                `).join('')}
            </div>
        </div>
        <div id="tool-active-content"></div>`;

        const toolEl = document.getElementById('tool-active-content');
        const renderer = this.TOOL_RENDERERS[this.currentTab] || this.TOOL_RENDERERS.today;
        renderer.call(this, toolEl);
    },

    renderPortalGrid(el) {
        const allTabs = Object.keys(this.NAV_TABS).flatMap(group => this.tabsForGroup(group));
        const currentTabs = this.searchQuery
            ? allTabs.filter(([id, label]) => {
                const info = this.TAB_CATALOG[id];
                return `${label} ${info?.desc || ''}`.toLocaleLowerCase('pt-BR').includes(this.searchQuery);
            })
            : this.tabsForGroup(this.currentGroup);
        const favorites = this.getFavorites().filter(id => this.TAB_CATALOG[id] && allTabs.some(([tab]) => tab === id));
        const recent = this.getRecent().filter(id => this.TAB_CATALOG[id] && !favorites.includes(id));
        const quickItems = [...favorites.map(id => [id, 'Favorito']), ...recent.slice(0, 4).map(id => [id, 'Recente'])];
        const groupLabel = this.NAV_GROUPS.find(([id]) => id === this.currentGroup)?.[1] || 'Ferramentas';
        el.innerHTML = `
        ${quickItems.length ? `<section class="power-quick-access" aria-label="Acesso rápido">
            <div class="power-section-heading"><div><h3>Acesso rápido</h3><p>Favoritos e ferramentas usadas recentemente.</p></div></div>
            <div class="power-quick-list">${quickItems.map(([id, kind]) => {
                const info = this.TAB_CATALOG[id];
                return `<button class="power-quick-item" onclick="FeatureHub.setTab('${id}')"><span class="power-quick-icon" style="--portal-accent:${info.color}">${info.icon}</span><span><strong>${info.label}</strong><small>${kind}</small></span><span class="power-quick-arrow">→</span></button>`;
            }).join('')}</div>
        </section>` : ''}
        <div class="power-section-heading">
            <div><h3>${this.searchQuery ? 'Resultados da busca' : groupLabel}</h3><p>${this.searchQuery ? `${currentTabs.length} ferramenta(s) encontrada(s)` : `${currentTabs.length} ferramentas disponíveis nesta categoria.`}</p></div>
            ${this.searchQuery ? `<button class="btn btn-sm btn-secondary" onclick="FeatureHub.searchQuery='';App.renderPage('power')">Limpar busca</button>` : ''}
        </div>
        <div class="power-portal-grid">
            ${currentTabs.length ? currentTabs.map(([id]) => {
                const info = this.TAB_CATALOG[id];
                if (!info) return '';
                const metricVal = typeof info.metric === 'function' ? info.metric() : info.metric;
                return `
                <article class="power-portal-card" style="--portal-accent: ${info.color}; --portal-accent-glow: ${info.glow};" onclick="FeatureHub.setTab('${id}')" tabindex="0" onkeydown="if(event.key==='Enter')FeatureHub.setTab('${id}')">
                    <div class="power-portal-card-header">
                        <div class="power-portal-icon">${info.icon}</div>
                        <div><h3>${info.label}</h3><span class="power-portal-group">${this.NAV_GROUPS.find(([group]) => (this.NAV_TABS[group] || []).some(([tab]) => tab === id))?.[1] || ''}</span></div>
                        <button class="power-favorite-btn ${favorites.includes(id) ? 'active' : ''}" onclick="FeatureHub.toggleFavorite('${id}', event)" aria-label="${favorites.includes(id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" title="${favorites.includes(id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${favorites.includes(id) ? '★' : '☆'}</button>
                    </div>
                    <p>${info.desc}</p>
                    <div class="power-portal-footer">
                        <span class="power-portal-badge">${metricVal}</span>
                        <button class="power-portal-btn" tabindex="-1">Abrir <span>→</span></button>
                    </div>
                </article>`;
            }).join('') : `<div class="power-empty-state"><span>⌕</span><h3>Nenhuma ferramenta encontrada</h3><p>Tente outro termo ou navegue pelas categorias acima.</p><button class="btn btn-secondary" onclick="FeatureHub.searchQuery='';App.renderPage('power')">Mostrar todas</button></div>`}
        </div>`;
    },

    initAutomationEngine() {
        if (this._rulesReady) return;
        this._rulesReady = true;
        Events.on('storage:event', event => this.applyRulesForEvent(event));
    },

    renderToday(el) {
        const today = new Date().toDateString();
        const bks = Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() });
        const notes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() });
        const todaysBks = bks.filter(b => new Date(b.createdAt || b.updatedAt).toDateString() === today);
        const todaysNotes = notes.filter(n => new Date(n.updatedAt || n.createdAt).toDateString() === today);
        const pending = bks.filter(b => b.smartEnabled && ['novo','lendo'].includes(b.readingStatus || 'novo'));
        el.innerHTML = `
        <div class="feature-grid">
            <div class="feature-card"><h3>Hoje</h3><p>${todaysNotes.length} notas editadas · ${todaysBks.length} links salvos</p></div>
            <div class="feature-card"><h3>Leitura depois</h3><p>${pending.length} link(s) em aberto</p></div>
            <div class="feature-card"><h3>Privados</h3><p>${notes.filter(n=>n.isPrivate).length + bks.filter(b=>b.isPrivate).length} item(s) no cofre</p></div>
        </div>
        <div class="feature-card"><h3>Atividade recente</h3>${[...todaysNotes.map(n=>`&#128221; ${App.escapeHtml(n.title)}`), ...todaysBks.map(b=>`&#128278; ${App.escapeHtml(b.title)}`)].slice(0,12).map(x=>`<div class="feature-row">${x}</div>`).join('') || '<p class="text-muted">Nada hoje ainda.</p>'}</div>`;
    },

    renderInbox(el) {
        const bks = Storage.getBookmarks().filter(b => b.inbox);
        const notes = Storage.getNotes().filter(n => n.inbox);
        el.innerHTML = `
        <div class="feature-card">
            <h3>Captura rápida</h3>
            <div class="form-row"><input id="inbox-title" placeholder="Título"><input id="inbox-url" placeholder="URL opcional"></div>
            <textarea id="inbox-text" rows="3" placeholder="Nota rápida ou descrição"></textarea>
            <div class="settings-actions"><button class="btn btn-primary" onclick="FeatureHub.addInbox()">Salvar como captura</button></div>
        </div>
        <div class="feature-card"><h3>Capturas a organizar</h3><p>Links e notas salvos rapidamente, importados ou enviados para revisao antes de irem para uma pasta, tag ou status definitivo.</p>
            ${[...notes.map(n=>({type:'note',item:n})), ...bks.map(b=>({type:'bookmark',item:b}))].map(({type,item}) => `
                <div class="feature-row"><span>${type==='note'?'📝':'🔖'} ${App.escapeHtml(item.title)}</span><button class="btn btn-sm btn-secondary" onclick="FeatureHub.processInbox('${type}','${item.id}')">Processado</button></div>
            `).join('') || '<p class="text-muted">Nenhuma captura pendente.</p>'}
        </div>`;
    },

    addInbox() {
        const title = document.getElementById('inbox-title').value.trim() || 'Captura rápida';
        const url = document.getElementById('inbox-url').value.trim();
        const text = document.getElementById('inbox-text').value.trim();
        if (url) Storage.addBookmark({ title, url, description: text, folderId: 'default', inbox: true, readingStatus: 'novo' });
        else Storage.addNote({ title, content: `<p>${App.escapeHtml(text)}</p>`, folderId: 'default', inbox: true, status: 'ideias' });
        App.toast('Salvo como captura.', 'success');
        App.renderPage('power');
    },

    processInbox(type, id) {
        if (type === 'note') Storage.updateNote(id, { inbox: false });
        else Storage.updateBookmark(id, { inbox: false });
        App.renderPage('power');
    },

    renderVault(el) {
        const vault = Storage.getVaultSettings();
        const unlocked = Storage.isVaultUnlocked();
        const bks = Storage.getBookmarks({ includePrivate: true });
        const notes = Storage.getNotes({ includePrivate: true });
        const privateItems = [...notes.filter(n=>n.isPrivate).map(n=>['note',n]), ...bks.filter(b=>b.isPrivate).map(b=>['bookmark',b])];
        
        el.innerHTML = `
        <div class="mui-vault-container">
            <style>
                .mui-vault-hero {
                    background: radial-gradient(circle at top left, rgba(255, 23, 68, 0.08), transparent 60%);
                    border: 1px solid rgba(255, 23, 68, 0.15);
                    border-radius: 16px;
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    margin-bottom: 24px;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 0 12px rgba(255, 23, 68, 0.03);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mui-vault-hero.unlocked {
                    background: radial-gradient(circle at top left, rgba(0, 191, 165, 0.08), transparent 60%);
                    border-color: rgba(0, 191, 165, 0.15);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 0 12px rgba(0, 191, 165, 0.03);
                }
                .mui-vault-icon-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: rgba(255, 23, 68, 0.06);
                    border: 1.5px dashed rgba(255, 23, 68, 0.25);
                    color: #FF1744;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                }
                .unlocked .mui-vault-icon-container {
                    background: rgba(0, 191, 165, 0.06);
                    border-color: rgba(0, 191, 165, 0.25);
                    color: #00BFA5;
                }
                .mui-vault-lock-svg {
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .locked .mui-vault-lock-svg {
                    animation: muiVaultPulse 3s infinite ease-in-out;
                }
                .unlocked .mui-vault-lock-svg {
                    filter: drop-shadow(0 0 6px rgba(0, 191, 165, 0.4));
                }
                @keyframes muiVaultPulse {
                    0% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255, 23, 68, 0.15)); }
                    50% { transform: scale(1.05); filter: drop-shadow(0 0 8px rgba(255, 23, 68, 0.4)); }
                    100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255, 23, 68, 0.15)); }
                }
                .mui-vault-hero-content {
                    flex: 1;
                }
                .mui-vault-hero-content h3 {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0 0 6px 0;
                    color: #FFF;
                }
                .unlocked .mui-vault-hero-content h3 {
                    color: #00BFA5;
                }
                .mui-vault-hero-content p {
                    margin: 0;
                    color: rgba(255,255,255,0.7);
                    font-size: 13.5px;
                    line-height: 1.4;
                }
                
                /* Form Controls */
                .mui-vault-input-group {
                    display: flex;
                    gap: 12px;
                    margin-top: 18px;
                    flex-wrap: wrap;
                    width: 100%;
                }
                .mui-vault-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    flex: 1;
                    min-width: 240px;
                }
                .mui-vault-input-wrapper input {
                    width: 100%;
                    padding: 10px 40px 10px 14px !important;
                    background: rgba(20, 20, 30, 0.5) !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    border-radius: 8px !important;
                    color: #FFF !important;
                    font-size: 13.5px !important;
                    transition: all 0.3s ease;
                }
                .mui-vault-input-wrapper input:focus {
                    border-color: var(--accent) !important;
                    box-shadow: 0 0 10px var(--accent-glow) !important;
                    background: rgba(20, 20, 30, 0.7) !important;
                }
                .mui-vault-eye-btn {
                    position: absolute;
                    right: 12px;
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    transition: color 0.3s;
                }
                .mui-vault-eye-btn:hover {
                    color: var(--accent);
                }
                
                /* Panel Grid */
                .mui-vault-panel-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 24px;
                }
                .mui-vault-card {
                    background: rgba(30, 30, 45, 0.3);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 18px;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                }
                .mui-vault-card:hover {
                    border-color: rgba(255,255,255,0.09);
                }
                .mui-vault-card h4 {
                    margin: 0 0 8px 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: #FFF;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .mui-vault-card p {
                    margin: 0 0 14px 0;
                    font-size: 12.5px;
                    color: rgba(255,255,255,0.5);
                    line-height: 1.4;
                }
                .mui-vault-card .form-row {
                    display: flex;
                    gap: 8px;
                    width: 100%;
                }
                .mui-vault-card select, .mui-vault-card input {
                    flex: 1;
                    padding: 8px 12px !important;
                    background: rgba(20, 20, 30, 0.4) !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    border-radius: 6px !important;
                    color: #FFF !important;
                    font-size: 13px !important;
                }
                
                /* Items Section */
                .mui-vault-items-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 28px 0 16px 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .mui-vault-items-header h3 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 700;
                    color: #FFF;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .mui-vault-badge-count {
                    font-size: 11px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-weight: 600;
                    background: rgba(255, 23, 68, 0.1);
                    color: #FF1744;
                    border: 1px solid rgba(255, 23, 68, 0.15);
                }
                .unlocked .mui-vault-badge-count {
                    background: rgba(0, 191, 165, 0.1);
                    color: #00BFA5;
                    border-color: rgba(0, 191, 165, 0.15);
                }
                .mui-vault-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }
                .mui-vault-item-card {
                    background: rgba(20, 20, 30, 0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 10px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 110px;
                    transition: all 0.3s ease;
                    position: relative;
                }
                .mui-vault-item-card:hover {
                    border-color: var(--accent);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 8px var(--accent-glow);
                    transform: translateY(-1px);
                }
                .mui-vault-item-card.locked-item {
                    background: linear-gradient(135deg, rgba(20, 20, 30, 0.4), rgba(30, 15, 20, 0.25));
                    border-color: rgba(255, 23, 68, 0.05);
                }
                .mui-vault-item-card.locked-item:hover {
                    border-color: rgba(255, 23, 68, 0.25);
                    box-shadow: 0 4px 12px rgba(255, 23, 68, 0.1);
                }
                .mui-vault-item-top {
                    margin-bottom: 12px;
                }
                .mui-vault-item-type {
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 700;
                    margin-bottom: 4px;
                    color: rgba(255,255,255,0.35);
                }
                .unlocked .mui-vault-item-type {
                    color: var(--accent);
                }
                .mui-vault-item-title {
                    font-weight: 600;
                    font-size: 13.5px;
                    margin: 0 0 4px 0;
                    color: #FFF;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .mui-vault-item-desc {
                    font-size: 12px;
                    color: rgba(255,255,255,0.45);
                    margin: 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.4;
                }
                .mui-vault-item-actions {
                    display: flex;
                    gap: 8px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255,255,255,0.04);
                }
                .mui-vault-item-actions button {
                    flex: 1;
                    padding: 4px 8px !important;
                    font-size: 11.5px !important;
                    height: 28px !important;
                }
            </style>

            <!-- Hero Header Status Card -->
            <div class="mui-vault-hero ${unlocked ? 'unlocked' : ''}">
                <div class="mui-vault-icon-container">
                    ${unlocked ? `
                        <svg class="mui-vault-lock-svg unlocked" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                            <circle cx="12" cy="16" r="1.5"></circle>
                        </svg>
                    ` : `
                        <svg class="mui-vault-lock-svg locked" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            <circle cx="12" cy="16" r="1.5"></circle>
                        </svg>
                    `}
                </div>
                <div class="mui-vault-hero-content">
                    <h3>${vault.enabled ? (unlocked ? 'Cofre Desbloqueado' : 'Cofre Privado Bloqueado') : 'Configurar Novo Cofre'}</h3>
                    <p>${vault.enabled ? (unlocked ? 'Acesso liberado à RAM. Itens privados aparecem nas listagens comuns e na galeria abaixo.' : 'Dados protegidos por AES-GCM-256 e sincronizados na nuvem. Desbloqueie para ler.') : 'Defina uma senha mestre para começar a ocultar notas e bookmarks confidenciais.'}</p>
                    
                    <div class="mui-vault-input-group">
                        ${!unlocked ? `
                            <div class="mui-vault-input-wrapper">
                                <input id="vault-password" type="password" placeholder="Senha do cofre">
                                <button type="button" class="mui-vault-eye-btn" onclick="const p = document.getElementById('vault-password'); p.type = p.type === 'password' ? 'text' : 'password'; this.innerText = p.type === 'password' ? '👁️' : '🔒';">👁️</button>
                            </div>
                            ${vault.totpEnabled ? `
                                <div style="width: 120px;">
                                    <input id="vault-2fa" class="form-control" inputmode="numeric" maxlength="6" placeholder="PIN 2FA" style="padding: 10px 12px !important; background: rgba(20,20,30,0.5) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 8px !important; color:#FFF !important; text-align:center;">
                                </div>
                            ` : ''}
                            <button class="btn btn-primary" onclick="FeatureHub.unlockOrSetupVault()">${vault.enabled ? 'Desbloquear' : 'Criar Cofre'}</button>
                        ` : `
                            <button class="btn btn-secondary" onclick="Storage.lockVault();App.renderPage('power')">Trancar Cofre</button>
                        `}
                    </div>
                </div>
            </div>

            <!-- Operations cards (Visible when configured and unlocked) -->
            ${unlocked ? `
                <div class="mui-vault-panel-grid">
                    <!-- Send items to vault -->
                    <div class="mui-vault-card">
                        <h4>🔒 Enviar para o Cofre</h4>
                        <p>Selecione um item comum para criptografá-lo e movê-lo ao cofre privado.</p>
                        <div class="form-row">
                            <select id="vault-item">
                                ${notes.filter(n=>!n.isPrivate).map(n=>`<option value="note:${n.id}">Nota: ${App.escapeHtml(n.title)}</option>`).join('')}
                                ${bks.filter(b=>!b.isPrivate).map(b=>`<option value="bookmark:${b.id}">Link: ${App.escapeHtml(b.title)}</option>`).join('')}
                            </select>
                            <button class="btn btn-primary" onclick="FeatureHub.makePrivate()" style="flex:0 0 80px;">Privar</button>
                        </div>
                    </div>

                    <!-- 2FA & Security Config -->
                    <div class="mui-vault-card">
                        <h4>🛡️ PIN de 2FA local</h4>
                        <p>PIN numérico de 6 dígitos que atua como fator duplo local. ${vault.totpEnabled ? '<strong style="color:#00BFA5;">Ativo</strong>' : 'Desativado'}.</p>
                        <div class="form-row">
                            ${vault.totpEnabled ? `
                                <button class="btn btn-secondary" onclick="Storage.disableVault2fa();App.renderPage('power')">Desativar PIN</button>
                            ` : `
                                <input id="vault-2fa-setup" inputmode="numeric" maxlength="6" placeholder="Novo PIN 2FA (6 dígitos)">
                                <button class="btn btn-primary" onclick="FeatureHub.enableVault2fa()" style="flex:0 0 90px;">Ativar PIN</button>
                            `}
                        </div>
                    </div>

                    <!-- Auto-lock Config -->
                    <div class="mui-vault-card">
                        <h4>⏳ Auto-bloqueio</h4>
                        <p>Tempo de inatividade em minutos antes do cofre se trancar sozinho.</p>
                        <div class="form-row">
                            <input id="vault-minutes" type="number" min="1" max="1440" value="${vault.autoLockMinutes || 10}">
                            <button class="btn btn-primary" onclick="FeatureHub.saveVaultTimeout()" style="flex:0 0 90px;">Salvar</button>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Private items directory -->
            <div class="mui-vault-items-header ${unlocked ? 'unlocked' : ''}">
                <h3>📂 Arquivos Criptografados <span class="mui-vault-badge-count ${unlocked ? 'unlocked' : ''}">${privateItems.length} item(ns)</span></h3>
            </div>

            <div class="mui-vault-grid ${unlocked ? 'unlocked' : ''}">
                ${privateItems.map(([type,item]) => {
                    const isNote = type === 'note';
                    return `
                        <div class="mui-vault-item-card ${!unlocked ? 'locked-item' : ''}">
                            <div class="mui-vault-item-top">
                                <div class="mui-vault-item-type">${isNote ? '📝 Nota Privada' : '🔖 Bookmark Privado'}</div>
                                <h4 class="mui-vault-item-title">${App.escapeHtml(item.title)}</h4>
                                ${unlocked ? `
                                    <p class="mui-vault-item-desc">${isNote ? Notes.stripHtml(item.content || '').slice(0, 100) || 'Sem descrição' : App.escapeHtml(item.description || item.url || 'Sem descrição')}</p>
                                ` : `
                                    <p class="mui-vault-item-desc" style="color:rgba(255,23,68,0.45); font-style:italic;">🔒 Trancado sob AES-256</p>
                                `}
                            </div>
                            ${unlocked ? `
                                <div class="mui-vault-item-actions">
                                    <button class="btn btn-primary" onclick="FeatureHub.openItem('${type}','${item.id}')">${isNote ? 'Abrir' : 'Visitar Link'}</button>
                                    <button class="btn btn-secondary" onclick="FeatureHub.makePublic('${type}','${item.id}')">Tornar Público</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('') || `<div class="feature-card" style="grid-column:1/-1; text-align:center; padding:32px; background:rgba(30,30,45,0.15); border:1px dashed rgba(255,255,255,0.06); color:rgba(255,255,255,0.4);">Sem itens privados no cofre.</div>`}
            </div>
        </div>
        `;
    },

    async unlockOrSetupVault() {
        try {
            const pass = document.getElementById('vault-password').value;
            if (Storage.getVaultSettings().enabled) await Storage.unlockVault(pass);
            else await Storage.setupVault(pass);
            App.toast(Storage.isVaultUnlocked() ? 'Cofre desbloqueado.' : 'Cofre pronto.', 'success');
            App.renderPage('power');
        } catch (err) { App.toast(err.message, 'error'); }
    },

    async enableVault2fa() {
        try {
            await Storage.enableVault2fa(document.getElementById('vault-2fa-setup')?.value || '');
            App.toast('2FA ativado no cofre.', 'success');
            App.renderPage('power');
        } catch (err) { App.toast(err.message, 'error'); }
    },

    async makePrivate() {
        try {
            const value = document.getElementById('vault-item')?.value;
            if (!value) return App.toast('Nenhum item disponivel para privar.', 'info');
            const [type, id] = value.split(':');
            await Storage.makePrivate(type, id);
            App.toast('Item enviado para o cofre.', 'success');
            App.renderPage('power');
        } catch (err) { App.toast(err.message, 'error'); }
    },

    async makePublic(type, id) {
        try {
            await Storage.makePublic(type, id);
            App.toast('Item tornou-se público.', 'success');
            App.renderPage('power');
        } catch (err) { App.toast(err.message, 'error'); }
    },

    openItem(type, id) {
        if (type === 'project') {
            this.currentTab = 'projects';
            App.renderPage('power');
            return;
        }
        if (type === 'note') {
            const note = Storage.getNotes({ includePrivate: true }).find(n => n.id === id);
            if (note?.isPrivate && !Storage.isVaultUnlocked()) return App.toast('Desbloqueie o cofre para abrir esta nota.', 'error');
            App.navigate('notes');
            setTimeout(() => Notes.openEditor(id), 100);
            return;
        }
        const bk = Storage.getBookmarks({ includePrivate: true }).find(b => b.id === id);
        if (!bk) return App.toast('Item não encontrado.', 'error');
        if (bk.isPrivate && !Storage.isVaultUnlocked()) return App.toast('Desbloqueie o cofre para abrir este link.', 'error');
        if (!bk.url || bk.url === '#') return App.toast('Link indisponível.', 'error');
        Storage.recordBookmarkOpen(id);
        window.open(bk.url, '_blank', 'noopener');
    },











    renderAdvancedSearch(el) {
        el.innerHTML = `
        <div class="feature-card"><h3>Busca avançada</h3>
            <div class="form-row"><input id="adv-q" placeholder="Texto"><select id="adv-type"><option value="all">Tudo</option><option value="notes">Notas</option><option value="bookmarks">Bookmarks</option></select><select id="adv-private"><option value="all">Todos</option><option value="public">Públicos</option><option value="private">Privados</option></select><button class="btn btn-primary" onclick="FeatureHub.runAdvancedSearch()">Buscar</button></div>
        </div><div class="feature-card" id="adv-results"><p class="text-muted">Digite uma busca.</p></div>`;
    },

    runAdvancedSearch() {
        const q = document.getElementById('adv-q').value;
        const type = document.getElementById('adv-type').value;
        const privacy = document.getElementById('adv-private').value;
        const rows = [];
        if (type !== 'bookmarks') rows.push(...Storage.getNotes({ includePrivate: true }).map(n => ({ type:'📝', title:n.title, text:Notes.stripHtml(n.content||''), item:n })));
        if (type !== 'notes') rows.push(...Storage.getBookmarks({ includePrivate: true }).map(b => ({ type:'🔖', title:b.title, text:`${b.url} ${b.description||''}`, item:b })));
        const filtered = rows
            .filter(r => privacy === 'all' || (privacy === 'private') === Boolean(r.item.isPrivate))
            .map(r => ({ ...r, score: FuzzySearch.score(q, [{ text: r.title, weight: 4 }, { text: r.text, weight: 1 }]) }))
            .filter(r => !q.trim() || r.score >= 28)
            .sort((a,b) => b.score - a.score);
        document.getElementById('adv-results').innerHTML = filtered.slice(0,50).map(r => `<div class="feature-row"><span>${r.type} ${App.escapeHtml(r.title)}</span><small>${r.item.isPrivate?'Privado':'Público'}</small></div>`).join('') || '<p class="text-muted">Sem resultados.</p>';
    },



    renderCockpit(el) {
        const bks = Storage.getBookmarks().filter(b => App.contextMatches('bookmark', b));
        const notes = Storage.getNotes().filter(n => App.contextMatches('note', n));
        const projects = Storage.getProjects().filter(p => App.contextMatches('project', p));
        const study = Storage.getStudy();
        const inboxLinks = bks.filter(b=>b.inbox).length;
        const inboxNotes = notes.filter(n=>n.inbox).length;
        const inboxCount = inboxLinks + inboxNotes;
        const activeProjects = projects.filter(p => p.status !== 'concluido');
        const weekAgo = Date.now() - 7 * 86400000;
        el.innerHTML = `
        <div class="suite-hero">
            <div><h3>Cockpit Executivo</h3><p>O painel para decidir o que estudar, organizar e executar agora.</p></div>
            <button class="btn btn-primary" onclick="FeatureHub.currentTab='assistant';App.renderPage('power')">Organizar com Assistente</button>
        </div>
        <div class="suite-grid">
            <div class="suite-card" onclick="FeatureHub.currentTab='inbox';App.renderPage('power')"><strong>${inboxCount}</strong><span>Capturas pendentes (${inboxLinks} links · ${inboxNotes} notas)</span></div>
            <div class="suite-card"><strong>${activeProjects.length}</strong><span>Projetos ativos</span></div>
            <div class="suite-card"><strong>${(study.queue||[]).filter(i=>i.status!=='feito').length}</strong><span>Itens para revisar</span></div>
            <div class="suite-card"><strong>${notes.filter(n => Date.parse(n.updatedAt || 0) >= weekAgo).length}</strong><span>Notas mexidas na semana</span></div>
        </div>
        <div class="feature-grid">
            <div class="feature-card"><h3>Próximas ações</h3>
                ${this.buildLightSuggestions().slice(0,6).map((s,i)=>`<div class="feature-row"><span>${App.escapeHtml(s.text)}</span><button class="btn btn-sm btn-primary" onclick="FeatureHub.applyLightSuggestion(${i})">Aplicar</button></div>`).join('') || '<p class="text-muted">Nada urgente agora.</p>'}
            </div>
            <div class="feature-card"><h3>Projetos em movimento</h3>
                ${activeProjects.slice(0,6).map(p=>`<div class="feature-row"><span>${App.escapeHtml(p.name)}</span><small>${App.escapeHtml(p.status)}</small></div>`).join('') || '<p class="text-muted">Nenhum projeto ativo.</p>'}
            </div>
        </div>`;
    },




    renderEditorPlus(el) {
        const notes = Storage.getNotes();
        const wikiCandidates = notes.filter(n => /\[\[[^\]]+\]\]/.test(Notes.stripHtml(n.content || '')));
        el.innerHTML = `
        <div class="feature-grid">
            <div class="feature-card"><h3>Blocos rápidos</h3>
                <p>Crie notas com estruturas de software pessoal.</p>
                <button class="btn btn-secondary" onclick="FeatureHub.createBlockNote('callout')">Callout</button>
                <button class="btn btn-secondary" onclick="FeatureHub.createBlockNote('table')">Tabela</button>
                <button class="btn btn-secondary" onclick="FeatureHub.createBlockNote('code')">Código</button>
                <button class="btn btn-secondary" onclick="FeatureHub.createBlockNote('review')">Revisão</button>
            </div>
            <div class="feature-card"><h3>Wiki links detectados</h3>
                ${wikiCandidates.map(n=>`<div class="feature-row"><span>${App.escapeHtml(n.title)}</span><button class="btn btn-sm btn-primary" onclick="FeatureHub.openItem('note','${n.id}')">Abrir</button></div>`).join('') || '<p class="text-muted">Use [[Nome da nota]] em textos para criar conexões estilo wiki.</p>'}
            </div>
        </div>`;
    },

    createBlockNote(type) {
        const blocks = {
            callout: ['Callout', '<blockquote><strong>Ideia:</strong> escreva aqui.</blockquote>'],
            table: ['Tabela', '<table><tr><th>Item</th><th>Status</th></tr><tr><td></td><td></td></tr></table>'],
            code: ['Snippet', '<pre><code>// codigo aqui</code></pre>'],
            review: ['Revisão', '<h2>Resumo</h2><p></p><h2>Perguntas</h2><ul><li></li></ul><h2>Flashcards</h2><p>P: </p><p>R: </p>']
        }[type];
        const note = Storage.addNote({ title: `${blocks[0]} - ${new Date().toLocaleDateString('pt-BR')}`, content: blocks[1], folderId: 'default' });
        App.navigate('notes'); setTimeout(()=>Notes.openEditor(note.id), 100);
    },















    renderAutomations(el) {
        const rules = Storage.getRules();
        el.innerHTML = `<div class="feature-card"><h3>Macros e gatilhos locais</h3><p>Regras rodam automaticamente quando itens sao criados ou editados. Tudo local, sem servidor e sem IA pesada.</p>
            ${rules.map(r=>`<div class="feature-row"><span>${r.enabled?'Ativa':'Pausada'} · ${App.escapeHtml(r.name)}<small>${App.escapeHtml(this.ruleSummary(r))}</small></span><div class="row-actions"><button class="btn btn-sm btn-secondary" onclick="FeatureHub.toggleRule('${r.id}')">${r.enabled?'Pausar':'Ativar'}</button><button class="btn btn-sm btn-secondary" onclick="FeatureHub.showRuleModal('${r.id}')">Editar</button><button class="btn btn-sm btn-danger" onclick="FeatureHub.deleteRule('${r.id}')">Apagar</button></div></div>`).join('') || '<p class="text-muted">Nenhuma regra criada.</p>'}
            <div class="settings-actions"><button class="btn btn-primary" onclick="FeatureHub.showRuleModal()">Nova regra</button><button class="btn btn-secondary" onclick="FeatureHub.applyRules()">Aplicar em tudo agora</button></div>
        </div>`;
    },

    ruleSummary(rule) {
        const actions = this.normalizeRuleActions(rule);
        return `${rule.target || 'all'} contem "${rule.contains || '*'}" -> ${actions.map(a => `${a.action}${a.value ? ':' + a.value : ''}`).join(' + ') || 'sem acao'}`;
    },
    normalizeRuleActions(rule = {}) {
        if (Array.isArray(rule.actions) && rule.actions.length) {
            return rule.actions.filter(a => a?.action).map(a => ({ action: a.action, value: a.value || '' }));
        }
        return rule.action ? [{ action: rule.action, value: rule.value || '' }] : [];
    },

    showRuleModal(id = '') {
        const rule = Storage.getRules().find(r => r.id === id) || {};
        const targets = [['all','Tudo'], ['note','Notas'], ['bookmark','Bookmarks'], ['professional','Profissional'], ['personal','Pessoal']];
        const actions = [['category','Adicionar categoria'], ['folder','Mover bookmark para pasta'], ['kanban','Enviar nota ao Kanban'], ['review','Adicionar a revisao'], ['inbox','Criar item na Inbox pessoal'], ['urgentInbox','Criar Inbox pessoal urgente'], ['status','Alterar status profissional']];
        const selectedActions = this.normalizeRuleActions(rule);
        const actionRows = [0, 1, 2].map(index => {
            const current = selectedActions[index] || {};
            return `<div class="form-row rule-action-row">
                <div class="form-group"><label>Acao ${index + 1}</label><select id="rule-action-${index}"><option value="">Nenhuma</option>${actions.map(([value,label]) => `<option value="${value}" ${value===current.action?'selected':''}>${label}</option>`).join('')}</select></div>
                <div class="form-group"><label>Valor ${index + 1}</label><input id="rule-value-${index}" value="${App.escapeHtml(current.value || '')}" placeholder="Categoria, pasta, status ou texto..."></div>
            </div>`;
        }).join('');
        App.showModal(id ? 'Editar regra' : 'Nova macro local', `
            ${App.modalContextHtml({
                icon: '⚙️',
                title: id ? 'Editar macro local' : 'Nova macro local',
                description: 'Configure uma regra simples para agir quando notas, bookmarks, itens profissionais ou pessoais combinarem com um texto.',
                meta: ['Automação local', rule.enabled === false ? 'Pausada' : 'Ativa'],
                tone: 'automation'
            })}
            <form onsubmit="FeatureHub.saveRule('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Nome</label><input id="rule-name" value="${App.escapeHtml(rule.name || '')}" placeholder="Ex: Supabase vira estudo" required></div>
                <div class="form-row">
                    <div class="form-group"><label>Alvo</label><select id="rule-target">${targets.map(([value,label]) => `<option value="${value}" ${value===(rule.target || 'all')?'selected':''}>${label}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Texto que deve conter</label><input id="rule-contains" value="${App.escapeHtml(rule.contains || '')}" placeholder="supabase, backup, cliente..."></div>
                </div>
                ${actionRows}
                <label class="checkbox-row"><input type="checkbox" id="rule-enabled" ${rule.enabled !== false ? 'checked' : ''}> Ativa</label>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    saveRule(id = '') {
        const actions = [0, 1, 2].map(index => ({
            action: document.getElementById(`rule-action-${index}`)?.value || '',
            value: document.getElementById(`rule-value-${index}`)?.value.trim() || ''
        })).filter(item => item.action);
        const data = {
            name: document.getElementById('rule-name')?.value.trim(),
            target: document.getElementById('rule-target')?.value || 'all',
            contains: document.getElementById('rule-contains')?.value.trim() || '',
            action: actions[0]?.action || 'review',
            value: actions[0]?.value || '',
            actions: actions.length ? actions : [{ action: 'review', value: '' }],
            enabled: Boolean(document.getElementById('rule-enabled')?.checked)
        };
        if (!data.name) return App.toast('Digite o nome da regra.', 'error');
        id ? Storage.updateRule(id, data) : Storage.addRule(data);
        App.closeModal();
        App.toast('Regra salva.', 'success');
        App.renderPage('power');
    },

    toggleRule(id) {
        const rule = Storage.getRules().find(r=>r.id===id);
        if (rule) Storage.updateRule(id, { enabled: !rule.enabled });
        App.renderPage('power');
    },

    deleteRule(id) {
        App.confirmAction('Apagar esta regra?', () => {
            Storage.deleteRule(id);
            App.closeModal();
            App.toast('Regra apagada.', 'info');
            App.renderPage('power');
        }, { title: 'Apagar regra', confirmText: 'Apagar', danger: true });
    },

    applyRules() {
        const rules = Storage.getRules().filter(r=>r.enabled);
        const docs = this.ruleDocs();
        let count = 0;
        rules.forEach(rule => {
            docs.filter(doc => this.ruleMatches(rule, doc)).forEach(doc => { count += this.applyRuleAction(rule, doc) || 0; });
        });
        App.toast(`${count} ação(ões) aplicadas.`, 'success');
        App.renderPage('power');
    },

    applyRulesForEvent(event) {
        if (this._applyingRules || !event?.type) return;
        const allowed = ['note.created','note.updated','bookmark.created','bookmark.updated','professional.created','professional.updated','personal.created','personal.updated'];
        if (!allowed.includes(event.type)) return;
        const docs = this.ruleDocs(event);
        if (!docs.length) return;
        Storage.getRules().filter(r => r.enabled).forEach(rule => {
            docs.filter(doc => this.ruleMatches(rule, doc)).forEach(doc => this.applyRuleAction(rule, doc, { silent: true }));
        });
    },

    ruleDocs(event = null) {
        const records = Storage.getProfessionalRecords();
        const personal = Storage.getPersonalData();
        const docs = [];
        const addNote = n => docs.push({ type: 'note', id: n.id, item: n, text: `${n.title || ''} ${Notes.stripHtml(n.content || '')}` });
        const addBookmark = b => docs.push({ type: 'bookmark', id: b.id, item: b, text: `${b.title || ''} ${b.url || ''} ${b.description || ''}` });
        const addProfessional = r => docs.push({ type: 'professional', id: r.id, item: r, text: `${r.title || ''} ${r.status || ''} ${r.content || ''} ${JSON.stringify(r.fields || {})}` });
        const addPersonal = (collection, item) => docs.push({ type: 'personal', collection, id: item.id, item, text: `${item.title || ''} ${item.text || ''} ${item.name || ''} ${item.note || ''} ${item.status || ''}` });
        if (!event) {
            Storage.getNotes({ includePrivate: true }).forEach(addNote);
            Storage.getBookmarks({ includePrivate: true }).forEach(addBookmark);
            records.forEach(addProfessional);
            Object.entries(personal).forEach(([collection, list]) => Array.isArray(list) && list.forEach(item => addPersonal(collection, item)));
            return docs;
        }
        const payload = event.payload || {};
        if (event.type.startsWith('note.')) {
            const note = Storage.getNotes({ includePrivate: true }).find(n => n.id === payload.id);
            if (note) addNote(note);
        }
        if (event.type.startsWith('bookmark.')) {
            const bookmark = Storage.getBookmarks({ includePrivate: true }).find(b => b.id === payload.id);
            if (bookmark) addBookmark(bookmark);
        }
        if (event.type.startsWith('professional.')) {
            const record = records.find(r => r.id === payload.id);
            if (record) addProfessional(record);
        }
        if (event.type.startsWith('personal.')) {
            const item = (personal[payload.collection] || []).find(i => i.id === payload.id);
            if (item) addPersonal(payload.collection, item);
        }
        return docs;
    },

    ruleMatches(rule, doc) {
        const target = rule.target || 'all';
        if (target !== 'all' && target !== doc.type) return false;
        const needle = (rule.contains || '').trim();
        if (!needle) return true;
        return FuzzySearch.matches(needle, [{ text: doc.text, weight: 1 }], 28);
    },

    applyRuleAction(rule, doc, options = {}) {
        this._applyingRules = true;
        try {
            let applied = 0;
            this.normalizeRuleActions(rule).forEach(({ action, value }) => {
                if (this.applySingleRuleAction(action, value || '', doc)) applied++;
            });
            return applied;
        } finally {
            this._applyingRules = false;
        }
    },

    applySingleRuleAction(action, value, doc) {
        if (action === 'category' && ['note','bookmark'].includes(doc.type)) {
            const categoryId = this.resolveRuleCategory(doc.type, value || 'Auto');
            const categoryIds = [...new Set([...(doc.item.categoryIds || []), categoryId])];
            doc.type === 'bookmark' ? Storage.updateBookmark(doc.id, { categoryIds }) : Storage.updateNote(doc.id, { categoryIds });
            return true;
        }
        if (action === 'folder' && doc.type === 'bookmark') {
            const folders = Storage.getBkFolders();
            const name = value || 'revisao';
            let folder = folders.find(f => FuzzySearch.normalize(f.name) === FuzzySearch.normalize(name));
            if (!folder) {
                folder = { id: crypto.randomUUID(), name, icon: '📥' };
                Storage.saveBkFolders([...folders, folder]);
            }
            Storage.updateBookmark(doc.id, { folderId: folder.id });
            return true;
        }
        if (action === 'kanban' && doc.type === 'note') {
            Storage.updateNote(doc.id, { kanbanEnabled: true, status: value || 'ideias' });
            return true;
        }
        if (action === 'review' && ['note','bookmark'].includes(doc.type)) {
            Storage.addStudyItem(doc.type, doc.id);
            return true;
        }
        if (action === 'inbox' || action === 'urgentInbox') {
            Storage.addPersonalItem('inbox', {
                text: value || `Revisar: ${doc.item.title || doc.item.text || doc.type}`,
                status: action === 'urgentInbox' ? 'urgente' : 'aberto',
                sourceType: doc.type,
                sourceId: doc.id
            });
            return true;
        }
        if (action === 'status' && doc.type === 'professional') {
            Storage.updateProfessionalRecord(doc.id, { status: value || doc.item.status || 'aberto' });
            return true;
        }
        return false;
    },

    resolveRuleCategory(type, value) {
        const isBookmark = type === 'bookmark';
        const list = isBookmark ? Storage.getBkCategories() : Storage.getNtCategories();
        const normalized = FuzzySearch.normalize(value);
        let category = list.find(c => c.id === value || FuzzySearch.normalize(c.name) === normalized);
        if (!category) {
            category = { id: crypto.randomUUID(), name: value || 'Auto', icon: '⚡', color: '#7C4DFF' };
            isBookmark ? Storage.saveBkCategories([...list, category]) : Storage.saveNtCategories([...list, category]);
        }
        return category.id;
    },

    renderDocuments(el) {
        const docs = Storage.getDocuments();
        const notes = Storage.getNotes();
        el.innerHTML = `<div class="feature-card"><h3>Biblioteca de documentos</h3><p>Armazena arquivos pequenos localmente. Para PDFs grandes, prefira anexar por referência/export.</p>
            <div class="form-row"><select id="doc-note"><option value="">Sem nota vinculada</option>${notes.map(n=>`<option value="${n.id}">${App.escapeHtml(n.title)}</option>`).join('')}</select><input id="doc-file" type="file"></div><button class="btn btn-primary" onclick="FeatureHub.addDocument()">Adicionar documento</button>
        </div>
        <div class="feature-card"><h3>Documentos</h3>${docs.map(d=>`<div class="feature-row"><span>${App.escapeHtml(d.title)} · ${Math.round((d.size||0)/1024)} KB</span><div class="row-actions"><a class="btn btn-sm btn-primary" href="${d.dataUrl}" download="${App.escapeHtml(d.title)}">Abrir</a><button class="btn btn-sm btn-danger" onclick="Storage.deleteDocument('${d.id}');App.renderPage('power')">Apagar</button></div></div>`).join('') || '<p class="text-muted">Nenhum documento.</p>'}</div>`;
    },

    async addDocument() {
        const file = document.getElementById('doc-file')?.files?.[0];
        if (!file) return App.toast('Escolha um arquivo.', 'error');
        if (file.size > 3 * 1024 * 1024 && !await BookListDialogs.confirm('Arquivo maior que 3MB pode pesar no pendrive/sync. Continuar?', { title: 'Documento grande', confirmText: 'Adicionar' })) return;
        const reader = new FileReader();
        reader.onload = () => { Storage.addDocument({ title: file.name, type: file.type, size: file.size, dataUrl: reader.result, noteId: document.getElementById('doc-note')?.value || '' }); App.renderPage('power'); };
        reader.readAsDataURL(file);
    },

    renderPrivacyPlus(el) {
        const vault = Storage.getVaultSettings();
        el.innerHTML = `<div class="feature-grid">
            <div class="feature-card"><h3>Auto-bloqueio</h3><p>Tempo atual: ${vault.autoLockMinutes || 10} minuto(s).</p><div class="form-row"><input id="vault-minutes" type="number" min="1" value="${vault.autoLockMinutes || 10}"><button class="btn btn-primary" onclick="FeatureHub.saveVaultTimeout()">Salvar</button></div></div>
            <div class="feature-card"><h3>Modo ocultar privados</h3><p>Bloqueia o cofre e remove privados das listas imediatamente.</p><button class="btn btn-primary" onclick="Storage.lockVault();App.renderPage('power')">Ocultar agora</button></div>
            <div class="feature-card"><h3>Coleções privadas</h3><p>Use o Cofre para notas/links sensíveis e agrupe-os em coleções. Com o cofre bloqueado, eles ficam inacessíveis.</p><button class="btn btn-secondary" onclick="FeatureHub.currentTab='vault';App.renderPage('power')">Abrir Cofre</button></div>
        </div>`;
    },

    saveVaultTimeout() {
        const minutes = Math.max(1, Number(document.getElementById('vault-minutes')?.value || 10));
        Storage.saveVaultSettings({ autoLockMinutes: minutes });
        App.toast('Auto-bloqueio atualizado.', 'success');
        App.renderPage('power');
    },



















    renderCalendar(el) {
        const days = this.getActivityDays(112);
        const month = this.getCalendarMonth();
        el.innerHTML = `
        <div class="feature-card">
            <h3>Calendario / Heatmap</h3>
            <p>Atividade dos ultimos 112 dias, estilo contribuicoes.</p>
            <div class="heatmap">${days.map(d => `<span class="heat-cell heat-${d.level}" title="${d.label}: ${d.count} atividade(s)"></span>`).join('')}</div>
        </div>
        <div class="feature-card"><h3>Calendario integrado</h3><div class="calendar-grid">${month.map(day => `<div class="calendar-day ${day.today ? 'today' : ''}"><strong>${day.date.getDate()}</strong>${day.items.slice(0,3).map(i => `<button onclick="FeatureHub.openItem('${i.type}','${i.id}')">${App.escapeHtml(i.title)}</button>`).join('')}${day.items.length > 3 ? `<small>+${day.items.length - 3}</small>` : ''}</div>`).join('')}</div></div>`;
    },

    getCalendarMonth() {
        const start = new Date();
        start.setDate(1);
        const firstDay = start.getDay();
        start.setDate(start.getDate() - firstDay);
        const items = [
            ...Storage.getNotes().map(n => ({ type: 'note', id: n.id, title: n.title, when: n.eventDate || n.dueAt || n.updatedAt || n.createdAt })),
            ...Storage.getBookmarks().map(b => ({ type: 'bookmark', id: b.id, title: b.title, when: b.dueAt || b.createdAt })),
            ...(Storage.getStudy().queue || []).map(q => {
                const src = q.type === 'note' ? Storage.getNotes().find(n=>n.id===q.id) : Storage.getBookmarks().find(b=>b.id===q.id);
                return { type: q.type, id: q.id, title: `Revisar: ${src?.title || 'item'}`, when: q.dueAt };
            })
        ].filter(i => i.when);
        return Array.from({ length: 42 }, (_, idx) => {
            const date = new Date(start);
            date.setDate(start.getDate() + idx);
            const key = date.toISOString().slice(0, 10);
            return { date, today: key === new Date().toISOString().slice(0,10), items: items.filter(i => new Date(i.when).toISOString().slice(0,10) === key) };
        });
    },

    getActivityDays(total) {
        const counts = {};
        const touch = iso => {
            if (!iso) return;
            const date = new Date(iso);
            if (Number.isNaN(date.getTime())) return;
            const key = date.toISOString().slice(0, 10);
            counts[key] = (counts[key] || 0) + 1;
        };
        Storage.getBookmarks().forEach(b => { touch(b.createdAt); touch(b.updatedAt); touch(b.lastOpenedAt); });
        Storage.getNotes().forEach(n => { touch(n.createdAt); touch(n.updatedAt); });
        Storage.getEvents().forEach(e => touch(e.createdAt));
        return Array.from({ length: total }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (total - 1 - i));
            const key = date.toISOString().slice(0, 10);
            const count = counts[key] || 0;
            return { key, count, label: date.toLocaleDateString('pt-BR'), level: Math.min(4, count) };
        });
    },

    renderTimeline(el) {
        const allRows = this.getTimelineItems();
        const filter = this.timelineFilter || 'all';
        const rows = filter === 'all' ? allRows : allRows.filter(r => r.filterGroup === filter);
        const years = [...new Set(rows.map(r => new Date(r.when).getFullYear()))];
        const listHtml = rows.map((r, index) => this.timelineRowHtml(r, index, rows)).join('');
        const filters = [
            ['all', 'Tudo', allRows.length],
            ['finance', 'Só financeiro', allRows.filter(r => r.filterGroup === 'finance').length],
            ['study', 'Só estudos', allRows.filter(r => r.filterGroup === 'study').length],
            ['clients', 'Só clientes', allRows.filter(r => r.filterGroup === 'clients').length],
            ['work', 'Só técnico', allRows.filter(r => r.filterGroup === 'work').length],
            ['personal', 'Só pessoal', allRows.filter(r => r.filterGroup === 'personal').length]
        ];
        el.innerHTML = `<div class="feature-card"><h3>Timeline avancada</h3><p>Use a data do evento nas notas ou datas dos registros tecnicos para montar uma linha do tempo viva.</p>
            <div class="timeline-filter-pills">${filters.map(([id,label,count]) => `<button class="btn btn-sm ${filter === id ? 'btn-primary' : 'btn-secondary'}" onclick="FeatureHub.setTimelineFilter('${id}')">${label} <small>${count}</small></button>`).join('')}</div>
            <div class="timeline-year-nav">${years.map(year => `<button class="btn btn-sm btn-secondary" onclick="document.getElementById('timeline-year-${year}')?.scrollIntoView({behavior:'smooth'})">${year}</button>`).join('')}</div>
            <div class="timeline-list advanced">${listHtml || '<p class="text-muted">Nenhum item com data. Abra uma nota e preencha o campo Timeline.</p>'}</div>
        </div>`;
    },
    setTimelineFilter(filter) {
        this.timelineFilter = filter || 'all';
        this.renderTab();
    },

    getTimelineItems() {
        const records = Storage.getProfessionalRecords();
        const modules = App.getProfessionalModules();
        const items = [];
        Storage.getNotes().filter(note => App.contextMatches('note', note)).forEach(note => {
            if (note.eventDate) items.push({ when: note.eventDate, kind: 'Nota', icon: '📝', title: note.title, detail: 'Data do evento', openType: 'note', id: note.id, filterGroup: this.timelineGroupFor('note', note) });
        });
        records.filter(record => App.contextMatches('professional', record)).forEach(record => {
            const dates = this.timelineDatesForRecord(record);
            dates.forEach(date => {
                items.push({
                    when: date.value,
                    kind: modules[record.moduleKey]?.title || record.moduleKey,
                    icon: modules[record.moduleKey]?.icon || '•',
                    title: record.title,
                    detail: date.label,
                    openType: 'professional',
                    id: record.id,
                    filterGroup: this.timelineGroupFor('professional', record)
                });
            });
        });
        const personal = Storage.getPersonalData();
        (personal.money || []).filter(item => App.contextMatches('personal', { ...item, collection: 'money' })).forEach(item => item.date && items.push({ when: item.date, kind: 'Money', icon: '💸', title: item.title, detail: `${item.type || ''} ${item.amount ? UI.money(item.amount) : ''}`, openType: 'money', id: item.id, filterGroup: 'finance' }));
        return items
            .filter(item => item.when && !Number.isNaN(new Date(item.when).getTime()))
            .sort((a,b) => new Date(b.when) - new Date(a.when))
            .slice(0, 160);
    },

    timelineGroupFor(type, item = {}) {
        if (item.moduleKey === 'finance') return 'finance';
        if (item.moduleKey === 'clients') return 'clients';
        if (item.moduleKey) return 'work';
        const text = `${item.title || ''} ${(item.categoryIds || []).join(' ')} ${Notes.stripHtml?.(item.content || '') || ''}`.toLowerCase();
        if (/estudo|study|curso|aula|livro|flashcard|tutorial/.test(text)) return 'study';
        const scope = App.contextForItem(type, item);
        return scope === 'personal' ? 'personal' : scope === 'work' ? 'work' : 'study';
    },

    timelineDatesForRecord(record) {
        const fields = record.fields || {};
        const labels = Object.fromEntries(App.professionalFieldsConfig(record.moduleKey).map(([key, label]) => [key, label]));
        const keys = ['date','dueDate','warrantyUntil','validUntil'];
        const dates = [];
        keys.forEach(key => {
            const value = fields[key] || record[key];
            if (value && !Number.isNaN(new Date(value).getTime())) dates.push({ value, label: labels[key] || key });
        });
        return dates;
    },

    timelineRowHtml(row, index, rows = []) {
        const date = new Date(row.when);
        const year = date.getFullYear();
        const prevYear = index > 0 ? new Date(rows[index - 1]?.when).getFullYear() : null;
        const yearMarker = index === 0 || prevYear !== year
            ? `<div class="timeline-year" id="timeline-year-${year}">${year}</div>`
            : '';
        return `${yearMarker}<button class="timeline-row timeline-row-button" onclick="FeatureHub.openTimelineItem('${row.openType}','${row.id}')"><time>${date.toLocaleDateString('pt-BR')}</time><strong>${row.icon} ${App.escapeHtml(row.kind)}</strong><span><b>${App.escapeHtml(row.title || '')}</b><small>${App.escapeHtml(row.detail || '')}</small></span></button>`;
    },

    openTimelineItem(type, id) {
        if (type === 'note') return FeatureHub.openItem('note', id);
        if (type === 'money') { App.navigate('money'); setTimeout(() => PersonalHub.showMoneyModal(id), 80); return; }
        if (type === 'tracker') { App.navigate('tracker'); setTimeout(() => PersonalHub.showTrackerModal(id), 80); return; }
        App.openProfessionalRecord(id);
    },

    renderSmartStats(el) {
        const bks = Storage.getBookmarks();
        const notes = Storage.getNotes();
        const weekAgo = Date.now() - 7 * 86400000;
        const tagCounts = {};
        [...bks, ...notes].forEach(item => (item.categoryIds || []).forEach(id => tagCounts[id] = (tagCounts[id] || 0) + 1));
        const mostEdited = [...notes].sort((a,b) => (b.versions || []).length - (a.versions || []).length).slice(0, 6);
        const activityDays = new Set(this.getActivityDays(30).filter(d => d.count).map(d => d.key));

        const bkCats = Storage.getBkCategories ? Storage.getBkCategories() : [];
        const ntCats = Storage.getNtCategories ? Storage.getNtCategories() : [];
        const catMap = {};
        bkCats.forEach(c => { catMap[c.id] = (c.icon ? c.icon + ' ' : '') + c.name; });
        ntCats.forEach(c => { catMap[c.id] = (c.icon ? c.icon + ' ' : '') + c.name; });

        el.innerHTML = `
        <div class="feature-grid">
            <div class="feature-card"><h3>Links por semana</h3><p>${bks.filter(b => Date.parse(b.createdAt || 0) >= weekAgo).length} novo(s) nos ultimos 7 dias</p></div>
            <div class="feature-card"><h3>Streak</h3><p>${this.calcStreak(activityDays)} dia(s) de escrita/estudo</p></div>
            <div class="feature-card"><h3>Capturas a organizar</h3><p>${bks.filter(b=>b.inbox).length} link(s) · ${notes.filter(n=>n.inbox).length} nota(s) pendentes</p></div>
            <div class="feature-card"><h3>Links nunca abertos</h3><p>${bks.filter(b => !b.openCount).length} bookmark(s)</p></div>
        </div>
        <div class="feature-grid">
            <div class="feature-card"><h3>Notas mais editadas</h3>${mostEdited.map(n=>`<div class="feature-row"><span>${App.escapeHtml(n.title)}</span><small>${(n.versions||[]).length} versoes</small></div>`).join('') || '<p class="text-muted">Sem histórico ainda.</p>'}</div>
            <div class="feature-card"><h3>Tags mais usadas</h3>${Object.entries(tagCounts)
                .filter(([id]) => {
                    const resolved = catMap[id];
                    if (resolved) return true;
                    // Se não está mapeado no catMap e tem formato de UUID, remove das mais usadas
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                    return !isUuid;
                })
                .sort((a,b)=>b[1]-a[1])
                .slice(0,8)
                .map(([id,count])=>{
                    const name = catMap[id] || id;
                    return `<div class="feature-row"><span>${App.escapeHtml(name)}</span><small>${count}</small></div>`;
                }).join('') || '<p class="text-muted">Sem tags.</p>'}</div>
            <div class="feature-card"><h3>Sem categoria</h3><p>${notes.filter(n => !(n.categoryIds||[]).length).length} notas · ${bks.filter(b => !(b.categoryIds||[]).length).length} links</p></div>
        </div>`;
    },

    calcStreak(activityDays) {
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            if (!activityDays.has(d.toISOString().slice(0, 10))) break;
            streak++;
        }
        return streak;
    },


    renderToc(el) {
        const notes = Storage.getNotes();
        const id = document.getElementById('toc-note')?.value || notes[0]?.id;
        const note = notes.find(n => n.id === id);
        const headings = this.extractHeadings(note?.content || '');
        el.innerHTML = `<div class="feature-card"><h3>Table of Contents</h3><div class="form-row"><select id="toc-note" onchange="FeatureHub.renderTab()">${notes.map(n=>`<option value="${n.id}" ${n.id===id?'selected':''}>${App.escapeHtml(n.title)}</option>`).join('')}</select><button class="btn btn-primary" onclick="App.navigate('notes');setTimeout(()=>Notes.openEditor('${id}'),100)">Abrir nota</button></div></div>
        <div class="feature-card"><h3>${App.escapeHtml(note?.title || 'Sem nota')}</h3>
            <div class="toc-list">${headings.map(h => `<button class="toc-item depth-${h.depth}" onclick="App.navigate('notes');setTimeout(()=>Notes.openEditor('${id}'),100)">${App.escapeHtml(h.text)}</button>`).join('') || '<p class="text-muted">Essa nota ainda nao tem H1, H2 ou H3.</p>'}</div>
        </div>`;
    },

    extractHeadings(html) {
        const doc = new DOMParser().parseFromString(html || '', 'text/html');
        return Array.from(doc.querySelectorAll('h1,h2,h3')).map(h => ({ depth: Number(h.tagName.slice(1)), text: h.textContent.trim() })).filter(h => h.text);
    },

    renderImport(el) {
        el.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
            <!-- Navegador Column -->
            <div class="feature-card" style="background: rgba(15, 23, 42, 0.25); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(8px); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 2rem;">🌐</span>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 750; color: var(--text-primary);">Favoritos do Navegador</h3>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">
                        Selecione o arquivo HTML exportado pelo seu navegador (Chrome, Edge, Safari, Firefox). Todos os links importados serão salvos na pasta <strong>revisao</strong> dentro da sua Inbox para triagem.
                    </p>
                    
                    <div style="border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; text-align: center; background: rgba(0,0,0,0.15); margin-bottom: 20px;">
                        <input type="file" id="browser-import-file" accept=".html,.htm" style="display: none;" onchange="document.getElementById('browser-file-label').innerText = this.files[0]?.name || 'Nenhum arquivo'">
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('browser-import-file').click()" style="margin-bottom: 8px;">💻 Escolher Arquivo HTML</button>
                        <div id="browser-file-label" style="font-size: 0.8rem; color: var(--text-secondary);">Nenhum arquivo selecionado</div>
                    </div>
                </div>
                
                <div>
                    <button class="btn btn-primary" onclick="FeatureHub.importBrowserBookmarks()" style="width: 100%; padding: 12px; font-weight: 700;">
                        📥 Importar Favoritos
                    </button>
                    <div id="browser-import-result" style="margin-top: 12px; font-size: 0.85rem; text-align: center;"></div>
                </div>
            </div>

            <!-- Outros Apps Column -->
            <div class="feature-card" style="background: rgba(15, 23, 42, 0.25); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(8px); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 2rem;">🔌</span>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 750; color: var(--text-primary);">Notion, Obsidian & Evernote</h3>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">
                        Importe suas notas ou links salvos em outros serviços. Suporta arquivos Markdown (.md), notas do Evernote (.enex), backups CSV (Pocket, Raindrop) ou arquivos JSON.
                    </p>
                    
                    <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 20px;">
                        <div style="border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; text-align: center; background: rgba(0,0,0,0.15);">
                            <input type="file" id="app-import-file" accept=".md,.txt,.html,.htm,.csv,.json,.enex" multiple style="display: none;" onchange="document.getElementById('app-file-label').innerText = this.files.length > 0 ? this.files.length + ' arquivo(s) selecionado(s)' : 'Nenhum arquivo'">
                            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('app-import-file').click()" style="margin-bottom: 8px;">📂 Escolher Arquivos</button>
                            <div id="app-file-label" style="font-size: 0.8rem; color: var(--text-secondary);">Nenhum arquivo selecionado</div>
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.85em; font-weight: 700; color: var(--accent); margin-bottom: 6px; text-transform: uppercase;">Destino das Notas</label>
                            <select id="app-import-target" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 15, 30, 0.6); color: var(--text-primary); outline: none;">
                                <option value="auto">Detecção Automática</option>
                                <option value="notes">Notas do Editor</option>
                                <option value="bookmarks">Favoritos (Links)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <button class="btn btn-primary" onclick="FeatureHub.importFromApps()" style="width: 100%; padding: 12px; font-weight: 700;">
                        📥 Iniciar Importação de Apps
                    </button>
                    <div id="app-import-result" style="margin-top: 12px; font-size: 0.85rem; text-align: center;"></div>
                </div>
            </div>
        </div>`;
    },

    importBrowserBookmarks() {
        const file = document.getElementById('browser-import-file')?.files?.[0];
        if (!file) return App.toast('Escolha um arquivo HTML.', 'error');
        const reader = new FileReader();
        reader.onload = () => {
            const doc = new DOMParser().parseFromString(reader.result, 'text/html');
            const links = Array.from(doc.querySelectorAll('a[href]'));
            const folders = Storage.getBkFolders();
            let review = folders.find(f => f.name.toLowerCase() === 'revisao');
            if (!review) {
                review = { id: crypto.randomUUID(), name: 'revisao', icon: '📥' };
                Storage.saveBkFolders([...folders, review]);
            }
            const existing = new Set(Storage.getBookmarks().map(b => (b.url || '').replace(/\/$/, '').toLowerCase()));
            let added = 0;
            links.forEach(a => {
                const url = a.href;
                const normalized = (url || '').replace(/\/$/, '').toLowerCase();
                if (!url || existing.has(normalized)) return;
                Storage.addBookmark({ title: a.textContent.trim() || url, url, folderId: review.id, inbox: true, imported: true, smartEnabled: false, readingStatus: 'novo' });
                existing.add(normalized);
                added++;
            });
            document.getElementById('browser-import-result').innerHTML = `<p class="text-muted">${added} favoritos importados para revisao.</p>`;
            App.toast('Importacao concluida.', 'success');
        };
        reader.readAsText(file);
    },










    renderCleanup(el) {
        const rows = this.buildCleanupRows();
        el.innerHTML = `<div class="feature-card"><h3>Modo Limpeza</h3><p>${rows.length} ponto(s) para organizar.</p>
            <div class="cleanup-batch-bar">
                <label class="checkbox-row"><input type="checkbox" onchange="FeatureHub.toggleCleanupSelection(this.checked)"> Selecionar visiveis</label>
                <button class="btn btn-sm btn-secondary" onclick="FeatureHub.batchCleanupArchive()">Arquivar selecionados</button>
                <button class="btn btn-sm btn-danger" onclick="FeatureHub.batchCleanupDelete()">Deletar selecionados</button>
            </div>
            ${rows.slice(0,80).map(({ type, item, reasons })=>`<div class="feature-row cleanup-row"><label class="cleanup-select"><input type="checkbox" data-cleanup-key="${type}:${item.id}"></label><span>${reasons.map(reason => `<small class="cleanup-badge">${App.escapeHtml(reason)}</small>`).join('')} ${App.escapeHtml(item.title || 'Sem título')}</span><div class="row-actions"><button class="btn btn-sm btn-secondary" onclick="FeatureHub.quickArchive('${type}','${item.id}')">Arquivar</button><button class="btn btn-sm btn-danger" onclick="FeatureHub.quickDelete('${type}','${item.id}')">Deletar</button></div></div>`).join('') || '<p class="text-muted">Tudo limpo por aqui.</p>'}
        </div>`;
    },

    buildCleanupRows() {
        const bks = Storage.getBookmarks();
        const notes = Storage.getNotes();
        const seen = new Map();
        const duplicates = bks.filter(b => {
            const key = (b.url || '').replace(/\/$/, '').toLowerCase();
            if (!key) return false;
            if (seen.has(key)) return true;
            seen.set(key, b.id);
            return false;
        });
        const rawRows = [
            ...bks.filter(b => !b.folderId).map(b => ['bookmark', b, 'sem pasta']),
            ...bks.filter(b => !(b.categoryIds||[]).length).map(b => ['bookmark', b, 'sem tag']),
            ...duplicates.map(b => ['bookmark', b, 'duplicado']),
            ...bks.filter(b => { try { new URL(b.url); return false; } catch { return true; } }).map(b => ['bookmark', b, 'url invalida']),
            ...notes.filter(n => !(n.categoryIds||[]).length).map(n => ['note', n, 'sem categoria']),
            ...notes.filter(n => !Notes.stripHtml(n.content || '').trim()).map(n => ['note', n, 'nota vazia']),
            ...[...bks, ...notes].filter(i => i.inbox).map(i => [i.url ? 'bookmark' : 'note', i, 'captura pendente'])
        ];
        const byKey = new Map();
        rawRows.forEach(([type, item, reason]) => {
            const key = `${type}:${item.id}`;
            if (!byKey.has(key)) byKey.set(key, { type, item, reasons: [] });
            byKey.get(key).reasons.push(reason);
        });
        return [...byKey.values()];
    },

    toggleCleanupSelection(checked) {
        document.querySelectorAll('[data-cleanup-key]').forEach(input => input.checked = checked);
    },

    selectedCleanupItems() {
        return [...document.querySelectorAll('[data-cleanup-key]:checked')].map(input => {
            const [type, id] = input.dataset.cleanupKey.split(':');
            return { type, id };
        });
    },

    batchCleanupArchive() {
        const selected = this.selectedCleanupItems();
        if (!selected.length) return App.toast('Selecione pelo menos um item.', 'info');
        selected.forEach(({ type, id }) => {
            if (type === 'bookmark') Storage.updateBookmark(id, { inbox: false, readingStatus: 'arquivado', smartEnabled: false });
            else Storage.updateNote(id, { inbox: false, kanbanEnabled: false, archived: true });
        });
        App.toast(`${selected.length} item(ns) arquivados.`, 'success');
        App.renderPage('power');
    },

    batchCleanupDelete() {
        const selected = this.selectedCleanupItems();
        if (!selected.length) return App.toast('Selecione pelo menos um item.', 'info');
        App.confirmAction(`Deletar ${selected.length} item(ns) selecionados?`, () => {
            selected.forEach(({ type, id }) => {
                if (type === 'bookmark') Storage.deleteBookmark(id);
                else Storage.deleteNote(id);
            });
            App.renderPage('power');
        }, { title: 'Deletar em lote', confirmText: 'Deletar selecionados', danger: true });
    },

    quickArchive(type, id) {
        if (type === 'bookmark') Storage.updateBookmark(id, { inbox: false, readingStatus: 'arquivado', smartEnabled: false });
        else Storage.updateNote(id, { inbox: false, kanbanEnabled: false, archived: true });
        App.renderPage('power');
    },

    quickDelete(type, id) {
        App.confirmAction('Deletar este item?', () => {
            if (type === 'bookmark') Storage.deleteBookmark(id);
            else Storage.deleteNote(id);
            App.renderPage('power');
        }, { title: 'Deletar item', confirmText: 'Deletar', danger: true });
    },

    renderSuggestions(el) {
        const suggestions = this.buildSuggestions();
        el.innerHTML = `<div class="feature-card"><h3>Sugestoes automaticas</h3>
            ${suggestions.map((s, i) => `<div class="feature-row"><span>${App.escapeHtml(s.text)}</span><button class="btn btn-sm btn-primary" onclick="FeatureHub.applySuggestion(${i})">Aplicar</button></div>`).join('') || '<p class="text-muted">Sem sugestoes fortes agora.</p>'}
        </div>`;
        this._suggestions = suggestions;
    },

    buildSuggestions() {
        const out = [];
        const bks = Storage.getBookmarks();
        const notes = Storage.getNotes();
        const supabaseItems = [...bks, ...notes].filter(i => `${i.title} ${i.description || ''} ${Notes.stripHtml(i.content || '')}`.toLowerCase().includes('supabase'));
        if (supabaseItems.length >= 3 && !Storage.getCollections().some(c => c.name.toLowerCase().includes('supabase'))) {
            out.push({ text: `Voce tem ${supabaseItems.length} itens sobre Supabase. Criar colecao?`, action: () => {
                const col = Storage.addCollection({ name: 'Supabase', color: '#00BFA5' });
                supabaseItems.forEach(i => Storage.addCollectionItem(col.id, i.url ? 'bookmark' : 'note', i.id));
            }});
        }
        bks.filter(b => /youtube|youtu\.be/i.test(`${b.url} ${b.title}`) && !(b.categoryIds||[]).includes('youtube')).slice(0,5).forEach(b => {
            out.push({ text: `Adicionar tag YouTube em "${b.title}"`, action: () => Storage.updateBookmark(b.id, { categoryIds: [...new Set([...(b.categoryIds||[]), 'youtube'])] }) });
        });
        bks.filter(b => !b.openCount && Date.now() - Date.parse(b.createdAt || 0) > 30 * 86400000).slice(0,5).forEach(b => {
            out.push({ text: `Arquivar link antigo nunca aberto: "${b.title}"`, action: () => Storage.updateBookmark(b.id, { readingStatus: 'arquivado', smartEnabled: false }) });
        });
        notes.filter(n => !(n.categoryIds||[]).length).slice(0,5).forEach(n => {
            out.push({ text: `Nota sem categoria: "${n.title}". Marcar como Ideias?`, action: () => Storage.updateNote(n.id, { categoryIds: [...new Set([...(n.categoryIds||[]), 'ideas'])] }) });
        });
        return out.slice(0, 12);
    },

    applySuggestion(index) {
        const suggestion = this._suggestions?.[index];
        if (!suggestion) return;
        suggestion.action();
        App.toast('Sugestao aplicada.', 'success');
        App.renderPage('power');
    },

    getAllSuiteItems() {
        return [
            ...Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).map(item => ({ type: 'note', item })),
            ...Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() }).map(item => ({ type: 'bookmark', item })),
            ...Storage.getProjects().map(item => ({ type: 'project', item }))
        ].filter(({ type, item }) => App.contextMatches(type, item));
    },

    itemOptionsHtml(items = null) {
        const list = items || this.getAllSuiteItems();
        return list.map(({ type, item }) => `<option value="${type}:${item.id}">${type === 'note' ? 'Nota' : type === 'bookmark' ? 'Link' : 'Projeto'}: ${App.escapeHtml(item.title || item.name || 'Sem título')}</option>`).join('');
    },

    updateTypedItem(type, id, data) {
        if (type === 'note') return Storage.updateNote(id, data);
        if (type === 'bookmark') return Storage.updateBookmark(id, data);
        if (type === 'project') return Storage.updateProject(id, data);
        return null;
    },

    itemScore(type, item) {
        const priorityScore = { baixa: 15, normal: 35, alta: 65, critica: 90 }[item.priority || 'normal'] || 35;
        const fav = item.favorite ? 10 : 0;
        const open = Math.min(Number(item.openCount || 0) * 3, 18);
        const recent = Date.now() - Date.parse(item.updatedAt || item.createdAt || 0) < 7 * 86400000 ? 10 : 0;
        const linked = (Storage.getRelations?.() || []).filter(r => r.fromId === item.id || r.toId === item.id).length * 4;
        return Math.min(100, priorityScore + fav + open + recent + linked + (type === 'project' ? 8 : 0));
    },

    downloadText(filename, text, mime = 'text/plain') {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    renderSemanticSearch(el) {
        const neuralReady = typeof WebAI !== 'undefined' && WebAI._pipeline;
        const neuralEnabled = Storage.getSettings().aiNeuralSearch;
        el.innerHTML = `
        <div class="feature-card">
            <h3>Busca semantica local</h3>
            <p>${neuralReady ? 'Modelo neural carregado: resultados por embeddings locais.' : neuralEnabled ? 'Modelo neural ativado nas configuracoes, mas ainda nao carregado. Usando TF-IDF local ate inicializar.' : 'Busca local por similaridade de texto. Ative o modelo neural nas configuracoes para embeddings.'}</p>
            <div class="form-row"><input id="semantic-query" placeholder="Ex: estudar supabase, ideias antigas, tutorial javascript" oninput="FeatureHub.runSemanticSearch()"><button class="btn btn-primary" onclick="FeatureHub.runSemanticSearch()">Buscar</button></div>
        </div>
        <div id="semantic-results" class="feature-card"><p class="text-muted">Digite algo para buscar.</p></div>`;
    },

    semanticTokens(query) {
        const map = {
            estudo: ['estudo','estudar','curso','aula','tutorial','docs','aprendizado','learning'],
            codigo: ['codigo','dev','programacao','javascript','supabase','react','api','bug'],
            ideia: ['ideia','insight','brainstorm','projeto','pensamento'],
            urgente: ['urgente','critica','alta','prioridade','importante'],
            antigo: ['antigo','parado','abandonado','arquivado']
        };
        const base = query.toLowerCase().split(/\s+/).filter(Boolean);
        const expanded = new Set(base);
        base.forEach(token => Object.values(map).forEach(group => {
            if (group.includes(token)) group.forEach(word => expanded.add(word));
        }));
        return [...expanded];
    },

    async runSemanticSearch() {
        const q = document.getElementById('semantic-query')?.value || '';
        const el = document.getElementById('semantic-results');
        if (!el) return;
        if (!q.trim()) return el.innerHTML = '<p class="text-muted">Digite algo para buscar.</p>';
        const runId = Date.now();
        this._semanticRunId = runId;
        el.innerHTML = '<p class="text-muted">Analisando contexto local...</p>';
        const docs = this.getAllSuiteItems().map(({ type, item }) => ({
            ...item,
            __type: type,
            title: item.title || item.name || 'Sem titulo',
            description: `${item.description || ''} ${(item.tags || []).join(' ')} ${(item.categoryIds || []).join(' ')}`,
            content: item.content || item.text || ''
        }));
        try {
            const rows = await WebAI.searchSemantic(q, docs, 20);
            if (this._semanticRunId !== runId) return;
            const mode = WebAI._pipeline ? 'embeddings locais' : 'TF-IDF local';
            el.innerHTML = `<h3>Resultados <small>${mode}</small></h3>${rows.map(item => `<div class="feature-row"><div><strong>${App.escapeHtml(item.title || item.name || 'Sem titulo')}</strong><small>${App.escapeHtml(item.__type || 'item')} · contexto analisado</small></div><button class="btn btn-sm btn-primary" onclick="FeatureHub.openItem('${item.__type}','${item.id}')">Abrir</button></div>`).join('') || '<p class="text-muted">Nada encontrado.</p>'}`;
        } catch (err) {
            console.warn('Busca semantica local falhou:', err);
            if (this._semanticRunId !== runId) return;
            el.innerHTML = '<p class="text-muted">Nao foi possivel concluir a busca semantica agora.</p>';
        }
        return;
        if (!tokens.length) return el.innerHTML = '<p class="text-muted">Digite algo para buscar.</p>';
        const rows = this.getAllSuiteItems().map(({ type, item }) => {
            const text = `${item.title || item.name || ''} ${item.description || ''} ${App.stripHtml?.(item.content || '') || ''} ${(item.tags || []).join(' ')} ${(item.categoryIds || []).join(' ')}`.toLowerCase();
            const hits = tokens.reduce((n, token) => n + (text.includes(token) ? 1 : 0), 0);
            return { type, item, hits, score: hits * 20 + this.itemScore(type, item) / 5 };
        }).filter(r => r.hits).sort((a, b) => b.score - a.score).slice(0, 20);
        el.innerHTML = `<h3>Resultados</h3>${rows.map(r => `<div class="feature-row"><div><strong>${App.escapeHtml(r.item.title || r.item.name || 'Sem título')}</strong><small>${r.type} · ${r.hits} match(es)</small></div><button class="btn btn-sm btn-primary" onclick="FeatureHub.openItem('${r.type}','${r.item.id}')">Abrir</button></div>`).join('') || '<p class="text-muted">Nada encontrado.</p>'}`;
    },






    renderChecklists(el) {
        const lists = Storage.getChecklists();
        const notes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() });
        el.innerHTML = `
        <div class="feature-card">
            <h3>Checklists reutilizaveis</h3>
            <div class="form-row"><input id="check-name" placeholder="Nome"><button class="btn btn-primary" onclick="FeatureHub.addReusableChecklist()">Salvar</button></div>
            <textarea id="check-items" rows="5" placeholder="Um item por linha"></textarea>
        </div>
        <div class="feature-card"><h3>Aplicar em nota</h3><div class="form-row"><select id="check-list">${lists.map(c=>`<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('')}</select><select id="check-note">${notes.map(n=>`<option value="${n.id}">${App.escapeHtml(n.title)}</option>`).join('')}</select><button class="btn btn-primary" onclick="FeatureHub.insertChecklistInNote()">Inserir</button></div></div>
        <div class="feature-card"><h3>Biblioteca</h3>${lists.map(c => `<div class="feature-row"><div><strong>${App.escapeHtml(c.name)}</strong><small>${(c.items || []).length} item(ns)</small></div><button class="btn btn-sm btn-danger" onclick="Storage.deleteChecklist('${c.id}');App.renderPage('power')">Apagar</button></div>`).join('')}</div>`;
    },

    addReusableChecklist() {
        const name = document.getElementById('check-name')?.value.trim();
        const items = (document.getElementById('check-items')?.value || '').split('\n').map(x => x.trim()).filter(Boolean);
        if (!name || !items.length) return App.toast('Informe nome e itens.', 'error');
        Storage.addChecklist({ name, items });
        App.renderPage('power');
    },

    insertChecklistInNote() {
        const list = Storage.getChecklists().find(c => c.id === document.getElementById('check-list')?.value);
        const noteId = document.getElementById('check-note')?.value;
        const note = Storage.getNotes({ includePrivate: true }).find(n => n.id === noteId);
        if (!list || !note) return;
        const html = `<h3>${App.escapeHtml(list.name)}</h3><ul>${list.items.map(i => `<li>[ ] ${App.escapeHtml(i)}</li>`).join('')}</ul>`;
        Storage.updateNote(noteId, { content: `${note.content || ''}${html}`, updatedAt: new Date().toISOString() });
        App.toast('Checklist inserido.', 'success');
    },













    renderPrettyExport(el) {
        const collections = Storage.getCollections();
        const bundles = Storage.getBundles();
        el.innerHTML = `
        <div class="feature-card" style="background: rgba(15, 23, 42, 0.25); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                <div style="font-size: 2.5rem; background: linear-gradient(135deg, #2979FF, #00E5FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">📄</div>
                <div>
                    <h3 style="margin: 0; font-size: 1.3rem; font-weight: 750; color: var(--text-primary);">Exportação Premium (Export+)</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-secondary);">Gere arquivos elegantes e portáveis para compartilhar ou fazer backup de seus dados.</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <div>
                    <label style="display: block; font-size: 0.85em; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">📦 Fonte dos Dados</label>
                    <select id="pretty-source" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 15, 30, 0.6); color: var(--text-primary); outline: none;">
                        <option value="all">Tudo visível (Sem itens do cofre)</option>
                        ${collections.map(c=>`<option value="collection:${c.id}">Coleção: ${App.escapeHtml(c.name)}</option>`).join('')}
                        ${bundles.map(b=>`<option value="bundle:${b.id}">Bundle: ${App.escapeHtml(b.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 0.85em; font-weight: 700; color: var(--accent); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">🎨 Formato de Saída</label>
                    <select id="pretty-format" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 15, 30, 0.6); color: var(--text-primary); outline: none;">
                        <option value="html">🌐 HTML Autocontido (Layout visual moderno)</option>
                        <option value="md">📝 Markdown Puro (Compatível com Obsidian/Logseq)</option>
                        <option value="json">💻 JSON Puro (Dados estruturados brutos)</option>
                    </select>
                </div>
            </div>

            <div style="border: 1px solid rgba(255, 145, 0, 0.2); background: rgba(255, 145, 0, 0.04); border-radius: 8px; padding: 12px; margin-bottom: 24px; display: flex; align-items: start; gap: 12px;">
                <span style="font-size: 1.25rem;">⚠️</span>
                <p style="margin: 0; font-size: 0.85rem; color: #FF9100; line-height: 1.4;">
                    <strong>Nota de Segurança:</strong> Itens trancados dentro do Cofre Privado <strong>não</strong> serão incluídos na exportação padrão para garantir sua privacidade absoluta. Desbloqueie o cofre primeiro se precisar exportá-los.
                </p>
            </div>
            
            <div style="display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" onclick="FeatureHub.prettyExport()" style="padding: 12px 28px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    📥 Iniciar Exportação
                </button>
            </div>
        </div>`;
    },

    prettyExport() {
        const source = document.getElementById('pretty-source')?.value || 'all';
        const format = document.getElementById('pretty-format')?.value || 'html';
        let refs = this.getAllSuiteItems().map(({ type, item }) => ({ type, id: item.id }));
        let name = 'booklist_export';
        if (source.startsWith('collection:')) {
            const col = Storage.getCollections().find(c => c.id === source.split(':')[1]);
            refs = col?.items || [];
            name = col?.name || name;
        }
        if (source.startsWith('bundle:')) {
            const bundle = Storage.getBundles().find(b => b.id === source.split(':')[1]);
            refs = bundle?.items || [];
            name = bundle?.name || name;
        }
        const rows = refs.map(ref => ({ ...ref, item: this.getAllSuiteItems().find(i => i.type === ref.type && i.item.id === ref.id)?.item })).filter(r => r.item);
        if (format === 'json') return this.downloadText(`${name}.json`, JSON.stringify(rows, null, 2), 'application/json');
        if (format === 'md') {
            const md = `# ${name}\n\n` + rows.map(r => `## ${r.item.title || r.item.name}\n\n${r.type === 'bookmark' ? r.item.url : App.stripHtml(r.item.content || '')}\n`).join('\n');
            return this.downloadText(`${name}.md`, md, 'text/markdown');
        }
        const html = `<!doctype html><meta charset="utf-8"><title>${App.escapeHtml(name)}</title><body style="font-family:system-ui;max-width:860px;margin:40px auto;line-height:1.55"><h1>${App.escapeHtml(name)}</h1>${rows.map(r => `<article style="border-top:1px solid #ddd;padding:16px 0"><h2>${App.escapeHtml(r.item.title || r.item.name)}</h2>${r.type === 'bookmark' ? `<p><a href="${App.escapeHtml(r.item.url)}">${App.escapeHtml(r.item.url)}</a></p><p>${App.escapeHtml(r.item.description || '')}</p>` : `<div>${UI.sanitizeHtml(r.item.content || '')}</div>`}</article>`).join('')}</body>`;
        this.downloadText(`${name}.html`, html, 'text/html');
    },

    renderSnapshots(el) {
        const backups = Storage.getAutoBackups();
        el.innerHTML = `
        <div class="feature-card"><h3>Snapshots nomeados</h3><div class="form-row"><input id="snapshot-name" placeholder="Ex: antes-da-limpeza"><button class="btn btn-primary" onclick="FeatureHub.createSnapshot()">Criar snapshot</button></div></div>
        <div class="feature-card"><h3>Backups locais</h3>${backups.map(b => `<div class="feature-row"><div><strong>${App.escapeHtml(b.reason)}</strong><small>${new Date(b.createdAt).toLocaleString('pt-BR')} · ${b.counts?.bookmarks || 0} links · ${b.counts?.notes || 0} notas</small></div><button class="btn btn-sm btn-primary" onclick="Storage.exportAutoBackup('${b.id}')">Exportar</button></div>`).join('') || '<p class="text-muted">Nenhum snapshot.</p>'}</div>`;
    },

    createSnapshot() {
        const name = document.getElementById('snapshot-name')?.value.trim() || 'snapshot';
        Storage.createNamedSnapshot(name);
        App.toast('Snapshot criado.', 'success');
        App.renderPage('power');
    },

    renderShareCenter(el) {
        const items = [
            ...Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).map(item => ({ type: 'note', item })),
            ...Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() }).map(item => ({ type: 'bookmark', item }))
        ];
        el.innerHTML = `
        <div class="feature-card">
            <h3>Compartilhamento publico via Supabase</h3>
            <p>Cria uma pagina publica sem login para uma nota ou bookmark. Itens privados exigem cofre desbloqueado.</p>
            <div class="form-row"><select id="share-item">${this.itemOptionsHtml(items)}</select><button class="btn btn-primary" onclick="FeatureHub.createPublicShare()">Criar link publico</button></div>
            <div id="share-result"></div>
        </div>
        <div class="feature-card"><h3>Ja compartilhados</h3>${items.filter(({item}) => item.publicShareId).map(({type,item}) => {
            const url = `${location.origin}${location.pathname}?share=${item.publicShareId}`;
            return `<div class="feature-row"><div><strong>${App.escapeHtml(item.title)}</strong><small>${type} · ${App.escapeHtml(url)}</small></div><div class="row-actions"><button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${url}');App.toast('Link copiado.','success')">Copiar</button><button class="btn btn-sm btn-danger" onclick="FeatureHub.revokePublicShare('${type}','${item.id}')">Revogar</button></div></div>`;
        }).join('') || '<p class="text-muted">Nenhum item compartilhado.</p>'}</div>`;
    },

    async createPublicShare() {
        const [type, id] = (document.getElementById('share-item')?.value || '').split(':');
        if (!id) return App.toast('Escolha um item.', 'error');
        const result = document.getElementById('share-result');
        try {
            if (result) result.innerHTML = '<p class="text-muted">Criando link...</p>';
            const share = await Storage.createPublicShare(type, id);
            if (result) result.innerHTML = `<div class="mini-link-row"><a href="${share.url}" target="_blank" rel="noopener noreferrer">${share.url}</a><button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${share.url}')">Copiar</button></div>`;
            App.toast('Link publico criado.', 'success');
        } catch (err) {
            App.toast(err.message, 'error');
            if (result) result.innerHTML = `<p class="text-muted">${App.escapeHtml(err.message)}</p>`;
        }
    },

    async revokePublicShare(type, id) {
        if (!await BookListDialogs.confirm('Revogar este link público?', { title: 'Revogar compartilhamento', confirmText: 'Revogar' })) return;
        try {
            await Storage.revokePublicShare(type, id);
            App.toast('Link público revogado.', 'success');
            App.renderPage('power');
        } catch (error) { App.toast(error.message, 'error'); }
    },



    async importFromApps() {
        const files = Array.from(document.getElementById('app-import-file')?.files || []);
        const target = document.getElementById('app-import-target')?.value || 'auto';
        if (!files.length) return App.toast('Escolha um ou mais arquivos.', 'error');
        let notes = 0, bookmarks = 0;
        for (const file of files) {
            const text = await file.text();
            const name = file.name.toLowerCase();
            if (target === 'notes' || name.endsWith('.md') || name.endsWith('.txt')) {
                Storage.addNote({ title: file.name.replace(/\.[^.]+$/, ''), content: this.markdownishToHtml(text), folderId: 'default', inbox: true });
                notes++;
            } else if (name.endsWith('.enex')) {
                const doc = new DOMParser().parseFromString(text, 'text/xml');
                Array.from(doc.querySelectorAll('note')).forEach(n => {
                    Storage.addNote({ title: n.querySelector('title')?.textContent || 'Evernote', content: n.querySelector('content')?.textContent || '', folderId: 'default', inbox: true });
                    notes++;
                });
            } else if (name.endsWith('.html') || name.endsWith('.htm')) {
                const doc = new DOMParser().parseFromString(text, 'text/html');
                const links = Array.from(doc.querySelectorAll('a[href]'));
                if (links.length > 3 || target === 'bookmarks') {
                    links.forEach(a => { Storage.addBookmark({ title: a.textContent.trim() || a.href, url: a.href, folderId: 'default', inbox: true }); bookmarks++; });
                } else {
                    Storage.addNote({ title: file.name.replace(/\.[^.]+$/, ''), content: doc.body?.innerHTML || text, folderId: 'default', inbox: true }); notes++;
                }
            } else if (name.endsWith('.json')) {
                const data = JSON.parse(text);
                const rows = Array.isArray(data) ? data : (data.items || data.bookmarks || []);
                rows.forEach(row => {
                    const url = row.url || row.href || row.link;
                    if (url) { Storage.addBookmark({ title: row.title || row.name || url, url, description: row.excerpt || row.description || '', folderId: 'default', inbox: true }); bookmarks++; }
                });
            } else if (name.endsWith('.csv')) {
                text.split(/\r?\n/).slice(1).forEach(line => {
                    const cols = line.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
                    const url = cols.find(c => /^https?:\/\//i.test(c));
                    if (url) { Storage.addBookmark({ title: cols[0] || url, url, description: cols[2] || '', folderId: 'default', inbox: true }); bookmarks++; }
                });
            }
        }
        document.getElementById('app-import-result').innerHTML = `<p>${notes} nota(s) e ${bookmarks} bookmark(s) importados para Inbox.</p>`;
        App.toast('Importacao concluida.', 'success');
    },

    markdownishToHtml(text) {
        return text
            .replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>')
            .replace(/\n/g, '<br>');
    },




    renderDuplicates(el) {
        const bks = Storage.getBookmarks();
        const notes = Storage.getNotes();
        const urlMap = {};
        bks.forEach(b => {
            const key = (b.url || '').replace(/\/$/, '').toLowerCase();
            if (!key) return;
            urlMap[key] = urlMap[key] || [];
            urlMap[key].push(b);
        });
        const dupLinks = Object.values(urlMap).filter(group => group.length > 1);
        const similarNotes = [];
        for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
            const a = new Set(`${notes[i].title} ${Notes.stripHtml(notes[i].content || '')}`.toLowerCase().split(/\W+/).filter(w => w.length > 4));
            const b = new Set(`${notes[j].title} ${Notes.stripHtml(notes[j].content || '')}`.toLowerCase().split(/\W+/).filter(w => w.length > 4));
            const overlap = [...a].filter(w => b.has(w)).length;
            const score = overlap / Math.max(1, Math.min(a.size, b.size));
            if (score > 0.45) similarNotes.push([notes[i], notes[j], score]);
        }
        el.innerHTML = `
        <div class="feature-grid">
            <div class="feature-card"><h3>Bookmarks duplicados</h3><p>${dupLinks.length} grupo(s)</p></div>
            <div class="feature-card"><h3>Notas similares</h3><p>${similarNotes.length} par(es)</p></div>
        </div>
        <div class="feature-card"><h3>Duplicatas de links</h3>${dupLinks.map(group => `<div class="feature-row"><div><strong>${App.escapeHtml(group[0].url)}</strong><small>${group.map(g => App.escapeHtml(g.title)).join(' | ')}</small></div><button class="btn btn-sm btn-danger" onclick="FeatureHub.removeDuplicateBookmarks('${group.slice(1).map(g=>g.id).join(',')}')">Manter primeiro</button></div>`).join('') || '<p class="text-muted">Nenhuma duplicata exata.</p>'}</div>
        <div class="feature-card"><h3>Notas parecidas</h3>${similarNotes.slice(0, 20).map(([a,b,score]) => `<div class="feature-row"><div><strong>${App.escapeHtml(a.title)}</strong><small>${App.escapeHtml(b.title)} · ${Math.round(score*100)}%</small></div><button class="btn btn-sm btn-primary" onclick="FeatureHub.openItem('note','${a.id}')">Abrir</button></div>`).join('') || '<p class="text-muted">Nenhuma nota muito similar.</p>'}</div>`;
    },

    removeDuplicateBookmarks(ids) {
        ids.split(',').filter(Boolean).forEach(id => Storage.deleteBookmark(id));
        App.toast('Duplicatas movidas para lixeira.', 'success');
        App.renderPage('power');
    },

    getSyncHistoryHtml() {
        const rows = Storage.getSyncHistory ? Storage.getSyncHistory() : [];
        return `
        <div class="feature-card sync-history-section" style="margin-top: 24px; padding: 20px; border-radius: 12px; background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255, 255, 255, 0.04);">
            <h3 style="color: var(--accent); margin-bottom: 8px; font-size: 1.1rem; font-weight: 750;">🔄 Histórico de Sincronização Recente</h3>
            <p style="font-size: 0.9em; line-height: 1.4; opacity: 0.8; margin-bottom: 16px; color: var(--text-secondary);">Log das últimas operações de sincronização realizadas no banco de dados local.</p>
            <div style="max-height: 250px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; background: rgba(10, 15, 30, 0.5);">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85em; text-align: left; color: var(--text-secondary);">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                            <th style="padding: 12px; font-weight: bold; color: var(--text-primary);">Status</th>
                            <th style="padding: 12px; font-weight: bold; color: var(--text-primary);">Data/Hora</th>
                            <th style="padding: 12px; font-weight: bold; color: var(--text-primary); text-align: center;">Enviados</th>
                            <th style="padding: 12px; font-weight: bold; color: var(--text-primary); text-align: center;">Recebidos</th>
                            <th style="padding: 12px; font-weight: bold; color: var(--text-primary);">Mensagem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => {
                            const isSuccess = r.status === 'success';
                            const badgeBg = isSuccess ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 145, 0, 0.15)';
                            const badgeColor = isSuccess ? '#00E676' : '#FF9100';
                            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
                                <td style="padding: 12px;"><span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid rgba(255,255,255,0.04);">${r.status.toUpperCase()}</span></td>
                                <td style="padding: 12px; white-space: nowrap;"><small>${new Date(r.createdAt).toLocaleString('pt-BR')}</small></td>
                                <td style="padding: 12px; text-align: center; font-weight: 500; color: var(--text-primary);">${r.pushed || 0}</td>
                                <td style="padding: 12px; text-align: center; font-weight: 500; color: var(--text-primary);">${r.pulled || 0}</td>
                                <td style="padding: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><small title="${App.escapeHtml(r.message || '')}">${App.escapeHtml(r.message || '')}</small></td>
                            </tr>
                            `;
                        }).join('') || `<tr><td colspan="5" style="text-align: center; padding: 24px;" class="text-muted">Nenhum histórico de sincronização registrado ainda.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    renderSync(el) {
        const sync = Storage.getSyncStatus();
        const dirty = sync.dirtyCount || 0;
        
        let connectionBadge = sync.online 
            ? '<span style="background: rgba(0, 230, 118, 0.15); color: #00E676; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; border: 1px solid rgba(0, 230, 118, 0.2);">🌐 ONLINE</span>' 
            : '<span style="background: rgba(255, 145, 0, 0.15); color: #FF9100; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; border: 1px solid rgba(255, 145, 0, 0.2);">⚠️ OFFLINE</span>';
            
        let accountStatus = '';
        if (sync.configured && sync.authenticated) {
            accountStatus = `<span style="background: rgba(41, 121, 255, 0.15); color: #2979FF; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; border: 1px solid rgba(41, 121, 255, 0.2);">✨ CONECTADO (${App.escapeHtml(sync.email || '')})</span>`;
        } else if (sync.configured) {
            accountStatus = '<span style="background: rgba(255, 145, 0, 0.15); color: #FF9100; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; border: 1px solid rgba(255, 145, 0, 0.2);">⚠️ REQUER AUTENTICAÇÃO</span>';
        } else {
            accountStatus = '<span style="background: rgba(255, 23, 68, 0.15); color: #FF1744; padding: 4px 10px; border-radius: 20px; font-size: 0.8em; font-weight: 700; border: 1px solid rgba(255, 23, 68, 0.2);">❌ NÃO CONFIGURADO</span>';
        }

        let syncStatusHtml = '';
        if (sync.status === 'synced') {
            syncStatusHtml = '<span style="color: #00E676; font-weight: 600;">Sincronizado</span>';
        } else if (sync.status === 'syncing') {
            syncStatusHtml = '<span style="color: #2979FF; font-weight: 600;">Sincronizando...</span>';
        } else if (sync.status === 'pending') {
            syncStatusHtml = '<span style="color: #FF9100; font-weight: 600;">Pendente de Envio</span>';
        } else if (sync.status === 'off') {
            syncStatusHtml = '<span style="color: var(--text-secondary); font-weight: 600;">Desativado</span>';
        } else {
            syncStatusHtml = `<span style="color: #FF1744; font-weight: 600;">Erro (${sync.status})</span>`;
        }

        el.innerHTML = `
        <div class="feature-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <!-- Status Card -->
            <div class="feature-card" style="background: rgba(15, 23, 42, 0.25); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(8px);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <span style="font-size: 2rem;">🔄</span>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 750; color: var(--text-primary);">Status de Sincronização</h3>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem; color: var(--text-secondary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 8px;">
                        <span>Conectividade local:</span>
                        ${connectionBadge}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 8px;">
                        <span>Conta Cloud (Supabase):</span>
                        ${accountStatus}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 8px;">
                        <span>Estado atual:</span>
                        ${syncStatusHtml}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 8px;">
                        <span>Última Sincronização:</span>
                        <span style="font-weight: 500; color: var(--text-primary); font-family: monospace;">
                            ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Detalhes:</span>
                        <small style="text-align: right; color: var(--text-secondary); max-width: 60%;">${App.escapeHtml(sync.message || '')}</small>
                    </div>
                </div>
            </div>

            <!-- Actions Card -->
            <div class="feature-card" style="background: rgba(15, 23, 42, 0.25); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); backdrop-filter: blur(8px); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 2rem;">⚡</span>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 750; color: var(--text-primary);">Ações Rápidas</h3>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">
                        O Booklist sincroniza alterações automaticamente em segundo plano. Se você acabou de fazer modificações offline e deseja forçar o envio imediato, use os botões abaixo.
                    </p>
                    
                    <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent);">ALTERAÇÕES PENDENTES</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">Aguardando envio para nuvem</div>
                        </div>
                        <div style="font-size: 1.8rem; font-weight: 800; color: ${dirty > 0 ? '#FF9100' : 'var(--text-secondary)'}; font-family: monospace;">${dirty}</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="btn btn-primary btn-sync-now" onclick="FeatureHub.triggerSyncNow()" style="width: 100%; padding: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        🔄 Sincronizar Agora
                    </button>
                    <button class="btn btn-secondary" onclick="FeatureHub.triggerForceReupload()" style="width: 100%; padding: 10px; font-size: 0.9em; font-weight: 600; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1);">
                        ⚠️ Forçar Reenvio Completo
                    </button>
                </div>
            </div>
        </div>
        ${this.getSyncHistoryHtml()}`;
    },

    async triggerSyncNow() {
        const btn = document.querySelector('.btn-sync-now');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '🔄 Sincronizando...';
        }
        try {
            const res = await Storage.syncNow();
            if (res.ok === false) {
                App.toast(res.message, 'warning');
            } else {
                App.toast(`Sincronização concluída! ${res.pulled} recebidos, ${res.pushed} enviados.`, 'success');
            }
        } catch (err) {
            App.toast(`Erro na sincronização: ${err.message}`, 'error');
        } finally {
            App.renderPage('power');
        }
    },

    async triggerForceReupload() {
        if (!await BookListDialogs.confirm('Tem certeza de que deseja forçar o reenvio completo de todos os dados locais? Isso substituirá as versões remotas se houver conflitos.', { title: 'Forçar reenvio completo', confirmText: 'Reenviar tudo' })) return;
        try {
            const dirtyCount = Storage.forceLocalSync();
            App.toast(`${dirtyCount} itens marcados para reenvio completo. Sincronizando...`, 'info');
            const res = await Storage.syncNow();
            if (res.ok === false) {
                App.toast(res.message, 'warning');
            } else {
                App.toast(`Forçar reenvio concluído! ${res.pushed} enviados.`, 'success');
            }
        } catch (err) {
            App.toast(`Erro ao forçar reenvio: ${err.message}`, 'error');
        } finally {
            App.renderPage('power');
        }
    },

    renderShortcuts(el) {
        el.innerHTML = `
        <div class="shortcut-layout">
            <div class="shortcut-grid">
                <div class="shortcut-category">
                    <h4>🧭 Navegação & Comando</h4>
                    <div class="shortcut-row">
                        <span>Abrir Command Palette</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>K</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Abrir Cheatsheet</span>
                        <div class="shortcut-keys"><kbd>?</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Ir para Home</span>
                        <div class="shortcut-keys"><kbd>Alt</kbd><kbd>H</kbd></div>
                    </div>
                </div>
                <div class="shortcut-category">
                    <h4>✍️ Criação & Edição</h4>
                    <div class="shortcut-row">
                        <span>Nova Nota</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>N</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Novo Favorito (Link)</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>L</kbd></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Formatação Básica (Editor)</span>
                        <div class="shortcut-keys"><kbd>Ctrl</kbd><kbd>B</kbd><kbd>I</kbd><kbd>U</kbd></div>
                    </div>
                </div>
                <div class="shortcut-category">
                    <h4>📋 Gestão Visual</h4>
                    <div class="shortcut-row">
                        <span>Reordenar/Mover no Kanban</span>
                        <div class="shortcut-keys"><small class="text-muted">Arrastar Cards</small></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Ações Rápidas (Lista)</span>
                        <div class="shortcut-keys"><small class="text-muted">Clique Direito</small></div>
                    </div>
                    <div class="shortcut-row">
                        <span>Foco de Leitura</span>
                        <div class="shortcut-keys"><kbd>F</kbd></div>
                    </div>
                </div>
            </div>
            
            <div class="shortcut-category">
                <h4>📱 Mobile & PWA Offline</h4>
                <p style="font-size: 0.9em; line-height: 1.6; opacity: 0.8; margin-bottom: 16px; color: var(--text-secondary);">
                    O Booklist foi projetado para funcionar 100% offline localmente como um PWA (Progressive Web App). Siga as instruções abaixo para instalá-lo no seu celular e acessá-lo como um aplicativo nativo:
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                    <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 16px;">
                        <h5 style="color: var(--accent); margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 700;">🤖 Android (Chrome / Edge)</h5>
                        <ol style="font-size: 0.85em; margin: 0; padding-left: 16px; line-height: 1.6; color: var(--text-secondary);">
                            <li>Abra o navegador no celular e acesse o endereço do app.</li>
                            <li>Toque no menu de três pontos <strong style="color: var(--text-primary);">⋮</strong> no canto superior direito.</li>
                            <li>Selecione <strong style="color: var(--text-primary);">"Adicionar à tela inicial"</strong> ou <strong style="color: var(--text-primary);">"Instalar aplicativo"</strong>.</li>
                            <li>O ícone aparecerá na sua tela inicial, rodando em tela cheia e offline.</li>
                        </ol>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 16px;">
                        <h5 style="color: var(--accent); margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 700;">🍎 iOS (Safari)</h5>
                        <ol style="font-size: 0.85em; margin: 0; padding-left: 16px; line-height: 1.6; color: var(--text-secondary);">
                            <li>Abra o Safari no iPhone e acesse o endereço do app.</li>
                            <li>Toque no botão <strong style="color: var(--text-primary);">Compartilhar</strong> (ícone de quadrado com seta para cima no rodapé).</li>
                            <li>Role para baixo e toque em <strong style="color: var(--text-primary);">"Adicionar à Tela de Início"</strong>.</li>
                            <li>Toque em "Adicionar" no canto superior direito. O app abrirá sem barra de navegação!</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderArchive(el) {
        const archivedBks = Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked() }).filter(b => b.readingStatus === 'arquivado' || b.archived);
        const archivedNotes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).filter(n => n.status === 'arquivado' || n.archived);
        const activeItems = this.getAllSuiteItems().filter(({ type, item }) => type !== 'project' && !item.archived && item.status !== 'arquivado' && item.readingStatus !== 'arquivado');
        el.innerHTML = `
        <div class="feature-card"><h3>Arquivo Morto</h3><p>Guarde o que nao precisa aparecer no fluxo diario, sem deletar.</p><div class="form-row"><select id="archive-item">${this.itemOptionsHtml(activeItems)}</select><button class="btn btn-primary" onclick="FeatureHub.archiveSelected()">Arquivar</button></div></div>
        <div class="feature-card"><h3>Arquivados</h3>${[...archivedNotes.map(n=>['note',n]), ...archivedBks.map(b=>['bookmark',b])].map(([type,item]) => `<div class="feature-row"><div><strong>${App.escapeHtml(item.title)}</strong><small>${type}</small></div><div class="row-actions"><button class="btn btn-sm btn-primary" onclick="FeatureHub.openItem('${type}','${item.id}')">Abrir</button><button class="btn btn-sm btn-secondary" onclick="FeatureHub.unarchiveItem('${type}','${item.id}')">Restaurar</button></div></div>`).join('') || '<p class="text-muted">Nada arquivado.</p>'}</div>`;
    },

    archiveSelected() {
        const [type, id] = (document.getElementById('archive-item')?.value || '').split(':');
        if (!id) return;
        if (type === 'note') Storage.updateNote(id, { status: 'arquivado', archived: true });
        if (type === 'bookmark') Storage.updateBookmark(id, { readingStatus: 'arquivado', archived: true, smartEnabled: false });
        App.toast('Item arquivado.', 'success');
        App.renderPage('power');
    },

    unarchiveItem(type, id) {
        if (type === 'note') Storage.updateNote(id, { status: 'ideias', archived: false });
        if (type === 'bookmark') Storage.updateBookmark(id, { readingStatus: 'novo', archived: false });
        App.renderPage('power');
    },

    renderAttachments(el) {
        const notes = Storage.getNotes();
        const atts = Storage.getAttachments();
        el.innerHTML = `<div class="feature-card"><h3>Anexos locais</h3><div class="form-row"><select id="att-note">${notes.map(n=>`<option value="${n.id}">${App.escapeHtml(n.title)}</option>`).join('')}</select><input id="att-file" type="file"><button class="btn btn-primary" onclick="FeatureHub.addAttachment()">Anexar</button></div></div>
        <div class="feature-card"><h3>Anexos</h3>${atts.map(a=>`<div class="feature-row"><a href="${a.dataUrl}" download="${App.escapeHtml(a.name)}">${App.escapeHtml(a.name)}</a><button class="btn btn-sm btn-danger" onclick="Storage.deleteAttachment('${a.id}');App.renderPage('power')">Apagar</button></div>`).join('') || '<p class="text-muted">Nenhum anexo.</p>'}</div>`;
    },

    addAttachment() {
        const file = document.getElementById('att-file').files[0];
        const noteId = document.getElementById('att-note').value;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { Storage.addAttachment({ noteId, name: file.name, type: file.type, size: file.size, dataUrl: reader.result }); App.renderPage('power'); };
        reader.readAsDataURL(file);
    },



    renderVersions(el) {
        const notes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() });
        el.innerHTML = `<div class="feature-card"><h3>Histórico de versões</h3>${notes.map(n => `
            <div class="feature-row"><span>📝 ${App.escapeHtml(n.title)} · ${(n.versions||[]).length} versão(ões)</span><button class="btn btn-sm btn-secondary" onclick="FeatureHub.showVersions('${n.id}')">Ver</button></div>
        `).join('') || '<p class="text-muted">Nenhuma nota.</p>'}</div><div id="version-detail"></div>`;
    },

    showVersions(id) {
        const note = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked() }).find(n => n.id === id);
        const el = document.getElementById('version-detail');
        if (!note || !el) return;
        el.innerHTML = `<div class="feature-card"><h3>Versões de ${App.escapeHtml(note.title)}</h3>${(note.versions||[]).map(v => `
            <div class="feature-row"><span>${new Date(v.createdAt).toLocaleString('pt-BR')} · ${App.escapeHtml(v.title)}</span><button class="btn btn-sm btn-primary" onclick="FeatureHub.restoreVersion('${note.id}','${v.id}')">Restaurar</button></div>
        `).join('') || '<p class="text-muted">Ainda não há versões salvas. Elas aparecem durante edições longas.</p>'}</div>`;
    },

    restoreVersion(noteId, versionId) {
        const notes = Storage._getRawList(Storage.KEYS.NOTES);
        const note = notes.find(n => n.id === noteId);
        const version = note?.versions?.find(v => v.id === versionId);
        if (!note || !version) return;
        Object.assign(note, { title: version.title, content: version.content, updatedAt: new Date().toISOString() });
        Storage.saveNotes(notes);
        App.toast('Versão restaurada.', 'success');
        App.renderPage('power');
    },



    renderSecureExport(el) {
        el.innerHTML = `
        <div class="feature-card">
            <h3>Export seguro</h3>
            <p>Gera um JSON criptografado com uma senha temporária.</p>
            <div class="form-row">
                <input id="secure-pass" type="password" placeholder="Senha do export">
                <button class="btn btn-primary" onclick="FeatureHub.secureExport()">Exportar criptografado</button>
            </div>
        </div>
        ${this.getSyncHistoryHtml()}`;
    },



    async secureExport() {
        const pass = document.getElementById('secure-pass').value;
        if (!pass) return App.toast('Digite uma senha.', 'error');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await Storage._deriveVaultKey(pass, salt);
        const payload = JSON.stringify({ notes: Storage.getNotes({ includePrivate: true }), bookmarks: Storage.getBookmarks({ includePrivate: true }), exportedAt: new Date().toISOString() });
        const encrypted = await Storage._encryptText(payload, key);
        const blob = new Blob([JSON.stringify({ type: 'booklist-secure-export', salt: Storage._bytesToBase64(salt), encrypted }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `booklist_secure_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    },

    renderTimeTravel(el) {
        const bks = Storage.getBookmarks({ includePrivate: Storage.isVaultUnlocked ? Storage.isVaultUnlocked() : true });
        const notes = Storage.getNotes({ includePrivate: Storage.isVaultUnlocked ? Storage.isVaultUnlocked() : true });
        const personal = Storage.getPersonalData ? Storage.getPersonalData() : {};
        const money = personal.money || [];
        const records = Storage.getProfessionalRecords ? Storage.getProfessionalRecords() : [];
        
        const allDates = [
            ...bks.map(b => b.createdAt || b.updatedAt),
            ...notes.map(n => n.createdAt || n.updatedAt),
            ...money.map(m => m.date || m.createdAt),
            ...records.map(r => r.createdAt || r.updatedAt)
        ].map(d => new Date(d).getTime()).filter(t => !isNaN(t));
        
        const now = new Date();
        const minTime = allDates.length > 0 ? Math.min(...allDates) : now.getTime() - 365 * 24 * 60 * 60 * 1000;
        const maxTime = now.getTime();
        
        const finalMinTime = Math.min(minTime, maxTime - 24 * 60 * 60 * 1000);
        const isTimeTravelActive = !!window.TimeTravelDate;
        const activeTime = isTimeTravelActive ? window.TimeTravelDate.getTime() : maxTime;
        
        const formatDate = (time) => {
            return new Date(time).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
        };
        
        const formatDateIso = (time) => {
            return new Date(time).toLocaleDateString('sv-SE').slice(0, 10);
        };
        
        const getCountsAtTime = (time) => {
            const cutoff = new Date(time);
            const bCount = bks.filter(b => new Date(b.createdAt || b.updatedAt) <= cutoff).length;
            const nCount = notes.filter(n => new Date(n.createdAt || n.updatedAt) <= cutoff).length;
            const mCount = money.filter(m => new Date(m.date || m.createdAt) <= cutoff).length;
            const rCount = records.filter(r => new Date(r.createdAt || r.updatedAt) <= cutoff).length;
            return { bCount, nCount, mCount, rCount, total: bCount + nCount + mCount + rCount };
        };
        
        const counts = getCountsAtTime(activeTime);
        const currentCounts = {
            bCount: bks.length,
            nCount: notes.length,
            mCount: money.length,
            rCount: records.length,
            total: bks.length + notes.length + money.length + records.length
        };
        
        el.innerHTML = `
        <div class="time-travel-console glass-panel" style="padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(20,20,35,0.6); position: relative; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div class="time-portal-grid-bg" style="position: absolute; inset: 0; background-image: radial-gradient(rgba(224, 64, 251, 0.08) 1px, transparent 0); background-size: 16px 16px; pointer-events: none; opacity: 0.5;"></div>
            <div style="position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 300px; height: 300px; background: radial-gradient(circle, rgba(224, 64, 251, 0.2) 0%, transparent 70%); filter: blur(50px); pointer-events: none; border-radius: 50%;"></div>
            
            <div style="text-align: center; margin-bottom: 24px; position: relative; z-index: 1;">
                <span class="module-kicker" style="color: #E040FB;">Módulo Quântico</span>
                <h2 style="margin: 4px 0 0 0; font-size: 1.8rem; letter-spacing: 1px; color: #fff; text-shadow: 0 0 10px rgba(224, 64, 251, 0.5);">⏳ Máquina do Tempo</h2>
                <p style="margin: 6px auto 0 auto; max-width: 600px; font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                    Ative o motor quântico temporal para viajar ao passado. Todo o ecossistema (Bookmarks, Notas, Money Pessoal e Registros) se reorganizará instantaneamente para mostrar a base exatamente como estava na data selecionada.
                </p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 24px; position: relative; z-index: 1; max-width: 800px; margin: 0 auto;">
                <div class="time-switch-panel" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; backdrop-filter: blur(8px);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="time-radar-ping ${isTimeTravelActive ? 'active' : ''}" style="width: 14px; height: 14px; background: ${isTimeTravelActive ? '#E040FB' : '#455A64'}; border-radius: 50%; box-shadow: 0 0 8px ${isTimeTravelActive ? '#E040FB' : 'transparent'}; animation: ${isTimeTravelActive ? 'pulse-time-radar 1.5s infinite' : 'none'};"></div>
                        <div>
                            <strong style="font-size: 1rem; color: #fff;">Status do Motor Temporal</strong>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${isTimeTravelActive ? 'Dobrando o espaço-tempo local. Você está no passado.' : 'Motor ocioso. Exibindo dados no presente.'}</div>
                        </div>
                    </div>
                    
                    <label class="switch-sci-fi" style="position: relative; display: inline-block; width: 68px; height: 34px;">
                        <input type="checkbox" id="time-travel-toggle" ${isTimeTravelActive ? 'checked' : ''} onchange="FeatureHub.toggleTimeTravel(this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span class="slider-sci-fi" style="position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 34px; transition: .4s; box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);"></span>
                    </label>
                </div>
                
                <div class="time-slider-section" style="opacity: ${isTimeTravelActive ? '1' : '0.45'}; pointer-events: ${isTimeTravelActive ? 'all' : 'none'}; transition: all 0.4s ease;">
                    <div style="display: flex; justify-content: center; margin-bottom: 24px; gap: 12px;">
                        <div class="nixie-display" style="background: #0d0d1a; border: 2px solid rgba(224, 64, 251, 0.3); box-shadow: 0 0 15px rgba(224, 64, 251, 0.15); padding: 12px 24px; border-radius: 8px; font-family: monospace; text-align: center;">
                            <div style="font-size: 0.65rem; color: rgba(224, 64, 251, 0.7); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Data Destino</div>
                            <strong id="nixie-target-date" style="font-size: 1.5rem; font-weight: 700; color: #E040FB; text-shadow: 0 0 8px rgba(224, 64, 251, 0.8);">${formatDate(activeTime)}</strong>
                            <div id="nixie-target-iso" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">[ ${formatDateIso(activeTime)} ]</div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 24px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
                        <input type="range" id="chrono-range-slider" min="${finalMinTime}" max="${maxTime}" value="${activeTime}" step="86400000" style="width: 100%; height: 8px; border-radius: 4px; outline: none; transition: background 450ms ease-in-out; cursor: pointer; -webkit-appearance: none; background: rgba(224, 64, 251, 0.15);" oninput="FeatureHub.onTimeTravelSliderInput(this.value)" onchange="FeatureHub.commitTimeTravel(this.value)">
                        
                        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-top: 8px;">
                            <span>⏮️ ${formatDateIso(finalMinTime)}</span>
                            <span style="color: #E040FB;">Arraste para viajar</span>
                            <span>⏭️ Hoje (${formatDateIso(maxTime)})</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
                        <div class="holo-stat-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; text-align: center; transition: all 0.3s ease;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">🔖 Bookmarks</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #fff; margin: 4px 0;" id="holo-bks">${counts.bCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.bCount}</span></div>
                            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4);" id="holo-bks-percent">${Math.round((counts.bCount / (currentCounts.bCount || 1)) * 100)}% ativos</div>
                        </div>
                        
                        <div class="holo-stat-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">📝 Notas</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #fff; margin: 4px 0;" id="holo-notes">${counts.nCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.nCount}</span></div>
                            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4);" id="holo-notes-percent">${Math.round((counts.nCount / (currentCounts.nCount || 1)) * 100)}% ativas</div>
                        </div>
                        
                        <div class="holo-stat-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">💸 Money Pessoal</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #fff; margin: 4px 0;" id="holo-money">${counts.mCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.mCount}</span></div>
                            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4);" id="holo-money-percent">${Math.round((counts.mCount / (currentCounts.mCount || 1)) * 100)}% ativos</div>
                        </div>
                        
                        <div class="holo-stat-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">💼 Profissional</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: #fff; margin: 4px 0;" id="holo-recs">${counts.rCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.rCount}</span></div>
                            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4);" id="holo-recs-percent">${Math.round((counts.rCount / (currentCounts.rCount || 1)) * 100)}% ativos</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            #chrono-range-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #E040FB;
                border: 2px solid #fff;
                cursor: pointer;
                box-shadow: 0 0 10px #E040FB;
                transition: transform 0.1s ease;
            }
            #chrono-range-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }
            
            .slider-sci-fi:before {
                position: absolute;
                content: "";
                height: 26px;
                width: 26px;
                left: 3px;
                bottom: 3px;
                background-color: #455A64;
                border-radius: 50%;
                transition: .4s;
                box-shadow: 0 2px 4px rgba(0,0,0,0.8);
            }
            input:checked + .slider-sci-fi {
                background-color: rgba(224, 64, 251, 0.2);
                border-color: rgba(224, 64, 251, 0.4);
            }
            input:checked + .slider-sci-fi:before {
                transform: translateX(34px);
                background-color: #E040FB;
                box-shadow: 0 0 10px #E040FB;
            }
            
            @keyframes pulse-time-radar {
                0% { box-shadow: 0 0 0 0px rgba(224, 64, 251, 0.6); }
                100% { box-shadow: 0 0 0 10px rgba(224, 64, 251, 0); }
            }
        </style>
        `;
        
        this.timeTravelDataBounds = { bks, notes, money, records, currentCounts };
    },
    
    toggleTimeTravel(checked) {
        if (checked) {
            const slider = document.getElementById('chrono-range-slider');
            const sliderValue = slider ? Number(slider.value) : new Date().getTime();
            window.TimeTravelDate = new Date(sliderValue);
            App.toast('🕰️ Viagem Temporal Iniciada! Os dados foram retrocedidos.', 'info');
        } else {
            window.TimeTravelDate = null;
            App.toast('🚀 Retornando ao Presente! O fluxo temporal foi normalizado.', 'success');
        }
        App.renderPage('power');
    },
    
    onTimeTravelSliderInput(value) {
        const time = Number(value);
        const formatDate = (t) => {
            return new Date(t).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
        };
        const formatDateIso = (t) => {
            return new Date(t).toLocaleDateString('sv-SE').slice(0, 10);
        };
        
        const nixie = document.getElementById('nixie-target-date');
        const nixieIso = document.getElementById('nixie-target-iso');
        if (nixie) nixie.textContent = formatDate(time);
        if (nixieIso) nixieIso.textContent = `[ ${formatDateIso(time)} ]`;
        
        if (this.timeTravelDataBounds) {
            const { bks, notes, money, records, currentCounts } = this.timeTravelDataBounds;
            const cutoff = new Date(time);
            
            const bCount = bks.filter(b => new Date(b.createdAt || b.updatedAt) <= cutoff).length;
            const nCount = notes.filter(n => new Date(n.createdAt || n.updatedAt) <= cutoff).length;
            const mCount = money.filter(m => new Date(m.date || m.createdAt) <= cutoff).length;
            const rCount = records.filter(r => new Date(r.createdAt || r.updatedAt) <= cutoff).length;
            
            const bEl = document.getElementById('holo-bks');
            const nEl = document.getElementById('holo-notes');
            const mEl = document.getElementById('holo-money');
            const rEl = document.getElementById('holo-recs');
            
            if (bEl) bEl.innerHTML = `${bCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.bCount}</span>`;
            if (nEl) nEl.innerHTML = `${nCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.nCount}</span>`;
            if (mEl) mEl.innerHTML = `${mCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.mCount}</span>`;
            if (rEl) rEl.innerHTML = `${rCount} / <span style="font-size:0.8rem; color: var(--text-muted);">${currentCounts.rCount}</span>`;
            
            const bPctEl = document.getElementById('holo-bks-percent');
            const nPctEl = document.getElementById('holo-notes-percent');
            const mPctEl = document.getElementById('holo-money-percent');
            const rPctEl = document.getElementById('holo-recs-percent');
            
            if (bPctEl) bPctEl.textContent = `${Math.round((bCount / (currentCounts.bCount || 1)) * 100)}% ativos`;
            if (nPctEl) nPctEl.textContent = `${Math.round((nCount / (currentCounts.nCount || 1)) * 100)}% ativas`;
            if (mPctEl) mPctEl.textContent = `${Math.round((mCount / (currentCounts.mCount || 1)) * 100)}% ativos`;
            if (rPctEl) rPctEl.textContent = `${Math.round((rCount / (currentCounts.rCount || 1)) * 100)}% ativos`;
        }
        
        if (window.TimeTravelDate) {
            window.TimeTravelDate = new Date(time);
        }
    },
    
    commitTimeTravel(value) {
        if (window.TimeTravelDate) {
            window.TimeTravelDate = new Date(Number(value));
            App.toast('🕰️ Coordenadas Temporais Atualizadas!', 'info');
            App.renderPage('power');
        }
    }
};
