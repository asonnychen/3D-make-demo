/* ============================================================
   森林湖畔村庄 · Lac des Fleurs
   共享配置：湖泊、村庄、房屋、道路与重要地点
   ============================================================ */

export const TAU = Math.PI * 2
export const deg = (d) => (d * Math.PI) / 180

export const WORLD = {
  lakeRadius: 28,
  waterLevel: 0,
  ringRadius: 31.8,
  terrainSize: 300,
  forestStart: 47,
  walkLimit: 112,
}

/* ------------------------------------------------------------
   配色：奶油灰泥、陶土屋顶、鼠尾草绿、玫瑰与薰衣草
   ------------------------------------------------------------ */

export const COLORS = {
  grass: 0x7f9a58,
  grassDark: 0x5d7a45,
  grassLight: 0x94aa66,
  sand: 0xc8b78d,
  mud: 0x6f7352,
  water: 0x7fb3ac,
  stone: 0xb9b2a2,
  stoneDark: 0x8f8b7c,
  wood: 0x8a6a48,
  woodDark: 0x5f4a33,
  iron: 0x39423c,
  glass: 0x2b3a3a,
  wall: 0xf1e5cf,
  wallWarm: 0xefe1c7,
  roof: 0xb4583f,
  roofAlt: 0xa94f3a,
  shutters: 0x8fa08a,
  flowerRose: 0xc05a7c,
  flowerPoppy: 0xd0473f,
  flowerDaisy: 0xf3ecd8,
  flowerLavender: 0x8d72b4,
  flowerYellow: 0xe7c54c,
}

/* ------------------------------------------------------------
   环湖房屋：angle 为方位角（0 = 正南，顺时针），radius 为到湖心距离
   ------------------------------------------------------------ */

export const HOUSES = [
  { id: 'rose', name: '玫瑰屋', angle: deg(34), radius: 37.5, w: 7.2, d: 6.2, h: 6.2, wall: 0xf2e6d0, roof: 0xb85a40, shutter: 0x9c6b73, dormers: 2 },
  { id: 'sage', name: '鼠尾草屋', angle: deg(74), radius: 39.0, w: 6.4, d: 6.8, h: 6.0, wall: 0xefe1c7, roof: 0xa94f3a, shutter: 0x7f9587, dormers: 1 },
  { id: 'blue', name: '蓝窗屋', angle: deg(116), radius: 37.0, w: 8.0, d: 6.0, h: 6.8, wall: 0xf4ead6, roof: 0xc06a4a, shutter: 0x7c94a1, dormers: 2 },
  { id: 'pink', name: '粉蔷薇屋', angle: deg(158), radius: 40.0, w: 6.8, d: 6.4, h: 5.6, wall: 0xeaddc4, roof: 0xac513c, shutter: 0xb9857f, dormers: 1 },
  { id: 'orchard', name: '果园屋', angle: deg(206), radius: 38.0, w: 7.4, d: 6.2, h: 6.4, wall: 0xf1e5cf, roof: 0xb4583f, shutter: 0x8a9a76, dormers: 2 },
  { id: 'violet', name: '紫藤屋', angle: deg(248), radius: 39.5, w: 6.6, d: 6.6, h: 6.0, wall: 0xeee0c6, roof: 0x9f4a38, shutter: 0x9a7d9b, dormers: 1 },
  { id: 'stone', name: '石阶屋', angle: deg(292), radius: 37.0, w: 7.0, d: 6.0, h: 6.2, wall: 0xf3e8d3, roof: 0xbd6246, shutter: 0x7f9587, dormers: 2 },
  { id: 'mill', name: '磨坊小屋', angle: deg(330), radius: 40.0, w: 6.2, d: 6.2, h: 5.4, wall: 0xeadfc8, roof: 0xa8513c, shutter: 0xb9857f, dormers: 0 },
]

/* ------------------------------------------------------------
   重要地点：地图标记、信息卡与步行落点
   ------------------------------------------------------------ */

export const LOCATIONS = [
  {
    id: 'square',
    name: '湖畔广场',
    en: 'Place du Lac',
    at: [0, 40],
    walk: [3.2, 34.2],
    look: [0, 2, 24],
    desc: '村子的心脏。石砌喷泉终年叮咚，花摊与市集绕着广场排开，圣米歇尔小教堂的钟声从南边传来。',
  },
  {
    id: 'dock',
    name: '西岸码头',
    en: 'Le Vieux Quai',
    at: [-25, 1.5],
    walk: [-25, 1.5],
    look: [0, 2, 6],
    desc: '木栈桥伸进浅水，一条小划艇拴在桩上。清晨的雾会从码头一路漫到湖心。',
  },
  {
    id: 'lavender',
    name: '薰衣草田',
    en: 'Champ de Lavande',
    at: [48, 2],
    walk: [46, 4],
    look: [0, 2, 8],
    desc: '东岸缓坡上的紫色花垄，蜂箱靠着矮石墙。风一过，整片田像水面一样起伏。',
  },
  {
    id: 'ruin',
    name: '废弃宅邸',
    en: 'La Maison Oubliée',
    at: [0, 0],
    walk: null,
    look: [0, 3, 0],
    desc: '湖心小岛上只剩一栋三层石宅。屋顶塌了一半，木梁伸向天空。没有桥 —— 它只属于划船的人。',
  },
  {
    id: 'pergola',
    name: '北岸凉亭',
    en: 'La Pergola',
    at: [0, -36],
    walk: [0, -34],
    look: [0, 2, -12],
    desc: '木格架爬满蔷薇，长椅正对湖心。这里是全村看落日与废弃宅邸倒影最好的位置。',
  },
  {
    id: 'trail',
    name: '林间步道',
    en: 'Sentier des Bois',
    at: [48, -46],
    walk: [44, -42],
    look: [0, 3, 10],
    desc: '一条被落叶覆盖的小径拐进密林。路牌指向更深的林子，也指向村里的面包房。',
  },
]

/* ------------------------------------------------------------
   道路：环湖路 + 各条支路
   ------------------------------------------------------------ */

export const ROAD_SPOKES = [
  { angle: deg(0), inner: 31.8, outer: 42, width: 3.4 }, // 广场
  { angle: deg(90), inner: 31.8, outer: 38.5, width: 2.6 }, // 薰衣草田
  { angle: deg(180), inner: 31.8, outer: 37.5, width: 2.6 }, // 凉亭
  { angle: deg(270), inner: 31.8, outer: 32.4, width: 2.8 }, // 码头
  { angle: deg(135), inner: 32.2, outer: 68, width: 2.2 }, // 林间步道
]

export const CHAPEL = { angle: deg(15), radius: 55, w: 6.4, d: 11.5, h: 6.2 }
export const SQUARE = { at: [0, 40], radius: 9 }
