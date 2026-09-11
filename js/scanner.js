/**
 * BookList V4 - QR Code & Barcode Scanner Module
 * Premium Local-First UX with html5-qrcode
 */

const Scanner = {
    html5QrCode: null,
    targetInputId: null,
    isScanning: false,

    /**
     * Initializes the Scanner modal in the DOM if it doesn't already exist.
     */
    initModal() {
        if (document.getElementById('scanner-modal')) return;

        const modalHtml = `
            <div id="scanner-modal" class="scanner-modal-overlay">
                <div class="scanner-modal-content">
                    <div class="scanner-modal-header">
                        <h3><span class="icon">📷</span> Escanear Código</h3>
                        <button class="scanner-modal-close" onclick="Scanner.stop()">&times;</button>
                    </div>
                    <div class="scanner-modal-body">
                        <div class="scanner-video-container">
                            <div id="scanner-reader"></div>
                            <div class="scanner-laser-line"></div>
                        </div>
                        <div class="scanner-controls">
                            <div class="form-group" style="margin-bottom: 8px;">
                                <label for="scanner-camera-select" style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 4px; display: block;">Selecione a Câmera</label>
                                <select id="scanner-camera-select" class="scanner-select" onchange="Scanner.changeCamera(this.value)">
                                    <option value="">Aguardando câmeras...</option>
                                </select>
                            </div>
                            <div class="scanner-status" id="scanner-status">Inicializando câmera...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    /**
     * Starts the scanner overlay and connects to the camera.
     * @param {string} targetInputId The ID of the input field to receive the code.
     */
    async start(targetInputId) {
        this.targetInputId = targetInputId;
        this.initModal();

        // Show the modal
        const modal = document.getElementById('scanner-modal');
        modal.classList.add('active');

        // Ensure libraries are ready
        if (!window.Html5Qrcode) {
            this.setStatus('Carregando biblioteca do scanner...');
            try {
                await this.loadScript('https://unpkg.com/html5-qrcode');
            } catch (err) {
                this.setStatus('Erro ao carregar scanner. Verifique a conexão.');
                console.error(err);
                return;
            }
        }

        this.setStatus('Buscando câmeras disponíveis...');
        
        try {
            // Get available cameras
            const devices = await Html5Qrcode.getCameras();
            const select = document.getElementById('scanner-camera-select');
            select.innerHTML = '';

            if (!devices || devices.length === 0) {
                this.setStatus('Nenhuma câmera encontrada. Use entrada manual.');
                select.innerHTML = '<option value="">Nenhuma câmera detectada</option>';
                return;
            }

            devices.forEach((device, index) => {
                const label = device.label || `Câmera ${index + 1}`;
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = label;
                // Prefer back camera if available (usually has "back" or "traseira" in the label)
                if (label.toLowerCase().includes('back') || label.toLowerCase().includes('traseira') || label.toLowerCase().includes('environment')) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            this.html5QrCode = new Html5Qrcode("scanner-reader");
            this.isScanning = true;

            const selectedCameraId = select.value || devices[0].id;
            await this.startCamera(selectedCameraId);

        } catch (err) {
            console.error('Erro ao acessar câmeras:', err);
            this.setStatus('Permissão de câmera negada ou erro de acesso.');
        }
    },

    /**
     * Helper to load external scripts dynamically
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Sets the scanner status message
     */
    setStatus(text) {
        const el = document.getElementById('scanner-status');
        if (el) el.textContent = text;
    },

    /**
     * Starts the actual camera stream with html5-qrcode
     */
    async startCamera(cameraId) {
        if (!this.html5QrCode) return;

        this.setStatus('Iniciando stream da câmera...');

        try {
            await this.html5QrCode.start(
                cameraId,
                {
                    fps: 15,
                    qrbox: (viewfinderWidth, viewfinderHeight) => {
                        // Wide and short rectangular viewfinder suitable for both barcodes and QR codes
                        const width = Math.floor(viewfinderWidth * 0.8);
                        const height = Math.floor(viewfinderHeight * 0.45);
                        return { width, height };
                    },
                    aspectRatio: 1.333333 // 4:3
                },
                (decodedText) => {
                    this.onSuccess(decodedText);
                },
                (errorMessage) => {
                    // Scanning errors (usually frames where no code is detected) are silent
                }
            );

            this.setStatus('Aponte a câmera para um código de barras ou QR Code.');
        } catch (err) {
            console.error('Falha ao iniciar câmera:', err);
            this.setStatus('Erro ao conectar ao stream da câmera.');
        }
    },

    /**
     * Triggered on changing the selected camera from the dropdown
     */
    async changeCamera(cameraId) {
        if (!cameraId || !this.html5QrCode) return;
        
        try {
            await this.html5QrCode.stop();
            await this.startCamera(cameraId);
        } catch (err) {
            console.error('Erro ao mudar de câmera:', err);
            this.setStatus('Erro ao mudar de câmera.');
        }
    },

    /**
     * Success handler when code is scanned
     */
    onSuccess(decodedText) {
        // Vibrate to indicate success if supported
        if (navigator.vibrate) {
            navigator.vibrate([100]);
        }

        if (window.App?.openEquipmentFromCode?.(decodedText)) {
            if (window.App?.toast) App.toast('Equipamento localizado pelo QR Code.', 'success');
            this.stop();
            return;
        }

        // Fill the input
        if (this.targetInputId) {
            const input = document.getElementById(this.targetInputId);
            if (input) {
                input.value = decodedText;
                // Dispatch change event to trigger form state listeners
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Show a brief toast
                if (window.App && typeof App.showToast === 'function') {
                    App.showToast(`Código escaneado: ${decodedText}`);
                }
            }
        }

        // Stop the camera
        this.stop();
    },

    /**
     * Stop scanning and close the camera / modal
     */
    async stop() {
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            try {
                await this.html5QrCode.stop();
            } catch (err) {
                console.error('Erro ao parar câmera:', err);
            }
        }
        
        this.html5QrCode = null;
        this.isScanning = false;

        const modal = document.getElementById('scanner-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};
