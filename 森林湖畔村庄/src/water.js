/* ============================================================
   湖水：平面镜面反射 + 波纹扰动 + 岸边浅水与泡沫
   ============================================================ */

import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { groundHeight } from './terrain.js'

const WaterShader = {
  name: 'LakeWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.55, 0.35).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d4) },
    uShallow: { value: new THREE.Color(0x8fc9bc) },
    uDeep: { value: new THREE.Color(0x3d7c7a) },
    uHorizon: { value: new THREE.Color(0xc9d2c0) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uHorizon;
    varying vec4 vUv;
    varying vec3 vWorld;

    #include <logdepthbuf_pars_fragment>

    void main() {
      #include <logdepthbuf_fragment>

      vec2 p = vWorld.xz;
      float t = uTime;

      // 多层正弦叠加成缓慢的湖面波纹
      vec2 w = vec2(
        sin(p.x * 0.55 + t * 0.85) + sin(p.y * 0.37 - t * 0.62) * 0.8 + sin((p.x + p.y) * 0.21 + t * 0.43) * 0.55,
        cos(p.y * 0.48 - t * 0.78) + cos(p.x * 0.33 + t * 0.54) * 0.8 + cos((p.x - p.y) * 0.19 - t * 0.39) * 0.55
      );

      vec4 uv = vUv;
      uv.xy += w * 0.0019 * uv.w;

      vec4 base = texture2DProj(tDiffuse, uv);

      float r = length(p);
      float shore = smoothstep(18.0, 28.5, r);
      vec3 tint = mix(uDeep, uShallow, shore * 0.85);

      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.2);

      // 反射偏湖水色，避免整片湖被亮天空洗白
      vec3 refl = mix(base.rgb, tint, 0.4);
      vec3 col = mix(tint, refl, 0.4 + fres * 0.2);

      // 阳光碎金
      vec3 n = normalize(vec3(-w.x * 0.035, 1.0, -w.y * 0.035));
      vec3 R = reflect(-V, n);
      float spec = pow(max(dot(R, uSunDir), 0.0), 160.0);
      col += uSunColor * spec * 0.75;

      // 岸边泡沫线
      float edge = abs(r - 27.4);
      float foam = smoothstep(0.8, 0.0, edge) * (0.55 + 0.45 * sin(p.x * 2.7 + p.y * 2.1 + t * 1.4));
      col = mix(col, vec3(0.9, 0.94, 0.88), foam * 0.24);

      // 远处融进雾里
      float dist = length(cameraPosition - vWorld);
      float fogF = 1.0 - exp(-pow(dist * 0.0042, 2.0));
      col = mix(col, uHorizon, clamp(fogF, 0.0, 0.68));

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

export function createWater(scene, quality = 1) {
  const size = Math.round(512 * quality)
  const geo = new THREE.CircleGeometry(30.2, 160)
  geo.rotateX(-Math.PI / 2)

  const water = new Reflector(geo, {
    clipBias: 0.004,
    textureWidth: size,
    textureHeight: size,
    color: 0x6f9c95,
    multisample: 0,
    shader: WaterShader,
  })
  water.position.y = 0.02
  water.name = 'lake-water'
  scene.add(water)

  const reeds = createReeds(scene)
  const lilies = createLilies(scene)

  return {
    mesh: water,
    reeds,
    lilies,
    update(elapsed) {
      water.material.uniforms.uTime.value = elapsed
      reeds.rotation.z = Math.sin(elapsed * 0.6) * 0.004
      lilies.position.y = Math.sin(elapsed * 0.7) * 0.012
    },
  }
}

/* 湖岸芦苇 */
function createReeds(scene) {
  const geo = new THREE.ConeGeometry(0.035, 1.0, 3)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d8a4d, roughness: 0.95 })
  const count = 360
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.castShadow = false
  const dummy = new THREE.Object3D()
  let n = 0
  let guard = 0
  while (n < count && guard++ < 4000) {
    const a = Math.random() * Math.PI * 2
    const r = 25.6 + Math.random() * 2.6
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (groundHeight(x, z) > 0.35) continue
    dummy.position.set(x, -0.05, z)
    dummy.rotation.set((Math.random() - 0.5) * 0.22, Math.random() * 6.28, (Math.random() - 0.5) * 0.22)
    const s = 0.5 + Math.random() * 0.55
    dummy.scale.set(1, s, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(n++, dummy.matrix)
  }
  mesh.count = n
  scene.add(mesh)
  return mesh
}

/* 睡莲 */
function createLilies(scene) {
  const group = new THREE.Group()
  const padGeo = new THREE.CircleGeometry(0.42, 12)
  padGeo.rotateX(-Math.PI / 2)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x5f7f4d, roughness: 0.8 })
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf0d7de, roughness: 0.7 })

  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 12 + Math.random() * 14
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    const pad = new THREE.Mesh(padGeo, padMat)
    pad.position.set(x, 0.045, z)
    pad.rotation.y = Math.random() * 6.28
    pad.scale.setScalar(0.7 + Math.random() * 0.8)
    group.add(pad)

    if (Math.random() < 0.3) {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), flowerMat)
      bud.position.set(x + 0.12, 0.14, z + 0.06)
      bud.scale.y = 1.5
      group.add(bud)
    }
  }
  scene.add(group)
  return group
}

