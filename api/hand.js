import { handleHand } from '../worker/hand-api.js';
import { redisHandStore } from '../worker/redis-store.js';

export default {
  fetch(request) {
    const env = process.env;
    const configured = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
    const url = configured ? env.UPSTASH_REDIS_REST_URL : env.KV_REST_API_URL;
    const token = configured ? env.UPSTASH_REDIS_REST_TOKEN : env.KV_REST_API_TOKEN;
    if (!url || !token) {
      console.error('Connect an Upstash Redis database to the Vercel project.');
      return Response.json({ error: 'The table is temporarily unavailable. Please try again.' }, {
        status: 503, headers: { 'cache-control': 'no-store' }
      });
    }
    return handleHand(request, redisHandStore(url, token));
  }
};
