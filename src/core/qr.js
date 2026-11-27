// QR コードをローカルで生成する(外部 API に URL を送らないため)。
// qrcode-generator のファクトリは呼び出し側から渡す(ブラウザは /vendor の ESM、Node は npm パッケージ)。

export function createQr(qrcode, { ecl = 'M' } = {}) {
  const cache = new Map();
  return (text) => {
    if (cache.has(text)) return cache.get(text);
    const code = qrcode(0, ecl);
    code.addData(String(text));
    code.make();
    const out = {
      modules: code.getModuleCount(),
      svg: code.createSvgTag({ cellSize: 4, margin: 2, scalable: true }),
      // PPTX には SVG を確実に埋め込めないため、同じコードの GIF も用意する。
      gifDataUrl: code.createDataURL(8, 2),
    };
    cache.set(text, out);
    return out;
  };
}
