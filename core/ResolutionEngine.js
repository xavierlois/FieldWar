import { GameState } from './GameState.js'
import { EventBus } from './EventBus.js'
import { executeTeamCommand, tickAttackCooldowns } from '../units/CommandSystem.js'
import { checkTriggers, snapshotUnitHP } from './TriggerSystem.js'
import { animateDeath } from '../render/UnitRenderer.js'
import { getClock } from '../render/SceneManager.js'

let running = false
let rafId = null
const RESOLUTION_DURATION = 8.0  // seconds max per resolution phase
let elapsedTime = 0

export function startResolution() {
  running = true
  elapsedTime = 0
  GameState.resolutionComplete = false

  // Reset all team emergency flags
  ;[...GameState.allPlayerTeams, ...GameState.allAITeams].forEach(t => {
    t.emergencyUsed = false
    t._patrolIndex = undefined
  })

  // Reset per-unit resolution state
  GameState.aliveUnits.forEach(u => {
    u._moveProgress = 0
    u.attackCooldown = 0
  })

  snapshotUnitHP()

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(resolutionLoop)
}

function resolutionLoop() {
  if (!running) return

  const dt = Math.min(getClock().getDelta(), 0.05)  // cap dt at 50ms
  elapsedTime += dt * GameState.resolutionSpeed

  // 1. Tick attack cooldowns
  tickAttackCooldowns(GameState.aliveUnits, dt)

  // 2. Execute all team commands
  let anyActive = false
  ;[...GameState.allPlayerTeams, ...GameState.allAITeams].forEach(team => {
    if (!team.isAlive) return
    const active = executeTeamCommand(team, GameState.grid, dt)
    if (active) anyActive = true
  })

  // 3. Check AI triggers
  checkTriggers(dt)

  // 4. Process dead units
  processDeaths()

  // 5. Check end conditions (rendering handled by main.js RAF loop)
  // Require at least 1.5s before early-complete check — units start with
  // worldX === targetWorldX so isResolutionComplete would fire immediately otherwise
  const done = (elapsedTime > 1.5 && isResolutionComplete()) || elapsedTime > RESOLUTION_DURATION

  if (done) {
    stopResolution()
    return
  }

  rafId = requestAnimationFrame(resolutionLoop)
}

function processDeaths() {
  GameState.allUnits.forEach(unit => {
    if (!unit.alive && !unit._deathProcessed) {
      unit._deathProcessed = true
      animateDeath(unit.id)
      GameState.removeUnit(unit)
      EventBus.emit('unit-died', { unitId: unit.id, faction: unit.faction })
    }
  })
}

function isResolutionComplete() {
  // All units have reached their destinations and cooldowns expired
  const allStill = GameState.aliveUnits.every(u => {
    const dx = Math.abs(u.worldX - u.targetWorldX)
    const dz = Math.abs(u.worldZ - u.targetWorldZ)
    return dx < 0.05 && dz < 0.05 && u.attackCooldown <= 0
  })
  return allStill
}

export function stopResolution() {
  running = false
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  EventBus.emit('resolution-complete')
}

export function setResolutionSpeed(speed) {
  GameState.resolutionSpeed = speed
}

export function isRunning() { return running }
