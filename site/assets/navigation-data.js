// Display-only navigation. Keep missing positions and never use SfM as a track.
const finite3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
export function validateNavigation(value, expected) {
  const fail = message => { throw new Error(`軌跡データ: ${message}`); };
  if (value?.schemaVersion !== 1 || value.id !== expected.id) fail('区間が一致しません。');
  if (!(value.durationSeconds > 0 && value.durationSeconds < 86400) ||
      !(value.maxGapSeconds > 0 && value.maxGapSeconds <= 1) ||
      !(value.defaultTimeSeconds >= 0 && value.defaultTimeSeconds <= value.durationSeconds)) fail('時間範囲が不正です。');
  if (!Array.isArray(value.rows) || value.rows.length !== expected.navigation.samples || value.rows.length > 50000) fail('行数が一致しません。');
  let previous = -Infinity;
  const valid = { parent: 0, child: 0 };
  for (const row of value.rows) {
    if (row.length !== 4 || !Number.isFinite(row[0]) || row[0] < 0 || row[0] > value.durationSeconds || row[0] <= previous) fail('時刻順序が不正です。');
    previous = row[0];
    for (const [role, index] of [['parent', 1], ['child', 2]]) {
      if (row[index] !== null && !finite3(row[index])) fail('位置が不正です。');
      if (row[index] !== null) valid[role]++;
    }
    if (row[3] !== null && (!Number.isFinite(row[3]) || row[3] < 0)) fail('更新経過時間が不正です。');
  }
  if (!finite3(value.bounds?.min) || !finite3(value.bounds?.max) ||
      !value.bounds.min.every((v, i) => v <= value.bounds.max[i])) fail('表示範囲が不正です。');
  for (const row of value.rows) for (const p of row.slice(1, 3)) if (p && !p.every((v, i) => v >= value.bounds.min[i] && v <= value.bounds.max[i])) fail('範囲外の位置です。');
  if (Object.keys(valid).some(role => value.validSamples?.[role] !== valid[role])) fail('有効点数が一致しません。');
  if (value.source?.sfmUsedForNavigation !== false || value.source?.accuracyValidated !== false ||
      !/^[a-f0-9]{64}$/.test(value.source?.sceneSHA256)) fail('来歴を確認できません。');
  return value;
}

// Last sample at or before the cursor; no interpolation, future samples or gap holding.
export function sampleAt(navigation, time) {
  if (!navigation || !Number.isFinite(time) || time < 0 || time > navigation.durationSeconds) return null;
  let low = 0, high = navigation.rows.length;
  while (low < high) { const mid = (low + high) >>> 1; if (navigation.rows[mid][0] <= time) low = mid + 1; else high = mid; }
  const row = navigation.rows[low - 1];
  return row && time - row[0] <= navigation.maxGapSeconds ? row : null;
}

export function trackSegments(navigation, role, time = Infinity) {
  const index = role === 'parent' ? 1 : 2, segments = [];
  let previous = null;
  for (const row of navigation.rows) {
    if (row[0] > time) break;
    if (row[index] && previous?.[index] && row[0] - previous[0] <= navigation.maxGapSeconds) {
      segments.push(...previous[index], ...row[index]);
    }
    previous = row;
  }
  return new Float32Array(segments);
}

export function availabilityIntervals(navigation, role) {
  const index = role === 'parent' ? 1 : 2, intervals = [];
  for (const row of navigation.rows) {
    if (!row[index]) continue;
    const end = Math.min(navigation.durationSeconds, row[0] + Math.min(0.25, navigation.maxGapSeconds));
    const last = intervals.at(-1);
    if (last && row[0] <= last[1] + 1e-6) last[1] = end;
    else intervals.push([row[0], end]);
  }
  return intervals;
}

export function nearestSurface(surfaces, time) {
  if (!surfaces.length) return -1;
  let index = 0;
  for (let i = 1; i < surfaces.length; i++) if (Math.abs(surfaces[i].timeSeconds - time) < Math.abs(surfaces[index].timeSeconds - time)) index = i;
  return index;
}

export function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
