// ブラウザでの動作確認(web / slides / 言語切替 / PPTX ダウンロード)とスクリーンショット撮影。
// 使い方: サーバー起動後に BASE_URL=http://127.0.0.1:8080 npm run test:e2e
// Playwright 同梱ブラウザが無い環境ではインストール済みの Google Chrome を使う。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8080';
const talk = process.env.TALK ?? '';
const outDir = path.resolve('test-e2e/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|404/.test(m.text())) errors.push(m.text()); });

const q = talk ? `talk=${talk}&` : '';
await page.goto(`${base}/?${q}view=web&lang=ja`);
await page.waitForFunction(() => window.__introReady === true);
const sections = await page.locator('#deck > .section').count();
assert.ok(sections > 0, 'セクションが描画される');
await page.screenshot({ path: path.join(outDir, 'web-ja.png'), fullPage: true });

await page.click('[data-lang="en"]');
assert.equal(await page.getAttribute('html', 'lang'), 'en', 'EN ボタンで英語表示になる');
await page.screenshot({ path: path.join(outDir, 'web-en.png'), fullPage: true });
await page.click('[data-lang="ja"]');

await page.click('[data-view="slides"]');
for (let i = 0; i < sections; i++) {
  assert.equal(await page.locator('#deck > .section.is-active').count(), 1, 'スライドは常に1枚だけ表示');
  await page.screenshot({ path: path.join(outDir, `slide-${i + 1}.png`) });
  await page.keyboard.press('ArrowRight');
}
assert.equal(await page.textContent('#slide-counter'), `${sections} / ${sections}`, '矢印キーで最後まで進める');

const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="pptx"]')]);
const pptxPath = path.join(outDir, await download.suggestedFilename());
await download.saveAs(pptxPath);
assert.equal(fs.readFileSync(pptxPath).subarray(0, 2).toString(), 'PK', 'PPTX がダウンロードできる');

await page.emulateMedia({ media: 'print' });
await page.pdf({ path: path.join(outDir, 'print.pdf'), width: '13.333in', height: '7.5in', printBackground: true });

await browser.close();
assert.deepEqual(errors, [], `ブラウザエラー: ${errors.join('\n')}`);
console.log(`e2e OK: ${sections} sections, screenshots → ${path.relative(process.cwd(), outDir)}`);
