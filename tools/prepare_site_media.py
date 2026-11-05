"""Create bounded, metadata-free web derivatives of existing project photographs.

Authoring-only dependency: Pillow. Does not alter source images or research data.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'assets/aquabeacon-film60/media/photos'
OUT = ROOT / 'site/assets'
records = []
for source_name, name, size in [('IMG_8005.jpg', 'device-harbor.webp', (1200, 1600)), ('IMG_8027.jpg', 'device-detail.webp', (1600, 1200))]:
    source = SOURCE / source_name
    target = OUT / name
    with Image.open(source) as image:
        image = image.convert('RGB')
        image.thumbnail(size, Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=85, method=6)
    with Image.open(target) as check:
        assert not check.getexif() and 'xmp' not in check.info
        dimensions = list(check.size)
    records.append({'file':name, 'source':'AquaBeacon/assets/aquabeacon-film60/media/photos/'+source_name,
        'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(), 'dimensions':dimensions,
        'processing':'sRGB source, resize only, WebP quality 85; EXIF/XMP not retained',
        'credit':'AquaBeacon project-provided photograph; see THIRD_PARTY.md'})
(OUT / 'media-provenance.json').write_text(json.dumps({'images':records}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Prepared 2 metadata-free project photographs')
