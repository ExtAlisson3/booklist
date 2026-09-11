import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

class LocalStorageMock {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
    setItem(key, value) { this.data.set(key, String(value)); }
    removeItem(key) { this.data.delete(key); }
    clear() { this.data.clear(); }
}

export function createStorageEnvironment(options = {}) {
    const localStorage = new LocalStorageMock();
    const sandbox = {
        console, crypto: webcrypto, TextEncoder, TextDecoder, structuredClone,
        localStorage, navigator: { onLine: true }, indexedDB: undefined,
        document: { getElementById: () => null, createElement: () => ({ click() {} }) },
        Blob, URL, FormData, Date, JSON, Math, Array, Object, String, Number, Boolean,
        setTimeout: () => 0, clearTimeout: () => {},
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary')
    };
    sandbox.window = sandbox;
    sandbox.BookListConfig = options.BookListConfig;
    sandbox.window.addEventListener = () => {};
    vm.createContext(sandbox);
    const storageSource = fs.readFileSync(new URL('../../js/storage.js', import.meta.url), 'utf8');
    vm.runInContext(`${storageSource}\nglobalThis.__Storage = Storage;`, sandbox, { filename: 'storage.js' });
    const portabilitySource = fs.readFileSync(new URL('../../js/modules/storage-portability.js', import.meta.url), 'utf8');
    vm.runInContext(`${portabilitySource}\nglobalThis.__Portability = StoragePortability;`, sandbox, { filename: 'storage-portability.js' });
    const Storage = sandbox.__Storage;
    Storage._db = null;
    Storage._cache = {};
    return { Storage, Portability: sandbox.__Portability, localStorage, sandbox };
}
