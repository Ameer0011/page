// ============================================================
// functions/api/items.js
// GET /api/items?cat=xxx  →  { items: [...] }
// Mirrors the PHP fetchAndDecrypt logic using Web Crypto API
// ============================================================

const API_KEY_HEX  = '4E5C6D1A8B3FE8137A3B9DF26A9C4DE195267B8E6F6C0B4E1C3AE1D27F2B4E6F';
const API_IV_HEX   = 'A9C21F8D7E6B4A9DB12E4F9D5C1A7B8E';
const API_ID       = '714b6955acb12a33';
const BASE_DOMAIN  = 'xp-2.top';

function hexToBytes(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i*2, i*2+2), 16);
    return arr;
}

function generateRandomString(length = 40) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let s = '';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) s += chars[arr[i] % chars.length];
    return s;
}

async function decryptAES256CBC(encryptedBytes) {
    const key = await crypto.subtle.importKey(
        'raw',
        hexToBytes(API_KEY_HEX),
        { name: 'AES-CBC' },
        false,
        ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: hexToBytes(API_IV_HEX) },
        key,
        encryptedBytes
    );
    return new TextDecoder().decode(decrypted);
}

async function fetchAndDecrypt(apiPath) {
    const subdomain = generateRandomString();
    const url = `https://${subdomain}.${BASE_DOMAIN}${apiPath}`;
    try {
        const res = await fetch(url, {
            headers: {
                'id': API_ID,
                'user-agent': 'Mozilla/5.0 (Android 15; Mobile; rv:138.0) Gecko/138.0 Firefox/138.0',
                'accept-encoding': 'gzip'
            },
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const decrypted = await decryptAES256CBC(buf);
        return JSON.parse(decrypted);
    } catch (e) {
        return null;
    }
}

async function checkAuth(request, env) {
    const token = request.headers.get('x-auth') || '';
    if (!env.IPTV_KV) return true;
    const val = await env.IPTV_KV.get(`token:${token}`);
    return val === '1';
}

export async function onRequestGet({ request, env }) {
    if (!await checkAuth(request, env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const cat = url.searchParams.get('cat') || '';

    const apiPath = cat
        ? `/api/v6.2/category/${cat}?page=1`
        : '/api/v6.2/main?page=1';

    const data = await fetchAndDecrypt(apiPath);
    if (!data) return Response.json({ items: [] });

    const items = data?.data?.items ?? data?.data ?? [];
    return Response.json({ items });
}
