// ============================================
// RAG CHAT MODULE - Retrieval-Augmented Local-First AI
// ============================================
const RAGChat = {
    initialized: false,
    isOpen: false,
    
    init() {
        if (this.initialized) return;
        
        // 1. Create and inject the FAB and Drawer elements
        const fab = document.createElement('button');
        fab.id = 'mui-rag-fab';
        fab.innerHTML = '🧠';
        fab.title = 'Conversar com Cérebro IA';
        fab.onclick = () => this.toggleDrawer();
        
        const drawer = document.createElement('div');
        drawer.id = 'mui-rag-drawer';
        drawer.className = 'mui-rag-drawer';
        drawer.innerHTML = `
            <div class="mui-rag-header">
                <h3>🧠 Cérebro Digital IA</h3>
                <button onclick="RAGChat.toggleDrawer()" class="mui-close-btn">&times;</button>
            </div>
            <div class="mui-rag-config">
                <select id="rag-model-select" onchange="RAGChat.onModelChange()">
                    <option value="local">📴 Sintetizador Local (Sem API)</option>
                    <option value="gemini">♊ Gemini 2.5 Flash API</option>
                    <option value="openai">🤖 OpenAI GPT-4o Mini API</option>
                </select>
                <input type="password" id="rag-api-key" placeholder="Digite sua chave de API..." onchange="RAGChat.saveApiKey()" style="display: none;">
            </div>
            <div class="mui-rag-messages" id="rag-messages">
                <div class="msg system">Olá! Sou o Cérebro Digital IA. Posso responder perguntas com base nas suas Notas e Bookmarks. Pergunte-me qualquer coisa!</div>
            </div>
            <div class="mui-rag-context" id="rag-context-preview" style="display: none;"></div>
            <div class="mui-rag-input-area">
                <textarea id="rag-input" placeholder="Pergunte ao seu Cérebro Digital..." rows="2" onkeydown="RAGChat.handleKeyDown(event)"></textarea>
                <button onclick="RAGChat.sendMessage()" id="btn-send-rag"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        
        document.body.appendChild(fab);
        document.body.appendChild(drawer);
        
        // 2. Load configurations from Storage
        const settings = Storage.getSettings();
        const select = document.getElementById('rag-model-select');
        const keyInput = document.getElementById('rag-api-key');
        
        if (settings.ragModel) {
            select.value = settings.ragModel;
        }
        
        this.onModelChange();
        
        this.initialized = true;
    },
    
    toggleDrawer() {
        const drawer = document.getElementById('mui-rag-drawer');
        if (!drawer) return;
        
        this.isOpen = !this.isOpen;
        drawer.classList.toggle('active', this.isOpen);
        
        if (this.isOpen) {
            document.getElementById('rag-input')?.focus();
            this.scrollMessages();
        }
    },
    
    onModelChange() {
        const select = document.getElementById('rag-model-select');
        const keyInput = document.getElementById('rag-api-key');
        if (!select || !keyInput) return;
        
        const settings = Storage.getSettings();
        Storage.saveSettings({ ragModel: select.value });
        
        if (select.value === 'local') {
            keyInput.style.display = 'none';
        } else {
            keyInput.style.display = 'block';
            if (select.value === 'gemini') {
                keyInput.value = settings.geminiApiKey || '';
            } else if (select.value === 'openai') {
                keyInput.value = settings.openaiApiKey || '';
            }
        }
    },
    
    saveApiKey() {
        const select = document.getElementById('rag-model-select');
        const keyInput = document.getElementById('rag-api-key');
        if (!select || !keyInput) return;
        
        if (select.value === 'gemini') {
            Storage.saveSettings({ geminiApiKey: keyInput.value.trim() });
        } else if (select.value === 'openai') {
            Storage.saveSettings({ openaiApiKey: keyInput.value.trim() });
        }
        
        if (typeof App !== 'undefined' && App.toast) {
            App.toast('Chave de API salva com sucesso!', 'success');
        }
    },
    
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },
    
    async sendMessage() {
        const input = document.getElementById('rag-input');
        if (!input) return;
        
        const query = input.value.trim();
        if (!query) return;
        
        input.value = '';
        
        // 1. Render user message
        this.renderMessage(query, 'user');
        this.scrollMessages();
        
        // 2. Render typing indicator
        const typingId = this.renderTypingIndicator();
        this.scrollMessages();
        
        try {
            // 3. RAG: Search local context (Notes and Bookmarks)
            const notes = Storage.getNotes().filter(n => !window.App || App.contextMatches('note', n));
            const bookmarks = Storage.getBookmarks().filter(b => !window.App || App.contextMatches('bookmark', b));
            const allItems = [...notes, ...bookmarks];
            
            let relevantItems = [];
            // If semantic search is loaded, use it. Otherwise fall back to TF-IDF keyword search
            if (typeof WebAI !== 'undefined') {
                relevantItems = await WebAI.searchSemantic(query, allItems, 3);
            } else {
                relevantItems = allItems.slice(0, 3);
            }
            
            // 4. Update UI with retrieved context links
            const contextPreview = document.getElementById('rag-context-preview');
            if (contextPreview) {
                if (relevantItems.length > 0) {
                    contextPreview.innerHTML = `
                        <div class="mui-rag-context-title">📌 Contexto Recuperado (RAG):</div>
                        ${relevantItems.map(item => {
                            const icon = item.content !== undefined ? '📝' : '🔖';
                            return `<span class="mui-rag-context-item">${icon} ${App.escapeHtml(item.title)}</span>`;
                        }).join('')}
                    `;
                    contextPreview.style.display = 'block';
                } else {
                    contextPreview.style.display = 'none';
                }
            }
            
            // 5. Build context payload text
            const contextText = relevantItems.map((item, idx) => {
                const type = item.content !== undefined ? 'Nota' : 'Bookmark';
                const body = item.content !== undefined 
                    ? (typeof WebAI !== 'undefined' ? WebAI._stripHtml(item.content) : item.content)
                    : (item.description || item.url);
                return `[Doc ${idx + 1}] (${type}) Título: "${item.title}"\nConteúdo: ${body}\n`;
            }).join('\n');
            
            // 6. Handle AI Generation based on configuration
            const select = document.getElementById('rag-model-select');
            const model = select ? select.value : 'local';
            const settings = Storage.getSettings();
            
            let responseText = '';
            
            if (model === 'local') {
                // Heuristic local context synthesizer (Fully Offline & Local!)
                if (relevantItems.length === 0) {
                    responseText = "Não encontrei notas ou links relacionados ao assunto no seu banco de dados local. Experimente criar notas sobre isso primeiro!";
                } else {
                    responseText = "✨ **Síntese Heurística Local:**\n\nCom base no seu acervo digital local, aqui está o que encontrei:\n\n";
                    relevantItems.forEach((item, idx) => {
                        const icon = item.content !== undefined ? '📝' : '🔖';
                        const summary = typeof WebAI !== 'undefined' 
                            ? WebAI.summarize(item.content || item.description || '') 
                            : (item.description || "Link registrado no BookList.");
                        responseText += `**${idx + 1}. ${icon} ${item.title}**\n_${summary}_\n\n`;
                    });
                    responseText += "\n💡 _Dica: Para conversar livremente e fazer perguntas complexas, adicione uma chave API do Gemini ou OpenAI no menu acima!_";
                }
            } else {
                const apiKey = model === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey;
                
                if (!apiKey) {
                    throw new Error(`Chave de API do ${model === 'gemini' ? 'Gemini' : 'OpenAI'} não configurada. Por favor, adicione-a no topo deste chat.`);
                }
                
                const prompt = `Você é o Cérebro Digital IA integrado à aplicação BookList. Sua missão é responder à pergunta do usuário de forma clara, prestativa e amigável em português com base nos documentos do banco de dados local fornecidos abaixo como contexto.

Se o contexto não contiver informações suficientes para responder, avise o usuário educadamente, mas tente responder da melhor forma com o que tiver disponível. Cite os títulos dos documentos consultados quando apropriado.

[Documentos Locais Recupeados]
${contextText}

[Pergunta do Usuário]
${query}`;

                if (model === 'gemini') {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `Erro na API do Gemini (${response.status})`);
                    }
                    
                    const data = await response.json();
                    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da API.';
                } else if (model === 'openai') {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [
                                { role: 'system', content: 'Você é a IA do BookList. Ajude o usuário respondendo com base no contexto das notas e links.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.7
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `Erro na API da OpenAI (${response.status})`);
                    }
                    
                    const data = await response.json();
                    responseText = data.choices?.[0]?.message?.content || 'Sem resposta da API.';
                }
            }
            
            // 7. Render AI response
            this.removeTypingIndicator(typingId);
            this.renderMessage(responseText, 'assistant');
            
            if (typeof Gamification !== 'undefined') {
                Gamification.awardRagQuery();
            }
            
        } catch (err) {
            console.error(err);
            this.removeTypingIndicator(typingId);
            this.renderMessage(`❌ **Erro:** ${err.message}`, 'assistant');
        }
        
        this.scrollMessages();
    },
    
    renderMessage(text, sender) {
        const messagesContainer = document.getElementById('rag-messages');
        if (!messagesContainer) return;
        
        const bubble = document.createElement('div');
        bubble.className = `msg ${sender}`;
        
        // Convert Markdown bold, lists, and line breaks to HTML safely
        let htmlContent = App.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>');
            
        bubble.innerHTML = htmlContent;
        messagesContainer.appendChild(bubble);
    },
    
    renderTypingIndicator() {
        const messagesContainer = document.getElementById('rag-messages');
        if (!messagesContainer) return null;
        
        const indicator = document.createElement('div');
        const id = 'typing-' + Date.now();
        indicator.id = id;
        indicator.className = 'msg assistant typing';
        indicator.innerHTML = '<span style="font-family: monospace;">Escrevendo... 💭</span>';
        
        messagesContainer.appendChild(indicator);
        return id;
    },
    
    removeTypingIndicator(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
    },
    
    scrollMessages() {
        const messagesContainer = document.getElementById('rag-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
};

// Hook up RAG Chat initialization to DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => RAGChat.init());
// Also trigger init immediately in case DOMContentLoaded has already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    RAGChat.init();
}
