// Return the stored row even when a concurrent request already advanced it.
const saveHand = `
local current = redis.call('GET', KEYS[1])
local revision = current and cjson.decode(current).revision or 0
if revision ~= tonumber(ARGV[1]) then return current end
redis.call('SET', KEYS[1], ARGV[2], 'EX', 86400)
return ARGV[2]
`;

export function redisHandStore(url, token) {
  async function command(args) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error('Redis request failed.');
    const body = await response.json();
    if (body.error) throw new Error('Redis command failed.');
    return body.result == null ? null : JSON.parse(body.result);
  }

  const key = id => `jbpercival:hand:${id}`;
  return {
    read: id => command(['GET', key(id)]),
    write: (id, revision, state) => command([
      'EVAL', saveHand, 1, key(id), revision, JSON.stringify({ revision: revision + 1, state })
    ])
  };
}
