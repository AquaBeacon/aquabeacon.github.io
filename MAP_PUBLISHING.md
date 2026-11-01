# 水中マップの公開・更新

ポスターのQRは **https://aquabeacon.github.io/map/** に固定する。結果を更新してもQRを作り直さない。

## 公開する結果

2026-11-02の解析 `20261102_nanyo_combined_000/mapping_replay` と、7区間の `mapping_selected/scene.json` を設計元にする。5区間で82,500点・230写真面・218,697三角形、残る2区間は地図未採用。全点・全三角形を残し、写真面を点群へ置き換えない。尺度・配置は暫定。日をまたぐ写真接続の採用候補は736組中0件で、共通ENUへのGNSS重ね合わせとして表示する。

公開状態・確認したコミットは [PUBLICATION.md](PUBLICATION.md)。ローカル生成だけでは公開済みと扱わない。

## 再取得する手順

1. 解析側の数値検証・採用断片・方式・座標系・尺度・欠測を確認する。新しい実験を使う場合は、下の固定実験IDと期待値をレビューして更新する。
2. `python -m pip install -r tools/requirements-authoring.txt` で任意のローカル制作依存を準備する。サイトのビルド・配信依存ではない。
3. `python tools/export_mapping.py --analysis-root ../aquabeacon-analysis` を実行する。元sceneのSHA-256を結合manifestと照合し、数値検証の成功を確認してから書き出す。元解析ファイルは変更しない。
4. `site/map/data/` の公開対象は、5区間のメタデータJSON・バイナリと230枚の派生JPEGのみ。`tools/verify_site.py` は余分なファイルも拒否する。元動画・生ログ・元manifest・航法時系列・地理原点はコピーしない。
5. レポート、研究入口、手法、ポスター原稿を更新する。静止RMSEから地図の精度を推論しない。位置合わせ残差も独立真値の誤差ではない。
6. 下記の検証を実行する。対象差分だけをレビューしてmainへpushし、Actions成功と本番URL・配信データのSHA-256を確認してから公開記録を更新する。

## 形式と精度の扱い

- `site/map/manifest.json` はschemaVersion 2。ready/unavailableの区間、グループ、点数・写真面数・三角形数、通信量、SHA-256を持つ。defaultSelectionは静止評価と同じ `20261101_nanyo_003`。
- 区間JSONは `data/<実験ID>.json`。共通ENUメートルの座標はバイナリのlittle-endian float32、色はuint8、三角形の頂点番号はuint16。各ビューにbyteOffset/count/components/typeを記録し、4バイト境界へ揃える。点数・面数とバイナリ範囲を実行時にも検証する。
- 座標のfloat32符号化差は最大0.000002845 m未満。これは表示形式の差で、測量精度ではない。中心化・画角・倍率の変更は表示だけに作用し、地図同士の相対配置を動かさない。
- 画像は元出力の960×540 JPEGをバイト同一で保存。EXIFがあればexportを停止する。描画時だけ480×270に縮小し、スマホのGPUメモリを抑える。
- 元scene・結合レポート・manifest・verificationのSHA-256と採用／除外理由は、公開用に選定した `research/reports/20261102-mapping/summary.json` へ残す。元ファイル全体の公開ではない。

## ビューアー

`map-data.js` は形式検証とカメラ変換、`map-renderer.js` は自作WebGL 1描画、`map-viewer.js` は読み込みとPointer Events操作。外部JS・CDN・アカウント不要。本文とレポートはJavaScriptなしでも読める。

選択した区間だけ読み込み、初回の転送量は初期区間約2.7 MB、全区間約28.2 MB。4並列で写真を読み込み、切替時には古い通信とGPU資源を解放する。JSON・バイナリ・全JPEGをSHA-256で照合。読み込み失敗・WebGL非対応・描画中断をメッセージにし、未採用区間には地図を表示しない。

操作：1本指／マウスドラッグで回転、ピンチ／ホイールで拡大縮小、2本指／Shift＋ドラッグで移動。写真面・点群の切替、撮影方向／全体／上面、キーボード、対応ブラウザの全画面。航跡と同期動画の再生・PNG保存・GLBダウンロードはこの公開ページには含めない。

## 検証

```sh
python tools/verify_site.py
node --test tests/map-data.test.mjs
python tools/prepare_map_qa.py
python -m http.server 8081 --bind 127.0.0.1 --directory .local/map-qa
```

公開データ自体を使って375px・1280pxで確認する。`.local/map-qa/map/` のテストUIで全7区間・3グループ、切替中断、合成タッチ、描画中断を検証できる。実ドラッグ・ボタン・キーボードも確認する。`mobile.html` は375px iframe、`failure/` は存在しないデータによる失敗・再試行の検証。これらの補助UIはGit・配信対象外。スマホ実機と印刷したQRの読み取りは別途確認する。
