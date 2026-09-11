// ============================================
// STORAGE MODULE - IndexedDB local-first + Supabase sync
// ============================================
const Storage = {
    DB_NAME: 'booklist_local_first',
    DB_VERSION: 2,
    STORE: 'kv',
    MIGRATIONS_KEY: 'booklist_migrations',
    META_KEY: 'booklist_sync_meta',
    AUTO_BACKUPS_KEY: 'booklist_auto_backups',
    TRASH_KEY: 'booklist_trash',
    RELATIONS_KEY: 'booklist_relations',
    ATTACHMENTS_KEY: 'booklist_attachments',
    MEDIA_KEY: 'booklist_media',
    PREFERENCES_KEY: 'booklist_preferences',
    VAULT_KEY: 'booklist_vault',
    COLLECTIONS_KEY: 'booklist_collections',
    WORKSPACES_KEY: 'booklist_workspaces',
    EVENTS_KEY: 'booklist_events',
    PROJECTS_KEY: 'booklist_projects',
    RULES_KEY: 'booklist_rules',
    STUDY_KEY: 'booklist_study',
    DOCUMENTS_KEY: 'booklist_documents',
    HOME_KEY: 'booklist_home_widgets',
    DAILY_FOCUS_KEY: 'booklist_daily_focus',
    CUSTOM_TEMPLATES_KEY: 'booklist_custom_templates',
    CHECKLISTS_KEY: 'booklist_checklists',
    BUNDLES_KEY: 'booklist_bundles',
    DECISIONS_KEY: 'booklist_decisions',
    ANNOTATIONS_KEY: 'booklist_annotations',
    AREAS_KEY: 'booklist_life_areas',
    MODULES_KEY: 'booklist_modules',
    PROFESSIONAL_RECORDS_KEY: 'booklist_professional_records',
    SYNC_HISTORY_KEY: 'booklist_sync_history',
    AI_SETTINGS_KEY: 'booklist_ai_settings',
    CLOUD_BACKUP_KEY: 'booklist_cloud_backup',
    CANVAS_KEY: 'booklist_canvas',
    DEFAULT_SUPABASE: window.BookListConfig?.supabase || { fixed: false, url: '', anonKey: '', email: '' },

    KEYS: {
        BOOKMARKS: 'booklist_bookmarks',
        BOOKMARK_FOLDERS: 'booklist_bk_folders',
        BOOKMARK_CATEGORIES: 'booklist_bk_categories',
        NOTES: 'booklist_notes',
        NOTE_FOLDERS: 'booklist_nt_folders',
        NOTE_CATEGORIES: 'booklist_nt_categories',
        SETTINGS: 'booklist_settings'
    },

    DEFAULT_SYNC_META: {
        dirtyKeys: [],
        localUpdatedAt: {},
        remoteUpdatedAt: {},
        lastSyncAt: null,
        status: 'offline',
        message: 'Sincronização ainda não configurada.'
    },

    _db: null,
    _cache: {},
    _syncTimer: null,
    _backupTimer: null,
    _syncInFlight: false,
    _vaultKey: null,
    _vaultUnlocked: false,
    _vaultLibrary: null,

    get SYNCABLE_KEYS() {
        return [
            this.KEYS.BOOKMARKS,
            this.KEYS.BOOKMARK_FOLDERS,
            this.KEYS.BOOKMARK_CATEGORIES,
            this.KEYS.NOTES,
            this.KEYS.NOTE_FOLDERS,
            this.KEYS.NOTE_CATEGORIES,
            this.RELATIONS_KEY,
            this.ATTACHMENTS_KEY,
            this.MEDIA_KEY,
            this.PREFERENCES_KEY,
            this.COLLECTIONS_KEY,
            this.WORKSPACES_KEY,
            this.EVENTS_KEY,
            this.PROJECTS_KEY,
            this.RULES_KEY,
            this.STUDY_KEY,
            this.DOCUMENTS_KEY,
            this.HOME_KEY,
            this.DAILY_FOCUS_KEY,
            this.CUSTOM_TEMPLATES_KEY,
            this.CHECKLISTS_KEY,
            this.BUNDLES_KEY,
            this.DECISIONS_KEY,
            this.ANNOTATIONS_KEY,
            this.AREAS_KEY,
            this.MODULES_KEY,
            this.CANVAS_KEY,
            this.VAULT_KEY
        ];
    },

    async init() {
        try {
            this._db = await this._openDb();
        } catch (err) {
            console.warn('IndexedDB indisponível, usando localStorage como fallback.', err);
            this._db = null;
        }

        await this._hydrateCache();
        await this._migrateLegacyLocalStorage();
        await this._runMigrations();
        await this._migrateLegacyMedia();

        window.addEventListener('online', () => this.scheduleSync(500));
        window.addEventListener('offline', () => this._setMeta({ ...this._getMeta(), status: 'offline', message: 'Offline. Alterações serão sincronizadas depois.' }));

        if (this.getSettings().sync.enabled) this.scheduleSync(1200);
    },

    _openDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('IndexedDB não suportado.'));
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE, { keyPath: 'key' });
            };
        });
    },

    _readRecord(key) {
        if (!this._db) return Promise.resolve(this._readLocalStorage(key));
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this.STORE, 'readonly');
            const req = tx.objectStore(this.STORE).get(key);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
        });
    },

    _putRecord(key, value) {
        this._cache[key] = value;
        this._writeLocalStorage(key, value);
        if (!this._db) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this.STORE, 'readwrite');
            const req = tx.objectStore(this.STORE).put({ key, value: this._clone(value), updatedAt: new Date().toISOString() });
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    _deleteRecord(key) {
        localStorage.removeItem(key);
        if (!this._db) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this.STORE, 'readwrite');
            tx.objectStore(this.STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    _readLocalStorage(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    _writeLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn('Não foi possível espelhar dados no localStorage.', err);
        }
    },

    async _hydrateCache() {
        const keys = [...Object.values(this.KEYS), this.MIGRATIONS_KEY, this.META_KEY, this.AUTO_BACKUPS_KEY, this.TRASH_KEY, this.RELATIONS_KEY, this.ATTACHMENTS_KEY, this.MEDIA_KEY, this.PREFERENCES_KEY, this.VAULT_KEY, this.COLLECTIONS_KEY, this.WORKSPACES_KEY, this.EVENTS_KEY, this.PROJECTS_KEY, this.RULES_KEY, this.STUDY_KEY, this.DOCUMENTS_KEY, this.HOME_KEY, this.DAILY_FOCUS_KEY, this.CUSTOM_TEMPLATES_KEY, this.CHECKLISTS_KEY, this.BUNDLES_KEY, this.DECISIONS_KEY, this.ANNOTATIONS_KEY, this.AREAS_KEY, this.MODULES_KEY, this.CANVAS_KEY, this.PROFESSIONAL_RECORDS_KEY, this.SYNC_HISTORY_KEY, this.AI_SETTINGS_KEY, this.CLOUD_BACKUP_KEY];
        const values = await Promise.all(keys.map(key => this._readRecord(key)));
        keys.forEach((key, idx) => {
            if (values[idx] !== null && values[idx] !== undefined) this._cache[key] = values[idx];
        });
    },

    async _migrateLegacyLocalStorage() {
        let migrated = false;
        for (const key of Object.values(this.KEYS)) {
            if (this._cache[key] !== undefined) continue;
            const value = this._readLocalStorage(key);
            if (value === null || value === undefined) continue;
            this._cache[key] = value;
            await this._putRecord(key, value);
            if (this._isSyncableKey(key)) this._markDirty(key, false);
            migrated = true;
        }
        if (migrated) {
            const meta = this._getMeta();
            meta.message = 'Dados antigos migrados para IndexedDB.';
            this._setMeta(meta);
        }
    },

    async _migrateLegacyMedia() {
        const media = this._get(this.MEDIA_KEY) || {};
        let changed = false;
        const importBlob = async (key, value) => {
            const uuid = String(key || '').replace(/^media:/, '');
            if (!uuid || media[uuid] || !value) return;
            let dataUrl = value;
            if (value instanceof Blob) {
                dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(value);
                });
            }
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return;
            media[uuid] = { dataUrl, type: value.type || dataUrl.slice(5, dataUrl.indexOf(';')) || 'application/octet-stream', size: value.size || 0, updatedAt: new Date().toISOString() };
            changed = true;
        };

        if (this._db) {
            const legacyEntries = await new Promise((resolve, reject) => {
                const entries = [];
                const tx = this._db.transaction(this.STORE, 'readonly');
                const req = tx.objectStore(this.STORE).openCursor();
                req.onerror = () => reject(req.error);
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor) return resolve(entries);
                    if (String(cursor.key).startsWith('media:')) entries.push([cursor.key, cursor.value?.value]);
                    cursor.continue();
                };
            });
            for (const [key, value] of legacyEntries) await importBlob(key, value);
        }
        if (typeof localStorage?.length === 'number' && typeof localStorage.key === 'function') {
            const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(key => key?.startsWith('media:'));
            for (const key of keys) await importBlob(key, localStorage.getItem(key));
        }
        if (changed) this._set(this.MEDIA_KEY, media);
    },

    async _runMigrations() {
        const done = new Set(this._get(this.MIGRATIONS_KEY) || []);
        const migrations = [
            ['v3-fixed-supabase-client-config', () => {
                const raw = this._get(this.KEYS.SETTINGS);
                const sync = { ...(raw?.sync || {}) };
                if (this.DEFAULT_SUPABASE.fixed) {
                    sync.enabled = true;
                    sync.supabaseUrl = this.DEFAULT_SUPABASE.url;
                    sync.anonKey = this.DEFAULT_SUPABASE.anonKey;
                    sync.email = this.DEFAULT_SUPABASE.email;
                }
                this._set(this.KEYS.SETTINGS, { ...(raw || {}), sync }, { sync: false });
            }],
            ['v2-canvas-store', () => {
                if (!this._get(this.CANVAS_KEY)) this._set(this.CANVAS_KEY, { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }, { sync: false });
            }],
            ['v4-synced-preferences', () => {
                if (!this._get(this.PREFERENCES_KEY)) this._set(this.PREFERENCES_KEY, this._publicPreferences(this.getSettings()), { sync: false });
            }]
        ];
        for (const [id, fn] of migrations) {
            if (done.has(id)) continue;
            fn();
            done.add(id);
        }
        this._set(this.MIGRATIONS_KEY, [...done], { sync: false });
    },

    _clone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    },

    _sanitizeForStorage(value) {
        if (Array.isArray(value)) return value.map(v => this._sanitizeForStorage(v));
        if (value && typeof value === 'object') {
            const clean = {};
            for (const [k, v] of Object.entries(value)) {
                if (k === '_decrypted') continue;
                clean[k] = this._sanitizeForStorage(v);
            }
            return clean;
        }
        return value;
    },

    _get(key) {
        if (this._cache[key] === undefined) {
            const localVal = this._readLocalStorage(key);
            if (localVal !== null && localVal !== undefined) {
                this._cache[key] = localVal;
            }
        }
        return this._clone(this._cache[key] ?? null);
    },

    _getRawList(key) {
        return this._get(key) || [];
    },

    _set(key, value, options = {}) {
        const isNoteOrBk = key === this.KEYS.NOTES || key === this.KEYS.BOOKMARKS;
        const shouldSync = options.sync !== false && this._isSyncableKey(key);
        const cloned = this._clone(this._sanitizeForStorage(value));
        const oldList = this._clone(this._cache[key] || []);
        this._cache[key] = cloned;
        this._putRecord(key, cloned).catch(err => console.error('Erro ao salvar no IndexedDB:', err));
        window.Events?.emit?.('storage:changed', { key, syncable: shouldSync });
        window.Events?.emit?.(`storage:${key}`, { key, value: this._clone(cloned), syncable: shouldSync });
        
        if (options.sync !== false && isNoteOrBk) {
            const isNote = key === this.KEYS.NOTES;
            const prefix = isNote ? 'note:' : 'bookmark:';
            const newList = cloned || [];
            
            // Find added/modified
            for (const item of newList) {
                const oldItem = oldList.find(i => i.id === item.id);
                if (!oldItem || item.updatedAt !== oldItem.updatedAt || JSON.stringify(item) !== JSON.stringify(oldItem)) {
                    const dynKey = prefix + item.id;
                    this._markDirty(dynKey);
                }
            }
            
            // Find deleted
            for (const oldItem of oldList) {
                if (!newList.some(i => i.id === oldItem.id)) {
                    const dynKey = prefix + oldItem.id;
                    const tombKey = 'tombstone:' + dynKey;
                    this._putRecord(tombKey, { id: oldItem.id, type: isNote ? 'note' : 'bookmark', _deleted: true, updatedAt: new Date().toISOString() })
                        .catch(err => console.error('Erro ao salvar tombstone:', err));
                    this._markDirty(tombKey);
                }
            }
            this._scheduleAutoBackup();
        } else if (shouldSync) {
            this._markDirty(key);
            this._scheduleAutoBackup();
        }
    },

    _isSyncableKey(key) {
        if (key.startsWith('note:') || key.startsWith('bookmark:') || key.startsWith('tombstone:')) {
            return true;
        }
        if (key === this.KEYS.BOOKMARKS || key === this.KEYS.NOTES) {
            return false;
        }
        return this.SYNCABLE_KEYS.includes(key);
    },

    _normalizeSettings(settings = {}) {
        const sync = settings.sync || {};
        const fixedSync = this.DEFAULT_SUPABASE.fixed ? this.DEFAULT_SUPABASE : null;
        return {
            theme: settings.theme || 'dark',
            accent: settings.accent || '#7C4DFF',
            language: settings.language || 'pt-BR',
            onboardingDone: Boolean(settings.onboardingDone),
            pureMarkdownDefault: Boolean(settings.pureMarkdownDefault),
            aiNeuralSearch: Boolean(settings.aiNeuralSearch),
            workspaceMode: ['work', 'personal', 'all'].includes(settings.workspaceMode) ? settings.workspaceMode : 'all',
            interfaceSounds: settings.interfaceSounds !== false,
            pixKey: settings.pixKey || '',
            pixName: settings.pixName || '',
            pixCity: settings.pixCity || '',
            geminiApiKey: settings.geminiApiKey || '',
            openaiApiKey: settings.openaiApiKey || '',
            ragModel: settings.ragModel || '',
            sync: {
                enabled: fixedSync ? true : Boolean(sync.enabled),
                supabaseUrl: fixedSync?.url || sync.supabaseUrl || '',
                anonKey: fixedSync?.anonKey || sync.anonKey || '',
                email: fixedSync?.email || sync.email || '',
                userId: sync.userId || '',
                accessToken: sync.accessToken || '',
                refreshToken: sync.refreshToken || '',
                expiresAt: sync.expiresAt || 0,
                lastSyncAt: sync.lastSyncAt || null
            }
        };
    },

    _normalizeSupabaseUrl(url) {
        return (url || '').trim().replace(/\/+$/, '');
    },

    // Migrate old single categoryId to categoryIds array
    _migrateCategoryIds(item) {
        if (item.categoryId && !item.categoryIds) {
            item.categoryIds = [item.categoryId];
            delete item.categoryId;
        }
        if (!item.categoryIds) item.categoryIds = [];
        return item;
    },

    // --- Bookmarks ---
    getBookmarks(options = {}) {
        const includePrivate = options.includePrivate !== undefined ? Boolean(options.includePrivate) : this.isVaultUnlocked();
        let list = (this._get(this.KEYS.BOOKMARKS) || [])
            .map(b => this._migrateCategoryIds(this._viewVaultItem(b, 'bookmark')))
            .filter(b => includePrivate || !b.isPrivate);
        if (window.TimeTravelDate) {
            list = list.filter(b => new Date(b.createdAt || b.updatedAt) <= window.TimeTravelDate);
        }
        return list;
    },
    saveBookmarks(arr) { this._set(this.KEYS.BOOKMARKS, arr); },
    addBookmark(bk) {
        const all = this._getRawList(this.KEYS.BOOKMARKS);
        bk.id = bk.id || crypto.randomUUID();
        bk.createdAt = bk.createdAt || new Date().toISOString();
        bk.updatedAt = new Date().toISOString();
        bk.favorite = bk.favorite || false;
        bk.categoryIds = bk.categoryIds || [];
        all.push(bk);
        this.saveBookmarks(all);
        this.logEvent('bookmark.created', { id: bk.id, title: bk.title });
        return bk;
    },
    updateBookmark(id, data) {
        const all = this._getRawList(this.KEYS.BOOKMARKS);
        const idx = all.findIndex(b => b.id === id);
        if (idx !== -1) {
            Object.assign(all[idx], data, { updatedAt: new Date().toISOString() });
            this.saveBookmarks(all);
            this.logEvent('bookmark.updated', { id, fields: Object.keys(data) }, { sync: false });
        }
        return all[idx];
    },
    deleteBookmark(id) {
        const current = this._getRawList(this.KEYS.BOOKMARKS);
        const item = current.find(b => b.id === id);
        const trash = item ? this.trashItem('bookmark', item) : null;
        this.saveBookmarks(current.filter(b => b.id !== id));
        this.logEvent('bookmark.deleted', { id }, { sync: false });
        return trash;
    },

    // --- Notes ---
    getNotes(options = {}) {
        const includePrivate = options.includePrivate !== undefined ? Boolean(options.includePrivate) : this.isVaultUnlocked();
        let list = (this._get(this.KEYS.NOTES) || [])
            .map(n => this._migrateCategoryIds(this._viewVaultItem(n, 'note')))
            .filter(n => includePrivate || !n.isPrivate);
        if (window.TimeTravelDate) {
            list = list.filter(n => new Date(n.createdAt || n.updatedAt) <= window.TimeTravelDate);
        }
        return list;
    },
    saveNotes(arr) { this._set(this.KEYS.NOTES, arr); },
    addNote(note) {
        const all = this._getRawList(this.KEYS.NOTES);
        note.id = note.id || crypto.randomUUID();
        note.createdAt = note.createdAt || new Date().toISOString();
        note.updatedAt = new Date().toISOString();
        note.pinned = note.pinned || false;
        note.categoryIds = note.categoryIds || [];
        all.push(note);
        this.saveNotes(all);
        this.logEvent('note.created', { id: note.id, title: note.title });
        return note;
    },
    updateNote(id, data) {
        const all = this._getRawList(this.KEYS.NOTES);
        const idx = all.findIndex(n => n.id === id);
        if (idx !== -1) {
            const current = all[idx];
            const contentChanged = data.content !== undefined && data.content !== current.content;
            const charsDiff = contentChanged ? Math.abs((data.content || '').length - (current.content || '').length) : 0;
            const enoughTime = !current._lastVersionAt || (Date.now() - Date.parse(current._lastVersionAt)) > 45000;
            if (contentChanged && (enoughTime || charsDiff > 20) && (current.content || '').trim()) {
                current.versions = current.versions || [];
                if (current.versions.length === 0 || current.versions[0].content !== current.content) {
                    current.versions.unshift({
                        id: crypto.randomUUID(),
                        title: current.title,
                        content: current.content,
                        createdAt: new Date().toISOString()
                    });
                    current.versions = current.versions.slice(0, 30);
                    current._lastVersionAt = new Date().toISOString();
                }
            }
            Object.assign(all[idx], data, { updatedAt: new Date().toISOString() });
            this.saveNotes(all);
            this.logEvent('note.updated', { id, fields: Object.keys(data) }, { sync: false });
        }
        return all[idx];
    },
    deleteNote(id) {
        const current = this._getRawList(this.KEYS.NOTES);
        const item = current.find(n => n.id === id);
        const trash = item ? this.trashItem('note', item) : null;
        this.saveNotes(current.filter(n => n.id !== id));
        this.logEvent('note.deleted', { id }, { sync: false });
        return trash;
    },

    // --- Vault / private encrypted items ---
    getVaultSettings() {
        return this._get(this.VAULT_KEY) || { enabled: false, salt: '', verifier: '', autoLockMinutes: 10 };
    },
    saveVaultSettings(data) {
        this._set(this.VAULT_KEY, { ...this.getVaultSettings(), ...data });
    },
    isVaultUnlocked() {
        return this._vaultUnlocked;
    },
    async _hashText(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async setupVault(password) {
        if (!password || password.length < 4) throw new Error('Use uma senha com pelo menos 4 caracteres.');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        this._vaultKey = await this._deriveVaultKey(password, salt);
        const verifier = await this._encryptText('booklist-vault-ok', this._vaultKey);
        this._vaultUnlocked = true;
        
        // Migrate existing API keys in settings to the vault!
        const settings = this.getSettings();
        const keysToSecure = {
            geminiApiKey: settings.geminiApiKey || '',
            openaiApiKey: settings.openaiApiKey || '',
            ragModel: settings.ragModel || ''
        };
        
        this._decryptedKeys = keysToSecure;
        const encryptedAiKeys = await this._encryptText(JSON.stringify(keysToSecure), this._vaultKey);
        
        // Strip plain keys from settings
        const cleanSettings = { ...settings, geminiApiKey: '', openaiApiKey: '', ragModel: '' };
        this._set(this.KEYS.SETTINGS, this._normalizeSettings(cleanSettings), { sync: false });
        
        this._vaultLibrary = { folders: [], categories: [], tracker: [] };
        const libraryData = await this._encryptText(JSON.stringify(this._vaultLibrary), this._vaultKey);
        this._set(this.VAULT_KEY, { enabled: true, salt: this._bytesToBase64(salt), verifier, encryptedAiKeys, libraryData, autoLockMinutes: 10 });
    },
    async unlockVault(password) {
        const vault = this.getVaultSettings();
        if (!vault.enabled) throw new Error('Cofre ainda não configurado.');
        const key = await this._deriveVaultKey(password, this._base64ToBytes(vault.salt));
        const verifier = await this._decryptText(vault.verifier, key);
        if (verifier !== 'booklist-vault-ok') throw new Error('Senha do cofre incorreta.');
        if (vault.totpEnabled && !(await this.verifyVault2fa(document.getElementById('vault-2fa')?.value))) throw new Error('Codigo 2FA invalido.');
        this._vaultKey = key;
        this._vaultUnlocked = true;
        
        // Decrypt secure AI API keys if present
        if (vault.encryptedAiKeys) {
            try {
                const decryptedStr = await this._decryptText(vault.encryptedAiKeys, key);
                this._decryptedKeys = JSON.parse(decryptedStr);
            } catch (err) {
                console.error("Falha ao descriptografar chaves de IA do cofre:", err);
                this._decryptedKeys = null;
            }
        } else {
            this._decryptedKeys = null;
        }

        try {
            this._vaultLibrary = vault.libraryData ? JSON.parse(await this._decryptText(vault.libraryData, key)) : { folders: [], categories: [], tracker: [] };
        } catch (err) {
            console.error('Falha ao carregar a organização do cofre:', err);
            this._vaultLibrary = { folders: [], categories: [] };
        }
        this._vaultLibrary.folders = Array.isArray(this._vaultLibrary.folders) ? this._vaultLibrary.folders : [];
        this._vaultLibrary.categories = Array.isArray(this._vaultLibrary.categories) ? this._vaultLibrary.categories : [];
        this._vaultLibrary.tracker = Array.isArray(this._vaultLibrary.tracker) ? this._vaultLibrary.tracker : [];

        await this.refreshVaultViews();
        setTimeout(() => this.lockVault(), (vault.autoLockMinutes || 10) * 60 * 1000);
    },
    lockVault() {
        this._vaultKey = null;
        this._vaultUnlocked = false;
        this._decryptedKeys = null; // Clear from memory
        this._vaultLibrary = null;
        for (const key of [this.KEYS.BOOKMARKS, this.KEYS.NOTES]) {
            const all = this._get(key) || [];
            all.forEach(item => { if (item._decrypted) delete item._decrypted; });
            this._cache[key] = all;
        }
    },
    async enableVault2fa(secret) {
        const clean = (secret || '').replace(/\D/g, '').slice(0, 6);
        if (clean.length < 6) throw new Error('Use um codigo numerico de 6 digitos.');
        const hashed = await this._hashText(clean);
        this.saveVaultSettings({ totpEnabled: true, totpSecretHash: hashed });
    },
    disableVault2fa() { this.saveVaultSettings({ totpEnabled: false, totpSecret: '', totpSecretHash: '' }); },
    async verifyVault2fa(code) {
        const vault = this.getVaultSettings();
        if (!vault.totpEnabled) return true;
        const cleanCode = String(code || '').trim();
        if (vault.totpSecretHash) {
            const hashed = await this._hashText(cleanCode);
            return hashed === vault.totpSecretHash;
        }
        return cleanCode === String(vault.totpSecret || '').trim();
    },
    getVaultFolders() { return this._vaultLibrary?.folders || []; },
    getVaultCategories() { return this._vaultLibrary?.categories || []; },
    getVaultTracker() { return this._vaultLibrary?.tracker || []; },
    async saveVaultLibrary(data) {
        if (!this._vaultUnlocked || !this._vaultKey) throw new Error('Desbloqueie o cofre primeiro.');
        this._vaultLibrary = {
            ...(this._vaultLibrary || {}),
            ...data,
            folders: Array.isArray(data?.folders) ? data.folders : (this._vaultLibrary?.folders || []),
            categories: Array.isArray(data?.categories) ? data.categories : (this._vaultLibrary?.categories || []),
            tracker: Array.isArray(data?.tracker) ? data.tracker : (this._vaultLibrary?.tracker || [])
        };
        const vault = this.getVaultSettings();
        const libraryData = await this._encryptText(JSON.stringify(this._vaultLibrary), this._vaultKey);
        this.saveVaultSettings({ ...vault, libraryData });
    },
    async addVaultFolder(data = {}) {
        const folders = this.getVaultFolders();
        const item = { id: crypto.randomUUID(), name: String(data.name || 'Nova pasta').trim().slice(0, 80), color: data.color || '#6f7cff', createdAt: new Date().toISOString() };
        await this.saveVaultLibrary({ folders: [...folders, item], categories: this.getVaultCategories() });
        return item;
    },
    async addVaultCategory(data = {}) {
        const categories = this.getVaultCategories();
        const item = { id: crypto.randomUUID(), name: String(data.name || 'Nova categoria').trim().slice(0, 80), color: data.color || '#a78bfa', createdAt: new Date().toISOString() };
        await this.saveVaultLibrary({ folders: this.getVaultFolders(), categories: [...categories, item] });
        return item;
    },
    async saveVaultTracker(items) { await this.saveVaultLibrary({ tracker: items }); },
    async saveVaultTrackerItem(data = {}, id = '') {
        if (!this._vaultUnlocked) throw new Error('Desbloqueie o cofre primeiro.');
        const items = this.getVaultTracker();
        const now = new Date().toISOString();
        const existing = id ? items.find(item => item.id === id) : null;
        const item = { ...(existing || {}), ...data, id: existing?.id || crypto.randomUUID(), createdAt: existing?.createdAt || now, updatedAt: now };
        await this.saveVaultTracker(existing ? items.map(entry => entry.id === id ? item : entry) : [item, ...items]);
        return item;
    },
    async deleteVaultTrackerItem(id) { await this.saveVaultTracker(this.getVaultTracker().filter(item => item.id !== id)); },
      async makePrivate(type, id) {
          if (!this._vaultUnlocked || !this._vaultKey) throw new Error('Desbloqueie o cofre primeiro.');
          if (type === 'bookmark') {
              const all = this._getRawList(this.KEYS.BOOKMARKS);
              const item = all.find(b => b.id === id);
              if (!item || item.isPrivate) return false;
              const payload = this._sanitizeForStorage({ ...item });
              delete payload.isPrivate;
              delete payload.lockedData;
              delete payload._decrypted;
              const lockedData = await this._encryptText(JSON.stringify(payload), this._vaultKey);
              Object.assign(item, { isPrivate: true, lockedData, title: 'Bookmark privado', url: '#', description: '' });
              this.saveBookmarks(all);
              await this.refreshVaultViews();
              return true;
          }
          const all = this._getRawList(this.KEYS.NOTES);
          const item = all.find(n => n.id === id);
          if (!item || item.isPrivate) return false;
          const payload = this._sanitizeForStorage({ ...item });
          delete payload.isPrivate;
          delete payload.lockedData;
          delete payload._decrypted;
          const lockedData = await this._encryptText(JSON.stringify(payload), this._vaultKey);
          Object.assign(item, { isPrivate: true, lockedData, title: 'Nota privada', content: '' });
          this.saveNotes(all);
          await this.refreshVaultViews();
        return true;
    },
    async makePublic(type, id) {
        if (!this._vaultUnlocked || !this._vaultKey) throw new Error('Desbloqueie o cofre primeiro.');
        const all = type === 'bookmark' ? this._getRawList(this.KEYS.BOOKMARKS) : this._getRawList(this.KEYS.NOTES);
        const item = all.find(x => x.id === id);
        if (!item || !item.isPrivate) return false;
        const data = item._decrypted || JSON.parse(await this._decryptText(item.lockedData, this._vaultKey));
        Object.assign(item, data, { isPrivate: false, lockedData: '' });
        delete item._decrypted;
        if (type === 'bookmark') this.saveBookmarks(all);
        else this.saveNotes(all);
        return true;
    },
    async savePrivateItem(type, data = {}, id = '') {
        if (!this._vaultUnlocked || !this._vaultKey) throw new Error('Desbloqueie o cofre primeiro.');
        if (!['note', 'bookmark'].includes(type)) throw new Error('Tipo de item inválido.');
        const key = type === 'bookmark' ? this.KEYS.BOOKMARKS : this.KEYS.NOTES;
        const all = this._getRawList(key);
        const existing = id ? all.find(item => item.id === id && item.isPrivate) : null;
        if (id && !existing) throw new Error('Item privado não encontrado.');
        const now = new Date().toISOString();
        const payload = {
            ...(existing?._decrypted || {}),
            ...data,
            id: existing?.id || crypto.randomUUID(),
            createdAt: existing?._decrypted?.createdAt || now,
            updatedAt: now,
            categoryIds: data.categoryIds || existing?._decrypted?.categoryIds || [],
            vaultTags: Array.isArray(data.vaultTags) ? data.vaultTags : (existing?._decrypted?.vaultTags || [])
        };
        const lockedData = await this._encryptText(JSON.stringify(this._sanitizeForStorage(payload)), this._vaultKey);
        if (existing) {
            Object.assign(existing, { isPrivate: true, lockedData, title: type === 'note' ? 'Nota privada' : 'Bookmark privado', content: '', url: '#', description: '', _decrypted: payload, updatedAt: now });
        } else {
            all.push({ id: payload.id, isPrivate: true, lockedData, title: type === 'note' ? 'Nota privada' : 'Bookmark privado', content: '', url: '#', description: '', createdAt: now, updatedAt: now, _decrypted: payload });
        }
        if (type === 'bookmark') this.saveBookmarks(all); else this.saveNotes(all);
        await this.refreshVaultViews();
        this.logEvent(`vault.${existing ? 'updated' : 'created'}`, { id: payload.id, type });
        return payload;
    },
    deletePrivateItem(type, id) {
        if (!this._vaultUnlocked) throw new Error('Desbloqueie o cofre primeiro.');
        const key = type === 'bookmark' ? this.KEYS.BOOKMARKS : this.KEYS.NOTES;
        const all = this._getRawList(key);
        const item = all.find(entry => entry.id === id && entry.isPrivate);
        if (!item) return false;
        if (type === 'bookmark') this.deleteBookmark(id); else this.deleteNote(id);
        return true;
    },
    _viewVaultItem(item, type) {
        if (!item?.isPrivate) return item;
        const copy = { ...item, privateType: type };
        if (item._decrypted) return { ...copy, ...item._decrypted };
        return copy;
    },
    async refreshVaultViews() {
        if (!this._vaultUnlocked || !this._vaultKey) return;
        for (const key of [this.KEYS.BOOKMARKS, this.KEYS.NOTES]) {
            const all = this._get(key) || [];
            for (const item of all) {
                if (!item.isPrivate || !item.lockedData) continue;
                try { item._decrypted = JSON.parse(await this._decryptText(item.lockedData, this._vaultKey)); }
                catch { item._decrypted = null; }
            }
            this._cache[key] = all;
        }
    },
    async _deriveVaultKey(password, salt) {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    },
    async _encryptText(text, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
        return `${this._bytesToBase64(iv)}.${this._bytesToBase64(new Uint8Array(cipher))}`;
    },
    async _decryptText(payload, key) {
        const [iv, data] = payload.split('.');
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this._base64ToBytes(iv) }, key, this._base64ToBytes(data));
        return new TextDecoder().decode(plain);
    },
    _bytesToBase64(bytes) {
        return btoa(String.fromCharCode(...bytes));
    },
    _base64ToBytes(text) {
        return Uint8Array.from(atob(text), c => c.charCodeAt(0));
    },

    // --- Local Media Storage ---
    async saveMedia(uuid, blob) {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
        const media = this._get(this.MEDIA_KEY) || {};
        media[uuid] = { dataUrl, type: blob.type || 'application/octet-stream', size: blob.size || 0, updatedAt: new Date().toISOString() };
        this._set(this.MEDIA_KEY, media);
    },

    async getMedia(uuid) {
        const synced = (this._get(this.MEDIA_KEY) || {})[uuid];
        if (synced?.dataUrl) return await (await fetch(synced.dataUrl)).blob();
        if (!this._db) {
            const raw = localStorage.getItem('media:' + uuid);
            if (!raw) return null;
            const res = await fetch(raw);
            return await res.blob();
        }
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this.STORE, 'readonly');
            const req = tx.objectStore(this.STORE).get('media:' + uuid);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
        });
    },

    async deleteMedia(uuid) {
        const media = this._get(this.MEDIA_KEY) || {};
        if (media[uuid]) { delete media[uuid]; this._set(this.MEDIA_KEY, media); }
        localStorage.removeItem('media:' + uuid);
        if (!this._db) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this.STORE, 'readwrite');
            tx.objectStore(this.STORE).delete('media:' + uuid);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    // --- Relations / attachments ---
    getRelations() { return this._get(this.RELATIONS_KEY) || []; },
    saveRelations(arr) { this._set(this.RELATIONS_KEY, arr); },
    addRelation(noteId, bookmarkId) {
        const rels = this.getRelations();
        if (!rels.some(r => r.noteId === noteId && r.bookmarkId === bookmarkId)) {
            rels.push({ id: crypto.randomUUID(), noteId, bookmarkId, createdAt: new Date().toISOString() });
            this.saveRelations(rels);
        }
    },
    removeRelation(id) { this.saveRelations(this.getRelations().filter(r => r.id !== id)); },
    getAttachments(noteId = null) {
        const all = this._get(this.ATTACHMENTS_KEY) || [];
        return noteId ? all.filter(a => a.noteId === noteId) : all;
    },
    addAttachment(att) {
        const all = this.getAttachments();
        all.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...att });
        this._set(this.ATTACHMENTS_KEY, all.slice(0, 120));
    },
    deleteAttachment(id) { this._set(this.ATTACHMENTS_KEY, this.getAttachments().filter(a => a.id !== id)); },

    // --- Collections / workspaces / activity ---
    getCollections() {
        return this._get(this.COLLECTIONS_KEY) || [];
    },
    saveCollections(arr) { this._set(this.COLLECTIONS_KEY, arr); },
    addCollection(data) {
        const all = this.getCollections();
        const item = {
            id: crypto.randomUUID(),
            name: data.name || 'Nova colecao',
            color: data.color || '#00BFA5',
            description: data.description || '',
            items: data.items || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        all.unshift(item);
        this.saveCollections(all);
        this.logEvent('collection.created', { id: item.id, name: item.name });
        return item;
    },
    updateCollection(id, data) {
        const all = this.getCollections();
        const idx = all.findIndex(c => c.id === id);
        if (idx === -1) return null;
        Object.assign(all[idx], data, { updatedAt: new Date().toISOString() });
        this.saveCollections(all);
        return all[idx];
    },
    deleteCollection(id) {
        this.saveCollections(this.getCollections().filter(c => c.id !== id));
    },
    addCollectionItem(collectionId, type, itemId) {
        const all = this.getCollections();
        const col = all.find(c => c.id === collectionId);
        if (!col) return false;
        col.items = col.items || [];
        if (!col.items.some(i => i.type === type && i.id === itemId)) {
            col.items.push({ type, id: itemId, addedAt: new Date().toISOString() });
            col.updatedAt = new Date().toISOString();
            this.saveCollections(all);
            this.logEvent('collection.item_added', { collectionId, type, itemId }, { sync: false });
        }
        return true;
    },
    removeCollectionItem(collectionId, type, itemId) {
        const all = this.getCollections();
        const col = all.find(c => c.id === collectionId);
        if (!col) return false;
        col.items = (col.items || []).filter(i => !(i.type === type && i.id === itemId));
        col.updatedAt = new Date().toISOString();
        this.saveCollections(all);
        return true;
    },
    getWorkspaces() {
        return this._get(this.WORKSPACES_KEY) || [{ id: 'default', name: 'Principal', color: '#7C4DFF', current: true, createdAt: new Date().toISOString() }];
    },
    saveWorkspaces(arr) { this._set(this.WORKSPACES_KEY, arr); },
    getCurrentWorkspaceId() {
        return this.getWorkspaces().find(w => w.current)?.id || 'default';
    },
    addWorkspace(data) {
        const all = this.getWorkspaces().map(w => ({ ...w, current: false }));
        const item = { id: crypto.randomUUID(), name: data.name || 'Novo workspace', color: data.color || '#7C4DFF', current: true, createdAt: new Date().toISOString() };
        all.unshift(item);
        this.saveWorkspaces(all);
        this.logEvent('workspace.created', { id: item.id, name: item.name });
        return item;
    },
    setCurrentWorkspace(id) {
        this.saveWorkspaces(this.getWorkspaces().map(w => ({ ...w, current: w.id === id })));
    },
    assignToWorkspace(type, id, workspaceId) {
        if (type === 'bookmark') return this.updateBookmark(id, { workspaceId });
        return this.updateNote(id, { workspaceId });
    },
    getEvents() {
        return this._get(this.EVENTS_KEY) || [];
    },
    saveEvents(arr) { this._set(this.EVENTS_KEY, arr); },
    logEvent(type, payload = {}, options = {}) {
        const event = { id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString() };
        const all = this.getEvents();
        all.unshift(event);
        this._set(this.EVENTS_KEY, all.slice(0, 600), { sync: options.sync !== false });
        window.Events?.emit?.('storage:event', event);
    },
    recordBookmarkOpen(id) {
        const item = this.getBookmarks().find(b => b.id === id);
        if (!item) return;
        this.updateBookmark(id, {
            openCount: (item.openCount || 0) + 1,
            lastOpenedAt: new Date().toISOString()
        });
        this.logEvent('bookmark.opened', { id, title: item.title }, { sync: false });
    },
    extractTasksFromNote(note) {
        const html = note.content || '';
        const text = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ');
        return text.split(/\n+/).map((line, index) => {
            const match = line.match(/^\s*[-*]?\s*\[( |x|X)\]\s+(.+)$/);
            if (!match) return null;
            return {
                id: `${note.id}:${index}`,
                noteId: note.id,
                noteTitle: note.title,
                lineIndex: index,
                done: match[1].toLowerCase() === 'x',
                text: match[2].trim()
            };
        }).filter(Boolean);
    },
    getNoteTasks() {
        return this.getNotes().flatMap(note => this.extractTasksFromNote(note));
    },

    // --- Personal software layers ---
    getProjects() { return this._get(this.PROJECTS_KEY) || []; },
    saveProjects(arr) { this._set(this.PROJECTS_KEY, arr); },
    addProject(data) {
        const all = this.getProjects();
        const project = {
            id: crypto.randomUUID(),
            name: data.name || 'Novo projeto',
            description: data.description || '',
            status: data.status || 'ativo',
            priority: data.priority || 'media',
            color: data.color || '#7C4DFF',
            items: data.items || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        all.unshift(project);
        this.saveProjects(all);
        this.logEvent('project.created', { id: project.id, name: project.name });
        return project;
    },
    updateProject(id, data) {
        const all = this.getProjects();
        const idx = all.findIndex(p => p.id === id);
        if (idx === -1) return null;
        Object.assign(all[idx], data, { updatedAt: new Date().toISOString() });
        this.saveProjects(all);
        return all[idx];
    },
    deleteProject(id) { this.saveProjects(this.getProjects().filter(p => p.id !== id)); },
    addProjectItem(projectId, type, itemId) {
        const all = this.getProjects();
        const project = all.find(p => p.id === projectId);
        if (!project) return false;
        project.items = project.items || [];
        if (!project.items.some(i => i.type === type && i.id === itemId)) {
            project.items.push({ type, id: itemId, addedAt: new Date().toISOString() });
            project.updatedAt = new Date().toISOString();
            this.saveProjects(all);
        }
        return true;
    },
    removeProjectItem(projectId, type, itemId) {
        const all = this.getProjects();
        const project = all.find(p => p.id === projectId);
        if (!project) return false;
        project.items = (project.items || []).filter(i => !(i.type === type && i.id === itemId));
        project.updatedAt = new Date().toISOString();
        this.saveProjects(all);
        return true;
    },
    getRules() {
        return this._get(this.RULES_KEY) || [
            { id: 'youtube-review', enabled: true, name: 'YouTube para revisão', target: 'bookmark', field: 'url', contains: 'youtube', action: 'folder', value: 'revisao' },
            { id: 'supabase-dev', enabled: true, name: 'Supabase vira Dev', target: 'all', field: 'text', contains: 'supabase', action: 'category', value: 'dev' },
            { id: 'note-tasks-kanban', enabled: false, name: 'Notas com checklist para Kanban', target: 'note', field: 'text', contains: '[ ]', action: 'kanban', value: 'ideias' }
        ];
    },
    saveRules(arr) { this._set(this.RULES_KEY, arr); },
    addRule(rule) {
        const all = this.getRules();
        all.unshift({ id: crypto.randomUUID(), enabled: true, createdAt: new Date().toISOString(), ...rule });
        this.saveRules(all);
    },
    updateRule(id, data) {
        const all = this.getRules();
        const idx = all.findIndex(r => r.id === id);
        if (idx === -1) return null;
        Object.assign(all[idx], data);
        this.saveRules(all);
        return all[idx];
    },
    deleteRule(id) {
        this.saveRules(this.getRules().filter(r => r.id !== id));
    },
    getStudy() {
        return this._get(this.STUDY_KEY) || { queue: [], flashcards: [], goals: { weeklyReads: 5, weeklyNotes: 3 } };
    },
    saveStudy(study) { this._set(this.STUDY_KEY, study); },
    addStudyItem(type, itemId) {
        const study = this.getStudy();
        study.queue = study.queue || [];
        if (!study.queue.some(i => i.type === type && i.id === itemId)) study.queue.unshift({ type, id: itemId, status: 'revisar', dueAt: new Date().toISOString(), createdAt: new Date().toISOString() });
        this.saveStudy(study);
    },
    updateStudyQueue(type, itemId, data) {
        const study = this.getStudy();
        const item = (study.queue || []).find(i => i.type === type && i.id === itemId);
        if (item) Object.assign(item, data);
        this.saveStudy(study);
    },
    addFlashcard(card) {
        const study = this.getStudy();
        study.flashcards = study.flashcards || [];
        study.flashcards.unshift({ id: crypto.randomUUID(), ease: 2, intervalDays: 1, dueAt: new Date().toISOString(), createdAt: new Date().toISOString(), ...card });
        this.saveStudy(study);
    },
    getDocuments() { return this._get(this.DOCUMENTS_KEY) || []; },
    saveDocuments(arr) { this._set(this.DOCUMENTS_KEY, arr); },
    addDocument(doc) {
        const all = this.getDocuments();
        const item = { id: crypto.randomUUID(), title: doc.title || doc.name || 'Documento', type: doc.type || '', size: doc.size || 0, dataUrl: doc.dataUrl || '', noteId: doc.noteId || '', tags: doc.tags || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        all.unshift(item);
        this.saveDocuments(all.slice(0, 200));
        this.logEvent('document.added', { id: item.id, title: item.title });
        return item;
    },
    deleteDocument(id) { this.saveDocuments(this.getDocuments().filter(d => d.id !== id)); },

    getHomeWidgets() {
        return this._get(this.HOME_KEY) || {
            stats: true,
            activity: true,
            recentLinks: true,
            recentNotes: true,
            quickActions: true,
            cockpit: false
        };
    },
    saveHomeWidgets(data) { this._set(this.HOME_KEY, data); },
    getDailyFocus() { return this._get(this.DAILY_FOCUS_KEY) || []; },
    saveDailyFocus(items) { this._set(this.DAILY_FOCUS_KEY, items); },
    addDailyFocus(title) {
        const items = this.getDailyFocus();
        const item = { id: crypto.randomUUID(), title: String(title || 'Nova prioridade').trim(), done: false, createdAt: new Date().toISOString() };
        items.unshift(item);
        this.saveDailyFocus(items.slice(0, 100));
        return item;
    },
    updateDailyFocus(id, data) {
        const items = this.getDailyFocus();
        const item = items.find(entry => entry.id === id);
        if (item) Object.assign(item, data, { updatedAt: new Date().toISOString() });
        this.saveDailyFocus(items);
        return item;
    },
    deleteDailyFocus(id) { this.saveDailyFocus(this.getDailyFocus().filter(item => item.id !== id)); },
    getCustomTemplates() {
        return this._get(this.CUSTOM_TEMPLATES_KEY) || [];
    },
    saveCustomTemplates(arr) { this._set(this.CUSTOM_TEMPLATES_KEY, arr); },
    addCustomTemplate(template) {
        const all = this.getCustomTemplates();
        all.unshift({ id: crypto.randomUUID(), name: template.name || 'Template', content: template.content || '', shortcut: template.shortcut || '', kind: template.kind || 'template', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        this.saveCustomTemplates(all);
    },
    deleteCustomTemplate(id) { this.saveCustomTemplates(this.getCustomTemplates().filter(t => t.id !== id)); },
    getQuickSnippets() {
        const defaults = [
            { id: 'snippet-orcamento', name: 'Orcamento enviado', shortcut: '/orc', kind: 'snippet', readonly: true, content: '<p>Ola {{nome_cliente}}, segue o orcamento para avaliacao. Qualquer duvida fico a disposicao.</p>' },
            { id: 'snippet-diagnostico', name: 'Diagnostico inicial', shortcut: '/diag', kind: 'snippet', readonly: true, content: '<p>Diagnostico inicial: {{titulo}}. Proximo passo: validar sintomas, testar componentes e registrar evidencias antes de executar alteracoes.</p>' },
            { id: 'snippet-retorno', name: 'Retorno ao cliente', shortcut: '/ret', kind: 'snippet', readonly: true, content: '<p>Ola {{nome_cliente}}, passando para atualizar o andamento do atendimento: status atual {{status}}. Assim que concluir a proxima etapa eu te aviso.</p>' }
        ];
        const custom = this.getCustomTemplates().filter(t => t.kind === 'snippet');
        const customShortcuts = new Set(custom.map(t => t.shortcut));
        return [...custom, ...defaults.filter(t => !customShortcuts.has(t.shortcut))];
    },
    addQuickSnippet(data) {
        const shortcut = String(data.shortcut || '').trim();
        if (!/^\/[a-z0-9_-]{2,24}$/i.test(shortcut)) throw new Error('Use um atalho como /orc ou /retorno.');
        if (!String(data.content || '').trim()) throw new Error('Digite o texto do snippet.');
        this.addCustomTemplate({
            name: data.name || shortcut,
            shortcut,
            content: data.content || '',
            kind: 'snippet'
        });
    },
    getChecklists() {
        return this._get(this.CHECKLISTS_KEY) || [
            { id: 'study-default', name: 'Estudo', items: ['Ler material', 'Anotar pontos-chave', 'Criar flashcards', 'Revisar em 3 dias'] },
            { id: 'project-default', name: 'Projeto', items: ['Definir objetivo', 'Separar referencias', 'Criar tarefas', 'Revisar progresso'] }
        ];
    },
    saveChecklists(arr) { this._set(this.CHECKLISTS_KEY, arr); },
    addChecklist(data) {
        const all = this.getChecklists();
        all.unshift({ id: crypto.randomUUID(), name: data.name || 'Checklist', items: data.items || [], createdAt: new Date().toISOString() });
        this.saveChecklists(all);
    },
    deleteChecklist(id) { this.saveChecklists(this.getChecklists().filter(c => c.id !== id)); },
    getBundles() { return this._get(this.BUNDLES_KEY) || []; },
    saveBundles(arr) { this._set(this.BUNDLES_KEY, arr); },
    addBundle(data) {
        const all = this.getBundles();
        const bundle = { id: crypto.randomUUID(), name: data.name || 'Bundle', source: data.source || '', items: data.items || [], createdAt: new Date().toISOString() };
        all.unshift(bundle);
        this.saveBundles(all);
        return bundle;
    },
    deleteBundle(id) { this.saveBundles(this.getBundles().filter(b => b.id !== id)); },
    getDecisions() { return this._get(this.DECISIONS_KEY) || []; },
    saveDecisions(arr) { this._set(this.DECISIONS_KEY, arr); },
    addDecision(data) {
        const all = this.getDecisions();
        all.unshift({ id: crypto.randomUUID(), title: data.title || 'Decisão', text: data.text || '', itemType: data.itemType || '', itemId: data.itemId || '', createdAt: new Date().toISOString() });
        this.saveDecisions(all.slice(0, 300));
    },
    deleteDecision(id) { this.saveDecisions(this.getDecisions().filter(d => d.id !== id)); },
    getAnnotations(bookmarkId = null) {
        const all = this._get(this.ANNOTATIONS_KEY) || [];
        return bookmarkId ? all.filter(a => a.bookmarkId === bookmarkId) : all;
    },
    saveAnnotations(arr) { this._set(this.ANNOTATIONS_KEY, arr); },
    addAnnotation(data) {
        const all = this.getAnnotations();
        all.unshift({ id: crypto.randomUUID(), bookmarkId: data.bookmarkId, text: data.text || '', createdAt: new Date().toISOString() });
        this.saveAnnotations(all);
    },
    deleteAnnotation(id) { this.saveAnnotations(this.getAnnotations().filter(a => a.id !== id)); },
    getLifeAreas() {
        return this._get(this.AREAS_KEY) || [
            { id: 'study', name: 'Estudos', color: '#00BFA5', items: [] },
            { id: 'work', name: 'Trabalho', color: '#FF6D00', items: [] },
            { id: 'personal', name: 'Pessoal', color: '#7C4DFF', items: [] },
            { id: 'ideas', name: 'Ideias', color: '#FFD600', items: [] }
        ];
    },
    saveLifeAreas(arr) { this._set(this.AREAS_KEY, arr); },
    addLifeArea(data) {
        const all = this.getLifeAreas();
        all.unshift({ id: crypto.randomUUID(), name: data.name || 'Área', color: data.color || '#7C4DFF', items: [] });
        this.saveLifeAreas(all);
    },
    assignToArea(areaId, type, itemId) {
        const all = this.getLifeAreas();
        const area = all.find(a => a.id === areaId);
        if (!area) return false;
        area.items = area.items || [];
        if (!area.items.some(i => i.type === type && i.id === itemId)) area.items.push({ type, id: itemId, addedAt: new Date().toISOString() });
        this.saveLifeAreas(all);
        return true;
    },
    getModules() {
        return this._get(this.MODULES_KEY) || { study: true, projects: true, privacy: true, documents: true, automations: true, graph: true };
    },
    saveModules(data) { this._set(this.MODULES_KEY, data); },
    getPersonalData() {
        const modules = this.getModules();
        const personal = { journal: [], habits: [], habitLogs: {}, goals: [], inbox: [], money: [], tracker: [], moneyCategories: [], ...(modules.personalData || {}) };
        if (window.TimeTravelDate) {
            const cutoff = window.TimeTravelDate;
            const filtered = { ...personal };
            
            filtered.journal = (personal.journal || []).filter(item => new Date(item.date || item.createdAt) <= cutoff);
            filtered.habits = (personal.habits || []).filter(item => new Date(item.createdAt || 0) <= cutoff);
            
            filtered.habitLogs = {};
            if (personal.habitLogs) {
                for (const [habitId, logs] of Object.entries(personal.habitLogs)) {
                    filtered.habitLogs[habitId] = {};
                    if (logs) {
                        for (const [dateStr, checked] of Object.entries(logs)) {
                            if (new Date(dateStr + 'T12:00:00') <= cutoff) {
                                filtered.habitLogs[habitId][dateStr] = checked;
                            }
                        }
                    }
                }
            }
            
            filtered.goals = (personal.goals || []).filter(item => new Date(item.createdAt || 0) <= cutoff);
            filtered.inbox = (personal.inbox || []).filter(item => new Date(item.createdAt || 0) <= cutoff);
            filtered.money = (personal.money || []).filter(item => new Date(item.date || item.createdAt) <= cutoff);
            filtered.tracker = (personal.tracker || []).filter(item => new Date(item.createdAt || 0) <= cutoff);
            
            return filtered;
        }
        return personal;
    },
    savePersonalData(data) {
        const modules = this.getModules();
        modules.personalData = { journal: [], habits: [], habitLogs: {}, goals: [], inbox: [], money: [], tracker: [], moneyCategories: [], ...data };
        this.saveModules(modules);
        window.Events?.emit?.('personal:changed', { data: modules.personalData });
    },
    addPersonalItem(collection, data) {
        const personal = this.getPersonalData();
        const now = new Date().toISOString();
        const item = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...data };
        personal[collection] = personal[collection] || [];
        personal[collection].unshift(item);
        this.savePersonalData(personal);
        this.logEvent('personal.created', { collection, id: item.id, title: data.title || data.text || data.name || '' }, { sync: false });
        return item;
    },
    updatePersonalItem(collection, id, data) {
        const personal = this.getPersonalData();
        const list = personal[collection] || [];
        const item = list.find(i => i.id === id);
        if (!item) return null;
        Object.assign(item, data, { updatedAt: new Date().toISOString() });
        this.savePersonalData(personal);
        this.logEvent('personal.updated', { collection, id, fields: Object.keys(data) }, { sync: false });
        return item;
    },
    deletePersonalItem(collection, id) {
        const personal = this.getPersonalData();
        personal[collection] = (personal[collection] || []).filter(i => i.id !== id);
        this.savePersonalData(personal);
    },
    toggleHabitCheck(habitId, date = new Date().toISOString().slice(0, 10)) {
        const personal = this.getPersonalData();
        personal.habitLogs = personal.habitLogs || {};
        personal.habitLogs[habitId] = personal.habitLogs[habitId] || {};
        personal.habitLogs[habitId][date] = !personal.habitLogs[habitId][date];
        this.savePersonalData(personal);
        return personal.habitLogs[habitId][date];
    },
    getProfessionalRecords(moduleKey = '') {
        const modules = this.getModules();
        const legacy = this._get(this.PROFESSIONAL_RECORDS_KEY) || [];
        let records = Array.isArray(modules.professionalRecords) ? modules.professionalRecords : legacy;
        if (window.TimeTravelDate) {
            records = records.filter(r => new Date(r.createdAt || r.updatedAt) <= window.TimeTravelDate);
        }
        return moduleKey ? records.filter(r => r.moduleKey === moduleKey) : records;
    },
    saveProfessionalRecords(records) {
        const modules = this.getModules();
        modules.professionalRecords = records;
        this.saveModules(modules);
        this._set(this.PROFESSIONAL_RECORDS_KEY, records, { sync: false });
        window.Events?.emit?.('professional:changed', { records });
    },
    addProfessionalRecord(data) {
        const records = this.getProfessionalRecords();
        const now = new Date().toISOString();
        const item = {
            id: crypto.randomUUID(),
            moduleKey: data.moduleKey || 'tickets',
            title: data.title || 'Registro',
            content: data.content || '',
            status: data.status || 'aberto',
            clientId: data.clientId || data.client || '',
            equipmentId: data.equipmentId || data.equipment || '',
            fields: data.fields || {},
            attachments: data.attachments || [],
            createdAt: now,
            updatedAt: now
        };
        records.unshift(item);
        this.saveProfessionalRecords(records);
        this.logEvent('professional.created', { id: item.id, moduleKey: item.moduleKey, title: item.title }, { sync: false });
        return item;
    },
    updateProfessionalRecord(id, data) {
        const records = this.getProfessionalRecords();
        const item = records.find(r => r.id === id);
        if (!item) return null;
        Object.assign(item, data, { updatedAt: new Date().toISOString() });
        this.saveProfessionalRecords(records);
        this.logEvent('professional.updated', { id, moduleKey: item.moduleKey, fields: Object.keys(data) }, { sync: false });
        return item;
    },
    deleteProfessionalRecord(id) {
        this.saveProfessionalRecords(this.getProfessionalRecords().filter(r => r.id !== id));
    },
    getSyncHistory() { return this._get(this.SYNC_HISTORY_KEY) || []; },
    addSyncHistory(entry) {
        const all = this.getSyncHistory();
        all.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry });
        this._set(this.SYNC_HISTORY_KEY, all.slice(0, 120), { sync: false });
    },
    getAiSettings() {
        return this._get(this.AI_SETTINGS_KEY) || { provider: 'heuristic', endpoint: '', apiKey: '', model: 'gpt-5-mini' };
    },
    saveAiSettings(data) { this._set(this.AI_SETTINGS_KEY, { ...this.getAiSettings(), ...data }, { sync: false }); },
    getCloudBackupSettings() { return this._get(this.CLOUD_BACKUP_KEY) || { enabled: false, provider: 'download', lastBackupAt: null }; },
    saveCloudBackupSettings(data) { this._set(this.CLOUD_BACKUP_KEY, { ...this.getCloudBackupSettings(), ...data }, { sync: false }); },
    getCanvas() {
        const data = this._get(this.CANVAS_KEY) || {};
        return {
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            edges: Array.isArray(data.edges) ? data.edges : [],
            viewport: data.viewport || { x: 0, y: 0, zoom: 1 }
        };
    },
    saveCanvas(data) {
        this._set(this.CANVAS_KEY, {
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            edges: Array.isArray(data.edges) ? data.edges : [],
            viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
            updatedAt: new Date().toISOString()
        });
    },
    upsertCanvasNode(node) {
        const canvas = this.getCanvas();
        const idx = canvas.nodes.findIndex(n => n.id === node.id);
        const next = { ...node, updatedAt: new Date().toISOString() };
        if (idx >= 0) canvas.nodes[idx] = { ...canvas.nodes[idx], ...next };
        else canvas.nodes.push({ id: crypto.randomUUID(), x: 120, y: 120, w: 220, h: 120, ...next });
        this.saveCanvas(canvas);
        return idx >= 0 ? canvas.nodes[idx] : canvas.nodes[canvas.nodes.length - 1];
    },
    deleteCanvasNode(id) {
        const canvas = this.getCanvas();
        canvas.nodes = canvas.nodes.filter(n => n.id !== id);
        canvas.edges = canvas.edges.filter(e => e.from !== id && e.to !== id);
        this.saveCanvas(canvas);
    },
    addCanvasEdge(from, to) {
        if (!from || !to || from === to) return null;
        const canvas = this.getCanvas();
        if (canvas.edges.some(e => e.from === from && e.to === to)) return null;
        const edge = { id: crypto.randomUUID(), from, to, createdAt: new Date().toISOString() };
        canvas.edges.push(edge);
        this.saveCanvas(canvas);
        return edge;
    },
    deleteCanvasEdge(id) {
        const canvas = this.getCanvas();
        canvas.edges = canvas.edges.filter(e => e.id !== id);
        this.saveCanvas(canvas);
    },
    async createPublicShare(type, id) {
        const settings = this.getSettings();
        if (!settings.sync.enabled || !settings.sync.userId || !settings.sync.accessToken) throw new Error('Entre no Supabase antes de criar link publico.');
        const item = type === 'note'
            ? this.getNotes({ includePrivate: true }).find(n => n.id === id)
            : this.getBookmarks({ includePrivate: true }).find(b => b.id === id);
        if (!item) throw new Error('Item nao encontrado.');
        if (item.isPrivate && !this.isVaultUnlocked()) throw new Error('Desbloqueie o cofre para compartilhar item privado.');
        const shareId = item.publicShareId || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const payload = type === 'note'
            ? { type, title: item.title, content: item.content || '', updatedAt: item.updatedAt || item.createdAt }
            : { type, title: item.title, url: item.url, description: item.description || '', updatedAt: item.updatedAt || item.createdAt };
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        const headers = await this._supabaseAuthHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' });
        const res = await fetch(`${url}/rest/v1/booklist_public_shares?on_conflict=share_id`, {
            method: 'POST',
            headers,
            body: JSON.stringify([{ share_id: shareId, user_id: settings.sync.userId, kind: type, title: item.title || 'Compartilhado', payload, enabled: true, updated_at: new Date().toISOString() }])
        });
        await this._parseSupabaseResponse(res);
        if (type === 'note') this.updateNote(id, { publicShareId: shareId, publicSharedAt: new Date().toISOString() });
        else this.updateBookmark(id, { publicShareId: shareId, publicSharedAt: new Date().toISOString() });
        return { shareId, url: `${location.origin}${location.pathname}?share=${shareId}` };
    },
    async revokePublicShare(type, id) {
        const settings = this.getSettings();
        const item = type === 'note'
            ? this.getNotes({ includePrivate: true }).find(entry => entry.id === id)
            : this.getBookmarks({ includePrivate: true }).find(entry => entry.id === id);
        if (!item?.publicShareId) return false;
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        const headers = await this._supabaseAuthHeaders();
        const res = await fetch(`${url}/rest/v1/booklist_public_shares?share_id=eq.${encodeURIComponent(item.publicShareId)}&user_id=eq.${encodeURIComponent(settings.sync.userId)}`, {
            method: 'PATCH', headers, body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() })
        });
        await this._parseSupabaseResponse(res);
        if (type === 'note') this.updateNote(id, { publicShareId: null, publicSharedAt: null });
        else this.updateBookmark(id, { publicShareId: null, publicSharedAt: null });
        return true;
    },
    async fetchPublicShare(shareId) {
        const settings = this.getSettings();
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        if (!url || !settings.sync.anonKey) throw new Error('Supabase nao configurado neste navegador.');
        const res = await fetch(`${url}/rest/v1/booklist_public_shares?select=share_id,kind,title,payload,updated_at&enabled=eq.true&share_id=eq.${encodeURIComponent(shareId)}&limit=1`, {
            headers: this._supabaseBaseHeaders()
        });
        const rows = await this._parseSupabaseResponse(res);
        return rows[0] || null;
    },
    createNamedSnapshot(name) {
        this.createAutoBackup(name || 'snapshot');
        return this.getAutoBackups()[0];
    },

    // --- Folders ---
    getBkFolders() { return this._get(this.KEYS.BOOKMARK_FOLDERS) || [{ id: 'default', name: 'Geral', icon: '&#128193;' }]; },
    saveBkFolders(arr) { this._set(this.KEYS.BOOKMARK_FOLDERS, arr); },
    getNtFolders() { return this._get(this.KEYS.NOTE_FOLDERS) || [{ id: 'default', name: 'Geral', icon: '&#128193;' }]; },
    saveNtFolders(arr) { this._set(this.KEYS.NOTE_FOLDERS, arr); },

    // --- Categories ---
    getBkCategories() {
        return this._get(this.KEYS.BOOKMARK_CATEGORIES) || [
            { id: 'youtube', name: 'YouTube', color: '#FF0000', icon: '&#127916;' },
            { id: 'news', name: 'Notícias', color: '#1DA1F2', icon: '&#128240;' },
            { id: 'games', name: 'Jogos', color: '#00C853', icon: '&#127918;' },
            { id: 'social', name: 'Redes Sociais', color: '#E040FB', icon: '&#128172;' },
            { id: 'dev', name: 'Desenvolvimento', color: '#FF6D00', icon: '&#128187;' },
            { id: 'other', name: 'Outros', color: '#78909C', icon: '&#128279;' }
        ];
    },
    saveBkCategories(arr) { this._set(this.KEYS.BOOKMARK_CATEGORIES, arr); },
    getNtCategories() {
        return this._get(this.KEYS.NOTE_CATEGORIES) || [
            { id: 'personal', name: 'Pessoal', color: '#7C4DFF', icon: '&#128100;' },
            { id: 'work', name: 'Trabalho', color: '#FF6D00', icon: '&#128188;' },
            { id: 'study', name: 'Estudo', color: '#00BFA5', icon: '&#128218;' },
            { id: 'ideas', name: 'Ideias', color: '#FFD600', icon: '&#128161;' },
            { id: 'other', name: 'Outros', color: '#78909C', icon: '&#128221;' }
        ];
    },
    saveNtCategories(arr) { this._set(this.KEYS.NOTE_CATEGORIES, arr); },

    // --- Settings ---
    getSettings() {
        const settings = this._normalizeSettings(this._get(this.KEYS.SETTINGS) || {});
        if (this._vaultUnlocked && this._decryptedKeys) {
            Object.assign(settings, this._decryptedKeys);
        }
        return settings;
    },
    saveSettings(s) {
        const current = this.getSettings();
        const settingsToSave = { ...current, ...s };
        
        // If vault is enabled and unlocked, we securely encrypt the AI keys inside the vault!
        if (this._vaultUnlocked && this._vaultKey) {
            const keysToSecure = {};
            let hasKeysToSecure = false;
            
            if (settingsToSave.geminiApiKey !== undefined) {
                keysToSecure.geminiApiKey = settingsToSave.geminiApiKey;
                settingsToSave.geminiApiKey = ''; // Strip from plain settings on disk
                hasKeysToSecure = true;
            }
            if (settingsToSave.openaiApiKey !== undefined) {
                keysToSecure.openaiApiKey = settingsToSave.openaiApiKey;
                settingsToSave.openaiApiKey = ''; // Strip from plain settings on disk
                hasKeysToSecure = true;
            }
            if (settingsToSave.ragModel !== undefined) {
                keysToSecure.ragModel = settingsToSave.ragModel;
                settingsToSave.ragModel = ''; // Strip from plain settings on disk
                hasKeysToSecure = true;
            }
            
            if (hasKeysToSecure) {
                // Update in-memory cache immediately
                this._decryptedKeys = { ...(this._decryptedKeys || {}), ...keysToSecure };
                
                // Asynchronously encrypt and save to the vault config
                this._encryptText(JSON.stringify(this._decryptedKeys), this._vaultKey).then(encrypted => {
                    const vault = this.getVaultSettings();
                    vault.encryptedAiKeys = encrypted;
                    this.saveVaultSettings(vault);
                }).catch(err => console.error("Erro ao salvar chaves criptografadas no cofre:", err));
            }
        }
        
        const normalized = this._normalizeSettings(settingsToSave);
        this._set(this.KEYS.SETTINGS, normalized, { sync: false });
        this._set(this.PREFERENCES_KEY, this._publicPreferences(normalized));
    },
    _publicPreferences(settings = this.getSettings()) {
        return { theme: settings.theme, accent: settings.accent, language: settings.language, onboardingDone: settings.onboardingDone, pureMarkdownDefault: settings.pureMarkdownDefault, aiNeuralSearch: settings.aiNeuralSearch, workspaceMode: settings.workspaceMode, interfaceSounds: settings.interfaceSounds, updatedAt: new Date().toISOString() };
    },
    saveSyncConfig(data) {
        const settings = this.getSettings();
        const next = {
            ...settings,
            sync: {
                ...settings.sync,
                ...data,
                supabaseUrl: data.supabaseUrl !== undefined ? this._normalizeSupabaseUrl(data.supabaseUrl) : settings.sync.supabaseUrl
            }
        };
        this._set(this.KEYS.SETTINGS, this._normalizeSettings(next), { sync: false });
        const shouldSchedule = ['enabled', 'supabaseUrl', 'anonKey', 'email', 'userId', 'accessToken', 'refreshToken', 'expiresAt']
            .some(key => Object.prototype.hasOwnProperty.call(data, key) && data[key] !== settings.sync[key]);
        if (next.sync.enabled && shouldSchedule) this.scheduleSync(800);
    },

    // Importação e exportação são fornecidas por modules/storage-portability.js.
    _isValidImport(data) {
        if (!data || typeof data !== 'object') return false;
        return Object.keys(this.KEYS).some(name => data[name] !== undefined || data[this.KEYS[name]] !== undefined);
    },
    _settingsForExport(settings) {
        const safe = this._normalizeSettings(settings || {});
        safe.sync = {
            enabled: false,
            supabaseUrl: safe.sync.supabaseUrl,
            anonKey: '',
            email: safe.sync.email,
            userId: '',
            accessToken: '',
            refreshToken: '',
            expiresAt: 0,
            lastSyncAt: safe.sync.lastSyncAt
        };
        return safe;
    },

    // Check if IndexedDB/localStorage has user data
    hasData() {
        return this.SYNCABLE_KEYS.some(key => {
            const value = this._get(key);
            if (key === this.CANVAS_KEY) return Boolean(value?.nodes?.length || value?.edges?.length);
            return Array.isArray(value) ? value.length > 0 : Boolean(value);
        });
    },

    async clearAll() {
        const keys = [...Object.values(this.KEYS), this.MIGRATIONS_KEY, this.META_KEY, this.AUTO_BACKUPS_KEY, this.TRASH_KEY, this.RELATIONS_KEY, this.ATTACHMENTS_KEY, this.MEDIA_KEY, this.PREFERENCES_KEY, this.VAULT_KEY, this.COLLECTIONS_KEY, this.WORKSPACES_KEY, this.EVENTS_KEY, this.PROJECTS_KEY, this.RULES_KEY, this.STUDY_KEY, this.DOCUMENTS_KEY, this.HOME_KEY, this.DAILY_FOCUS_KEY, this.CUSTOM_TEMPLATES_KEY, this.CHECKLISTS_KEY, this.BUNDLES_KEY, this.DECISIONS_KEY, this.ANNOTATIONS_KEY, this.AREAS_KEY, this.MODULES_KEY, this.CANVAS_KEY, this.PROFESSIONAL_RECORDS_KEY, this.SYNC_HISTORY_KEY, this.AI_SETTINGS_KEY, this.CLOUD_BACKUP_KEY];
        await Promise.all(keys.map(key => this._deleteRecord(key)));
        this._cache = {};
    },

    // --- Trash / undo ---
    getTrash() {
        return this._get(this.TRASH_KEY) || [];
    },
    trashItem(type, item) {
        const trash = this.getTrash();
        const entry = {
            id: crypto.randomUUID(),
            type,
            item: this._clone(item),
            deletedAt: new Date().toISOString()
        };
        trash.unshift(entry);
        this._set(this.TRASH_KEY, trash.slice(0, 80), { sync: false });
        return entry;
    },
    restoreTrashItem(trashId) {
        const trash = this.getTrash();
        const entry = trash.find(t => t.id === trashId);
        if (!entry) return false;
        if (entry.type === 'bookmark') {
            const items = this.getBookmarks();
            if (!items.some(i => i.id === entry.item.id)) {
                items.unshift({ ...entry.item, updatedAt: new Date().toISOString() });
                this.saveBookmarks(items);
            }
        }
        if (entry.type === 'note') {
            const items = this.getNotes();
            if (!items.some(i => i.id === entry.item.id)) {
                items.unshift({ ...entry.item, updatedAt: new Date().toISOString() });
                this.saveNotes(items);
            }
        }
        this._set(this.TRASH_KEY, trash.filter(t => t.id !== trashId), { sync: false });
        return true;
    },
    emptyTrash() {
        this._set(this.TRASH_KEY, [], { sync: false });
    },

    // --- Automatic local backups ---
    getAutoBackups() {
        return this._get(this.AUTO_BACKUPS_KEY) || [];
    },
    _scheduleAutoBackup() {
        clearTimeout(this._backupTimer);
        this._backupTimer = setTimeout(() => this.createAutoBackup('auto'), 2000);
    },
    createAutoBackup(reason = 'manual') {
        const backups = this.getAutoBackups();
        const snapshot = {};
        for (const [name, key] of Object.entries(this.KEYS)) {
            if (key === this.KEYS.SETTINGS) continue;
            snapshot[name] = this._sanitizeForStorage(this._get(key));
        }
        snapshot.COLLECTIONS = this.getCollections();
        snapshot.WORKSPACES = this.getWorkspaces();
        snapshot.PROJECTS = this.getProjects();
        snapshot.RULES = this.getRules();
        snapshot.STUDY = this.getStudy();
        snapshot.DOCUMENTS = this.getDocuments();
        snapshot.ATTACHMENTS = this.getAttachments();
        snapshot.MEDIA = this._get(this.MEDIA_KEY) || {};
        snapshot.PREFERENCES = this._get(this.PREFERENCES_KEY) || {};
        snapshot.HOME_WIDGETS = this.getHomeWidgets();
        snapshot.DAILY_FOCUS = this.getDailyFocus();
        snapshot.CUSTOM_TEMPLATES = this.getCustomTemplates();
        snapshot.CHECKLISTS = this.getChecklists();
        snapshot.BUNDLES = this.getBundles();
        snapshot.DECISIONS = this.getDecisions();
        snapshot.ANNOTATIONS = this.getAnnotations();
        snapshot.LIFE_AREAS = this.getLifeAreas();
        snapshot.MODULES = this.getModules();
        snapshot.CANVAS = this.getCanvas();
        snapshot.PROFESSIONAL_RECORDS = this.getProfessionalRecords();
        backups.unshift({
            id: crypto.randomUUID(),
            reason,
            createdAt: new Date().toISOString(),
            counts: {
                bookmarks: this.getBookmarks().length,
                notes: this.getNotes().length
            },
            data: snapshot
        });
        this._set(this.AUTO_BACKUPS_KEY, backups.slice(0, 10), { sync: false });
    },
    exportAutoBackup(id) {
        const backup = this.getAutoBackups().find(b => b.id === id);
        if (!backup) return false;
        const blob = new Blob([JSON.stringify({ ...backup.data, _backupDate: backup.createdAt, _version: '3.0-auto-backup' }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `booklist_auto_backup_${backup.createdAt.slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    },

    // --- Supabase local-first sync ---
    _getMeta() {
        const meta = this._get(this.META_KEY) || {};
        return {
            ...this.DEFAULT_SYNC_META,
            ...meta,
            dirtyKeys: Array.isArray(meta.dirtyKeys) ? meta.dirtyKeys : [],
            localUpdatedAt: meta.localUpdatedAt || {},
            remoteUpdatedAt: meta.remoteUpdatedAt || {}
        };
    },
    _setMeta(meta) {
        const next = { ...this.DEFAULT_SYNC_META, ...meta };
        this._cache[this.META_KEY] = this._clone(next);
        this._putRecord(this.META_KEY, next).catch(err => console.error('Erro ao salvar metadados de sync:', err));
    },
    _markDirty(key, schedule = true) {
        if (!this._isSyncableKey(key)) return;
        const meta = this._getMeta();
        if (!meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
        meta.localUpdatedAt[key] = new Date().toISOString();
        meta.status = 'pending';
        meta.message = 'Alterações locais aguardando sincronização.';
        this._setMeta(meta);
        if (schedule) this.scheduleSync(1200);
    },
    getSyncStatus() {
        const settings = this.getSettings();
        const meta = this._getMeta();
        const online = typeof navigator === 'undefined' ? true : navigator.onLine;
        return {
            enabled: settings.sync.enabled,
            configured: Boolean(settings.sync.supabaseUrl && settings.sync.anonKey),
            authenticated: Boolean(settings.sync.accessToken && settings.sync.userId),
            email: settings.sync.email,
            online,
            dirtyCount: meta.dirtyKeys.length,
            lastSyncAt: meta.lastSyncAt || settings.sync.lastSyncAt,
            status: !settings.sync.enabled ? 'off' : meta.status,
            message: !settings.sync.enabled ? 'Sync desativado.' : meta.message
        };
    },
    forceLocalSync() {
        this._markExistingSyncDataDirty(true);
        const meta = this._getMeta();
        return meta.dirtyKeys.length;
    },
    scheduleSync(delay = 1500) {
        clearTimeout(this._syncTimer);
        const settings = this.getSettings();
        if (!settings.sync.enabled || !settings.sync.supabaseUrl || !settings.sync.anonKey) return;
        if (this._syncInFlight) return;
        this._syncTimer = setTimeout(() => this.syncNow().catch(err => console.warn('Sync falhou:', err)), delay);
    },
    async signInSupabase(email, password) {
        const settings = this.getSettings();
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        if (!url || !settings.sync.anonKey) throw new Error('Configure a URL e a anon key do Supabase primeiro.');
        const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: this._supabaseBaseHeaders(),
            body: JSON.stringify({ email, password })
        });
        const data = await this._parseSupabaseResponse(res);
        this._saveSession(data, email);
        this.scheduleSync(300);
        return data.user;
    },
    async signUpSupabase(email, password) {
        const settings = this.getSettings();
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        if (!url || !settings.sync.anonKey) throw new Error('Configure a URL e a anon key do Supabase primeiro.');
        const res = await fetch(`${url}/auth/v1/signup`, {
            method: 'POST',
            headers: this._supabaseBaseHeaders(),
            body: JSON.stringify({ email, password })
        });
        const data = await this._parseSupabaseResponse(res);
        if (data.access_token) this._saveSession(data, email);
        else this.saveSyncConfig({ enabled: true, email });
        return data;
    },
    disconnectSupabase() {
        this.saveSyncConfig({
            enabled: this.DEFAULT_SUPABASE.fixed,
            userId: '',
            accessToken: '',
            refreshToken: '',
            expiresAt: 0
        });
        const meta = this._getMeta();
        meta.status = this.DEFAULT_SUPABASE.fixed ? 'pending' : 'off';
        meta.message = this.DEFAULT_SUPABASE.fixed ? 'Sessão encerrada. Entre novamente para sincronizar.' : 'Sync desativado.';
        this._setMeta(meta);
    },
    _saveSession(data, email) {
        const previous = this.getSettings();
        const userId = this._sessionUserId(data);
        if (!userId) throw new Error('Login recebido, mas não foi possível identificar o usuário do Supabase.');
        this.saveSyncConfig({
            enabled: true,
            email,
            userId,
            accessToken: data.access_token || '',
            refreshToken: data.refresh_token || '',
            expiresAt: Date.now() + ((data.expires_in || 3600) * 1000) - 30000
        });
        const wasSameSession = previous.sync.enabled && previous.sync.userId === userId;
        if (!wasSameSession) this._markExistingSyncDataDirty(false);
    },
    _sessionUserId(data = {}) {
        return data.user?.id || data.user_id || this._jwtSubject(data.access_token) || '';
    },
    _jwtSubject(token) {
        if (!token || typeof atob !== 'function') return '';
        try {
            const payload = token.split('.')[1];
            if (!payload) return '';
            const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
            return JSON.parse(atob(padded)).sub || '';
        } catch {
            return '';
        }
    },
    _supabaseBaseHeaders(extra = {}) {
        const settings = this.getSettings();
        return {
            apikey: settings.sync.anonKey,
            'Content-Type': 'application/json',
            ...extra
        };
    },
    async _supabaseAuthHeaders(extra = {}) {
        await this._refreshSessionIfNeeded();
        const settings = this.getSettings();
        if (!settings.sync.accessToken) throw new Error('Faça login no Supabase antes de sincronizar.');
        return this._supabaseBaseHeaders({
            Authorization: `Bearer ${settings.sync.accessToken}`,
            ...extra
        });
    },
    async _refreshSessionIfNeeded() {
        const settings = this.getSettings();
        if (!settings.sync.refreshToken || Date.now() < settings.sync.expiresAt) return;
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: this._supabaseBaseHeaders(),
            body: JSON.stringify({ refresh_token: settings.sync.refreshToken })
        });
        const data = await this._parseSupabaseResponse(res);
        this._saveSession(data, settings.sync.email);
    },
    async _parseSupabaseResponse(res) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        const rawMessage = data.msg || data.message || data.error_description || `Supabase respondeu ${res.status}.`;
        if (!res.ok && /booklist_sync_documents_doc_key_check|doc_key_check/i.test(rawMessage)) {
            throw new Error('Schema do Supabase desatualizado: aplique a migration 20260802204805_fix_booklist_sync_security_20260802.sql para liberar todas as chaves de sincronização.');
        }
        if (!res.ok) throw new Error(rawMessage);
        return data;
    },
    async syncNow() {
        if (this._syncInFlight) return { ok: false, message: 'Sincronização já em andamento.' };
        const settings = this.getSettings();
        if (!settings.sync.enabled) return { ok: false, message: 'Sync desativado.' };
        if (!settings.sync.supabaseUrl || !settings.sync.anonKey) throw new Error('Configure a URL e a anon key do Supabase.');
        if (!settings.sync.accessToken || !settings.sync.userId) throw new Error('Faça login no Supabase para sincronizar.');
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const meta = this._getMeta();
            meta.status = 'offline';
            meta.message = 'Offline. Alterações serão sincronizadas quando a internet voltar.';
            this._setMeta(meta);
            return { ok: false, message: meta.message };
        }

        const meta = this._getMeta();
        meta.status = 'syncing';
        meta.message = 'Sincronizando com Supabase...';
        this._setMeta(meta);

        this._syncInFlight = true;
        try {
            const pulled = await this._pullRemoteDocuments();
            const pushed = await this._pushDirtyDocuments();
            const done = this._getMeta();
            done.status = 'synced';
            done.lastSyncAt = new Date().toISOString();
            done.message = pushed || pulled ? `Sync concluído (${pulled} recebidos, ${pushed} enviados).` : 'Tudo sincronizado.';
            this._setMeta(done);
            this.addSyncHistory({ status: 'success', pulled, pushed, message: done.message });
            const latestSettings = this.getSettings();
            this._set(this.KEYS.SETTINGS, this._normalizeSettings({
                ...latestSettings,
                sync: { ...latestSettings.sync, lastSyncAt: done.lastSyncAt }
            }), { sync: false });
            window.dispatchEvent(new CustomEvent('booklist:sync-complete', { detail: { pulled, pushed } }));
            return { ok: true, pulled, pushed };
        } catch (err) {
            const failed = this._getMeta();
            failed.status = 'error';
            failed.message = err.message || 'Erro ao sincronizar.';
            this._setMeta(failed);
            this.addSyncHistory({ status: 'error', pulled: 0, pushed: 0, message: failed.message });
            throw err;
        } finally {
            this._syncInFlight = false;
        }
    },
    async _pullRemoteDocuments() {
        const settings = this.getSettings();
        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        const headers = await this._supabaseAuthHeaders();
        const res = await fetch(`${url}/rest/v1/booklist_sync_documents?select=doc_key,payload,updated_at`, { headers });
        const rows = await this._parseSupabaseResponse(res);
        const meta = this._getMeta();
        let applied = 0;

        let notes = this._get(this.KEYS.NOTES) || [];
        let bookmarks = this._get(this.KEYS.BOOKMARKS) || [];
        let notesChanged = false;
        let bookmarksChanged = false;

        for (const row of rows) {
            const key = row.doc_key;
            if (key === this.KEYS.NOTES || key === this.KEYS.BOOKMARKS) continue;
            if (!this._isSyncableKey(key)) continue;

            const remoteAt = Date.parse(row.updated_at || 0);
            const knownRemoteAt = Date.parse(meta.remoteUpdatedAt[key] || 0);
            const localDirty = meta.dirtyKeys.includes(key) || meta.dirtyKeys.includes('tombstone:' + key);
            
            const isRemoteDeleted = row.payload && row.payload._deleted === true;

            if (remoteAt > knownRemoteAt) {
                if (isRemoteDeleted) {
                    if (key.startsWith('note:')) {
                        const id = key.substring(5);
                        if (notes.some(n => n.id === id)) {
                            notes = notes.filter(n => n.id !== id);
                            notesChanged = true;
                        }
                    } else if (key.startsWith('bookmark:')) {
                        const id = key.substring(9);
                        if (bookmarks.some(b => b.id === id)) {
                            bookmarks = bookmarks.filter(b => b.id !== id);
                            bookmarksChanged = true;
                        }
                    }
                    meta.remoteUpdatedAt[key] = row.updated_at;
                    meta.localUpdatedAt[key] = row.updated_at;
                    meta.dirtyKeys = meta.dirtyKeys.filter(k => k !== key && k !== 'tombstone:' + key);
                    applied++;
                } else {
                    if (key.startsWith('note:')) {
                        const id = key.substring(5);
                        const existingIdx = notes.findIndex(n => n.id === id);
                        if (existingIdx !== -1) {
                            if (localDirty) {
                                notes[existingIdx] = this._mergeNotes(notes[existingIdx], row.payload);
                            } else {
                                notes[existingIdx] = row.payload;
                            }
                        } else {
                            notes.push(row.payload);
                        }
                        notesChanged = true;
                    } else if (key.startsWith('bookmark:')) {
                        const id = key.substring(9);
                        const existingIdx = bookmarks.findIndex(b => b.id === id);
                        if (existingIdx !== -1) {
                            if (localDirty) {
                                bookmarks[existingIdx] = this._mergeBookmarks(bookmarks[existingIdx], row.payload);
                            } else {
                                bookmarks[existingIdx] = row.payload;
                            }
                        } else {
                            bookmarks.push(row.payload);
                        }
                        bookmarksChanged = true;
                    } else {
                        const firstRemoteSeen = !meta.remoteUpdatedAt[key];
                        const merged = firstRemoteSeen ? this._mergeSyncPayload(key, this._getSyncPayload(key), row.payload) : null;
                        if (merged) {
                            this._set(key, merged, { sync: false });
                            if (key === this.PREFERENCES_KEY) {
                                const current = this.getSettings();
                                this._set(this.KEYS.SETTINGS, this._normalizeSettings({ ...current, ...merged, sync: current.sync }), { sync: false });
                            }
                            meta.remoteUpdatedAt[key] = row.updated_at;
                            meta.localUpdatedAt[key] = new Date().toISOString();
                            if (!meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
                            meta.message = 'Dados locais e remotos mesclados. O bloco combinado sera reenviado ao Supabase.';
                            applied++;
                        } else {
                            this._set(key, row.payload, { sync: false });
                            if (key === this.PREFERENCES_KEY) {
                                const current = this.getSettings();
                                this._set(this.KEYS.SETTINGS, this._normalizeSettings({ ...current, ...row.payload, sync: current.sync }), { sync: false });
                            }
                            meta.remoteUpdatedAt[key] = row.updated_at;
                            applied++;
                        }
                    }

                    if (key.startsWith('note:') || key.startsWith('bookmark:')) {
                        meta.remoteUpdatedAt[key] = row.updated_at;
                        meta.localUpdatedAt[key] = row.updated_at;
                        meta.dirtyKeys = meta.dirtyKeys.filter(k => k !== key);
                        applied++;
                    }
                }
            }
        }

        if (notesChanged) {
            this._set(this.KEYS.NOTES, notes, { sync: false });
        }
        if (bookmarksChanged) {
            this._set(this.KEYS.BOOKMARKS, bookmarks, { sync: false });
        }

        this._setMeta(meta);
        return applied;
    },
    async _pushDirtyDocuments() {
        const settings = this.getSettings();
        const meta = this._getMeta();
        const dirty = meta.dirtyKeys.filter(key => this._isSyncableKey(key));
        if (!dirty.length) return 0;

        const url = this._normalizeSupabaseUrl(settings.sync.supabaseUrl);
        const headers = await this._supabaseAuthHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' });
        const sentAt = {};
        const docs = [];

        for (const key of dirty) {
            const payload = this._getSyncPayload(key);
            const updatedAt = meta.localUpdatedAt[key] || new Date().toISOString();
            sentAt[key] = updatedAt;

            if (payload === null || payload === undefined) {
                // Skip sending null payload, but keep in sentAt to clear from dirtyKeys
                continue;
            }

            let docKey = key;
            if (key.startsWith('tombstone:')) {
                docKey = key.substring(10);
            }
            docs.push({
                user_id: settings.sync.userId,
                doc_key: docKey,
                payload: payload,
                updated_at: updatedAt
            });
        }

        if (docs.length > 0) {
            const res = await fetch(`${url}/rest/v1/booklist_sync_documents?on_conflict=user_id,doc_key`, {
                method: 'POST',
                headers,
                body: JSON.stringify(docs)
            });
            await this._parseSupabaseResponse(res);
        }

        const nextMeta = this._getMeta();
        nextMeta.dirtyKeys = nextMeta.dirtyKeys.filter(key => {
            if (!sentAt.hasOwnProperty(key)) return true;
            const payload = this._getSyncPayload(key);
            if (payload === null || payload === undefined) return false; // Remove deleted/missing local keys from dirty queue
            return nextMeta.localUpdatedAt[key] !== sentAt[key];
        });

        for (const key of dirty) {
            if (sentAt[key]) {
                nextMeta.remoteUpdatedAt[key] = sentAt[key];
                if (key.startsWith('tombstone:')) {
                    this._deleteRecord(key).catch(err => console.error('Erro ao deletar tombstone local:', err));
                }
            }
        }
        this._setMeta(nextMeta);
        return docs.length;
    },
    _getSyncPayload(key) {
        if (key.startsWith('note:')) {
            const id = key.substring(5);
            const notes = this._get(this.KEYS.NOTES) || [];
            return notes.find(n => n.id === id) || null;
        }
        if (key.startsWith('bookmark:')) {
            const id = key.substring(9);
            const bookmarks = this._get(this.KEYS.BOOKMARKS) || [];
            return bookmarks.find(b => b.id === id) || null;
        }
        if (key.startsWith('tombstone:')) {
            return { _deleted: true, updatedAt: new Date().toISOString() };
        }
        switch (key) {
            case this.KEYS.BOOKMARKS: return this._sanitizeForStorage(this._get(this.KEYS.BOOKMARKS) || []);
            case this.KEYS.BOOKMARK_FOLDERS: return this.getBkFolders();
            case this.KEYS.BOOKMARK_CATEGORIES: return this.getBkCategories();
            case this.KEYS.NOTES: return this._sanitizeForStorage(this._get(this.KEYS.NOTES) || []);
            case this.KEYS.NOTE_FOLDERS: return this.getNtFolders();
            case this.KEYS.NOTE_CATEGORIES: return this.getNtCategories();
            case this.RELATIONS_KEY: return this.getRelations();
            case this.ATTACHMENTS_KEY: return this.getAttachments();
            case this.MEDIA_KEY: return this._get(this.MEDIA_KEY) || {};
            case this.PREFERENCES_KEY: return this._get(this.PREFERENCES_KEY) || this._publicPreferences();
            case this.COLLECTIONS_KEY: return this.getCollections();
            case this.WORKSPACES_KEY: return this.getWorkspaces();
            case this.EVENTS_KEY: return this.getEvents();
            case this.PROJECTS_KEY: return this.getProjects();
            case this.RULES_KEY: return this.getRules();
            case this.STUDY_KEY: return this.getStudy();
            case this.DOCUMENTS_KEY: return this.getDocuments();
            case this.HOME_KEY: return this.getHomeWidgets();
            case this.DAILY_FOCUS_KEY: return this.getDailyFocus();
            case this.CUSTOM_TEMPLATES_KEY: return this.getCustomTemplates();
            case this.CHECKLISTS_KEY: return this.getChecklists();
            case this.BUNDLES_KEY: return this.getBundles();
            case this.DECISIONS_KEY: return this.getDecisions();
            case this.ANNOTATIONS_KEY: return this.getAnnotations();
            case this.AREAS_KEY: return this.getLifeAreas();
            case this.MODULES_KEY: return this.getModules();
            case this.CANVAS_KEY: return this.getCanvas();
            default: return this._get(key);
        }
    },
    _markExistingSyncDataDirty(schedule = true) {
        const meta = this._getMeta();
        const now = new Date().toISOString();
        
        this.SYNCABLE_KEYS.forEach(key => {
            if (key === this.KEYS.NOTES || key === this.KEYS.BOOKMARKS) return;
            const payload = this._getSyncPayload(key);
            if (!this._hasSyncContent(payload)) return;
            if (!meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
            meta.localUpdatedAt[key] = meta.localUpdatedAt[key] || now;
        });

        const notes = this._get(this.KEYS.NOTES) || [];
        notes.forEach(note => {
            const key = 'note:' + note.id;
            if (!meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
            meta.localUpdatedAt[key] = meta.localUpdatedAt[key] || now;
        });

        const bookmarks = this._get(this.KEYS.BOOKMARKS) || [];
        bookmarks.forEach(bk => {
            const key = 'bookmark:' + bk.id;
            if (!meta.dirtyKeys.includes(key)) meta.dirtyKeys.push(key);
            meta.localUpdatedAt[key] = meta.localUpdatedAt[key] || now;
        });

        if (!meta.dirtyKeys.length) return;
        meta.status = 'pending';
        meta.message = 'Dados locais aguardando sincronizacao inicial.';
        this._setMeta(meta);
        if (schedule) this.scheduleSync(800);
    },
    _mergeNotes(local, remote) {
        if (!local) return remote;
        if (!remote) return local;
        const localAt = Date.parse(local.updatedAt || local.createdAt || 0);
        const remoteAt = Date.parse(remote.updatedAt || remote.createdAt || 0);
        return remoteAt >= localAt ? { ...local, ...remote } : { ...remote, ...local };
    },
    _mergeBookmarks(local, remote) {
        if (!local) return remote;
        if (!remote) return local;
        const localAt = Date.parse(local.updatedAt || local.createdAt || 0);
        const remoteAt = Date.parse(remote.updatedAt || remote.createdAt || 0);
        return remoteAt >= localAt ? { ...local, ...remote } : { ...remote, ...local };
    },
    _hasSyncContent(payload) {
        if (Array.isArray(payload)) return payload.length > 0;
        if (!payload || typeof payload !== 'object') return payload !== null && payload !== undefined && payload !== '';
        if (Array.isArray(payload.nodes) || Array.isArray(payload.edges)) {
            return Boolean(payload.nodes?.length || payload.edges?.length);
        }
        return Object.values(payload).some(value => {
            if (Array.isArray(value)) return value.length > 0;
            if (value && typeof value === 'object') return Object.keys(value).length > 0;
            return Boolean(value);
        });
    },
    _mergeSyncPayload(key, localPayload, remotePayload) {
        if (!remotePayload) return null;
        const arrayKeys = new Set([
            this.KEYS.BOOKMARKS,
            this.KEYS.BOOKMARK_FOLDERS,
            this.KEYS.BOOKMARK_CATEGORIES,
            this.KEYS.NOTES,
            this.KEYS.NOTE_FOLDERS,
            this.KEYS.NOTE_CATEGORIES,
            this.RELATIONS_KEY,
            this.ATTACHMENTS_KEY,
            this.COLLECTIONS_KEY,
            this.WORKSPACES_KEY,
            this.EVENTS_KEY,
            this.PROJECTS_KEY,
            this.RULES_KEY,
            this.DOCUMENTS_KEY,
            this.CUSTOM_TEMPLATES_KEY,
            this.CHECKLISTS_KEY,
            this.BUNDLES_KEY,
            this.DECISIONS_KEY,
            this.ANNOTATIONS_KEY,
            this.AREAS_KEY
        ]);
        if (arrayKeys.has(key) && Array.isArray(localPayload) && Array.isArray(remotePayload)) return this._mergeById(localPayload, remotePayload);
        if (key === this.STUDY_KEY) {
            return {
                ...(remotePayload || {}),
                ...(localPayload || {}),
                queue: this._mergeById(localPayload?.queue || [], remotePayload?.queue || []),
                flashcards: this._mergeById(localPayload?.flashcards || [], remotePayload?.flashcards || []),
                goals: { ...(remotePayload?.goals || {}), ...(localPayload?.goals || {}) }
            };
        }
        if (key === this.MODULES_KEY) return this._mergeModulesPayload(localPayload || {}, remotePayload || {});
        if (key === this.MEDIA_KEY) return { ...(remotePayload || {}), ...(localPayload || {}) };
        if (key === this.PREFERENCES_KEY) return Date.parse(localPayload?.updatedAt || 0) >= Date.parse(remotePayload?.updatedAt || 0) ? localPayload : remotePayload;
        return null;
    },
    _mergeById(localItems = [], remoteItems = []) {
        const map = new Map();
        const put = (item = {}) => {
            const id = item.id || item.share_id || item.name || JSON.stringify(item);
            const existing = map.get(id);
            if (!existing) {
                map.set(id, item);
                return;
            }
            const existingAt = Date.parse(existing.updatedAt || existing.createdAt || existing.addedAt || 0);
            const itemAt = Date.parse(item.updatedAt || item.createdAt || item.addedAt || 0);
            map.set(id, itemAt >= existingAt ? { ...existing, ...item } : { ...item, ...existing });
        };
        remoteItems.forEach(put);
        localItems.forEach(put);
        return Array.from(map.values());
    },
    _mergeModulesPayload(local = {}, remote = {}) {
        const merged = { ...remote, ...local };
        const personalCollections = ['journal','habits','goals','inbox','money','tracker'];
        const remotePersonal = remote.personalData || {};
        const localPersonal = local.personalData || {};
        const personalData = { ...remotePersonal, ...localPersonal };
        personalCollections.forEach(collection => {
            personalData[collection] = this._mergeById(localPersonal[collection] || [], remotePersonal[collection] || []);
        });
        personalData.habitLogs = this._mergeHabitLogs(localPersonal.habitLogs || {}, remotePersonal.habitLogs || {});
        merged.personalData = personalData;
        merged.professionalRecords = this._mergeById(local.professionalRecords || [], remote.professionalRecords || []);
        return merged;
    },
    _mergeHabitLogs(local = {}, remote = {}) {
        const merged = { ...remote };
        Object.entries(local).forEach(([habitId, dates]) => {
            merged[habitId] = { ...(merged[habitId] || {}), ...(dates || {}) };
        });
        return merged;
    }
};
