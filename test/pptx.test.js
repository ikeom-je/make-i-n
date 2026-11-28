import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import { buildPptx } from '../src/core/pptx.js';
import { validateProfile } from '../src/core/profile.js';
import { createContext } from '../src/core/render.js';
import { normalizeTalk } from '../src/core/talk.js';
import { ROOT, createDataStore } from '../server/data.js';
import { buildPptxForTalk } from '../scripts/lib.js';
import { profile, registry, talk } from './helpers.js';

async function toBuffer(pres) {
  return pres.write({ outputType: 'nodebuffer' });
}

test('talk から PPTX を生成すると、セクション数と同じ枚数のスライドを持つ pptx(zip)になる', async () => {
  const r = registry();
  const model = normalizeTalk(talk, profile, r);
  const pres = buildPptx(PptxGenJS, model, r, createContext({ lang: 'en', profile }));
  assert.equal(pres.slides.length, model.sections.length);
  const buf = await toBuffer(pres);
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
});

test('全コンポーネント・全バリアントが PPTX 化で例外を出さない', async () => {
  const r = registry();
  const sections = r.list().flatMap((c) => c.variants.map((variant) => ({
    component: c.name, variant, props: c.name === 'quote' ? { text: 'x' } : c.name === 'media-hero' ? { slot: 'none' } : {},
  })));
  const model = normalizeTalk({ id: 'all', sections: sections.map((s, i) => ({ ...s, id: `s${i}` })) }, profile, r);
  for (const lang of ['ja', 'en']) {
    await toBuffer(buildPptx(PptxGenJS, model, r, createContext({ lang, profile })));
  }
});

const dataDirs = ['data/example', 'data/private'].map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(path.join(d, 'talks')));
for (const dir of dataDirs) {
  const store = createDataStore(dir);
  test(`${path.relative(ROOT, dir)} の profile は検証を通る`, () => {
    assert.deepEqual(validateProfile(store.loadProfile()).errors, []);
  });
  for (const { id } of store.listTalks()) {
    test(`${path.relative(ROOT, dir)} の talk "${id}" は日英どちらでも PPTX に書き出せる`, async () => {
      for (const lang of ['ja', 'en']) {
        const buf = await toBuffer(buildPptxForTalk(store, id, lang));
        assert.ok(buf.length > 1000);
      }
    });
  }
}

test('経歴の肩書(title)は PPTX にも出力される', async () => {
  const r = registry();
  const p = { ...profile, timeline: [{ period: '2020', org: 'X', title: { ja: '部長', en: 'Director' } }] };
  for (const variant of ['rows', 'cards', 'axis']) {
    const model = normalizeTalk({ id: 'x', sections: [{ component: 'career-timeline', variant }] }, p, r);
    const pres = buildPptx(PptxGenJS, model, r, createContext({ lang: 'en', profile: p }));
    const texts = JSON.stringify(pres.slides[0]._slideObjects.map((o) => o.text));
    assert.match(texts, /Director/, variant);
  }
});

test('顔写真の枠つきタイトルも PPTX に書き出せる(写真が無ければ丸い枠だけ)', async () => {
  const r = registry();
  const model = normalizeTalk({ id: 'p', sections: [{ component: 'title', props: { photo: 'photo' } }] }, profile, r);
  const pres = buildPptx(PptxGenJS, model, r, createContext({ lang: 'ja', profile }));
  assert.ok(pres.slides[0]._slideObjects.some((o) => o.shape === 'ellipse' || o.options?.shape === 'ellipse' || JSON.stringify(o).includes('ellipse')));
  await pres.write({ outputType: 'nodebuffer' });
});
