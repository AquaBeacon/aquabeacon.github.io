# ライセンスの適用範囲

本プロジェクトの自作ソース・設計・文書には [Apache License 2.0](LICENSE) を適用します（2026-10-15指定）。個別の著作権・ライセンス表示がある第三者部分は元の条件を保持します。

外部依存は依存定義・既存の出典と各パッケージのLICENSE/NOTICEを参照してください。

任意のQR制作ツールはPythonの `qrcode` 8.2を使用します。ライブラリ本体は同梱せず、元パッケージのライセンスを保持します。Web配信には依存しません。公開用画像の形式・EXIF検証にはローカル制作工程のみPillowを使用します。両ライブラリ本体はサイトに同梱しません。`site/assets/map-data.js`、`map-viewer.js`、`map-renderer.js` は外部ライブラリを使用しない自作実装です。WebGLの写真面表示と撮影方向の計算は、Apache-2.0の自作解析ビューアー `aquabeacon-analysis/scripts/templates/nanyo_combined_mapping.html` を基にしています。

手元の未公開データ・購入台帳・認証情報は配布対象に含めません。Git履歴に既に存在する資料はignore設定だけでは除去されません。公開対象を確定してから履歴を点検してください。

## 2026-11-06：写真と自己配信フォント

- `site/assets/device-harbor.webp` と `device-detail.webp` は、プロジェクト提供写真 `AquaBeacon/assets/aquabeacon-film60/media/photos/IMG_8005.jpg` と `IMG_8027.jpg` の表示用縮小版です。元画像の構図・内容は加工せず、EXIF/XMPを配信しません。写真の出典・内容と利用条件は [素材元](https://github.com/AquaBeacon/assets/blob/main/aquabeacon-film60/media/README.md) を参照してください。写真へApache-2.0を自動適用しません。来歴・ハッシュは `site/assets/media-provenance.json`。
- `site/assets/map-preview.png` は既存公開マップの11月1日区間3を地図拡大視点で描画した画面です。原データは公開マップ台帳に対応し、架空の形状ではありません。
- Inter、Noto Sans JP、JetBrains MonoをGoogle Fontsの公式リポジトリから取得し、公開ページで用いる文字へサブセット化しました。SIL Open Font License 1.1の原文と著作権表示を `site/assets/fonts/*-OFL.txt` に保存しています。取得URL・元フォントと公開フォントのSHA-256は同ディレクトリの `provenance.json`。外部へのフォント通信はありません。
- 配色、書体の組合せ、余白と罫線の方針は [AquaWiz Design v3.1](https://aquawiz.org/design/) を参照しました。サイトコード・本文はAquaBeacon用に実装し、AquaWizのロゴ・写真・本文・ソースコードは転載していません。
- `tools/prepare_site_fonts.py` は制作時だけfontToolsを使用します。ライブラリ本体は配信しません。
