---
# 対話インテークの要約(エージェントが会話の内容をここに整理する)。
# plan から `npm run intake:build` で talks/<talk.id>.yaml が生成される。
talk:
  id: my-intro
  title: { ja: 自己紹介, en: Self introduction }
  durationSec: 150          # 持ち時間(秒)。2〜3分なら 120〜180
  defaultLang: ja
occasion: TODO             # 場面(例: 研究室の同窓会での LT)
audience: TODO             # 聞き手(例: 研究室の OB・OG と現役学生)
goal: TODO                 # 聞き終わった人にしてほしいこと(例: LinkedIn でつながる)
plan:                      # 並べるパーツ。短縮記法: highlight / links / message は profile のキー名だけでよい
  - title: { photo: photo }
  - career-timeline: { variant: keywords }
  - links: { variant: qr, items: [linkedin, github] }
---
# ja
## 伝えたいこと
- TODO

## 表現・トーン
- TODO

# en
## Key message
- TODO
