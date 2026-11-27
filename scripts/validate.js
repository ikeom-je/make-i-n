// すべての talk 定義を profile とレジストリに照らして検証する。1件でも不正なら終了コード 1。

import { createDefaultRegistry } from '../src/components/index.js';
import { validateProfile } from '../src/core/profile.js';
import { validateTalk } from '../src/core/talk.js';
import { createDataStore } from '../server/data.js';

const store = createDataStore();
const registry = createDefaultRegistry();
const profile = store.loadProfile();
let failed = 0;
const p = validateProfile(profile);
console.log(`${p.ok ? 'OK ' : 'NG '} profile${p.ok ? '' : `\n  - ${p.errors.join('\n  - ')}`}`);
if (!p.ok) failed++;
for (const { id } of store.listTalks()) {
  const { ok, errors } = validateTalk(store.loadTalk(id), profile, registry);
  console.log(`${ok ? 'OK ' : 'NG '} ${id}${ok ? '' : `\n  - ${errors.join('\n  - ')}`}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
