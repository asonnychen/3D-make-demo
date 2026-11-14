/* ============================================================
   区块网格构建
   只为「露在外面」的面生成三角形，并把方向光、环境光遮蔽（AO）
   直接烘焙进顶点色，于是整片地形只需要一张图集材质。
   ============================================================ */

import { CHUNK_SIZE, WORLD_HEIGHT } from './config.js'
import { BLOCK_INFO, isOpaque } from './blocks.js'

/**
 * 六个面
 * dir       面朝向
 * corners   四个角在方块内的局部坐标（左下 → 右下 → 右上 → 左上，逆时针）
 * u / v     面内的两个切线，用来算 AO
 * ao        每个角在 (u,v) 上的符号
 * shade     烘焙进顶点色的明暗
 * tile      取 tiles 数组里的第几张图
 */
const FACES = [
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    u: [0, 0, -1],
    v: [0, 1, 0],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 0.8,
    tile: 0,
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    u: [0, 0, 1],
    v: [0, 1, 0],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 0.8,
    tile: 1,
  },
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    u: [1, 0, 0],
    v: [0, 0, -1],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 1,
    tile: 2,
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    u: [1, 0, 0],
    v: [0, 0, 1],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 0.62,
    tile: 3,
  },
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    u: [1, 0, 0],
    v: [0, 1, 0],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 0.9,
    tile: 4,
  },
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    u: [-1, 0, 0],
    v: [0, 1, 0],
    ao: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
    shade: 0.9,
    tile: 5,
  },
]

const CORNER_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

function newBuffer() {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] }
}

/**
 * 构建一个区块的几何数据
 * @param {import('./world.js').World} world
 * @param {import('./world.js').Chunk} chunk
 * @param {(name: string) => number[]} tileUV
 */
export function buildChunkGeometry(world, chunk, tileUV) {
  const opaque = newBuffer()
  const alpha = newBuffer()
  const baseX = chunk.cx * CHUNK_SIZE
  const baseZ = chunk.cz * CHUNK_SIZE
  const blocks = chunk.blocks
  const LAYER = CHUNK_SIZE * CHUNK_SIZE

  const occ = (x, y, z) => isOpaque(world.getBlock(x, y, z))

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[lx + lz * CHUNK_SIZE + y * LAYER]
        if (id === 0) continue

        const info = BLOCK_INFO[id]
        const buf = info.alpha ? alpha : opaque
        const wx = baseX + lx
        const wz = baseZ + lz
        // 每块轻微色差，避免大片同色看起来像塑料
        const tint = 0.94 + ((Math.imul(wx * 73856093 ^ (y * 19349663) ^ (wz * 83492791), 1) >>> 0) % 100) / 100 * 0.1

        for (let f = 0; f < 6; f++) {
          const face = FACES[f]
          const nx = wx + face.dir[0]
          const ny = y + face.dir[1]
          const nz = wz + face.dir[2]
          const neighbor = world.getBlock(nx, ny, nz)

          // 同种方块互相贴合，或者被不透明方块挡住，这个面就看不见
          if (neighbor === id) continue
          if (isOpaque(neighbor)) continue

          const [u0, v0, u1, v1] = tileUV(info.tiles[face.tile])
          const vertexBase = buf.positions.length / 3

          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c]
            buf.positions.push(lx + corner[0], y + corner[1], lz + corner[2])
            buf.normals.push(face.dir[0], face.dir[1], face.dir[2])

            const uv = CORNER_UV[c]
            buf.uvs.push(u0 + (u1 - u0) * uv[0], v0 + (v1 - v0) * uv[1])

            // 环境光遮蔽：检查这个角两侧和斜角的方块
            let light = face.shade
            if (!info.emissive) {
              const su = face.ao[c][0]
              const sv = face.ao[c][1]
              const ux = face.u[0] * su
              const uy = face.u[1] * su
              const uz = face.u[2] * su
              const vx = face.v[0] * sv
              const vy = face.v[1] * sv
              const vz = face.v[2] * sv

              const s1 = occ(nx + ux, ny + uy, nz + uz) ? 1 : 0
              const s2 = occ(nx + vx, ny + vy, nz + vz) ? 1 : 0
              const cr = occ(nx + ux + vx, ny + uy + vy, nz + uz + vz) ? 1 : 0

              const ao = s1 && s2 ? 0.45 : Math.max(0.5, 1 - 0.2 * (s1 + s2 + cr * 0.6))
              light *= ao
            } else {
              light = 1
            }

            const shade = light * tint
            buf.colors.push(shade, shade, shade, 1)
          }

          buf.indices.push(
            vertexBase,
            vertexBase + 1,
            vertexBase + 2,
            vertexBase,
            vertexBase + 2,
            vertexBase + 3,
          )
        }
      }
    }
  }

  return {
    opaque: opaque.indices.length ? opaque : null,
    alpha: alpha.indices.length ? alpha : null,
  }
}

/** 水平放置的 1×1 方片（云层、海面用） */
export function buildQuadGeometry() {
  const buf = newBuffer()
  const corners = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
  ]
  const uvs = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]
  corners.forEach((c, i) => {
    buf.positions.push(c[0], c[1], c[2])
    buf.normals.push(0, 1, 0)
    buf.uvs.push(uvs[i][0], uvs[i][1])
    buf.colors.push(1, 1, 1, 1)
  })
  buf.indices.push(0, 2, 1, 0, 3, 2)
  return buf
}

/** 选中方块的描边方盒（12 条细棱） */
export function buildSelectionBoxGeometry() {
  const buf = newBuffer()
  const t = 0.012 // 棱的粗细
  const lo = -0.002
  const hi = 1.002

  const addBox = (x0, y0, z0, x1, y1, z1) => {
    const min = [x0, y0, z0]
    const max = [x1, y1, z1]
    for (const face of FACES) {
      const base = buf.positions.length / 3
      for (let c = 0; c < 4; c++) {
        const corner = face.corners[c]
        buf.positions.push(
          corner[0] ? max[0] : min[0],
          corner[1] ? max[1] : min[1],
          corner[2] ? max[2] : min[2],
        )
        buf.normals.push(face.dir[0], face.dir[1], face.dir[2])
        buf.uvs.push(0, 0)
        buf.colors.push(1, 1, 1, 1)
      }
      buf.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  // 沿 X 的 4 条棱
  for (const y of [lo, hi]) {
    for (const z of [lo, hi]) {
      addBox(lo - t, y - t, z - t, hi + t, y + t, z + t)
    }
  }
  // 沿 Z 的 4 条棱
  for (const y of [lo, hi]) {
    for (const x of [lo, hi]) {
      addBox(x - t, y - t, lo - t, x + t, y + t, hi + t)
    }
  }
  // 沿 Y 的 4 条棱
  for (const x of [lo, hi]) {
    for (const z of [lo, hi]) {
      addBox(x - t, lo - t, z - t, x + t, hi + t, z + t)
    }
  }

  return buf
}

/** 渐变天空球 */
export function buildSkySphereGeometry(radius = 700, segments = 32, rings = 18) {
  const buf = newBuffer()
  const zenith = [0.19, 0.44, 0.86]
  const horizon = [0.72, 0.88, 1.0]
  const ground = [0.5, 0.58, 0.56]

  const colorAt = (t) => {
    // t: 0 底部 → 1 顶部
    const from = t < 0.5 ? ground : horizon
    const to = t < 0.5 ? horizon : zenith
    const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
    const eased = k * k * (3 - 2 * k)
    return [
      from[0] + (to[0] - from[0]) * eased,
      from[1] + (to[1] - from[1]) * eased,
      from[2] + (to[2] - from[2]) * eased,
    ]
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const base = buf.positions.length / 3
      const corners = [
        [r, s],
        [r + 1, s],
        [r + 1, s + 1],
        [r, s + 1],
      ]
      for (const [ri, si] of corners) {
        const phi = (ri / rings) * Math.PI // 0 = 底
        const theta = (si / segments) * Math.PI * 2
        const sy = -Math.cos(phi)
        const sr = Math.sin(phi)
        buf.positions.push(Math.cos(theta) * sr * radius, sy * radius, Math.sin(theta) * sr * radius)
        buf.normals.push(0, 0, 0)
        // v = 0 在画布顶部（天顶），所以这里把纬度翻过来
        buf.uvs.push(si / segments, 1 - (sy + 1) / 2)
        const t = (sy + 1) / 2
        const [cr, cg, cb] = colorAt(t)
        buf.colors.push(cr, cg, cb, 1)
      }
      buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }

  return buf
}
