/**
 * 关卡与数值配置
 * 坐标约定：+Y 向上，+Z 朝向来路（码头），原点附近为涡轮机竞技场。
 */

export const ARENA = {
  id: 'arena',
  label: 'Cirrus Reach 涡轮机',
  x: 0,
  z: -4,
  y: 4,
  r: 26,
  kind: 'arena',
}

/** 玩家出发的拾荒者码头 */
export const SPAWN = { x: 0, y: 0, z: 68 }

/** 涡轮机（相对世界坐标，底座落在竞技场甲板上） */
export const TURBINE = {
  x: ARENA.x,
  z: ARENA.z,
  baseY: ARENA.y,
  baseR: 6.4,
  height: 34,
}

/** 所有可站立平台。y 为平台上表面高度。 */
export const PLATFORMS = [
  { id: 'dock', label: '拾荒者码头', x: 0, z: 68, y: 0, r: 13, kind: 'dock' },
  { id: 'step1', label: '断桅岩', x: -10, z: 46, y: 1.2, r: 6, kind: 'step' },
  { id: 'step2', label: '信标石', x: 0, z: 32, y: 2.6, r: 7, kind: 'step' },
  ARENA,
  { id: 'west', label: '西侧残骸', x: -38, z: -12, y: 5, r: 7, kind: 'islet' },
  { id: 'east', label: '东侧残骸', x: 38, z: 4, y: 6.5, r: 8, kind: 'islet' },
  { id: 'north', label: '北侧风帆', x: 0, z: -44, y: 7, r: 9, kind: 'islet' },
]

/** 固定线圈代币的位置（漂浮在平台上空） */
export const STATIC_TOKENS = [
  { x: -12, z: 46, y: 3.2 },
  { x: -7.4, z: 43.4, y: 3.2 },
  { x: 0, z: 32, y: 4.4 },
  { x: -41, z: -14, y: 6.9 },
  { x: -35.4, z: -8.6, y: 6.9 },
  { x: -38, z: -11, y: 8.6 },
  { x: 40.4, z: 2.4, y: 8.4 },
  { x: 35.2, z: 7.2, y: 8.4 },
  { x: 39, z: 5.4, y: 10.1 },
  { x: 0, z: -47.4, y: 8.9 },
  { x: -4.6, z: -42, y: 8.9 },
  { x: 4.6, z: -42, y: 8.9 },
]

/** 三波守卫的构成 */
export const WAVES = [
  {
    name: '第一波 · 巡弋',
    sub: '风之守卫发现了你',
    enemies: [{ type: 'drone', count: 4 }],
  },
  {
    name: '第二波 · 合围',
    sub: '它们开始呼叫增援',
    enemies: [
      { type: 'drone', count: 5 },
      { type: 'lancer', count: 1 },
    ],
  },
  {
    name: '第三波 · 风帆守卫长',
    sub: '核心守卫亲自降临',
    enemies: [
      { type: 'drone', count: 6 },
      { type: 'lancer', count: 1 },
      { type: 'warden', count: 1 },
    ],
  },
]

/** 线圈代币改装档位 */
export const UPGRADE_TIERS = [
  { at: 8, id: 'damage', label: '弹道增幅 · 伤害 +15%' },
  { at: 16, id: 'mag', label: '扩容弹匣 · 弹匣 +12' },
  { at: 24, id: 'cooldown', label: '脉冲循环 · 技能冷却 -30%' },
  { at: 32, id: 'armor', label: '护甲强化 · 最大生命 +25' },
]

/** 章节文本 */
export const CHAPTERS = [
  {
    tag: 'CHAPTER I',
    name: '云海之上',
    objective: '抵达 Cirrus Reach 涡轮机',
    kicker: 'EXPEDITION 01',
    sub: '追踪失落的信号',
  },
  {
    tag: 'CHAPTER II',
    name: '失落的信号',
    objective: '抵御三波风之守卫',
    kicker: 'SIGNAL HOSTILE',
    sub: '守卫正在苏醒',
  },
  {
    tag: 'CHAPTER III',
    name: '风之核心',
    objective: '修复涡轮机',
    kicker: 'CORE REPAIR',
    sub: '让风重新转动',
  },
]

/** 音频总音量 */
export const AUDIO = {
  master: 0.55,
}

export const PLAYER = {
  maxHp: 100,
  walkSpeed: 9.4,
  aimSpeed: 5.2,
  jump: 10.4,
  gravity: 32,
  dashSpeed: 25,
  dashTime: 0.2,
  dashCd: 1.5,
  magSize: 30,
  fireRate: 0.105,
  reloadTime: 1.35,
  skillCd: 12,
  skillDamage: 70,
  skillRadius: 9.5,
  damage: 10,
}
