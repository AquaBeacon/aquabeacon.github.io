"""Create an ignored local-only browser fixture. Never publishes synthetic data."""
import json
import math
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = root / ".local/map-qa"
shutil.copytree(root / "site", output, dirs_exist_ok=True)
points = []
for i in range(100):
    angle = i / 100 * math.tau
    for j in range(20):
        h = j / 20
        points.append([math.cos(angle), math.sin(angle) * (0.7 + h * 0.2), h - 0.5, 32 + j * 8, 210, 200])
data = output / "map/data/qa-only.json"
data.parent.mkdir(parents=True, exist_ok=True)
data.write_text(json.dumps({"schemaVersion": 1, "points": points}), encoding="utf-8")
(output / "map/manifest.json").write_text(json.dumps({
    "schemaVersion": 1, "status": "ready", "file": "data/qa-only.json", "pointCount": len(points),
    "title": "検証用の合成点群（実験結果ではありません）", "coordinateSystem": "local Z-up",
    "scaleNote": "任意尺度。ローカル動作確認専用。", "description": "SYNTHETIC QA ONLY — NOT A RESEARCH RESULT"
}, ensure_ascii=False), encoding="utf-8")
# Pointer Events test harness is intentionally outside site/ and uses the real viewer.
original = (output / "map/index.html").read_text(encoding="utf-8")
harness = '''<section class="wrap section"><h2>ローカルQA</h2><button id="test-gestures">合成タッチ操作を検証</button><p id="gesture-result" role="status"></p></section>
<script type="module">
const canvas = document.querySelector('#map-canvas');
document.querySelector('#test-gestures').addEventListener('click', async () => {
 const result=document.querySelector('#gesture-result');
 if(canvas.hidden){result.textContent='FAIL: viewer not loaded';return;}
 // setPointerCapture needs trusted pointer IDs; retain actual drag testing separately.
 const capture=canvas.setPointerCapture.bind(canvas);
 canvas.setPointerCapture=()=>{};
 const dispatch=(type,id,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',bubbles:true}));
 const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 document.querySelector('#reset-view').click(); await settle();
 const start=canvas.toDataURL();
 dispatch('pointerdown',1,100,100); dispatch('pointermove',1,140,130); dispatch('pointerup',1,140,130); await settle();
 const orbit=start!==canvas.toDataURL();
 dispatch('pointerdown',1,100,100); dispatch('pointerdown',2,200,100); dispatch('pointermove',2,250,100); await settle();
 const pinch=canvas.getAttribute('aria-label').includes('1.5 倍');
 dispatch('pointercancel',1,100,100); dispatch('pointercancel',2,250,100);
 const before=canvas.toDataURL(); dispatch('pointermove',1,300,100); await settle();
 const cancel=before===canvas.toDataURL();
 canvas.setPointerCapture=capture;
 result.textContent=(orbit&&pinch&&cancel?'PASS':'FAIL')+': touch orbit='+orbit+', pinch='+pinch+', cancel='+cancel;
});
</script>'''
(output / "map/index.html").write_text(original.replace('</body>', harness + '</body>'), encoding="utf-8")
preview = output / "poster"
preview.mkdir(exist_ok=True)
shutil.copyfile(root / "poster/2026-11/map-qr.png", preview / "map-qr.png")
shutil.copyfile(root / "poster/2026-11/panel-preview.html", preview / "index.html")
print(f"Local QA only: {output}")
