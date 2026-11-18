import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const dist = new URL('../sheets/dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('artifact-manifest.json', dist), 'utf8'));
const prefix = '/agentic-sheets/';
const routes = new Map(manifest.files.map(({path}) => [prefix + path, new URL(path, dist)]));
routes.set(prefix, new URL('index.html', dist));
routes.set(prefix + 'artifact-manifest.json', new URL('artifact-manifest.json', dist));
routes.set('/test-browser/sheets-check.mjs', new URL('../test-browser/sheets-check.mjs', import.meta.url));
const mime = {'.html':'text/html', '.mjs':'text/javascript', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json'};
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

const server = createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }
  const pathname = req.url.split('?')[0];
  if (pathname === '/' || pathname === '/agentic-sheets') {
    res.writeHead(308, { location: prefix }).end();
    return;
  }
  const file = routes.get(pathname);
  if (!file) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    const headers = { 'cache-control':'no-store', 'x-content-type-options':'nosniff', 'content-length':body.length,
      'content-type':(mime[extname(file.pathname)] ?? 'text/plain') + '; charset=utf-8' };
    if (file.pathname.endsWith('/index.html')) {
      // Loopback annotation tools insert a <style> element in their own shadow root.
      headers['content-security-policy-report-only'] = csp;
      headers['content-security-policy'] = csp + "; style-src-elem 'self' 'unsafe-inline'";
    }
    if (pathname === prefix + 'sw.js') headers['service-worker-allowed'] = prefix;
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error.message);
    res.writeHead(500).end();
  }
});
const port = Number(process.env.PORT ?? 4177);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
server.listen(port, '127.0.0.1', () => console.log('Sheets: http://127.0.0.1:' + port + prefix));
