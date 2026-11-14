/* ============================================================
   区块渲染器：材质、网格构建、按帧分摊的重建队列
   ============================================================ */

import {
  Color,
  Entity,
  Mesh,
  MeshInstance,
  StandardMaterial,
  Texture,
  PIXELFORMAT_SRGBA8,
  FILTER_NEAREST,
  FILTER_NEAREST_MIPMAP_LINEAR,
  ADDRESS_CLAMP_TO_EDGE,
  BLEND_NORMAL,
} from 'playcanvas'
import { CHUNK_SIZE } from './config.js'
import { buildChunkGeometry } from './mesher.js'

export class ChunkRenderer {
  constructor(app, world, atlas) {
    this.app = app
    this.device = app.graphicsDevice
    this.world = world
    this.atlas = atlas
    this.queue = []

    /* 不透明地形材质 */
    const opaque = new StandardMaterial()
    opaque.diffuse = new Color(1, 1, 1)
    opaque.ambient = new Color(1, 1, 1)
    opaque.diffuseVertexColor = true
    opaque.diffuseVertexColorChannel = 'rgb'
    opaque.specular = new Color(0.02, 0.02, 0.02)
    opaque.gloss = 0.1
    opaque.diffuseMap = this.createAtlasTexture()
    opaque.useFog = true
    opaque.update()

    /* 半透明材质：玻璃与水共用一张图集的 alpha 通道 */
    const alpha = new StandardMaterial()
    alpha.diffuse = new Color(1, 1, 1)
    alpha.ambient = new Color(1, 1, 1)
    alpha.diffuseVertexColor = true
    alpha.diffuseVertexColorChannel = 'rgb'
    alpha.specular = new Color(0.08, 0.08, 0.08)
    alpha.gloss = 0.4
    alpha.diffuseMap = opaque.diffuseMap
    alpha.opacityMap = opaque.diffuseMap
    alpha.opacityMapChannel = 'a'
    alpha.blendType = BLEND_NORMAL
    alpha.depthWrite = false
    alpha.useFog = true
    alpha.update()

    this.opaqueMaterial = opaque
    this.alphaMaterial = alpha
  }

  createAtlasTexture() {
    const texture = new Texture(this.device, {
      width: this.atlas.canvas.width,
      height: this.atlas.canvas.height,
      format: PIXELFORMAT_SRGBA8,
      mipmaps: true,
      minFilter: FILTER_NEAREST_MIPMAP_LINEAR,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
    })
    texture.setSource(this.atlas.canvas)
    return texture
  }

  /* ---------------------------------------------------------- 区块实体 */

  attachEntities() {
    for (const chunk of this.world.chunks) {
      if (!chunk) continue
      const entity = new Entity(`chunk-${chunk.cx}-${chunk.cz}`)
      entity.setPosition(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE)
      entity.addComponent('render', { meshInstances: [] })
      entity.render.castShadows = false
      entity.render.receiveShadows = false
      this.app.root.addChild(entity)
      chunk.entity = entity
      chunk.meshes = []
    }
  }

  detachEntities() {
    for (const chunk of this.world.chunks) {
      if (!chunk) continue
      if (chunk.entity) {
        chunk.entity.destroy()
        chunk.entity = null
      }
      chunk.meshes = []
    }
  }

  /* ---------------------------------------------------------- 重建 */

  toMesh(buffer) {
    const mesh = new Mesh(this.device)
    mesh.setPositions(new Float32Array(buffer.positions))
    mesh.setNormals(new Float32Array(buffer.normals))
    mesh.setUvs(0, new Float32Array(buffer.uvs))
    mesh.setColors(new Float32Array(buffer.colors))
    mesh.setIndices(new Uint32Array(buffer.indices))
    mesh.update()
    return mesh
  }

  rebuild(chunk) {
    if (!chunk || !chunk.entity) return
    const geometry = buildChunkGeometry(this.world, chunk, this.atlas.tileUV)

    // 释放旧网格
    for (const mesh of chunk.meshes) mesh.destroy()
    chunk.meshes = []

    const instances = []
    if (geometry.opaque) {
      const mesh = this.toMesh(geometry.opaque)
      chunk.meshes.push(mesh)
      const instance = new MeshInstance(mesh, this.opaqueMaterial)
      instance.castShadows = false
      instances.push(instance)
    }
    if (geometry.alpha) {
      const mesh = this.toMesh(geometry.alpha)
      chunk.meshes.push(mesh)
      const instance = new MeshInstance(mesh, this.alphaMaterial)
      instance.castShadows = false
      instances.push(instance)
    }

    chunk.entity.render.meshInstances = instances
    chunk.dirty = false
  }

  /** 收集需要重建的区块 */
  collectDirty() {
    const list = []
    for (const chunk of this.world.chunks) {
      if (chunk && chunk.dirty) list.push(chunk)
    }
    return list
  }

  /** 每帧最多重建 budget 个区块，避免卡顿 */
  process(budget = 1) {
    let done = 0
    for (const chunk of this.world.chunks) {
      if (done >= budget) break
      if (chunk && chunk.dirty) {
        this.rebuild(chunk)
        done++
      }
    }
    return done
  }

  /** 一次构建完（加载阶段用） */
  buildAll(onProgress) {
    const chunks = this.world.chunks.filter(Boolean)
    for (let i = 0; i < chunks.length; i++) {
      this.rebuild(chunks[i])
      onProgress?.((i + 1) / chunks.length)
    }
  }

  dispose() {
    this.detachEntities()
    this.opaqueMaterial.diffuseMap?.destroy()
    this.opaqueMaterial.destroy()
    this.alphaMaterial.destroy()
  }
}
