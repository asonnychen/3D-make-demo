/* ============================================================
   程序化像素贴图
   所有方块纹理都在浏览器里用 Canvas 逐像素画出来，
   再拼成一张 8×8 的图集（每格 16×16 像素），不加载任何图片文件。
   ============================================================ */

import { mulberry32 } from './noise.js'

export const TILE_PX = 16
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 8

/** 图集里的格子顺序 */
export const TILES = [
  'grass_top',
  'grass_side',
  'dirt',
  'stone',
  'cobble',
  'sand',
  'log_side',
  'log_top',
  'leaves',
  'planks',
  'glass',
  'brick',
  'water',
  'bedrock',
  'glowstone',
  'gravel',
  'snow',
  'white',
]

export const TILE_INDEX = Object.fromEntries(TILES.map((name, i) => [name, i]))

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length]

/* ------------------------------------------------------------ 单格绘制 */

function drawTile(ctx, name, ox, oy) {
  const rand = mulberry32(TILE_INDEX[name] * 7919 + 17)
  const px = (x, y, color) => {
    ctx.fillStyle = color
    ctx.fillRect(ox + x, oy + y, 1, 1)
  }
  const fill = (color) => {
    ctx.fillStyle = color
    ctx.fillRect(ox, oy, TILE_PX, TILE_PX)
  }
  const noiseFill = (palette) => {
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        px(x, y, pick(rand, palette))
      }
    }
  }

  switch (name) {
    case 'grass_top': {
      noiseFill(['#5f9e3f', '#6aab46', '#74b54d', '#568e39', '#7cbd55'])
      for (let i = 0; i < 22; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#4c8132')
      break
    }
    case 'grass_side': {
      noiseFill(['#8a6a46', '#7d5f3e', '#94734e', '#715436'])
      for (let x = 0; x < 16; x++) {
        const depth = 3 + Math.floor(rand() * 3)
        for (let y = 0; y < depth; y++) {
          px(x, y, pick(rand, ['#5f9e3f', '#6aab46', '#74b54d', '#568e39']))
        }
        px(x, depth, '#4c8132')
      }
      break
    }
    case 'dirt': {
      noiseFill(['#8a6a46', '#7d5f3e', '#94734e', '#715436'])
      for (let i = 0; i < 16; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#5f452b')
      break
    }
    case 'stone': {
      noiseFill(['#8d8d8d', '#848484', '#979797', '#7b7b7b'])
      for (let i = 0; i < 5; i++) {
        let x = Math.floor(rand() * 16)
        let y = Math.floor(rand() * 16)
        const len = 3 + Math.floor(rand() * 5)
        for (let k = 0; k < len; k++) {
          px(Math.min(15, x + k), y, '#6f6f6f')
          if (rand() > 0.6) y = Math.min(15, y + 1)
        }
      }
      break
    }
    case 'cobble': {
      fill('#6b6b6b')
      const stones = [
        [1, 1, 6, 5],
        [9, 1, 6, 4],
        [1, 7, 4, 5],
        [6, 6, 4, 4],
        [11, 6, 4, 5],
        [1, 13, 6, 3],
        [8, 11, 7, 5],
      ]
      for (const [x, y, w, h] of stones) {
        const base = pick(rand, ['#909090', '#9c9c9c', '#878787'])
        ctx.fillStyle = base
        ctx.fillRect(ox + x, oy + y, w, h)
        ctx.fillStyle = '#b0b0b0'
        ctx.fillRect(ox + x, oy + y, w, 1)
        ctx.fillStyle = '#757575'
        ctx.fillRect(ox + x, oy + y + h - 1, w, 1)
      }
      break
    }
    case 'sand': {
      noiseFill(['#e3d9a6', '#ded29b', '#e8dfb2', '#d8cb92'])
      for (let i = 0; i < 18; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#c9bb82')
      break
    }
    case 'log_side': {
      for (let x = 0; x < 16; x++) {
        const base = pick(rand, ['#6d4f2b', '#7a5a33', '#5f4525', '#77552f'])
        for (let y = 0; y < 16; y++) px(x, y, rand() > 0.82 ? '#5a3f22' : base)
      }
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(rand() * 11)
        const y = 2 + Math.floor(rand() * 10)
        px(x, y, '#4d351c')
        px(x, y + 1, '#4d351c')
        px(x + 1, y, '#4d351c')
      }
      break
    }
    case 'log_top': {
      fill('#8a6534')
      for (let r = 7; r >= 1; r -= 2) {
        ctx.fillStyle = r % 4 === 1 ? '#a87c44' : '#8a6534'
        ctx.fillRect(ox + 8 - r, oy + 8 - r, r * 2, r * 2)
      }
      ctx.fillStyle = '#5f4525'
      ctx.fillRect(ox + 7, oy + 7, 2, 2)
      break
    }
    case 'leaves': {
      noiseFill(['#2f6b2a', '#387a30', '#458a39', '#26591f', '#3f8034'])
      for (let i = 0; i < 26; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#1d4718')
      for (let i = 0; i < 10; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#4f9440')
      break
    }
    case 'planks': {
      for (let y = 0; y < 16; y++) {
        const board = Math.floor(y / 4)
        const base = ['#b08a55', '#a9814f', '#b6905c', '#a37b4a'][board]
        for (let x = 0; x < 16; x++) px(x, y, rand() > 0.9 ? '#9c7444' : base)
        if (y % 4 === 3) for (let x = 0; x < 16; x++) px(x, y, '#7a5a34')
      }
      for (let b = 0; b < 4; b++) {
        const x = 3 + ((b * 5) % 11)
        px(x, b * 4 + 1, '#8a6a3c')
        px(x, b * 4 + 2, '#8a6a3c')
      }
      break
    }
    case 'glass': {
      ctx.clearRect(ox, oy, TILE_PX, TILE_PX)
      ctx.fillStyle = 'rgba(196, 232, 240, 0.20)'
      ctx.fillRect(ox, oy, 16, 16)
      ctx.fillStyle = 'rgba(226, 246, 250, 0.75)'
      ctx.fillRect(ox, oy, 16, 1)
      ctx.fillRect(ox, oy + 15, 16, 1)
      ctx.fillRect(ox, oy, 1, 16)
      ctx.fillRect(ox + 15, oy, 1, 16)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.fillRect(ox + 3, oy + 3, 4, 1)
      ctx.fillRect(ox + 2, oy + 4, 1, 3)
      ctx.fillRect(ox + 9, oy + 10, 4, 1)
      ctx.fillRect(ox + 12, oy + 6, 1, 3)
      break
    }
    case 'brick': {
      fill('#c2b6a3')
      for (let row = 0; row < 4; row++) {
        const y = row * 4
        const offset = row % 2 === 0 ? 0 : 4
        for (let col = -1; col < 2; col++) {
          const x = offset + col * 8
          const color = pick(rand, ['#9d4a3c', '#a85445', '#8f4235', '#b05a4a'])
          ctx.fillStyle = color
          ctx.fillRect(ox + Math.max(0, x), oy + y, Math.min(8, 16 - Math.max(0, x)) - 1, 3)
        }
      }
      break
    }
    case 'water': {
      ctx.clearRect(ox, oy, TILE_PX, TILE_PX)
      ctx.fillStyle = 'rgba(42, 96, 176, 0.76)'
      ctx.fillRect(ox, oy, 16, 16)
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(rand() * 16)
        const y = Math.floor(rand() * 16)
        ctx.fillStyle = rand() > 0.5 ? 'rgba(96, 156, 226, 0.55)' : 'rgba(30, 74, 146, 0.5)'
        ctx.fillRect(ox + x, oy + y, 2, 1)
      }
      break
    }
    case 'bedrock': {
      noiseFill(['#3a3a3a', '#2e2e2e', '#4a4a4a', '#222222', '#414141'])
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(rand() * 15)
        const y = Math.floor(rand() * 15)
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(ox + x, oy + y, 2, 2)
      }
      break
    }
    case 'glowstone': {
      noiseFill(['#c9a24a', '#d8b45c', '#b9923f', '#e6c674'])
      for (let i = 0; i < 24; i++) {
        const x = Math.floor(rand() * 16)
        const y = Math.floor(rand() * 16)
        ctx.fillStyle = pick(rand, ['#ffe9a0', '#fff2bd', '#f7d97c'])
        ctx.fillRect(ox + x, oy + y, 2, 2)
      }
      break
    }
    case 'gravel': {
      noiseFill(['#8b8b8b', '#7a7268', '#9a9187', '#6d655c', '#857c72'])
      for (let i = 0; i < 20; i++) {
        const x = Math.floor(rand() * 15)
        const y = Math.floor(rand() * 15)
        ctx.fillStyle = pick(rand, ['#5f574e', '#a8a29a', '#726a60'])
        ctx.fillRect(ox + x, oy + y, 2, 2)
      }
      break
    }
    case 'snow': {
      noiseFill(['#f4f8ff', '#e9f1fb', '#ffffff', '#dce7f5'])
      for (let i = 0; i < 12; i++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), '#c9d8ec')
      break
    }
    case 'white':
    default: {
      fill('#ffffff')
      break
    }
  }
}

/* ------------------------------------------------------------ 图集 */

/**
 * 生成方块图集
 * @returns {{ canvas: HTMLCanvasElement, tileUV: (name: string) => [number, number, number, number] }}
 */
export function createAtlas() {
  const size = TILE_PX * ATLAS_COLS
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = TILE_PX * ATLAS_ROWS
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  TILES.forEach((name, i) => {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    drawTile(ctx, name, col * TILE_PX, row * TILE_PX)
  })

  const inset = 0.5 / canvas.width
  const tileUV = (name) => {
    const i = TILE_INDEX[name] ?? 0
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const u0 = col / ATLAS_COLS + inset
    const u1 = (col + 1) / ATLAS_COLS - inset
    // 纹理坐标 v=0 在画布顶部，行号直接映射即可
    const v0 = row / ATLAS_ROWS + inset
    const v1 = (row + 1) / ATLAS_ROWS - inset
    return [u0, v0, u1, v1]
  }

  return { canvas, tileUV }
}

/** 从图集里裁出单独一格（给远海平面之类的重复贴图用） */
export function extractTile(atlasCanvas, name) {
  const index = TILE_INDEX[name] ?? 0
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PX
  canvas.height = TILE_PX
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(atlasCanvas, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX)
  return canvas
}

/* ------------------------------------------------------------ 云层贴图 */
/** 可平铺的云朵贴图（含透明度） */
export function createCloudTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(90210)

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'

  // 用一圈椭圆拼出云团，并做 9 宫格重复，保证平铺无缝
  const blobs = 20
  for (let i = 0; i < blobs; i++) {
    const bx = rand() * size
    const by = rand() * size
    const rx = 14 + rand() * 26
    const ry = 8 + rand() * 16
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        ctx.globalAlpha = 0.7 + rand() * 0.3
        ctx.beginPath()
        ctx.ellipse(bx + ox * size, by + oy * size, rx, ry, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1

  // 抹掉过实的区域，留下蓬松边缘
  const img = ctx.getImageData(0, 0, size, size)
  const data = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const a = data[i + 3] / 255
      data[i + 3] = Math.round(Math.max(0, Math.min(1, (a - 0.62) * 3.4)) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
