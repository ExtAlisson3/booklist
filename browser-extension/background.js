// BookList Clipper - background service worker
// Salva bookmarks/notas no Supabase quando configurado, e mantém fila local quando offline.

const QUEUE_KEY = 'pendingQueue';
const DOC_KEYS = {
    BOOKMARKS: 'booklist_bookmarks',
    NOTES: 'booklist_notes'
};

async function getCfg() {
    return new Promise(resolve => chrome.storage.local.get(['supabaseUrl', 'anonKey', 'accessToken', 'refreshToken', 'userId', QUEUE_KEY], resolve));
}

async function setCfg(patch) {
    return new Promise(resolve => chrome.storage.local.set(patch, resolve));
}

async function removeQueueEntry(entry) {
    const cfg = await getCfg();
    const queue = cfg[QUEUE_KEY] || [];
    await setCfg({ [QUEUE_KEY]: queue.filter(e => e.queueId !== entry.queueId && e.item?.id !== entry.item?.id) });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: 'save-link', title: 'BookList: Salvar este link', contexts: ['link', 'page'] });
        chrome.contextMenus.create({ id: 'save-selection', title: 'BookList: Salvar seleção como nota', contexts: ['selection'] });
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'save-link') {
        const url = info.linkUrl || info.pageUrl;
        const title = tab.title || url;
        const result = await saveBookmark({
            id: crypto.randomUUID(),
            title,
            url,
            description: '',
            categoryIds: [],
            folderId: 'default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            favorite: false,
            clippedFromExtension: true
        });
        notify(result.ok ? 'Link salvo no BookList' : result.message, result.ok);
    }

    if (info.menuItemId === 'save-selection') {
        const note = {
            id: crypto.randomUUID(),
            title: 'Clipping de ' + (tab.title || 'página'),
            content: `<p><a href="${escapeHtml(tab.url || '')}" target="_blank">🔗 ${escapeHtml(tab.url || '')}</a></p><blockquote>${escapeHtml(info.selectionText || '').replace(/\n/g, '<br>')}</blockquote>`,
            categoryIds: [],
            folderId: 'default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pinned: false,
            clippedFromExtension: true
        };
        const result = await saveNote(note);
        notify(result.ok ? 'Seleção salva como nota' : result.message, result.ok);
    }
});

function notify(msg, ok = true) {
    chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
    chrome.action.setBadgeBackgroundColor({ color: ok ? '#00C853' : '#FF5252' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === 'SAVE_BOOKMARK') {
                const result = await saveBookmark(msg.item);
                sendResponse(result);
                if (result.ok) flushQueue().catch(() => {});
            } else if (msg.type === 'SAVE_NOTE') {
                const result = await saveNote(msg.item);
                sendResponse(result);
                if (result.ok) flushQueue().catch(() => {});
            } else if (msg.type === 'SAVE_MODULES') {
                const result = await upsertGenericDoc('booklist_modules', msg.item);
                sendResponse(result);
                if (result.ok) flushQueue().catch(() => {});
            } else if (msg.type === 'FLUSH_QUEUE') {
                const result = await flushQueue();
                sendResponse(result);
            }
        } catch (err) {
            sendResponse({ ok: false, message: err.message });
        }
    })();
    return true;
});

async function saveBookmark(item) {
    return upsertDoc(DOC_KEYS.BOOKMARKS, item);
}

async function saveNote(item) {
    return upsertDoc(DOC_KEYS.NOTES, item);
}

async function upsertGenericDoc(docKey, payload, options = {}) {
    const { queueOnFail = true } = options;
    let cfg = await getCfg();

    if (!hasSupabaseSession(cfg)) {
        if (queueOnFail) await enqueue(docKey, payload);
        return { ok: true, message: 'Salvo na fila local (logue no Supabase para sync)' };
    }

    try {
        cfg = await checkAndRefreshSession(cfg);
        await saveIndividualPayload(cfg, docKey, payload);
        return { ok: true, message: 'Sincronizado com Supabase!' };
    } catch (err) {
        if (isAuthError(err) && cfg.refreshToken) {
            try {
                cfg = await refreshSession(cfg);
                await saveIndividualPayload(cfg, docKey, payload);
                return { ok: true, message: 'Sessão renovada e sincronizada!' };
            } catch (authErr) {
                if (queueOnFail) await enqueue(docKey, payload);
                return { ok: false, message: authErr.message + (queueOnFail ? ' (item na fila local)' : '') };
            }
        }

        if (queueOnFail) await enqueue(docKey, payload);
        return { ok: false, message: err.message + (queueOnFail ? ' (item na fila local)' : '') };
    }
}

async function upsertDoc(docKey, newItem, options = {}) {
    const { queueOnFail = true } = options;
    let cfg = await getCfg();

    if (!hasSupabaseSession(cfg)) {
        if (queueOnFail) await enqueue(docKey, newItem);
        return { ok: true, message: 'Salvo na fila local (logue no Supabase para sync)' };
    }

    try {
        cfg = await checkAndRefreshSession(cfg);
        
        const isNote = docKey === DOC_KEYS.NOTES;
        const dynKey = (isNote ? 'note:' : 'bookmark:') + newItem.id;
        
        await saveIndividualPayload(cfg, dynKey, newItem);
        return { ok: true, message: 'Sincronizado com Supabase!' };
    } catch (err) {
        if (isAuthError(err) && cfg.refreshToken) {
            try {
                cfg = await refreshSession(cfg);
                const isNote = docKey === DOC_KEYS.NOTES;
                const dynKey = (isNote ? 'note:' : 'bookmark:') + newItem.id;
                await saveIndividualPayload(cfg, dynKey, newItem);
                return { ok: true, message: 'Sessão renovada e sincronizada!' };
            } catch (authErr) {
                if (queueOnFail) await enqueue(docKey, newItem);
                return { ok: false, message: authErr.message + (queueOnFail ? ' (item na fila local)' : '') };
            }
        }

        if (queueOnFail) await enqueue(docKey, newItem);
        return { ok: false, message: err.message + (queueOnFail ? ' (item na fila local)' : '') };
    }
}

function hasSupabaseSession(cfg) {
    return Boolean(cfg.supabaseUrl && cfg.anonKey && cfg.accessToken && cfg.userId);
}

function isJwtExpired(token) {
    if (!token) return true;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return true;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload.exp) return false;
        return (payload.exp * 1000) < (Date.now() + 300000); // 5 min buffer
    } catch {
        return true;
    }
}

async function checkAndRefreshSession(cfg) {
    if (cfg.refreshToken && isJwtExpired(cfg.accessToken)) {
        try {
            return await refreshSession(cfg);
        } catch (err) {
            console.error('Silent session refresh failed:', err);
        }
    }
    return cfg;
}

async function saveIndividualPayload(cfg, docKey, item) {
    const row = {
        user_id: cfg.userId,
        doc_key: docKey,
        payload: {
            ...item,
            clippedFromExtension: true,
            updatedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
    };

    const upsertUrl = `${cleanUrl(cfg.supabaseUrl)}/rest/v1/booklist_sync_documents?on_conflict=user_id,doc_key`;
    const res = await fetch(upsertUrl, {
        method: 'POST',
        headers: {
            ...authHeaders(cfg),
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(row)
    });

    if (res.status === 401 || res.status === 403) throw new Error('Sessão expirada');
    if (!res.ok) throw new Error('Supabase: ' + await errorText(res));
}

function itemKey(item, docKey) {
    if (docKey === 'booklist_modules') return 'booklist_modules';
    if (docKey === DOC_KEYS.BOOKMARKS && item.url) return 'url:' + normalizeUrl(item.url);
    return 'id:' + item.id;
}

function normalizeUrl(url) {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return parsed.toString().replace(/\/$/, '').toLowerCase();
    } catch {
        return String(url || '').trim().replace(/\/$/, '').toLowerCase();
    }
}

async function enqueue(docKey, item) {
    const cfg = await getCfg();
    const queue = cfg[QUEUE_KEY] || [];
    const entry = {
        queueId: crypto.randomUUID(),
        docKey,
        item,
        queuedAt: new Date().toISOString()
    };
    const key = itemKey(item, docKey);
    const deduped = queue.filter(e => e.item?.id !== item.id && itemKey(e.item || {}, e.docKey) !== key);
    await setCfg({ [QUEUE_KEY]: [...deduped, entry].slice(-300) });
}

async function flushQueue() {
    const cfg = await getCfg();
    const queue = cfg[QUEUE_KEY] || [];
    if (!queue.length) return { ok: true, message: 'Fila local vazia.' };
    if (!hasSupabaseSession(cfg)) return { ok: false, message: 'Faça login no Supabase para sincronizar a fila.' };

    let synced = 0;
    let failed = 0;
    for (const entry of queue.slice()) {
        const result = entry.docKey === 'booklist_modules'
            ? await upsertGenericDoc(entry.docKey, entry.item, { queueOnFail: false })
            : await upsertDoc(entry.docKey, entry.item, { queueOnFail: false });
        if (result.ok) {
            synced++;
            await removeQueueEntry(entry);
        } else {
            failed++;
        }
    }

    return {
        ok: failed === 0,
        message: failed ? `${synced} item(ns) sincronizados, ${failed} ainda pendente(s).` : `${synced} item(ns) da fila sincronizados.`
    };
}

async function refreshSession(cfg) {
    const res = await fetch(`${cleanUrl(cfg.supabaseUrl)}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
            'apikey': cfg.anonKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: cfg.refreshToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Sessão expirada. Faça login novamente.');

    const patch = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cfg.refreshToken,
        userId: data.user?.id || cfg.userId
    };
    await setCfg(patch);
    return { ...cfg, ...patch };
}

function isAuthError(err) {
    return /sess[aã]o expirada|token/i.test(err.message || '');
}

function authHeaders(cfg) {
    return {
        'apikey': cfg.anonKey,
        'Authorization': `Bearer ${cfg.accessToken}`
    };
}

function cleanUrl(url) {
    return String(url || '').replace(/\/+$/, '');
}

async function errorText(res) {
    const text = await res.text();
    return text.slice(0, 200);
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}

chrome.alarms?.create('flush-queue', { periodInMinutes: 5 });
chrome.alarms?.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'flush-queue') return;
    let cfg = await getCfg();
    if (hasSupabaseSession(cfg)) {
        await checkAndRefreshSession(cfg).catch(() => {});
    }
    await flushQueue();
});
