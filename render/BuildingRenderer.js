import * as THREE from 'three'
import { hexToWorld, HEX_RADIUS } from '../core/HexGrid.js'
import { createBuildingCanvas } from '../assets/sprites.js'

const BUILDING_SCALE = 1.4
const SPRITE_HEIGHT_OFFSET = 1.2

let scene = null
const buildingSprites = new Map() // key: "q,r" → THREE.Sprite

export function initBuildingRenderer(threeScene) {
  scene = threeScene
}

export async function renderBuildings(grid) {
  // Clear existing building sprites
  for (const sprite of buildingSprites.values()) {
    scene.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
  }
  buildingSprites.clear()

  for (const [key, hex] of grid) {
    if (!hex.building) continue
    await _spawnBuildingSprite(hex)
  }
}

async function _spawnBuildingSprite(hex) {
  const canvas = await createBuildingCanvas(hex.building.type, BUILDING_SCALE * 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true
  })

  const sprite = new THREE.Sprite(material)
  const world = hexToWorld(hex.q, hex.r)
  const tileTopY = _tileTopY(hex)

  sprite.position.set(world.x, tileTopY + SPRITE_HEIGHT_OFFSET, world.z)
  sprite.scale.set(BUILDING_SCALE, BUILDING_SCALE, 1)

  scene.add(sprite)
  buildingSprites.set(`${hex.q},${hex.r}`, sprite)
}

function _tileTopY(hex) {
  // Must match HexRenderer tile heights: 0→0.1, 1→0.3, 2→0.6
  const heightMap = { 0: 0.1, 1: 0.3, 2: 0.6 }
  const tileH = heightMap[hex.height] ?? 0.3
  return tileH / 2
}

export function removeBuildingAt(q, r) {
  const key = `${q},${r}`
  const sprite = buildingSprites.get(key)
  if (sprite) {
    scene.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
    buildingSprites.delete(key)
  }
}

export function disposeBuildingRenderer() {
  for (const sprite of buildingSprites.values()) {
    scene.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
  }
  buildingSprites.clear()
}
