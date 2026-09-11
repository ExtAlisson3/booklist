/* Cross-domain centers: reuse existing data instead of creating isolated silos. */
const OperationalCenters = {
    renderToday(main) {
        const today = new Date().toLocaleDateString('sv-SE');
        const personal = Storage.getPersonalData();
        const records = Storage.getProfessionalRecords();
        const focus = Storage.getDailyFocus().filter(item => !item.done);
        const agenda = records.filter(item => item.moduleKey === 'schedule' && String(item.fields?.date || item.eventDate || '').slice(0, 10) >= today && !['concluído','cancelado'].includes(item.status)).sort((a, b) => String(a.fields?.date || '').localeCompare(String(b.fields?.date || ''))).slice(0, 8);
        const money = records.filter(item => item.moduleKey === 'finance' && ['pendente','atrasado'].includes(item.status)).slice(0, 6);
        const inbox = [...Storage.getNotes().filter(item => item.inbox).map(item => ({ ...item, kind: 'note' })), ...Storage.getBookmarks().filter(item => item.inbox).map(item => ({ ...item, kind: 'bookmark' })), ...(personal.inbox || []).filter(item => item.status !== 'resolvido').map(item => ({ ...item, title: item.text, kind: 'personal' }))].slice(0, 8);
        const habits = (personal.habits || []).filter(habit => !personal.habitLogs?.[habit.id]?.[today]);
        main.innerHTML = `<div class="module-page center-page"><div class="module-hero"><div><span class="module-kicker">Visão unificada</span><h2>Hoje e Pendências</h2><p>Prioridades pessoais e operação técnica em uma fila única, sem duplicar seus dados.</p></div><button class="btn btn-primary" onclick="App.addDailyFocus()">+ Prioridade</button></div><div class="center-metrics"><button onclick="App.navigate('dashboard')"><strong>${focus.length}</strong><span>Prioridades</span></button><button onclick="App.navigate('personal-inbox')"><strong>${inbox.length}</strong><span>Capturas</span></button><button onclick="App.navigate('habits')"><strong>${habits.length}</strong><span>Hábitos pendentes</span></button><button onclick="App.navigate('schedule')"><strong>${agenda.length}</strong><span>Agenda técnica</span></button><button onclick="App.navigate('finance')"><strong>${money.length}</strong><span>Financeiro</span></button></div><div class="center-columns">${this.section('Prioridades', focus, item => item.title, 'dashboard')}${this.section('Próximos compromissos', agenda, item => `${item.title} · ${item.status}`, 'schedule')}${this.section('Capturas a organizar', inbox, item => item.title || 'Sem título', 'power')}${this.section('Hábitos de hoje', habits, item => item.name || item.title, 'habits')}</div></div>`;
    },

    section(title, items, label, page) {
        return `<section class="center-section"><div class="dash-section-header"><h2>${App.escapeHtml(title)}</h2><button class="btn btn-sm btn-secondary" onclick="App.navigate('${page}')">Abrir</button></div>${items.length ? items.map(item => `<div class="center-row"><span>${App.escapeHtml(label(item) || 'Item')}</span><small>${item.updatedAt || item.createdAt ? new Date(item.updatedAt || item.createdAt).toLocaleDateString('pt-BR') : ''}</small></div>`).join('') : '<p class="text-muted">Nada pendente.</p>'}</section>`;
    },

    renderOs360(main) {
        const clients = Storage.getProfessionalRecords('clients');
        const selected = this.clientId || clients[0]?.id || '';
        const client = clients.find(item => item.id === selected);
        const linked = client ? Storage.getProfessionalRecords().filter(item => item.clientId === client.id || item.id === client.id) : [];
        const groups = ['equipment','tickets','budgets','finance','schedule'].map(key => [key, linked.filter(item => item.moduleKey === key)]);
        main.innerHTML = `<div class="module-page center-page"><div class="module-hero"><div><span class="module-kicker">Jornada técnica completa</span><h2>OS 360</h2><p>Cliente, equipamentos, atendimentos, orçamento, pagamento e garantia no mesmo contexto.</p></div><button class="btn btn-primary" onclick="App.createProfessionalRecord('tickets','','${selected}')" ${selected ? '' : 'disabled'}>Nova OS</button></div><div class="center-selector"><label>Cliente</label><select onchange="OperationalCenters.clientId=this.value;App.renderPage('os360')"><option value="">Selecione</option>${clients.map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${App.escapeHtml(item.title)}</option>`).join('')}</select></div>${client ? `<section class="center-profile"><div><span>Cliente</span><h3>${App.escapeHtml(client.title)}</h3><p>${App.escapeHtml(client.fields?.phone || client.fields?.email || 'Sem contato informado')}</p></div><button class="btn btn-secondary" onclick="App.openClientDetail('${client.id}')">Abrir cadastro</button></section><div class="center-columns">${groups.map(([key, items]) => { const def = App.getProfessionalModules()[key]; return this.section(def.title, items, item => `${item.title} · ${item.status}`, key); }).join('')}</div>` : '<div class="empty-state"><h3>Escolha um cliente</h3><p>A jornada completa será montada com os registros já vinculados.</p></div>'}</div>`;
    },

    renderIntegrations(main) {
        const settings = Storage.getModules().integrationSettings || {};
        const providers = [
            ['jikan','Jikan / MyAnimeList','Anime e mangá','Público'],
            ['openlibrary','OpenLibrary','Livros e novels','Público'],
            ['anilist','AniList','Anime e mangá','Planejado'],
            ['tmdb','TMDB','Filmes e séries', settings.tmdb?.credential ? 'Com chave' : 'Requer chave'],
            ['mal','MyAnimeList OAuth','Lista pessoal e progresso', settings.mal?.credential ? 'Com Client ID' : 'Requer Client ID']
        ];
        main.innerHTML = `<div class="module-page center-page"><div class="module-hero"><div><span class="module-kicker">Provedores externos</span><h2>Central de Integrações</h2><p>Catálogos, credenciais e estado de conexão com uma única configuração.</p></div><button class="btn btn-primary" onclick="App.navigate('tracker')">Pesquisar obra</button></div><div class="integration-grid">${providers.map(([id,name,scope,state]) => `<article class="integration-card"><div><span class="integration-dot ${['jikan','openlibrary','anilist'].includes(id) || settings[id]?.credential ? 'ok' : ''}"></span><h3>${name}</h3></div><p>${scope}</p><small>${settings[id]?.enabled || settings[id]?.credential ? 'Ativado' : state}</small>${['tmdb','mal'].includes(id) ? `<button class="btn btn-sm btn-secondary" onclick="OperationalCenters.configureIntegration('${id}','${name}')">Configurar</button>` : '<span class="integration-ready">Disponível</span>'}</article>`).join('')}</div><section class="center-section"><h2>Como os dados entram</h2><p class="text-muted">A pesquisa usa o tipo da obra para selecionar o provedor, mostra uma prévia e só aplica os campos após sua escolha. Resultados não substituem conteúdo salvo sem confirmação.</p></section></div>`;
    },

    async configureIntegration(id, name) {
        const modules = Storage.getModules();
        const current = modules.integrationSettings?.[id] || {};
        const result = await BookListDialogs.open({ title: `Configurar ${name}`, description: 'A credencial fica no armazenamento sincronizado. Use somente uma chave pública de cliente.', fields: [{ name: 'credential', label: id === 'mal' ? 'Client ID' : 'API key', value: current.credential || '', required: true }], confirmText: 'Salvar' });
        if (!result) return;
        modules.integrationSettings = { ...(modules.integrationSettings || {}), [id]: { enabled: true, credential: result.credential, updatedAt: new Date().toISOString() } };
        Storage.saveModules(modules);
        App.toast('Integração salva e incluída na sincronização.', 'success');
        App.renderPage('integrations');
    },

    renderAutomations(main) {
        const rules = Storage.getRules();
        const templates = Storage.getCustomTemplates();
        const checklists = Storage.getChecklists();
        main.innerHTML = `<div class="module-page center-page"><div class="module-hero"><div><span class="module-kicker">Reutilização e regras</span><h2>Automações e Modelos</h2><p>Regras, modelos, snippets, checklists e runbooks reunidos em um único ponto.</p></div><button class="btn btn-primary" onclick="FeatureHub.currentTab='automations';App.navigate('power')">Nova automação</button></div><div class="center-metrics"><button onclick="FeatureHub.currentTab='automations';App.navigate('power')"><strong>${rules.length}</strong><span>Regras</span></button><button onclick="Notes.showTemplatesModal()"><strong>${templates.filter(item => item.kind !== 'snippet').length}</strong><span>Modelos</span></button><button onclick="App.showSnippetLibrary()"><strong>${templates.filter(item => item.kind === 'snippet').length}</strong><span>Snippets</span></button><button onclick="FeatureHub.currentTab='checklists';App.navigate('power')"><strong>${checklists.length}</strong><span>Checklists</span></button><button onclick="App.navigate('runbooks')"><strong>${Storage.getProfessionalRecords('runbooks').length}</strong><span>Runbooks</span></button></div></div>`;
    },

    renderReports(main) {
        const technical = Storage.getProfessionalRecords();
        const personal = Storage.getPersonalData();
        const finance = technical.filter(item => item.moduleKey === 'finance');
        const amount = item => Number(item.fields?.amount || item.fields?.value || 0);
        const income = finance.filter(item => ['entrada','receita'].includes(item.fields?.type)).reduce((sum,item) => sum + amount(item), 0);
        const expense = finance.filter(item => ['saida','saída','despesa'].includes(item.fields?.type)).reduce((sum,item) => sum + amount(item), 0);
        const tickets = technical.filter(item => item.moduleKey === 'tickets');
        main.innerHTML = `<div class="module-page center-page"><div class="module-hero"><div><span class="module-kicker">Indicadores consolidados</span><h2>Relatórios</h2><p>Resumo operacional e pessoal calculado diretamente da base sincronizada.</p></div><button class="btn btn-primary" onclick="window.print()">Imprimir relatório</button></div><div class="report-grid"><article><span>Receitas técnicas</span><strong>${UI.money(income)}</strong></article><article><span>Despesas técnicas</span><strong>${UI.money(expense)}</strong></article><article><span>Resultado</span><strong>${UI.money(income-expense)}</strong></article><article><span>Atendimentos</span><strong>${tickets.length}</strong></article><article><span>Concluídos</span><strong>${tickets.filter(item => item.status === 'finalizado').length}</strong></article><article><span>Clientes</span><strong>${technical.filter(item => item.moduleKey === 'clients').length}</strong></article><article><span>Hábitos</span><strong>${(personal.habits || []).length}</strong></article><article><span>Metas abertas</span><strong>${(personal.goals || []).filter(item => !['concluida','arquivada'].includes(item.status)).length}</strong></article><article><span>Obras acompanhadas</span><strong>${(personal.tracker || []).length}</strong></article></div></div>`;
    }
};

PageRouter.register('today-center', main => OperationalCenters.renderToday(main));
PageRouter.register('os360', main => OperationalCenters.renderOs360(main));
PageRouter.register('integrations', main => OperationalCenters.renderIntegrations(main));
PageRouter.register('automation-center', main => OperationalCenters.renderAutomations(main));
PageRouter.register('reports', main => OperationalCenters.renderReports(main));
window.OperationalCenters = OperationalCenters;
