// ============================================
// GRAPH MODULE - 3D Interactive Cérebro Digital
// ============================================
const GraphView = {
    canvas: null,
    ctx: null,
    nodes: [],
    edges: [],
    simulationActive: false,
    selectedNode: null,
    hoveredNode: null,
    draggedNode: null,
    searchQuery: '',
    visibleTypes: { note: true, bookmark: true, category: true },
    pointerTravel: 0,
    
    viewport: { x: 0, y: 0, zoom: 1 },
    dragStart: { clientX: 0, clientY: 0 },
    isPanning: false,
    
    // Core state & Toggle settings
    showSemanticEdges: true,
    showAllLabels: false,
    physicsTicks: 0,
    showSettingsPanel: false,
    
    // Time-Lapse state
    timeLapseCutoff: null,
    timeLapsePlaying: false,
    timeLapseTimer: null,
    timeLapseMinDate: null,
    timeLapseMaxDate: null,
    allRawNodes: [],
    allRawEdges: [],
    
    // 3D Perspective & Rotation
    focalLength: 350,
    rotation: { x: 0, y: 0, spinX: 0.0003, spinY: 0.001 },
    stars: [],

    // Physics constants (tridimensional tuning)
    physics: {
        gravity: 0.004,          // Pull to center
        repulsion: 25000,        // Separation push
        repulsionRadius: 320,    // Separation radius
        springLength: 120,       // Connection length
        springStiffness: 0.015,  // Spring elasticity
        friction: 0.82           // Damping friction
    },

    icon(name) {
        const paths = {
            network: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="18" r="2"/><path d="m7.8 6.5 8.3-1M7 7.7l4 8.4m5.8-9.3-3.7 9.4"/>',
            search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
            crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
            pause: '<path d="M9 5v14M15 5v14"/>',
            play: '<path d="m8 5 11 7-11 7Z"/>',
            sliders: '<path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6"/>',
            close: '<path d="m6 6 12 12M18 6 6 18"/>',
            pointer: '<path d="m5 3 14 9-7 2-3 7Z"/>',
            file: '<path d="M7 3h7l4 4v14H7Z"/><path d="M14 3v5h5M10 13h5m-5 4h5"/>',
            bookmark: '<path d="M7 4h10v17l-5-3-5 3Z"/>',
            tag: '<path d="M20 13 13 20l-9-9V4h7Z"/><circle cx="8.5" cy="8.5" r="1"/>',
            calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
            chevron: '<path d="m9 18 6-6-6-6"/>',
            external: '<path d="M14 5h5v5m0-5-9 9"/><path d="M19 13v6H5V5h6"/>'
        };
        return `<svg class="graph-svg" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.network}</svg>`;
    },

    /**
     * Initializes and displays the 3D Graph inside the container.
     */


    init(containerEl) {
        if (!containerEl) return;

        if (this.timeLapseTimer) {
            clearInterval(this.timeLapseTimer);
            this.timeLapseTimer = null;
        }
        this.timeLapsePlaying = false;
        this.timeLapseCutoff = null;
        this.allRawNodes = [];
        this.allRawEdges = [];
        
        containerEl.innerHTML = `
            <section class="mui-graph-wrapper" aria-label="Cérebro Digital">
                <header class="mui-graph-header">
                    <div class="mui-graph-heading"><span class="mui-graph-mark">${this.icon('network')}</span><div><h2>Cérebro Digital</h2><p>Explore as conexões entre suas ideias</p></div></div>
                    <label class="mui-graph-search">${this.icon('search')}<input id="graph-search" type="search" placeholder="Buscar no grafo…" autocomplete="off"><kbd>/</kbd></label>
                    <div class="mui-graph-controls">
                        <button class="graph-icon-btn" onclick="GraphView.reset3DView()" title="Centralizar" aria-label="Centralizar">${this.icon('crosshair')}</button>
                        <button class="graph-icon-btn" id="graph-stabilize-btn" onclick="GraphView.togglePhysics()" title="Pausar física" aria-label="Pausar física">${this.icon('pause')}</button>
                        <button class="graph-icon-btn" id="graph-settings-btn" onclick="GraphView.toggleSettings()" title="Ajustes do grafo" aria-label="Ajustes do grafo">${this.icon('sliders')}</button>
                        <button class="graph-icon-btn" onclick="App.closeModal()" title="Fechar" aria-label="Fechar">${this.icon('close')}</button>
                    </div>
                </header>
                <div class="mui-graph-workspace">
                    <aside class="mui-graph-sidebar" aria-label="Filtros do grafo">
                        <div class="graph-filter-heading">Exibir</div>
                        <button class="graph-type-filter is-active" data-type="note" onclick="GraphView.toggleType('note', this)"><span class="graph-type-dot note"></span><span>Notas</span><b id="graph-count-note">0</b></button>
                        <button class="graph-type-filter is-active" data-type="bookmark" onclick="GraphView.toggleType('bookmark', this)"><span class="graph-type-dot bookmark"></span><span>Bookmarks</span><b id="graph-count-bookmark">0</b></button>
                        <button class="graph-type-filter is-active" data-type="category" onclick="GraphView.toggleType('category', this)"><span class="graph-type-dot category"></span><span>Categorias</span><b id="graph-count-category">0</b></button>
                        <div class="graph-sidebar-spacer"></div>
                        <div class="graph-summary"><span><b id="graph-visible-count">0</b> itens visíveis</span><span><b id="graph-edge-count">0</b> conexões</span></div>
                        <p class="graph-help">${this.icon('pointer')} Selecione um nó para explorar. Arraste o fundo para girar.</p>
                    </aside>
                    <main class="mui-graph-stage">
                        <canvas id="mui-graph-canvas"></canvas>
                        <div class="graph-empty" id="graph-empty">${this.icon('search')}<strong>Nenhum resultado</strong><span>Tente outro termo ou reative um filtro.</span></div>
                        <div class="graph-canvas-actions">
                            <button onclick="GraphView.reset3DView()">${this.icon('crosshair')} Centralizar</button>
                            <button onclick="GraphView.togglePhysics()">${this.icon('pause')} Pausar física</button>
                        </div>
                        <div id="mui-graph-settings" class="mui-graph-settings" aria-hidden="true">
                            <div class="settings-title"><div><strong>Ajustes do grafo</strong><span>Refine a visualização 3D</span></div><button onclick="GraphView.toggleSettings()" aria-label="Fechar ajustes">${this.icon('close')}</button></div>
                            <div class="settings-group"><label>Perspectiva <span id="val-focal">350</span></label><input type="range" id="slide-focal" min="150" max="600" step="10" value="350"></div>
                            <div class="settings-group"><label>Gravidade <span id="val-gravity">0.0040</span></label><input type="range" id="slide-gravity" min="0.0010" max="0.0150" step="0.0005" value="0.0040"></div>
                            <div class="settings-group"><label>Distância entre nós <span id="val-repulsion">25000</span></label><input type="range" id="slide-repulsion" min="5000" max="60000" step="1000" value="25000"></div>
                            <div class="settings-group"><label>Comprimento das conexões <span id="val-spring">120</span></label><input type="range" id="slide-spring" min="50" max="250" step="10" value="120"></div>
                            <label class="graph-switch"><input type="checkbox" id="chk-show-labels"><span></span>Mostrar todos os nomes</label>
                            <label class="graph-switch"><input type="checkbox" id="chk-show-semantic" checked><span></span>Relações semânticas</label>
                        </div>
                    </main>
                    <aside class="mui-graph-inspector" id="graph-inspector" aria-live="polite">
                        <div class="graph-inspector-empty"><span class="graph-inspector-symbol">${this.icon('network')}</span><strong>Explore uma conexão</strong><p>Selecione um nó para ver seus detalhes e itens relacionados.</p></div>
                    </aside>
                </div>
                <footer class="mui-graph-timeline">
                    <div class="timeline-title"><strong>Linha do tempo</strong><span>Veja como seu conhecimento cresceu</span></div>
                    <button id="btn-play-lapse" onclick="GraphView.toggleTimeLapse()" aria-label="Reproduzir linha do tempo">${this.icon('play')}</button>
                    <input type="range" id="slide-time-lapse" aria-label="Data do grafo">
                    <output id="val-time-lapse">Hoje</output>
                </footer>
            </section>`;

        this.canvas = document.getElementById('mui-graph-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Setup initial dimensions & listen for resize
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.loadGraphData();
        this.initPhysicsPositions();
        this.setupEvents();
        
        // Setup initial time-lapse slider limits
        const notesAndBks = this.allRawNodes.filter(n => n.type === 'note' || n.type === 'bookmark');
        const timestamps = notesAndBks
            .map(n => n.createdAt ? Date.parse(n.createdAt) : null)
            .filter(ts => ts && !isNaN(ts));
        
        let minTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let maxTs = Date.now();
        
        if (timestamps.length > 0) {
            minTs = Math.min(...timestamps);
            maxTs = Math.max(...timestamps);
            if (minTs === maxTs) {
                minTs = minTs - 24 * 60 * 60 * 1000;
            }
        }
        
        this.timeLapseMinDate = minTs;
        this.timeLapseMaxDate = maxTs;
        this.timeLapseCutoff = maxTs;

        const slideTimeLapse = document.getElementById('slide-time-lapse');
        const valTimeLapse = document.getElementById('val-time-lapse');

        if (slideTimeLapse) {
            slideTimeLapse.min = minTs;
            slideTimeLapse.max = maxTs;
            slideTimeLapse.value = maxTs;

            const updateLapse = () => {
                this.timeLapseCutoff = parseInt(slideTimeLapse.value);
                const isMax = this.timeLapseCutoff >= maxTs;
                valTimeLapse.innerText = isMax ? 'Hoje' : new Date(this.timeLapseCutoff).toLocaleDateString('pt-BR');
                this.applyTimeLapseFilter();
            };

            slideTimeLapse.addEventListener('input', updateLapse);
            slideTimeLapse.addEventListener('change', updateLapse);
        }

        const searchInput = document.getElementById('graph-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.setSearch(searchInput.value));
        }
        this._graphKeyHandler = (event) => {
            if (event.key === '/' && document.activeElement !== searchInput) {
                event.preventDefault();
                searchInput?.focus();
            } else if (event.key === 'Escape' && this.selectedNode) {
                this.selectNode(null);
            }
        };
        document.addEventListener('keydown', this._graphKeyHandler);

        // Settings elements linking
        const slideFocal = document.getElementById('slide-focal');
        const slideGravity = document.getElementById('slide-gravity');
        const slideRepulsion = document.getElementById('slide-repulsion');
        const slideSpring = document.getElementById('slide-spring');
        const chkShowLabels = document.getElementById('chk-show-labels');
        const chkShowSemantic = document.getElementById('chk-show-semantic');

        const valFocal = document.getElementById('val-focal');
        const valGravity = document.getElementById('val-gravity');
        const valRepulsion = document.getElementById('val-repulsion');
        const valSpring = document.getElementById('val-spring');

        const updateParams = () => {
            this.focalLength = parseFloat(slideFocal.value);
            this.physics.gravity = parseFloat(slideGravity.value);
            this.physics.repulsion = parseFloat(slideRepulsion.value);
            this.physics.springLength = parseFloat(slideSpring.value);
            this.showAllLabels = chkShowLabels.checked;
            this.showSemanticEdges = chkShowSemantic.checked;

            valFocal.innerText = this.focalLength;
            valGravity.innerText = this.physics.gravity.toFixed(4);
            valRepulsion.innerText = this.physics.repulsion;
            valSpring.innerText = this.physics.springLength;

            const legendSemantic = document.getElementById('legend-semantic');
            if (legendSemantic) {
                legendSemantic.style.display = this.showSemanticEdges ? 'flex' : 'none';
            }

            this.wakeUpSimulation();
        };

        slideFocal.addEventListener('input', updateParams);
        slideGravity.addEventListener('input', updateParams);
        slideRepulsion.addEventListener('input', updateParams);
        slideSpring.addEventListener('input', updateParams);
        chkShowLabels.addEventListener('change', updateParams);
        chkShowSemantic.addEventListener('change', updateParams);

        // Apply defaults initially
        this.showSemanticEdges = true;
        this.showAllLabels = false;
        this.showSettingsPanel = false;
        
        // Wake up physics simulation
        this.wakeUpSimulation();
        
        // Single loop runner
        this.runLoop();
    },

    resizeCanvas() {
        if (!this.canvas) return;
        let rect = this.canvas.parentElement.getBoundingClientRect();
        let w = rect.width;
        let h = rect.height;
        
        if (w <= 0) {
            const modalBody = this.canvas.closest('.mui-modal-body') || this.canvas.closest('.modal-body');
            if (modalBody) {
                const mRect = modalBody.getBoundingClientRect();
                w = mRect.width;
                h = mRect.height;
            }
        }
        if (w <= 0) {
            w = window.innerWidth * 0.8;
            h = window.innerHeight * 0.7;
        }

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.scale(dpr, dpr);
    },

    /**
     * Loads the nodes and connections from notes, bookmarks and categories.
     */
    loadGraphData() {
        this.allRawNodes = [];
        this.allRawEdges = [];

        const notes = Storage.getNotes();
        const bookmarks = Storage.getBookmarks();
        const ntCategories = Storage.getNtCategories();
        const bkCategories = Storage.getBkCategories();

        const nodeMap = new Map();

        // 1. Add Category Nodes
        const allCats = [...ntCategories, ...bkCategories];
        const uniqueCats = [];
        const seenCatIds = new Set();
        
        allCats.forEach(c => {
            if (!seenCatIds.has(c.id)) {
                seenCatIds.add(c.id);
                uniqueCats.push(c);
            }
        });

        uniqueCats.forEach(cat => {
            const id = `cat:${cat.id}`;
            const node = {
                id,
                label: cat.name || 'Categoria sem nome',
                type: 'category',
                color: cat.color || '#00E676',
                radius: 13,
                refId: cat.id,
                connections: 0
            };
            this.allRawNodes.push(node);
            nodeMap.set(id, node);
        });

        // 2. Add Note Nodes
        notes.forEach(note => {
            const id = `note:${note.id}`;
            const node = {
                id,
                label: note.title || 'Nota Sem Título',
                type: 'note',
                color: '#9B6BFF', // Purple Neon
                radius: 8,
                refId: note.id,
                createdAt: note.createdAt,
                connections: 0
            };
            this.allRawNodes.push(node);
            nodeMap.set(id, node);

            // Connect Note to its Categories
            if (note.categoryIds) {
                note.categoryIds.forEach(catId => {
                    const catNodeId = `cat:${catId}`;
                    if (nodeMap.has(catNodeId)) {
                        this.allRawEdges.push({ source: id, target: catNodeId, type: 'relation' });
                        node.connections++;
                        nodeMap.get(catNodeId).connections++;
                    }
                });
            }
        });

        // 3. Add Bookmark Nodes
        bookmarks.forEach(bk => {
            const id = `bookmark:${bk.id}`;
            const node = {
                id,
                label: bk.title || 'Link Sem Título',
                type: 'bookmark',
                color: '#00E5FF', // Blue Neon
                radius: 6,
                refId: bk.id,
                createdAt: bk.createdAt,
                connections: 0
            };
            this.allRawNodes.push(node);
            nodeMap.set(id, node);

            // Connect Bookmark to its Categories
            if (bk.categoryIds) {
                bk.categoryIds.forEach(catId => {
                    const catNodeId = `cat:${catId}`;
                    if (nodeMap.has(catNodeId)) {
                        this.allRawEdges.push({ source: id, target: catNodeId, type: 'relation' });
                        node.connections++;
                        nodeMap.get(catNodeId).connections++;
                    }
                });
            }
        });

        // 4. Resolve Wikilinks inside Notes
        notes.forEach(note => {
            const sourceNodeId = `note:${note.id}`;
            const textContent = note.content || '';
            
            // Regex to find wiki-style links [[Title]]
            const matches = textContent.match(/\[\[(.*?)\]\]/g);
            if (matches) {
                matches.forEach(match => {
                    const title = match.replace(/[\[\]]/g, '').trim();
                    const targetNote = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
                    if (targetNote && targetNote.id !== note.id) {
                        const targetNodeId = `note:${targetNote.id}`;
                        this.allRawEdges.push({ source: sourceNodeId, target: targetNodeId, type: 'relation' });
                        nodeMap.get(sourceNodeId).connections++;
                        nodeMap.get(targetNodeId).connections++;
                    }
                });
            }
        });

        // 5. Calculate Semantic Similarity Connections (using WebAI TF-IDF Fallback)
        const stopwords = new Set([
            'que', 'com', 'para', 'uma', 'como', 'mais', 'este', 'esta', 'seus', 'suas', 'daquele', 'daquela',
            'the', 'and', 'for', 'with', 'from', 'our'
        ]);

        const documents = [...notes, ...bookmarks];
        const tokenizedDocs = documents.map(doc => {
            const text = `${doc.title || ''} ${doc.description || ''} ${doc.content ? doc.content.replace(/<[^>]+>/g, '') : ''}`;
            const rawTokens = typeof WebAI !== 'undefined' ? WebAI.tokenize(text) : text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            const tokens = rawTokens.filter(w => !stopwords.has(w));
            return {
                id: doc.id,
                type: doc.content !== undefined ? 'note' : 'bookmark',
                tokens: new Set(tokens)
            };
        });

        for (let i = 0; i < tokenizedDocs.length; i++) {
            for (let j = i + 1; j < tokenizedDocs.length; j++) {
                const docA = tokenizedDocs[i];
                const docB = tokenizedDocs[j];
                if (docA.tokens.size === 0 || docB.tokens.size === 0) continue;

                let intersection = 0;
                docA.tokens.forEach(t => {
                    if (docB.tokens.has(t)) intersection++;
                });

                const union = docA.tokens.size + docB.tokens.size - intersection;
                const similarity = intersection / union;

                if (similarity >= 0.22) { 
                    const source = docA.type === 'note' ? `note:${docA.id}` : `bookmark:${docA.id}`;
                    const target = docB.type === 'note' ? `note:${docB.id}` : `bookmark:${docB.id}`;
                    
                    if (nodeMap.has(source) && nodeMap.has(target)) {
                        this.allRawEdges.push({ source, target, type: 'semantic', strength: similarity });
                        nodeMap.get(source).connections++;
                        nodeMap.get(target).connections++;
                    }
                }
            }
        }

        // Apply filtering initially
        this.applyTimeLapseFilter();
    },

    applyTimeLapseFilter() {
        const cutoff = this.timeLapseCutoff || Date.now();
        
        // 1. Filter nodes based on creation date
        const filteredNodes = this.allRawNodes.filter(node => {
            if (!this.visibleTypes[node.type]) return false;
            if (node.type === 'note' || node.type === 'bookmark') {
                const ts = node.createdAt ? Date.parse(node.createdAt) : null;
                if (!ts || isNaN(ts)) return true; // Fallback se não tiver data
                return ts <= cutoff;
            }
            return true; // As categorias e outros nós estruturais passam inicialmente
        });

        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

        // 2. Filter edges: source and target must be in the filtered nodes
        const filteredEdges = this.allRawEdges.filter(edge => {
            return filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
        });

        // 3. Reset connection counts on filtered nodes
        filteredNodes.forEach(n => n.connections = 0);

        // 4. Calculate connection counts based on filtered edges
        filteredEdges.forEach(edge => {
            const src = filteredNodes.find(n => n.id === edge.source);
            const tgt = filteredNodes.find(n => n.id === edge.target);
            if (src) src.connections++;
            if (tgt) tgt.connections++;
        });

        // 5. Filter category nodes: keep them only if they have at least one connection, 
        // OR if they had 0 connections in the unfiltered graph
        this.nodes = filteredNodes.filter(node => {
            if (node.type === 'category') {
                const hasConnections = node.connections > 0;
                const wasEmptyInRaw = this.allRawNodes.find(n => n.id === node.id)?.connections === 0;
                return hasConnections || wasEmptyInRaw;
            }
            return true;
        });

        this.edges = filteredEdges;

        // 6. Recalculate radius based on filtered connections count
        this.nodes.forEach(node => {
            let baseRadius = 8;
            if (node.type === 'category') baseRadius = 13;
            else if (node.type === 'bookmark') baseRadius = 6;
            
            node.radius = baseRadius + Math.min(node.connections * 0.6, 12);
            node.isSearchMatch = !this.searchQuery || this.normalizeText(node.label).includes(this.searchQuery);
        });

        if (this.selectedNode && !this.nodes.some(node => node.id === this.selectedNode.id)) {
            this.selectNode(null);
        }
        this.updateGraphUI();
        this.wakeUpSimulation();
    },

    normalizeText(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    },

    setSearch(value) {
        this.searchQuery = this.normalizeText(value);
        this.nodes.forEach(node => {
            node.isSearchMatch = !this.searchQuery || this.normalizeText(node.label).includes(this.searchQuery);
        });
        const firstMatch = this.searchQuery ? this.nodes.find(node => node.isSearchMatch) : null;
        if (firstMatch) this.focusNode(firstMatch, false);
        this.updateGraphUI();
    },

    toggleType(type, button) {
        this.visibleTypes[type] = !this.visibleTypes[type];
        button?.classList.toggle('is-active', this.visibleTypes[type]);
        button?.setAttribute('aria-pressed', String(this.visibleTypes[type]));
        this.applyTimeLapseFilter();
    },

    updateGraphUI() {
        const rawCounts = this.allRawNodes.reduce((acc, node) => {
            acc[node.type] = (acc[node.type] || 0) + 1;
            return acc;
        }, {});
        ['note', 'bookmark', 'category'].forEach(type => {
            const el = document.getElementById(`graph-count-${type}`);
            if (el) el.textContent = rawCounts[type] || 0;
        });
        const visible = this.searchQuery ? this.nodes.filter(node => node.isSearchMatch).length : this.nodes.length;
        const visibleEl = document.getElementById('graph-visible-count');
        const edgeEl = document.getElementById('graph-edge-count');
        if (visibleEl) visibleEl.textContent = visible;
        if (edgeEl) edgeEl.textContent = this.edges.length;
        document.getElementById('graph-empty')?.classList.toggle('is-visible', visible === 0);
    },

    getRelatedNodes(node) {
        if (!node) return [];
        const ids = new Set();
        this.edges.forEach(edge => {
            if (edge.source === node.id) ids.add(edge.target);
            if (edge.target === node.id) ids.add(edge.source);
        });
        return this.nodes.filter(item => ids.has(item.id));
    },

    selectNode(node) {
        this.selectedNode = node || null;
        const inspector = document.getElementById('graph-inspector');
        if (!inspector) return;
        if (!node) {
            inspector.innerHTML = `<div class="graph-inspector-empty"><span class="graph-inspector-symbol">${this.icon('network')}</span><strong>Explore uma conexão</strong><p>Selecione um nó para ver seus detalhes e itens relacionados.</p></div>`;
            return;
        }
        const related = this.getRelatedNodes(node).sort((a, b) => b.connections - a.connections);
        const typeLabels = { note: 'Nota', bookmark: 'Bookmark', category: 'Categoria' };
        const icon = node.type === 'note' ? 'file' : node.type === 'bookmark' ? 'bookmark' : 'tag';
        const date = node.createdAt ? new Date(node.createdAt).toLocaleDateString('pt-BR') : 'Item estrutural';
        inspector.innerHTML = `
            <div class="graph-inspector-head"><span class="graph-node-icon ${node.type}">${this.icon(icon)}</span><button onclick="GraphView.selectNode(null)" aria-label="Fechar detalhes">${this.icon('close')}</button></div>
            <span class="graph-node-type">${typeLabels[node.type]}</span>
            <h3>${this.escapeHtml(node.label)}</h3>
            <div class="graph-node-meta"><span>${this.icon('calendar')}${date}</span><span>${this.icon('network')}${node.connections} ${node.connections === 1 ? 'conexão' : 'conexões'}</span></div>
            <div class="graph-related-title">Relacionados <b>${related.length}</b></div>
            <div class="graph-related-list">${related.length ? related.slice(0, 12).map(item => `<button onclick="GraphView.selectNode(GraphView.nodes.find(n => n.id === '${item.id}'))"><span class="graph-type-dot ${item.type}"></span><span><strong>${this.escapeHtml(item.label)}</strong><small>${typeLabels[item.type]}</small></span>${this.icon('chevron')}</button>`).join('') : '<p>Nenhuma relação visível com os filtros atuais.</p>'}</div>
            <button class="graph-open-node" onclick="GraphView.openNodeEntity(GraphView.selectedNode)">${this.icon('external')}Abrir ${typeLabels[node.type].toLowerCase()}</button>`;
    },

    focusNode(node, select = true) {
        if (!node) return;
        node.z = -40;
        node.x *= 0.35;
        node.y *= 0.35;
        node.vx = node.vy = node.vz = 0;
        if (select) this.selectNode(node);
        this.wakeUpSimulation();
    },

    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value || '';
        return div.innerHTML;
    },

    toggleTimeLapse() {
        const playBtn = document.getElementById('btn-play-lapse');
        const slider = document.getElementById('slide-time-lapse');
        if (!playBtn || !slider) return;

        if (this.timeLapsePlaying) {
            // Pausar
            this.timeLapsePlaying = false;
            playBtn.innerHTML = this.icon('play');
            if (this.timeLapseTimer) {
                clearInterval(this.timeLapseTimer);
                this.timeLapseTimer = null;
            }
        } else {
            // Play
            this.timeLapsePlaying = true;
            playBtn.innerHTML = this.icon('pause');
            
            // Se o slider já está no máximo, volta para o início
            const val = parseInt(slider.value);
            const max = parseInt(slider.max);
            const min = parseInt(slider.min);
            if (val >= max) {
                slider.value = min;
            }

            const step = (max - min) / 60; // 60 passos de tempo
            this.timeLapseTimer = setInterval(() => {
                let currentVal = parseInt(slider.value);
                let nextVal = currentVal + step;
                if (nextVal >= max) {
                    nextVal = max;
                    slider.value = nextVal;
                    slider.dispatchEvent(new Event('input'));
                    this.toggleTimeLapse(); // Para a reprodução no fim
                } else {
                    slider.value = nextVal;
                    slider.dispatchEvent(new Event('input'));
                }
            }, 150);
        }
    },

    /**
     * Initializes stars background and node positions inside the 3D space.
     */
    initPhysicsPositions() {
        this.rotation = { x: 0, y: 0, spinX: 0.0002, spinY: 0.0008 };
        this.physicsTicks = 0;

        // Keep the backdrop quiet so the knowledge structure remains the focus.
        this.stars = [];

        // Distribute nodes evenly inside a 3D spherical shell to avoid immediate collapses
        this.allRawNodes.forEach(node => {
            if (node.x !== undefined) return; // Preserva posições se já existirem
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const radius = 90 + Math.random() * 70;

            node.x = radius * Math.sin(phi) * Math.cos(theta);
            node.y = radius * Math.sin(phi) * Math.sin(theta);
            node.z = radius * Math.cos(phi);
            node.vx = 0;
            node.vy = 0;
            node.vz = 0;
        });
    },

    setupEvents() {
        this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', () => {
            if (this.hoveredNode) this.openNodeEntity(this.hoveredNode);
        });
    },

    getMouseCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

    onPointerDown(e) {
        e.preventDefault();
        this.pointerTravel = 0;
        this.dragStart = { clientX: e.clientX, clientY: e.clientY };
        const coords = this.getMouseCoords(e);
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        let clickedNode = null;
        // Sort nodes so nearest (negative z) nodes are checked first for overlap click safety
        const sortedNodes = [...this.nodes].sort((a, b) => a.z - b.z);
        
        for (let i = 0; i < sortedNodes.length; i++) {
            const n = sortedNodes[i];
            const zClamp = Math.max(-this.focalLength * 0.28, n.z);
            const scale = this.focalLength / (this.focalLength + zClamp);
            const projX = n.x * scale + centerX;
            const projY = n.y * scale + centerY;
            
            const dx = coords.x - projX;
            const dy = coords.y - projY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= (n.radius * scale * 1.35) + 7) {
                clickedNode = n;
                break;
            }
        }

        if (clickedNode) {
            this.draggedNode = clickedNode;
            this.wakeUpSimulation();
        } else {
            this.isPanning = true;
            this.dragStart = { clientX: e.clientX, clientY: e.clientY };
        }
        
        this.canvas.setPointerCapture(e.pointerId);
    },

    onPointerMove(e) {
        e.preventDefault();
        const coords = this.getMouseCoords(e);
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        if (this.draggedNode) {
            this.pointerTravel += Math.abs(e.clientX - this.dragStart.clientX) + Math.abs(e.clientY - this.dragStart.clientY);
            this.dragStart = { clientX: e.clientX, clientY: e.clientY };
            // Reposition dragged node on focal plane (z = 0)
            this.draggedNode.x = (coords.x - centerX);
            this.draggedNode.y = (coords.y - centerY);
            this.draggedNode.z = 0;
            this.draggedNode.vx = 0;
            this.draggedNode.vy = 0;
            this.draggedNode.vz = 0;
        } else if (this.isPanning) {
            const dx = e.clientX - this.dragStart.clientX;
            const dy = e.clientY - this.dragStart.clientY;
            this.pointerTravel += Math.abs(dx) + Math.abs(dy);
            this.dragStart = { clientX: e.clientX, clientY: e.clientY };

            // Rotate background cérebro in 3D orbit
            this.rotation.spinY = dx * 0.005;
            this.rotation.spinX = -dy * 0.005;
            this.wakeUpSimulation();
        } else {
            let hover = null;
            const sortedNodes = [...this.nodes].sort((a, b) => a.z - b.z);
            
            for (let i = 0; i < sortedNodes.length; i++) {
                const n = sortedNodes[i];
                const zClamp = Math.max(-this.focalLength * 0.28, n.z);
                const scale = this.focalLength / (this.focalLength + zClamp);
                const projX = n.x * scale + centerX;
                const projY = n.y * scale + centerY;
                
                const dx = coords.x - projX;
                const dy = coords.y - projY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist <= (n.radius * scale * 1.35) + 7) {
                    hover = n;
                    break;
                }
            }
            this.hoveredNode = hover;
            this.canvas.style.cursor = hover ? 'pointer' : (this.isPanning ? 'grabbing' : 'grab');
        }
    },

    onPointerUp(e) {
        e.preventDefault();
        if (this.draggedNode) {
            if (this.pointerTravel < 6) this.selectNode(this.draggedNode);
            this.draggedNode = null;
        }
        this.isPanning = false;
        this.canvas.releasePointerCapture(e.pointerId);
    },

    onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? -15 : 15;
        // Zooming adjusts focal length (perspective depth stretch)
        this.focalLength = Math.max(150, Math.min(600, this.focalLength - factor));
        const slideFocal = document.getElementById('slide-focal');
        const valFocal = document.getElementById('val-focal');
        if (slideFocal && valFocal) {
            slideFocal.value = this.focalLength;
            valFocal.innerText = this.focalLength;
        }
    },

    reset3DView() {
        this.focalLength = 350;
        this.rotation = { x: 0, y: 0, spinX: 0.0003, spinY: 0.001 };
        
        // Spread again to re-stabilize
        this.nodes.forEach(node => {
            node.vx = 0; node.vy = 0; node.vz = 0;
            node.x += (Math.random() - 0.5) * 50;
            node.y += (Math.random() - 0.5) * 50;
            node.z += (Math.random() - 0.5) * 50;
        });
        
        const slideFocal = document.getElementById('slide-focal');
        const valFocal = document.getElementById('val-focal');
        if (slideFocal && valFocal) {
            slideFocal.value = 350;
            valFocal.innerText = 350;
        }
        this.wakeUpSimulation();
    },

    togglePhysics() {
        this.simulationActive = !this.simulationActive;
        this.physicsTicks = 0;
        this.updateStabilizeButton();
    },

    wakeUpSimulation() {
        this.simulationActive = true;
        this.physicsTicks = 0;
        this.updateStabilizeButton();
    },

    updateStabilizeButton() {
        const btn = document.getElementById('graph-stabilize-btn');
        if (btn) {
            btn.innerHTML = this.simulationActive ? this.icon('pause') : this.icon('play');
            btn.title = this.simulationActive ? 'Pausar física' : 'Retomar física';
        }
        document.querySelectorAll('.graph-canvas-actions button:nth-child(2)').forEach(action => {
            action.innerHTML = this.simulationActive ? `${this.icon('pause')} Pausar física` : `${this.icon('play')} Retomar física`;
        });
    },

    toggleSettings() {
        this.showSettingsPanel = !this.showSettingsPanel;
        const panel = document.getElementById('mui-graph-settings');
        if (panel) {
            panel.classList.toggle('is-open', this.showSettingsPanel);
            panel.setAttribute('aria-hidden', String(!this.showSettingsPanel));
        }
        document.getElementById('graph-settings-btn')?.classList.toggle('is-active', this.showSettingsPanel);
    },

    openNodeEntity(node) {
        App.closeModal();
        if (node.type === 'note') {
            App.navigate('notes');
            setTimeout(() => {
                if (typeof Notes !== 'undefined') Notes.openEditor(node.refId);
            }, 120);
        } else if (node.type === 'bookmark') {
            App.navigate('bookmarks');
            setTimeout(() => {
                const card = document.querySelector(`.bk-card[data-id="${node.refId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.outline = '2px solid var(--accent)';
                    card.style.transition = 'all 0.3s ease';
                    setTimeout(() => card.style.outline = 'none', 1500);
                }
            }, 180);
        } else if (node.type === 'category') {
            App.navigate('bookmarks');
            setTimeout(() => {
                const chips = document.querySelectorAll('.cat-btn');
                chips.forEach(c => {
                    if (c.textContent.includes(node.label)) {
                        c.click();
                    }
                });
            }, 180);
        }
    },

    /**
     * Direct coordinate rotation around X and Y axes
     */
    rotateAll(angleX, angleY) {
        const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
        const cosY = Math.cos(angleY), sinY = Math.sin(angleY);

        this.nodes.forEach(node => {
            if (node === this.draggedNode) return;

            // Orbit around Y axis (horizontal)
            if (angleY !== 0) {
                const x1 = node.x * cosY - node.z * sinY;
                const z1 = node.x * sinY + node.z * cosY;
                node.x = x1;
                node.z = z1;
            }
            // Orbit around X axis (vertical)
            if (angleX !== 0) {
                const y1 = node.y * cosX - node.z * sinX;
                const z2 = node.y * sinX + node.z * cosX;
                node.y = y1;
                node.z = z2;
            }
        });

        // Rotate stars for background parallax field
        this.stars.forEach(star => {
            if (angleY !== 0) {
                const x1 = star.x * cosY - star.z * sinY;
                const z1 = star.x * sinY + star.z * cosY;
                star.x = x1;
                star.z = z1;
            }
            if (angleX !== 0) {
                const y1 = star.y * cosX - star.z * sinX;
                const z2 = star.y * sinX + star.z * cosX;
                star.y = y1;
                star.z = z2;
            }
        });
    },

    /**
     * Calculates 3D physics forces step.
     */
    updatePhysics() {
        this.physicsTicks++;
        const canvasRect = this.canvas?.getBoundingClientRect();
        const limitX = Math.max(120, (canvasRect?.width || 720) * 0.32);
        const limitY = Math.max(90, (canvasRect?.height || 540) * 0.27);
        
        // 3D center gravity pull (coordinates gravitate around 0,0,0)
        this.nodes.forEach(node => {
            if (node === this.draggedNode) return;
            node.vx += (0 - node.x) * this.physics.gravity;
            node.vy += (0 - node.y) * this.physics.gravity;
            node.vz += (0 - node.z) * this.physics.gravity;

            if (Math.abs(node.x) > limitX) node.vx += (Math.sign(node.x) * limitX - node.x) * 0.025;
            if (Math.abs(node.y) > limitY) node.vy += (Math.sign(node.y) * limitY - node.y) * 0.025;
            node.z = Math.max(-180, Math.min(180, node.z));
        });

        // Coulomb repulsion in 3D
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeA = this.nodes[i];
            if (nodeA === this.draggedNode) continue;
            
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeB = this.nodes[j];
                
                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const dz = nodeA.z - nodeB.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                
                if (dist < this.physics.repulsionRadius) {
                    const force = this.physics.repulsion / (dist * dist + 180);
                    const forceX = (dx / dist) * force;
                    const forceY = (dy / dist) * force;
                    const forceZ = (dz / dist) * force;
                    
                    if (nodeA !== this.draggedNode) {
                        nodeA.vx += forceX;
                        nodeA.vy += forceY;
                        nodeA.vz += forceZ;
                    }
                    if (nodeB !== this.draggedNode) {
                        nodeB.vx -= forceX;
                        nodeB.vy -= forceY;
                        nodeB.vz -= forceZ;
                    }
                }
            }
        }

        // Spring connection pull in 3D
        this.edges.forEach(edge => {
            if (edge.type === 'semantic' && !this.showSemanticEdges) return;

            const nodeA = this.nodes.find(n => n.id === edge.source);
            const nodeB = this.nodes.find(n => n.id === edge.target);
            if (!nodeA || !nodeB) return;

            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const dz = nodeA.z - nodeB.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

            const strength = edge.type === 'semantic' ? (edge.strength * 0.65) : 1.1;
            const force = (dist - this.physics.springLength) * this.physics.springStiffness * strength;
            const forceX = (dx / dist) * force;
            const forceY = (dy / dist) * force;
            const forceZ = (dz / dist) * force;

            if (nodeA !== this.draggedNode) {
                nodeA.vx -= forceX;
                nodeA.vy -= forceY;
                nodeA.vz -= forceZ;
            }
            if (nodeB !== this.draggedNode) {
                nodeB.vx += forceX;
                nodeB.vy += forceY;
                nodeB.vz += forceZ;
            }
        });

        // Update coordinates & damp
        let totalEnergy = 0;
        this.nodes.forEach(node => {
            if (node === this.draggedNode) return;
            node.vx *= this.physics.friction;
            node.vy *= this.physics.friction;
            node.vz *= this.physics.friction;
            
            node.x += node.vx;
            node.y += node.vy;
            node.z += node.vz;
            node.x = Math.max(-limitX, Math.min(limitX, node.x));
            node.y = Math.max(-limitY, Math.min(limitY, node.y));

            totalEnergy += node.vx*node.vx + node.vy*node.vy + node.vz*node.vz;
        });

        // Stabilize check
        if (this.physicsTicks > 240 && totalEnergy < 0.004 * this.nodes.length) {
            this.simulationActive = false;
            this.updateStabilizeButton();
        }
    },

    normalizeHex(color, fallback = '#55c995') {
        const value = String(color || '').trim();
        if (/^#[0-9a-f]{6}$/i.test(value)) return value;
        if (/^#[0-9a-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(char => char + char).join('');
        return fallback;
    },

    mixHex(colorA, colorB, weight = 0.5) {
        const a = this.normalizeHex(colorA).slice(1);
        const b = this.normalizeHex(colorB).slice(1);
        const channel = index => Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - weight) + parseInt(b.slice(index, index + 2), 16) * weight).toString(16).padStart(2, '0');
        return `#${channel(0)}${channel(2)}${channel(4)}`;
    },

    nodeTone(node) {
        if (node.type === 'note') return '#8b7cf6';
        if (node.type === 'bookmark') return '#48bfe3';
        return this.mixHex(node.color || '#55c995', '#8a96a8', 0.24);
    },

    colorAlpha(color, alpha) {
        const hex = this.normalizeHex(color).slice(1);
        return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
    },

    traceNodeShape(ctx, type, x, y, size) {
        ctx.beginPath();
        if (type === 'note') {
            const r = Math.max(4, size * 0.22);
            const left = x - size, top = y - size, width = size * 2, height = size * 2;
            ctx.moveTo(left + r, top);
            ctx.arcTo(left + width, top, left + width, top + height, r);
            ctx.arcTo(left + width, top + height, left, top + height, r);
            ctx.arcTo(left, top + height, left, top, r);
            ctx.arcTo(left, top, left + width, top, r);
        } else if (type === 'bookmark') {
            ctx.moveTo(x, y - size * 1.08);
            ctx.lineTo(x + size * 1.02, y);
            ctx.lineTo(x, y + size * 1.08);
            ctx.lineTo(x - size * 1.02, y);
        } else {
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 6 + i * Math.PI / 3;
                const px = x + Math.cos(angle) * size * 1.08;
                const py = y + Math.sin(angle) * size * 1.08;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
    },

    drawNodeGlyph(ctx, type, x, y, size, color) {
        const unit = Math.max(7, size * 0.5);
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.25, size * 0.075);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (type === 'note') {
            ctx.moveTo(-unit * .62, -unit);
            ctx.lineTo(unit * .28, -unit);
            ctx.lineTo(unit * .68, -unit * .58);
            ctx.lineTo(unit * .68, unit);
            ctx.lineTo(-unit * .62, unit);
            ctx.closePath();
            ctx.moveTo(unit * .28, -unit);
            ctx.lineTo(unit * .28, -unit * .52);
            ctx.lineTo(unit * .68, -unit * .52);
            ctx.moveTo(-unit * .3, unit * .12);
            ctx.lineTo(unit * .36, unit * .12);
            ctx.moveTo(-unit * .3, unit * .52);
            ctx.lineTo(unit * .22, unit * .52);
        } else if (type === 'bookmark') {
            ctx.moveTo(-unit * .58, -unit);
            ctx.lineTo(unit * .58, -unit);
            ctx.lineTo(unit * .58, unit);
            ctx.lineTo(0, unit * .58);
            ctx.lineTo(-unit * .58, unit);
            ctx.closePath();
        } else {
            ctx.moveTo(-unit, -unit * .56);
            ctx.lineTo(-unit * .12, -unit * .56);
            ctx.lineTo(unit, unit * .38);
            ctx.lineTo(unit * .18, unit);
            ctx.lineTo(-unit, -unit * .04);
            ctx.closePath();
            ctx.moveTo(-unit * .55, -unit * .22);
            ctx.arc(-unit * .55, -unit * .22, Math.max(1, unit * .1), 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();
    },

    labelLines(ctx, label, maxWidth = 110) {
        const words = String(label || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return ['Sem título'];
        const lines = [];
        let current = '';
        words.forEach(word => {
            const candidate = current ? `${current} ${word}` : word;
            if (current && ctx.measureText(candidate).width > maxWidth) {
                lines.push(current);
                current = word;
            } else current = candidate;
        });
        if (current) lines.push(current);
        if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, 18) + '…'];
        return lines;
    },

    /**
     * Renders space field, nodes, labels and links on Canvas.
     */
    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const centerX = w / 2;
        const centerY = h / 2;
        const selectedId = this.selectedNode?.id || null;
        const relatedIds = new Set(this.getRelatedNodes(this.selectedNode).map(node => node.id));

        this.ctx.clearRect(0, 0, w, h);
        
        // 1. Draw Space Field Stars with parallax depth
        this.stars.forEach(star => {
            const zClamp = Math.max(-this.focalLength * 0.28, star.z);
            const scale = this.focalLength / (this.focalLength + zClamp);
            const projX = star.x * scale + centerX;
            const projY = star.y * scale + centerY;

            if (projX >= 0 && projX <= w && projY >= 0 && projY <= h) {
                const size = Math.max(0.6, 2 * scale);
                const opacity = star.brightness * (scale * 0.6);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.9, Math.max(0.05, opacity))})`;
                this.ctx.fillRect(projX, projY, size, size);
            }
        });

        // 2. Draw Edges using perspective projection
        this.edges.forEach(edge => {
            if (edge.type === 'semantic' && !this.showSemanticEdges) return;

            const source = this.nodes.find(n => n.id === edge.source);
            const target = this.nodes.find(n => n.id === edge.target);
            if (!source || !target) return;
            const isSelectedEdge = !selectedId || edge.source === selectedId || edge.target === selectedId;
            const isSearchEdge = !this.searchQuery || source.isSearchMatch || target.isSearchMatch;
            const edgeOpacity = (isSelectedEdge ? 1 : 0.1) * (isSearchEdge ? 1 : 0.12);

            // Project Source
            const zClampS = Math.max(-this.focalLength * 0.28, source.z);
            const scaleS = this.focalLength / (this.focalLength + zClampS);
            const projXS = source.x * scaleS + centerX;
            const projYS = source.y * scaleS + centerY;

            // Project Target
            const zClampT = Math.max(-this.focalLength * 0.28, target.z);
            const scaleT = this.focalLength / (this.focalLength + zClampT);
            const projXT = target.x * scaleT + centerX;
            const projYT = target.y * scaleT + centerY;

            this.ctx.beginPath();
            this.ctx.moveTo(projXS, projYS);
            this.ctx.lineTo(projXT, projYT);

            const avgScale = (scaleS + scaleT) / 2;

            if (edge.type === 'semantic') {
                const alpha = (isSelectedEdge && selectedId ? 0.5 : 0.2) * Math.max(0.45, edge.strength || 0.45) * edgeOpacity;
                this.ctx.strokeStyle = `rgba(139, 124, 246, ${alpha})`;
                this.ctx.lineWidth = (isSelectedEdge && selectedId ? 1.35 : 0.75) * avgScale;
                this.ctx.setLineDash([3, 5]);
            } else {
                const alpha = (isSelectedEdge && selectedId ? 0.52 : 0.17) * edgeOpacity;
                this.ctx.strokeStyle = selectedId && isSelectedEdge ? `rgba(157, 141, 246, ${alpha})` : `rgba(112, 124, 146, ${alpha})`;
                this.ctx.lineWidth = (isSelectedEdge && selectedId ? 1.45 : 0.8) * avgScale;
                this.ctx.setLineDash([]);
            }
            
            this.ctx.stroke();
        });
        this.ctx.setLineDash([]); 

        // 3. Draw Nodes (depth-sorted to let closer nodes overlap far ones correctly)
        const sortedNodes = [...this.nodes].sort((a, b) => b.z - a.z);

        sortedNodes.forEach(node => {
            const zClamp = Math.max(-this.focalLength * 0.28, node.z);
            const scale = this.focalLength / (this.focalLength + zClamp);
            const projX = node.x * scale + centerX;
            const projY = node.y * scale + centerY;
            const baseSize = Math.max(12.5, Math.min(28, node.radius * 1.18 * scale));
            const isSelected = this.selectedNode === node;
            const isHovered = this.hoveredNode === node;
            const isDragged = this.draggedNode === node;
            const isActive = isSelected || isHovered || isDragged;
            const isInSelection = !selectedId || isSelected || relatedIds.has(node.id);
            const isInSearch = !this.searchQuery || node.isSearchMatch;
            const tone = this.nodeTone(node);
            const opacity = (isInSelection ? 1 : 0.17) * (isInSearch ? 1 : 0.13) * Math.min(1, Math.max(.48, scale));
            const size = baseSize * (isActive ? 1.08 : 1);

            this.ctx.save();
            this.ctx.globalAlpha = opacity;
            this.ctx.lineJoin = 'round';

            if (isSelected) {
                this.ctx.shadowBlur = 24;
                this.ctx.shadowColor = this.colorAlpha(tone, .72);
                this.traceNodeShape(this.ctx, node.type, projX, projY, size + 4);
                this.ctx.strokeStyle = this.colorAlpha(tone, .32);
                this.ctx.lineWidth = 5;
                this.ctx.stroke();
            }

            this.traceNodeShape(this.ctx, node.type, projX, projY, size);
            this.ctx.shadowBlur = isActive ? 13 : 4;
            this.ctx.shadowColor = this.colorAlpha(tone, isActive ? .52 : .24);
            this.ctx.fillStyle = this.colorAlpha(this.mixHex(tone, '#0c1119', .74), .98);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = this.colorAlpha(tone, isActive ? .98 : .72);
            this.ctx.lineWidth = isSelected ? 2 : Math.max(1.15, 1.35 * scale);
            this.ctx.stroke();

            this.drawNodeGlyph(this.ctx, node.type, projX, projY, size, isSelected ? '#ffffff' : tone);

            let showLabel = this.showAllLabels || isActive || node.type === 'category' || node.connections > 2 || scale > 1.12;
            if (showLabel) {
                const fontSize = Math.max(9.5, Math.min(12, 10.5 * scale));
                this.ctx.font = `${isActive ? 650 : 560} ${fontSize}px Inter, -apple-system, sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'top';
                this.ctx.fillStyle = isActive ? '#f8fafc' : '#d7dce6';
                this.ctx.shadowColor = 'rgba(0, 0, 0, .95)';
                this.ctx.shadowBlur = 4;
                this.ctx.shadowOffsetY = 1;
                const lines = this.labelLines(this.ctx, node.label, 112);
                const startY = projY + size + 7;
                lines.forEach((line, index) => this.ctx.fillText(line, projX, startY + index * (fontSize + 2)));
            }

            this.ctx.restore();
        });
    },

    runLoop() {
        if (!this.canvas || !this.canvas.isConnected) {
            if (this._graphKeyHandler) document.removeEventListener('keydown', this._graphKeyHandler);
            return;
        }
        
        // Physics update
        if (this.simulationActive) {
            this.updatePhysics();
        }
        
        // Orbital rotative spin drift loop
        if (Math.abs(this.rotation.spinX) > 0.00005 || Math.abs(this.rotation.spinY) > 0.00005) {
            this.rotateAll(this.rotation.spinX, this.rotation.spinY);
            if (!this.isPanning) {
                this.rotation.spinX *= 0.94;
                this.rotation.spinY *= 0.94;
            }
        } else if (!this.isPanning && !this.draggedNode && this.simulationActive) {
            // Gentle autonomous spin so it constant feels alive
            this.rotation.spinY = 0.0004;
            this.rotation.spinX = 0.0001;
            this.rotateAll(this.rotation.spinX, this.rotation.spinY);
        }
        
        this.draw();
        requestAnimationFrame(() => this.runLoop());
    }
};

// Hook up App.showGraph to overlay trigger
if (typeof App !== 'undefined') {
    App.showGraph = function() {
        App.showModal('Cérebro Digital', '<div id="graph-mount-container" class="graph-mount-container"></div>');
        const overlay = document.getElementById('modal-overlay');
        overlay?.classList.add('graph-modal-overlay');
        overlay?.querySelector('.modal')?.classList.add('graph-modal-shell');
        setTimeout(() => {
            const mount = document.getElementById('graph-mount-container');
            if (mount) GraphView.init(mount);
        }, 120);
    };
}
