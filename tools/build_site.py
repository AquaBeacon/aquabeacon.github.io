"""Assemble static pages from explicit content and shared site navigation.

Authoring only: Python standard library; GitHub Pages serves site/ as checked in.
"""
import argparse
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
BASE = 'https://aquabeacon.github.io'
PAGES = [
    ('/', 'home', 'AquaBeacon | 光と音で、水中の位置を知る。', '光と音を組み合わせる水中位置推定・マッピング。仕組み、研究結果、実機の設計、ソースコードと公開資料をまとめたAquaBeaconの公式OSSサイト。'),
    ('/research/methods/', 'methods', '位置推定の仕組み | AquaBeacon', '光学方向・音響距離・姿勢・深度を組み合わせる水中位置推定。観測から解析、写真付き地図までの仕組みと校正条件。'),
    ('/research/', 'research', '研究・結果 | AquaBeacon', '南予の水中実験、深度約16 mの静止評価、7区間の航跡と5区間の写真付き地図。測定条件・指標・未検証事項を確認できます。'),
    ('/research/reports/', 'reports', '実験レポート | AquaBeacon', 'AquaBeaconの実験レポート一覧。静止評価と写真付きマッピングの数値、条件、採用・除外、解析の来歴。'),
    ('/research/reports/20261101-static/', 'static-report', '深度約16 mの静止評価 | AquaBeacon', '平均深度16.44 m、採用32点。姿勢補正後3D RMSE 0.1397 mは区間平均まわりのばらつきで、真値誤差ではありません。'),
    ('/research/reports/20261102-mapping/', 'mapping-report', '写真付き水中マッピング | AquaBeacon', '2日7区間の観測から、5区間で82,500点・230写真面を取得。暫定尺度・配置、採用条件と未検証事項。'),
    ('/build/', 'build', 'つくる・使う | AquaBeacon', 'AquaBeaconの回路、機構、ファームウェア、解析、シミュレーション。再利用したい部分から設計元と開発手順へ進めます。'),
    ('/resources/', 'resources', '公開資料 | AquaBeacon', '全19リポジトリ、システム仕様、製作資料、研究レポート、公開データとライセンスの索引。'),
    ('/map/', 'map', '軌跡と水中マップ | AquaBeacon', '親機・子機の軌跡と写真付き水中マップを3Dで操作。回転、拡大、時刻再生で南予7区間の実験を確認できます。'),
    ('/en/', 'en', 'AquaBeacon | Underwater positioning with light and sound', 'Open-source underwater positioning and mapping. Explore the system, research, hardware, software and interactive results.'),
    ('/404.html', '404', 'ページが見つかりません | AquaBeacon', 'AquaBeaconの概要、研究、公開資料と水中マップへの入口。'),
]
NAV = [('/', '概要', 'Overview'), ('/research/methods/', '仕組み', 'How it works'), ('/research/', '研究・結果', 'Research'), ('/build/', 'つくる・使う', 'Build'), ('/resources/', '公開資料', 'Resources'), ('/map/', '軌跡とマップ', 'Explore map')]


def navigation(url, english):
    links = []
    for href, ja, en in NAV:
        current = href == url or (href == '/research/' and url.startswith('/research/reports/'))
        marker = ' aria-current="page"' if current else ''
        links.append(f'<a href="{href}"{marker}>{en if english else ja}</a>')
    return ''.join(links)


def render(url, key, title, description):
    english = key == 'en'
    lang = 'en' if english else 'ja'
    nav = navigation(url, english)
    content = (ROOT / 'content' / f'{key}.html').read_text(encoding='utf-8')
    is_map = key == 'map'
    extra = '<link rel="stylesheet" href="/assets/map-explorer.css?v=4"><script type="module" src="/assets/map-viewer.js?v=4"></script>' if is_map else '<link rel="stylesheet" href="/assets/research.css?v=4">'
    theme = '' if is_map else '<button class="theme-toggle" type="button" aria-label="配色を切り替える" title="明るい配色・暗い配色を切り替え" hidden><span aria-hidden="true">◐</span></button>'
    body_class = 'explorer' if is_map else 'site-page'
    main_class = 'explorer-main' if is_map else 'wrap'
    switch = '<a href="/" lang="ja" hreflang="ja">日本語</a>' if english else '<a href="/en/" lang="en" hreflang="en">EN</a>'
    schema = {'@context':'https://schema.org', '@type':'WebPage', 'name':title, 'description':description, 'url':BASE+url, 'inLanguage':lang, 'isPartOf':{'@type':'WebSite','name':'AquaBeacon','url':BASE+'/'}}
    alternates = '<link rel="alternate" hreflang="ja" href="'+BASE+'/"><link rel="alternate" hreflang="en" href="'+BASE+'/en/">' if key in ('home','en') else ''
    return f'''<!doctype html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(description, quote=True)}">
<meta name="theme-color" content="#F9F8F5"><link rel="canonical" href="{BASE}{url}">{alternates}
<meta property="og:type" content="website"><meta property="og:site_name" content="AquaBeacon"><meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(description, quote=True)}"><meta property="og:url" content="{BASE}{url}"><meta property="og:image" content="{BASE}/assets/social.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.png"><link rel="stylesheet" href="/assets/style.css?v=4">{extra}<script src="/assets/site.js?v=4" defer></script>
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
</head><body class="{body_class}">
<a class="skip" href="#main">{'Skip to content' if english else '本文へ移動'}</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="AquaBeacon {"home" if english else "ホーム"}">AquaBeacon<span class="brand-mark" aria-hidden="true">↗</span></a><nav class="desktop-nav" aria-label="{'Main navigation' if english else 'メインナビゲーション'}">{nav}</nav><div class="header-tools">{switch}{theme}<details class="mobile-menu"><summary>{'Menu' if english else 'メニュー'} <span aria-hidden="true">＋</span></summary><nav aria-label="{'Mobile navigation' if english else 'モバイルナビゲーション'}">{nav}</nav></details></div></div></header>
<main id="main" class="{main_class}">{content}</main>
<footer class="site-footer"><div class="wrap"><div class="footer-top"><a class="brand" href="/">AquaBeacon</a><p>{'Underwater positioning with light and sound.' if english else '光と音で、水中の位置を知る。'}</p></div><nav class="footer-nav" aria-label="{'Footer navigation' if english else 'フッターナビゲーション'}">{nav}</nav><div class="footer-bottom"><span>© 2026 AquaBeacon</span><a href="https://github.com/AquaBeacon">GitHub ↗</a><a href="/resources/#license">{'Licenses & credits' if english else 'ライセンス・出典'}</a><a href="/resources/#contribute">{'Contribute' if english else '開発に参加する'}</a></div></div></footer>
</body></html>
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check generated pages without writing')
    args = parser.parse_args()
    stale = []
    for url, key, title, desc in PAGES:
        target = SITE / (url.lstrip('/') if url.endswith('.html') else url.lstrip('/')+'index.html')
        output = render(url, key, title, desc)
        if args.check:
            if not target.exists() or target.read_text(encoding='utf-8') != output:
                stale.append(str(target.relative_to(ROOT)))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(output, encoding='utf-8', newline='\n')
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'<url><loc>{BASE}{url}</loc></url>\n' for url,*_ in PAGES if url != '/404.html')+'</urlset>\n'
    if args.check:
        if (SITE / 'sitemap.xml').read_text(encoding='utf-8') != sitemap:
            stale.append('site/sitemap.xml')
        if stale:
            raise SystemExit('Regenerate with python tools/build_site.py: '+', '.join(stale))
    else:
        (SITE / 'sitemap.xml').write_text(sitemap, encoding='utf-8', newline='\n')
    print(f'PASS: {len(PAGES)} static pages '+('up to date' if args.check else 'generated'))


if __name__ == '__main__':
    main()
