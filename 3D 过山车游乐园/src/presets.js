const point = (x, y, z) => ({ x, y, z })
const deg = (value) => (value * Math.PI) / 180

/**
 * 轨道几何遵循能量守恒原则，保证列车能完整跑完一圈：
 * 1. 链条提升段终点即全局最高点，俯冲把势能换成速度；
 * 2. 竖直回环由「底 → 右 → 顶 → 左 → 底」五点定义，
 *    构建曲线时会按真实圆弧加密采样，回环顶点比提升顶低 12m 以上，
 *    列车过顶仍有富余速度；
 * 3. 螺旋段位于中低高度平缓爬升，避免连续净爬升超过可用动能；
 * 4. 驼峰段小幅起伏，末段自然下落回到站台高度。
 *
 * loopArcs 记录每个回环的圆心、半径与起止控制点索引，
 * 供 TrackSystem 用圆弧采样还原真实回环形状。
 */
const classicPoints = [
  point(-38, 3.2, 30), point(-38, 3.2, 15), point(-37, 5, 2), point(-35, 12, -12),
  point(-25, 24, -23), point(-6, 36, -27), point(12, 34, -27), point(27, 20, -23),
  point(16, 3.2, -5),
  point(28, 4, -20), point(36, 12, -20), point(28, 20, -20), point(20, 12, -20),
  point(28, 4, -20), point(38, 5, -20),
  point(26, 8, -4), point(18, 12, 12), point(4, 16, 24), point(-10, 18, 22), point(-20, 20, 8),
  point(-20, 22, -6), point(-10, 24, -12), point(4, 26, -12), point(18, 28, -4), point(26, 30, 12),
  point(14, 26, 24), point(-2, 20, 26), point(-18, 15, 24), point(-32, 10, 26), point(-40, 4, 30),
]

const classicLoopArcs = [{ start: 9, end: 13, centerX: 28, baseY: 4, radius: 8 }]

const classicBanks = [
  0, 0, deg(-3), deg(-8), deg(-12), deg(-4), deg(8), deg(18), deg(10),
  0, 0, 0, 0, 0,
  deg(4),
  deg(14), deg(28), deg(38), deg(46), deg(52), deg(48), deg(38), deg(28), deg(18), deg(8),
  deg(-8), deg(-12), deg(-8), deg(-4), 0,
]

const canyonPoints = [
  point(-42, 3.5, 34), point(-42, 3.5, 18), point(-41, 6, 3), point(-38, 16, -11),
  point(-30, 28, -22), point(-14, 40, -28), point(4, 37, -29), point(20, 20, -25),
  point(18, 3.5, -10),
  point(31, 4, -23), point(40, 13, -23), point(31, 22, -23), point(22, 13, -23),
  point(31, 4, -23), point(41, 5, -23),
  point(36, 8, -12), point(31, 14, 8), point(20, 18, 22), point(4, 22, 29), point(-12, 25, 28),
  point(-25, 28, 18), point(-29, 30, 2), point(-22, 31, -13), point(-5, 32, -20), point(13, 32, -13),
  point(24, 29, 4), point(23, 25, 19), point(10, 20, 28), point(-8, 15, 31), point(-26, 10, 31),
  point(-40, 6, 33), point(-42, 4, 34),
]

const canyonBanks = [
  0, 0, deg(-4), deg(-14), deg(-20), deg(-8), deg(14), deg(24), deg(12),
  0, 0, 0, 0, 0,
  deg(6),
  deg(18), deg(35), deg(48), deg(58), deg(65), deg(60), deg(48), deg(36), deg(24), deg(12),
  deg(-4), deg(-14), deg(-18), deg(-12), deg(-6), 0,
]

const canyonLoopArcs = [{ start: 9, end: 13, centerX: 31, baseY: 4, radius: 9 }]

const devilLoopArcs = [
  { start: 8, end: 12, centerX: 26, baseY: 4, radius: 8 },
  { start: 15, end: 19, centerX: 10, baseY: 4, radius: 8 },
]

const devilPoints = [
  point(-40, 3.2, 31), point(-40, 3.2, 16), point(-39, 6, 1), point(-36, 15, -13),
  point(-25, 26, -24), point(-6, 34, -27), point(14, 31, -25), point(27, 18, -21),
  point(26, 4, -18), point(34, 12, -18), point(26, 20, -18), point(18, 12, -18),
  point(26, 4, -18), point(36, 5, -18),
  point(25, 7, -6),
  point(10, 4, 8), point(18, 12, 8), point(10, 20, 8), point(2, 12, 8), point(10, 4, 8),
  point(0, 6, 8),
  point(-12, 9, 3), point(-22, 13, 14), point(-24, 17, -6), point(-14, 21, -18), point(2, 24, -20),
  point(17, 22, -13), point(19, 17, -1), point(10, 13, 13), point(-5, 9, 22), point(-22, 6, 27),
  point(-36, 4, 31),
]

const devilBanks = [
  0, 0, deg(-5), deg(-10), deg(-16), deg(-5), deg(12), deg(18),
  0, 0, 0, 0, 0,
  deg(5),
  deg(6),
  0, 0, 0, 0, 0,
  deg(5),
  deg(8), deg(18), deg(30), deg(38), deg(30), deg(22), deg(12), deg(4),
  deg(-5), deg(-8), deg(-5), 0,
]

function makeTags(count, ranges) {
  const tags = Array.from({ length: count }, () => 'cruise')
  for (const [start, end, tag] of ranges) {
    for (let index = start; index <= end; index += 1) tags[index] = tag
  }
  return tags
}

export const TRACK_PRESETS = {
  classic: {
    id: 'classic',
    name: '经典大回环',
    subtitle: '链条爬升 · 垂直回环 · 湖畔俯冲',
    points: classicPoints,
    banks: classicBanks,
    tags: makeTags(classicPoints.length, [[2, 4, 'chain'], [8, 9, 'water'], [9, 13, 'loop'], [15, 24, 'helix'], [25, 29, 'humps'], [29, 30, 'brake']]),
    // 区间由控制点索引描述，构建轨道时换算成归一化弧长 u
    chainEndIndex: 5,
    brakeStartIndex: 26,
    loopIndexRanges: [[9, 13]],
    loopArcs: classicLoopArcs,
    accent: 0xff6b35,
  },
  canyon: {
    id: 'canyon',
    name: '峡谷螺旋王',
    subtitle: '高 banking 螺旋 · 高空双落差',
    points: canyonPoints,
    banks: canyonBanks,
    tags: makeTags(canyonPoints.length, [[2, 4, 'chain'], [8, 9, 'water'], [9, 13, 'loop'], [15, 24, 'helix'], [25, 30, 'humps'], [30, 31, 'brake']]),
    chainEndIndex: 5,
    brakeStartIndex: 27,
    loopIndexRanges: [[9, 13]],
    loopArcs: canyonLoopArcs,
    accent: 0xffb23f,
  },
  devil: {
    id: 'devil',
    name: '魔鬼双环',
    subtitle: '连续双回环 · 紧凑甩尾弯',
    points: devilPoints,
    banks: devilBanks,
    tags: makeTags(devilPoints.length, [[2, 4, 'chain'], [8, 12, 'loop'], [15, 19, 'loop'], [21, 28, 'helix'], [29, 31, 'humps'], [31, 32, 'brake']]),
    chainEndIndex: 5,
    brakeStartIndex: 27,
    loopIndexRanges: [[8, 12], [15, 19]],
    loopArcs: devilLoopArcs,
    accent: 0xf04464,
  },
}

export function clonePreset(preset) {
  return {
    ...preset,
    points: preset.points.map((item) => ({ ...item })),
    banks: [...preset.banks],
    tags: [...preset.tags],
    loopIndexRanges: preset.loopIndexRanges.map((range) => [...range]),
    loopArcs: (preset.loopArcs ?? []).map((arc) => ({ ...arc })),
  }
}
