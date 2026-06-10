/* Sqwords global leaderboard — Cloudflare Worker
   GET  /  -> { scores: [{name, score, mode, won, d}, ...] }  (top 50)
   POST /  -> submit a score; validated and rate-limited        */

const MAX_ENTRIES = 50;
const MAX_SCORE = 500;            // theoretical game max is ~445
const RATE_MS = 20000;            // min gap between submissions per IP

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method === 'GET') {
      const scores = JSON.parse((await env.LB.get('scores')) || '[]');
      return json({ scores });
    }

    if (request.method === 'POST') {
      // rate limit per IP
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const last = await env.LB.get('rl:' + ip);
      if (last && Date.now() - Number(last) < RATE_MS) {
        return json({ error: 'too fast — try again in a moment' }, 429);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'bad json' }, 400); }

      // strict validation: only well-formed game results get stored
      const name = String(body.name ?? '').replace(/[^\w \-'!.]/g, '').trim().slice(0, 12);
      const score = Number(body.score);
      const mode = body.mode === 'daily' ? 'daily' : 'random';
      const won = !!body.won;
      const d = String(body.d ?? '');
      if (!name) return json({ error: 'name required' }, 400);
      if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
        return json({ error: 'invalid score' }, 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: 'invalid date' }, 400);

      const scores = JSON.parse((await env.LB.get('scores')) || '[]');
      scores.push({ name, score, mode, won, d });
      scores.sort((a, b) => b.score - a.score);
      const trimmed = scores.slice(0, MAX_ENTRIES);

      await env.LB.put('scores', JSON.stringify(trimmed));
      await env.LB.put('rl:' + ip, String(Date.now()), { expirationTtl: 60 });

      const rank = trimmed.findIndex(e =>
        e.name === name && e.score === score && e.d === d) + 1;
      return json({ ok: true, rank: rank || null });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
