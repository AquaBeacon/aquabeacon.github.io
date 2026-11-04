// Minimal WebGL photo-patch renderer, adapted from AquaBeacon's analysis viewer.
// Apache-2.0. Geometry stays in common ENU meters; centering affects display only.
import {sampleAt, trackSegments} from './navigation-data.js?v=3';

export function projectPoint(view, point, width, height) {
  let p = [0, 1, 2].map(j => point.reduce((sum, v, k) => sum + (v - view.center[k]) / view.radius * view.basis[k * 3 + j], 0));
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  p = [cy * p[0] + sy * p[2], p[1], -sy * p[0] + cy * p[2]];
  p = [p[0] + view.pan[0], cp * p[1] - sp * p[2] + view.pan[1], sp * p[1] + cp * p[2] - view.distance];
  if (p[2] >= -.001) return null;
  return [(p[0] * 1.73205 / (width / height) / -p[2] + 1) * width / 2, (1 - p[1] * 1.73205 / -p[2]) * height / 2];
}

function countThrough(times, time) {
  let low = 0, high = times.length;
  while (low < high) { const mid = (low + high) >>> 1; if (times[mid] <= time) low = mid + 1; else high = mid; }
  return low;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('このブラウザでは3D描画を利用できません。別のブラウザか下のレポートをご利用ください。');
  function shader(type, source) {
    const item = gl.createShader(type); gl.shaderSource(item, source); gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) { gl.deleteShader(item); throw new Error('3D描画を初期化できませんでした。'); }
    return item;
  }
  const vertex = shader(gl.VERTEX_SHADER, `
    attribute vec3 xyz; attribute vec2 uv; attribute vec3 rgb;
    uniform vec3 center; uniform mat3 basis; uniform float radius,yaw,pitch,dist,aspect,size;
    uniform vec2 pan; varying vec2 tex; varying vec3 color;
    void main(){
      vec3 p=basis*((xyz-center)/radius);
      float c=cos(yaw),s=sin(yaw);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      c=cos(pitch);s=sin(pitch);p=vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
      p.xy+=pan;p.z-=dist;
      gl_Position=vec4(p.x*1.73205/aspect,p.y*1.73205,-1.000002*p.z-.002000002,-p.z);
      gl_PointSize=size;tex=uv;color=rgb;
    }`);
  const fragment = shader(gl.FRAGMENT_SHADER, `precision mediump float;
    varying vec2 tex;varying vec3 color;uniform sampler2D image;uniform bool textured,rounded;
    void main(){if(rounded && distance(gl_PointCoord,vec2(.5))>.5)discard;
    gl_FragColor=textured?texture2D(image,tex):vec4(color,1.);}`);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D描画を初期化できませんでした。');
  gl.useProgram(program);
  const a = {}, u = {};
  for (const name of ['xyz', 'uv', 'rgb']) a[name] = gl.getAttribLocation(program, name);
  for (const name of ['center', 'basis', 'radius', 'yaw', 'pitch', 'dist', 'aspect', 'size', 'pan', 'image', 'textured', 'rounded']) u[name] = gl.getUniformLocation(program, name);
  let meshes = [], buffers = [], textures = [], tracks = [], navigation = [], grid, labels = [], marker;
  const colors = {parent: [.388, .831, 1], child: [1, .714, .361]};
  function buffer(values, target = gl.ARRAY_BUFFER) {
    const b = gl.createBuffer(); buffers.push(b); gl.bindBuffer(target, b); gl.bufferData(target, values, gl.STATIC_DRAW); return b;
  }
  function clear() {
    for (const b of buffers) gl.deleteBuffer(b);
    for (const t of textures) gl.deleteTexture(t);
    buffers = []; textures = []; meshes = []; tracks = []; navigation = []; grid = null; labels = [];
    gl.clearColor(.035, .114, .169, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  function setData(data, nav = []) {
    clear();
    navigation = nav;
    meshes = data.map(d => ({ points: buffer(d.points), colors: buffer(d.colors), count: d.pointCount,
      surfaces: d.surfaces.map(s => ({ xyz: buffer(s.vertices), uv: buffer(s.uv), indices: buffer(s.indices, gl.ELEMENT_ARRAY_BUFFER), count: s.indices.length, texture: null })) }));
    for (const n of navigation) for (const [role, index] of [['parent', 1], ['child', 2]]) {
      const lines = trackSegments(n, role), times = [], pointTimes = [], points = [];
      for (let i = 0; i < n.rows.length; i++) {
        const row = n.rows[i], prev = n.rows[i - 1];
        if (row[index]) { points.push(...row[index]); pointTimes.push(row[0]); }
        if (row[index] && prev?.[index] && row[0] - prev[0] <= n.maxGapSeconds) times.push(row[0]);
      }
      tracks.push({role, xyz: buffer(lines), times, points: buffer(new Float32Array(points)), pointTimes});
    }
    const bounds = [...data, ...nav].map(d => d.bounds);
    if (bounds.length) {
      const min = [0, 1, 2].map(i => Math.min(...bounds.map(b => b.min[i])));
      const max = [0, 1, 2].map(i => Math.max(...bounds.map(b => b.max[i])));
      const span = Math.max(...max.map((v, i) => v - min[i]), 1);
      const unit = 10 ** Math.floor(Math.log10(span / 5));
      const step = [1, 2, 5, 10].find(v => v * unit >= span / 5) * unit;
      const lo = min.map(v => Math.floor(v / step) * step), hi = max.map(v => Math.ceil(v / step) * step);
      const lines = [];
      for (let x = lo[0]; x <= hi[0] + step / 2; x += step) { lines.push(x, lo[1], lo[2], x, hi[1], lo[2]); labels.push({point: [x, lo[1], lo[2]], text: `E ${+x.toFixed(2)}`}); }
      for (let y = lo[1]; y <= hi[1] + step / 2; y += step) { lines.push(lo[0], y, lo[2], hi[0], y, lo[2]); labels.push({point: [hi[0], y, lo[2]], text: `N ${+y.toFixed(2)}`}); }
      lines.push(lo[0], lo[1], lo[2], lo[0], lo[1], hi[2]);
      for (let z = lo[2] + step; z <= hi[2] + step / 2; z += step) { lines.push(lo[0], lo[1], z, lo[0] + step * .1, lo[1], z); labels.push({point: [lo[0], lo[1], z], text: `U ${+z.toFixed(2)}`}); }
      grid = {xyz: buffer(new Float32Array(lines)), count: lines.length / 3};
    }
    marker = buffer(new Float32Array(3));
  }
  function upload(dataset, surface, image) {
    const t = gl.createTexture(); textures.push(t); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, axis, gl.CLAMP_TO_EDGE);
    for (const filter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, filter, gl.LINEAR);
    meshes[dataset].surfaces[surface].texture = t;
  }
  function attribute(name, b, size, type = gl.FLOAT, normalized = false) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(a[name]); gl.vertexAttribPointer(a[name], size, type, normalized, 0, 0);
  }
  function flat(xyz, color, mode, count, size = 2) {
    gl.uniform1i(u.textured, 0); gl.uniform1i(u.rounded, mode === gl.POINTS);
    gl.uniform1f(u.size, size); gl.disableVertexAttribArray(a.uv); gl.vertexAttrib2f(a.uv, 0, 0);
    gl.disableVertexAttribArray(a.rgb); gl.vertexAttrib3fv(a.rgb, color); attribute('xyz', xyz, 3);
    gl.drawArrays(mode, 0, count);
  }
  function draw(view, options) {
    const {showPhotos, showPoints, showParent, showChild, showGrid, time, history, single} = options;
    const ratio = Math.min(options.pixelRatio || Math.min(devicePixelRatio || 1, 2), 6), width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.clearColor(.035, .114, .169, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(program);
    gl.uniform3fv(u.center, view.center); gl.uniformMatrix3fv(u.basis, false, view.basis); gl.uniform2fv(u.pan, view.pan);
    for (const [key, value] of Object.entries({ radius: view.radius, yaw: view.yaw, pitch: view.pitch, dist: view.distance, aspect: width / height, size: 2 * ratio })) gl.uniform1f(u[key], value);
    if (showGrid && grid) flat(grid.xyz, [.16, .27, .34], gl.LINES, grid.count);
    gl.uniform1i(u.rounded, 0);
    if (showPhotos) {
      gl.disableVertexAttribArray(a.rgb); gl.vertexAttrib3f(a.rgb, 1, 1, 1);
      gl.uniform1i(u.textured, 1); gl.uniform1i(u.image, 0); gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      for (const d of meshes) for (const s of d.surfaces) if (s.texture) {
        attribute('xyz', s.xyz, 3); attribute('uv', s.uv, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.indices); gl.bindTexture(gl.TEXTURE_2D, s.texture); gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    if (showPoints) {
      gl.uniform1f(u.size, 2 * ratio);
      gl.uniform1i(u.textured, 0); gl.disableVertexAttribArray(a.uv); gl.vertexAttrib2f(a.uv, 0, 0);
      for (const d of meshes) { attribute('xyz', d.points, 3); attribute('rgb', d.colors, 3, gl.UNSIGNED_BYTE, true); gl.drawArrays(gl.POINTS, 0, d.count); }
    }
    const cutoff = history && single ? time : Infinity;
    for (const track of tracks) if (track.role === 'parent' ? showParent : showChild) {
      flat(track.xyz, colors[track.role], gl.LINES, countThrough(track.times, cutoff) * 2);
      flat(track.points, colors[track.role], gl.POINTS, countThrough(track.pointTimes, cutoff), 2.5 * ratio);
    }
    const overlay = showGrid ? [...labels] : [];
    if (single && navigation.length === 1) {
      const row = sampleAt(navigation[0], time);
      for (const [role, index, name] of [['parent', 1, '親機'], ['child', 2, '子機']]) {
        if (!row?.[index] || !(role === 'parent' ? showParent : showChild)) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, marker); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(row[index]), gl.DYNAMIC_DRAW);
        gl.disable(gl.DEPTH_TEST);
        flat(marker, [1, 1, 1], gl.POINTS, 1, 12 * ratio);
        flat(marker, colors[role], gl.POINTS, 1, 8 * ratio);
        gl.enable(gl.DEPTH_TEST);
        overlay.push({point: row[index], text: name, role});
      }
    }
    return overlay;
  }
  function destroy() { clear(); gl.deleteProgram(program); }
  return { setData, upload, draw, clear, destroy };
}
