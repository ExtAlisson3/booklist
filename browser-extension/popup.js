// BookList Clipper Pro - popup logic
const STORAGE_KEYS = ['supabaseUrl', 'anonKey', 'email', 'accessToken', 'pendingQueue'];

async function getCfg() {
    return new Promise(resolve => chrome.storage.local.get(STORAGE_KEYS, resolve));
}

async function setCfg(patch) {
    return new Promise(resolve => chrome.storage.local.set(patch, resolve));
}

function showStatus(msg, type = 'success') {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => { el.className = 'status'; }, 4000);
}

// Tab switcher
document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('panel-' + t.dataset.panel).classList.add('active');
    });
});

// Global Context State
let currentActiveTabUrl = '';
let remoteBookmarks = [];
let remoteModules = null;
let matchedMangaItem = null;
let matchedBookmarkItem = null;

// Helpers for URL Matching
function isRestrictedUrl(url) {
    if (!url) return true;
    try {
        const parsed = new URL(url);
        // Only http:, https:, and file: protocols allow script injection
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
            return true;
        }
        const host = parsed.hostname.toLowerCase();
        if (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) {
            return true;
        }
        if (host === 'chromewebstore.google.com') {
            return true;
        }
        return false;
    } catch {
        return true;
    }
}

const GENERIC_SEGMENTS = new Set([
    'obras', 'obra', 'ler', 'manga', 'mangas', 'series', 'serie',
    'comic', 'comics', 'read', 'title', 'titles', 'chapters', 'chapter',
    'capitulo', 'cap', 'vol', 'volume', 'home', 'index', 'page', 'pages',
    'view', 'viewer', 'comic-viewer', 'reader', 'wp-content', 'uploads',
    'images', 'assets', 'api'
]);

function normalizeUrlExtended(url) {
    if (!url) return '';
    try {
        const p = new URL(url);
        let host = p.hostname.replace(/^www\./i, '').toLowerCase();
        let path = p.pathname.replace(/\/+$/, '').toLowerCase();
        
        // Handle hash routing (e.g. #/obras/...)
        let hash = p.hash;
        if (hash) {
            let cleanHash = hash.replace(/^#!\/?|^#\/?/, '').replace(/\/+$/, '').toLowerCase();
            if (cleanHash) {
                path = path ? (path + '/' + cleanHash) : ('/' + cleanHash);
            }
        }
        return (host + path).replace(/\/+/g, '/').replace(/\/$/, '');
    } catch {
        return String(url).trim().replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
    }
}

function isChapterSegment(seg) {
    if (!seg) return false;
    // Pure numbers (like /123 or /123.4)
    if (/^\d+(\.\d+)?$/.test(seg)) return true;
    // Chapter patterns, e.g. cap-01, capitulo-1, ch-5, chapter-10, vol-2, volume-3, v-1, c-1, ep-1, temp-1, season-2
    // Must end with the number or number followed by a single letter or decimal
    return /^(cap|capitulo|ch|chapter|vol|volume|v|c|ep|episode|episodio|temp|temporada|season|s)[-_]?\d+([.-]\d+)?([a-z])?$/i.test(seg);
}

function getMangaSlugSegments(url) {
    const norm = normalizeUrlExtended(url);
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        const path = norm.replace(host, '');
        
        return path.split('/')
            .filter(Boolean)
            .map(s => s.trim().toLowerCase())
            .filter(s => !GENERIC_SEGMENTS.has(s) && !isChapterSegment(s));
    } catch {
        const clean = norm.replace(/^(https?:\/\/)?(www\.)?/i, '');
        const segments = clean.split('/').filter(Boolean);
        if (segments.length > 1) {
            segments.shift(); // Remove host
        }
        return segments
            .map(s => s.trim().toLowerCase())
            .filter(s => !GENERIC_SEGMENTS.has(s) && !isChapterSegment(s));
    }
}

function urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    return normalizeUrlExtended(url1) === normalizeUrlExtended(url2);
}

function matchManga(activeUrl, item) {
    const urls = [item.url, item.rawUrl, item.wikiUrl].filter(Boolean);
    for (const u of urls) {
        if (urlsMatch(activeUrl, u)) return true;
        try {
            const activeHost = new URL(activeUrl).hostname.replace(/^www\./i, '').toLowerCase();
            const savedHost = new URL(u).hostname.replace(/^www\./i, '').toLowerCase();
            
            if (activeHost === savedHost) {
                const activeSlugs = getMangaSlugSegments(activeUrl);
                const savedSlugs = getMangaSlugSegments(u);
                
                if (activeSlugs.length > 0 && savedSlugs.length > 0) {
                    const hasOverlap = activeSlugs.some(slug => savedSlugs.includes(slug));
                    if (hasOverlap) return true;
                }
            }
        } catch {}
    }
    return false;
}

// Fetch helper from Supabase documents
async function fetchRemoteDocs(docKeyPattern) {
    const cfg = await getCfg();
    if (!cfg.supabaseUrl || !cfg.anonKey || !cfg.accessToken) return null;
    try {
        const url = `${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/booklist_sync_documents?select=doc_key,payload,updated_at&doc_key=${encodeURIComponent(docKeyPattern)}`;
        const res = await fetch(url, {
            headers: {
                'apikey': cfg.anonKey,
                'Authorization': `Bearer ${cfg.accessToken}`
            }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('Error fetching remote docs for ' + docKeyPattern, e.message || e);
    }
    return null;
}

function setSelectedCategories(containerId, categoryIds = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.cat-chip').forEach(chip => {
        if (categoryIds.includes(chip.dataset.id)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function setSelectedFolder(selectId, folderId) {
    const el = document.getElementById(selectId);
    if (el) el.value = folderId || 'default';
}

function renderTrackerCard(item) {
    const card = document.getElementById('tracker-context-card');
    if (!card) return;
    card.style.display = 'block';
    
    document.getElementById('tracker-card-title').textContent = item.title || 'Sem Título';
    document.getElementById('tracker-card-badge').textContent = (item.type || 'manga').toUpperCase();
    
    const current = Number(item.currentChapter || 0);
    const latest = Number(item.latestChapter || 0);
    let pct = 0;
    if (latest > 0) {
        pct = Math.min(100, Math.round((current / latest) * 100));
    }
    
    document.getElementById('tracker-card-progress').style.width = pct + '%';
    document.getElementById('tracker-card-chapters').textContent = `Capítulo ${current} de ${latest || '?'}`;
    document.getElementById('tracker-card-percent').textContent = pct + '%';
    
    document.getElementById('tracker-input-current').value = current;
    document.getElementById('tracker-input-latest').value = latest || '';
    document.getElementById('tracker-select-status').value = item.status || 'lendo';
    document.getElementById('tracker-input-rating').value = item.rating || '';
    document.getElementById('tracker-textarea-note').value = item.note || '';
}

async function saveMangaTrackerItem(item) {
    if (!remoteModules) {
        showStatus('Erro: Módulos remotos não carregados.', 'error');
        return;
    }
    
    if (!remoteModules.personalData) {
        remoteModules.personalData = {};
    }
    if (!Array.isArray(remoteModules.personalData.tracker)) {
        remoteModules.personalData.tracker = [];
    }
    
    const index = remoteModules.personalData.tracker.findIndex(t => t.id === item.id);
    if (index >= 0) {
        remoteModules.personalData.tracker[index] = item;
    } else {
        remoteModules.personalData.tracker.unshift(item);
    }
    
    const result = await chrome.runtime.sendMessage({ 
        type: 'SAVE_MODULES', 
        item: remoteModules 
    });
    
    showStatus(result.ok ? '✓ Tracker atualizado!' : '✗ ' + result.message, result.ok ? 'success' : 'error');
}

async function detectContext(activeUrl) {
    const cfg = await getCfg();
    if (!cfg.supabaseUrl || !cfg.anonKey || !cfg.accessToken) return;

    try {
        const bms = await fetchRemoteDocs('like.bookmark*');
        if (bms) {
            remoteBookmarks = bms.map(row => row.payload).filter(Boolean);
            matchedBookmarkItem = remoteBookmarks.find(bm => urlsMatch(activeUrl, bm.url));
            if (matchedBookmarkItem) {
                document.getElementById('bookmark-alert').style.display = 'block';
                document.getElementById('title').value = matchedBookmarkItem.title || '';
                document.getElementById('url').value = matchedBookmarkItem.url || '';
                
                let desc = matchedBookmarkItem.description || '';
                let annotation = '';
                if (desc.startsWith('✏️ Anotação: ')) {
                    const parts = desc.split('\n\n');
                    annotation = parts[0].replace('✏️ Anotação: ', '');
                    desc = parts.slice(1).join('\n\n');
                }
                document.getElementById('desc').value = desc;
                document.getElementById('annotation-bookmark').value = annotation;
                
                setSelectedFolder('folder-select', matchedBookmarkItem.folderId);
                setSelectedCategories('cats-container-bookmark', matchedBookmarkItem.categoryIds || []);
                document.getElementById('btn-save').textContent = 'Atualizar Bookmark';
            }
        }

        const mods = await fetchRemoteDocs('eq.booklist_modules');
        if (mods && mods.length > 0) {
            remoteModules = mods[0].payload;
            const trackerList = remoteModules?.personalData?.tracker || [];
            matchedMangaItem = trackerList.find(item => matchManga(activeUrl, item));
            if (matchedMangaItem) {
                renderTrackerCard(matchedMangaItem);
            }
        }
    } catch (e) {
        console.warn('Error during context detection:', e.message || e);
    }
}

// Bind Manga Tracker actions
document.getElementById('btn-tracker-bump').addEventListener('click', async () => {
    if (!matchedMangaItem) return;
    matchedMangaItem.currentChapter = (Number(matchedMangaItem.currentChapter) || 0) + 1;
    matchedMangaItem.updatedAt = new Date().toISOString();
    renderTrackerCard(matchedMangaItem);
    await saveMangaTrackerItem(matchedMangaItem);
});

document.getElementById('btn-tracker-caughtup').addEventListener('click', async () => {
    if (!matchedMangaItem || !matchedMangaItem.latestChapter) {
        showStatus('Defina o capítulo lançado primeiro', 'error');
        return;
    }
    matchedMangaItem.currentChapter = Number(matchedMangaItem.latestChapter);
    matchedMangaItem.updatedAt = new Date().toISOString();
    renderTrackerCard(matchedMangaItem);
    await saveMangaTrackerItem(matchedMangaItem);
});

document.getElementById('btn-tracker-toggle-details').addEventListener('click', () => {
    const drawer = document.getElementById('tracker-details-drawer');
    if (drawer) {
        const isHidden = drawer.style.display === 'none' || !drawer.style.display;
        drawer.style.display = isHidden ? 'block' : 'none';
    }
});

document.getElementById('btn-tracker-save').addEventListener('click', async () => {
    if (!matchedMangaItem) return;
    
    const current = Number(document.getElementById('tracker-input-current').value || 0);
    const latestVal = document.getElementById('tracker-input-latest').value;
    const latest = latestVal === '' ? null : Number(latestVal);
    const status = document.getElementById('tracker-select-status').value;
    const ratingVal = document.getElementById('tracker-input-rating').value;
    const rating = ratingVal === '' ? null : Number(ratingVal);
    const note = document.getElementById('tracker-textarea-note').value;
    
    matchedMangaItem.currentChapter = current;
    matchedMangaItem.latestChapter = latest;
    matchedMangaItem.status = status;
    matchedMangaItem.rating = rating;
    matchedMangaItem.note = note;
    matchedMangaItem.updatedAt = new Date().toISOString();
    
    renderTrackerCard(matchedMangaItem);
    await saveMangaTrackerItem(matchedMangaItem);
    document.getElementById('tracker-details-drawer').style.display = 'none';
});

// Load Config & Categories/Folders on Start
(async () => {
    const cfg = await getCfg();
    if (cfg.supabaseUrl) document.getElementById('cfg-url').value = cfg.supabaseUrl;
    if (cfg.anonKey) document.getElementById('cfg-key').value = cfg.anonKey;
    if (cfg.email) document.getElementById('cfg-email').value = cfg.email;
    const queueCount = (cfg.pendingQueue || []).length;
    document.getElementById('cfg-status').textContent = cfg.accessToken
        ? `✓ Logado como ${cfg.email}${queueCount ? ` · ${queueCount} item(ns) na fila` : ''}`
        : `✗ Não logado — ${queueCount || 'bookmarks'} ficarão na fila local até configurar.`;
        
    // Auto-flush queue on startup if logged in
    if (cfg.accessToken) {
        chrome.runtime.sendMessage({ type: 'FLUSH_QUEUE' }).then(res => {
            if (res && res.ok && res.message && !res.message.includes('vazia')) {
                showStatus('Fila sincronizada automaticamente!', 'success');
                getCfg().then(newCfg => {
                    const newQueueCount = (newCfg.pendingQueue || []).length;
                    document.getElementById('cfg-status').textContent = `✓ Logado como ${newCfg.email}${newQueueCount ? ` · ${newQueueCount} item(ns) na fila` : ''}`;
                });
            }
        }).catch(() => {});
    }

    await loadCategoriesAndFolders();
    
    // Auto-fill active tab & Scrape rich metadata & selection
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        if (!tab) return;
        document.getElementById('title').value = tab.title || '';
        document.getElementById('url').value = tab.url || '';
        currentActiveTabUrl = tab.url || '';
        
        await detectContext(currentActiveTabUrl);
        
        // Skip executing scripts on restricted system pages to avoid browser console errors
        if (isRestrictedUrl(currentActiveTabUrl)) return;
        
        try {
            const [{ result }] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const getMeta = (names) => {
                        for (const name of names) {
                            const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                            if (el && el.getAttribute('content')) {
                                return el.getAttribute('content').trim();
                            }
                        }
                        return '';
                    };
                    return {
                        description: getMeta(['og:description', 'description', 'twitter:description']),
                        author: getMeta(['author', 'article:author', 'og:article:author']),
                        image: getMeta(['og:image', 'twitter:image']),
                        selection: window.getSelection().toString()
                    };
                }
            });
            
            if (result) {
                if (result.description && !matchedBookmarkItem) {
                    document.getElementById('desc').value = result.description;
                }
                if (result.selection) {
                    document.getElementById('clip-content').value = result.selection;
                }
                window.scrapedMetadata = result;
            }
        } catch (e) {
            console.warn('Failed to scrape page metadata:', e.message || e);
        }
    });
})();

// Fetch dynamic categories and folders from Supabase or fallback
async function loadCategoriesAndFolders() {
    const cfg = await getCfg();
    const catsContainerB = document.getElementById('cats-container-bookmark');
    const catsContainerN = document.getElementById('cats-container-note');
    const folderSelectB = document.getElementById('folder-select');
    const folderSelectN = document.getElementById('folder-select-note');
    
    if (!cfg.supabaseUrl || !cfg.anonKey || !cfg.accessToken) {
        const noSessionMsg = '<small>Faça login na aba ⚙️ para carregar pastas/categorias</small>';
        if (catsContainerB) catsContainerB.innerHTML = noSessionMsg;
        if (catsContainerN) catsContainerN.innerHTML = noSessionMsg;
        return;
    }
    
    try {
        const url = `${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/booklist_sync_documents?select=doc_key,payload&doc_key=in.(booklist_bk_folders,booklist_nt_folders,booklist_bk_categories,booklist_nt_categories)`;
        const res = await fetch(url, {
            headers: {
                'apikey': cfg.anonKey,
                'Authorization': `Bearer ${cfg.accessToken}`
            }
        });
        
        if (res.ok) {
            const rows = await res.json();
            
            let bkFolders = [];
            let ntFolders = [];
            let bkCategories = [];
            let ntCategories = [];
            
            rows.forEach(r => {
                if (r.doc_key === 'booklist_bk_folders' && Array.isArray(r.payload)) bkFolders = r.payload;
                if (r.doc_key === 'booklist_nt_folders' && Array.isArray(r.payload)) ntFolders = r.payload;
                if (r.doc_key === 'booklist_bk_categories' && Array.isArray(r.payload)) bkCategories = r.payload;
                if (r.doc_key === 'booklist_nt_categories' && Array.isArray(r.payload)) ntCategories = r.payload;
            });
            
            // Populate Bookmark Folders
            if (folderSelectB) {
                folderSelectB.innerHTML = '<option value="default">📁 Default (Sem pasta)</option>' + bkFolders.map(f => 
                    `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`
                ).join('');
            }
            
            // Populate Note Folders
            if (folderSelectN) {
                folderSelectN.innerHTML = '<option value="default">📁 Default (Sem pasta)</option>' + ntFolders.map(f => 
                    `<option value="${f.id}">${f.icon || '📁'} ${f.name}</option>`
                ).join('');
            }
            
            // Render Bookmark Categories
            if (catsContainerB) {
                if (bkCategories.length === 0) {
                    catsContainerB.innerHTML = '<small class="text-muted">Nenhuma categoria cadastrada.</small>';
                } else {
                    catsContainerB.innerHTML = bkCategories.map(c => 
                        `<span class="cat-chip" data-id="${c.id}" style="border-left: 3px solid ${c.color || '#7C4DFF'}">${c.icon || '🏷️'} ${c.name}</span>`
                    ).join('');
                    catsContainerB.querySelectorAll('.cat-chip').forEach(chip => {
                        chip.addEventListener('click', () => chip.classList.toggle('active'));
                    });
                }
            }
            
            // Render Note Categories
            if (catsContainerN) {
                if (ntCategories.length === 0) {
                    catsContainerN.innerHTML = '<small class="text-muted">Nenhuma categoria cadastrada.</small>';
                } else {
                    catsContainerN.innerHTML = ntCategories.map(c => 
                        `<span class="cat-chip" data-id="${c.id}" style="border-left: 3px solid ${c.color || '#7C4DFF'}">${c.icon || '🏷️'} ${c.name}</span>`
                    ).join('');
                    catsContainerN.querySelectorAll('.cat-chip').forEach(chip => {
                        chip.addEventListener('click', () => chip.classList.toggle('active'));
                    });
                }
            }
            
            // Restore selection if matched items exist
            if (matchedBookmarkItem) {
                setSelectedFolder('folder-select', matchedBookmarkItem.folderId);
                setSelectedCategories('cats-container-bookmark', matchedBookmarkItem.categoryIds || []);
            }
        }
    } catch (err) {
        console.warn('Failed to load categories/folders:', err.message || err);
    }
}

// SAVE BOOKMARK
document.getElementById('btn-save').addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const url = document.getElementById('url').value.trim();
    const desc = document.getElementById('desc').value.trim();
    const folderId = document.getElementById('folder-select').value;
    const annotation = document.getElementById('annotation-bookmark').value.trim();
    
    // Get active category chips
    const activeChips = Array.from(document.querySelectorAll('#cats-container-bookmark .cat-chip.active'))
        .map(chip => chip.dataset.id);
    
    if (!url) return showStatus('URL obrigatória', 'error');
    
    let finalDesc = desc;
    if (annotation) {
        finalDesc = `✏️ Anotação: ${annotation}\n\n${desc}`;
    }
    
    const isUpdate = Boolean(matchedBookmarkItem);
    const item = {
        id: isUpdate ? matchedBookmarkItem.id : crypto.randomUUID(),
        title: title || url,
        url,
        description: finalDesc,
        categoryIds: activeChips,
        folderId: folderId,
        createdAt: isUpdate ? matchedBookmarkItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        favorite: isUpdate ? matchedBookmarkItem.favorite : false,
        clippedFromExtension: true
    };
    
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_BOOKMARK', item });
    showStatus(result.ok ? '✓ ' + result.message : '✗ ' + result.message, result.ok ? 'success' : 'error');
    
    if (result.ok) {
        matchedBookmarkItem = item;
        document.getElementById('bookmark-alert').style.display = 'block';
        document.getElementById('btn-save').textContent = 'Atualizar Bookmark';
    }
});

// GRAB SELECTION
document.getElementById('btn-grab-selection').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    if (isRestrictedUrl(tab.url)) {
        return showStatus('Não é possível capturar seleção em páginas do sistema.', 'error');
    }
    
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString()
        });
        if (result) {
            document.getElementById('clip-content').value = result;
            showStatus('Seleção capturada!', 'success');
        } else {
            showStatus('Nenhum texto selecionado na página.', 'error');
        }
    } catch (e) {
        showStatus('Erro: ' + e.message, 'error');
    }
});

// GRAB CLEAN READER PAGE (MARKDOWN)
document.getElementById('btn-grab-page').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    if (isRestrictedUrl(tab.url)) {
        return showStatus('Não é possível ler conteúdo em páginas do sistema.', 'error');
    }
    
    showStatus('Extraindo conteúdo limpo...', 'success');
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const article = document.querySelector('article, main, [role="main"], .post, .article, .content');
                const root = article || document.body;
                const clone = root.cloneNode(true);
                
                const noiseSelectors = 'nav, footer, header, sidebar, .sidebar, aside, script, style, iframe, noscript, .ads, .comments, .menu';
                clone.querySelectorAll(noiseSelectors).forEach(el => el.remove());

                function processNode(node) {
                    if (node.nodeType === 3) {
                        return node.textContent.trim() ? node.textContent : '';
                    }
                    if (node.nodeType !== 1) return '';

                    let content = '';
                    node.childNodes.forEach(child => {
                        content += processNode(child);
                    });

                    const tag = node.tagName.toLowerCase();
                    switch (tag) {
                        case 'h1': return `\n\n# ${content}\n\n`;
                        case 'h2': return `\n\n## ${content}\n\n`;
                        case 'h3': return `\n\n### ${content}\n\n`;
                        case 'h4': return `\n\n#### ${content}\n\n`;
                        case 'p': return `\n\n${content}\n\n`;
                        case 'br': return `\n`;
                        case 'li': return `\n- ${content}`;
                        case 'ul':
                        case 'ol': return `\n${content}\n`;
                        case 'strong':
                        case 'b': return ` **${content}** `;
                        case 'em':
                        case 'i': return ` *${content}* `;
                        case 'a': {
                            const href = node.getAttribute('href');
                            return href ? ` [${content}](${href}) ` : content;
                        }
                        case 'img': {
                            const src = node.getAttribute('src');
                            const alt = node.getAttribute('alt') || 'imagem';
                            return src ? `\n![${alt}](${src})\n` : '';
                        }
                        case 'blockquote': return `\n> ${content.replace(/\n/g, '\n> ')}\n`;
                        case 'pre':
                        case 'code': return `\n\`\`\`\n${content}\n\`\`\`\n`;
                        default: return content;
                    }
                }

                const rawMd = processNode(clone);
                return rawMd.replace(/\n{3,}/g, '\n\n').trim().substring(0, 18000);
            }
        });
        
        if (result) {
            document.getElementById('clip-content').value = result;
            showStatus('Leitura Limpa Markdown obtida!', 'success');
        } else {
            showStatus('Falha ao extrair página.', 'error');
        }
    } catch (e) {
        showStatus('Erro: ' + e.message, 'error');
    }
});

// SAVE NOTE CLIPPER
document.getElementById('btn-save-clip').addEventListener('click', async () => {
    const content = document.getElementById('clip-content').value.trim();
    const title = document.getElementById('title').value.trim();
    const url = document.getElementById('url').value.trim();
    const folderId = document.getElementById('folder-select-note').value;
    const isMarkdownMode = document.getElementById('chk-markdown-mode').checked;
    
    // Get active category chips
    const activeChips = Array.from(document.querySelectorAll('#cats-container-note .cat-chip.active'))
        .map(chip => chip.dataset.id);
    
    if (!content) return showStatus('Capture algo primeiro', 'error');
    
    const safeUrl = escapeHtml(url);
    let finalContent = '';
    
    if (isMarkdownMode) {
        finalContent = `🔗 **URL original:** [${safeUrl}](${safeUrl})\n\n---\n\n${content}`;
    } else {
        finalContent = `<p><a href="${safeUrl}" target="_blank">🔗 ${safeUrl}</a></p><blockquote>${escapeHtml(content).replace(/\n/g, '<br>')}</blockquote>`;
    }
    
    const note = {
        id: crypto.randomUUID(),
        title: title || 'Clipping ' + new Date().toLocaleDateString(),
        content: finalContent,
        categoryIds: activeChips,
        folderId: folderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        clippedFromExtension: true,
        pureMarkdown: isMarkdownMode
    };
    
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_NOTE', item: note });
    showStatus(result.ok ? '✓ ' + result.message : '✗ ' + result.message, result.ok ? 'success' : 'error');
});

// LOGIN CONFIG
document.getElementById('btn-config-save').addEventListener('click', async () => {
    const supabaseUrl = document.getElementById('cfg-url').value.trim().replace(/\/+$/, '');
    const anonKey = document.getElementById('cfg-key').value.trim();
    const email = document.getElementById('cfg-email').value.trim();
    const password = document.getElementById('cfg-pass').value;
    if (!supabaseUrl || !anonKey || !email || !password) return showStatus('Preencha tudo', 'error');
    try {
        const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.msg || 'Login falhou');
        await setCfg({ supabaseUrl, anonKey, email, accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user?.id });
        const flush = await chrome.runtime.sendMessage({ type: 'FLUSH_QUEUE' });
        document.getElementById('cfg-status').textContent = '✓ Logado como ' + email;
        showStatus(flush?.ok ? 'Logado e fila sincronizada!' : 'Logado. ' + (flush?.message || 'Pronto para sincronizar.'), flush?.ok ? 'success' : 'error');
        
        await loadCategoriesAndFolders();
    } catch (err) {
        showStatus(err.message, 'error');
    }
});

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[c]));
}
