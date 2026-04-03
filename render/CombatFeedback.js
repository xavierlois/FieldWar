import * as THREE from 'three'
import { EventBus } from '../core/EventBus.js'
import { GameState } from '../core/GameState.js'
import { getScene, getCamera, getRenderer } from './SceneManager.js'
import { getTeamWorldPosition } from './UnitRenderer.js'
import { getUnitType } from '../units/UnitTypes.js'

const LINE_DURATION  = 0.35  // seconds
const NUM_DURATION   = 0.75  // seconds
const NUM_RISE_PX    = 36    // pixels to float upward

let feedbackGroup
let overlayEl

const activeLines   = []
const activeNumbers = []

// Rate-limit: suppress duplicate lines for same pair within 0.25s
const recentLinePairs = new Map()  // key → timestamp

export function initCombatFeedback() {
  feedbackGroup = new THREE.Group()
  feedbackGroup.renderOrder = 10
  getScene().add(feedbackGroup)

  overlayEl = document.createElement('div')
  overlayEl.id = 'combat-feedback'
  overlayEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:5;'
  document.getElementById('game-container').appendChild(overlayEl)

  EventBus.on('unit-attacked', onUnitAttacked)
}

function onUnitAttacked({ attackerId, defenderId, damage, killed }) {
  const attacker = GameState.units.get(attackerId)
  const defender = GameState.units.get(defenderId)
  if (!attacker || !defender) return

  const aTeam = GameState.getTeamForUnit(attackerId)
  const dTeam = GameState.getTeamForUnit(defenderId)
  if (!aTeam || !dTeam) return

  const aPos = getTeamWorldPosition(aTeam.id)
  const dPos = getTeamWorldPosition(dTeam.id)
  if (!aPos || !dPos) return

  // Attack line (rate-limited per team pair)
  const pairKey = `${aTeam.id}→${dTeam.id}`
  const now = performance.now()
  if (!recentLinePairs.has(pairKey) || now - recentLinePairs.get(pairKey) > 250) {
    recentLinePairs.set(pairKey, now)
    _spawnLine(aPos, dPos, attacker.faction)
  }

  // Damage number (always shown)
  _spawnNumber(dPos, damage, killed, attacker)
}

function _spawnLine(from, to, faction) {
  const color = faction === 'player' ? 0x2B7FD4 : 0xE8820C
  const pts = [
    new THREE.Vector3(from.x, from.y + 0.2, from.z),
    new THREE.Vector3(to.x,   to.y   + 0.2, to.z)
  ]
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1.0, depthTest: false })
  const line = new THREE.Line(geo, mat)
  line.renderOrder = 10
  feedbackGroup.add(line)
  activeLines.push({ line, elapsed: 0 })
}

function _spawnNumber(worldPos, damage, killed, attacker) {
  const canvas  = getRenderer().domElement
  const camera  = getCamera()
  const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z)
  v.project(camera)

  const rect = canvas.getBoundingClientRect()
  const x = (v.x  *  0.5 + 0.5) * rect.width
  const y = (1 - (v.y * 0.5 + 0.5)) * rect.height

  const typeDef = getUnitType(attacker.type)
  let text, color
  if (damage === 0) {
    text  = `${typeDef.icon} BLOCKED`
    color = '#aaaaaa'
  } else {
    text  = `${typeDef.icon} −${damage}${killed ? ' ☠' : ''}`
    color = attacker.faction === 'player' ? '#E8820C' : '#ff5555'
  }

  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = `
    position:absolute;
    left:${x}px; top:${y}px;
    transform:translate(-50%,-50%);
    font-family:'Share Tech Mono',monospace;
    font-size:12px; font-weight:bold;
    color:${color};
    text-shadow:0 0 6px #000,1px 1px 2px #000;
    white-space:nowrap;
  `
  overlayEl.appendChild(el)
  activeNumbers.push({ el, elapsed: 0, startY: y })
}

export function updateCombatFeedback(dt) {
  // Update lines
  for (let i = activeLines.length - 1; i >= 0; i--) {
    const item = activeLines[i]
    item.elapsed += dt
    const t = item.elapsed / LINE_DURATION
    item.line.material.opacity = Math.max(0, 1 - t)
    if (t >= 1) {
      feedbackGroup.remove(item.line)
      item.line.geometry.dispose()
      item.line.material.dispose()
      activeLines.splice(i, 1)
    }
  }

  // Update damage numbers
  for (let i = activeNumbers.length - 1; i >= 0; i--) {
    const item = activeNumbers[i]
    item.elapsed += dt
    const t = item.elapsed / NUM_DURATION
    item.el.style.opacity = Math.max(0, 1 - t)
    item.el.style.top = `${item.startY - t * NUM_RISE_PX}px`
    if (t >= 1) {
      item.el.remove()
      activeNumbers.splice(i, 1)
    }
  }

  // Prune old rate-limit entries
  const now = performance.now()
  for (const [key, ts] of recentLinePairs) {
    if (now - ts > 500) recentLinePairs.delete(key)
  }
}
