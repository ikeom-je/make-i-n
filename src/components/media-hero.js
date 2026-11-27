import { mediaVisual } from './util.js';

export default {
  name: 'media-hero',
  description: '画像/動画を大きく見せる',
  variants: ['default'],
  props: { slot: { required: true }, heading: {}, caption: {} },

  render(p, ctx) {
    return `${p.heading ? `<h2 class="section-heading">${ctx.tx(p.heading)}</h2>` : ''}
<figure class="hero-figure">${mediaVisual(p.slot, ctx, { alt: ctx.t(p.caption) })}${p.caption ? `<figcaption>${ctx.tx(p.caption)}</figcaption>` : ''}</figure>`;
  },

  pptx(slide, p, ctx, kit) {
    kit.addBar(slide);
    kit.text(slide, p.heading, { x: 0.6, y: 0.35, w: 12, h: 0.6, fontSize: 28, bold: true });
    const img = kit.imagePath(p.slot);
    if (img) slide.addImage({ path: img, x: 1.2, y: 1.2, w: kit.w - 2.4, h: 5.4, sizing: { type: 'contain', w: kit.w - 2.4, h: 5.4 } });
    kit.text(slide, p.caption, { x: 0.6, y: 6.75, w: kit.w - 1.2, h: 0.5, fontSize: 14, align: 'center', color: kit.colors.sub });
  },
};
