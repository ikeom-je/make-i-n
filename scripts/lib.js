// CLI スクリプト共通: データストアから talk を読み込み、正規化済みモデルとコンテキストを作る。

import PptxGenJS from 'pptxgenjs';
import qrcode from 'qrcode-generator';
import { createQr } from '../src/core/qr.js';
import { createDefaultRegistry } from '../src/components/index.js';
import { buildPptx } from '../src/core/pptx.js';
import { createContext } from '../src/core/render.js';
import { normalizeTalk } from '../src/core/talk.js';

export function loadModel(store, talkId, lang) {
  const registry = createDefaultRegistry();
  const profile = store.loadProfile();
  const talk = store.loadTalk(talkId);
  if (!talk) throw new Error(`talk が見つかりません: ${talkId}`);
  const model = normalizeTalk(talk, profile, registry);
  const ctx = createContext({ lang: lang ?? model.defaultLang, profile, media: store.mediaFor(profile), mode: 'pptx', qr: createQr(qrcode) });
  return { registry, profile, talk, model, ctx };
}

export function buildPptxForTalk(store, talkId, lang) {
  const { registry, model, ctx } = loadModel(store, talkId, lang);
  return buildPptx(PptxGenJS, model, registry, ctx, {
    resolveMediaPath: (entry, field) => store.absMedia(entry[field]),
  });
}
