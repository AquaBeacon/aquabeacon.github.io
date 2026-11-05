"""Self-host OFL fonts, subset to public page/UI characters; authoring only.

Requires fontTools. Original font files are cached outside site/.
"""
import hashlib
import json
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.local/redesign/fonts'
OUT = ROOT / 'site/assets/fonts'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(exist_ok=True)
text = ''.join(chr(i) for i in range(32, 383))
for folder, pattern in [(ROOT / 'content', '*.html'), (ROOT / 'site/assets', '*.js'), (ROOT / 'site/map', 'manifest.json')]:
    text += ''.join(p.read_text(encoding='utf-8') for p in folder.glob(pattern))
text += '概要仕組み研究結果つくる使う公開資料軌跡とマップメニュー本文へ移動配色切替明暗ライセンス出典開発参加検索リポジトリ欠測秒回転拡大移動←→↑↓↗＋−◐…'
records = []
for slug, directory, filename, family in [
    ('inter', 'inter', 'Inter%5Bopsz,wght%5D.ttf', 'Inter'),
    ('noto-sans-jp', 'notosansjp', 'NotoSansJP%5Bwght%5D.ttf', 'Noto Sans JP'),
    ('jetbrains-mono', 'jetbrainsmono', 'JetBrainsMono%5Bwght%5D.ttf', 'JetBrains Mono'),
]:
    base = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{directory}/'
    source = CACHE / f'{slug}.ttf'
    if not source.exists():
        with urllib.request.urlopen(base + filename, timeout=45) as response:
            source.write_bytes(response.read())
    license_path = OUT / f'{slug}-OFL.txt'
    if not license_path.exists():
        with urllib.request.urlopen(base + 'OFL.txt', timeout=30) as response:
            license_path.write_bytes(response.read())
    font = TTFont(source)
    options = subset.Options()
    options.flavor = 'woff'
    options.layout_features = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text if slug == 'noto-sans-jp' else ''.join(chr(i) for i in range(32, 383)))
    subsetter.subset(font)
    font.flavor = 'woff'
    target = OUT / f'{slug}.woff'
    font.save(target)
    font.close()
    records.append({'family':family,'source':base+filename,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'license':license_path.name})
    print(f'{family}: {target.stat().st_size:,} bytes')
(OUT / 'provenance.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf-8')
