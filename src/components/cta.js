import { esc } from '../core/i18n.js';
import { mediaVisual, safeHref } from './util.js';

export { safeHref };

function merged(p) {
  return { headline: p.message?.headline, button: p.message?.button, href: p.message?.href, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) };
}

export default {
  name: 'cta',
  description: '締めの呼びかけ。背景に動画/画像',
  variants: ['default'],
  props: { message: { description: '{headline, button, href}' }, headline: {}, button: {}, href: {}, background: {} },

  render(p, ctx) {
    const m = merged(p);
    const bg = m.background ? `<div class="cta-bg">${mediaVisual(m.background, ctx, { background: true })}</div>` : '';
    const href = safeHref(ctx.t(m.href));
    const btn = m.button
      ? (href ? `<a class="pill pill-primary pill-lg" href="${esc(href)}">${ctx.tx(m.button)}</a>` : `<span class="pill pill-primary pill-lg">${ctx.tx(m.button)}</span>`)
      : '';
    return `${bg}<div class="cta-body"><h2 class="cta-headline">${ctx.tx(m.headline)}</h2>${btn}</div>`;
  },

  pptx(slide, p, ctx, kit) {
    const m = merged(p);
    const img = m.background ? kit.imagePath(m.background) : null;
    if (img) {
      slide.addImage({ path: img, x: 0, y: 0, w: kit.w, h: kit.h, sizing: { type: 'cover', w: kit.w, h: kit.h } });
      slide.addShape(kit.pres.ShapeType.rect, { x: 0, y: 0, w: kit.w, h: kit.h, fill: { color: '000000', transparency: 55 }, line: { color: '000000', transparency: 100 } });
    }
    kit.addBar(slide);
    kit.text(slide, m.headline, { x: 1, y: 2.3, w: kit.w - 2, h: 1.6, fontSize: 40, bold: true, align: 'center', color: img ? 'FFFFFF' : kit.colors.text });
    if (m.button) {
      slide.addShape(kit.pres.ShapeType.roundRect, { x: kit.w / 2 - 2, y: 4.3, w: 4, h: 0.9, rectRadius: 0.45, fill: { color: kit.colors.blue }, line: { color: kit.colors.blue } });
      kit.text(slide, m.button, { x: kit.w / 2 - 2, y: 4.3, w: 4, h: 0.9, fontSize: 22, bold: true, align: 'center', valign: 'middle', color: 'FFFFFF' });
    }
  },
};
