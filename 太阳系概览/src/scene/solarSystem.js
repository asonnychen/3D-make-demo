import * as THREE from 'three'
import { BODIES } from '../data/bodies.js'
import {
  createSurfaceTexture,
  createCloudTexture,
  createRingTexture,
  createGlowTexture,
  createStarTexture,
} from '../lib/textures.js'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

function buildStarField() {
  const count = 2400
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < count; i += 1) {
    const r = 220 + Math.random() * 620
    const theta = Math.random() * TAU
    const cosPhi = Math.random() * 2 - 1
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi)
    positions[i * 3] = r * sinPhi * Math.cos(theta)
    positions[i * 3 + 1] = r * cosPhi
    positions[i * 3 + 2] = r * sinPhi * Math.sin(theta)
    const warm = Math.random()
    color.setHSL(warm > 0.82 ? 0.09 : 0.58, warm > 0.82 ? 0.35 : 0.18, 0.58 + Math.random() * 0.36)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 2,
    sizeAttenuation: false,
    map: createStarTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    opacity: 0.95,
  })
  return new THREE.Points(geo, mat)
}

function buildOrbitLine(radius, inclination, color = 0x33465c) {
  const segments = 220
  const points = []
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * TAU
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
  const line = new THREE.Line(geo, mat)
  line.rotation.x = inclination * DEG
  return line
}

function buildAtmosphere(radius, color = 0x86b9e8) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 2.6 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      uniform vec3 uColor;
      uniform float uPower;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), uPower);
        gl_FragColor = vec4(uColor, rim * 0.72);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material)
  mesh.name = 'atmosphere'
  return mesh
}

function buildSaturnRing(radius) {
  const inner = radius * 1.28
  const outer = radius * 1.98
  const geo = new THREE.RingGeometry(inner, outer, 220, 2)
  // 用着色器按半径采样一维环带纹理，避免 UV 在三角形间插值产生放射条纹
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: createRingTexture() },
      uInner: { value: inner },
      uSpan: { value: outer - inner },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uInner;
      uniform float uSpan;
      varying vec3 vLocal;
      void main() {
        float t = clamp((length(vLocal.xy) - uInner) / uSpan, 0.0, 1.0);
        vec4 c = texture2D(uMap, vec2(t, 0.5));
        if (c.a < 0.01) discard;
        gl_FragColor = vec4(c.rgb * 0.92, c.a * 0.9);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  return { mesh, inner, outer }
}

const SUN_NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i);
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += noise3(p) * a;
      p = p * 2.03 + vec3(11.3, 7.1, 5.7);
      a *= 0.5;
    }
    return v / 0.875;
  }
`

// 着色器火焰：两层球壳，顶点按噪声起伏，片元只保留边缘的流动热浪
function buildSunFlames(radius) {
  const group = new THREE.Group()
  const materials = []

  const layers = [
    {
      scale: 1.002,
      height: 0.07,
      opacity: 1.0,
      speed: 1,
      detail: 9,
      edgeStart: 0.15,
      edgeEnd: 0.86,
      colorBase: [1.0, 0.32, 0.04],
      colorHot: [1.0, 0.82, 0.42],
    },
    {
      scale: 1.012,
      height: 0.2,
      opacity: 0.72,
      speed: 0.55,
      detail: 4.5,
      edgeStart: 0.4,
      edgeEnd: 0.98,
      colorBase: [1.0, 0.2, 0.01],
      colorHot: [1.0, 0.66, 0.22],
    },
  ]

  for (const layer of layers) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: radius * layer.scale },
        uHeight: { value: radius * layer.height },
        uOpacity: { value: layer.opacity },
        uSpeed: { value: layer.speed },
        uDetail: { value: layer.detail },
        uEdgeStart: { value: layer.edgeStart },
        uEdgeEnd: { value: layer.edgeEnd },
        uColorBase: { value: new THREE.Color(...layer.colorBase) },
        uColorHot: { value: new THREE.Color(...layer.colorHot) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uRadius;
        uniform float uHeight;
        uniform float uSpeed;
        uniform float uDetail;
        varying vec3 vLocal;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        ${SUN_NOISE_GLSL}
        void main() {
          vec3 dir = normalize(position);
          float n1 = fbm3(dir * uDetail + vec3(0.0, uTime * 0.42 * uSpeed, 0.0));
          float n2 = fbm3(dir * (uDetail * 2.2) - vec3(uTime * 0.3 * uSpeed, 0.0, uTime * 0.18 * uSpeed));
          float lift = pow(clamp(n1 * 0.74 + n2 * 0.26, 0.0, 1.0), 2.1);
          vLocal = dir;
          vNormalW = normalize(mat3(modelMatrix) * dir);
          vec3 displaced = dir * (uRadius + uHeight * lift);
          vec4 world = modelMatrix * vec4(displaced, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uSpeed;
        uniform float uDetail;
        uniform float uEdgeStart;
        uniform float uEdgeEnd;
        uniform vec3 uColorBase;
        uniform vec3 uColorHot;
        varying vec3 vLocal;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        ${SUN_NOISE_GLSL}
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - abs(dot(normalize(vNormalW), viewDir));
          float edge = smoothstep(uEdgeStart, uEdgeEnd, rim);
          float n1 = fbm3(vLocal * (uDetail * 0.9) + vec3(0.0, -uTime * 0.55 * uSpeed, 0.0));
          float n2 = fbm3(vLocal * (uDetail * 2.4) + vec3(uTime * 0.34 * uSpeed, -uTime * 0.8 * uSpeed, 0.0));
          float flame = smoothstep(0.46, 0.9, n1 * 0.72 + n2 * 0.28);
          float alpha = flame * edge * uOpacity;
          vec3 color = mix(uColorBase, uColorHot, flame);
          gl_FragColor = vec4(color * (0.7 + flame * 0.55), alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * layer.scale, 96, 64), material)
    mesh.renderOrder = 1
    group.add(mesh)
    materials.push(material)
  }

  function update(dt, speedFactor) {
    const step = dt * speedFactor
    for (const m of materials) m.uniforms.uTime.value += step
  }

  return { group, update }
}

export function createSolarSystem() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x04060a)
  const root = new THREE.Group()
  scene.add(root)

  const stars = buildStarField()
  root.add(stars)

  const ambient = new THREE.AmbientLight(0xffffff, 0.19)
  scene.add(ambient)

  const sunLight = new THREE.PointLight(0xfff3e2, 5.4, 0, 0)
  scene.add(sunLight)

  const records = new Map()
  const pickables = []

  // 太阳
  const sunData = BODIES.find((b) => b.id === 'sun')
  const sunGroup = new THREE.Group()
  const sunTex = createSurfaceTexture('sun', 11)
  sunTex.wrapS = THREE.RepeatWrapping
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(sunData.displayRadius, 64, 48),
    new THREE.MeshBasicMaterial({ map: sunTex }),
  )
  sunMesh.name = 'sun'
  sunMesh.userData.bodyId = 'sun'
  sunGroup.add(sunMesh)

  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture('rgba(255,214,140,0.95)', 'rgba(255,120,20,0)'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.6,
    }),
  )
  corona.scale.setScalar(sunData.displayRadius * 2.5)
  corona.renderOrder = -1
  sunGroup.add(corona)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture('rgba(255,160,70,0.55)', 'rgba(255,90,10,0)'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
    }),
  )
  halo.scale.setScalar(sunData.displayRadius * 6.5)
  sunGroup.add(halo)

  // 着色器火焰：两层球壳在边缘起伏，缓慢翻卷
  const sunFlames = buildSunFlames(sunData.displayRadius)
  sunGroup.add(sunFlames.group)

  root.add(sunGroup)
  pickables.push(sunMesh)
  records.set('sun', {
    data: sunData,
    anchor: sunGroup,
    tiltGroup: sunGroup,
    spinMesh: sunMesh,
    radius: sunData.displayRadius,
    isSun: true,
  })

  // 行星
  const planetOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
  const phaseSeed = { mercury: 0.4, venus: 1.55, earth: 4.1, mars: 5.6, jupiter: 1.1, saturn: 2.35, uranus: 5.55, neptune: 0.9 }

  for (const id of planetOrder) {
    const data = BODIES.find((b) => b.id === id)
    const orbitPivot = new THREE.Group()
    orbitPivot.rotation.y = phaseSeed[id]
    root.add(orbitPivot)

    const anchor = new THREE.Group()
    anchor.position.x = data.displayOrbit
    orbitPivot.add(anchor)

    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = data.tilt * DEG
    anchor.add(tiltGroup)

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.displayRadius, 64, 48),
      new THREE.MeshStandardMaterial({
        map: createSurfaceTexture(data.kind, data.index * 7 + 3),
        roughness: 0.92,
        metalness: 0.02,
      }),
    )
    mesh.name = id
    mesh.userData.bodyId = id
    tiltGroup.add(mesh)
    pickables.push(mesh)

    let clouds = null
    let atmosphere = null
    if (id === 'earth') {
      clouds = new THREE.Mesh(
        new THREE.SphereGeometry(data.displayRadius * 1.014, 64, 48),
        new THREE.MeshStandardMaterial({
          map: createCloudTexture(23),
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        }),
      )
      clouds.renderOrder = 1
      tiltGroup.add(clouds)
      atmosphere = buildAtmosphere(data.displayRadius * 1.055)
      tiltGroup.add(atmosphere)
    }
    if (id === 'venus') {
      atmosphere = buildAtmosphere(data.displayRadius * 1.06, 0xf0d9a8)
      atmosphere.material.uniforms.uPower.value = 3.2
      tiltGroup.add(atmosphere)
    }

    let ring = null
    if (id === 'saturn') {
      const built = buildSaturnRing(data.displayRadius)
      ring = built.mesh
      ring.renderOrder = 2
      tiltGroup.add(ring)
    }

    // 轨道线独立挂在 root，不受公转影响
    const orbitLine = buildOrbitLine(data.displayOrbit, data.orbitInclination)
    root.add(orbitLine)

    records.set(id, {
      data,
      orbitPivot,
      anchor,
      tiltGroup,
      spinMesh: mesh,
      clouds,
      atmosphere,
      ring,
      orbitLine,
      radius: data.displayRadius,
      phase: phaseSeed[id],
    })
  }

  // 月球
  const moonData = BODIES.find((b) => b.id === 'moon')
  const earthRec = records.get('earth')
  const moonPivot = new THREE.Group()
  moonPivot.rotation.x = moonData.orbitInclination * DEG
  moonPivot.rotation.y = 1.4
  earthRec.anchor.add(moonPivot)

  const moonAnchor = new THREE.Group()
  moonAnchor.position.x = moonData.displayOrbit
  moonPivot.add(moonAnchor)

  const moonTilt = new THREE.Group()
  moonTilt.rotation.z = moonData.tilt * DEG
  moonAnchor.add(moonTilt)

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(moonData.displayRadius, 48, 36),
    new THREE.MeshStandardMaterial({
      map: createSurfaceTexture('moon', 77),
      roughness: 1,
      metalness: 0,
    }),
  )
  moonMesh.name = 'moon'
  moonMesh.userData.bodyId = 'moon'
  moonTilt.add(moonMesh)
  pickables.push(moonMesh)

  const moonLine = buildOrbitLine(moonData.displayOrbit, 0, 0x2a3644)
  moonPivot.add(moonLine)

  records.set('moon', {
    data: moonData,
    orbitPivot: moonPivot,
    anchor: moonAnchor,
    tiltGroup: moonTilt,
    spinMesh: moonMesh,
    orbitLine: moonLine,
    radius: moonData.displayRadius,
    parent: earthRec,
  })

  const tmp = new THREE.Vector3()

  function update(dt, speedFactor, flags) {
    // 公转
    if (flags.orbit) {
      for (const rec of records.values()) {
        if (rec.orbitPivot && rec.data.displayOrbitPeriod > 0) {
          rec.orbitPivot.rotation.y += (dt * speedFactor * TAU) / rec.data.displayOrbitPeriod
        }
      }
    }
    // 自转（月球潮汐锁定：自转角度跟随公转）
    if (flags.spin) {
      for (const rec of records.values()) {
        if (rec.data.id === 'moon') continue
        if (rec.spinMesh && rec.data.displaySpinPeriod) {
          const dir = 1
          rec.spinMesh.rotation.y += (dt * speedFactor * TAU * dir) / rec.data.displaySpinPeriod
        }
        if (rec.clouds) {
          rec.clouds.rotation.y += (dt * speedFactor * TAU) / (rec.data.displaySpinPeriod * 0.78)
        }
      }
      const moonRec = records.get('moon')
      moonRec.spinMesh.rotation.y = moonRec.orbitPivot.rotation.y + Math.PI
    }
    stars.rotation.y += dt * 0.003
    sunFlames.update(dt, speedFactor)
  }

  function getWorldPosition(id, target = new THREE.Vector3()) {
    const rec = records.get(id)
    if (!rec) return target.set(0, 0, 0)
    rec.spinMesh.getWorldPosition(target)
    return target
  }

  function setOrbitLines(visible) {
    for (const rec of records.values()) {
      if (rec.orbitLine) rec.orbitLine.visible = visible
    }
  }

  function setCloudsVisible(visible) {
    const rec = records.get('earth')
    if (rec?.clouds) rec.clouds.visible = visible
  }

  function pulseSun(t) {
    const k = 1 + Math.sin(t * 0.8) * 0.012
    corona.scale.setScalar(sunData.displayRadius * 2.5 * k)
  }

  return {
    scene,
    root,
    sunGroup,
    sunMesh,
    records,
    pickables,
    update,
    getWorldPosition,
    setOrbitLines,
    setCloudsVisible,
    pulseSun,
    tmp,
  }
}
