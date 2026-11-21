import * as THREE from 'three';
import { soundEngine } from './audio.js';

export class PortMorrowCity {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // 碰撞盒数组 { box: THREE.Box3, type: 'building' | 'prop' }
    this.interactables = []; // 交互触发区 { id, name, position, radius, callback }
    this.zones = [
      { name: '钟楼集市 (Clockmarket)', street: '电车大道 (Tramline Avenue)', x: 0, z: 0, r: 85 },
      { name: '海港码头 (Wharf 7)', street: '海堤栈道 (Harbor Boardwalk)', x: -160, z: 80, r: 90 },
      { name: '旧电车机械所 (Tram Works)', street: '铁轨调车支线 (Depot Spur)', x: 140, z: -100, r: 80 },
      { name: '北岬灯塔 (North Cape)', street: '灯塔岬角路 (Lighthouse Blv)', x: -180, z: -200, r: 90 },
      { name: '莫罗修车库 (Morrow Garage)', street: '工坊巷 (Craft Lane)', x: 90, z: 70, r: 60 }
    ];

    // 旧电车实例与路线
    this.vintageTram = null;
    this.tramProgress = 0;
    this.tramBellTimer = 0;

    // 海水材质动态引用
    this.waterMesh = null;
    this.seagulls = [];

    // 失踪邮包 3D 锚点
    this.parcelMeshes = [];

    // 初始化场景内容
    this.initWorld();
  }

  initWorld() {
    this.buildTerrainAndSea();
    this.buildRoadsAndTramlines();
    this.buildBuildingsAndBlocks();
    this.buildStreetProps();
    this.buildVintageTram();
    this.buildParcels();
    this.buildSeagulls();
  }

  // 1. 地表、海堤与海浪
  buildTerrainAndSea() {
    // 陆地基础底座 (米色与暖岩石地表)
    const landGeo = new THREE.PlaneGeometry(600, 600);
    const landMat = new THREE.MeshStandardMaterial({
      color: 0xd8d0bc,
      roughness: 0.9,
      metalness: 0.05
    });
    const land = new THREE.Mesh(landGeo, landMat);
    land.rotation.x = -Math.PI / 2;
    land.position.y = -0.1;
    land.receiveShadow = true;
    this.scene.add(land);

    // 港口海域 (南侧与西侧大海)
    const waterGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3d7e9a,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(-280, -1.8, 200);
    this.scene.add(this.waterMesh);

    // 海港石造防波堤与木质老码头栈道
    this.buildHarborPier();
  }

  // 码头栈道与防波堤
  buildHarborPier() {
    const seaWallMat = new THREE.MeshStandardMaterial({ color: 0x8a8479, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x936f4c, roughness: 0.8 });

    // 沿海防波堤 (西面沿线)
    const wallGeo = new THREE.BoxGeometry(16, 3, 380);
    const wall = new THREE.Mesh(wallGeo, seaWallMat);
    wall.position.set(-230, 0.5, 0);
    wall.receiveShadow = true;
    wall.castShadow = true;
    this.scene.add(wall);
    this.colliders.push({ box: new THREE.Box3().setFromObject(wall), type: 'building' });

    // 伸入海面的木制码头 Wharf 7
    const pierGeo = new THREE.BoxGeometry(140, 2, 36);
    const pier = new THREE.Mesh(pierGeo, woodMat);
    pier.position.set(-300, 0.2, 70);
    pier.receiveShadow = true;
    this.scene.add(pier);

    // 码头木桩
    const pileGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 8);
    for (let x = -360; x <= -240; x += 30) {
      for (let z of [54, 86]) {
        const pile = new THREE.Mesh(pileGeo, woodMat);
        pile.position.set(x, -1.5, z);
        this.scene.add(pile);
      }
    }

    // 停泊的木质小渔船
    const boatGeo = new THREE.ConeGeometry(5, 14, 4);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0xd95a3f });
    const boat = new THREE.Mesh(boatGeo, boatMat);
    boat.rotation.x = Math.PI / 2;
    boat.rotation.z = 0.3;
    boat.position.set(-340, -0.6, 105);
    this.scene.add(boat);

    // 北岬灯塔 (白色圆锥柱 + 红色顶部 + 玻璃观景台)
    const towerGeo = new THREE.CylinderGeometry(3.2, 5.5, 38, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.6 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-180, 19, -200);
    tower.castShadow = true;
    this.scene.add(tower);
    this.colliders.push({ box: new THREE.Box3().setFromObject(tower), type: 'building' });

    // 灯塔红色圆顶
    const domeGeo = new THREE.SphereGeometry(4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xc83a2a });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(-180, 38, -200);
    this.scene.add(dome);

    // 灯塔透镜与旋转灯光
    const lightBoxGeo = new THREE.CylinderGeometry(3.5, 3.5, 4, 12);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffea9f, emissive: 0xffcc33, emissiveIntensity: 0.6 });
    const lightBox = new THREE.Mesh(lightBoxGeo, glassMat);
    lightBox.position.set(-180, 36, -200);
    this.scene.add(lightBox);
  }

  // 2. 街道系统与旧电车铁轨
  buildRoadsAndTramlines() {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x47494d, roughness: 0.85 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xbdb7ab, roughness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x828892, metalness: 0.8, roughness: 0.25 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf4c242 }); // 双黄线
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xf0ede6 }); // 车道虚线

    // 主干道：电车大道 (东西向，宽 32m，长 500m)
    const mainAvenueGeo = new THREE.PlaneGeometry(500, 32);
    const mainAvenue = new THREE.Mesh(mainAvenueGeo, asphaltMat);
    mainAvenue.rotation.x = -Math.PI / 2;
    mainAvenue.position.set(0, 0.01, 0);
    mainAvenue.receiveShadow = true;
    this.scene.add(mainAvenue);

    // 南北纵向大道 (两根：x = -80, x = 80)
    for (let x of [-80, 80]) {
      const roadGeo = new THREE.PlaneGeometry(26, 440);
      const road = new THREE.Mesh(roadGeo, asphaltMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.012, 0);
      road.receiveShadow = true;
      this.scene.add(road);
    }

    // 环岛与次干道 (z = 120, z = -120)
    for (let z of [-130, 120]) {
      const crossGeo = new THREE.PlaneGeometry(420, 22);
      const cross = new THREE.Mesh(crossGeo, asphaltMat);
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(0, 0.011, z);
      cross.receiveShadow = true;
      this.scene.add(cross);
    }

    // 道路中心双黄线 (在主电车大道)
    const lineGeo = new THREE.PlaneGeometry(480, 0.35);
    const yellow1 = new THREE.Mesh(lineGeo, stripeMat);
    yellow1.rotation.x = -Math.PI / 2;
    yellow1.position.set(0, 0.02, 0.3);
    this.scene.add(yellow1);

    const yellow2 = new THREE.Mesh(lineGeo, stripeMat);
    yellow2.rotation.x = -Math.PI / 2;
    yellow2.position.set(0, 0.02, -0.3);
    this.scene.add(yellow2);

    // 白色车道分割虚线
    const dashGeo = new THREE.PlaneGeometry(4, 0.3);
    for (let x = -230; x <= 230; x += 10) {
      for (let offset of [-7.5, 7.5]) {
        const dash = new THREE.Mesh(dashGeo, whiteStripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.02, offset);
        this.scene.add(dash);
      }
    }

    // 人行横道斑马线 (在主要路口)
    this.buildCrosswalks();

    // 嵌入路面的旧电车铁轨线 (两条平行的银灰钢轨)
    const railWidth = 0.22;
    const trackSpan = 3.2; // 轨距
    const railGeo = new THREE.BoxGeometry(490, 0.08, railWidth);

    const railLeft = new THREE.Mesh(railGeo, railMat);
    railLeft.position.set(0, 0.04, -trackSpan / 2);
    this.scene.add(railLeft);

    const railRight = new THREE.Mesh(railGeo, railMat);
    railRight.position.set(0, 0.04, trackSpan / 2);
    this.scene.add(railRight);

    // 电车架空线杆 (Catenary Poles) 与架空铜线
    this.buildTramCatenary();
  }

  // 斑马线
  buildCrosswalks() {
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xeeebe2 });
    const barGeo = new THREE.PlaneGeometry(1.2, 6);
    const junctions = [-80, 0, 80];

    junctions.forEach((jx) => {
      for (let side of [-18, 18]) {
        for (let i = -10; i <= 10; i += 2.5) {
          const bar = new THREE.Mesh(barGeo, whiteMat);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(jx + i, 0.022, side);
          this.scene.add(bar);
        }
      }
    });
  }

  // 电车架空接触网吊线与电线杆
  buildTramCatenary() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e4235, metalness: 0.7, roughness: 0.4 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1f2421 });

    const poleGeo = new THREE.CylinderGeometry(0.25, 0.35, 11, 8);
    const armGeo = new THREE.BoxGeometry(0.2, 0.2, 8);

    for (let x = -220; x <= 220; x += 40) {
      // 竖直立杆
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 5.5, -9);
      pole.castShadow = true;
      this.scene.add(pole);

      // 横向悬挂支撑臂
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(x, 10.2, -5);
      this.scene.add(arm);

      // 碰撞检测
      this.colliders.push({ box: new THREE.Box3().setFromObject(pole), type: 'prop' });
    }

    // 纵向架空电线 (横贯电车线上空)
    const wireGeo = new THREE.CylinderGeometry(0.04, 0.04, 460, 6);
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0, 10, 0);
    this.scene.add(wire);
  }

  // 3. 城市建筑群与商业街区
  buildBuildingsAndBlocks() {
    // 建筑配色卡盘：柔和的港口洋房、红砖工坊、米白灰泥洋楼、薄荷绿外墙
    const buildingColors = [
      0xead8be, // 经典暖米色灰泥
      0xd58b68, // 红砖陶瓦色
      0x96b6b3, // 海港薄荷灰绿
      0xe7d39f, // 暖杏黄
      0x6f8793, // 板岩青灰
      0xc5b9a8  // 砂岩白
    ];

    // 街区定义：在道路划分的四象限与沿街排列
    const blocks = [
      // 北侧主街区 (z: -35 到 -110)
      { minX: -200, maxX: -100, minZ: -100, maxZ: -28 },
      { minX: -60, maxX: 60, minZ: -100, maxZ: -28 },
      { minX: 100, maxX: 200, minZ: -100, maxZ: -28 },

      // 南侧商业街区 (z: 28 到 105)
      { minX: -200, maxX: -100, minZ: 28, maxZ: 105 },
      { minX: -60, maxX: 60, minZ: 28, maxZ: 105 },
      { minX: 100, maxX: 200, minZ: 28, maxZ: 105 }
    ];

    blocks.forEach((blk, bIdx) => {
      const stepX = (blk.maxX - blk.minX) / 3;
      const stepZ = (blk.maxZ - blk.minZ) / 2;

      for (let bx = blk.minX; bx < blk.maxX; bx += stepX) {
        for (let bz = blk.minZ; bz < blk.maxZ; bz += stepZ) {
          const w = stepX - 5;
          const d = stepZ - 5;
          const h = 14 + Math.random() * 24; // 楼高 14~38m
          const color = buildingColors[(bIdx + Math.floor(bx + bz)) % buildingColors.length];

          const bldg = this.createArtDecoBuilding(w, h, d, color, bx + w / 2, bz + d / 2);
          this.scene.add(bldg);
          this.colliders.push({ box: new THREE.Box3().setFromObject(bldg), type: 'building' });
        }
      }
    });

    // 放置特定标志性地标建筑与招牌
    this.buildLandmarkBuildings();
  }

  // 经典港口复古洋楼生成
  createArtDecoBuilding(w, h, d, colorHex, posX, posZ) {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.85,
      metalness: 0.1
    });

    // 主楼体
    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const body = new THREE.Mesh(bodyGeo, wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 屋顶女儿墙与边框
    const roofTrimGeo = new THREE.BoxGeometry(w + 0.8, 1.2, d + 0.8);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a433d, roughness: 0.7 });
    const roofTrim = new THREE.Mesh(roofTrimGeo, trimMat);
    roofTrim.position.y = h + 0.6;
    group.add(roofTrim);

    // 屋顶冷却塔或水箱
    if (Math.random() > 0.4) {
      const tankGeo = new THREE.CylinderGeometry(2, 2, 4, 10);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x7a6e65 });
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set((Math.random() - 0.5) * (w * 0.5), h + 2.6, (Math.random() - 0.5) * (d * 0.5));
      group.add(tank);
    }

    // 正面窗户矩阵
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x25313d,
      roughness: 0.2,
      metalness: 0.8
    });
    const winGeo = new THREE.PlaneGeometry(1.6, 2.4);

    const floors = Math.floor(h / 4.5);
    const cols = Math.floor(w / 3.8);

    for (let f = 1; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const win = new THREE.Mesh(winGeo, winMat);
        const winX = -w / 2 + 2.5 + c * 3.6;
        const winY = f * 4.2;
        win.position.set(winX, winY, d / 2 + 0.05);
        group.add(win);
      }
    }

    // 沿街一楼商铺遮阳篷 (Awnings)
    const awningMat = new THREE.MeshStandardMaterial({
      color: Math.random() > 0.5 ? 0xc84c36 : 0x2b596d,
      roughness: 0.9
    });
    const awningGeo = new THREE.BoxGeometry(w * 0.8, 0.4, 2.5);
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.rotation.x = 0.25;
    awning.position.set(0, 3.8, d / 2 + 1.2);
    group.add(awning);

    group.position.set(posX, 0, posZ);
    return group;
  }

  // 特殊地标建筑：钟楼、印刷社 (RUE PRINTS)、面包坊、修车库
  buildLandmarkBuildings() {
    // 1. 钟楼大厦 (Clock Tower - Clockmarket)
    const clockGroup = new THREE.Group();
    const clockWallMat = new THREE.MeshStandardMaterial({ color: 0xdfcbaf, roughness: 0.7 });
    const towerH = 46;
    const towerGeo = new THREE.BoxGeometry(18, towerH, 18);
    const tower = new THREE.Mesh(towerGeo, clockWallMat);
    tower.position.y = towerH / 2;
    tower.castShadow = true;
    clockGroup.add(tower);

    // 钟楼金顶尖塔
    const spireGeo = new THREE.ConeGeometry(8, 16, 4);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x3d6b63, roughness: 0.4 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = towerH + 8;
    spire.rotation.y = Math.PI / 4;
    clockGroup.add(spire);

    // 巨大圆形表盘 (四面)
    const dialGeo = new THREE.CircleGeometry(3.5, 24);
    const dialMat = new THREE.MeshBasicMaterial({ color: 0xfffcf0 });
    for (let angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const dial = new THREE.Mesh(dialGeo, dialMat);
      dial.position.set(0, 36, 0);
      dial.rotation.y = angle;
      dial.translateZ(9.1);
      clockGroup.add(dial);
    }

    clockGroup.position.set(0, 0, -50);
    this.scene.add(clockGroup);
    this.colliders.push({ box: new THREE.Box3().setFromObject(clockGroup), type: 'building' });

    // 2. 街角印刷社 (RUE PRINTS) —— 还原原图招牌与临街铺面
    const printSignGroup = this.createStreetShopSign('RUE PRINTS', 0x223547, 0xf6ede2);
    printSignGroup.position.set(-35, 6.5, -23);
    this.scene.add(printSignGroup);

    // 3. 莫罗港维修车库 (Port Morrow Garage)
    const garageGroup = new THREE.Group();
    const garageWallMat = new THREE.MeshStandardMaterial({ color: 0x8b3e2f, roughness: 0.8 });
    const garageGeo = new THREE.BoxGeometry(28, 12, 34);
    const garageMesh = new THREE.Mesh(garageGeo, garageWallMat);
    garageMesh.position.y = 6;
    garageMesh.castShadow = true;
    garageGroup.add(garageMesh);

    // 车库卷帘门
    const rollDoorGeo = new THREE.PlaneGeometry(10, 8);
    const rollDoorMat = new THREE.MeshStandardMaterial({ color: 0x5a636c, metalness: 0.8, roughness: 0.3 });
    const rollDoor = new THREE.Mesh(rollDoorGeo, rollDoorMat);
    rollDoor.position.set(0, 4, 17.1);
    garageGroup.add(rollDoor);

    const garageSign = this.createStreetShopSign('PORT MORROW GARAGE', 0x1b2838, 0xef8f3d);
    garageSign.position.set(0, 10.5, 17.3);
    garageGroup.add(garageSign);

    garageGroup.position.set(90, 0, 70);
    this.scene.add(garageGroup);
    this.colliders.push({ box: new THREE.Box3().setFromObject(garageGroup), type: 'building' });

    // 车库门口交互触发区
    this.interactables.push({
      id: 'garage_zone',
      name: '莫罗修车库 (Morrow Garage)',
      position: new THREE.Vector3(90, 1, 95),
      radius: 12,
      type: 'garage'
    });
  }

  // 创建复古文字招牌
  createStreetShopSign(text, bgColor, textColor) {
    const group = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // 背景板
    ctx.fillStyle = `#${bgColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 512, 128);

    // 边框金线
    ctx.strokeStyle = `#${textColor.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 112);

    // 字体排版
    ctx.fillStyle = `#${textColor.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 44px "Trebuchet MS", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture });
    const signGeo = new THREE.BoxGeometry(12, 3, 0.4);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    group.add(signMesh);

    return group;
  }

  // 4. 街道道具：消防栓（原图亮点）、路灯、行道棕榈树、垃圾桶
  buildStreetProps() {
    const hydrantGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
    const hydrantCapGeo = new THREE.SphereGeometry(0.38, 8, 8);
    const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xdf382b, roughness: 0.5 }); // 亮红消防栓

    const lampMat = new THREE.MeshStandardMaterial({ color: 0x313d36, metalness: 0.6, roughness: 0.5 });
    const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });

    // 沿主街道布置消防栓与路灯
    for (let x = -200; x <= 200; x += 45) {
      // 鲜艳红色消防栓（严格呼应原图右侧的标志性消防栓）
      const hyd = new THREE.Group();
      const hydBody = new THREE.Mesh(hydrantGeo, hydrantMat);
      hydBody.position.y = 0.6;
      const hydCap = new THREE.Mesh(hydrantCapGeo, hydrantMat);
      hydCap.position.y = 1.2;
      hyd.add(hydBody, hydCap);
      hyd.position.set(x + 12, 0, 18);
      this.scene.add(hyd);
      this.colliders.push({ box: new THREE.Box3().setFromObject(hyd), type: 'prop' });

      // 欧式复古铸铁双臂路灯
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 9, 8), lampMat);
      pole.position.y = 4.5;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lampLightMat);
      bulb.position.set(0, 8.8, 0);
      lamp.add(pole, bulb);
      lamp.position.set(x, 0, -18);
      this.scene.add(lamp);
      this.colliders.push({ box: new THREE.Box3().setFromObject(lamp), type: 'prop' });

      // 行道海滨棕榈树
      this.buildPalmTree(x + 22, 19);
      this.buildPalmTree(x - 18, -19);
    }
  }

  // 沿海棕榈树
  buildPalmTree(x, z) {
    const tree = new THREE.Group();
    // 弯曲树干
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x73553e, roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.7, 10, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 5;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    tree.add(trunk);

    // 棕榈大叶片
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d7042, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leafGeo = new THREE.ConeGeometry(1.6, 6, 4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0, 9.8, 0);
      leaf.rotation.x = 1.2;
      leaf.rotation.y = angle;
      tree.add(leaf);
    }

    tree.position.set(x, 0, z);
    this.scene.add(tree);
    this.colliders.push({ box: new THREE.Box3().setFromObject(tree), type: 'prop' });
  }

  // 5. 自动巡游的复古老电车 (Vintage Tram)
  buildVintageTram() {
    this.vintageTram = new THREE.Group();
    const tramBodyMat = new THREE.MeshStandardMaterial({ color: 0xb53c29, roughness: 0.6 }); // 经典电车红
    const tramCreamMat = new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.6 }); // 象牙奶油白
    const tramGlassMat = new THREE.MeshStandardMaterial({ color: 0x223240, roughness: 0.1, metalness: 0.9 });

    // 下车身
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(18, 3.4, 3.8), tramBodyMat);
    lowerBody.position.y = 2.4;
    lowerBody.castShadow = true;
    this.vintageTram.add(lowerBody);

    // 上车身窗台层
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(17.8, 2.2, 3.6), tramCreamMat);
    upperBody.position.y = 5.2;
    this.vintageTram.add(upperBody);

    // 拱形车顶
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.8, 4.0), tramBodyMat);
    roof.position.y = 6.6;
    this.vintageTram.add(roof);

    // 车顶菱形受电弓 (Pantograph)
    const pantoMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.9 });
    const panto = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, 1.4), pantoMat);
    panto.position.set(0, 8.2, 0);
    this.vintageTram.add(panto);

    // 车身两侧窗户
    for (let x = -7; x <= 7; x += 2.2) {
      for (let z of [-1.82, 1.82]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.5), tramGlassMat);
        win.position.set(x, 5.2, z);
        if (z < 0) win.rotation.y = Math.PI;
        this.vintageTram.add(win);
      }
    }

    // 前后大灯
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffea92 });
    for (let end of [-9.05, 9.05]) {
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), headlightMat);
      light.rotation.z = Math.PI / 2;
      light.position.set(end, 2.8, 0);
      this.vintageTram.add(light);
    }

    this.vintageTram.position.set(-150, 0, 0);
    this.scene.add(this.vintageTram);
  }

  // 6. 散落各处的 3 个失踪邮包 (Lost Parcels)
  buildParcels() {
    const parcelGeo = new THREE.BoxGeometry(1.6, 1.2, 2.0);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#caa372'; // 牛皮纸
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#b83b28'; // 红色打包带十字
    ctx.fillRect(110, 0, 36, 256);
    ctx.fillRect(0, 110, 256, 36);
    ctx.fillStyle = '#ffffff'; // 邮政快递标签
    ctx.fillRect(30, 30, 80, 50);

    const parcelTex = new THREE.CanvasTexture(canvas);
    const parcelMat = new THREE.MeshStandardMaterial({ map: parcelTex, roughness: 0.8 });

    // 3 个失踪包裹的藏匿点
    const parcelLocs = [
      { id: 'parcel_1', name: '防波堤 7 号栈道失落包裹', pos: new THREE.Vector3(-310, 1.6, 68) },
      { id: 'parcel_2', name: '旧电车支线长椅旁失落包裹', pos: new THREE.Vector3(145, 1.0, -115) },
      { id: 'parcel_3', name: '北岬灯塔山崖露台失落包裹', pos: new THREE.Vector3(-195, 1.2, -185) }
    ];

    parcelLocs.forEach((loc) => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(parcelGeo, parcelMat);
      mesh.castShadow = true;
      group.add(mesh);

      // 金色悬浮光环
      const ringGeo = new THREE.RingGeometry(1.6, 2.2, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd24d, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.5;
      group.add(ring);

      group.position.copy(loc.pos);
      this.scene.add(group);

      this.parcelMeshes.push({
        id: loc.id,
        name: loc.name,
        group: group,
        position: loc.pos,
        collected: false
      });
    });
  }

  // 7. 海鸥群
  buildSeagulls() {
    const wingGeo = new THREE.BufferGeometry();
    // 简单 V 字形海鸥多边形
    const vertices = new Float32Array([
      -1.2, 0.4, 0,
      0, 0, 0.8,
      0, 0, -0.6,
      1.2, 0.4, 0,
      0, 0, 0.8,
      0, 0, -0.6
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wingGeo.computeVertexNormals();

    const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    for (let i = 0; i < 12; i++) {
      const bird = new THREE.Mesh(wingGeo, birdMat);
      bird.position.set(-200 + Math.random() * 200, 24 + Math.random() * 15, -100 + Math.random() * 250);
      bird.userData = {
        speed: 0.3 + Math.random() * 0.2,
        wingPhase: Math.random() * Math.PI * 2,
        center: bird.position.clone()
      };
      this.seagulls.push(bird);
      this.scene.add(bird);
    }
  }

  // 逐帧更新城市动态（电车巡航、海浪、海鸥飞行、邮包旋转）
  update(delta) {
    // 1. 电车沿轨道在 x: -220 到 220 之间平稳往返
    if (this.vintageTram) {
      this.tramProgress += delta * 0.05; // 周期约 20 秒
      const range = 210;
      const t = (Math.sin(this.tramProgress) + 1) / 2;
      const x = -range + t * (range * 2);
      this.vintageTram.position.x = x;

      // 根据运动方向旋转电车车身
      const movingRight = Math.cos(this.tramProgress) > 0;
      this.vintageTram.rotation.y = movingRight ? 0 : Math.PI;

      // 周期性清脆电车敲钟
      this.tramBellTimer += delta;
      if (this.tramBellTimer > 18) {
        this.tramBellTimer = 0;
        soundEngine.playTramBell();
      }
    }

    // 2. 失踪邮包上下起伏并自转
    const time = performance.now() * 0.002;
    this.parcelMeshes.forEach((p) => {
      if (!p.collected) {
        p.group.rotation.y += delta * 1.5;
        p.group.position.y = p.position.y + Math.sin(time + p.position.x) * 0.25;
      }
    });

    // 3. 海水轻微波浪
    if (this.waterMesh) {
      this.waterMesh.position.y = -1.8 + Math.sin(time * 0.8) * 0.15;
    }

    // 4. 海鸥滑翔与扇翅
    this.seagulls.forEach((bird) => {
      const ud = bird.userData;
      ud.wingPhase += delta * 6;
      bird.position.x += ud.speed;
      if (bird.position.x > 180) bird.position.x = -260;
      bird.position.y = ud.center.y + Math.sin(ud.wingPhase * 0.3) * 1.5;
      bird.rotation.z = Math.sin(ud.wingPhase) * 0.25;
    });
  }

  // 获取当前玩家所处街区/地点名称
  getCurrentZone(pos) {
    for (let z of this.zones) {
      const dist = Math.hypot(pos.x - z.x, pos.z - z.z);
      if (dist <= z.r) {
        return z;
      }
    }
    return { name: '海港海滨大道 (Harbor Blv)', street: '海堤外围 (Waterfront Drive)' };
  }
}
