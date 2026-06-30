'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const resolvedHostCache = new Map();

function normalizeHost(value) {
    const host = String(value || '').trim().replace(/\/$/, '');
    if (!host) return '';

    if (/^https?:\/\//i.test(host)) {
        const url = new URL(host);
        return url.host;
    }

    return host;
}

function toSunberryBaseUrl(value) {
    const host = normalizeHost(value);
    if (!host) throw new Error('Sunberry host is required');
    return `http://${host}`;
}

function isLocalHostname(host) {
    return /\.local(?::\d+)?$/i.test(host);
}

function splitHostAndPort(host) {
    const index = host.lastIndexOf(':');
    if (index <= 0 || host.includes(']')) return { hostname: host, port: '' };

    const hostname = host.slice(0, index);
    const port = host.slice(index + 1);
    return /^\d+$/.test(port) ? { hostname, port } : { hostname: host, port: '' };
}

async function resolveHost(host, { lookup = dns.lookup } = {}) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return normalizedHost;

    const { hostname, port } = splitHostAndPort(normalizedHost);
    if (net.isIP(hostname) || !isLocalHostname(hostname)) return normalizedHost;

    const cacheKey = normalizedHost.toLowerCase();
    if (resolvedHostCache.has(cacheKey)) return resolvedHostCache.get(cacheKey);

    const result = await lookup(hostname, { family: 4 });
    const resolved = `${result.address}${port ? `:${port}` : ''}`;
    resolvedHostCache.set(cacheKey, resolved);
    return resolved;
}

async function resolveBaseUrl(baseUrl, options = {}) {
    const url = new URL(baseUrl);
    const resolvedHost = await resolveHost(url.host, options);
    url.host = resolvedHost;
    return url.origin;
}

module.exports = {
    normalizeHost,
    resolveBaseUrl,
    resolveHost,
    toSunberryBaseUrl,
    _private: {
        resolvedHostCache,
        splitHostAndPort
    }
};
