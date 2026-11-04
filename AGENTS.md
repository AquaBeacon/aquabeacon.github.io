# 紹介サイトの作業規約

- HTML/CSSの静的サイト。配信対象はsite/のみ。外部JavaScript・ビルド依存は追加しない。
- DESIGN.mdとCSS変数に従う。
- `python -m http.server 8080 --bind 127.0.0.1 --directory site` で確認する。
- 表示変更時は375pxと1280pxで横溢れ・リンク・キーボードフォーカスを確認する。
- 機能・URL・公開状態の変更時はREADMEと対応文書を更新する。公開済みとの記載には実際の公開確認が必要。

## 軌跡とマップ（2026-11-05）

- `/map/` は親機・子機・採用地図を共通ENUで表示する。測定中心は親機GNSSアンテナ／子機機体原点。欠測間・別区間・別日を線でつながない。
- 位置・時刻・欠測を表示の都合で補正しない。3Dの丸は位置記号で、架空のCADや姿勢を示さない。地図は後処理の最終結果で、時刻再生は航法結果のみ。
- `python tools/export_navigation.py --analysis-root ../aquabeacon-analysis` で既存公開地図と同じsceneの表示用系列だけを取得する。元sceneのSHA-256を公開来歴・解析manifestの両方と照合する。
- `python tools/verify_site.py`、`node --test tests/map-data.test.mjs tests/navigation-data.test.mjs`、変更Pythonのruffを実行する。
- 実画面は `node tools/verify_map_browser.mjs --playwright-root <既存node_modules> --browser-executable <既存Edge等>`。一時サーバー・専用ブラウザのPIDと開始時刻を記録し、finallyで終了する。`--url https://aquabeacon.github.io` で本番確認。
- 公開データの形式・制約・受け入れ条件は `MAP_PUBLISHING.md`、表示の判断は `DESIGN.md` に同期する。
