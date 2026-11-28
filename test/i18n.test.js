import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, normalizeLang, t } from '../src/core/i18n.js';

test('多言語テキストは指定言語を返し、欠けていれば日本語→英語の順に落とす', () => {
  assert.equal(t({ ja: 'こんにちは', en: 'Hello' }, 'en'), 'Hello');
  assert.equal(t({ ja: 'こんにちは' }, 'en'), 'こんにちは');
  assert.equal(t({ en: 'Hello' }, 'ja'), 'Hello');
});

test('単一言語の文字列・数値はそのまま、null は空文字になる', () => {
  assert.equal(t('2T', 'en'), '2T');
  assert.equal(t(2003, 'ja'), '2003');
  assert.equal(t(null, 'ja'), '');
});

test('未対応の言語指定は既定の日本語になる', () => {
  assert.equal(normalizeLang('fr'), 'ja');
  assert.equal(normalizeLang('en'), 'en');
});

test('HTML 特殊文字はエスケープされる', () => {
  assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});
