/* ============================================================
   物品表：方块、工具、武器、材料
   - 方块物品的 id 形如 block:3，工具 / 武器形如 pickaxe_stone
   - 工具决定挖掘速度与能否掉落，武器决定攻击伤害
   ============================================================ */

import { BLOCK, BLOCK_INFO } from './blocks.js'

export const TIER_CN = { 1: '木', 2: '石', 3: '铁', 4: '钻石' }

/** 物品注册表：id → 定义 */
export const ITEMS = new Map()

function defItem(def) {
  ITEMS.set(def.id, def)
  return def.id
}

export const itemDef = (id) => ITEMS.get(id) || null

/* ------------------------------------------------------------ 方块物品 */

export const blockItemId = (blockId) => `block:${blockId}`

/** 不能进入背包的方块 */
const NO_ITEM_BLOCKS = new Set([BLOCK.AIR, BLOCK.WATER, BLOCK.BEDROCK])

for (const info of BLOCK_INFO) {
  if (!info || NO_ITEM_BLOCKS.has(info.id)) continue
  defItem({
    id: blockItemId(info.id),
    cn: info.cn,
    en: info.en,
    kind: 'block',
    block: info.id,
    stack: 64,
  })
}

/* ------------------------------------------------------------ 工具 / 武器 */

/** 工具等级：挖掘速度倍率、耐久、攻击伤害 */
const TOOL_MATERIALS = [
  { tier: 1, key: 'wood', cn: '木', color: '#c49a63', dark: '#7a5a34', light: '#e6c391', speed: 2, durability: 60 },
  { tier: 2, key: 'stone', cn: '石', color: '#a6a6a6', dark: '#6f6f6f', light: '#d6d6d6', speed: 4, durability: 132 },
  { tier: 3, key: 'iron', cn: '铁', color: '#dbe0e6', dark: '#8b949c', light: '#ffffff', speed: 6, durability: 250 },
  { tier: 4, key: 'diamond', cn: '钻石', color: '#6fe4d8', dark: '#2fa79c', light: '#b6fff8', speed: 8, durability: 900 },
]

const TOOL_TYPES = [
  { key: 'pickaxe', cn: '镐', en: 'Pickaxe', damage: (tier) => tier + 1, speed: 1 },
  { key: 'axe', cn: '斧', en: 'Axe', damage: (tier) => tier + 2, speed: 0.9 },
  { key: 'shovel', cn: '铲', en: 'Shovel', damage: (tier) => tier, speed: 1 },
  { key: 'sword', cn: '剑', en: 'Sword', damage: (tier) => tier + 3, speed: 0.4 },
]

export const TOOLS = []

for (const type of TOOL_TYPES) {
  for (const mat of TOOL_MATERIALS) {
    const id = `${type.key}_${mat.key}`
    const isSword = type.key === 'sword'
    defItem({
      id,
      cn: `${mat.cn}${type.cn}`,
      en: `${mat.cn === '钻石' ? 'Diamond' : mat.cn === '铁' ? 'Iron' : mat.cn === '石' ? 'Stone' : 'Wooden'} ${type.en}`,
      kind: isSword ? 'weapon' : 'tool',
      stack: 1,
      tool: {
        type: type.key,
        tier: mat.tier,
        speed: mat.speed,
        durability: mat.durability,
        color: mat.color,
        dark: mat.dark,
        light: mat.light,
        mining: type.speed,
      },
      damage: type.damage(mat.tier),
      durability: mat.durability,
    })
    TOOLS.push(id)
  }
}

/* ------------------------------------------------------------ 材料 */

defItem({ id: 'stick', cn: '木棍', en: 'Stick', kind: 'material', stack: 64 })
defItem({ id: 'coal', cn: '煤炭', en: 'Coal', kind: 'material', stack: 64 })
defItem({ id: 'iron_ingot', cn: '铁锭', en: 'Iron Ingot', kind: 'material', stack: 64 })
defItem({ id: 'diamond', cn: '钻石', en: 'Diamond', kind: 'material', stack: 64 })
defItem({ id: 'rotten_flesh', cn: '腐肉', en: 'Rotten Flesh', kind: 'material', stack: 64 })

/* ------------------------------------------------------------ 初始物资 */

/** 新建世界时放进背包的起始装备 */
export const STARTER_KIT = [
  { id: 'sword_wood', count: 1 },
  { id: 'pickaxe_wood', count: 1 },
  { id: blockItemId(BLOCK.PLANKS), count: 8 },
  { id: 'stick', count: 4 },
]

/* ------------------------------------------------------------ 合成表 */

const b = blockItemId

export const RECIPES = [
  { out: b(BLOCK.PLANKS), count: 4, need: [{ id: b(BLOCK.LOG), count: 1 }] },
  { out: 'stick', count: 4, need: [{ id: b(BLOCK.PLANKS), count: 2 }] },

  { out: 'pickaxe_wood', need: [{ id: b(BLOCK.PLANKS), count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'pickaxe_stone', need: [{ id: b(BLOCK.COBBLE), count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'pickaxe_iron', need: [{ id: 'iron_ingot', count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'pickaxe_diamond', need: [{ id: 'diamond', count: 3 }, { id: 'stick', count: 2 }] },

  { out: 'axe_wood', need: [{ id: b(BLOCK.PLANKS), count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'axe_stone', need: [{ id: b(BLOCK.COBBLE), count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'axe_iron', need: [{ id: 'iron_ingot', count: 3 }, { id: 'stick', count: 2 }] },
  { out: 'axe_diamond', need: [{ id: 'diamond', count: 3 }, { id: 'stick', count: 2 }] },

  { out: 'shovel_wood', need: [{ id: b(BLOCK.PLANKS), count: 1 }, { id: 'stick', count: 2 }] },
  { out: 'shovel_stone', need: [{ id: b(BLOCK.COBBLE), count: 1 }, { id: 'stick', count: 2 }] },
  { out: 'shovel_iron', need: [{ id: 'iron_ingot', count: 1 }, { id: 'stick', count: 2 }] },
  { out: 'shovel_diamond', need: [{ id: 'diamond', count: 1 }, { id: 'stick', count: 2 }] },

  { out: 'sword_wood', need: [{ id: b(BLOCK.PLANKS), count: 2 }, { id: 'stick', count: 1 }] },
  { out: 'sword_stone', need: [{ id: b(BLOCK.COBBLE), count: 2 }, { id: 'stick', count: 1 }] },
  { out: 'sword_iron', need: [{ id: 'iron_ingot', count: 2 }, { id: 'stick', count: 1 }] },
  { out: 'sword_diamond', need: [{ id: 'diamond', count: 2 }, { id: 'stick', count: 1 }] },
]

/* ------------------------------------------------------------ 挖掘规则 */

export const toolOf = (itemId) => ITEMS.get(itemId)?.tool || null

/** 空手 / 拿错工具时的额外耗时倍率 */
const WRONG_TOOL_PENALTY = 2.2

/**
 * 挖掉一个方块需要多少秒
 * 硬度为 null 表示不可破坏，返回 Infinity
 */
export function breakTime(blockId, itemId) {
  const info = BLOCK_INFO[blockId]
  if (!info || blockId === BLOCK.AIR) return Infinity
  if (info.hardness === null) return Infinity
  if (info.hardness <= 0) return 0

  const tool = toolOf(itemId)
  const correct = !!tool && tool.type === info.tool
  const speed = correct ? tool.speed * tool.mining : 1
  const penalty = correct ? 1 : WRONG_TOOL_PENALTY
  return Math.max(0.05, (info.hardness * penalty) / speed)
}

/** 当前手持物品能否让这个方块掉落 */
export function canHarvest(blockId, itemId) {
  const info = BLOCK_INFO[blockId]
  if (!info || info.hardness === null) return false
  if (!info.minTier) return true
  const tool = toolOf(itemId)
  return !!tool && tool.type === info.tool && tool.tier >= info.minTier
}

/** 方块破坏后的掉落物 id（null = 不掉落） */
export function dropOf(blockId) {
  const info = BLOCK_INFO[blockId]
  if (!info) return null
  if (info.dropItem) return info.dropItem
  if (info.drop == null) return null
  return blockItemId(info.drop)
}

/** 空手攻击力 */
export const FIST_DAMAGE = 1

/** 手持物品的攻击力 */
export function attackDamage(itemId) {
  const item = ITEMS.get(itemId)
  if (!item) return FIST_DAMAGE
  return item.damage || FIST_DAMAGE
}

/** 工具描述文字 */
export function describeItem(itemId) {
  const item = ITEMS.get(itemId)
  if (!item) return ''
  if (item.tool) {
    const typeCn = { pickaxe: '镐', axe: '斧', shovel: '铲', sword: '剑' }[item.tool.type]
    const kind = item.tool.type === 'sword' ? '武器' : '工具'
    return `${kind} · ${TIER_CN[item.tool.tier]}${typeCn} · 攻击 ${item.damage}`
  }
  if (item.kind === 'block') return '方块'
  return '材料'
}
