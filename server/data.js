// データディレクトリ(profile / talks / media / generated)の読み書き。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { mergeMedia } from '../src/core/media.js';
import { resolveRefs } from '../src/core/resolve.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 個人データ(data/private)があればそれを、無ければ同梱サンプル(data/example)を使う。
export function resolveDataDir(env = process.env) {
  if (env.DATA_DIR) return path.resolve(ROOT, env.DATA_DIR);
  const priv = path.join(ROOT, 'data/private');
  return fs.existsSync(path.join(priv, 'talks')) ? priv : path.join(ROOT, 'data/example');
}

function readStructured(file) {
  const text = fs.readFileSync(file, 'utf8');
  return file.endsWith('.json') ? JSON.parse(text) : YAML.parse(text);
}

function findFile(dir, base) {
  for (const ext of ['.yaml', '.yml', '.json']) {
    const f = path.join(dir, base + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

export const MEDIA_ROOTS = ['media', 'generated'];

// media/ と generated/ の外を指すパスは拒否する(../ によるデータ外参照を防ぐ)。
export function safeMediaPath(dataDir, rel) {
  if (typeof rel !== 'string' || !rel) return null;
  const abs = path.resolve(dataDir, rel);
  const ok = MEDIA_ROOTS.some((r) => abs.startsWith(path.join(dataDir, r) + path.sep));
  return ok ? abs : null;
}

export function createDataStore(dataDir = resolveDataDir()) {
  const manifestFile = path.join(dataDir, 'generated', 'manifest.json');

  const store = {
    dataDir,
    loadProfile() {
      const f = findFile(dataDir, 'profile');
      if (!f) throw new Error(`profile.(yaml|json) がありません: ${dataDir}`);
      return readStructured(f);
    },
    listTalks() {
      const dir = path.join(dataDir, 'talks');
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter((f) => /\.(ya?ml|json)$/.test(f))
        .sort()
        .map((f) => {
          const talk = readStructured(path.join(dir, f));
          return { id: talk.id ?? f.replace(/\.\w+$/, ''), title: talk.title ?? null, order: talk.order ?? 100 };
        })
        .sort((a, b) => a.order - b.order);
    },
    loadTalk(id) {
      if (!/^[\w-]+$/.test(id)) return null;
      const f = findFile(path.join(dataDir, 'talks'), id);
      return f ? readStructured(f) : null;
    },
    loadManifest() {
      try {
        return JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      } catch {
        return { slots: {} };
      }
    },
    saveGenerated(slot, { kind, ext, data, prompt, text, poster }) {
      const dir = path.join(dataDir, 'generated');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = `generated/${slot}-${stamp}.${ext}`;
      fs.writeFileSync(path.join(dataDir, file), data);
      const manifest = store.loadManifest();
      manifest.slots ??= {};
      const prev = manifest.slots[slot];
      manifest.slots[slot] = {
        kind, file, prompt, text, poster: poster ?? prev?.poster, createdAt: new Date().toISOString(),
        history: [...(prev?.history ?? []), ...(prev?.file ? [prev.file] : [])].slice(-10),
      };
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      return manifest.slots[slot];
    },
    mediaFor(profile) {
      // media 定義の text も "$.narration.en" のように profile を参照できる(原稿を1か所で持つため)。
      return mergeMedia(resolveRefs(profile.media ?? {}, profile), store.loadManifest(), (rel) => {
        const abs = safeMediaPath(dataDir, rel);
        return Boolean(abs && fs.existsSync(abs));
      });
    },
    absMedia(rel) {
      return safeMediaPath(dataDir, rel);
    },
  };
  return store;
}
