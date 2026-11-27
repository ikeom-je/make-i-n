import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createDefaultRegistry } from '../src/components/index.js';
import { createApp } from '../server/app.js';
import { ROOT, createDataStore } from '../server/data.js';

function tempDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-srv-'));
  fs.cpSync(path.join(ROOT, 'data/example'), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'media/clip.mp4'), Buffer.from('0123456789'));
  return dir;
}

async function withServer(genmedia, fn) {
  const dir = tempDataDir();
  const store = createDataStore(dir);
  const server = http.createServer(createApp({ store, registry: createDefaultRegistry(), getGenMedia: () => genmedia }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, dir);
  } finally {
    server.close();
  }
}

const fakeClient = {
  model: { image: 'm' },
  generateImage: async ({ prompt }) => ({ ext: 'png', data: Buffer.from(`img:${prompt}`) }),
};

test('トップページ・共通モジュール・PPTX ライブラリ(ローカル同梱)を配信する', async () => {
  await withServer({ client: null, error: 'x' }, async (base) => {
    assert.match(await (await fetch(`${base}/`)).text(), /JP<\/button>/);
    assert.equal((await fetch(`${base}/src/core/talk.js`)).status, 200);
    const vendor = await fetch(`${base}/vendor/pptxgen.bundle.js`);
    assert.equal(vendor.status, 200);
  });
});

test('talk 一覧と talk 本体(profile・メディア解決済み)を返す', async () => {
  await withServer({ client: null }, async (base) => {
    const { talks } = await (await fetch(`${base}/api/talks`)).json();
    assert.deepEqual(talks.map((t) => t.id), ['sample-intro', 'sample-30s']);
    const body = await (await fetch(`${base}/api/talks/sample-intro`)).json();
    assert.equal(body.talk.id, 'sample-intro');
    assert.equal(body.profile.name.en, 'Hanako Yamada');
    assert.equal(body.media.portrait.file, null);
    assert.equal(body.media.narration_en.text, 'Hi, I\'m Hanako Yamada, an engineer who loves to build small and ship far.');
    assert.equal((await fetch(`${base}/api/talks/nope`)).status, 404);
  });
});

test('データディレクトリの profile などはメディアとして取得できない', async () => {
  await withServer({ client: null }, async (base) => {
    assert.equal((await fetch(`${base}/media/profile.yaml`)).status, 404);
    assert.equal((await fetch(`${base}/media/..%2Fprofile.yaml`)).status, 404);
    assert.equal((await fetch(`${base}/src/..%2Fserver%2Fapp.js`)).status, 404);
  });
});

test('動画は Range リクエストで部分取得できる', async () => {
  await withServer({ client: null }, async (base) => {
    const res = await fetch(`${base}/media/media/clip.mp4`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(res.status, 206);
    assert.equal(await res.text(), '2345');
    assert.equal(res.headers.get('content-range'), 'bytes 2-5/10');
  });
});

test('GenMedia 未設定なら 503 と理由を返す', async () => {
  await withServer({ client: null, error: 'GOOGLE_CLOUD_PROJECT が未設定です' }, async (base) => {
    const status = await (await fetch(`${base}/api/genmedia/status`)).json();
    assert.equal(status.configured, false);
    const res = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'image', slot: 'portrait', prompt: 'x' }) });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /GOOGLE_CLOUD_PROJECT/);
  });
});

test('別オリジンからの生成リクエストは拒否する', async () => {
  await withServer({ client: fakeClient }, async (base) => {
    const res = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ kind: 'image', slot: 'portrait', prompt: 'x' }) });
    assert.equal(res.status, 403);
  });
});

test('不正な種類・スロット名・空プロンプトは 400', async () => {
  await withServer({ client: fakeClient }, async (base) => {
    const post = (b) => fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    assert.equal((await post({ kind: 'hologram', slot: 'a', prompt: 'x' })).status, 400);
    assert.equal((await post({ kind: 'image', slot: '../x', prompt: 'x' })).status, 400);
    assert.equal((await post({ kind: 'image', slot: 'a', prompt: '  ' })).status, 400);
  });
});

test('生成に成功すると generated/ に保存され、そのスロットが新しいファイルに差し替わる', async () => {
  await withServer({ client: fakeClient }, async (base, dir) => {
    const res = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ kind: 'image', slot: 'portrait', prompt: 'blocks' }) });
    assert.equal(res.status, 200);
    const { media } = await res.json();
    assert.match(media.portrait.file, /^generated\/portrait-.*\.png$/);
    assert.equal(media.portrait.prompt, 'blocks');
    assert.equal(fs.readFileSync(path.join(dir, media.portrait.file), 'utf8'), 'img:blocks');
    const served = await fetch(`${base}/media/${media.portrait.file}`);
    assert.equal(await served.text(), 'img:blocks');
  });
});

test('不正なパーセントエンコードの URL でもサーバーは落ちず 400 を返す', async () => {
  await withServer({ client: null }, async (base) => {
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await fetch(`${base}/api/talks`)).status, 200, 'その後も応答する');
  });
});

test('ループバック以外の Host 宛て(DNS rebinding)は拒否する', async () => {
  await withServer({ client: fakeClient }, async (base) => {
    const port = new URL(base).port;
    const res = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port, path: '/api/talks/sample-intro', headers: { Host: `evil.example:${port}` } }, resolve);
    });
    assert.equal(res.statusCode, 421);
    res.resume();
  });
});

test('生成 API は JSON 以外の Content-Type と壊れた JSON を 4xx で拒否する', async () => {
  await withServer({ client: fakeClient }, async (base) => {
    const form = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    assert.equal(form.status, 415);
    const broken = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(broken.status, 400);
  });
});

test('Origin が無くても Sec-Fetch-Site が cross-site なら拒否する', async () => {
  await withServer({ client: fakeClient }, async (base) => {
    const res = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: JSON.stringify({ kind: 'image', slot: 'a', prompt: 'x' }) });
    assert.equal(res.status, 403);
  });
});

test('上流の著作権フィルタ停止は 422、その他の上流失敗は 502 で返す', async () => {
  const { GenMediaError } = await import('../server/genmedia/vertex.js');
  const failing = (code) => ({ model: {}, generateImage: async () => { throw new GenMediaError('x', { code, status: 403 }); } });
  for (const [code, status] of [['RECITATION', 422], ['HTTP_ERROR', 502]]) {
    await withServer({ client: failing(code) }, async (base) => {
      const res = await fetch(`${base}/api/genmedia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'image', slot: 'a', prompt: 'x' }) });
      assert.equal(res.status, status);
    });
  }
});

test('範囲外の Range 指定は 416', async () => {
  await withServer({ client: null }, async (base) => {
    assert.equal((await fetch(`${base}/media/media/clip.mp4`, { headers: { Range: 'bytes=50-60' } })).status, 416);
  });
});
