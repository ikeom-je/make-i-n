// profile(人物データ)の検証。

import { LANGS } from './i18n.js';

// YAML のフローマップ { ja: a, b, en: c } で値にカンマを書くと余分なキーに化けるため、
// ja/en 以外のキーが混ざった多言語オブジェクトを検出する。
export function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') return { ok: false, errors: ['profile が空です'] };
  if (!profile.name) errors.push('name が必要です');
  const walk = (v, where) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${where}[${i}]`));
    if (v === null || typeof v !== 'object') return;
    const keys = Object.keys(v);
    if (keys.some((k) => LANGS.includes(k))) {
      const extra = keys.filter((k) => !LANGS.includes(k));
      if (extra.length) errors.push(`${where}: 多言語テキストに不明なキー ${extra.join(', ')}(値のカンマは "..." で囲む)`);
      return;
    }
    keys.forEach((k) => walk(v[k], where ? `${where}.${k}` : k));
  };
  walk(profile, '');
  return { ok: errors.length === 0, errors };
}
