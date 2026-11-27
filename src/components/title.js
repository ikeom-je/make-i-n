import { UI, audioButton, mediaVisual } from './util.js';

function narrationSlot(base, ctx) {
  if (!base) return null;
  const candidates = [`${base}_${ctx.lang}`, `${base}_en`, base];
  return candidates.find((s) => ctx.mediaEntry(s)?.file) ?? candidates.find((s) => ctx.mediaEntry(s)) ?? null;
}

export default {
  name: 'title',
  description: '名前・所属・肩書・キャッチコピー。テーマ曲とナレーションの再生ボタン付き',
  variants: ['split', 'center'],
  props: {
    name: { required: true },
    affiliation: {},
    role: {},
    tagline: {},
    visual: { description: '右側に出す画像スロット' },
    music: { description: 'テーマ曲の music スロット' },
    narration: { description: 'ナレーション tts スロットの接頭辞(<name>_ja / <name>_en を言語で選ぶ)' },
  },
  defaults: { name: '$.name', affiliation: '$.affiliation', role: '$.role', tagline: '$.tagline' },

  render(p, ctx, section) {
    const nSlot = narrationSlot(p.narration, ctx);
    const audio = [
      p.music ? audioButton(p.music, UI.theme, ctx, '♪') : '',
      nSlot ? audioButton(nSlot, UI.narration, ctx, '▶') : '',
    ].join('');
    const visual = p.visual && section.variant === 'split'
      ? `<div class="title-visual">${mediaVisual(p.visual, ctx, { alt: ctx.t(p.tagline) })}</div>` : '';
    const sub = [ctx.tx(p.affiliation), ctx.tx(p.role)].filter(Boolean).join(' <span class="sep">／</span> ');
    return `<div class="title-wrap">
  <div class="title-text">
    <div class="g-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <h1 class="title-name">${ctx.tx(p.name)}</h1>
    ${sub ? `<p class="title-role">${sub}</p>` : ''}
    ${p.tagline ? `<p class="title-tagline">${ctx.tx(p.tagline)}</p>` : ''}
    ${audio ? `<div class="audio-row">${audio}</div>` : ''}
  </div>
  ${visual}
</div>`;
  },

  pptx(slide, p, ctx, kit, section) {
    kit.addBar(slide);
    const img = section.variant === 'split' && p.visual ? kit.imagePath(p.visual) : null;
    const textW = img ? 6.6 : kit.w - 1.6;
    kit.text(slide, p.name, { x: 0.8, y: 2.0, w: textW, h: 1.2, fontSize: 48, bold: true });
    const sub = [ctx.t(p.affiliation), ctx.t(p.role)].filter(Boolean).join(' ／ ');
    kit.text(slide, sub, { x: 0.8, y: 3.25, w: textW, h: 0.6, fontSize: 20, color: kit.colors.sub });
    kit.text(slide, p.tagline, { x: 0.8, y: 4.2, w: textW, h: 1.2, fontSize: 24, color: kit.colors.blue, bold: true });
    if (img) slide.addImage({ path: img, x: 7.7, y: 1.2, w: 5.0, h: 5.0, sizing: { type: 'cover', w: 5.0, h: 5.0 } });
    if (ctx.profile?.narration) slide.addNotes(ctx.t(ctx.profile.narration));
  },
};
