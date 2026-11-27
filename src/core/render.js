// 正規化済み talk → HTML。web / slides / print はすべてこの同じ DOM を CSS で出し分ける。

import { esc, normalizeLang, t, tx } from './i18n.js';
import { mediaUrl } from './media.js';

export function createContext({ lang, profile, media = {}, mediaBase = '/media/', mode = 'web' }) {
  const l = normalizeLang(lang);
  return {
    lang: l,
    mode,
    profile,
    media,
    t: (v) => t(v, l),
    tx: (v) => tx(v, l),
    esc,
    mediaEntry: (slot) => (slot ? media[slot] ?? null : null),
    mediaUrl: (slot, field = 'file') => mediaUrl(media[slot], field, mediaBase),
  };
}

export function renderSection(section, registry, ctx) {
  const def = registry.get(section.component);
  const classes = [
    'section',
    `c-${section.component}`,
    `v-${section.variant}`,
    `size-${section.size}`,
    section.emphasis ? 'is-emphasis' : '',
  ].filter(Boolean).join(' ');
  return `<section class="${classes}" id="${esc(section.id)}" data-component="${esc(section.component)}">`
    + `<div class="section-inner">${def.render(section.props, ctx, section)}</div></section>`;
}

export function renderTalk(model, registry, ctx) {
  return model.sections.map((s) => renderSection(s, registry, ctx)).join('\n');
}
