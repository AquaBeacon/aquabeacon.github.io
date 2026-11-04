import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateNavigation, sampleAt, trackSegments, nearestSurface} from '../site/assets/navigation-data.js';
import {fitView} from '../site/assets/map-data.js';
import {projectPoint} from '../site/assets/map-renderer.js';
const root = new URL('../site/map/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('manifest.json', root)));
const sources = JSON.parse(await readFile(new URL('../research/reports/20261102-mapping/summary.json', root)));
for (const item of catalog.datasets) {
  test(`${item.id}: trajectory retains reviewed source, nulls and bounds`, async () => {
    const raw = await readFile(new URL(item.navigation.file, root));
    assert.equal(raw.length, item.navigation.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), item.navigation.sha256);
    const nav = validateNavigation(JSON.parse(raw), item);
    assert.equal(nav.source.sceneSHA256, sources.datasets.find(d => d.experimentId === item.id).sourceSceneSHA256);
    for (const r of nav.rows) {
      assert.deepEqual(sampleAt(nav, r[0]), r);
      if (r[2] === null) assert.equal(sampleAt(nav, r[0] + .001)?.[2], null);
    }
    const view = fitView([nav]);
    for (const r of nav.rows) for (const p of r.slice(1, 3)) if (p) assert.ok(Math.hypot(...p.map((v, i) => v - view.center[i])) <= view.radius + 1e-8);
    for (const mutate of [n => n.rows[1][0] = n.rows[0][0], n => n.rows[0][1] = [NaN,0,0], n => n.source.sfmUsedForNavigation = true, n => n.validSamples.child++]) {
      const invalid = structuredClone(nav); mutate(invalid); assert.throws(() => validateNavigation(invalid, item));
    }
  });
}
test('never connect missing rows or bridge a timestamp gap; retain historical cutoff', () => {
  const nav = {durationSeconds: 4, maxGapSeconds: .375, rows: [[0,[1,0,0],[2,0,0],0],[.25,[2,0,0],null,null],[.5,[3,0,0],[4,0,0],0],[.75,[4,0,0],[5,0,0],0],[3,[9,0,0],[9,0,0],0]]};
  assert.deepEqual([...trackSegments(nav, 'child')], [4,0,0,5,0,0]);
  assert.equal(trackSegments(nav, 'child', .5).length, 0);
  assert.equal(sampleAt(nav, 2), null);
  assert.equal(sampleAt(nav, .3)[2], null);
  assert.equal(sampleAt(nav, -1), null);
  assert.equal(sampleAt(nav, 5), null);
  assert.equal(nearestSurface([], 0), -1);
  assert.equal(nearestSurface([{timeSeconds:2},{timeSeconds:8}],7),1);
});
test('top view keeps East right and North up; metric displacement is not changed', () => {
  const v = fitView([{bounds:{min:[-5,-5,-5],max:[5,5,5]}}]);
  v.yaw=0; v.pitch=Math.PI/2;
  const c=projectPoint(v,[0,0,0],800,600), e=projectPoint(v,[1,0,0],800,600), n=projectPoint(v,[0,1,0],800,600);
  assert.ok(e[0]>c[0]);assert.ok(n[1]<c[1]);
  assert.ok(Math.abs(e[0]-c[0]-(c[1]-n[1]))<1e-8);
});
