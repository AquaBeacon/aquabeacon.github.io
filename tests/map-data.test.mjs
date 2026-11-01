import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateManifest, prepareGeometry, fitView, sourceView, localPath } from '../site/assets/map-data.js';
const root = new URL('../site/map/', import.meta.url);
const catalog = validateManifest(JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')));
const scenes = [];
const digest = data => createHash('sha256').update(data).digest('hex');
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
for (const item of catalog.datasets.filter(d => d.availability === 'ready')) {
  const raw = await readFile(new URL(item.file, root));
  const meta = JSON.parse(raw);
  const binary = await readFile(new URL(meta.binary, root));
  scenes.push({ item, meta, binary: arrayBuffer(binary), prepared: prepareGeometry(meta, arrayBuffer(binary), item) });
  test(`${item.id}: geometry and all photo hashes match the catalog`, async () => {
    assert.equal(digest(raw), item.metadataSHA256);
    assert.equal(digest(binary), meta.binarySHA256);
    assert.equal(binary.length, meta.binaryByteLength);
    let transfer = raw.length + binary.length;
    for (const s of meta.surfaces) {
      const bytes = await readFile(new URL(s.image, root));
      assert.equal(digest(bytes), s.imageSHA256); transfer += bytes.length;
    }
    assert.equal(transfer, item.transferBytes);
  });
}
test('catalog retains all five accepted maps and two exclusions', () => {
  assert.deepEqual(catalog.totals, { pointCount: 82500, photoCount: 230, triangleCount: 218697 });
  assert.equal(scenes.length, 5);
  assert.equal(catalog.datasets.filter(d => d.availability === 'unavailable').length, 2);
  for (const mutate of [c => c.groups[0].ids.push('absent'), c => c.totals.pointCount++, c => c.datasets[0].file='../private.json', c => c.datasets[5].pointCount=1]) {
    const copy = structuredClone(catalog); mutate(copy); assert.throws(() => validateManifest(copy));
  }
});
test('only allow local, selected asset paths', () => {
  assert.equal(localPath('data/images/trial-01.jpg', 'jpg'), 'data/images/trial-01.jpg');
  for (const path of ['https://example.com/map.bin', '../map.bin', 'data/../map.bin', '/data/map.bin', 'data/map.bin?x=1']) assert.throws(() => localPath(path, 'bin'));
});
test('reject malformed binary views, non-finite positions and invalid triangles', () => {
  const { meta, item, binary } = scenes[0];
  for (const mutate of [m => m.id='other', m => m.points.byteOffset=1, m => m.colors.byteOffset=0, m => m.surfaces[0].uv.count-=2, m => m.defaultSurface=999, m => m.triangleCount++]) {
    const copy=structuredClone(meta); mutate(copy); assert.throws(() => prepareGeometry(copy,binary,item));
  }
  const invalidFloat=binary.slice(0); new DataView(invalidFloat).setFloat32(meta.points.byteOffset,NaN,true);
  assert.throws(() => prepareGeometry(meta,invalidFloat,item));
  const invalidIndex=binary.slice(0); new DataView(invalidIndex).setUint16(meta.surfaces[0].indices.byteOffset,65535,true);
  assert.throws(() => prepareGeometry(meta,invalidIndex,item));
});
test('common overview centers without changing relative metric placement', () => {
  const view = fitView(scenes.map(s=>s.prepared));
  for (const {prepared} of scenes) {
    for (const bound of [prepared.bounds.min,prepared.bounds.max]) assert.ok(Math.hypot(...bound.map((v,i)=>v-view.center[i]))<=view.radius+1e-8);
  }
  const point = [10,20,30], other=[11,22,33];
  const transform=p=>[0,1,2].map(j=>p.reduce((sum,v,k)=>sum+(v-view.center[k])/view.radius*view.basis[k*3+j],0));
  const a=transform(point),b=transform(other);
  assert.ok(Math.abs(Math.hypot(...a.map((v,i)=>v-b[i]))*view.radius-Math.sqrt(14))<1e-10);
});
test('source camera is at the origin looking forward after display transform', () => {
  for (const {prepared} of scenes) {
    const view=sourceView(prepared), s=prepared.surfaces[prepared.defaultSurface];
    const transformed=[0,1,2].map(j=>s.camera.reduce((sum,v,k)=>sum+(v-view.center[k])/view.radius*view.basis[k*3+j],0));
    assert.ok(Math.abs(transformed[0])<1e-5 && Math.abs(transformed[1])<1e-5);
    assert.ok(Math.abs(transformed[2]-view.distance)<1e-5);
    assert.ok(view.distance>0);
  }
});
