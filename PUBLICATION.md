# 研究ページの公開記録

## 親子の軌跡とマップの表示更新（2026-11-05）

- 公開元：`41dc1247628303f4b8125934fc0dfcbfcea58b5d`。[GitHub Actions成功](https://github.com/AquaBeacon/aquabeacon.github.io/actions/runs/41857338245)と [本番マップ](https://aquabeacon.github.io/map/) を確認。固定URL・QRは維持。
- 南予7区間の親機／子機の軌跡（15,898表示サンプル）と従来の5地図（82,500点・230写真面）を同じ画面へ統合。地図未採用2区間も軌跡と理由を表示する。区間・時刻・視点をURLに保持。再生、独立レイヤー、上面・側面・地図拡大・撮影方向、元画像、全画面、PNG保存を追加。
- 暗い描画面と明るい操作面へ再設計。ホームの主リンクと研究ページのナビゲーションを更新。校正値・地図形状・尺度は変更していない。軌跡は公開地図と同じ2026-11-02版の元sceneから切り出し、後日の光源回復・位置フォールバックとは別の版であることを明示。
- 親機はGNSSアンテナ、子機は機体原点。共通ENUと元の欠測を保持。null・時間差・区間境界を越えて線を描かず、欠測時は現在位置記号も表示しない。地図は最終結果のままで、再生をオンライン生成とは扱わない。
- `python tools/verify_site.py` 成功。9 HTMLのリンク・fragment・公開範囲・全データのハッシュを検証。`node --test tests/map-data.test.mjs tests/navigation-data.test.mjs` は19件成功。変更PythonのruffとJavaScript構文検査も成功。
- ローカル／本番の既存Edgeで1280/760/640/375pxを検証。7区間・3グループ、元系列との現在値照合、欠測、range/number、再生停止、全レイヤー、5視点、実ドラッグ、キー、合成タッチの回転・ピンチ・cancel、URL復元、全画面、PNG保存を確認。狭幅からのPNGも横1600pxで保存。ローカルでは通信失敗・再試行・WebGL中断も確認。本番の未捕捉JavaScriptエラーなし。
- 画面キャプチャを目視し、地図拡大の向き・目盛りの重なりを修正。配信HTML・コード・CSS・台帳・軌跡・公開要約の17ファイルは、コミットのバイト列とSHA-256が一致。証跡はGit除外の `.local/map-review/`（`live-verification.json`, `live-hashes.json`, before/after画像）。
- 一時HTTPサーバーと専用ブラウザは検証ごとに終了を確認。継続稼働のタスク所有プロセスはない。スマートフォン実機での確認は未実施。独立真値による位置・地図精度は未検証。

## 写真付きマッピングの追加（2026-11-02）

5区間の写真付き地図（82,500点・230写真面・218,697三角形）、未採用2区間の理由、マッピングレポートを公開。固定QRのURLは変更していない。

- 公開元：`44409506dc704b7d7492d53dd27be57cd2296df4`。2026-11-02に[GitHub Actions成功](https://github.com/AquaBeacon/aquabeacon.github.io/actions/runs/41338624247)を確認。
- 本番7ページのHTTP 200、schemaVersion 2 / readyのカタログ一致、247ファイルのSHA-256一致を確認。対象は5区間のJSON・バイナリ・230 JPEG、表示用コード・CSS、公開図。Windowsの改行変換で整合性を壊さないよう、地図のデータはバイト同一でGitに保存。
- 本番 `/map/` で初期区間の4,200点・25写真面が読み込まれ、表示・操作できることを確認。固定リンクは https://aquabeacon.github.io/map/ 、追加レポートは https://aquabeacon.github.io/research/reports/20261102-mapping/ 。
- `python tools/verify_site.py`：9 HTMLのリンク・fragment・サイトマップ、全地図資産のハッシュと余分な資産がないこと、静止評価の図と数値、ローカル絶対パス非掲載を確認。
- `node --test tests/map-data.test.mjs`：10件成功。全5区間・230 JPEGのハッシュ、全点・面数、変換、破損したバイナリ・不正URL・範囲外頂点の拒否を検証。
- 7ページを375px・1280pxで確認し、ページ横溢れ・壊れた画像なし。公開実データを使って全7区間と3グループ、連続切替中断、実ドラッグ、キー・拡大・上面・写真／点群切替・全画面切替を確認。合成タッチの回転・ピンチ・cancelも成功。読み込み失敗・再試行・WebGL描画中断の案内も確認。
- 元sceneのSHA-256が解析の結合manifestと一致。解析側の数値照合41,173件と対象テスト13件の成功を確認した。解析側全体の既存テスト1件失敗とPNG保存自動検証の未確認はレポートに明記し、全解析が無条件に成功したとは扱わない。
- 親ワークスペース：19 repositories、0 structural errors。スマートフォン実機と印刷したQRの検証は未実施。

地図の尺度・配置は暫定。独立真値による地図精度と日をまたぐ写真接続は未検証で、GNSS重ね合わせとして表示する。生ログ・生動画・航法時系列・地理原点は配信していない。ポスター原稿は更新したが、Canva連携は編集権限エラーのため原本未変更。

## 初回の研究ページ公開（マッピング追加前）

2026-11-02：研究入口、手法、レポート一覧、11月1日10:15の静止評価、水中マップの固定URLを実装。

- 公開先：AquaBeacon/aquabeacon.github.io のmain、GitHub Actionsでsite/のみ配信。
- 追加ページの公開状態：2026-11-02に本番5 URLのHTTP 200と内容を確認済み。
- 公開ソース：`86aa128ad12c223699721caa722e759a12b4cf40`、[GitHub Actions成功](https://github.com/AquaBeacon/aquabeacon.github.io/actions/runs/41336059198)。
- 固定URL：https://aquabeacon.github.io/map/ 。`manifest.json` のpending状態、本番PNG/SVGのSHA-256と公開用来歴の一致も確認済み。
- 初回時点のマッピング結果：解析中。地図データは未掲載。
- 静止結果：平均深度16.44 m、採用32点、平均まわり3D RMSE 0.1397 m（親機姿勢固定1.4545 m）。独立真値による精度評価ではない。

## 検証

- 元CSVの重複なし32観測から3条件の3D RMSEを再計算し、既存manifestと一致。
- `python tools/verify_site.py`：8 HTMLページの内部リンク・fragment・サイトマップ・外部JSなし・公開図のハッシュ・manifest状態・ローカル絶対パス非掲載を確認。
- `node --test tests/map-data.test.mjs`：5件成功。manifestのURL制限、尺度条件、点数・RGB・有限値、表示変換を確認。
- 追加5ページと日本語トップを375px/1280pxで確認。ページ横溢れ・壊れた画像なし。キーボードのスキップリンクとフォーカス表示を確認。
- 合成2000点をGit除外の `.local/map-qa/` のみに用意。ブラウザで実ドラッグ回転、拡大、初期化、上面、キーボード操作を確認。375pxのiframeでも操作欄の折り返しと横溢れなしを確認。合成Pointer Eventsによるタッチ回転・ピンチ・cancelも成功。スマートフォン実機での操作・印刷後のQRは未検証。
- QR PNGをOpenCVで復号し、`https://aquabeacon.github.io/map/` と一致。
- 親ワークスペース検証：19 repositories、0 structural errors。

Canva本体への反映状態と、Webサイトの公開状態は独立して確認する。
