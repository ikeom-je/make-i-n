import test from 'node:test';
import assert from 'node:assert/strict';
import { TalkValidationError, normalizeTalk, validateTalk } from '../src/core/talk.js';
import { profile, registry, talk } from './helpers.js';

test('正しい talk 定義は検証を通り、profile 参照が実データに解決される', () => {
  const model = normalizeTalk(talk, profile, registry());
  assert.deepEqual(model.sections.map((s) => s.component), ['title', 'career-timeline', 'big-number', 'cta']);
  assert.equal(model.sections[2].props.highlight.value, '2T');
  assert.equal(model.sections[1].props.items.length, 2, 'career-timeline は既定で $.timeline を使う');
  assert.deepEqual(model.sections[0].props.name, profile.name, 'title は既定で $.name を使う');
});

test('variant・size 省略時はコンポーネントの既定値になる', () => {
  const model = normalizeTalk(talk, profile, registry());
  assert.equal(model.sections[0].variant, 'split');
  assert.equal(model.sections[1].variant, 'cards');
  assert.equal(model.sections[0].size, 'l');
});

test('同じ profile でもセクションの並べ替えだけで別のトークになる', () => {
  const reordered = { id: 'r', sections: [talk.sections[3], talk.sections[0]] };
  const model = normalizeTalk(reordered, profile, registry());
  assert.deepEqual(model.sections.map((s) => s.component), ['cta', 'title']);
});

test('未登録コンポーネント・不正な variant/size・壊れた参照・重複 id をまとめて報告する', () => {
  const bad = {
    id: 'bad',
    sections: [
      { component: 'nope' },
      { component: 'career-timeline', variant: 'spiral' },
      { component: 'quote', size: 'xxl', props: { text: '$.messages.missing' } },
      { id: 'dup', component: 'cta' },
      { id: 'dup', component: 'cta' },
    ],
  };
  const { ok, errors } = validateTalk(bad, profile, registry());
  assert.equal(ok, false);
  const all = errors.join('\n');
  assert.match(all, /未登録の component "nope"/);
  assert.match(all, /variant "spiral"/);
  assert.match(all, /size "xxl"/);
  assert.match(all, /\$\.messages\.missing/);
  assert.match(all, /"dup" が重複/);
});

test('必須 props が無いと検証エラーになる', () => {
  const { ok, errors } = validateTalk({ id: 'x', sections: [{ component: 'quote' }] }, profile, registry());
  assert.equal(ok, false);
  assert.match(errors.join(), /必須 props "text"/);
});

test('id や sections が無い talk は不正', () => {
  assert.equal(validateTalk({ sections: [] }, profile, registry()).ok, false);
  assert.throws(() => normalizeTalk({ id: 'x', sections: [] }, profile, registry()), TalkValidationError);
});

test('レジストリに独自コンポーネントを追加すると talk から使える', () => {
  const r = registry().register({ name: 'hello', render: () => '<p>hi</p>', pptx: () => {} });
  const model = normalizeTalk({ id: 'h', sections: [{ component: 'hello' }] }, profile, r);
  assert.equal(model.sections[0].component, 'hello');
  assert.throws(() => r.register({ name: 'hello', render() {}, pptx() {} }), /重複/);
});
