import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
const types = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', png: 'image/png', svg: 'image/svg+xml',
  webp: 'image/webp', woff2: 'font/woff2'
};
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
const assets = Object.fromEntries(await Promise.all((await readdir('public')).map(async name => [
  '/' + name, [types[name.split('.').at(-1)], (await readFile('public/' + name)).toString('base64')]
])));
await writeFile('dist/server/assets.js', 'export const assets = ' + JSON.stringify(assets) + ';');
await Promise.all(['index.js', 'game.js'].map(file => copyFile('worker/' + file, 'dist/server/' + file)));
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json').catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
