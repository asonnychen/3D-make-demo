/* ============================================================
   植被：环湖森林、灌木、花海与草丛（全部 InstancedMesh）
   ============================================================ */

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { COLORS, HOUSES, TAU, WORLD, deg, CHAPEL } from './config.js'
import { groundHeight } from './terrain.js'

/* 共享的风场时间，注入到标准材质里做顶点摆动 */
const windTime = { value: 0 }
export function updateWind(elapsed) {
  windTime.value = elapsed
}

function windify(material, strength = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3( position );
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iPos = vec3(0.0);
        #endif
        float ph = iPos.x * 0.33 + iPos.z * 0.27;
        float sw = (sin(uWindTime * 1.15 + ph) * 0.6 + sin(uWindTime * 2.4 + ph * 1.7) * 0.25) * ${strength.toFixed(3)};
        float up = max(position.y, 0.0);
        transformed.x += sw * up * 0.05;
        transformed.z += sw * up * 0.03;
        `
      )
  }
  material.customProgramCacheKey = () => `wind-${strength}`
  return material
}

/* ------------------------------------------------------------ 工具 */

function angleDiff(a, b) {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return Math.abs(d)
}

const HOUSE_CENTERS = HOUSES.map((h) => ({
  x: Math.sin(h.angle) * h.radius,
  z: Math.cos(h.angle) * h.radius,
  r: Math.max(h.w, h.d) * 0.72 + 1.2,
}))

const BLOCKERS = [
  { x: 0, z: 40, r: 10.5 }, // 广场
  { x: Math.sin(CHAPEL.angle) * CHAPEL.radius, z: Math.cos(CHAPEL.angle) * CHAPEL.radius, r: 10 }, // 教堂
  { x: -33, z: 3, r: 6 }, // 码头
  { x: 0, z: -36, r: 5 }, // 凉亭
  ...HOUSE_CENTERS,
]

export function isFreeSpot(x, z, pad = 0) {
  for (const b of BLOCKERS) {
    if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return false
  }
  return true
}

export function nearRoad(x, z) {
  const r = Math.hypot(x, z)
  const a = Math.atan2(x, z)
  if (Math.abs(r - WORLD.ringRadius) < 2.5) return true
  const spokes = [0, 90, 135, 180, 270]
  for (const s of spokes) {
    if (angleDiff(a, deg(s)) < 0.055 && r > 29 && r < 70) return true
  }
  for (const h of HOUSES) {
    if (angleDiff(a, h.angle) < 0.05 && r > 31 && r < h.radius) return true
  }
  return false
}

/* ------------------------------------------------------------ 树 */

function treeCanopyGeometry() {
  const parts = []
  const blobs = [
    [0, 4.9, 0, 1.75],
    [-1.1, 4.2, 0.5, 1.25],
    [1.05, 4.35, -0.35, 1.3],
    [0.25, 3.7, 1.0, 1.15],
    [-0.3, 3.65, -1.05, 1.1],
    [0.4, 5.9, 0.1, 1.0],
  ]
  for (const [x, y, z, s] of blobs) {
    const g = new THREE.IcosahedronGeometry(s, 1)
    g.scale(1, 0.86, 1)
    g.translate(x, y, z)
    parts.push(g)
  }
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  return merged
}

export function createTrees(scene) {
  const count = 560
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 3.6, 6)
  trunkGeo.translate(0, 1.8, 0)
  const canopyGeo = treeCanopyGeometry()

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a35, roughness: 1 })
  const canopyMat = windify(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: false }),
    1
  )

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count)
  trunks.castShadow = true
  trunks.receiveShadow = true
  canopies.castShadow = true
  canopies.receiveShadow = true

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let n = 0
  let guard = 0
  while (n < count && guard++ < 12000) {
    let r
    let a
    if (n < 26) {
      // 村内的观赏树
      a = Math.random() * TAU
      r = 43 + Math.random() * 4.5
    } else {
      a = Math.random() * TAU
      r = WORLD.forestStart + Math.pow(Math.random(), 0.72) * 68
    }
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (Math.hypot(x, z) < 30) continue
    if (nearRoad(x, z)) continue
    if (!isFreeSpot(x, z, 1.5)) continue
    if (Math.hypot(x - 48, z - 2) < 14) continue
    // 林间步道两侧留出空地
    if (r > 45 && r < 72 && angleDiff(a, deg(135)) < 0.1) continue

    const y = groundHeight(x, z)
    if (y < 0.1) continue

    const s = 0.72 + Math.random() * 0.95
    dummy.position.set(x, y - 0.15, z)
    dummy.rotation.set(0, Math.random() * TAU, 0)
    dummy.scale.set(s * (0.85 + Math.random() * 0.3), s * (0.9 + Math.random() * 0.35), s)
    dummy.updateMatrix()
    trunks.setMatrixAt(n, dummy.matrix)
    canopies.setMatrixAt(n, dummy.matrix)

    const hue = 0.24 + (Math.random() - 0.5) * 0.05
    const light = 0.21 + Math.random() * 0.14
    color.setHSL(hue, 0.36 + Math.random() * 0.18, light)
    canopies.setColorAt(n, color)
    n++
  }
  trunks.count = n
  canopies.count = n
  trunks.instanceMatrix.needsUpdate = true
  canopies.instanceMatrix.needsUpdate = true
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true

  scene.add(trunks, canopies)
  return { trunks, canopies }
}

/* ------------------------------------------------------------ 灌木 */

export function createBushes(scene) {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  geo.scale(1, 0.72, 1)
  const mat = windify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 0.7)
  const count = 220
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let n = 0
  let guard = 0
  while (n < count && guard++ < 5000) {
    const a = Math.random() * TAU
    const r = 40 + Math.random() * 16
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (nearRoad(x, z) || !isFreeSpot(x, z, 0.6)) continue
    if (Math.hypot(x - 48, z - 2) < 14) continue
    const y = groundHeight(x, z)
    const s = 0.4 + Math.random() * 0.6
    dummy.position.set(x, y + s * 0.45, z)
    dummy.rotation.y = Math.random() * TAU
    dummy.scale.set(s * 1.25, s, s * 1.15)
    dummy.updateMatrix()
    mesh.setMatrixAt(n, dummy.matrix)
    color.setHSL(0.25 + Math.random() * 0.03, 0.36, 0.22 + Math.random() * 0.12)
    mesh.setColorAt(n, color)
    n++
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  scene.add(mesh)
  return mesh
}

/* ------------------------------------------------------------ 花 */

function flowerGeometry() {
  const parts = []
  const stem = new THREE.BoxGeometry(0.025, 0.28, 0.025)
  stem.translate(0, 0.14, 0)
  parts.push(stem)

  for (let i = 0; i < 4; i++) {
    const petal = new THREE.PlaneGeometry(0.1, 0.075)
    petal.rotateX(-Math.PI / 3.2)
    petal.translate(0, 0.3, 0.05)
    petal.rotateY((i / 4) * TAU)
    parts.push(petal)
  }
  const center = new THREE.BoxGeometry(0.05, 0.03, 0.05)
  center.translate(0, 0.31, 0)
  parts.push(center)

  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  return merged
}

const FLOWER_COLORS = [
  COLORS.flowerDaisy,
  COLORS.flowerDaisy,
  COLORS.flowerYellow,
  COLORS.flowerPoppy,
  COLORS.flowerRose,
  COLORS.flowerLavender,
  0xb9c8e0,
]

export function createFlowers(scene) {
  const geo = flowerGeometry()
  const mat = windify(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }),
    1.4
  )
  const count = 5400
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = false
  mesh.receiveShadow = false

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let n = 0
  let guard = 0

  // 1) 村庄草甸上的野花
  while (n < 3200 && guard++ < 26000) {
    const a = Math.random() * TAU
    const r = 28.2 + Math.pow(Math.random(), 0.8) * 22
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (nearRoad(x, z) || !isFreeSpot(x, z, 0.2)) continue
    if (Math.hypot(x - 48, z - 2) < 13.5) continue // 留给薰衣草田
    const y = groundHeight(x, z)
    if (y < 0.18) continue

    const s = 0.7 + Math.random() * 0.65
    dummy.position.set(x, y, z)
    dummy.rotation.y = Math.random() * TAU
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    mesh.setMatrixAt(n, dummy.matrix)
    color.setHex(FLOWER_COLORS[(Math.random() * FLOWER_COLORS.length) | 0])
    color.offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.08)
    mesh.setColorAt(n, color)
    n++
  }

  // 2) 薰衣草田：整齐的花垄
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 80; col++) {
      const x = 40.4 + col * 0.19 + Math.sin(row * 1.7) * 0.08
      const z = -4 + row * 0.65
      if (Math.hypot(x - 48, z - 2) > 9) continue
      const y = groundHeight(x, z)
      const s = 0.8 + Math.random() * 0.3
      dummy.position.set(x, y, z)
      dummy.rotation.y = Math.random() * TAU
      dummy.scale.set(s * 0.62, s * (1.5 + Math.random() * 0.35), s * 0.62)
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
      color.setHSL(0.72 + Math.random() * 0.03, 0.45, 0.5 + Math.random() * 0.1)
      mesh.setColorAt(n, color)
      n++
      if (n >= count) break
    }
    if (n >= count) break
  }

  // 3) 房屋窗下与广场花坛
  for (const h of HOUSE_CENTERS) {
    for (let i = 0; i < 26 && n < count; i++) {
      const a = Math.random() * TAU
      const rr = h.r * 0.55 + Math.random() * 1.6
      const x = h.x + Math.sin(a) * rr
      const z = h.z + Math.cos(a) * rr
      if (nearRoad(x, z)) continue
      const y = groundHeight(x, z)
      dummy.position.set(x, y, z)
      dummy.rotation.y = Math.random() * TAU
      dummy.scale.setScalar(1 + Math.random() * 0.5)
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
      color.setHex(FLOWER_COLORS[(Math.random() * 4) | 0])
      mesh.setColorAt(n, color)
      n++
    }
  }

  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  scene.add(mesh)

  // 薰衣草田的土壤（贴地网格，避免悬空）
  const soilGeo = new THREE.PlaneGeometry(13.5, 14.5, 14, 16)
  soilGeo.rotateX(-Math.PI / 2)
  const sp = soilGeo.attributes.position
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) + 48
    const z = sp.getZ(i) + 2
    sp.setY(i, groundHeight(x, z) - groundHeight(48, 2) + 0.03)
  }
  soilGeo.computeVertexNormals()
  const soil = new THREE.Mesh(
    soilGeo,
    new THREE.MeshStandardMaterial({ color: 0x6d6048, roughness: 1 })
  )
  soil.position.set(48, groundHeight(48, 2), 2)
  soil.receiveShadow = true
  scene.add(soil)

  return mesh
}

/* ------------------------------------------------------------ 草丛 */

function grassGeometry() {
  const parts = []
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.PlaneGeometry(0.05, 0.34)
    blade.translate(0, 0.17, 0)
    blade.rotateY((i / 3) * Math.PI + Math.random() * 0.4)
    blade.rotateZ((Math.random() - 0.5) * 0.35)
    parts.push(blade)
  }
  return mergeGeometries(parts)
}

export function createGrass(scene) {
  const geo = grassGeometry()
  const mat = windify(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }),
    1.1
  )
  const count = 8000
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let n = 0
  let guard = 0
  while (n < count && guard++ < 40000) {
    const a = Math.random() * TAU
    const r = 27.5 + Math.pow(Math.random(), 0.75) * 30
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (nearRoad(x, z) || !isFreeSpot(x, z, 0.05)) continue
    if (Math.hypot(x - 48, z - 2) < 12.5) continue
    const y = groundHeight(x, z)
    if (y < 0.15) continue
    const s = 0.6 + Math.random() * 0.75
    dummy.position.set(x, y, z)
    dummy.rotation.y = Math.random() * TAU
    dummy.scale.set(s, s * (0.8 + Math.random() * 0.6), s)
    dummy.updateMatrix()
    mesh.setMatrixAt(n, dummy.matrix)
    color.setHSL(0.24 + Math.random() * 0.035, 0.35 + Math.random() * 0.15, 0.3 + Math.random() * 0.12)
    mesh.setColorAt(n, color)
    n++
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  scene.add(mesh)
  return mesh
}
