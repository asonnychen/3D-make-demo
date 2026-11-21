import * as THREE from 'three';
import { soundEngine } from './audio.js';

export class PortMorrowCity {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.interactables = [];
    this.zones = [
      { name: '钟楼集市 (Clockmarket)', street: '电车大道 (Tramline Avenue)', x: 0, z: -40, r: 90 },
      { name: '海港码头 (Wharf 7)', street: '海堤栈道 (Harbor Boardwalk)', x: -160, z: 80, r: 90 },
      { name: '旧电车机械所 (Tram Works)', street: '铁轨调车支线 (Depot Spur)', x: 140, z: 120, r: 80 },
      { name: '北岬灯塔 (North Cape)', street: '灯塔岬角路 (Lighthouse Blv)', x: -180, z: -220, r: 90 },
      { name: '莫罗修车库 (Morrow Garage)', street: '工坊巷 (Craft Lane)', x: 80, z: 50, r: 60 }
    ];

    // 旧电车实例与路线 (放在远离玩家起点的对向或外侧轨道)
    this.vintageTram = null;
    this.tramProgress = Math.PI * 0.5; // 从远端开始巡航
    this.tramBellTimer = 0;

    // 前方漫游街车 (Traffic Car) —— 对应原图中前方的小轿车
    this.trafficCars = [];

    // 行人 NPC
    this.pedestrians = [];

    // 海水材质与海鸥
    this.waterMesh = null;
    this.seagulls = [];

    // 失踪邮包 3D 锚点
    this.parcelMeshes = [];

    this.initWorld();
  }

  initWorld() {
    this.buildTerrainAndSea();
    this.buildRoadsAndTramlines();
    this.buildBuildingsAndBlocks();
    this.buildStreetProps();
    this.buildVintageTram();
    this.buildTrafficCars();
    this.buildPedestrians();
    this.buildParcels();
    this.buildSeagulls();
  }

  // 1. 地表与海滨防波堤
  buildTerrainAndSea() {
    const landGeo = new THREE.PlaneGeometry(800, 800);
    const landMat = new THREE.MeshStandardMaterial({
      color: 0xdcd5c4,
      roughness: 0.95,
      metalness: 0.05
    });
    const land = new THREE.Mesh(landGeo, landMat);
    land.rotation.x = -Math.PI / 2;
    land.position.y = -0.05;
    land.receiveShadow = true;
    this.scene.add(land);

    // 西面大海
    const waterGeo = new THREE.PlaneGeometry(1000, 1000, 32, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3d7e9a,
      roughness: 0.2,
      metalness: 0.65,
      transparent: true,
      opacity: 0.88
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(-340, -1.8, 0);
    this.scene.add(this.waterMesh);

    this.buildHarborPier();
  }

  buildHarborPier() {
    const seaWallMat = new THREE.MeshStandardMaterial({ color: 0x8a8479, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x936f4c, roughness: 0.8 });

    // 沿海防波堤 (x = -200)
    const wallGeo = new THREE.BoxGeometry(16, 3, 500);
    const wall = new THREE.Mesh(wallGeo, seaWallMat);
    wall.position.set(-200, 0.5, 0);
    wall.receiveShadow = true;
    wall.castShadow = true;
    this.scene.add(wall);
    this.colliders.push({ box: new THREE.Box3().setFromObject(wall), type: 'building' });

    // 木栈道 Wharf 7
    const pierGeo = new THREE.BoxGeometry(120, 2, 36);
    const pier = new THREE.Mesh(pierGeo, woodMat);
    pier.position.set(-260, 0.2, 80);
    pier.receiveShadow = true;
    this.scene.add(pier);

    // 渔船
    const boatGeo = new THREE.ConeGeometry(4.5, 12, 4);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0xd95a3f });
    const boat = new THREE.Mesh(boatGeo, boatMat);
    boat.rotation.x = Math.PI / 2;
    boat.rotation.z = 0.3;
    boat.position.set(-290, -0.6, 110);
    this.scene.add(boat);

    // 北岬灯塔
    const towerGeo = new THREE.CylinderGeometry(3.2, 5.5, 38, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.6 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-160, 19, -220);
    tower.castShadow = true;
    this.scene.add(tower);
    this.colliders.push({ box: new THREE.Box3().setFromObject(tower), type: 'building' });

    const domeGeo = new THREE.SphereGeometry(4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xc83a2a });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(-160, 38, -220);
    this.scene.add(dome);
  }

  // 2. 街道系统与旧电车铁轨 (纵向南北贯穿主干道)
  buildRoadsAndTramlines() {
    // 沥青颜色：还原原图平整柔和的灰调路面
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x4f5457,
      roughness: 0.88,
      metalness: 0.08
    });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.85, roughness: 0.25 });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xf3bd3e }); // 双黄线
    const whiteStripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 }); // 车道虚线

    // 主干道：电车大道 (宽 36m，长 600m)
    const mainAvenueGeo = new THREE.PlaneGeometry(36, 600);
    const mainAvenue = new THREE.Mesh(mainAvenueGeo, asphaltMat);
    mainAvenue.rotation.x = -Math.PI / 2;
    mainAvenue.position.set(0, 0.01, 0);
    mainAvenue.receiveShadow = true;
    this.scene.add(mainAvenue);

    // 左右人行道
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xdfd7c5, roughness: 0.9 });
    for (let sx of [-23, 23]) {
      const swGeo = new THREE.BoxGeometry(10, 0.28, 600);
      const sw = new THREE.Mesh(swGeo, sidewalkMat);
      sw.position.set(sx, 0.14, 0);
      sw.receiveShadow = true;
      this.scene.add(sw);
    }

    // 东西向横跨支路
    for (let z of [-140, 0, 140]) {
      const crossRoadGeo = new THREE.PlaneGeometry(360, 24);
      const crossRoad = new THREE.Mesh(crossRoadGeo, asphaltMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.012, z);
      crossRoad.receiveShadow = true;
      this.scene.add(crossRoad);
    }

    // 中心双黄线 (位于 x = 0，两条平行纵向黄色实线)
    const doubleYellowLen = 580;
    const yellowGeo = new THREE.PlaneGeometry(0.26, doubleYellowLen);

    const yellowLeft = new THREE.Mesh(yellowGeo, yellowStripeMat);
    yellowLeft.rotation.x = -Math.PI / 2;
    yellowLeft.position.set(-0.28, 0.02, 0);
    this.scene.add(yellowLeft);

    const yellowRight = new THREE.Mesh(yellowGeo, yellowStripeMat);
    yellowRight.rotation.x = -Math.PI / 2;
    yellowRight.position.set(0.28, 0.02, 0);
    this.scene.add(yellowRight);

    // 白色车道分割虚线 (在 x = -8.5 与 x = 8.5)
    const dashGeo = new THREE.PlaneGeometry(0.26, 4.5);
    for (let z = -280; z <= 280; z += 11) {
      for (let laneX of [-8.5, 8.5]) {
        const dash = new THREE.Mesh(dashGeo, whiteStripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(laneX, 0.022, z);
        this.scene.add(dash);
      }
    }

    // 原图前方路口斑马线 (在 z = -36 处)
    const zebraBarGeo = new THREE.PlaneGeometry(5.2, 0.85);
    for (let x = -16; x <= 16; x += 1.8) {
      const bar = new THREE.Mesh(zebraBarGeo, whiteStripeMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(x, 0.024, -36);
      this.scene.add(bar);
    }

    // 嵌入主大道的旧电车铁轨线 (双轨，设在外侧慢车道 x = 11.2 与 x = 14.4)
    const railWidth = 0.22;
    const railGeo = new THREE.BoxGeometry(railWidth, 0.07, 580);

    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(11.2, 0.038, 0);
    this.scene.add(rail1);

    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(14.4, 0.038, 0);
    this.scene.add(rail2);

    this.buildTramCatenary();
  }

  buildTramCatenary() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x24382c, metalness: 0.7, roughness: 0.4 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1a211d });

    const poleGeo = new THREE.CylinderGeometry(0.22, 0.32, 10.5, 8);
    const armGeo = new THREE.BoxGeometry(6.5, 0.2, 0.2);

    for (let z = -260; z <= 260; z += 45) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(18.2, 5.25, z);
      pole.castShadow = true;
      this.scene.add(pole);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(15.2, 9.8, z);
      this.scene.add(arm);

      this.colliders.push({ box: new THREE.Box3().setFromObject(pole), type: 'prop' });
    }

    const wireGeo = new THREE.CylinderGeometry(0.035, 0.035, 560, 6);
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(12.8, 9.6, 0);
    this.scene.add(wire);
  }

  // 3. 城市建筑群 (严格对齐原图左侧的 RUE PRINTS 商业楼和沿街建筑)
  buildBuildingsAndBlocks() {
    // 1. RUE PRINTS 印刷社商业骑楼 (位于左前方 x = -35, z = -55)
    this.buildRuePrintsBuilding();

    // 2. 钟楼大厦 (Clockmarket) —— 位于主路后方端点
    this.buildClockTower();

    // 3. 沿街其他商业洋楼与公寓 (分布在人行道以外，x <= -40 或 x >= 40)
    const bldgColors = [0xead8be, 0xd88a64, 0x98b8b4, 0xe8d5a2, 0x6e8794, 0xc7bba9];

    // 西侧沿街建筑 (x = -48)
    for (let z = -260; z <= 260; z += 52) {
      if (Math.abs(z - (-55)) < 30) continue;
      const h = 18 + Math.random() * 22;
      const bldg = this.createBuildingBlock(24, h, 42, bldgColors[Math.floor(Math.random() * bldgColors.length)]);
      bldg.position.set(-48, 0, z);
      this.scene.add(bldg);
      this.colliders.push({ box: new THREE.Box3().setFromObject(bldg), type: 'building' });
    }

    // 东侧沿街建筑 (x = 48) —— 保持在马路与人行道外侧，绝不遮挡视野！
    for (let z = -260; z <= 260; z += 52) {
      if (Math.abs(z - 75) < 30) continue;
      const h = 18 + Math.random() * 22;
      const bldg = this.createBuildingBlock(24, h, 42, bldgColors[Math.floor(Math.random() * bldgColors.length)]);
      bldg.position.set(48, 0, z);
      this.scene.add(bldg);
      this.colliders.push({ box: new THREE.Box3().setFromObject(bldg), type: 'building' });
    }

    // 4. 莫罗修车库 (Morrow Garage) —— 位于东侧支路内部 (x = 75, z = 75)
    this.buildGarageBuilding();
  }

  // 还原原图正前方横向铺展的【RUE PRINTS】与商业街景大楼
  buildRuePrintsBuilding() {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeddcc8, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a5047, roughness: 0.7 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2b3d4f, metalness: 0.7, roughness: 0.25 });

    // 正对马路前方的大楼主体 (后移至 z = -140，高度 18m，给天空留出大片视野！)
    const body = new THREE.Mesh(new THREE.BoxGeometry(160, 18, 26), wallMat);
    body.position.y = 9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 楼顶女儿墙边框
    const trim = new THREE.Mesh(new THREE.BoxGeometry(161, 0.9, 27), trimMat);
    trim.position.y = 18.45;
    group.add(trim);

    // 二至三层精致优雅的长条窗矩阵
    for (let f = 1; f <= 2; f++) {
      for (let x = -70; x <= 70; x += 14) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.4), winMat);
        win.position.set(x, 6 + f * 4.8, 13.05);
        group.add(win);
      }
    }

    // 底楼沿街玻璃门窗
    const shopWin = new THREE.Mesh(new THREE.PlaneGeometry(140, 3.6), winMat);
    shopWin.position.set(0, 2.6, 13.05);
    group.add(shopWin);

    // 【RUE PRINTS】招牌 (清晰居中偏左)
    const signGroup = this.createStreetShopSign('RUE PRINTS', 0x223547, 0xf6ede2);
    signGroup.position.set(-20, 5.2, 13.2);
    group.add(signGroup);

    // 【PORT BOOKS】招牌 (居中偏右)
    const sign2 = this.createStreetShopSign('PORT BOOKS', 0x3d5448, 0xf6ede2);
    sign2.position.set(28, 5.2, 13.2);
    group.add(sign2);

    // 放置在远方路口对面 (z = -140)
    group.position.set(0, 0, -140);
    this.scene.add(group);
    this.colliders.push({ box: new THREE.Box3().setFromObject(group), type: 'building' });

    // 大楼后方远景高楼天际线 (产生原图中的小城纵深感)
    const skyBldgMat = new THREE.MeshStandardMaterial({ color: 0x9fb4be, roughness: 0.9 });
    for (let bx of [-50, -10, 35, 75]) {
      const h = 32 + Math.random() * 16;
      const skyBldg = new THREE.Mesh(new THREE.BoxGeometry(22, h, 24), skyBldgMat);
      skyBldg.position.set(bx, h / 2, -185);
      this.scene.add(skyBldg);
    }
  }

  // 钟楼集市大厦 (移至偏右侧广场，不再挡住街道正前方视线)
  buildClockTower() {
    const clockGroup = new THREE.Group();
    const clockWallMat = new THREE.MeshStandardMaterial({ color: 0xdfcbaf, roughness: 0.7 });
    const towerH = 46;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(18, towerH, 18), clockWallMat);
    tower.position.y = towerH / 2;
    tower.castShadow = true;
    clockGroup.add(tower);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 4), new THREE.MeshStandardMaterial({ color: 0x3d6b63 }));
    spire.position.y = towerH + 8;
    spire.rotation.y = Math.PI / 4;
    clockGroup.add(spire);

    const dialMat = new THREE.MeshBasicMaterial({ color: 0xfffcf0 });
    for (let angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), dialMat);
      dial.position.set(0, 36, 0);
      dial.rotation.y = angle;
      dial.translateZ(9.05);
      clockGroup.add(dial);
    }

    // 放置在右后方广场 (x = 70, z = -130)
    clockGroup.position.set(70, 0, -130);
    this.scene.add(clockGroup);
    this.colliders.push({ box: new THREE.Box3().setFromObject(clockGroup), type: 'building' });
  }

  buildGarageBuilding() {
    const garageGroup = new THREE.Group();
    const garageMesh = new THREE.Mesh(
      new THREE.BoxGeometry(26, 11, 32),
      new THREE.MeshStandardMaterial({ color: 0x8a3c2e, roughness: 0.8 })
    );
    garageMesh.position.y = 5.5;
    garageMesh.castShadow = true;
    garageGroup.add(garageMesh);

    const rollDoor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x5a636c, metalness: 0.8 })
    );
    rollDoor.position.set(0, 3.8, 16.05);
    garageGroup.add(rollDoor);

    const garageSign = this.createStreetShopSign('PORT MORROW GARAGE', 0x1b2838, 0xef8f3d);
    garageSign.position.set(0, 9.8, 16.15);
    garageGroup.add(garageSign);

    // 位于支路深处
    garageGroup.position.set(85, 0, 75);
    this.scene.add(garageGroup);
    this.colliders.push({ box: new THREE.Box3().setFromObject(garageGroup), type: 'building' });

    this.interactables.push({
      id: 'garage_zone',
      name: '莫罗修车库 (Morrow Garage)',
      position: new THREE.Vector3(85, 1, 95),
      radius: 12,
      type: 'garage'
    });
  }

  createBuildingBlock(w, h, d, colorHex) {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const winMat = new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.2, metalness: 0.8 });
    const floors = Math.floor(h / 4.5);
    for (let f = 1; f < floors; f++) {
      for (let z = -d / 2 + 4; z <= d / 2 - 4; z += 5) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), winMat);
        win.rotation.y = Math.PI / 2;
        win.position.set(w / 2 + 0.05, f * 4.2, z);
        group.add(win);
      }
    }
    return group;
  }

  createStreetShopSign(text, bgColor, textColor) {
    const group = new THREE.Group();
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = `#${bgColor.toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = `#${textColor.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = `#${textColor.toString(16).padStart(6, '0')}`;
      ctx.font = 'bold 44px "Trebuchet MS", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const signMat = new THREE.MeshBasicMaterial({ map: texture });
      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 0.3), signMat);
      group.add(signMesh);
    }
    return group;
  }

  // 4. 街道道具：红色消防栓（严格还原原图左侧路边位置！）
  buildStreetProps() {
    const hydrantGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.15, 8);
    const hydrantCapGeo = new THREE.SphereGeometry(0.36, 8, 8);
    const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xdc382b, roughness: 0.5 });

    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2b3830, metalness: 0.6, roughness: 0.5 });
    const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });

    // 原图左侧人行道边鲜艳的红色消防栓 (x = -18.5, z = -10)
    const hyd1 = new THREE.Group();
    hyd1.add(new THREE.Mesh(hydrantGeo, hydrantMat));
    const cap1 = new THREE.Mesh(hydrantCapGeo, hydrantMat);
    cap1.position.y = 0.6;
    hyd1.add(cap1);
    hyd1.position.set(-18.5, 0.6, -10);
    this.scene.add(hyd1);
    this.colliders.push({ box: new THREE.Box3().setFromObject(hyd1), type: 'prop' });

    for (let z = -250; z <= 250; z += 40) {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 8.5, 8), lampMat);
      pole.position.y = 4.25;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), lampLightMat);
      bulb.position.set(0, 8.2, 0);
      lamp.add(pole, bulb);
      lamp.position.set(-18.8, 0, z);
      this.scene.add(lamp);
      this.colliders.push({ box: new THREE.Box3().setFromObject(lamp), type: 'prop' });

      this.buildPalmTree(-19.5, z + 18);
      this.buildPalmTree(19.5, z - 15);
    }
  }

  buildPalmTree(x, z) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.65, 9.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x73553e, roughness: 0.9 })
    );
    trunk.position.y = 4.75;
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d7042, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.5, 5.5, 4), leafMat);
      leaf.position.set(0, 9.2, 0);
      leaf.rotation.x = 1.25;
      leaf.rotation.y = angle;
      tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    this.scene.add(tree);
    this.colliders.push({ box: new THREE.Box3().setFromObject(tree), type: 'prop' });
  }

  // 5. 自动巡游的复古老电车 (Vintage Tram) —— 在右侧专属轨道行驶
  buildVintageTram() {
    this.vintageTram = new THREE.Group();
    const tramBodyMat = new THREE.MeshStandardMaterial({ color: 0xb53c29, roughness: 0.6 });
    const tramCreamMat = new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.6 });

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 16), tramBodyMat);
    lowerBody.position.y = 2.2;
    lowerBody.castShadow = true;
    this.vintageTram.add(lowerBody);

    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 15.8), tramCreamMat);
    upperBody.position.y = 4.8;
    this.vintageTram.add(upperBody);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 16.2), tramBodyMat);
    roof.position.y = 6.1;
    this.vintageTram.add(roof);

    const panto = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.8, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.9 })
    );
    panto.position.set(0, 7.8, 0);
    this.vintageTram.add(panto);

    // 位于右侧慢车道轨道 (x = 12.8)，初始位置设在远方 (z = -180)
    this.vintageTram.position.set(12.8, 0, -180);
    this.scene.add(this.vintageTram);
  }

  // 6. 前方漫游街车 —— 原图前方橙红小车
  buildTrafficCars() {
    const car = new THREE.Group();
    const carMat = new THREE.MeshStandardMaterial({ color: 0xd95634, roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 4.2), carMat);
    body.position.y = 0.9;
    body.castShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.6), roofMat);
    cabin.position.set(0, 1.8, -0.2);
    car.add(cabin);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (let wx of [-1.05, 1.05]) {
      for (let wz of [-1.2, 1.2]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.4, wz);
        car.add(w);
      }
    }

    // 位于前方车道 (x = -3.8, z = -52)
    car.position.set(-3.8, 0, -52);
    this.scene.add(car);
    this.trafficCars.push(car);
  }

  // 7. 路口行人 NPC (聚集在斑马线右侧街边)
  buildPedestrians() {
    const pedColors = [0x2f3e4d, 0x825435, 0x3d594b];
    const pedCoords = [
      { x: 18.2, z: -35 },
      { x: 19.0, z: -37 },
      { x: 17.5, z: -38 }
    ];

    pedCoords.forEach((coord, i) => {
      const p = new THREE.Group();
      const coat = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 1.25, 0.38),
        new THREE.MeshStandardMaterial({ color: pedColors[i % pedColors.length] })
      );
      coat.position.y = 1.4;
      coat.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5cca0 })
      );
      head.position.y = 2.22;
      p.add(coat, head);
      p.position.set(coord.x, 0.14, coord.z);
      this.scene.add(p);
      this.pedestrians.push(p);
    });
  }

  // 8. 3 个失踪邮包
  buildParcels() {
    const parcelGeo = new THREE.BoxGeometry(1.6, 1.2, 2.0);
    let parcelMat;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#caa372';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#b83b28';
      ctx.fillRect(110, 0, 36, 256);
      ctx.fillRect(0, 110, 256, 36);
      const parcelTex = new THREE.CanvasTexture(canvas);
      parcelMat = new THREE.MeshStandardMaterial({ map: parcelTex, roughness: 0.8 });
    } else {
      parcelMat = new THREE.MeshStandardMaterial({ color: 0xcaa372, roughness: 0.8 });
    }

    const parcelLocs = [
      { id: 'parcel_1', name: '防波堤 7 号栈道失落包裹', pos: new THREE.Vector3(-280, 1.6, 80) },
      { id: 'parcel_2', name: '旧电车支线长椅旁失落包裹', pos: new THREE.Vector3(26, 1.0, 120) },
      { id: 'parcel_3', name: '北岬灯塔山崖露台失落包裹', pos: new THREE.Vector3(-175, 1.2, -210) }
    ];

    parcelLocs.forEach((loc) => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(parcelGeo, parcelMat);
      mesh.castShadow = true;
      group.add(mesh);

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

  buildSeagulls() {
    const wingGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -1.2, 0.4, 0, 0, 0, 0.8, 0, 0, -0.6,
      1.2, 0.4, 0, 0, 0, 0.8, 0, 0, -0.6
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wingGeo.computeVertexNormals();

    const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) {
      const bird = new THREE.Mesh(wingGeo, birdMat);
      bird.position.set(-160 + Math.random() * 180, 24 + Math.random() * 15, -120 + Math.random() * 240);
      bird.userData = {
        speed: 0.3 + Math.random() * 0.2,
        wingPhase: Math.random() * Math.PI * 2,
        center: bird.position.clone()
      };
      this.seagulls.push(bird);
      this.scene.add(bird);
    }
  }

  update(delta) {
    if (this.vintageTram) {
      this.tramProgress += delta * 0.05;
      const range = 240;
      const t = (Math.sin(this.tramProgress) + 1) / 2;
      const z = -range + t * (range * 2);
      this.vintageTram.position.z = z;

      const movingForward = Math.cos(this.tramProgress) < 0;
      this.vintageTram.rotation.y = movingForward ? 0 : Math.PI;

      this.tramBellTimer += delta;
      if (this.tramBellTimer > 18) {
        this.tramBellTimer = 0;
        soundEngine.playTramBell();
      }
    }

    this.trafficCars.forEach((c) => {
      c.position.z -= delta * 6.5;
      if (c.position.z < -240) c.position.z = 240;
    });

    const time = performance.now() * 0.002;
    this.parcelMeshes.forEach((p) => {
      if (!p.collected) {
        p.group.rotation.y += delta * 1.5;
        p.group.position.y = p.position.y + Math.sin(time + p.position.x) * 0.25;
      }
    });

    if (this.waterMesh) {
      this.waterMesh.position.y = -1.8 + Math.sin(time * 0.8) * 0.15;
    }

    this.seagulls.forEach((bird) => {
      const ud = bird.userData;
      ud.wingPhase += delta * 6;
      bird.position.z -= ud.speed * 1.2;
      if (bird.position.z < -260) bird.position.z = 260;
      bird.position.y = ud.center.y + Math.sin(ud.wingPhase * 0.3) * 1.5;
      bird.rotation.z = Math.sin(ud.wingPhase) * 0.25;
    });
  }

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
