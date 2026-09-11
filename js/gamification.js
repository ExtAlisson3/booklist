// ============================================
// GAMIFICATION ENGINE - practical quests + useful rewards
// ============================================
const Gamification = {
    initialized: false,
    state: {
        xp: 0,
        level: 1,
        streak: 0,
        lastActiveDate: null,
        achievements: [],
        history: [],
        completedQuests: [],
        unlockedRewards: [],
        claimedRewards: [],
        unlockedNodes: []
    },

    QUESTS: [
        { id: 'daily_capture', repeat: 'daily', title: 'Captura util do dia', desc: 'Salve ou crie pelo menos uma nota/bookmark hoje.', xp: 35, rewardId: 'pet_memo' },
        { id: 'context_focus', title: 'Entrar em modo foco', desc: 'Use Trabalho ou Pessoal no Modo Contexto global.', xp: 25 },
        { id: 'inbox_zero', title: 'Mesa limpa', desc: 'Zere as capturas pendentes de notas, links e inbox pessoal.', xp: 90, rewardId: 'theme_focus' },
        { id: 'ticket_done', title: 'OS resolvida', desc: 'Finalize pelo menos um atendimento tecnico.', xp: 120 },
        { id: 'equipment_registry', title: 'Inventario vivo', desc: 'Cadastre 3 equipamentos para habilitar rotina com QR.', xp: 100, rewardId: 'snippet_pack' },
        { id: 'custom_snippet', title: 'Resposta de tecnico preparada', desc: 'Crie um snippet personalizado para atendimento.', xp: 60 },
        { id: 'rag_question', title: 'Consultar o segundo cerebro', desc: 'Faca uma pergunta ao chat RAG do BookList.', xp: 50 }
    ],

    REWARDS: [
        { id: 'pet_memo', title: 'Pet Memo', desc: 'Mostra um pequeno pet ajudante no menu de nivel.', action: 'pet' },
        { id: 'theme_focus', title: 'Accent Foco Verde', desc: 'Aplica uma cor de foco mais calma na interface.', action: 'accent', value: '#00BFA5' },
        { id: 'snippet_pack', title: 'Pacote de respostas tecnicas', desc: 'Adiciona snippets /ok, /pix e /gar para tickets e clientes.', action: 'snippets' }
    ],

    async init() {
        if (this.initialized) return;
        try {
            const data = await Storage._readRecord('booklist_gamification');
            if (data) this.state = this.normalizeState(data);
        } catch (err) {
            console.error('[Gamification] Error loading state:', err);
        }
        this.checkStreak();
        window.Events?.on('storage:event', event => this.handleEvent(event));
        window.Events?.on('storage:changed', () => this.checkQuests());
        this.injectWidgets();
        this.checkQuests();
        this.initialized = true;
    },

    normalizeState(data = {}) {
        return {
            xp: Number(data.xp || 0),
            level: Number(data.level || 1),
            streak: Number(data.streak || 0),
            lastActiveDate: data.lastActiveDate || null,
            achievements: Array.isArray(data.achievements) ? data.achievements : [],
            history: Array.isArray(data.history) ? data.history : [],
            completedQuests: Array.isArray(data.completedQuests) ? data.completedQuests : [],
            unlockedRewards: Array.isArray(data.unlockedRewards) ? data.unlockedRewards : [],
            claimedRewards: Array.isArray(data.claimedRewards) ? data.claimedRewards : [],
            unlockedNodes: Array.isArray(data.unlockedNodes) ? data.unlockedNodes : []
        };
    },

    todayKey() {
        return new Date().toLocaleDateString('sv');
    },

    questKey(quest) {
        return quest.repeat === 'daily' ? `${quest.id}:${this.todayKey()}` : quest.id;
    },

    xpForNextLevel() {
        return this.state.level * 120;
    },

    async save() {
        try {
            await Storage._putRecord('booklist_gamification', this.state);
        } catch (err) {
            console.error('[Gamification] Error saving state:', err);
        }
        this.updateUI();
    },

    checkStreak() {
        const today = this.todayKey();
        const lastDate = this.state.lastActiveDate;
        if (!lastDate) {
            this.state.streak = 1;
            this.state.lastActiveDate = today;
            this.awardXp(20, 'Primeiro acesso do dia');
            return;
        }
        if (lastDate === today) return;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.state.streak = lastDate === yesterday.toLocaleDateString('sv') ? this.state.streak + 1 : 1;
        this.state.lastActiveDate = today;
        this.awardXp(20 + Math.min(this.state.streak * 5, 40), `Sequencia ativa de ${this.state.streak} dia(s)`);
    },

    handleEvent(event) {
        const type = event.type;
        const payload = event.payload || {};
        if (type === 'note.created') this.awardXp(12, 'Nota criada');
        if (type === 'bookmark.created') this.awardXp(10, 'Bookmark capturado');
        if (type === 'bookmark.opened') this.awardXp(3, 'Referencia aberta');
        if (type === 'professional.created') this.awardXp(18, 'Registro tecnico criado');
        if (type === 'professional.updated' && payload.moduleKey === 'tickets') {
            const rec = Storage.getProfessionalRecords('tickets').find(r => r.id === payload.id);
            if (rec?.status === 'finalizado') this.completeQuest('ticket_done');
        }
        this.checkQuests();
    },

    awardRagQuery() {
        this.completeQuest('rag_question');
    },

    awardWhiteboard() {
        this.awardXp(25, 'Quadro visual usado');
    },

    awardZenFocus() {
        this.completeQuest('context_focus');
    },

    awardXp(amount, reason) {
        let finalAmount = amount;
        const unlocked = this.state.unlockedNodes || [];
        
        // 25% global boost
        if (unlocked.includes('focus_3')) {
            finalAmount *= 1.25;
        }
        
        // Specific boosts
        if (unlocked.includes('focus_1') && (reason.toLowerCase().includes('bookmark') || reason.toLowerCase().includes('favorito'))) {
            finalAmount *= 1.10;
        }
        if (unlocked.includes('tech_1') && (reason.toLowerCase().includes('ticket') || reason.toLowerCase().includes('servico') || reason.toLowerCase().includes('chamado'))) {
            finalAmount *= 1.15;
        }
        if (unlocked.includes('finance_1') && (reason.toLowerCase().includes('finance') || reason.toLowerCase().includes('money') || reason.toLowerCase().includes('lançamento'))) {
            finalAmount *= 1.10;
        }
        
        finalAmount = Math.max(1, Math.round(finalAmount));

        this.state.xp += finalAmount;
        this.state.history.unshift({ xp: finalAmount, reason, date: new Date().toISOString() });
        this.state.history = this.state.history.slice(0, 60);
        let leveled = false;
        while (this.state.xp >= this.xpForNextLevel()) {
            this.state.xp -= this.xpForNextLevel();
            this.state.level++;
            leveled = true;
        }
        if (leveled) this.triggerLevelUpModal();
        else this.showXpFloatingIndicator(finalAmount, reason);
        this.save();
    },

    checkQuests() {
        this.QUESTS.forEach(quest => {
            if (this.state.completedQuests.includes(this.questKey(quest))) return;
            if (this.questIsDone(quest.id)) this.completeQuest(quest.id);
        });
    },

    questIsDone(id) {
        const today = new Date().toDateString();
        const notesToday = Storage.getNotes().filter(n => new Date(n.createdAt || n.updatedAt || 0).toDateString() === today).length;
        const bksToday = Storage.getBookmarks().filter(b => new Date(b.createdAt || b.updatedAt || 0).toDateString() === today).length;
        const personal = Storage.getPersonalData();
        const pendingPersonal = (personal.inbox || []).filter(i => !['feito','arquivado','concluido'].includes(i.status)).length;
        const pendingCaptures = Storage.getBookmarks().filter(b => b.inbox).length + Storage.getNotes().filter(n => n.inbox).length + pendingPersonal;
        if (id === 'daily_capture') return notesToday + bksToday > 0;
        if (id === 'context_focus') return Storage.getSettings().workspaceMode !== 'all';
        if (id === 'inbox_zero') return pendingCaptures === 0 && (Storage.getBookmarks().length + Storage.getNotes().length > 0);
        if (id === 'ticket_done') return Storage.getProfessionalRecords('tickets').some(t => t.status === 'finalizado');
        if (id === 'equipment_registry') return Storage.getProfessionalRecords('equipment').length >= 3;
        if (id === 'custom_snippet') return Storage.getQuickSnippets().some(s => !s.readonly);
        if (id === 'rag_question') return false;
        return false;
    },

    completeQuest(id) {
        const quest = this.QUESTS.find(q => q.id === id);
        if (!quest) return;
        const key = this.questKey(quest);
        if (this.state.completedQuests.includes(key)) return;
        this.state.completedQuests.push(key);
        if (quest.rewardId && !this.state.unlockedRewards.includes(quest.rewardId)) {
            this.state.unlockedRewards.push(quest.rewardId);
        }
        this.triggerQuestModal(quest);
        this.awardXp(quest.xp, `Quest: ${quest.title}`);
    },

    claimReward(id) {
        const reward = this.REWARDS.find(r => r.id === id);
        if (!reward || !this.state.unlockedRewards.includes(id)) return;
        if (reward.action === 'accent') {
            Storage.saveSettings({ accent: reward.value });
            App.applyAppearance();
        }
        if (reward.action === 'snippets') {
            const existing = new Set(Storage.getQuickSnippets().map(s => s.shortcut));
            [
                ['/ok', 'Servico concluido', '<p>Ola {{nome_cliente}}, servico concluido e equipamento liberado. Recomendo testar os pontos principais na retirada.</p>'],
                ['/pix', 'Enviar PIX', '<p>Segue a chave PIX para pagamento. Assim que confirmar, atualizo o status do atendimento.</p>'],
                ['/gar', 'Garantia', '<p>Garantia registrada para este atendimento. Guarde este historico caso precise acionar suporte novamente.</p>']
            ].forEach(([shortcut, name, content]) => {
                if (!existing.has(shortcut)) Storage.addQuickSnippet({ shortcut, name, content });
            });
        }
        if (!this.state.claimedRewards.includes(id)) this.state.claimedRewards.push(id);
        this.save();
        App.toast(`Recompensa aplicada: ${reward.title}`, 'success');
        document.querySelector('.mui-gamify-panel-overlay')?.remove();
        this.showPanel();
    },

    showXpFloatingIndicator(amount, reason) {
        const floatEl = document.createElement('div');
        floatEl.className = 'mui-xp-floater';
        floatEl.innerHTML = `<span>+${amount} XP</span><small>${this.escape(reason)}</small>`;
        document.body.appendChild(floatEl);
        setTimeout(() => floatEl.remove(), 2500);
    },

    triggerLevelUpModal() {
        const overlay = document.createElement('div');
        overlay.className = 'mui-gamify-modal-overlay';
        overlay.innerHTML = `
            <div class="mui-gamify-modal mui-glass level-up-pop animate-pop">
                <div class="modal-icon">LV</div>
                <h2>Novo nivel: ${this.state.level}</h2>
                <p>Voce ganhou mais capacidade de rotina. Continue fechando ciclos reais, nao so colecionando pontos.</p>
                <button onclick="this.closest('.mui-gamify-modal-overlay').remove()" class="btn btn-primary">Continuar</button>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    triggerQuestModal(quest) {
        const reward = this.REWARDS.find(r => r.id === quest.rewardId);
        const overlay = document.createElement('div');
        overlay.className = 'mui-gamify-modal-overlay';
        overlay.innerHTML = `
            <div class="mui-gamify-modal mui-glass achievement-pop animate-pop">
                <div class="modal-icon">Q</div>
                <span class="modal-kicker">QUEST CONCLUIDA</span>
                <h2>${this.escape(quest.title)}</h2>
                <p class="ach-desc">${this.escape(quest.desc)}</p>
                <div class="reward-xp-badge">+${quest.xp} XP${reward ? ` · Recompensa: ${this.escape(reward.title)}` : ''}</div>
                <button onclick="this.closest('.mui-gamify-modal-overlay').remove()" class="btn btn-primary">Boa</button>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    injectWidgets() {
        const nav = document.getElementById('app-nav');
        if (nav && !document.getElementById('mui-sidebar-gamify')) {
            const badge = document.createElement('div');
            badge.id = 'mui-sidebar-gamify';
            badge.className = 'mui-sidebar-gamify';
            badge.onclick = () => this.showPanel();
            nav.insertBefore(badge, nav.firstChild);
        }
        this.updateUI();
    },

    updateUI() {
        const xpPercent = Math.min(100, (this.state.xp / this.xpForNextLevel()) * 100);
        const sidebar = document.getElementById('mui-sidebar-gamify');
        if (sidebar) {
            const pet = this.state.unlockedRewards.includes('pet_memo') ? '<span class="sidebar-pet">memo</span>' : '';
            sidebar.innerHTML = `
                <div class="sidebar-avatar-wrap"><span class="sidebar-avatar-letter">N${this.state.level}</span>${pet}</div>
                <span class="sidebar-gamify-tooltip">Nivel ${this.state.level} (${Math.round(xpPercent)}%) · ${this.state.streak}d · quests</span>
            `;
        }
    },

    showPanel() {
        this.checkQuests();
        const overlay = document.createElement('div');
        overlay.className = 'mui-gamify-panel-overlay';
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        const today = this.todayKey();
        const questHtml = this.QUESTS.map(q => {
            const done = this.state.completedQuests.includes(this.questKey(q));
            return `<div class="mui-quest-card ${done ? 'done' : ''}">
                <div><strong>${this.escape(q.title)}</strong><small>${this.escape(q.desc)}</small></div>
                <span>${done ? 'OK' : '+' + q.xp + ' XP'}</span>
            </div>`;
        }).join('');
        const rewardHtml = this.REWARDS.map(r => {
            const unlocked = this.state.unlockedRewards.includes(r.id);
            const claimed = this.state.claimedRewards.includes(r.id);
            return `<div class="mui-reward-card ${unlocked ? 'unlocked' : 'locked'}">
                <div><strong>${this.escape(r.title)}</strong><small>${this.escape(r.desc)}</small></div>
                ${unlocked ? `<button class="btn btn-sm ${claimed ? 'btn-secondary' : 'btn-primary'}" onclick="Gamification.claimReward('${r.id}')">${claimed ? 'Aplicar de novo' : 'Aplicar'}</button>` : '<span>Bloqueado</span>'}
            </div>`;
        }).join('');
        const historyHtml = this.state.history.slice(0, 8).map(h => `<div class="mui-history-row"><span class="hist-reason">${this.escape(h.reason)}</span><span class="hist-xp">+${h.xp}</span><span class="hist-date">${new Date(h.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') || '<p class="text-muted">Sem historico ainda.</p>';
        overlay.innerHTML = `
            <div class="mui-gamify-panel mui-glass animate-slide">
                <div class="panel-head"><h2>Life OS Quests</h2><button class="mui-close-btn" onclick="this.closest('.mui-gamify-panel-overlay').remove()">&times;</button></div>
                <div class="panel-hero" style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div class="hero-stats"><div class="hero-level">Nivel <span>${this.state.level}</span></div><div class="hero-xp">${this.state.xp} / ${this.xpForNextLevel()} XP</div></div>
                        <div class="hero-streak">Sequencia: <span>${this.state.streak} dia(s)</span><small>${today}</small></div>
                    </div>
                    <button class="btn btn-primary" onclick="Gamification.showSkillTreeModal()" style="width: 100%; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #7C4DFF, #00BFA5); border: none; box-shadow: 0 0 10px rgba(124, 77, 255, 0.4); padding: 8px 12px; border-radius: 8px; font-weight: 600; color: #fff; cursor: pointer;">
                        🌳 Árvore de Habilidades RPG (Skill Tree)
                    </button>
                </div>
                <div class="panel-sections">
                    <div class="panel-section"><h3>Quests logicas</h3><div class="mui-quest-list">${questHtml}</div></div>
                    <div class="panel-section"><h3>Recompensas uteis</h3><div class="mui-reward-list">${rewardHtml}</div></div>
                    <div class="panel-section"><h3>Historico recente</h3><div class="history-list-pane">${historyHtml}</div></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    escape(value = '') {
        return (window.App?.escapeHtml ? App.escapeHtml(value) : String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
    },

    SKILL_NODES: {
        focus_1: { id: 'focus_1', tree: 'focus', label: 'Iniciado do Foco', desc: 'Usar Modo Contexto global para limpar ruídos.', cost: 1, req: null, bonus: '+10% XP em bookmarks', color: '#00BFA5' },
        focus_2: { id: 'focus_2', tree: 'focus', label: 'Mestre da Inbox', desc: 'Zerar as capturas pendentes do Inbox.', cost: 2, req: 'focus_1', bonus: 'Habilita visual Aurora Violeta', color: '#E040FB' },
        focus_3: { id: 'focus_3', tree: 'focus', label: 'Guru do Foco', desc: 'Concluir a quest Zerar Inbox 10 vezes.', cost: 3, req: 'focus_2', bonus: '+25% XP global', color: '#7C4DFF' },
        
        tech_1: { id: 'tech_1', tree: 'tech', label: 'Mão na Graxa', desc: 'Criar primeiro ticket técnico no painel.', cost: 1, req: null, bonus: '+15% XP em tickets', color: '#00E5FF' },
        tech_2: { id: 'tech_2', tree: 'tech', label: 'Analista de Redes', desc: 'Mapear uma topologia de rede local.', cost: 2, req: 'tech_1', bonus: 'Comandos de ping no terminal', color: '#2979FF' },
        tech_3: { id: 'tech_3', tree: 'tech', label: 'Lorde SysAdmin', desc: 'Finalizar 5 ordens de serviço / tickets.', cost: 3, req: 'tech_2', bonus: 'Tema hacker no terminal', color: '#00E676' },
        
        finance_1: { id: 'finance_1', tree: 'finance', label: 'Poupador', desc: 'Registrar 3 lançamentos no Money Pessoal.', cost: 1, req: null, bonus: '+10% XP financeiro', color: '#FFD700' },
        finance_2: { id: 'finance_2', tree: 'finance', label: 'Consumidor Consciente', desc: 'Utilizar a visão Safe to Spend.', cost: 2, req: 'finance_1', bonus: 'Simulador de juros compostos', color: '#FF9100' },
        finance_3: { id: 'finance_3', tree: 'finance', label: 'Magnata Pessoal', desc: 'Economizar 20% de suas receitas no mês.', cost: 3, req: 'finance_2', bonus: '+30% XP em metas', color: '#FF1744' }
    },

    getAvailableSkillPoints() {
        const unlockedCount = (this.state.unlockedNodes || []).reduce((sum, nodeId) => {
            const node = this.SKILL_NODES[nodeId];
            return sum + (node ? node.cost : 0);
        }, 0);
        return Math.max(0, this.state.level - 1 - unlockedCount);
    },

    showSkillTreeModal() {
        const modal = document.createElement('div');
        modal.id = 'skill-tree-overlay';
        modal.className = 'mui-gamify-panel-overlay';
        modal.style.zIndex = '10000';
        
        const points = this.getAvailableSkillPoints();
        
        modal.innerHTML = `
        <div class="skill-tree-modal glass-panel" style="width: 90vw; height: 85vh; max-width: 1200px; display: grid; grid-template-columns: 1fr 320px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(15,15,25,0.85); backdrop-filter: blur(20px); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); position: relative; animation: skill-pop 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);">
            <div style="position: relative; width: 100%; height: 100%; overflow: hidden; background: radial-gradient(circle at center, rgba(30, 30, 60, 0.4) 0%, rgba(10, 10, 20, 0.8) 100%);">
                <canvas id="skill-tree-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: grab;"></canvas>
                <div style="position: absolute; top: 16px; left: 16px; pointer-events: none;">
                    <span class="module-kicker" style="color: #7C4DFF;">RPG Life Engine</span>
                    <h3 style="margin: 4px 0 0 0; color: #fff; text-shadow: 0 0 8px rgba(124, 77, 255, 0.4);">🌳 Árvore de Habilidades</h3>
                    <small style="color: var(--text-muted);">Clique e arraste para explorar. Clique em um nodo para ver detalhes.</small>
                </div>
            </div>
            
            <div class="skill-sidebar" style="border-left: 1px solid rgba(255,255,255,0.08); background: rgba(10,10,15,0.5); padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h4 style="margin: 0; color: #fff; font-size: 1.1rem;">Habilidades RPG</h4>
                        <button onclick="document.getElementById('skill-tree-overlay').remove()" class="mui-close-btn" style="background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    
                    <div class="nixie-points" style="background: #05050f; border: 2px solid rgba(124, 77, 255, 0.3); box-shadow: 0 0 10px rgba(124, 77, 255, 0.2); padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 24px; font-family: monospace;">
                        <div style="font-size: 0.65rem; color: #7C4DFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Pontos Disponíveis</div>
                        <strong id="skill-points-display" style="font-size: 1.8rem; color: #7C4DFF; text-shadow: 0 0 8px rgba(124, 77, 255, 0.8);">${points}</strong>
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">(1 Ponto por Nível alcançado)</div>
                    </div>
                    
                    <div id="selected-node-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 250px; justify-content: center; align-items: center; text-align: center; transition: all 0.3s ease;">
                        <span style="font-size: 2.5rem;">🌳</span>
                        <h5 style="margin: 0; color: #fff; font-size: 1rem;">Selecione um Nodo</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">Clique em qualquer círculo na árvore para inspecionar, ver requisitos e desbloquear novos bônus permanentes.</p>
                    </div>
                </div>
                
                <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
                    💡 Cada nodo ativado concede bônus permanentes na sua jornada BookList.
                </div>
            </div>
        </div>
        
        <style>
            @keyframes skill-pop {
                0% { opacity: 0; transform: scale(0.95); }
                100% { opacity: 1; transform: scale(1); }
            }
        </style>
        `;
        
        document.body.appendChild(modal);
        this.initSkillTreeCanvas();
    },

    initSkillTreeCanvas() {
        const canvas = document.getElementById('skill-tree-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = canvas.parentElement.clientWidth;
        let height = canvas.height = canvas.parentElement.clientHeight;
        
        window.addEventListener('resize', () => {
            if (!canvas || !canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.clientWidth;
            height = canvas.height = canvas.parentElement.clientHeight;
        });
        
        let cameraX = 0;
        let cameraY = 0;
        let dragStart = null;
        let isDraggingCamera = false;
        
        const nodes = [
            { id: 'root', type: 'root', label: 'Cérebro Digital', desc: 'Sua mente integrada ao ecossistema BookList.', cost: 0, req: null, x: 0, y: 0, targetX: 0, targetY: 50, vx: 0, vy: 0, radius: 28, emoji: '🧠', color: '#7C4DFF', unlocked: true },
            
            { id: 'focus_1', type: 'skill', label: 'Iniciado do Foco', desc: 'Usar Modo Contexto global para limpar ruídos.', cost: 1, req: 'root', x: -100, y: -20, targetX: -160, targetY: -20, vx: 0, vy: 0, radius: 22, emoji: '🧘', color: '#00BFA5', tree: 'focus' },
            { id: 'focus_2', type: 'skill', label: 'Mestre da Inbox', desc: 'Zerar as capturas pendentes do Inbox.', cost: 2, req: 'focus_1', x: -200, y: -70, targetX: -280, targetY: -100, vx: 0, vy: 0, radius: 22, emoji: '📥', color: '#E040FB', tree: 'focus' },
            { id: 'focus_3', type: 'skill', label: 'Guru do Foco', desc: 'Concluir a quest Zerar Inbox 10 vezes.', cost: 3, req: 'focus_2', x: -300, y: -120, targetX: -400, targetY: -180, vx: 0, vy: 0, radius: 22, emoji: '✨', color: '#7C4DFF', tree: 'focus' },
            
            { id: 'tech_1', type: 'skill', label: 'Mão na Graxa', desc: 'Criar primeiro ticket técnico no painel.', cost: 1, req: 'root', x: 0, y: -100, targetX: 0, targetY: -120, vx: 0, vy: 0, radius: 22, emoji: '🔧', color: '#00E5FF', tree: 'tech' },
            { id: 'tech_2', type: 'skill', label: 'Analista de Redes', desc: 'Mapear uma topologia de rede local.', cost: 2, req: 'tech_1', x: 0, y: -200, targetX: 0, targetY: -240, vx: 0, vy: 0, radius: 22, emoji: '🌐', color: '#2979FF', tree: 'tech' },
            { id: 'tech_3', type: 'skill', label: 'Lorde SysAdmin', desc: 'Finalizar 5 ordens de serviço / tickets.', cost: 3, req: 'tech_2', x: 0, y: -300, targetX: 0, targetY: -360, vx: 0, vy: 0, radius: 22, emoji: '👑', color: '#00E676', tree: 'tech' },
            
            { id: 'finance_1', type: 'skill', label: 'Poupador', desc: 'Registrar 3 lançamentos no Money Pessoal.', cost: 1, req: 'root', x: 100, y: -20, targetX: 160, targetY: -20, vx: 0, vy: 0, radius: 22, emoji: '💰', color: '#FFD700', tree: 'finance' },
            { id: 'finance_2', type: 'skill', label: 'Consumidor Consciente', desc: 'Utilizar a visão Safe to Spend.', cost: 2, req: 'finance_1', x: 200, y: -70, targetX: 280, targetY: -100, vx: 0, vy: 0, radius: 22, emoji: '🛡️', color: '#FF9100', tree: 'finance' },
            { id: 'finance_3', type: 'skill', label: 'Magnata Pessoal', desc: 'Economizar 20% de suas receitas no mês.', cost: 3, req: 'finance_2', x: 300, y: -120, targetX: 400, targetY: -180, vx: 0, vy: 0, radius: 22, emoji: '🔥', color: '#FF1744', tree: 'finance' }
        ];
        
        const updateNodesUnlockStatus = () => {
            nodes.forEach(n => {
                if (n.id !== 'root') {
                    n.unlocked = (this.state.unlockedNodes || []).includes(n.id);
                }
            });
        };
        updateNodesUnlockStatus();
        
        let selectedNode = null;
        let draggedNode = null;
        
        const centerX = width / 2;
        const centerY = height / 2 + 30;
        
        nodes.forEach(n => {
            n.x = centerX + n.targetX + (Math.random() - 0.5) * 50;
            n.y = centerY + n.targetY + (Math.random() - 0.5) * 50;
        });
        
        const particles = [];
        const spawnParticles = (x, y, color) => {
            for (let i = 0; i < 24; i++) {
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.03,
                    radius: 2 + Math.random() * 3,
                    color
                });
            }
        };
        
        const tick = () => {
            if (!document.getElementById('skill-tree-canvas')) return;
            
            ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
            ctx.fillRect(0, 0, width, height);
            
            const originX = centerX + cameraX;
            const originY = centerY + cameraY;
            
            nodes.forEach(n => {
                if (n === draggedNode) return;
                
                const idealX = originX + n.targetX;
                const idealY = originY + n.targetY;
                const fx = (idealX - n.x) * 0.04;
                const fy = (idealY - n.y) * 0.04;
                n.vx += fx;
                n.vy += fy;
                
                nodes.forEach(other => {
                    if (n === other) return;
                    const dx = n.x - other.x;
                    const dy = n.y - other.y;
                    const distSq = dx*dx + dy*dy;
                    if (distSq < 7000) {
                        const dist = Math.sqrt(distSq) || 1;
                        const force = (80 - dist) * 0.08;
                        n.vx += (dx / dist) * force;
                        n.vy += (dy / dist) * force;
                    }
                });
                
                n.vx *= 0.75;
                n.vy *= 0.75;
                n.x += n.vx;
                n.y += n.vy;
            });
            
            nodes.forEach(n => {
                if (n.req) {
                    const parent = nodes.find(p => p.id === n.req);
                    if (parent) {
                        ctx.beginPath();
                        ctx.moveTo(parent.x, parent.y);
                        ctx.lineTo(n.x, n.y);
                        
                        if (n.unlocked) {
                            ctx.strokeStyle = n.color;
                            ctx.lineWidth = 3;
                            ctx.shadowBlur = 12;
                            ctx.shadowColor = n.color;
                        } else {
                            const isReqUnlocked = parent.unlocked;
                            ctx.strokeStyle = isReqUnlocked ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)';
                            ctx.lineWidth = 1.5;
                            ctx.shadowBlur = 0;
                            if (!isReqUnlocked) {
                                ctx.setLineDash([4, 4]);
                            }
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.shadowBlur = 0;
                    }
                }
            });
            
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.decay;
                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.shadowBlur = 6;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1.0;
            }
            
            nodes.forEach(n => {
                ctx.save();
                
                if (n.unlocked) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = n.color;
                } else if (n.id !== 'root' && nodes.find(p => p.id === n.req)?.unlocked) {
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = 'rgba(255,255,255,0.3)';
                }
                
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
                
                if (n.unlocked) {
                    ctx.fillStyle = n.color + '22';
                    ctx.strokeStyle = n.color;
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                }
                
                ctx.lineWidth = selectedNode === n ? 4 : 2;
                ctx.fill();
                ctx.stroke();
                ctx.restore();
                
                if (selectedNode === n) {
                    ctx.save();
                    ctx.strokeStyle = '#fff';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
                
                ctx.font = `${n.radius * 0.9}px Outfit, system-ui`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(n.emoji, n.x, n.y);
                
                ctx.fillStyle = n.unlocked ? '#fff' : 'rgba(255,255,255,0.4)';
                ctx.font = '10px Inter, system-ui';
                ctx.fillText(n.label, n.x, n.y + n.radius + 15);
            });
            
            requestAnimationFrame(tick);
        };
        
        requestAnimationFrame(tick);
        
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        
        canvas.addEventListener('mousedown', (e) => {
            const m = getMousePos(e);
            
            let clickedNode = null;
            nodes.forEach(n => {
                const dx = m.x - n.x;
                const dy = m.y - n.y;
                if (dx*dx + dy*dy < n.radius * n.radius * 1.5) clickedNode = n;
            });
            
            if (clickedNode) {
                draggedNode = clickedNode;
                selectedNode = clickedNode;
                this.updateSelectedNodeCard(selectedNode);
            } else {
                dragStart = m;
                isDraggingCamera = true;
            }
            canvas.style.cursor = 'grabbing';
        });
        
        canvas.addEventListener('mousemove', (e) => {
            const m = getMousePos(e);
            
            if (draggedNode) {
                draggedNode.x = m.x;
                draggedNode.y = m.y;
                draggedNode.vx = 0;
                draggedNode.vy = 0;
            } else if (isDraggingCamera && dragStart) {
                cameraX += m.x - dragStart.x;
                cameraY += m.y - dragStart.y;
                dragStart = m;
            } else {
                let hoverNode = null;
                nodes.forEach(n => {
                    const dx = m.x - n.x;
                    const dy = m.y - n.y;
                    if (dx*dx + dy*dy < n.radius * n.radius) hoverNode = n;
                });
                canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
            }
        });
        
        const stopDrag = () => {
            draggedNode = null;
            isDraggingCamera = false;
            dragStart = null;
            if (canvas) canvas.style.cursor = 'grab';
        };
        
        canvas.addEventListener('mouseup', stopDrag);
        canvas.addEventListener('mouseleave', stopDrag);
        
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const m = getMousePos(touch);
                let clickedNode = null;
                nodes.forEach(n => {
                    const dx = m.x - n.x;
                    const dy = m.y - n.y;
                    if (dx*dx + dy*dy < n.radius * n.radius * 1.5) clickedNode = n;
                });
                if (clickedNode) {
                    draggedNode = clickedNode;
                    selectedNode = clickedNode;
                    this.updateSelectedNodeCard(selectedNode);
                } else {
                    dragStart = m;
                    isDraggingCamera = true;
                }
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const m = getMousePos(touch);
                if (draggedNode) {
                    draggedNode.x = m.x;
                    draggedNode.y = m.y;
                } else if (isDraggingCamera && dragStart) {
                    cameraX += m.x - dragStart.x;
                    cameraY += m.y - dragStart.y;
                    dragStart = m;
                }
            }
        });
        
        canvas.addEventListener('touchend', stopDrag);
        
        this._skillCanvasControls = {
            nodes,
            spawnParticles,
            updateNodesUnlockStatus
        };
    },
    
    updateSelectedNodeCard(node) {
        const card = document.getElementById('selected-node-card');
        if (!card) return;
        
        if (node.id === 'root') {
            card.innerHTML = `
                <span style="font-size: 3rem;">🧠</span>
                <h5 style="margin: 0; color: #fff; font-size: 1.1rem;">${App.escapeHtml ? App.escapeHtml(node.label) : node.label}</h5>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">${App.escapeHtml ? App.escapeHtml(node.desc) : node.desc}</p>
                <div style="font-size: 0.72rem; color: #7C4DFF; font-weight: 600; background: rgba(124,77,255,0.15); border: 1px solid rgba(124,77,255,0.2); padding: 4px 10px; border-radius: 12px; margin-top: 10px;">Nodo Raiz Desbloqueado</div>
            `;
            return;
        }
        
        const meta = this.SKILL_NODES[node.id];
        if (!meta) return;
        
        const unlocked = (this.state.unlockedNodes || []).includes(node.id);
        const parent = this._skillCanvasControls.nodes.find(p => p.id === node.req);
        const parentUnlocked = parent ? parent.unlocked : true;
        const points = this.getAvailableSkillPoints();
        
        let statusHtml = '';
        if (unlocked) {
            statusHtml = `<div style="font-size: 0.72rem; color: #00BFA5; font-weight: 600; background: rgba(0,191,165,0.15); border: 1px solid rgba(0,191,165,0.2); padding: 4px 10px; border-radius: 12px; margin-top: 10px;">Habilidade Ativada</div>`;
        } else if (!parentUnlocked) {
            statusHtml = `<div style="font-size: 0.72rem; color: #FF1744; font-weight: 600; background: rgba(255,23,68,0.1); border: 1px solid rgba(255,23,68,0.15); padding: 4px 10px; border-radius: 12px; margin-top: 10px;">Requisito Bloqueado: ${App.escapeHtml ? App.escapeHtml(parent.label) : parent.label}</div>`;
        } else if (points < meta.cost) {
            statusHtml = `<div style="font-size: 0.72rem; color: #FF9100; font-weight: 600; background: rgba(255,145,0,0.1); border: 1px solid rgba(255,145,0,0.15); padding: 4px 10px; border-radius: 12px; margin-top: 10px;">Pontos Insuficientes (Custa ${meta.cost} pts)</div>`;
        } else {
            statusHtml = `<button onclick="Gamification.unlockSkillNode('${meta.id}')" class="btn btn-primary" style="width: 100%; font-size: 0.8rem; background: ${meta.color}; border: none; box-shadow: 0 0 10px ${meta.color}50; margin-top: 12px; padding: 8px; border-radius: 6px; color: #000; font-weight: 600; cursor: pointer;">Desbloquear por ${meta.cost} Ponto(s)</button>`;
        }
        
        card.innerHTML = `
            <div style="background: ${meta.color}15; color: ${meta.color}; border: 1px solid ${meta.color}30; width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 2.2rem; margin-bottom: 8px;">${node.emoji}</div>
            <h5 style="margin: 0; color: #fff; font-size: 1.1rem; text-shadow: 0 0 5px ${meta.color}40;">${App.escapeHtml ? App.escapeHtml(meta.label) : meta.label}</h5>
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Árvore: ${meta.tree === 'focus' ? '🧘 Foco' : meta.tree === 'tech' ? '💻 DevOps' : '💰 Finanças'}</div>
            <p style="margin: 6px 0 0 0; font-size: 0.8rem; color: var(--text-main); line-height: 1.4;">${App.escapeHtml ? App.escapeHtml(meta.desc) : meta.desc}</p>
            
            <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 10px; padding-top: 10px; text-align: left;">
                <div style="font-size: 0.75rem; color: var(--text-muted);"><strong>Bônus Permanente:</strong></div>
                <div style="font-size: 0.8rem; color: ${meta.color}; font-weight: 600; margin-top: 2px;">⚡ ${App.escapeHtml ? App.escapeHtml(meta.bonus) : meta.bonus}</div>
            </div>
            
            ${statusHtml}
        `;
    },
    
    unlockSkillNode(nodeId) {
        const meta = this.SKILL_NODES[nodeId];
        if (!meta) return;
        
        const unlocked = (this.state.unlockedNodes || []).includes(nodeId);
        if (unlocked) return;
        
        const points = this.getAvailableSkillPoints();
        if (points < meta.cost) return App.toast('Pontos de Habilidade insuficientes!', 'error');
        
        if (!this.state.unlockedNodes) this.state.unlockedNodes = [];
        this.state.unlockedNodes.push(nodeId);
        
        this.save();
        App.toast(`🎉 Habilidade Desbloqueada: ${meta.label}!`, 'success');
        
        const display = document.getElementById('skill-points-display');
        if (display) display.textContent = this.getAvailableSkillPoints();
        
        if (this._skillCanvasControls) {
            this._skillCanvasControls.updateNodesUnlockStatus();
            const canvasNode = this._skillCanvasControls.nodes.find(n => n.id === nodeId);
            if (canvasNode) {
                this._skillCanvasControls.spawnParticles(canvasNode.x, canvasNode.y, meta.color);
                this.updateSelectedNodeCard(canvasNode);
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Gamification.init(), 400);
});
