import { act, deal, publicHand } from './game.js';
import { assets } from './assets.js';

const cookieName = 'jbp_hand';
const privateHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(value, status = 200, cookie) {
  const headers = new Headers(privateHeaders);
  if (cookie) headers.set('set-cookie', cookie);
  return Response.json(value, { status, headers });
}

const read = (db, id) => db.prepare('SELECT revision, state FROM hands WHERE id = ?').bind(id).first();

async function game(request, env, url) {
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)jbp_hand=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const db = env.DB;
  if (request.method === 'GET') return json(cookie ? publicHand(await read(db, cookie)) : null);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
  const data = await request.json().catch(() => null);
  const action = data?.action;
  if (!['deal', 'hit', 'stand'].includes(action)) return json({ error: 'Invalid move.' }, 400);

  const id = cookie || crypto.randomUUID();
  const existing = await read(db, id);
  if (action === 'deal') {
    if (existing) {
      const round = publicHand(existing);
      if (!round.outcome || data.revision !== existing.revision) return json(round);
    }
  } else if (!existing || existing.revision !== data.revision || publicHand(existing).outcome) {
    return json({ error: 'This hand changed. Refreshing the table.', hand: publicHand(existing) }, 409);
  }

  const round = action === 'deal' ? deal() : JSON.parse(existing.state);
  if (action !== 'deal') act(round, action);
  if (existing) {
    await db.prepare('UPDATE hands SET revision = revision + 1, state = ?, updated = ? WHERE id = ? AND revision = ?')
      .bind(JSON.stringify(round), Date.now(), id, existing.revision).run();
  } else {
    await db.prepare('INSERT INTO hands (id, revision, state, updated) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(id, JSON.stringify(round), Date.now()).run();
  }

  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return json(publicHand(await read(db, id)), 200,
    `${cookieName}=${id}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/hand') {
      try {
        return await game(request, env, url);
      } catch (error) {
        console.error('Blackjack request failed', error);
        return json({ error: 'The table is temporarily unavailable. Please try again.' }, 503);
      }
    }
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found', { status: 404 });
    const [type, data] = asset;
    return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(data), c => c.charCodeAt(0)), {
      headers: {
        'content-type': type,
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'; base-uri 'none'"
      }
    });
  }
};
