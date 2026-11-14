/* ============================================================
   方块交互：体素射线拾取（DDA）、按工具计算挖掘时间、
   破坏掉落、放置消耗、选中描边
   ============================================================ */

import { Color, Entity, Mesh, MeshInstance, StandardMaterial, BLEND_NORMAL } from 'playcanvas'
import { REACH } from './config.js'
import { BLOCK, BLOCK_INFO, isSolid, isBreakable } from './blocks.js'
import { ITEMS, breakTime, canHarvest, dropOf } from './items.js'
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
  constructor(app, world, player, selection, inventory) {
    this.app = app
    this.world = world
    this.player = player
    this.selection = selection
    this.inventory = inventory

    this.target = null
    this.activeSlot = 0
    this.mining = false
    this.progress = 0
    this.miningKey = ''
    this._lastHeld = null

    this.onChange = null // 方块变化（破坏 / 放置）
    this.onPickup = null // 捡到掉落物
    this.onToolBreak = null // 工具耐久耗尽
    this.onSwing = null // 挥手动画
  }

  get heldItem() {
    return this.inventory?.get(this.activeSlot)?.id ?? null
  }

  /** 每帧更新选中方块与挖掘进度 */
  update(dt = 0) {
    const origin = this.player.eyePosition
    const dir = this.player.getLookDirection()
    this.target = raycastVoxels(this.world, origin, dir, REACH)

    if (this.target) {
      this.selection.enabled = true
      this.selection.setPosition(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    } else {
      this.selection.enabled = false
    }

    // 换手 / 换目标时进度归零
    const held = this.heldItem
    if (held !== this._lastHeld) {
      this._lastHeld = held
      this.progress = 0
      this.miningKey = ''
    }

    if (!this.mining || !this.target) {
      this.progress = 0
      return
    }

    const id = this.world.getBlock(this.target.x, this.target.y, this.target.z)
    if (!isBreakable(id)) {
      this.progress = 0
      return
    }

    const key = `${this.target.x},${this.target.y},${this.target.z}`
    if (key !== this.miningKey) {
      this.miningKey = key
      this.progress = 0
    }

    const time = breakTime(id, held)
    if (!Number.isFinite(time)) {
      this.progress = 0
      return
    }

    this.progress += dt / time
    if (this.progress >= 1) {
      this.progress = 0
      this.breakBlock()
    }
  }

  beginMine() {
    this.mining = true
  }

  endMine() {
    this.mining = false
    this.progress = 0
  }

  /** 破坏 */
  breakBlock() {
    const t = this.target
    if (!t) return false
    const id = this.world.getBlock(t.x, t.y, t.z)
    if (!isBreakable(id)) return false

    const held = this.heldItem
    if (!this.world.setBlock(t.x, t.y, t.z, BLOCK.AIR)) return false

    this.onChange?.(t.x, t.y, t.z, BLOCK.AIR, id)

    // 掉落物
    if (canHarvest(id, held)) {
      const drop = dropOf(id)
      if (drop) {
        const left = this.inventory.add(drop, 1)
        this.onPickup?.(drop, 1, left === 0)
      }
    }

    this.useDurability(1)
    this.onSwing?.()
    return true
  }

  /** 放置：消耗快捷栏里的一格方块 */
  placeBlock() {
    const t = this.target
    if (!t) return false
    const stack = this.inventory.get(this.activeSlot)
    if (!stack) return false
    const item = ITEMS.get(stack.id)
    if (!item || item.kind !== 'block') return false

    const x = t.x + t.nx
    const y = t.y + t.ny
    const z = t.z + t.nz
    const existing = this.world.getBlock(x, y, z)
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER) return false
    if (this.player.intersectsBlock(x, y, z)) return false

    if (this.world.setBlock(x, y, z, item.block)) {
      this.inventory.consumeSlot(this.activeSlot, 1)
      this.onChange?.(x, y, z, item.block, existing)
      this.onSwing?.()
      return true
    }
    return false
  }

  /** 中键取色：只有背包里有这个方块才能选中 */
  pickBlock() {
    const t = this.target
    if (!t) return null
    const id = this.world.getBlock(t.x, t.y, t.z)
    if (!BLOCK_INFO[id] || id === BLOCK.AIR) return null
    return this.inventory.findSlotOf(`block:${id}`)
  }

  /** 消耗工具耐久 */
  useDurability(amount = 1) {
    const stack = this.inventory.get(this.activeSlot)
    if (!stack) return
    const item = ITEMS.get(stack.id)
    if (item?.durability == null || stack.durability == null) return
    stack.durability -= amount
    if (stack.durability <= 0) {
      this.inventory.set(this.activeSlot, null)
      this.onToolBreak?.(item)
    } else {
      this.inventory.emit()
    }
  }
}
