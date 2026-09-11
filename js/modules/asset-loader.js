/* Lazy external assets: features load their heavier dependencies only when needed. */
const AssetLoader = {
    pending: new Map(),
    script(src, globalName) {
        if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
        if (this.pending.has(src)) return this.pending.get(src);
        const promise = new Promise((resolve, reject) => {
            const node = document.createElement('script');
            node.src = src;
            node.defer = true;
            node.onload = () => resolve(globalName ? window[globalName] : true);
            node.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
            document.head.appendChild(node);
        });
        this.pending.set(src, promise);
        return promise;
    },
    chart() { return this.script('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js', 'Chart'); }
};
window.AssetLoader = AssetLoader;
