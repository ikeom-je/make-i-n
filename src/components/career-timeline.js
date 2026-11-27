import { list } from './util.js';

function itemHtml(item, ctx) {
  const bullets = list(item.items).map((b) => `<li>${ctx.tx(b)}</li>`).join('');
  return `<article class="tl-item${item.highlight ? ' is-highlight' : ''}">
  <div class="tl-period">${ctx.tx(item.period)}</div>
  <div class="tl-body">
    <h3 class="tl-org">${ctx.tx(item.org)}${item.badge ? ` <span class="tl-badge">${ctx.tx(item.badge)}</span>` : ''}</h3>
    ${item.title ? `<p class="tl-title">${ctx.tx(item.title)}</p>` : ''}
    ${bullets ? `<ul class="tl-points">${bullets}</ul>` : ''}
  </div>
</article>`;
}

export default {
  name: 'career-timeline',
  description: '経歴タイムライン。rows(行)/ cards(カード)/ axis(横軸)',
  variants: ['rows', 'cards', 'axis'],
  props: {
    items: { required: true, description: 'timeline 配列' },
    heading: {},
    limit: { description: '先頭から何件出すか(30秒版などで短縮)' },
  },
  defaults: { items: '$.timeline', heading: { ja: '経歴', en: 'Career' } },

  render(p, ctx) {
    const items = list(p.items).slice(0, p.limit ?? undefined);
    return `${p.heading ? `<h2 class="section-heading">${ctx.tx(p.heading)}</h2>` : ''}
<div class="timeline">${items.map((it) => itemHtml(it, ctx)).join('')}</div>`;
  },

  pptx(slide, p, ctx, kit, section) {
    kit.addBar(slide);
    kit.text(slide, p.heading, { x: 0.6, y: 0.35, w: 8, h: 0.6, fontSize: 28, bold: true });
    const items = list(p.items).slice(0, p.limit ?? undefined);
    const n = Math.max(items.length, 1);
    if (section.variant === 'rows') {
      const rowH = Math.min(1.25, 6.2 / n);
      items.forEach((it, i) => {
        const y = 1.15 + i * rowH;
        kit.text(slide, it.period, { x: 0.6, y, w: 1.9, h: rowH, fontSize: 14, bold: true, color: it.highlight ? kit.colors.blue : kit.colors.sub, valign: 'top' });
        const body = [ctx.t(it.org) + (it.badge ? `  [${ctx.t(it.badge)}]` : ''), ...(it.title ? [ctx.t(it.title)] : []), ...list(it.items).map((b) => `・${ctx.t(b)}`)].join('\n');
        kit.text(slide, body, { x: 2.6, y, w: 10.1, h: rowH, fontSize: 11, valign: 'top', bold: false });
      });
      return;
    }
    const gap = 0.15;
    const colW = (kit.w - 1.2 - gap * (n - 1)) / n;
    items.forEach((it, i) => {
      const x = 0.6 + i * (colW + gap);
      const accent = it.highlight ? kit.colors.blue : kit.colors.line;
      slide.addShape(kit.pres.ShapeType.roundRect, {
        x, y: 1.2, w: colW, h: 5.8, rectRadius: 0.08,
        fill: { color: it.highlight ? 'E8F0FE' : kit.colors.soft }, line: { color: accent, width: it.highlight ? 2 : 1 },
      });
      kit.text(slide, it.period, { x: x + 0.15, y: 1.35, w: colW - 0.3, h: 0.4, fontSize: 13, bold: true, color: it.highlight ? kit.colors.blue : kit.colors.sub });
      kit.text(slide, it.org, { x: x + 0.15, y: 1.8, w: colW - 0.3, h: 0.8, fontSize: 15, bold: true, valign: 'top' });
      const body = [it.badge ? `★ ${ctx.t(it.badge)}` : null, it.title ? ctx.t(it.title) : null, ...list(it.items).map((b) => `・${ctx.t(b)}`)].filter(Boolean).join('\n');
      kit.text(slide, body, { x: x + 0.15, y: 2.65, w: colW - 0.3, h: 4.2, fontSize: 10.5, valign: 'top', color: kit.colors.text });
    });
  },
};
