# AquaBeacon website

**日本語** | [English](README.en.md)

光と音を組み合わせた水中位置推定・マッピングプロジェクトの紹介サイト。

**COMING SOON ...** — ソフトウェア・ハードウェア設計・詳細ドキュメントの公開を準備しています。

- Website: https://aquabeacon.github.io/
- Organization: https://github.com/AquaBeacon
- 公開ファイル: `site/`
- デザイン方針: [DESIGN.md](DESIGN.md)

## Preview

Python 3で `python -m http.server 8080 --bind 127.0.0.1 --directory site` を実行し、http://127.0.0.1:8080 を開きます。

## Deploy

リポジトリ名は `AquaBeacon/aquabeacon.github.io`。Settings → Pages → Sourceを **GitHub Actions** に設定します。`main` へのpushで `site/` のみを公開します。

## Contributing / License

文言や表示の改善はIssue・Pull Requestでご提案ください。自作部分はApache License 2.0です。第三者部分はTHIRD_PARTY.mdを参照してください。

## 開発とライセンス

[開発ガイド](DEVELOPMENT.md)にセットアップ・入口・確認方法をまとめています。自作部分は [Apache License 2.0](LICENSE)。[第三者素材・依存の扱い](THIRD_PARTY.md)も参照してください。
