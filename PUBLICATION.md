# 研究ページの公開記録

2026-11-02：研究入口、手法、レポート一覧、11月1日10:15の静止評価、水中マップの固定URLを実装。

- 公開先：AquaBeacon/aquabeacon.github.io のmain、GitHub Actionsでsite/のみ配信。
- 追加ページの公開状態：ローカル検証済み。GitHub Pagesの公開確認後に本書を更新する。
- マッピング結果：解析中。地図データは未掲載。
- 静止結果：平均深度16.44 m、採用32点、平均まわり3D RMSE 0.1397 m（親機姿勢固定1.4545 m）。独立真値による精度評価ではない。

## 検証

- 元CSVの重複なし32観測から3条件の3D RMSEを再計算し、既存manifestと一致。
- `python tools/verify_site.py`：8 HTMLページの内部リンク・fragment・サイトマップ・外部JSなし・公開図のハッシュ・manifest状態・ローカル絶対パス非掲載を確認。
- `node --test tests/map-data.test.mjs`：5件成功。manifestのURL制限、尺度条件、点数・RGB・有限値、表示変換を確認。
- 追加5ページと日本語トップを375px/1280pxで確認。ページ横溢れ・壊れた画像なし。キーボードのスキップリンクとフォーカス表示を確認。
- 合成2000点をGit除外の `.local/map-qa/` のみに用意。ブラウザで実ドラッグ回転、拡大、初期化、上面、キーボード操作を確認。合成Pointer Eventsによるタッチ回転・ピンチ・cancelも成功。スマートフォン実機での操作・印刷後のQRは未検証。
- QR PNGをOpenCVで復号し、`https://aquabeacon.github.io/map/` と一致。
- 親ワークスペース検証：19 repositories、0 structural errors。

Canva本体への反映状態と、Webサイトの公開状態は独立して確認する。
