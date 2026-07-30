'use strict';

const http = require('http');
const https = require('https');

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const MAX_BINARY_LENGTH = 20 * 1024 * 1024;

class ReolinkTransport {
    constructor(config) {
        this.config = config;
    }

    requestJson(path, body) {
        const payload = body ? JSON.stringify(body) : '';
        const options = {
            hostname: this.config.host,
            port: this.config.port,
            path,
            method: body ? 'POST' : 'GET',
            headers: body ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            } : {}
        };

        return this.requestJsonWithRedirects(options, payload);
    }

    requestJsonWithRedirects(options, payload, redirectCount = 0) {
        return new Promise((resolve, reject) => {
            const requestOptions = this.normalizeOptions(options);
            const transport = this.transportFor(requestOptions.protocol);
            const req = transport.request(requestOptions, res => {
                const statusCode = res.statusCode || 0;

                if (this.isRedirect(statusCode, res.headers.location)) {
                    res.resume();
                    if (redirectCount >= MAX_REDIRECTS) {
                        reject(new Error('Reolink redirect limit exceeded'));
                        return;
                    }
                    this.requestJsonWithRedirects(
                        this.redirectOptions(requestOptions, res.headers.location),
                        payload,
                        redirectCount + 1
                    ).then(resolve, reject);
                    return;
                }

                let responseBody = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { responseBody += chunk; });
                res.on('end', () => {
                    if (statusCode < 200 || statusCode >= 300) {
                        reject(new Error(`Reolink HTTP ${statusCode}`));
                        return;
                    }
                    try {
                        resolve(responseBody ? JSON.parse(responseBody) : null);
                    } catch (error) {
                        reject(new Error(`Invalid Reolink JSON response: ${error.message}`));
                    }
                });
            });

            this.finishRequest(req, payload, 'Reolink request timed out', reject);
        });
    }

    requestJpeg(options, redirectCount = 0) {
        return new Promise((resolve, reject) => {
            const requestOptions = this.normalizeOptions(options);
            const transport = this.transportFor(requestOptions.protocol);
            const req = transport.request(requestOptions, res => {
                const statusCode = res.statusCode || 0;

                if (this.isRedirect(statusCode, res.headers.location)) {
                    res.resume();
                    if (redirectCount >= MAX_REDIRECTS) {
                        reject(new Error('Reolink snapshot redirect limit exceeded'));
                        return;
                    }
                    this.requestJpeg(
                        this.redirectOptions(requestOptions, res.headers.location),
                        redirectCount + 1
                    ).then(resolve, reject);
                    return;
                }

                const chunks = [];
                let length = 0;
                res.on('data', chunk => {
                    length += chunk.length;
                    if (length > MAX_BINARY_LENGTH) {
                        req.destroy(new Error('Reolink snapshot exceeded 20 MiB'));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    if (statusCode < 200 || statusCode >= 300) {
                        reject(new Error(`Reolink snapshot HTTP ${statusCode}`));
                        return;
                    }
                    const data = Buffer.concat(chunks);
                    const isJpeg = data.length >= 4 && data[0] === 0xff &&
                        data[1] === 0xd8 && data[data.length - 2] === 0xff &&
                        data[data.length - 1] === 0xd9;
                    if (!isJpeg) {
                        const contentType = res.headers['content-type'] || 'missing';
                        reject(new Error(
                            `Reolink snapshot was not JPEG (content-type=${contentType}, bytes=${data.length})`
                        ));
                        return;
                    }
                    resolve({ data, contentType: 'image/jpeg' });
                });
            });

            this.finishRequest(req, null, 'Reolink snapshot request timed out', reject);
        });
    }

    normalizeOptions(options) {
        const protocol = options.protocol || 'http:';
        const requestOptions = { ...options, protocol };
        if (protocol === 'https:' && requestOptions.rejectUnauthorized === undefined)
            requestOptions.rejectUnauthorized = false;
        return requestOptions;
    }

    transportFor(protocol) {
        return protocol === 'https:' ? https : http;
    }

    isRedirect(statusCode, location) {
        return REDIRECT_STATUS_CODES.has(statusCode) && Boolean(location);
    }

    redirectOptions(requestOptions, location) {
        const hostname = requestOptions.hostname || requestOptions.host;
        const port = requestOptions.port ? `:${requestOptions.port}` : '';
        const currentUrl = `${requestOptions.protocol}//${hostname}${port}${requestOptions.path || '/'}`;
        const redirectUrl = new URL(location, currentUrl);

        return {
            ...requestOptions,
            protocol: redirectUrl.protocol,
            hostname: redirectUrl.hostname,
            host: undefined,
            port: redirectUrl.port || (redirectUrl.protocol === 'https:' ? 443 : 80),
            path: redirectUrl.pathname.includes('/cgi-bin/api.cgi')
                ? `${redirectUrl.pathname}${redirectUrl.search}`
                : requestOptions.path,
            headers: { ...requestOptions.headers, host: redirectUrl.host }
        };
    }

    finishRequest(req, payload, timeoutMessage, reject) {
        req.setTimeout(this.config.timeoutMs, () => req.destroy(new Error(timeoutMessage)));
        req.on('error', reject);
        if (payload !== undefined && payload !== null)
            req.write(payload);
        req.end();
    }
}

module.exports = ReolinkTransport;
