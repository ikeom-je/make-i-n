---
name: intro-intake
description: 自己紹介の内容を本人と対話しながら集め、data/private(git 管理外)の profile / timeline.jsonl / context/requests.jsonl / brief.md に書き出し、npm run intake:build で talk を生成するときに使う。
---

# intro-intake

手順の本体は [docs/intake.md](../../../docs/intake.md)。この skill はその実行役。

1. `npm run intake -- init` で雛形を作る(既存は上書きされない)。
2. docs/intake.md の質問表の順に、1回1〜2問ずつ聞く。答えは復唱して確認してから書く。
3. 書き込み先は `data/private/` だけ。要望・表現の希望は `npm run intake -- note <kind> <text>` で1行ずつ残す。
4. 毎ターンの終わりに `npm run intake -- check` を実行し、出てきた不足を次の質問にする。
5. 不足が無くなったら `npm run intake:build` で talk を生成し、`npm start` の画面を本人に確認してもらう。

推測で値を埋めない。分からないものは `TODO` のまま残す。
