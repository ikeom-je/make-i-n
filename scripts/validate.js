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
for (const { id, declaredId } of store.listTalks()) {
  const { ok: valid, errors } = validateTalk(store.loadTalk(id), profile, registry);
  if (declaredId && declaredId !== id) errors.push(`id "${declaredId}" がファイル名 "${id}" と一致しません`);
  const ok = valid && errors.length === 0;
  console.log(`${ok ? 'OK ' : 'NG '} ${id}${ok ? '' : `\n  - ${errors.join('\n  - ')}`}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
