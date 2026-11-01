// Minimal WebGL photo-patch renderer, adapted from AquaBeacon's analysis viewer.
// Apache-2.0. Geometry stays in common ENU meters; centering affects display only.
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
    varying vec2 tex;varying vec3 color;uniform sampler2D image;uniform bool textured;
    void main(){gl_FragColor=textured?texture2D(image,tex):vec4(color,1.);}`);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D描画を初期化できませんでした。');
  gl.useProgram(program);
  const a = {}, u = {};
  for (const name of ['xyz', 'uv', 'rgb']) a[name] = gl.getAttribLocation(program, name);
  for (const name of ['center', 'basis', 'radius', 'yaw', 'pitch', 'dist', 'aspect', 'size', 'pan', 'image', 'textured']) u[name] = gl.getUniformLocation(program, name);
  let meshes = [], buffers = [], textures = [];
  function buffer(values, target = gl.ARRAY_BUFFER) {
    const b = gl.createBuffer(); buffers.push(b); gl.bindBuffer(target, b); gl.bufferData(target, values, gl.STATIC_DRAW); return b;
  }
  function clear() {
    for (const b of buffers) gl.deleteBuffer(b);
    for (const t of textures) gl.deleteTexture(t);
    buffers = []; textures = []; meshes = [];
    gl.clearColor(0.028, 0.065, 0.095, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  function setData(data) {
    clear();
    meshes = data.map(d => ({ points: buffer(d.points), colors: buffer(d.colors), count: d.pointCount,
      surfaces: d.surfaces.map(s => ({ xyz: buffer(s.vertices), uv: buffer(s.uv), indices: buffer(s.indices, gl.ELEMENT_ARRAY_BUFFER), count: s.indices.length, texture: null })) }));
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
  function draw(view, showPhotos, showPoints) {
    const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.clearColor(0.028, 0.065, 0.095, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(program);
    gl.uniform3fv(u.center, view.center); gl.uniformMatrix3fv(u.basis, false, view.basis); gl.uniform2fv(u.pan, view.pan);
    for (const [key, value] of Object.entries({ radius: view.radius, yaw: view.yaw, pitch: view.pitch, dist: view.distance, aspect: width / height, size: 2 * ratio })) gl.uniform1f(u[key], value);
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
      gl.uniform1i(u.textured, 0); gl.disableVertexAttribArray(a.uv); gl.vertexAttrib2f(a.uv, 0, 0);
      for (const d of meshes) { attribute('xyz', d.points, 3); attribute('rgb', d.colors, 3, gl.UNSIGNED_BYTE, true); gl.drawArrays(gl.POINTS, 0, d.count); }
    }
  }
  return { setData, upload, draw, clear };
}
