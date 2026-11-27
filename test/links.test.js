import test from 'node:test';
import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import qrcode from 'qrcode-generator';
import { normalizeLinks } from '../src/components/links.js';
import { buildPptx } from '../src/core/pptx.js';
import { createQr } from '../src/core/qr.js';
import { createContext, renderTalk } from '../src/core/render.js';
import { normalizeTalk } from '../src/core/talk.js';
import { profile, registry } from './helpers.js';

const qr = createQr(qrcode);
function html(variant, items, lang = 'ja', withQr = true) {
  const r = registry();
  const model = normalizeTalk({ id: 'l', sections: [{ component: 'links', variant, ...(items ? { props: { items } } : {}) }] }, profile, r);
  return renderTalk(model, r, createContext({ lang, profile, qr: withQr ? qr : null }));
}

test('QR はローカルで生成され、同じ URL からは同じ SVG と GIF が得られる', () => {
  const a = qr('https://github.com/example/repo');
  assert.match(a.svg, /^<svg[^>]*viewBox/);
  assert.match(a.gifDataUrl, /^data:image\/gif;base64,/);
  assert.equal(createQr(qrcode)('https://github.com/example/repo').svg, a.svg);
});

test('既定では profile.links の全リンクを QR とリンクの両方で表示する', () => {
  const out = html('both');
  assert.equal((out.match(/<svg/g) ?? []).length, 2);
  assert.match(out, /href="https:\/\/github\.com\/example\/repo"/);
  assert.match(out, />github\.com\/example\/repo</, '表示用 URL はスキームを省く');
  assert.match(out, /LinkedIn/, 'ラベル未指定なら種類の既定名');
  assert.match(out, /ソース/);
});

test('qr バリアントは URL 文字列を出さず、link バリアントは QR を出さない', () => {
  assert.doesNotMatch(html('qr'), /class="link-url"/);
  const link = html('link');
  assert.doesNotMatch(link, /<svg/);
  assert.match(link, /class="link-url"/);
});

test('QR 生成器が無い環境ではリンク表示に落ちる', () => {
  const out = html('qr', undefined, 'ja', false);
  assert.doesNotMatch(out, /<svg/);
  assert.match(out, /class="link-url"/);
});

test('対応 SNS の種類を認識し、不明な種類は Web、危険な URL は除外する', () => {
  const ctx = createContext({ lang: 'en', profile });
  const links = normalizeLinks([
    { type: 'orcid', url: 'https://orcid.org/0000-0000' },
    { type: 'eight', url: 'https://8card.net/p/x' },
    { type: 'x', url: 'https://x.com/example' },
    { type: 'facebook', url: 'https://facebook.com/example' },
    { type: 'mastodon', url: 'https://example.social/@a' },
    { type: 'url', url: 'javascript:alert(1)' },
  ], ctx);
  assert.deepEqual(links.map((l) => l.label), ['ORCID', 'Eight', 'X', 'Facebook', 'Web']);
});

test('talk から特定のリンクだけを参照して出せる(例: リポジトリ URL だけ)', () => {
  const out = html('qr', ['$.links.github']);
  assert.equal((out.match(/<svg/g) ?? []).length, 1);
});

test('PPTX には QR 画像とハイパーリンク付き URL が入る', async () => {
  const r = registry();
  const model = normalizeTalk({ id: 'l', sections: [{ component: 'links' }] }, profile, r);
  const pres = buildPptx(PptxGenJS, model, r, createContext({ lang: 'en', profile, qr }));
  const objs = pres.slides[0]._slideObjects;
  assert.equal(objs.filter((o) => o._type === 'image').length, 2);
  assert.ok((await pres.write({ outputType: 'nodebuffer' })).length > 1000);
});

test('項目ごとの show 指定は section の variant より優先される', () => {
  const out = html('both', [
    { type: 'github', url: 'https://github.com/a/b', show: 'qr' },
    { type: 'orcid', url: 'https://orcid.org/0000', show: 'link' },
  ]);
  assert.equal((out.match(/<svg/g) ?? []).length, 1, 'QR は github だけ');
  assert.equal((out.match(/class="link-url"/g) ?? []).length, 1, 'URL 文字列は orcid だけ');
});
