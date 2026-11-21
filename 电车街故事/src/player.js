import * as THREE from 'three';

export class CourierPlayer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.isActive = false; // 是否处于下车步行状态

    this.speed = 0;
    this.walkSpeed = 5.5; // m/s
    this.runSpeed = 9.0;
    this.heading = 0;
    this.walkAnimPhase = 0;

    // 肢体引用
    this.leftLeg = null;
    this.rightLeg = null;
    this.leftArm = null;
    this.rightArm = null;

    this.buildCourierMesh();
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  // 打造低多边形复古小城快递员模型
  buildCourierMesh() {
    const courierGroup = this.mesh;

    // 材质
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cda2, roughness: 0.6 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x8a5d3b, roughness: 0.7 }); // 暖棕色工装
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.8 }); // 象牙白衬衣
    const capMat = new THREE.MeshStandardMaterial({ color: 0x243342, roughness: 0.6 }); // 深蓝快递鸭舌帽
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xb57c48, roughness: 0.8 }); // 牛皮斜挎包

    // 躯干 (Torso)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const torso = new THREE.Mesh(torsoGeo, clothesMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    courierGroup.add(torso);

    // 领口内衣
    const shirtGeo = new THREE.PlaneGeometry(0.3, 0.3);
    const shirt = new THREE.Mesh(shirtGeo, shirtMat);
    shirt.position.set(0, 1.6, 0.23);
    courierGroup.add(shirt);

    // 头部 (Head)
    const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.05;
    courierGroup.add(head);

    // 鸭舌帽 (Cap)
    const capGeo = new THREE.BoxGeometry(0.52, 0.2, 0.52);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 2.32;
    const visorGeo = new THREE.BoxGeometry(0.5, 0.06, 0.28);
    const visor = new THREE.Mesh(visorGeo, capMat);
    visor.position.set(0, 2.24, 0.35);
    courierGroup.add(cap, visor);

    // 斜挎牛皮邮包 (Mail Bag)
    const bagGeo = new THREE.BoxGeometry(0.32, 0.4, 0.55);
    const bag = new THREE.Mesh(bagGeo, bagMat);
    bag.position.set(0.42, 1.15, 0.05);
    courierGroup.add(bag);

    // 腿部 (Legs)
    const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.26);
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x36454f, roughness: 0.8 });

    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.2, 0.45, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.2, 0.45, 0);
    this.rightLeg.castShadow = true;

    courierGroup.add(this.leftLeg, this.rightLeg);

    // 手臂 (Arms)
    const armGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
    this.leftArm = new THREE.Mesh(armGeo, clothesMat);
    this.leftArm.position.set(-0.46, 1.35, 0);

    this.rightArm = new THREE.Mesh(armGeo, clothesMat);
    this.rightArm.position.set(0.46, 1.35, 0);

    courierGroup.add(this.leftArm, this.rightArm);
  }

  // 从车辆离开下车
  spawnFromVehicle(vehicle) {
    this.isActive = true;
    this.mesh.visible = true;

    // 出生在车辆左侧车门旁
    const exitOffset = new THREE.Vector3(-2.2, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      vehicle.heading
    );
    this.mesh.position.copy(vehicle.mesh.position).add(exitOffset);
    this.mesh.position.y = 0;
    this.heading = vehicle.heading;
    this.mesh.rotation.y = this.heading;
  }

  // 登车
  enterVehicle() {
    this.isActive = false;
    this.mesh.visible = false;
  }

  // 步行更新
  update(delta, inputState, colliders) {
    if (!this.isActive) return;

    const forwardInput = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
    const sideInput = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    const isRunning = !!inputState.boost;

    const isMoving = forwardInput !== 0 || sideInput !== 0;

    if (isMoving) {
      // 运动朝向
      const moveAngle = Math.atan2(sideInput, forwardInput);
      this.heading = moveAngle;
      this.mesh.rotation.y = this.heading;

      const currentSpeed = isRunning ? this.runSpeed : this.walkSpeed;
      const dx = Math.sin(this.heading) * currentSpeed * delta;
      const dz = Math.cos(this.heading) * currentSpeed * delta;

      const oldPos = this.mesh.position.clone();
      this.mesh.position.x += dx;
      this.mesh.position.z += dz;

      // 碰撞检测
      const playerBox = new THREE.Box3().setFromCenterAndSize(
        this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
        new THREE.Vector3(0.8, 2, 0.8)
      );

      for (let c of colliders) {
        if (playerBox.intersectsBox(c.box)) {
          this.mesh.position.copy(oldPos);
          break;
        }
      }

      // 肢体摆动动画
      this.walkAnimPhase += delta * (isRunning ? 14 : 9);
      const legSwing = Math.sin(this.walkAnimPhase) * 0.55;
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftArm.rotation.x = -legSwing * 0.8;
      this.rightArm.rotation.x = legSwing * 0.8;
    } else {
      // 待机呼吸重置
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }
}
