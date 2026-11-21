import * as THREE from 'three';
import { soundEngine } from './audio.js';
import { PortMorrowCity } from './city.js';
import { CourierVehicle } from './vehicle.js';
import { CourierPlayer } from './player.js';
import { MissionManager } from './missions.js';

class TramlineGame {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. 初始化 Three.js 核心场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6ded0);
    this.scene.fog = new THREE.FogExp2(0xe2dac7, 0.0028);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 1200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 2. 环境与阳光照明 (营造温暖舒适的海港午后金黄光影)
    this.setupLighting();

    // 3. 游戏核心子系统
    this.city = new PortMorrowCity(this.scene);
    this.vehicle = new CourierVehicle(this.scene);
    this.player = new CourierPlayer(this.scene);
    this.missionManager = new MissionManager(this.scene, this.city);

    // 4. 控制与状态
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      boost: false
    };

    this.cameraMode = 0; // 0: 第三人称跟车, 1: 驾驶舱第一人称, 2: 俯瞰观光视角, 3: 车库展示
    this.isDriving = true; // true: 驾车, false: 步行
    this.clock = new THREE.Clock();

    // 小城时间推移 (从 PM 04:15 开始)
    this.gameMinutes = 16 * 60 + 15;

    // UI 元素缓存
    this.cacheDom();

    // 初始化事件监听
    this.initInputs();
    this.initUiEvents();

    // 绘制大地图与小地图初始化
    this.initCanvases();

    // 窗口自适应
    window.addEventListener('resize', () => this.onWindowResize());

    // 开启渲染循环
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // 显示开场提示
    this.showToast('欢迎来到莫罗港！开着你的雨燕快递车，享受海风与旧电车街区。', '📮');
  }

  setupLighting() {
    // 温暖的环境天光
    const ambientLight = new THREE.AmbientLight(0xfff0db, 0.7);
    this.scene.add(ambientLight);

    // 天空金黄与海港微蓝的半球光
    const hemiLight = new THREE.HemisphereLight(0xffecd4, 0x4e758a, 0.6);
    this.scene.add(hemiLight);

    // 午后斜阳直射光 (产生长而优雅的午后投影)
    this.sunLight = new THREE.DirectionalLight(0xfff7e3, 1.4);
    this.sunLight.position.set(140, 160, 120);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 450;
    const d = 160;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
  }

  cacheDom() {
    this.dom = {
      cashDisplay: document.getElementById('cash-display'),
      zoneName: document.getElementById('zone-name'),
      streetName: document.getElementById('street-name'),
      timeDisplay: document.getElementById('time-display'),
      healthVal: document.getElementById('health-value'),
      nitroVal: document.getElementById('nitro-value'),
      healthBar: document.getElementById('health-bar'),
      nitroBar: document.getElementById('nitro-bar'),
      speedDisplay: document.getElementById('speed-display'),
      gearIndicator: document.getElementById('gear-indicator'),
      stationName: document.getElementById('station-name'),
      radioWidget: document.getElementById('radio-widget'),
      prompt: document.getElementById('interaction-prompt'),
      promptText: document.getElementById('prompt-text'),
      toastBanner: document.getElementById('toast-banner'),
      toastText: document.getElementById('toast-text'),
      toastIcon: document.getElementById('toast-icon'),
      errandBadge: document.getElementById('errand-badge'),
      parcelsCount: document.getElementById('parcels-count'),

      // 模态弹窗
      modalExplore: document.getElementById('modal-explore'),
      modalGarage: document.getElementById('modal-garage'),
      modalMap: document.getElementById('modal-map'),
      modalHelp: document.getElementById('modal-help'),
      errandsList: document.getElementById('errands-list'),

      // 画布
      minimapCanvas: document.getElementById('minimap-canvas'),
      bigmapCanvas: document.getElementById('bigmap-canvas')
    };

    this.minimapCtx = this.dom.minimapCanvas.getContext('2d');
    this.bigmapCtx = this.dom.bigmapCanvas.getContext('2d');
  }

  initInputs() {
    const handleKey = (e, isDown) => {
      // 唤醒 Web Audio
      soundEngine.init();
      soundEngine.resume();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputState.forward = isDown;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputState.backward = isDown;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputState.left = isDown;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputState.right = isDown;
          break;
        case 'Space':
          this.inputState.handbrake = isDown;
          if (isDown) e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.inputState.boost = isDown;
          break;
        case 'KeyE':
          if (isDown && !e.repeat) {
            this.handleInteraction();
          }
          break;
        case 'KeyC':
          if (isDown && !e.repeat) {
            this.cycleCamera();
          }
          break;
        case 'KeyM':
          if (isDown && !e.repeat) {
            this.toggleMapModal();
          }
          break;
        case 'Escape':
          if (isDown && !e.repeat) {
            this.toggleHelpModal();
          }
          break;
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    // 用户点击任意处初始化音频
    window.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.resume();
    }, { once: true });
  }

  initUiEvents() {
    // 顶部按钮绑定
    document.getElementById('btn-free-roam').addEventListener('click', () => {
      this.missionManager.clearActiveErrand();
      this.showToast('已切换至自由漫游模式，尽情欣赏海港电车街景！', '🌴');
    });

    document.getElementById('btn-explore').addEventListener('click', () => {
      this.openExploreModal();
    });

    document.getElementById('btn-garage').addEventListener('click', () => {
      this.openGarageModal();
    });

    document.getElementById('btn-open-map').addEventListener('click', () => {
      this.toggleMapModal();
    });

    document.getElementById('btn-footer-map').addEventListener('click', () => {
      this.toggleMapModal();
    });

    document.getElementById('btn-toggle-audio').addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      this.showToast(isMuted ? '音频已静音' : '音频已开启', isMuted ? '🔇' : '🔊');
    });

    document.getElementById('btn-help').addEventListener('click', () => {
      this.toggleHelpModal();
    });

    // 模态弹窗关闭
    document.getElementById('btn-close-explore').addEventListener('click', () => this.closeExploreModal());
    document.getElementById('btn-close-explore-bottom').addEventListener('click', () => this.closeExploreModal());
    document.getElementById('btn-close-garage').addEventListener('click', () => this.closeGarageModal());
    document.getElementById('btn-close-garage-bottom').addEventListener('click', () => this.closeGarageModal());
    document.getElementById('btn-close-map').addEventListener('click', () => this.toggleMapModal());
    document.getElementById('btn-close-help').addEventListener('click', () => this.toggleHelpModal());
    document.getElementById('btn-confirm-help').addEventListener('click', () => this.toggleHelpModal());

    // 电台组件切台
    this.dom.radioWidget.addEventListener('click', () => {
      soundEngine.init();
      soundEngine.resume();
      const station = soundEngine.nextStation();
      this.dom.stationName.textContent = station.name;
      this.showToast(`切换电台频道：${station.name}`, '📻');
    });

    // 修车库业务绑定
    document.getElementById('btn-repair-car').addEventListener('click', () => {
      if (this.missionManager.cash >= 200) {
        if (this.vehicle.health >= 100) {
          this.showToast('车辆目前完好无损，无需维修。', '✨');
          return;
        }
        this.missionManager.cash -= 200;
        this.vehicle.repair();
        soundEngine.playMoneyChime();
        this.showToast('车辆耐久已全部修复完毕！焕然一新！', '🔧');
      } else {
        this.showToast('现金不足，需要 $200 才能修理车辆。', '⚠️');
      }
    });

    // 车身喷漆选择
    document.querySelectorAll('.paint-opt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const color = target.getAttribute('data-color');
        this.vehicle.setPaintColor(color);
        document.querySelectorAll('.paint-opt').forEach((b) => b.classList.replace('border-[#b83f2a]', 'border-transparent'));
        target.classList.replace('border-transparent', 'border-[#b83f2a]');
        this.showToast(`已更换车漆颜色：${color}`, '🎨');
      });
    });

    // 升级引擎
    document.getElementById('btn-upgrade-engine').addEventListener('click', () => {
      if (this.vehicle.upgrades.engine >= 3) {
        this.showToast('发动机马力已升至最高等级！', '🔥');
        return;
      }
      if (this.missionManager.cash >= 1500) {
        this.missionManager.cash -= 1500;
        this.vehicle.upgrades.engine++;
        document.getElementById('lvl-engine').textContent = this.vehicle.upgrades.engine;
        soundEngine.playMoneyChime();
        this.showToast(`发动机已升级至 LV.${this.vehicle.upgrades.engine}！极速与加速度显著提升！`, '🏎️');
      } else {
        this.showToast('现金不足，升级需要 $1,500。', '⚠️');
      }
    });

    // 升级操控
    document.getElementById('btn-upgrade-handling').addEventListener('click', () => {
      if (this.vehicle.upgrades.handling >= 3) {
        this.showToast('悬挂与操控已升至最高等级！', '🏁');
        return;
      }
      if (this.missionManager.cash >= 1200) {
        this.missionManager.cash -= 1200;
        this.vehicle.upgrades.handling++;
        document.getElementById('lvl-handling').textContent = this.vehicle.upgrades.handling;
        soundEngine.playMoneyChime();
        this.showToast(`悬挂已调校至 LV.${this.vehicle.upgrades.handling}！转向与漂移更加稳定！`, '🔧');
      } else {
        this.showToast('现金不足，升级需要 $1,200。', '⚠️');
      }
    });

    // 升级氮气
    document.getElementById('btn-upgrade-nitro').addEventListener('click', () => {
      if (this.vehicle.upgrades.nitro >= 3) {
        this.showToast('氮气系统已升至最高等级！', '⚡');
        return;
      }
      if (this.missionManager.cash >= 1000) {
        this.missionManager.cash -= 1000;
        this.vehicle.upgrades.nitro++;
        document.getElementById('lvl-nitro').textContent = this.vehicle.upgrades.nitro;
        soundEngine.playMoneyChime();
        this.showToast(`氮气系统已升级至 LV.${this.vehicle.upgrades.nitro}！充能速度加快！`, '⚡');
      } else {
        this.showToast('现金不足，升级需要 $1,000。', '⚠️');
      }
    });
  }

  initCanvases() {
    this.dom.bigmapCanvas.width = 960;
    this.dom.bigmapCanvas.height = 540;
  }

  // E 键交互分发
  handleInteraction() {
    const carPos = this.vehicle.mesh.position;
    const playerPos = this.player.mesh.position;

    if (this.isDriving) {
      // 在车内时检查是否靠近车库交互区
      const garageDist = Math.hypot(carPos.x - 90, carPos.z - 95);
      if (garageDist < 16) {
        this.openGarageModal();
        return;
      }

      // 下车
      this.isDriving = false;
      this.player.spawnFromVehicle(this.vehicle);
      this.showToast('已走下快递车，步行探索莫罗港！靠近驾驶室按 E 可重新上车。', '🚶');
    } else {
      // 检查是否靠近车辆左侧驾驶门上车
      const distToCar = playerPos.distanceTo(carPos);
      if (distToCar < 4.2) {
        this.isDriving = true;
        this.player.enterVehicle();
        this.showToast('已进入雨燕 N4 驾驶座，发动引擎！', '🚗');
      }
    }
  }

  // 镜头切换
  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    const modeNames = ['追随跟随视角', '驾驶舱第一人称', '全景观光俯瞰视角'];
    this.showToast(`已切换镜头：${modeNames[this.cameraMode]}`, '📷');
  }

  // 模态弹窗控制
  openExploreModal() {
    this.renderErrandsList();
    this.dom.parcelsCount.textContent = `${this.missionManager.lostParcelsFound} / ${this.missionManager.totalParcels}`;
    this.dom.modalExplore.classList.remove('hidden');
  }

  closeExploreModal() {
    this.dom.modalExplore.classList.add('hidden');
  }

  openGarageModal() {
    this.dom.modalGarage.classList.remove('hidden');
  }

  closeGarageModal() {
    this.dom.modalGarage.classList.add('hidden');
  }

  toggleMapModal() {
    const isHidden = this.dom.modalMap.classList.contains('hidden');
    if (isHidden) {
      this.dom.modalMap.classList.remove('hidden');
      this.renderBigMap();
    } else {
      this.dom.modalMap.classList.add('hidden');
    }
  }

  toggleHelpModal() {
    this.dom.modalHelp.classList.toggle('hidden');
  }

  renderErrandsList() {
    this.dom.errandsList.innerHTML = '';
    this.missionManager.errands.forEach((errand) => {
      const isCompleted = errand.status === 'completed';
      const isActive = errand.status === 'active';

      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border transition flex items-center justify-between ${
        isCompleted
          ? 'bg-[#e2edd8] border-[#a2c293]'
          : isActive
          ? 'bg-[#fff5e8] border-[#e88c3a] shadow-md ring-2 ring-[#e88c3a]'
          : 'bg-[#f4eee4] border-[#cbbca3] hover:bg-[#ede5d6]'
      }`;

      card.innerHTML = `
        <div class="flex flex-col gap-1 max-w-[420px]">
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-sm text-[#2a3c4e]">${errand.title}</span>
            ${
              isCompleted
                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#78a867] text-white">已达成</span>'
                : isActive
                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#e88c3a] text-white animate-pulse">正在进行</span>'
                : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#a89b88] text-white">可接取</span>'
            }
          </div>
          <div class="text-[11px] font-bold text-[#b83f2a]">${errand.subtitle}</div>
          <div class="text-xs text-[#5e5346] leading-relaxed">${errand.desc}</div>
        </div>
        <div class="flex flex-col items-end gap-2">
          <div class="text-sm font-black text-[#1e2f42] font-mono">+$${errand.reward}</div>
          ${
            isCompleted
              ? '<span class="text-xs font-bold text-[#628c54]">✓ 奖励已到账</span>'
              : `<button data-id="${errand.id}" class="btn-track-errand px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition ${
                  isActive ? 'bg-[#5c4e40] hover:bg-[#43382d]' : 'bg-[#b83f2a] hover:bg-[#ce4932]'
                }">
                  ${isActive ? '正在导航' : '开启导航前往'}
                </button>`
          }
        </div>
      `;

      this.dom.errandsList.appendChild(card);
    });

    // 绑定导航接取
    this.dom.errandsList.querySelectorAll('.btn-track-errand').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.missionManager.startErrand(id);
        this.renderErrandsList();
        this.closeExploreModal();
        this.showToast(`已锁定差事导航目标！请跟随地面光柱指引。`, '🎯');
      });
    });
  }

  showToast(text, icon = '📦') {
    this.dom.toastText.textContent = text;
    this.dom.toastIcon.textContent = icon;
    this.dom.toastBanner.classList.remove('opacity-0', 'pointer-events-none');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.dom.toastBanner.classList.add('opacity-0', 'pointer-events-none');
    }, 3600);
  }

  // 逐帧主循环
  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. 推进小城时间与时钟文本
    this.gameMinutes += delta * 0.8;
    const hours = Math.floor((this.gameMinutes / 60) % 24);
    const mins = Math.floor(this.gameMinutes % 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayH = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    this.dom.timeDisplay.textContent = `${ampm} ${displayH.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    // 2. 状态更新
    if (this.isDriving) {
      this.vehicle.update(delta, this.inputState, this.city.colliders);
      this.updateCameraDriving(delta);
    } else {
      this.player.update(delta, this.inputState, this.city.colliders);
      this.updateCameraWalking(delta);
    }

    // 3. 城市动态更新 (巡游电车、海鸥、海浪)
    this.city.update(delta);

    // 4. 任务系统更新与事件检查
    const activePos = this.isDriving ? this.vehicle.mesh.position : this.player.mesh.position;
    this.missionManager.update(delta, activePos, (msg) => this.showToast(msg));

    // 5. 交互浮动提示判断
    this.updateInteractionPrompt(activePos);

    // 6. HUD 数据刷新
    this.updateHud();

    // 7. 渲染小地图
    this.renderMinimap(activePos);

    // 8. Three.js 画面渲染
    this.renderer.render(this.scene, this.camera);
  }

  // 驾驶相机运镜 (严格再现原图追随视角)
  updateCameraDriving(delta) {
    const carPos = this.vehicle.mesh.position;
    const heading = this.vehicle.heading;

    if (this.cameraMode === 0) {
      // 第三人称追尾相机
      const targetOffset = new THREE.Vector3(0, 4.2, 10.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      const desiredPos = carPos.clone().add(targetOffset);
      this.camera.position.lerp(desiredPos, delta * 5.0);

      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.8, -2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading));
      this.camera.lookAt(lookTarget);
    } else if (this.cameraMode === 1) {
      // 驾驶舱近景
      const cockpitOffset = new THREE.Vector3(0, 2.3, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      this.camera.position.copy(carPos).add(cockpitOffset);
      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 2.0, -12).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading));
      this.camera.lookAt(lookTarget);
    } else {
      // 全景观光高机位
      const highOffset = new THREE.Vector3(0, 32, 28).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      this.camera.position.lerp(carPos.clone().add(highOffset), delta * 4);
      this.camera.lookAt(carPos);
    }
  }

  // 步行相机运镜
  updateCameraWalking(delta) {
    const pPos = this.player.mesh.position;
    const heading = this.player.heading;
    const targetOffset = new THREE.Vector3(-Math.sin(heading) * 6, 4.5, -Math.cos(heading) * 6);
    this.camera.position.lerp(pPos.clone().add(targetOffset), delta * 6);
    this.camera.lookAt(pPos.x, pPos.y + 1.6, pPos.z);
  }

  // 互动提示判定
  updateInteractionPrompt(pos) {
    if (this.isDriving) {
      const garageDist = Math.hypot(pos.x - 90, pos.z - 95);
      if (garageDist < 16) {
        this.dom.prompt.classList.remove('hidden');
        this.dom.promptText.textContent = '按 E 进入莫罗修车库与改装展厅';
        return;
      }
      this.dom.prompt.classList.add('hidden');
    } else {
      const distToCar = pos.distanceTo(this.vehicle.mesh.position);
      if (distToCar < 4.2) {
        this.dom.prompt.classList.remove('hidden');
        this.dom.promptText.textContent = '按 E 键进入雨燕 N4 驾驶座';
        return;
      }
      this.dom.prompt.classList.add('hidden');
    }
  }

  // 刷新 HUD
  updateHud() {
    // 现金
    this.dom.cashDisplay.textContent = `$${this.missionManager.cash.toLocaleString()}`;

    // 地点
    const currentPos = this.isDriving ? this.vehicle.mesh.position : this.player.mesh.position;
    const zone = this.city.getCurrentZone(currentPos);
    this.dom.zoneName.textContent = zone.name.toUpperCase();
    this.dom.streetName.textContent = zone.street;

    // 耐久与氮气
    const h = Math.round(this.vehicle.health);
    const n = Math.round(this.vehicle.nitro);
    this.dom.healthVal.textContent = h;
    this.dom.nitroVal.textContent = n;
    this.dom.healthBar.style.width = `${h}%`;
    this.dom.nitroBar.style.width = `${n}%`;

    // 速度与挡位
    const speed = this.vehicle.getSpeedKmh();
    this.dom.speedDisplay.textContent = speed.toString().padStart(3, '0');
    this.dom.gearIndicator.textContent = this.vehicle.gear;

    // 差事徽章数
    const pendingErrands = this.missionManager.errands.filter((e) => e.status !== 'completed').length;
    this.dom.errandBadge.textContent = pendingErrands;
  }

  // 绘制左下角雷达小地图
  renderMinimap(playerPos) {
    const ctx = this.minimapCtx;
    const w = this.dom.minimapCanvas.width;
    const h = this.dom.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 绘制米色底色与淡网格
    ctx.fillStyle = '#e8dfc8';
    ctx.fillRect(0, 0, w, h);

    const scale = 0.65; // 缩放比例
    const centerX = w / 2;
    const centerY = h / 2;

    const toMapX = (worldX) => centerX + (worldX - playerPos.x) * scale;
    const toMapY = (worldZ) => centerY + (worldZ - playerPos.z) * scale;

    // 1. 绘制海域 (西侧与南侧)
    ctx.fillStyle = '#9cbcc4';
    const seaX = toMapX(-230);
    if (seaX > 0) {
      ctx.fillRect(0, 0, Math.min(seaX, w), h);
    }

    // 2. 绘制街道主路与横路
    ctx.fillStyle = '#f6f1e3';
    // 东西向电车大道
    const mainAvenueY = toMapY(0);
    ctx.fillRect(0, mainAvenueY - 10, w, 20);

    // 两条南北纵路
    for (let rx of [-80, 80]) {
      const roadX = toMapX(rx);
      ctx.fillRect(roadX - 8, 0, 16, h);
    }

    // 3. 绘制街区方块 (还原截图中的橙褐色街区)
    ctx.fillStyle = '#d29676';
    const blocks = [
      { x: -150, z: -60, bw: 42, bh: 32 },
      { x: -30, z: -60, bw: 42, bh: 32 },
      { x: 30, z: -60, bw: 42, bh: 32 },
      { x: 150, z: -60, bw: 42, bh: 32 },
      { x: -150, z: 60, bw: 42, bh: 32 },
      { x: -30, z: 60, bw: 42, bh: 32 },
      { x: 30, z: 60, bw: 42, bh: 32 },
      { x: 150, z: 60, bw: 42, bh: 32 }
    ];

    blocks.forEach((blk) => {
      const bx = toMapX(blk.x);
      const by = toMapY(blk.z);
      const bw = blk.bw * scale;
      const bh = blk.bh * scale;
      ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
    });

    // 4. 绘制旧电车铁轨线 (横贯主大道中央双轨)
    ctx.strokeStyle = '#a69e90';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, mainAvenueY - 1.5);
    ctx.lineTo(w, mainAvenueY - 1.5);
    ctx.moveTo(0, mainAvenueY + 1.5);
    ctx.lineTo(w, mainAvenueY + 1.5);
    ctx.stroke();

    // 5. 绘制差事目标指引点 (带呼吸圈)
    const target = this.missionManager.getCurrentTarget();
    if (target) {
      const tx = toMapX(target.pos.x);
      const ty = toMapY(target.pos.z);
      ctx.fillStyle = '#3a7cb8';
      ctx.beginPath();
      ctx.arc(tx, ty, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 6. 绘制失踪邮包标记
    ctx.fillStyle = '#d95a32';
    this.city.parcelMeshes.forEach((p) => {
      if (!p.collected) {
        const px = toMapX(p.position.x);
        const py = toMapY(p.position.z);
        ctx.fillRect(px - 3, py - 3, 6, 6);
      }
    });

    // 7. 绘制玩家三角形箭头图标 (随朝向旋转)
    const pRot = this.isDriving ? this.vehicle.heading : this.player.heading;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(pRot + Math.PI); // 朝向调整
    ctx.fillStyle = '#223140';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 绘制水彩航海风全景大地图 (Full Map)
  renderBigMap() {
    const ctx = this.bigmapCtx;
    const w = this.dom.bigmapCanvas.width;
    const h = this.dom.bigmapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 水彩米黄羊皮纸底色
    ctx.fillStyle = '#f0e6d2';
    ctx.fillRect(0, 0, w, h);

    // 港湾海水部分 (西与南)
    ctx.fillStyle = '#9cb8c4';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(240, 0);
    ctx.bezierCurveTo(250, 220, 280, 360, 450, 540);
    ctx.lineTo(0, 540);
    ctx.closePath();
    ctx.fill();

    // 道路系统
    ctx.fillStyle = '#fffdf7';
    // 东西向中央电车大道
    ctx.fillRect(180, 260, 760, 36);
    // 南北主道
    ctx.fillRect(360, 40, 30, 460);
    ctx.fillRect(660, 40, 30, 460);
    // 北环路与南滨海路
    ctx.fillRect(240, 110, 700, 24);
    ctx.fillRect(300, 420, 640, 24);

    // 电车铁轨虚线
    ctx.strokeStyle = '#7c7365';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(180, 278);
    ctx.lineTo(940, 278);
    ctx.stroke();
    ctx.setLineDash([]);

    // 标绘所有重要地标
    const landmarks = [
      { name: '北岬灯塔 (North Cape Lighthouse)', x: 190, y: 75, icon: '🗼', color: '#b53c29' },
      { name: '海港 7 号栈道 (Wharf 7)', x: 140, y: 350, icon: '⚓', color: '#2d4d68' },
      { name: '钟楼集市 (Clockmarket)', x: 510, y: 220, icon: '🏛️', color: '#a67232' },
      { name: 'Rue Prints 街角印刷社', x: 440, y: 310, icon: '📰', color: '#436154' },
      { name: '旧电车机械所 (Tram Works)', x: 790, y: 170, icon: '🚋', color: '#8c4331' },
      { name: '莫罗修车库 (Morrow Garage)', x: 740, y: 370, icon: '🔧', color: '#31485e' }
    ];

    landmarks.forEach((lm) => {
      ctx.fillStyle = lm.color;
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#2d251f';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${lm.icon} ${lm.name}`, lm.x + 12, lm.y + 4);
    });

    // 标绘 3 个失踪邮包区域雷达圈
    ctx.strokeStyle = '#e87443';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(232, 116, 67, 0.15)';
    [
      { x: 155, y: 360, label: '邮包 A 信号' },
      { x: 810, y: 150, label: '邮包 B 信号' },
      { x: 175, y: 95, label: '邮包 C 信号' }
    ].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9b3f1c';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`📮 ${p.label}`, p.x - 20, p.y - 26);
    });

    // 绘制玩家当前所在位置
    const pPos = this.isDriving ? this.vehicle.mesh.position : this.player.mesh.position;
    const mapPx = 510 + (pPos.x / 240) * 260;
    const mapPy = 278 + (pPos.z / 180) * 160;

    // 玩家光圈与箭头
    ctx.fillStyle = 'rgba(184, 63, 42, 0.25)';
    ctx.beginPath();
    ctx.arc(mapPx, mapPy, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b83f2a';
    ctx.beginPath();
    ctx.arc(mapPx, mapPy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#b83f2a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('📍 你在这里', mapPx + 10, mapPy - 10);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// 启动游戏实例
window.addEventListener('DOMContentLoaded', () => {
  new TramlineGame();
});
