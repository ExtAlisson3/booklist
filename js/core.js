// ============================================
// CORE HELPERS - tiny UI helpers and app events
// ============================================
const Events = {
    _listeners: new Map(),
    on(type, handler) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(handler);
        return () => this.off(type, handler);
    },
    off(type, handler) {
        this._listeners.get(type)?.delete(handler);
    },
    emit(type, payload = {}) {
        this._listeners.get(type)?.forEach(handler => {
            try { handler(payload); } catch (err) { console.error(`[Events] ${type}`, err); }
        });
        this._listeners.get('*')?.forEach(handler => {
            try { handler(type, payload); } catch (err) { console.error('[Events] wildcard', err); }
        });
    }
};

const UI = {
    escape(value = '') {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    },
    isSafeUrl(value = '', options = {}) {
        const raw = String(value || '').trim();
        if (!raw) return true;
        if (raw.startsWith('#') || raw.startsWith('/')) return true;
        if (options.allowDataImage && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(raw)) return true;
        try {
            const url = new URL(raw, location.href);
            return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
        } catch {
            return false;
        }
    },
    sanitizeHtml(html = '') {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        const allowedTags = new Set([
            'A','B','BLOCKQUOTE','BR','CODE','DIV','EM','H1','H2','H3','H4','H5','H6','HR','I','IMG','INPUT',
            'LI','OL','P','PRE','S','SMALL','SPAN','STRONG','TABLE','TBODY','TD','TH','THEAD','TR','U','UL','IFRAME'
        ]);
        const allowedAttrs = new Set([
            'href','src','alt','title','target','rel','class','data-lang','type','checked','disabled',
            'width','height','loading','allow','allowfullscreen'
        ]);
        const walk = node => {
            [...node.children].forEach(child => {
                if (!allowedTags.has(child.tagName)) {
                    if (['SCRIPT','STYLE','OBJECT','EMBED','META','LINK'].includes(child.tagName)) {
                        child.remove();
                        return;
                    }
                    walk(child);
                    child.replaceWith(...child.childNodes);
                    return;
                }
                [...child.attributes].forEach(attr => {
                    const name = attr.name.toLowerCase();
                    if (name.startsWith('on') || name === 'style' || !allowedAttrs.has(name)) {
                        child.removeAttribute(attr.name);
                        return;
                    }
                    if ((name === 'href' || name === 'src') && !this.isSafeUrl(attr.value, { allowDataImage: child.tagName === 'IMG' })) {
                        child.removeAttribute(attr.name);
                    }
                });
                if (child.tagName === 'A') {
                    child.setAttribute('rel', 'noopener noreferrer');
                    if (!child.getAttribute('target')) child.setAttribute('target', '_blank');
                }
                if (child.tagName === 'IFRAME') {
                    child.setAttribute('loading', 'lazy');
                    child.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
                }
                if (child.tagName === 'INPUT' && child.getAttribute('type') !== 'checkbox') child.remove();
                walk(child);
            });
        };
        walk(template.content);
        return template.innerHTML;
    },
    highlight(text = '', query = '') {
        const escaped = this.escape(text);
        const tokens = FuzzySearch.tokens(query).filter(t => t.length >= 2).slice(0, 6);
        if (!tokens.length) return escaped;
        const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
    },
    relativeTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const diff = Date.now() - date.getTime();
        const abs = Math.abs(diff);
        const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
        const units = [
            ['year', 31536000000],
            ['month', 2592000000],
            ['week', 604800000],
            ['day', 86400000],
            ['hour', 3600000],
            ['minute', 60000]
        ];
        const [unit, ms] = units.find(([, size]) => abs >= size) || ['second', 1000];
        return rtf.format(Math.round(-diff / ms), unit);
    },
    money(value = 0) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    },
    date(value) {
        if (!value) return '';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
        }
        const d = new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('pt-BR');
    },
    card(title, body = '', extra = '') {
        return `<div class="feature-card"><h3>${this.escape(title)}</h3>${body}${extra}</div>`;
    },
    empty(text) {
        return `<p class="text-muted">${this.escape(text)}</p>`;
    }
};

const FuzzySearch = {
    normalize(value = '') {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s:/._-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },
    tokens(value = '') {
        return this.normalize(value).split(' ').filter(Boolean);
    },
    distance(a = '', b = '') {
        a = this.normalize(a);
        b = this.normalize(b);
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        const row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            let prev = i - 1;
            row[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const old = row[j];
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
                prev = old;
            }
        }
        return row[b.length];
    },
    tokenScore(queryToken, word) {
        if (!queryToken || !word) return 0;
        if (word === queryToken) return 100;
        if (word.startsWith(queryToken)) return 82;
        if (word.includes(queryToken)) return 68;
        if (queryToken.length >= 4) {
            const limit = queryToken.length <= 5 ? 1 : 2;
            const dist = this.distance(queryToken, word.slice(0, Math.max(word.length, queryToken.length)));
            if (dist <= limit) return 58 - (dist * 10);
        }
        return 0;
    },
    score(query = '', fields = []) {
        const queryTokens = this.tokens(query);
        if (!queryTokens.length) return 0;
        const docs = fields
            .map(field => ({
                weight: Number(field.weight || 1),
                text: this.normalize(field.text || ''),
                words: this.tokens(field.text || '')
            }))
            .filter(field => field.text);
        if (!docs.length) return 0;
        let total = 0;
        let matched = 0;
        queryTokens.forEach(token => {
            let best = 0;
            docs.forEach(field => {
                if (field.text.includes(token)) best = Math.max(best, 72 * field.weight);
                field.words.forEach(word => {
                    best = Math.max(best, this.tokenScore(token, word) * field.weight);
                });
            });
            if (best > 0) matched++;
            total += best;
        });
        if (!matched) return 0;
        const coverage = matched / queryTokens.length;
        return Math.round((total / queryTokens.length) * coverage);
    },
    search(query = '', docs = [], options = {}) {
        const minScore = options.minScore ?? 32;
        const limit = options.limit ?? 20;
        return docs
            .map(doc => ({ ...doc, score: this.score(query, doc.fields || []) }))
            .filter(doc => doc.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    },
    matches(query = '', fields = [], minScore = 32) {
        if (!query.trim()) return true;
        return this.score(query, fields.map(text => typeof text === 'object' ? text : { text, weight: 1 })) >= minScore;
    }
};

const MermaidLite = {
    renderAll(root = document) {
        const scope = root || document;
        scope.querySelectorAll('pre code[data-lang], pre code[class*="language-"]').forEach(code => {
            const lang = (code.dataset.lang || code.className || '').toLowerCase();
            if (!lang.includes('mermaid')) return;
            this.renderBlock(code);
        });
    },
    renderBlock(code) {
        const pre = code.closest('pre');
        if (!pre) return;
        const source = code.textContent || '';
        const graph = this.parse(source);
        let target = pre.nextElementSibling?.classList?.contains('mermaid-render') ? pre.nextElementSibling : null;
        if (!target) {
            target = document.createElement('div');
            target.className = 'mermaid-render';
            target.contentEditable = 'false';
            pre.insertAdjacentElement('afterend', target);
        }
        target.innerHTML = graph.nodes.length ? this.svg(graph) : '<p class="text-muted">Diagrama Mermaid vazio ou ainda nao reconhecido.</p>';
    },
    parse(source = '') {
        const lines = source.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
        const header = lines.find(line => /^(graph|flowchart)\s+/i.test(line)) || '';
        const direction = /(\s|^)(LR|RL)(\s|$)/i.test(header) ? 'LR' : 'TD';
        const nodeMap = new Map();
        const edges = [];
        const ensure = (raw) => {
            const node = this.parseNode(raw);
            if (!node.id) return null;
            if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
            else if (node.label && node.label !== node.id) nodeMap.get(node.id).label = node.label;
            return nodeMap.get(node.id);
        };
        lines.filter(line => !/^(graph|flowchart)\s+/i.test(line)).forEach(line => {
            const cleaned = line.replace(/\s+--\s*[^-]+?\s*-->/g, ' --> ');
            const match = cleaned.match(/^(.+?)\s*(-->|---|==>|-\.->)\s*(.+)$/);
            if (match) {
                const from = ensure(match[1]);
                const to = ensure(match[3]);
                if (from && to) edges.push({ from: from.id, to: to.id, arrow: match[2] !== '---' });
                return;
            }
            ensure(line);
        });
        const nodes = Array.from(nodeMap.values());
        return { direction, nodes, edges };
    },
    parseNode(raw = '') {
        const text = raw.trim().replace(/;$/, '');
        const match = text.match(/^([A-Za-z0-9_.:-]+)(?:\[(.+?)\]|\((.+?)\)|\{(.+?)\})?$/);
        if (!match) return { id: text.replace(/\W+/g, '_'), label: text };
        return { id: match[1], label: match[2] || match[3] || match[4] || match[1] };
    },
    layout(graph) {
        const indegree = new Map(graph.nodes.map(n => [n.id, 0]));
        const children = new Map(graph.nodes.map(n => [n.id, []]));
        graph.edges.forEach(edge => {
            children.get(edge.from)?.push(edge.to);
            indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
        });
        const level = new Map();
        const queue = graph.nodes.filter(n => !indegree.get(n.id)).map(n => n.id);
        graph.nodes.forEach(n => { if (!queue.includes(n.id) && !level.has(n.id)) level.set(n.id, 0); });
        queue.forEach(id => level.set(id, 0));
        for (let i = 0; i < queue.length; i++) {
            const id = queue[i];
            (children.get(id) || []).forEach(child => {
                level.set(child, Math.max(level.get(child) || 0, (level.get(id) || 0) + 1));
                indegree.set(child, (indegree.get(child) || 1) - 1);
                if (indegree.get(child) === 0) queue.push(child);
            });
        }
        const groups = new Map();
        graph.nodes.forEach(node => {
            const l = level.get(node.id) || 0;
            if (!groups.has(l)) groups.set(l, []);
            groups.get(l).push(node);
        });
        const width = 180, height = 58, gapX = 72, gapY = 42;
        const positions = new Map();
        Array.from(groups.entries()).forEach(([l, nodes]) => {
            nodes.forEach((node, index) => {
                const x = graph.direction === 'LR' ? 24 + l * (width + gapX) : 24 + index * (width + gapX);
                const y = graph.direction === 'LR' ? 24 + index * (height + gapY) : 24 + l * (height + gapY);
                positions.set(node.id, { x, y, width, height });
            });
        });
        const maxX = Math.max(...Array.from(positions.values()).map(p => p.x + p.width), 240) + 24;
        const maxY = Math.max(...Array.from(positions.values()).map(p => p.y + p.height), 120) + 24;
        return { positions, maxX, maxY };
    },
    svg(graph) {
        const { positions, maxX, maxY } = this.layout(graph);
        const edgeHtml = graph.edges.map(edge => {
            const a = positions.get(edge.from), b = positions.get(edge.to);
            if (!a || !b) return '';
            const x1 = graph.direction === 'LR' ? a.x + a.width : a.x + a.width / 2;
            const y1 = graph.direction === 'LR' ? a.y + a.height / 2 : a.y + a.height;
            const x2 = graph.direction === 'LR' ? b.x : b.x + b.width / 2;
            const y2 = graph.direction === 'LR' ? b.y + b.height / 2 : b.y;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${edge.arrow ? 'marker-end="url(#arrow)"' : ''}></line>`;
        }).join('');
        const nodeHtml = graph.nodes.map(node => {
            const p = positions.get(node.id);
            const label = UI.escape(node.label || node.id);
            return `<g><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="10"></rect><text x="${p.x + p.width / 2}" y="${p.y + p.height / 2 + 5}" text-anchor="middle">${label}</text></g>`;
        }).join('');
        return `<svg viewBox="0 0 ${maxX} ${maxY}" role="img" aria-label="Diagrama Mermaid"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z"></path></marker></defs>${edgeHtml}${nodeHtml}</svg>`;
    },
    stripGenerated(root) {
        root?.querySelectorAll?.('.mermaid-render')?.forEach(el => el.remove());
    }
};

const WikiLinks = {
    renderAll(root = document) {
        const scope = root || document;
        this.bindPreviewEvents();
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
            acceptNode: node => {
                if (!node.nodeValue || !/\[\[[^\]]+\]\]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || parent.closest('a,button,pre,code,script,style,.wiki-link,.wiki-transclusion,.mermaid-render')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => this.replaceNode(node));
    },
    replaceNode(node) {
        const frag = document.createDocumentFragment();
        const re = /(!)?\[\[([^\]]+)\]\]/g;
        let last = 0;
        const text = node.nodeValue || '';
        text.replace(re, (match, embed, title, index) => {
            if (index > last) frag.appendChild(document.createTextNode(text.slice(last, index)));
            frag.appendChild(embed ? this.embed(title.trim()) : this.link(title.trim()));
            last = index + match.length;
            return match;
        });
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode?.replaceChild(frag, node);
    },
    resolve(title = '') {
        const wanted = FuzzySearch.normalize(title);
        const notes = Storage.getNotes({ includePrivate: false });
        const note = notes.find(n => FuzzySearch.normalize(n.title || '') === wanted)
            || notes.find(n => FuzzySearch.normalize(n.title || '').includes(wanted));
        if (note) return { type: 'note', id: note.id, title: note.title, content: note.content || '' };
        const records = Storage.getProfessionalRecords();
        const record = records.find(r => FuzzySearch.normalize(r.title || '') === wanted)
            || records.find(r => FuzzySearch.normalize(r.title || '').includes(wanted));
        if (record) return { type: 'record', id: record.id, moduleKey: record.moduleKey, title: record.title, content: record.content || '' };
        return null;
    },
    link(title) {
        const item = this.resolve(title);
        const el = document.createElement('span');
        el.className = `wiki-link ${item ? '' : 'missing'}`;
        el.contentEditable = 'false';
        el.dataset.wikiTitle = title;
        if (item) {
            el.dataset.wikiType = item.type;
            el.dataset.wikiId = item.id;
        }
        el.textContent = `[[${title}]]`;
        el.addEventListener('click', event => {
            event.preventDefault();
            this.open(title);
        });
        return el;
    },
    embed(title) {
        const item = this.resolve(title);
        const el = document.createElement('section');
        el.className = `wiki-transclusion ${item ? '' : 'missing'}`;
        el.contentEditable = 'false';
        el.dataset.wikiTitle = title;
        if (!item) {
            el.innerHTML = `<strong>![[${UI.escape(title)}]]</strong><p class="text-muted">Item nao encontrado.</p>`;
            return el;
        }
        el.dataset.wikiType = item.type;
        el.dataset.wikiId = item.id;
        const preview = this.safePreview(item.content);
        el.innerHTML = `<header><strong>${UI.escape(item.title)}</strong><button type="button" class="btn btn-sm btn-secondary">Abrir</button></header><div>${preview}</div>`;
        el.querySelector('button')?.addEventListener('click', () => this.open(title));
        setTimeout(() => {
            MermaidLite.renderAll(el);
            this.renderAll(el);
        }, 0);
        return el;
    },
    safePreview(html = '') {
        return UI.sanitizeHtml(html || '<p></p>');
    },
    open(title) {
        const item = this.resolve(title);
        if (!item) return window.App?.toast?.('Item wiki nao encontrado.', 'info');
        if (item.type === 'note') {
            App.afterNavigate ? App.afterNavigate('notes', () => Notes.openEditor(item.id)) : (App.navigate('notes'), setTimeout(() => Notes.openEditor(item.id), 80));
        } else {
            App.openProfessionalRecord(item.id);
        }
        this.hidePreview();
    },
    bindPreviewEvents() {
        if (this._bound) return;
        this._bound = true;
        document.addEventListener('mouseover', event => {
            const link = event.target.closest?.('.wiki-link');
            if (link) this.showPreview(link);
        });
        document.addEventListener('mouseout', event => {
            const link = event.target.closest?.('.wiki-link');
            if (link && !link.contains(event.relatedTarget)) this.hidePreviewSoon();
        });
    },
    showPreview(link) {
        const title = link.dataset.wikiTitle || '';
        const item = this.resolve(title);
        let pop = document.getElementById('wiki-preview-popover');
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'wiki-preview-popover';
            pop.className = 'wiki-preview-popover';
            pop.addEventListener('mouseenter', () => clearTimeout(this._hideTimer));
            pop.addEventListener('mouseleave', () => this.hidePreviewSoon());
            document.body.appendChild(pop);
        }
        pop.innerHTML = item
            ? `<strong>${UI.escape(item.title)}</strong><p>${UI.escape(this.textPreview(item.content))}</p>`
            : `<strong>${UI.escape(title)}</strong><p>Item nao encontrado.</p>`;
        const rect = link.getBoundingClientRect();
        pop.style.left = `${Math.min(window.innerWidth - 340, Math.max(12, rect.left))}px`;
        pop.style.top = `${Math.min(window.innerHeight - 170, rect.bottom + 8)}px`;
        pop.classList.add('active');
    },
    textPreview(html = '') {
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260) || 'Sem conteudo.';
    },
    hidePreviewSoon() {
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => this.hidePreview(), 160);
    },
    hidePreview() {
        document.getElementById('wiki-preview-popover')?.classList.remove('active');
    },
    stripGenerated(root) {
        root?.querySelectorAll?.('.wiki-transclusion')?.forEach(el => {
            el.replaceWith(document.createTextNode(`![[${el.dataset.wikiTitle || ''}]]`));
        });
        root?.querySelectorAll?.('.wiki-link')?.forEach(el => {
            el.replaceWith(document.createTextNode(`[[${el.dataset.wikiTitle || el.textContent.replace(/\[|\]/g, '')}]]`));
        });
    }
};

const QueryView = {
    renderAll(root = document) {
        const scope = root || document;
        scope.querySelectorAll('pre code[data-lang], pre code[class*="language-"]').forEach(code => {
            const lang = (code.dataset.lang || code.className || '').toLowerCase();
            const text = code.textContent || '';
            if (!lang.includes('query') && !text.trim().startsWith('//query')) return;
            this.renderBlock(code);
        });
    },
    renderBlock(code) {
        const pre = code.closest('pre');
        if (!pre) return;
        const source = code.textContent || '';
        let target = pre.nextElementSibling?.classList?.contains('query-render') ? pre.nextElementSibling : null;
        if (!target) {
            target = document.createElement('div');
            target.className = 'query-render';
            target.contentEditable = 'false';
            pre.insertAdjacentElement('afterend', target);
        }
        try {
            const result = this.run(source);
            target.innerHTML = this.table(result);
        } catch (err) {
            target.innerHTML = `<p class="text-muted">Query invalida: ${UI.escape(err.message)}</p>`;
        }
    },
    run(source = '') {
        const cleaned = source.replace(/^\/\/query/i, '').trim();
        const match = cleaned.match(/^MOSTRAR\s+([a-z0-9_-]+)(?:\s+ONDE\s+(.+))?/i);
        if (!match) throw new Error('use: MOSTRAR tickets ONDE status = aberto');
        const target = this.normalizeTarget(match[1]);
        const filters = this.parseFilters(match[2] || '');
        let rows = this.dataset(target);
        filters.forEach(filter => rows = rows.filter(row => this.matches(row, filter)));
        return { target, filters, rows: rows.slice(0, 50), total: rows.length };
    },
    normalizeTarget(value = '') {
        const map = {
            notas: 'notes', nota: 'notes', notes: 'notes',
            bookmarks: 'bookmarks', links: 'bookmarks', link: 'bookmarks',
            clientes: 'clients', cliente: 'clients', clients: 'clients',
            equipamentos: 'equipment', equipamento: 'equipment', equipment: 'equipment',
            tickets: 'tickets', atendimentos: 'tickets', atendimento: 'tickets',
            orcamentos: 'budgets', orcamento: 'budgets', budgets: 'budgets',
            redes: 'networks', rede: 'networks', networks: 'networks',
            runbooks: 'runbooks', scripts: 'scripts', financeiro: 'finance', agenda: 'schedule',
            money: 'money', tracker: 'tracker', leituras: 'tracker', leitura: 'tracker'
        };
        return map[FuzzySearch.normalize(value)] || value;
    },
    parseFilters(raw = '') {
        if (!raw.trim()) return [];
        return raw.split(/\s+E\s+/i).map(part => {
            const match = part.trim().match(/^([a-z0-9_.-]+)\s*(=|!=|~|contém|contem|>|<)\s*['"]?(.+?)['"]?$/i);
            if (!match) throw new Error(`filtro nao reconhecido: ${part}`);
            return { field: match[1], op: match[2].toLowerCase(), value: match[3] };
        });
    },
    dataset(target) {
        const records = Storage.getProfessionalRecords();
        const personal = Storage.getPersonalData();
        if (target === 'notes') return Storage.getNotes().map(n => ({ type: 'note', id: n.id, titulo: n.title, title: n.title, status: n.status || '', texto: this.text(n.content), atualizado: n.updatedAt, item: n }));
        if (target === 'bookmarks') return Storage.getBookmarks().map(b => ({ type: 'bookmark', id: b.id, titulo: b.title, title: b.title, url: b.url, descricao: b.description || '', favorito: b.favorite ? 'sim' : 'nao', aberto: b.openCount || 0, item: b }));
        if (target === 'money') return (personal.money || []).map(m => ({ type: 'money', id: m.id, titulo: m.title, title: m.title, status: m.type, categoria: m.category, valor: m.amount, data: m.date || m.createdAt, item: m }));
        if (target === 'tracker') return (personal.tracker || []).map(t => ({ type: 'tracker', id: t.id, titulo: t.title, title: t.title, status: t.status, tipo: t.type, capitulo: t.currentChapter, lancado: t.latestChapter, item: t }));
        return records
            .filter(r => r.moduleKey === target)
            .map(r => {
                const client = r.clientId ? records.find(x => x.id === r.clientId) : null;
                const equipment = r.equipmentId ? records.find(x => x.id === r.equipmentId) : null;
                return { type: 'professional', id: r.id, moduleKey: r.moduleKey, titulo: r.title, title: r.title, status: r.status, cliente: client?.title || '', equipamento: equipment?.title || '', texto: this.text(r.content), atualizado: r.updatedAt, item: r };
            });
    },
    matches(row, filter) {
        const actual = this.valueFor(row, filter.field);
        const a = FuzzySearch.normalize(actual);
        const b = FuzzySearch.normalize(filter.value);
        if (filter.op === '=') return a === b || a.includes(b);
        if (filter.op === '!=') return a !== b && !a.includes(b);
        if (filter.op === '~' || filter.op === 'contém' || filter.op === 'contem') return FuzzySearch.matches(filter.value, [{ text: actual, weight: 1 }], 24);
        if (filter.op === '>') return Number(actual) > Number(filter.value);
        if (filter.op === '<') return Number(actual) < Number(filter.value);
        return false;
    },
    valueFor(row, field) {
        const normalized = FuzzySearch.normalize(field);
        const aliases = { titulo: 'titulo', title: 'title', situacao: 'status', cap: 'capitulo', lançado: 'lancado', lancado: 'lancado' };
        return row[aliases[normalized] || normalized] ?? row.item?.[field] ?? row.item?.fields?.[field] ?? '';
    },
    table(result) {
        const cols = this.columns(result.target);
        const rows = result.rows.map(row => `<tr>${cols.map(([key]) => `<td>${UI.escape(this.format(this.valueFor(row, key)))}</td>`).join('')}<td><button type="button" class="btn btn-sm btn-secondary" onclick="QueryView.open('${row.type}','${row.id}','${row.moduleKey || ''}')">Abrir</button></td></tr>`).join('');
        return `<div class="query-render-head"><strong>${result.total} resultado(s)</strong><small>${UI.escape(result.target)}</small></div><table><thead><tr>${cols.map(([,label]) => `<th>${UI.escape(label)}</th>`).join('')}<th></th></tr></thead><tbody>${rows || `<tr><td colspan="${cols.length + 1}">Nenhum resultado.</td></tr>`}</tbody></table>`;
    },
    columns(target) {
        if (target === 'bookmarks') return [['titulo','Titulo'], ['url','URL'], ['favorito','Favorito'], ['aberto','Aberturas']];
        if (target === 'money') return [['titulo','Titulo'], ['status','Tipo'], ['categoria','Categoria'], ['valor','Valor']];
        if (target === 'tracker') return [['titulo','Titulo'], ['status','Status'], ['capitulo','Cap'], ['lancado','Lancado']];
        if (target === 'notes') return [['titulo','Titulo'], ['texto','Texto'], ['atualizado','Atualizado']];
        return [['titulo','Titulo'], ['status','Status'], ['cliente','Cliente'], ['equipamento','Equipamento']];
    },
    format(value) {
        if (typeof value === 'number') return String(value);
        if (/\d{4}-\d{2}-\d{2}T/.test(String(value))) return UI.date(value);
        return String(value ?? '').slice(0, 120);
    },
    text(html = '') {
        const div = document.createElement('div');
        div.innerHTML = html || '';
        return (div.textContent || '').replace(/\s+/g, ' ').trim();
    },
    open(type, id, moduleKey = '') {
        if (type === 'note') { App.navigate('notes'); setTimeout(() => Notes.openEditor(id), 80); return; }
        if (type === 'bookmark') {
            const item = Storage.getBookmarks().find(b => b.id === id);
            if (item?.url) { Storage.recordBookmarkOpen(id); window.open(item.url, '_blank', 'noopener'); }
            return;
        }
        if (type === 'money') { App.navigate('money'); setTimeout(() => PersonalHub.showMoneyModal(id), 80); return; }
        if (type === 'tracker') { App.navigate('tracker'); setTimeout(() => PersonalHub.showTrackerModal(id), 80); return; }
        App.openProfessionalRecord(id);
    },
    stripGenerated(root) {
        root?.querySelectorAll?.('.query-render')?.forEach(el => el.remove());
    }
};

window.Events = Events;
window.UI = UI;
window.FuzzySearch = FuzzySearch;
window.MermaidLite = MermaidLite;
window.WikiLinks = WikiLinks;
window.QueryView = QueryView;
