import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSite, outputDirectory, viewDirectory } from './build.mjs';

const preview = process.argv.includes('--preview');
const port = Number(process.env.PORT || 4173);
const clients = new Set();
await buildSite();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (!preview && pathname === '/__reload') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  const file = path.resolve(outputDirectory, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${outputDirectory}${path.sep}`)) { response.writeHead(403).end(); return; }
  try {
    let data = await readFile(file);
    if (!preview && file.endsWith('.html')) data = Buffer.from(data.toString().replace('</body>', '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script></body>'));
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  } catch { response.writeHead(404).end('Arquivo não encontrado'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
if (!preview) {
  let timer, running = false, queued = false;
  async function rebuild() {
    if (running) { queued = true; return; }
    running = true;
    try { await buildSite(); for (const client of clients) client.write('data: reload\n\n'); }
    catch (error) { console.error(error); }
    finally { running = false; if (queued) { queued = false; await rebuild(); } }
  }
  for (const folder of [path.join(viewDirectory, '..', 'Stack'), path.join(viewDirectory, 'src'), path.join(viewDirectory, 'assets')]) {
    watch(folder, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 150); });
  }
}
