import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

// A ribbon swept by a blade: the last few hundredths of a second of its edge,
// bright at the steel and fading behind. Shown only while the blade moves fast.

const SEG = 20;

export class BladeTrail {
  constructor(scene, { color = 0xfff2c0, life = 170, minSpeed = 2.2 } = {}) {
    this.life = life;
    this.minSpeed = minSpeed;
    this.samples = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((SEG + 1) * 2 * 3);
    this.col = new Float32Array((SEG + 1) * 2 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < SEG; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({
      color, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.strength = 0;
  }

  setColor(hex) {
    this.mat.color.setHex(hex);
  }

  // base, tip: world positions of the blade this frame. now: ms.
  update(base, tip, now) {
    const s = this.samples;
    const last = s[s.length - 1];
    const speed = last ? tip.distanceTo(last.tip) / Math.max(0.001, (now - last.t) / 1000) : 0;
    s.push({ base: base.clone(), tip: tip.clone(), t: now });
    while (s.length > 2 && now - s[0].t > this.life) s.shift();
    // Fade in when the blade is fast, out when it slows.
    const want = speed > this.minSpeed ? Math.min(1, (speed - this.minSpeed) / 2.5) : 0;
    this.strength += (want - this.strength) * (want > this.strength ? 0.6 : 0.18);
    if (this.strength < 0.02 || s.length < 3) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const n = s.length;
    for (let i = 0; i <= SEG; i++) {
      // Sample the history evenly from oldest to newest.
      const f = (i / SEG) * (n - 1);
      const j = Math.min(n - 2, Math.floor(f));
      const u = f - j;
      const a = s[j];
      const b = s[j + 1];
      const k = i * 2;
      for (let c = 0; c < 3; c++) {
        // Only the outer two-thirds of the blade leaves a trail.
        const ba = a.base.getComponent(c) + (a.tip.getComponent(c) - a.base.getComponent(c)) * 0.35;
        const bb = b.base.getComponent(c) + (b.tip.getComponent(c) - b.base.getComponent(c)) * 0.35;
        this.pos[k * 3 + c] = ba + (bb - ba) * u;
        this.pos[(k + 1) * 3 + c] = a.tip.getComponent(c) + (b.tip.getComponent(c) - a.tip.getComponent(c)) * u;
      }
      const age = i / SEG;               // 0 oldest .. 1 newest
      const al = Math.pow(age, 1.3) * this.strength;
      this.col.set([1, 1, 1, al * 0.55], k * 4);
      this.col.set([1, 1, 1, Math.min(1, al * 1.4)], (k + 1) * 4);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.computeBoundingSphere();
  }

  hide() {
    this.samples = [];
    this.strength = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
