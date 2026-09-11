/* External media catalog adapters with unified fallback by category. */
const MediaCatalog = {
    normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    },

    async search(query, type) {
        const normalized = this.normalize(type);
        if (['anime', 'manga', 'manhwa', 'manhua'].includes(normalized)) {
            const endpoint = normalized === 'anime' ? 'anime' : 'manga';
            return this.searchAnimeMangaFallback(query, endpoint);
        }
        if (['livro', 'novel', 'web novel', 'quadrinho'].includes(normalized)) {
            return this.searchOpenLibrary(query);
        }
        if (['filme', 'serie', 'série'].includes(normalized)) {
            return this.searchTmdb(query, normalized === 'filme' ? 'movie' : 'tv');
        }
        throw new Error('Este tipo ainda não possui um catálogo automático configurado.');
    },

    async searchAnimeMangaFallback(query, endpoint) {
        const errors = [];
        const providers = [
            { name: 'Jikan', run: () => this.searchJikan(query, endpoint) },
            { name: 'AniList', run: () => this.searchAniList(query, endpoint) },
            { name: 'MyAnimeList', run: () => this.searchMalDirect(query, endpoint) },
        ];

        for (const provider of providers) {
            try {
                const results = await provider.run();
                if (results && results.length > 0) {
                    return results;
                }
            } catch (err) {
                errors.push(`${provider.name}: ${err.message}`);
                continue;
            }
        }

        throw new Error(`Nenhum catálogo respondeu. ${errors.join(' | ')}`);
    },

    async searchJikan(query, endpoint) {
        const response = await fetch(`https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(query)}&limit=5&sfw=true`, {
            headers: { 'User-Agent': 'BookList/1.0' }
        });
        if (!response.ok) {
            const msg = response.status === 429 ? 'rate-limit' : `HTTP ${response.status}`;
            throw new Error(`Jikan indisponível (${msg})`);
        }
        const data = await response.json();
        return (data.data || []).map(item => ({
            title: item.title || item.title_english || query,
            creator: (item.authors || item.producers || item.studios || []).map(person => person.name).filter(Boolean).join(', '),
            latest: item.chapters || item.episodes || '',
            year: item.year || item.aired?.prop?.from?.year || '',
            wikiUrl: item.url || '',
            image: item.images?.jpg?.image_url || '',
            meta: [item.type, item.status, item.score ? `★ ${item.score}` : ''].filter(Boolean).join(' · ')
        }));
    },

    async searchAniList(query, endpoint) {
        const isAnime = endpoint === 'anime';
        const gql = isAnime
            ? `query($q:String,$page:Int){Page(page:$page,perPage:5){pageInfo{hasNextPage}media(search:$q,type:ANIME){id title{romaji english native}format status episodes averageScore genres siteUrl coverImage{large}}}}`
            : `query($q:String,$page:Int){Page(page:$page,perPage:5){pageInfo{hasNextPage}media(search:$q,type:MANGA){id title{romaji english native}format status chapters averageScore genres siteUrl coverImage{large}}}}`;
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'BookList/1.0' },
            body: JSON.stringify({ query: gql, variables: { q: query, page: 1 } })
        });
        if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
        const data = await response.json();
        const mediaList = data.data?.Page?.media || [];
        if (!mediaList.length) return [];
        return mediaList.map(item => ({
            title: item.title?.english || item.title?.romaji || query,
            creator: (item.genres || []).slice(0, 3).join(', '),
            latest: isAnime ? (item.episodes || '') : (item.chapters || ''),
            year: item.format || '',
            wikiUrl: item.siteUrl || `https://anilist.co/${item.type?.toLowerCase()}/${item.id}`,
            image: item.coverImage?.large || '',
            meta: [item.status, isAnime ? `★ ${item.averageScore || ''}` : `★ ${item.averageScore || ''}`].filter(Boolean).join(' · ')
        }));
    },

    async searchMalDirect(query, endpoint) {
        const credential = Storage.getModules()?.integrationSettings?.mal?.credential || '';
        if (!credential) throw new Error('MAL OAuth não configurado');
        const isAnime = endpoint === 'anime';
        const url = isAnime
            ? `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(query)}&limit=5&fields=title,main_picture,mean,num_episodes,status,genres,studios`
            : `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(query)}&limit=5&fields=title,main_picture,mean,num_chapters,status,genres,authors`;
        const response = await fetch(url, {
            headers: { 'X-MAL-CLIENT-ID': credential, 'User-Agent': 'BookList/1.0' }
        });
        if (response.status === 401) throw new Error('MAL Client ID inválido');
        if (!response.ok) throw new Error(`MAL HTTP ${response.status}`);
        const data = await response.json();
        const list = data.data || [];
        if (!list.length) return [];
        return list.map(item => {
            const node = item.node || {};
            const studios = Array.isArray(node.studios) ? node.studios.map(s => s.name).join(', ') : '';
            const authors = Array.isArray(node.authors) ? node.authors.map(a => a.node?.name).filter(Boolean).join(', ') : '';
            return {
                title: node.title || query,
                creator: isAnime ? studios : authors,
                latest: isAnime ? (node.num_episodes || '') : (node.num_chapters || ''),
                year: node.status || '',
                wikiUrl: node.url || '',
                image: node.main_picture?.medium || node.main_picture?.large || '',
                meta: (node.genres || []).slice(0, 3).map(g => g.name).join(', ') + (node.mean ? ` · ★ ${Number(node.mean).toFixed(1)}` : '')
            };
        });
    },

    async searchOpenLibrary(query) {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,first_publish_year,edition_count,key`);
        if (!response.ok) throw new Error(`OpenLibrary HTTP ${response.status}`);
        const data = await response.json();
        return (data.docs || []).map(item => ({
            title: item.title || query,
            creator: (item.author_name || []).join(', '),
            year: item.first_publish_year || '',
            wikiUrl: item.key ? `https://openlibrary.org${item.key}` : '',
            meta: `${item.edition_count || 0} edição(ões)`
        }));
    },

    async searchTmdb(query, endpoint) {
        const credential = Storage.getModules()?.integrationSettings?.tmdb?.credential || '';
        if (!credential) throw new Error('Configure uma chave pública do TMDB na Central de Integrações.');
        const response = await fetch(`https://api.themoviedb.org/3/search/${endpoint}?api_key=${encodeURIComponent(credential)}&language=pt-BR&query=${encodeURIComponent(query)}&include_adult=false&page=1`);
        if (response.status === 401) throw new Error('Chave do TMDB inválida.');
        if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
        const data = await response.json();
        return (data.results || []).slice(0, 5).map(item => {
            const date = item.release_date || item.first_air_date || '';
            const title = item.title || item.name || query;
            return {
                title,
                creator: endpoint === 'movie' ? 'Filme' : 'Série',
                year: date.slice(0, 4),
                wikiUrl: `https://www.themoviedb.org/${endpoint}/${item.id}`,
                image: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '',
                meta: [date.slice(0, 4), item.vote_average ? `★ ${Number(item.vote_average).toFixed(1)}` : ''].filter(Boolean).join(' · ')
            };
        });
    }
};

window.MediaCatalog = MediaCatalog;
