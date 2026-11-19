import { makePixelTitle } from './lib/pixelFont.js'

// 低分辨率画布 → 放大后得到像素月面
const SMALL_SCREEN = window.innerWidth < 860
const BUFFER_W = SMALL_SCREEN ? 180 : 420
const BUFFER_H = Math.round(BUFFER_W * 0.56)

function rand(seedRef) {
  seedRef.value = (seedRef.value * 1103515245 + 12345) % 2147483648
  return seedRef.value / 2147483648
}

function drawMoonCanvas(canvas) {
  canvas.width = BUFFER_W
  canvas.height = BUFFER_H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  // 深空底色
  const bg = ctx.createLinearGradient(0, 0, BUFFER_W, BUFFER_H)
  bg.addColorStop(0, '#05070b')
  bg.addColorStop(0.55, '#080b10')
  bg.addColorStop(1, '#030407')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, BUFFER_W, BUFFER_H)

  const seed = { value: 987654321 }
  // 星点
  for (let i = 0; i < 120; i += 1) {
    const x = Math.floor(rand(seed) * BUFFER_W)
    const y = Math.floor(rand(seed) * BUFFER_H)
    const a = 0.18 + rand(seed) * 0.65
    ctx.fillStyle = `rgba(226,234,244,${a.toFixed(2)})`
    ctx.fillRect(x, y, 1, 1)
    if (rand(seed) > 0.94) {
      ctx.fillStyle = 'rgba(226,234,244,0.28)'
      ctx.fillRect(x - 1, y, 3, 1)
      ctx.fillRect(x, y - 1, 1, 3)
    }
  }

  const cx = BUFFER_W * 0.685
  const cy = BUFFER_H * 0.47
  const R = BUFFER_H * 0.345

  // 月球本体
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()

  const base = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.45, R * 0.1, cx, cy, R * 1.15)
  base.addColorStop(0, '#d8d4cb')
  base.addColorStop(0.55, '#b3aea4')
  base.addColorStop(0.86, '#7c7871')
  base.addColorStop(1, '#3c3a37')
  ctx.fillStyle = base
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // 月海
  const maria = [
    [-0.28, -0.12, 0.42, 0.3, 0.5],
    [0.02, -0.3, 0.3, 0.22, 0.42],
    [0.18, 0.1, 0.34, 0.26, 0.38],
    [-0.1, 0.3, 0.24, 0.18, 0.3],
    [0.36, -0.2, 0.2, 0.16, 0.28],
  ]
  for (const [mx, my, rx, ry, alpha] of maria) {
    const g = ctx.createRadialGradient(cx + mx * R, cy + my * R, 1, cx + mx * R, cy + my * R, rx * R)
    g.addColorStop(0, `rgba(58,56,54,${alpha})`)
    g.addColorStop(0.7, `rgba(70,68,65,${alpha * 0.6})`)
    g.addColorStop(1, 'rgba(70,68,65,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx + mx * R, cy + my * R, rx * R * 1.5, ry * R * 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 陨石坑
  for (let i = 0; i < 90; i += 1) {
    const ang = rand(seed) * Math.PI * 2
    const dist = Math.sqrt(rand(seed)) * R * 0.94
    const px = cx + Math.cos(ang) * dist
    const py = cy + Math.sin(ang) * dist
    const pr = 1.2 + Math.pow(rand(seed), 2.4) * R * 0.17
    const shade = 0.25 + rand(seed) * 0.35
    // 坑体
    const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr)
    g.addColorStop(0, `rgba(30,29,28,${shade})`)
    g.addColorStop(0.62, `rgba(48,46,44,${shade * 0.6})`)
    g.addColorStop(0.8, `rgba(236,233,225,${shade * 0.55})`)
    g.addColorStop(1, 'rgba(236,233,225,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }

  // 像素噪点，强化颗粒感
  for (let i = 0; i < 900; i += 1) {
    const ang = rand(seed) * Math.PI * 2
    const dist = Math.sqrt(rand(seed)) * R
    const px = Math.floor(cx + Math.cos(ang) * dist)
    const py = Math.floor(cy + Math.sin(ang) * dist)
    const lum = rand(seed)
    ctx.fillStyle = lum > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
    ctx.fillRect(px, py, 1, 1)
  }

  // 明暗交界：光来自左上，右下没入黑暗
  const term = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
  term.addColorStop(0, 'rgba(255,255,255,0.07)')
  term.addColorStop(0.45, 'rgba(0,0,0,0)')
  term.addColorStop(0.72, 'rgba(0,0,0,0.42)')
  term.addColorStop(1, 'rgba(0,0,0,0.86)')
  ctx.fillStyle = term
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // 边缘环形山的一圈亮边
  const rim = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R)
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(0.85, 'rgba(255,255,255,0.09)')
  rim.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.fillStyle = rim
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
  ctx.restore()

  // 像素化后处理：把月面灰度压成有限色阶，强化像素质感
  const image = ctx.getImageData(0, 0, BUFFER_W, BUFFER_H)
  const data = image.data
  for (let y = 0; y < BUFFER_H; y += 1) {
    for (let x = 0; x < BUFFER_W; x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > R * R) continue
      const i = (y * BUFFER_W + x) * 4
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      const stepped = Math.round(lum / 16) * 16
      const ratio = lum > 1 ? Math.min(2.4, stepped / lum) : 0
      data[i] = Math.min(255, data[i] * ratio)
      data[i + 1] = Math.min(255, data[i + 1] * ratio)
      data[i + 2] = Math.min(255, data[i + 2] * ratio)
    }
  }
  ctx.putImageData(image, 0, 0)
}

function paintTitle(canvas, text, scale, color) {
  const source = makePixelTitle(text, { scale, color, gap: 1 })
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)
  return { width: source.width, height: source.height }
}

export function initIntro(onEnter) {
  const intro = document.getElementById('intro')
  const canvas = document.getElementById('intro-canvas')
  const titleCanvas = document.getElementById('intro-title')
  const brandCanvas = document.getElementById('brand-title')

  drawMoonCanvas(canvas)
  paintTitle(titleCanvas, 'SOLAR SYSTEM', 5, '#f3f5f8')
  paintTitle(brandCanvas, 'SOLAR SYSTEM', 2, '#e8ebf0')

  let entered = false
  const enter = () => {
    if (entered) return
    entered = true
    intro.classList.add('is-leaving')
    intro.setAttribute('aria-hidden', 'true')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        intro.hidden = true
      },
      reduce ? 0 : 720,
    )
    onEnter()
  }

  intro.addEventListener('click', enter)
  document.getElementById('intro-enter').addEventListener('click', (e) => {
    e.stopPropagation()
    enter()
  })

  const onKey = (e) => {
    if (entered) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      enter()
    }
  }
  window.addEventListener('keydown', onKey)

  return { enter, isEntered: () => entered }
}
