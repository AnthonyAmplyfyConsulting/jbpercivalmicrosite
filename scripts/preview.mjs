import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
await import('./build.mjs');
const { default: worker } = await import('../dist/server/index.js');
const db = new DatabaseSync(':memory:');
db.exec(await readFile('drizzle/0000_rounds.sql', 'utf8'));
const DB = {
  prepare(sql) {
    const statement = db.prepare(sql);
    return { bind: (...args) => ({
      first: async () => statement.get(...args),
      run: async () => statement.run(...args)
    }) };
  }
};
const portArg = process.argv.indexOf('--port');
const hostArg = process.argv.indexOf('--host');
const port = Number((portArg >= 0 && process.argv[portArg + 1]) || process.env.PORT || 3000);
const host = (hostArg >= 0 && process.argv[hostArg + 1]) || '127.0.0.1';
createServer(async (req, res) => {
  try {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers,
      body: body.length ? Buffer.concat(body) : undefined
    });
    const response = await worker.fetch(request, { DB });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
}).listen(port, host, () => console.log(`Blackjack preview on port ${port}`));
