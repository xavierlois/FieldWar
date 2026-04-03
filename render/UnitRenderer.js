import * as THREE from 'three'
import { hexToWorld, effectiveHeight } from '../core/HexGrid.js'
import { getScene } from './SceneManager.js'
import { createUnitCanvas, createTeamCanvas, drawTeamCount } from '../assets/sprites.js'
import { GameState } from '../core/GameState.js'

const PLAYER_COLOR = '#2B7FD4'
const AI_COLOR     = '#E8820C'
const SPRITE_SIZE  = 1.4

let teamGroup
// teamId → { sprite, texture, canvas, ctx, baseCanvas, count }
const teamSprites = new Map()
const textureCache = new Map()  // `${type}_${faction}` → baseCanvas

export function initUnitRenderer() {
  teamGroup = new THREE.Group()
  getScene().add(teamGroup)
}

export async function preloadUnitTextures(units) {
  const needed = new Set()
  units.forEach(u => needed.add(`${u.type}_${u.faction}`))
  await Promise.all([...needed].map(async key => {
    if (textureCache.has(key)) return
    const [type, faction] = key.split('_')
    const color = faction === 'player' ? PLAYER_COLOR : AI_COLOR
    const canvas = await createUnitCanvas(type, color, 128)
    textureCache.set(key, canvas)
  }))
}

export async function renderTeams(teams) {
  teamGroup.clear()
  teamSprites.clear()
  for (const team of teams) {
    await _addTeamSprite(team)
  }
}

async function _addTeamSprite(team) {
  const aliveUnits = GameState.getAliveTeamUnits(team)
  if (aliveUnits.length === 0) return

  const color = team.faction === 'player' ? PLAYER_COLOR : AI_COLOR
  const { canvas, ctx, baseCanvas } = await createTeamCanvas(team.unitType, color, 128, aliveUnits.length)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1)

  const centroid = _teamCentroid(aliveUnits)
  const wp = hexToWorld(centroid.q, centroid.r)
  sprite.position.set(wp.x, _spriteY(centroid.q, centroid.r), wp.z)

  // userData lets InputManager detect taps
  sprite.userData = { teamId: team.id, unitId: aliveUnits[0].id, isUnit: true }

  teamGroup.add(sprite)
  teamSprites.set(team.id, { sprite, texture, canvas, ctx, baseCanvas, count: aliveUnits.length })
}

// Called each RAF frame — interpolates unit worldX/Z and moves team sprites to centroid
export function updateTeamPositions(units, dt) {
  const speed = 4.0 * GameState.resolutionSpeed

  // 1. Interpolate each unit's world position
  units.filter(u => u.alive).forEach(unit => {
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
  })

  // 2. Update each team sprite
  for (const [teamId, data] of teamSprites) {
    const team = GameState.getTeam(teamId)
    if (!team) { _removeTeamSprite(teamId); continue }

    const aliveUnits = GameState.getAliveTeamUnits(team)
    if (aliveUnits.length === 0) { _removeTeamSprite(teamId); continue }

    // Update count badge if a unit died
    if (aliveUnits.length !== data.count) {
      data.count = aliveUnits.length
      drawTeamCount(data.ctx, data.baseCanvas, 128, data.count)
      data.texture.needsUpdate = true
      // Update unitId in case first unit was the one that died
      data.sprite.userData.unitId = aliveUnits[0].id
    }

    // Move sprite to centroid of unit world positions
    const cx = aliveUnits.reduce((s, u) => s + u.worldX, 0) / aliveUnits.length
    const cz = aliveUnits.reduce((s, u) => s + u.worldZ, 0) / aliveUnits.length
    const firstUnit = aliveUnits[0]
    data.sprite.position.set(cx, _spriteY(firstUnit.q, firstUnit.r), cz)
  }
}

function _removeTeamSprite(teamId) {
  const data = teamSprites.get(teamId)
  if (!data) return
  teamGroup.remove(data.sprite)
  data.texture.dispose()
  data.sprite.material.dispose()
  teamSprites.delete(teamId)
}

function _teamCentroid(aliveUnits) {
  const q = Math.round(aliveUnits.reduce((s, u) => s + u.q, 0) / aliveUnits.length)
  const r = Math.round(aliveUnits.reduce((s, u) => s + u.r, 0) / aliveUnits.length)
  return { q, r }
}

function _spriteY(q, r) {
  const hex = GameState.grid.get(`${q},${r}`)
  const h = hex ? effectiveHeight(hex) : 1
  return h * 0.35 + 0.1 + SPRITE_SIZE * 0.6
}

export function setUnitTargetPosition(unit, q, r) {
  const pos = hexToWorld(q, r)
  unit.targetWorldX = pos.x
  unit.targetWorldZ = pos.z
  unit.q = q
  unit.r = r
}

// No-op: count updates happen automatically in updateTeamPositions
export function animateDeath(unitId) {}

export function flashTeam(teamId, color = 0xff4444, duration = 300) {
  const data = teamSprites.get(teamId)
  if (!data) return
  const original = data.sprite.material.color.clone()
  data.sprite.material.color.setHex(color)
  setTimeout(() => {
    if (data.sprite.material) data.sprite.material.color.copy(original)
  }, duration)
}

export function getTeamSpriteList() {
  return [...teamSprites.values()].map(d => d.sprite)
}
