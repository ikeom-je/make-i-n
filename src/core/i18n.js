// 多言語テキスト {ja, en} の解決と HTML エスケープ。ブラウザと Node の両方で使う。

export const LANGS = ['ja', 'en'];
export const DEFAULT_LANG = 'ja';

export function normalizeLang(lang) {
  return LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

export function isLocalized(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && LANGS.some((l) => typeof value[l] === 'string');
}

// 指定言語が無いときは ja → en の順に落とす(片方の言語だけ書いた項目でも表示が欠けないように)。
export function t(value, lang) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (isLocalized(value)) {
    return value[lang] ?? value[DEFAULT_LANG] ?? value.en ?? '';
  }
  return '';
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function tx(value, lang) {
  return esc(t(value, lang));
}
