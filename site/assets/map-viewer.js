import { validateManifest, prepareGeometry, localPath, fitView, sourceView } from './map-data.js?v=3';
import { createRenderer, projectPoint } from './map-renderer.js?v=3';
import {validateNavigation, sampleAt, availabilityIntervals, nearestSurface, formatTime} from './navigation-data.js?v=3';

const $ = id => document.getElementById(id);
const canvas = $('map-canvas'), stage = $('map-stage'), placeholder = $('map-placeholder');
const status = $('map-status'), select = $('map-selection');
let catalog, renderer, active = [], view, frame = 0, generation = 0, controller, loading = false;
let navigation = [], selected, time = 0, playing = false, playbackFrame = 0, previousTick = null, mode = 'fit';
const formats = new Intl.NumberFormat('ja-JP');
const presetIds = {fit: 'fit-view', top: 'top-view', side: 'side-view', map: 'map-view', source: 'reset-view'};
const pointers = new Map();
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function draw(settings) {
  frame = 0;
  if (!view || canvas.hidden) return;
  const labels = renderer.draw(view, {showPhotos: $('show-photos').checked, showPoints: $('show-points').checked || loading,
    showParent: $('show-parent').checked, showChild: $('show-child').checked, showGrid: $('show-grid').checked,
    time, history: $('track-history').checked, single: !selected.ids, pixelRatio: settings?.pixelRatio}) || [];
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const occupied = [];
  $('scene-labels').replaceChildren(...labels.sort((a, b) => Number(!!b.role) - Number(!!a.role)).flatMap(label => {
    const point = projectPoint(view, label.point, width, height);
    if (!point || point[0] < 15 || point[0] > width - 15 || point[1] < 40 || point[1] > height - 15) return [];
    point[1] += label.role ? -22 : 0;
    if (!label.role && occupied.some(p => Math.abs(p[0] - point[0]) < 58 && Math.abs(p[1] - point[1]) < 17)) return [];
    occupied.push(point);
    const span = document.createElement('span'); span.className = `scene-label${label.role ? ` marker ${label.role}` : ''}`;
    span.textContent = label.text; span.style.left = `${point[0]}px`; span.style.top = `${point[1]}px`; return [span];
  }));
  canvas.setAttribute('aria-label', `水中マップ。${select.selectedOptions[0].textContent}。表示倍率 ${view.zoom.toFixed(1)} 倍。矢印キーで回転、プラス・マイナスで拡大縮小、0で初期表示。`);
}
function setView(nextMode = 'fit') {
  if (!active.length && !navigation.length) return;
  mode = nextMode;
  const camera = active.length === 1 && ['source', 'map'].includes(mode);
  const photo = camera && mode === 'source' ? {...active[0], defaultSurface: nearestSurface(active[0].surfaces, time)} : active[0];
  view = camera ? sourceView(photo) : fitView(mode === 'map' && active.length ? active : [...active, ...navigation]);
  // Keep the representative camera's orientation, but frame the map at its
  // analysis-provided center so the whole subject stays usable on narrow screens.
  if (camera && mode === 'map') { view.center = [...active[0].center]; view.distance = Math.max(2.2, view.distance); }
  view.distance *= Math.max(1, (camera ? 1.1 : 1) * canvas.clientHeight / Math.max(1, canvas.clientWidth));
  if (mode === 'top') { view.yaw = 0; view.pitch = Math.PI / 2; }
  if (mode === 'side') { view.yaw = 0; view.pitch = 0; }
  for (const [name, id] of Object.entries(presetIds)) $(id).setAttribute('aria-pressed', String(name === mode));
  $('view-caption').textContent = `${{fit:'3D 全体',top:'上面 · 北が上',side:'側面 · 東が右 / 上が上',map:'地図を拡大',source:'撮影方向'}[mode]} · ENU / m`;
  pointers.clear(); schedule();
}

function pause() {
  playing = false; previousTick = null; cancelAnimationFrame(playbackFrame);
  $('play').textContent = '▶ 再生'; $('play').setAttribute('aria-pressed', 'false'); $('play').setAttribute('aria-label', '記録を再生');
}
function urlState() {
  if (!selected) return;
  const params = new URLSearchParams({experiment: select.value, view: mode});
  if (!selected.ids) params.set('time', time.toFixed(2));
  history.replaceState(null, '', `#${params}`);
}
function setTime(value, persist = false) {
  if (!navigation.length || selected.ids) return;
  const nav = navigation[0];
  time = Math.max(0, Math.min(nav.durationSeconds, Number.isFinite(value) ? value : 0));
  $('time').value = time; $('time-number').value = time.toFixed(2); $('time-label').textContent = formatTime(time);
  $('time').setAttribute('aria-valuetext', `開始から${time.toFixed(2)}秒`);
  for (const cursor of document.querySelectorAll('.time-cursor')) cursor.style.left = `${100 * time / nav.durationSeconds}%`;
  const row = sampleAt(nav, time);
  $('position-values').replaceChildren(...[['parent', 1, '親機'], ['child', 2, '子機']].map(([role, index, name]) => {
    const el = document.createElement('div'); el.className = `position-row ${role}`;
    const title = document.createElement('strong'); title.textContent = name; el.append(title);
    if (row?.[index]) {
      const values = document.createElement('div'); values.className = 'position-numbers';
      for (let axis = 0; axis < 3; axis++) { const s = document.createElement('span'), k = document.createElement('small'), b = document.createElement('b'); k.textContent = ['E', 'N', 'U'][axis]; b.textContent = row[index][axis].toFixed(2); s.append(k, b); values.append(s); }
      el.append(values);
    } else { const missing = document.createElement('span'); missing.className = 'missing-value'; missing.textContent = 'この時刻は欠測'; el.append(missing); }
    return el;
  }));
  $('anchor-age').textContent = row?.[2] && row[3] !== null ? `子機の水平位置更新から ${row[3].toFixed(2)} 秒` : '子機の欠測中は位置の記号も表示しません。';
  const surfaces = active[0]?.surfaces || [], index = nearestSurface(surfaces, time);
  $('source-photo').hidden = index < 0;
  if (index >= 0) {
    const s = surfaces[index], url = assetURL(s.image, s.imageSHA256);
    if ($('source-photo').getAttribute('src') !== url) $('source-photo').src = url;
    $('photo-count').textContent = `${index + 1} / ${surfaces.length}`;
    $('photo-caption').textContent = `撮影 ${formatTime(s.timeSeconds)} · 選択時刻との差 ${Math.abs(s.timeSeconds - time).toFixed(1)} 秒（最近傍画像）`;
  } else { $('photo-count').textContent = '0 枚'; $('photo-caption').textContent = 'この区間には採用された写真地図がありません。'; }
  schedule(); if (persist) urlState();
}
function setupTimeline() {
  const single = !selected.ids;
  $('timeline').hidden = !single; $('group-note').hidden = single;
  $('availability').replaceChildren();
  if (!single) {
    $('position-values').textContent = '現在位置の確認は区間を1つ選んでください。'; $('anchor-age').textContent = '';
    $('source-photo').hidden = true; $('photo-count').textContent = '';
    $('photo-caption').textContent = '区間を1つ選ぶと撮影画像を確認できます。'; return;
  }
  const nav = navigation[0];
  $('time').max = $('time-number').max = nav.durationSeconds; $('duration-label').textContent = `/ ${formatTime(nav.durationSeconds)}`;
  for (const [role, name] of [['parent', '親機'], ['child', '子機']]) {
    const line = document.createElement('div'); line.className = `availability-row ${role}`;
    const label = document.createElement('span'); label.textContent = name;
    const track = document.createElement('div'); track.className = 'availability-track';
    for (const [start, end] of availabilityIntervals(nav, role)) {
      const bar = document.createElement('span'); bar.className = 'availability-segment';
      bar.style.left = `${100 * start / nav.durationSeconds}%`; bar.style.width = `${100 * (end - start) / nav.durationSeconds}%`; track.append(bar);
    }
    const cursor = document.createElement('span'); cursor.className = 'time-cursor'; track.append(cursor); line.append(label, track); $('availability').append(line);
  }
}
for (const id of ['time', 'time-number']) $(id).addEventListener('input', () => { pause(); setTime(Number($(id).value), true); });
$('track-history').addEventListener('change', schedule);
$('play').addEventListener('click', () => {
  if (playing) { pause(); urlState(); return; }
  if (!navigation.length || selected.ids) return;
  if (time >= navigation[0].durationSeconds) setTime(0);
  playing = true; previousTick = null; $('play').textContent = 'Ⅱ 停止'; $('play').setAttribute('aria-pressed', 'true'); $('play').setAttribute('aria-label', '記録を停止');
  const tick = now => {
    if (!playing) return;
    if (previousTick !== null) setTime(time + Math.min((now - previousTick) / 1000, .25) * Number($('speed').value));
    previousTick = now;
    if (time >= navigation[0].durationSeconds) { pause(); urlState(); return; }
    playbackFrame = requestAnimationFrame(tick);
  };
  playbackFrame = requestAnimationFrame(tick);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
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
    case 'ArrowLeft': if (event.shiftKey) moveView(-20, 0); else view.yaw -= .12; break;
    case 'ArrowRight': if (event.shiftKey) moveView(20, 0); else view.yaw += .12; break;
    case 'ArrowUp': if (event.shiftKey) moveView(0, -20); else view.pitch = Math.min(Math.PI, view.pitch + .12); break;
    case 'ArrowDown': if (event.shiftKey) moveView(0, 20); else view.pitch = Math.max(-Math.PI, view.pitch - .12); break;
    case '+': case '=': scaleView(1.2); break;
    case '-': scaleView(1 / 1.2); break;
    case '0': case 'Home': setView(); break;
    default: return;
  }
  event.preventDefault(); schedule();
});
$('zoom-in').addEventListener('click', () => scaleView(1.3));
$('zoom-out').addEventListener('click', () => scaleView(1 / 1.3));
for (const [name, id] of Object.entries(presetIds)) $(id).addEventListener('click', () => { setView(name); urlState(); });
for (const id of ['show-photos', 'show-points', 'show-parent', 'show-child', 'show-grid']) $(id).addEventListener('change', schedule);
$('save-image').addEventListener('click', () => {
  cancelAnimationFrame(frame);
  draw({pixelRatio: Math.max(1, 1600 / canvas.clientWidth)});
  const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height + 92;
  const ctx = output.getContext('2d'); ctx.fillStyle = '#091d2b'; ctx.fillRect(0, 0, output.width, output.height); ctx.drawImage(canvas, 0, 0);
  const factor = canvas.width / canvas.clientWidth;
  for (const label of $('scene-labels').children) { ctx.font = `${12 * factor}px sans-serif`; ctx.fillStyle = getComputedStyle(label).color; ctx.fillText(label.textContent, parseFloat(label.style.left) * factor, parseFloat(label.style.top) * factor); }
  ctx.fillStyle = '#eaf9ff'; ctx.font = '16px sans-serif';
  ctx.fillText(`AquaBeacon | ${selected.label} | ENU (m) | ${selected.ids ? 'GNSS配置の重ね合わせ' : `区間 ${time.toFixed(2)} s`}`, 20, canvas.height + 28);
  ctx.fillText('親機: 青 / 子機: 橙 / 地図: 最終結果 · 尺度と配置は暫定 · 独立真値による精度は未検証', 20, canvas.height + 57);
  const link = document.createElement('a'); link.download = `aquabeacon-${select.value}.png`; link.href = output.toDataURL('image/png'); link.click();
  schedule();
});
const fullscreen = $('fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('map-workspace').requestFullscreen(); }
  catch { status.textContent = '全画面表示を開始できませんでした。通常表示で操作できます。'; }
});
document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '全画面を閉じる' : '全画面'; schedule(); });
new ResizeObserver(schedule).observe(stage);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); pause(); controller?.abort(); generation++; active = []; navigation = []; view = null;
  showMessage('3D描画が中断されました', 'ページを再読み込みすると再開できます。レポートは下のリンクからご覧いただけます。');
  $('retry-map').hidden = false; $('retry-map').onclick = () => location.reload();
});

function showMessage(title, message) {
  canvas.hidden = true; $('map-tools').hidden = true; $('timeline').hidden = true; $('scene-zoom').hidden = true; $('view-caption').hidden = true;
  $('scene-labels').replaceChildren(); $('source-photo').hidden = true;
  $('position-values').textContent = title; $('anchor-age').textContent = ''; $('photo-caption').textContent = ''; $('photo-count').textContent = '';
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
async function loadNavigation(item, signal) {
  return validateNavigation(json(await read(assetURL(item.navigation.file, item.navigation.sha256), 10000000, signal, item.navigation.sha256)), item);
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
  pause();
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal, current = ++generation;
  active = []; navigation = []; view = null; pointers.clear(); loading = true; renderer?.clear();
  $('retry-map').hidden = true;
  selected = catalog.datasets.find(d => d.id === select.value) || catalog.groups.find(g => g.id === select.value);
  const items = selected.ids ? selected.ids.map(id => catalog.datasets.find(d => d.id === id)) : [selected];
  const size = items.reduce((sum, d) => sum + d.transferBytes + d.navigation.bytes, 0) / 1000000;
  $('map-transfer').textContent = `初回読み込み 約${size.toFixed(1)} MB · ${selected.ids ? '複数区間のGNSS配置' : '選択区間だけを読み込み'}`;
  $('map-detail').textContent = `${catalog.coordinateSystem} ${catalog.scaleNote}`;
  $('no-map').hidden = selected.availability !== 'unavailable'; $('no-map').textContent = selected.reason || '';
  $('point-count').textContent = formats.format(items.reduce((n, d) => n + d.pointCount, 0));
  $('surface-count').textContent = `${items.reduce((n, d) => n + d.photoCount, 0)} 枚`;
  $('coverage').textContent = '—'; $('group-note').hidden = true;
  showMessage(`${selected.label}を読み込み中…`, '親子の位置と、採用された地図を読み込んでいます。');
  try {
    renderer ||= createRenderer(canvas);
    const [data, nav] = await Promise.all([Promise.all(items.filter(item => item.availability === 'ready').map(item => loadGeometry(item, signal))), Promise.all(items.map(item => loadNavigation(item, signal)))]);
    if (current !== generation) return;
    renderer.setData(data, nav); active = data; navigation = nav;
    $('show-photos').checked = true; $('show-points').checked = data.length > 1;
    placeholder.hidden = true; canvas.hidden = false; $('map-tools').hidden = false; $('scene-zoom').hidden = false; $('view-caption').hidden = false;
    $('map-view').disabled = !data.length; $('reset-view').disabled = data.length !== 1 || !!selected.ids;
    $('show-photos').disabled = $('show-points').disabled = !data.length;
    const valid = nav.reduce((n, d) => n + d.validSamples.child, 0), samples = nav.reduce((n, d) => n + d.rows.length, 0);
    $('coverage').textContent = `${formats.format(valid)} / ${formats.format(samples)} (${(100 * valid / samples).toFixed(1)}%)`;
    $('source-hash').textContent = nav.length === 1 ? `元scene SHA-256: ${nav[0].source.sceneSHA256}` : `${nav.length}区間の元sceneを公開台帳のSHA-256と照合済み。`;
    setupTimeline();
    const params = new URLSearchParams(location.hash.slice(1)), matching = params.get('experiment') === select.value;
    const requestedMode = matching && params.get('view');
    setTime(matching && params.has('time') ? Number(params.get('time')) : nav[0].defaultTimeSeconds);
    setView(requestedMode in presetIds && (data.length || !['source','map'].includes(requestedMode)) ? requestedMode : 'fit');
    urlState();
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
    status.textContent = `${selected.label} · 親子の軌跡 / ${items.reduce((n, d) => n + d.pointCount, 0).toLocaleString('ja-JP')} 点 / ${done} 写真面${!done ? '（地図未採用）' : ''}`;
    schedule();
  } catch (error) {
    if (current !== generation) return;
    controller.abort(); pause(); loading = false; active = []; navigation = []; view = null; renderer?.clear();
    showMessage('マップを読み込めませんでした', `${error.message} 通信状況を確認して再試行してください。`);
    $('retry-map').hidden = false;
    console.error('Map viewer:', error.message);
  }
}
select.addEventListener('change', choose);
window.addEventListener('hashchange', () => {
  const id = new URLSearchParams(location.hash.slice(1)).get('experiment');
  if ([...select.options].some(option => option.value === id)) { select.value = id; choose(); }
});
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
    const requested = new URLSearchParams(location.hash.slice(1)).get('experiment');
    select.value = [...select.options].some(option => option.value === requested) ? requested : catalog.defaultSelection; select.disabled = false;
    await choose();
  } catch (error) { showMessage('マップの情報を読み込めませんでした', '通信状況を確認して再試行してください。レポートは下のリンクからご覧いただけます。'); $('retry-map').hidden = false; console.error(error); }
}
initialize();
window.addEventListener('pagehide', () => { pause(); controller?.abort(); generation++; cancelAnimationFrame(frame); renderer?.destroy(); active = []; navigation = []; });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
