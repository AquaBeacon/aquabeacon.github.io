# 開発ガイド

公開紹介サイト。

Python 3で python -m http.server 8080 --bind 127.0.0.1 --directory site を実行します。配信対象はsite/のみです。

## 入口

- [site/index.html](site/index.html)
- [site/en/index.html](site/en/index.html)

## 検証

```sh
python tools/verify_site.py
node --test tests/map-data.test.mjs tests/navigation-data.test.mjs
python -m ruff check tools/export_mapping.py tools/export_navigation.py tools/verify_site.py
node tools/verify_map_browser.mjs --playwright-root <existing-node_modules> --browser-executable <existing-browser>
```

375px/1280pxで本文・表・リンク・キーボードフォーカス・横溢れを確認します。地図は実際の公開データで写真面・点群の表示、全7区間と3種類の重ね合わせ、回転・拡大・移動・初期化・上面表示・タッチ・連続切替の中断処理を検証します。`python tools/prepare_map_qa.py` でGit除外の `.local/map-qa/` に検証UIを作り、別ポートで配信できます。`mobile.html` は375px iframe、`failure/` はデータ欠落時の検証専用ページです。検証UIはsite/へ含めません。

数値と図を再取得する場合は `python tools/export_static_report.py --analysis-root ../aquabeacon-analysis`。指定された単一区間の観測からRMSEを再計算して既存manifestと照合し、公開用の要約と既存PNG/SVGだけをコピーします。生データや元manifestの絶対パスは配信しません。

マッピングの再取得は `python tools/export_mapping.py --analysis-root ../aquabeacon-analysis`。解析の検証結果と元sceneのSHA-256を照合し、選定した全点・写真面だけを静的配信用バイナリ・JSON・JPEGに分離します。詳細は [MAP_PUBLISHING.md](MAP_PUBLISHING.md)。

QRの再生成は `python -m pip install -r tools/requirements-authoring.txt`、`python tools/make_poster_qr.py`。これは任意のローカル制作工程で、サイト配信・ビルドの依存ではありません。

ビルド・実機・外部ツールの確認手順はREADMEを参照してください。移行検証だけで実機動作・製造可能性を合格扱いにしません。

## データと関連リポジトリ

このディレクトリがGitリポジトリのルートです。親の AquaBeacon-OSS は複数リポジトリの置き場です。横断開発では各リポジトリを同じ親ディレクトリに配置し、[全体の入口](https://github.com/AquaBeacon/workspace-tools)から関連設計へ進みます。単体checkoutでも本書のローカル入口を使用できます。

生データ・生成物・SDK・仮想環境は手元に保持し、公開対象を.gitignoreで区別します。追跡済みのファイルは.gitignoreだけでは除外されないので、`git status --short`と`git ls-files`を確認します。

ライセンスは[Apache 2.0](LICENSE)、第三者部分は[THIRD_PARTY.md](THIRD_PARTY.md)。

## 公開リポジトリ

GitHub: https://github.com/AquaBeacon/aquabeacon.github.io

```sh
git clone https://github.com/AquaBeacon/aquabeacon.github.io.git
```

公開ブランチはmainです。新設リポジトリは公開対象だけを初期履歴にし、過去の開発履歴と実験ログはローカルに保管します。

## ページの編集と全体検証

本文は `content/*.html`、共通HTMLは `tools/build_site.py` が正本です。生成された `site/**/*.html` を直接編集しません。公開図・JSON・map/dataは生成スクリプトで変更しません。

```sh
python tools/build_site.py
python tools/build_site.py --check
python tools/verify_site.py
python -m ruff check tools/build_site.py tools/prepare_site_media.py tools/prepare_site_fonts.py
node --check site/assets/site.js
node tools/verify_pages_browser.mjs --playwright-root <existing-node_modules> --browser-executable <existing-browser>
```

ブラウザ検証は一度に1つずつ実行します。既存マップ検証も続けて実施してください。本番は両ブラウザ検証へ `--url https://aquabeacon.github.io` を渡します。各スクリプトは所有PID・開始時刻・目的を記録し、終了時にブラウザとループバックサーバーを閉じます。証跡はGit除外の `.local/redesign/` と `.local/map-review/` です。

写真の再生成は `python tools/prepare_site_media.py`（Pillow）、文字を大きく追加した際のフォントサブセット更新は `python tools/prepare_site_fonts.py`（fontTools）。いずれも任意の制作工程です。書体の元データは `.local/redesign/fonts/` にキャッシュし、ライセンスと来歴は `site/assets/fonts/` に保持します。記事の新しい文字がサブセットにない場合も、指定したOSフォントへフォールバックします。
