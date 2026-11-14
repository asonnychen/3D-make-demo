/* ============================================================
   我的世界 · 全局常量
   世界被切成 16×16 的区块，纵向 64 格
   ============================================================ */

export const CHUNK_SIZE = 16 // 区块边长（格）
export const WORLD_HEIGHT = 64 // 世界高度（格）
export const CHUNKS_X = 10 // 横向区块数
export const CHUNKS_Z = 10 // 纵向区块数

export const WORLD_X = CHUNK_SIZE * CHUNKS_X // 160 格
export const WORLD_Z = CHUNK_SIZE * CHUNKS_Z // 160 格

export const SEA_LEVEL = 22 // 海平面高度
export const SNOW_LINE = 44 // 雪线高度

export const REACH = 6 // 交互距离（格）

export const FOG_START = 82
export const FOG_END = 158

/* 玩家尺寸与手感 */
export const PLAYER = {
  width: 0.6,
  height: 1.8,
  eye: 1.62,
  walkSpeed: 4.6,
  sprintSpeed: 7.2,
  flySpeed: 12,
  jumpSpeed: 8.4,
  gravity: 26,
  maxFall: 52,
}
