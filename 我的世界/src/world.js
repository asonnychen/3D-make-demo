/* ============================================================
   世界数据：区块存储、地形生成、方块读写
   ============================================================ */

import {
  CHUNK_SIZE,
  CHUNKS_X,
  CHUNKS_Z,
  WORLD_HEIGHT,
  WORLD_X,
  WORLD_Z,
  SEA_LEVEL,
  SNOW_LINE,
} from './config.js'
import { BLOCK, isSolid } from './blocks.js'
import { fbm2, mulberry32 } from './noise.js'

const LAYER = CHUNK_SIZE * CHUNK_SIZE // 一个水平层 256 格

const smoothstep = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx
    this.cz = cz
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT)
    this.dirty = true
    this.entity = null
    this.meshes = []
  }

  get(x, y, z) {
    return this.blocks[x + z * CHUNK_SIZE + y * LAYER]
  }

  set(x, y, z, id) {
    this.blocks[x + z * CHUNK_SIZE + y * LAYER] = id
  }
}

export class World {
  constructor(seed = 2026) {
    this.seed = seed
    this.chunks = new Array(CHUNKS_X * CHUNKS_Z).fill(null)
    this.pending = [] // 待构建网格的区块
  }

  /* ---------------------------------------------------------- 区块 */

  chunkAt(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= CHUNKS_X || cz >= CHUNKS_Z) return null
    return this.chunks[cx * CHUNKS_Z + cz]
  }

  createChunks() {
    this.chunks.fill(null)
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        this.chunks[cx * CHUNKS_Z + cz] = new Chunk(cx, cz)
      }
    }
  }

  /** 世界坐标 → 方块 id */
  getBlock(x, y, z) {
    if (y < 0) return BLOCK.BEDROCK
    if (y >= WORLD_HEIGHT) return BLOCK.AIR
    if (x < 0 || z < 0 || x >= WORLD_X || z >= WORLD_Z) return BLOCK.AIR
    const chunk = this.chunks[(x >> 4) * CHUNKS_Z + (z >> 4)]
    if (!chunk) return BLOCK.AIR
    return chunk.blocks[(x & 15) + (z & 15) * CHUNK_SIZE + y * LAYER]
  }

  /** 写入方块，并把受影响的区块标记为需要重建 */
  setBlock(x, y, z, id) {
    if (x < 0 || z < 0 || x >= WORLD_X || z >= WORLD_Z) return false
    if (y < 0 || y >= WORLD_HEIGHT) return false
    const cx = x >> 4
    const cz = z >> 4
    const chunk = this.chunks[cx * CHUNKS_Z + cz]
    if (!chunk) return false

    const lx = x & 15
    const lz = z & 15
    const index = lx + lz * CHUNK_SIZE + y * LAYER
    if (chunk.blocks[index] === id) return false
    chunk.blocks[index] = id
    this.markDirty(cx, cz)

    // 边界上的方块会影响邻区块的面剔除
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === 15) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === 15) this.markDirty(cx, cz + 1)
    return true
  }

  markDirty(cx, cz) {
    const chunk = this.chunkAt(cx, cz)
    if (chunk) chunk.dirty = true
  }

  isSolid(x, y, z) {
    return isSolid(this.getBlock(x, y, z))
  }

  /** 从 (x,z) 往下找到第一个实心方块，返回其上方的高度 */
  surfaceHeight(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.getBlock(x, y, z))) return y + 1
    }
    return SEA_LEVEL + 1
  }

  /* ---------------------------------------------------------- 地形 */

  terrainHeight(x, z) {
    // fbm 的结果集中在 0.5 附近，先展开到 -1..1 才有明显的起伏
    const n1 = (fbm2(x * 0.006, z * 0.006, this.seed, 5) - 0.5) * 2
    const n2 = (fbm2(x * 0.019, z * 0.019, this.seed + 31, 4) - 0.5) * 2
    const n3 = (fbm2(x * 0.078, z * 0.078, this.seed + 77, 2) - 0.5) * 2
    const mountain = Math.pow(Math.max(0, n1 - 0.18) / 0.82, 1.6)
    let h = 29 + n1 * 16 + n2 * 6 + n3 * 2 + mountain * 24

    // 岛屿化：靠近世界边缘时把地形压回海面以下，边界看起来就是外海
    const cx = WORLD_X / 2
    const cz = WORLD_Z / 2
    const edge = Math.max(Math.abs((x - cx) / cx), Math.abs((z - cz) / cz))
    const k = 1 - smoothstep(0.78, 1.0, edge)
    h = SEA_LEVEL - 7 + (h - (SEA_LEVEL - 7)) * k

    return Math.max(4, Math.min(WORLD_HEIGHT - 6, Math.round(h)))
  }

  generate() {
    this.createChunks()

    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        const chunk = this.chunkAt(cx, cz)
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const wx = cx * CHUNK_SIZE + lx
            const wz = cz * CHUNK_SIZE + lz
            const h = this.terrainHeight(wx, wz)
            const beach = h <= SEA_LEVEL + 1

            for (let y = 0; y <= h; y++) {
              let id
              if (y === 0) id = BLOCK.BEDROCK
              else if (y < h - 4) id = BLOCK.STONE
              else if (y < h) id = beach ? BLOCK.SAND : BLOCK.DIRT
              else if (h >= SNOW_LINE) id = BLOCK.SNOW
              else if (beach) id = BLOCK.SAND
              else id = BLOCK.GRASS
              chunk.set(lx, y, lz, id)
            }

            for (let y = h + 1; y <= SEA_LEVEL; y++) {
              chunk.set(lx, y, lz, BLOCK.WATER)
            }
          }
        }
      }
    }

    this.decorate()
    this.chunks.forEach((c) => {
      if (c) c.dirty = true
    })
  }

  /** 种树：只长在离海平面不高的草地上 */
  decorate() {
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        const rand = mulberry32(this.seed + cx * 7331 + cz * 1279)
        const count = 1 + Math.floor(rand() * 3)
        for (let i = 0; i < count; i++) {
          const lx = 2 + Math.floor(rand() * (CHUNK_SIZE - 4))
          const lz = 2 + Math.floor(rand() * (CHUNK_SIZE - 4))
          const wx = cx * CHUNK_SIZE + lx
          const wz = cz * CHUNK_SIZE + lz
          const h = this.terrainHeight(wx, wz)
          if (h <= SEA_LEVEL + 1 || h >= SNOW_LINE - 4) continue
          if (this.getBlock(wx, h, wz) !== BLOCK.GRASS) continue
          this.growTree(wx, h + 1, wz, rand)
        }
      }
    }
  }

  growTree(x, y, z, rand) {
    const trunk = 4 + Math.floor(rand() * 3)
    const top = y + trunk

    // 树冠：下两层半径 2，上两层半径 1
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
          const px = x + dx
          const py = top + dy
          const pz = z + dz
          if (this.getBlock(px, py, pz) === BLOCK.AIR) {
            this.setBlock(px, py, pz, BLOCK.LEAVES)
          }
        }
      }
    }

    for (let i = 0; i < trunk; i++) {
      this.setBlock(x, y + i, z, BLOCK.LOG)
    }
    this.setBlock(x, y - 1, z, BLOCK.DIRT)
  }

  /** 世界中心附近找一个安全的出生点 */
  findSpawn() {
    const cx = Math.floor(WORLD_X / 2)
    const cz = Math.floor(WORLD_Z / 2)
    for (let r = 0; r < 24; r++) {
      for (let a = 0; a < 8; a++) {
        const x = cx + Math.round(Math.cos((a / 8) * Math.PI * 2) * r)
        const z = cz + Math.round(Math.sin((a / 8) * Math.PI * 2) * r)
        const y = this.surfaceHeight(x, z)
        if (y > SEA_LEVEL + 1 && y < SNOW_LINE - 6) {
          return { x: x + 0.5, y, z: z + 0.5 }
        }
      }
    }
    return { x: cx + 0.5, y: this.surfaceHeight(cx, cz), z: cz + 0.5 }
  }

  /** 清空区块实体（重新生成世界时用） */
  disposeAll() {
    for (const chunk of this.chunks) {
      if (!chunk) continue
      if (chunk.entity) {
        chunk.entity.destroy()
        chunk.entity = null
      }
      chunk.meshes = []
    }
    this.chunks.fill(null)
  }
}
