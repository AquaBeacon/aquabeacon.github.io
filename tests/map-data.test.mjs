import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, preparePoints, projectPoint } from '../site/assets/map-data.js';

const ready = { schemaVersion: 1, status: 'ready', file: 'data/map-v1.json', title: 'test',
  coordinateSystem: 'local Z-up', scaleNote: 'arbitrary', description: 'test only', pointCount: 2 };
test('pending state needs no invented map', () => assert.equal(validateManifest({ schemaVersion: 1, status: 'pending' }).status, 'pending'));
test('ready map requires local data and scientific context', () => {
  assert.equal(validateManifest(ready).file, 'data/map-v1.json');
  for (const file of ['https://example.com/data.json', '../data.json', '/data.json', 'data/../../secret.json']) {
    assert.throws(() => validateManifest({ ...ready, file }));
  }
  assert.throws(() => validateManifest({ ...ready, scaleNote: '' }));
  assert.throws(() => validateManifest({ ...ready, pointCount: 100001 }));
});
test('display centering preserves relative point distances', () => {
  const p = preparePoints({ schemaVersion: 1, points: [[100, 200, -5, 0, 100, 255], [110, 200, -5, 255, 0, 0]] }, 2);
  assert.deepEqual(p.map(x => x.slice(0, 3)), [[-0.5, 0, 0], [0.5, 0, 0]]);
});
test('invalid and mislabeled point data is rejected', () => {
  for (const points of [[], [[0, 0, 0, 1, 2, 3]], [[0, 0, NaN, 1, 2, 3], [1, 0, 0, 1, 2, 3]], [[0, 0, 0, 256, 2, 3], [1, 0, 0, 1, 2, 3]]]) {
    assert.throws(() => preparePoints({ schemaVersion: 1, points }, 2));
  }
});
test('orbit changes the view but preserves 3D distance', () => {
  const p = [0.3, 0.7, -0.5], rotated = projectPoint(p, 0.8, 0.4);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...rotated)) < 1e-12);
  const overhead = projectPoint([1, 2, 3], 0, Math.PI / 2);
  assert.ok(Math.abs(overhead[0] - 1) < 1e-12 && Math.abs(overhead[1] + 2) < 1e-12);
});
