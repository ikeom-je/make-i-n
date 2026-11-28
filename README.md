# make-i-n — 自己紹介フレームワーク

人物データ(profile)を1か所に書き、talk 定義で「どのパーツをどの順に並べるか」を書くだけで、
**Web(スクロール)/ Slides(16:9・矢印キー・全画面)/ PDF / PPTX** の自己紹介を日英で出せます。
舞台裏カードから Vertex AI の画像・動画・音楽・音声合成をその場で生成してページに差し込めます。

- 設計: [docs/architecture.md](docs/architecture.md) / プロダクト: [docs/product.md](docs/product.md)
- 開発ルール: [AGENTS.md](AGENTS.md)(dot-agent 由来)

## ローカル起動

前提: Node.js 22 以上。GenMedia を使う場合のみ gcloud CLI(`gcloud auth login` 済み)。
gcloud は `brew install --cask gcloud-cli` で入れ、`gcloud auth login` と `gcloud config set project <ID>` を実行します。
サーバーは PATH に加えて Homebrew や SDK の既定の場所でも gcloud を探します。別の場所にある場合は `GCLOUD_BIN` で指定してください。
準備ができていないと、舞台裏カードに理由が表示されます(`/api/genmedia/status` の `authenticated`)。

```bash
npm install
```

```bash
mkdir -p data/private && cp .env.example data/private/.env   # GOOGLE_CLOUD_PROJECT 等を記入(GenMedia を使う場合のみ)
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
- データ形式は YAML / JSON / JSONL / Markdown。
  - `profile.(yaml|json|md)` と `profile/` ディレクトリ(ファイル名がキー。例 `profile/timeline.jsonl` → 経歴、`profile/narration.md` → 原稿)
  - JSONL は1行1項目(空行・`//` 行は無視)。Markdown は frontmatter + 本文で、本文の `# ja` / `# en` 見出しで日英を分けられる
  - 任意の名前のファイルは `"@file:profile/career.jsonl"` のように値として読み込める(データディレクトリ内のみ)
  - `talks/<id>.(yaml|json|md)`(id はファイル名)
- `data/example/` は動作確認用の架空人物サンプルです。

## AI エージェントと対話してデータを作る

Claude Code / Codex / Gemini などに「自己紹介を作りたい」と話しかけると、エージェントが
[docs/intake.md](docs/intake.md) の手順で質問し、答えを `data/private/` に書き出します。

- `profile.yaml`(基本情報・リンク・顔写真)、`profile/timeline.jsonl`(学歴・職歴のキーワード)
- `context/requests.jsonl`(要望・表現の希望を1行ずつ)
- `brief.md`(上を整理した構造化 Markdown。frontmatter の `plan` から talk を生成)

```bash
npm run intake -- init
```

```bash
npm run intake -- check
```

```bash
npm run intake:build
```

`check` は TODO のまま残っている項目や、顔写真・リンクの不足を一覧にします。`build` は持ち時間を超えていれば警告します。

## 自分のデータを作る

1. `data/example/` を `data/private/` にコピーし、`profile.yaml` を書き換える(`data/private/` は git 管理外)。
2. `data/private/talks/<id>.yaml` に並べ方を書く。参照は `$.highlights.tokens` のように profile のパス。
3. 既存素材は `data/private/media/` に置き、`profile.yaml` の `media.<slot>.file` で指定。無ければプレースホルダー表示。
   顔写真は `media.photo` に指定し、talk の title に `photo: photo` と書くと小さな丸枠で表示されます(無ければ枠だけ)。
4. 検証:

```bash
npm run validate
```

YAML のフローマップ `{ ja: ..., en: ... }` で値にカンマを含めるときは `"..."` で囲んでください(validate が検出します)。

## リンク / QR

`profile.links` に SNS や Web の URL を書くと、`links` パーツが QR とリンクを表示します。
QR はローカルで生成するので、URL が外部サービスに送られることはありません。

```yaml
links:
  github: { type: github, url: "https://github.com/you/repo" }
  linkedin: { type: linkedin, url: "https://www.linkedin.com/in/you" }
```

`type` に指定できるのは linkedin / facebook / x / orcid / eight / github / url です。
表示は variant で選びます: `both`(QR+リンク)/ `qr` / `link`。
talk から一部だけ出すときは `items: [$.links.github]` のように書きます。
項目ごとに `show: qr | link | both` を書くと、その項目だけ表示方法を変えられます(variant より優先)。

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
src/components/  パーツ(title, career-timeline, big-number, quote, media-hero, genmedia-studio, cta, links)
src/client/      画面(ビュー切替・JP|EN・スライド操作・PPTX・GenMedia フォーム)
src/themes/      base.css(ビューの仕組み)/ google.css(テーマ)
server/          ローカルサーバー(127.0.0.1)・GenMedia アダプタ(Vertex AI)
scripts/         validate / export-pptx
data/example/    サンプル(架空人物)  ※ data/private/ は git 管理外
test/ test-e2e/  単体テスト(node:test)/ ブラウザ確認(Playwright)
```
