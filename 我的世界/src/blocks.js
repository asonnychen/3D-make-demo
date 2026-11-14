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
  }
}

def(BLOCK.AIR, '空气', 'air', all('white'), { solid: false, opaque: false })

def(BLOCK.GRASS, '草方块', 'grass', column('grass_top', 'grass_side', 'dirt'))
def(BLOCK.DIRT, '泥土', 'dirt', all('dirt'))
def(BLOCK.STONE, '石头', 'stone', all('stone'))
def(BLOCK.COBBLE, '圆石', 'cobblestone', all('cobble'))
def(BLOCK.SAND, '沙子', 'sand', all('sand'))
def(BLOCK.LOG, '橡木原木', 'oak log', column('log_top', 'log_side', 'log_top'))
def(BLOCK.LEAVES, '橡树树叶', 'oak leaves', all('leaves'))
def(BLOCK.PLANKS, '橡木木板', 'oak planks', all('planks'))
def(BLOCK.GLASS, '玻璃', 'glass', all('glass'), { opaque: false, alpha: true })
def(BLOCK.BRICK, '砖块', 'bricks', all('brick'))
def(BLOCK.WATER, '水', 'water', all('water'), {
  solid: false,
  opaque: false,
  alpha: true,
  liquid: true,
})
def(BLOCK.BEDROCK, '基岩', 'bedrock', all('bedrock'))
def(BLOCK.GLOWSTONE, '荧石', 'glowstone', all('glowstone'), { emissive: true })
def(BLOCK.GRAVEL, '砂砾', 'gravel', all('gravel'))
def(BLOCK.SNOW, '雪块', 'snow', all('snow'))

/** 快捷栏里的九个方块 */
export const HOTBAR = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.COBBLE,
  BLOCK.SAND,
  BLOCK.LOG,
  BLOCK.PLANKS,
  BLOCK.LEAVES,
  BLOCK.GLASS,
]

/** 方块在快捷栏 / 提示里使用的图标面（顶面或侧面） */
export function iconTile(id) {
  const info = BLOCK_INFO[id]
  if (!info) return 'stone'
  return id === BLOCK.GRASS ? 'grass_side' : info.tiles[4]
}

export const isSolid = (id) => !!BLOCK_INFO[id]?.solid
export const isOpaque = (id) => !!BLOCK_INFO[id]?.opaque
export const isAlpha = (id) => !!BLOCK_INFO[id]?.alpha
