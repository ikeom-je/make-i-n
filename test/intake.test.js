import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { ROOT } from '../server/data.js';
import { buildTalk, checkReadiness, estimateSeconds, parseBrief } from '../server/intake.js';
import { build, check, init, note } from '../scripts/intake.js';

function exampleCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-intake-'));
  fs.cpSync(path.join(ROOT, 'data/example'), dir, { recursive: true });
  return dir;
}

test('brief.md の frontmatter と日英の本文を読み取る', () => {
  const brief = parseBrief(fs.readFileSync(path.join(ROOT, 'data/example/brief.md'), 'utf8'));
  assert.equal(brief.talk.durationSec, 150);
  assert.equal(brief.occasion, '社内勉強会の LT');
  assert.match(brief.summary.ja, /伝えたいこと/);
  assert.match(brief.summary.en, /Key message/);
});

test('plan の短縮記法(キー名だけ)は profile 参照に展開される', () => {
  const talk = buildTalk({ talk: { id: 'x' }, plan: ['title', { 'big-number': { highlight: 'deploys' } }, { links: { variant: 'qr', items: ['linkedin', '$.links.github'] } }, { cta: { message: 'cta' } }] });
  assert.deepEqual(talk.sections.map((s) => s.component), ['title', 'big-number', 'links', 'cta']);
  assert.equal(talk.sections[1].props.highlight, '$.highlights.deploys');
  assert.deepEqual(talk.sections[2].props.items, ['$.links.linkedin', '$.links.github']);
  assert.equal(talk.sections[2].variant, 'qr');
  assert.equal(talk.sections[3].props.message, '$.messages.cta');
});

test('talk.id や plan の無い brief からは talk を作らない', () => {
  assert.throws(() => buildTalk({ plan: ['title'] }), /talk\.id/);
  assert.throws(() => buildTalk({ talk: { id: 'x' } }), /plan/);
});

test('intake:build は brief から検証済みの talk YAML を書き出し、所要時間の目安を返す', () => {
  const dir = exampleCopy();
  const { file, seconds, overBy } = build(dir);
  const talk = YAML.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(talk.id, 'sample-lt');
  assert.equal(talk.sections[1].variant, 'keywords');
  assert.equal(seconds, estimateSeconds(talk));
  assert.equal(overBy, 0, '150 秒以内に収まる');
});

test('持ち時間を超える plan は超過秒数を知らせる', () => {
  const dir = exampleCopy();
  const briefFile = path.join(dir, 'brief.md');
  fs.writeFileSync(briefFile, fs.readFileSync(briefFile, 'utf8').replace('durationSec: 150', 'durationSec: 60'));
  assert.ok(build(dir).overBy > 0);
});

test('参照先の無い plan からは talk を書き出さない', () => {
  const dir = exampleCopy();
  const briefFile = path.join(dir, 'brief.md');
  fs.writeFileSync(briefFile, fs.readFileSync(briefFile, 'utf8').replace('highlight: deploys', 'highlight: nothing'));
  assert.throws(() => build(dir), /\$\.highlights\.nothing/);
});

test('note は要望・表現を1行1件で context/requests.jsonl に追記する', () => {
  const dir = exampleCopy();
  note(dir, 'style', '敬語は控えめに', new Date('2026-01-01T00:00:00Z'));
  const lines = fs.readFileSync(path.join(dir, 'context/requests.jsonl'), 'utf8').trim().split('\n');
  assert.deepEqual(JSON.parse(lines.at(-1)), { ts: '2026-01-01T00:00:00.000Z', kind: 'style', text: '敬語は控えめに' });
  assert.throws(() => note(dir, 'gossip', 'x'), /kind/);
});

test('check は顔写真の未配置など、次に聞くべき不足を挙げる', () => {
  const items = check(exampleCopy());
  assert.ok(items.some((m) => /顔写真/.test(m)));
});

test('TODO や未記入の brief 項目、キーワードの無い経歴を不足として挙げる', () => {
  const missing = checkReadiness({
    profile: { name: { ja: 'TODO' }, timeline: [{ id: 'a', items: [] }] },
    brief: { talk: { id: 'x' }, plan: [] },
  });
  const all = missing.join('\n');
  assert.match(all, /profile\.name\.ja: 未確定/);
  assert.match(all, /キーワードがありません/);
  assert.match(all, /profile\.links/);
  assert.match(all, /brief\.occasion/);
  assert.match(all, /durationSec/);
});

test('init は雛形を作るが既存ファイルは上書きしない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-init-'));
  const created = init(dir);
  assert.ok(created.includes('brief.md') && created.includes(path.join('profile', 'timeline.jsonl')));
  fs.writeFileSync(path.join(dir, 'brief.md'), 'mine');
  assert.ok(!init(dir).includes('brief.md'));
  assert.equal(fs.readFileSync(path.join(dir, 'brief.md'), 'utf8'), 'mine');
  assert.ok(check(dir).some((m) => /未確定/.test(m)), '雛形のままなら TODO が不足として出る');
});
