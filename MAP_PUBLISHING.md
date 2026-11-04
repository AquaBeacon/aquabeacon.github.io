# 水中マップの公開・更新

ポスターのQRは **https://aquabeacon.github.io/map/** に固定する。結果を更新してもQRを作り直さない。

## 公開する結果

2026-11-02の解析 `20261102_nanyo_combined_000/mapping_replay` と、7区間の `mapping_selected/scene.json` を設計元にする。5区間で82,500点・230写真面・218,697三角形、残る2区間は地図未採用。全点・全三角形を残し、写真面を点群へ置き換えない。尺度・配置は暫定。日をまたぐ写真接続の採用候補は736組中0件で、共通ENUへのGNSS重ね合わせとして表示する。

公開状態・確認したコミットは [PUBLICATION.md](PUBLICATION.md)。ローカル生成だけでは公開済みと扱わない。

## 再取得する手順

1. 解析側の数値検証・採用断片・方式・座標系・尺度・欠測を確認する。新しい実験を使う場合は、下の固定実験IDと期待値をレビューして更新する。
2. `python -m pip install -r tools/requirements-authoring.txt` で任意のローカル制作依存を準備する。サイトのビルド・配信依存ではない。
3. `python tools/export_mapping.py --analysis-root ../aquabeacon-analysis` を実行する。元sceneのSHA-256を結合manifestと照合し、数値検証の成功を確認してから書き出す。元解析ファイルは変更しない。
4. `site/map/data/` の公開対象は、5区間のメタデータJSON・バイナリ、230枚の派生JPEG、7区間の選定した表示用軌跡JSON。`tools/verify_site.py` は余分なファイルも拒否する。元動画・生ログ・元manifest・全解像度の航法ログ・地理原点はコピーしない。`export_mapping.py` は最後に `export_navigation.py` を呼び、軌跡の参照を保持する。既存地図をそのままに軌跡のみ取得するときは `python tools/export_navigation.py --analysis-root ../aquabeacon-analysis`。
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

選択した区間だけ読み込み、軌跡を含む初回転送量は初期区間約2.9 MB、全区間約30.0 MB。4並列で写真を読み込み、切替時には古い通信とGPU資源を解放する。JSON・バイナリ・全JPEGをSHA-256で照合。読み込み失敗・WebGL非対応・描画中断をメッセージにし、未採用区間には軌跡と理由のみを表示する。

操作：1本指／マウスドラッグで回転、ピンチ／ホイールで拡大縮小、2本指／Shift＋ドラッグで移動。親機・子機・写真面・点群・目盛りを独立表示。全体／上面／側面／地図拡大／最近傍画像の撮影方向、キーボード、全画面、PNG保存に対応。区間ごとの軌跡を再生でき、時刻はスライダー・秒数の直接入力で指定する。地図は常に後処理の最終結果を表示し、オンライン生成として扱わない。動画・GLBダウンロードは含めない。

## 軌跡の公開形式（2026-11-05）

- カタログは後方互換のschemaVersion 2に `trajectoryVersion: 1` を追加。各区間の `navigation` は `file`、SHA-256、bytes、samplesを持つ。地図未採用2区間にも軌跡を用意し、日別・2日分の表示に含める。
- `data/<実験ID>-navigation.json` はschemaVersion 1。`rows` は `[区間開始からの秒, 親機ENUまたはnull, 子機ENUまたはnull, 水平位置更新からの秒またはnull]`。元sceneの約4 Hz系列を全15,898行、追加間引き・丸め・補間なしで保持する。生CSVや絶対UTCはコピーしない。
- 親機はGNSSアンテナ、子機は機体原点。地図の撮影カメラ中心とは区別する。共通ENUのUを水深と呼ばない。地理原点は非掲載。
- 元sceneのSHA-256を解析の結合manifestと公開地図summaryの両方に照合。`source` に解析commit SHA、scene・verificationのハッシュ、航法の版、真値精度未検証を残す。元解析には最大3秒の子機慣性伝播を含む。表示側で推定値を作らない。
- カーソル時刻以前の直近サンプルを表示し、0.375秒を超える時間差、null行では位置記号を隠す。線は両端が有効で時間差0.375秒以内の隣接行のみ。別区間・別日を結ばない。全履歴／選択時刻までを切り替えられる。
- 元画像は最近傍時刻を選び、差を秒で表示。画像の出現や地図の全点をオンライン生成の進行と称さない。
- `#experiment=<id>&view=<fit|top|side|map|source>&time=<秒>` で区間・時刻・プリセットを再現。任意のドラッグ視点・レイヤー設定まで保存する形式ではない。
- 2026-11-02版の公開結果を使う。11/4以降の光源回復・位置フォールバックを既に反映したと表示しない。校正・尺度は変更せず、状態を画面に示す。

## 受け入れ条件

1. 7区間を省略せず、5区間は元の82,500点・230写真面を維持、未採用2区間は軌跡と理由を表示。
2. 親子の座標・欠測・元sceneのハッシュが一致し、時間差・null・区間境界を越えて線や位置を補完しない。
3. 再生／停止、range／number、レイヤー、視点、ドラッグ・キー、URL復元、PNGが動作する。
4. 375px・1280pxと中間幅で横溢れなし。読み込み・失敗・再試行・WebGL中断を明示する。
5. 通信切替を中断し、GPU資源を解放する。再生は自動開始せず、非表示タブでは停止する。
6. 本番Actions成功、配信HTML・コード・カタログ・軌跡ハッシュと実ブラウザを確認して公開済みとする。

## 検証

```sh
python tools/verify_site.py
node --test tests/map-data.test.mjs tests/navigation-data.test.mjs
python -m ruff check tools/export_mapping.py tools/export_navigation.py tools/verify_site.py
node tools/verify_map_browser.mjs --playwright-root <既存node_modules> --browser-executable <既存ブラウザ>
python tools/prepare_map_qa.py
python -m http.server 8081 --bind 127.0.0.1 --directory .local/map-qa
```

公開データ自体を使って375px・1280pxで確認する。`.local/map-qa/map/` のテストUIで全7区間・3グループ、切替中断、合成タッチ、描画中断を検証できる。実ドラッグ・ボタン・キーボードも確認する。`mobile.html` は375px iframe、`failure/` は存在しないデータによる失敗・再試行の検証。これらの補助UIはGit・配信対象外。スマホ実機と印刷したQRの読み取りは別途確認する。
