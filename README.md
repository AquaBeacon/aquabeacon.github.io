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

文言や表示の改善はIssue・Pull Requestでご提案ください。ソースコードの公開と利用許諾は別です。ライセンスは現在選定中であり、決定まではOSSライセンスが付与されたものとして再利用しないでください。AquaBeacon本体は各公開リポジトリのライセンスに従います。
