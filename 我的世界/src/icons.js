/* ============================================================
   物品图标：方块用图集裁切，工具 / 武器 / 材料用像素画
   全部在 Canvas 上现画，输出 48×48 的 dataURL 或 canvas
   ============================================================ */

import { TILE_INDEX, TILE_PX, ATLAS_COLS } from './textures.js'
import { BLOCK_INFO, iconTile } from './blocks.js'
import { ITEMS } from './items.js'

const ICON_PX = 48
const SRC_PX = 16

/** 描边色 */
const OUTLINE = [22, 20, 17, 255]

/* ------------------------------------------------------------ 基础绘制 */

function makeCanvas(size = SRC_PX) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

const px = (ctx, x, y, color) => {
  if (x < 0 || y < 0 || x >= SRC_PX || y >= SRC_PX) return
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

/** 水平线段（含两端） */
function hspan(ctx, x0, x1, y, color) {
  for (let x = x0; x <= x1; x++) px(ctx, x, y, color)
}

/** Bresenham 直线，width 为方形笔头边长 */
function line(ctx, x0, y0, x1, y1, color, width = 1) {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const ex = Math.round(x1)
  const ey = Math.round(y1)
  const dx = Math.abs(ex - x)
  const dy = -Math.abs(ey - y)
  const sx = x < ex ? 1 : -1
  const sy = y < ey ? 1 : -1
  let err = dx + dy
  const half = Math.floor((width - 1) / 2)
  while (true) {
    for (let oy = 0; oy < width; oy++) {
      for (let ox = 0; ox < width; ox++) {
        px(ctx, x + ox - half, y + oy - half, color)
      }
    }
    if (x === ex && y === ey) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** 在 16×16 上画好后自动加一圈 1px 深色描边，再放大到 48×48 */
function outlined(draw) {
  const { canvas: src, ctx } = makeCanvas()
  draw(ctx)

  const data = ctx.getImageData(0, 0, SRC_PX, SRC_PX).data
  const on = (x, y) => x >= 0 && y >= 0 && x < SRC_PX && y < SRC_PX && data[(y * SRC_PX + x) * 4 + 3] > 0

  const { canvas: edge, ctx: ectx } = makeCanvas()
  const img = ectx.createImageData(SRC_PX, SRC_PX)
  for (let y = 0; y < SRC_PX; y++) {
    for (let x = 0; x < SRC_PX; x++) {
      if (on(x, y)) continue
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        const i = (y * SRC_PX + x) * 4
        img.data[i] = OUTLINE[0]
        img.data[i + 1] = OUTLINE[1]
        img.data[i + 2] = OUTLINE[2]
        img.data[i + 3] = OUTLINE[3]
      }
    }
  }
  ectx.putImageData(img, 0, 0)

  const { canvas: out, ctx: octx } = makeCanvas(ICON_PX)
  octx.imageSmoothingEnabled = false
  octx.drawImage(edge, 0, 0, ICON_PX, ICON_PX)
  octx.drawImage(src, 0, 0, ICON_PX, ICON_PX)
  return out
}

/* ------------------------------------------------------------ 工具形状 */

/** 统一配色：柄是浅蓝色，镐头 / 斧刃 / 铲面 / 剑身是银白色 */
const HANDLE = '#9ed0f5'
const HANDLE_LIGHT = '#d4ecff'
const METAL = '#e8eef5'
const METAL_DARK = '#a4aeba'
const METAL_LIGHT = '#ffffff'

function drawPickaxe(ctx, metal, dark, light) {
  // 柄：从左下伸到镐头中间
  line(ctx, 4, 14, 10, 3, HANDLE, 2)
  line(ctx, 5, 13, 10, 4, HANDLE_LIGHT, 1)
  // 镐头：中间厚、两端下垂的弧形
  hspan(ctx, 5, 10, 1, metal)
  hspan(ctx, 3, 12, 2, metal)
  hspan(ctx, 2, 13, 3, metal)
  hspan(ctx, 1, 3, 4, metal)
  hspan(ctx, 13, 15, 4, metal)
  hspan(ctx, 1, 2, 5, dark)
  hspan(ctx, 14, 15, 5, dark)
  // 高光
  px(ctx, 6, 1, light)
  px(ctx, 7, 1, light)
  px(ctx, 4, 2, light)
  px(ctx, 3, 3, light)
}

function drawAxe(ctx, metal, dark, light) {
  // 柄：从左下伸到斧头右侧
  line(ctx, 4, 14, 11, 4, HANDLE, 2)
  line(ctx, 5, 13, 11, 5, HANDLE_LIGHT, 1)
  // 斧头：贴在柄右侧的厚楔形，右边是垂直刃口
  hspan(ctx, 9, 12, 1, metal)
  hspan(ctx, 8, 14, 2, metal)
  hspan(ctx, 8, 15, 3, metal)
  hspan(ctx, 8, 15, 4, metal)
  hspan(ctx, 8, 14, 5, metal)
  hspan(ctx, 9, 13, 6, metal)
  hspan(ctx, 11, 12, 7, dark)
  // 刃口高光
  hspan(ctx, 14, 15, 2, light)
  hspan(ctx, 14, 15, 3, light)
  px(ctx, 9, 1, light)
}

function drawShovel(ctx, metal, dark, light) {
  // 柄：从左下伸到铲面底部
  line(ctx, 4, 14, 10, 6, HANDLE, 2)
  line(ctx, 5, 13, 10, 7, HANDLE_LIGHT, 1)
  // 铲面：上宽下窄的圆角铲头
  hspan(ctx, 9, 13, 2, metal)
  hspan(ctx, 8, 14, 3, metal)
  hspan(ctx, 8, 14, 4, metal)
  hspan(ctx, 8, 14, 5, metal)
  hspan(ctx, 9, 13, 6, metal)
  hspan(ctx, 10, 12, 7, metal)
  hspan(ctx, 11, 11, 8, dark)
  // 高光
  hspan(ctx, 10, 12, 3, light)
  hspan(ctx, 10, 12, 4, light)
}

function drawSword(ctx, metal, dark, light) {
  // 剑身：左下到右上，3px 宽
  line(ctx, 5, 10, 11, 4, metal, 3)
  line(ctx, 6, 10, 11, 5, light, 1)
  px(ctx, 12, 3, metal)
  px(ctx, 13, 2, dark)
  // 护手：与剑身垂直的横条
  line(ctx, 3, 7, 6, 10, dark, 2)
  // 剑柄
  line(ctx, 4, 11, 2, 13, HANDLE, 2)
  px(ctx, 1, 14, dark)
}

/* ------------------------------------------------------------ 材料形状 */

function drawStick(ctx) {
  line(ctx, 4, 12, 11, 5, HANDLE, 2)
  line(ctx, 4, 12, 11, 5, HANDLE_LIGHT, 1)
}

function drawCoal(ctx) {
  hspan(ctx, 6, 9, 3, '#3a3a40')
  hspan(ctx, 4, 11, 4, '#2c2c31')
  hspan(ctx, 3, 12, 5, '#26262b')
  hspan(ctx, 2, 13, 6, '#26262b')
  hspan(ctx, 2, 13, 7, '#26262b')
  hspan(ctx, 2, 13, 8, '#26262b')
  hspan(ctx, 3, 12, 9, '#2c2c31')
  hspan(ctx, 4, 11, 10, '#2c2c31')
  hspan(ctx, 6, 9, 11, '#3a3a40')
  px(ctx, 4, 5, '#5a5a62')
  px(ctx, 5, 6, '#5a5a62')
  px(ctx, 10, 7, '#4a4a52')
  px(ctx, 6, 9, '#4a4a52')
}

function drawIngot(ctx, metal, dark) {
  hspan(ctx, 4, 11, 4, metal)
  hspan(ctx, 2, 13, 5, metal)
  hspan(ctx, 2, 13, 6, metal)
  hspan(ctx, 2, 13, 7, metal)
  hspan(ctx, 3, 12, 8, dark)
  hspan(ctx, 4, 11, 9, dark)
  hspan(ctx, 5, 10, 10, dark)
  px(ctx, 4, 5, '#ffffff')
  px(ctx, 5, 5, '#ffffff')
  px(ctx, 6, 5, '#ffffff')
}

function drawDiamond(ctx) {
  hspan(ctx, 7, 8, 2, '#9ffaf4')
  hspan(ctx, 5, 10, 3, '#6fe4d8')
  hspan(ctx, 3, 12, 4, '#6fe4d8')
  hspan(ctx, 3, 12, 5, '#6fe4d8')
  hspan(ctx, 4, 11, 6, '#38d6cf')
  hspan(ctx, 5, 10, 7, '#38d6cf')
  hspan(ctx, 6, 9, 8, '#2fa79c')
  hspan(ctx, 7, 8, 9, '#2fa79c')
  px(ctx, 5, 4, '#ffffff')
  px(ctx, 6, 4, '#ffffff')
  px(ctx, 4, 5, '#ffffff')
}

function drawFlesh(ctx) {
  hspan(ctx, 6, 9, 3, '#8a4a3a')
  hspan(ctx, 4, 11, 4, '#7a4234')
  hspan(ctx, 3, 12, 5, '#8a4a3a')
  hspan(ctx, 3, 12, 6, '#7a4234')
  hspan(ctx, 4, 11, 7, '#8a4a3a')
  hspan(ctx, 4, 10, 8, '#7a4234')
  hspan(ctx, 5, 9, 9, '#6b3a2c')
  hspan(ctx, 6, 8, 10, '#5c3226')
  px(ctx, 5, 5, '#b06a52')
  px(ctx, 10, 6, '#b06a52')
  px(ctx, 7, 7, '#5c3226')
  px(ctx, 6, 8, '#b06a52')
}

/* ------------------------------------------------------------ 图标工厂 */

export function createIcons(atlas) {
  const cache = new Map()

  function blockCanvas(blockId) {
    const index = TILE_INDEX[iconTile(blockId)] ?? 0
    const col = index % ATLAS_COLS
    const row = Math.floor(index / ATLAS_COLS)
    const { canvas, ctx } = makeCanvas(ICON_PX)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      atlas.canvas,
      col * TILE_PX,
      row * TILE_PX,
      TILE_PX,
      TILE_PX,
      0,
      0,
      ICON_PX,
      ICON_PX,
    )
    return canvas
  }

  function itemCanvas(itemId) {
    if (cache.has(itemId)) return cache.get(itemId)
    const item = ITEMS.get(itemId)
    if (!item) return null

    let canvas
    if (item.kind === 'block') {
      canvas = blockCanvas(item.block)
    } else if (item.tool) {
      const draw = {
        pickaxe: drawPickaxe,
        axe: drawAxe,
        shovel: drawShovel,
        sword: drawSword,
      }[item.tool.type]
      // 所有档位统一：银白色金属部分 + 浅蓝色手柄
      canvas = outlined((ctx) => draw(ctx, METAL, METAL_DARK, METAL_LIGHT))
    } else {
      const draw = {
        stick: drawStick,
        coal: drawCoal,
        iron_ingot: (ctx) => drawIngot(ctx, '#d8dde2', '#9aa2aa'),
        diamond: drawDiamond,
        rotten_flesh: drawFlesh,
      }[itemId]
      canvas = draw ? outlined(draw) : outlined((ctx) => drawCoal(ctx))
    }

    cache.set(itemId, canvas)
    return canvas
  }

  const urlCache = new Map()
  function itemURL(itemId) {
    if (urlCache.has(itemId)) return urlCache.get(itemId)
    const canvas = itemCanvas(itemId)
    const url = canvas ? canvas.toDataURL() : ''
    urlCache.set(itemId, url)
    return url
  }

  /** 方块 id → 图标（选中描边、调试用） */
  function blockURL(blockId) {
    const item = BLOCK_INFO[blockId]
    if (!item) return ''
    return itemURL(`block:${blockId}`)
  }

  return { itemCanvas, itemURL, blockURL }
}
