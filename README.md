# make-i-n — 自己紹介フレームワーク

人物データ(profile)を1か所に書き、talk 定義で「どのパーツをどの順に並べるか」を書くだけで、
**Web(スクロール)/ Slides(16:9・矢印キー・全画面)/ PDF / PPTX** の自己紹介を日英で出せます。
舞台裏カードから Vertex AI の画像・動画・音楽・音声合成をその場で生成してページに差し込めます。

- 設計: [docs/architecture.md](docs/architecture.md) / プロダクト: [docs/product.md](docs/product.md)
- 開発ルール: [AGENTS.md](AGENTS.md)(dot-agent 由来)

## ローカル起動

前提: Node.js 22 以上。GenMedia を使う場合のみ gcloud CLI(`gcloud auth login` 済み)。

```bash
npm install
```

```bash
mkdir -p data/private && cp env.example data/private/.env   # GOOGLE_CLOUD_PROJECT 等を記入(GenMedia を使う場合のみ)
```

```bash
npm start             # → http://127.0.0.1:8080/
```

- `data/private/` があればそれを、無ければサンプル `data/example/` を表示します(`DATA_DIR=...` で上書き可)。
- URL パラメータ: `?talk=<id>&view=web|slides|print&lang=ja|en&slide=<n>`
- Slides: `→ / Space / PageDown` で次、`← / PageUp` で前、`Home / End`、`f` で全画面、`Esc` で Web に戻る。
- PDF: 右上「PDF」→ ブラウザの印刷ダイアログで「PDF に保存」(16:9 で1枚1ページ)。
- PPTX: 右上「PPTX」でダウンロード。CLI でも書き出せます:

```bash
npm run export:pptx -- lab-reunion-2026 en out.pptx
```

## 個人データとフレームワークの分離

- リポジトリが管理するのは **フレームワーク(パーツ・表現・ビュー・言語・GenMedia アダプタ)だけ**です。
- 自己紹介する人のデータ・認証情報・非公開データは **すべて `data/private/` 以下**に置きます
  (profile / talks / media / generated / exports / screenshots / `.env`)。`data/private/` は .gitignore 済み。
- データ形式は YAML / JSON(`profile.yaml` または `profile.json`、`talks/<id>.yaml|json`)。
- `data/example/` は動作確認用の架空人物サンプルです。

## 自分のデータを作る

1. `data/example/` を `data/private/` にコピーし、`profile.yaml` を書き換える(`data/private/` は git 管理外)。
2. `data/private/talks/<id>.yaml` に並べ方を書く。参照は `$.highlights.tokens` のように profile のパス。
3. 既存素材は `data/private/media/` に置き、`profile.yaml` の `media.<slot>.file` で指定。無ければプレースホルダー表示。
4. 検証:

```bash
npm run validate
```

YAML のフローマップ `{ ja: ..., en: ... }` で値にカンマを含めるときは `"..."` で囲んでください(validate が検出します)。

## テスト

```bash
npm test
```

ブラウザ e2e(サーバー起動中に実行。インストール済み Google Chrome を使用。スクショは `data/private/screenshots/`、無ければ `test-e2e/screenshots/`):

```bash
BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

## 構成

```
src/core/        i18n・参照解決・talk 検証・メディア解決・HTML 描画・PPTX(ブラウザ/Node 共通)
src/components/  パーツ(title, career-timeline, big-number, quote, media-hero, genmedia-studio, cta)
src/client/      画面(ビュー切替・JP|EN・スライド操作・PPTX・GenMedia フォーム)
src/themes/      base.css(ビューの仕組み)/ google.css(テーマ)
server/          ローカルサーバー(127.0.0.1)・GenMedia アダプタ(Vertex AI)
scripts/         validate / export-pptx
data/example/    サンプル(架空人物)  ※ data/private/ は git 管理外
test/ test-e2e/  単体テスト(node:test)/ ブラウザ確認(Playwright)
```
