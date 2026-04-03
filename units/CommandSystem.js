import { GameState } from '../core/GameState.js'
import { hexPath, reachableHexes, hexDistance, hexNeighbors, hexesInRange, hexToWorld, effectiveHeight, moveCost } from '../core/HexGrid.js'
import { resolveAttack } from '../combat/CombatResolver.js'
import { EventBus } from '../core/EventBus.js'
import { getDynamicAttackRange } from '../combat/LineOfSight.js'
import { getUnitType } from '../units/UnitTypes.js'


// Commands that need a target hex
export const NEEDS_TARGET_HEX = new Set([
  'guard-position', 'charge', 'patrol', 'attack-along-path', 'ambush', 'overwatch'
])

// Commands that need an enemy target team
export const NEEDS_TARGET_TEAM = new Set([
  'envelop', 'suppressive-fire'
])

// Commands that need an ally target team
export const NEEDS_ALLY_TARGET = new Set([
  'cover-team', 'screen'
])

// Execute a team's command for one resolution step
// Returns true if the command is still active (not complete)
export function executeTeamCommand(team, grid, dt) {
  if (!team.isAlive) return false

  // Reduce cooldown
  team.attackCooldown = Math.max(0, team.attackCooldown - dt)

  let active = false
  const command = team.emergencyUsed && team.emergencyCommand ? team.emergencyCommand : team.command

  switch (command) {
    case 'charge': active = execCharge(team, grid, dt); break
    case 'guard-position': active = execGuard(team, grid, dt); break
    case 'hold-the-line': active = execHold(team, grid, dt); break
    case 'overwatch': active = execOverwatch(team, grid, dt); break
    case 'suppressive-fire': active = execSuppressiveFire(team, grid, dt); break
    case 'ordered-retreat': active = execRetreat(team, grid, dt); break
    case 'scatter': active = execScatter(team, grid, dt); break
    case 'skirmish': active = execSkirmish(team, grid, dt); break
    case 'ambush': active = execAmbush(team, grid, dt); break
    case 'screen': active = execScreen(team, grid, dt); break
    case 'rally': active = execRally(team, grid, dt); break
    case 'feint': active = execFeint(team, grid, dt); break
    case 'cover-team': active = execCoverTeam(team, grid, dt); break
    case 'envelop': active = execEnvelop(team, grid, dt); break
    case 'patrol': active = execPatrol(team, grid, dt); break
    case 'attack-along-path': active = execAttackAlongPath(team, grid, dt); break
    case 'formation-advance': active = execFormationAdvance(team, grid, dt); break
    case 'encircle': active = execEncircle(team, grid, dt); break
    default: active = false; break // Do nothing if no command assigned
  }

  // Handle combat after any move step — allow when team just finished moving
  // (team.moving is set false by setTimeout, so this frame check allows attacks after arrival)
  const enemies = getEnemies(team)
  tryAttack(team, enemies, grid)

  return active
}

// ── COMMAND IMPLEMENTATIONS ──────────────────────────────────────────

function defaultAdvance(team, grid, dt) {
  const enemies = getEnemies(team)
  const nearest = findNearestEnemy(team, enemies)
  if (!nearest) return false

  moveTeamToward(team, nearest.q, nearest.r, grid, dt)
  return true
}

function execCharge(team, grid, dt) {
  if (!team.targetHex) return false
  const { q, r } = team.targetHex
  return moveTeamToward(team, q, r, grid, dt, 1.5)
}

function execGuard(team, grid, dt) {
  if (!team.targetHex) return false
  const { q, r } = team.targetHex
  if (team.q === q && team.r === r) {
    return true // We are holding
  }
  return moveTeamToward(team, q, r, grid, dt)
}

function execHold(team, grid, dt) {
  GameState.getAliveTeamUnits(team).forEach(u => u.holdingLine = true)
  return true
}

function execOverwatch(team, grid, dt) {
  if (!team.targetHex) return false
  const { q, r } = team.targetHex
  if (team.q !== q || team.r !== r) {
    moveTeamToward(team, q, r, grid, dt)
  }
  return true
}

function execSuppressiveFire(team, grid, dt) {
  if (!team.targetTeamId) return false
  const target = GameState.getTeam(team.targetTeamId)
  if (!target || !target.isAlive) return false

  const dist = hexDistance(team.q, team.r, target.q, target.r)
  const rng = getDynamicAttackRange(GameState.getAliveTeamUnits(team)[0], grid, target.q, target.r)

  if (dist > rng) {
    moveTeamToward(team, target.q, target.r, grid, dt)
  } else {
    GameState.getAliveTeamUnits(target).forEach(u => u.suppressed = true)
  }
  return true
}

function execRetreat(team, grid, dt) {
  const enemies = getEnemies(team)
  const nearest = findNearestEnemy(team, enemies)
  if (!nearest) return false

  // Move away from nearest enemy
  const dq = team.q - nearest.q
  const dr = team.r - nearest.r
  const targetQ = team.q + Math.sign(dq) * 2
  const targetR = team.r + Math.sign(dr) * 2

  return moveTeamToward(team, targetQ, targetR, grid, dt, 1.2)
}

function execScatter(team, grid, dt) {
  const enemies = getEnemies(team)
  const nearest = findNearestEnemy(team, enemies)
  if (!nearest) return false

  const dq = team.q - nearest.q
  const dr = team.r - nearest.r
  moveTeamToward(team, team.q + dq * 3, team.r + dr * 3, grid, dt, 1.5)
  return true
}

function execSkirmish(team, grid, dt) {
  const enemies = getEnemies(team)
  const nearest = findNearestEnemy(team, enemies)
  if (!nearest) return false

  const maxRange = GameState.getAliveTeamUnits(team)[0]?.maxAttackRange || 1
  const dist = hexDistance(team.q, team.r, nearest.q, nearest.r)

  if (dist <= maxRange) {
    const dq = team.q - nearest.q
    const dr = team.r - nearest.r
    moveTeamToward(team, team.q + Math.sign(dq), team.r + Math.sign(dr), grid, dt)
  } else {
    moveTeamToward(team, nearest.q, nearest.r, grid, dt)
  }
  return true
}

function execAmbush(team, grid, dt) {
  if (!team.targetHex) return false
  const { q, r } = team.targetHex
  if (team.q !== q || team.r !== r) {
    moveTeamToward(team, q, r, grid, dt)
  } else {
    GameState.getAliveTeamUnits(team).forEach(u => u.inAmbush = true)
  }
  return true
}

function execScreen(team, grid, dt) {
  if (!team.targetTeamId) return false
  const ally = GameState.getTeam(team.targetTeamId)
  if (!ally || !ally.isAlive) return false

  const enemies = getEnemies(team)
  const nearestEnemy = findNearestEnemy(ally, enemies)
  if (!nearestEnemy) {
    moveTeamToward(team, ally.q, ally.r, grid, dt)
    return true
  }

  // Position between ally and enemy
  const midQ = Math.round((ally.q + nearestEnemy.q) / 2)
  const midR = Math.round((ally.r + nearestEnemy.r) / 2)

  moveTeamToward(team, midQ, midR, grid, dt)
  return true
}

function execRally(team, grid, dt) {
  GameState.getAliveTeamUnits(team).forEach(u => u.rallied = true)
  return true
}

function execFeint(team, grid, dt) {
  return execSkirmish(team, grid, dt)
}

function execCoverTeam(team, grid, dt) {
  if (!team.targetTeamId) return false
  const ally = GameState.getTeam(team.targetTeamId)
  if (!ally || !ally.isAlive) return false

  const dist = hexDistance(team.q, team.r, ally.q, ally.r)
  if (dist > 1) {
    moveTeamToward(team, ally.q, ally.r, grid, dt)
  }
  return true
}

function execEnvelop(team, grid, dt) {
  if (!team.targetTeamId) return false
  const target = GameState.getTeam(team.targetTeamId)
  if (!target || !target.isAlive) return false

  // Try to move to the opposite side of target's current facing
  const backsideQ = target.q - 2
  const backsideR = target.r + 1
  moveTeamToward(team, backsideQ, backsideR, grid, dt)
  return true
}

function execPatrol(team, grid, dt) {
  if (!team.patrolPath || team.patrolPath.length === 0) return false
  if (team.pathIndex >= team.patrolPath.length) {
    team.patrolPath.reverse()
    team.pathIndex = 0
  }

  const dest = team.patrolPath[team.pathIndex]
  if (team.q === dest.q && team.r === dest.r) {
    team.pathIndex++
    return true
  }

  moveTeamToward(team, dest.q, dest.r, grid, dt)
  return true
}

function execAttackAlongPath(team, grid, dt) {
  return execPatrol(team, grid, dt)
}

function execFormationAdvance(team, grid, dt) {
  return defaultAdvance(team, grid, dt)
}

function execEncircle(team, grid, dt) {
  return execEnvelop(team, grid, dt)
}

// ── HELPERS ────────────────────────────────────────────────────────

function getEnemies(team) {
  return team.faction === 'player' ? GameState.allAITeams.filter(t => t.isAlive) : GameState.allPlayerTeams.filter(t => t.isAlive)
}

function findNearestEnemy(team, enemies) {
  let min = Infinity
  let nearest = null
  enemies.forEach(e => {
    const d = hexDistance(team.q, team.r, e.q, e.r)
    if (d < min) { min = d; nearest = e }
  })
  return nearest
}

function findValidHex(q, r) {
  const h = GameState.grid.get(`${q},${r}`)
  if (h && h.passable && !h.teamId) return { q, r }

  // Expand outward ring by ring (hexesInRange returns all within radius N)
  for (let rad = 1; rad <= 3; rad++) {
    for (const n of hexesInRange(q, r, rad)) {
      if (n.q === q && n.r === r) continue
      const hn = GameState.grid.get(`${n.q},${n.r}`)
      if (hn && hn.passable && !hn.teamId) return n
    }
  }
  return null
}

// Move a team one step toward (destQ, destR)
// Called each frame during resolution
const TEAM_SPEED_BASE = 2.0  // hexes per second base

function moveTeamToward(team, destQ, destR, grid, dt, speedMult = 1.0) {
  if (team.moving) return true

  const aliveUnits = GameState.getAliveTeamUnits(team)
  if (aliveUnits.length === 0) return false
  const anchorUnit = aliveUnits[0]

  if (team.q === destQ && team.r === destR) {
    team.plannedPath = []
    team.pathIndex = 0
    return false
  }

  // Need new path?
  if (team.plannedPath.length === 0 || team.pathIndex >= team.plannedPath.length) {
    const target = findValidHex(destQ, destR)
    if (!target) return false

    const p = hexPath(grid, team.q, team.r, target.q, target.r)
    if (p && p.length > 0) {
      team.plannedPath = p
      team.pathIndex = 0
    } else {
      team.plannedPath = []
      return false
    }
  }

  // Next step
  const nextIdx = team.pathIndex
  if (nextIdx < team.plannedPath.length) {
    const nq = team.plannedPath[nextIdx].q
    const nr = team.plannedPath[nextIdx].r

    // Check collision against other teams
    const nHex = GameState.grid.get(`${nq},${nr}`)
    if (nHex && nHex.teamId && nHex.teamId !== team.id) {
      // path blocked! find detour!
      const target = findValidHex(destQ, destR)
      if (!target) {
        team.plannedPath = []
        return false
      }
      const p = hexPath(grid, team.q, team.r, target.q, target.r)
      if (p && p.length > 0) {
        team.plannedPath = p
        team.pathIndex = 0
      } else {
        team.plannedPath = []
      }
      return true // Wait until next tick to try again
    }

    // Move
    GameState.moveTeam(team, nq, nr)
    team.pathIndex++
    team.stepsTaken = (team.stepsTaken || 0) + 1

    // Animation lockout
    team.moving = true

    // Compute terrain cost and dynamic speed
    const uClass = getUnitType(team.unitType)
    const baseSpeed = uClass.move || 1
    const nHexCost = nHex ? moveCost(nHex) : 1
    const speed = TEAM_SPEED_BASE * speedMult * baseSpeed * (1 / nHexCost)
    const duration = 1.0 / speed

    const w = hexToWorld(nq, nr)
    team.targetWorldX = w.x
    team.targetWorldZ = w.z

    EventBus.emit('team-move', { teamId: team.id })

    setTimeout(() => {
      team.moving = false
    }, (duration / GameState.resolutionSpeed) * 1000)

    return true
  }

  team.plannedPath = []
  return false
}

function tryAttack(team, enemies, grid) {
  if (team.attackCooldown > 0) return

  const alive = GameState.getAliveTeamUnits(team)
  if (alive.length === 0) return

  // Find enemies in range
  const inRange = enemies.filter(e => {
    if (!e.isAlive) return false
    const dist = hexDistance(team.q, team.r, e.q, e.r)
    return dist <= getDynamicAttackRange(team, grid, e.q, e.r)
  })
  if (inRange.length === 0) return

  // Target lowest total HP
  inRange.sort((a, b) => {
    const aHp = GameState.getAliveTeamUnits(a).reduce((s, u) => s + u.hp, 0)
    const bHp = GameState.getAliveTeamUnits(b).reduce((s, u) => s + u.hp, 0)
    return aHp - bHp
  })

  resolveAttack(team, inRange[0], grid)

  // Cooldown from unit type's attack speed
  const uType = getUnitType(team.unitType)
  team.attackCooldown = uType.attackSpeed ?? 2.0
}
