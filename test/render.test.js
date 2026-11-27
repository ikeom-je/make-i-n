import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, renderTalk } from '../src/core/render.js';
import { normalizeTalk } from '../src/core/talk.js';
import { profile, registry, talk } from './helpers.js';

function html(lang, media = {}, t = talk) {
  const r = registry();
  const model = normalizeTalk(t, profile, r);
  return renderTalk(model, r, createContext({ lang, profile, media }));
}

test('日本語で描画すると日本語のテキストが出る', () => {
  const out = html('ja');
  assert.match(out, /山田 太郎/);
  assert.match(out, /話そう/);
  assert.doesNotMatch(out, /Taro Yamada/);
});

test('言語を英語に切り替えると同じ talk が英語で描画される', () => {
  const out = html('en');
  assert.match(out, /Taro Yamada/);
  assert.match(out, /Let&#39;s talk/);
  assert.doesNotMatch(out, /山田 太郎/);
});

test('セクションは talk の順序どおりに並び、コンポーネント名とバリアントのクラスを持つ', () => {
  const out = html('ja');
  const order = [...out.matchAll(/data-component="([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['title', 'career-timeline', 'big-number', 'cta']);
  assert.match(out, /class="section c-career-timeline v-cards size-l"/);
});

test('強調指定された経歴項目はハイライト表示になる', () => {
  assert.equal((html('ja').match(/tl-item is-highlight/g) ?? []).length, 1);
});

test('メディアが未生成のスロットはプレースホルダーになり、音声ボタンは無効になる', () => {
  const out = html('ja', { theme: { slot: 'theme', kind: 'music', file: null } });
  assert.match(out, /data-play-slot="theme"[^>]*disabled/);
});

test('生成済みメディアは /media/ 配下の URL で参照される', () => {
  const media = {
    bg: { slot: 'bg', kind: 'image', file: 'generated/bg-1.png', updatedAt: '2026-01-01' },
    narration_en: { slot: 'narration_en', kind: 'tts', file: 'media/n en.mp3' },
  };
  const out = html('en', media);
  assert.match(out, /src="\/media\/generated\/bg-1\.png\?v=2026-01-01"/);
  assert.match(out, /data-src="\/media\/media\/n%20en\.mp3"/, '英語表示では narration_en を再生する');
});

test('profile 内の HTML はエスケープされて描画される', () => {
  const evil = { ...profile, name: { ja: '<script>x</script>' } };
  const r = registry();
  const model = normalizeTalk({ id: 'e', sections: [{ component: 'title' }] }, evil, r);
  const out = renderTalk(model, r, createContext({ lang: 'ja', profile: evil }));
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
});

test('CTA のリンク先は http(s)/mailto/相対パスだけを許し、javascript: はリンクにしない', async () => {
  const { safeHref } = await import('../src/components/cta.js');
  assert.equal(safeHref('https://cloud.google.com'), 'https://cloud.google.com');
  assert.equal(safeHref('mailto:a@example.com'), 'mailto:a@example.com');
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('//evil.example'), null);
  const r = registry();
  const model = normalizeTalk({ id: 'c', sections: [{ component: 'cta', props: { headline: 'h', button: 'b', href: 'javascript:alert(1)' } }] }, profile, r);
  assert.doesNotMatch(renderTalk(model, r, createContext({ lang: 'ja', profile })), /javascript:/);
});

test('profile の参照はプロトタイプのプロパティ($.constructor など)を辿らない', async () => {
  const { validateTalk } = await import('../src/core/talk.js');
  const { ok } = validateTalk({ id: 'x', sections: [{ component: 'quote', props: { text: '$.constructor' } }] }, profile, registry());
  assert.equal(ok, false);
});
