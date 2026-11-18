import * as THREE from 'three'
import { LAKE_CENTER, WORLD_SIZE, terrainHeight, isInsideLake } from './constants.js'

const UP = new THREE.Vector3(0, 1, 0)

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

export class ParkScene {
  constructor(scene) {
    this.scene = scene
    this.time = 0
    this.isNight = false
    this.random = seededRandom(20261118)
    this.balloons = []
    this.clouds = []
    this.cabins = []
    this.materials = []

    this.createSky()
    this.createLights()
    this.createTerrain()
    this.createLake()
    this.createForest()
    this.createFerrisWheel()
    this.createBalloons()
    this.createClouds()
    this.createCanyon()
  }

  createSky() {
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x62b6e8) },
      bottomColor: { value: new THREE.Color(0xffd8a8) },
      offset: { value: 18 },
      exponent: { value: 0.72 },
    }
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float height = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float blend = pow(max(height, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, blend), 1.0);
        }
      `,
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 18), skyMaterial)
    this.sky.name = '昼夜渐变天空'
    this.scene.add(this.sky)
  }

  createLights() {
    this.hemisphere = new THREE.HemisphereLight(0xbfe7ff, 0x53613d, 2.25)
    this.sun = new THREE.DirectionalLight(0xfff0c4, 3.25)
    this.sun.position.set(-48, 76, 38)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -90
    this.sun.shadow.camera.right = 90
    this.sun.shadow.camera.top = 90
    this.sun.shadow.camera.bottom = -90
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 190
    this.sun.shadow.bias = -0.00035
    this.sun.target.position.set(0, 0, 0)
    this.scene.add(this.hemisphere, this.sun, this.sun.target)
  }

  createTerrain() {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 84, 84)
    geometry.rotateX(-Math.PI / 2)
    const positions = geometry.attributes.position
    const colors = []
    const color = new THREE.Color()
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = positions.getZ(index)
      const height = terrainHeight(x, z)
      positions.setY(index, height)
      const variation = Math.sin(x * 0.17) * 0.035 + Math.cos(z * 0.13) * 0.03
      color.setHSL(0.25 + variation, 0.42, THREE.MathUtils.clamp(0.31 + height * 0.018, 0.22, 0.46))
      colors.push(color.r, color.g, color.b)
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 })
    this.terrain = new THREE.Mesh(geometry, material)
    this.terrain.receiveShadow = true
    this.terrain.name = '起伏草地地形'
    this.scene.add(this.terrain)
  }

  createLake() {
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x247d92,
      emissive: 0x061b23,
      emissiveIntensity: 0.25,
      roughness: 0.18,
      metalness: 0.48,
      transparent: true,
      opacity: 0.88,
    })
    this.waterMaterial = waterMaterial
    this.water = new THREE.Mesh(new THREE.CircleGeometry(LAKE_CENTER.radius, 72), waterMaterial)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.set(LAKE_CENTER.x, 0.12, LAKE_CENTER.z)
    this.water.receiveShadow = true
    this.water.name = '中央人工湖'
    this.scene.add(this.water)

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(LAKE_CENTER.radius + 0.5, 0.45, 8, 72),
      new THREE.MeshStandardMaterial({ color: 0xc9b67d, roughness: 0.82 }),
    )
    rim.rotation.x = Math.PI / 2
    rim.position.set(LAKE_CENTER.x, 0.05, LAKE_CENTER.z)
    this.scene.add(rim)
  }

  createForest() {
    const treeCount = 190
    const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x604331, roughness: 0.92 })
    const crownGeometry = new THREE.ConeGeometry(1.65, 4.8, 7)
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x214f3f, roughness: 0.88 })
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount)
    const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, treeCount)
    trunks.castShadow = true
    crowns.castShadow = true
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    let placed = 0
    let attempts = 0
    while (placed < treeCount && attempts < 4000) {
      attempts += 1
      const x = (this.random() - 0.5) * 165
      const z = (this.random() - 0.5) * 165
      if (isInsideLake(x, z, 7) || Math.hypot(x, z) < 14) continue
      const height = terrainHeight(x, z)
      const size = 0.72 + this.random() * 0.72
      quaternion.setFromAxisAngle(UP, this.random() * Math.PI * 2)
      matrix.compose(new THREE.Vector3(x, height + 1.1 * size, z), quaternion, scale.set(size, size, size))
      trunks.setMatrixAt(placed, matrix)
      matrix.compose(new THREE.Vector3(x, height + 4.0 * size, z), quaternion, scale.set(size, size, size))
      crowns.setMatrixAt(placed, matrix)
      placed += 1
    }
    trunks.count = placed
    crowns.count = placed
    this.scene.add(trunks, crowns)
  }

  createFerrisWheel() {
    this.ferris = new THREE.Group()
    this.ferris.position.set(-62, 0, -48)
    this.ferris.name = '远处旋转摩天轮'
    const wheel = new THREE.Group()
    wheel.position.y = 26
    const radius = 18
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xe8ddc4, metalness: 0.64, roughness: 0.34 })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.38, 8, 72), rimMaterial)
    wheel.add(rim)
    const spokeMaterial = new THREE.MeshStandardMaterial({ color: 0x668086, metalness: 0.7, roughness: 0.4 })
    for (let index = 0; index < 16; index += 1) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, radius * 2, 6), spokeMaterial)
      spoke.rotation.z = (index / 16) * Math.PI
      wheel.add(spoke)
    }
    this.ferrisWheel = wheel
    this.ferris.add(wheel)

    const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x4e5d62, metalness: 0.74, roughness: 0.42 })
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 30, 8), supportMaterial)
      support.position.set(side * 5, 12, 0)
      support.rotation.z = side * 0.25
      this.ferris.add(support)
    }

    const cabinColors = [0xff6b35, 0xffc857, 0x72e6d1, 0xf15b75]
    for (let index = 0; index < 12; index += 1) {
      const cabin = new THREE.Group()
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.05, 1.45, 8),
        new THREE.MeshStandardMaterial({ color: cabinColors[index % cabinColors.length], roughness: 0.5, metalness: 0.16 }),
      )
      shell.position.y = -0.75
      cabin.add(shell)
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 8, 6),
        new THREE.MeshBasicMaterial({ color: cabinColors[index % cabinColors.length] }),
      )
      bulb.position.set(0, 0.15, 1.05)
      cabin.add(bulb)
      this.ferris.add(cabin)
      this.cabins.push(cabin)
    }
    this.scene.add(this.ferris)
  }

  createBalloons() {
    const balloonColors = [0xff6b35, 0xffc857, 0x72e6d1, 0xf15b75, 0xf2efe0]
    for (let index = 0; index < 5; index += 1) {
      const group = new THREE.Group()
      const color = balloonColors[index]
      const envelope = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 10, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 }),
      )
      envelope.scale.y = 1.22
      envelope.castShadow = true
      group.add(envelope)
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.9, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x735238, roughness: 0.9 }),
      )
      basket.position.y = -3.6
      group.add(basket)
      group.position.set(-44 + index * 23, 22 + (index % 2) * 7, -42 - (index % 3) * 12)
      group.userData.baseY = group.position.y
      group.userData.phase = index * 1.7
      this.balloons.push(group)
      this.scene.add(group)
    }
  }

  createClouds() {
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f1df, roughness: 1, transparent: true, opacity: 0.9 })
    for (let index = 0; index < 9; index += 1) {
      const cloud = new THREE.Group()
      const puffCount = 4 + Math.floor(this.random() * 3)
      for (let puffIndex = 0; puffIndex < puffCount; puffIndex += 1) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5 + this.random() * 2.4, 1), cloudMaterial)
        puff.position.set((puffIndex - puffCount / 2) * 2.4, this.random() * 1.4, this.random() * 1.6)
        puff.scale.y = 0.56
        cloud.add(puff)
      }
      cloud.position.set((this.random() - 0.5) * 150, 40 + this.random() * 24, (this.random() - 0.5) * 150)
      cloud.userData.speed = 0.45 + this.random() * 0.65
      this.clouds.push(cloud)
      this.scene.add(cloud)
    }
  }

  createCanyon() {
    this.canyon = new THREE.Group()
    this.canyon.visible = false
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x9a5d3e, roughness: 0.93, flatShading: true })
    for (let index = 0; index < 34; index += 1) {
      const angle = this.random() * Math.PI * 2
      const radius = 45 + this.random() * 34
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const height = 3 + this.random() * 9
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(height, 0), rockMaterial)
      rock.position.set(x, terrainHeight(x, z) + height * 0.32, z)
      rock.scale.set(0.7 + this.random() * 0.8, 1.2 + this.random(), 0.7 + this.random() * 0.8)
      rock.rotation.set(this.random(), this.random(), this.random())
      rock.castShadow = true
      this.canyon.add(rock)
    }
    this.scene.add(this.canyon)
  }

  setPreset(presetId) {
    this.canyon.visible = presetId === 'canyon'
  }

  setNightMode(isNight) {
    this.isNight = isNight
    if (isNight) {
      this.skyUniforms.topColor.value.set(0x071126)
      this.skyUniforms.bottomColor.value.set(0x263651)
      this.hemisphere.color.set(0x7c9cc4)
      this.hemisphere.groundColor.set(0x17202a)
      this.hemisphere.intensity = 0.72
      this.sun.color.set(0xa8c6ff)
      this.sun.intensity = 0.5
      this.sun.position.set(35, 58, -28)
      this.waterMaterial.color.set(0x12364d)
      this.waterMaterial.emissive.set(0x0b2b3a)
      this.waterMaterial.emissiveIntensity = 0.7
      this.scene.fog.color.set(0x101827)
      this.scene.fog.density = 0.0068
    } else {
      this.skyUniforms.topColor.value.set(0x62b6e8)
      this.skyUniforms.bottomColor.value.set(0xffd8a8)
      this.hemisphere.color.set(0xbfe7ff)
      this.hemisphere.groundColor.set(0x53613d)
      this.hemisphere.intensity = 2.25
      this.sun.color.set(0xfff0c4)
      this.sun.intensity = 3.25
      this.sun.position.set(-48, 76, 38)
      this.waterMaterial.color.set(0x247d92)
      this.waterMaterial.emissive.set(0x061b23)
      this.waterMaterial.emissiveIntensity = 0.25
      this.scene.fog.color.set(0xb9d9dd)
      this.scene.fog.density = 0.0032
    }
  }

  update(delta, elapsed) {
    this.time = elapsed
    this.ferrisWheel.rotation.z -= delta * 0.055
    const wheelAngle = this.ferrisWheel.rotation.z
    const radius = 18
    this.cabins.forEach((cabin, index) => {
      const angle = wheelAngle + (index / this.cabins.length) * Math.PI * 2
      cabin.position.set(Math.cos(angle) * radius, 26 + Math.sin(angle) * radius, 0)
      cabin.rotation.z = 0
    })

    this.balloons.forEach((balloon, index) => {
      balloon.position.y = balloon.userData.baseY + Math.sin(elapsed * 0.38 + balloon.userData.phase) * 1.8
      balloon.position.x += Math.sin(elapsed * 0.16 + index) * delta * 0.28
      balloon.rotation.z = Math.sin(elapsed * 0.42 + index) * 0.06
    })

    this.clouds.forEach((cloud) => {
      cloud.position.x += cloud.userData.speed * delta
      if (cloud.position.x > 105) cloud.position.x = -105
    })

    this.water.rotation.z = Math.sin(elapsed * 0.2) * 0.008
    this.water.position.y = 0.12 + Math.sin(elapsed * 0.7) * 0.025
  }
}
