// 使い方: npm run export:pptx -- <talkId> [ja|en] [出力先.pptx]

import fs from 'node:fs';
import path from 'node:path';
import { createDataStore } from '../server/data.js';
import { buildPptxForTalk } from './lib.js';

const store = createDataStore();
const [talkId = store.listTalks()[0]?.id, lang = 'ja', out] = process.argv.slice(2);
const file = path.resolve(out ?? path.join(store.dataDir, 'exports', `${talkId}-${lang}.pptx`));
fs.mkdirSync(path.dirname(file), { recursive: true });
const pres = buildPptxForTalk(store, talkId, lang);
fs.writeFileSync(file, await pres.write({ outputType: 'nodebuffer' }));
console.log(`wrote ${file}`);
