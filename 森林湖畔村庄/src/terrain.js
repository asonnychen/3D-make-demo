/* ============================================================
   地形：环湖草甸、湖盆、湖心小岛与外围丘陵
   ============================================================ */

import * as THREE from 'three'
import { COLORS, WORLD } from './config.js'
import { getTextures } from './textures.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

export function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/* 所有物件共用同一套高度函数，保证路面、房屋、树木都贴地 */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z)

  // 基础草甸起伏
  let h = 0
  h += Math.sin(x * 0.032 + 0.6) * Math.cos(z * 0.028 - 0.4) * 2.0
  h += Math.sin(x * 0.078 - 1.1) * Math.cos(z * 0.071 + 0.8) * 0.75
  h += Math.sin((x + z) * 0.14 + 0.4) * 0.25

  // 村庄带压平，方便铺路与建房
  const flat = smoothstep(54, 30, r)
  h = h * (1 - flat * 0.96) + flat * 0.28

  // 外围丘陵抬升
  h += smoothstep(52, 122, r) * (6 + Math.sin(x * 0.021) * Math.cos(z * 0.019) * 2.5)

  // 湖盆
  const basin = 1 - smoothstep(6.5, 30.5, r)
  h -= basin * 3.7

  // 湖心小岛
  const island = 1 - smoothstep(4.2, 8.6, r)
  h += island * (4.5 + 0.25 * Math.sin(x * 0.9))

  return h
}

export function groundNormal(x, z, e = 0.6) {
  const hL = groundHeight(x - e, z)
  const hR = groundHeight(x + e, z)
  const hD = groundHeight(x, z - e)
  const hU = groundHeight(x, z + e)
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize()
}

/* ------------------------------------------------------------ 地形网格 */

export function createTerrain(scene) {
  const size = WORLD.terrainSize
  const seg = 220
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const sand = new THREE.Color(COLORS.sand)
  const mud = new THREE.Color(COLORS.mud)
  const grass = new THREE.Color(COLORS.grass)
  const grassDark = new THREE.Color(COLORS.grassDark)
  const grassLight = new THREE.Color(COLORS.grassLight)
  const deep = new THREE.Color(0x415244)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = groundHeight(x, z)
    pos.setY(i, y)

    const n = Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.19 - 0.7) * 0.5 + 0.5
    const n2 = Math.sin(x * 0.047 - 0.4) * Math.cos(z * 0.052 + 1.1) * 0.5 + 0.5

    if (y < -0.25) {
      // 水下湖床
      c.copy(deep).lerp(mud, clamp01(1 + y * 0.5))
    } else if (y < 0.12 && Math.hypot(x, z) < 31.5) {
      // 沙滩到草地的过渡（只在湖岸）
      c.copy(sand).lerp(grassDark, smoothstep(-0.02, 0.14, y))
      c.lerp(sand, 0.2 * (1 - smoothstep(0.05, 0.12, y)))
    } else {
      c.copy(grass).lerp(grassLight, n * 0.55)
      c.lerp(grassDark, n2 * 0.55)
      // 远处森林地表更深
      c.lerp(grassDark, smoothstep(46, 100, Math.hypot(x, z)) * 0.5)
    }

    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    map: getTextures().grass,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'terrain'
  scene.add(mesh)

  return mesh
}

/* ------------------------------------------------------------ 湖岸碎石 */

export function createShoreRocks(scene) {
  const count = 90
  const geo = new THREE.DodecahedronGeometry(1, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0x9d998b, roughness: 0.95 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const dummy = new THREE.Object3D()
  let placed = 0
  let guard = 0
  while (placed < count && guard++ < 2000) {
    const a = Math.random() * Math.PI * 2
    const r = 26 + Math.random() * 8
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    const y = groundHeight(x, z)
    if (y < -0.7) continue
    const s = 0.18 + Math.random() * 0.42
    dummy.position.set(x, y + s * 0.2, z)
    dummy.rotation.set(Math.random(), Math.random() * 6.28, Math.random())
    dummy.scale.set(s, s * (0.6 + Math.random() * 0.5), s)
    dummy.updateMatrix()
    mesh.setMatrixAt(placed++, dummy.matrix)
  }
  mesh.count = placed
  scene.add(mesh)
  return mesh
}
