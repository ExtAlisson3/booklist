// ============================================
// PERSONAL HUB - areas, journal, habits, goals and personal inbox
// ============================================
const PersonalHub = {
    moneyFilter: { kind: 'all', value: '' },
    moneyMonth: new Date().toLocaleDateString('sv-SE').slice(0, 7),
    moneyListFilters: { search: '', type: 'all', category: 'all', account: 'all', recurring: 'all' },

    _guardPersonal(main) {
        if (App.isContextAllowed('personal')) return false;
        App.renderContextGate(main, 'personal', 'Os módulos pessoais ficam disponíveis nos modos Pessoal ou Tudo.');
        return true;
    },

    renderHome(main) {
        if (this._guardPersonal(main)) return;
        const personal = Storage.getPersonalData();
        const areas = Storage.getLifeAreas();
        const today = new Date().toLocaleDateString('sv-SE');
        const checkedToday = (personal.habits || []).filter(h => personal.habitLogs?.[h.id]?.[today]).length;
        const openGoals = (personal.goals || []).filter(g => !['concluida', 'arquivada'].includes(this.normalize(g.status))).length;
        const inboxOpen = (personal.inbox || []).filter(i => i.status !== 'resolvido').length;
        const monthMoney = this.moneySummary(personal.money || []);
        const trackerStats = this.trackerStats(personal.tracker || []);
        const recentJournal = [...(personal.journal || [])].sort((a,b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 4);

        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero"><div><span class="module-kicker">Sistema pessoal</span><h2>✨ Pessoal</h2><p>Áreas da vida, diário, hábitos, metas e uma inbox para capturar ideias sem misturar com o lado profissional.</p></div><button class="btn btn-primary" onclick="PersonalHub.quickCapture()">Capturar agora</button></div>
            <div class="personal-capture">
                <input id="personal-quick-text" placeholder="Capturar pensamento, pendência, ideia, compra, lembrete...">
                <button class="btn btn-primary" onclick="PersonalHub.quickCapture()">Enviar para Inbox</button>
            </div>
            <div class="module-stats">
                <div class="feature-card" onclick="App.navigate('life')"><h3>${areas.length}</h3><p>Áreas da vida</p></div>
                <div class="feature-card" onclick="App.navigate('journal')"><h3>${(personal.journal || []).length}</h3><p>Entradas no diário</p></div>
                <div class="feature-card" onclick="App.navigate('habits')"><h3>${checkedToday}/${(personal.habits || []).length}</h3><p>Hábitos de hoje</p></div>
                <div class="feature-card" onclick="App.navigate('goals')"><h3>${openGoals}</h3><p>Metas ativas</p></div>
                <div class="feature-card" onclick="App.navigate('tracker')"><h3>${trackerStats.pending}</h3><p>Leituras com capitulo novo</p></div>
                <div class="feature-card" onclick="App.navigate('money')"><h3>${UI.money(monthMoney.balance)}</h3><p>Saldo pessoal do mês</p></div>
                <div class="feature-card" onclick="App.navigate('personal-inbox')"><h3>${inboxOpen}</h3><p>Itens na inbox</p></div>
            </div>
            <div class="module-grid">
                ${this.moduleCard('life','🌱','Áreas da Vida','Organize saúde, estudos, casa, finanças, família e lazer.')}
                ${this.moduleCard('journal','📖','Diário','Registre humor, energia, acontecimentos e aprendizados.')}
                ${this.moduleCard('habits','✅','Hábitos','Check-ins diários, streaks e consistência.')}
                ${this.moduleCard('goals','🎯','Metas','Objetivos pessoais com progresso e área vinculada.')}
                ${this.moduleCard('tracker','&#127916;','Minhas Mídias','Animes, mangás, filmes, séries e outras obras acompanhadas.')}
                ${this.moduleCard('money','💸','Money Pessoal','Entradas, saídas, assinaturas e gastos pessoais.')}
                ${this.moduleCard('personal-inbox','📥','Inbox Pessoal','Capture rápido e decida depois.')}
            </div>
            <div class="dash-sections">
                <div class="dash-section"><div class="dash-section-header"><h2>Diário recente</h2><button class="btn btn-sm btn-secondary" onclick="PersonalHub.showJournalModal()">Nova entrada</button></div>
                    ${recentJournal.length ? recentJournal.map(j => this.journalCard(j)).join('') : '<p class="text-muted">Nenhuma entrada ainda. Um registro curto por dia já começa a criar histórico.</p>'}
                </div>
                <div class="dash-section"><div class="dash-section-header"><h2>Hábitos de hoje</h2><button class="btn btn-sm btn-secondary" onclick="PersonalHub.showHabitModal()">Novo hábito</button></div>
                    ${(personal.habits || []).length ? (personal.habits || []).slice(0, 6).map(h => this.habitRow(h, personal)).join('') : '<p class="text-muted">Crie seus primeiros hábitos para acompanhar constância.</p>'}
                </div>
            </div>
        </div>`;
    },

    moduleCard(page, icon, title, subtitle) {
        return `<button class="module-card" onclick="App.navigate('${page}')"><span>${icon}</span><strong>${App.escapeHtml(title)}</strong><small>${App.escapeHtml(subtitle)}</small></button>`;
    },

    modalContext(kind, editing = false, accent = '') {
        const configs = {
            area: ['🌱', editing ? 'Editar área da vida' : 'Nova área da vida', 'Crie um contexto para agrupar metas, hábitos, diário, dinheiro e capturas pessoais.', ['Pessoal', 'Organização']],
            journal: ['📖', editing ? 'Editar entrada do diário' : 'Nova entrada no diário', 'Registre o dia com humor, energia, área e uma narrativa curta para formar histórico.', ['Diário', 'Timeline pessoal']],
            habit: ['✅', editing ? 'Editar hábito' : 'Novo hábito', 'Defina frequência, área, cor e observações para acompanhar consistência.', ['Hábito', 'Check-in diário']],
            goal: ['🎯', editing ? 'Editar meta' : 'Nova meta', 'Transforme um objetivo em progresso mensurável com alvo, unidade, horizonte e status.', ['Meta', 'Progresso']],
            tracker: ['📚', editing ? 'Editar obra acompanhada' : 'Nova obra no tracker', 'Acompanhe leitura, capítulos, links, avaliação e obras que ainda têm atualização pendente.', ['Leitura', 'Biblioteca contínua']],
            money: ['💸', editing ? 'Editar lançamento pessoal' : 'Novo lançamento pessoal', 'Registre entrada ou saída com valor, categoria, conta e recorrência.', ['Finanças pessoais', 'Fluxo do mês']]
        };
        const [icon, title, description, meta] = configs[kind] || configs.area;
        return App.modalContextHtml({ icon, title, description, meta: [...meta, editing ? 'Edição' : 'Criação'], tone: kind, accent });
    },

    renderLifeAreas(main) {
        if (this._guardPersonal(main)) return;
        const areas = Storage.getLifeAreas();
        const personal = Storage.getPersonalData();
        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero"><div><span class="module-kicker">Pessoal</span><h2>🌱 Áreas da Vida</h2><p>Separe sua vida por contexto para metas, hábitos, diário e pendências não ficarem soltos.</p></div><button class="btn btn-primary" onclick="PersonalHub.showLifeAreaModal()">Nova área</button></div>
            <div class="module-grid">${areas.map(area => {
                const counts = this.areaCounts(area.id, personal);
                return `<div class="module-card area-card" style="--area-color:${area.color || '#7C4DFF'}"><span>●</span><strong>${App.escapeHtml(area.name)}</strong><small>${counts.goals} meta(s) · ${counts.habits} hábito(s) · ${counts.journal} diário(s) · ${counts.inbox} inbox</small><div class="area-actions"><button class="btn btn-sm btn-secondary" onclick="PersonalHub.showLifeAreaModal('${area.id}')">Editar</button><button class="btn btn-sm btn-primary" onclick="PersonalHub.showGoalModal('', '${area.id}')">Meta</button></div></div>`;
            }).join('')}</div>
        </div>`;
    },

    areaCounts(areaId, personal = Storage.getPersonalData()) {
        return {
            goals: (personal.goals || []).filter(i => i.areaId === areaId).length,
            habits: (personal.habits || []).filter(i => i.areaId === areaId).length,
            journal: (personal.journal || []).filter(i => i.areaId === areaId).length,
            inbox: (personal.inbox || []).filter(i => i.areaId === areaId && i.status !== 'resolvido').length,
            money: (personal.money || []).filter(i => i.areaId === areaId).length,
            tracker: (personal.tracker || []).filter(i => i.areaId === areaId).length
        };
    },

    showLifeAreaModal(id = '') {
        const areas = Storage.getLifeAreas();
        const area = areas.find(a => a.id === id) || {};
        App.showModal(id ? 'Editar área' : 'Nova área', `
            ${this.modalContext('area', Boolean(id), area.color || '#7C4DFF')}
            <form onsubmit="PersonalHub.saveLifeArea('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Nome</label><input id="life-area-name" value="${App.escapeHtml(area.name || '')}" placeholder="Saúde, Estudos, Casa..." required></div>
                <div class="form-group"><label>Cor</label><input id="life-area-color" type="color" value="${App.escapeHtml(area.color || '#7C4DFF')}"></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteLifeArea('${id}')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    saveLifeArea(id = '') {
        const name = document.getElementById('life-area-name')?.value.trim();
        const color = document.getElementById('life-area-color')?.value || '#7C4DFF';
        if (!name) return App.toast('Digite o nome da área.', 'error');
        const areas = Storage.getLifeAreas();
        if (id) {
            const area = areas.find(a => a.id === id);
            if (!area) return App.toast('Área não encontrada.', 'error');
            Object.assign(area, { name, color });
        } else {
            areas.unshift({ id: crypto.randomUUID(), name, color, items: [] });
        }
        Storage.saveLifeAreas(areas);
        App.closeModal();
        App.toast('Área salva.', 'success');
        App.renderPage('life');
    },

    deleteLifeArea(id) {
        App.confirmAction('Apagar esta área? Os itens vinculados ficarão sem área.', () => {
            Storage.saveLifeAreas(Storage.getLifeAreas().filter(a => a.id !== id));
            const personal = Storage.getPersonalData();
            ['journal','habits','goals','inbox','money','tracker'].forEach(key => (personal[key] || []).forEach(item => { if (item.areaId === id) item.areaId = ''; }));
            Storage.savePersonalData(personal);
            App.closeModal();
            App.toast('Área apagada.', 'info');
            App.renderPage('life');
        }, { title: 'Apagar área', confirmText: 'Apagar', danger: true });
    },

    renderJournal(main) {
        if (this._guardPersonal(main)) return;
        const personal = Storage.getPersonalData();
        const entries = [...(personal.journal || [])].sort((a,b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        
        // stats
        const energySum = entries.reduce((sum, e) => sum + Number(e.energy || 0), 0);
        const energyAvg = entries.length ? (energySum / entries.length).toFixed(1) : '0.0';
        
        const moodMap = {};
        entries.forEach(e => { if (e.mood) moodMap[e.mood] = (moodMap[e.mood] || 0) + 1; });
        let domMood = '🙂';
        let maxCount = 0;
        for (const [mood, count] of Object.entries(moodMap)) {
            if (count > maxCount) { maxCount = count; domMood = mood; }
        }
        
        const uniqueAreas = new Set(entries.map(e => e.areaId).filter(Boolean));
        const areasCount = uniqueAreas.size;

        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>📖 Diário Pessoal</h2>
                    <p>Registre humor, energia, acontecimentos e aprendizados sem misturar com notas técnicas.</p>
                </div>
                <button class="btn btn-primary" onclick="PersonalHub.showJournalModal()">+ Nova entrada</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${entries.length}</h3><p>Total de Entradas</p></div>
                <div class="feature-card" style="border-left: 3px solid #00B4D8;"><h3>${energyAvg}/5</h3><p>Média de Energia</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3>${domMood}</h3><p>Humor Dominante</p></div>
                <div class="feature-card"><h3>${areasCount}</h3><p>Áreas de Vida com Diário</p></div>
            </div>

            <div class="personal-search-panel">
                <input type="text" id="journal-search" placeholder="Buscar por título ou conteúdo..." oninput="PersonalHub.filterJournalList()">
                <select id="journal-filter-area" onchange="PersonalHub.filterJournalList()">
                    <option value="">Todas as áreas</option>
                    ${Storage.getLifeAreas().map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                </select>
                <select id="journal-filter-mood" onchange="PersonalHub.filterJournalList()">
                    <option value="">Todos os humores</option>
                    ${['🙂','😄','😐','😕','😰','😴','🔥','✨'].map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>📖 Linha do Tempo</h2>
                    </div>
                    <div id="personal-journal-list" class="personal-list">
                        ${entries.length ? entries.map(j => this.journalCard(j)).join('') : '<p class="text-muted">Nenhuma entrada registrada ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    journalCard(entry) {
        const area = this.getArea(entry.areaId);
        return `
        <div class="journal-record-card" data-title="${App.escapeHtml(entry.title || '')}" data-content="${App.escapeHtml(entry.content || '')}" data-area="${entry.areaId || ''}" data-mood="${entry.mood || ''}" style="margin-bottom: 10px;">
            <button class="personal-record" onclick="PersonalHub.showJournalModal('${entry.id}')" style="width: 100%; text-align: left; margin-bottom: 0;">
                <span>${App.escapeHtml(entry.mood || '🙂')}</span>
                <div>
                    <strong>${App.escapeHtml(entry.title || 'Entrada do diário')}</strong>
                    <small>${UI.date(entry.date || entry.createdAt)} · Energia ${entry.energy || 3}/5${area ? ` · ${App.escapeHtml(area.name)}` : ''}</small>
                    <p>${App.escapeHtml((entry.content || '').slice(0, 180))}</p>
                </div>
            </button>
        </div>`;
    },

    filterJournalList() {
        const q = (document.getElementById('journal-search')?.value || '').toLowerCase().trim();
        const area = document.getElementById('journal-filter-area')?.value || '';
        const mood = document.getElementById('journal-filter-mood')?.value || '';
        
        const cards = document.querySelectorAll('.journal-record-card');
        cards.forEach(card => {
            const title = (card.getAttribute('data-title') || '').toLowerCase();
            const content = (card.getAttribute('data-content') || '').toLowerCase();
            const cardArea = card.getAttribute('data-area') || '';
            const cardMood = card.getAttribute('data-mood') || '';
            
            const matchQuery = !q || title.includes(q) || content.includes(q);
            const matchArea = !area || cardArea === area;
            const matchMood = !mood || cardMood === mood;
            
            if (matchQuery && matchArea && matchMood) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    showJournalModal(id = '', prefill = '', inboxId = '') {
        const item = (Storage.getPersonalData().journal || []).find(j => j.id === id) || {};
        const today = new Date().toLocaleDateString('sv-SE');
        App.showModal(id ? 'Editar diário' : 'Nova entrada no diário', `
            ${this.modalContext('journal', Boolean(id))}
            <form onsubmit="PersonalHub.saveJournalEntry('${id}', '${inboxId}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Título</label><input id="journal-title" value="${App.escapeHtml(item.title || '')}" placeholder="Como foi hoje?"></div>
                <div class="form-row">
                    <div class="form-group"><label>Data</label><input id="journal-date" type="date" value="${App.escapeHtml((item.date || today).slice(0,10))}"></div>
                    <div class="form-group"><label>Área</label><select id="journal-area">${this.areaOptions(item.areaId || '')}</select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Humor</label><select id="journal-mood">${['🙂','😄','😐','😕','😰','😴','🔥','✨'].map(m => `<option value="${m}" ${m===(item.mood || '🙂')?'selected':''}>${m}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Energia: <span id="journal-energy-label">${item.energy || 3}</span>/5</label><input id="journal-energy" type="range" min="1" max="5" value="${item.energy || 3}" oninput="document.getElementById('journal-energy-label').textContent=this.value"></div>
                </div>
                <div class="form-group"><label>Observações / Detalhes Adicionais</label><textarea id="journal-content" rows="8" placeholder="Acontecimentos, aprendizados, decisões, pensamentos...">${App.escapeHtml(item.content || prefill || '')}</textarea></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('journal','${id}','journal')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    saveJournalEntry(id = '', inboxId = '') {
        const data = {
            title: document.getElementById('journal-title')?.value.trim() || 'Entrada do diário',
            date: document.getElementById('journal-date')?.value || new Date().toISOString().slice(0, 10),
            areaId: document.getElementById('journal-area')?.value || '',
            mood: document.getElementById('journal-mood')?.value || '🙂',
            energy: Number(document.getElementById('journal-energy')?.value || 3),
            content: document.getElementById('journal-content')?.value || ''
        };
        id ? Storage.updatePersonalItem('journal', id, data) : Storage.addPersonalItem('journal', data);
        if (inboxId) Storage.updatePersonalItem('inbox', inboxId, { status: 'resolvido' });
        App.closeModal();
        App.toast('Diário salvo.', 'success');
        App.renderPage('journal');
    },

    renderHabits(main) {
        if (this._guardPersonal(main)) return;
        const personal = Storage.getPersonalData();
        const habits = personal.habits || [];
        
        // stats
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const checkedToday = habits.filter(h => personal.habitLogs?.[h.id]?.[todayStr]).length;
        
        let weeklyChecks = 0;
        const now = new Date();
        habits.forEach(h => {
            const logs = personal.habitLogs?.[h.id] || {};
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const key = d.toLocaleDateString('sv-SE');
                if (logs[key]) weeklyChecks++;
            }
        });
        
        const streaks = habits.map(h => this.streak(h.id, personal));
        const maxStreak = streaks.length ? Math.max(...streaks) : 0;

        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>✅ Hábitos & Consistência</h2>
                    <p>Check-ins, streaks e uma visão visual simples de consistência.</p>
                </div>
                <button class="btn btn-primary" onclick="PersonalHub.showHabitModal()">+ Novo hábito</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${habits.length}</h3><p>Hábitos Ativos</p></div>
                <div class="feature-card" style="border-left: 3px solid #06D6A0;"><h3>${checkedToday}/${habits.length}</h3><p>Concluídos Hoje</p></div>
                <div class="feature-card" style="border-left: 3px solid #7C4DFF;"><h3>${weeklyChecks}</h3><p>Checks na Semana</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3>${maxStreak} dia(s)</h3><p>Maior Sequência</p></div>
            </div>

            <div class="personal-search-panel">
                <input type="text" id="habits-search" placeholder="Buscar por nome do hábito..." oninput="PersonalHub.filterHabitsList()">
                <select id="habits-filter-area" onchange="PersonalHub.filterHabitsList()">
                    <option value="">Todas as áreas</option>
                    ${Storage.getLifeAreas().map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                </select>
                <div style="display:none;"></div>
            </div>

            <div id="personal-habits-list" class="personal-list habit-grid">
                ${habits.length ? habits.map(h => this.habitCard(h, personal)).join('') : '<div class="dash-section"><p class="text-muted">Nenhum hábito registrado ainda.</p></div>'}
            </div>
        </div>`;
    },

    habitRow(habit, personal = Storage.getPersonalData()) {
        const today = new Date().toLocaleDateString('sv-SE');
        const done = Boolean(personal.habitLogs?.[habit.id]?.[today]);
        return `<button class="global-result" onclick="PersonalHub.toggleHabit('${habit.id}')"><span>${done ? '✅' : '⬜'}</span><div><strong>${App.escapeHtml(habit.name)}</strong><small>${this.streak(habit.id, personal)} dia(s) de sequência · ${App.escapeHtml(this.getArea(habit.areaId)?.name || 'Sem área')}</small></div></button>`;
    },

    habitCard(habit, personal = Storage.getPersonalData()) {
        const today = new Date().toLocaleDateString('sv-SE');
        const done = Boolean(personal.habitLogs?.[habit.id]?.[today]);
        return `
        <div class="habit-record-card" data-name="${App.escapeHtml(habit.name || '')}" data-area="${habit.areaId || ''}">
            <div class="dash-section habit-card" style="--area-color:${habit.color || '#7C4DFF'}; margin-bottom: 0;">
                <div class="dash-section-header"><h2>${done ? '✅' : '⬜'} ${App.escapeHtml(habit.name)}</h2><button class="btn btn-sm btn-secondary" onclick="PersonalHub.showHabitModal('${habit.id}')">Editar</button></div>
                <p class="text-muted">${App.escapeHtml(this.getArea(habit.areaId)?.name || 'Sem área')} · ${App.escapeHtml(habit.frequency || 'diário')} · streak ${this.streak(habit.id, personal)}</p>
                <div class="habit-heatmap">${this.heatmap(habit.id, personal)}</div>
                <button class="btn ${done ? 'btn-secondary' : 'btn-primary'}" onclick="PersonalHub.toggleHabit('${habit.id}')">${done ? 'Desmarcar hoje' : 'Marcar hoje'}</button>
            </div>
        </div>`;
    },

    heatmap(habitId, personal = Storage.getPersonalData()) {
        const logs = personal.habitLogs?.[habitId] || {};
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (41 - i));
            const key = d.toISOString().slice(0, 10);
            return `<span class="heat-cell ${logs[key] ? 'heat-4' : 'heat-0'}" title="${new Date(key).toLocaleDateString('pt-BR')}"></span>`;
        }).join('');
    },

    streak(habitId, personal = Storage.getPersonalData()) {
        const logs = personal.habitLogs?.[habitId] || {};
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            if (logs[d.toISOString().slice(0, 10)]) streak++;
            else break;
        }
        return streak;
    },

    toggleHabit(id) {
        const isDone = Storage.toggleHabitCheck(id);
        if (isDone && typeof window.SoundEffects !== 'undefined') {
            window.SoundEffects.playComplete();
        }
        App.toast('Hábito atualizado.', 'success');
        App.renderPage(App.currentPage);
    },

    filterHabitsList() {
        const q = (document.getElementById('habits-search')?.value || '').toLowerCase().trim();
        const area = document.getElementById('habits-filter-area')?.value || '';
        
        const cards = document.querySelectorAll('.habit-record-card');
        cards.forEach(card => {
            const name = (card.getAttribute('data-name') || '').toLowerCase();
            const cardArea = card.getAttribute('data-area') || '';
            
            const matchQuery = !q || name.includes(q);
            const matchArea = !area || cardArea === area;
            
            if (matchQuery && matchArea) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    showHabitModal(id = '') {
        const item = (Storage.getPersonalData().habits || []).find(h => h.id === id) || {};
        App.showModal(id ? 'Editar hábito' : 'Novo hábito', `
            ${this.modalContext('habit', Boolean(id), item.color || '#00BFA5')}
            <form onsubmit="PersonalHub.saveHabit('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Nome</label><input id="habit-name" value="${App.escapeHtml(item.name || '')}" placeholder="Ler, caminhar, estudar..." required></div>
                <div class="form-row">
                    <div class="form-group"><label>Área</label><select id="habit-area">${this.areaOptions(item.areaId || '')}</select></div>
                    <div class="form-group"><label>Frequência</label><select id="habit-frequency">${['diário','dias úteis','semanal','livre'].map(f => `<option value="${f}" ${f===(item.frequency || 'diário')?'selected':''}>${f}</option>`).join('')}</select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cor</label><input id="habit-color" type="color" value="${App.escapeHtml(item.color || '#00BFA5')}"></div>
                    <div class="form-group"><label>Observações / Detalhes Adicionais</label><input id="habit-note" value="${App.escapeHtml(item.note || '')}" placeholder="Por que isso importa?"></div>
                </div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('habits','${id}','habits')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    saveHabit(id = '') {
        const data = {
            name: document.getElementById('habit-name')?.value.trim(),
            areaId: document.getElementById('habit-area')?.value || '',
            frequency: document.getElementById('habit-frequency')?.value || 'diário',
            color: document.getElementById('habit-color')?.value || '#00BFA5',
            note: document.getElementById('habit-note')?.value || ''
        };
        if (!data.name) return App.toast('Digite o nome do hábito.', 'error');
        id ? Storage.updatePersonalItem('habits', id, data) : Storage.addPersonalItem('habits', data);
        App.closeModal();
        App.toast('Hábito salvo.', 'success');
        App.renderPage('habits');
    },

    renderGoals(main) {
        if (this._guardPersonal(main)) return;
        const goals = Storage.getPersonalData().goals || [];
        const active = goals.filter(g => g.status === 'ativa').length;
        const completed = goals.filter(g => g.status === 'concluida').length;
        const progressValues = goals.map(g => Math.min(100, Math.round((Number(g.current || 0) / Math.max(1, Number(g.target || 1))) * 100)));
        const avgProgress = progressValues.length ? Math.round(progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length) : 0;

        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>🎯 Metas & Objetivos</h2>
                    <p>Planeje seus objetivos por área da vida com acompanhamento e horizontes claros.</p>
                </div>
                <button class="btn btn-primary" onclick="PersonalHub.showGoalModal()">+ Nova meta</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${goals.length}</h3><p>Total de Metas</p></div>
                <div class="feature-card" style="border-left: 3px solid #7C4DFF;"><h3>${active}</h3><p>Metas Ativas</p></div>
                <div class="feature-card" style="border-left: 3px solid #06D6A0;"><h3>${completed}</h3><p>Metas Concluídas</p></div>
                <div class="feature-card" style="border-left: 3px solid #00B4D8;"><h3>${avgProgress}%</h3><p>Média de Progresso</p></div>
            </div>

            <div class="personal-search-panel">
                <input type="text" id="goals-search" placeholder="Buscar por título ou observações..." oninput="PersonalHub.filterGoalsList()">
                <select id="goals-filter-area" onchange="PersonalHub.filterGoalsList()">
                    <option value="">Todas as áreas</option>
                    ${Storage.getLifeAreas().map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                </select>
                <select id="goals-filter-status" onchange="PersonalHub.filterGoalsList()">
                    <option value="">Todos os status</option>
                    ${['ativa','pausada','concluida','arquivada'].map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>

            <div id="personal-goals-list" class="personal-list goal-grid">
                ${goals.length ? goals.map(g => this.goalCard(g)).join('') : '<div class="dash-section"><p class="text-muted">Nenhuma meta cadastrada ainda.</p></div>'}
            </div>
        </div>`;
    },

    goalCard(goal) {
        const pct = Math.min(100, Math.round((Number(goal.current || 0) / Math.max(1, Number(goal.target || 1))) * 100));
        const area = this.getArea(goal.areaId);
        return `
        <div class="goal-record-card" data-title="${App.escapeHtml(goal.title || '')}" data-note="${App.escapeHtml(goal.note || '')}" data-area="${goal.areaId || ''}" data-status="${goal.status || 'ativa'}">
            <div class="dash-section goal-card" style="margin-bottom: 0; height: 100%;">
                <div class="dash-section-header"><h2>${App.escapeHtml(goal.title)}</h2><button class="btn btn-sm btn-secondary" onclick="PersonalHub.showGoalModal('${goal.id}')">Editar</button></div>
                <p class="text-muted">${App.escapeHtml(goal.status || 'ativa')} · ${App.escapeHtml(goal.horizon || 'sem prazo')}${area ? ` · ${App.escapeHtml(area.name)}` : ''}</p>
                <div class="goal-progress"><span style="width:${pct}%"></span></div>
                <small>${pct}% · ${App.escapeHtml(goal.current || 0)} de ${App.escapeHtml(goal.target || 1)} ${App.escapeHtml(goal.unit || '')}</small>
                <p>${App.escapeHtml(goal.note || '')}</p>
            </div>
        </div>`;
    },

    filterGoalsList() {
        const q = (document.getElementById('goals-search')?.value || '').toLowerCase().trim();
        const area = document.getElementById('goals-filter-area')?.value || '';
        const status = document.getElementById('goals-filter-status')?.value || '';
        
        const cards = document.querySelectorAll('.goal-record-card');
        cards.forEach(card => {
            const title = (card.getAttribute('data-title') || '').toLowerCase();
            const note = (card.getAttribute('data-note') || '').toLowerCase();
            const cardArea = card.getAttribute('data-area') || '';
            const cardStatus = card.getAttribute('data-status') || '';
            
            const matchQuery = !q || title.includes(q) || note.includes(q);
            const matchArea = !area || cardArea === area;
            const matchStatus = !status || cardStatus === status;
            
            if (matchQuery && matchArea && matchStatus) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    showGoalModal(id = '', prefillAreaId = '') {
        const item = (Storage.getPersonalData().goals || []).find(g => g.id === id) || {};
        App.showModal(id ? 'Editar meta' : 'Nova meta', `
            ${this.modalContext('goal', Boolean(id))}
            <form onsubmit="PersonalHub.saveGoal('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Título</label><input id="goal-title" value="${App.escapeHtml(item.title || '')}" placeholder="Ex: estudar redes 20h no mês" required></div>
                <div class="form-row">
                    <div class="form-group"><label>Área</label><select id="goal-area">${this.areaOptions(item.areaId || prefillAreaId || '')}</select></div>
                    <div class="form-group"><label>Status</label><select id="goal-status">${['ativa','pausada','concluida','arquivada'].map(s => `<option value="${s}" ${s===(item.status || 'ativa')?'selected':''}>${s}</option>`).join('')}</select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Horizonte</label><input id="goal-horizon" value="${App.escapeHtml(item.horizon || '')}" placeholder="Maio, 2026, trimestre..."></div>
                    <div class="form-group"><label>Unidade</label><input id="goal-unit" value="${App.escapeHtml(item.unit || '')}" placeholder="horas, páginas, dias..."></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Atual</label><input id="goal-current" type="number" step="0.01" value="${App.escapeHtml(item.current || 0)}"></div>
                    <div class="form-group"><label>Alvo</label><input id="goal-target" type="number" step="0.01" value="${App.escapeHtml(item.target || 1)}"></div>
                </div>
                <div class="form-group"><label>Observações / Detalhes Adicionais</label><textarea id="goal-note" rows="4" placeholder="Detalhes da meta, plano de ação...">${App.escapeHtml(item.note || '')}</textarea></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('goals','${id}','goals')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    saveGoal(id = '') {
        const data = {
            title: document.getElementById('goal-title')?.value.trim(),
            areaId: document.getElementById('goal-area')?.value || '',
            status: document.getElementById('goal-status')?.value || 'ativa',
            horizon: document.getElementById('goal-horizon')?.value || '',
            unit: document.getElementById('goal-unit')?.value || '',
            current: Number(document.getElementById('goal-current')?.value || 0),
            target: Number(document.getElementById('goal-target')?.value || 1),
            note: document.getElementById('goal-note')?.value || ''
        };
        if (!data.title) return App.toast('Digite o título da meta.', 'error');
        id ? Storage.updatePersonalItem('goals', id, data) : Storage.addPersonalItem('goals', data);
        App.closeModal();
        App.toast('Meta salva.', 'success');
        App.renderPage('goals');
    },

    renderTracker(main) {
        if (this._guardPersonal(main)) return;
        const items = [...(Storage.getPersonalData().tracker || [])].sort((a, b) => {
            const aPending = Number(a.latestChapter || 0) > Number(a.currentChapter || 0) ? 1 : 0;
            const bPending = Number(b.latestChapter || 0) > Number(b.currentChapter || 0) ? 1 : 0;
            if (aPending !== bPending) return bPending - aPending;
            if (Boolean(a.favorite) !== Boolean(b.favorite)) return Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
            return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        });
        const stats = this.trackerStats(items);
        const categories = this.trackerCategories();
        const statuses = ['lendo','em lancamento','hiato','finalizado','pausado','dropado','quero ler'];

        main.innerHTML = `
        <div class="module-page personal-page tracker-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>🎬 Minhas Mídias</h2>
                    <p>Organize animes, mangás, filmes, séries e outras obras sem misturar as categorias.</p>
                </div>
                <button class="btn btn-primary" onclick="PersonalHub.showTrackerModal()">+ Nova obra</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${stats.total}</h3><p>Obras Registradas</p></div>
                <div class="feature-card" style="border-left: 3px solid #00B4D8;"><h3>${stats.reading}</h3><p>Em andamento</p></div>
                <div class="feature-card" style="border-left: 3px solid #EF5350;"><h3>${stats.pending}</h3><p>Com progresso pendente</p></div>
                <div class="feature-card" style="border-left: 3px solid #FF9100;"><h3>${stats.favorites}</h3><p>Favoritas ⭐</p></div>
            </div>

            <div class="personal-search-panel">
                <input type="text" id="tracker-search" placeholder="Buscar por título ou observações..." oninput="PersonalHub.filterTrackerList()">
                <select id="tracker-filter-status" onchange="PersonalHub.filterTrackerList()">
                    <option value="">Todos os status</option>
                    ${statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>

            <div class="tracker-category-tabs" role="tablist" aria-label="Categorias de mídia">
                <button class="tracker-category-tab active" type="button" data-category="all" onclick="PersonalHub.setTrackerCategory('all')">Tudo <span>${items.length}</span></button>
                ${categories.map(category => `<button class="tracker-category-tab" type="button" data-category="${category.id}" onclick="PersonalHub.setTrackerCategory('${category.id}')">${category.icon} ${category.label} <span>${items.filter(item => this.trackerCategory(item.type) === category.id).length}</span></button>`).join('')}
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>🎬 Biblioteca</h2>
                    </div>
                    <div id="personal-tracker-list" class="personal-list tracker-list">
                        ${items.length ? categories.map(category => {
                            const categoryItems = items.filter(item => this.trackerCategory(item.type) === category.id);
                            if (!categoryItems.length) return '';
                            return `<section class="tracker-category-group" data-category="${category.id}"><h3>${category.icon} ${category.label}</h3><div>${categoryItems.map(item => this.trackerCard(item)).join('')}</div></section>`;
                        }).join('') : '<p class="text-muted">Nenhuma mídia acompanhada ainda.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    trackerStats(items = []) {
        return {
            total: items.length,
            reading: items.filter(i => ['lendo','assistindo','em lancamento'].includes(this.normalize(i.status))).length,
            pending: items.filter(i => Number(i.latestChapter || 0) > Number(i.currentChapter || 0)).length,
            favorites: items.filter(i => i.favorite).length
        };
    },

    trackerCategories() {
        return [
            { id: 'anime', label: 'Animes', icon: '🌸', types: ['anime'] },
            { id: 'manga', label: 'Mangás', icon: '📚', types: ['manga', 'manhwa', 'manhua'] },
            { id: 'film', label: 'Filmes', icon: '🎞️', types: ['filme'] },
            { id: 'series', label: 'Séries', icon: '📺', types: ['serie', 'série'] },
            { id: 'books', label: 'Livros & Novels', icon: '📖', types: ['livro', 'novel', 'web novel'] },
            { id: 'other', label: 'Outros', icon: '✨', types: ['quadrinho', 'outro'] }
        ];
    },

    trackerCategory(type = '') {
        const normalized = this.normalize(type);
        return this.trackerCategories().find(category => category.types.some(entry => this.normalize(entry) === normalized))?.id || 'other';
    },

    trackerProgress(item = {}) {
        const current = Number(item.currentChapter || 0);
        const latest = Math.max(1, Number(item.latestChapter || current || 1));
        return Math.max(0, Math.min(100, Math.round((current / latest) * 100)));
    },

    trackerCard(item) {
        const area = this.getArea(item.areaId);
        const current = Number(item.currentChapter || 0);
        const latest = Number(item.latestChapter || 0);
        const pending = latest > current;
        const pct = this.trackerProgress(item);
        const links = [
            ['Ler', item.url],
            ['Raws', item.rawUrl],
            ['Wiki', item.wikiUrl]
        ].filter(([, url]) => url);
        return `
        <div class="tracker-record-card" data-title="${App.escapeHtml(item.title || '')}" data-note="${App.escapeHtml(item.note || '')}" data-category="${this.trackerCategory(item.type)}" data-status="${item.status || 'lendo'}" style="margin-bottom: 12px;">
            <div class="personal-record tracker-record ${pending ? 'has-update' : ''}" style="margin-bottom: 0;">
                <span>${item.favorite ? '⭐' : '📖'}</span>
                <div>
                    <strong>${App.escapeHtml(item.title || 'Obra sem título')}</strong>
                    <small>${App.escapeHtml(item.type || 'obra')} · ${App.escapeHtml(item.status || 'lendo')}${area ? ` · ${App.escapeHtml(area.name)}` : ''}${item.rating ? ` · nota ${App.escapeHtml(item.rating)}/10` : ''}</small>
                    <div class="tracker-progress"><span style="width:${pct}%"></span></div>
                    <p>Progresso ${App.escapeHtml(current)}${latest ? ` de ${App.escapeHtml(latest)}` : ''}${pending ? ` · faltam ${latest - current}` : ' · em dia'}</p>
                    ${item.note ? `<p>${App.escapeHtml(item.note).slice(0, 180)}</p>` : ''}
                    ${links.length ? `<div class="tracker-links">${links.map(([label, url]) => `<button class="btn btn-sm btn-secondary" onclick="PersonalHub.openTrackerUrl('${encodeURIComponent(url)}')">${label}</button>`).join('')}</div>` : ''}
                </div>
                <div class="tracker-actions">
                    <button class="btn btn-sm btn-primary" onclick="PersonalHub.bumpTracker('${item.id}', 1)">+1 progresso</button>
                    <button class="btn btn-sm btn-secondary" onclick="PersonalHub.markTrackerCaughtUp('${item.id}')">Em dia</button>
                    <button class="btn btn-sm btn-secondary" onclick="PersonalHub.showTrackerModal('${item.id}')">Editar</button>
                </div>
            </div>
        </div>`;
    },

    filterTrackerList() {
        const q = (document.getElementById('tracker-search')?.value || '').toLowerCase().trim();
        const status = document.getElementById('tracker-filter-status')?.value || '';
        const category = document.getElementById('personal-tracker-list')?.dataset.category || 'all';
        
        const cards = document.querySelectorAll('.tracker-record-card');
        cards.forEach(card => {
            const title = (card.getAttribute('data-title') || '').toLowerCase();
            const note = (card.getAttribute('data-note') || '').toLowerCase();
            const cardCategory = card.getAttribute('data-category') || '';
            const cardStatus = card.getAttribute('data-status') || '';
            
            const matchQuery = !q || title.includes(q) || note.includes(q);
            const matchCategory = category === 'all' || cardCategory === category;
            const matchStatus = !status || cardStatus === status;
            
            if (matchQuery && matchCategory && matchStatus) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        document.querySelectorAll('.tracker-category-group').forEach(group => {
            group.style.display = [...group.querySelectorAll('.tracker-record-card')].some(card => card.style.display !== 'none') ? '' : 'none';
        });
    },

    setTrackerCategory(category = 'all') {
        const list = document.getElementById('personal-tracker-list');
        if (!list) return;
        list.dataset.category = category;
        document.querySelectorAll('.tracker-category-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.category === category));
        this.filterTrackerList();
    },

    showTrackerModal(id = '') {
        const item = (Storage.getPersonalData().tracker || []).find(t => t.id === id) || {};
        const types = ['anime','manga','manhwa','manhua','filme','serie','livro','novel','web novel','quadrinho','outro'];
        const statuses = this.trackerStatusOptions(item.type || 'manga');
        App.showModal(id ? 'Editar tracker' : 'Nova obra no tracker', `
            ${this.modalContext('tracker', Boolean(id))}
            <form onsubmit="PersonalHub.saveTracker('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group"><label>Titulo</label><input id="tracker-title" value="${App.escapeHtml(item.title || '')}" placeholder="One Piece, Interestelar, The Last of Us..." required></div>
                <div class="media-catalog-search"><div><strong>Preencher pelo catálogo</strong><span>Busca dados públicos conforme o tipo de obra.</span></div><div class="media-catalog-search-actions"><input id="tracker-catalog-query" value="${App.escapeHtml(item.title || '')}" placeholder="Digite o título para pesquisar"><button type="button" class="btn btn-secondary" onclick="PersonalHub.searchMediaCatalog()">Buscar</button></div><div id="tracker-catalog-results" class="media-catalog-results" aria-live="polite"></div></div>
                <div class="form-row">
                    <div class="form-group"><label>Tipo</label><select id="tracker-type" onchange="PersonalHub.refreshTrackerTypeFields();PersonalHub.refreshTrackerStatusOptions()">${types.map(t => `<option value="${t}" ${t===(item.type || 'manga')?'selected':''}>${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Status</label><select id="tracker-status">${statuses.map(s => `<option value="${s}" ${s===(item.status || 'lendo')?'selected':''}>${s}</option>`).join('')}</select></div>
                </div>
                <div id="tracker-type-fields">${this.trackerTypeFields(item.type || 'manga', item)}</div>
                <div class="form-row">
                    <div class="form-group"><label>Area</label><select id="tracker-area">${this.areaOptions(item.areaId || '')}</select></div>
                    <div class="form-group"><label>Avaliacao 0-10</label><input id="tracker-rating" type="number" min="0" max="10" step="0.5" value="${App.escapeHtml(item.rating || '')}"></div>
                </div>
                <label class="checkbox-row"><input type="checkbox" id="tracker-favorite" ${item.favorite ? 'checked' : ''}> Favorito</label>
                <div class="form-group"><label>Observações / Detalhes Adicionais</label><textarea id="tracker-note" rows="4" placeholder="Onde parei, personagem, arco atual, observações...">${App.escapeHtml(item.note || '')}</textarea></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('tracker','${id}','tracker')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    trackerTypeFields(type = 'manga', item = {}) {
        const normalized = this.normalize(type);
        const mangaTypes = ['manga', 'manhwa', 'manhua'];
        const episodicTypes = ['anime', 'serie', 'série'];
        const bookTypes = ['livro', 'novel', 'web novel', 'quadrinho'];
        const isManga = mangaTypes.includes(normalized);
        const isEpisodic = episodicTypes.includes(normalized);
        const isBook = bookTypes.includes(normalized);
        const hasProgress = isManga || isEpisodic || isBook;
        const currentLabel = isManga ? 'Capítulo atual' : isEpisodic ? 'Episódio atual' : 'Capítulo ou página atual';
        const latestLabel = isManga ? 'Último capítulo lançado' : isEpisodic ? 'Episódios lançados ou total' : 'Total de capítulos ou páginas';
        const primaryLinkLabel = isManga || isBook ? 'Link de leitura' : isEpisodic ? 'Link para assistir' : 'Onde assistir';
        const rawField = isManga ? `<div class="form-group"><label>Link da raw / original</label><input id="tracker-raw-url" value="${App.escapeHtml(item.rawUrl || '')}" placeholder="https://..."></div>` : `<input id="tracker-raw-url" type="hidden" value="${App.escapeHtml(item.rawUrl || '')}">`;
        const progressFields = hasProgress
            ? `<div class="form-row"><div class="form-group"><label>${currentLabel}</label><input id="tracker-current" type="number" min="0" step="1" value="${App.escapeHtml(item.currentChapter || 0)}"></div><div class="form-group"><label>${latestLabel}</label><input id="tracker-latest" type="number" min="0" step="1" value="${App.escapeHtml(item.latestChapter || '')}"></div></div>`
            : `<input id="tracker-current" type="hidden" value="${App.escapeHtml(item.currentChapter || 0)}"><input id="tracker-latest" type="hidden" value="${App.escapeHtml(item.latestChapter || '')}">`;
        const detailFields = isEpisodic
            ? `<div class="form-row"><div class="form-group"><label>Temporada atual</label><input id="tracker-season" type="number" min="0" value="${App.escapeHtml(item.season || '')}" placeholder="Ex.: 2"></div><div class="form-group"><label>Estúdio / plataforma</label><input id="tracker-creator" value="${App.escapeHtml(item.creator || '')}" placeholder="MAPPA, Netflix, Crunchyroll..."></div></div>`
            : isManga
                ? `<div class="form-row"><div class="form-group"><label>Autor / artista</label><input id="tracker-creator" value="${App.escapeHtml(item.creator || '')}" placeholder="Autor ou estúdio"></div><div class="form-group"><label>Formato</label><select id="tracker-format"><option value="">Não informado</option>${['Físico','Digital','Webtoon','Scan','Oficial'].map(value => `<option ${item.format === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>`
                : isBook
                    ? `<div class="form-row"><div class="form-group"><label>Autor</label><input id="tracker-creator" value="${App.escapeHtml(item.creator || '')}" placeholder="Nome do autor"></div><div class="form-group"><label>Edição / formato</label><input id="tracker-format" value="${App.escapeHtml(item.format || '')}" placeholder="Físico, Kindle, audiobook..."></div></div>`
                    : `<div class="form-row"><div class="form-group"><label>Ano</label><input id="tracker-year" type="number" min="1800" max="2200" value="${App.escapeHtml(item.year || '')}" placeholder="2026"></div><div class="form-group"><label>Direção / criador</label><input id="tracker-creator" value="${App.escapeHtml(item.creator || '')}" placeholder="Direção ou criador"></div></div>`;
        return `<section class="tracker-type-details"><div class="tracker-type-details-head"><strong>${isEpisodic ? 'Acompanhamento por episódios' : isManga ? 'Acompanhamento de capítulos' : isBook ? 'Acompanhamento de leitura' : 'Detalhes da obra'}</strong><span>${isEpisodic ? 'Anime ou série' : isManga ? 'Mangá, manhwa ou manhua' : isBook ? 'Livro, novel ou quadrinho' : 'Filme ou obra avulsa'}</span></div>${progressFields}${detailFields}<div class="form-group"><label>${primaryLinkLabel}</label><input id="tracker-url" value="${App.escapeHtml(item.url || '')}" placeholder="https://..."></div><div class="form-row">${rawField}<div class="form-group"><label>Wiki / informações</label><input id="tracker-wiki-url" value="${App.escapeHtml(item.wikiUrl || '')}" placeholder="https://..."></div></div></section>`;
    },

    refreshTrackerTypeFields() {
        const type = document.getElementById('tracker-type')?.value || 'manga';
        const field = id => document.getElementById(id)?.value || '';
        const target = document.getElementById('tracker-type-fields');
        if (!target) return;
        target.innerHTML = this.trackerTypeFields(type, {
            currentChapter: field('tracker-current'),
            latestChapter: field('tracker-latest'),
            url: field('tracker-url'),
            rawUrl: field('tracker-raw-url'),
            wikiUrl: field('tracker-wiki-url'),
            season: field('tracker-season'),
            creator: field('tracker-creator'),
            format: field('tracker-format'),
            year: field('tracker-year')
        });
    },

    trackerStatusOptions(type = 'manga') {
        const normalized = this.normalize(type);
        if (['anime', 'serie'].includes(normalized)) return ['assistindo', 'em lancamento', 'hiato', 'finalizado', 'pausado', 'dropado', 'quero assistir'];
        if (normalized === 'filme') return ['quero assistir', 'assistido', 'reassistir'];
        return ['lendo', 'em lancamento', 'hiato', 'finalizado', 'pausado', 'dropado', 'quero ler'];
    },

    refreshTrackerStatusOptions() {
        const type = document.getElementById('tracker-type')?.value || 'manga';
        const select = document.getElementById('tracker-status');
        if (!select) return;
        const selected = select.value;
        const statuses = this.trackerStatusOptions(type);
        select.innerHTML = statuses.map(status => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`).join('');
    },

    async searchMediaCatalog() {
        const query = document.getElementById('tracker-catalog-query')?.value.trim() || document.getElementById('tracker-title')?.value.trim();
        const type = document.getElementById('tracker-type')?.value || 'manga';
        const resultsEl = document.getElementById('tracker-catalog-results');
        if (!query) return App.toast('Digite o título da obra para buscar.', 'info');
        if (resultsEl) resultsEl.innerHTML = '<p>Buscando no catálogo…</p>';
        try {
            const results = await MediaCatalog.search(query, type);
            if (!results.length) throw new Error('Nenhuma obra encontrada. Tente outro título.');
            if (resultsEl) resultsEl.innerHTML = results.map((item, index) => `<button type="button" class="media-catalog-result" onclick="PersonalHub.applyMediaCatalogResult(${index})"><span class="media-catalog-cover">${item.image ? `<img src="${App.escapeHtml(item.image)}" alt="">` : '📚'}</span><span><strong>${App.escapeHtml(item.title)}</strong><small>${App.escapeHtml(item.creator || 'Autor/estúdio não informado')}</small><em>${App.escapeHtml(item.meta || (item.year ? String(item.year) : 'Catálogo público'))}</em></span></button>`).join('');
            this._catalogResults = results;
        } catch (error) {
            if (resultsEl) resultsEl.innerHTML = `<p class="media-catalog-error">${App.escapeHtml(error.message || 'Não foi possível buscar agora.')}</p>`;
        }
    },

    applyMediaCatalogResult(index) {
        const item = this._catalogResults?.[index];
        if (!item) return;
        const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined && value !== null) el.value = value; };
        set('tracker-title', item.title); set('tracker-catalog-query', item.title); set('tracker-creator', item.creator); set('tracker-wiki-url', item.wikiUrl); set('tracker-year', item.year); set('tracker-latest', item.latest);
        document.getElementById('tracker-catalog-results').innerHTML = '<p class="media-catalog-success">Dados aplicados. Revise e complete o que faltar antes de salvar.</p>';
        App.toast('Dados do catálogo aplicados.', 'success');
    },

    saveTracker(id = '') {
        const rating = document.getElementById('tracker-rating')?.value;
        const current = Number(document.getElementById('tracker-current')?.value || 0);
        const latestValue = document.getElementById('tracker-latest')?.value;
        const data = {
            title: document.getElementById('tracker-title')?.value.trim(),
            type: document.getElementById('tracker-type')?.value || 'manga',
            status: document.getElementById('tracker-status')?.value || 'lendo',
            currentChapter: current,
            latestChapter: latestValue === '' ? current : Number(latestValue || current),
            areaId: document.getElementById('tracker-area')?.value || '',
            rating: rating === '' ? '' : Number(rating),
            url: document.getElementById('tracker-url')?.value.trim() || '',
            rawUrl: document.getElementById('tracker-raw-url')?.value.trim() || '',
            wikiUrl: document.getElementById('tracker-wiki-url')?.value.trim() || '',
            season: Number(document.getElementById('tracker-season')?.value || 0) || '',
            creator: document.getElementById('tracker-creator')?.value.trim() || '',
            format: document.getElementById('tracker-format')?.value.trim() || '',
            year: Number(document.getElementById('tracker-year')?.value || 0) || '',
            favorite: Boolean(document.getElementById('tracker-favorite')?.checked),
            note: document.getElementById('tracker-note')?.value || ''
        };
        if (!data.title) return App.toast('Digite o titulo da obra.', 'error');
        id ? Storage.updatePersonalItem('tracker', id, data) : Storage.addPersonalItem('tracker', data);
        App.closeModal();
        App.toast('Tracker salvo.', 'success');
        App.renderPage('tracker');
    },

    bumpTracker(id, delta = 1) {
        const item = (Storage.getPersonalData().tracker || []).find(t => t.id === id);
        if (!item) return;
        const next = Math.max(0, Number(item.currentChapter || 0) + Number(delta || 1));
        Storage.updatePersonalItem('tracker', id, {
            currentChapter: next,
            latestChapter: Math.max(Number(item.latestChapter || 0), next)
        });
        App.renderPage('tracker');
    },

    markTrackerCaughtUp(id) {
        const item = (Storage.getPersonalData().tracker || []).find(t => t.id === id);
        if (!item) return;
        const latest = Math.max(Number(item.latestChapter || 0), Number(item.currentChapter || 0));
        Storage.updatePersonalItem('tracker', id, { currentChapter: latest, latestChapter: latest });
        App.renderPage('tracker');
    },

    openTrackerUrl(encodedUrl = '') {
        const url = decodeURIComponent(encodedUrl || '');
        if (!url) return App.toast('Nenhum link cadastrado.', 'info');
        window.open(url, '_blank', 'noopener');
    },

    renderMoney(main) {
        if (this._guardPersonal(main)) return;
        const personal = Storage.getPersonalData();
        const money = [...(personal.money || [])].sort((a,b) => {
            const dateB = b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)
                ? new Date(b.date.split('-')[0], b.date.split('-')[1] - 1, b.date.split('-')[2])
                : new Date(b.date || b.createdAt);
            const dateA = a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
                ? new Date(a.date.split('-')[0], a.date.split('-')[1] - 1, a.date.split('-')[2])
                : new Date(a.date || a.createdAt);
            return dateB - dateA;
        });
        const selectedMonth = this.moneyMonth || new Date().toLocaleDateString('sv-SE').slice(0, 7);
        const filter = this.moneyFilter || { kind: 'all', value: '' };
        const monthMoney = money.filter(item => this.moneyItemMonth(item) === selectedMonth);
        const filteredByChart = this.applyMoneyFilter(monthMoney, filter);
        const visibleMoney = this.applyMoneyListFilters(filteredByChart, this.moneyListFilters);
        const summary = this.moneySummary(money, selectedMonth);
        const previousSummary = this.moneySummary(money, this.shiftMoneyMonth(selectedMonth, -1));
        const categories = this.moneyCategories(money, selectedMonth);
        
        main.innerHTML = `
        <div class="module-page personal-page money-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>💸 Money Pessoal</h2>
                    <p>Controle entradas, saídas, assinaturas e compras planejadas separado do financeiro profissional.</p>
                </div>
                <div class="row-actions">
                    <button class="btn btn-secondary" onclick="PersonalHub.showCategoryManagerModal()">⚙️ Categorias</button>
                    <button class="btn btn-primary" onclick="PersonalHub.showMoneyModal()">Novo lançamento</button>
                </div>
            </div>
            
            ${this.moneyMonthNavigatorHtml(selectedMonth)}

            <div class="money-stats-grid">
                <div class="metric-container income-card" onclick="PersonalHub.filterMoney('type','entrada')">
                    <div class="metric-icon">📈</div>
                    <div>
                        <small>Entradas do Mês</small>
                        <h3>${UI.money(summary.income)}</h3>
                        ${this.moneyComparisonHtml(summary.income, previousSummary.income, false)}
                    </div>
                </div>
                <div class="metric-container expense-card" onclick="PersonalHub.filterMoney('type','saida')">
                    <div class="metric-icon">📉</div>
                    <div>
                        <small>Saídas do Mês</small>
                        <h3>${UI.money(summary.expense)}</h3>
                        ${this.moneyComparisonHtml(summary.expense, previousSummary.expense, true)}
                    </div>
                </div>
                <div class="metric-container balance-card ${summary.balance >= 0 ? 'positive' : 'negative'}" onclick="PersonalHub.clearMoneyFilter()">
                    <div class="metric-icon">${summary.balance >= 0 ? '💰' : '⚠️'}</div>
                    <div>
                        <small>Saldo do Mês</small>
                        <h3>${UI.money(summary.balance)}</h3>
                        ${this.moneyComparisonHtml(summary.balance, previousSummary.balance, false)}
                    </div>
                </div>
                <div class="metric-container recurring-card">
                    <div class="metric-icon">🔄</div>
                    <div>
                        <small>Assinaturas/Recorrentes</small>
                        <h3>${summary.recurring}</h3>
                    </div>
                </div>
            </div>
            
            ${this.renderSafeToSpend(money, selectedMonth)}
            
            ${this.moneyChartsHtml(money, categories.slice(0, 8), summary, filter, selectedMonth)}
            
            ${this.moneyFilterHtml(filter, visibleMoney.length, monthMoney.length)}

            ${this.moneyListFiltersHtml(money, visibleMoney.length, selectedMonth)}
            
            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>Lançamentos</h2>
                        <div class="row-actions">
                            <button class="btn btn-sm btn-secondary" onclick="PersonalHub.exportMoneyCsv()">Export CSV</button>
                            <button class="btn btn-sm btn-primary" onclick="PersonalHub.showMoneyModal()">Novo lançamento</button>
                        </div>
                    </div>
                    <div class="money-list-container ${!visibleMoney.length ? 'money-list-empty-overridden' : ''}">
                        ${!visibleMoney.length ? this.moneyListEmptyHtml(monthMoney.length) : ''}
                        ${visibleMoney.length ? visibleMoney.map(item => this.moneyRow(item)).join('') : '<p class="text-muted" style="padding: 20px; text-align: center;">Nenhum lançamento encontrado para o filtro atual.</p>'}
                    </div>
                </div>
                <div class="dash-section" style="margin-top:20px;">
                    <div class="dash-section-header">
                        <h2>Categorias do Mês</h2>
                    </div>
                    <div class="money-categories-container">
                        ${categories.length ? categories.map(cat => {
                            const catDetails = this.getCategoryDetails(cat.name);
                            const style = `background-color: ${catDetails.color}15; color: ${catDetails.color}; border: 1px solid ${catDetails.color}30;`;
                            return `
                            <div class="category-summary-row" onclick="PersonalHub.filterMoney('category','${encodeURIComponent(cat.name)}')" style="cursor: pointer; transition: all 0.2s ease;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span class="cat-icon-bullet" style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; ${style}">${catDetails.emoji}</span>
                                    <span>${App.escapeHtml(cat.name)}</span>
                                </div>
                                <strong>${UI.money(cat.total)}</strong>
                            </div>`;
                        }).join('') : '<p class="text-muted" style="padding: 20px; text-align: center;">As categorias aparecerão quando você registrar saídas.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
        
        setTimeout(() => this.initMoneyCharts(money, categories.slice(0, 8), filter, selectedMonth), 50);
    },

    getMoneyCategories() {
        const personal = Storage.getPersonalData();
        if (!personal.moneyCategories || personal.moneyCategories.length === 0) {
            const defaults = [
                { id: 'casa', name: 'Casa', emoji: '🏠', color: '#FF7043' },
                { id: 'supermercado', name: 'Supermercado', emoji: '🛒', color: '#26A69A' },
                { id: 'estudos', name: 'Estudos', emoji: '🎓', color: '#42A5F5' },
                { id: 'compras', name: 'Compras', emoji: '🛍️', color: '#EC407A' },
                { id: 'pessoal', name: 'Pessoal', emoji: '👤', color: '#AB47BC' },
                { id: 'trabalho', name: 'Trabalho', emoji: '💼', color: '#78909C' },
                { id: 'salario', name: 'Salário', emoji: '💰', color: '#66BB6A' },
                { id: 'internet', name: 'Internet', emoji: '🌐', color: '#26C6DA' },
                { id: 'saude', name: 'Saúde', emoji: '💊', color: '#EF5350' },
                { id: 'transporte', name: 'Transporte', emoji: '🚗', color: '#FFA726' },
                { id: 'lazer', name: 'Lazer', emoji: '🍿', color: '#FFA000' },
                { id: 'assinatura', name: 'Assinatura', emoji: '💳', color: '#5C6BC0' },
                { id: 'investimento', name: 'Investimento', emoji: '📈', color: '#9CCC65' },
                { id: 'outros', name: 'Outros', emoji: '📦', color: '#8D6E63' }
            ];
            personal.moneyCategories = defaults;
            Storage.savePersonalData(personal);
            return defaults;
        }
        return personal.moneyCategories;
    },

    getCategoryDetails(name = '') {
        const categories = this.getMoneyCategories();
        const norm = this.normalize(name);
        let cat = categories.find(c => c.id === name || this.normalize(c.name) === norm);
        if (!cat) {
            cat = { name: name || 'Sem categoria', emoji: '📦', color: '#8D6E63' };
        }
        return cat;
    },

    showCategoryManagerModal() {
        const categories = this.getMoneyCategories();
        App.showModal('Configurar Categorias', `
            <div class="category-manager-container">
                <p class="text-muted" style="margin-bottom: 15px; font-size: 0.85rem;">Personalize suas categorias de finanças pessoais com emojis e cores para deixar seus gráficos e relatórios com a sua cara.</p>
                <div class="category-manager-list" style="max-height: 350px; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                    ${categories.map(cat => {
                        const style = `background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}30;`;
                        return `
                        <div class="category-manager-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; ${style}">${cat.emoji}</span>
                                <strong style="font-size: 0.9rem;">${App.escapeHtml(cat.name)}</strong>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button class="btn btn-sm btn-secondary" onclick="PersonalHub.showEditCategoryModal('${cat.id}')" style="margin: 0; padding: 4px 8px;">Editar</button>
                                <button class="btn btn-sm btn-danger" onclick="PersonalHub.deleteMoneyCategory('${cat.id}')" style="margin: 0; padding: 4px 8px;">Apagar</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                <div class="form-actions" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <button class="btn btn-secondary" onclick="App.closeModal()">Fechar</button>
                    <button class="btn btn-primary" onclick="PersonalHub.showEditCategoryModal('')">+ Nova Categoria</button>
                </div>
            </div>
        `);
    },

    showEditCategoryModal(id = '') {
        const categories = this.getMoneyCategories();
        const cat = categories.find(c => c.id === id) || {};
        
        App.showModal(id ? 'Editar Categoria' : 'Nova Categoria', `
            <form onsubmit="PersonalHub.saveMoneyCategory('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-group">
                    <label>Nome da Categoria</label>
                    <input id="cat-name" value="${App.escapeHtml(cat.name || '')}" placeholder="Supermercado, Almoço, Presentes..." required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Emoji</label>
                        <input id="cat-emoji" value="${App.escapeHtml(cat.emoji || '📦')}" placeholder="🛒" style="text-align: center; font-size: 1.2rem;" required>
                    </div>
                    <div class="form-group">
                        <label>Cor Identificadora</label>
                        <input id="cat-color" type="color" value="${App.escapeHtml(cat.color || '#AB47BC')}">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="PersonalHub.showCategoryManagerModal()">Voltar</button>
                    <button class="btn btn-primary">Salvar Categoria</button>
                </div>
            </form>
        `);
    },

    saveMoneyCategory(id = '') {
        const name = document.getElementById('cat-name')?.value.trim();
        const emoji = document.getElementById('cat-emoji')?.value.trim() || '📦';
        const color = document.getElementById('cat-color')?.value || '#AB47BC';
        
        if (!name) return App.toast('Digite o nome da categoria.', 'error');
        
        const personal = Storage.getPersonalData();
        const categories = personal.moneyCategories || [];
        
        if (id) {
            const index = categories.findIndex(c => c.id === id);
            if (index !== -1) {
                const oldName = categories[index].name;
                categories[index] = { id, name, emoji, color };
                personal.money = (personal.money || []).map(item => {
                    if (item.category === oldName) {
                        return { ...item, category: name };
                    }
                    return item;
                });
            }
        } else {
            const newId = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
            if (categories.some(c => c.id === newId)) {
                return App.toast('Uma categoria com esse nome já existe.', 'error');
            }
            categories.push({ id: newId, name, emoji, color });
        }
        
        personal.moneyCategories = categories;
        Storage.savePersonalData(personal);
        App.toast('Categoria salva com sucesso.', 'success');
        this.showCategoryManagerModal();
        App.renderPage('money');
    },

    deleteMoneyCategory(id) {
        const personal = Storage.getPersonalData();
        const categories = personal.moneyCategories || [];
        const cat = categories.find(c => c.id === id);
        if (!cat) return;
        
        const count = (personal.money || []).filter(item => item.category === cat.name).length;
        const msg = count > 0 
            ? `A categoria "${cat.name}" possui ${count} lançamento(s). Se você excluí-la, eles ficarão "Sem categoria". Continuar?`
            : `Deseja apagar a categoria "${cat.name}"?`;
            
        App.confirmAction(msg, () => {
            personal.moneyCategories = categories.filter(c => c.id !== id);
            personal.money = (personal.money || []).map(item => {
                if (item.category === cat.name) {
                    return { ...item, category: '' };
                }
                return item;
            });
            
            Storage.savePersonalData(personal);
            App.toast('Categoria excluída.', 'info');
            this.showCategoryManagerModal();
            App.renderPage('money');
        }, { title: 'Excluir Categoria', confirmText: 'Excluir', danger: true });
    },

    moneyItemMonth(item = {}) {
        return String(item.date || item.createdAt || '').slice(0, 7);
    },

    shiftMoneyMonth(monthKey, amount = 0) {
        const [year, month] = String(monthKey || '').split('-').map(Number);
        const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + amount, 1);
        return date.toLocaleDateString('sv-SE').slice(0, 7);
    },

    moneyMonthLabel(monthKey) {
        const [year, month] = String(monthKey || '').split('-').map(Number);
        return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    },

    setMoneyMonth(amount = 0) {
        this.moneyMonth = this.shiftMoneyMonth(this.moneyMonth, Number(amount || 0));
        this.moneyFilter = { kind: 'all', value: '' };
        App.renderPage('money');
    },

    resetMoneyMonth() {
        this.moneyMonth = new Date().toLocaleDateString('sv-SE').slice(0, 7);
        this.moneyFilter = { kind: 'all', value: '' };
        App.renderPage('money');
    },

    moneyMonthNavigatorHtml(monthKey) {
        const current = new Date().toLocaleDateString('sv-SE').slice(0, 7);
        return `<div class="money-month-nav" aria-label="Selecionar mês">
            <button type="button" class="money-month-arrow" onclick="PersonalHub.setMoneyMonth(-1)" aria-label="Mês anterior">←</button>
            <div><small>Período</small><strong>${App.escapeHtml(this.moneyMonthLabel(monthKey))}</strong></div>
            <button type="button" class="money-month-arrow" onclick="PersonalHub.setMoneyMonth(1)" aria-label="Próximo mês">→</button>
            ${monthKey !== current ? '<button type="button" class="btn btn-sm btn-secondary" onclick="PersonalHub.resetMoneyMonth()">Mês atual</button>' : ''}
        </div>`;
    },

    moneyComparisonHtml(current = 0, previous = 0, lowerIsBetter = false) {
        if (!previous && !current) return '<span class="money-metric-trend neutral">Sem histórico anterior</span>';
        if (!previous) return '<span class="money-metric-trend neutral">Primeiro mês com dados</span>';
        const difference = ((current - previous) / Math.abs(previous)) * 100;
        const improved = lowerIsBetter ? difference <= 0 : difference >= 0;
        const arrow = difference > 0 ? '↑' : difference < 0 ? '↓' : '→';
        return `<span class="money-metric-trend ${improved ? 'good' : 'bad'}">${arrow} ${Math.abs(difference).toFixed(0)}% vs. mês anterior</span>`;
    },

    applyMoneyListFilters(items = [], filters = {}) {
        const search = this.normalize(filters.search || '');
        return items.filter(item => {
            if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
            if (filters.category && filters.category !== 'all' && (item.category || '') !== filters.category) return false;
            if (filters.account && filters.account !== 'all' && (item.account || '') !== filters.account) return false;
            if (filters.recurring === 'yes' && !item.recurring) return false;
            if (filters.recurring === 'no' && item.recurring) return false;
            if (search && !this.normalize(`${item.title || ''} ${item.note || ''} ${item.category || ''} ${item.account || ''}`).includes(search)) return false;
            return true;
        });
    },

    setMoneyListFilter(key, value) {
        this.moneyListFilters = { ...this.moneyListFilters, [key]: value };
        App.renderPage('money');
    },

    setMoneySearch(value = '') {
        this.moneyListFilters.search = value;
        clearTimeout(this._moneySearchTimer);
        this._moneySearchTimer = setTimeout(() => {
            App.renderPage('money');
            requestAnimationFrame(() => {
                const input = document.querySelector('.money-search input');
                if (!input) return;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            });
        }, 250);
    },

    clearMoneyListFilters() {
        this.moneyListFilters = { search: '', type: 'all', category: 'all', account: 'all', recurring: 'all' };
        App.renderPage('money');
    },

    moneyListFiltersHtml(items = [], visibleCount = 0, monthKey = '') {
        const filters = this.moneyListFilters || {};
        const monthItems = items.filter(item => this.moneyItemMonth(item) === monthKey);
        const categories = [...new Set(monthItems.map(item => item.category).filter(Boolean))].sort();
        const accounts = [...new Set(monthItems.map(item => item.account).filter(Boolean))].sort();
        const hasFilters = Object.entries(filters).some(([key, value]) => key === 'search' ? Boolean(value) : value && value !== 'all');
        const option = (value, label, selected) => `<option value="${App.escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${App.escapeHtml(label)}</option>`;
        return `<div class="money-list-filters">
            <label class="money-search"><span>⌕</span><input value="${App.escapeHtml(filters.search || '')}" oninput="PersonalHub.setMoneySearch(this.value)" placeholder="Buscar lançamento..."></label>
            <select aria-label="Filtrar por tipo" onchange="PersonalHub.setMoneyListFilter('type', this.value)">
                ${option('all', 'Todos os tipos', filters.type)}${option('saida', 'Saídas', filters.type)}${option('entrada', 'Entradas', filters.type)}
            </select>
            <select aria-label="Filtrar por categoria" onchange="PersonalHub.setMoneyListFilter('category', this.value)">
                ${option('all', 'Todas as categorias', filters.category)}${categories.map(value => option(value, value, filters.category)).join('')}
            </select>
            <select aria-label="Filtrar por conta" onchange="PersonalHub.setMoneyListFilter('account', this.value)">
                ${option('all', 'Todas as contas', filters.account)}${accounts.map(value => option(value, value, filters.account)).join('')}
            </select>
            <select aria-label="Filtrar recorrência" onchange="PersonalHub.setMoneyListFilter('recurring', this.value)">
                ${option('all', 'Todos', filters.recurring)}${option('yes', 'Recorrentes', filters.recurring)}${option('no', 'Não recorrentes', filters.recurring)}
            </select>
            <span id="money-visible-count">${visibleCount} resultado(s)</span>
            ${hasFilters ? '<button type="button" class="btn btn-sm btn-secondary" onclick="PersonalHub.clearMoneyListFilters()">Limpar</button>' : ''}
        </div>`;
    },

    moneyListEmptyHtml(monthHasItems = 0) {
        const title = monthHasItems ? 'Nenhum lançamento combina com os filtros.' : 'Este mês ainda está vazio.';
        const detail = monthHasItems ? 'Limpe ou ajuste os filtros para voltar a ver os lançamentos.' : 'Registre a primeira entrada ou saída para montar seu resumo.';
        return `<div class="money-empty-state"><span>💸</span><strong>${title}</strong><p>${detail}</p>${monthHasItems ? '<button class="btn btn-sm btn-secondary" onclick="PersonalHub.clearMoneyListFilters()">Limpar filtros</button>' : '<button class="btn btn-sm btn-primary" onclick="PersonalHub.showMoneyModal()">Novo lançamento</button>'}</div>`;
    },

    moneyChartsHtml(items = [], categories = [], summary = {}, filter = { kind: 'all', value: '' }, selectedMonth = '') {
        const hasTrendData = this.moneyMonthlySeries(items, 6, selectedMonth).some(row => row.income || row.expense);
        const emptyAction = `<div class="money-chart-empty"><span>📊</span><strong>Dados insuficientes</strong><p>Adicione lançamentos para visualizar este gráfico.</p><button class="btn btn-sm btn-primary" onclick="PersonalHub.showMoneyModal()">Adicionar lançamento</button></div>`;
        return `
        <div class="money-insights-grid">
            <div class="glass-card chart-card trend-chart-container">
                <div class="chart-header">
                    <div>
                        <h3>Evolução Mensal</h3>
                        <p class="chart-subtitle">Entradas vs Saídas nos últimos 6 meses. Clique em uma barra para filtrar.</p>
                    </div>
                </div>
                ${hasTrendData ? '<div class="chart-canvas-wrapper"><canvas id="moneyTrendChart"></canvas></div>' : emptyAction}
            </div>
            <div class="glass-card chart-card category-chart-container">
                <div class="chart-header">
                    <div>
                        <h3>Despesas por Categoria</h3>
                        <p class="chart-subtitle">Divisão percentual das saídas do mês corrente. Clique para filtrar.</p>
                    </div>
                </div>
                ${categories.length ? '<div class="chart-canvas-wrapper doughnut-wrapper"><canvas id="moneyCategoryChart"></canvas></div>' : emptyAction}
            </div>
        </div>`;
    },

    initMoneyCharts(items = [], categories = [], filter = {}, selectedMonth = '') {
        if (typeof Chart === 'undefined') {
            if (!this._chartRetryCount) this._chartRetryCount = 0;
            if (this._chartRetryCount < 10) {
                this._chartRetryCount++;
                setTimeout(() => this.initMoneyCharts(items, categories, filter, selectedMonth), 100);
            }
            return;
        }
        this._chartRetryCount = 0;
        
        if (this._moneyTrendChartInstance) {
            this._moneyTrendChartInstance.destroy();
            this._moneyTrendChartInstance = null;
        }
        if (this._moneyCategoryChartInstance) {
            this._moneyCategoryChartInstance.destroy();
            this._moneyCategoryChartInstance = null;
        }
        
        const trendCanvas = document.getElementById('moneyTrendChart');
        const categoryCanvas = document.getElementById('moneyCategoryChart');
        
        if (trendCanvas) {
            const monthlySeries = this.moneyMonthlySeries(items, 6, selectedMonth);
            const ctx = trendCanvas.getContext('2d');
            
            const incomeGradient = ctx.createLinearGradient(0, 0, 0, 240);
            incomeGradient.addColorStop(0, 'rgba(102, 187, 106, 0.45)');
            incomeGradient.addColorStop(1, 'rgba(102, 187, 106, 0.02)');
            
            const expenseGradient = ctx.createLinearGradient(0, 0, 0, 240);
            expenseGradient.addColorStop(0, 'rgba(239, 83, 80, 0.45)');
            expenseGradient.addColorStop(1, 'rgba(239, 83, 80, 0.02)');
            
            this._moneyTrendChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: monthlySeries.map(row => row.short),
                    datasets: [
                        {
                            label: 'Entradas',
                            data: monthlySeries.map(row => row.income),
                            backgroundColor: incomeGradient,
                            borderColor: 'rgb(102, 187, 106)',
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false
                        },
                        {
                            label: 'Saídas',
                            data: monthlySeries.map(row => row.expense),
                            backgroundColor: expenseGradient,
                            borderColor: 'rgb(239, 83, 80)',
                            borderWidth: 2,
                            borderRadius: 6,
                            borderSkipped: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { family: 'inherit', size: 11 }
                            }
                        },
                        tooltip: {
                            padding: 10,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            bodyColor: 'rgba(255,255,255,0.85)',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) {
                                        label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.55)',
                                font: { family: 'inherit', size: 10 }
                            }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.04)' },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.55)',
                                font: { family: 'inherit', size: 10 },
                                callback: function(value) {
                                    return 'R$ ' + value;
                                }
                            }
                        }
                    },
                    onClick: (event, activeElements) => {
                        if (activeElements.length > 0) {
                            const index = activeElements[0].index;
                            const key = monthlySeries[index].key;
                            PersonalHub.filterMoney('month', key);
                        }
                    }
                }
            });
        }
        
        if (categoryCanvas) {
            const chartData = categories.length ? categories : [{ name: 'Sem saídas', total: 0 }];
            const backgroundColors = chartData.map(c => {
                const details = this.getCategoryDetails(c.name);
                return details.color;
            });
            
            const ctx = categoryCanvas.getContext('2d');
            this._moneyCategoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartData.map(c => {
                        const details = this.getCategoryDetails(c.name);
                        return `${details.emoji} ${c.name}`;
                    }),
                    datasets: [{
                        data: chartData.map(c => c.total),
                        backgroundColor: backgroundColors.map(color => color + 'dd'),
                        borderColor: backgroundColors,
                        borderWidth: 1.5,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { family: 'inherit', size: 10 },
                                boxWidth: 10,
                                padding: 6
                            }
                        },
                        tooltip: {
                            padding: 10,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            bodyColor: 'rgba(255,255,255,0.85)',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed !== null) {
                                        label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    onClick: (event, activeElements) => {
                        if (activeElements.length > 0 && categories.length > 0) {
                            const index = activeElements[0].index;
                            const categoryName = categories[index].name;
                            PersonalHub.filterMoney('category', encodeURIComponent(categoryName));
                        }
                    }
                }
            });
        }
    },

    moneyFilterHtml(filter = {}, visibleCount = 0, totalCount = 0) {
        if (!filter.kind || filter.kind === 'all') return '';
        return `<div class="money-filter-banner" style="margin: 15px 0; padding: 12px 18px; border-radius: 12px; background: rgba(124, 77, 255, 0.08); border: 1px solid rgba(124, 77, 255, 0.15); display: flex; align-items: center; justify-content: space-between; gap: 15px; font-size: 0.9rem;">
            <span style="color: var(--color-text-main); font-weight: 500;">📌 ${this.moneyFilterLabel(filter)}</span>
            <div style="display: flex; align-items: center; gap: 12px;">
                <strong style="color: var(--color-text-muted); font-size: 0.85rem;">${visibleCount} de ${totalCount} lançamento(s)</strong>
                <button type="button" class="btn btn-sm btn-secondary" onclick="PersonalHub.clearMoneyFilter()" style="margin: 0; padding: 4px 10px;">Limpar filtro</button>
            </div>
        </div>`;
    },

    moneyFilterLabel(filter = {}) {
        if (filter.kind === 'type') return filter.value === 'entrada' ? 'Mostrando apenas Entradas' : 'Mostrando apenas Saídas';
        if (filter.kind === 'month') {
            const [year, month] = String(filter.value || '').split('-').map(Number);
            const date = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
            return `Filtrado por ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
        }
        if (filter.kind === 'day') return `Filtrado pelo dia ${UI.date(filter.value)}`;
        if (filter.kind === 'category') return `Categoria: ${filter.value || 'Sem categoria'}`;
        return 'Filtro active';
    },

    filterMoney(kind, rawValue = '') {
        const value = kind === 'category' ? decodeURIComponent(rawValue || '') : rawValue;
        if (kind === 'month' && value) {
            this.moneyMonth = value;
            this.moneyFilter = { kind: 'all', value: '' };
            return App.renderPage('money');
        }
        this.moneyFilter = { kind, value };
        App.renderPage('money');
    },

    clearMoneyFilter() {
        this.moneyFilter = { kind: 'all', value: '' };
        App.renderPage('money');
    },

    isMoneyFilterActive(filter = {}, kind, value) {
        return filter.kind === kind && String(filter.value || '') === String(value || '');
    },

    moneyFilterValue(value = '') {
        return encodeURIComponent(value).replace(/'/g, '%27');
    },

    applyMoneyFilter(items = [], filter = {}) {
        if (!filter.kind || filter.kind === 'all') return items;
        if (filter.kind === 'type') return items.filter(item => filter.value === 'entrada' ? item.type === 'entrada' : item.type !== 'entrada');
        if (filter.kind === 'month') return items.filter(item => (item.date || item.createdAt || '').slice(0, 7) === filter.value);
        if (filter.kind === 'day') return items.filter(item => (item.date || item.createdAt || '').slice(0, 10) === filter.value);
        if (filter.kind === 'category') {
            return items.filter(item => (item.category || 'Sem categoria') === filter.value);
        }
        return items;
    },

    moneyMonthlySeries(items = [], count = 6, endMonth = '') {
        const [selectedYear, selectedMonth] = String(endMonth || new Date().toLocaleDateString('sv-SE').slice(0, 7)).split('-').map(Number);
        const now = new Date(selectedYear || new Date().getFullYear(), (selectedMonth || 1) - 1, 1);
        return Array.from({ length: count }, (_, idx) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - idx), 1);
            const key = d.toLocaleDateString('sv-SE').slice(0, 7);
            const monthItems = items.filter(item => (item.date || item.createdAt || '').slice(0, 7) === key);
            const income = monthItems.filter(item => item.type === 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const expense = monthItems.filter(item => item.type !== 'entrada').reduce((sum, item) => sum + Number(item.amount || 0), 0);
            return {
                key,
                income,
                expense,
                label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
                short: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
            };
        });
    },

    moneyDailySeries(items = []) {
        const month = new Date().toLocaleDateString('sv-SE').slice(0, 7);
        const buckets = new Map();
        items.filter(item => (item.date || item.createdAt || '').slice(0, 7) === month).forEach(item => {
            const day = (item.date || item.createdAt || '').slice(8, 10) || '01';
            const bucket = buckets.get(day) || { label: day, dateKey: `${month}-${day}`, income: 0, expense: 0 };
            if (item.type === 'entrada') bucket.income += Number(item.amount || 0);
            else bucket.expense += Number(item.amount || 0);
            buckets.set(day, bucket);
        });
        return Array.from(buckets.values()).sort((a,b) => Number(a.label) - Number(b.label)).slice(-8);
    },

    moneySummary(items = [], month = '') {
        month = month || new Date().toLocaleDateString('sv-SE').slice(0, 7);
        const current = items.filter(i => (i.date || i.createdAt || '').slice(0, 7) === month);
        const income = current.filter(i => i.type === 'entrada').reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const expense = current.filter(i => i.type !== 'entrada').reduce((sum, i) => sum + Number(i.amount || 0), 0);
        return { income, expense, balance: income - expense, recurring: current.filter(i => i.recurring).length };
    },

    moneyCategories(items = [], month = '') {
        month = month || new Date().toLocaleDateString('sv-SE').slice(0, 7);
        const map = new Map();
        items.filter(i => i.type !== 'entrada' && (i.date || i.createdAt || '').slice(0, 7) === month).forEach(item => {
            const key = item.category || 'Sem categoria';
            map.set(key, (map.get(key) || 0) + Number(item.amount || 0));
        });
        return Array.from(map.entries()).map(([name,total]) => ({ name, total })).sort((a,b) => b.total - a.total);
    },

    moneyRow(item) {
        const area = this.getArea(item.areaId);
        const sign = item.type === 'entrada' ? '+' : '-';
        const cat = this.getCategoryDetails(item.category);
        const badgeStyle = `background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}25; padding: 2px 8px; border-radius: 12px; font-weight: 500; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;`;
        
        return `<div class="personal-record money-record ${item.type === 'entrada' ? 'income' : 'expense'}" style="margin-bottom: 8px;">
            <span class="money-icon" style="background-color: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}20;">${cat.emoji}</span>
            <div style="flex: 1;">
                <strong>${App.escapeHtml(item.title || 'Lançamento')}</strong>
                <small style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px;">
                    <span>${UI.date(item.date || item.createdAt)}</span> · 
                    <span style="${badgeStyle}">${cat.emoji} ${App.escapeHtml(cat.name)}</span>
                    ${area ? ` · 💼 ${App.escapeHtml(area.name)}` : ''}
                    ${item.recurring ? ' · 🔄 recorrente' : ''}
                </small>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--color-text-muted);">${App.escapeHtml(item.note || '')}</p>
            </div>
            <div class="money-row-side" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <strong style="font-size: 1.1rem; font-weight: 700; color: ${item.type === 'entrada' ? 'var(--success)' : 'var(--danger)'};">${sign}${UI.money(item.amount)}</strong>
                <button class="btn btn-sm btn-secondary" onclick="PersonalHub.showMoneyModal('${item.id}')" style="margin: 0; padding: 3px 8px; font-size: 0.75rem;">Editar</button>
            </div>
        </div>`;
    },

    moneyCategoryOptions(selected = '') {
        const categories = this.getMoneyCategories();
        const options = categories.map(cat => {
            const isSelected = selected && (cat.id === selected || cat.name === selected || this.normalize(cat.name) === this.normalize(selected));
            return `<option value="${App.escapeHtml(cat.name)}" ${isSelected ? 'selected' : ''}>${cat.emoji} ${App.escapeHtml(cat.name)}</option>`;
        });
        
        const money = Storage.getPersonalData().money || [];
        const existingNames = new Set(categories.map(c => this.normalize(c.name)));
        money.forEach(item => {
            const catName = item.category;
            if (catName && !existingNames.has(this.normalize(catName))) {
                const isSelected = this.normalize(selected) === this.normalize(catName);
                options.push(`<option value="${App.escapeHtml(catName)}" ${isSelected ? 'selected' : ''}>📦 ${App.escapeHtml(catName)}</option>`);
                existingNames.add(this.normalize(catName));
            }
        });
        
        return `<option value="">Sem categoria</option>` + options.join('');
    },

    showMoneyModalLegacy(id = '') {
        const item = (Storage.getPersonalData().money || []).find(m => m.id === id) || {};
        const today = new Date().toLocaleDateString('sv-SE');
        App.showModal(id ? 'Editar lançamento' : 'Novo lançamento pessoal', `
            ${this.modalContext('money', Boolean(id))}
            <form onsubmit="PersonalHub.saveMoney('${id}');return false;" class="settings-entity-form module-form">
                <div class="form-row">
                    <div class="form-group"><label>Tipo</label><select id="money-type">${['saida','entrada'].map(t => `<option value="${t}" ${t===(item.type || 'saida')?'selected':''}>${t}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Data</label><input id="money-date" type="date" value="${App.escapeHtml((item.date || today).slice(0,10))}"></div>
                </div>
                <div class="form-group"><label>Descrição</label><input id="money-title" value="${App.escapeHtml(item.title || '')}" placeholder="Mercado, salário, internet, curso..." required></div>
                <div class="form-row">
                    <div class="form-group"><label>Valor</label><input id="money-amount" type="number" step="0.01" value="${App.escapeHtml(item.amount || '')}" required></div>
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="margin: 0;">Categoria</label>
                            <a href="javascript:void(0)" onclick="App.closeModal(); setTimeout(() => PersonalHub.showCategoryManagerModal(), 150)" style="font-size: 0.72rem; color: var(--accent); text-decoration: none; font-weight: 600;">⚙️ Gerenciar</a>
                        </div>
                        <select id="money-category">${this.moneyCategoryOptions(item.category || '')}</select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Área</label><select id="money-area">${this.areaOptions(item.areaId || '')}</select></div>
                    <div class="form-group"><label>Conta / meio</label><input id="money-account" value="${App.escapeHtml(item.account || '')}" placeholder="Nubank, dinheiro, cartão..."></div>
                </div>
                <label class="checkbox-row"><input type="checkbox" id="money-recurring" ${item.recurring ? 'checked' : ''}> Recorrente / assinatura</label>
                <div class="form-group"><label>Observações / Detalhes Adicionais</label><textarea id="money-note" rows="4" placeholder="Detalhes do lançamento...">${App.escapeHtml(item.note || '')}</textarea></div>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('money','${id}','money')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar</button></div>
            </form>
        `);
    },

    moneyInputValue(value = '') {
        if (value === '' || value === null || typeof value === 'undefined') return '';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    },

    maskMoneyInput(input) {
        const digits = String(input?.value || '').replace(/\D/g, '');
        input.value = digits ? this.moneyInputValue(Number(digits) / 100) : '';
    },

    parseMoneyInput(value = '') {
        const digits = String(value || '').replace(/\D/g, '');
        return digits ? Number(digits) / 100 : 0;
    },

    setMoneyType(type = 'saida') {
        const input = document.getElementById('money-type');
        if (input) input.value = type;
        document.querySelectorAll('.money-type-option').forEach(button => {
            const active = button.dataset.type === type;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    },

    toggleMoneyRecurringFields() {
        const checked = Boolean(document.getElementById('money-recurring')?.checked);
        const fields = document.getElementById('money-recurring-fields');
        if (fields) fields.hidden = !checked;
    },

    showMoneyModal(id = '') {
        const item = (Storage.getPersonalData().money || []).find(entry => entry.id === id) || {};
        const today = new Date().toLocaleDateString('sv-SE');
        const type = item.type || 'saida';
        const recurring = Boolean(item.recurring);
        const advancedOpen = recurring || item.areaId || item.note;
        App.showModal(id ? 'Editar lançamento' : 'Novo lançamento pessoal', `
            ${this.modalContext('money', Boolean(id))}
            <form onsubmit="PersonalHub.saveMoney('${id}');return false;" class="settings-entity-form module-form money-form">
                <div class="form-row money-form-topline">
                    <div class="form-group">
                        <label>Tipo</label>
                        <input id="money-type" type="hidden" value="${type}">
                        <div class="money-type-toggle" role="group" aria-label="Tipo de lançamento">
                            <button type="button" data-type="saida" aria-pressed="${type === 'saida'}" class="money-type-option expense ${type === 'saida' ? 'active' : ''}" onclick="PersonalHub.setMoneyType('saida')">↓ Saída</button>
                            <button type="button" data-type="entrada" aria-pressed="${type === 'entrada'}" class="money-type-option income ${type === 'entrada' ? 'active' : ''}" onclick="PersonalHub.setMoneyType('entrada')">↑ Entrada</button>
                        </div>
                    </div>
                    <div class="form-group"><label>Data</label><input id="money-date" type="date" value="${App.escapeHtml((item.date || today).slice(0,10))}" required></div>
                </div>
                <div class="form-group"><label>Descrição</label><input id="money-title" value="${App.escapeHtml(item.title || '')}" placeholder="Ex.: mercado, salário ou internet" autocomplete="off" required></div>
                <div class="form-row">
                    <div class="form-group"><label>Valor</label><input id="money-amount" class="money-amount-input" inputmode="numeric" value="${App.escapeHtml(this.moneyInputValue(item.amount))}" oninput="PersonalHub.maskMoneyInput(this)" placeholder="R$ 0,00" required></div>
                    <div class="form-group">
                        <div class="money-label-action"><label>Categoria</label><button type="button" onclick="App.closeModal();setTimeout(() => PersonalHub.showCategoryManagerModal(),150)">Gerenciar</button></div>
                        <select id="money-category">${this.moneyCategoryOptions(item.category || '')}</select>
                    </div>
                </div>
                <div class="form-group"><label>Conta / meio de pagamento</label><input id="money-account" value="${App.escapeHtml(item.account || '')}" placeholder="Ex.: Nubank, dinheiro ou cartão"></div>
                <details class="money-advanced" ${advancedOpen ? 'open' : ''}>
                    <summary>Mais opções <span>Área, recorrência e observações</span></summary>
                    <div class="money-advanced-content">
                        <div class="form-group"><label>Área</label><select id="money-area">${this.areaOptions(item.areaId || '')}</select></div>
                        <label class="checkbox-row money-recurring-check"><input type="checkbox" id="money-recurring" ${recurring ? 'checked' : ''} onchange="PersonalHub.toggleMoneyRecurringFields()"> <span>Recorrente / assinatura</span></label>
                        <div id="money-recurring-fields" class="money-recurring-fields" ${recurring ? '' : 'hidden'}>
                            <div class="form-group"><label>Frequência</label><select id="money-frequency"><option value="mensal" ${(item.recurringFrequency || 'mensal') === 'mensal' ? 'selected' : ''}>Mensal</option><option value="semanal" ${item.recurringFrequency === 'semanal' ? 'selected' : ''}>Semanal</option><option value="anual" ${item.recurringFrequency === 'anual' ? 'selected' : ''}>Anual</option></select></div>
                            <div class="form-group"><label>Dia de vencimento</label><input id="money-due-day" type="number" min="1" max="31" value="${App.escapeHtml(item.recurringDueDay || '')}" placeholder="Ex.: 10"></div>
                            <div class="form-group"><label>Repetir até</label><input id="money-recurring-end" type="date" value="${App.escapeHtml(item.recurringEnd || '')}"></div>
                        </div>
                        <div class="form-group"><label>Observações</label><textarea id="money-note" rows="3" placeholder="Detalhes opcionais">${App.escapeHtml(item.note || '')}</textarea></div>
                    </div>
                </details>
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${id ? `<button type="button" class="btn btn-danger" onclick="PersonalHub.deleteRecord('money','${id}','money')">Apagar</button>` : ''}<button class="btn btn-primary">Salvar lançamento</button></div>
            </form>
        `);
    },

    saveMoney(id = '') {
        const data = {
            type: document.getElementById('money-type')?.value || 'saida',
            date: document.getElementById('money-date')?.value || new Date().toLocaleDateString('sv-SE'),
            title: document.getElementById('money-title')?.value.trim(),
            amount: this.parseMoneyInput(document.getElementById('money-amount')?.value || ''),
            category: document.getElementById('money-category')?.value.trim() || '',
            areaId: document.getElementById('money-area')?.value || '',
            account: document.getElementById('money-account')?.value.trim() || '',
            recurring: Boolean(document.getElementById('money-recurring')?.checked),
            recurringFrequency: document.getElementById('money-frequency')?.value || 'mensal',
            recurringDueDay: Number(document.getElementById('money-due-day')?.value || 0) || '',
            recurringEnd: document.getElementById('money-recurring-end')?.value || '',
            note: document.getElementById('money-note')?.value || ''
        };
        if (!data.title) return App.toast('Digite uma descrição.', 'error');
        if (!data.amount) return App.toast('Digite um valor.', 'error');
        id ? Storage.updatePersonalItem('money', id, data) : Storage.addPersonalItem('money', data);
        App.closeModal();
        App.toast('Lançamento salvo.', 'success');
        App.renderPage('money');
    },

    exportMoneyCsv() {
        const rows = [['data','tipo','descricao','valor','categoria','area','conta','recorrente','nota']];
        (Storage.getPersonalData().money || []).forEach(item => {
            const area = this.getArea(item.areaId)?.name || '';
            rows.push([item.date || '', item.type || '', item.title || '', item.amount || 0, item.category || '', area, item.account || '', item.recurring ? 'sim' : 'nao', item.note || '']);
        });
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `money-pessoal-${new Date().toLocaleDateString('sv-SE')}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    renderInbox(main) {
        if (this._guardPersonal(main)) return;
        const items = Storage.getPersonalData().inbox || [];
        const pending = items.filter(i => i.status !== 'resolvido').length;
        const resolved = items.filter(i => i.status === 'resolvido').length;

        main.innerHTML = `
        <div class="module-page personal-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Pessoal</span>
                    <h2>📥 Inbox Pessoal</h2>
                    <p>Capture ideias, pensamentos, compras planejadas ou lembretes rápido, organize depois.</p>
                </div>
                <button class="btn btn-primary" onclick="PersonalHub.quickCapture()">+ Capturar</button>
            </div>
            
            <div class="module-stats">
                <div class="feature-card"><h3>${items.length}</h3><p>Total Capturado</p></div>
                <div class="feature-card" style="border-left: 3px solid #7C4DFF;"><h3>${pending}</h3><p>Itens Pendentes</p></div>
                <div class="feature-card" style="border-left: 3px solid #06D6A0;"><h3>${resolved}</h3><p>Itens Resolvidos</p></div>
            </div>

            <div class="personal-capture">
                <input id="personal-quick-text" placeholder="Ideia, lembrete, compra, pensamento, pendência...">
                <select id="personal-quick-area">${this.areaOptions('')}</select>
                <button class="btn btn-primary" onclick="PersonalHub.quickCapture()">Adicionar</button>
            </div>

            <div class="personal-search-panel">
                <input type="text" id="inbox-search" placeholder="Buscar por texto capturado..." oninput="PersonalHub.filterInboxList()">
                <select id="inbox-filter-area" onchange="PersonalHub.filterInboxList()">
                    <option value="">Todas as áreas</option>
                    ${Storage.getLifeAreas().map(a => `<option value="${a.id}">${App.escapeHtml(a.name)}</option>`).join('')}
                </select>
                <select id="inbox-filter-status" onchange="PersonalHub.filterInboxList()">
                    <option value="">Todos os status</option>
                    <option value="aberto">Pendente</option>
                    <option value="resolvido">Resolvido</option>
                </select>
            </div>

            <div class="dash-sections single-column">
                <div class="dash-section">
                    <div class="dash-section-header">
                        <h2>📥 Itens na Inbox</h2>
                    </div>
                    <div id="personal-inbox-list" class="personal-list">
                        ${items.length ? items.map(i => this.inboxItem(i)).join('') : '<p class="text-muted">Inbox vazia.</p>'}
                    </div>
                </div>
            </div>
        </div>`;
    },

    inboxItem(item) {
        const area = this.getArea(item.areaId);
        return `
        <div class="inbox-record-card" data-text="${App.escapeHtml(item.text || '')}" data-area="${item.areaId || ''}" data-status="${item.status || 'aberto'}" style="margin-bottom: 8px;">
            <div class="personal-record inbox-record ${item.status === 'resolvido' ? 'is-done' : ''}" style="margin-bottom: 0;">
                <span>${item.status === 'resolvido' ? '✅' : '📥'}</span>
                <div>
                    <strong>${App.escapeHtml(item.text || 'Item sem texto')}</strong>
                    <small>${new Date(item.createdAt).toLocaleString('pt-BR')}${area ? ` · ${App.escapeHtml(area.name)}` : ''}</small>
                </div>
                <div class="inbox-actions">
                    <button class="btn btn-sm btn-secondary" onclick="PersonalHub.convertInboxToJournal('${item.id}')">Diário</button>
                    <button class="btn btn-sm btn-secondary" onclick="PersonalHub.convertInboxToNote('${item.id}')">Nota</button>
                    <button class="btn btn-sm btn-primary" onclick="PersonalHub.resolveInbox('${item.id}')">${item.status === 'resolvido' ? 'Reabrir' : 'Resolver'}</button>
                    <button class="btn btn-sm btn-danger" onclick="PersonalHub.deleteRecord('inbox','${item.id}','personal-inbox')">Apagar</button>
                </div>
            </div>
        </div>`;
    },

    quickCapture() {
        const input = document.getElementById('personal-quick-text');
        const text = input?.value.trim();
        const areaId = document.getElementById('personal-quick-area')?.value || '';
        if (!text) return App.toast('Digite algo para capturar.', 'error');
        Storage.addPersonalItem('inbox', { text, areaId, status: 'aberto' });
        if (input) input.value = '';
        App.toast('Enviado para Inbox pessoal.', 'success');
        App.renderPage(App.currentPage);
    },

    resolveInbox(id) {
        const item = (Storage.getPersonalData().inbox || []).find(i => i.id === id);
        if (!item) return;
        Storage.updatePersonalItem('inbox', id, { status: item.status === 'resolvido' ? 'aberto' : 'resolvido' });
        App.renderPage('personal-inbox');
    },

    convertInboxToJournal(id) {
        const item = (Storage.getPersonalData().inbox || []).find(i => i.id === id);
        if (!item) return;
        this.showJournalModal('', item.text || '', id);
    },

    convertInboxToNote(id) {
        const item = (Storage.getPersonalData().inbox || []).find(i => i.id === id);
        if (!item) return;
        const notes = Storage.getNotes({ includePrivate: true });
        const now = new Date().toISOString();
        const note = { id: crypto.randomUUID(), title: (item.text || 'Nota pessoal').slice(0, 70), content: `<p>${App.escapeHtml(item.text || '')}</p>`, folderId: 'default', categoryIds: [], createdAt: now, updatedAt: now, pinned: false };
        notes.unshift(note);
        Storage.saveNotes(notes);
        Storage.updatePersonalItem('inbox', id, { status: 'resolvido' });
        App.toast('Item convertido em nota.', 'success');
        App.navigate('notes');
        setTimeout(() => Notes.openEditor(note.id), 100);
    },

    filterInboxList() {
        const q = (document.getElementById('inbox-search')?.value || '').toLowerCase().trim();
        const area = document.getElementById('inbox-filter-area')?.value || '';
        const status = document.getElementById('inbox-filter-status')?.value || '';
        
        const cards = document.querySelectorAll('.inbox-record-card');
        cards.forEach(card => {
            const text = (card.getAttribute('data-text') || '').toLowerCase();
            const cardArea = card.getAttribute('data-area') || '';
            const cardStatus = card.getAttribute('data-status') || '';
            
            const matchQuery = !q || text.includes(q);
            const matchArea = !area || cardArea === area;
            const matchStatus = !status || cardStatus === status;
            
            if (matchQuery && matchArea && matchStatus) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    deleteRecord(collection, id, page) {
        App.confirmAction('Apagar este item?', () => {
            Storage.deletePersonalItem(collection, id);
            App.closeModal();
            App.toast('Item apagado.', 'info');
            App.renderPage(page);
        }, { title: 'Apagar item', confirmText: 'Apagar', danger: true });
    },

    areaOptions(selected = '') {
        return `<option value="">Sem área</option>${Storage.getLifeAreas().map(a => `<option value="${a.id}" ${a.id===selected?'selected':''}>${App.escapeHtml(a.name)}</option>`).join('')}`;
    },

    getArea(id = '') {
        return Storage.getLifeAreas().find(a => a.id === id) || null;
    },

    normalize(value = '') {
        return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    },

    calculateSafeToSpend(items = [], monthKey = '') {
        const refDate = monthKey ? new Date(`${monthKey}-01T12:00:00`) : (window.TimeTravelDate || new Date());
        const currentMonthStr = refDate.toLocaleDateString('sv-SE').slice(0, 7);
        
        const currentIncome = items.filter(i => i.type === 'entrada' && (i.date || i.createdAt || '').slice(0, 7) === currentMonthStr).reduce((sum, i) => sum + Number(i.amount || 0), 0);
        
        let income = currentIncome;
        let isEstimatedIncome = false;
        if (currentIncome === 0) {
            const prevDate = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
            const prevMonthStr = prevDate.toLocaleDateString('sv-SE').slice(0, 7);
            const estimatedIncome = items.filter(i => i.type === 'entrada' && (i.date || i.createdAt || '').slice(0, 7) === prevMonthStr).reduce((sum, i) => sum + Number(i.amount || 0), 0);
            if (estimatedIncome > 0) {
                income = estimatedIncome;
                isEstimatedIncome = true;
            }
        }
        
        const expense = items.filter(i => i.type !== 'entrada' && (i.date || i.createdAt || '').slice(0, 7) === currentMonthStr).reduce((sum, i) => sum + Number(i.amount || 0), 0);
        
        const sixMonthsAgo = new Date(refDate.getFullYear(), refDate.getMonth() - 6, 1);
        const startOfCurrentMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        
        const pastRecurringItems = items.filter(i => {
            if (i.type === 'entrada' || !i.recurring) return false;
            const itemDateStr = i.date || i.createdAt;
            if (!itemDateStr) return false;
            const itemDate = new Date(itemDateStr);
            const itemMonthStr = itemDateStr.slice(0, 7);
            return itemMonthStr !== currentMonthStr && itemDate >= sixMonthsAgo && itemDate < startOfCurrentMonth;
        });
        
        const commitmentsMap = new Map();
        pastRecurringItems.forEach(item => {
            const normTitle = this.normalize(item.title || '');
            if (!commitmentsMap.has(normTitle)) {
                commitmentsMap.set(normTitle, {
                    title: item.title,
                    amount: Number(item.amount || 0),
                    category: item.category,
                    lastSeenDate: item.date || item.createdAt
                });
            } else {
                const existing = commitmentsMap.get(normTitle);
                if ((item.date || item.createdAt) > existing.lastSeenDate) {
                    commitmentsMap.set(normTitle, {
                        title: item.title,
                        amount: Number(item.amount || 0),
                        category: item.category,
                        lastSeenDate: item.date || item.createdAt
                    });
                }
            }
        });
        
        const currentMonthExpenses = items.filter(i => i.type !== 'entrada' && (i.date || i.createdAt || '').slice(0, 7) === currentMonthStr);
        const currentMonthExpenseTitles = new Set(currentMonthExpenses.map(i => this.normalize(i.title || '')));
        
        const pendingCommitments = [];
        let totalCommitments = 0;
        
        for (const [normTitle, comm] of commitmentsMap.entries()) {
            if (!currentMonthExpenseTitles.has(normTitle)) {
                pendingCommitments.push(comm);
                totalCommitments += comm.amount;
            }
        }
        
        const safeToSpend = income - expense - totalCommitments;
        
        return {
            income,
            isEstimatedIncome,
            expense,
            totalCommitments,
            pendingCommitments,
            safeToSpend,
            hasHistory: items.some(item => this.moneyItemMonth(item) <= currentMonthStr),
            hasRecurringHistory: pastRecurringItems.length > 0
        };
    },

    renderSafeToSpend(items = [], monthKey = '') {
        const data = this.calculateSafeToSpend(items, monthKey);
        if (!data.hasHistory) {
            return `<div class="safe-to-spend-card money-onboarding-state"><div class="money-onboarding-icon">🛡️</div><div><h4>Livre para gastar</h4><p>Registre uma entrada e seus gastos para calcular um valor seguro. Nenhuma estimativa será exibida sem histórico.</p></div><button class="btn btn-primary" onclick="PersonalHub.showMoneyModal()">Adicionar primeiro lançamento</button></div>`;
        }
        const percent = data.income > 0 ? Math.max(0, Math.min(100, (data.safeToSpend / data.income) * 100)) : 0;
        
        let strokeColor = '#00BFA5';
        let glowColor = 'rgba(0, 191, 165, 0.4)';
        let statusText = 'Excelente controle';
        
        if (data.safeToSpend < 0) {
            strokeColor = '#FF1744';
            glowColor = 'rgba(255, 23, 68, 0.4)';
            statusText = 'Limite ultrapassado';
        } else if (percent < 25) {
            strokeColor = '#FF9100';
            glowColor = 'rgba(255, 145, 0, 0.4)';
            statusText = 'Atenção ao orçamento';
        } else if (percent < 50) {
            strokeColor = '#2979FF';
            glowColor = 'rgba(41, 121, 255, 0.4)';
            statusText = 'Zona segura moderada';
        }
        
        const radius = 54;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percent / 100) * circumference;
        const pendingCount = data.pendingCommitments.length;
        
        let commitmentsListHtml = '';
        if (pendingCount === 0 && !data.hasRecurringHistory) {
            commitmentsListHtml = `<div class="money-empty-inline">Ainda não há histórico recorrente suficiente para prever compromissos.</div>`;
        } else if (pendingCount === 0) {
            commitmentsListHtml = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    🎉 Todas as despesas recorrentes estimadas para este mês já foram pagas!
                </div>`;
        } else {
            commitmentsListHtml = data.pendingCommitments.map(c => {
                const cat = this.getCategoryDetails(c.category);
                return `
                <div class="pending-commitment-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}20; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.9rem;">${cat.emoji}</span>
                        <div>
                            <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">${App.escapeHtml(c.title)}</div>
                            <small style="color: var(--text-muted); font-size: 0.75rem;">Última cobrança: ${UI.date(c.lastSeenDate)}</small>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 600; color: #FF9100; font-size: 0.9rem;">${UI.money(c.amount)}</span>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">Pendente (Previsto)</div>
                    </div>
                </div>`;
            }).join('');
        }
        
        return `
        <div class="safe-to-spend-card glass-panel" style="margin-bottom: 24px; padding: 20px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(30, 30, 46, 0.4); backdrop-filter: blur(16px); position: relative; overflow: hidden; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);">
            <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: ${strokeColor}; filter: blur(80px); opacity: 0.15; pointer-events: none; border-radius: 50%;"></div>
            
            <div class="sts-grid" style="display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center;">
                <div class="sts-gauge-wrapper" style="position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;">
                    <svg width="140" height="140" style="transform: rotate(-90deg);">
                        <circle cx="70" cy="70" r="${radius}" stroke="rgba(255,255,255,0.05)" stroke-width="8" fill="transparent" />
                        <circle cx="70" cy="70" r="${radius}" stroke="${strokeColor}" stroke-width="8" fill="transparent"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}"
                                stroke-linecap="round" style="filter: drop-shadow(0 0 4px ${glowColor}); transition: stroke-dashoffset 0.6s ease;" />
                    </svg>
                    <div class="sts-gauge-center" style="position: absolute; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100px;">
                        <span style="font-size: 0.72rem; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);">Livre</span>
                        <strong style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 2px 0; word-break: break-all;">${UI.money(data.safeToSpend)}</strong>
                        <span style="font-size: 0.65rem; color: ${strokeColor}; font-weight: 600; background: ${strokeColor}15; padding: 2px 6px; border-radius: 8px; border: 1px solid ${strokeColor}20;">${statusText}</span>
                    </div>
                </div>
                
                <div class="sts-info" style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                            🛡️ Inteligência Financeira: Livre para Gastar
                            <span class="pulse-dot" style="width: 8px; height: 8px; background: #00BFA5; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #00BFA5;"></span>
                        </h4>
                        <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                            Seu saldo líquido seguro para novos gastos neste mês. Calculado deduzindo todas as contas efetuadas e as despesas recorrentes que o sistema estima que ainda vão vencer.
                        </p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Receita ${data.isEstimatedIncome ? 'Estimada' : 'Real'}</div>
                            <div style="font-size: 0.9rem; font-weight: 600; color: #00BFA5; margin-top: 2px;">
                                ${UI.money(data.income)}
                                ${data.isEstimatedIncome ? '<span title="Sem entradas este mês ainda; baseado no mês anterior." style="cursor:help; font-size:0.75rem;">⚡</span>' : ''}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Gastos Efetuados</div>
                            <div style="font-size: 0.9rem; font-weight: 600; color: #FF1744; margin-top: 2px;">${UI.money(data.expense)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Compromissos Pendentes</div>
                            <div style="font-size: 0.9rem; font-weight: 600; color: #FF9100; margin-top: 2px;">${UI.money(data.totalCommitments)}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-secondary" onclick="PersonalHub.toggleStsDrawer()" style="display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); font-size: 0.78rem;">
                            🔄 ${pendingCount > 0 ? `Ver ${pendingCount} Compromissos Pendentes` : 'Verificar Compromissos'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="sts-drawer" style="max-height: 0px; overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1); margin-top: 0px;">
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 16px;">
                    <h5 style="margin: 0 0 12px 0; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">
                        🔮 Compromissos Recorrentes Pendentes (Previsão)
                    </h5>
                    <div class="pending-commitments-list" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">
                        ${commitmentsListHtml}
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 0.72rem; color: var(--text-muted); font-style: italic;">
                        * O sistema analisa saídas com flag "Recorrente" nos últimos 6 meses e prevê aquelas que ainda não foram registradas (com o mesmo título) no mês atual.
                    </p>
                </div>
            </div>
        </div>`;
    },
    
    toggleStsDrawer() {
        const drawer = document.getElementById('sts-drawer');
        if (!drawer) return;
        if (drawer.style.maxHeight === '0px' || !drawer.style.maxHeight) {
            drawer.style.maxHeight = drawer.scrollHeight + 'px';
            drawer.style.marginTop = '16px';
        } else {
            drawer.style.maxHeight = '0px';
            drawer.style.marginTop = '0px';
        }
    }
};
window.PersonalHub = PersonalHub;
