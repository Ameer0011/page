// ============================================================
// functions/proxy/[[path]].js
// Handles all proxy requests:
//   /proxy/video.m3u8?id=xxx&cat=yyy   → fetch + rewrite m3u8
//   /proxy/video.ts?url=xxx             → pipe raw TS bytes
//   /proxy/video.m3u8?url=xxx           → direct url proxy
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
        'raw', hexToBytes(API_KEY_HEX), { name: 'AES-CBC' }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: hexToBytes(API_IV_HEX) }, key, encryptedBytes
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
    } catch (e) { return null; }
}

async function getConfig(env) {
    let global_cfg = { active: false, url: '' };
    let overrides = {};
    if (env.IPTV_KV) {
        const g = await env.IPTV_KV.get('global_config', { type: 'json' });
        if (g) global_cfg = g;
        const o = await env.IPTV_KV.get('individual_overrides', { type: 'json' });
        if (o) overrides = o;
    }
    return { global_cfg, overrides };
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const proxyBase = url.origin + '/proxy';

    const { global_cfg, overrides } = await getConfig(env);

    // ---------- Global redirect mode ----------
    if (global_cfg.active && global_cfg.url) {
        return Response.redirect(global_cfg.url, 302);
    }

    // ---------- Resolve source URL ----------
    let sourceUrl = null;

    if (params.has('url')) {
        // Direct URL pass-through (used for TS segments)
        sourceUrl = decodeURIComponent(params.get('url'));
    } else if (params.has('id')) {
        const reqId   = params.get('id');
        const reqCat  = params.get('cat') || '';

        // Check individual override first
        if (overrides[reqId]) {
            sourceUrl = overrides[reqId];
        } else {
            const apiPath = reqCat
                ? `/api/v6.2/category/${reqCat}?page=1`
                : '/api/v6.2/main?page=1';
            const data = await fetchAndDecrypt(apiPath);
            const items = data?.data?.items ?? data?.data ?? [];
            for (const item of items) {
                if (String(item.id) === String(reqId)) {
                    sourceUrl = item.source;
                    break;
                }
            }
        }
    }

    if (!sourceUrl) {
        return new Response('Source not found', { status: 404, headers: corsHeaders });
    }

    // ---------- Fetch the source ----------
    try {
        const upstream = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(20000),
            redirect: 'follow'
        });

        const contentType = upstream.headers.get('content-type') || '';
        const body        = await upstream.text();
        const finalUrl    = upstream.url; // after redirects

        // ---------- HLS playlist? Rewrite segment URLs ----------
        if (contentType.includes('mpegurl') || body.trimStart().startsWith('#EXTM3U')) {
            const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
            const lines = body.split('\n').map(line => {
                line = line.trim();
                if (!line) return '';
                if (line.startsWith('#')) return line;
                // Segment URL — route through our proxy /proxy/video.ts
                const segUrl = line.startsWith('http') ? line : baseUrl + line;
                return `${proxyBase}/video.ts?url=${encodeURIComponent(segUrl)}`;
            });
            return new Response(lines.join('\n'), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Cache-Control': 'no-cache'
                }
            });
        }

        // ---------- Raw TS / direct video ----------
        // Re-fetch as binary for TS segments
        const upstream2 = await fetch(sourceUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
        });
        return new Response(upstream2.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'video/mp2t',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (e) {
        return new Response('Proxy error: ' + e.message, { status: 502, headers: corsHeaders });
    }
}

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}
