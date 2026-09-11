// ============================================
// WEB AI MODULE - Heuristic + Neural Local-First NLP
// ============================================
const WebAI = {
    stopwords: new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho']),

    tokenize(text) {
        return (text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2 && !this.stopwords.has(token));
    },

    suggestTags(text, title = '') {
        const titleTokens = this.tokenize(title);
        const textTokens = this.tokenize(text);
        const counts = {};

        titleTokens.forEach(t => counts[t] = (counts[t] || 0) + 3);
        textTokens.forEach(t => counts[t] = (counts[t] || 0) + 1);

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        return sorted.slice(0, 3);
    },

    summarize(text) {
        const clean = this._stripHtml(text || '');
        if (!clean || clean.trim().length < 30) return 'Texto muito curto para resumir.';

        const sentences = clean.split(/[.!?]+\s+/).filter(s => s.trim().length > 8);
        if (sentences.length <= 2) return sentences.join('. ').trim() + (sentences.join('. ').endsWith('.') ? '' : '.');

        const tokens = this.tokenize(clean);
        const tf = {};
        tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);

        const scored = sentences.map((sentence, index) => {
            const sTokens = this.tokenize(sentence);
            if (!sTokens.length) return { sentence, score: 0, index };
            let score = 0;
            sTokens.forEach(t => score += (tf[t] || 0));
            score = score / Math.sqrt(sTokens.length);
            return { sentence, score, index };
        });

        const topSentences = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .sort((a, b) => a.index - b.index)
            .map(s => s.sentence.trim());

        return topSentences.join('. ') + '.';
    },

    search(query, items, limit = 10) {
        const qTokens = this.tokenize(query);
        if (!qTokens.length) return items.slice(0, limit);

        const scored = items.map(item => {
            const docText = `${item.title || ''} ${item.description || ''} ${this._stripHtml(item.content || '')}`;
            const docTokens = this.tokenize(docText);

            let score = 0;
            qTokens.forEach(q => {
                const termFreq = docTokens.filter(t => t === q).length;
                if (termFreq > 0) {
                    const inTitle = (item.title || '').toLowerCase().includes(q);
                    score += termFreq * (inTitle ? 10 : 2);
                }
            });

            return { item, score };
        });

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(s => s.item)
            .slice(0, limit);
    },

    _stripHtml(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.textContent || d.innerText || '';
    },

    // Neural Transformers.js layer
    _pipeline: null,
    _loading: false,

    async isTransformersSupported() {
        return typeof window !== 'undefined' && 'WebAssembly' in window;
    },

    async initTransformers(progressCallback) {
        if (this._pipeline) return this._pipeline;
        if (this._loading) throw new Error('Transformers.js já está carregando.');
        this._loading = true;

        try {
            if (typeof window.transformers === 'undefined') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.type = 'module';
                    s.textContent = `
                        import * as transformers from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
                        window.transformers = transformers;
                        window.dispatchEvent(new CustomEvent('transformers-loaded'));
                    `;
                    
                    const onLoaded = () => {
                        window.removeEventListener('transformers-loaded', onLoaded);
                        cleanup();
                        resolve();
                    };
                    
                    const onError = (e) => {
                        cleanup();
                        reject(new Error('Erro ao carregar script do Transformers.js de CDN.'));
                    };
                    
                    const cleanup = () => {
                        s.remove();
                    };
                    
                    window.addEventListener('transformers-loaded', onLoaded);
                    s.onerror = onError;
                    document.head.appendChild(s);
                    
                    // Safety timeout of 15 seconds
                    setTimeout(() => {
                        window.removeEventListener('transformers-loaded', onLoaded);
                        cleanup();
                        reject(new Error('Timeout ao carregar script do Transformers.js.'));
                    }, 15000);
                });
            }

            const tf = window.transformers;
            if (!tf || !tf.pipeline) throw new Error('Falha ao carregar script do Transformers.js de CDN.');

            tf.env.allowLocalModels = false;

            this._pipeline = await tf.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                progress_callback: (p) => {
                    if (progressCallback && p.status === 'progress') {
                        progressCallback(p.progress);
                    }
                }
            });
            this._loading = false;
            return this._pipeline;
        } catch (err) {
            this._loading = false;
            throw err;
        }
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    async getEmbedding(text) {
        if (!this._pipeline) throw new Error('Transformers.js não inicializado. Ative nas configurações.');
        const result = await this._pipeline(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    },

    async searchSemantic(query, items, limit = 10) {
        if (!this._pipeline) {
            // Fallback to heuristic TF-IDF search
            return this.search(query, items, limit);
        }
        try {
            const queryVec = await this.getEmbedding(query);

            const scored = await Promise.all(items.map(async (item) => {
                const cacheKey = `embedding:${item.id}`;
                let itemVec = Storage._get(cacheKey);
                if (!itemVec) {
                    const text = `${item.title || ''} ${item.description || ''} ${this._stripHtml(item.content || '')}`.substring(0, 500);
                    itemVec = await this.getEmbedding(text);
                    await Storage._putRecord(cacheKey, itemVec);
                }
                const score = this._cosineSimilarity(queryVec, itemVec);
                return { item, score };
            }));

            return scored
                .sort((a, b) => b.score - a.score)
                .map(s => s.item)
                .slice(0, limit);
        } catch (err) {
            console.warn('Busca semântica falhou, revertendo para busca TF-IDF', err);
            return this.search(query, items, limit);
        }
    },

    _cosineSimilarity(a, b) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
        }
        return dot / (Math.sqrt(mA) * Math.sqrt(mB));
    }
};
