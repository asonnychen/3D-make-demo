/* ============================================================
   湖心废弃宅邸：三层石宅、塌陷屋顶、空窗、断木码头与爬藤
   ============================================================ */

import * as THREE from 'three'
import { Builder, M, mat } from './village.js'
import { groundHeight } from './terrain.js'

const M_PLASTER = mat(0xb0aa97, { roughness: 1 })
const M_PLASTER_DARK = mat(0x938f7d, { roughness: 1 })
const M_STONE = mat(0x8b8879, { roughness: 1 })
const M_STONE_DARK = mat(0x6f6d61, { roughness: 1 })
const M_ROOF = mat(0x4e4e46, { roughness: 1 })
const M_BLACK = mat(0x151814, { roughness: 1 })
const M_WOOD = mat(0x5b4a38, { roughness: 1 })
const M_IVY = mat(0x3f5c39, { roughness: 1 })
const M_IVY_LIGHT = mat(0x577548, { roughness: 1 })
const M_SHUTTER = mat(0x5d6a5c, { roughness: 1 })

export function createRuin(scene) {
  const baseY = groundHeight(0, 0)
  const group = new THREE.Group()
  group.position.set(0, baseY, 0)
  group.name = 'ruin'

  const b = new Builder()
  const w = 8.0
  const d = 7.6
  const h = 7.8
  const wallBottom = 0.65
  const wallTop = wallBottom + h

  // 石砌台基
  b.box(M_STONE_DARK, w + 0.7, 1.1, d + 0.7, M(0, 0.1, 0))
  b.box(M_STONE, w + 0.5, 0.24, d + 0.5, M(0, 0.66, 0))
  // 南侧台阶
  b.box(M_STONE, 2.2, 0.28, 0.7, M(0, 0.56, d / 2 + 0.75))
  b.box(M_STONE, 2.6, 0.24, 0.6, M(0, 0.38, d / 2 + 1.35))
  b.box(M_STONE, 3.0, 0.2, 0.6, M(0, 0.22, d / 2 + 1.9))

  // 四面墙（分块建造，右上角已经塌掉一截）
  const t = 0.4
  const panel = (px, py, pz, sx, sy, sz) => b.box(M_PLASTER, sx, sy, sz, M(px, py, pz))

  // 前墙（+Z）
  panel(-w * 0.25, wallBottom + h * 0.5, d / 2, w * 0.5, h, t)
  panel(w * 0.25, wallBottom + 5.5 * 0.5, d / 2, w * 0.5, 5.5, t)
  // 后墙（-Z）
  panel(0, wallBottom + h * 0.5, -d / 2, w, h, t)
  // 左右墙
  panel(-w / 2, wallBottom + 6.9 * 0.5, 0, t, 6.9, d)
  panel(w / 2, wallBottom + h * 0.5, 0, t, h, d)

  // 楼层板
  b.box(M_STONE_DARK, w - 0.9, 0.22, d - 0.9, M(0, wallBottom + 2.6, 0))
  b.box(M_STONE_DARK, w - 0.9, 0.22, d - 0.9, M(0, wallBottom + 5.2, 0))

  // 破损的女儿墙
  for (let i = 0; i < 26; i++) {
    const side = i % 4
    const tt = (Math.random() - 0.5) * 0.86
    const ch = 0.25 + Math.random() * 0.95
    const maxH = side === 1 ? wallTop : side === 2 ? wallBottom + 6.9 : wallBottom + 5.5
    let x = 0
    let z = 0
    let ry = 0
    if (side === 0) {
      x = tt * w
      z = d / 2
    } else if (side === 1) {
      x = tt * w
      z = -d / 2
    } else if (side === 2) {
      x = -w / 2
      z = tt * d
      ry = Math.PI / 2
    } else {
      x = w / 2
      z = tt * d
      ry = Math.PI / 2
    }
    if (side === 0 && x > 0.2) continue
    if (side === 2 && z > 1.0) continue
    b.box(M_PLASTER, side < 2 ? 0.65 : 0.5, ch, side < 2 ? 0.5 : 0.65, M(x, maxH + ch / 2 - 0.08, z, ry))
  }

  // 残存的斜屋顶（朝南倾斜，边缘是断裂的）
  b.box(M_ROOF, 5.8, 0.2, 5.2, M(-1.0, 9.9, -0.1, 0.06, -0.44))
  b.box(M_ROOF, 3.4, 0.16, 3.4, M(1.9, 8.9, -2.0, -0.25, 0.34))
  b.box(M_ROOF, 2.4, 0.14, 2.4, M(-2.9, 10.3, -2.3, 0.18, -0.52))
  // 屋顶断裂的边缘
  for (let i = 0; i < 9; i++) {
    b.box(M_ROOF, 0.42, 0.2, 0.7, M(-3.4 + i * 0.62, 9.05 + Math.random() * 0.22, 2.35 + Math.random() * 0.35, Math.random() * 0.3, -0.3))
  }
  // 断瓦
  for (let i = 0; i < 18; i++) {
    b.box(
      M_ROOF,
      0.5,
      0.06,
      0.36,
      M(
        -3.6 + Math.random() * 6.4,
        8.4 + Math.random() * 1.9,
        -3.2 + Math.random() * 4.6,
        Math.random() * 3,
        (Math.random() - 0.5) * 0.5
      )
    )
  }
  // 断裂的梁与椽
  for (let i = 0; i < 11; i++) {
    const x = -3.4 + Math.random() * 6.8
    const z = -3.2 + Math.random() * 4.4
    b.cyl(M_WOOD, 0.09, 0.13, 1.5 + Math.random() * 2.2, 6, M(x, wallTop + 0.4 + Math.random() * 1.1, z, Math.random() * 2.4, 0.5 + Math.random() * 0.8))
  }

  // 山墙残片
  const tri = new THREE.Shape()
  tri.moveTo(-d / 2, 0)
  tri.lineTo(d / 2, 0)
  tri.lineTo(0, 2.6)
  tri.closePath()
  const triGeo = new THREE.ShapeGeometry(tri)
  b.add(triGeo, M_PLASTER, M(-w / 2 - 0.22, wallTop, 0, -Math.PI / 2))

  // 烟囱（断了半截）
  b.box(M_STONE, 1.0, 2.5, 1.0, M(2.6, wallTop + 1.2, -1.2))
  b.box(M_STONE_DARK, 1.0, 0.35, 1.0, M(2.6, wallTop + 2.45, -1.2, 0.12, 0.1))

  // 空窗：三层，正面与两侧
  const floors = [wallBottom + 1.55, wallBottom + 4.25, wallBottom + 6.7]
  const winSpots = [
    [-2.0, 0, d / 2 + 0.22, 0],
    [2.0, 0, d / 2 + 0.22, 0],
    [-1.8, 0, -d / 2 - 0.22, Math.PI],
    [1.8, 0, -d / 2 - 0.22, Math.PI],
    [-w / 2 - 0.22, 0, 0.9, -Math.PI / 2],
    [-w / 2 - 0.22, 0, -1.7, -Math.PI / 2],
    [w / 2 + 0.22, 0, 0.9, Math.PI / 2],
    [w / 2 + 0.22, 0, -1.7, Math.PI / 2],
  ]
  for (let f = 0; f < floors.length; f++) {
    for (let i = 0; i < winSpots.length; i++) {
      const [wx, _, wz, ry] = winSpots[i]
      if (f === 2 && i !== 0) continue
      b.box(M_BLACK, 0.92, 1.35, 0.14, M(wx, floors[f], wz, ry))
      const T = (lx, ly, lz, r = 0) => M(wx, floors[f], wz, ry).multiply(M(lx, ly, lz, r))
      if (Math.random() < 0.7) {
        b.box(M_STONE, 0.1, 1.55, 0.2, T(-0.54, 0, 0.02))
        b.box(M_STONE, 0.1, 1.55, 0.2, T(0.54, 0, 0.02))
        if (Math.random() < 0.7) b.box(M_STONE, 1.2, 0.1, 0.2, T(0, 0.79, 0.02))
        b.box(M_STONE, 1.2, 0.12, 0.32, T(0, -0.74, 0.06))
      }
      // 半挂的百叶窗
      if (Math.random() < 0.45) {
        b.box(M_SHUTTER, 0.4, 1.3, 0.06, T(-0.78, -0.12, 0.12, 0.55))
      }
      if (Math.random() < 0.3) {
        b.box(M_WOOD, 1.15, 0.16, 0.07, M(wx, floors[f] + 0.2, wz + Math.cos(ry) * 0.1, ry, 0, 0.24))
      }
    }
  }

  // 门洞与歪掉的门板
  b.box(M_BLACK, 1.5, 2.6, 0.16, M(0, wallBottom + 1.3, d / 2 + 0.22))
  b.box(M_STONE, 0.18, 2.9, 0.24, M(-0.86, wallBottom + 1.4, d / 2 + 0.25))
  b.box(M_STONE, 0.18, 2.9, 0.24, M(0.86, wallBottom + 1.4, d / 2 + 0.25))
  b.box(M_WOOD, 1.15, 2.25, 0.09, M(-0.2, wallBottom + 0.98, d / 2 + 0.38, 0, 0, 0.18))

  // 二层残破的木质阳台
  for (const sx of [-1.4, 1.4]) {
    b.box(M_WOOD, 0.14, 0.14, 1.2, M(sx, wallBottom + 2.9, d / 2 + 0.7))
  }
  b.box(M_WOOD, 3.2, 0.12, 0.8, M(0, wallBottom + 2.96, d / 2 + 0.75, 0, 0.03))
  for (let i = 0; i < 5; i++) {
    b.box(M_WOOD, 0.07, 0.7, 0.07, M(-1.5 + i * 0.75, wallBottom + 3.35, d / 2 + 1.1))
  }
  b.box(M_WOOD, 3.1, 0.07, 0.07, M(0, wallBottom + 3.68, d / 2 + 1.1))

  // 爬藤
  for (let i = 0; i < 15; i++) {
    b.add(
      new THREE.IcosahedronGeometry(0.26 + Math.random() * 0.28, 0),
      i % 3 ? M_IVY : M_IVY_LIGHT,
      M(-w / 2 - 0.08, wallBottom + 0.7 + Math.random() * 6.2, -2.4 + Math.random() * 4.6, 0, 0, 0, 1, 1.2, 1)
    )
  }
  for (let i = 0; i < 7; i++) {
    b.box(M_IVY, 0.05, 1.2 + Math.random() * 1.8, 0.05, M(-w / 2 - 0.1, wallBottom + 1 + Math.random() * 3.6, -2 + Math.random() * 4))
  }
  // 前墙的常春藤
  for (let i = 0; i < 7; i++) {
    b.add(new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.24, 0), i % 2 ? M_IVY : M_IVY_LIGHT, M(-2.8 + Math.random() * 1.2, wallBottom + 0.4 + Math.random() * 2.2, d / 2 + 0.32))
  }

  b.build(group)
  scene.add(group)

  // 岛上的碎石
  const rubbleGeo = new THREE.DodecahedronGeometry(0.5, 0)
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x8f8c7e, roughness: 1 })
  const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, 52)
  rubble.castShadow = true
  rubble.receiveShadow = true
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 52; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 4.4 + Math.random() * 3.2
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    const y = groundHeight(x, z) - baseY
    const s = 0.2 + Math.random() * 0.6
    dummy.position.set(x, y + s * 0.25, z)
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    rubble.setMatrixAt(i, dummy.matrix)
  }
  group.add(rubble)

  // 枯树
  const deadTree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.32, 4.4, 7), M_WOOD)
  trunk.position.y = 2.2
  trunk.castShadow = true
  deadTree.add(trunk)
  for (let i = 0; i < 6; i++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 1.5 + Math.random() * 1.3, 5), M_WOOD)
    branch.position.set(0, 2.8 + Math.random() * 1.4, 0)
    branch.rotation.set((Math.random() - 0.5) * 1.5, Math.random() * 6.28, 0.6 + Math.random() * 0.9)
    branch.translateY(0.65)
    branch.castShadow = true
    deadTree.add(branch)
  }
  deadTree.position.set(4.1, groundHeight(4.1, 2.4) - baseY, 2.4)
  deadTree.rotation.y = 0.6
  group.add(deadTree)

  // 断裂的木栈桥（从岛边伸向水面）
  const jetty = new THREE.Group()
  const jx = 0.7
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) continue
    const z = 4.3 + i * 0.78
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.64), M_WOOD)
    plank.position.set(jx, -0.12 - i * 0.085 + Math.random() * 0.04, z)
    plank.rotation.z = (Math.random() - 0.5) * 0.12
    plank.rotation.x = (Math.random() - 0.5) * 0.08
    plank.castShadow = true
    jetty.add(plank)
  }
  for (const sz of [-1, 1]) {
    for (const z of [4.8, 7.6, 10.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.2, 6), M_WOOD)
      post.position.set(jx + sz * 0.95, -1.1, z)
      post.rotation.z = (Math.random() - 0.5) * 0.12
      jetty.add(post)
    }
  }
  group.add(jetty)

  // 半沉的旧船
  const boat = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.1), mat(0x5a4a38, { roughness: 1 }))
  hull.position.y = 0.05
  boat.add(hull)
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), mat(0x5a4a38, { roughness: 1 }))
  bow.rotation.x = -Math.PI / 2
  bow.rotation.y = Math.PI / 4
  bow.position.set(1.65, 0.05, 0)
  boat.add(bow)
  boat.position.set(-3.0, -1.02, 8.2)
  boat.rotation.set(0.08, -0.5, 0.14)
  group.add(boat)

  // 烟囱上的乌鸦
  const crow = new THREE.Group()
  const crowMat = mat(0x14161a, { roughness: 0.8 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7), crowMat)
  body.scale.set(1.5, 1, 1)
  crow.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), crowMat)
  head.position.set(0.22, 0.14, 0)
  crow.add(head)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), mat(0xc59a55, { roughness: 0.8 }))
  beak.rotation.z = -Math.PI / 2
  beak.position.set(0.36, 0.13, 0)
  crow.add(beak)
  crow.position.set(2.6, wallTop + 2.7, -1.2)
  group.add(crow)

  return {
    group,
    obstacle: { x: 0, z: 0, r: 7 },
    center: [0, 0],
    top: baseY + wallTop + 1.8,
  }
}
