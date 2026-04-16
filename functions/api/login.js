// ============================================================
// functions/api/login.js
// POST /api/login  →  { ok, token }
// ============================================================

const MASTER_PASSWORD = "moha87"; // غيّر هذا

function makeToken() {
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const body = await request.json();
    if (body.password === MASTER_PASSWORD) {
        const token = makeToken();
        // Store token in KV with 8h expiry
        if (env.IPTV_KV) {
            await env.IPTV_KV.put(`token:${token}`, '1', { expirationTtl: 28800 });
        }
        return Response.json({ ok: true, token });
    }
    return Response.json({ ok: false }, { status: 401 });
}
