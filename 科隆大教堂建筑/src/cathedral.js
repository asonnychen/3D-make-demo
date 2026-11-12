import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const D = Math.PI / 180
const TAU = Math.PI * 2
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1))

/* ------------------------------------------------------------------ 基础几何 */
function signedArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

function shapeOf(pts) {
  const arr = pts.map(p => new THREE.Vector2(p[0], p[1]))
  if (signedArea(arr) < 0) arr.reverse()
  return new THREE.Shape(arr)
}

function archPts(w, h, steps = 8) {
  let spring = h - 0.866 * w
  if (spring < 0.18 * h) spring = 0.18 * h
  const R = w
  const pts = [[-w / 2, 0], [-w / 2, spring]]
  for (const a of lin(180, 120, steps).slice(1)) {
    pts.push([w / 2 + R * Math.cos(a * D), spring + R * Math.sin(a * D)])
  }
  for (const a of lin(60, 0, steps).slice(1)) {
    pts.push([-w / 2 + R * Math.cos(a * D), spring + R * Math.sin(a * D)])
  }
  pts.push([w / 2, 0])
  return { pts, spring }
}

/** 二维轮廓沿坐标轴拉伸。axis 使用 Blender 轴向：X / Y / Z */
function prism(pts, axis, a0, a1) {
  const depth = Math.abs(a1 - a0)
  const lo = Math.min(a0, a1)
  let sp, m
  if (axis === 'Y') {
    sp = pts
    m = new THREE.Matrix4().makeTranslation(0, 0, lo)
  } else if (axis === 'Z') {
    sp = pts.map(p => [p[0], -p[1]])
    m = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
    m.premultiply(new THREE.Matrix4().makeTranslation(0, lo, 0))
  } else {
    sp = pts.map(p => [-p[0], p[1]])
    m = new THREE.Matrix4().makeRotationY(Math.PI / 2)
    m.premultiply(new THREE.Matrix4().makeTranslation(lo, 0, 0))
  }
  const g = new THREE.ExtrudeGeometry(shapeOf(sp), { depth, bevelEnabled: false, curveSegments: 1 })
  g.applyMatrix4(m)
  return g
}

function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0))
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2)
  return g
}

function rbox(cx, cy, sx, sy, z0, z1, rot) {
  const g = new THREE.BoxGeometry(sx, Math.abs(z1 - z0), sy)
  g.translate(0, (z0 + z1) / 2, 0)
  g.rotateY(rot)
  g.translate(cx, 0, cy)
  return g
}

/** Blender 坐标中的两点之间放置方杆 */
function barB(p0, p1, tx, ty) {
  const a = new THREE.Vector3(p0[0], p0[2], p0[1])
  const c = new THREE.Vector3(p1[0], p1[2], p1[1])
  const dir = new THREE.Vector3().subVectors(c, a)
  const len = dir.length()
  if (len < 1e-6) return null
  const g = new THREE.BoxGeometry(tx, ty, len)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
  g.applyQuaternion(q)
  g.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2)
  return g
}

function cone(cx, cy, z0, z1, r0, r1, seg) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), seg, 1, false)
  g.translate(cx, (z0 + z1) / 2, cy)
  return g
}

/* ------------------------------------------------------------------ 合批 */
class Builder {
  constructor() { this.buckets = new Map() }
  add(key, geom, matrix) {
    if (!geom) return
    let g = geom.index ? geom.toNonIndexed() : geom
    if (matrix) g.applyMatrix4(matrix)
    let arr = this.buckets.get(key)
    if (!arr) this.buckets.set(key, arr = [])
    arr.push(g)
  }
  build(materials) {
    const group = new THREE.Group()
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false)
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, materials[key])
      mesh.name = key
      mesh.castShadow = key !== 'glass' && key !== 'gold'
      mesh.receiveShadow = true
      group.add(mesh)
      list.forEach(g => g.dispose())
    }
    return group
  }
}

/* ------------------------------------------------------------------ 窗 / 玫瑰窗 / 门廊 */
const DIR = { '-X': -Math.PI / 2, '+X': Math.PI / 2, '+Y': 0, '-Y': Math.PI }

function placeM(pos, rotY) {
  return new THREE.Matrix4()
    .makeTranslation(pos[0], pos[2], pos[1])
    .multiply(new THREE.Matrix4().makeRotationY(rotY))
}

function addWindow(b, { w, h, pos, rotY, mullions = 2, band = 0.55, transom = true, headRing = false, sill = true }) {
  const m = placeM(pos, rotY)
  const { pts: innerPts, spring } = archPts(w, h)
  const outerPts = archPts(w + 2 * band, h + band * 0.6).pts.map(p => [p[0], p[1] - 0.5])
  const outer = shapeOf(outerPts)
  const hole = new THREE.Path(innerPts.map(p => new THREE.Vector2(p[0], p[1])).reverse())
  outer.holes.push(hole)

  const frame = new THREE.ExtrudeGeometry(outer, { depth: 0.9, bevelEnabled: false, curveSegments: 1 })
  frame.translate(0, 0, -0.15)
  b.add('trim', frame, m)

  const glassGeo = new THREE.ExtrudeGeometry(shapeOf(innerPts), { depth: 0.12, bevelEnabled: false, curveSegments: 1 })
  glassGeo.translate(0, 0, -0.05)
  b.add('glass', glassGeo, m)

  for (let i = 0; i < mullions; i++) {
    const u = -w / 2 + w * (i + 1) / (mullions + 1)
    const g = new THREE.BoxGeometry(0.2, Math.max(spring - 0.4, 0.3), 0.2)
    g.translate(u, spring / 2, 0.45)
    b.add('trim', g, m)
  }
  if (transom) {
    const g = new THREE.BoxGeometry(w - 0.3, 0.16, 0.16)
    g.translate(0, spring * 0.6, 0.45)
    b.add('trim', g, m)
  }
  if (headRing) {
    const g = new THREE.RingGeometry(0.13 * w, 0.26 * w, 20)
    g.translate(0, spring + 0.34 * w, 0.52)
    b.add('trim', g, m)
  }
  if (sill) {
    const g = new THREE.BoxGeometry(w + 1.5, 0.7, 1.1)
    g.translate(0, -0.25, -0.35)
    b.add('stoneDark', g, m)
  }
}

function addRose(b, { r, pos, rotY, spokes = 12, small = 8 }) {
  const m = placeM(pos, rotY)
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, TAU, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, r * 0.86, 0, TAU, true)
  s.holes.push(hole)
  const frame = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false, curveSegments: 40 })
  frame.translate(0, 0, -0.2)
  b.add('trim', frame, m)

  const glassGeo = new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.16, 48)
  glassGeo.rotateX(Math.PI / 2)
  glassGeo.translate(0, 0, 0.02)
  b.add('glass', glassGeo, m)

  const inner = new THREE.RingGeometry(r * 0.28, r * 0.38, 40)
  inner.translate(0, 0, 0.55)
  b.add('trim', inner, m)

  for (let i = 0; i < spokes; i++) {
    const a = TAU * i / spokes
    const len = r * 0.88 - r * 0.36
    const g = new THREE.BoxGeometry(len, 0.42, 0.32)
    g.translate(r * 0.36 + len / 2, 0, 0.5)
    g.rotateZ(a)
    b.add('trim', g, m)
  }
  for (let i = 0; i < small; i++) {
    const a = TAU * (i + 0.5) / small
    const g = new THREE.RingGeometry(r * 0.085, r * 0.155, 12)
    g.translate(r * 0.62 * Math.cos(a), r * 0.62 * Math.sin(a), 0.58)
    b.add('trim', g, m)
  }
}

function addPortal(b, { w, h, pos, rotY, layers = 4 }) {
  const m = placeM(pos, rotY)
  const doorPts = archPts(w * 0.46, h * 0.52).pts
  const door = new THREE.ExtrudeGeometry(shapeOf(doorPts), { depth: 0.5, bevelEnabled: false, curveSegments: 1 })
  door.translate(0, 0, 0.02)
  b.add('door', door, m)

  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.22, h * 0.34, 0.22)
    g.translate(s * w * 0.11, h * 0.17, 0.5)
    b.add('bronze', g, m)
  }
  const tr = new THREE.BoxGeometry(w * 0.44, 0.22, 0.22)
  tr.translate(0, h * 0.38, 0.5)
  b.add('bronze', tr, m)

  const ty = new THREE.BoxGeometry(w * 0.6, h * 0.2, 0.14)
  ty.translate(0, h * 0.6, 0.1)
  b.add('warm', ty, m)
  const disc = new THREE.CylinderGeometry(w * 0.13, w * 0.13, 0.12, 24)
  disc.rotateX(Math.PI / 2)
  disc.translate(0, h * 0.6, 0.2)
  b.add('gold', disc, m)

  for (let i = 0; i < layers; i++) {
    const ww = w - i * 1.75
    const hh = h - i * 1.25
    const outerPts = archPts(ww + 1.6, hh + 0.8).pts.map(p => [p[0], p[1] - 0.6])
    const outer = shapeOf(outerPts)
    const holePts = archPts(ww - 1.6, hh - 0.8).pts
    outer.holes.push(new THREE.Path(holePts.map(p => new THREE.Vector2(p[0], p[1])).reverse()))
    const z0 = (layers - 1 - i) * 0.9 + 0.4
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.9, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, z0)
    b.add(i % 2 === 0 ? 'warm' : 'trim', g, m)
  }

  const fin = new THREE.BoxGeometry(0.35, 2.0, 0.35)
  fin.translate(0, h + 1.4, (layers - 1) * 0.9 + 0.85)
  b.add('bronze', fin, m)
}

/* ------------------------------------------------------------------ 主体 */
export const NAVE_X0 = -54.0
export const NAVE_X1 = 31.5
const CORE_Y = 10.4
const AISLE_Y = 21.2
const WALL_H = 33.0
const RIDGE = 58.0
const TR_X0 = 31.5, TR_X1 = 53.0, TR_Y = 39.0, TR_RIDGE = 56.0
const CH_X0 = 53.0, CH_X1 = 68.0
const AP_CX = 68.0, AP_R = 21.0
const FACADE_X = -56.4

function buildNave(b) {
  b.add('stone', box(NAVE_X0, NAVE_X1, -CORE_Y, CORE_Y, 0, WALL_H))
  for (const s of [-1, 1]) {
    b.add('stone', box(NAVE_X0, NAVE_X1, s * (AISLE_Y - 1.2), s * AISLE_Y, 0, 21))
    let pts = [[s * 10.4, 28.6], [s * 21.7, 21.6], [s * 21.7, 22.9], [s * 10.4, 29.9]]
    if (s < 0) pts.reverse()
    b.add('roof', prism(pts, 'X', NAVE_X0 - 0.8, NAVE_X1 + 0.8))
  }
  b.add('roof', prism([[-12.4, 31.6], [0, RIDGE], [12.4, 31.6]], 'X', NAVE_X0 - 1.0, NAVE_X1 + 0.6))
  b.add('roofDark', box(NAVE_X0 - 1.0, NAVE_X1 + 0.6, -0.55, 0.55, RIDGE - 0.4, RIDGE + 1.1))
  for (const s of [-1, 1]) {
    b.add('roofDark', box(NAVE_X0 - 1.0, NAVE_X1 + 0.6, s * 11.9, s * 12.6, 31.0, 32.6))
  }

  for (const s of [-1, 1]) {
    const dir = s > 0 ? '+Y' : '-Y'
    lin(-44, 26, 10).forEach((x, k) => {
      addWindow(b, { w: 3.8, h: 13.5, pos: [x, s * AISLE_Y, 6.0], rotY: DIR[dir], mullions: 1 })
    })
    lin(-46, 28, 10).forEach((x, k) => {
      addWindow(b, { w: 3.4, h: 7.5, pos: [x, s * CORE_Y, 26.0], rotY: DIR[dir], mullions: 1, band: 0.45 })
    })
  }
}

function buildTransept(b) {
  b.add('stone', box(TR_X0, TR_X1, -TR_Y, TR_Y, 0, WALL_H))
  for (const s of [-1, 1]) {
    b.add('stone', box(TR_X0, TR_X1, s * (TR_Y - 1.4), s * TR_Y, 0, WALL_H))
  }
  b.add('roof', prism([[TR_X0 - 0.8, 31.8], [42.2, TR_RIDGE], [TR_X1 + 0.8, 31.8]], 'Y', -TR_Y - 1.0, TR_Y + 1.0))
  b.add('roofDark', box(41.7, 42.7, -TR_Y - 1.0, TR_Y + 1.0, TR_RIDGE - 0.4, TR_RIDGE + 1.0))

  for (const s of [-1, 1]) {
    const y = s * TR_Y
    const dir = s > 0 ? '+Y' : '-Y'
    b.add('stone', prism([[TR_X0, 33.0], [TR_X1, 33.0], [42.2, TR_RIDGE - 0.5]], 'Y', y - 1.2 * s, y))
    addRose(b, { r: 5.6, pos: [42.2, y + 0.15 * s, 41.5], rotY: DIR[dir], spokes: 12, small: 8 })
    addPortal(b, { w: 8.2, h: 13.0, pos: [42.2, y, 0], rotY: DIR[dir], layers: 3 })
    for (const x of [35.0, 49.4]) {
      addWindow(b, { w: 4.2, h: 14.0, pos: [x, y + 0.15 * s, 15.0], rotY: DIR[dir], mullions: 2, headRing: true })
    }
    addWindow(b, { w: 2.8, h: 6.0, pos: [42.2, y + 0.15 * s, 48.0], rotY: DIR[dir], mullions: 1, band: 0.4 })
    b.add('gold', barB([42.2, y + 0.2 * s, TR_RIDGE], [42.2, y + 0.2 * s, TR_RIDGE + 4.0], 0.5, 0.5))
    b.add('gold', barB([40.0, y + 0.2 * s, TR_RIDGE + 2.6], [44.4, y + 0.2 * s, TR_RIDGE + 2.6], 0.35, 0.35))
  }

  for (const x of [TR_X0, TR_X1]) {
    for (const s of [-1, 1]) {
      const cy = s * (TR_Y - 1.2)
      b.add('stone', rbox(x, cy, 4.2, 4.2, 0, 40.0, 0))
      b.add('roof', cone(x, cy, 40.0, 47.0, 3.1, 0.25, 8))
      b.add('roof', cone(x, cy, 39.2, 40.4, 3.4, 3.4, 8))
    }
  }
}

function buildChoir(b) {
  b.add('stone', box(CH_X0, CH_X1, -CORE_Y, CORE_Y, 0, WALL_H))
  for (const s of [-1, 1]) {
    b.add('stone', box(CH_X0, CH_X1, s * (AISLE_Y - 1.2), s * AISLE_Y, 0, 21))
    let pts = [[s * 10.4, 28.6], [s * 21.7, 21.6], [s * 21.7, 22.9], [s * 10.4, 29.9]]
    if (s < 0) pts.reverse()
    b.add('roof', prism(pts, 'X', CH_X0 - 0.5, CH_X1 + 0.5))
  }
  b.add('roof', prism([[-12.4, 31.6], [0, RIDGE], [12.4, 31.6]], 'X', CH_X0 - 0.5, CH_X1 + 0.5))
  b.add('roofDark', box(CH_X0 - 0.5, CH_X1 + 0.5, -0.55, 0.55, RIDGE - 0.4, RIDGE + 1.1))

  const apsePts = lin(-90, 90, 8).map(a => [AP_CX + AP_R * Math.cos(a * D), AP_R * Math.sin(a * D)])
  b.add('stone', prism(apsePts, 'Z', 0, WALL_H))

  // 后殿扇形屋顶
  const apex = new THREE.Vector3(AP_CX + 1.5, 55.5, 0)
  const ring = apsePts.map(p => new THREE.Vector3(p[0], 32.2, p[1]))
  const pos = []
  const pushTri = (a, c, d) => {
    const n = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(d, a))
    if (n.y < 0) { const t = c; c = d; d = t }
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z)
  }
  for (let i = 0; i < ring.length - 1; i++) pushTri(ring[i], ring[i + 1], apex)
  pushTri(ring[ring.length - 1], ring[0], apex)
  const fan = new THREE.BufferGeometry()
  fan.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  fan.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2))
  fan.computeVertexNormals()
  b.add('roof', fan)

  for (const p of apsePts) b.add('roofDark', barB([p[0], p[1], 32.4], [apex.x, apex.z, apex.y - 0.3], 0.55, 0.55))
  b.add('roofDark', barB([AP_CX, -AP_R, 32.4], [apex.x, apex.z, apex.y - 0.3], 0.55, 0.55))
  b.add('roofDark', barB([AP_CX, AP_R, 32.4], [apex.x, apex.z, apex.y - 0.3], 0.55, 0.55))

  for (let i = 0; i < apsePts.length - 1; i++) {
    const p0 = apsePts[i], p1 = apsePts[i + 1]
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2
    const th = Math.atan2(my, mx - AP_CX)
    addWindow(b, {
      w: 4.6, h: 20.0, pos: [mx, my, 7.0],
      rotY: Math.PI / 2 - th, mullions: 2, headRing: true,
    })
  }

  // 辐射小礼拜堂
  for (const a of [-60, -30, 0, 30, 60]) {
    const cx = AP_CX + 26.0 * Math.cos(a * D)
    const cy = 26.0 * Math.sin(a * D)
    const hexp = Array.from({ length: 6 }, (_, j) => [
      cx + 7.2 * Math.cos((a + 30 + 60 * j) * D),
      cy + 7.2 * Math.sin((a + 30 + 60 * j) * D),
    ])
    b.add('stone', prism(hexp, 'Z', 0, 13.0))
    b.add('roof', cone(cx, cy, 13.0, 20.5, 7.6, 0.4, 6))
    b.add('roofDark', cone(cx, cy, 12.4, 13.6, 7.9, 7.9, 6))
  }

  for (const a of [-75, -45, -15, 15, 45, 75]) {
    const cx = AP_CX + 24.0 * Math.cos(a * D)
    const cy = 24.0 * Math.sin(a * D)
    b.add('stone', rbox(cx, cy, 2.4, 3.2, 0, 22.0, a * D))
    b.add('roof', cone(cx, cy, 22.0, 27.0, 1.5, 0.2, 4))
  }
}

function flyingButtress(b, xc, s) {
  const yp = s * 24.6
  b.add('stone', box(xc - 1.15, xc + 1.15, yp - 1.15, yp + 1.15, 0, 25.0))
  b.add('stoneDark', box(xc - 1.55, xc + 1.55, yp - 1.55, yp + 1.55, 0, 3.0))

  const arc = (p0, p1, c, n) => {
    const out = []
    for (const t of lin(0, 1, n)) {
      out.push([
        (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
        (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
      ])
    }
    return out
  }
  const band = (path, thick) => {
    const L = [], R = []
    for (let i = 0; i < path.length; i++) {
      let t
      if (i === 0) t = [path[1][0] - path[0][0], path[1][1] - path[0][1]]
      else if (i === path.length - 1) t = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]]
      else t = [path[i + 1][0] - path[i - 1][0], path[i + 1][1] - path[i - 1][1]]
      const l = Math.hypot(t[0], t[1]) || 1
      const nx = -t[1] / l, ny = t[0] / l
      L.push([path[i][0] + nx * thick / 2, path[i][1] + ny * thick / 2])
      R.push([path[i][0] - nx * thick / 2, path[i][1] - ny * thick / 2])
    }
    return [...L, ...R.reverse()]
  }

  const up = band(arc([s * 24.0, 25.0], [s * 11.2, 32.0], [s * 17.2, 27.6], 14), 1.9)
  b.add('stone', prism(up, 'X', xc - 0.8, xc + 0.8))
  const low = band(arc([s * 24.2, 14.0], [s * 21.0, 21.5], [s * 23.2, 18.0], 10), 1.0)
  b.add('stone', prism(low, 'X', xc - 0.55, xc + 0.55))

  b.add('stone', box(xc - 1.0, xc + 1.0, yp - 1.0, yp + 1.0, 25.0, 28.5))
  b.add('roof', cone(xc, yp, 28.5, 33.5, 1.35, 0.15, 4))
}

function buildFacade(b) {
  b.add('stone', box(FACADE_X, -54.0, -10.0, 10.0, 0, 54.0))
  b.add('stone', prism([[-10.0, 54.0], [10.0, 54.0], [0.0, 70.0]], 'X', FACADE_X, -54.0))
  for (const s of [-1, 1]) {
    b.add('stoneDark', box(FACADE_X - 0.7, FACADE_X + 1.2, s * 9.1, s * 10.4, 0, 56.0))
  }
  b.add('stoneDark', box(FACADE_X - 0.35, FACADE_X + 0.2, -10.0, 10.0, 23.0, 24.3))
  b.add('stoneDark', box(FACADE_X - 0.35, FACADE_X + 0.2, -10.0, 10.0, 53.0, 54.6))

  addRose(b, { r: 8.2, pos: [FACADE_X - 0.02, 0, 44.0], rotY: DIR['-X'], spokes: 16, small: 12 })
  addPortal(b, { w: 15.0, h: 23.0, pos: [FACADE_X, 0, 0], rotY: DIR['-X'], layers: 4 })

  for (const y of [-4.2, 0, 4.2]) {
    addWindow(b, { w: 2.6, h: 6.2, pos: [FACADE_X, y, 56.0], rotY: DIR['-X'], mullions: 1, band: 0.32, transom: false })
  }
  for (const y of lin(-8.0, 8.0, 5)) {
    addWindow(b, { w: 2.4, h: 6.5, pos: [FACADE_X, y, 24.5], rotY: DIR['-X'], mullions: 1, band: 0.35 })
  }

  b.add('gold', barB([-55.2, 0, 70.0], [-55.2, 0, 75.0], 0.6, 0.6))
  b.add('gold', barB([-55.2, -1.6, 72.8], [-55.2, 1.6, 72.8], 0.4, 0.4))
}

function buildTower(b, cy) {
  const cx = -49.0
  b.add('stone', box(cx - 10.0, cx + 10.0, cy - 12.0, cy + 12.0, 0, 8.0))
  b.add('stone', box(cx - 9.0, cx + 9.0, cy - 11.0, cy + 11.0, 8.0, 100.0))
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add('stoneDark', box(cx + sx * 9 - 1.8, cx + sx * 9 + 1.8, cy + sy * 11 - 1.8, cy + sy * 11 + 1.8, 0, 100.0))
  }
  for (const z of [8.0, 34.0, 60.0, 88.0, 98.0]) {
    b.add('stoneDark', box(cx - 9.5, cx + 9.5, cy - 11.5, cy + 11.5, z, z + 1.4))
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add('stone', box(cx + sx * 9 - 2.0, cx + sx * 9 + 2.0, cy + sy * 11 - 2.0, cy + sy * 11 + 2.0, 100.0, 122.0))
  }
  // 钟楼层外墙
  b.add('stone', box(cx - 9.0, cx + 9.0, cy - 11.0, cy + 11.0, 100.0, 122.0))
  for (const [z0, z1] of [[100.0, 102.2], [119.8, 122.0]]) {
    b.add('stoneDark', box(cx - 9.4, cx + 9.4, cy - 11.4, cy + 11.4, z0, z1))
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add('stone', box(cx + sx * 8 - 2.0, cx + sx * 8 + 2.0, cy + sy * 8 - 2.0, cy + sy * 8 + 2.0, 122.0, 132.0))
  }
  // 上部收分外墙
  b.add('stone', box(cx - 8.0, cx + 8.0, cy - 8.0, cy + 8.0, 122.0, 132.0))
  for (const [z0, z1] of [[122.0, 123.6], [130.4, 132.0]]) {
    b.add('stoneDark', box(cx - 8.4, cx + 8.4, cy - 8.4, cy + 8.4, z0, z1))
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    b.add('stone', box(cx + sx * 8 - 1.2, cx + sx * 8 + 1.2, cy + sy * 8 - 1.2, cy + sy * 8 + 1.2, 132.0, 138.0))
    b.add('roof', cone(cx + sx * 8, cy + sy * 8, 138.0, 146.0, 1.35, 0.15, 4))
  }

  b.add('roof', cone(cx, cy, 132.0, 157.0, 6.9, 0.35, 8))
  for (let i = 0; i < 8; i++) {
    const a = TAU * i / 8 + TAU / 16
    b.add('trim', barB(
      [cx + 6.85 * Math.cos(a), cy + 6.85 * Math.sin(a), 132.2],
      [cx, cy, 156.6], 0.55, 0.55))
  }
  for (const [z, r] of [[138.0, 5.5], [144.0, 4.0], [150.0, 2.5]]) {
    for (let i = 0; i < 8; i++) {
      const a0 = TAU * i / 8, a1 = TAU * (i + 1) / 8
      b.add('trim', barB(
        [cx + r * Math.cos(a0), cy + r * Math.sin(a0), z],
        [cx + r * Math.cos(a1), cy + r * Math.sin(a1), z], 0.35, 0.35))
    }
  }

  b.add('gold', barB([cx, cy, 156.8], [cx, cy, 162.5], 0.5, 0.5))
  b.add('gold', barB([cx - 1.4, cy, 160.0], [cx + 1.4, cy, 160.0], 0.35, 0.35))

  const faces = [
    { dir: '-X', fixed: cx - 9.0, offs: [cy - 6.6, cy, cy + 6.6], axis: 'x' },
    { dir: '+X', fixed: cx + 9.0, offs: [cy - 6.6, cy, cy + 6.6], axis: 'x' },
    { dir: '-Y', fixed: cy - 11.0, offs: [cx - 4.6, cx + 4.6], axis: 'y' },
    { dir: '+Y', fixed: cy + 11.0, offs: [cx - 4.6, cx + 4.6], axis: 'y' },
  ]
  for (const f of faces) {
    const rotY = DIR[f.dir]
    const at = (o, z) => f.axis === 'x' ? [f.fixed, o, z] : [o, f.fixed, z]
    f.offs.forEach((o, k) => {
      addWindow(b, { w: 4.4, h: 40.0, pos: at(o, 36.0), rotY, mullions: 2, headRing: true })
      addWindow(b, { w: 3.6, h: 14.0, pos: at(o, 80.0), rotY, mullions: 1, band: 0.4 })
      addWindow(b, { w: 4.4, h: 16.5, pos: at(o, 103.0), rotY, mullions: 2, headRing: true })
      addWindow(b, { w: 4.0, h: 7.2, pos: at(o, 124.0), rotY, mullions: 1, band: 0.4 })
      addWindow(b, { w: 3.4, h: 11.5, pos: at(o, 16.0), rotY, mullions: 1, band: 0.42 })
    })
  }

  addPortal(b, { w: 8.0, h: 14.0, pos: [cx - 9.0, cy, 0], rotY: DIR['-X'], layers: 3 })
}

export function buildCathedral() {
  const b = new Builder()
  buildNave(b)
  buildTransept(b)
  buildChoir(b)
  buildFacade(b)

  for (const x of lin(-44, 28, 10)) for (const s of [-1, 1]) flyingButtress(b, x, s)
  for (const x of [56.5, 64.0]) for (const s of [-1, 1]) flyingButtress(b, x, s)

  for (const cy of [-20.5, 20.5]) buildTower(b, cy)

  // 交叉部尖塔
  b.add('stone', box(38.6, 45.8, -3.6, 3.6, 33.0, 47.0))
  b.add('roof', cone(42.2, 0, 47.0, 78.0, 4.4, 0.22, 8))
  for (let i = 0; i < 8; i++) {
    const a = TAU * i / 8
    b.add('trim', barB([42.2 + 4.3 * Math.cos(a), 4.3 * Math.sin(a), 47.2], [42.2, 0, 77.6], 0.45, 0.45))
  }
  for (const [z, r] of [[56.0, 3.1], [65.0, 2.1]]) {
    for (let i = 0; i < 8; i++) {
      const a0 = TAU * i / 8, a1 = TAU * (i + 1) / 8
      b.add('trim', barB(
        [42.2 + r * Math.cos(a0), r * Math.sin(a0), z],
        [42.2 + r * Math.cos(a1), r * Math.sin(a1), z], 0.3, 0.3))
    }
  }
  b.add('gold', barB([42.2, 0, 77.6], [42.2, 0, 82.0], 0.35, 0.35))
  b.add('gold', barB([41.0, 0, 80.2], [43.4, 0, 80.2], 0.25, 0.25))

  // 屋脊装饰
  for (const x of lin(NAVE_X0 + 3, NAVE_X1 - 2, 20)) {
    b.add('roofDark', box(x - 0.3, x + 0.3, -0.45, 0.45, RIDGE, RIDGE + 1.5))
  }
  for (const x of lin(CH_X0 + 2, CH_X1 - 2, 5)) {
    b.add('roofDark', box(x - 0.3, x + 0.3, -0.45, 0.45, RIDGE, RIDGE + 1.5))
  }

  return b
}

export function buildBase() {
  const b = new Builder()
  const plate = new RoundedBoxGeometry(230, 8, 156, 3, 1.4)
  plate.translate(15, -4, 0)
  b.add('base', plate)

  b.add('plinth', box(-96, 126, -74, -72.5, 0, 0.22))
  b.add('plinth', box(-96, 126, 72.5, 74, 0, 0.22))
  b.add('plinth', box(-96, -94.5, -72.5, 72.5, 0, 0.22))
  b.add('plinth', box(124.5, 126, -72.5, 72.5, 0, 0.22))

  b.add('plinth', box(-64, 104, -45, 45, 0, 1.0))
  b.add('stoneDark', box(-61, 101, -43, 43, 1.0, 2.0))
  return b
}

/* ------------------------------------------------------------------ 材质 */
export function makeMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
  return {
    stone: std(0xd9d3c5, 0.92),
    stoneDark: std(0xb5ae9f, 0.92),
    trim: std(0xe7e1d3, 0.86),
    warm: std(0x9a6a42, 0.8),
    bronze: std(0x7a5526, 0.42, 0.85),
    gold: std(0xc9a24a, 0.28, 1.0),
    roof: std(0x3c4654, 0.62, 0.05),
    roofDark: std(0x272e38, 0.6),
    glass: std(0x1e2c47, 0.22, 0.3),
    base: std(0xe2ddd3, 0.95),
    plinth: std(0xc6c0b3, 0.95),
    door: std(0x3a2618, 0.65),
  }
}

/** 设计模式：素模配色，强调体量与光影 */
export function makeDesignMaterials() {
  const std = (color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
  return {
    stone: std(0xe8e2d4, 0.94),
    stoneDark: std(0xd4cdbe, 0.94),
    trim: std(0xf6f1e7, 0.9),
    warm: std(0xcfc6b6, 0.88),
    bronze: std(0x857e70, 0.6, 0.25),
    gold: std(0x8f887a, 0.5, 0.4),
    roof: std(0xa9a292, 0.86),
    roofDark: std(0x999284, 0.86),
    glass: std(0x93a1b0, 0.55, 0.15),
    base: std(0xeee9dd, 0.96),
    plinth: std(0xd8d1c1, 0.96),
    door: std(0xc6bfb0, 0.9),
  }
}
