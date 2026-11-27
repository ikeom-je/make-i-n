import { esc } from '../core/i18n.js';
import { list, safeHref } from './util.js';

// SNS などの種類ごとの既定ラベル。未知の種類は url 扱い。
export const LINK_TYPES = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  x: 'X',
  twitter: 'X',
  orcid: 'ORCID',
  eight: 'Eight',
  github: 'GitHub',
  url: 'Web',
};

// items は配列でも、profile.links のような {id: link} のマップでもよい。URL が不正な項目は出さない。
export function normalizeLinks(items, ctx) {
  const arr = Array.isArray(items) ? items : items && typeof items === 'object' && !('url' in items) ? Object.values(items) : list(items);
  return arr.map((it) => {
    const href = safeHref(ctx.t(it.url));
    if (!href) return null;
    const type = LINK_TYPES[it.type] ? it.type : 'url';
    const show = ['qr', 'link', 'both'].includes(it.show) ? it.show : null;
    return { type, href, show, label: ctx.t(it.label) || LINK_TYPES[type], note: ctx.t(it.note), display: href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') };
  }).filter(Boolean);
}

export default {
  name: 'links',
  description: 'SNS・Web のリンクと QR コード。both(QR+リンク)/ qr / link',
  variants: ['both', 'qr', 'link'],
  props: {
    items: { required: true, description: '[{type, url, label, note, show}] または profile.links への参照。show(qr/link/both)で項目ごとに表示を指定' },
    heading: {},
    lead: {},
  },
  defaults: { items: '$.links', heading: { ja: 'つながりましょう', en: "Let's connect" } },

  render(p, ctx, section) {
    const links = normalizeLinks(p.items, ctx);
    // 項目ごとの show(qr / link / both)が section の variant より優先される。
    const cards = links.map((l) => {
      const mode = l.show ?? section.variant;
      const showQr = mode !== 'link' && typeof ctx.qr === 'function';
      const showLink = mode !== 'qr' || !showQr;
      return `<li class="link-card t-${esc(l.type)}">
  ${showQr ? `<a class="link-qr" href="${esc(l.href)}" aria-label="${esc(l.label)} QR">${ctx.qr(l.href).svg}</a>` : ''}
  <div class="link-meta">
    <span class="link-type">${esc(l.label)}</span>
    ${showLink ? `<a class="link-url" href="${esc(l.href)}">${esc(l.display)}</a>` : ''}
    ${l.note ? `<span class="link-note">${esc(l.note)}</span>` : ''}
  </div>
</li>`;
    }).join('');
    return `${p.heading ? `<h2 class="section-heading">${ctx.tx(p.heading)}</h2>` : ''}
${p.lead ? `<p class="section-lead">${ctx.tx(p.lead)}</p>` : ''}
<ul class="links count-${links.length}">${cards}</ul>`;
  },

  pptx(slide, p, ctx, kit, section) {
    kit.addBar(slide);
    kit.text(slide, p.heading, { x: 0.6, y: 0.35, w: 12, h: 0.7, fontSize: 30, bold: true });
    if (p.lead) kit.text(slide, p.lead, { x: 0.6, y: 1.05, w: 12, h: 0.5, fontSize: 16, color: kit.colors.sub });
    const links = normalizeLinks(p.items, ctx);
    const n = Math.max(links.length, 1);
    const colW = Math.min(3.6, (kit.w - 1.2 - 0.3 * (n - 1)) / n);
    const x0 = (kit.w - (colW * n + 0.3 * (n - 1))) / 2;
    links.forEach((l, i) => {
      const x = x0 + i * (colW + 0.3);
      const showQr = (l.show ?? section.variant) !== 'link' && typeof ctx.qr === 'function';
      const qrSize = Math.min(colW - 0.4, 3.0);
      if (showQr) slide.addImage({ data: ctx.qr(l.href).gifDataUrl, x: x + (colW - qrSize) / 2, y: 1.8, w: qrSize, h: qrSize });
      const y = showQr ? 1.9 + qrSize : 2.6;
      kit.text(slide, l.label, { x, y, w: colW, h: 0.5, fontSize: 18, bold: true, align: 'center' });
      slide.addText(l.display, { x, y: y + 0.5, w: colW, h: 0.5, fontSize: 12, align: 'center', color: kit.colors.blue, fontFace: kit.font, margin: 0, hyperlink: { url: l.href } });
    });
  },
};
