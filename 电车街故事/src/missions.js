import * as THREE from 'three';
import { soundEngine } from './audio.js';

export class MissionManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;

    // 玩家现金资产 (初始 $24,850 严格还原原图！)
    this.cash = 24850;

    // 3 个邻里差事定义
    this.errands = [
      {
        id: 'errand_bakery',
        title: '差事一：海滨烘焙坊的温热酸面包',
        subtitle: '烘焙坊 ➔ 北岬灯塔 (Lighthouse)',
        desc: '老面包师出炉了刚烘好的海盐酸面包，需要在它凉透前趁热送到北岬灯塔给老汉斯！',
        reward: 850,
        status: 'available', // available | active | completed
        stage: 'pickup', // pickup | deliver
        pickupPos: new THREE.Vector3(-45, 0, 40),
        pickupRadius: 10,
        deliverPos: new THREE.Vector3(-180, 0, -185),
        deliverRadius: 16,
        timer: 90,
        maxTimer: 90
      },
      {
        id: 'errand_gear',
        title: '差事二：旧电车机械所的急修轴承组',
        subtitle: '海港 7 号码头 ➔ 旧电车机械所 (Tram Works)',
        desc: '旧电车主轴承磨损停运，急需从码头仓库调运一套崭新的重型锻钢齿轮组送往检修车间。',
        reward: 1200,
        status: 'available',
        stage: 'pickup',
        pickupPos: new THREE.Vector3(-270, 0, 70),
        pickupRadius: 12,
        deliverPos: new THREE.Vector3(135, 0, -90),
        deliverRadius: 14,
        timer: null
      },
      {
        id: 'errand_vinyl',
        title: '差事三：海港留声机黑胶唱片专递',
        subtitle: 'Rue Prints 街角 ➔ 钟楼集市露天咖啡馆',
        desc: '绝版爵士黑胶唱片《莫罗港午后》已到货，送给钟楼前等待已久的咖啡馆老板娘。',
        reward: 1500,
        status: 'available',
        stage: 'pickup',
        pickupPos: new THREE.Vector3(-35, 0, -20),
        pickupRadius: 10,
        deliverPos: new THREE.Vector3(15, 0, -45),
        deliverRadius: 12,
        timer: null
      }
    ];

    // 当前进行中的任务
    this.activeErrand = null;

    // 失踪邮包状态
    this.lostParcelsFound = 0;
    this.totalParcels = 3;

    // 任务指示光柱与地标标记 Mesh
    this.markerMesh = null;
    this.initMarker();
  }

  initMarker() {
    const markerGroup = new THREE.Group();
    // 旋转的亮橙色菱形标记柱
    const diamondGeo = new THREE.OctahedronGeometry(1.6, 0);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0xef5b34, wireframe: false });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.y = 4.2;
    markerGroup.add(diamond);

    // 地面呼吸光环
    const ringGeo = new THREE.RingGeometry(2.4, 3.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef8f3d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    markerGroup.add(ring);

    // 光柱
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.4, 18, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffa055,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 9;
    markerGroup.add(beam);

    this.markerMesh = markerGroup;
    this.markerMesh.visible = false;
    this.scene.add(this.markerMesh);
  }

  // 接取差事
  startErrand(errandId) {
    const errand = this.errands.find((e) => e.id === errandId);
    if (!errand || errand.status === 'completed') return false;

    // 切换当前激活任务
    if (this.activeErrand && this.activeErrand.id !== errandId) {
      this.activeErrand.status = 'available';
      this.activeErrand.stage = 'pickup';
    }

    errand.status = 'active';
    errand.stage = 'pickup';
    this.activeErrand = errand;

    this.updateMarkerTarget();
    return true;
  }

  // 取消或放弃当前差事，返回自由漫游
  clearActiveErrand() {
    if (this.activeErrand) {
      this.activeErrand.status = 'available';
      this.activeErrand.stage = 'pickup';
      this.activeErrand = null;
    }
    this.markerMesh.visible = false;
  }

  // 更新目标点光柱位置
  updateMarkerTarget() {
    if (!this.activeErrand) {
      this.markerMesh.visible = false;
      return;
    }
    this.markerMesh.visible = true;
    const targetPos = this.activeErrand.stage === 'pickup'
      ? this.activeErrand.pickupPos
      : this.activeErrand.deliverPos;

    this.markerMesh.position.copy(targetPos);
  }

  // 任务进度更新与交互判定
  update(delta, playerPos, onNotify) {
    // 旋转目标光柱
    if (this.markerMesh.visible) {
      this.markerMesh.children[0].rotation.y += delta * 2.5;
      const t = performance.now() * 0.003;
      this.markerMesh.children[0].position.y = 4.2 + Math.sin(t) * 0.5;
    }

    // 1. 失踪邮包检测 (距离 < 4 米即可收集)
    this.city.parcelMeshes.forEach((parcel) => {
      if (!parcel.collected) {
        const dist = playerPos.distanceTo(parcel.position);
        if (dist < 4.2) {
          parcel.collected = true;
          parcel.group.visible = false;
          this.lostParcelsFound++;
          const reward = 2000;
          this.cash += reward;
          soundEngine.playMoneyChime();

          if (onNotify) {
            onNotify(`📦 找回失踪邮包！[${parcel.name}]，获得现金奖励 +$${reward}`);
            if (this.lostParcelsFound >= this.totalParcels) {
              onNotify('🎉 恭喜！莫罗港所有 3 个失踪邮包已全部寻回！荣获「金牌海港快递员」成就！');
            }
          }
        }
      }
    });

    // 2. 差事倒计时与目标点检查
    if (!this.activeErrand) return;

    // 限时差事倒计时
    if (this.activeErrand.timer !== null) {
      this.activeErrand.timer -= delta;
      if (this.activeErrand.timer <= 0) {
        if (onNotify) onNotify(`⏳ 哎呀！面包变凉了，差事已超时重置。`);
        this.activeErrand.timer = this.activeErrand.maxTimer;
        this.activeErrand.stage = 'pickup';
        this.updateMarkerTarget();
        return;
      }
    }

    // 检查是否到达当前阶段目标
    const isPickup = this.activeErrand.stage === 'pickup';
    const targetPos = isPickup ? this.activeErrand.pickupPos : this.activeErrand.deliverPos;
    const targetRadius = isPickup ? this.activeErrand.pickupRadius : this.activeErrand.deliverRadius;

    const dist = playerPos.distanceTo(targetPos);
    if (dist < targetRadius) {
      if (isPickup) {
        // 完成装货取件
        this.activeErrand.stage = 'deliver';
        soundEngine.playMoneyChime();
        this.updateMarkerTarget();
        if (onNotify) onNotify(`📦 已完成装货！正在前往交付目的地：${this.activeErrand.subtitle.split('➔')[1]}`);
      } else {
        // 完成送达交付！
        this.activeErrand.status = 'completed';
        this.cash += this.activeErrand.reward;
        soundEngine.playMoneyChime();
        if (onNotify) {
          onNotify(`🏆 差事完成！已交付【${this.activeErrand.title}】，获得报酬 +$${this.activeErrand.reward}`);
        }
        this.activeErrand = null;
        this.markerMesh.visible = false;
      }
    }
  }

  // 获取正在追踪的目标点坐标与类型
  getCurrentTarget() {
    if (!this.activeErrand) return null;
    return {
      pos: this.activeErrand.stage === 'pickup' ? this.activeErrand.pickupPos : this.activeErrand.deliverPos,
      type: this.activeErrand.stage
    };
  }
}
