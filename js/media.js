// ============================================
// MEDIA & ATTACHMENTS MODULE - Local Vault
// ============================================
const MediaManager = {
    urlCache: {},
    _loading: {},

    /**
     * Compresses an image file to JPEG using HTML5 Canvas.
     * @param {File} file 
     * @param {number} maxWidth 
     * @param {number} quality 
     * @returns {Promise<Blob>}
     */
    compressImage(file, maxWidth = 1200, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas compress failed'));
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        });
    },

    /**
     * Handles image insertion (compresses and saves to Storage).
     * @param {File} file 
     * @returns {Promise<string>} Markdown image tag with local media URL
     */
    async handleImageUpload(file) {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
            throw new Error('Apenas arquivos de imagem são suportados no momento.');
        }

        const toastId = window.App?.showToast?.('Processando e compactando imagem...', 'info', 10000);
        try {
            const compressedBlob = await this.compressImage(file);
            const uuid = crypto.randomUUID();
            await Storage.saveMedia(uuid, compressedBlob);

            // Pre-cache object URL
            const localUrl = URL.createObjectURL(compressedBlob);
            this.urlCache[uuid] = localUrl;

            if (toastId) window.App?.dismissToast?.(toastId);
            window.App?.showToast?.('Imagem salva no cofre offline com sucesso!', 'success');

            return `![${file.name.replace(/[\[\]]/g, '')}](media:${uuid})`;
        } catch (err) {
            console.error('Failed to upload/compress image:', err);
            if (toastId) window.App?.dismissToast?.(toastId);
            window.App?.showToast?.('Erro ao processar imagem local.', 'error');
            throw err;
        }
    },

    /**
     * Synchronously resolves a media reference (media:uuid) to a cached URL or loading placeholder.
     * @param {string} mediaRef 
     * @returns {string} Virtual object URL or transparent SVG loading spinner
     */
    resolveMediaUrlSync(mediaRef) {
        if (!mediaRef || !mediaRef.startsWith('media:')) return mediaRef;
        const uuid = mediaRef.replace('media:', '');

        if (this.urlCache[uuid]) {
            return this.urlCache[uuid];
        }

        this.preLoadMedia(uuid);

        // Neon cyberpunk loading placeholder with a heartbeat/spin feel
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%230b0f19" rx="10" /><text x="50%" y="45%" font-family="sans-serif" font-weight="bold" font-size="14" fill="%237c4dff" text-anchor="middle" dominant-baseline="middle">Carregando imagem offline...</text><circle cx="150" cy="120" r="12" stroke="%237c4dff" stroke-width="2" fill="none" stroke-dasharray="18 10"><animateTransform attributeName="transform" type="rotate" from="0 150 120" to="360 150 120" dur="1s" repeatCount="indefinite"/></circle></svg>`;
    },

    /**
     * Asynchronously loads media from IndexedDB and caches its URL, updating all matching images in DOM.
     * @param {string} uuid 
     */
    async preLoadMedia(uuid) {
        if (this.urlCache[uuid] || this._loading[uuid]) return;
        this._loading[uuid] = true;

        try {
            const blob = await Storage.getMedia(uuid);
            if (blob) {
                const url = URL.createObjectURL(blob);
                this.urlCache[uuid] = url;

                // Scan DOM and replace src of images waiting for this media:uuid
                setTimeout(() => {
                    const selector = `img[data-media-ref="media:${uuid}"], img[src*="media:${uuid}"]`;
                    const imgs = document.querySelectorAll(selector);
                    imgs.forEach(img => {
                        img.src = url;
                        img.style.filter = 'none'; // Clear any loading blur
                    });
                }, 50);
            }
        } catch (err) {
            console.error('Error preloading local media:', uuid, err);
        } finally {
            delete this._loading[uuid];
        }
    },

    /**
     * Attaches drag & drop and paste events to the editor element.
     * @param {HTMLElement} editorElement 
     * @param {Function} insertTextCallback Function to insert the generated markdown tag
     */
    install(editorElement, insertTextCallback) {
        if (!editorElement) return;

        // Prevent browser default drop action
        const preventDefault = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            editorElement.addEventListener(eventName, preventDefault, false);
        });

        // Add visual feedback on dragover
        editorElement.addEventListener('dragenter', () => {
            editorElement.classList.add('mui-dragover');
        });
        editorElement.addEventListener('dragleave', () => {
            editorElement.classList.remove('mui-dragover');
        });
        editorElement.addEventListener('drop', async (e) => {
            editorElement.classList.remove('mui-dragover');
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        try {
                            const markdownTag = await this.handleImageUpload(file);
                            insertTextCallback(markdownTag);
                        } catch (err) {
                            console.error('Drop upload failed:', err);
                        }
                    }
                }
            }
        });

        // Add paste handler
        editorElement.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (const item of items) {
                    if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            preventDefault(e);
                            try {
                                const markdownTag = await this.handleImageUpload(file);
                                insertTextCallback(markdownTag);
                            } catch (err) {
                                console.error('Paste upload failed:', err);
                            }
                        }
                    }
                }
            }
        });
    }
};
