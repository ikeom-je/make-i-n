// HTTP ハンドラ。静的配信・talk API・メディア配信・GenMedia 代理。

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './data.js';
import { GenMediaError } from './genmedia/vertex.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};
const STATIC = {
  '/src/': path.join(ROOT, 'src'),
};
const VENDOR = {
  '/vendor/pptxgen.bundle.js': path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js'),
};
const MAX_BODY = 1024 * 1024;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function sendFile(req, res, file) {
  let stat;
  try {
    stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error('not file');
  } catch {
    return send(res, 404, { error: 'not found' });
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  // 動画・音声のシーク(Safari は Range 必須)に対応する。
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

function underDir(dir, rel) {
  const abs = path.resolve(dir, '.' + path.sep + rel);
  return abs.startsWith(dir + path.sep) ? abs : null;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new GenMediaError('リクエストが大きすぎます', { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// 127.0.0.1 バインドに加え、別オリジンのページからの POST(CSRF)で課金 API を叩かれないようにする。
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.headers['sec-fetch-site'] !== 'cross-site';
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const KIND_HANDLERS = {
  image: (c, b) => c.generateImage({ prompt: b.prompt, aspectRatio: b.aspectRatio }),
  tts: (c, b) => c.synthesizeSpeech({ text: b.prompt, voice: b.voice }),
  video: (c, b) => c.generateVideo({ prompt: b.prompt }),
  music: (c, b) => c.generateMusic({ prompt: b.prompt }),
};

export function createApp({ store, registry, getGenMedia }) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    try {
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        return sendFile(req, res, path.join(ROOT, 'src/client/index.html'));
      }
      if (req.method === 'GET' && VENDOR[p]) return sendFile(req, res, VENDOR[p]);
      for (const [prefix, dir] of Object.entries(STATIC)) {
        if (req.method === 'GET' && p.startsWith(prefix)) {
          const file = underDir(dir, p.slice(prefix.length));
          return file ? sendFile(req, res, file) : send(res, 404, { error: 'not found' });
        }
      }
      if (req.method === 'GET' && p.startsWith('/media/')) {
        const file = store.absMedia(p.slice('/media/'.length));
        return file ? sendFile(req, res, file) : send(res, 404, { error: 'not found' });
      }
      if (req.method === 'GET' && p === '/api/talks') {
        return send(res, 200, { talks: store.listTalks() });
      }
      if (req.method === 'GET' && p.startsWith('/api/talks/')) {
        const talk = store.loadTalk(p.slice('/api/talks/'.length));
        if (!talk) return send(res, 404, { error: 'talk not found' });
        const profile = store.loadProfile();
        return send(res, 200, { talk, profile, media: store.mediaFor(profile), components: registry.list() });
      }
      if (req.method === 'GET' && p === '/api/genmedia/status') {
        const g = getGenMedia();
        return send(res, 200, { configured: Boolean(g.client), reason: g.error ?? null, models: g.client?.model ?? null });
      }
      if (req.method === 'POST' && p === '/api/genmedia') {
        if (!sameOrigin(req)) return send(res, 403, { error: 'cross-origin request rejected' });
        const body = await readJson(req);
        const handler = KIND_HANDLERS[body.kind];
        if (!handler) return send(res, 400, { error: `unknown kind: ${body.kind}` });
        if (!/^[\w-]+$/.test(body.slot ?? '')) return send(res, 400, { error: 'invalid slot' });
        if (typeof body.prompt !== 'string' || !body.prompt.trim()) return send(res, 400, { error: 'prompt is required' });
        const g = getGenMedia();
        if (!g.client) return send(res, 503, { error: g.error ?? 'GenMedia is not configured', code: 'NOT_CONFIGURED' });
        const out = await handler(g.client, body);
        store.saveGenerated(body.slot, {
          kind: body.kind, ext: out.ext, data: out.data,
          prompt: body.kind === 'tts' ? undefined : body.prompt,
          text: body.kind === 'tts' ? body.prompt : undefined,
        });
        const profile = store.loadProfile();
        return send(res, 200, { media: store.mediaFor(profile) });
      }
      return send(res, 404, { error: 'not found' });
    } catch (err) {
      const status = err instanceof GenMediaError ? (err.status && err.status < 500 && err.status !== 429 ? err.status : 502) : 500;
      if (!(err instanceof GenMediaError)) console.error(err);
      return send(res, status, { error: err.message, code: err.code ?? null });
    }
  };
}
