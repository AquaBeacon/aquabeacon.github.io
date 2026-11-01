"""Generate print assets for the fixed, public map URL (authoring only)."""
from pathlib import Path
import qrcode

ROOT = Path(__file__).resolve().parents[1]
URL = "https://aquabeacon.github.io/map/"
OUTPUT = ROOT / "poster/2026-11"
OUTPUT.mkdir(parents=True, exist_ok=True)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=24, border=4)
qr.add_data(URL)
qr.make(fit=True)
qr.make_image(fill_color="black", back_color="white").save(OUTPUT / "map-qr.png")
matrix = qr.get_matrix()
size = len(matrix)
path = " ".join(f"M{x},{y}h1v1h-1z" for y, row in enumerate(matrix) for x, value in enumerate(row) if value)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="90mm" viewBox="0 0 {size} {size}" role="img" aria-label="水中マップのQRコード">
<title>{URL}</title><rect width="{size}" height="{size}" fill="white"/><path d="{path}" fill="black"/></svg>\n'''
(OUTPUT / "map-qr.svg").write_text(svg, encoding="utf-8")
print(f"QR: {URL}; {size} modules including 4-module quiet zone; print size 90 mm.")
