/**
 * Markmap Lite Integration
 * Procura blocos ```markmap e renderiza SVGs de mapas mentais interativos
 */
const MarkmapLite = {
    isLoaded: false,
    loadingPromise: null,

    loadDependencies() {
        if (this.isLoaded) return Promise.resolve();
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = new Promise((resolve) => {
            // Load D3
            const d3Script = document.createElement('script');
            d3Script.src = 'https://cdn.jsdelivr.net/npm/d3@7';
            d3Script.onload = () => {
                // Load Markmap Lib & View
                const viewScript = document.createElement('script');
                viewScript.src = 'https://cdn.jsdelivr.net/npm/markmap-view';
                
                const libScript = document.createElement('script');
                libScript.src = 'https://cdn.jsdelivr.net/npm/markmap-lib';
                
                let loadedCount = 0;
                const checkDone = () => {
                    loadedCount++;
                    if (loadedCount === 2) {
                        this.isLoaded = true;
                        resolve();
                    }
                };
                
                viewScript.onload = checkDone;
                libScript.onload = checkDone;
                
                document.head.appendChild(viewScript);
                document.head.appendChild(libScript);
            };
            document.head.appendChild(d3Script);
        });

        return this.loadingPromise;
    },

    renderAll(root = document) {
        const blocks = root.querySelectorAll('pre > code[data-lang="markmap"]');
        if (blocks.length === 0) return;

        this.loadDependencies().then(() => {
            blocks.forEach((codeEl, index) => {
                const preEl = codeEl.parentElement;
                
                // Se já foi renderizado, ignora
                if (preEl.classList.contains('markmap-rendered')) return;
                
                const markdownContent = codeEl.textContent || codeEl.innerText;
                
                // Transforma o pre em um container relativo
                preEl.classList.add('markmap-rendered');
                preEl.style.position = 'relative';
                preEl.style.minHeight = '300px';
                preEl.style.backgroundColor = 'var(--mui-glass-bg, rgba(255,255,255,0.04))';
                preEl.style.border = '1px solid var(--border, #333)';
                preEl.style.borderRadius = '12px';
                preEl.style.overflow = 'hidden';
                preEl.style.display = 'flex';
                preEl.style.justifyContent = 'center';
                preEl.style.padding = '0';
                
                // Limpa o conteúdo original
                preEl.innerHTML = '';
                
                // Cria o SVG
                const svgId = 'markmap-svg-' + Math.random().toString(36).substr(2, 9);
                const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svgEl.setAttribute('id', svgId);
                svgEl.style.width = '100%';
                svgEl.style.height = '100%';
                svgEl.style.minHeight = '300px';
                preEl.appendChild(svgEl);
                
                try {
                    const { Transformer } = window.markmap;
                    const transformer = new Transformer();
                    const { root: markmapRoot, features } = transformer.transform(markdownContent);
                    
                    const { Markmap, loadCSS, loadJS } = window.markmap;
                    // Se tiver plugins (como katex), o loadJS / loadCSS seriam necessários, mas para o básico não precisamos
                    
                    Markmap.create(svgEl, null, markmapRoot);
                } catch (e) {
                    console.error("Markmap error", e);
                    preEl.innerHTML = `<div style="color:red; padding: 10px;">Erro ao renderizar Mapa Mental.</div><pre style="font-size:12px;">${markdownContent}</pre>`;
                }
            });
        });
    },

    stripGenerated(root) {
        // Remover SVGs e restaurar o texto se formos limpar o HTML,
        // Mas a lógica do BookList já recria baseado no textContent, 
        // ou recriamos a tag original
        const rendered = root.querySelectorAll('pre.markmap-rendered');
        rendered.forEach(pre => {
            // Em caso de extração, isso pode ser necessário, mas o notes.js atual lê o attr 'data-raw' no modo LP
            // ou usa replace direto no markdown.
        });
    }
};
