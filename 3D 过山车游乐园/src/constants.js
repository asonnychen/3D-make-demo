export const GRAVITY = 9.81
export const LAKE_CENTER = { x: 12, z: -4, radius: 16 }
export const WORLD_SIZE = 190

export function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * 解析地形高度函数。轨道支撑柱与地形网格共用此函数，
 * 保证立柱落点与起伏草地完全一致。
 */
export function terrainHeight(x, z) {
  const broad = Math.sin(x * 0.055) * 1.65 + Math.cos(z * 0.047) * 1.45
  const detail = Math.sin((x + z) * 0.11) * 0.38 + Math.cos((x - z) * 0.09) * 0.32
  const distanceToLake = Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z)
  const lakeBlend = smoothstep(LAKE_CENTER.radius, LAKE_CENTER.radius + 8, distanceToLake)
  return -3.4 + (broad + detail + 3.4) * lakeBlend
}

export function isInsideLake(x, z, margin = 0) {
  return Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z) < LAKE_CENTER.radius + margin
}
