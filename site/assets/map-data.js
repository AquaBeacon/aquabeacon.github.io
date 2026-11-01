// Published geometry contract and camera math. Apache-2.0; no external runtime.
const ID = /^[a-zA-Z0-9_-]+$/;
const HASH = /^[a-f0-9]{64}$/;
const vector = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
function require(condition, message) { if (!condition) throw new Error(message); }
export function localPath(path, extension) {
  require(typeof path === 'string' && new RegExp(`^data/${extension === 'jpg' ? 'images/' : ''}[a-zA-Z0-9_-]+\\.${extension}$`).test(path), 'Invalid local map asset path.');
  return path;
}
export function validateManifest(value) {
  require(value?.schemaVersion === 2 && value.status === 'ready', 'Unsupported map catalog.');
  for (const key of ['title', 'coordinateSystem', 'scaleNote']) require(typeof value[key] === 'string' && value[key].trim(), `Missing ${key}.`);
  require(Array.isArray(value.datasets) && value.datasets.length > 0 && value.datasets.length <= 20, 'Invalid dataset list.');
  const ids = new Set();
  const totals = { pointCount: 0, photoCount: 0, triangleCount: 0 };
  for (const data of value.datasets) {
    require(ID.test(data.id) && !ids.has(data.id) && typeof data.label === 'string', 'Invalid dataset identity.');
    ids.add(data.id);
    require(['ready', 'unavailable'].includes(data.availability), 'Invalid availability.');
    for (const [key, limit] of [['pointCount', 100000], ['photoCount', 300], ['triangleCount', 500000]]) {
      require(integer(data[key], data.availability === 'ready' ? 1 : 0, limit), `Invalid ${key}.`);
      totals[key] += data[key];
    }
    if (data.availability === 'ready') {
      localPath(data.file, 'json');
      require(HASH.test(data.metadataSHA256) && integer(data.transferBytes, 1, 50000000), 'Invalid data integrity metadata.');
    } else {
      require(data.file === null && data.pointCount === 0 && data.photoCount === 0 && data.triangleCount === 0 && typeof data.reason === 'string', 'Unavailable data must not contain a map.');
    }
  }
  require(value.datasets.some(d => d.id === value.defaultSelection && d.availability === 'ready'), 'Invalid default map.');
  require(Array.isArray(value.groups), 'Missing map groups.');
  for (const group of value.groups) {
    require(ID.test(group.id) && !ids.has(group.id) && typeof group.label === 'string', 'Invalid group identity.');
    ids.add(group.id);
    require(Array.isArray(group.ids) && group.ids.length > 0 && new Set(group.ids).size === group.ids.length && group.ids.every(id => value.datasets.some(d => d.id === id && d.availability === 'ready')), 'Invalid group members.');
  }
  require(Object.keys(totals).every(key => totals[key] === value.totals?.[key]), 'Catalog totals do not match.');
  return value;
}

export function prepareGeometry(meta, binary, expected) {
  require(meta?.schemaVersion === 2 && meta.id === expected.id, 'Geometry identity mismatch.');
  for (const key of ['pointCount', 'photoCount', 'triangleCount']) require(meta[key] === expected[key], 'Geometry counts mismatch.');
  localPath(meta.binary, 'bin');
  require(HASH.test(meta.binarySHA256) && binary instanceof ArrayBuffer && binary.byteLength === meta.binaryByteLength && binary.byteLength <= 10000000, 'Invalid geometry binary.');
  require(vector(meta.center, 3) && Number.isFinite(meta.radius) && meta.radius > 0, 'Invalid map extent.');
  require(vector(meta.bounds?.min, 3) && vector(meta.bounds?.max, 3) && meta.bounds.min.every((v, i) => v <= meta.bounds.max[i]), 'Invalid map bounds.');
  const ranges = [];
  function read(descriptor, type, components, count) {
    const Types = { float32: Float32Array, uint8: Uint8Array, uint16: Uint16Array };
    const Type = Types[type];
    require(descriptor?.type === type && descriptor.components === components && integer(descriptor.count, 1, 1500000) && descriptor.count % components === 0, 'Invalid typed geometry view.');
    if (count !== undefined) require(descriptor.count === count, 'Geometry view count mismatch.');
    const start = descriptor.byteOffset, end = start + descriptor.count * Type.BYTES_PER_ELEMENT;
    require(integer(start, 0, binary.byteLength) && start % 4 === 0 && end <= binary.byteLength && !ranges.some(([a, b]) => start < b && end > a), 'Overlapping or out-of-bounds geometry.');
    ranges.push([start, end]);
    const view = new Type(binary, start, descriptor.count);
    require(view.every(Number.isFinite), 'Non-finite geometry.');
    return view;
  }
  const points = read(meta.points, 'float32', 3, meta.pointCount * 3);
  const colors = read(meta.colors, 'uint8', 3, meta.pointCount * 3);
  require(Array.isArray(meta.surfaces) && meta.surfaces.length === meta.photoCount && integer(meta.defaultSurface, 0, meta.photoCount - 1), 'Invalid photo list.');
  let triangles = 0;
  const surfaces = meta.surfaces.map(s => {
    localPath(s.image, 'jpg');
    require(HASH.test(s.imageSHA256) && vector(s.camera, 3) && vector(s.orientation, 4) && Math.abs(Math.hypot(...s.orientation) - 1) < 0.001, 'Invalid photo camera.');
    const vertices = read(s.vertices, 'float32', 3);
    const uv = read(s.uv, 'float32', 2, vertices.length / 3 * 2);
    const indices = read(s.indices, 'uint16', 3);
    require(vertices.length / 3 < 65536 && indices.every(i => i < vertices.length / 3), 'Invalid triangle index.');
    triangles += indices.length / 3;
    return { ...s, vertices, uv, indices };
  });
  require(triangles === meta.triangleCount, 'Triangle count mismatch.');
  return { ...meta, points, colors, surfaces };
}

export const ENU_BASIS = [1, 0, 0, 0, 0, -1, 0, 1, 0]; // E→right, U→up, N→back.
export function fitView(data) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const d of data) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], d.bounds.min[axis]); max[axis] = Math.max(max[axis], d.bounds.max[axis]);
  }
  const center = min.map((v, i) => (v + max[i]) / 2);
  const radius = Math.max(0.01, Math.hypot(...max.map((v, i) => (v - min[i]) / 2)));
  return { center, radius, basis: ENU_BASIS, yaw: 0.35, pitch: 0.65, distance: 2.8, pan: [0, 0], zoom: 1 };
}
export function sourceView(data) {
  const s = data.surfaces[data.defaultSurface], [x, y, z, w] = s.orientation;
  const rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]];
  const depths = [];
  for (let i = 0; i < s.vertices.length; i += 3) depths.push(rotation.reduce((sum, row, j) => sum + (s.vertices[i+j] - s.camera[j]) * row[2], 0));
  depths.sort((a, b) => a - b);
  const depth = depths[Math.floor(depths.length / 2)];
  if (!(depth > 0)) return fitView([data]);
  return { center: s.camera.map((v, j) => v + rotation[j][2] * depth), radius: data.radius,
    basis: rotation.flatMap(row => [row[0], -row[1], -row[2]]), yaw: 0, pitch: 0, distance: depth / data.radius, pan: [0, 0], zoom: 1 };
}
