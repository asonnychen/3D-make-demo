/* ============================================================
   方块定义
   tiles 顺序固定为：+X, -X, +Y(顶), -Y(底), +Z, -Z
   ============================================================ */

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  LOG: 6,
  LEAVES: 7,
  PLANKS: 8,
  GLASS: 9,
  BRICK: 10,
  WATER: 11,
  BEDROCK: 12,
  GLOWSTONE: 13,
  GRAVEL: 14,
  SNOW: 15,
  COAL_ORE: 16,
  IRON_ORE: 17,
  DIAMOND_ORE: 18,
}

/** 六面同图 */
const all = (t) => [t, t, t, t, t, t]
/** 顶 / 侧 / 底 */
const column = (top, side, bottom) => [side, side, top, bottom, side, side]

/**
 * 方块表（索引即方块 id）
 * - solid：是否阻挡玩家
 * - opaque：是否遮挡相邻面 / 遮挡光线
 * - alpha：是否进入半透明网格（玻璃、水）
 * - emissive：自发光（不受方向光影响）
 * - hardness：挖掘硬度（0 = 瞬间破坏，null = 不可破坏）
 * - tool：对应工具类型（pickaxe 镐 / axe 斧 / shovel 铲）
 * - minTier：掉落所需的最低工具等级（1 木 2 石 3 铁 4 钻石）
 * - drop：破坏后掉落的方块 id（默认掉落自身）
 * - dropItem：破坏后掉落的物品 id（优先级高于 drop）
 */
export const BLOCK_INFO = []

function def(id, cn, en, tiles, opts = {}) {
  BLOCK_INFO[id] = {
    id,
    cn,
    en,
    tiles,
    solid: opts.solid !== false,
    opaque: opts.opaque !== false,
    alpha: !!opts.alpha,
    emissive: !!opts.emissive,
    liquid: !!opts.liquid,
    hardness: opts.hardness === undefined ? 1 : opts.hardness,
    tool: opts.tool || null,
    minTier: opts.minTier || 0,
    drop: opts.drop === undefined ? id : opts.drop,
    dropItem: opts.dropItem || null,
  }
}

def(BLOCK.AIR, '空气', 'air', all('white'), {
  solid: false,
  opaque: false,
  hardness: 0,
  drop: null,
})

def(BLOCK.GRASS, '草方块', 'grass', column('grass_top', 'grass_side', 'dirt'), {
  hardness: 0.6,
  tool: 'shovel',
  drop: BLOCK.DIRT,
})
def(BLOCK.DIRT, '泥土', 'dirt', all('dirt'), { hardness: 0.5, tool: 'shovel' })
def(BLOCK.STONE, '石头', 'stone', all('stone'), {
  hardness: 1.5,
  tool: 'pickaxe',
  minTier: 1,
  drop: BLOCK.COBBLE,
})
def(BLOCK.COBBLE, '圆石', 'cobblestone', all('cobble'), {
  hardness: 2,
  tool: 'pickaxe',
  minTier: 1,
})
def(BLOCK.SAND, '沙子', 'sand', all('sand'), { hardness: 0.5, tool: 'shovel' })
def(BLOCK.LOG, '橡木原木', 'oak log', column('log_top', 'log_side', 'log_top'), {
  hardness: 2,
  tool: 'axe',
})
def(BLOCK.LEAVES, '橡树树叶', 'oak leaves', all('leaves'), {
  hardness: 0.2,
  tool: 'axe',
  drop: null,
})
def(BLOCK.PLANKS, '橡木木板', 'oak planks', all('planks'), {
  hardness: 2,
  tool: 'axe',
})
def(BLOCK.GLASS, '玻璃', 'glass', all('glass'), {
  opaque: false,
  alpha: true,
  hardness: 0.3,
  drop: null,
})
def(BLOCK.BRICK, '砖块', 'bricks', all('brick'), {
  hardness: 2,
  tool: 'pickaxe',
  minTier: 1,
})
def(BLOCK.WATER, '水', 'water', all('water'), {
  solid: false,
  opaque: false,
  alpha: true,
  liquid: true,
  hardness: null,
  drop: null,
})
def(BLOCK.BEDROCK, '基岩', 'bedrock', all('bedrock'), { hardness: null, drop: null })
def(BLOCK.GLOWSTONE, '荧石', 'glowstone', all('glowstone'), {
  emissive: true,
  hardness: 0.3,
  tool: 'pickaxe',
})
def(BLOCK.GRAVEL, '砂砾', 'gravel', all('gravel'), { hardness: 0.6, tool: 'shovel' })
def(BLOCK.SNOW, '雪块', 'snow', all('snow'), { hardness: 0.2, tool: 'shovel' })

def(BLOCK.COAL_ORE, '煤矿石', 'coal ore', all('coal_ore'), {
  hardness: 3,
  tool: 'pickaxe',
  minTier: 1,
  drop: null,
  dropItem: 'coal',
})
def(BLOCK.IRON_ORE, '铁矿石', 'iron ore', all('iron_ore'), {
  hardness: 3,
  tool: 'pickaxe',
  minTier: 2,
  drop: null,
  dropItem: 'iron_ingot',
})
def(BLOCK.DIAMOND_ORE, '钻石矿石', 'diamond ore', all('diamond_ore'), {
  hardness: 3,
  tool: 'pickaxe',
  minTier: 3,
  drop: null,
  dropItem: 'diamond',
})

/** 方块在快捷栏 / 提示里使用的图标面（顶面或侧面） */
export function iconTile(id) {
  const info = BLOCK_INFO[id]
  if (!info) return 'stone'
  return id === BLOCK.GRASS ? 'grass_side' : info.tiles[4]
}

export const isSolid = (id) => !!BLOCK_INFO[id]?.solid
export const isOpaque = (id) => !!BLOCK_INFO[id]?.opaque
export const isAlpha = (id) => !!BLOCK_INFO[id]?.alpha
export const isBreakable = (id) => {
  const info = BLOCK_INFO[id]
  return !!info && id !== BLOCK.AIR && info.hardness !== null
}
