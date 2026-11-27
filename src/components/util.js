// コンポーネント共通の部品(メディア表示・プレースホルダー・UI文言)。

import { esc } from '../core/i18n.js';

export const UI = {
  theme: { ja: 'テーマ曲', en: 'Theme' },
  narration: { ja: 'ナレーション', en: 'Narration' },
  notGenerated: { ja: '未生成 — 舞台裏で生成できます', en: 'Not generated yet — create it backstage' },
  generate: { ja: '生成', en: 'Generate' },
  generating: { ja: '生成中…', en: 'Generating…' },
  prompt: { ja: 'プロンプト', en: 'Prompt' },
  script: { ja: '原稿', en: 'Script' },
  voice: { ja: '声', en: 'Voice' },
  aspect: { ja: '比率', en: 'Aspect' },
  kinds: {
    image: { ja: '画像', en: 'Image' },
    video: { ja: '動画', en: 'Video' },
    music: { ja: '音楽', en: 'Music' },
    tts: { ja: '音声合成', en: 'Speech' },
  },
  models: {
    image: 'Nano Banana', video: 'Omni Flash', music: 'Lyria 3 Pro', tts: 'Gemini TTS',
  },
};

export function placeholder(slot, ctx, cls = '') {
  return `<div class="media-placeholder ${cls}" data-slot="${esc(slot ?? '')}">`
    + `<span>${ctx.tx(UI.notGenerated)}</span><code>${esc(slot ?? '')}</code></div>`;
}

// 画像/動画スロットを表示する。ファイルが無ければプレースホルダー(素材なしでも全ビューが動くように)。
export function mediaVisual(slot, ctx, { cls = '', alt = '', background = false } = {}) {
  const entry = ctx.mediaEntry(slot);
  if (!entry || !entry.file) {
    if (entry?.kind === 'video' && entry.poster) {
      return `<img class="media ${cls}" data-slot="${esc(slot)}" src="${esc(ctx.mediaUrl(slot, 'poster'))}" alt="${esc(alt)}">`;
    }
    return background ? `<div class="media media-empty ${cls}" data-slot="${esc(slot ?? '')}"></div>` : placeholder(slot, ctx, cls);
  }
  if (entry.kind === 'video') {
    const poster = entry.poster ? ` poster="${esc(ctx.mediaUrl(slot, 'poster'))}"` : '';
    return `<video class="media ${cls}" data-slot="${esc(slot)}" src="${esc(ctx.mediaUrl(slot))}"${poster} autoplay muted loop playsinline></video>`;
  }
  if (entry.kind === 'image') {
    return `<img class="media ${cls}" data-slot="${esc(slot)}" src="${esc(ctx.mediaUrl(slot))}" alt="${esc(alt)}">`;
  }
  return placeholder(slot, ctx, cls);
}

export function audioButton(slot, label, ctx, icon = '▶') {
  const entry = ctx.mediaEntry(slot);
  const ready = Boolean(entry?.file);
  const url = ready ? ctx.mediaUrl(slot) : '';
  return `<button type="button" class="pill pill-outline audio-btn" data-play-slot="${esc(slot)}" data-src="${esc(url)}"`
    + `${ready ? '' : ` disabled title="${ctx.tx(UI.notGenerated)}"`}><span class="icon">${icon}</span>${ctx.tx(label)}</button>`;
}

export function list(values) {
  return Array.isArray(values) ? values : values ? [values] : [];
}
