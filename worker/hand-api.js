import { act, deal, publicHand } from './game.js';

const cookieName = 'jbp_hand';
const privateHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(value, status = 200, cookie) {
  const headers = new Headers(privateHeaders);
  if (cookie) headers.set('set-cookie', cookie);
  return Response.json(value, { status, headers });
}

async function game(request, store, url) {
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)jbp_hand=([a-f0-9-]{36})(?:;|$)/)?.[1];
  if (request.method === 'GET') return json(cookie ? publicHand(await store.read(cookie)) : null);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
  const data = await request.json().catch(() => null);
  const action = data?.action;
  if (!['deal', 'hit', 'stand'].includes(action)) return json({ error: 'Invalid move.' }, 400);

  const id = cookie || crypto.randomUUID();
  const existing = await store.read(id);
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
  const saved = await store.write(id, existing?.revision ?? 0, JSON.stringify(round));

  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return json(publicHand(saved), 200,
    `${cookieName}=${id}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}`);
}

export async function handleHand(request, store) {
  try {
    return await game(request, store, new URL(request.url));
  } catch {
    console.error('Blackjack hand storage unavailable.');
    return json({ error: 'The table is temporarily unavailable. Please try again.' }, 503);
  }
}
