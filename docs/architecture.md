# architecture.md — 自己紹介フレームワーク

## 全体像

```
data/<private|example>/
  profile.yaml ──┐            (人物データ: 単一ソース)
  talks/*.yaml ──┼─▶ normalizeTalk ─▶ model ─┬─▶ renderTalk ─▶ HTML ─▶ CSS で web / slides / print
  generated/     │   (検証+参照解決)          └─▶ buildPptx  ─▶ PPTX(ブラウザ / CLI)
   manifest.json ┴─▶ mergeMedia ─▶ media(slot → file)
                                     ▲
  ブラウザ ── POST /api/genmedia ──▶ server(127.0.0.1)── gcloud token ──▶ Vertex AI
```

## レイヤ
| パス | 役割 | 実行環境 |
|---|---|---|
| `src/core/` | i18n・参照解決・talk 検証/正規化・メディア解決・HTML 描画・PPTX 組み立て | ブラウザ + Node(同一 ESM) |
| `src/components/` | パーツ(title / career-timeline / big-number / quote / media-hero / genmedia-studio / cta / links)とレジストリ登録 | 同上 |
| `src/client/` | 画面制御(ビュー切替・言語・スライド操作・PPTX ダウンロード・GenMedia フォーム) | ブラウザ |
| `src/themes/` | `base.css`(ビューの仕組み)+ テーマ(`google.css`) | ブラウザ |
| `server/` | 静的配信・talk API・メディア配信(Range 対応)・GenMedia 代理 | Node |
| `scripts/` | `validate`(全 talk 検証)・`export-pptx`(CLI 書き出し)・`intake`(対話インテークの init / note / check / build) | Node |
| `templates/intake/` | `intake init` が data/private に置く雛形 | — |

## データモデル
個人データは `data/private/` に YAML / JSON / JSONL / Markdown で置く(`server/formats.js` が読む)。
profile は `profile.(yaml|json|md)` と `profile/<key>.<ext>`(ファイル名がキー)を合成し、`"@file:<path>"` で任意ファイルを取り込める。
- **profile**: `name / affiliation / role / tagline / timeline[] / highlights{id} / messages{id} / narration / media{slot}`。
  テキストは `{ja, en}` か単一文字列。
- **talk**: `id / title / theme / defaultLang / order / sections[]`。section は
  `component / variant / size(s|m|l|full) / emphasis / id / notes / props`。
  props の `"$.path"` は profile への参照で、描画前に実データへ解決する。
- **media slot**: `kind(image|video|music|tts) / file / poster / prompt / text / voice / aspectRatio`。
  `generated/manifest.json` に同じスロット名の生成物があればそちらを優先(実在するファイルだけ採用)。

## コンポーネント契約
```js
{ name, description, variants: [...], props: { key: { required } }, defaults: { key: '$.ref' },
  render(props, ctx, section) => html, pptx(slide, props, ctx, kit, section) }
```
`createDefaultRegistry().register(def)` で追加。ctx は `t / tx / esc / mediaEntry / mediaUrl / lang / profile / qr`。QR は `src/core/qr.js` がローカル生成(qrcode-generator を `/vendor/qrcode.mjs` で配信、外部 API 不使用)。

## ビュー
- 同じ DOM を `body.view-{web|slides|print}` で出し分ける。サイズは単位 `--u`(スライド幅の 1%= `1cqw`)で統一し、
  スライドでも Web でも比率が崩れない。
- PPTX はブラウザ(同梱 `pptxgen.bundle.js` を `/vendor/` で配信。CDN 不使用)と Node CLI の両方で同じ `buildPptx` を使う。
  動画はポスター画像で代替。

## GenMedia
| 種類 | API | 要点 |
|---|---|---|
| 画像 | `models/<MODEL_IMAGE>:generateContent` | `responseModalities: [TEXT, IMAGE]`、`imageConfig.aspectRatio`、最後の inlineData を採用 |
| 音声合成 | `models/<MODEL_TTS>:generateContent` | `responseModalities: [AUDIO]`、`speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`。生 PCM は WAV に包む |
| 動画 | `interactions`(`background: true`)→ `GET interactions/<id>` をポーリング | `steps[].content[]` の `type=video` を base64 デコード |
| 音楽 | `interactions`(`stream: true`) | SSE の `delta.type=audio` を連結。recitation は言い換えを促すエラー |

共通: `x-goog-user-project` ヘッダ、429/503 は指数バックオフで再試行、トークンは `gcloud auth print-access-token` を5分キャッシュ。
安全策: 127.0.0.1 バインド、Host はループバックのみ(DNS rebinding 対策)、POST は同一オリジンかつ application/json のみ、スロット名は `[\w-]+`、メディア配信は `media/`・`generated/` 配下のみ。
