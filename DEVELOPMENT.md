# 開発ガイド

公開紹介サイト。

Python 3で python -m http.server 8080 --bind 127.0.0.1 --directory site を実行します。配信対象はsite/のみです。

## 入口

- [site/index.html](site/index.html)
- [site/en/index.html](site/en/index.html)

## 検証

```sh
python tools/verify_site.py
node --test tests/map-data.test.mjs
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
