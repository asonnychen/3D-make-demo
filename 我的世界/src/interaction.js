/* ============================================================
   方块交互：体素射线拾取（DDA）、破坏、放置、选中描边
   ============================================================ */

import { Color, Entity, Mesh, MeshInstance, StandardMaterial, BLEND_NORMAL } from 'playcanvas'
import { REACH } from './config.js'
import { BLOCK, BLOCK_INFO, isSolid } from './blocks.js'
import { buildSelectionBoxGeometry } from './mesher.js'

/**
 * 沿射线逐格步进，找到第一个实体方块
 * 返回 { x, y, z, nx, ny, nz }（nx..nz 是命中面的法线）
 */
export function raycastVoxels(world, origin, dir, maxDistance = REACH) {
  let x = Math.floor(origin.x)
  let y = Math.floor(origin.y)
  let z = Math.floor(origin.z)

  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0

  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dir.x)
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dir.y)
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dir.z)

  let tMaxX =
    stepX === 0 ? Infinity : (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX
  let tMaxY =
    stepY === 0 ? Infinity : (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY
  let tMaxZ =
    stepZ === 0 ? Infinity : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ

  let nx = 0
  let ny = 0
  let nz = 0
  let distance = 0

  while (distance <= maxDistance) {
    if (isSolid(world.getBlock(x, y, z))) {
      return { x, y, z, nx, ny, nz, distance }
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX
      distance = tMaxX
      tMaxX += tDeltaX
      nx = -stepX
      ny = 0
      nz = 0
    } else if (tMaxY < tMaxZ) {
      y += stepY
      distance = tMaxY
      tMaxY += tDeltaY
      nx = 0
      ny = -stepY
      nz = 0
    } else {
      z += stepZ
      distance = tMaxZ
      tMaxZ += tDeltaZ
      nx = 0
      ny = 0
      nz = -stepZ
    }
  }

  return null
}

/** 选中方块的描边 */
export function createSelectionBox(app, device) {
  const geometry = buildSelectionBoxGeometry()
  const mesh = new Mesh(device)
  mesh.setPositions(geometry.positions)
  mesh.setNormals(geometry.normals)
  mesh.setUvs(0, geometry.uvs)
  mesh.setColors(geometry.colors)
  mesh.setIndices(new Uint32Array(geometry.indices))
  mesh.update()

  const material = new StandardMaterial()
  material.useLighting = false
  material.useFog = false
  material.diffuse = new Color(0.04, 0.05, 0.04)
  material.opacity = 0.62
  material.blendType = BLEND_NORMAL
  material.depthWrite = false
  material.update()

  const entity = new Entity('selection')
  entity.addComponent('render', { meshInstances: [new MeshInstance(mesh, material)] })
  entity.enabled = false
  app.root.addChild(entity)
  return entity
}

/**
 * 交互控制器
 */
export class Interaction {
  constructor(app, world, player, selection) {
    this.app = app
    this.world = world
    this.player = player
    this.selection = selection
    this.target = null
    this.selectedBlock = BLOCK.GRASS
    this.onChange = null // 破坏 / 放置后的回调
  }

  /** 每帧更新选中方块 */
  update() {
    const origin = this.player.eyePosition
    const dir = this.player.getLookDirection()
    this.target = raycastVoxels(this.world, origin, dir, REACH)

    if (this.target) {
      this.selection.enabled = true
      this.selection.setPosition(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    } else {
      this.selection.enabled = false
    }
  }

  /** 破坏 */
  breakBlock() {
    const t = this.target
    if (!t) return false
    const id = this.world.getBlock(t.x, t.y, t.z)
    if (id === BLOCK.BEDROCK) return false
    if (this.world.setBlock(t.x, t.y, t.z, BLOCK.AIR)) {
      this.onChange?.(t.x, t.y, t.z, BLOCK.AIR, id)
      return true
    }
    return false
  }

  /** 放置 */
  placeBlock() {
    const t = this.target
    if (!t) return false
    const x = t.x + t.nx
    const y = t.y + t.ny
    const z = t.z + t.nz
    const existing = this.world.getBlock(x, y, z)
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER) return false
    if (this.player.intersectsBlock(x, y, z)) return false
    const id = this.selectedBlock
    if (this.world.setBlock(x, y, z, id)) {
      this.onChange?.(x, y, z, id, existing)
      return true
    }
    return false
  }

  /** 中键取色 */
  pickBlock() {
    const t = this.target
    if (!t) return null
    const id = this.world.getBlock(t.x, t.y, t.z)
    if (!BLOCK_INFO[id] || id === BLOCK.AIR) return null
    this.selectedBlock = id
    return id
  }
}
