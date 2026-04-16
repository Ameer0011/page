// ============================================================
// functions/api/config.js
// GET  /api/config  →  { global, overrides }
// POST /api/config  ←  { global, overrides }
// ============================================================

async function checkAuth(request, env) {
    const token = request.headers.get('x-auth') || '';
    if (!env.IPTV_KV) return true; // dev fallback: no KV = open
    const val = await env.IPTV_KV.get(`token:${token}`);
    return val === '1';
}

async function getConfig(env) {
    let global_cfg = { active: false, url: 'https://c.top4top.io/m_3691x315n1.mp4' };
    let overrides = {};

    if (env.IPTV_KV) {
        const g = await env.IPTV_KV.get('global_config', { type: 'json' });
        if (g) global_cfg = g;
        const o = await env.IPTV_KV.get('individual_overrides', { type: 'json' });
        if (o) overrides = o;
    }
    return { global: global_cfg, overrides };
}

export async function onRequestGet({ request, env }) {
    if (!await checkAuth(request, env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const cfg = await getConfig(env);
    return Response.json(cfg);
}

export async function onRequestPost({ request, env }) {
    if (!await checkAuth(request, env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    if (env.IPTV_KV) {
        if (body.global)    await env.IPTV_KV.put('global_config', JSON.stringify(body.global));
        if (body.overrides) await env.IPTV_KV.put('individual_overrides', JSON.stringify(body.overrides));
    }
    return Response.json({ ok: true });
}
