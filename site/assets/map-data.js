// Dependency-free published point-cloud contract. Apache-2.0.
export const MAX_POINTS = 100000;

export function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || !['pending', 'ready'].includes(value.status)) {
    throw new Error('Unsupported map manifest.');
  }
  if (value.status === 'ready') {
    if (typeof value.file !== 'string' || !/^data\/[a-zA-Z0-9_-]+\.json$/.test(value.file)) {
      throw new Error('Map data must be a local JSON file below data/.');
    }
    for (const key of ['title', 'coordinateSystem', 'scaleNote', 'description']) {
      if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Missing ${key}.`);
    }
    if (!Number.isInteger(value.pointCount) || value.pointCount < 1 || value.pointCount > MAX_POINTS) {
      throw new Error('Invalid published point count.');
    }
  }
  return value;
}

export function preparePoints(value, expectedCount) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.points) ||
      value.points.length < 1 || value.points.length > MAX_POINTS || value.points.length !== expectedCount) {
    throw new Error('Invalid point-cloud size.');
  }
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const p of value.points) {
    if (!Array.isArray(p) || p.length !== 6 || !p.every(Number.isFinite) ||
        p.slice(3).some(c => !Number.isInteger(c) || c < 0 || c > 255)) {
      throw new Error('Each point requires finite x/y/z and integer RGB in 0–255.');
    }
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], p[axis]);
      maximum[axis] = Math.max(maximum[axis], p[axis]);
    }
  }
  const centre = minimum.map((v, i) => v / 2 + maximum[i] / 2);
  const extent = Math.max(...minimum.map((v, i) => maximum[i] - v));
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('Point cloud has no usable extent.');
  // Display normalization only. It does not establish metric scale or geographic coordinates.
  return value.points.map(p => [
    (p[0] - centre[0]) / extent, (p[1] - centre[1]) / extent, (p[2] - centre[2]) / extent,
    `rgb(${p[3]} ${p[4]} ${p[5]})`,
  ]);
}

export function projectPoint(p, yaw, pitch) {
  const x = Math.cos(yaw) * p[0] - Math.sin(yaw) * p[1];
  const y = Math.sin(yaw) * p[0] + Math.cos(yaw) * p[1];
  // Z-up, viewed from negative Y; in the top view positive Y points upward.
  return [x, -Math.sin(pitch) * y - Math.cos(pitch) * p[2], -Math.cos(pitch) * y + Math.sin(pitch) * p[2]];
}
