# AquaBeacon website

**日本語** | [English](README.en.md)

光と音を組み合わせた水中位置推定・マッピングプロジェクトの紹介サイト。

ソフトウェア・ハードウェア設計・ドキュメントを公開しています。[全19リポジトリと開発手順](https://github.com/AquaBeacon/workspace-tools)を参照してください。

- Website: https://aquabeacon.github.io/
- Organization: https://github.com/AquaBeacon
- 公開ファイル: `site/`
- デザイン方針: [DESIGN.md](DESIGN.md)

## 研究・結果とポスターのQR

- `/research/`：研究・結果の入口
- `/research/methods/`：光・音・姿勢を組み合わせる手法
- `/research/reports/`：レポート一覧
- `/research/reports/20261101-static/`：11月1日10:15、平均深度16.44 mの静止評価
- `/research/reports/20261102-mapping/`：2日分・7区間のマッピングと採用・除外条件
- `/map/`：ポスターの固定リンク。7区間の親機・子機の軌跡と5区間の写真付き地図を同じ3D画面で表示。時刻再生、親子別の表示、上面・側面・地図拡大、元画像、PNG保存に対応。選択区間・時刻・視点はURLで共有できる。

3D RMSE 0.1397 mは各系列の区間平均まわりのばらつきであり、真値誤差ではありません。公開対象は選定した数値・派生図・来歴と、82,500点・230写真面の派生地図です。地図の尺度・配置は暫定で、独立真値による精度と日をまたぐ写真の接続は未検証です。生動画・生ログ・原点の緯度経度は配信しません。地図の更新方法は [MAP_PUBLISHING.md](MAP_PUBLISHING.md)、QR素材は [poster/2026-11](poster/2026-11/README.md) を参照してください。

配信は従来どおり `site/` のみ。本文はJavaScriptなしで閲覧可能です。マップ操作・配色切替・資料検索に自作のローカルJavaScriptを使用し、外部JavaScript・CDN・サイトのビルド依存は追加していません。

軌跡は2026-11-02の採用済み地図と同じ元sceneから、約4 Hzの表示系列15,898行を公開します。親機はGNSSアンテナ、子機は機体原点。相対時刻と共通ENU位置のみを切り出し、欠測・慣性伝播の条件を保持します。後日の光源回復・位置フォールバック結果とは別の版です。校正値を変更した更新ではありません。

公開確認前のローカル変更を公開済みとは扱いません。公開状態は [PUBLICATION.md](PUBLICATION.md) に記録します。

## Preview

Python 3で `python -m http.server 8080 --bind 127.0.0.1 --directory site` を実行し、http://127.0.0.1:8080 を開きます。

## Deploy

リポジトリ名は `AquaBeacon/aquabeacon.github.io`。Settings → Pages → Sourceを **GitHub Actions** に設定します。`main` へのpushで `site/` のみを公開します。

## Contributing / License

文言や表示の改善はIssue・Pull Requestでご提案ください。自作部分はApache License 2.0です。第三者部分はTHIRD_PARTY.mdを参照してください。

## 開発とライセンス

[開発ガイド](DEVELOPMENT.md)にセットアップ・入口・確認方法をまとめています。自作部分は [Apache License 2.0](LICENSE)。[第三者素材・依存の扱い](THIRD_PARTY.md)も参照してください。

## 2026-11-06のサイト再構築

- 概要、仕組み、研究・結果、つくる・使う、公開資料、軌跡とマップを共通ナビゲーションに整理しました。英語概要・レポート・404を含む全11ページです。
- `/build/` は基板・機構・ファームウェア・解析・シミュレーションの入口、`/resources/` は全19リポジトリ、設計仕様、公開データ、参加方法、ライセンスの索引です。
- 本文の編集元は `content/*.html`、共通テンプレートは `tools/build_site.py`。編集後に `python tools/build_site.py`、確認時は `python tools/build_site.py --check` を実行します。配信範囲は `site/` のままで、CIのビルドは不要です。
- 参照デザインは [AquaWiz Design v3.1](https://aquawiz.org/design/)。Inter・Noto Sans JP・JetBrains MonoはOFL付きで自己配信。実機写真はプロジェクト提供素材の縮小版でEXIF/XMPを除去しています。
- `/map/` のPC配置と操作機能を保持し、スマホでの回転・ピンチ・2本指移動の案内を追加。地図・航跡・研究数値は従来の版です。
- 新版の公開状況・検証結果は [PUBLICATION.md](PUBLICATION.md) を参照してください。
