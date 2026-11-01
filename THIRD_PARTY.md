# ライセンスの適用範囲

本プロジェクトの自作ソース・設計・文書には [Apache License 2.0](LICENSE) を適用します（2026-10-15指定）。個別の著作権・ライセンス表示がある第三者部分は元の条件を保持します。

外部依存は依存定義・既存の出典と各パッケージのLICENSE/NOTICEを参照してください。

任意のQR制作ツールはPythonの `qrcode` 8.2を使用します。ライブラリ本体は同梱せず、元パッケージのライセンスを保持します。Web配信には依存しません。公開用画像の形式・EXIF検証にはローカル制作工程のみPillowを使用します。両ライブラリ本体はサイトに同梱しません。`site/assets/map-data.js`、`map-viewer.js`、`map-renderer.js` は外部ライブラリを使用しない自作実装です。WebGLの写真面表示と撮影方向の計算は、Apache-2.0の自作解析ビューアー `aquabeacon-analysis/scripts/templates/nanyo_combined_mapping.html` を基にしています。

手元の未公開データ・購入台帳・認証情報は配布対象に含めません。Git履歴に既に存在する資料はignore設定だけでは除去されません。公開対象を確定してから履歴を点検してください。
