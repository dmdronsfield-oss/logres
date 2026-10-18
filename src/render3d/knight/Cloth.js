import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

// Small verlet cloth: a grid pinned along its top edge to points on the body,
// pulled by gravity, kept in shape by distance constraints and pushed out of
// the body by sphere colliders. Simulated in world space.

const GRAVITY = -9.8;

export class Cloth {
  constructor({ cols, rows, width, height, material, pin, colliders, damping = 0.975 }) {
    this.cols = cols;
    this.rows = rows;
    this.pin = pin;               // (col, out: Vector3) => world position of a top-row pin
    this.colliders = colliders;   // () => [{ c: Vector3, r }]
    this.damping = damping;
    this.dx = width / (cols - 1);
    this.dy = height / (rows - 1);
    const n = cols * rows;
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
    this.cons = [];
    const id = (c, r) => r * cols + c;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) this.cons.push([id(c, r), id(c + 1, r), this.dx]);
        if (r < rows - 1) this.cons.push([id(c, r), id(c, r + 1), this.dy]);
        if (c < cols - 1 && r < rows - 1) {
          const d = Math.hypot(this.dx, this.dy);
          this.cons.push([id(c, r), id(c + 1, r + 1), d], [id(c + 1, r), id(c, r + 1), d]);
        }
        if (r < rows - 2) this.cons.push([id(c, r), id(c, r + 2), this.dy * 2]);
      }
    }
    this.geo = new THREE.PlaneGeometry(width, height, cols - 1, rows - 1);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.ready = false;
    this.v = new THREE.Vector3();
  }

  // Hang straight down from the pins.
  reset() {
    const { cols, rows } = this;
    for (let c = 0; c < cols; c++) {
      this.pin(c, this.v);
      for (let r = 0; r < rows; r++) {
        const i = (r * cols + c) * 3;
        this.p[i] = this.v.x;
        this.p[i + 1] = this.v.y - r * this.dy;
        this.p[i + 2] = this.v.z - r * 0.01;
        this.q[i] = this.p[i];
        this.q[i + 1] = this.p[i + 1];
        this.q[i + 2] = this.p[i + 2];
      }
    }
    this.ready = true;
    this.write();
  }

  update(dt) {
    if (!this.ready) this.reset();
    if (dt <= 0) return;
    const h = Math.min(dt, 1 / 30) / 2;
    const cols = this.cols;
    const n = cols * this.rows;
    const P = this.p;
    const Q = this.q;
    const spheres = this.colliders();
    for (let step = 0; step < 2; step++) {
      for (let i = cols; i < n; i++) {
        const k = i * 3;
        for (let a = 0; a < 3; a++) {
          const vel = (P[k + a] - Q[k + a]) * this.damping;
          Q[k + a] = P[k + a];
          P[k + a] += vel + (a === 1 ? GRAVITY * h * h : 0);
        }
      }
      for (let c = 0; c < cols; c++) {
        this.pin(c, this.v);
        const k = c * 3;
        P[k] = this.v.x; P[k + 1] = this.v.y; P[k + 2] = this.v.z;
        Q[k] = this.v.x; Q[k + 1] = this.v.y; Q[k + 2] = this.v.z;
      }
      for (let it = 0; it < 4; it++) {
        for (const [i, j, rest] of this.cons) {
          const a = i * 3;
          const b = j * 3;
          const dx = P[b] - P[a];
          const dy = P[b + 1] - P[a + 1];
          const dz = P[b + 2] - P[a + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = (d - rest) / d;
          const wa = i < cols ? 0 : 1;
          const wb = j < cols ? 0 : 1;
          const sum = wa + wb;
          if (!sum) continue;
          const fa = (diff * wa) / sum;
          const fb = (diff * wb) / sum;
          P[a] += dx * fa; P[a + 1] += dy * fa; P[a + 2] += dz * fa;
          P[b] -= dx * fb; P[b + 1] -= dy * fb; P[b + 2] -= dz * fb;
        }
        for (let i = cols; i < n; i++) {
          const k = i * 3;
          for (const s of spheres) {
            const dx = P[k] - s.c.x;
            const dy = P[k + 1] - s.c.y;
            const dz = P[k + 2] - s.c.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < s.r * s.r) {
              const d = Math.sqrt(d2) || 1e-6;
              const f = s.r / d;
              P[k] = s.c.x + dx * f;
              P[k + 1] = s.c.y + dy * f;
              P[k + 2] = s.c.z + dz * f;
            }
          }
          if (P[k + 1] < 0.01) P[k + 1] = 0.01;
        }
      }
    }
    this.write();
  }

  write() {
    const pos = this.geo.attributes.position;
    pos.array.set(this.p);
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}
