import * as THREE from 'three';

/**
 * 程序化纹理工厂
 * 全部纹理由 Canvas 2D 实时绘制，零外部图片资源。
 */

function make(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 红漆木纹（立柱、栏杆） */
function woodTexture() {
  const c = make(256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#7d2119');
  grad.addColorStop(0.35, '#a8382a');
  grad.addColorStop(0.6, '#b84433');
  grad.addColorStop(1, '#7a1f18');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 190; i++) {
    const x = Math.random() * 256;
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(40,8,4,0.10)' : 'rgba(255,190,160,0.07)';
    g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath();
    g.moveTo(x, -10);
    g.bezierCurveTo(x + 7, 70, x - 6, 180, x + 3, 266);
    g.stroke();
  }
  return toTexture(c, 1, 2);
}

/** 深色木地板 */
function floorTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.fillStyle = '#6a4730';
  g.fillRect(0, 0, 512, 512);

  const plank = 64;
  for (let x = 0; x < 512; x += plank) {
    g.fillStyle = x % 128 === 0 ? 'rgba(255,220,180,0.045)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, 0, plank, 512);
    g.strokeStyle = 'rgba(20,10,4,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
    // 木纹
    for (let i = 0; i < 14; i++) {
      const gx = x + 4 + Math.random() * (plank - 8);
      g.strokeStyle = 'rgba(30,16,8,0.16)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(gx, 0);
      g.bezierCurveTo(gx + 4, 160, gx - 4, 340, gx + 2, 512);
      g.stroke();
    }
  }
  return toTexture(c, 4, 4);
}

/** 石材（台基、广场、栏杆） */
function stoneTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.fillStyle = '#898983';
  g.fillRect(0, 0, 512, 512);

  const bh = 64;
  const bw = 128;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 512 + bw; x += bw) {
      const bx = x + offset;
      // 单通道亮度 + 极小色差，避免石块出现红绿蓝跳色
      const v = 120 + Math.random() * 26;
      g.fillStyle = `rgb(${v | 0},${v | 0},${(v - 4) | 0})`;
      g.fillRect(bx + 2, row * bh + 2, bw - 4, bh - 4);
      g.strokeStyle = 'rgba(60,60,56,0.45)';
      g.lineWidth = 2;
      g.strokeRect(bx + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  // 噪点
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  return toTexture(c, 4, 4);
}

/** 米色墙面抹灰 */
function wallTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.fillStyle = '#e9dfca';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(120,100,70,0.05)';
    const r = 1 + Math.random() * 5;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(140,110,70,0.18)';
  g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  return toTexture(c, 2, 1);
}

/** 黄琉璃瓦 */
function tileTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.fillStyle = '#c9941d';
  g.fillRect(0, 0, 512, 512);

  const col = 32;
  for (let x = 0; x < 512; x += col) {
    const lg = g.createLinearGradient(x, 0, x + col, 0);
    lg.addColorStop(0, '#a8760f');
    lg.addColorStop(0.3, '#e7b52f');
    lg.addColorStop(0.55, '#ffe27a');
    lg.addColorStop(0.8, '#dba720');
    lg.addColorStop(1, '#9c6c0c');
    g.fillStyle = lg;
    g.fillRect(x, 0, col, 512);
  }
  // 横向瓦垄接缝
  for (let y = 0; y < 512; y += 64) {
    g.strokeStyle = 'rgba(96,60,6,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const yy = y + Math.sin((x / 512) * Math.PI * 2) * 2;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,236,160,0.25)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, y + 4);
    g.lineTo(512, y + 4);
    g.stroke();
  }
  return toTexture(c, 1, 1);
}

/** 天花（暗色木构 + 金色藻井） */
function ceilingTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.fillStyle = '#38241a';
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      g.strokeStyle = 'rgba(196,150,66,0.55)';
      g.lineWidth = 4;
      g.strokeRect(x + 18, y + 18, 92, 92);
      g.strokeStyle = 'rgba(196,150,66,0.28)';
      g.lineWidth = 2;
      g.strokeRect(x + 34, y + 34, 60, 60);
      g.fillStyle = 'rgba(214,168,80,0.55)';
      g.beginPath();
      g.arc(x + 64, y + 64, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c, 2, 2);
}

/** 画一只仙鹤剪影 */
function drawCrane(g, x, y, s, flip = false) {
  g.save();
  g.translate(x, y);
  g.scale(s * (flip ? -1 : 1), s);

  // 腿
  g.strokeStyle = '#3b3630';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-6, 18);
  g.lineTo(-18, 62);
  g.moveTo(8, 20);
  g.lineTo(2, 64);
  g.stroke();

  // 尾羽
  g.fillStyle = '#4a4640';
  g.beginPath();
  g.moveTo(-40, -2);
  g.lineTo(-78, -20);
  g.lineTo(-70, 2);
  g.lineTo(-82, 12);
  g.lineTo(-40, 16);
  g.closePath();
  g.fill();

  // 身体
  g.fillStyle = '#fbf8ec';
  g.strokeStyle = '#4a4640';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 0, 44, 22, -0.08, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 翅膀
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-16, -8);
  g.quadraticCurveTo(10, -46, 44, -26);
  g.quadraticCurveTo(18, -10, 10, 6);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#3b3630';
  g.beginPath();
  g.moveTo(34, -28);
  g.quadraticCurveTo(40, -18, 30, -12);
  g.quadraticCurveTo(24, -20, 34, -28);
  g.fill();

  // 长颈
  g.strokeStyle = '#fbf8ec';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(30, -8);
  g.quadraticCurveTo(66, -22, 72, -58);
  g.stroke();
  g.strokeStyle = '#4a4640';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(30, -8);
  g.quadraticCurveTo(66, -22, 72, -58);
  g.stroke();

  // 头与喙
  g.fillStyle = '#fbf8ec';
  g.beginPath();
  g.ellipse(74, -60, 9, 7, 0.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#4a4640';
  g.stroke();
  g.fillStyle = '#b23a2a';
  g.beginPath();
  g.arc(75, -67, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8c6a2c';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(82, -60);
  g.lineTo(98, -56);
  g.stroke();

  g.restore();
}

/** 底层壁画《白云黄鹤》 */
function muralTexture() {
  const c = make(1024, 512);
  const g = c.getContext('2d');

  // 天空
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#8fb8d4');
  sky.addColorStop(0.45, '#cfe4ea');
  sky.addColorStop(0.78, '#f2ead3');
  sky.addColorStop(1, '#dfd1b0');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);

  // 太阳
  const sun = g.createRadialGradient(800, 120, 10, 800, 120, 130);
  sun.addColorStop(0, 'rgba(255,246,214,0.95)');
  sun.addColorStop(0.4, 'rgba(255,226,150,0.5)');
  sun.addColorStop(1, 'rgba(255,226,150,0)');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(800, 120, 130, 0, Math.PI * 2);
  g.fill();

  // 祥云
  const cloud = (cx, cy, scale, alpha) => {
    g.save();
    g.translate(cx, cy);
    g.scale(scale, scale);
    g.globalAlpha = alpha;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(k * 54, Math.sin(k * 1.7) * 12, 34 + (k % 2) * 8, Math.PI * 0.85, Math.PI * 2.2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-30, 18);
    g.quadraticCurveTo(90, 44, 230, 12);
    g.stroke();
    g.restore();
  };
  cloud(120, 90, 1.25, 0.75);
  cloud(330, 60, 0.9, 0.55);
  cloud(600, 140, 1.05, 0.5);
  cloud(60, 230, 0.8, 0.4);
  cloud(700, 300, 1.2, 0.35);

  // 远山
  g.fillStyle = 'rgba(112,140,140,0.35)';
  g.beginPath();
  g.moveTo(0, 360);
  g.quadraticCurveTo(150, 290, 300, 350);
  g.quadraticCurveTo(420, 300, 540, 356);
  g.quadraticCurveTo(680, 296, 860, 350);
  g.quadraticCurveTo(950, 320, 1024, 344);
  g.lineTo(1024, 512);
  g.lineTo(0, 512);
  g.closePath();
  g.fill();

  // 江水
  const water = g.createLinearGradient(0, 400, 0, 512);
  water.addColorStop(0, 'rgba(120,164,178,0.55)');
  water.addColorStop(1, 'rgba(72,112,132,0.85)');
  g.fillStyle = water;
  g.fillRect(0, 400, 1024, 112);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 418 + i * 10;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 32) {
      const yy = y + Math.sin(x * 0.02 + i) * 3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }

  // 江边黄鹤楼剪影
  g.fillStyle = 'rgba(120,80,40,0.55)';
  for (let i = 0; i < 5; i++) {
    const w = 96 - i * 14;
    const y = 372 - i * 22;
    g.fillRect(160 - w / 2, y, w, 16);
    g.beginPath();
    g.moveTo(160 - w / 2 - 10, y);
    g.quadraticCurveTo(160 - w / 2, y - 16, 160, y - 10);
    g.quadraticCurveTo(160 + w / 2, y - 16, 160 + w / 2 + 10, y);
    g.closePath();
    g.fill();
  }

  // 两只仙鹤
  drawCrane(g, 560, 230, 1.15, false);
  drawCrane(g, 780, 330, 0.8, true);

  // 题字
  g.save();
  g.translate(950, 70);
  g.fillStyle = 'rgba(42,52,64,0.9)';
  g.font = 'bold 62px "KaiTi","STKaiti","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const chars = ['白', '雲', '黃', '鶴'];
  chars.forEach((ch, i) => g.fillText(ch, 0, i * 66));
  g.restore();

  // 印章
  g.fillStyle = 'rgba(170,48,36,0.85)';
  g.fillRect(930, 348, 44, 44);
  g.fillStyle = '#f3e6cc';
  g.font = 'bold 26px "KaiTi","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('鹤', 952, 362);
  g.fillText('归', 952, 384);

  // 装裱边框
  g.strokeStyle = 'rgba(90,62,34,0.6)';
  g.lineWidth = 16;
  g.strokeRect(8, 8, 1008, 496);

  return toTexture(c, 1, 1);
}

/** 「黄鹤楼」金字匾额 */
function plaqueTexture() {
  const c = make(1024, 288);
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, 288);
  bg.addColorStop(0, '#5a1a12');
  bg.addColorStop(0.5, '#3f0f0a');
  bg.addColorStop(1, '#571710');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 288);

  // 金色边框
  g.strokeStyle = '#d8ab45';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 996, 260);
  g.strokeStyle = 'rgba(216,171,69,0.5)';
  g.lineWidth = 4;
  g.strokeRect(34, 34, 956, 220);

  // 四角云纹
  g.fillStyle = 'rgba(216,171,69,0.65)';
  for (const [x, y, sx, sy] of [
    [70, 70, 1, 1],
    [954, 70, -1, 1],
    [70, 218, 1, -1],
    [954, 218, -1, -1],
  ]) {
    g.save();
    g.translate(x, y);
    g.scale(sx, sy);
    g.beginPath();
    g.arc(0, 0, 20, 0, Math.PI * 1.5);
    g.arc(26, 0, 12, Math.PI, Math.PI * 2.4);
    g.fill();
    g.restore();
  }

  // 主字
  g.font = 'bold 168px "KaiTi","STKaiti","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.65)';
  g.shadowBlur = 12;
  g.shadowOffsetY = 6;
  const text = '黄鹤楼';
  const spacing = 230;
  g.fillStyle = '#f0c85a';
  for (let i = 0; i < text.length; i++) {
    g.fillText(text[i], 512 + (i - 1) * spacing, 148);
  }
  g.shadowColor = 'transparent';

  return toTexture(c, 1, 1);
}

/** 江水（流动由 offset 动画实现） */
function waterTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#33697f');
  grad.addColorStop(0.5, '#2a5d74');
  grad.addColorStop(1, '#24536a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 512;
    const len = 40 + Math.random() * 160;
    const x = Math.random() * 512;
    g.strokeStyle = `rgba(${180 + Math.random() * 60},${220 + Math.random() * 30},230,${0.06 + Math.random() * 0.16})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y - 6 - Math.random() * 6, x + len, y);
    g.stroke();
  }
  // 波光
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(220,245,250,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 10, 1.5);
  }
  return toTexture(c, 8, 4);
}

/** 云朵精灵贴图 */
function cloudTexture() {
  const c = make(512);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  const blobs = [
    [180, 270, 120],
    [250, 230, 140],
    [330, 265, 115],
    [270, 300, 130],
    [150, 300, 85],
    [390, 300, 80],
    [240, 180, 80],
  ];
  for (const [x, y, r] of blobs) {
    const rg = g.createRadialGradient(x, y, r * 0.15, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.65)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = toTexture(c, 1, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 远景楼宇窗格 */
function cityTexture() {
  const c = make(256);
  const g = c.getContext('2d');
  g.fillStyle = '#26313d';
  g.fillRect(0, 0, 256, 256);
  for (let y = 8; y < 256; y += 22) {
    for (let x = 8; x < 256; x += 20) {
      g.fillStyle = Math.random() > 0.55 ? 'rgba(255,206,140,0.85)' : 'rgba(40,52,64,0.9)';
      g.fillRect(x, y, 10, 12);
    }
  }
  return toTexture(c, 1, 1);
}

export function createTextures() {
  return {
    wood: woodTexture(),
    floor: floorTexture(),
    stone: stoneTexture(),
    wall: wallTexture(),
    tile: tileTexture(),
    ceiling: ceilingTexture(),
    mural: muralTexture(),
    plaque: plaqueTexture(),
    water: waterTexture(),
    cloud: cloudTexture(),
    city: cityTexture(),
  };
}
