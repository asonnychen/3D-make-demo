import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BALL_R, HALF_L, HALF_W, POCKETS, BALL_COLORS, RAIL_GAP_CORNER, RAIL_GAP_SIDE } from './constants.js'

// ---------- 纹理工具 ----------
function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 8
  return texture
}

function makeWoodTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a150c'
    ctx.fillRect(0, 0, w, h)
    const plankW = 64
    for (let i = 0; i < w / plankW; i++) {
      const shade = 30 + Math.random() * 16
      ctx.fillStyle = `rgb(${shade + 16}, ${shade * 0.62 + 8}, ${shade * 0.42 + 4})`
      ctx.fillRect(i * plankW, 0, plankW - 2, h)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(i * plankW + plankW - 2, 0, 2, h)
      // 木纹
      for (let g = 0; g < 14; g++) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? 90 : 20}, ${Math.random() > 0.5 ? 52 : 12}, 18, ${0.08 + Math.random() * 0.1})`
        ctx.lineWidth = 0.6 + Math.random() * 1.6
        const x = i * plankW + Math.random() * plankW
        ctx.moveTo(x, 0)
        for (let y = 0; y <= h; y += 32) {
          ctx.lineTo(x + Math.sin(y * 0.02 + g) * 4, y)
        }
        ctx.stroke()
      }
    }
    // 整体压暗
    ctx.fillStyle = 'rgba(18, 8, 4, 0.38)'
    ctx.fillRect(0, 0, w, h)
    // 整体高光与暗角
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, 'rgba(255,170,90,0.06)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  })
}

function makeFeltTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0d4632'
    ctx.fillRect(0, 0, w, h)
    // 绒毛的细碎噪点
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(190, 230, 205, 0.035)' : 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4)
    }
    // 台呢的柔和明暗
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 40 + Math.random() * 100
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, Math.random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }, 5, 2.5)
}

function makeCarpetTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#471a19'
    ctx.fillRect(0, 0, w, h)
    // 细密噪点
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,190,140,0.05)'
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    // 边框
    ctx.strokeStyle = '#a87a45'
    ctx.lineWidth = 6
    ctx.strokeRect(26, 26, w - 52, h - 52)
    ctx.strokeStyle = '#6c3a25'
    ctx.lineWidth = 12
    ctx.strokeRect(48, 48, w - 96, h - 96)
    // 中央菱形花纹
    ctx.save()
    ctx.translate(w / 2, h / 2)
    for (let r = 44; r <= 190; r += 48) {
      ctx.rotate(Math.PI / 4)
      ctx.strokeStyle = r % 96 === 44 ? '#b98a4f' : '#77392b'
      ctx.lineWidth = 3
      ctx.strokeRect(-r, -r, r * 2, r * 2)
      ctx.rotate(-Math.PI / 4)
    }
    ctx.restore()
    for (const [x, y] of [[256, 120], [120, 256], [392, 256], [256, 392]]) {
      ctx.beginPath()
      ctx.arc(x, y, 12, 0, Math.PI * 2)
      ctx.fillStyle = '#c49a5f'
      ctx.fill()
    }
  }, 3, 2.4)
}

function makeArtTexture() {
  return canvasTexture(512, 640, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#1c3a2f')
    bg.addColorStop(0.55, '#153029')
    bg.addColorStop(1, '#0d1f1a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    // 抽象人物：宽檐帽与侧脸
    ctx.fillStyle = '#c58a3c'
    ctx.beginPath()
    ctx.ellipse(250, 300, 96, 120, -0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e7b46a'
    ctx.beginPath()
    ctx.ellipse(254, 268, 68, 88, -0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.ellipse(286, 236, 10, 45, 0.2, 0, Math.PI * 2)
    ctx.fill()
    // 帽檐
    ctx.fillStyle = '#101d18'
    ctx.beginPath()
    ctx.ellipse(268, 178, 168, 34, -0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(272, 140, 88, 52, -0.08, 0, Math.PI * 2)
    ctx.fill()
    // 帽子上的金色缎带
    ctx.fillStyle = '#b9853f'
    ctx.beginPath()
    ctx.ellipse(268, 168, 92, 13, -0.08, 0, Math.PI * 2)
    ctx.fill()
    // 背景装饰圆
    ctx.strokeStyle = 'rgba(215,168,96,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(110, 470, 90, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(420, 520, 60, 0, Math.PI * 2)
    ctx.stroke()
    // 文字
    ctx.fillStyle = '#d8b173'
    ctx.font = '600 30px Georgia, serif'
    ctx.fillText('CLUB', 44, 560)
    ctx.font = '700 74px Georgia, serif'
    ctx.fillText('No.9', 42, 620)
    // 颗粒
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,220,170,0.03)' : 'rgba(0,0,0,0.05)'
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
  })
}

function makeDartboardTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1a120d'
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    const rings = [
      [230, '#2a2018'],
      [205, '#d9c9a3'],
      [190, '#1c1c1c'],
      [160, '#2b6b48'],
      [132, '#742323'],
      [104, '#2b6b48'],
      [76, '#742323'],
      [48, '#2b6b48'],
      [26, '#742323'],
      [12, '#2b6b48'],
    ]
    for (const [r, color] of rings) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
    // 扇形分割
    ctx.strokeStyle = 'rgba(220,200,160,0.35)'
    ctx.lineWidth = 2
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26)
      ctx.lineTo(cx + Math.cos(a) * 205, cy + Math.sin(a) * 205)
      ctx.stroke()
    }
    // 数字
    ctx.fillStyle = '#e8d6b0'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 - Math.PI / 2
      ctx.fillText(String((i + 1) % 20 || 20), cx + Math.cos(a) * 218, cy + Math.sin(a) * 218)
    }
    // 牛眼
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.fillStyle = '#c0392b'
    ctx.fill()
  })
}

function makeBallTexture(number) {
  const color = BALL_COLORS[number]
  const isStripe = number > 8
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = isStripe ? '#f4efe3' : `#${color.toString(16).padStart(6, '0')}`
    ctx.fillRect(0, 0, w, h)
    if (isStripe) {
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
      ctx.fillRect(0, h * 0.28, w, h * 0.44)
      // 条纹边缘的淡金色描边
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, h * 0.28, w, 2)
      ctx.fillRect(0, h * 0.72 - 2, w, 2)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(255,255,255,0.18)')
      g.addColorStop(0.45, 'rgba(255,255,255,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.22)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
    // 两个白色号码圈
    for (const cx of [w * 0.25, w * 0.75]) {
      ctx.beginPath()
      ctx.arc(cx, h / 2, 40, 0, Math.PI * 2)
      ctx.fillStyle = '#f7f1e2'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, h / 2, 40, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#161411'
      ctx.font = 'bold 46px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(number), cx, h / 2 + 2)
    }
  })
}

function makeCueTexture() {
  return canvasTexture(64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#c9a878')
    g.addColorStop(0.16, '#9a6b3f')
    g.addColorStop(0.55, '#6d4426')
    g.addColorStop(0.86, '#3b2214')
    g.addColorStop(1, '#241309')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`
      ctx.lineWidth = 1 + Math.random()
      const x = Math.random() * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + Math.sin(i) * 2, h)
      ctx.stroke()
    }
  })
}

// ---------- 舞台 ----------
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.94
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x120b07)
  scene.fog = new THREE.FogExp2(0x120b07, 0.085)

  const camera = new THREE.PerspectiveCamera(54, 1, 0.03, 60)

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.16

  const setQuality = (high) => {
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1)
    renderer.shadowMap.enabled = high
  }

  return { renderer, scene, camera, setQuality }
}

// ---------- 房间 ----------
export function buildRoom(scene) {
  const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.62, metalness: 0.05 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 0.7 })
  const carpetMap = makeCarpetTexture()
  const carpet = new THREE.MeshStandardMaterial({ map: carpetMap, roughness: 1 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4c, roughness: 0.35, metalness: 0.7 })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 11), carpet)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, -0.742, 0.4)
  floor.receiveShadow = true
  scene.add(floor)

  // 地毯
  const rugMap = makeCarpetTexture()
  rugMap.repeat.set(1.4, 1)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4), new THREE.MeshStandardMaterial({ map: rugMap, roughness: 1 }))
  rug.rotation.x = -Math.PI / 2
  rug.position.set(0, -0.736, 0.05)
  rug.receiveShadow = true
  scene.add(rug)

  // 墙面
  const wallMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.68, metalness: 0.04 })
  wallMat.map.repeat.set(3, 2)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.6), wallMat)
  back.position.set(0, 1.05, -3.3)
  back.receiveShadow = true
  scene.add(back)

  const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.6), wallMat)
  left.rotation.y = Math.PI / 2
  left.position.set(-4.3, 1.05, 0.4)
  left.receiveShadow = true
  scene.add(left)

  const right = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.6), wallMat)
  right.rotation.y = -Math.PI / 2
  right.position.set(4.3, 1.05, 0.4)
  right.receiveShadow = true
  scene.add(right)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(11, 9), new THREE.MeshStandardMaterial({ color: 0x180f0a, roughness: 1 }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, 2.85, 0.4)
  scene.add(ceiling)

  // 墙裙
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(11, 0.62, 0.08), darkWood)
  skirt.position.set(0, -0.42, -3.24)
  scene.add(skirt)
  const skirtL = skirt.clone()
  skirtL.rotation.y = Math.PI / 2
  skirtL.scale.set(0.9, 1, 1)
  skirtL.position.set(-4.24, -0.42, 0.4)
  scene.add(skirtL)
  const skirtR = skirtL.clone()
  skirtR.position.x = 4.24
  scene.add(skirtR)

  // 画作
  const artFrame = new THREE.Group()
  const artMat = new THREE.MeshStandardMaterial({ map: makeArtTexture(), roughness: 0.8 })
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.88), artMat)
  art.position.z = 0.01
  const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(1.66, 2.04, 0.08), darkWood)
  frameOuter.position.z = -0.02
  const frameInner = new THREE.Mesh(new THREE.BoxGeometry(1.57, 1.95, 0.1), brass)
  frameInner.position.z = 0.0
  art.position.z = 0.06
  artFrame.add(frameOuter, frameInner, art)
  artFrame.position.set(-1.1, 1.55, -3.2)
  scene.add(artFrame)

  // 飞镖盘
  const boardTex = makeDartboardTexture()
  const board = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 48),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 }),
  )
  board.rotation.y = -Math.PI / 2
  board.position.set(4.2, 1.5, -2.2)
  scene.add(board)
  const boardRim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.022, 10, 48), darkWood)
  boardRim.rotation.y = -Math.PI / 2
  boardRim.position.set(4.19, 1.5, -2.2)
  scene.add(boardRim)

  // 墙面壁灯
  for (const z of [-2.2, 0.8, 2.6]) {
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.16, 0.2, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb98a4d, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    )
    shade.position.set(-4.16, 1.95, z)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    )
    bulb.position.set(-4.1, 1.9, z)
    scene.add(shade, bulb)
    const l = new THREE.PointLight(0xffbf7a, 9, 3.6, 2)
    l.position.set(-3.95, 1.85, z)
    scene.add(l)
  }

  // 右侧与角落的暖色补光，让木墙和画框有层次
  const cornerLight = new THREE.PointLight(0xff9d5e, 16, 6.5, 2)
  cornerLight.position.set(3.1, 1.9, 2.1)
  scene.add(cornerLight)
  const cornerLight2 = new THREE.PointLight(0xff8a45, 12, 6, 2)
  cornerLight2.position.set(2.6, 1.7, -2.4)
  scene.add(cornerLight2)

  // 吊灯：五盏，覆盖整张英式大台
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1d2b22, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide })
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe0ae })
  const lampXs = [-1.45, -0.725, 0, 0.725, 1.45]
  for (const x of lampXs) {
    const group = new THREE.Group()
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x1a1512 }))
    cord.position.y = 2.4
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 28, 1, true), lampMat)
    shade.position.y = 1.86
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), glowMat)
    bulb.position.y = 1.79
    group.add(cord, shade, bulb)
    group.position.x = x
    group.position.z = 0
    scene.add(group)
  }

  // 灯光
  const ambient = new THREE.AmbientLight(0x6a4c33, 0.62)
  scene.add(ambient)
  const hemi = new THREE.HemisphereLight(0x543a26, 0x120906, 0.45)
  scene.add(hemi)

  const spot = new THREE.SpotLight(0xffd6a2, 32, 8, 0.95, 0.8, 1.6)
  spot.position.set(0, 1.82, 0)
  spot.target.position.set(0, 0, 0)
  spot.castShadow = true
  spot.shadow.mapSize.set(2048, 2048)
  spot.shadow.bias = -0.0002
  spot.shadow.normalBias = 0.02
  spot.shadow.radius = 2
  spot.shadow.camera.near = 0.3
  spot.shadow.camera.far = 6
  scene.add(spot, spot.target)

  for (const x of [-1.45, -0.725, 0.725, 1.45]) {
    const s = new THREE.SpotLight(0xffcf9a, 14, 7, 0.8, 0.8, 1.7)
    s.position.set(x, 1.8, 0)
    s.target.position.set(x * 0.35, 0, 0)
    scene.add(s, s.target)
  }

  const rim = new THREE.PointLight(0xff8a45, 10, 7, 2)
  rim.position.set(2.6, 1.5, -2.5)
  scene.add(rim)

  return { spot }
}

// ---------- 球桌 ----------
export function buildTable(scene) {
  const group = new THREE.Group()
  const railWood = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), color: 0x2f2018, roughness: 0.66, metalness: 0.02 })
  railWood.map.repeat.set(3, 1)
  const felt = new THREE.MeshStandardMaterial({ map: makeFeltTexture(), roughness: 1, metalness: 0 })
  const cushion = felt
  const black = new THREE.MeshStandardMaterial({ color: 0x080705, roughness: 0.9 })
  const darkBronze = new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 0.42, metalness: 0.6 })

  // 台面
  const bed = new THREE.Mesh(new THREE.BoxGeometry(HALF_L * 2, 0.055, HALF_W * 2), felt)
  bed.position.y = -0.0275
  bed.receiveShadow = true
  group.add(bed)

  // 台面暗色底衬
  const subBed = new THREE.Mesh(new THREE.BoxGeometry(HALF_L * 2 + 0.04, 0.05, HALF_W * 2 + 0.04), black)
  subBed.position.y = -0.07
  group.add(subBed)

  // 库边做成与台呢同色、几乎等高的薄边，只比台面高 1.5 mm
  const cushionProfile = [
    [0, -0.008],
    [0.045, -0.008],
    [0.045, 0.0015],
    [0, 0.0015],
  ]
  const makeCushion = (length) => {
    const shape = new THREE.Shape()
    shape.moveTo(cushionProfile[0][0], cushionProfile[0][1])
    for (let i = 1; i < cushionProfile.length; i++) {
      shape.lineTo(cushionProfile[i][0], cushionProfile[i][1])
    }
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1, curveSegments: 1 })
    const mesh = new THREE.Mesh(geo, cushion)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const longSegs = [
    [-HALF_L + RAIL_GAP_CORNER, -RAIL_GAP_SIDE],
    [RAIL_GAP_SIDE, HALF_L - RAIL_GAP_CORNER],
  ]
  for (const [x1, x2] of longSegs) {
    const len = x2 - x1
    const north = makeCushion(len)
    north.rotation.y = -Math.PI / 2
    north.position.set(x2, 0, HALF_W)
    group.add(north)

    const south = makeCushion(len)
    south.rotation.y = Math.PI / 2
    south.position.set(x1, 0, -HALF_W)
    group.add(south)
  }

  const shortLen = (HALF_W - RAIL_GAP_CORNER) * 2
  const east = makeCushion(shortLen)
  east.position.set(HALF_L, 0, -(HALF_W - RAIL_GAP_CORNER))
  group.add(east)

  const west = makeCushion(shortLen)
  west.rotation.y = Math.PI
  west.position.set(-HALF_L, 0, HALF_W - RAIL_GAP_CORNER)
  group.add(west)

  // 木质外框：每侧用一整块挤出木框，中袋和角袋都以圆弧挖出，没有拼接缝
  const RAIL_W = 0.09
  const RAIL_TOP = 0.044
  const RAIL_BOTTOM = -0.058
  const railH = RAIL_TOP - RAIL_BOTTOM
  const innerZ = HALF_W + 0.018
  const innerX = HALF_L + 0.018
  const outerZ = innerZ + RAIL_W
  const outerX = innerX + RAIL_W

  const sidePocket = { x: 0, z: HALF_W - 0.006, r: 0.065 }
  const cornerPockets = [
    { x: -(HALF_L - 0.012), z: HALF_W - 0.012, r: 0.07 },
    { x: HALF_L - 0.012, z: HALF_W - 0.012, r: 0.07 },
  ]
  const railPockets = [...cornerPockets, sidePocket].sort((a, b) => a.x - b.x)

  const makeRailMesh = (shape, top, height) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 32 })
    const mesh = new THREE.Mesh(geo, railWood)
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = top
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  // 长边木框：外矩形内沿 + 中袋和两个角袋的半圆缺口
  const longShape = new THREE.Shape()
  longShape.moveTo(-outerX, outerZ)
  longShape.lineTo(-outerX, innerZ)
  for (const p of railPockets) {
    const dz = innerZ - p.z
    const half = Math.sqrt(Math.max(0, p.r * p.r - dz * dz))
    longShape.lineTo(p.x - half, innerZ)
    const a1 = Math.atan2(dz, -half)
    const a2 = Math.atan2(dz, half)
    longShape.absarc(p.x, p.z, p.r, a1, a2, true)
  }
  longShape.lineTo(outerX, innerZ)
  longShape.lineTo(outerX, outerZ)
  longShape.closePath()

  const northRail = makeRailMesh(longShape, RAIL_TOP, railH)
  group.add(northRail)
  const southRail = new THREE.Group()
  southRail.rotation.y = Math.PI
  southRail.add(northRail.clone())
  group.add(southRail)

  // 短边木框：内外两条边，内边在角袋处挖出圆弧
  const endTop = 0.0435
  const endHeight = endTop - RAIL_BOTTOM
  const endShape = new THREE.Shape()
  const cornerX = HALF_L - 0.012
  const cornerR = 0.07
  const endPocketZs = [-(HALF_W - 0.012), HALF_W - 0.012]
  endShape.moveTo(innerX, -outerZ)
  for (const zc of endPocketZs) {
    const dz = innerX - cornerX
    const half = Math.sqrt(Math.max(0, cornerR * cornerR - dz * dz))
    const a = Math.atan2(half, dz)
    endShape.lineTo(innerX, zc - half)
    endShape.absarc(cornerX, zc, cornerR, -a, a, false)
  }
  endShape.lineTo(innerX, outerZ)
  endShape.lineTo(outerX, outerZ)
  endShape.lineTo(outerX, -outerZ)
  endShape.closePath()

  const eastRail = makeRailMesh(endShape, endTop, endHeight)
  group.add(eastRail)
  const westRail = new THREE.Group()
  westRail.rotation.y = Math.PI
  westRail.add(eastRail.clone())
  group.add(westRail)

  // 象牙色菱形瞄点
  const sightMat = new THREE.MeshStandardMaterial({ color: 0xdbcdaf, roughness: 0.35, metalness: 0.15 })
  const sightGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.0022, 10)
  const quarter = HALF_L / 2
  const sightXs = [-quarter * 3, -quarter * 2, -quarter, quarter, quarter * 2, quarter * 3]
  for (const x of sightXs) {
    for (const zSign of [-1, 1]) {
      const sight = new THREE.Mesh(sightGeo, sightMat)
      sight.position.set(x, RAIL_TOP + 0.0011, zSign * (innerZ + outerZ) / 2)
      group.add(sight)
    }
  }
  for (const xSign of [-1, 1]) {
    for (const z of [-0.445, 0, 0.445]) {
      const sight = new THREE.Mesh(sightGeo, sightMat)
      sight.position.set(xSign * (innerX + outerX) / 2, RAIL_TOP + 0.0011, z)
      group.add(sight)
    }
  }

  // 袋口黑圈与暗铜环
  for (const p of POCKETS) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(p.mouth, 48), new THREE.MeshBasicMaterial({ color: 0x050403 }))
    hole.rotation.x = -Math.PI / 2
    hole.position.set(p.x, 0.003, p.z)
    group.add(hole)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.mouth + 0.0015, 0.006, 10, 48), darkBronze)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(p.x, 0.0038, p.z)
    group.add(ring)

    const well = new THREE.Mesh(new THREE.CylinderGeometry(p.mouth * 0.96, p.mouth * 0.8, 0.16, 28, 1, true), black)
    well.position.set(p.x, -0.082, p.z)
    group.add(well)
  }

  // 台身与桌腿
  const skirt = new THREE.Mesh(new RoundedBoxGeometry(3.736, 0.17, 1.946, 2, 0.006), railWood)
  skirt.position.y = -0.14
  skirt.castShadow = true
  group.add(skirt)

  const legMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.52, metalness: 0.1 })
  const legProfile = [
    [0.1, 0], [0.115, 0.02], [0.075, 0.06], [0.05, 0.12], [0.065, 0.2], [0.1, 0.27], [0.105, 0.31],
    [0.07, 0.37], [0.055, 0.43], [0.09, 0.49], [0.1, 0.52],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const legGeo = new THREE.LatheGeometry(legProfile, 20)
  for (const x of [-1.55, 1.55]) {
    for (const z of [-0.66, 0.66]) {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(x, -0.744, z)
      leg.castShadow = true
      leg.receiveShadow = true
      group.add(leg)
    }
  }

  // 桌边金色装饰线
  for (const zSign of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.008, 0.006), darkBronze)
    trim.position.set(0, -0.075, zSign * 0.975)
    group.add(trim)
  }
  for (const xSign of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 1.85), darkBronze)
    trim.position.set(xSign * 1.87, -0.075, 0)
    group.add(trim)
  }

  scene.add(group)
  return group
}

// ---------- 球 ----------
const ballTextureCache = new Map()

export function getBallTexture(number) {
  if (!ballTextureCache.has(number)) ballTextureCache.set(number, makeBallTexture(number))
  return ballTextureCache.get(number)
}

export function createBallMesh(number) {
  const material = new THREE.MeshPhysicalMaterial({
    map: number === 0 ? null : getBallTexture(number),
    color: number === 0 ? 0xf6f1e4 : 0xffffff,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.85,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 40, 28), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (number === 0) {
    // 白球上的小红点，方便观察旋转
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 0.13, 12),
      new THREE.MeshBasicMaterial({ color: 0xb33a2a }),
    )
    dot.position.set(0, 0, BALL_R + 0.0004)
    mesh.add(dot)
  }
  return mesh
}

// ---------- 球杆与瞄准辅助 ----------
export function createCueStick(scene) {
  const group = new THREE.Group()
  const shaftGeo = new THREE.CylinderGeometry(0.0042, 0.0115, 1.36, 18, 1)
  shaftGeo.rotateX(Math.PI / 2)
  shaftGeo.translate(0, 0, -0.68)
  const shaftMat = new THREE.MeshStandardMaterial({ map: makeCueTexture(), roughness: 0.4, metalness: 0.08 })
  const shaft = new THREE.Mesh(shaftGeo, shaftMat)
  shaft.castShadow = true
  group.add(shaft)

  const ferruleGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.02, 14)
  ferruleGeo.rotateX(Math.PI / 2)
  ferruleGeo.translate(0, 0, -0.01)
  const ferrule = new THREE.Mesh(ferruleGeo, new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.4 }))
  group.add(ferrule)

  const tipGeo = new THREE.CylinderGeometry(0.0041, 0.0041, 0.008, 14)
  tipGeo.rotateX(Math.PI / 2)
  tipGeo.translate(0, 0, 0.001)
  const tip = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0x2b6a8c, roughness: 0.85 }))
  group.add(tip)

  group.visible = false
  scene.add(group)
  return group
}

export function createAimVisuals(scene) {
  const group = new THREE.Group()
  group.visible = false

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  const line = new THREE.Line(
    lineGeo,
    new THREE.LineDashedMaterial({ color: 0xf7e6bd, dashSize: 0.045, gapSize: 0.03, transparent: true, opacity: 0.85 }),
  )
  line.computeLineDistances()
  group.add(line)

  const ghost = new THREE.Mesh(
    new THREE.RingGeometry(BALL_R * 0.82, BALL_R, 36),
    new THREE.MeshBasicMaterial({ color: 0xf7e6bd, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  )
  ghost.rotation.x = -Math.PI / 2
  ghost.position.y = 0.004
  group.add(ghost)

  const ghostBall = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xf7e6bd, transparent: true, opacity: 0.12, depthWrite: false }),
  )
  group.add(ghostBall)

  const deflectGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  const deflect = new THREE.Line(
    deflectGeo,
    new THREE.LineBasicMaterial({ color: 0x9fd7b4, transparent: true, opacity: 0.7 }),
  )
  group.add(deflect)

  scene.add(group)
  return { group, line, ghost, ghostBall, deflect, lineGeo, deflectGeo }
}













