'use strict';

const fs = require('node:fs/promises');

async function readCredential(value, label) {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value !== 'string' || value.length === 0)
        throw new TypeError(`${label} must be a PEM buffer or file path`);
    return fs.readFile(value);
}

class ProtectCertificateStore {
    constructor(config = {}) {
        this.config = config;
    }

    async load() {
        const cert = await readCredential(
            this.config.cert ?? this.config.certPath,
            'Protect client certificate'
        );
        const key = await readCredential(
            this.config.key ?? this.config.keyPath,
            'Protect client private key'
        );
        const caValue = this.config.ca ?? this.config.caPath;
        const ca = caValue == null
            ? undefined
            : await readCredential(caValue, 'Protect CA certificate');

        return Object.freeze({ cert, key, ca });
    }
}

module.exports = {
    ProtectCertificateStore,
    readCredential
};
