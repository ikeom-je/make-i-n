// 正規化済み talk → PPTX。PptxGenJS のコンストラクタは呼び出し側から渡す
// (ブラウザは同梱 bundle の window.PptxGenJS、Node は npm の pptxgenjs)。

export const PPTX_THEME = {
  w: 13.333,
  h: 7.5,
  font: 'Google Sans',
  fontJa: 'Noto Sans JP',
  colors: {
    blue: '1A73E8', red: 'EA4335', yellow: 'FBBC04', green: '34A853',
    text: '202124', sub: '5F6368', line: 'DADCE0', bg: 'FFFFFF', soft: 'F8F9FA',
  },
};

function createKit(pres, ctx, resolveMediaPath) {
  const { colors, w, h } = PPTX_THEME;
  const font = ctx.lang === 'ja' ? PPTX_THEME.fontJa : PPTX_THEME.font;
  return {
    pres, colors, w, h, font,
    addBar(slide, y = 0, height = 0.08) {
      const seg = w / 4;
      [colors.blue, colors.red, colors.yellow, colors.green].forEach((c, i) => {
        slide.addShape(pres.ShapeType.rect, { x: seg * i, y, w: seg, h: height, fill: { color: c }, line: { color: c } });
      });
    },
    // 動画スロットは PPTX に埋め込まずポスター画像で代替する(ファイルが巨大になり再生互換も低いため)。
    imagePath(slot) {
      const entry = ctx.mediaEntry(slot);
      if (!entry) return null;
      if (entry.kind === 'image' && entry.file) return resolveMediaPath(entry, 'file');
      if (entry.kind === 'video' && entry.poster) return resolveMediaPath(entry, 'poster');
      return null;
    },
    text(slide, value, opts) {
      slide.addText(ctx.t(value), { fontFace: font, color: colors.text, margin: 0, ...opts });
    },
  };
}

export function buildPptx(PptxGenJS, model, registry, ctx, { resolveMediaPath = (e, f) => ctx.mediaUrl(e.slot, f) } = {}) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = ctx.t(model.title);
  pres.author = ctx.t(ctx.profile?.name);
  const kit = createKit(pres, ctx, resolveMediaPath);
  for (const section of model.sections) {
    const slide = pres.addSlide();
    slide.background = { color: PPTX_THEME.colors.bg };
    registry.get(section.component).pptx(slide, section.props, ctx, kit, section);
    if (section.notes) slide.addNotes(ctx.t(section.notes));
  }
  return pres;
}
