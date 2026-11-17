import * as THREE from 'three';
import { SPAWN } from './config.js';

const EYE_HEIGHT = 1.62;
const RADIUS = 0.32;
const GRAVITY = 18;
const JUMP_SPEED = 5.2;
const MAX_FALL = 22;

/**
 * 第一 / 第三人称漫游控制器
 * - WASD / 方向键移动
 * - 鼠标或手指拖拽转视角
 * - 空格跳跃
 * - 圆形碰撞体 vs AABB，支持台阶自动抬升
 */
export class Player {
  constructor(camera, dom, world, scene) {
    this.camera = camera;
    this.dom = dom;
    this.world = world;
    this.scene = scene;

    this.feet = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
    this.vy = 0;
    this.grounded = true;
    this.yaw = 0;
    this.pitch = 0.2;
    this.mode = 'fp';
    this.distance = 5.5;

    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.jumpQueued = false;

    this.dragging = false;
    this.pointerId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.dragDistance = 0;

    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpDir = new THREE.Vector3();
    this.tmpHead = new THREE.Vector3();
    this.tmpCam = new THREE.Vector3();

    // 第三人称角色模型
    this.avatar = this.buildAvatar();
    this.avatar.visible = false;
    scene.add(this.avatar);
    this.walkPhase = 0;

    this._onKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();

    this._onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragging = true;
      this.pointerId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance = 0;
      try {
        this.dom.setPointerCapture?.(e.pointerId);
      } catch {
        /* 合成事件可能没有活动指针，忽略 */
      }
    };
    this._onPointerMove = (e) => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.0026;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0024, -1.15, 1.05);
    };
    this._onPointerUp = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.pointerId = null;
      try {
        this.dom.releasePointerCapture?.(e.pointerId);
      } catch {
        /* 忽略 */
      }
    };
    this._onWheel = (e) => {
      if (this.mode !== 'tp') return;
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance + Math.sign(e.deltaY) * 0.5, 2.6, 9);
    };
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointermove', this._onPointerMove);
    dom.addEventListener('pointerup', this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('contextmenu', this._onContextMenu);

    // 初始落地
    this.feet.y = world.getSupportY(this.feet.x, this.feet.z, 6);
    this.updateCamera(0);
  }

  get wasDrag() {
    return this.dragDistance > 6;
  }

  /** 第三人称角色（低多边形小人） */
  buildAvatar() {
    const group = new THREE.Group();
    this.avatarGeos = [];
    this.avatarMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d5f8f, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xe8b48f, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.55, metalness: 0.2 }),
    ];
    const [robe, pants, skin, hair, sash] = this.avatarMats;

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      this.avatarGeos.push(geo);
      return m;
    };

    add(new THREE.BoxGeometry(0.44, 0.64, 0.28), robe, 0, 1.05, 0);
    add(new THREE.BoxGeometry(0.46, 0.09, 0.3), sash, 0, 0.86, 0);
    add(new THREE.BoxGeometry(0.26, 0.28, 0.26), skin, 0, 1.52, 0);
    add(new THREE.BoxGeometry(0.3, 0.1, 0.3), hair, 0, 1.68, 0);
    add(new THREE.BoxGeometry(0.06, 0.06, 0.05), skin, 0, 1.51, 0.15);

    const legGeo = new THREE.BoxGeometry(0.15, 0.72, 0.17);
    legGeo.translate(0, -0.36, 0);
    this.avatarLegL = add(legGeo, pants, -0.11, 0.74, 0);
    const legGeo2 = new THREE.BoxGeometry(0.15, 0.72, 0.17);
    legGeo2.translate(0, -0.36, 0);
    this.avatarLegR = add(legGeo2, pants, 0.11, 0.74, 0);

    const armGeo = new THREE.BoxGeometry(0.11, 0.54, 0.13);
    armGeo.translate(0, -0.27, 0);
    this.avatarArmL = add(armGeo, robe, -0.29, 1.31, 0);
    const armGeo2 = new THREE.BoxGeometry(0.11, 0.54, 0.13);
    armGeo2.translate(0, -0.27, 0);
    this.avatarArmR = add(armGeo2, robe, 0.29, 1.31, 0);

    return group;
  }

  updateAvatar(dt, moving) {
    if (this.mode !== 'tp') return;
    this.avatar.position.set(this.feet.x, this.feet.y, this.feet.z);
    this.avatar.rotation.y = this.yaw + Math.PI;
    if (moving) this.walkPhase += dt * 9;
    const sw = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.avatarLegL.rotation.x = sw;
    this.avatarLegR.rotation.x = -sw;
    this.avatarArmL.rotation.x = -sw * 0.8;
    this.avatarArmR.rotation.x = sw * 0.8;
  }

  /** 判断这次指针抬起是否算「点击」而不是拖拽，并复位计数 */
  consumeClick() {
    const ok = this.dragDistance <= 6;
    this.dragDistance = 0;
    return ok;
  }

  toggleMode() {
    this.mode = this.mode === 'fp' ? 'tp' : 'fp';
    this.avatar.visible = this.mode === 'tp';
    this.updateCamera(0);
    return this.mode;
  }

  /** 把摇杆与键盘合成为移动向量 */
  getMove() {
    let x = this.joy.x;
    let z = this.joy.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return { x, z };
  }

  resolveCollisions() {
    const colliders = this.world.colliders;
    const feetY = this.feet.y;
    const bodyLow = feetY + 0.28;
    const bodyHigh = feetY + 1.7;

    for (let iter = 0; iter < 2; iter++) {
      for (const c of colliders) {
        if (bodyHigh < c.y0 + 0.04 || bodyLow > c.y1) continue;
        const cx = THREE.MathUtils.clamp(this.feet.x, c.x0, c.x1);
        const cz = THREE.MathUtils.clamp(this.feet.z, c.z0, c.z1);
        let dx = this.feet.x - cx;
        let dz = this.feet.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;

        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = RADIUS - d;
          this.feet.x += (dx / d) * push;
          this.feet.z += (dz / d) * push;
        } else {
          // 圆心落在盒内：沿最近的一条边推出
          const left = this.feet.x - c.x0;
          const right = c.x1 - this.feet.x;
          const back = this.feet.z - c.z0;
          const front = c.z1 - this.feet.z;
          const m = Math.min(left, right, back, front);
          if (m === left) this.feet.x = c.x0 - RADIUS;
          else if (m === right) this.feet.x = c.x1 + RADIUS;
          else if (m === back) this.feet.z = c.z0 - RADIUS;
          else this.feet.z = c.z1 + RADIUS;
        }
      }
    }
  }

  update(dt) {
    if (dt <= 0) return;
    const move = this.getMove();

    // 水平移动
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6.2 : 3.7;
    this.tmpForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.tmpRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.tmpDir
      .copy(this.tmpForward)
      .multiplyScalar(move.z)
      .addScaledVector(this.tmpRight, move.x);

    if (this.tmpDir.lengthSq() > 1e-6) {
      this.tmpDir.normalize();
      this.feet.x += this.tmpDir.x * speed * dt;
      this.feet.z += this.tmpDir.z * speed * dt;
      this.resolveCollisions();
    }

    this.updateAvatar(dt, this.tmpDir.lengthSq() > 1e-6);

    // 跳跃
    if (this.jumpQueued && this.grounded) {
      this.vy = JUMP_SPEED;
      this.grounded = false;
    }
    this.jumpQueued = false;

    // 重力与落地
    this.vy = Math.max(-MAX_FALL, this.vy - GRAVITY * dt);
    this.feet.y += this.vy * dt;

    const support = this.world.getSupportY(this.feet.x, this.feet.z, this.feet.y + 0.55);
    if (this.vy <= 0 && this.feet.y - support <= 0.7) {
      this.feet.y = support;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // 掉出世界时复位
    if (!Number.isFinite(this.feet.y) || this.feet.y < -40) {
      this.feet.set(SPAWN.x, this.world.getSupportY(SPAWN.x, SPAWN.z, 10), SPAWN.z);
      this.vy = 0;
    }

    this.updateCamera(dt);
  }

  updateCamera() {
    const headY = this.feet.y + EYE_HEIGHT;
    if (this.mode === 'fp') {
      this.camera.position.set(this.feet.x, headY, this.feet.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      this.tmpHead.set(this.feet.x, this.feet.y + 1.45, this.feet.z);
      this.tmpDir.set(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.tmpCam.copy(this.tmpHead).addScaledVector(this.tmpDir, -this.distance);
      // 相机不要钻进地面 / 楼板
      const s = this.world.getSupportY(this.tmpCam.x, this.tmpCam.z, this.tmpCam.y);
      this.tmpCam.y = Math.max(this.tmpCam.y, s + 0.45);
      this.camera.position.copy(this.tmpCam);
      this.camera.lookAt(this.tmpHead);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.dom.removeEventListener('pointerdown', this._onPointerDown);
    this.dom.removeEventListener('pointermove', this._onPointerMove);
    this.dom.removeEventListener('pointerup', this._onPointerUp);
    this.dom.removeEventListener('pointercancel', this._onPointerUp);
    this.dom.removeEventListener('wheel', this._onWheel);
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    if (this.avatar) {
      this.scene.remove(this.avatar);
      for (const g of this.avatarGeos) g.dispose();
      for (const m of this.avatarMats) m.dispose();
    }
  }
}
