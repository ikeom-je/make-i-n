# intent: 自己紹介フレームワーク(intro-framework)

規模: 標準
Issue: なし(ローカル運用。push しない指示のため issue は作らない)

## 課題
自己紹介の資料を場面(同窓会・30秒自己紹介・登壇者紹介・採用イベント)ごとに作り直している。
経歴データは同じなのに、HTML / スライド / PPTX を毎回別に作るため、更新が分散する。

## やること
- 1データソース(profile)× talk 定義(並べ替え)× 複数ビュー(web / slides / print / PPTX)の枠組み
- コンポーネントをレジストリで追加できる構造
- GenMedia(画像・動画・音楽・TTS)をローカルサーバー経由で Vertex AI に代理呼び出し
- 最初の利用例: 研究室同窓会 2026(data/private、リポジトリ管理外)

## 完了の定義
- npm test がグリーン(データ→ビュー変換、talk 検証、言語切替、PPTX 生成、GenMedia アダプタ)
- ローカル起動して web / slides / PPTX が動くことを e2e で確認
