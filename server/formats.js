// 個人データのファイル形式(YAML / JSON / JSONL / Markdown)を読み、profile を組み立てる。

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { LANGS } from '../src/core/i18n.js';

export const DATA_EXTS = ['.yaml', '.yml', '.json', '.jsonl', '.md'];

// JSONL: 1行1項目。空行と // で始まる行は無視する(経歴などを1行ずつ足していけるように)。
export function parseJsonl(text, file = 'jsonl') {
  return text.split(/\r?\n/).flatMap((line, i) => {
    const s = line.trim();
    if (!s || s.startsWith('//')) return [];
    try {
      return [JSON.parse(s)];
    } catch (err) {
      throw new Error(`${file}:${i + 1}: JSON として読めません (${err.message})`);
    }
  });
}

// Markdown: 先頭の --- で囲んだ YAML frontmatter + 本文。
// 本文に「# ja」「# en」の見出しがあれば言語ごとに分けて {ja, en} にする。
export function parseMarkdown(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  const front = m ? (YAML.parse(m[1]) ?? {}) : {};
  const body = (m ? m[2] : text).trim();
  const parts = {};
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    const h = /^#\s+(\w+)\s*$/.exec(line);
    if (h && LANGS.includes(h[1])) {
      current = h[1];
      parts[current] = [];
    } else if (current) {
      parts[current].push(line);
    }
  }
  const localized = Object.keys(parts).length
    ? Object.fromEntries(Object.entries(parts).map(([l, lines]) => [l, lines.join('\n').trim()]))
    : body;
  return { front, body: localized };
}

export function parseByExt(file, text) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') return JSON.parse(text);
  if (ext === '.jsonl') return parseJsonl(text, file);
  if (ext === '.md') {
    const { front, body } = parseMarkdown(text);
    // frontmatter が無い md は本文そのもの(自己紹介文・ナレーション原稿など)を値にする。
    if (!Object.keys(front).length) return body;
    return body === '' ? front : { ...front, body };
  }
  return YAML.parse(text);
}

export function readStructured(file) {
  return parseByExt(file, fs.readFileSync(file, 'utf8'));
}

export function findFile(dir, base) {
  for (const ext of DATA_EXTS) {
    const f = path.join(dir, base + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// "@file:profile/career.jsonl" の形の値を、データディレクトリ内のファイル内容に置き換える。
export function resolveIncludes(value, dataDir) {
  if (typeof value === 'string' && value.startsWith('@file:')) {
    const abs = path.resolve(dataDir, value.slice('@file:'.length));
    if (!abs.startsWith(dataDir + path.sep)) throw new Error(`データディレクトリ外は読み込めません: ${value}`);
    return resolveIncludes(readStructured(abs), dataDir);
  }
  if (Array.isArray(value)) return value.map((v) => resolveIncludes(v, dataDir));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveIncludes(v, dataDir)]));
  }
  return value;
}

// profile = profile.(yaml|json|md) + profile/ ディレクトリの各ファイル(ファイル名がキー)。
// 例: profile/timeline.jsonl → profile.timeline、profile/narration.md → profile.narration。
export function loadProfile(dataDir) {
  const baseFile = findFile(dataDir, 'profile');
  const dir = path.join(dataDir, 'profile');
  const hasDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  if (!baseFile && !hasDir) throw new Error(`profile.(yaml|json|md) または profile/ がありません: ${dataDir}`);
  const profile = baseFile ? { ...readStructured(baseFile) } : {};
  if (hasDir) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (!DATA_EXTS.includes(path.extname(f).toLowerCase())) continue;
      const key = path.basename(f, path.extname(f));
      if (key in profile) throw new Error(`profile のキー "${key}" が profile 本体と profile/${f} の両方にあります`);
      profile[key] = readStructured(path.join(dir, f));
    }
  }
  return resolveIncludes(profile, dataDir);
}
