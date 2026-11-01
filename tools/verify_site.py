"""Check local site links, manifest safety and selected published evidence."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate id {attrs['id']}"
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])
        if tag == "script" and "src" in attrs:
            assert not urlsplit(attrs["src"]).netloc, "External JavaScript is not allowed"


pages = {}
for path in SITE.rglob("*.html"):
    parser = Page()
    parser.feed(path.read_text(encoding="utf-8"))
    pages[path.resolve()] = parser
for path, page in pages.items():
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc:
            continue
        target = (SITE / unquote(url.path).lstrip("/")) if url.path.startswith("/") else path.parent / unquote(url.path)
        if not url.path:
            target = path
        if target.is_dir():
            target /= "index.html"
        target = target.resolve()
        assert target.is_relative_to(SITE.resolve()), f"Out-of-site link: {link}"
        assert target.is_file(), f"Broken link in {path.name}: {link}"
        if url.fragment and target in pages:
            assert unquote(url.fragment) in pages[target].ids, f"Missing fragment {link}"
summary_path = SITE / "research/reports/20261101-static/summary.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))
assert summary["observation"]["matchedPositions"] == 32
assert round(summary["metrics"]["corrected"]["rmse_3d_m"], 4) == 0.1397
assert round(summary["reductionPercent"], 1) == 90.4
assert summary["accuracyValidated"] is False
for ext in ("svg", "png"):
    path = summary_path.parent / f"position-overhead.{ext}"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == summary["sourceSHA256"][f"position_overhead.{ext}"]
for path in SITE.rglob("*.json"):
    content = path.read_text(encoding="utf-8")
    assert "C:\\" not in content and "C:/Users" not in content and "/Users/" not in content
manifest = json.loads((SITE / "map/manifest.json").read_text(encoding="utf-8"))
assert manifest["schemaVersion"] == 1
if manifest["status"] == "pending":
    assert manifest["file"] is None and manifest["pointCount"] == 0
else:
    assert manifest["status"] == "ready"
    data = (SITE / "map" / manifest["file"]).resolve()
    assert data.is_relative_to((SITE / "map/data").resolve()) and data.is_file()
    assert len(json.loads(data.read_text(encoding="utf-8"))["points"]) == manifest["pointCount"]
for entry in ElementTree.parse(SITE / "sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
    path = SITE / urlsplit(entry.text).path.lstrip("/") / "index.html"
    assert path.is_file(), f"Missing sitemap page: {entry.text}"
print(f"PASS: {len(pages)} HTML pages, links/fragments, local scripts, sitemap, evidence hashes, map state, no local absolute paths.")
