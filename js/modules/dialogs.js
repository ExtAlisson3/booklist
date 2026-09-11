/* BookList dialog service: async replacements for browser prompt/confirm. */
const BookListDialogs = {
    _resolve: null,
    _previousFocus: null,
    _keydown: null,

    close(value = null) {
        const overlay = document.getElementById('booklist-dialog-overlay');
        overlay?.classList.remove('active');
        overlay?.remove();
        if (this._keydown) document.removeEventListener('keydown', this._keydown);
        this._keydown = null;
        const resolve = this._resolve;
        this._resolve = null;
        resolve?.(value);
        this._previousFocus?.focus?.();
        this._previousFocus = null;
    },

    open({ title = 'Informação', description = '', fields = [], confirmText = 'Continuar', danger = false } = {}) {
        this.close(null);
        return new Promise(resolve => {
            this._resolve = resolve;
            this._previousFocus = document.activeElement;
            const overlay = document.createElement('div');
            overlay.id = 'booklist-dialog-overlay';
            overlay.className = 'confirm-overlay active booklist-input-dialog';
            const formFields = fields.map(field => {
                const id = `booklist-dialog-${field.name}`;
                const label = App.escapeHtml(field.label || field.name);
                const value = App.escapeHtml(field.value ?? '');
                if (field.type === 'textarea') return `<div class="form-group"><label for="${id}">${label}</label><textarea id="${id}" name="${App.escapeHtml(field.name)}" rows="${field.rows || 6}" placeholder="${App.escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>${value}</textarea></div>`;
                if (field.type === 'select') return `<div class="form-group"><label for="${id}">${label}</label><select id="${id}" name="${App.escapeHtml(field.name)}">${(field.options || []).map(option => { const item = typeof option === 'string' ? { value: option, label: option } : option; return `<option value="${App.escapeHtml(item.value)}" ${String(item.value) === String(field.value ?? '') ? 'selected' : ''}>${App.escapeHtml(item.label)}</option>`; }).join('')}</select></div>`;
                return `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" name="${App.escapeHtml(field.name)}" type="${App.escapeHtml(field.type || 'text')}" value="${value}" placeholder="${App.escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''}></div>`;
            }).join('');
            overlay.innerHTML = `<form class="confirm-dialog booklist-dialog-card" onsubmit="BookListDialogs.submit(event)"><div class="confirm-header"><h3>${App.escapeHtml(title)}</h3></div>${description ? `<p>${App.escapeHtml(description)}</p>` : ''}<div class="booklist-dialog-fields">${formFields}</div><div class="confirm-actions"><button type="button" class="btn btn-secondary" onclick="BookListDialogs.close(null)">Cancelar</button><button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${App.escapeHtml(confirmText)}</button></div></form>`;
            overlay.addEventListener('click', event => { if (event.target === overlay) this.close(null); });
            document.body.appendChild(overlay);
            this._keydown = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(null); return; }
                if (event.key !== 'Tab') return;
                const focusable = [...overlay.querySelectorAll('button,input,textarea,select,[href],[tabindex]:not([tabindex="-1"])')].filter(node => !node.disabled && !node.hidden);
                if (!focusable.length) return;
                const first = focusable[0], last = focusable.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            };
            document.addEventListener('keydown', this._keydown);
            requestAnimationFrame(() => overlay.querySelector('input,textarea,select,button')?.focus());
        });
    },

    submit(event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        this.close(data);
    },

    confirm(message, options = {}) {
        return this.open({ title: options.title || 'Confirmar ação', description: message, fields: [], confirmText: options.confirmText || 'Confirmar', danger: options.danger !== false }).then(Boolean);
    },

    prompt(label, value = '', options = {}) {
        return this.open({ title: options.title || label, description: options.description || '', confirmText: options.confirmText || 'Aplicar', fields: [{ name: 'value', label, value, type: options.type || 'text', placeholder: options.placeholder || '', required: options.required !== false }] }).then(result => result?.value ?? null);
    }
};
window.BookListDialogs = BookListDialogs;
