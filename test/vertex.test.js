import test from 'node:test';
import assert from 'node:assert/strict';
import { GenMediaError, createVertexClient } from '../server/genmedia/vertex.js';

const b64 = (s) => Buffer.from(s).toString('base64');

function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    const call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    return responder(call, calls.length);
  };
  fn.calls = calls;
  return fn;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

function client(fetchImpl, extra = {}) {
  return createVertexClient({ project: 'proj-1', getToken: async () => 'tok', fetchImpl, sleep: async () => {}, ...extra });
}

test('プロジェクト未設定ではクライアントを作れない', () => {
  assert.throws(() => createVertexClient({ project: '' }), GenMediaError);
});

test('画像生成は generateContent に IMAGE モダリティと比率を送り、最後の画像を採用する', async () => {
  const f = fakeFetch(() => json({ candidates: [{ content: { parts: [
    { text: 'draft' }, { inlineData: { mimeType: 'image/png', data: b64('first') } }, { inlineData: { mimeType: 'image/png', data: b64('final') } },
  ] } }] }));
  const out = await client(f).generateImage({ prompt: 'library', aspectRatio: '1:1' });
  const call = f.calls[0];
  assert.equal(call.url, 'https://aiplatform.googleapis.com/v1/projects/proj-1/locations/global/publishers/google/models/gemini-nano-banana-2.1:generateContent');
  assert.deepEqual(call.body.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } });
  assert.equal(call.headers['x-goog-user-project'], 'proj-1');
  assert.equal(call.headers.Authorization, 'Bearer tok');
  assert.equal(out.data.toString(), 'final');
  assert.equal(out.ext, 'png');
});

test('音声合成は AUDIO モダリティと声を指定し、生 PCM は WAV に包んで返す', async () => {
  const f = fakeFetch(() => json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: b64('abcd') } }] } }] }));
  const out = await client(f).synthesizeSpeech({ text: 'Hi', voice: 'Puck' });
  assert.match(f.calls[0].url, /gemini-3\.8-flash-tts:generateContent$/);
  assert.deepEqual(f.calls[0].body.generationConfig.speechConfig, { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } });
  assert.equal(out.mime, 'audio/wav');
  assert.equal(out.data.subarray(0, 4).toString(), 'RIFF');
  assert.equal(out.data.readUInt32LE(24), 24000);
  assert.equal(out.data.length, 44 + 4);
});

test('音声合成が audio/wav で返ればそのまま保存する', async () => {
  const f = fakeFetch(() => json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: b64('RIFFxxxx') } }] } }] }));
  const out = await client(f).synthesizeSpeech({ text: 'Hi' });
  assert.equal(out.data.toString(), 'RIFFxxxx');
});

test('画像が返らない(ブロックされた)場合は理由付きのエラーになる', async () => {
  const f = fakeFetch(() => json({ promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(client(f).generateImage({ prompt: 'x' }), /SAFETY/);
});

test('動画生成は Interactions API を background で開始し、完了までポーリングして mp4 を取り出す', async () => {
  const f = fakeFetch((call, n) => {
    if (call.method === 'POST') return json({ id: 'int-1', status: 'in_progress' });
    if (n < 4) return json({ id: 'int-1', status: 'in_progress' });
    return json({ id: 'int-1', status: 'completed', steps: [{ content: [{ type: 'text', text: 'ok' }, { type: 'video', mime_type: 'video/mp4', data: b64('mp4data') }] }] });
  });
  const out = await client(f).generateVideo({ prompt: 'Generate a 6-second 16:9 video: books' });
  assert.equal(f.calls[0].url, 'https://aiplatform.googleapis.com/v1/projects/proj-1/locations/global/interactions');
  assert.deepEqual(f.calls[0].body, { model: 'gemini-omni-1.2-flash', input: 'Generate a 6-second 16:9 video: books', background: true });
  assert.match(f.calls[1].url, /\/interactions\/int-1$/);
  assert.equal(f.calls[1].method, 'GET');
  assert.equal(out.data.toString(), 'mp4data');
});

test('429 Resource exhausted は待って再試行し、成功すれば結果を返す', async () => {
  const f = fakeFetch((call, n) => (n <= 2 ? json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429)
    : json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: b64('j') } }] } }] })));
  const out = await client(f).generateImage({ prompt: 'x' });
  assert.equal(f.calls.length, 3);
  assert.equal(out.ext, 'jpg');
});

test('429 が再試行上限を超えたら RESOURCE_EXHAUSTED エラーになる', async () => {
  const f = fakeFetch(() => json({}, 429));
  await assert.rejects(client(f, { maxRetries: 2 }).generateImage({ prompt: 'x' }), (e) => e.code === 'RESOURCE_EXHAUSTED');
  assert.equal(f.calls.length, 3);
});

function sse(events) {
  const body = events.map((e) => `event: ${e.event_type ?? 'message'}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  // チャンク境界がイベントの途中に来ても連結できることを確かめるため細かく分割する。
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.subarray(i, i + 7)); c.close(); },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('音楽生成は stream:true の SSE から audio デルタを順に連結する', async () => {
  const f = fakeFetch(() => sse([
    { event_type: 'interaction.start' },
    { event_type: 'content.delta', delta: { type: 'audio', mime_type: 'audio/mpeg', data: b64('ID3-a') } },
    { event_type: 'content.delta', delta: { type: 'text', text: 'lyrics' } },
    { event_type: 'content.delta', delta: { type: 'audio', mime_type: 'audio/mpeg', data: b64('-b') } },
    { event_type: 'interaction.complete' },
  ]));
  const out = await client(f).generateMusic({ prompt: 'uplifting' });
  assert.deepEqual(f.calls[0].body, { model: 'lyria-3-pro-preview', input: 'uplifting', stream: true });
  assert.equal(out.data.toString(), 'ID3-a-b');
  assert.equal(out.ext, 'mp3');
});

test('音楽生成が著作権フィルタで止まったら言い換えを促すエラーになる', async () => {
  const f = fakeFetch(() => sse([{ event_type: 'error', error: { message: 'blocked', reason: 'RECITATION' } }]));
  await assert.rejects(client(f).generateMusic({ prompt: 'famous song' }), (e) => e.code === 'RECITATION');
});

test('音楽生成で音声が1つも返らなければエラーになる', async () => {
  const f = fakeFetch(() => sse([{ event_type: 'interaction.complete' }]));
  await assert.rejects(client(f).generateMusic({ prompt: 'x' }), (e) => e.code === 'NO_OUTPUT');
});
