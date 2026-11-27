// ローカルサーバー起動。127.0.0.1 のみで待ち受ける(GenMedia の課金 API を LAN に晒さないため)。

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createDefaultRegistry } from '../src/components/index.js';
import { createApp } from './app.js';
import { ROOT, createDataStore, resolveDataDir } from './data.js';
import { createVertexClient } from './genmedia/vertex.js';

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const store = createDataStore(resolveDataDir());
const registry = createDefaultRegistry();

let genmedia = null;
function getGenMedia() {
  if (genmedia) return genmedia;
  try {
    genmedia = {
      client: createVertexClient({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GENMEDIA_LOCATION || 'global',
        models: {
          image: process.env.MODEL_IMAGE, video: process.env.MODEL_VIDEO,
          music: process.env.MODEL_MUSIC, tts: process.env.MODEL_TTS,
        },
      }),
    };
  } catch (err) {
    genmedia = { client: null, error: err.message };
  }
  return genmedia;
}

const port = Number(process.env.PORT || 8080);
http.createServer(createApp({ store, registry, getGenMedia })).listen(port, '127.0.0.1', () => {
  console.log(`self-intro: http://127.0.0.1:${port}/  (data: ${path.relative(ROOT, store.dataDir)})`);
});
