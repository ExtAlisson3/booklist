/* Progressive accessibility fixes for legacy templates rendered at runtime. */
const Accessibility = {
    enhance(root = document) {
        const select = selector => [
            ...(root.matches?.(selector) ? [root] : []),
            ...(root.querySelectorAll?.(selector) || [])
        ];
        select('button:not([type])').forEach(button => {
            if (!button.closest('form')) button.type = 'button';
        });
        select('button[title]:not([aria-label])').forEach(button => {
            button.setAttribute('aria-label', button.title);
        });
        select('[onclick]:not(button):not(a):not(input):not(select):not(textarea)').forEach(element => {
            if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
            if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
        });
        select('[role="dialog"]').forEach(dialog => {
            if (!dialog.hasAttribute('aria-modal')) dialog.setAttribute('aria-modal', 'true');
        });
    },
    init() {
        this.enhance();
        document.addEventListener('keydown', event => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'button') return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            target.click();
        });
        new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) this.enhance(node);
        }))).observe(document.body, { childList: true, subtree: true });
    }
};

document.addEventListener('DOMContentLoaded', () => Accessibility.init(), { once: true });
window.Accessibility = Accessibility;
