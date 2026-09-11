/* Storage portability boundary: testable payload creation/import separated from download UI. */
const StoragePortability = {
    createPayload() {
        const data = {};
        for (const [name, key] of Object.entries(Storage.KEYS)) {
            const value = Storage._get(key);
            data[name] = key === Storage.KEYS.SETTINGS ? Storage._settingsForExport(value) : Storage._sanitizeForStorage(value);
        }
        Object.assign(data, {
            COLLECTIONS: Storage.getCollections(), WORKSPACES: Storage.getWorkspaces(), EVENTS: Storage.getEvents(), PROJECTS: Storage.getProjects(), RULES: Storage.getRules(), STUDY: Storage.getStudy(), DOCUMENTS: Storage.getDocuments(), ATTACHMENTS: Storage.getAttachments(), MEDIA: Storage._get(Storage.MEDIA_KEY) || {}, PREFERENCES: Storage._get(Storage.PREFERENCES_KEY) || {}, HOME_WIDGETS: Storage.getHomeWidgets(), DAILY_FOCUS: Storage.getDailyFocus(), CUSTOM_TEMPLATES: Storage.getCustomTemplates(), CHECKLISTS: Storage.getChecklists(), BUNDLES: Storage.getBundles(), DECISIONS: Storage.getDecisions(), ANNOTATIONS: Storage.getAnnotations(), LIFE_AREAS: Storage.getLifeAreas(), MODULES: Storage.getModules(), CANVAS: Storage.getCanvas(), PROFESSIONAL_RECORDS: Storage.getProfessionalRecords(), TRASH: Storage.getTrash(), VAULT: Storage.getVaultSettings(), _exportDate: new Date().toISOString(), _version: '6.0-supabase-complete'
        });
        return Storage._sanitizeForStorage(data);
    },

    importPayload(data) {
        if (!Storage._isValidImport(data)) throw new Error('Arquivo não parece ser um backup válido do BookList.');
        for (const [name, key] of Object.entries(Storage.KEYS)) {
            const value = data[name] !== undefined ? data[name] : data[key];
            if (value !== undefined) Storage._set(key, value);
        }
        const arrays = { COLLECTIONS: Storage.COLLECTIONS_KEY, WORKSPACES: Storage.WORKSPACES_KEY, EVENTS: Storage.EVENTS_KEY, PROJECTS: Storage.PROJECTS_KEY, RULES: Storage.RULES_KEY, DOCUMENTS: Storage.DOCUMENTS_KEY, ATTACHMENTS: Storage.ATTACHMENTS_KEY, DAILY_FOCUS: Storage.DAILY_FOCUS_KEY, CUSTOM_TEMPLATES: Storage.CUSTOM_TEMPLATES_KEY, CHECKLISTS: Storage.CHECKLISTS_KEY, BUNDLES: Storage.BUNDLES_KEY, DECISIONS: Storage.DECISIONS_KEY, ANNOTATIONS: Storage.ANNOTATIONS_KEY, LIFE_AREAS: Storage.AREAS_KEY, TRASH: Storage.TRASH_KEY };
        for (const [name, key] of Object.entries(arrays)) if (Array.isArray(data[name])) Storage._set(key, data[name], { sync: key !== Storage.TRASH_KEY });
        const objects = { STUDY: Storage.STUDY_KEY, MEDIA: Storage.MEDIA_KEY, PREFERENCES: Storage.PREFERENCES_KEY, HOME_WIDGETS: Storage.HOME_KEY, MODULES: Storage.MODULES_KEY, CANVAS: Storage.CANVAS_KEY, VAULT: Storage.VAULT_KEY };
        for (const [name, key] of Object.entries(objects)) if (data[name] && typeof data[name] === 'object') Storage._set(key, data[name]);
        if (Array.isArray(data.PROFESSIONAL_RECORDS)) Storage.saveProfessionalRecords(data.PROFESSIONAL_RECORDS);
        Storage.scheduleSync(500);
        return true;
    },

    download() {
        const payload = this.createPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `booklist_backup_${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return payload;
    },

    importFile(file) {
        return file.text().then(text => this.importPayload(JSON.parse(text)));
    }
};

Object.assign(Storage, {
    createExportPayload: () => StoragePortability.createPayload(),
    importPayload: data => StoragePortability.importPayload(data),
    exportAll: () => StoragePortability.download(),
    importAll: file => StoragePortability.importFile(file)
});
window.StoragePortability = StoragePortability;
