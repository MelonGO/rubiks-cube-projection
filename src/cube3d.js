import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACE_NORMALS, posKey } from './cubeState.js';
import { COLORS } from './projection2d.js';

const SPACING = 1;
const CUBIE = 0.97;
const STICKER = 0.8;
const STICKER_RADIUS = 0.13;

function roundedRectShape(size, radius) {
  const h = size / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

export class Cube3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(12, 1, 0.1, 200);
    // viewed from the U-F-R corner, slightly from above (as in the video)
    this.azimuth = Math.PI / 4;
    this.elevation = 0.3;
    this.distance = 15;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-3, 8, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(6, 2, 2);
    this.scene.add(fill);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);

    this.materials = {};
    for (const [face, hex] of Object.entries(COLORS)) {
      this.materials[face] = new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.28,
        roughness: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
    }
    this.buildCubies();
    this.turnKey = null;
    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  buildCubies() {
    const bodyGeo = new RoundedBoxGeometry(CUBIE, CUBIE, CUBIE, 4, 0.09);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.55 });
    const stickerGeo = new THREE.ShapeGeometry(roundedRectShape(STICKER, STICKER_RADIUS), 6);
    this.cubies = [];
    this.stickerMeshes = new Map();
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const home = [x, y, z];
          const cubie = new THREE.Group();
          cubie.userData.home = home;
          cubie.position.set(x * SPACING, y * SPACING, z * SPACING);
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.userData.cubie = cubie;
          cubie.add(body);
          for (const n of Object.values(FACE_NORMALS)) {
            const a = n.findIndex((v) => v !== 0);
            if (home[a] !== n[a]) continue;
            const sticker = new THREE.Mesh(stickerGeo, this.materials.U);
            const nv = new THREE.Vector3(...n);
            sticker.position.copy(nv).multiplyScalar(CUBIE / 2 + 0.002);
            sticker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nv);
            sticker.userData.cubie = cubie;
            cubie.add(sticker);
            this.stickerMeshes.set(posKey(home, n), sticker);
          }
          this.root.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  syncColors(state) {
    for (const [key, color] of state.colorMap()) {
      this.stickerMeshes.get(key).material = this.materials[color];
    }
  }

  /** Rotate the given layers by `angle` radians about +axis (live, not committed). */
  setTurn(axis, layers, angle) {
    const key = `${axis}|${layers}`;
    if (this.turnKey !== key) {
      this.clearTurn();
      this.turnKey = key;
      for (const c of this.cubies) {
        if (layers.includes(c.userData.home[axis])) this.pivot.attach(c);
      }
    }
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.rotation[['x', 'y', 'z'][axis]] = angle;
  }

  /** Put every cubie back at its home transform (colors are then re-synced). */
  clearTurn() {
    this.pivot.rotation.set(0, 0, 0);
    for (const c of this.cubies) {
      if (c.parent !== this.root) this.root.attach(c);
      const [x, y, z] = c.userData.home;
      c.position.set(x * SPACING, y * SPACING, z * SPACING);
      c.rotation.set(0, 0, 0);
    }
    this.turnKey = null;
  }

  orbit(dx, dy) {
    this.azimuth -= dx * 0.008;
    this.elevation = Math.max(-1.45, Math.min(1.45, this.elevation + dy * 0.008));
    this.updateCamera();
  }

  updateCamera() {
    const d = this.distance;
    const ce = Math.cos(this.elevation);
    this.camera.position.set(d * ce * Math.sin(this.azimuth), d * Math.sin(this.elevation), d * ce * Math.cos(this.azimuth));
    this.camera.lookAt(0, 0, 0);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // keep the cube (bounding radius ~2.7) framed whatever the aspect ratio
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfMin = Math.min(halfV, Math.atan(Math.tan(halfV) * this.camera.aspect));
    this.distance = 2.9 / Math.sin(halfMin);
    // tight depth range around the cube, otherwise stickers z-fight with the cubie faces
    this.camera.near = this.distance - 3.5;
    this.camera.far = this.distance + 3.5;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---- picking helpers for drag input ----

  ndc(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** Returns { home, normal, point } for the cube face under the pointer, or null. */
  pick(clientX, clientY) {
    // Intersect the cube's bounding box rather than the cubie meshes, so the
    // gaps between cubies are grabbable too.
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const h = 1.5 * SPACING;
    const point = this.raycaster.ray.intersectBox(this.bounds || (this.bounds = new THREE.Box3(new THREE.Vector3(-h, -h, -h), new THREE.Vector3(h, h, h))), new THREE.Vector3());
    if (!point) return null;
    const p = point.toArray();
    const abs = p.map(Math.abs);
    const axis = abs.indexOf(Math.max(...abs));
    const normal = [0, 0, 0];
    normal[axis] = Math.sign(p[axis]);
    const home = p.map((v, i) => (i === axis ? normal[axis] : Math.max(-1, Math.min(1, Math.round(v / SPACING)))));
    return { home, normal, point };
  }

  /** Screen-space (CSS px) direction of moving `point` by `dir` world units. */
  screenDirection(point, dir) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const a = point.clone().project(this.camera);
    const b = point.clone().add(dir).project(this.camera);
    return new THREE.Vector2(((b.x - a.x) * rect.width) / 2, (-(b.y - a.y) * rect.height) / 2);
  }
}
