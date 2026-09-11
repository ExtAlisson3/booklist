/* Route registry for gradual extraction from App.renderPage. */
const PageRouter = {
    routes: new Map(),
    register(page, render) { this.routes.set(page, render); return this; },
    render(page, main) {
        const handler = this.routes.get(page);
        if (!handler) return false;
        handler(main, page);
        return true;
    }
};

window.PageRouter = PageRouter;
