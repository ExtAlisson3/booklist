// ============================================
// WHITEBOARD DRAWING MODULE - Premium Offline Canvas
// ============================================
const Whiteboard = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    color: '#a78bfa', // Default purple accent
    brushSize: 4,
    tool: 'pen', // pen or eraser
    history: [],
    historyIndex: -1,
    lastX: 0,
    lastY: 0,

    open() {
        // Build the whiteboard modal HTML content
        const modalHtml = `
            <div class="wb-container" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="wb-toolbar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="Whiteboard.setTool('pen')" id="wb-tool-pen" class="btn btn-sm btn-primary active" style="padding: 6px 12px; display: flex; align-items: center; gap: 6px; background: var(--accent, #7C4DFF); border: none;">✏️ Caneta</button>
                        <button type="button" onclick="Whiteboard.setTool('eraser')" id="wb-tool-eraser" class="btn btn-sm btn-secondary" style="padding: 6px 12px; display: flex; align-items: center; gap: 6px;">🧼 Borracha</button>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.85rem; color: #cbd5e1;">Espessura:</span>
                        <input type="range" id="wb-thickness" min="2" max="30" value="4" oninput="Whiteboard.setBrushSize(this.value)" style="width: 80px; accent-color: var(--accent, #7C4DFF);">
                        <span id="wb-thickness-val" style="font-size: 0.85rem; font-family: monospace; color: var(--accent, #7C4DFF); min-width: 15px;">4px</span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.85rem; color: #cbd5e1; margin-right: 4px;">Cores:</span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${['#a78bfa', '#00e5ff', '#34d399', '#f87171', '#fbbf24', '#ffffff', '#000000'].map(c => `
                                <button type="button" class="wb-color-preset" onclick="Whiteboard.setColor('${c}', this)" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${c === '#a78bfa' ? '#fff' : 'transparent'}; background: ${c}; cursor: pointer; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.2s;"></button>
                            `).join('')}
                            <input type="color" value="#a78bfa" onchange="Whiteboard.setColor(this.value)" style="width: 22px; height: 22px; border: none; border-radius: 4px; padding: 0; background: none; cursor: pointer;">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" onclick="Whiteboard.undo()" class="btn btn-sm btn-secondary" title="Desfazer" style="padding: 6px 10px;">↩️</button>
                        <button type="button" onclick="Whiteboard.redo()" class="btn btn-sm btn-secondary" title="Refazer" style="padding: 6px 10px;">↪️</button>
                        <button type="button" onclick="Whiteboard.clear()" class="btn btn-sm btn-danger" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171;">🗑️ Limpar</button>
                    </div>
                </div>

                <div class="wb-canvas-wrapper" style="position: relative; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; background: #0c111d; overflow: hidden; height: 420px; box-shadow: inset 0 4px 12px rgba(0,0,0,0.5);">
                    <canvas id="wb-canvas" style="display: block; width: 100%; height: 100%; cursor: crosshair;"></canvas>
                </div>

                <div class="wb-actions" style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="Whiteboard.save()" style="background: linear-gradient(135deg, var(--accent, #7C4DFF), #9b6bff); border: none; box-shadow: 0 4px 15px rgba(124, 77, 255, 0.3);">💾 Salvar Desenho</button>
                </div>
            </div>
        `;

        App.showModal('🎨 Quadro Branco Offline', modalHtml);

        // Setup the canvas and contexts
        setTimeout(() => this.initCanvas(), 100);
    },

    initCanvas() {
        this.canvas = document.getElementById('wb-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Resize canvas to its actual displayed width/height with High DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        // Set styled canvas background
        this.ctx.fillStyle = '#0c111d';
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        // Save initial state in history
        this.history = [];
        this.historyIndex = -1;
        this.saveState();

        // Setup default tool variables
        this.tool = 'pen';
        this.color = '#a78bfa';
        this.brushSize = 4;

        // Register mouse & touch events
        this.setupEvents();
    },

    setupEvents() {
        const getCoordinates = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDraw = (e) => {
            e.preventDefault();
            this.isDrawing = true;
            const coords = getCoordinates(e);
            this.lastX = coords.x;
            this.lastY = coords.y;

            // Draw a single dot on click
            this.ctx.beginPath();
            this.ctx.arc(this.lastX, this.lastY, this.brushSize / 2, 0, Math.PI * 2);
            this.ctx.fillStyle = this.tool === 'eraser' ? '#0c111d' : this.color;
            this.ctx.fill();
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const coords = getCoordinates(e);

            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(coords.x, coords.y);
            
            // Stylistic bezier rendering
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineWidth = this.brushSize;
            this.ctx.strokeStyle = this.tool === 'eraser' ? '#0c111d' : this.color;
            
            this.ctx.stroke();

            this.lastX = coords.x;
            this.lastY = coords.y;
        };

        const stopDraw = () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.saveState();
            }
        };

        // Mouse listeners
        this.canvas.addEventListener('mousedown', startDraw);
        this.canvas.addEventListener('mousemove', draw);
        this.canvas.addEventListener('mouseup', stopDraw);
        this.canvas.addEventListener('mouseleave', stopDraw);

        // Touch listeners (mobile/tablet)
        this.canvas.addEventListener('touchstart', startDraw, { passive: false });
        this.canvas.addEventListener('touchmove', draw, { passive: false });
        this.canvas.addEventListener('touchend', stopDraw, { passive: false });
    },

    setTool(tool) {
        this.tool = tool;
        const penBtn = document.getElementById('wb-tool-pen');
        const eraserBtn = document.getElementById('wb-tool-eraser');
        
        if (tool === 'pen') {
            if (penBtn) {
                penBtn.style.background = 'var(--accent, #7C4DFF)';
                penBtn.style.color = '#fff';
            }
            if (eraserBtn) {
                eraserBtn.style.background = '';
                eraserBtn.style.color = '';
            }
        } else {
            if (eraserBtn) {
                eraserBtn.style.background = 'var(--accent, #7C4DFF)';
                eraserBtn.style.color = '#fff';
            }
            if (penBtn) {
                penBtn.style.background = '';
                penBtn.style.color = '';
            }
        }
    },

    setBrushSize(size) {
        this.brushSize = Number(size);
        const valEl = document.getElementById('wb-thickness-val');
        if (valEl) valEl.textContent = `${size}px`;
    },

    setColor(color, buttonEl) {
        this.color = color;
        this.setTool('pen'); // Automatically switch back to pen on color change
        
        // Update preset active styling
        const presets = document.querySelectorAll('.wb-color-preset');
        presets.forEach(p => {
            p.style.borderColor = 'transparent';
        });
        if (buttonEl) {
            buttonEl.style.borderColor = '#fff';
        }
    },

    saveState() {
        if (!this.canvas || !this.ctx) return;
        
        // Remove redo stack if we were inside history
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Capture image data
        const state = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(state);
        this.historyIndex++;
        
        // Cap history to save memory
        if (this.history.length > 30) {
            this.history.shift();
            this.historyIndex--;
        }
    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.ctx.putImageData(state, 0, 0);
        }
    },

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.ctx.putImageData(state, 0, 0);
        }
    },

    async clear() {
        if (!await BookListDialogs.confirm('Deseja limpar todo o desenho?', { title: 'Limpar quadro', confirmText: 'Limpar' })) return;
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = '#0c111d';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        this.saveState();
    },

    async save() {
        if (!this.canvas) return;

        // Convert canvas back to high-quality compressed PNG blob
        this.canvas.toBlob(async (blob) => {
            if (!blob) return App.toast('Erro ao gerar imagem.', 'error');
            
            try {
                const uuid = crypto.randomUUID();
                // Save to local vault
                await Storage.saveMedia(uuid, blob);

                // Cache URL
                const localUrl = URL.createObjectURL(blob);
                if (typeof MediaManager !== 'undefined') {
                    MediaManager.urlCache[uuid] = localUrl;
                }

                // Ingest as markdown embed inside current note editor
                const markdownTag = `![Whiteboard Drawing](media:${uuid})`;
                
                if (typeof Notes !== 'undefined') {
                    if (Notes.markdownMode) {
                        const mdEl = document.getElementById('editor-markdown');
                        if (mdEl) {
                            const start = mdEl.selectionStart || mdEl.value.length;
                            mdEl.value = mdEl.value.slice(0, start) + '\n' + markdownTag + '\n' + mdEl.value.slice(start);
                            Notes.autoSave();
                        }
                    } else {
                        // Rich HTML live preview editor
                        const contentEl = document.getElementById('editor-content');
                        if (contentEl) {
                            contentEl.focus();
                            // Ingest image tag
                            const imgHtml = `<img class="note-inline-image" data-media-ref="media:${uuid}" src="${localUrl}" alt="Whiteboard Drawing"><p></p>`;
                            document.execCommand('insertHTML', false, imgHtml);
                            Notes.autoSave();
                        }
                    }
                }

                if (typeof Gamification !== 'undefined') {
                    Gamification.awardWhiteboard();
                }

                App.closeModal();
                App.toast('Desenho anexado à nota com sucesso!', 'success');
            } catch (err) {
                console.error(err);
                App.toast('Erro ao salvar desenho no banco de dados local.', 'error');
            }
        }, 'image/png');
    }
};
