import { esc } from '../core/i18n.js';
import { UI, audioButton, mediaVisual } from './util.js';

const DEFAULT_CARDS = [
  { kind: 'image', slot: 'library' },
  { kind: 'video', slot: 'books' },
  { kind: 'music', slot: 'theme' },
  { kind: 'tts', slot: 'narration_en' },
];
const ASPECTS = ['16:9', '1:1', '9:16', '4:3', '3:4'];

function preview(card, ctx) {
  if (card.kind === 'image' || card.kind === 'video') return mediaVisual(card.slot, ctx, { cls: 'gm-media' });
  return audioButton(card.slot, UI.kinds[card.kind], ctx, card.kind === 'music' ? '♪' : '▶');
}

function cardHtml(card, ctx) {
  const entry = ctx.mediaEntry(card.slot) ?? {};
  const isTts = card.kind === 'tts';
  const value = isTts ? (entry.text || ctx.t(ctx.profile?.narration)) : entry.prompt;
  const extra = isTts
    ? `<label class="gm-field">${ctx.tx(UI.voice)}<input name="voice" value="${esc(entry.voice ?? 'Puck')}"></label>`
    : card.kind === 'image'
      ? `<label class="gm-field">${ctx.tx(UI.aspect)}<select name="aspectRatio">${ASPECTS.map((a) => `<option${a === (entry.aspectRatio ?? '16:9') ? ' selected' : ''}>${a}</option>`).join('')}</select></label>`
      : '';
  return `<form class="gm-card" data-genmedia-card data-kind="${esc(card.kind)}" data-slot="${esc(card.slot)}">
  <header><span class="gm-kind k-${esc(card.kind)}">${ctx.tx(UI.kinds[card.kind])}</span><span class="gm-model">${esc(UI.models[card.kind])}</span><code>${esc(card.slot)}</code></header>
  <div class="gm-preview">${preview(card, ctx)}</div>
  <label class="gm-field">${ctx.tx(isTts ? UI.script : UI.prompt)}<textarea name="prompt" rows="4">${esc(value ?? '')}</textarea></label>
  ${extra}
  <div class="gm-actions"><button type="submit" class="pill pill-primary">${ctx.tx(UI.generate)}</button><span class="gm-status" role="status"></span></div>
</form>`;
}

export default {
  name: 'genmedia-studio',
  description: '舞台裏: 画像/動画/音楽/音声合成をその場で生成してスロットに反映する',
  variants: ['grid'],
  props: { heading: {}, lead: {}, cards: { description: '[{kind, slot}] の配列' } },
  defaults: {
    heading: { ja: '舞台裏 — このページは生成AIで作っています', en: 'Behind the scenes — made with generative AI' },
    lead: { ja: 'プロンプトを書き換えて「生成」すると、その場でページに反映されます。', en: 'Edit a prompt and hit Generate — the page updates in place.' },
  },

  render(p, ctx) {
    const cards = p.cards ?? DEFAULT_CARDS;
    return `<h2 class="section-heading">${ctx.tx(p.heading)}</h2>
${p.lead ? `<p class="section-lead">${ctx.tx(p.lead)}</p>` : ''}
<div class="gm-grid">${cards.map((c) => cardHtml(c, ctx)).join('')}</div>`;
  },

  pptx(slide, p, ctx, kit) {
    kit.addBar(slide);
    kit.text(slide, p.heading, { x: 0.6, y: 0.35, w: 12, h: 0.6, fontSize: 26, bold: true });
    const cards = p.cards ?? DEFAULT_CARDS;
    const colors = [kit.colors.blue, kit.colors.red, kit.colors.yellow, kit.colors.green];
    const colW = (kit.w - 1.2 - 0.2 * 3) / 4;
    cards.slice(0, 4).forEach((card, i) => {
      const x = 0.6 + i * (colW + 0.2);
      const entry = ctx.mediaEntry(card.slot) ?? {};
      slide.addShape(kit.pres.ShapeType.roundRect, { x, y: 1.3, w: colW, h: 5.6, rectRadius: 0.08, fill: { color: kit.colors.soft }, line: { color: colors[i % 4], width: 2 } });
      kit.text(slide, `${ctx.t(UI.kinds[card.kind])} · ${UI.models[card.kind]}`, { x: x + 0.15, y: 1.45, w: colW - 0.3, h: 0.45, fontSize: 15, bold: true, color: colors[i % 4] });
      const img = kit.imagePath(card.slot);
      if (img) slide.addImage({ path: img, x: x + 0.15, y: 2.0, w: colW - 0.3, h: (colW - 0.3) * 9 / 16, sizing: { type: 'cover', w: colW - 0.3, h: (colW - 0.3) * 9 / 16 } });
      const text = card.kind === 'tts' ? (entry.text || ctx.t(ctx.profile?.narration)) : entry.prompt;
      kit.text(slide, String(text ?? '').slice(0, 220), { x: x + 0.15, y: img ? 3.85 : 2.0, w: colW - 0.3, h: img ? 2.9 : 4.7, fontSize: 10, valign: 'top', color: kit.colors.sub });
    });
  },
};
