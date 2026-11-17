import * as THREE from 'three';
import { FLOOR_Y, INNER_HALF, OUTER_HALF, stairSpec, stairHole } from './config.js';
import { rand, pick, lerpAngle, segmentHitsRect } from './utils.js';

/** NPC 随机配色 */
const PALETTES = [
  { shirt: 0x2f6f9e, pants: 0x2b3140, skin: 0xe8b48f, hair: 0x241c18 },
  { shirt: 0xc05a3a, pants: 0x3a3f4a, skin: 0xf0c39d, hair: 0x3a2a20 },
  { shirt: 0x4f8a5b, pants: 0x4a4238, skin: 0xe3ac82, hair: 0x1e1a16 },
  { shirt: 0xd9b23f, pants: 0x2f3a4a, skin: 0xf2c9a4, hair: 0x4a3524 },
  { shirt: 0x8a5aa8, pants: 0x33313c, skin: 0xe0aa86, hair: 0x2b211b },
  { shirt: 0x3d8f8a, pants: 0x3b3b42, skin: 0xeec0a0, hair: 0x241f1a },
];

const waypointCache = new Map();

/** 各层随机漫步点（大厅 + 回廊，避开楼梯洞口） */
function getWaypoints(level) {
  if (waypointCache.has(level)) return waypointCache.get(level);
  const H = INNER_HALF[level];
  const O = OUTER_HALF[level];
  const hole = stairHole(level);
  const pts = [];
  const margin = 0.7;

  const add = (x, z) => {
    if (
      hole &&
      x > hole.x0 - margin &&
      x < hole.x1 + margin &&
      z > hole.z0 - margin &&
      z < hole.z1 + margin
    ) {
      return;
    }
    pts.push({ x, z, y: FLOOR_Y[level] });
  };

  const a = H - 1.7;
  add(0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sx * a, sz * a);
  add(0, a);
  add(0, -a);
  add(a, 0);
  add(-a, 0);

  // 一层是封闭大厅，只在室内漫步；其余楼层可去外回廊
  if (level > 0) {
    const rr = O - 1.05;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sx * rr, sz * rr);
    add(0, rr);
    add(0, -rr);
    add(rr, 0);
    add(-rr, 0);
  }

  waypointCache.set(level, pts);
  return pts;
}

function expandRect(r, m) {
  return { x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m };
}

/** 单层楼梯路线 */
function stairRoute(level, dir) {
  const i = dir > 0 ? level : level - 1;
  const s = stairSpec(i);
  const zAc = s.zA + s.laneW / 2;
  const zBc = s.zB + s.laneW / 2;
  const landing = s.y0 + s.halfRise;
  const up = [
    { x: s.xStart + 0.6, z: zAc, y: s.y0 },
    { x: s.xL0, z: zAc, y: landing },
    { x: s.xEnd - 0.55, z: (s.zA + s.zB + s.laneW) / 2, y: landing },
    { x: s.xL0, z: zBc, y: landing },
    { x: s.xStart - 1.0, z: zBc, y: s.y1 },
  ];
  return dir > 0 ? up : up.slice().reverse();
}

class NPC {
  constructor(scene, world, level) {
    this.scene = scene;
    this.world = world;
    this.level = level;
    this.targetLevel = level;
    this.route = [];
    this.idle = rand(0.5, 3.5);
    this.speed = rand(0.8, 1.3);
    this.phase = Math.random() * 10;
    this.yaw = rand(0, Math.PI * 2);
    this.walking = false;
    this.pos = new THREE.Vector3();

    const palette = pick(PALETTES);
    this.mesh = this.build(palette);
    scene.add(this.mesh);

    const p = pick(getWaypoints(level));
    this.pos.set(p.x, p.y, p.z);
    this.mesh.position.copy(this.pos);
  }

  build(palette) {
    const group = new THREE.Group();
    this.materials = [
      new THREE.MeshStandardMaterial({ color: palette.shirt, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: palette.pants, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.9 }),
    ];
    const [shirtMat, pantsMat, skinMat, hairMat] = this.materials;
    this.geometries = [];

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      this.geometries.push(geo);
      return m;
    };

    // 躯干
    add(new THREE.BoxGeometry(0.44, 0.62, 0.27), shirtMat, 0, 1.06, 0);
    // 头
    add(new THREE.BoxGeometry(0.27, 0.28, 0.27), skinMat, 0, 1.53, 0);
    // 头发
    add(new THREE.BoxGeometry(0.29, 0.09, 0.29), hairMat, 0, 1.69, 0);
    // 鼻尖（朝向 +z）
    add(new THREE.BoxGeometry(0.06, 0.06, 0.05), skinMat, 0, 1.52, 0.15);

    // 腿（几何体下移，使旋转轴在髋部）
    const legGeo = new THREE.BoxGeometry(0.15, 0.72, 0.17);
    legGeo.translate(0, -0.36, 0);
    this.leftLeg = add(legGeo, pantsMat, -0.11, 0.74, 0);
    const legGeo2 = new THREE.BoxGeometry(0.15, 0.72, 0.17);
    legGeo2.translate(0, -0.36, 0);
    this.rightLeg = add(legGeo2, pantsMat, 0.11, 0.74, 0);

    // 手臂
    const armGeo = new THREE.BoxGeometry(0.11, 0.52, 0.13);
    armGeo.translate(0, -0.26, 0);
    this.leftArm = add(armGeo, shirtMat, -0.28, 1.3, 0);
    const armGeo2 = new THREE.BoxGeometry(0.11, 0.52, 0.13);
    armGeo2.translate(0, -0.26, 0);
    this.rightArm = add(armGeo2, shirtMat, 0.28, 1.3, 0);

    // 手
    add(new THREE.BoxGeometry(0.1, 0.1, 0.11), skinMat, -0.28, 1.02, 0);
    add(new THREE.BoxGeometry(0.1, 0.1, 0.11), skinMat, 0.28, 1.02, 0);

    return group;
  }

  chooseTarget() {
    const hole = stairHole(this.level);

    // 有一定概率上下楼
    if (Math.random() < 0.24) {
      const dirs = [];
      if (this.level < 4) dirs.push(1);
      if (this.level > 0) dirs.push(-1);
      const dir = pick(dirs);
      const route = stairRoute(this.level, dir);
      const first = route[0];
      const blocked =
        hole && segmentHitsRect(this.pos.x, this.pos.z, first.x, first.z, expandRect(hole, 0.35));

      if (!blocked) {
        const targetLevel = this.level + dir;
        const tHole = stairHole(targetLevel);
        const exit = route[route.length - 1];
        const candidates = getWaypoints(targetLevel).filter(
          (p) =>
            !tHole ||
            !segmentHitsRect(exit.x, exit.z, p.x, p.z, expandRect(tHole, 0.35))
        );
        if (candidates.length) {
          this.targetLevel = targetLevel;
          this.route = route.concat([pick(candidates)]);
          return;
        }
      }
    }

    // 同层漫步
    const wps = getWaypoints(this.level);
    for (let tries = 0; tries < 14; tries++) {
      const p = pick(wps);
      if (!hole || !segmentHitsRect(this.pos.x, this.pos.z, p.x, p.z, expandRect(hole, 0.4))) {
        this.targetLevel = this.level;
        this.route = [p];
        return;
      }
    }
    this.idle = rand(1, 2.5);
  }

  respawn() {
    const p = pick(getWaypoints(this.level));
    this.pos.set(p.x, p.y, p.z);
    this.route.length = 0;
    this.targetLevel = this.level;
    this.idle = rand(1, 3);
  }

  update(dt, time) {
    if (this.route.length) {
      const t = this.route[0];
      const dx = t.x - this.pos.x;
      const dz = t.z - this.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.16) {
        this.route.shift();
        if (!this.route.length) {
          this.level = this.targetLevel;
          this.idle = rand(1.2, 4.5);
        }
      } else {
        const step = Math.min(dist, this.speed * dt);
        this.pos.x += (dx / dist) * step;
        this.pos.z += (dz / dist) * step;
        this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 7));
      }

      const s = this.world.getSupportY(this.pos.x, this.pos.z, this.pos.y + 0.8);
      this.pos.y += (s - this.pos.y) * Math.min(1, dt * 9);
      this.walking = true;
    } else {
      this.walking = false;
      this.idle -= dt;
      // 「看风景」：缓慢转头
      this.yaw += Math.sin(time * 0.55 + this.phase) * dt * 0.45;
      if (this.idle <= 0) this.chooseTarget();
    }

    if (this.pos.y < FLOOR_Y[this.level] - 2.5) this.respawn();

    this.mesh.position.set(
      this.pos.x,
      this.pos.y + (this.walking ? Math.abs(Math.sin(time * 9 + this.phase)) * 0.035 : 0),
      this.pos.z
    );
    this.mesh.rotation.y = this.yaw;

    const sw = this.walking ? Math.sin(time * 9 + this.phase) * 0.55 : 0;
    this.leftLeg.rotation.x = sw;
    this.rightLeg.rotation.x = -sw;
    this.leftArm.rotation.x = -sw * 0.8;
    this.rightArm.rotation.x = sw * 0.8;
  }

  dispose() {
    this.scene.remove(this.mesh);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

/** 5 位游客，分别在各层漫步 */
export class NPCManager {
  constructor(scene, world) {
    this.npcs = [];
    for (let i = 0; i < 5; i++) {
      this.npcs.push(new NPC(scene, world, i));
    }
  }

  update(dt, time) {
    for (const npc of this.npcs) npc.update(dt, time);
  }

  dispose() {
    for (const npc of this.npcs) npc.dispose();
    this.npcs.length = 0;
  }
}
