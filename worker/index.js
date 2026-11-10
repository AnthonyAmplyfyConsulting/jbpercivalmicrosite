import { handleHand } from './hand-api.js';
import { assets } from './assets.js';

function d1Store(db) {
  const read = id => db.prepare('SELECT revision, state FROM hands WHERE id = ?').bind(id).first();
  return {
    read,
    async write(id, revision, state) {
      if (revision) {
        await db.prepare('UPDATE hands SET revision = revision + 1, state = ?, updated = ? WHERE id = ? AND revision = ?')
          .bind(state, Date.now(), id, revision).run();
      } else {
        await db.prepare('INSERT INTO hands (id, revision, state, updated) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
          .bind(id, state, Date.now()).run();
      }
      return read(id);
    }
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/hand') return handleHand(request, d1Store(env.DB));
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
