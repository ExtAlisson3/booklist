// ============================================
// NETWORK TOPOLOGY & TECHNICAL EXPANSION MODULE
// ============================================
const NetworkTopology = {
    canvas: null,
    ctx: null,
    nodes: [],
    edges: [],
    draggingNode: null,
    hoveredNode: null,
    dragOffset: { x: 0, y: 0 },
    animationFrameId: null,
    activeRecord: null,
    sweepInterval: null,
    cctvClockInterval: null,
    sweepSoundOsc: null,

    render(main, records) {
        // Set first network record as active if none selected
        if (!this.activeRecord && records.length > 0) {
            this.activeRecord = records[0];
        }

        const selectorHtml = records.length > 0
            ? `<select id="network-record-select" class="sort-select" onchange="NetworkTopology.selectRecord(this.value)">
                ${records.map(r => `<option value="${r.id}" ${this.activeRecord && r.id === this.activeRecord.id ? 'selected' : ''}>${App.escapeHtml(r.title)}</option>`).join('')}
               </select>`
            : '<span class="text-muted">Nenhuma rede cadastrada. Crie uma no botão ao lado.</span>';

        main.innerHTML = `
        <div class="module-page network-expansion-page">
            <div class="module-hero">
                <div>
                    <span class="module-kicker">Módulo Técnico Avançado</span>
                    <h2>🌐 Redes e Infraestrutura Visual</h2>
                    <p>Mapeamento de topologia interativo, auditoria de segurança em tempo real, varredura de sub-redes e monitor de CFTV.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${selectorHtml}
                    <button class="btn btn-primary" onclick="App.createProfessionalRecord('networks')">+ Criar Rede</button>
                </div>
            </div>

            ${this.activeRecord ? this.buildActiveRecordLayout() : this.buildEmptyStateLayout()}
        </div>`;

        if (this.activeRecord) {
            this.initTopologyCanvas();
            this.initAuditGauge();
            this.initCctvClock();
        }
    },

    selectRecord(id) {
        const records = Storage.getProfessionalRecords('networks');
        this.activeRecord = records.find(r => r.id === id) || null;
        const main = document.getElementById('main-content');
        if (main) {
            this.render(main, records);
        }
    },

    buildEmptyStateLayout() {
        return `
        <div class="empty-state mui-glass" style="margin-top: 24px; padding: 48px; border-radius: 16px;">
            <div class="empty-icon">🌐</div>
            <h3>Nenhum registro de infraestrutura de rede</h3>
            <p>Crie um registro de redes para liberar o mapeador visual de topologias, checklist de conformidade e o simulador terminal.</p>
            <button class="btn btn-primary" style="margin-top: 16px;" onclick="App.createProfessionalRecord('networks')">Cadastrar Primeira Rede</button>
        </div>`;
    },

    buildActiveRecordLayout() {
        const advanced = this.activeRecord.fields?.networkAdvanced || {};
        const client = this.activeRecord.clientId ? Storage.getProfessionalRecords('clients').find(c => c.id === this.activeRecord.clientId) : null;
        
        return `
        <div class="network-vis-grid">
            <!-- TOPOLOGY CANVAS CARD -->
            <div class="feature-card topo-canvas-card mui-glass">
                <div class="topo-card-header">
                    <div>
                        <h3>🗺️ Mapa de Topologia Ativo</h3>
                        <p>Infraestrutura atual de: <strong>${App.escapeHtml(this.activeRecord.title)}</strong> ${client ? `· Cliente: <strong>${App.escapeHtml(client.title)}</strong>` : ''}</p>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-secondary" onclick="NetworkTopology.resetNodeLayout()">Resetar Layout</button>
                        <button class="btn btn-sm btn-primary" onclick="NetworkTopology.openDeviceManager()" style="margin-left: 8px;">⚙️ Dispositivos</button>
                    </div>
                </div>
                <div class="canvas-container">
                    <canvas id="topology-canvas" width="700" height="420"></canvas>
                    <div id="topo-tooltip" class="topo-tooltip mui-glass" style="display:none;"></div>
                </div>
                <div class="topo-legend">
                    <span><i style="background:var(--accent);"></i> Roteador/Borda</span>
                    <span><i style="background:#00E676;"></i> Switch Core</span>
                    <span><i style="background:#29B6F6;"></i> AP/Wi-Fi</span>
                    <span><i style="background:#FF9100;"></i> Servidores/Cameras</span>
                </div>
            </div>

            <!-- COMPLIANCE AUDIT GAUGE -->
            <div class="feature-card audit-gauge-card mui-glass">
                <h3>🛡️ Checklist & Conformidade de Segurança</h3>
                <div class="gauge-section">
                    <div class="gauge-canvas-wrap">
                        <canvas id="audit-gauge-canvas" width="150" height="150"></canvas>
                        <div class="gauge-value" id="gauge-value-text">0%</div>
                    </div>
                    <div class="gauge-details">
                        <h4 id="gauge-status-title">Avaliando...</h4>
                        <p id="gauge-status-desc">Preencha os itens do checklist no editor do registro técnico para atualizar sua conformidade.</p>
                    </div>
                </div>
                <div class="audit-checklist-preview" id="audit-checklist-preview">
                    <!-- Loaded dynamically -->
                </div>
            </div>

            <!-- RETRO TERMINAL sweep -->
            <div class="feature-card terminal-card mui-glass">
                <div class="terminal-header">
                    <h3>📟 Varredura de Rede (Ping Sweep Scanner)</h3>
                    <button class="btn btn-sm btn-primary" onclick="NetworkTopology.runIpSweep()">🔍 Simular Varredura IP</button>
                </div>
                <div class="terminal-body">
                    <div class="crt-overlay"></div>
                    <pre id="terminal-output">C:\\> click "Simular Varredura IP" to ping subnet...\nC:\\></pre>
                </div>
            </div>

            <!-- CFTV MONITOR CARD -->
            <div class="feature-card cctv-card mui-glass">
                <div class="cctv-header">
                    <h3>📷 Painel de Câmeras CFTV</h3>
                    <span class="live-clock" id="cctv-live-clock">LIVE 00:00:00</span>
                </div>
                <div class="cctv-grid" id="cctv-grid-display">
                    <!-- Loaded dynamically -->
                </div>
            </div>
        </div>`;
    },

    getRecordDevices() {
        const advanced = this.activeRecord?.fields?.networkAdvanced || {};
        const devices = advanced.devices || [];
        
        if (devices.length > 0) return devices;

        // Fallback demo devices if empty
        return [
            { id: '1', type: 'roteador', name: 'Gateway Borda', ip: '192.168.1.1', mac: '00:1A:4C:E1:92:01', model: 'MikroTik Hex GR3', status: 'atual', location: 'Rack Central' },
            { id: '2', type: 'switch', name: 'Switch Core', ip: '192.168.1.10', mac: '00:1A:4C:E1:92:02', model: 'EdgeSwitch 24XP', status: 'atual', location: 'Rack Central' },
            { id: '3', type: 'ap', name: 'Wi-Fi Recepção', ip: '192.168.1.20', mac: '00:1A:4C:E1:92:03', model: 'UniFi U6 Lite', status: 'atual', location: 'Teto Recepção' },
            { id: '4', type: 'servidor', name: 'Servidor NAS', ip: '192.168.1.100', mac: '00:1A:4C:E1:92:04', model: 'Synology DS920+', status: 'atual', location: 'DataCenter Sala 3' },
            { id: '5', type: 'camera', name: 'Câmera Portaria', ip: '192.168.1.150', mac: '00:1A:4C:E1:92:05', model: 'Intelbras Dome', status: 'atual', location: 'Garagem' },
            { id: '6', type: 'pc', name: 'PC Financeiro', ip: '192.168.1.12', mac: '00:1A:4C:E1:92:06', model: 'Dell Optiplex', status: 'atual', location: 'Escritório' }
        ];
    },

    resetNodeLayout() {
        if (!this.canvas) return;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        this.nodes.forEach(node => {
            if (node.device.type === 'roteador') {
                node.x = width / 2;
                node.y = 80;
            } else if (node.device.type === 'switch') {
                node.x = width / 2;
                node.y = 200;
            } else {
                node.x = 100 + Math.random() * (width - 200);
                node.y = 320 + (Math.random() * 40 - 20);
            }
        });

        this.saveNodeLayout();
    },

    saveNodeLayout() {
        if (!this.activeRecord) return;
        
        const updatedDevices = this.nodes.map(node => {
            return {
                ...node.device,
                x: Math.round(node.x),
                y: Math.round(node.y)
            };
        });

        const fields = this.activeRecord.fields || {};
        const networkAdvanced = fields.networkAdvanced || {};
        networkAdvanced.devices = updatedDevices;
        fields.networkAdvanced = networkAdvanced;

        Storage.updateProfessionalRecord(this.activeRecord.id, { fields });
        this.activeRecord.fields = fields;
    },

    openDeviceManager() {
        if (!this.activeRecord) return;
        const devices = this.getRecordDevices();
        
        const types = ['roteador', 'switch', 'ap', 'servidor', 'camera', 'pc', 'notebook', 'printer'];
        const typeOptions = types.map(t => `<option value="${t}">${t.toUpperCase()}</option>`).join('');

        App.showModal('Gerenciar Dispositivos', `
            <div style="margin-bottom: 20px;">
                <p class="text-muted">Adicione equipamentos reais para mapeá-los no quadro e poder ligá-los (WoL).</p>
                
                <form onsubmit="NetworkTopology.addDeviceToNetwork(event)" style="display:flex; gap:10px; flex-wrap:wrap; background: var(--mui-glass-bg); padding:16px; border-radius:12px; border:1px solid var(--mui-glass-border); margin-top:10px;">
                    <input type="text" id="dev-name" placeholder="Nome (Ex: NAS Central)" required style="flex:1; min-width:140px;" class="mui-input">
                    <select id="dev-type" required class="mui-input" style="width:120px;">${typeOptions}</select>
                    <input type="text" id="dev-ip" placeholder="IP (Opcional)" style="width:130px;" class="mui-input">
                    <input type="text" id="dev-mac" placeholder="MAC (Para WoL)" style="width:150px;" class="mui-input">
                    <button type="submit" class="btn btn-primary" style="white-space:nowrap;">+ Add</button>
                </form>
            </div>

            <div id="nt-devices-list" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
                ${this.renderDeviceManagerList(devices)}
            </div>
            
            <div class="form-actions" style="margin-top:20px;">
                <button class="btn btn-secondary" onclick="App.closeModal(); NetworkTopology.initTopologyCanvas();">Fechar e Atualizar Mapa</button>
            </div>
        `);
    },

    renderDeviceManagerList(devices) {
        if (devices.length === 0) return '<div class="text-muted text-center" style="padding: 20px;">Nenhum equipamento cadastrado. A rede mostrará o exemplo demo.</div>';
        
        return devices.map(d => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div>
                    <strong>${App.escapeHtml(d.name)}</strong> <span class="text-muted" style="font-size:0.8rem;">(${App.escapeHtml(d.type)})</span><br>
                    <small style="color:var(--accent);">IP: ${d.ip || '-'} | MAC: ${d.mac || '-'}</small>
                </div>
                <button class="btn btn-sm btn-danger" onclick="NetworkTopology.removeDeviceFromNetwork('${d.id}')">Excluir</button>
            </div>
        `).join('');
    },

    addDeviceToNetwork(e) {
        e.preventDefault();
        const advanced = this.activeRecord.fields?.networkAdvanced || {};
        let devices = advanced.devices || [];
        
        // Se ainda for o array demo falso (length 0 na persistência), a gente ignora o fake e cria os reais
        if (!advanced.devices) {
            advanced.devices = [];
            devices = advanced.devices;
        }

        const newDevice = {
            id: 'dev-' + Date.now(),
            name: document.getElementById('dev-name').value.trim(),
            type: document.getElementById('dev-type').value,
            ip: document.getElementById('dev-ip').value.trim(),
            mac: document.getElementById('dev-mac').value.trim(),
            status: 'atual',
            location: 'Local'
        };

        devices.push(newDevice);
        
        const fields = this.activeRecord.fields || {};
        fields.networkAdvanced = advanced;
        Storage.updateProfessionalRecord(this.activeRecord.id, { fields });
        this.activeRecord.fields = fields;

        document.getElementById('nt-devices-list').innerHTML = this.renderDeviceManagerList(devices);
        
        document.getElementById('dev-name').value = '';
        document.getElementById('dev-ip').value = '';
        document.getElementById('dev-mac').value = '';
        
        App.toast('Equipamento adicionado!', 'success');
    },

    removeDeviceFromNetwork(deviceId) {
        const advanced = this.activeRecord.fields?.networkAdvanced || {};
        let devices = advanced.devices || [];
        
        advanced.devices = devices.filter(d => d.id !== deviceId);
        
        const fields = this.activeRecord.fields || {};
        fields.networkAdvanced = advanced;
        Storage.updateProfessionalRecord(this.activeRecord.id, { fields });
        this.activeRecord.fields = fields;

        // Atualizar lista no DOM visualmente
        const listEl = document.getElementById('nt-devices-list');
        if(listEl) listEl.innerHTML = this.renderDeviceManagerList(advanced.devices);
        
        App.toast('Equipamento removido!', 'info');
    },

    initTopologyCanvas() {
        this.canvas = document.getElementById('topology-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // Setup Retina resolution
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);

        const devices = this.getRecordDevices();
        
        // Instantiate nodes
        this.nodes = devices.map((d, index) => {
            let x, y;
            if (d.x !== undefined && d.y !== undefined) {
                x = d.x;
                y = d.y;
            } else {
                x = 100 + Math.random() * (width - 200);
                y = 100 + Math.random() * (height - 200);

                // Simple hierarchical preset
                if (d.type === 'roteador') {
                    x = width / 2;
                    y = 70;
                } else if (d.type === 'switch') {
                    x = width / 2;
                    y = 190;
                }
            }

            return {
                id: d.id || `dev-${index}`,
                x, y,
                vx: 0, vy: 0,
                radius: 24,
                device: d
            };
        });

        // Setup mouse listeners
        this.canvas.onmousedown = (e) => this.handleMouseDown(e);
        this.canvas.onmousemove = (e) => this.handleMouseMove(e);
        this.canvas.onmouseup = () => this.handleMouseUp();
        this.canvas.onmouseleave = () => this.handleMouseUp();

        this.canvas.ontouchstart = (e) => this.handleTouchStart(e);
        this.canvas.ontouchmove = (e) => this.handleTouchMove(e);
        this.canvas.ontouchend = () => this.handleMouseUp();

        const tooltip = document.getElementById('topo-tooltip');
        if (tooltip && !tooltip.dataset.eventsBound) {
            tooltip.style.pointerEvents = 'auto'; // Garante que o popup receba cliques
            tooltip.addEventListener('mouseenter', () => this.isTooltipHovered = true);
            tooltip.addEventListener('mouseleave', () => {
                this.isTooltipHovered = false;
                this.hoveredNode = null;
                this.updateTooltip(null);
            });
            tooltip.dataset.eventsBound = 'true';
        }

        // Run animation loop
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animateTopology();
    },

    animateTopology() {
        this.updateTopologyPhysics();
        this.drawTopology();
        this.animationFrameId = requestAnimationFrame(() => this.animateTopology());
    },

    updateTopologyPhysics() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // Simple spring elastic connections (Nodes pull toward switches or router)
        const gatewayNode = this.nodes.find(n => n.device.type === 'roteador');
        const switchNode = this.nodes.find(n => n.device.type === 'switch');

        this.nodes.forEach(node => {
            if (node === this.draggingNode) return;

            // Coulomb-like repelling forces between all nodes to prevent overlaps
            this.nodes.forEach(other => {
                if (node === other) return;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distSq = dx * dx + dy * dy + 0.1;
                const dist = Math.sqrt(distSq);

                if (dist < 100) {
                    const force = (100 - dist) * 0.05;
                    node.vx += (dx / dist) * force;
                    node.vy += (dy / dist) * force;
                }
            });

            // Elastic attraction to Switch (or Router)
            let parent = switchNode || gatewayNode;
            if (node.device.type === 'switch' && gatewayNode) {
                parent = gatewayNode;
            }

            if (parent && node !== parent) {
                const dx = parent.x - node.x;
                const dy = parent.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const targetDist = 140;
                const diff = dist - targetDist;
                const k = 0.005; // Spring stiffness
                node.vx += dx * k * (diff / (dist || 1));
                node.vy += dy * k * (diff / (dist || 1));
            }

            // Apply friction and bounds limits
            node.x += node.vx;
            node.y += node.vy;
            node.vx *= 0.8;
            node.vy *= 0.8;

            node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
            node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
        });
    },

    drawTopology() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        this.ctx.clearRect(0, 0, width, height);

        const gatewayNode = this.nodes.find(n => n.device.type === 'roteador');
        const switchNode = this.nodes.find(n => n.device.type === 'switch');

        // Draw connections
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';

        this.nodes.forEach(node => {
            let parent = switchNode || gatewayNode;
            if (node.device.type === 'switch' && gatewayNode) parent = gatewayNode;

            if (parent && node !== parent) {
                // Connection line
                this.ctx.beginPath();
                this.ctx.moveTo(node.x, node.y);
                this.ctx.lineTo(parent.x, parent.y);
                this.ctx.strokeStyle = node.device.status === 'offline' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(124, 77, 255, 0.18)';
                this.ctx.stroke();

                // Draw micro data packet animation flowing
                const time = Date.now() * 0.002;
                const ratio = (time + parseFloat(node.id)) % 1.0;
                const px = node.x + (parent.x - node.x) * ratio;
                const py = node.y + (parent.y - node.y) * ratio;

                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                this.ctx.fillStyle = node.device.status === 'offline' ? '#EF5350' : '#00BFA5';
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = this.ctx.fillStyle;
                this.ctx.fill();
                this.ctx.shadowBlur = 0; // reset
            }
        });

        // Draw nodes
        this.nodes.forEach(node => {
            const isHovered = node === this.hoveredNode;
            const isDragging = node === this.draggingNode;

            let color = 'var(--accent, #7C4DFF)';
            if (node.device.type === 'roteador') color = '#7C4DFF';
            else if (node.device.type === 'switch') color = '#00E676';
            else if (node.device.type === 'ap') color = '#29B6F6';
            else if (node.device.type === 'camera') color = '#FFD700';
            else if (node.device.status === 'offline') color = '#EF5350';

            // Outer pulsing neon ring for dragged node
            if (isDragging) {
                this.ctx.save();
                this.ctx.beginPath();
                const pulse = Math.sin(Date.now() * 0.01) * 3 + 5;
                this.ctx.arc(node.x, node.y, node.radius + pulse, 0, Math.PI * 2);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2.5;
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = color;
                this.ctx.stroke();
                this.ctx.restore();
            }

            this.ctx.save();

            // Outer glowing ring
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius + (isHovered ? 4 : 0), 0, Math.PI * 2);
            
            this.ctx.fillStyle = 'rgba(20, 24, 39, 0.6)';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = isHovered ? 3 : 1.5;
            
            if (isHovered) {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = color;
            }

            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.restore();

            // Draw center icon
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Segoe UI Symbol, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const iconMap = { roteador: '🌐', switch: '🎛️', ap: '📶', servidor: '💾', camera: '📷', pc: '💻', notebook: '💻', printer: '🖨️' };
            const icon = iconMap[node.device.type] || '🔌';
            this.ctx.fillText(icon, node.x, node.y + 1);

            // Device Name underneath
            this.ctx.fillStyle = isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)';
            this.ctx.font = '10px Roboto, Segoe UI, sans-serif';
            this.ctx.fillText(node.device.name, node.x, node.y + node.radius + 15);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.fillText(node.device.ip, node.x, node.y + node.radius + 26);
        });
    },

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.draggingNode = this.nodes.find(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < n.radius;
        });

        if (this.draggingNode) {
            this.dragOffset.x = pos.x - this.draggingNode.x;
            this.dragOffset.y = pos.y - this.draggingNode.y;
        }
    },

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.draggingNode) {
            this.draggingNode.x = pos.x - this.dragOffset.x;
            this.draggingNode.y = pos.y - this.dragOffset.y;
            this.updateTooltip(this.draggingNode, e);
        } else {
            if (this.isTooltipHovered) return; // Se o mouse já tá no popup, ignora o canvas

            // Check hover
            const hover = this.nodes.find(n => {
                const dx = n.x - pos.x;
                const dy = n.y - pos.y;
                return Math.sqrt(dx * dx + dy * dy) < n.radius;
            });

            if (hover !== this.hoveredNode) {
                if (!hover) {
                    // Delay antes de esconder para dar tempo de mover o mouse até o popup
                    this.tooltipTimeout = setTimeout(() => {
                        if (!this.isTooltipHovered) {
                            this.hoveredNode = null;
                            this.updateTooltip(null);
                        }
                    }, 250);
                } else {
                    clearTimeout(this.tooltipTimeout);
                    this.hoveredNode = hover;
                    this.updateTooltip(hover, e);
                }
            } else if (hover) {
                this.updateTooltip(hover, e);
            }
        }
    },

    handleMouseUp() {
        if (this.draggingNode) {
            this.draggingNode = null;
            this.saveNodeLayout();
        }
    },

    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.handleMouseDown(e.touches[0]);
        }
    },

    handleTouchMove(e) {
        if (e.touches.length === 1) {
            this.handleMouseMove(e.touches[0]);
        }
    },

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

    updateTooltip(node, e) {
        const tooltip = document.getElementById('topo-tooltip');
        if (!tooltip) return;

        if (!node) {
            tooltip.style.display = 'none';
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const d = node.device;

        tooltip.innerHTML = `
            <div class="tooltip-title">🏷️ ${App.escapeHtml(d.name)}</div>
            <div class="tooltip-row"><span>Tipo:</span><strong>${App.escapeHtml(d.type)}</strong></div>
            <div class="tooltip-row"><span>IP:</span><strong>${App.escapeHtml(d.ip || 'Não atribuído')}</strong></div>
            <div class="tooltip-row"><span>MAC:</span><strong>${App.escapeHtml(d.mac || 'N/A')}</strong></div>
            <div class="tooltip-row"><span>Modelo:</span><strong>${App.escapeHtml(d.model || 'N/A')}</strong></div>
            <div class="tooltip-row"><span>Local:</span><strong>${App.escapeHtml(d.location || 'Rack Central')}</strong></div>
            <div class="tooltip-status-wrap" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span class="tooltip-status status-${d.status}">${App.escapeHtml(d.status || 'atual')}</span>
                ${d.mac && d.mac !== 'N/A' ? `<button class="btn btn-sm btn-primary" style="padding: 2px 8px; font-size:0.75rem;" onclick="NetworkTopology.sendWoL('${d.mac}', '${d.ip}')">⚡ Ligar</button>` : ''}
            </div>
        `;

        tooltip.style.left = `${node.x + 15}px`;
        tooltip.style.top = `${node.y - 40}px`;
        tooltip.style.display = 'block';
    },

    async sendWoL(macAddress, deviceIp) {
        // O usuário precisa rodar o script Python em um PC real da rede, pois o roteador Omada não roda Python nativamente.
        let gatewayIP = localStorage.getItem('wolRelayIp');
        let gatewayPort = localStorage.getItem('wolRelayPort') || '8080';

        if (!gatewayIP) {
            gatewayIP = await BookListDialogs.prompt('IP do servidor relay', '192.168.25.10', { title: 'Configurar Wake-on-LAN', description: 'Informe o computador da rede que executa gateway-wol-relay.py.', placeholder: '192.168.25.10' });
            if (gatewayIP) {
                localStorage.setItem('wolRelayIp', gatewayIP);
            } else {
                return; // Cancelou
            }
        }
        
        App.toast(`Enviando Magic Packet via Relay (${gatewayIP}:${gatewayPort})...`, 'info');
        
        fetch(`http://${gatewayIP}:${gatewayPort}/wol?mac=${encodeURIComponent(macAddress)}`, {
            method: 'POST',
            mode: 'no-cors' // Ignora bloqueios CORS por estar em proxy local interno
        }).then(() => {
            App.toast(`Pacote disparado no gateway VPN!`, 'success');
        }).catch(err => {
            App.toast(`Falha de comunicação WoL na VPN.`, 'error');
        });
    },

    initAuditGauge() {
        const canvas = document.getElementById('audit-gauge-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const advanced = this.activeRecord.fields?.networkAdvanced || {};
        const audit = advanced.audit || {};
        
        const auditItems = [
            ['ipsDocumented','IPs documentados'],
            ['configBackup','Backup de config.'],
            ['firmwareChecked','Firmware revisado'],
            ['passwordsReviewed','Senhas revisadas'],
            ['equipmentLabeled','Equips. identificados'],
            ['criticalPoints','Pontos críticos anotados']
        ];

        const total = auditItems.length;
        const checkedCount = auditItems.filter(([key]) => audit[key] === true).length;
        const pct = total > 0 ? (checkedCount / total) : 0;
        const pctStr = `${Math.round(pct * 100)}%`;

        // Render label text overlay
        const displayVal = document.getElementById('gauge-value-text');
        if (displayVal) displayVal.innerText = pctStr;

        const titleEl = document.getElementById('gauge-status-title');
        const descEl = document.getElementById('gauge-status-desc');

        if (titleEl && descEl) {
            if (pct >= 1.0) {
                titleEl.innerText = '🛡️ Totalmente Seguro';
                descEl.innerText = 'Excelente! Todos os padrões de auditoria física e lógica foram atendidos e revisados.';
            } else if (pct >= 0.6) {
                titleEl.innerText = '⚠️ Segurança Intermediária';
                descEl.innerText = `A conformidade está em ${pctStr}. Resolva as pendências listadas para blindar o rack.`;
            } else {
                titleEl.innerText = '🚨 Infraestrutura Vulnerável';
                descEl.innerText = `Nível crítico de auditoria (${pctStr}). Importante realizar backups e cadastrar IPs urgentes.`;
            }
        }

        // Draw radial gauge
        ctx.clearRect(0, 0, 150, 150);

        const x = 75;
        const y = 75;
        const r = 60;
        const start = -Math.PI / 2;
        const end = start + (Math.PI * 2 * pct);

        // Track background
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 10;
        ctx.stroke();

        // Glowing progress arc
        if (checkedCount > 0) {
            ctx.beginPath();
            ctx.arc(x, y, r, start, end);
            
            let strokeColor = '#EF5350'; // vulnerable
            if (pct >= 0.9) strokeColor = '#00BFA5'; // safe
            else if (pct >= 0.5) strokeColor = '#7C4DFF'; // middle

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 12;
            ctx.shadowColor = strokeColor;
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        }

        // Render checklist preview list
        const previewEl = document.getElementById('audit-checklist-preview');
        if (previewEl) {
            previewEl.innerHTML = auditItems.map(([key, label]) => {
                const passed = audit[key] === true;
                return `
                    <div class="audit-preview-item ${passed ? 'passed' : 'failed'}">
                        <span class="status-indicator">${passed ? '✔' : '✖'}</span>
                        <span class="audit-label">${App.escapeHtml(label)}</span>
                    </div>
                `;
            }).join('');
        }
    },

    runIpSweep() {
        const output = document.getElementById('terminal-output');
        if (!output) return;

        if (this.sweepInterval) clearInterval(this.sweepInterval);

        output.innerHTML = '';
        this.writeTerminalLine('C:\\> sweep -subnet 192.168.1.0/24 -v');
        this.writeTerminalLine('Iniciando varredura rápida ping sweep (TF-Ping v2.4)...');
        this.writeTerminalLine('Varrendo 254 hosts nas sub-redes ativas...\n');

        const devices = this.getRecordDevices();
        let currentIdx = 0;

        this.sweepInterval = setInterval(() => {
            if (currentIdx < devices.length) {
                const d = devices[currentIdx];
                const latency = (Math.random() * 4 + 0.5).toFixed(1);
                
                if (d.status === 'offline') {
                    this.writeTerminalLine(`[-] Host offline: ${d.ip.padEnd(15)} - PING TIMEOUT`, 'error');
                } else {
                    this.writeTerminalLine(`[+] Host online:  ${d.ip.padEnd(15)} [${d.name}] - Latency: ${latency}ms`, 'success');
                }
                currentIdx++;
                this.playTypewriterChime();
            } else {
                clearInterval(this.sweepInterval);
                this.sweepInterval = null;
                const onlineCount = devices.filter(d => d.status !== 'offline').length;
                this.writeTerminalLine(`\n>> Varredura concluída. ${onlineCount} online, ${devices.length - onlineCount} offline.`);
                this.writeTerminalLine('C:\\>');
                
                // Trigger gamification XP for networks sweep!
                if (typeof Gamification !== 'undefined') {
                    Gamification.awardXp(20, 'Varredura IP concluída 🌐');
                }
            }
        }, 600);
    },

    writeTerminalLine(text, style = '') {
        const output = document.getElementById('terminal-output');
        if (!output) return;

        let color = '#39FF14'; // neon green default
        if (style === 'error') color = '#EF5350';
        else if (style === 'success') color = '#00E676';

        const line = document.createElement('div');
        line.style.color = color;
        line.style.margin = '4px 0';
        line.innerText = text;
        output.appendChild(line);

        // Scroll terminal to bottom
        const body = output.parentElement;
        if (body) body.scrollTop = body.scrollHeight;
    },

    playTypewriterChime() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            const now = ctx.currentTime;
            osc.frequency.setValueAtTime(1400, now);
            gain.gain.setValueAtTime(0.015, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            osc.start(now);
            osc.stop(now + 0.05);
        } catch {}
    },

    initCctvClock() {
        this.updateCctvClock();
        if (this.cctvClockInterval) clearInterval(this.cctvClockInterval);
        this.cctvClockInterval = setInterval(() => this.updateCctvClock(), 1000);

        this.renderCctvGrid();
    },

    updateCctvClock() {
        const el = document.getElementById('cctv-live-clock');
        if (!el) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR');
        el.innerText = `🔴 REC ${timeStr}`;
    },

    renderCctvGrid() {
        const container = document.getElementById('cctv-grid-display');
        if (!container) return;

        const advanced = this.activeRecord.fields?.networkAdvanced || {};
        const cameras = advanced.cameras || [];

        const activeCams = cameras.length ? cameras : [
            { name: 'CAM 01 - Portaria', ip: '192.168.1.150', location: 'Portão Principal' },
            { name: 'CAM 02 - Garagem', ip: '192.168.1.151', location: 'Estacionamento' },
            { name: 'CAM 03 - Rack Geral', ip: '192.168.1.152', location: 'Sala TI' },
            { name: 'CAM 04 - Almoxarifado', ip: '192.168.1.153', location: 'Depósito' }
        ];

        container.innerHTML = activeCams.slice(0, 4).map((cam, idx) => {
            const camId = `cctv-canvas-${idx}`;
            return `
                <div class="cctv-block">
                    <canvas id="${camId}" class="cctv-screen"></canvas>
                    <div class="cctv-overlay-text">
                        <div class="cam-info">
                            <span>CAM 0${idx + 1}</span>
                            <span>${App.escapeHtml(cam.name)}</span>
                        </div>
                        <div class="cam-meta">
                            <span>${cam.ip}</span>
                            <span>${App.escapeHtml(cam.location || 'Local')}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Draw animated CCTV interference onto grids
        activeCams.slice(0, 4).forEach((cam, idx) => {
            this.animateCctvNoise(`cctv-canvas-${idx}`, idx);
        });
    },

    animateCctvNoise(canvasId, seed) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let frame = 0;

        const draw = () => {
            if (!document.getElementById(canvasId)) return; // page changed

            const w = canvas.width = 160;
            const h = canvas.height = 100;
            frame++;

            // Draw solid grid backdrop
            ctx.fillStyle = '#0b0f19';
            ctx.fillRect(0, 0, w, h);

            // Draw technical green vector grid lines
            ctx.strokeStyle = 'rgba(0, 230, 118, 0.08)';
            ctx.lineWidth = 0.5;
            for (let x = 0; x < w; x += 20) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 20) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Draw moving sweep line
            const sweepY = (frame * 1.5 + seed * 30) % h;
            ctx.fillStyle = 'rgba(0, 230, 118, 0.06)';
            ctx.fillRect(0, sweepY, w, 2);

            // Draw random interference noise
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            const noiseDensity = Math.random() * 0.04 + 0.02;

            for (let i = 0; i < data.length; i += 4) {
                if (Math.random() < noiseDensity) {
                    const noise = Math.random() * 80;
                    data[i] = noise; // R
                    data[i+1] = noise + 40; // G (greenish)
                    data[i+2] = noise; // B
                }
            }
            ctx.putImageData(imgData, 0, 0);

            // Blinking dots
            if (Math.floor(frame / 30) % 2 === 0) {
                ctx.beginPath();
                ctx.arc(12, 12, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#EF5350';
                ctx.fill();
            }

            requestAnimationFrame(draw);
        };

        draw();
    }
};
