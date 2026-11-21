import * as THREE from 'three';
import { soundEngine } from './audio.js';

export class CourierVehicle {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // 属性与性能数值
    this.health = 100;
    this.maxHealth = 100;
    this.nitro = 100;
    this.maxNitro = 100;

    // 升级等级
    this.upgrades = {
      engine: 1, // 1~3
      handling: 1, // 1~3
      nitro: 1, // 1~3
      paintColor: '#7aa2b8' // 默认天青蓝 (Kestrel Azure)
    };

    // 物理参数
    this.speed = 0; // m/s (正前负后)
    this.maxForwardSpeed = 32; // ~115 km/h
    this.maxReverseSpeed = -10; // ~36 km/h
    this.acceleration = 16.0;
    this.braking = 24.0;
    this.drag = 0.985;
    this.steerAngle = 0;
    this.maxSteerAngle = 0.58; // 约 33 度
    this.steerSpeed = 2.8;
    this.heading = 0; // 朝向角 (弧度)

    // 状态
    this.isHandbraking = false;
    this.isBoosting = false;
    this.gear = 'N'; // P, R, N, D
    this.driftFactor = 0;

    // 轮子引用（用于滚动与前轮转向）
    this.frontLeftWheel = null;
    this.frontRightWheel = null;
    this.rearLeftWheel = null;
    this.rearRightWheel = null;
    this.frontAxleLeft = null;
    this.frontAxleRight = null;

    // 车身部件引用（用于变色）
    this.bodyMaterials = [];

    // 粒子系统：氮气喷射与烟尘
    this.particles = [];
    this.skidMarks = [];

    // 初始化模型与网格
    this.buildVehicleMesh();

    // 初始位置设置在电车大道中央 (靠近钟楼集市)
    this.mesh.position.set(0, 0, 7.5);
    this.scene.add(this.mesh);
  }

  // 精准还原截图中的 Kestrel N4 Courier 快递车
  buildVehicleMesh() {
    const carGroup = this.mesh;

    // 1. 主车身底盘与下车厢 (浅蓝天青色)
    const baseColor = new THREE.Color(this.upgrades.paintColor);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.45,
      metalness: 0.2
    });
    this.bodyMaterials.push(bodyMat);

    // 车身下半截 (方正圆角箱型车体)
    const lowerBodyGeo = new THREE.BoxGeometry(2.4, 1.25, 4.6);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
    lowerBody.position.y = 1.1;
    lowerBody.castShadow = true;
    carGroup.add(lowerBody);

    // 车身上半截 / 乘员与货仓座舱
    const cabinGeo = new THREE.BoxGeometry(2.2, 1.15, 3.2);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 2.2, -0.4);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // 2. 双层悬浮式白色车顶 (White Roof)
    const whiteRoofMat = new THREE.MeshStandardMaterial({
      color: 0xf4eee4,
      roughness: 0.4,
      metalness: 0.1
    });
    const roofGeo = new THREE.BoxGeometry(2.36, 0.22, 3.4);
    const roof = new THREE.Mesh(roofGeo, whiteRoofMat);
    roof.position.set(0, 2.85, -0.4);
    roof.castShadow = true;
    carGroup.add(roof);

    // 车顶复古实木行李架 (Wooden Roof Rack & Slats) —— 核心视觉特征！
    const woodRackMat = new THREE.MeshStandardMaterial({
      color: 0xa85f37,
      roughness: 0.8
    });

    // 纵向两根固定滑轨
    const railGeo = new THREE.BoxGeometry(0.12, 0.18, 2.8);
    for (let rx of [-0.95, 0.95]) {
      const rail = new THREE.Mesh(railGeo, woodRackMat);
      rail.position.set(rx, 3.02, -0.4);
      carGroup.add(rail);
    }

    // 横向三根防滑实木条
    const slatGeo = new THREE.BoxGeometry(2.0, 0.14, 0.18);
    for (let rz of [-1.3, -0.4, 0.5]) {
      const slat = new THREE.Mesh(slatGeo, woodRackMat);
      slat.position.set(0, 3.08, rz);
      carGroup.add(slat);
    }

    // 3. 车窗玻璃系统 (后窗、前风挡、侧窗)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1f2c38,
      roughness: 0.15,
      metalness: 0.85
    });

    // 宽大的长方形后风挡玻璃
    const rearWinGeo = new THREE.PlaneGeometry(1.9, 0.85);
    const rearWin = new THREE.Mesh(rearWinGeo, glassMat);
    rearWin.position.set(0, 2.22, 1.21);
    carGroup.add(rearWin);

    // 前风挡玻璃 (轻微后倾)
    const frontWinGeo = new THREE.BoxGeometry(1.95, 0.88, 0.1);
    const frontWin = new THREE.Mesh(frontWinGeo, glassMat);
    frontWin.rotation.x = -0.15;
    frontWin.position.set(0, 2.22, -2.01);
    carGroup.add(frontWin);

    // 左右侧窗
    for (let sx of [-1.11, 1.11]) {
      const sideWinGeo = new THREE.PlaneGeometry(2.4, 0.78);
      const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
      sideWin.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      sideWin.position.set(sx, 2.24, -0.4);
      carGroup.add(sideWin);
    }

    // 4. 车尾独特细节：橘红色提手/拉环、橘红尾灯、白色后保险杠
    const orangeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xeb5938,
      roughness: 0.5,
      metalness: 0.1
    });

    // 两个 U 型拉环挂饰 (原图亮眼特征)
    const loopGeo = new THREE.TorusGeometry(0.18, 0.045, 8, 16, Math.PI);
    for (let lx of [-0.68, 0.68]) {
      const loop = new THREE.Mesh(loopGeo, orangeAccentMat);
      loop.rotation.z = Math.PI; // 口朝上挂着
      loop.position.set(lx, 1.25, 2.31);
      carGroup.add(loop);
    }

    // 方形橘红尾灯
    const tailLightGeo = new THREE.BoxGeometry(0.35, 0.18, 0.06);
    for (let tx of [-0.88, 0.88]) {
      const tLight = new THREE.Mesh(tailLightGeo, orangeAccentMat);
      tLight.position.set(tx, 0.88, 2.32);
      carGroup.add(tLight);
    }

    // 白色后保险杠
    const bumperGeo = new THREE.BoxGeometry(2.5, 0.28, 0.25);
    const bumper = new THREE.Mesh(bumperGeo, whiteRoofMat);
    bumper.position.set(0, 0.72, 2.36);
    carGroup.add(bumper);

    // 前脸格栅与前大灯
    const headLightGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.1, 16);
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    for (let hx of [-0.85, 0.85]) {
      const hLight = new THREE.Mesh(headLightGeo, headLightMat);
      hLight.rotation.x = Math.PI / 2;
      hLight.position.set(hx, 1.15, -2.31);
      carGroup.add(hLight);
    }

    // 5. 四个轮子与转向轴系统
    this.buildWheels(carGroup);
  }

  buildWheels(carGroup) {
    const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 18);
    tireGeo.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x242a30,
      roughness: 0.85
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0ea,
      metalness: 0.6,
      roughness: 0.3
    });

    const capMat = new THREE.MeshStandardMaterial({
      color: 0xe85a3c // 橘红色轮毂中心
    });

    const createWheelMesh = () => {
      const wGroup = new THREE.Group();
      // 外胎
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wGroup.add(tire);

      // 白/银色五辐轮毂盘
      const rimGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.39, 12);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);

      // 轮毂中心圆心
      const capGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.41, 10);
      capGeo.rotateZ(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, capMat);
      wGroup.add(cap);

      return wGroup;
    };

    // 前左轮转向轴
    this.frontAxleLeft = new THREE.Group();
    this.frontAxleLeft.position.set(-1.18, 0.48, -1.45);
    this.frontLeftWheel = createWheelMesh();
    this.frontAxleLeft.add(this.frontLeftWheel);
    carGroup.add(this.frontAxleLeft);

    // 前右轮转向轴
    this.frontAxleRight = new THREE.Group();
    this.frontAxleRight.position.set(1.18, 0.48, -1.45);
    this.frontRightWheel = createWheelMesh();
    this.frontAxleRight.add(this.frontRightWheel);
    carGroup.add(this.frontAxleRight);

    // 后左轮
    this.rearLeftWheel = createWheelMesh();
    this.rearLeftWheel.position.set(-1.18, 0.48, 1.45);
    carGroup.add(this.rearLeftWheel);

    // 后右轮
    this.rearRightWheel = createWheelMesh();
    this.rearRightWheel.position.set(1.18, 0.48, 1.45);
    carGroup.add(this.rearRightWheel);
  }

  // 更换车漆涂装
  setPaintColor(hexColor) {
    this.upgrades.paintColor = hexColor;
    const c = new THREE.Color(hexColor);
    this.bodyMaterials.forEach((mat) => {
      mat.color.copy(c);
    });
  }

  // 物理与输入更新
  update(delta, inputState, colliders) {
    // 1. 输入解析
    const forwardInput = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    const steerInput = (inputState.left ? 1 : 0) - (inputState.right ? 1 : 0);
    this.isHandbraking = !!inputState.handbrake;
    const boostPressed = !!inputState.boost;

    // 2. 氮气冲刺逻辑
    if (boostPressed && this.nitro > 0 && forwardInput > 0) {
      this.isBoosting = true;
      this.nitro = Math.max(0, this.nitro - delta * 30);
      soundEngine.playNitroSound();
      this.spawnBoostParticles();
    } else {
      this.isBoosting = false;
      // 氮气自动缓缓充能
      const rechargeRate = 8 + this.upgrades.nitro * 4;
      this.nitro = Math.min(this.maxNitro, this.nitro + delta * rechargeRate);
    }

    // 3. 发动机驱动与加速度计算
    let currentAccel = this.acceleration * (1 + (this.upgrades.engine - 1) * 0.25);
    let topSpeed = this.maxForwardSpeed * (1 + (this.upgrades.engine - 1) * 0.18);
    if (this.isBoosting) {
      currentAccel *= 1.7;
      topSpeed *= 1.35;
    }

    // 车辆受损降速惩罚
    if (this.health < 25) {
      topSpeed *= 0.55;
      currentAccel *= 0.6;
      this.spawnSmokeParticles();
    }

    if (forwardInput > 0) {
      this.speed += currentAccel * delta;
      if (this.speed > topSpeed) this.speed = topSpeed;
      this.gear = 'D';
    } else if (forwardInput < 0) {
      // 倒车或减速制动
      if (this.speed > 0.5) {
        this.speed -= this.braking * delta;
      } else {
        this.speed -= currentAccel * 0.6 * delta;
        if (this.speed < this.maxReverseSpeed) this.speed = this.maxReverseSpeed;
        this.gear = 'R';
      }
    } else {
      // 滑行阻力
      this.speed *= Math.pow(this.drag, delta * 60);
      if (Math.abs(this.speed) < 0.15) {
        this.speed = 0;
        this.gear = 'N';
      }
    }

    // 手刹减速与漂移处理
    if (this.isHandbraking) {
      this.speed *= Math.pow(0.92, delta * 60);
      this.driftFactor = Math.min(1.0, this.driftFactor + delta * 3.5);
      if (Math.abs(this.speed) > 5) {
        soundEngine.playSkidSound(this.driftFactor);
        this.spawnSkidMark();
      }
    } else {
      this.driftFactor = Math.max(0, this.driftFactor - delta * 2.5);
    }

    // 4. 转向角度与偏航处理
    const targetSteer = steerInput * this.maxSteerAngle;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, this.steerSpeed * delta * 5);

    // 车身偏航转弯 (速度越快、转向越灵敏，高速微减)
    const speedRatio = this.speed / this.maxForwardSpeed;
    const effectiveSteer = this.steerAngle * (1 + this.driftFactor * 0.7);
    this.heading += effectiveSteer * speedRatio * delta * (2.4 + (this.upgrades.handling - 1) * 0.4);

    // 5. 位置位移更新
    const moveX = -Math.sin(this.heading) * this.speed * delta;
    const moveZ = -Math.cos(this.heading) * this.speed * delta;

    const oldPos = this.mesh.position.clone();
    this.mesh.position.x += moveX;
    this.mesh.position.z += moveZ;

    // 车身朝向与悬挂动态倾斜
    this.mesh.rotation.y = this.heading;

    // 悬挂俯仰 (加速抬头、刹车点头)
    const pitch = forwardInput * (this.speed > 0 ? 0.04 : -0.05);
    // 悬挂侧倾 (转弯外甩)
    const roll = -this.steerAngle * (this.speed / 20) * 0.08;
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, pitch, delta * 8);
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, roll, delta * 8);

    // 6. 前轮转向与轮子滚动旋转
    if (this.frontAxleLeft && this.frontAxleRight) {
      this.frontAxleLeft.rotation.y = this.steerAngle;
      this.frontAxleRight.rotation.y = this.steerAngle;
    }
    const rollDist = (this.speed * delta) / 0.48; // 轮子半径 0.48
    if (this.frontLeftWheel) this.frontLeftWheel.rotation.x -= rollDist;
    if (this.frontRightWheel) this.frontRightWheel.rotation.x -= rollDist;
    if (this.rearLeftWheel) this.rearLeftWheel.rotation.x -= rollDist;
    if (this.rearRightWheel) this.rearRightWheel.rotation.x -= rollDist;

    // 7. 碰撞检测
    this.handleCollisions(oldPos, colliders);

    // 8. 引擎音效更新
    const speedKmh = Math.abs(Math.round(this.speed * 3.6));
    soundEngine.updateEngine(speedKmh, forwardInput !== 0, this.isBoosting);

    // 9. 更新粒子与胎痕
    this.updateParticles(delta);
  }

  // 碰撞检测与受损
  handleCollisions(oldPos, colliders) {
    if (!colliders || colliders.length === 0) return;

    // 车辆碰撞盒
    const carBox = new THREE.Box3().setFromObject(this.mesh);

    for (let c of colliders) {
      if (carBox.intersectsBox(c.box)) {
        // 发生碰撞！
        const impactSpeed = Math.abs(this.speed);
        if (impactSpeed > 3.0) {
          const dmg = Math.round(impactSpeed * 1.5);
          this.health = Math.max(0, this.health - dmg);
          soundEngine.playCrashSound(impactSpeed / 20);
        }

        // 弹回旧位置并反冲反弹
        this.mesh.position.copy(oldPos);
        this.speed = -this.speed * 0.35;
        break;
      }
    }
  }

  // 喷射氮气粒子
  spawnBoostParticles() {
    for (let side of [-0.4, 0.4]) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x42bcf5, transparent: true, opacity: 0.9 })
      );
      // 位于排气管/车尾
      const offset = new THREE.Vector3(side, 0.6, 2.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      p.position.copy(this.mesh.position).add(offset);
      p.userData = {
        vel: offset.clone().normalize().multiplyScalar(4 + Math.random() * 3),
        life: 0.28
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  // 受损冒烟粒子
  spawnSmokeParticles() {
    if (Math.random() > 0.4) return;
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.75 })
    );
    const offset = new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.4, -1.8).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.heading
    );
    p.position.copy(this.mesh.position).add(offset);
    p.userData = {
      vel: new THREE.Vector3(0, 2.5 + Math.random() * 1.5, 0),
      life: 0.6
    };
    this.scene.add(p);
    this.particles.push(p);
  }

  // 漂移地面轮胎印
  spawnSkidMark() {
    if (this.skidMarks.length > 80) {
      const old = this.skidMarks.shift();
      this.scene.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
    const markGeo = new THREE.PlaneGeometry(0.32, 0.9);
    const markMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = this.heading;
    const rearOffset = new THREE.Vector3(0, 0.03, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    mark.position.copy(this.mesh.position).add(rearOffset);
    this.scene.add(mark);
    this.skidMarks.push(mark);
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= delta;
      p.position.addScaledVector(p.userData.vel, delta);
      p.scale.multiplyScalar(1.05);
      p.material.opacity = p.userData.life * 2;
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // 修车恢复满耐久
  repair() {
    this.health = this.maxHealth;
  }

  getSpeedKmh() {
    return Math.abs(Math.round(this.speed * 3.6));
  }
}
