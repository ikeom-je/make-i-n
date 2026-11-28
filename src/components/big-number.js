import { list, mediaVisual } from './util.js';

// highlight オブジェクト(profile.highlights.<id>)をそのまま渡しても、個別 props で上書きしてもよい。
function merged(p) {
  return { ...(p.highlight ?? {}), ...Object.fromEntries(Object.entries(p).filter(([k, v]) => k !== 'highlight' && v !== undefined)) };
}

export default {
  name: 'big-number',
  description: '大きな数字で近況を見せる。plain / hero(背景画像)',
  variants: ['hero', 'plain'],
  props: {
    highlight: { description: 'profile.highlights.<id> への参照' },
    value: {}, unit: {}, label: {}, detail: {}, notes: {},
    background: { description: 'hero 時の背景画像スロット' },
  },

  render(p, ctx, section) {
    const h = merged(p);
    const notes = list(h.notes).map((n) => `<li>${ctx.tx(n)}</li>`).join('');
    const bg = section.variant === 'hero' && h.background
      ? `<div class="bn-bg">${mediaVisual(h.background, ctx, { background: true })}</div>` : '';
    return `${bg}<div class="bn-card">
  ${h.label ? `<p class="bn-label">${ctx.tx(h.label)}</p>` : ''}
  <p class="bn-value"><span class="bn-num">${ctx.tx(h.value)}</span> <span class="bn-unit">${ctx.tx(h.unit)}</span></p>
  ${h.detail ? `<p class="bn-detail">${ctx.tx(h.detail)}</p>` : ''}
  ${notes ? `<ul class="bn-notes">${notes}</ul>` : ''}
</div>`;
  },

  pptx(slide, p, ctx, kit, section) {
    const h = merged(p);
    const img = section.variant === 'hero' && h.background ? kit.imagePath(h.background) : null;
    if (img) {
      slide.addImage({ path: img, x: 0, y: 0, w: kit.w, h: kit.h, sizing: { type: 'cover', w: kit.w, h: kit.h } });
      slide.addShape(kit.pres.ShapeType.roundRect, { x: 1.4, y: 1.1, w: kit.w - 2.8, h: 5.3, rectRadius: 0.15, fill: { color: 'FFFFFF', transparency: 12 }, line: { color: 'FFFFFF' } });
    }
    kit.addBar(slide);
    kit.text(slide, h.label, { x: 1.6, y: 1.4, w: kit.w - 3.2, h: 0.6, fontSize: 22, align: 'center', color: kit.colors.sub });
    slide.addText([
      { text: ctx.t(h.value), options: { fontSize: 120, bold: true, color: kit.colors.blue } },
      { text: ` ${ctx.t(h.unit)}`, options: { fontSize: 36, bold: true, color: kit.colors.text } },
    ], { x: 1.6, y: 2.0, w: kit.w - 3.2, h: 2.2, align: 'center', fontFace: kit.font, margin: 0 });
    kit.text(slide, h.detail, { x: 1.6, y: 4.2, w: kit.w - 3.2, h: 0.5, fontSize: 16, align: 'center', color: kit.colors.sub });
    kit.text(slide, list(h.notes).map((n) => ctx.t(n)).join('\n'), { x: 1.6, y: 4.8, w: kit.w - 3.2, h: 1.4, fontSize: 18, align: 'center', valign: 'top' });
  },
};
