// 対話インテークの CLI。エージェント(Claude Code / Codex / Gemini)が会話の結果を data/private に書いた後に使う。
//   npm run intake -- init               テンプレートから data/private の骨組みを作る(既存ファイルは上書きしない)
//   npm run intake -- note <kind> <text> 要望・表現の希望などを context/requests.jsonl に1行追記
//   npm run intake -- check              未確定・不足項目を一覧(次に何を聞くべきか)
//   npm run intake:build                 brief.md の plan から talks/<id>.yaml を生成して検証

import fs from 'node:fs';
import path from 'node:path';
import { createDefaultRegistry } from '../src/components/index.js';
import { validateProfile } from '../src/core/profile.js';
import { validateTalk } from '../src/core/talk.js';
import { ROOT, createDataStore, resolveDataDir } from '../server/data.js';
import { buildTalk, checkReadiness, estimateSeconds, loadBrief, talkYaml } from '../server/intake.js';

const NOTE_KINDS = ['intro', 'request', 'style', 'avoid', 'fact'];
const TEMPLATE_DIR = path.join(ROOT, 'templates/intake');

export function init(dataDir) {
  const created = [];
  const copy = (src, dst) => {
    for (const f of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, f.name);
      const d = path.join(dst, f.name);
      if (f.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
      else if (!fs.existsSync(d)) { fs.copyFileSync(s, d); created.push(path.relative(dataDir, d)); }
    }
  };
  fs.mkdirSync(dataDir, { recursive: true });
  copy(TEMPLATE_DIR, dataDir);
  for (const d of ['talks', 'media', 'generated']) fs.mkdirSync(path.join(dataDir, d), { recursive: true });
  return created;
}

export function note(dataDir, kind, text, now = new Date()) {
  if (!NOTE_KINDS.includes(kind)) throw new Error(`kind は ${NOTE_KINDS.join(' / ')} のどれか`);
  if (!text?.trim()) throw new Error('text が空です');
  const file = path.join(dataDir, 'context/requests.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ ts: now.toISOString(), kind, text: text.trim() })}\n`);
  return file;
}

export function check(dataDir) {
  const store = createDataStore(dataDir);
  const profile = store.loadProfile();
  const brief = loadBrief(dataDir);
  return [
    ...validateProfile(profile).errors,
    ...(brief ? [] : ['brief.md がありません(npm run intake -- init で雛形を作る)']),
    ...checkReadiness({ profile, brief, media: store.mediaFor(profile) }),
  ];
}

export function build(dataDir) {
  const store = createDataStore(dataDir);
  const brief = loadBrief(dataDir);
  if (!brief) throw new Error('brief.md がありません');
  const talk = buildTalk(brief);
  const { ok, errors } = validateTalk(talk, store.loadProfile(), createDefaultRegistry());
  if (!ok) throw new Error(`生成した talk が不正です:\n- ${errors.join('\n- ')}`);
  const seconds = estimateSeconds(talk);
  const file = path.join(dataDir, 'talks', `${talk.id}.yaml`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, talkYaml(talk, { seconds }));
  const limit = brief.talk?.durationSec;
  return { file, talk, seconds, overBy: limit && seconds > limit ? seconds - limit : 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = resolveDataDir();
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'init') {
      const created = init(dataDir);
      console.log(created.length ? `作成: ${created.join(', ')}` : '既存ファイルはそのまま(作成なし)');
    } else if (cmd === 'note') {
      console.log(`追記: ${path.relative(ROOT, note(dataDir, args[0], args.slice(1).join(' ')))}`);
    } else if (cmd === 'check') {
      const items = check(dataDir);
      console.log(items.length ? `未確定・不足 ${items.length} 件:\n- ${items.join('\n- ')}` : 'OK: 不足なし');
    } else if (cmd === 'build') {
      const { file, seconds, overBy } = build(dataDir);
      console.log(`生成: ${path.relative(ROOT, file)}(目安 ${seconds} 秒)`);
      if (overBy) console.log(`注意: 持ち時間を約 ${overBy} 秒超えています。plan を減らすか variant を短くしてください`);
    } else {
      console.log('usage: npm run intake -- <init|note <kind> <text>|check|build>');
      process.exitCode = 2;
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
