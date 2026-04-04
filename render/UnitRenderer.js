import * as THREE from 'three'
import { hexToWorld, effectiveHeight } from '../core/HexGrid.js'
import { getScene } from './SceneManager.js'
import { createUnitCanvas, createTeamCanvas, drawTeamCount } from '../assets/sprites.js'
import { GameState } from '../core/GameState.js'

const PLAYER_COLOR = '#2B7FD4'
const AI_COLOR = '#E8820C'
const SPRITE_SIZE = 0.7

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

  // Initialize team's world position from its hex position
  const wp = hexToWorld(team.q, team.r)
  team.worldX = wp.x; team.worldZ = wp.z
  team.targetWorldX = wp.x; team.targetWorldZ = wp.z

  const color = team.faction === 'player' ? PLAYER_COLOR : AI_COLOR
  const { canvas, ctx, baseCanvas } = await createTeamCanvas(team.unitType, color, 128, aliveUnits.length)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1)

  sprite.position.set(team.worldX, _spriteY(team.q, team.r), team.worldZ)

  // userData lets InputManager detect taps
  sprite.userData = { teamId: team.id, unitId: aliveUnits[0].id, isUnit: true }

  teamGroup.add(sprite)
  teamSprites.set(team.id, { sprite, texture, canvas, ctx, baseCanvas, count: aliveUnits.length, command: team.command })
}

// Called each RAF frame — interpolates team worldX/Z and moves team sprites
export function updateTeamPositions(teams, dt) {
  const speed = 4.0 * GameState.resolutionSpeed

  // 1. Interpolate each team's world position
  teams.filter(t => t.isAlive).forEach(team => {
    const dx = team.targetWorldX - team.worldX
    const dz = team.targetWorldZ - team.worldZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 0.01) {
      const move = Math.min(speed * dt, dist)
      team.worldX += (dx / dist) * move
      team.worldZ += (dz / dist) * move
    } else {
      team.worldX = team.targetWorldX
      team.worldZ = team.targetWorldZ
    }
  })

  // 2. Update each team sprite
  for (const [teamId, data] of teamSprites) {
    const team = GameState.getTeam(teamId)
    if (!team) { _removeTeamSprite(teamId); continue }

    const aliveUnits = GameState.getAliveTeamUnits(team)
    if (aliveUnits.length === 0) { _removeTeamSprite(teamId); continue }

    // Update count/command badge if changed
    if (aliveUnits.length !== data.count || team.command !== data.command) {
      data.count = aliveUnits.length
      data.command = team.command
      drawTeamCount(data.ctx, data.baseCanvas, 128, data.count)
      if (data.command) {
        _drawActionIcon(data.ctx, 128)
      }
      data.texture.needsUpdate = true
      // Update unitId in case first unit was the one that died
      data.sprite.userData.unitId = aliveUnits[0].id
    }

    // Move sprite to the team's world position
    data.sprite.position.set(
      team.worldX,
      _spriteY(team.q, team.r),
      team.worldZ
    )
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
  return h * 0.25 + 0.08 + SPRITE_SIZE * 0.6
}

export function setTeamTargetPosition(team, q, r) {
  const pos = hexToWorld(q, r)
  team.targetWorldX = pos.x
  team.targetWorldZ = pos.z
  team.q = q
  team.r = r
}

// No-op: count updates happen automatically in updateTeamPositions
export function animateDeath(unitId) { }

function _drawActionIcon(ctx, size) {
  const cx = size * 0.82
  const cy = size * 0.18
  const r = size * 0.16
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#10B981' // Action green
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.02
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.22}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✓', cx, cy + size * 0.02)
}

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

export function getTeamWorldPosition(teamId) {
  const data = teamSprites.get(teamId)
  if (!data) return null
  const p = data.sprite.position
  return { x: p.x, y: p.y, z: p.z }
}
