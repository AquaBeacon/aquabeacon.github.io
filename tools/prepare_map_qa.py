"""Create an ignored QA copy of the actual public data, with local-only test UI."""
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = root / ".local/map-qa"
shutil.copytree(root / "site", output, dirs_exist_ok=True)
# Pointer Events test harness is intentionally outside site/ and uses the real viewer.
original = (output / "map/index.html").read_text(encoding="utf-8")
harness = '''<section class="wrap section"><h2>ローカルQA</h2><button id="test-gestures">合成タッチ操作を検証</button><p id="gesture-result" role="status"></p><button id="test-selections">全区間・連続切替を検証</button><p id="selection-result" role="status"></p><button id="test-context">描画中断を検証</button></section>
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
document.querySelector('#test-selections').addEventListener('click', async () => {
 const select=document.querySelector('#map-selection'), status=document.querySelector('#map-status'), result=document.querySelector('#selection-result');
 const settle=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const choose=value=>{select.value=value;select.dispatchEvent(new Event('change'));};
 const ready=async()=>{const end=Date.now()+20000;while(Date.now()<end){if(!status.textContent.includes('読み込み中'))return;await settle();}throw Error('Timed out');};
 const results=[];
 try {
  for(const option of [...select.options]){
   choose(option.value); await ready();
   const expected=!canvas.hidden&&status.textContent.includes('写真面');
   results.push(option.textContent+': '+(expected?'PASS':'FAIL')+' / '+status.textContent);result.textContent=results.join(' | ');
   if(!expected)throw Error('Unexpected selection state');
  }
  choose('combined');choose('20261101_nanyo_003');await ready();
  const race=status.textContent.includes('11/1 区間3')&&status.textContent.includes('25 写真面');
  result.textContent=(race?'PASS':'FAIL')+': all 10 selections; rapid selection cancellation='+race+' | '+results.join(' | ');
 }catch(error){result.textContent='FAIL: '+error.message+' | '+results.join(' | ');}
});
document.querySelector('#test-context').addEventListener('click',()=>canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
</script>'''
(output / "map/index.html").write_text(original.replace('</body>', harness + '</body>'), encoding="utf-8")
preview = output / "poster"
preview.mkdir(exist_ok=True)
shutil.copyfile(root / "poster/2026-11/map-qr.png", preview / "map-qr.png")
shutil.copyfile(root / "poster/2026-11/panel-preview.html", preview / "index.html")
(output / "mobile.html").write_text('''<!doctype html><html lang="ja"><meta charset="utf-8"><title>375px viewer QA</title><style>body{background:#ddd;font:16px sans-serif}iframe{width:375px;height:812px;border:0}</style><h1>375px・公開実データのローカル検証</h1><iframe title="375px マップ" src="map/"></iframe></html>''', encoding="utf-8")
failure = output / "failure"
failure.mkdir(exist_ok=True)
shutil.copyfile(output / "map/manifest.json", failure / "manifest.json")
shutil.copyfile(root / "site/map/index.html", failure / "index.html")
print(f"Local QA only: {output}")
