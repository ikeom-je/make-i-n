// メディアスロットの解決。profile.media の定義(プロンプト・既定ファイル)に、
// 生成物 manifest の最新ファイルを重ねる。ファイルが無いスロットはプレースホルダー扱い。

export const MEDIA_KINDS = ['image', 'video', 'music', 'tts'];

export function mergeMedia(profileMedia = {}, manifest = {}, fileExists = () => true) {
  const slots = manifest?.slots ?? {};
  const out = {};
  for (const slot of new Set([...Object.keys(profileMedia), ...Object.keys(slots)])) {
    const def = profileMedia[slot] ?? {};
    const gen = slots[slot];
    const candidates = [gen?.file, def.file].filter(Boolean);
    const file = candidates.find((f) => fileExists(f)) ?? null;
    const poster = [gen?.poster, def.poster].filter(Boolean).find((f) => fileExists(f)) ?? null;
    out[slot] = {
      slot,
      kind: def.kind ?? gen?.kind ?? 'image',
      file,
      poster,
      prompt: gen?.prompt ?? def.prompt ?? '',
      text: gen?.text ?? def.text ?? '',
      voice: def.voice ?? 'Puck',
      aspectRatio: def.aspectRatio ?? '16:9',
      label: def.label ?? slot,
      updatedAt: gen?.createdAt ?? null,
    };
  }
  return out;
}

export function mediaUrl(entry, field = 'file', base = '/media/') {
  const file = entry?.[field];
  if (!file) return null;
  const v = entry.updatedAt ? `?v=${encodeURIComponent(entry.updatedAt)}` : '';
  return `${base}${file.split('/').map(encodeURIComponent).join('/')}${v}`;
}
