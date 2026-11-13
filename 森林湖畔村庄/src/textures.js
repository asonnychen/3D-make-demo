/* ============================================================
   程序化贴图：碎石路、广场铺石、草地细纹（全部用 Canvas 生成）
   ============================================================ */

import * as THREE from 'three'

function makeCanvas(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return { canvas, ctx: canvas.getContext('2d') }
}

function finish(canvas, repeat = 1) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  return tex
}

let cache = null

export function getTextures() {
  if (cache) return cache

  // 草地细纹：接近白色的低对比噪点，乘在顶点色上
  {
    const { canvas, ctx } = makeCanvas(256)
    ctx.fillStyle = '#dcdcd2'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 5200; i++) {
      const g = 200 + Math.random() * 40
      ctx.fillStyle = `rgba(${g},${g + 6},${g - 8},${0.25 + Math.random() * 0.35})`
      const s = 1 + Math.random() * 3
      ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s)
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${120 + Math.random() * 40},${140 + Math.random() * 30},${100 + Math.random() * 20},0.06)`
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 20, 4 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    cache = cache || {}
    cache.grass = finish(canvas, 90)
  }

  // 碎石路
  {
    const { canvas, ctx } = makeCanvas(256)
    ctx.fillStyle = '#c3b191'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      const g = 150 + Math.random() * 80
      ctx.fillStyle = `rgba(${g + 18},${g + 6},${g - 18},${0.35 + Math.random() * 0.45})`
      const s = 0.8 + Math.random() * 2.6
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, Math.random() * 256, s, s * 0.8, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(120,108,88,0.18)`
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 8, 2 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    cache.rubble = finish(canvas, 1)
  }

  // 广场铺石
  {
    const { canvas, ctx } = makeCanvas(256)
    ctx.fillStyle = '#a99c85'
    ctx.fillRect(0, 0, 256, 256)
    const cell = 32
    for (let y = 0; y < 256; y += cell) {
      for (let x = 0; x < 256; x += cell) {
        const jx = (Math.random() - 0.5) * 4
        const jy = (Math.random() - 0.5) * 4
        const g = 168 + Math.random() * 34
        ctx.fillStyle = `rgb(${g + 12},${g + 2},${g - 16})`
        ctx.beginPath()
        ctx.roundRect(x + 2 + jx, y + 2 + jy, cell - 4, cell - 4, 5)
        ctx.fill()
        ctx.strokeStyle = 'rgba(110,100,84,0.35)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,250,235,${Math.random() * 0.06})`
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
    cache.plaza = finish(canvas, 6)
  }

  // 屋顶瓦片
  {
    const { canvas, ctx } = makeCanvas(128)
    ctx.fillStyle = '#b3543c'
    ctx.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 12) {
      for (let x = 0; x < 128; x += 14) {
        const g = 0.82 + Math.random() * 0.3
        ctx.fillStyle = `rgba(${Math.round(178 * g)},${Math.round(82 * g)},${Math.round(58 * g)},1)`
        ctx.beginPath()
        ctx.roundRect(x + (y % 24 === 0 ? 0 : 7) + 1, y + 1, 12, 10, 4)
        ctx.fill()
      }
    }
    cache.roof = finish(canvas, 4)
  }

  return cache
}
