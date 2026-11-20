// 台球桌与球的共享物理尺寸（单位：米）
export const BALL_R = 0.028575 // 标准 57.15mm 直径
// 英式 12 尺大台：台面 3.57m x 1.78m
export const HALF_L = 1.785
export const HALF_W = 0.89
export const HEAD_SPOT = { x: -HALF_L / 2, z: 0 }
export const FOOT_SPOT = { x: HALF_L / 2, z: 0 }

// 袋口中心（向库边靠拢，袋口收小）
export const POCKETS = [
  { x: -(HALF_L - 0.012), z: -(HALF_W - 0.012), r: 0.046, mouth: 0.046 },
  { x: -(HALF_L - 0.012), z: HALF_W - 0.012, r: 0.046, mouth: 0.046 },
  { x: HALF_L - 0.012, z: -(HALF_W - 0.012), r: 0.046, mouth: 0.046 },
  { x: HALF_L - 0.012, z: HALF_W - 0.012, r: 0.046, mouth: 0.046 },
  { x: 0, z: -(HALF_W - 0.006), r: 0.043, mouth: 0.043 },
  { x: 0, z: HALF_W - 0.006, r: 0.043, mouth: 0.043 },
]

// 库边碰撞段的起止（留出袋口）
export const RAIL_GAP_CORNER = 0.1
export const RAIL_GAP_SIDE = 0.085

export const BALL_COLORS = {
  1: 0xf2c200,
  2: 0x1e4e9c,
  3: 0xc22f2a,
  4: 0x6a2f8c,
  5: 0xe07a1c,
  6: 0x1b7a44,
  7: 0x8a2a23,
  8: 0x141414,
  9: 0xf2c200,
  10: 0x1e4e9c,
  11: 0xc22f2a,
  12: 0x6a2f8c,
  13: 0xe07a1c,
  14: 0x1b7a44,
  15: 0x8a2a23,
}

// 标准三角摆球顺序（顶点朝开球线）
export const RACK_ORDER = [1, 9, 2, 10, 8, 3, 11, 7, 14, 4, 5, 13, 15, 6, 12]

export const CUE_NUMBER = 0




