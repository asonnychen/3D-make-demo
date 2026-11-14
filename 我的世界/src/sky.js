/* ============================================================
   天空：渐变天球 + 缓慢飘动的云层
   ============================================================ */

import {
  CULLFACE_NONE,
  Color,
  Entity,
  Mesh,
  MeshInstance,
  StandardMaterial,
  Texture,
  PIXELFORMAT_SRGBA8,
  PIXELFORMAT_RGBA8,
  ADDRESS_REPEAT,
  ADDRESS_CLAMP_TO_EDGE,
  FILTER_LINEAR,
  FILTER_LINEAR_MIPMAP_LINEAR,
  BLEND_NORMAL,
  Vec2,
} from 'playcanvas'
import { buildSkySphereGeometry, buildQuadGeometry } from './mesher.js'
import { createCloudTexture } from './textures.js'

function bufferToMesh(device, buf) {
  const mesh = new Mesh(device)
  mesh.setPositions(buf.positions)
  mesh.setNormals(buf.normals)
  mesh.setUvs(0, buf.uvs)
  mesh.setColors(buf.colors)
  mesh.setIndices(new Uint32Array(buf.indices))
  mesh.update()
  return mesh
}

/** 竖直渐变贴图：底部 → 地平线 → 天顶 */
function createGradientTexture(device) {
  const height = 256
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, height, 0, 0)
  grad.addColorStop(0, '#3f4a45') // 天底（地面方向）
  grad.addColorStop(0.42, '#a6cbe6')
  grad.addColorStop(0.52, '#dcecf8') // 地平线附近发亮
  grad.addColorStop(0.72, '#7db4e4')
  grad.addColorStop(1, '#2f6cbe') // 天顶
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 4, height)

  const texture = new Texture(device, {
    width: 4,
    height,
    format: PIXELFORMAT_SRGBA8,
    mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_CLAMP_TO_EDGE,
    addressV: ADDRESS_CLAMP_TO_EDGE,
  })
  texture.setSource(canvas)
  return texture
}

export function createSky(app) {
  const device = app.graphicsDevice

  /* ------------------------------------------------ 天球 */
  const sphere = bufferToMesh(device, buildSkySphereGeometry(720, 32, 24))
  const gradient = createGradientTexture(device)

  const skyMaterial = new StandardMaterial()
  skyMaterial.useLighting = false
  skyMaterial.useFog = false
  skyMaterial.cull = CULLFACE_NONE
  skyMaterial.diffuse = new Color(1, 1, 1)
  // useLighting=false 时引擎仍会乘上环境光，这里按环境光逐通道补回来，
  // 让天空的颜色和渐变贴图完全一致，海平线才不会出现色差接缝
  skyMaterial.ambient = new Color(2.22, 2.13, 2.0)
  skyMaterial.diffuseMap = gradient
  skyMaterial.depthWrite = false
  skyMaterial.update()

  const sky = new Entity('sky')
  const skyInstance = new MeshInstance(sphere, skyMaterial)
  skyInstance.castShadows = false
  sky.addComponent('render', { meshInstances: [skyInstance] })
  app.root.addChild(sky)

  /* ------------------------------------------------ 云层 */
  const cloudCanvas = createCloudTexture(256)
  const cloudTexture = new Texture(device, {
    width: 256,
    height: 256,
    format: PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: FILTER_LINEAR,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT,
  })
  cloudTexture.setSource(cloudCanvas)

  const cloudMaterial = new StandardMaterial()
  cloudMaterial.useLighting = false
  cloudMaterial.useFog = false
  cloudMaterial.cull = CULLFACE_NONE
  cloudMaterial.diffuse = new Color(1, 1, 1)
  cloudMaterial.emissive = new Color(1, 1, 1)
  cloudMaterial.ambient = new Color(2.1, 2.1, 2.1)
  cloudMaterial.diffuseMap = cloudTexture
  cloudMaterial.opacityMap = cloudTexture
  cloudMaterial.opacityMapChannel = 'a'
  cloudMaterial.opacity = 0.92
  cloudMaterial.blendType = BLEND_NORMAL
  cloudMaterial.depthWrite = false
  cloudMaterial.diffuseMapTiling = new Vec2(9, 9)
  cloudMaterial.update()

  const clouds = new Entity('clouds')
  const cloudMesh = bufferToMesh(device, buildQuadGeometry())
  const cloudInstance = new MeshInstance(cloudMesh, cloudMaterial)
  cloudInstance.castShadows = false
  clouds.addComponent('render', { meshInstances: [cloudInstance] })
  clouds.setLocalScale(1500, 1, 1500)
  clouds.setPosition(0, 96, 0)
  app.root.addChild(clouds)

  let offset = 0

  return {
    sky,
    clouds,
    update(dt, cameraPosition) {
      sky.setPosition(cameraPosition)
      clouds.setPosition(cameraPosition.x, 96, cameraPosition.z)

      offset += dt * 0.0035
      cloudMaterial.diffuseMapOffset.set(offset, offset * 0.35)
      cloudMaterial.update()
    },
  }
}
