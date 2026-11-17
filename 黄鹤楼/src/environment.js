import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from './utils.js';

/**
 * 蛇山地形高度函数
 * 中心广场为平台，向外逐渐下降至江岸。
 */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= 30) return 0;
  const t = r - 30;
  let h = -Math.min(16, t * 0.17);
  // 两段低频起伏，让山坡不至于像圆锥
  const n =
    Math.sin(x * 0.055) * Math.cos(z * 0.05) +
    Math.sin(x * 0.12 + z * 0.09) * 0.45 +
    Math.cos(x * 0.03 - z * 0.07) * 0.35;
  h += n * 1.1 * Math.min(1, t / 26);
  return h;
}

/** 生成地形网格（顶点着色：草地 / 深林 / 江岸） */
function buildTerrain() {
  const geo = new THREE.PlaneGeometry(440, 440, 110, 110);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x5c8150);
  const cDeep = new THREE.Color(0x3b5a3e);
  const cBank = new THREE.Color(0x5c5748);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    const r = Math.hypot(x, z);
    if (y > -13) {
      tmp.copy(cGrass).lerp(cDeep, Math.min(1, (r - 30) / 120));
    } else {
      tmp.copy(cDeep).lerp(cBank, Math.min(1, (-13 - y) / 3));
    }

    const n = 0.9 + Math.random() * 0.2;
    colors[i * 3] = tmp.r * n;
    colors[i * 3 + 1] = tmp.g * n;
    colors[i * 3 + 2] = tmp.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 松树：树干 + 三层锥形树冠 */
function buildPines(mats) {
  const trunkGeos = [];
  const leafGeos = [];

  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(32, 138);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (z < -104) continue; // 不种到江里
    // 南侧登山步道留空
    if (Math.abs(x) < 13 && z > 24) continue;
    const y = terrainHeight(x, z);
    const s = rand(0.8, 1.5);

    const trunk = new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 3.2 * s, 6);
    trunk.translate(x, y + 1.6 * s, z);
    trunkGeos.push(trunk);

    for (let k = 0; k < 3; k++) {
      const cone = new THREE.ConeGeometry((1.9 - k * 0.45) * s, (2.6 - k * 0.3) * s, 7);
      cone.translate(x, y + (3.2 + k * 1.5) * s, z);
      leafGeos.push(cone);
    }
  }

  const group = new THREE.Group();
  if (trunkGeos.length) {
    const trunkMesh = new THREE.Mesh(mergeGeometries(trunkGeos, false), mats.trunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    group.add(trunkMesh);
  }
  if (leafGeos.length) {
    const leafMesh = new THREE.Mesh(mergeGeometries(leafGeos, false), mats.tree);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
  }
  trunkGeos.forEach((g) => g.dispose());
  leafGeos.forEach((g) => g.dispose());
  return group;
}

/** 对岸武汉城市剪影（低多边形色块） */
function buildCity(mats) {
  const geos = [];
  const windowGeos = [];
  const tints = [0x3c4a58, 0x46525f, 0x354250, 0x505a64, 0x3f4c5c];

  for (let i = 0; i < 54; i++) {
    const x = rand(-270, 270);
    const z = rand(-380, -282);
    const w = rand(9, 26);
    const d = rand(9, 22);
    const h = rand(12, 58);
    const baseY = -13.0;

    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, baseY + h / 2, z);
    const col = new THREE.Color(tints[i % tints.length]);
    col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      colors[k * 3] = col.r;
      colors[k * 3 + 1] = col.g;
      colors[k * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(g);

    // 夜间窗灯（贴在朝向江面的那一面）
    const rows = Math.floor(rand(2, 5));
    for (let k = 0; k < rows; k++) {
      const ww = w * rand(0.25, 0.62);
      const wh = rand(0.5, 1.1);
      const wy = baseY + rand(4, h - 3);
      const wg = new THREE.BoxGeometry(ww, wh, 0.25);
      wg.translate(x + rand(-w * 0.2, w * 0.2), wy, z + d / 2 + 0.12);
      windowGeos.push(wg);
    }
  }

  const group = new THREE.Group();
  const city = new THREE.Mesh(mergeGeometries(geos, false), mats.city);
  city.receiveShadow = false;
  city.castShadow = false;
  group.add(city);

  const win = new THREE.Mesh(mergeGeometries(windowGeos, false), mats.cityWindows);
  group.add(win);

  geos.forEach((g) => g.dispose());
  windowGeos.forEach((g) => g.dispose());
  return group;
}

/** 渐变天空球 */
function buildSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x4f97e0) },
    bottomColor: { value: new THREE.Color(0xffe6c0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        float t = smoothstep(-0.12, 0.62, h);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(620, 32, 18), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

/** 缓慢漂移的云 */
function buildClouds(mats) {
  const group = new THREE.Group();
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const sprite = new THREE.Sprite(mats.cloud.clone());
    sprite.material.opacity = rand(0.35, 0.8);
    const s = rand(70, 170);
    sprite.scale.set(s, s * 0.5, 1);
    sprite.position.set(rand(-320, 320), rand(65, 120), rand(-260, 160));
    group.add(sprite);
    clouds.push({ sprite, speed: rand(1.2, 3.4) });
  }
  return { group, clouds };
}

/** 星空 */
function buildStars() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = Math.random() * 0.95 + 0.05;
    const r = Math.sqrt(1 - y * y);
    const R = 560;
    positions[i * 3] = Math.cos(a) * r * R;
    positions[i * 3 + 1] = y * R;
    positions[i * 3 + 2] = Math.sin(a) * r * R;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export function buildEnvironment(scene, mats) {
  const group = new THREE.Group();
  group.name = '蛇山与长江';
  scene.add(group);

  // 地形
  const terrain = new THREE.Mesh(buildTerrain(), mats.terrain);
  terrain.receiveShadow = true;
  group.add(terrain);

  // 山顶广场
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(30, 80), mats.plaza);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  group.add(plaza);

  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(29.2, 30.2, 80), mats.stoneStep);
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.y = 0.035;
  plazaRing.receiveShadow = true;
  group.add(plazaRing);

  // 松树
  group.add(buildPines(mats));

  // 长江
  const waterGeo = new THREE.PlaneGeometry(680, 150);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, mats.water);
  water.position.set(0, -13.2, -190);
  group.add(water);

  // 近岸压边，遮住水面直边
  const bank = new THREE.Mesh(new THREE.BoxGeometry(680, 3.2, 8), mats.trunk);
  bank.position.set(0, -13.4, -117);
  bank.receiveShadow = true;
  group.add(bank);

  // 对岸河滩与城市
  const farBank = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), mats.tree);
  farBank.rotation.x = -Math.PI / 2;
  farBank.position.set(0, -13.0, -410);
  farBank.receiveShadow = false;
  group.add(farBank);
  group.add(buildCity(mats));

  // 天空、云、星
  const sky = buildSky();
  scene.add(sky.mesh);

  const clouds = buildClouds(mats);
  scene.add(clouds.group);

  const stars = buildStars();
  scene.add(stars.points);

  // ---------------- 光照 ----------------
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x7a7350, 1.15);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(72, 96, 58);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 8, 0);
  scene.add(sunTarget);
  sun.target = sunTarget;
  scene.add(sun);

  scene.fog = new THREE.Fog(0xdfe9f2, 220, 1000);

  // 昼夜颜色
  const dayTop = new THREE.Color(0x4f97e0);
  const dayBottom = new THREE.Color(0xffe6c0);
  const nightTop = new THREE.Color(0x050d1c);
  const nightBottom = new THREE.Color(0x1b2c47);
  const fogDay = new THREE.Color(0xdfe9f2);
  const fogNight = new THREE.Color(0x0a1420);
  const sunDay = new THREE.Color(0xfff0d0);
  const sunNight = new THREE.Color(0x9db8ff);
  const hemiDay = new THREE.Color(0xcfe6ff);
  const hemiNight = new THREE.Color(0x24365e);
  const hemiGroundDay = new THREE.Color(0x7a7350);
  const hemiGroundNight = new THREE.Color(0x141a24);

  const setNight = (k) => {
    sky.uniforms.topColor.value.copy(dayTop).lerp(nightTop, k);
    sky.uniforms.bottomColor.value.copy(dayBottom).lerp(nightBottom, k);
    scene.fog.color.copy(fogDay).lerp(fogNight, k);
    sun.intensity = 2.6 - 2.35 * k;
    sun.color.copy(sunDay).lerp(sunNight, k);
    hemi.intensity = 1.15 - 0.92 * k;
    hemi.color.copy(hemiDay).lerp(hemiNight, k);
    hemi.groundColor.copy(hemiGroundDay).lerp(hemiGroundNight, k);
    ambient.intensity = 0.3 - 0.2 * k;
    stars.mat.opacity = k * 0.95;
    mats.cityWindows.emissiveIntensity = 1.7 * k;
    mats.water.emissiveIntensity = 0.25 + 0.45 * k;
    for (const c of clouds.clouds) {
      c.sprite.material.color.setRGB(1 - 0.5 * k, 1 - 0.44 * k, 1 - 0.28 * k);
      c.sprite.material.opacity = c.baseOpacity * (1 - 0.72 * k);
    }
  };

  for (const c of clouds.clouds) c.baseOpacity = c.sprite.material.opacity;
  setNight(0);

  return {
    group,
    sun,
    water,
    clouds,
    setNight,
    update(dt) {
      // 云漂移
      for (const c of clouds.clouds) {
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > 360) c.sprite.position.x = -360;
      }
      // 江水流动
      mats.water.map.offset.x += dt * 0.013;
      mats.water.map.offset.y += dt * 0.005;
    },
  };
}
