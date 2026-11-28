// 対話インテークで集めた brief(構造化 Markdown)から talk を組み立て、準備状況を点検する。
// エージェントとの会話 → data/private/{profile, context, brief.md} → talks/<id>.yaml の最後の段。

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { parseMarkdown, readStructured } from './formats.js';

// 1パーツあたりの目安秒数(2〜3分の持ち時間に収まるかの概算に使う)。
export const SECONDS_PER_COMPONENT = {
  title: 20, 'career-timeline': 50, 'big-number': 25, quote: 15, 'media-hero': 15,
  'genmedia-studio': 60, cta: 15, links: 20,
};

export function parseBrief(text) {
  const { front, body } = parseMarkdown(text);
  return { ...front, summary: body };
}

// plan の1項目は「パーツ名」だけ、または { パーツ名: {variant, size, ...props} }。
// 短縮記法: big-number の highlight と links の items は profile のキー名だけで書ける。
function planEntry(entry) {
  const [component, opts] = typeof entry === 'string' ? [entry, {}] : Object.entries(entry)[0];
  const { variant, size, emphasis, id, notes, ...props } = opts ?? {};
  if (component === 'big-number' && typeof props.highlight === 'string' && !props.highlight.startsWith('$')) {
    props.highlight = `$.highlights.${props.highlight}`;
  }
  if (component === 'links' && Array.isArray(props.items)) {
    props.items = props.items.map((it) => (typeof it === 'string' && !it.startsWith('$') ? `$.links.${it}` : it));
  }
  if (component === 'cta' && typeof props.message === 'string' && !props.message.startsWith('$')) {
    props.message = `$.messages.${props.message}`;
  }
  const section = { component };
  if (id) section.id = id;
  if (variant) section.variant = variant;
  if (size) section.size = size;
  if (emphasis) section.emphasis = emphasis;
  if (notes) section.notes = notes;
  if (Object.keys(props).length) section.props = props;
  return section;
}

export function buildTalk(brief) {
  const talk = brief.talk ?? {};
  if (!talk.id) throw new Error('brief の frontmatter に talk.id がありません');
  if (!Array.isArray(brief.plan) || brief.plan.length === 0) throw new Error('brief の frontmatter に plan(並べるパーツ)がありません');
  return {
    id: talk.id,
    ...(talk.order !== undefined ? { order: talk.order } : {}),
    title: talk.title ?? talk.id,
    theme: talk.theme ?? 'google',
    defaultLang: talk.defaultLang ?? 'ja',
    sections: brief.plan.map(planEntry),
  };
}

export function estimateSeconds(talk) {
  return talk.sections.reduce((sum, s) => sum + (s.seconds ?? SECONDS_PER_COMPONENT[s.component] ?? 20), 0);
}

const TODO = /TODO|要確認|\?\?\?/;

// 発表前に埋まっていないものを列挙する(エージェントが次に何を質問すべきかの手がかり)。
export function checkReadiness({ profile, brief, media = {} }) {
  const missing = [];
  const walk = (v, where) => {
    if (typeof v === 'string' && TODO.test(v)) missing.push(`${where}: 未確定(${v})`);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, where ? `${where}.${k}` : k));
  };
  walk(profile, 'profile');
  if (!profile.timeline?.length) missing.push('profile.timeline: 経歴がありません');
  for (const [i, it] of (profile.timeline ?? []).entries()) {
    if (!it.items?.length) missing.push(`profile.timeline[${i}](${it.id ?? i}): キーワードがありません`);
  }
  if (!profile.links || !Object.keys(profile.links).length) missing.push('profile.links: QR に出すリンクがありません');
  if (brief) {
    for (const key of ['occasion', 'audience']) if (!brief[key]) missing.push(`brief.${key}: 未記入`);
    if (!brief.talk?.durationSec) missing.push('brief.talk.durationSec: 持ち時間が未記入');
  }
  const usesPhoto = brief?.plan?.some((e) => typeof e === 'object' && e.title?.photo);
  if (usesPhoto) {
    const slot = brief.plan.find((e) => typeof e === 'object' && e.title?.photo).title.photo;
    if (!media[slot]?.file) missing.push(`media.${slot}: 顔写真のファイルがありません(media/ に置いて profile.media.${slot}.file に指定)`);
  }
  return missing;
}

export function loadBrief(dataDir) {
  const file = path.join(dataDir, 'brief.md');
  return fs.existsSync(file) ? parseBrief(fs.readFileSync(file, 'utf8')) : null;
}

export function loadContext(dataDir) {
  const dir = path.join(dataDir, 'context');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => /\.(jsonl|json|ya?ml|md)$/.test(f)).sort()
    .map((f) => [path.basename(f, path.extname(f)), readStructured(path.join(dir, f))]));
}

export function talkYaml(talk, { source = 'brief.md', seconds } = {}) {
  const head = `# ${source} から npm run intake:build で生成(手で直す場合は brief.md の plan を直して再生成する)\n`
    + (seconds ? `# 目安 ${seconds} 秒\n` : '');
  return head + YAML.stringify(talk, { lineWidth: 0 });
}
