# intake.md — 対話インテーク(会話から自己紹介データを作る)

AI エージェント(Claude Code / Codex / Gemini など)が本人と会話し、自己紹介に必要な情報を
`data/private/`(git 管理外)にデータとして書き出すための手順。リポジトリ側は手順と CLI だけを持ち、
会話の中身(個人データ)は一切コミットしない。

## 置き場所と形式

| ファイル | 形式 | 中身 |
|---|---|---|
| `data/private/profile.yaml` | YAML | 名前・所属・肩書・キャッチコピー・`links`(QR に出す URL)・`highlights`・`messages`・`media`(顔写真など) |
| `data/private/profile/timeline.jsonl` | JSONL(1行1項目) | 学歴・職歴。`period` / `org`(大学名・学部・学科、会社名)/ `items`(キーワード)/ `badge` / `highlight` |
| `data/private/context/requests.jsonl` | JSONL(1行1件) | 会話で出た要望・表現の希望。`kind`: `intro` 紹介したいこと / `request` 要望 / `style` 表現・トーン / `avoid` 避けたいこと / `fact` 事実メモ |
| `data/private/brief.md` | Markdown(frontmatter + `# ja` / `# en`) | 上を整理した要約。frontmatter の `talk` と `plan` から talk を生成する |
| `data/private/talks/<id>.yaml` | YAML | `npm run intake:build` が brief.md から生成 |
| `data/private/media/` | 画像・音声・動画 | 顔写真(`media/photo.jpg` など)。`profile.media.photo.file` で指定 |

テキストは `{ ja, en }` で日英を持つ。決まっていない値は `TODO` と書いておく(`check` が拾う)。

## 手順

1. 雛形を作る(既存ファイルは上書きしない):

   ```bash
   npm run intake -- init
   ```

2. 次の順で質問し、答えを上の表のファイルに書く。1回に聞くのは1〜2項目にし、聞いた内容は書く前に復唱して確認する。

   | # | 質問 | 書き先 |
   |---|---|---|
   | 1 | どんな場で、誰に向けて話すか | brief.md `occasion` / `audience` |
   | 2 | 持ち時間 | brief.md `talk.durationSec`(2〜3分なら 120〜180) |
   | 3 | 名前・所属・肩書・ひとことで言うと | profile.yaml |
   | 4 | 大学・大学院の名前と学部・学科・研究室、在籍年 | timeline.jsonl(学校ごとに1行) |
   | 5 | 職歴ごとに「何をしていたか」をキーワード 3〜5 個で | timeline.jsonl の `items` |
   | 6 | いま一番伝えたい数字・トピック | profile.yaml `highlights` |
   | 7 | 聞き終わった人にしてほしいこと(採用・相談・つながる)と締めの言葉 | brief.md `goal`、profile.yaml `messages.cta` |
   | 8 | QR で案内したいリンク(LinkedIn・GitHub・X・ORCID・Eight など) | profile.yaml `links` |
   | 9 | 顔写真(ファイルの場所) | `media/` に置き、profile.yaml `media.photo.file` |
   | 10 | 避けたい話題・表現のトーン | context/requests.jsonl(`avoid` / `style`) |

   要望や表現の希望はその都度1行ずつ記録する:

   ```bash
   npm run intake -- note style "経歴はキーワードだけにしたい"
   ```

3. brief.md の `plan` に並べるパーツを書く(持ち時間の目安: title 20秒、career-timeline 50秒、big-number 25秒、
   links 20秒、cta 15秒、genmedia-studio 60秒)。2〜3分なら 4〜5 パーツに抑える。

4. 不足を確認して、talk を生成する:

   ```bash
   npm run intake -- check
   ```

   ```bash
   npm run intake:build
   ```

   `check` の出力が次に聞くべき質問になる。`build` は持ち時間を超えると警告する。

5. `npm start` で表示を本人に見せ、直したい点を `note` に記録して 2〜4 を繰り返す。

## エージェントへの注意

- 書き込むのは `data/private/` の中だけ。リポジトリのファイルに個人の情報を書かない。
- 推測で埋めない。分からない値は `TODO` のまま残し、本人に聞く。
- 顔写真や URL は本人が用意したものだけを使う。
