export default {
  name: 'quote',
  description: 'ひとことメッセージ・引用',
  variants: ['default'],
  props: { text: { required: true }, by: {} },

  render(p, ctx) {
    return `<blockquote class="quote"><p>${ctx.tx(p.text)}</p>${p.by ? `<footer>— ${ctx.tx(p.by)}</footer>` : ''}</blockquote>`;
  },

  pptx(slide, p, ctx, kit) {
    kit.addBar(slide);
    kit.text(slide, p.text, { x: 1.2, y: 2.2, w: kit.w - 2.4, h: 2.4, fontSize: 36, bold: true, align: 'center' });
    if (p.by) kit.text(slide, `— ${ctx.t(p.by)}`, { x: 1.2, y: 4.8, w: kit.w - 2.4, h: 0.6, fontSize: 18, align: 'center', color: kit.colors.sub });
  },
};
