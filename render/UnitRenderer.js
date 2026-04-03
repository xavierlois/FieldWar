import * as THREE from 'three'
import { hexToWorld, effectiveHeight, HEX_RADIUS } from '../core/HexGrid.js'
import { getScene } from './SceneManager.js'
import { createUnitCanvas } from '../assets/sprites.js'
import { GameState } from '../core/GameState.js'

const PLAYER_COLOR = '#2B7FD4'
const AI_COLOR = '#E8820C'
const SPRITE_SIZE = 1.2

let unitSprites = new Map()  // unitId → { sprite, pivot }
let unitGroup
const textureCache = new Map()  // `${type}_${faction}` → texture

export function initUnitRenderer() {
  unitGroup = new THREE.Group()
  getScene().add(unitGroup)
}

// Preload all textures for unit types in a scenario
export async function preloadUnitTextures(units) {
  const needed = new Set()
  units.forEach(u => needed.add(`${u.type}_${u.faction}`))

  await Promise.all([...needed].map(async key => {
    if (textureCache.has(key)) return
    const [type, faction] = key.split('_')
    const color = faction === 'player' ? PLAYER_COLOR : AI_COLOR
    const canvas = await createUnitCanvas(type, color, 128)
    const texture = new THREE.CanvasTexture(canvas)
    textureCache.set(key, texture)
  }))
}

export function renderUnits(units) {
  // Clear existing
  unitGroup.clear()
  unitSprites.clear()

  units.filter(u => u.alive).forEach(unit => {
    addUnitSprite(unit)
  })
}

function getUnitWorldY(unit) {
  const hex = GameState.grid.get(`${unit.q},${unit.r}`)
  const h = hex ? effectiveHeight(hex) : 1
  return h * 0.35 + 0.1 + SPRITE_SIZE * 0.6
}

function addUnitSprite(unit) {
  const texKey = `${unit.type}_${unit.faction}`
  const texture = textureCache.get(texKey)
  if (!texture) return

  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1)

  const pos = hexToWorld(unit.q, unit.r)
  sprite.position.set(pos.x, getUnitWorldY(unit), pos.z)
  sprite.userData = { unitId: unit.id, isUnit: true }

  unitGroup.add(sprite)
  unitSprites.set(unit.id, sprite)

  // Update stored world position for interpolation
  unit.worldX = pos.x
  unit.worldZ = pos.z
  unit.targetWorldX = pos.x
  unit.targetWorldZ = pos.z
}

export function updateUnitPositions(units, dt) {
  units.filter(u => u.alive).forEach(unit => {
    const sprite = unitSprites.get(unit.id)
    if (!sprite) return

    // Interpolate toward target position (smooth movement)
    const speed = 4.0 * GameState.resolutionSpeed  // world units per second
    const dx = unit.targetWorldX - unit.worldX
    const dz = unit.targetWorldZ - unit.worldZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > 0.01) {
      const move = Math.min(speed * dt, dist)
      unit.worldX += (dx / dist) * move
      unit.worldZ += (dz / dist) * move
    } else {
      unit.worldX = unit.targetWorldX
      unit.worldZ = unit.targetWorldZ
    }

    const hex = GameState.grid.get(`${unit.q},${unit.r}`)
    const h = hex ? effectiveHeight(hex) : 1
    const y = h * 0.35 + 0.1 + SPRITE_SIZE * 0.6
    sprite.position.set(unit.worldX, y, unit.worldZ)
  })
}

export function setUnitTargetPosition(unit, q, r) {
  const pos = hexToWorld(q, r)
  unit.targetWorldX = pos.x
  unit.targetWorldZ = pos.z
  unit.q = q
  unit.r = r
}

export function removeUnitSprite(unitId) {
  const sprite = unitSprites.get(unitId)
  if (sprite) {
    unitGroup.remove(sprite)
    sprite.material.dispose()
    unitSprites.delete(unitId)
  }
}

export function flashUnit(unitId, color = 0xff4444, duration = 300) {
  const sprite = unitSprites.get(unitId)
  if (!sprite) return
  const original = sprite.material.color.clone()
  sprite.material.color.setHex(color)
  setTimeout(() => {
    if (sprite.material) sprite.material.color.copy(original)
  }, duration)
}

// Animate death: fade out sprite
export function animateDeath(unitId) {
  const sprite = unitSprites.get(unitId)
  if (!sprite) return
  let opacity = 1
  const fade = setInterval(() => {
    opacity -= 0.08
    if (opacity <= 0) {
      removeUnitSprite(unitId)
      clearInterval(fade)
    } else {
      sprite.material.opacity = opacity
      sprite.material.transparent = true
    }
  }, 30)
}

export function getUnitSpriteList() {
  return [...unitSprites.values()]
}
