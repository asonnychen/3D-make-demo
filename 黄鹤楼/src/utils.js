import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 几何体批处理器：把大量静态小构件合并成一个 Mesh，减少 draw call。
 * 所有构件共享同一材质；不同材质用不同 Batch。
 */
export class GeoBatch {
  constructor(material) {
    this.material = material;
    this.geos = [];
  }

  /** 直接放入一个已经变换好的几何体 */
  add(geo) {
    this.geos.push(geo);
    return this;
  }

  /** 轴对齐长方体，可选绕 Y / Z 旋转 */
  box(w, h, d, x, y, z, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.geos.push(g);
    return this;
  }

  /** 圆柱 / 圆台 */
  cyl(rTop, rBottom, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    this.geos.push(g);
    return this;
  }

  /** 球体 */
  sphere(r, seg, x, y, z, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.floor(seg * 0.6)));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    this.geos.push(g);
    return this;
  }

  /** 合并并挂到父节点，返回生成的 Mesh */
  build(parent, { cast = true, receive = true, name = '' } = {}) {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    this.dispose();
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
  }
}

/** 加入一个轴对齐碰撞盒（y 为竖直范围） */
export function pushCollider(list, cx, cz, w, d, y0, y1) {
  list.push({
    x0: cx - w / 2,
    x1: cx + w / 2,
    z0: cz - d / 2,
    z1: cz + d / 2,
    y0,
    y1,
  });
}

/**
 * 把「带洞的矩形」拆成最多 4 块矩形
 * 返回 [{x0,x1,z0,z1}]
 */
export function rectsAroundHole(x0, x1, z0, z1, hole) {
  if (!hole) return [{ x0, x1, z0, z1 }];
  const hx0 = Math.max(x0, hole.x0);
  const hx1 = Math.min(x1, hole.x1);
  const hz0 = Math.max(z0, hole.z0);
  const hz1 = Math.min(z1, hole.z1);
  if (hx0 >= hx1 || hz0 >= hz1) return [{ x0, x1, z0, z1 }];

  const out = [];
  if (hz0 > z0) out.push({ x0, x1, z0, z1: hz0 });
  if (hz1 < z1) out.push({ x0, x1, z0: hz1, z1 });
  if (hx0 > x0) out.push({ x0, x1: hx0, z0: hz0, z1: hz1 });
  if (hx1 < x1) out.push({ x0: hx1, x1, z0: hz0, z1: hz1 });
  return out;
}

/** 区间随机数 */
export function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** 从数组中随机取一个 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 角度插值（取最短路径） */
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** 线段与矩形是否相交（用于 NPC 绕开楼梯洞口） */
export function segmentHitsRect(ax, az, bx, bz, r) {
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
  }
  return false;
}

/** 递归释放对象上的几何体、材质与贴图 */
export function disposeObject3D(root) {
  const materials = new Set();
  const textures = new Set();
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      materials.add(m);
      for (const key of ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap']) {
        if (m[key]) textures.add(m[key]);
      }
    }
  });
  for (const t of textures) t.dispose();
  for (const m of materials) m.dispose();
}
