import * as THREE from 'three';
import {
  FLOOR_Y,
  EAVE_Y,
  INNER_HALF,
  OUTER_HALF,
  stairSpec,
  stairHole,
} from './config.js';
import { GeoBatch, pushCollider, rectsAroundHole } from './utils.js';

/**
 * 黄鹤楼程序化建模
 * 所有构件由基础几何体拼装，重复构件用 GeoBatch 合并。
 */

const STEP_COUNT = 16;

// 各层陈列台位置（x, z）：避开楼梯洞口与楼梯本身
const EXHIBIT_POS = [
  [0, 0],
  [0, 6.6],
  [0, 5.2],
  [3.8, 0],
  [0, 2.4],
];

/** 生成带起翘的中国式屋面（方形环面 / 攒尖面） */
function makeRoof(a, b, yIn, yOut, lift, seg = 24) {
  const positions = [];
  const uvs = [];
  const step = (2 * b) / seg;

  const yAt = (x, z) => {
    const s = Math.max(Math.abs(x), Math.abs(z));
    let t = (s - a) / (b - a);
    t = Math.max(0, Math.min(1, t));
    // 凹曲面：靠近屋脊陡、靠近檐口缓
    const k = 1 - Math.pow(1 - t, 1.9);
    let y = yIn + (yOut - yIn) * k;
    // 四角起翘
    const mx = Math.max(Math.abs(x), Math.abs(z));
    const mn = Math.min(Math.abs(x), Math.abs(z));
    const c = mx > 1e-6 ? mn / mx : 0;
    y += lift * Math.pow(c, 3.2) * Math.pow(t, 1.6);
    return y;
  };

  const pushTri = (A, B, C) => {
    for (const v of [A, B, C]) {
      positions.push(v[0], v[1], v[2]);
      uvs.push(v[0] * 0.28, v[2] * 0.28);
    }
  };

  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
      const x0 = -b + i * step;
      const x1 = x0 + step;
      const z0 = -b + j * step;
      const z1 = z0 + step;
      const sMax = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(z0), Math.abs(z1));
      if (sMax < a) continue;
      const p = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      const v = p.map(([x, z]) => [x, yAt(x, z), z]);
      pushTri(v[0], v[3], v[2]);
      pushTri(v[0], v[2], v[1]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return { geo, yAt };
}

/** 屋面 + 暗色底面 + 檐口封边 */
function addRoof(root, mats, a, b, yIn, yOut, lift, seg) {
  const { geo, yAt } = makeRoof(a, b, yIn, yOut, lift, seg);
  const top = new THREE.Mesh(geo, mats.roof);
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  const under = new THREE.Mesh(geo.clone().translate(0, -0.24, 0), mats.roofUnder);
  under.receiveShadow = true;
  root.add(under);

  // 檐口封边，沿四边分段贴合起翘曲线
  const rim = new GeoBatch(mats.eave);
  const n = 12;
  const segLen = (2 * b) / n;
  for (let i = 0; i < n; i++) {
    const c = -b + (i + 0.5) * segLen;
    // 南北两边
    rim.box(segLen, 0.26, 0.12, c, yAt(c, b) - 0.12, b);
    rim.box(segLen, 0.26, 0.12, c, yAt(c, -b) - 0.12, -b);
    // 东西两边
    rim.box(0.12, 0.26, segLen, b, yAt(b, c) - 0.12, c);
    rim.box(0.12, 0.26, segLen, -b, yAt(-b, c) - 0.12, c);
  }
  rim.build(root, { cast: false, receive: false, name: '檐口' });
  return geo;
}

/** 水平直栏杆（轴对齐），同时写入碰撞盒 */
function railLine(batch, ax, az, bx, bz, y, colliders) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const alongZ = Math.abs(dz) > Math.abs(dx);
  const ry = alongZ ? Math.PI / 2 : 0;
  batch.box(len, 0.1, 0.12, cx, y + 1.0, cz, ry);
  batch.box(len, 0.06, 0.08, cx, y + 0.6, cz, ry);
  batch.box(len, 0.06, 0.08, cx, y + 0.2, cz, ry);
  const n = Math.max(2, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    batch.box(0.09, 1.0, 0.09, ax + dx * t, y + 0.5, az + dz * t);
  }
  colliders.push({
    x0: Math.min(ax, bx) - 0.1,
    x1: Math.max(ax, bx) + 0.1,
    z0: Math.min(az, bz) - 0.1,
    z1: Math.max(az, bz) + 0.1,
    y0: y,
    y1: y + 1.1,
  });
}

/** 斜向楼梯扶手 */
function stairRail(batch, x0, x1, z, yAtX0, yAtX1, colliders) {
  const dx = x1 - x0;
  const dy = yAtX1 - yAtX0;
  const len = Math.hypot(dx, dy);
  const cx = (x0 + x1) / 2;
  const cy = (yAtX0 + yAtX1) / 2;
  const angle = Math.atan2(dy, dx);

  batch.box(len, 0.1, 0.1, cx, cy + 0.98, z, 0, angle);
  batch.box(len, 0.06, 0.07, cx, cy + 0.52, z, 0, angle);

  const n = Math.max(4, Math.round(Math.abs(dx) / 0.7));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x0 + dx * t;
    const py = yAtX0 + dy * t;
    batch.box(0.08, 0.96, 0.08, px, py + 0.48, z);
  }

  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const a = x0 + dx * t0;
    const b = x0 + dx * t1;
    const y = yAtX0 + dy * ((t0 + t1) / 2);
    colliders.push({
      x0: Math.min(a, b),
      x1: Math.max(a, b),
      z0: z - 0.1,
      z1: z + 0.1,
      y0: y,
      y1: y + 1.06,
    });
  }
}

/** 展台 + 展品 */
function makeExhibit(mats, level, title, text, builder) {
  const y = FLOOR_Y[level];
  const [x, z] = EXHIBIT_POS[level];
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.name = title;

  const info = { title, text, tag: '展品' };

  // 台座
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.5), mats.red);
  base.position.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  base.userData.info = info;
  group.add(base);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.09, 1.62), mats.gold);
  trim.position.y = 0.9;
  trim.castShadow = true;
  trim.userData.info = info;
  group.add(trim);

  const item = builder();
  item.position.y = 0.95;
  item.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.userData.info = info;
    }
  });
  group.add(item);

  return { group, info, collider: { x, z, w: 1.7, d: 1.7, y0: y, y1: y + 1.1 } };
}

export function buildTower(mats) {
  const root = new THREE.Group();
  root.name = '黄鹤楼';

  const colliders = [];
  const surfaces = [];
  const clickables = [];
  const lights = [];

  const addSurface = (x0, x1, z0, z1, y) =>
    surfaces.push({ type: 'rect', x0, x1, z0, z1, y });
  const addRampZ = (x0, x1, z0, z1, y0, y1) =>
    surfaces.push({ type: 'rampZ', x0, x1, z0, z1, y0, y1 });
  const addRampX = (x0, x1, z0, z1, y0, y1) =>
    surfaces.push({ type: 'rampX', x0, x1, z0, z1, y0, y1 });

  // ---------------- 台基 ----------------
  const terrace1 = new THREE.Mesh(new THREE.BoxGeometry(40, 1.6, 40), mats.stone);
  terrace1.position.y = 0.8;
  terrace1.castShadow = true;
  terrace1.receiveShadow = true;
  root.add(terrace1);
  pushCollider(colliders, 0, 0, 40, 40, 0, 1.6);
  addSurface(-20, 20, -20, 20, 1.6);

  const terrace2 = new THREE.Mesh(new THREE.BoxGeometry(32, 1.4, 32), mats.stone);
  terrace2.position.y = 2.3;
  terrace2.castShadow = true;
  terrace2.receiveShadow = true;
  root.add(terrace2);
  pushCollider(colliders, 0, 0, 32, 32, 1.6, 3.0);
  addSurface(-16, 16, -16, 16, 3.0);

  // 台基压边（只做一圈边框，避免整块盖住楼面）
  const trim = new GeoBatch(mats.stoneDeck);
  for (const z of [-20, 20]) trim.box(40.6, 0.18, 0.7, 0, 1.66, z);
  for (const x of [-20, 20]) trim.box(0.7, 0.18, 40.6, x, 1.66, 0);
  for (const z of [-16, 16]) trim.box(32.6, 0.18, 0.7, 0, 3.06, z);
  for (const x of [-16, 16]) trim.box(0.7, 0.18, 32.6, x, 3.06, 0);
  trim.build(root, { cast: false, receive: true, name: '台基压边' });

  // 南侧石阶（广场 → 一层台基 → 二层台基）
  const stoneSteps = new GeoBatch(mats.stoneStep);
  const stair1 = { x: 6, z0: 20, z1: 23.6, y0: 1.6, y1: 0, n: 8 };
  for (let i = 0; i < stair1.n; i++) {
    const d = (stair1.z1 - stair1.z0) / stair1.n;
    const h = (stair1.y0 - stair1.y1) * ((i + 1) / stair1.n);
    stoneSteps.box(stair1.x, h, d, 0, h / 2, stair1.z1 - (i + 0.5) * d);
  }
  addRampZ(-stair1.x / 2, stair1.x / 2, stair1.z0, stair1.z1, stair1.y0, stair1.y1);

  const stair2 = { x: 5, z0: 16.4, z1: 19, y0: 3.0, y1: 1.6, n: 7 };
  for (let i = 0; i < stair2.n; i++) {
    const d = (stair2.z1 - stair2.z0) / stair2.n;
    const h = (stair2.y0 - stair2.y1) * ((i + 1) / stair2.n);
    stoneSteps.box(stair2.x, h, d, 0, stair2.y1 + h / 2, stair2.z1 - (i + 0.5) * d);
  }
  addRampZ(-stair2.x / 2, stair2.x / 2, stair2.z0, stair2.z1, stair2.y0, stair2.y1);
  stoneSteps.build(root, { cast: true, receive: true, name: '台基石阶' });

  // ---------------- 楼层、楼板、回廊 ----------------
  const deckRing = new GeoBatch(mats.stoneDeck);
  const woodFinish = new GeoBatch(mats.floor);
  const slabBatch = new GeoBatch(mats.stone);

  for (let level = 0; level < 5; level++) {
    const O = OUTER_HALF[level];
    const H = INNER_HALF[level];
    const y = FLOOR_Y[level];
    const hole = stairHole(level);

    // 结构楼板（带洞）
    for (const r of rectsAroundHole(-O, O, -O, O, hole)) {
      slabBatch.box(r.x1 - r.x0, 0.3, r.z1 - r.z0, (r.x0 + r.x1) / 2, y - 0.15, (r.z0 + r.z1) / 2);
    }

    // 大厅木地板
    for (const r of rectsAroundHole(-H, H, -H, H, hole)) {
      woodFinish.box(r.x1 - r.x0, 0.04, r.z1 - r.z0, (r.x0 + r.x1) / 2, y + 0.02, (r.z0 + r.z1) / 2);
    }

    // 外回廊石地面（环形）
    deckRing.box(2 * O, 0.06, O - H, 0, y + 0.03, -(H + O) / 2);
    deckRing.box(2 * O, 0.06, O - H, 0, y + 0.03, (H + O) / 2);
    deckRing.box(O - H, 0.06, 2 * H, -(H + O) / 2, y + 0.03, 0);
    deckRing.box(O - H, 0.06, 2 * H, (H + O) / 2, y + 0.03, 0);

    // 可行走面
    for (const r of rectsAroundHole(-O, O, -O, O, hole)) {
      addSurface(r.x0, r.x1, r.z0, r.z1, y);
    }

    // 楼板侧面压边
    deckRing.box(2 * O + 0.16, 0.34, 0.16, 0, y - 0.14, O);
    deckRing.box(2 * O + 0.16, 0.34, 0.16, 0, y - 0.14, -O);
    deckRing.box(0.16, 0.34, 2 * O, O, y - 0.14, 0);
    deckRing.box(0.16, 0.34, 2 * O, -O, y - 0.14, 0);
  }
  slabBatch.build(root, { cast: true, receive: true, name: '楼板' });
  woodFinish.build(root, { cast: false, receive: true, name: '木地板' });
  deckRing.build(root, { cast: false, receive: true, name: '回廊地面' });

  // ---------------- 一层墙体、门窗、壁画 ----------------
  const H0 = INNER_HALF[0];
  const y0 = FLOOR_Y[0];
  const wallTop = y0 + 4.6;
  const doorH = 3.4;
  const doorW = 3.2;
  const wallBatch = new GeoBatch(mats.wall);
  const redBatch = new GeoBatch(mats.red);
  const glassBatch = new GeoBatch(mats.glass);

  // 南墙（主入口）
  const southSeg = (H0 - doorW / 2);
  wallBatch.box(southSeg, 4.6, 0.4, -(doorW / 2 + southSeg / 2), y0 + 2.3, H0);
  wallBatch.box(southSeg, 4.6, 0.4, doorW / 2 + southSeg / 2, y0 + 2.3, H0);
  wallBatch.box(doorW, 4.6 - doorH, 0.4, 0, y0 + doorH + (4.6 - doorH) / 2, H0);
  pushCollider(colliders, -(doorW / 2 + southSeg / 2), H0, southSeg, 0.4, y0, wallTop);
  pushCollider(colliders, doorW / 2 + southSeg / 2, H0, southSeg, 0.4, y0, wallTop);

  // 北墙（实墙）
  wallBatch.box(2 * H0, 4.6, 0.4, 0, y0 + 2.3, -H0);
  pushCollider(colliders, 0, -H0, 2 * H0, 0.4, y0, wallTop);

  // 东墙（花窗）
  const winW = 5;
  const winH = 2.8;
  const winSill = 0.9;
  const eastSeg = (H0 - winW / 2);
  wallBatch.box(0.4, 4.6, eastSeg, H0, y0 + 2.3, -(winW / 2 + eastSeg / 2));
  wallBatch.box(0.4, 4.6, eastSeg, H0, y0 + 2.3, winW / 2 + eastSeg / 2);
  wallBatch.box(0.4, winSill, winW, H0, y0 + winSill / 2, 0);
  wallBatch.box(0.4, 4.6 - winSill - winH, winW, H0, y0 + winSill + winH + (4.6 - winSill - winH) / 2, 0);
  pushCollider(colliders, H0, 0, 0.4, 2 * H0, y0, wallTop);

  // 西墙（实墙，贴《白云黄鹤》壁画）
  wallBatch.box(0.4, 4.6, 2 * H0, -H0, y0 + 2.3, 0);
  pushCollider(colliders, -H0, 0, 0.4, 2 * H0, y0, wallTop);

  // 门框
  redBatch.box(0.22, doorH + 0.2, 0.55, -doorW / 2 - 0.11, y0 + doorH / 2, H0);
  redBatch.box(0.22, doorH + 0.2, 0.55, doorW / 2 + 0.11, y0 + doorH / 2, H0);
  redBatch.box(doorW + 0.44, 0.26, 0.55, 0, y0 + doorH + 0.13, H0);

  // 东侧花窗棂格 + 玻璃
  glassBatch.box(0.1, winH, winW, H0, y0 + winSill + winH / 2, 0);
  const bars = 8;
  for (let i = 1; i < bars; i++) {
    const z = -winW / 2 + (winW / bars) * i;
    redBatch.box(0.16, winH, 0.07, H0 + 0.05, y0 + winSill + winH / 2, z);
  }
  for (let i = 1; i < 4; i++) {
    const yy = y0 + winSill + (winH / 4) * i;
    redBatch.box(0.16, 0.07, winW, H0 + 0.05, yy, 0);
  }

  // 墙角立柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      redBatch.cyl(0.2, 0.22, 4.7, 10, sx * H0, y0 + 2.35, sz * H0);
    }
  }

  // 一层天花（为楼梯留洞）
  const ceilingHole = stairHole(1);
  const ceilBatch = new GeoBatch(mats.ceiling);
  for (const r of rectsAroundHole(-H0, H0, -H0, H0, ceilingHole)) {
    ceilBatch.box(r.x1 - r.x0, 0.18, r.z1 - r.z0, (r.x0 + r.x1) / 2, y0 + 4.72, (r.z0 + r.z1) / 2);
  }
  ceilBatch.build(root, { cast: false, receive: true, name: '一层天花' });

  // 檐下额枋
  redBatch.box(2 * H0 + 0.6, 0.55, 0.45, 0, y0 + 4.95, H0);
  redBatch.box(2 * H0 + 0.6, 0.55, 0.45, 0, y0 + 4.95, -H0);
  redBatch.box(0.45, 0.55, 2 * H0 + 0.6, H0, y0 + 4.95, 0);
  redBatch.box(0.45, 0.55, 2 * H0 + 0.6, -H0, y0 + 4.95, 0);

  // 壁画
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.0), mats.mural);
  mural.position.set(-H0 + 0.22, y0 + 2.55, 0);
  mural.rotation.y = Math.PI / 2;
  mural.userData.info = {
    title: '《白云黄鹤》壁画',
    tag: '壁画',
    text:
      '壁画取意于「昔人已乘黄鹤去，此地空余黄鹤楼」。画中祥云翻涌、仙鹤振翅，远处江天一色，黄鹤楼临江而立。' +
      '相传古时仙人骑黄鹤于此驻足，后人筑楼纪念，黄鹤楼因此得名。壁画以青绿与鎏金为主色，象征楚地云梦泽的浩渺与仙道文化。',
  };
  root.add(mural);
  clickables.push(mural);

  // 匾额（门外上方）
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.18), mats.plaque);
  plaque.position.set(0, y0 + 4.12, H0 + 0.24);
  plaque.userData.info = {
    title: '「黄鹤楼」匾额',
    tag: '匾额',
    text:
      '黑底金字的「黄鹤楼」匾额悬于底层大厅正门上方，是楼阁的门面标识。' +
      '黄鹤楼始建于三国吴黄武二年（公元 223 年），历代屡毁屡建，现楼以清代同治楼为蓝本重建，' +
      '与湖南岳阳楼、江西滕王阁并称「江南三大名楼」。',
  };
  root.add(plaque);
  clickables.push(plaque);

  wallBatch.build(root, { cast: true, receive: true, name: '一层墙体' });
  glassBatch.build(root, { cast: false, receive: false, name: '窗玻璃' });

  // ---------------- 外檐柱、栏杆、斗拱 ----------------
  const columnBatch = new GeoBatch(mats.red);
  const railingBatch = new GeoBatch(mats.red);
  const bracketBatch = new GeoBatch(mats.red);
  const goldBatch = new GeoBatch(mats.gold);
  const lanternBatch = new GeoBatch(mats.lantern);

  for (let level = 0; level < 5; level++) {
    const O = OUTER_HALF[level];
    const y = FLOOR_Y[level];
    const eave = EAVE_Y[level];
    const r = O - 0.55;

    // 檐柱
    const seen = new Set();
    const step = 2.7;
    const place = (x, z) => {
      const key = `${x.toFixed(2)},${z.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      columnBatch.cyl(0.17, 0.2, 5.35, 10, x, y + 2.675, z);
      pushCollider(colliders, x, z, 0.42, 0.42, y, y + 5.2);
    };
    for (let t = -r; t <= r + 0.01; t += step) {
      place(t, r);
      place(t, -r);
      place(r, t);
      place(-r, t);
    }
    // 补角柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) place(sx * r, sz * r);

    // 外栏杆（底层南侧留出入口，与台基石阶相接）
    const rr = O - 0.08;
    if (level === 0) {
      railLine(railingBatch, -rr, rr, -2.1, rr, y, colliders);
      railLine(railingBatch, 2.1, rr, rr, rr, y, colliders);
    } else {
      railLine(railingBatch, -rr, rr, rr, rr, y, colliders);
    }
    railLine(railingBatch, -rr, -rr, rr, -rr, y, colliders);
    railLine(railingBatch, rr, -rr, rr, rr, y, colliders);
    railLine(railingBatch, -rr, -rr, -rr, rr, y, colliders);

    // 斗拱（三层叠涩）
    const bx = O - 0.42;
    for (let t = -bx; t <= bx + 0.01; t += 1.75) {
      for (const [z, rot] of [
        [bx, 0],
        [-bx, 0],
      ]) {
        bracketBatch.box(1.0, 0.2, 0.42, t, eave - 0.95, z, rot);
        bracketBatch.box(0.78, 0.2, 0.62, t, eave - 0.7, z, rot);
        bracketBatch.box(0.56, 0.2, 0.82, t, eave - 0.45, z, rot);
      }
      for (const [x, rot] of [
        [bx, Math.PI / 2],
        [-bx, Math.PI / 2],
      ]) {
        bracketBatch.box(1.0, 0.2, 0.42, x, eave - 0.95, t, rot);
        bracketBatch.box(0.78, 0.2, 0.62, x, eave - 0.7, t, rot);
        bracketBatch.box(0.56, 0.2, 0.82, x, eave - 0.45, t, rot);
      }
    }

    // 檐下金线
    goldBatch.box(2 * O + 0.2, 0.08, 0.1, 0, eave - 0.16, O - 0.28);
    goldBatch.box(2 * O + 0.2, 0.08, 0.1, 0, eave - 0.16, -O + 0.28);
    goldBatch.box(0.1, 0.08, 2 * O + 0.2, O - 0.28, eave - 0.16, 0);
    goldBatch.box(0.1, 0.08, 2 * O + 0.2, -O + 0.28, eave - 0.16, 0);

    // 回廊灯笼
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        lanternBatch.sphere(0.19, 10, sx * (O - 0.45), y + 2.45, sz * (O - 0.45), 1, 1.25, 1);
      }
    }
  }

  // ---------------- 楼梯 ----------------
  const stairBatch = new GeoBatch(mats.floor);
  const stairRailBatch = new GeoBatch(mats.red);
  const holeRailBatch = new GeoBatch(mats.red);

  for (let i = 0; i < 4; i++) {
    const s = stairSpec(i);
    const { xStart, xEnd, xL0, zA, zB, laneW, y0: sy0, y1: sy1 } = s;
    const half = s.halfRise;
    const run = xL0 - xStart;
    const runStep = run / STEP_COUNT;
    const riseStep = half / STEP_COUNT;
    const zAc = zA + laneW / 2;
    const zBc = zB + laneW / 2;

    // A 跑（镂空踏步 + 立板 + 斜梁）
    for (let k = 0; k < STEP_COUNT; k++) {
      const topY = sy0 + (k + 1) * riseStep;
      const xc = xStart + (k + 0.5) * runStep;
      stairBatch.box(runStep + 0.03, 0.1, laneW, xc, topY - 0.05, zAc);
      stairBatch.box(0.05, riseStep, laneW, xStart + k * runStep + 0.025, topY - riseStep / 2, zAc);
    }
    // 休息平台
    stairBatch.box(xEnd - xL0, 0.22, zB + laneW - zA, (xL0 + xEnd) / 2, sy0 + half - 0.11, (zA + zB + laneW) / 2);
    // B 跑
    for (let k = 0; k < STEP_COUNT; k++) {
      const topY = sy0 + half + (k + 1) * riseStep;
      const xc = xL0 - (k + 0.5) * runStep;
      stairBatch.box(runStep + 0.03, 0.1, laneW, xc, topY - 0.05, zBc);
      stairBatch.box(0.05, riseStep, laneW, xL0 - k * runStep - 0.025, topY - riseStep / 2, zBc);
    }

    // 两侧斜梁
    const runLen = Math.hypot(run, half);
    const ang = Math.atan2(half, run);
    for (const zz of [zA + 0.05, zA + laneW - 0.05]) {
      stairBatch.box(runLen, 0.26, 0.09, (xStart + xL0) / 2, sy0 + half / 2 - 0.2, zz, 0, ang);
    }
    for (const zz of [zB + 0.05, zB + laneW - 0.05]) {
      stairBatch.box(runLen, 0.26, 0.09, (xStart + xL0) / 2, sy0 + half + half / 2 - 0.2, zz, 0, -ang);
    }

    // 可行走斜面
    addRampX(xStart, xL0, zA, zA + laneW, sy0, sy0 + half);
    addRampX(xStart, xL0, zB, zB + laneW, sy1, sy0 + half);
    addSurface(xL0, xEnd, zA, zB + laneW, sy0 + half);

    // 扶手
    stairRail(stairRailBatch, xStart, xL0, zA, sy0, sy0 + half, colliders);
    stairRail(stairRailBatch, xStart, xL0, zA + laneW, sy0, sy0 + half, colliders);
    stairRail(stairRailBatch, xStart, xL0, zB, sy1, sy0 + half, colliders);
    stairRail(stairRailBatch, xStart, xL0, zB + laneW, sy1, sy0 + half, colliders);
    // 平台外侧扶手
    railLine(stairRailBatch, xEnd, zA, xEnd, zB + laneW, sy0 + half, colliders);

    // 上层洞口护栏（B 跑出口留空）
    const h = stairHole(i + 1);
    const uy = sy1;
    railLine(holeRailBatch, h.x0, h.z0, h.x1, h.z0, uy, colliders);
    railLine(holeRailBatch, h.x0, h.z1, h.x1, h.z1, uy, colliders);
    railLine(holeRailBatch, h.x1, h.z0, h.x1, h.z1, uy, colliders);
    railLine(holeRailBatch, h.x0, h.z0, h.x0, zB, uy, colliders);
  }
  stairBatch.build(root, { cast: true, receive: true, name: '楼梯' });
  stairRailBatch.build(root, { cast: true, receive: true, name: '楼梯扶手' });
  holeRailBatch.build(root, { cast: true, receive: true, name: '洞口护栏' });

  // ---------------- 屋面 ----------------
  for (let level = 0; level < 4; level++) {
    const a = INNER_HALF[level + 1] - 0.12;
    const b = OUTER_HALF[level] + 3.0;
    addRoof(root, mats, a, b, EAVE_Y[level] + 1.42, EAVE_Y[level], 1.15, 26);
  }
  // 顶层攒尖顶
  addRoof(root, mats, 0.4, OUTER_HALF[4] + 3.0, 45.0, EAVE_Y[4], 1.5, 22);

  // ---------------- 宝顶 ----------------
  const finial = new THREE.Group();
  const addGold = (geo, y) => {
    const m = new THREE.Mesh(geo, mats.gold);
    m.position.y = y;
    m.castShadow = true;
    finial.add(m);
  };
  addGold(new THREE.CylinderGeometry(0.95, 1.25, 0.5, 16), 45.15);
  addGold(new THREE.SphereGeometry(0.82, 16, 10), 45.85);
  addGold(new THREE.SphereGeometry(0.56, 14, 10), 46.9);
  addGold(new THREE.SphereGeometry(0.4, 12, 8), 47.75);
  addGold(new THREE.CylinderGeometry(0.12, 0.2, 2.0, 10), 48.9);
  addGold(new THREE.SphereGeometry(0.26, 12, 8), 50.0);
  addGold(new THREE.ConeGeometry(0.12, 0.9, 10), 50.5);
  root.add(finial);

  // ---------------- 陈列台 ----------------
  const exhibits = [];

  const ding = makeExhibit(
    mats,
    1,
    '青铜鼎',
    '鼎是先秦楚地重要的礼器，用于祭祀与宴飨。此鼎三足双耳，腹饰蟠螭纹，' +
      '造型浑厚庄重。楚人尚赤、崇凤，青铜器上常见的云纹与凤鸟纹，正与黄鹤楼的云鹤意象一脉相承。',
    () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.36, 0.5, 16), mats.bronze);
      body.position.y = 0.45;
      g.add(body);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 8, 20), mats.bronze);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.7;
      g.add(rim);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.45, 8), mats.bronze);
        leg.position.set(Math.cos(a) * 0.28, 0.22, Math.sin(a) * 0.28);
        g.add(leg);
      }
      for (const sx of [-1, 1]) {
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 12, Math.PI), mats.bronze);
        handle.position.set(sx * 0.46, 0.72, 0);
        handle.rotation.y = Math.PI / 2;
        g.add(handle);
      }
      return g;
    }
  );
  exhibits.push(ding);

  const vase = makeExhibit(
    mats,
    2,
    '青花瓷瓶',
    '青花瓷以钴料在素胎上绘纹，罩透明釉后高温一次烧成，色泽清雅。' +
      '瓶身缠枝莲纹自下而上舒展，寓意「清廉」「连绵」。长江航运与景德镇瓷业往来密切，' +
      '登楼远眺，仿佛仍能看见江面上运送瓷器的帆影。',
    () => {
      const g = new THREE.Group();
      const pts = [];
      const profile = [
        [0.06, 0],
        [0.22, 0.02],
        [0.3, 0.12],
        [0.34, 0.34],
        [0.27, 0.58],
        [0.13, 0.74],
        [0.1, 0.88],
        [0.16, 0.98],
        [0.15, 1.04],
      ];
      for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mats.porcelain);
      body.position.y = 0.05;
      g.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.32, 0.12, 20, 1, true), mats.bronze);
      band.position.y = 0.42;
      g.add(band);
      const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20, 1, true), mats.bronze);
      band2.position.y = 0.95;
      g.add(band2);
      return g;
    }
  );
  exhibits.push(vase);

  const bells = makeExhibit(
    mats,
    3,
    '楚式编钟',
    '编钟是中国古代重要的打击乐器，按音高分列，可演奏完整的旋律。' +
      '湖北曾侯乙编钟是迄今发现规模最大、音律最全的一套，被誉为「古代世界第八大奇迹」。' +
      '楚地音乐发达，钟磬之音常在江畔楼阁间回响。',
    () => {
      const g = new THREE.Group();
      const frameMat = mats.red;
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), frameMat);
        post.position.set(sx * 0.62, 0.62, 0);
        g.add(post);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.12), frameMat);
      bar.position.y = 1.25;
      g.add(bar);
      for (let i = 0; i < 6; i++) {
        const x = -0.5 + i * 0.2;
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 8), mats.bronze);
        bell.position.set(x, 0.98, 0);
        g.add(bell);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.bronze);
        knob.position.set(x, 1.17, 0);
        g.add(knob);
      }
      return g;
    }
  );
  exhibits.push(bells);
  // 编钟横架朝向大厅中心，避免正对楼梯时只看到一根立柱
  bells.group.rotation.y = Math.PI / 2;

  const craneStatue = makeExhibit(
    mats,
    4,
    '铜鹤',
    '鹤在传统文化中象征长寿、高洁与仙逸。黄鹤楼之名源于仙人乘鹤的传说，' +
      '楼内陈设铜鹤，既点题，也寄托「黄鹤一去不复返，白云千载空悠悠」的悠远意境。' +
      '立于顶层，凭窗可望长江与武汉三镇。',
    () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mats.bronze);
      body.scale.set(1.5, 0.85, 0.9);
      body.position.y = 0.5;
      g.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.85, 8), mats.bronze);
      neck.position.set(0.36, 0.86, 0);
      neck.rotation.z = -0.38;
      g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.bronze);
      head.position.set(0.52, 1.26, 0);
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 8), mats.bronze);
      beak.position.set(0.65, 1.24, 0);
      beak.rotation.z = -Math.PI / 2;
      g.add(beak);
      for (const sz of [-0.1, 0.1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.45, 6), mats.bronze);
        leg.position.set(-0.05, 0.18, sz);
        g.add(leg);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), mats.bronze);
      tail.position.set(-0.48, 0.56, 0);
      tail.rotation.z = Math.PI / 2;
      g.add(tail);
      return g;
    }
  );
  exhibits.push(craneStatue);
  // 铜鹤朝向大厅（南侧）
  craneStatue.group.rotation.y = -Math.PI / 2;

  for (const ex of exhibits) {
    root.add(ex.group);
    ex.group.traverse((o) => {
      if (o.isMesh) clickables.push(o);
    });
    pushCollider(
      colliders,
      ex.collider.x,
      ex.collider.z,
      ex.collider.w,
      ex.collider.d,
      ex.collider.y0,
      ex.collider.y1
    );
  }

  // ---------------- 室内灯光 ----------------
  for (let level = 0; level < 5; level++) {
    const light = new THREE.PointLight(0xffb066, 0, 26, 2);
    light.position.set(0, FLOOR_Y[level] + 3.4, 0);
    root.add(light);
    lights.push(light);
  }

  // ---------------- 完成 ----------------
  columnBatch.build(root, { cast: true, receive: true, name: '檐柱' });
  railingBatch.build(root, { cast: true, receive: true, name: '外栏杆' });
  bracketBatch.build(root, { cast: true, receive: true, name: '斗拱' });
  goldBatch.build(root, { cast: false, receive: false, name: '金线' });
  const lanternMesh = lanternBatch.build(root, { cast: false, receive: false, name: '灯笼' });
  if (lanternMesh) lanternMesh.userData.noRay = true;

  /** 昼夜切换：k 为 0（白天）→ 1（夜晚） */
  const setNight = (k) => {
    mats.lantern.emissiveIntensity = 0.15 + 3.2 * k;
    mats.gold.emissiveIntensity = 0.15 + 0.55 * k;
    mats.mural.emissiveIntensity = 0.12 + 0.35 * k;
    mats.plaque.emissiveIntensity = 0.16 + 0.5 * k;
    for (const l of lights) l.intensity = 62 + 46 * k;
  };
  setNight(0);

  return {
    group: root,
    colliders,
    surfaces,
    clickables,
    lights,
    setNight,
  };
}
