import { hexDistance, hexNeighbors } from '../core/HexGrid.js'
import { GameState } from './GameState.js'
import { commanderAI } from '../ai/CommanderAI.js'

// AI-only trigger system — fires during resolution phase
// Checks conditions each frame and issues emergency commands to AI teams

const TRIGGER_COOLDOWN = 3.0  // minimum seconds between triggers per team
const teamTriggerTimers = new Map()  // teamId → cooldown remaining

export function resetTriggers() {
  teamTriggerTimers.clear()
}

export function checkTriggers(dt) {
  if (GameState.phase !== 'resolution') return

  // Cool down all timers
  teamTriggerTimers.forEach((time, teamId) => {
    teamTriggerTimers.set(teamId, time - dt)
  })

  GameState.allAITeams.forEach(team => {
    if (!team.isAlive) return
    if (team.emergencyUsed) return  // already used emergency this round

    const cooldown = teamTriggerTimers.get(team.id) || 0
    if (cooldown > 0) return

    const units = GameState.getAliveTeamUnits(team)
    if (units.length === 0) return

    const trigger = detectTrigger(team, units)
    if (trigger) {
      teamTriggerTimers.set(team.id, TRIGGER_COOLDOWN)
      commanderAI.emergencyCommand(team, trigger)
    }
  })
}

function detectTrigger(team, units) {
  const playerUnits = GameState.playerUnits

  // Heavy casualties: team HP dropped below 40%
  const avgHp = units.reduce((s, u) => s + u.hp / u.maxHp, 0) / units.length
  if (avgHp < 0.4) return 'casualties'

  // Surrounded: unit has 3+ enemies adjacent
  for (const unit of units) {
    const adjacentEnemies = playerUnits.filter(e =>
      hexDistance(unit.q, unit.r, e.q, e.r) <= 1
    ).length
    if (adjacentEnemies >= 3) return 'surrounded'
  }

  // Ambush: unit was attacked from a hidden position this frame
  // (detected via unit HP change — simplified: check sudden hp drop)
  for (const unit of units) {
    if (unit._prevHp !== undefined && unit.hp < unit._prevHp - 1) {
      return 'ambush'
    }
  }

  // Opportunity: exposed player unit nearby with low HP
  for (const enemy of playerUnits) {
    if (enemy.hp / enemy.maxHp < 0.3) {
      const nearest = units.reduce((near, u) => {
        const d = hexDistance(u.q, u.r, enemy.q, enemy.r)
        return !near || d < near.dist ? { unit: u, dist: d } : near
      }, null)
      if (nearest && nearest.dist <= 3) return 'opportunity'
    }
  }

  return null
}

// Store previous HP for change detection
export function snapshotUnitHP() {
  GameState.allUnits.forEach(u => { u._prevHp = u.hp })
}
