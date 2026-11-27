import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { validateProfile } from '../src/core/profile.js';

test('YAML の値にカンマを裸で書いて多言語テキストが壊れたら検出する', () => {
  const broken = YAML.parse('role: { ja: エンジニア, en: Engineer, Media }');
  const { ok, errors } = validateProfile({ name: 'x', ...broken });
  assert.equal(ok, false);
  assert.match(errors[0], /role: 多言語テキストに不明なキー Media/);
});

test('引用符で囲めば正しい多言語テキストとして通る', () => {
  const fixed = YAML.parse('role: { ja: エンジニア, en: "Engineer, Media" }');
  assert.equal(validateProfile({ name: 'x', ...fixed }).ok, true);
});

test('name の無い profile は不正', () => {
  assert.equal(validateProfile({}).ok, false);
});

test('media 定義の壊れた profile 参照を検出する', () => {
  const { errors } = validateProfile({ name: 'x', media: { n: { kind: 'tts', text: '$.narration.fr' } } });
  assert.match(errors.join(), /\$\.narration\.fr/);
});
