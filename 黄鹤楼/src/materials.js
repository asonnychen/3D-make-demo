import * as THREE from 'three';
import { createTextures } from './textures.js';

/**
 * 统一创建材质，并记录所有纹理以便销毁。
 * 同一张贴图需要不同 repeat 时使用 clone，避免互相覆盖。
 */
export function createMaterials() {
  const tex = createTextures();
  const extraTextures = [];

  const clone = (t, rx, ry) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    extraTextures.push(c);
    return c;
  };

  const stoneTerrace = clone(tex.stone, 6, 6);
  const stonePlaza = clone(tex.stone, 12, 12);
  const stoneDeck = clone(tex.stone, 4, 4);
  const stoneStep = clone(tex.stone, 2, 2);
  const wallTex = clone(tex.wall, 2, 1);
  const floorTex = clone(tex.floor, 5, 5);

  const M = {
    roof: new THREE.MeshStandardMaterial({
      map: tex.tile,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.22,
      side: THREE.DoubleSide,
      emissive: 0x2a1c05,
      emissiveIntensity: 0.25,
    }),
    roofUnder: new THREE.MeshStandardMaterial({
      color: 0x8d4a33,
      emissive: 0x32150b,
      emissiveIntensity: 0.9,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    eave: new THREE.MeshStandardMaterial({
      color: 0xd7a52b,
      roughness: 0.45,
      metalness: 0.25,
      emissive: 0x2a1c04,
      emissiveIntensity: 0.3,
    }),
    red: new THREE.MeshStandardMaterial({
      map: tex.wood,
      roughness: 0.55,
      metalness: 0.05,
    }),
    wall: new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.9,
    }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTerrace, roughness: 0.95 }),
    stoneDeck: new THREE.MeshStandardMaterial({ map: stoneDeck, roughness: 0.9 }),
    stoneStep: new THREE.MeshStandardMaterial({ map: stoneStep, roughness: 0.95 }),
    plaza: new THREE.MeshStandardMaterial({ map: stonePlaza, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ map: tex.ceiling, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xe8bf55,
      roughness: 0.22,
      metalness: 0.95,
      emissive: 0x6b4a10,
      emissiveIntensity: 0.15,
    }),
    bronze: new THREE.MeshStandardMaterial({
      color: 0x7c5a32,
      roughness: 0.45,
      metalness: 0.8,
    }),
    porcelain: new THREE.MeshStandardMaterial({
      color: 0xeef3f4,
      roughness: 0.18,
      metalness: 0.05,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x24343c,
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.55,
    }),
    mural: new THREE.MeshStandardMaterial({
      map: tex.mural,
      emissiveMap: tex.mural,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
      roughness: 0.85,
    }),
    plaque: new THREE.MeshStandardMaterial({
      map: tex.plaque,
      emissiveMap: tex.plaque,
      emissive: 0xffffff,
      emissiveIntensity: 0.16,
      roughness: 0.6,
    }),
    lantern: new THREE.MeshStandardMaterial({
      color: 0xff7040,
      emissive: 0xff6a30,
      emissiveIntensity: 0.15,
      roughness: 0.5,
    }),
    water: new THREE.MeshStandardMaterial({
      map: tex.water,
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.45,
      emissive: 0x0a2433,
      emissiveIntensity: 0.25,
    }),
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    }),
    tree: new THREE.MeshStandardMaterial({ color: 0x2f5a36, roughness: 1, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }),
    city: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
    }),
    cityWindows: new THREE.MeshStandardMaterial({
      color: 0x33251a,
      emissive: 0xffcf8a,
      emissiveIntensity: 0,
      roughness: 0.8,
    }),
    cloud: new THREE.SpriteMaterial({
      map: tex.cloud,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      fog: false,
    }),
  };

  const allTextures = [...Object.values(tex), ...extraTextures];

  return {
    M,
    textures: allTextures,
    dispose() {
      for (const m of Object.values(M)) m.dispose();
      for (const t of allTextures) t.dispose();
    },
  };
}
