import { validateManifest, preparePoints, projectPoint } from './map-data.js';

const stage = document.querySelector('#map-stage');
const pending = document.querySelector('#map-placeholder');
const canvas = document.querySelector('#map-canvas');
const controls = document.querySelector('#map-tools');
const status = document.querySelector('#map-status');
const detail = document.querySelector('#map-detail');
const instruction = document.querySelector('#map-instruction');
let points = [], yaw = -0.6, pitch = 0.65, zoom = 1, pan = [0, 0], frame = 0;
const pointers = new Map();

function resetView() { yaw = -0.6; pitch = 0.65; zoom = 1; pan = [0, 0]; schedule(); }
function scaleView(factor) { zoom = Math.min(12, Math.max(0.25, zoom * factor)); schedule(); }
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function draw() {
  frame = 0;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width, height) * 0.8 * zoom;
  const projected = points.map(p => [...projectPoint(p, yaw, pitch), p[3]]).sort((a, b) => a[2] - b[2]);
  const size = width < 600 ? 2 : 2.5;
  for (const p of projected) {
    const x = width / 2 + pan[0] + p[0] * scale, y = height / 2 + pan[1] + p[1] * scale;
    if (x < -size || x > width + size || y < -size || y > height + size) continue;
    ctx.fillStyle = p[3]; ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  canvas.setAttribute('aria-label', `水中マップ。表示倍率 ${zoom.toFixed(1)} 倍。矢印キーで回転、プラス・マイナスで拡大縮小、0で初期表示。`);
}

function pairGeometry(values) {
  const [a, b] = values;
  return { centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], distance: Math.hypot(a[0] - b[0], a[1] - b[1]) };
}
canvas.addEventListener('pointerdown', event => {
  if (!points.length || pointers.size >= 2) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  const previous = pointers.get(event.pointerId), before = [...pointers.values()];
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  if (pointers.size === 2) {
    const a = pairGeometry(before), b = pairGeometry([...pointers.values()]);
    if (a.distance > 2) scaleView(b.distance / a.distance);
    pan[0] += b.centre[0] - a.centre[0]; pan[1] += b.centre[1] - a.centre[1];
  } else if (event.shiftKey || event.buttons === 2) {
    pan[0] += event.clientX - previous[0]; pan[1] += event.clientY - previous[1];
  } else {
    yaw += (event.clientX - previous[0]) * 0.009;
    pitch = Math.min(Math.PI / 2, Math.max(-Math.PI / 2, pitch + (event.clientY - previous[1]) * 0.009));
  }
  schedule();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => pointers.delete(event.pointerId));
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => { event.preventDefault(); scaleView(Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * 0.002)); }, { passive: false });
canvas.addEventListener('keydown', event => {
  const delta = 0.12;
  switch (event.key) {
    case 'ArrowLeft': yaw -= delta; break;
    case 'ArrowRight': yaw += delta; break;
    case 'ArrowUp': pitch = Math.min(Math.PI / 2, pitch + delta); break;
    case 'ArrowDown': pitch = Math.max(-Math.PI / 2, pitch - delta); break;
    case '+': case '=': scaleView(1.2); break;
    case '-': scaleView(1 / 1.2); break;
    case '0': case 'Home': resetView(); break;
    default: return;
  }
  event.preventDefault(); schedule();
});
document.querySelector('#zoom-in').addEventListener('click', () => scaleView(1.3));
document.querySelector('#zoom-out').addEventListener('click', () => scaleView(1 / 1.3));
document.querySelector('#reset-view').addEventListener('click', resetView);
document.querySelector('#top-view').addEventListener('click', () => { yaw = 0; pitch = Math.PI / 2; pan = [0, 0]; schedule(); });
const fullscreen = document.querySelector('#fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); }
  catch { status.textContent = '全画面表示を開始できませんでした。通常表示で操作できます。'; }
});
document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '全画面を閉じる' : '全画面'; schedule(); });
new ResizeObserver(schedule).observe(stage);

async function readJSON(url, maximumBytes) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('Content-Length')) > maximumBytes) throw new Error('Map is too large.');
  const content = await response.text();
  if (content.length > maximumBytes) throw new Error('Map is too large.');
  return JSON.parse(content);
}
async function load() {
  try {
    const manifest = validateManifest(await readJSON('./manifest.json', 20000));
    if (manifest.status === 'pending') return;
    const data = await readJSON(`./${manifest.file}`, 15000000);
    points = preparePoints(data, manifest.pointCount);
    if (!canvas.getContext('2d')) throw new Error('Canvas is unavailable.');
    pending.hidden = true; canvas.hidden = false; controls.hidden = false; instruction.hidden = false;
    document.querySelector('#map-title').textContent = manifest.title;
    status.textContent = `公開マップ · ${points.length.toLocaleString('ja-JP')} 点`;
    detail.textContent = `${manifest.description} 座標系：${manifest.coordinateSystem}。${manifest.scaleNote}`;
    schedule();
  } catch (error) {
    console.error('Map viewer:', error.message);
    status.textContent = 'マップの読み込みを確認できませんでした';
    pending.querySelector('h2').textContent = '読み込みに失敗しました';
    pending.querySelector('p').textContent = '通信状況を確認してページを再読み込みしてください。下のリンクから静止評価レポートと手法を閲覧できます。';
  }
}
load();
