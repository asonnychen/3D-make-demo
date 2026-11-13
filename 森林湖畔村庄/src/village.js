/* ============================================================
   村庄：法式环湖民居、教堂、广场喷泉、码头、凉亭与道路网
   ============================================================ */

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CHAPEL, COLORS, HOUSES, ROAD_SPOKES, SQUARE, TAU, WORLD, deg } from './config.js'
import { groundHeight } from './terrain.js'
import { getTextures } from './textures.js'

/* ------------------------------------------------------------ 材质与合并工具 */

const matCache = new Map()
export function mat(color, opts = {}) {
  const key = [
    color,
    opts.roughness ?? '',
    opts.metalness ?? '',
    opts.map?.uuid ?? '',
    opts.emissive ?? '',
    opts.emissiveIntensity ?? '',
    opts.transparent ?? '',
    opts.opacity ?? '',
    opts.side ?? '',
  ].join('-')
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...opts })
    )
  }
  return matCache.get(key)
}

const M_STONE = mat(COLORS.stone, { roughness: 0.98 })
const M_STONE_DARK = mat(COLORS.stoneDark, { roughness: 0.98 })
const M_WOOD = mat(COLORS.wood, { roughness: 0.95 })
const M_WOOD_DARK = mat(COLORS.woodDark, { roughness: 0.95 })
const M_IRON = mat(COLORS.iron, { roughness: 0.6, metalness: 0.5 })
const M_GLASS = mat(COLORS.glass, { roughness: 0.18, metalness: 0.35 })
const M_TRIM = mat(0xf6efe0, { roughness: 0.9 })
const M_LEAF = mat(0x4e6d3e, { roughness: 1 })
const M_LEAF_LIGHT = mat(0x68894d, { roughness: 1 })

const _dummy = new THREE.Object3D()
export function M(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _dummy.position.set(x, y, z)
  _dummy.rotation.set(rx, ry, rz)
  _dummy.scale.set(sx, sy, sz)
  _dummy.updateMatrix()
  return _dummy.matrix.clone()
}

export class Builder {
  constructor() {
    this.batches = new Map()
  }

  add(geo, material, matrix) {
    // ShapeGeometry 等可能是无索引几何，统一转成无索引再合并
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (matrix) g.applyMatrix4(matrix)
    let b = this.batches.get(material.uuid)
    if (!b) {
      b = { material, geos: [] }
      this.batches.set(material.uuid, b)
    }
    b.geos.push(g)
  }

  box(material, sx, sy, sz, m) {
    this.add(new THREE.BoxGeometry(sx, sy, sz), material, m)
  }

  cyl(material, rt, rb, h, seg, m) {
    this.add(new THREE.CylinderGeometry(rt, rb, h, seg), material, m)
  }

  build(parent, { cast = true, receive = true } = {}) {
    for (const { material, geos } of this.batches.values()) {
      const merged = mergeGeometries(geos, false)
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, material)
      mesh.castShadow = cast
      mesh.receiveShadow = receive
      parent.add(mesh)
      for (const g of geos) g.dispose()
    }
    this.batches.clear()
  }
}

/* ------------------------------------------------------------ 屋顶 */

function gableRoof(b, roofMat, wallMat, w, d, rise, ov, baseY) {
  const halfD = d / 2 + ov
  const angle = Math.atan2(rise, halfD)
  const L = Math.hypot(halfD, rise)

  b.box(roofMat, w + ov * 2, 0.18, L, M(0, baseY + rise / 2, -halfD / 2, 0, -angle))
  b.box(roofMat, w + ov * 2, 0.18, L, M(0, baseY + rise / 2, halfD / 2, 0, angle))

  // 山墙三角
  const tri = new THREE.Shape()
  tri.moveTo(-d / 2, 0)
  tri.lineTo(d / 2, 0)
  tri.lineTo(0, rise)
  tri.closePath()
  const triGeo = new THREE.ShapeGeometry(tri)
  b.add(triGeo, wallMat, M(w / 2, baseY, 0, Math.PI / 2))
  b.add(triGeo, wallMat, M(-w / 2, baseY, 0, -Math.PI / 2))

  // 屋脊
  b.cyl(roofMat, 0.14, 0.14, w + ov * 2, 8, M(0, baseY + rise + 0.02, 0, 0, 0, Math.PI / 2))
  // 檐口
  b.box(roofMat, w + ov * 2 + 0.1, 0.14, 0.16, M(0, baseY - 0.02, halfD))
  b.box(roofMat, w + ov * 2 + 0.1, 0.14, 0.16, M(0, baseY - 0.02, -halfD))

  return { rise, halfD }
}

/* ------------------------------------------------------------ 窗户 */

function addWindow(b, W, shutterMat, flowers = false, scale = 1) {
  const T = (lx, ly, lz, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    W.clone().multiply(M(lx, ly, lz, ry, rx, rz, sx * scale, sy * scale, sz * scale))

  b.box(M_GLASS, 0.92, 1.28, 0.05, T(0, 0, 0.02))
  b.box(M_TRIM, 0.1, 1.42, 0.14, T(-0.51, 0, 0.05))
  b.box(M_TRIM, 0.1, 1.42, 0.14, T(0.51, 0, 0.05))
  b.box(M_TRIM, 1.12, 0.1, 0.14, T(0, 0.7, 0.05))
  b.box(M_TRIM, 1.12, 0.1, 0.14, T(0, -0.7, 0.05))
  b.box(M_TRIM, 0.05, 1.28, 0.09, T(0, 0, 0.06))
  b.box(M_TRIM, 0.92, 0.05, 0.09, T(0, 0.12, 0.06))
  b.box(M_STONE, 1.34, 0.1, 0.28, T(0, -0.76, 0.08))

  // 百叶窗
  b.box(shutterMat, 0.44, 1.42, 0.06, T(-0.8, 0, 0.11, 0.42))
  b.box(shutterMat, 0.44, 1.42, 0.06, T(0.8, 0, 0.11, -0.42))
  b.box(mat(0x5d6a5c, { roughness: 1 }), 0.03, 1.2, 0.02, T(-0.86, 0, 0.16, 0.42))
  b.box(mat(0x5d6a5c, { roughness: 1 }), 0.03, 1.2, 0.02, T(0.86, 0, 0.16, -0.42))

  if (flowers) {
    b.box(M_WOOD_DARK, 1.1, 0.2, 0.24, T(0, -0.86, 0.16))
    const colors = [COLORS.flowerRose, COLORS.flowerPoppy, COLORS.flowerDaisy, COLORS.flowerLavender]
    for (let i = 0; i < 5; i++) {
      const c = colors[i % colors.length]
      b.add(new THREE.IcosahedronGeometry(0.09, 0), mat(c, { roughness: 0.8 }), T(-0.42 + i * 0.21, -0.72, 0.17))
      b.add(new THREE.IcosahedronGeometry(0.08, 0), M_LEAF, T(-0.42 + i * 0.21, -0.78, 0.22))
    }
  }
}

/* ------------------------------------------------------------ 房屋 */

function createHouse(spec, scene) {
  const a = spec.angle
  const cx = Math.sin(a) * spec.radius
  const cz = Math.cos(a) * spec.radius
  const baseY = groundHeight(cx, cz)

  const group = new THREE.Group()
  group.position.set(cx, baseY, cz)
  group.rotation.y = a + Math.PI

  const b = new Builder()
  const wallMat = mat(spec.wall, { roughness: 0.95 })
  const roofMat = mat(spec.roof, { roughness: 0.9 })
  const shutterMat = mat(spec.shutter, { roughness: 0.9 })

  const w = spec.w
  const d = spec.d
  const h = spec.h
  const wallBottom = 0.65
  const wallTop = wallBottom + h

  // 石基与墙体
  b.box(M_STONE_DARK, w + 0.5, 1.1, d + 0.5, M(0, 0.1, 0))
  b.box(wallMat, w, h, d, M(0, wallBottom + h / 2, 0))
  b.box(M_TRIM, w + 0.12, 0.18, d + 0.12, M(0, wallBottom + h * 0.5, 0))
  b.box(M_TRIM, w + 0.16, 0.22, d + 0.16, M(0, wallTop - 0.05, 0))
  // 转角石
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(M_STONE, 0.34, h, 0.34, M((sx * w) / 2, wallBottom + h / 2, (sz * d) / 2))
    }
  }

  const { rise } = gableRoof(b, roofMat, wallMat, w, d, Math.max(2.2, h * 0.5), 0.55, wallTop)

  // 烟囱
  b.box(M_STONE, 0.82, 1.9, 0.82, M(-w * 0.27, wallTop + rise + 0.55, -0.5))
  b.box(M_STONE_DARK, 1.0, 0.16, 1.0, M(-w * 0.27, wallTop + rise + 1.52, -0.5))

  // 老虎窗
  for (let i = 0; i < spec.dormers; i++) {
    const dx = (i === 0 ? -1 : 1) * w * 0.23
    const dz = d * 0.2
    const dy = wallTop + rise * 0.48
    b.box(wallMat, 1.45, 1.15, 1.3, M(dx, dy, dz))
    b.box(roofMat, 1.75, 0.12, 0.95, M(dx, dy + 0.62, dz + 0.02, 0, 0.42))
    b.box(roofMat, 1.75, 0.12, 0.95, M(dx, dy + 0.62, dz + 0.02, 0, -0.42))
    b.box(M_GLASS, 0.66, 0.72, 0.05, M(dx, dy + 0.05, dz + 0.66))
    b.box(M_TRIM, 0.78, 0.08, 0.1, M(dx, dy + 0.44, dz + 0.66))
  }

  // 正门
  const doorY = wallBottom + 1.18
  b.box(M_TRIM, 1.62, 2.6, 0.22, M(0, doorY + 0.08, d / 2 + 0.04))
  b.box(M_WOOD_DARK, 1.16, 2.28, 0.14, M(0, doorY, d / 2 + 0.13))
  b.box(mat(0x6e4f34, { roughness: 0.9 }), 0.06, 2.05, 0.05, M(0, doorY, d / 2 + 0.21))
  b.box(M_IRON, 0.07, 0.07, 0.12, M(0.38, doorY - 0.05, d / 2 + 0.22))
  b.box(M_STONE, 1.9, 0.2, 0.95, M(0, wallBottom - 0.05, d / 2 + 0.55))
  b.box(M_STONE, 1.7, 0.18, 0.75, M(0, wallBottom - 0.22, d / 2 + 0.95))
  // 门廊小雨棚
  b.box(roofMat, 2.1, 0.1, 0.85, M(0, doorY + 1.52, d / 2 + 0.42, 0, -0.28))
  b.box(M_WOOD_DARK, 0.1, 0.1, 0.75, M(-0.9, doorY + 1.36, d / 2 + 0.4, 0, 0.4))
  b.box(M_WOOD_DARK, 0.1, 0.1, 0.75, M(0.9, doorY + 1.36, d / 2 + 0.4, 0, 0.4))

  // 窗
  const rows = [wallBottom + h * 0.3, wallBottom + h * 0.72]
  for (let r = 0; r < 2; r++) {
    const y = rows[r]
    for (const sx of [-1, 1]) {
      addWindow(b, M(sx * w * 0.26, y, d / 2 + 0.02), shutterMat, true)
      addWindow(b, M(sx * w * 0.26, y, -d / 2 - 0.02, Math.PI), shutterMat, false)
    }
    for (const sz of [-1, 1]) {
      addWindow(b, M(w / 2 + 0.02, y, sz * d * 0.22, Math.PI / 2), shutterMat, false)
      addWindow(b, M(-w / 2 - 0.02, y, sz * d * 0.22, -Math.PI / 2), shutterMat, false)
    }
  }

  // 门牌与爬藤
  b.box(M_WOOD_DARK, 0.6, 0.26, 0.06, M(0.95, doorY + 0.9, d / 2 + 0.1))
  for (let i = 0; i < 5; i++) {
    b.add(
      new THREE.IcosahedronGeometry(0.32 + Math.random() * 0.2, 0),
      i % 2 ? M_LEAF : M_LEAF_LIGHT,
      M(-w / 2 + 0.25, wallBottom + 0.5 + i * 0.5, d / 2 - 0.1 + Math.sin(i) * 0.2, 0, 0, 0, 1, 1.2, 0.6)
    )
  }

  // 前院：小径、矮墙、绣球与灯
  b.box(mat(0xcabf9f, { roughness: 1 }), 1.35, 0.06, 2.6, M(0, 0.02, d / 2 + 1.6))
  const wallZ = d / 2 + 2.9
  const gateHalf = 1.15
  const wallWidth = w * 0.5 - gateHalf
  const wallCenter = gateHalf + wallWidth / 2
  b.box(M_STONE, wallWidth, 0.62, 0.42, M(-wallCenter, 0.3, wallZ))
  b.box(M_STONE, wallWidth, 0.62, 0.42, M(wallCenter, 0.3, wallZ))
  b.box(M_STONE, 0.42, 0.8, 0.42, M(-gateHalf, 0.4, wallZ))
  b.box(M_STONE, 0.42, 0.8, 0.42, M(gateHalf, 0.4, wallZ))
  for (const sx of [-1, 1]) {
    b.add(new THREE.IcosahedronGeometry(0.62, 0), M_LEAF, M(sx * (w * 0.32), 0.75, wallZ - 0.45, 0, 0, 0, 1.3, 0.9, 1))
    b.add(new THREE.IcosahedronGeometry(0.5, 0), M_LEAF_LIGHT, M(sx * (w * 0.32) + 0.35, 0.6, wallZ - 0.5))
  }
  // 门口灯
  b.box(M_IRON, 0.07, 2.2, 0.07, M(1.25, 1.15, d / 2 + 0.75))
  b.box(mat(0xffd9a0, { emissive: 0xffb45e, emissiveIntensity: 0.7, roughness: 0.5 }), 0.26, 0.34, 0.26, M(1.25, 2.32, d / 2 + 0.75))
  b.box(M_IRON, 0.34, 0.06, 0.34, M(1.25, 2.52, d / 2 + 0.75))

  b.build(group)
  scene.add(group)

  // 碰撞体：房屋主体、前院矮墙（留出中间院门）、绣球与门灯
  const th = a + Math.PI
  const cth = Math.cos(th)
  const sth = Math.sin(th)
  const l2w = (lx, lz) => ({
    x: cx + lx * cth + lz * sth,
    z: cz - lx * sth + lz * cth,
  })
  const boxes = [
    { x: cx, z: cz, hw: w / 2 + 0.35, hd: d / 2 + 0.35, ry: th },
  ]
  for (const sign of [-1, 1]) {
    const p = l2w(sign * wallCenter, wallZ)
    boxes.push({ x: p.x, z: p.z, hw: wallWidth / 2 + 0.05, hd: 0.34, ry: th })
  }
  const circles = [
    { ...l2w(-gateHalf, wallZ), r: 0.32 },
    { ...l2w(gateHalf, wallZ), r: 0.32 },
    { ...l2w(-w * 0.32, wallZ - 0.45), r: 0.92 },
    { ...l2w(w * 0.32, wallZ - 0.45), r: 0.92 },
    { ...l2w(1.25, d / 2 + 0.75), r: 0.22 },
  ]

  return {
    group,
    center: [cx, cz],
    name: spec.name,
    boxes,
    circles,
  }
}

/* ------------------------------------------------------------ 教堂 */

function createChapel(scene) {
  const a = CHAPEL.angle
  const cx = Math.sin(a) * CHAPEL.radius
  const cz = Math.cos(a) * CHAPEL.radius
  const baseY = groundHeight(cx, cz)

  const group = new THREE.Group()
  group.position.set(cx, baseY, cz)
  group.rotation.y = a + Math.PI

  const b = new Builder()
  const wallMat = mat(0xf0e8d6, { roughness: 0.95 })
  const roofMat = mat(0x8c4f3f, { roughness: 0.92 })
  const w = CHAPEL.w
  const d = CHAPEL.d
  const h = CHAPEL.h
  const wallBottom = 0.7
  const wallTop = wallBottom + h

  b.box(M_STONE_DARK, w + 0.8, 1.0, d + 0.8, M(0, 0.15, 0))
  b.box(wallMat, w, h, d, M(0, wallBottom + h / 2, 0))
  const { rise } = gableRoof(b, roofMat, wallMat, w, d, 4.2, 0.5, wallTop)

  // 拱窗
  function archGeo(aw, ah) {
    const s = new THREE.Shape()
    s.moveTo(-aw / 2, 0)
    s.lineTo(-aw / 2, ah - aw / 2)
    s.absarc(0, ah - aw / 2, aw / 2, Math.PI, 0, true)
    s.lineTo(aw / 2, 0)
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }
  const winGeo = archGeo(1.0, 2.2)
  for (const sz of [-3.4, 0, 3.4]) {
    for (const sx of [-1, 1]) {
      b.add(winGeo, M_GLASS, M((sx * w) / 2 + sx * 0.03, wallBottom + 2.4, sz, (sx * Math.PI) / 2))
      b.add(winGeo, mat(0xd8cdb6, { roughness: 0.9 }), M((sx * w) / 2 + sx * 0.015, wallBottom + 2.35, sz, (sx * Math.PI) / 2, 0, 0, 1.16, 1.1, 1))
    }
  }

  // 钟楼
  const tw = 3.0
  const th = 10.5
  const tz = d / 2 - 0.6
  b.box(wallMat, tw, th, tw, M(0, wallBottom + th / 2, tz))
  b.box(M_STONE, tw + 0.3, 0.35, tw + 0.3, M(0, wallBottom + 2.6, tz))
  b.box(M_STONE, tw + 0.3, 0.35, tw + 0.3, M(0, wallBottom + th - 0.2, tz))
  // 钟楼拱门与圆窗
  const doorGeo = archGeo(1.5, 2.9)
  b.add(doorGeo, mat(0x3a2f26, { roughness: 1 }), M(0, wallBottom, tz + tw / 2 + 0.03))
  b.add(archGeo(1.9, 3.2), mat(0xded2bb, { roughness: 0.9 }), M(0, wallBottom - 0.02, tz + tw / 2 + 0.015, 0, 0, 0, 1.08, 1.05, 1))
  b.cyl(M_GLASS, 1.0, 1.0, 0.06, 20, M(0, wallBottom + 5.6, tz + tw / 2 + 0.04, 0, Math.PI / 2))
  b.add(new THREE.TorusGeometry(1.05, 0.09, 8, 24), M_STONE, M(0, wallBottom + 5.6, tz + tw / 2 + 0.06))
  for (let i = 0; i < 8; i++) {
    b.box(M_STONE, 0.06, 1.9, 0.06, M(0, wallBottom + 5.6, tz + tw / 2 + 0.07, 0, 0, (i / 8) * Math.PI))
  }

  // 尖顶与十字架
  b.add(new THREE.ConeGeometry(tw * 0.72, 4.6, 4), roofMat, M(0, wallBottom + th + 2.3, tz, Math.PI / 4))
  b.cyl(M_IRON, 0.05, 0.05, 1.3, 6, M(0, wallBottom + th + 5.1, tz))
  b.box(M_IRON, 0.7, 0.09, 0.09, M(0, wallBottom + th + 5.35, tz))
  b.box(M_IRON, 0.09, 0.7, 0.09, M(0, wallBottom + th + 5.45, tz))

  b.build(group)
  scene.add(group)
  return {
    group,
    center: [cx, cz],
    boxes: [{ x: cx, z: cz, hw: CHAPEL.w / 2 + 0.4, hd: CHAPEL.d / 2 + 1.15, ry: a + Math.PI }],
    circles: [],
  }
}

/* ------------------------------------------------------------ 道路 */

function stripGeometry(points, width, yOff, closed, baseColor) {
  const pos = []
  const col = []
  const uv = []
  const idx = []
  const n = points.length
  const c = new THREE.Color(baseColor)
  let dist = 0

  for (let i = 0; i < n; i++) {
    const p = points[i]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    let tx = next.x - prev.x
    let tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    tx /= len
    tz /= len
    const nx = -tz
    const nz = tx
    const hw = width / 2
    const y = groundHeight(p.x, p.z) + yOff
    pos.push(p.x + nx * hw, y, p.z + nz * hw)
    pos.push(p.x - nx * hw, y, p.z - nz * hw)

    if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z)
    const shade = 0.9 + Math.random() * 0.18
    for (let k = 0; k < 2; k++) {
      col.push(c.r * shade, c.g * shade, c.b * shade)
    }
    uv.push(dist / 2.6, 0, dist / 2.6, 1)
  }

  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    const b = ((i + 1) % n) * 2
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()

  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    map: getTextures().rubble,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new THREE.Mesh(geo, m)
  mesh.receiveShadow = true
  return mesh
}

function linePoints(a, b, segments) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t))
  }
  return pts
}

function addRoads(scene) {
  const group = new THREE.Group()
  group.name = 'roads'

  // 环湖路
  const ringPts = []
  const N = 120
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU
    ringPts.push(new THREE.Vector3(Math.sin(a) * WORLD.ringRadius, 0, Math.cos(a) * WORLD.ringRadius))
  }
  group.add(stripGeometry(ringPts, 3.4, 0.06, true, 0xb7a684))

  // 支路
  for (const s of ROAD_SPOKES) {
    const a = s.angle
    const inner = new THREE.Vector3(Math.sin(a) * s.inner, 0, Math.cos(a) * s.inner)
    const outer = new THREE.Vector3(Math.sin(a) * s.outer, 0, Math.cos(a) * s.outer)
    group.add(stripGeometry(linePoints(inner, outer, 12), s.width, 0.062, false, 0xb5a381))
  }

  // 各家门前的车道
  for (const h of HOUSES) {
    const a = h.angle
    const r0 = WORLD.ringRadius
    const r1 = h.radius - h.d / 2 - 0.4
    const p0 = new THREE.Vector3(Math.sin(a) * r0, 0, Math.cos(a) * r0)
    const p1 = new THREE.Vector3(Math.sin(a) * r1, 0, Math.cos(a) * r1)
    group.add(stripGeometry(linePoints(p0, p1, 6), 2.4, 0.064, false, 0xb9a785))
  }

  // 广场到教堂
  const chapelFront = new THREE.Vector3(
    Math.sin(CHAPEL.angle) * (CHAPEL.radius - CHAPEL.d / 2 - 0.4),
    0,
    Math.cos(CHAPEL.angle) * (CHAPEL.radius - CHAPEL.d / 2 - 0.4)
  )
  group.add(
    stripGeometry(
      linePoints(new THREE.Vector3(3.2, 0, 44), chapelFront, 10),
      2.8,
      0.065,
      false,
      0xb9a785
    )
  )

  // 环湖路到码头入口
  group.add(
    stripGeometry(
      linePoints(new THREE.Vector3(-31.8, 0, 0), new THREE.Vector3(-30.0, 0, 3.3), 6),
      2.6,
      0.063,
      false,
      0xb7a684
    )
  )

  // 林间步道：从主路继续蜿蜒进森林
  const trail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(48, 0, -46),
    new THREE.Vector3(56, 0, -54),
    new THREE.Vector3(62, 0, -66),
    new THREE.Vector3(74, 0, -74),
  ])
  group.add(stripGeometry(trail.getSpacedPoints(36), 1.9, 0.06, false, 0xa99a7d))

  scene.add(group)
  return group
}

/* ------------------------------------------------------------ 广场与喷泉 */

function bench(b, x, z, ry) {
  const T = (lx, ly, lz, r = 0) => M(x, 0, z, ry).multiply(M(lx, ly, lz, r))
  for (let i = 0; i < 3; i++) b.box(M_WOOD, 1.8, 0.08, 0.16, T(0, 0.48, -0.22 + i * 0.2))
  for (let i = 0; i < 3; i++) b.box(M_WOOD, 1.8, 0.14, 0.07, T(0, 0.78 + i * 0.17, 0.34, 0.16))
  for (const sx of [-0.72, 0.72]) {
    b.box(M_IRON, 0.07, 0.5, 0.07, T(sx, 0.24, -0.28))
    b.box(M_IRON, 0.07, 0.5, 0.07, T(sx, 0.24, 0.3))
    b.box(M_IRON, 0.07, 0.75, 0.07, T(sx, 0.42, 0.34))
    b.box(M_IRON, 0.07, 0.07, 0.72, T(sx, 0.62, 0.02))
  }
}

function createSquare(scene) {
  const [sx, sz] = SQUARE.at
  const y = groundHeight(sx, sz)
  const group = new THREE.Group()
  group.name = 'square'

  // 铺地
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(SQUARE.radius, 64),
    mat(0xb0a897, { roughness: 1, map: getTextures().plaza })
  )
  plaza.rotation.x = -Math.PI / 2
  plaza.position.set(sx, y + 0.04, sz)
  plaza.receiveShadow = true
  group.add(plaza)

  const border = new THREE.Mesh(
    new THREE.RingGeometry(SQUARE.radius - 0.55, SQUARE.radius, 64),
    mat(0xa79b83, { roughness: 1 })
  )
  border.rotation.x = -Math.PI / 2
  border.position.set(sx, y + 0.05, sz)
  group.add(border)

  const b = new Builder()
  // 放射铺装线
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    b.box(
      mat(0xb2a58c, { roughness: 1 }),
      0.16,
      0.02,
      8.2,
      M(sx + Math.sin(a) * 4.4, y + 0.06, sz + Math.cos(a) * 4.4, a)
    )
  }

  // 喷泉：石砌水池（开口）+ 水面 + 上层水碗 + 弧形水柱
  const fy = y + 0.04
  b.cyl(M_STONE_DARK, 3.55, 3.7, 0.24, 28, M(sx, fy + 0.12, sz))
  b.add(new THREE.CylinderGeometry(3.05, 3.22, 0.9, 28, 1, true), M_STONE, M(sx, fy + 0.55, sz))
  b.add(new THREE.TorusGeometry(3.08, 0.17, 8, 32), M_STONE, M(sx, fy + 0.99, sz, 0, Math.PI / 2))
  b.cyl(M_STONE_DARK, 2.84, 2.84, 0.12, 24, M(sx, fy + 0.17, sz))
  // 中央柱与上层水碗
  b.cyl(M_STONE, 0.45, 0.6, 1.3, 12, M(sx, fy + 1.4, sz))
  b.cyl(M_STONE, 1.15, 1.3, 0.3, 20, M(sx, fy + 2.05, sz))
  b.cyl(M_STONE, 0.24, 0.32, 0.7, 10, M(sx, fy + 2.45, sz))
  b.add(new THREE.SphereGeometry(0.28, 12, 10), M_STONE, M(sx, fy + 2.88, sz))

  // 水面：程序化涟漪着色器
  const fountainTime = { value: 0 }
  const waterSurfaceMat = new THREE.ShaderMaterial({
    uniforms: { uTime: fountainTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float wave = sin(r * 46.0 - uTime * 3.2) * 0.5 + 0.5;
        float wave2 = sin(p.x * 28.0 + uTime * 1.7) * cos(p.y * 24.0 - uTime * 1.3) * 0.5 + 0.5;
        vec3 deep = vec3(0.055, 0.22, 0.25);
        vec3 shallow = vec3(0.3, 0.62, 0.6);
        vec3 col = mix(deep, shallow, wave * 0.2 + wave2 * 0.14 + 0.12);
        float edge = smoothstep(0.94, 0.78, r);
        col = mix(col, vec3(0.58, 0.82, 0.78), edge * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(2.8, 48), waterSurfaceMat)
  basinWater.rotation.x = -Math.PI / 2
  basinWater.position.set(sx, fy + 0.64, sz)
  group.add(basinWater)

  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), waterSurfaceMat)
  bowlWater.rotation.x = -Math.PI / 2
  bowlWater.position.set(sx, fy + 2.22, sz)
  group.add(bowlWater)

  // 弧形水柱
  const jetMat = new THREE.MeshStandardMaterial({
    color: 0xd6f3ec,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    metalness: 0.15,
    emissive: 0x9fd8d0,
    emissiveIntensity: 0.18,
    depthWrite: false,
  })
  const droplets = []
  const dropGeo = new THREE.SphereGeometry(0.035, 5, 4)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    const start = new THREE.Vector3(sx + Math.sin(a) * 1.08, fy + 2.18, sz + Math.cos(a) * 1.08)
    const mid = new THREE.Vector3(sx + Math.sin(a) * 1.75, fy + 2.85, sz + Math.cos(a) * 1.75)
    const end = new THREE.Vector3(sx + Math.sin(a) * 2.55, fy + 0.66, sz + Math.cos(a) * 2.55)
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.03, 5, false), jetMat)
    group.add(tube)
    for (let k = 0; k < 4; k++) {
      const drop = new THREE.Mesh(dropGeo, jetMat)
      group.add(drop)
      droplets.push({ curve, mesh: drop, phase: (k / 4 + i * 0.11) % 1 })
    }
  }

  const updateFountain = (elapsed) => {
    fountainTime.value = elapsed
    for (const d of droplets) {
      const t = (elapsed * 0.75 + d.phase) % 1
      d.curve.getPoint(t, d.mesh.position)
      d.mesh.scale.setScalar(0.7 + Math.sin(t * Math.PI) * 0.5)
    }
  }

  // 长椅
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4
    bench(b, sx + Math.sin(a) * 6.4, sz + Math.cos(a) * 6.4, a + Math.PI)
  }

  // 路灯
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    const lx = sx + Math.sin(a) * 7.6
    const lz = sz + Math.cos(a) * 7.6
    b.cyl(M_IRON, 0.07, 0.11, 3.4, 8, M(lx, y + 1.7, lz))
    b.box(M_IRON, 0.42, 0.1, 0.42, M(lx, y + 3.45, lz))
    b.box(mat(0xffe0ae, { emissive: 0xffb45e, emissiveIntensity: 0.85, roughness: 0.4 }), 0.3, 0.46, 0.3, M(lx, y + 3.22, lz))
    b.box(M_IRON, 0.46, 0.08, 0.46, M(lx, y + 2.96, lz))
  }

  // 市集摊位
  function stall(cx, cz, ry, stripe) {
    const T = (lx, ly, lz, r = 0) => M(cx, y, cz, ry).multiply(M(lx, ly, lz, r))
    for (const px of [-1.5, 1.5]) {
      for (const pz of [-1, 1]) b.box(M_WOOD_DARK, 0.1, 2.4, 0.1, T(px, 1.2, pz))
    }
    b.box(M_WOOD, 3.1, 0.12, 1.9, T(0, 1.02, 0))
    b.box(M_WOOD_DARK, 3.2, 0.2, 0.12, T(0, 1.14, 0.95))
    const colors = [stripe, 0xf2e8d2]
    for (let i = 0; i < 7; i++) {
      b.box(
        mat(colors[i % 2], { roughness: 0.95 }),
        0.46,
        0.07,
        2.2,
        T(-1.38 + i * 0.46, 2.5, -0.1, 0, -0.16)
      )
    }
    b.box(M_WOOD, 3.1, 0.06, 0.06, T(0, 2.44, -1.0))
    // 货箱与水果
    for (let i = 0; i < 3; i++) {
      b.box(M_WOOD_DARK, 0.7, 0.35, 0.55, T(-0.95 + i * 0.95, 1.26, 0.15))
      for (let k = 0; k < 5; k++) {
        const col = [0xd66a3f, 0xd8b23f, 0x8fae4e][i % 3]
        b.add(new THREE.SphereGeometry(0.1, 6, 5), mat(col, { roughness: 0.75 }), T(-1.15 + i * 0.95 + (k % 3) * 0.15, 1.49, 0.02 + Math.floor(k / 3) * 0.18))
      }
    }
  }
  stall(6.6, sz - 2.4, -Math.PI / 2.6, 0xc2684a)
  stall(-6.4, sz + 2.2, Math.PI / 2.4, 0x7f9587)

  // 花摊木桶
  for (let i = 0; i < 3; i++) {
    const fx = sx - 2.6 + i * 2.6
    const fz = sz - 6.6
    b.cyl(M_WOOD, 0.42, 0.34, 0.55, 10, M(fx, y + 0.28, fz))
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU
      b.add(
        new THREE.IcosahedronGeometry(0.16, 0),
        mat([COLORS.flowerRose, COLORS.flowerPoppy, COLORS.flowerDaisy, COLORS.flowerLavender][k % 4], { roughness: 0.8 }),
        M(fx + Math.sin(a) * 0.26, y + 0.62, fz + Math.cos(a) * 0.26)
      )
    }
  }

  b.build(group)
  scene.add(group)

  const obstacles = [
    { x: sx, z: sz, r: 3.5 },
    { x: 6.6, z: sz - 2.4, r: 2.2 },
    { x: -6.4, z: sz + 2.2, r: 2.2 },
  ]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4
    obstacles.push({ x: sx + Math.sin(a) * 6.4, z: sz + Math.cos(a) * 6.4, r: 1.15 })
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    obstacles.push({ x: sx + Math.sin(a) * 7.6, z: sz + Math.cos(a) * 7.6, r: 0.26 })
  }
  for (let i = 0; i < 3; i++) {
    obstacles.push({ x: sx - 2.6 + i * 2.6, z: sz - 6.6, r: 0.55 })
  }

  return {
    group,
    obstacles,
    update: updateFountain,
  }
}

/* ------------------------------------------------------------ 码头与划艇 */

function createDock(scene) {
  const group = new THREE.Group()
  const b = new Builder()
  const deckY = 0.78
  const x0 = -30.2
  const x1 = -21.8
  const zc = 3.5
  const halfW = 1.2

  // 甲板木板
  const planks = 18
  for (let i = 0; i < planks; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / planks
    b.box(M_WOOD, Math.abs(x1 - x0) / planks - 0.06, 0.14, halfW * 2, M(x, deckY, zc, 0, 0, (Math.random() - 0.5) * 0.012))
  }
  // 边梁
  for (const sz of [-1, 1]) {
    b.box(M_WOOD_DARK, Math.abs(x1 - x0) + 0.2, 0.2, 0.18, M((x0 + x1) / 2, deckY - 0.14, zc + sz * halfW))
  }
  // 木桩
  for (const px of [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1]) {
    for (const sz of [-1, 1]) {
      b.cyl(M_WOOD_DARK, 0.16, 0.18, 3.6, 7, M(px, deckY - 1.5, zc + sz * (halfW - 0.1)))
    }
  }
  // 系船柱与跳板
  b.cyl(M_WOOD_DARK, 0.2, 0.24, 0.7, 8, M(x1 + 0.5, deckY + 0.35, zc + 1.6))
  b.box(M_WOOD, 1.8, 0.09, 0.8, M(-20.9, 0.7, zc + 0.7))
  for (const sx of [-21.6, -20.2]) {
    b.box(M_WOOD_DARK, 0.08, 0.55, 0.08, M(sx, 0.42, zc + 1.0))
  }
  // 上岸坡道
  const steps = 7
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const x = x0 + 2.2 - t * 2.2
    const yy = 0.24 + t * (deckY - 0.24)
    b.box(M_WOOD, 0.36, 0.1, 2.6, M(x, yy, zc))
  }
  b.build(group)
  scene.add(group)

  // 划艇：中空船壳 + 深色内底
  const boat = new THREE.Group()
  const boatOutline = (s) => {
    const sh = new THREE.Shape()
    sh.moveTo(-1.5 * s, 0)
    sh.quadraticCurveTo(-1.85 * s, 0.55 * s, -0.5 * s, 0.62 * s)
    sh.quadraticCurveTo(0.8 * s, 0.64 * s, 1.75 * s, 0)
    sh.quadraticCurveTo(0.8 * s, -0.64 * s, -0.5 * s, -0.62 * s)
    sh.quadraticCurveTo(-1.85 * s, -0.55 * s, -1.5 * s, 0)
    return sh
  }
  const shape = boatOutline(1)
  const holePath = new THREE.Path()
  holePath.setFromPoints(boatOutline(0.76).getPoints(48))
  shape.holes.push(holePath)

  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 12 })
  hullGeo.rotateX(-Math.PI / 2)
  const hull = new THREE.Mesh(hullGeo, mat(0x7d6a4e, { roughness: 0.95, side: THREE.DoubleSide }))
  hull.position.y = -0.02
  hull.castShadow = true
  boat.add(hull)

  const floorGeo = new THREE.ShapeGeometry(boatOutline(0.76))
  floorGeo.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(floorGeo, mat(0x4f3f2e, { roughness: 1 }))
  floor.position.y = 0.12
  boat.add(floor)

  for (const x of [-0.6, 0.55]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.92), M_WOOD)
    seat.position.set(x, 0.34, 0)
    boat.add(seat)
  }
  for (const sz of [-1, 1]) {
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), M_WOOD_DARK)
    oar.rotation.z = Math.PI / 2
    oar.rotation.y = 0.2
    oar.position.set(0.3, 0.4, sz * 0.55)
    boat.add(oar)
  }
  boat.position.set(-20, 0.02, 4.2)
  boat.scale.setScalar(0.9)
  boat.rotation.y = 0
  boat.rotation.z = Math.sin(0.2) * 0.03
  scene.add(boat)

  // 缆绳：从船头系到码头边缘
  const ropeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-21.0, 0.5, 4.0),
    new THREE.Vector3(-21.4, 0.68, 4.1),
    new THREE.Vector3(-21.7, 0.86, 4.2)
  )
  const rope = new THREE.Mesh(
    new THREE.TubeGeometry(ropeCurve, 16, 0.018, 4, false),
    mat(0xcbb68e, { roughness: 1 })
  )
  group.add(rope)

  return {
    group,
    boat,
    walkables: [
      // 码头甲板
      { x1: x0 + 0.2, x2: x1 + 0.3, z1: zc - halfW + 0.05, z2: zc + halfW - 0.05, y: deckY + 0.08 },
      // 上船跳板
      { x1: -22, x2: -19.4, z1: 3.9, z2: 4.5, y: 0.74 },
      // 小船甲板
      { x1: -21.2, x2: -18.8, z1: 3.6, z2: 4.8, y: 0.36 },
    ],
    obstacles: [
      { x: x1 + 0.5, z: zc + 1.6, r: 0.4 },
      { x: x0 - 1.2, z: zc - 2.2, r: 0.5 },
      { x: x0 - 1.2, z: zc + 2.2, r: 0.5 },
    ],
  }
}

/* ------------------------------------------------------------ 北岸凉亭 */

function createPergola(scene) {
  const cx = 0
  const cz = -36
  const y = groundHeight(cx, cz)
  const group = new THREE.Group()
  const b = new Builder()

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(M_WOOD_DARK, 0.22, 3.2, 0.22, M(cx + sx * 2.4, y + 1.6, cz + sz * 1.8))
    }
  }
  for (const sz of [-1, 1]) {
    b.box(M_WOOD, 5.6, 0.24, 0.3, M(cx, y + 3.25, cz + sz * 1.8))
  }
  for (let i = 0; i < 7; i++) {
    b.box(M_WOOD, 0.16, 0.14, 4.0, M(cx - 2.6 + i * 0.86, y + 3.4, cz))
  }
  // 爬藤
  for (let i = 0; i < 14; i++) {
    const sx = i % 2 ? -1 : 1
    b.add(
      new THREE.IcosahedronGeometry(0.4 + Math.random() * 0.3, 0),
      i % 3 ? M_LEAF : M_LEAF_LIGHT,
      M(cx + sx * 2.4, y + 2.6 + Math.random() * 0.9, cz - 1.8 + Math.random() * 3.6, 0, 0, 0, 1.2, 0.9, 1.2)
    )
    if (i % 2 === 0) {
      b.add(new THREE.IcosahedronGeometry(0.12, 0), mat(COLORS.flowerRose, { roughness: 0.8 }), M(cx + sx * 2.6, y + 2.9 + Math.random() * 0.6, cz - 1.5 + Math.random() * 3))
    }
  }
  bench(b, cx, cz + 0.4, Math.PI)
  b.build(group)
  scene.add(group)

  return {
    group,
    obstacles: [
      { x: cx - 2.4, z: cz - 1.8, r: 0.4 },
      { x: cx + 2.4, z: cz - 1.8, r: 0.4 },
      { x: cx - 2.4, z: cz + 1.8, r: 0.4 },
      { x: cx + 2.4, z: cz + 1.8, r: 0.4 },
      { x: cx, z: cz + 0.4, r: 1.1 },
    ],
  }
}

/* ------------------------------------------------------------ 薰衣草田的矮墙、蜂箱与路牌 */

function createFieldDressing(scene) {
  const group = new THREE.Group()
  const b = new Builder()
  const cx = 48
  const cz = 2

  // 低石墙（留出西侧入口）
  const boxes = []
  const segments = 18
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU
    if (a > 4.4 && a < 5.0) continue
    const x = cx + Math.sin(a) * 10.8
    const z = cz + Math.cos(a) * 10.8
    if (groundHeight(x, z) < 0.2) continue
    b.box(M_STONE, 0.9, 0.6, 0.42, M(x, groundHeight(x, z) + 0.3, z, a))
    boxes.push({ x, z, hw: 0.47, hd: 0.23, ry: a })
  }

  // 蜂箱
  for (let i = 0; i < 3; i++) {
    const x = 55.5 + i * 1.3
    const z = 8 - i * 0.4
    const y = groundHeight(x, z)
    b.box(M_WOOD, 0.8, 1.0, 0.7, M(x, y + 0.5, z))
    b.box(mat(0xe8dcc0, { roughness: 1 }), 0.86, 0.16, 0.76, M(x, y + 0.72, z))
    b.box(mat(0x8d6b45, { roughness: 1 }), 0.86, 0.08, 0.76, M(x, y + 0.42, z))
    b.box(mat(0x8d6b45, { roughness: 1 }), 0.86, 0.08, 0.76, M(x, y + 0.14, z))
    b.box(M_WOOD_DARK, 1.0, 0.12, 0.9, M(x, y + 1.06, z))
    b.box(M_WOOD_DARK, 0.06, 0.12, 0.06, M(x, y + 0.05, z))
  }

  // 田边木栅
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 2.0
    const z = 11.5
    b.box(M_WOOD_DARK, 0.1, 1.0, 0.1, M(x, groundHeight(x, z) + 0.5, z))
    if (i < 7) b.box(M_WOOD, 2.0, 0.08, 0.06, M(x + 1.0, groundHeight(x + 1.0, z) + 0.7, z))
  }

  b.build(group)
  scene.add(group)

  return {
    group,
    obstacles: [{ x: 55.5, z: 8, r: 2.4 }],
    boxes,
  }
}

/* ------------------------------------------------------------ 林间路牌 */

function createTrailSign(scene) {
  const x = 46
  const z = -44
  const y = groundHeight(x, z)
  const group = new THREE.Group()

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.6, 7), M_WOOD_DARK)
  post.position.set(x, y + 1.3, z)
  post.castShadow = true
  group.add(post)

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#7a6242'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#efe3c9'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, 492, 108)
  ctx.fillStyle = '#f3e9d2'
  ctx.font = '52px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Sentier des Bois  →', 256, 66)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), signMat)
  sign.position.set(x, y + 2.15, z + 0.08)
  sign.rotation.y = 0.35
  group.add(sign)
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.08), M_WOOD)
  back.position.set(x, y + 2.15, z)
  back.rotation.y = 0.35
  group.add(back)

  scene.add(group)
  return { group, obstacles: [{ x, z, r: 0.35 }] }
}

/* ------------------------------------------------------------ 组装 */

export function createVillage(scene) {
  const group = new THREE.Group()
  group.name = 'village'
  scene.add(group)

  const obstacles = []
  const boxes = []
  const walkables = []
  const houses = []

  for (const spec of HOUSES) {
    const h = createHouse(spec, group)
    houses.push(h)
    obstacles.push(...h.circles)
    boxes.push(...h.boxes)
  }

  const chapel = createChapel(group)
  obstacles.push(...chapel.circles)
  boxes.push(...chapel.boxes)

  const square = createSquare(group)
  obstacles.push(...square.obstacles)
  const updateFountain = square.update

  const dock = createDock(group)
  walkables.push(...dock.walkables)
  obstacles.push(...dock.obstacles)

  const pergola = createPergola(group)
  obstacles.push(...pergola.obstacles)

  const field = createFieldDressing(group)
  obstacles.push(...field.obstacles)
  boxes.push(...field.boxes)

  const sign = createTrailSign(group)
  obstacles.push(...sign.obstacles)

  addRoads(group)

  return { group, houses, obstacles, boxes, walkables, dock, chapel, updateFountain }
}
