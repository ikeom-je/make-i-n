import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProfile, parseJsonl, parseMarkdown } from '../server/formats.js';
import { createDataStore } from '../server/data.js';

function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-fmt-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('JSONL は1行1項目の配列になり、空行と // コメント行は無視される', () => {
  assert.deepEqual(parseJsonl('{"a":1}\n\n// memo\n{"a":2}\n'), [{ a: 1 }, { a: 2 }]);
});

test('JSONL の壊れた行は行番号付きでエラーになる', () => {
  assert.throws(() => parseJsonl('{"a":1}\n{bad}', 'career.jsonl'), /career\.jsonl:2/);
});

test('Markdown は frontmatter と本文に分かれ、# ja / # en 見出しで言語ごとの本文になる', () => {
  const { front, body } = parseMarkdown('---\nvoice: Puck\n---\n# ja\nこんにちは。\n改行も残る\n\n# en\nHello.\n');
  assert.deepEqual(front, { voice: 'Puck' });
  assert.deepEqual(body, { ja: 'こんにちは。\n改行も残る', en: 'Hello.' });
});

test('言語見出しの無い Markdown は本文がそのまま文字列になる', () => {
  assert.equal(parseMarkdown('ただのメモ').body, 'ただのメモ');
});

test('profile/ ディレクトリの jsonl・md・json はファイル名をキーとして profile に合流する', () => {
  const dir = tmp({
    'profile.yaml': 'name: { ja: 太郎, en: Taro }\n',
    'profile/timeline.jsonl': '{"period":"2001","org":"A"}\n{"period":"2010","org":"B","highlight":true}\n',
    'profile/narration.md': '# ja\nこんにちは\n# en\nHello\n',
    'profile/highlights.json': '{"n":{"value":"2T"}}',
  });
  const p = loadProfile(dir);
  assert.equal(p.timeline.length, 2);
  assert.equal(p.timeline[1].highlight, true);
  assert.deepEqual(p.narration, { ja: 'こんにちは', en: 'Hello' });
  assert.equal(p.highlights.n.value, '2T');
});

test('"@file:" で任意の名前のファイル(例: career.jsonl)を profile の値として読み込める', () => {
  const dir = tmp({
    'profile.json': '{"name":"x","timeline":"@file:profile-data/career.jsonl"}',
    'profile-data/career.jsonl': '{"period":"2005","org":"NHK"}\n',
  });
  assert.deepEqual(loadProfile(dir).timeline, [{ period: '2005', org: 'NHK' }]);
});

test('"@file:" でデータディレクトリの外は読めない', () => {
  const dir = tmp({ 'profile.json': '{"name":"x","secret":"@file:../outside.json"}' });
  assert.throws(() => loadProfile(dir), /データディレクトリ外/);
});

test('profile 本体と profile/ の同じキーは衝突エラーになる(どちらが正か曖昧にしない)', () => {
  const dir = tmp({ 'profile.yaml': 'name: x\ntimeline: []\n', 'profile/timeline.jsonl': '{"a":1}\n' });
  assert.throws(() => loadProfile(dir), /"timeline"/);
});

test('profile.md(frontmatter)だけでも profile になる', () => {
  const dir = tmp({ 'profile.md': '---\nname: { ja: 花子, en: Hanako }\n---\n' });
  assert.equal(loadProfile(dir).name.en, 'Hanako');
});

test('talk は md(frontmatter)・json でも書け、id はファイル名で引ける', () => {
  const dir = tmp({
    'profile.yaml': 'name: x\n',
    'talks/a-md.md': '---\ntitle: md talk\nsections:\n  - component: title\n---\n発表メモ\n',
    'talks/b-json.json': '{"id":"other","sections":[{"component":"title"}]}',
  });
  const store = createDataStore(dir);
  assert.deepEqual(store.listTalks().map((t) => t.id), ['a-md', 'b-json']);
  assert.equal(store.listTalks()[1].declaredId, 'other');
  assert.equal(store.loadTalk('a-md').id, 'a-md');
  assert.equal(store.loadTalk('a-md').sections[0].component, 'title');
});
