/**
 * 全局尺寸配置
 * 单位：米。总高约 51 米，五层楼阁，两层石台基。
 */

// 各层可行走楼面标高（第一层楼面即第二层台基顶面）
export const FLOOR_Y = [3.0, 10.2, 17.4, 24.6, 31.8];

// 各层屋檐底标高（每层净高约 5.6 米）
export const EAVE_Y = FLOOR_Y.map((y) => y + 5.6);

// 各层墙体（柱网）半宽
export const INNER_HALF = [10.0, 8.6, 7.2, 5.8, 4.4];

// 外回廊宽度
export const CORRIDOR = 2.2;

// 各层外檐柱 / 栏杆半宽
export const OUTER_HALF = INNER_HALF.map((h) => h + CORRIDOR);

// 台基尺寸
export const TERRACE_1 = { size: 40, height: 1.6 };
export const TERRACE_2 = { size: 32, height: 1.4 };

// 建筑总高（宝顶尖端）
export const TOTAL_HEIGHT = 51.0;

/**
 * 「之」字形楼梯参数
 * 每层楼梯由两跑（A、B）加一个休息平台组成，位于上层大厅北侧。
 * @param {number} i 起始楼层索引 0..3
 */
export function stairSpec(i) {
  const laneW = 1.25; // 单跑宽度
  const gap = 0.25; // 两跑之间的缝隙
  // 各层楼梯的南北位置：错位布置，保证楼梯起步点避开本层楼板洞口
  const zA = [-7.7, -3.5, 0.7, -3.5][i];
  const zB = zA + laneW + gap; // B 跑（继续上行）z
  // 楼梯固定尺寸，保证在最小的一层（顶层）也能放下
  const xStart = -2.8; // 楼梯西端
  const xEnd = 2.8; // 楼梯东端（休息平台外沿）
  const xL0 = 1.8; // 休息平台内沿
  const rise = FLOOR_Y[i + 1] - FLOOR_Y[i];
  return {
    level: i,
    zA,
    zB,
    laneW,
    xStart,
    xEnd,
    xL0,
    y0: FLOOR_Y[i],
    y1: FLOOR_Y[i + 1],
    rise,
    halfRise: rise / 2,
  };
}

/**
 * 上层楼板为楼梯预留的洞口（矩形）
 * @param {number} level 楼层索引 1..4
 */
export function stairHole(level) {
  if (level <= 0) return null;
  const s = stairSpec(level - 1);
  return {
    x0: s.xStart,
    x1: s.xEnd,
    z0: s.zA - 0.45,
    z1: s.zB + s.laneW + 0.45,
  };
}

// 玩家出生点（广场南侧，面朝楼阁）
export const SPAWN = { x: 0, y: 0, z: 56 };
