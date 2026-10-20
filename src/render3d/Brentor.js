import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';

// Brent Tor and St Michael de Rupe: "Brentor Church in Dartmoor National Park" by Chris Bibb
// (Sketchfab, CC BY 4.0), a photogrammetry scan of the church on its rock, reduced for the
// browser by tools/brentor_build.py (metres; the porch at the origin).
const URL_BRENTOR = new URL('../../assets/locations/brentor/brentor.glb', import.meta.url).href;

// The porch door, and the way it faces (out toward the path).
export const PORCH_DOOR = new THREE.Vector3(0.8, 0, 0.05);
export const PORCH_OUT = new THREE.Vector3(-0.71, 0, -0.71);
// The middle of the church on the ground plan.
export const CHURCH = new THREE.Vector3(7, 0, 1.4);
// The path up, in metres on the ground plan (x, z): from below the stone steps, through the
// gate, along the paved path under the bank, round the churchyard corner and down to the porch.
// Traced on a top-down render of the scan (tools/brentor_build.py).
export const ROUTE = [[-23.3, -23.45], [-19.93, -21.78], [-14.3, -18.82], [-8.55, -15.83], [-7.42, -15.2], [-4.55, -13.58], [-2.05, -12.28],
  [0.45, -11.08], [2.7, -9.95], [3.75, -8.78], [3.08, -7.2], [1.95, -5.45], [0.83, -3.58], [-0.05, -1.82], [-0.2, -0.95]];
// The scan carries its own sunlight; a light from here matches its shadows.
export const SUN_DIR = new THREE.Vector3(-0.5, 1, 0.6).normalize();

// Tufts of grass, mid-grey on average, to tile over the moor beyond the scan.
function grassTexture() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * N, y = rnd() * N, l = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
    const v = Math.round(70 + rnd() * 120);
    g.strokeStyle = `rgb(${v},${v + 6},${v - 10})`;
    g.lineWidth = 1 + rnd();
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The tor, ready to add to a scene, with heightAt(x, z) for standing things on it.
export async function loadBrentor(onProgress) {
  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
  const land = await new GLTFLoader().setDRACOLoader(draco).loadAsync(URL_BRENTOR, onProgress);
  // Lit softly so the scan keeps its photographed colour; it still takes shadows.
  const ground = [];
  land.scene.traverse((o) => {
    if (!o.isMesh) return;
    const old = o.material;
    o.material = old.map
      // part glow so every face keeps its colour, lit or not
      ? new THREE.MeshLambertMaterial({ map: old.map, emissive: 0xffffff, emissiveMap: old.map, emissiveIntensity: 0.55 })
      // the skirt falling away to the moor: grass over the colours of the scan's edge
      : new THREE.MeshLambertMaterial({ map: grassTexture(), vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9), side: THREE.DoubleSide });
    // Its long thin faces would catch the light in streaks; light it as level ground instead.
    if (!old.map) o.geometry.attributes.normal.array.forEach((_, i, n) => { n[i] = i % 3 === 1 ? 1 : 0; });
    o.receiveShadow = true;
    ground.push(o);
  });
  land.scene.updateMatrixWorld(true);

  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  function heightAt(x, z, fallback = 0) {
    ray.set(from.set(x, 80, z), down);
    const hit = ray.intersectObjects(ground, false)[0];
    return hit ? hit.point.y : fallback;
  }
  return { root: land.scene, ground, heightAt };
}

// The country round the tor, for wide shots: farmland a hundred metres below the church,
// rising to the moor's hills in the distance, to be seen through haze.
export function moorland() {
  const geo = new THREE.RingGeometry(150, 1600, 160, 60);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const n2 = (x, z) => Math.sin(x * 0.013 + Math.sin(z * 0.007) * 2) * Math.cos(z * 0.011 - Math.sin(x * 0.005) * 1.7);
  const fields = [new THREE.Color('#5d6b3a'), new THREE.Color('#6f7444'), new THREE.Color('#4e5a34'), new THREE.Color('#7a6c45')];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    // gently rolling farmland, the hills of Dartmoor rising to the east
    const east = Math.max(0, x / r) * THREE.MathUtils.smoothstep(r, 450, 1300);
    const y = -78 + n2(x, z) * 9 + n2(x * 2.3 + 40, z * 2.3) * 4 + east * (60 + n2(x * 0.6, z * 0.6) * 35);
    p.setY(i, y);
    const f = fields[Math.abs(Math.floor(n2(x * 4.1, z * 4.1) * 3 + n2(x * 9, z * 7))) % 4];
    c.copy(f).lerp(new THREE.Color('#6b5a40'), east * 0.6);
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

// The Paladin's walk, held over his feet so a path can carry him: his planted foot
// travels back 0.78 m in 0.67 s of the clip, so he covers WALK_SPEED metres a second.
export const WALK_SPEED = 1.17;
export function holdWalkInPlace(animations) {
  const walk = animations.find((c) => c.name === 'walk');
  const hips = walk.tracks.find((t) => /Hips\.position$/.test(t.name));
  if (hips && !walk.userData?.inPlace) {
    const v = hips.values;
    for (let i = 0; i < hips.times.length; i++) { v[i * 3] = v[0]; v[i * 3 + 2] = v[2]; }
    walk.userData = { inPlace: true };
  }
  return walk;
}

// A sea of mist lapping at the tor: on top of the scene's own fog, everything below `top`
// fades into the fog colour, wholly so by `bottom` and more so the farther away it is.
// Call before any material is first drawn; it applies to every fogged material.
export function installGroundFog(top, bottom) {
  const C = THREE.ShaderChunk;
  if (C.fog_vertex.includes('vFogY')) return;
  const f = (x) => x.toFixed(2);
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying float vFogY;');
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;\n\tvFogY = ( inverse( viewMatrix ) * mvPosition ).y;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying float vFogY;');
  C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix(',
    `float mist = ( 1.0 - smoothstep( ${f(bottom)}, ${f(top)}, vFogY ) ) * ( 1.0 - exp( - vFogDepth * 0.06 ) );
\tfogFactor = max( fogFactor, mist );
\tgl_FragColor.rgb = mix(`);
}

// Soft drifting cloud, tileable: white with alpha from layered noise.
function cloudTexture(seed = 3) {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // value noise on wrapping grids, four octaves
  const octaves = [4, 8, 16, 32].map((n) => ({ n, v: Array.from({ length: n * n }, rnd) }));
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, w = 0.55;
    for (const o of octaves) {
      const fx = (x / N) * o.n, fy = (y / N) * o.n, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy), at = (i, j) => o.v[((j % o.n) * o.n) + (i % o.n)];
      a += w * ((at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty);
      w *= 0.5;
    }
    const i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.max(0, Math.min(255, (a - 0.42) * 2.4 * 255));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Banks of cloud on the mist's surface; update(t) drifts them.
export function mistClouds(top, color) {
  const g = new THREE.Group();
  const layers = [[top - 1.6, 0.55, 5, 1], [top - 0.4, 0.4, 8, 2], [top + 0.8, 0.22, 13, 3]].map(([y, opacity, rep, seed]) => {
    const map = cloudTexture(seed * 7919);
    map.repeat.set(rep, rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({
      map, color, transparent: true, opacity, depthWrite: false, fog: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 2;
    g.add(m);
    return m;
  });
  g.userData.update = (t) => layers.forEach((m, i) => { m.material.map.offset.set(t * 0.0009 * (i + 1), t * 0.0004 * (2 - i)); });
  return g;
}

// Trees standing in the mist round the tor, only their crowns above it: firs, and a few
// round-headed oaks. Their trunks run down out of sight into the fog.
export function mistTrees(heightAt, top, { count = 420, woods = 30, inner = 46, outer = 300, seed = 11 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // a fir tier: a cone with a ragged hem
  const fir = new THREE.ConeGeometry(1, 1, 11, 2).translate(0, 0.5, 0);
  const fp = fir.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    if (fp.getY(i) > 0.9) continue;
    const k = 1 + (rnd() - 0.5) * 0.45 * (1 - fp.getY(i));
    fp.setXYZ(i, fp.getX(i) * k, fp.getY(i) - rnd() * 0.08, fp.getZ(i) * k);
  }
  fir.computeVertexNormals();
  const oak = new THREE.IcosahedronGeometry(1, 1);
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 1, 5).translate(0, 0.5, 0);
  const dark = new THREE.MeshLambertMaterial({ color: '#26341f' });
  const oakMat = new THREE.MeshLambertMaterial({ color: '#34402a' });
  const bark = new THREE.MeshLambertMaterial({ color: '#2b241c' });
  const firs = new THREE.InstancedMesh(fir, dark, count * 3);
  const oaks = new THREE.InstancedMesh(oak, oakMat, count * 4);
  const trunks = new THREE.InstancedMesh(trunk, bark, count);
  let nf = 0, no = 0, nt = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const C = CHURCH;
  // in woods and spinneys, not scattered evenly
  const groves = Array.from({ length: woods }, () => {
    const a = rnd() * Math.PI * 2, r = inner + 10 + Math.pow(rnd(), 0.9) * (outer - inner - 10);
    return { x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r, spread: 6 + rnd() * 22 };
  });
  for (let tries = 0; nt < count && tries < count * 20; tries++) {
    const gr = groves[Math.floor(rnd() * woods)];
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * gr.spread;
    const x = gr.x + Math.sin(a) * d, z = gr.z + Math.cos(a) * d;
    if (Math.hypot(x - C.x, z - C.z) < inner) continue;
    const ground = heightAt(x, z, -78);
    if (ground > top - 2.5) continue;   // keep off the tor itself
    const crownTop = top + 0.3 + rnd() * rnd() * 4.5;   // mostly just the tops showing
    const base = Math.min(ground, top - 14);
    // trunk from the (hidden) ground to the crown
    m.compose(p.set(x, base, z), q.identity(), sc.set(1, crownTop - base - 2, 1));
    trunks.setMatrixAt(nt++, m);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.3);
    if (rnd() < 0.72) {
      // a fir: three tiers narrowing to the tip
      const h = 7 + rnd() * 5, w = 2 + rnd() * 1.4;
      for (let k = 0; k < 3; k++) {
        const ww = w * (1 - k * 0.27), hh = h * (0.55 - k * 0.1);
        m.compose(p.set(x, crownTop - h + k * h * 0.3, z), q, sc.set(ww, hh, ww));
        firs.setMatrixAt(nf++, m);
      }
    } else {
      // an oak: a cluster of round heads
      const w = 3 + rnd() * 2.5;
      for (let k = 0; k < 4; k++) {
        const ww = w * (0.55 + rnd() * 0.3);
        p.set(x + (rnd() - 0.5) * w, crownTop - ww * (0.9 + k * 0.5), z + (rnd() - 0.5) * w);
        m.compose(p, q, sc.set(ww, ww * 0.9, ww));
        oaks.setMatrixAt(no++, m);
      }
    }
  }
  // each tree its own shade of dark green
  const tint = new THREE.Color();
  for (let i = 0; i < nf; i++) firs.setColorAt(i, tint.setHSL(0.27 + (rnd() - 0.5) * 0.06, 0.25 + rnd() * 0.15, 0.62 + rnd() * 0.5));
  for (let i = 0; i < no; i++) oaks.setColorAt(i, tint.setHSL(0.2 + (rnd() - 0.5) * 0.08, 0.2 + rnd() * 0.2, 0.6 + rnd() * 0.5));
  firs.count = nf;
  oaks.count = no;
  trunks.count = nt;
  const g = new THREE.Group();
  g.add(trunks, firs, oaks);
  return g;
}
