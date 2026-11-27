import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeMedia } from '../src/core/media.js';
import { createDataStore, safeMediaPath } from '../server/data.js';

test('生成物 manifest のファイルが profile の既定素材より優先される', () => {
  const m = mergeMedia({ bg: { kind: 'image', file: 'media/bg.png', prompt: 'old' } },
    { slots: { bg: { kind: 'image', file: 'generated/bg-2.png', prompt: 'new' } } });
  assert.equal(m.bg.file, 'generated/bg-2.png');
  assert.equal(m.bg.prompt, 'new');
});

test('実在しないファイルは使わず、既定素材 → 無し(プレースホルダー)の順に落ちる', () => {
  const profileMedia = { bg: { kind: 'image', file: 'media/bg.png' } };
  const manifest = { slots: { bg: { file: 'generated/gone.png' } } };
  assert.equal(mergeMedia(profileMedia, manifest, (f) => f === 'media/bg.png').bg.file, 'media/bg.png');
  assert.equal(mergeMedia(profileMedia, manifest, () => false).bg.file, null);
});

test('メディアパスは media/ と generated/ の中だけを許可する', () => {
  const dir = path.resolve('/tmp/x');
  assert.ok(safeMediaPath(dir, 'media/a.png'));
  assert.ok(safeMediaPath(dir, 'generated/a.png'));
  assert.equal(safeMediaPath(dir, '../etc/passwd'), null);
  assert.equal(safeMediaPath(dir, 'media/../profile.yaml'), null);
  assert.equal(safeMediaPath(dir, 'profile.yaml'), null);
});

test('生成物を保存すると manifest に記録され、以前のファイルは履歴に残る', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-'));
  fs.writeFileSync(path.join(dir, 'profile.yaml'), 'name: x\nmedia:\n  bg: { kind: image, file: media/none.png }\n');
  const store = createDataStore(dir);
  const first = store.saveGenerated('bg', { kind: 'image', ext: 'png', data: Buffer.from('1'), prompt: 'p1' });
  const second = store.saveGenerated('bg', { kind: 'image', ext: 'png', data: Buffer.from('2'), prompt: 'p2' });
  assert.deepEqual(second.history, [first.file]);
  const media = store.mediaFor(store.loadProfile());
  assert.equal(media.bg.file, second.file);
  assert.equal(media.bg.prompt, 'p2');
});

test('media 定義の text は profile の原稿を参照できる', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-'));
  fs.writeFileSync(path.join(dir, 'profile.yaml'), 'narration: { en: Hello }\nmedia:\n  n: { kind: tts, text: $.narration.en }\n');
  const store = createDataStore(dir);
  assert.equal(store.mediaFor(store.loadProfile()).n.text, 'Hello');
});

test('同じ瞬間に2回生成しても、ファイル名が衝突して上書きされない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-'));
  fs.writeFileSync(path.join(dir, 'profile.yaml'), 'name: x\n');
  const store = createDataStore(dir);
  const realNow = Date.prototype.toISOString;
  Date.prototype.toISOString = () => '2026-01-01T00:00:00.000Z';
  try {
    const a = store.saveGenerated('s', { kind: 'image', ext: 'png', data: Buffer.from('a') });
    const b = store.saveGenerated('s', { kind: 'image', ext: 'png', data: Buffer.from('b') });
    assert.notEqual(a.file, b.file);
    assert.equal(fs.readFileSync(path.join(dir, a.file), 'utf8'), 'a');
  } finally {
    Date.prototype.toISOString = realNow;
  }
});
