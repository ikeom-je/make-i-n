// Vertex AI の GenMedia 代理呼び出し。トークンはサーバー側だけで扱い、ブラウザには出さない。

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsePcmMime, pcmToWav } from './wav.js';

export class GenMediaError extends Error {
  constructor(message, { status, code, detail } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

// GUI や launchd から起動したサーバーは PATH が短く、Homebrew の gcloud が見つからないことがあるため、
// 既定のインストール先も探す。
export function findGcloud({ env = process.env, exists = fs.existsSync, home = os.homedir() } = {}) {
  if (env.GCLOUD_BIN) return exists(env.GCLOUD_BIN) ? env.GCLOUD_BIN : null;
  const fromPath = (env.PATH ?? '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, 'gcloud'));
  const known = [
    '/opt/homebrew/bin/gcloud',
    '/usr/local/bin/gcloud',
    '/opt/homebrew/share/google-cloud-sdk/bin/gcloud',
    '/usr/local/share/google-cloud-sdk/bin/gcloud',
    path.join(home, 'google-cloud-sdk/bin/gcloud'),
  ];
  return [...fromPath, ...known].find((p) => exists(p)) ?? null;
}

export function gcloudTokenProvider({ ttlMs = 5 * 60 * 1000, exec = execFile, locate = findGcloud } = {}) {
  let cached = null;
  const getToken = async () => {
    if (cached && cached.expires > Date.now()) return cached.token;
    const bin = locate();
    if (!bin) {
      throw new GenMediaError('gcloud が見つかりません(Google Cloud CLI をインストールするか、GCLOUD_BIN にパスを指定)', { code: 'NO_GCLOUD' });
    }
    const token = await new Promise((resolve, reject) => {
      exec(bin, ['auth', 'print-access-token'], { timeout: 30_000 }, (err, stdout) => {
        if (err) reject(new GenMediaError('gcloud auth print-access-token に失敗しました(gcloud auth login 済みか確認)', { code: 'NO_TOKEN', detail: String(err.message) }));
        else resolve(String(stdout).trim());
      });
    });
    if (!token) throw new GenMediaError('gcloud からトークンが返りませんでした(gcloud auth login を実行)', { code: 'NO_TOKEN' });
    cached = { token, expires: Date.now() + ttlMs };
    return token;
  };
  // 期限切れ・取り消しで 401 になったとき、キャッシュを捨てて取り直せるようにする。
  getToken.invalidate = () => { cached = null; };
  return getToken;
}

const RETRY_STATUS = new Set([429, 503]);

export function createVertexClient({
  project,
  location = 'global',
  models = {},
  getToken = gcloudTokenProvider(),
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxRetries = 5,
  retryBaseMs = 2000,
  pollIntervalMs = 5000,
  maxPollMs = 10 * 60 * 1000,
} = {}) {
  if (!project) throw new GenMediaError('GOOGLE_CLOUD_PROJECT が未設定です(.env を確認)', { code: 'NO_PROJECT' });
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const base = `https://${host}/v1/projects/${project}/locations/${location}`;
  const model = {
    image: models.image ?? 'gemini-nano-banana-2.1',
    video: models.video ?? 'gemini-omni-1.2-flash',
    music: models.music ?? 'lyria-3-pro-preview',
    tts: models.tts ?? 'gemini-3.8-flash-tts',
  };

  async function request(method, url, body, extraHeaders = {}) {
    let token = await getToken();
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-goog-user-project': project,
          'Content-Type': 'application/json; charset=utf-8',
          ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return res;
      if (res.status === 401 && !refreshed && typeof getToken.invalidate === 'function') {
        refreshed = true;
        getToken.invalidate();
        token = await getToken();
        attempt--;
        continue;
      }
      if (RETRY_STATUS.has(res.status) && attempt < maxRetries) {
        await sleep(retryBaseMs * 2 ** attempt);
        continue;
      }
      const text = await res.text().catch(() => '');
      throw new GenMediaError(`Vertex AI ${res.status}: ${text.slice(0, 500)}`, { status: res.status, code: res.status === 429 ? 'RESOURCE_EXHAUSTED' : 'HTTP_ERROR' });
    }
  }

  async function generateContent(modelId, body) {
    const res = await request('POST', `${base}/publishers/google/models/${modelId}:generateContent`, body);
    return res.json();
  }

  function inlineParts(json) {
    return (json.candidates ?? []).flatMap((c) => c.content?.parts ?? []).map((p) => p.inlineData ?? p.inline_data).filter(Boolean);
  }

  function blockedReason(json) {
    const c = json.candidates?.[0];
    return json.promptFeedback?.blockReason ?? (c && c.finishReason && c.finishReason !== 'STOP' ? c.finishReason : null);
  }

  return {
    base,
    model,

    // 生成ボタンを押す前に、トークンが取れる状態かを確かめる(課金 API は呼ばない)。
    async checkAuth() {
      try {
        await getToken();
        return { ok: true, reason: null };
      } catch (err) {
        return { ok: false, reason: err.message, code: err.code ?? null };
      }
    },

    async generateImage({ prompt, aspectRatio = '16:9' }) {
      const json = await generateContent(model.image, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
      });
      // 下書き画像が先に返ることがあるため、最後の画像を採用する。
      const img = inlineParts(json).filter((d) => (d.mimeType ?? d.mime_type ?? '').startsWith('image/')).at(-1);
      if (!img) throw new GenMediaError(`画像が返りませんでした(${blockedReason(json) ?? 'no image'})`, { code: 'NO_OUTPUT' });
      const mime = img.mimeType ?? img.mime_type;
      return { mime, ext: mime.includes('jpeg') ? 'jpg' : 'png', data: Buffer.from(img.data, 'base64') };
    },

    async synthesizeSpeech({ text, voice = 'Puck' }) {
      const json = await generateContent(model.tts, {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const audio = inlineParts(json).find((d) => (d.mimeType ?? d.mime_type ?? '').startsWith('audio/'));
      if (!audio) throw new GenMediaError(`音声が返りませんでした(${blockedReason(json) ?? 'no audio'})`, { code: 'NO_OUTPUT' });
      const mime = audio.mimeType ?? audio.mime_type;
      const raw = Buffer.from(audio.data, 'base64');
      const pcm = parsePcmMime(mime);
      if (pcm) return { mime: 'audio/wav', ext: 'wav', data: pcmToWav(raw, pcm) };
      return { mime, ext: mime.includes('mpeg') ? 'mp3' : 'wav', data: raw };
    },

    async generateVideo({ prompt }) {
      const start = await (await request('POST', `${base}/interactions`, { model: model.video, input: prompt, background: true })).json();
      const id = start.id ?? start.name?.split('/').pop();
      if (!id) throw new GenMediaError('interaction id が返りませんでした', { code: 'NO_ID', detail: start });
      const deadline = Date.now() + maxPollMs;
      let cur = start;
      while (!isDone(cur)) {
        if (Date.now() > deadline) throw new GenMediaError('動画生成がタイムアウトしました', { code: 'TIMEOUT' });
        await sleep(pollIntervalMs);
        cur = await (await request('GET', `${base}/interactions/${id}`)).json();
      }
      if (isFailed(cur)) throw new GenMediaError(`動画生成に失敗しました: ${JSON.stringify(cur.error ?? cur.status).slice(0, 300)}`, { code: 'FAILED' });
      const contents = [...(cur.steps ?? []).flatMap((s) => s.content ?? []), ...(cur.outputs ?? []), ...(cur.output?.content ?? [])];
      const video = contents.find((c) => c.type === 'video' && c.data);
      if (!video) throw new GenMediaError('動画データが見つかりませんでした', { code: 'NO_OUTPUT' });
      return { mime: video.mime_type ?? video.mimeType ?? 'video/mp4', ext: 'mp4', data: Buffer.from(video.data, 'base64') };
    },

    async generateMusic({ prompt }) {
      // Lyria は stream:true でしか音声が返らない(background/store は不可)。
      const res = await request('POST', `${base}/interactions`, { model: model.music, input: prompt, stream: true }, { Accept: 'text/event-stream' });
      const chunks = [];
      let mime = 'audio/mpeg';
      for await (const event of readSse(res.body)) {
        if (isRecitation(event)) {
          throw new GenMediaError('著作権フィルタ(recitation)で停止しました。プロンプトを言い換えてください', { code: 'RECITATION' });
        }
        if (event.error) throw new GenMediaError(`音楽生成エラー: ${JSON.stringify(event.error).slice(0, 300)}`, { code: 'FAILED' });
        const d = event.delta;
        if (d?.type === 'audio' && d.data) {
          mime = d.mime_type ?? d.mimeType ?? mime;
          chunks.push(Buffer.from(d.data, 'base64'));
        }
      }
      if (chunks.length === 0) throw new GenMediaError('音声が返りませんでした', { code: 'NO_OUTPUT' });
      const pcm = parsePcmMime(mime);
      if (pcm) return { mime: 'audio/wav', ext: 'wav', data: pcmToWav(Buffer.concat(chunks), pcm) };
      return { mime, ext: mime.includes('wav') ? 'wav' : 'mp3', data: Buffer.concat(chunks) };
    },
  };
}

function isDone(it) {
  const s = String(it.status ?? it.state ?? '').toLowerCase();
  return it.done === true || ['completed', 'succeeded', 'failed', 'cancelled', 'canceled'].includes(s);
}

function isFailed(it) {
  const s = String(it.status ?? it.state ?? '').toLowerCase();
  return Boolean(it.error) || ['failed', 'cancelled', 'canceled'].includes(s);
}

function isRecitation(event) {
  return /recitation/i.test(JSON.stringify(event.error ?? event.finish_reason ?? event.finishReason ?? event.status ?? ''))
    || /recitation/i.test(String(event.delta?.reason ?? ''));
}

export async function* readSse(stream) {
  const decoder = new TextDecoder();
  let buf = '';
  let pendingCr = '';
  for await (const chunk of stream) {
    // SSE は CRLF / CR 改行も許すため LF に揃えてから境界を探す。チャンク末尾の \r は
    // 次チャンク先頭の \n と組になる可能性があるので、次回まで保留する。
    let text = pendingCr + decoder.decode(chunk, { stream: true });
    pendingCr = text.endsWith('\r') ? '\r' : '';
    if (pendingCr) text = text.slice(0, -1);
    buf += text.replace(/\r\n?/g, '\n');
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseSseEvent(raw);
      if (ev) yield ev;
    }
  }
  for (const raw of (buf + pendingCr).replace(/\r/g, '\n').split('\n\n')) {
    const ev = parseSseEvent(raw);
    if (ev) yield ev;
  }
}

function parseSseEvent(raw) {
  const data = raw.replace(/\r/g, '').split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
