import { validateManifest, prepareGeometry, localPath, fitView, sourceView } from './map-data.js?v=2';
import { createRenderer } from './map-renderer.js?v=2';

const $ = id => document.getElementById(id);
const canvas = $('map-canvas'), stage = $('map-stage'), placeholder = $('map-placeholder');
const status = $('map-status'), select = $('map-selection');
let catalog, renderer, active = [], view, frame = 0, generation = 0, controller, loading = false;
const pointers = new Map();
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function draw() {
  frame = 0;
  if (!view || canvas.hidden) return;
  renderer.draw(view, $('show-photos').checked, $('show-points').checked || loading);
  canvas.setAttribute('aria-label', `水中マップ。${select.selectedOptions[0].textContent}。表示倍率 ${view.zoom.toFixed(1)} 倍。矢印キーで回転、プラス・マイナスで拡大縮小、0で初期表示。`);
}
function setView(mode = 'default') {
  if (!active.length) return;
  const camera = active.length === 1 && mode !== 'fit' && mode !== 'top';
  view = camera ? sourceView(active[0]) : fitView(active);
  // Keep the representative camera's orientation, but frame the map at its
  // analysis-provided center so the whole subject stays usable on narrow screens.
  if (camera) { view.center = [...active[0].center]; view.distance = Math.max(2.5, view.distance); }
  view.distance *= Math.max(1, (camera ? 1.1 : 1) * canvas.clientHeight / Math.max(1, canvas.clientWidth));
  if (mode === 'top') { view.yaw = 0; view.pitch = Math.PI / 2; }
  pointers.clear(); schedule();
}
function scaleView(factor) {
  if (!view) return;
  const next = Math.max(0.2, Math.min(20, view.zoom * factor));
  view.distance *= view.zoom / next; view.zoom = next; schedule();
}
function moveView(dx, dy) {
  const scale = 2 * view.distance / (1.73205 * Math.max(1, canvas.clientHeight));
  view.pan[0] += dx * scale; view.pan[1] -= dy * scale;
}
function pair(values) {
  const [a, b] = values;
  return { center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], distance: Math.hypot(a[0] - b[0], a[1] - b[1]) };
}
canvas.addEventListener('pointerdown', event => {
  if (!view || pointers.size >= 2) return;
  canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, [event.clientX, event.clientY]); canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId) || !view) return;
  const previous = pointers.get(event.pointerId), before = [...pointers.values()];
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pointers.size === 2) {
    const a = pair(before), b = pair([...pointers.values()]);
    if (a.distance > 2) scaleView(b.distance / a.distance);
    moveView(b.center[0] - a.center[0], b.center[1] - a.center[1]);
  } else if (event.shiftKey || event.buttons === 2) moveView(event.clientX - previous[0], event.clientY - previous[1]);
  else { view.yaw += (event.clientX - previous[0]) * 0.008; view.pitch = Math.max(-Math.PI, Math.min(Math.PI, view.pitch + (event.clientY - previous[1]) * 0.008)); }
  schedule();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => pointers.delete(event.pointerId));
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => { if (!view) return; event.preventDefault(); scaleView(Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * 0.002)); }, { passive: false });
canvas.addEventListener('keydown', event => {
  if (!view) return;
  switch (event.key) {
    case 'ArrowLeft': view.yaw -= 0.12; break;
    case 'ArrowRight': view.yaw += 0.12; break;
    case 'ArrowUp': view.pitch = Math.min(Math.PI, view.pitch + 0.12); break;
    case 'ArrowDown': view.pitch = Math.max(-Math.PI, view.pitch - 0.12); break;
    case '+': case '=': scaleView(1.2); break;
    case '-': scaleView(1 / 1.2); break;
    case '0': case 'Home': setView(); break;
    default: return;
  }
  event.preventDefault(); schedule();
});
$('zoom-in').addEventListener('click', () => scaleView(1.3));
$('zoom-out').addEventListener('click', () => scaleView(1 / 1.3));
$('reset-view').addEventListener('click', () => setView());
$('fit-view').addEventListener('click', () => setView('fit'));
$('top-view').addEventListener('click', () => setView('top'));
for (const id of ['show-photos', 'show-points']) $(id).addEventListener('change', () => {
  if (!$('show-photos').checked && !$('show-points').checked) $(id === 'show-photos' ? 'show-points' : 'show-photos').checked = true;
  schedule();
});
const fullscreen = $('fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); }
  catch { status.textContent = '全画面表示を開始できませんでした。通常表示で操作できます。'; }
});
document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '全画面を閉じる' : '全画面'; schedule(); });
new ResizeObserver(schedule).observe(stage);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); controller?.abort(); generation++; active = []; view = null;
  showMessage('3D描画が中断されました', 'ページを再読み込みすると再開できます。レポートは下のリンクからご覧いただけます。');
  $('retry-map').hidden = false; $('retry-map').onclick = () => location.reload();
});

function showMessage(title, message) {
  canvas.hidden = true; $('map-tools').hidden = true; $('map-layers').hidden = true;
  placeholder.hidden = false; placeholder.querySelector('h2').textContent = title; placeholder.querySelector('p').textContent = message;
  status.textContent = title;
}
async function read(url, maximumBytes, signal, expectedHash) {
  const response = await fetch(url, { signal, cache: expectedHash ? 'default' : 'no-cache' });
  if (!response.ok) throw new Error(`通信エラー（HTTP ${response.status}）`);
  if (Number(response.headers.get('Content-Length')) > maximumBytes) throw new Error('データのサイズが想定を超えています。');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maximumBytes) throw new Error('データのサイズが想定を超えています。');
  if (expectedHash) {
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('');
    if (digest !== expectedHash) throw new Error('公開データの整合性を確認できませんでした。少し待って再試行してください。');
  }
  return buffer;
}
const json = buffer => JSON.parse(new TextDecoder().decode(buffer));
const assetURL = (path, hash) => `./${path}?v=${hash.slice(0, 16)}`;
async function loadGeometry(item, signal) {
  const meta = json(await read(assetURL(item.file, item.metadataSHA256), 300000, signal, item.metadataSHA256));
  localPath(meta.binary, 'bin');
  const binary = await read(assetURL(meta.binary, meta.binarySHA256), 10000000, signal, meta.binarySHA256);
  return prepareGeometry(meta, binary, item);
}
async function decodedPhoto(surface, signal) {
  const bytes = await read(assetURL(surface.image, surface.imageSHA256), 1000000, signal, surface.imageSHA256);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth !== 960 || image.naturalHeight !== 540) throw new Error('写真のサイズを確認できませんでした。');
    // Keep all 230 source JPEGs intact; bound GPU memory on phones to ~120 MB RGBA.
    const display = document.createElement('canvas'); display.width = 480; display.height = 270;
    display.getContext('2d').drawImage(image, 0, 0, 480, 270);
    return display;
  } finally { URL.revokeObjectURL(url); }
}
async function choose() {
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal, current = ++generation;
  active = []; view = null; pointers.clear(); loading = true; renderer?.clear();
  $('retry-map').hidden = true;
  const selected = catalog.datasets.find(d => d.id === select.value) || catalog.groups.find(g => g.id === select.value);
  const items = selected.ids ? selected.ids.map(id => catalog.datasets.find(d => d.id === id)) : [selected];
  const size = items.reduce((sum, d) => sum + d.transferBytes, 0) / 1000000;
  $('map-transfer').textContent = selected.availability === 'unavailable' ? 'この区間の地図は未採用です。' : `初回読み込み 約${size.toFixed(1)} MB。読み込み後は通信せず回転できます。`;
  $('map-detail').textContent = `${catalog.coordinateSystem} ${catalog.scaleNote}${selected.ids ? ' 区間は離れて配置されます。写真を詳しく見るには「見る区間」で区間を一つ選んでください。複数区間の表示はGNSS配置の重ね合わせで、写真同士の接続は未確認です。' : ''}`;
  if (selected.availability === 'unavailable') { loading = false; showMessage(`${selected.label}：地図は未採用`, selected.reason); return; }
  showMessage(`${selected.label}を読み込み中`, '確認済みの点群と写真面を読み込んでいます。');
  try {
    renderer ||= createRenderer(canvas);
    const data = await Promise.all(items.map(item => loadGeometry(item, signal)));
    if (current !== generation) return;
    renderer.setData(data); active = data;
    $('show-photos').checked = true; $('show-points').checked = data.length > 1;
    placeholder.hidden = true; canvas.hidden = false; $('map-tools').hidden = false; $('map-layers').hidden = false; $('map-instruction').hidden = false;
    $('reset-view').textContent = data.length === 1 ? '撮影方向に戻す' : '初期表示';
    setView();
    const queue = data.flatMap((d, dataset) => d.surfaces.map((s, surface) => ({ s, dataset, surface })));
    // Render the representative photograph first, then fill the rest.
    queue.sort((a, b) => Number(b.surface === data[b.dataset].defaultSurface) - Number(a.surface === data[a.dataset].defaultSurface));
    let done = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length && !signal.aborted) {
        const { s, dataset, surface } = queue.shift();
        const photo = await decodedPhoto(s, signal);
        if (current !== generation || signal.aborted) return;
        renderer.upload(dataset, surface, photo); done++;
        status.textContent = `${selected.label} · 写真を読み込み中 ${done}/${items.reduce((n, d) => n + d.photoCount, 0)}`;
        schedule();
      }
    }));
    if (current !== generation) return;
    loading = false;
    status.textContent = `${selected.label} · ${items.reduce((n, d) => n + d.pointCount, 0).toLocaleString('ja-JP')} 点 / ${done} 写真面`;
    schedule();
  } catch (error) {
    if (current !== generation) return;
    controller.abort(); loading = false; active = []; view = null; renderer?.clear();
    showMessage('マップを読み込めませんでした', `${error.message} 通信状況を確認して再試行してください。`);
    $('retry-map').hidden = false;
    console.error('Map viewer:', error.message);
  }
}
select.addEventListener('change', choose);
$('retry-map').onclick = () => catalog ? choose() : initialize();
async function initialize() {
  try {
    catalog = validateManifest(json(await read('./manifest.json', 30000)));
    select.replaceChildren();
    for (const [label, entries] of [['区間ごとに見る', catalog.datasets], ['複数区間を重ねる', catalog.groups]]) {
      const group = document.createElement('optgroup'); group.label = label;
      for (const item of entries) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label + (item.availability === 'unavailable' ? '（地図未採用）' : ''); group.append(option); }
      select.append(group);
    }
    select.value = catalog.defaultSelection; select.disabled = false;
    await choose();
  } catch (error) { showMessage('マップの情報を読み込めませんでした', '通信状況を確認して再試行してください。レポートは下のリンクからご覧いただけます。'); $('retry-map').hidden = false; console.error(error); }
}
initialize();
