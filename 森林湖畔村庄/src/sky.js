/* ============================================================
   天空：渐变穹顶、柔云、飞鸟与阳光方向
   ============================================================ */

import * as THREE from 'three'

export const SUN_DIR = new THREE.Vector3(0.46, 0.6, 0.34).normalize()

export function createSky(scene) {
  const geo = new THREE.SphereGeometry(720, 40, 24)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x8ea8ba) },
      uMid: { value: new THREE.Color(0xc4d0c8) },
      uHorizon: { value: new THREE.Color(0xdadfcb) },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color(0xfff0cf) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.85, h));
        float sun = pow(max(dot(d, uSunDir), 0.0), 28.0);
        col += uSunColor * sun * 0.28;
        float halo = pow(max(dot(d, uSunDir), 0.0), 5.0);
        col += uSunColor * halo * 0.06;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  const dome = new THREE.Mesh(geo, mat)
  dome.name = 'sky'
  dome.frustumCulled = false
  scene.add(dome)

  const clouds = createClouds(scene)
  const birds = createBirds(scene)

  return { dome, clouds, birds }
}

function cloudTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < 16; i++) {
    const x = 40 + Math.random() * (size - 80)
    const y = 80 + Math.random() * 90
    const r = 24 + Math.random() * 52
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.5)')
    g.addColorStop(0.55, 'rgba(248,248,240,0.22)')
    g.addColorStop(1, 'rgba(245,246,238,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createClouds(scene) {
  const tex = cloudTexture()
  const group = new THREE.Group()
  for (let i = 0; i < 9; i++) {
    const m = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.22 + Math.random() * 0.3,
      depthWrite: false,
      fog: false,
      color: 0xffffff,
    })
    const s = new THREE.Sprite(m)
    const a = Math.random() * Math.PI * 2
    const r = 170 + Math.random() * 280
    s.position.set(Math.sin(a) * r, 95 + Math.random() * 80, Math.cos(a) * r)
    const sc = 150 + Math.random() * 190
    s.scale.set(sc, sc * 0.42, 1)
    group.add(s)
  }
  group.name = 'clouds'
  scene.add(group)
  return group
}

function createBirds(scene) {
  const group = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: 0x49524a, side: THREE.DoubleSide })
  const birds = []

  for (let i = 0; i < 7; i++) {
    const bird = new THREE.Group()
    const wingGeo = new THREE.PlaneGeometry(0.85, 0.13)
    const left = new THREE.Mesh(wingGeo, mat)
    left.position.x = -0.55
    left.rotation.y = 0.1
    const right = new THREE.Mesh(wingGeo, mat)
    right.position.x = 0.55
    right.rotation.y = -0.1
    bird.add(left, right)
    bird.userData.left = left
    bird.userData.right = right
    bird.userData.phase = Math.random() * Math.PI * 2
    bird.userData.radius = 42 + Math.random() * 26
    bird.userData.height = 26 + Math.random() * 14
    bird.userData.speed = 0.045 + Math.random() * 0.03
    group.add(bird)
    birds.push(bird)
  }

  scene.add(group)

  return {
    group,
    update(elapsed) {
      for (const bird of birds) {
        const p = bird.userData
        const a = elapsed * p.speed + p.phase
        bird.position.set(Math.sin(a) * p.radius, p.height + Math.sin(elapsed * 0.6 + p.phase) * 1.4, Math.cos(a) * p.radius)
        bird.rotation.y = -a + Math.PI
        const flap = Math.sin(elapsed * 5.5 + p.phase) * 0.5
        p.left.rotation.z = flap
        p.right.rotation.z = -flap
      }
    },
  }
}
