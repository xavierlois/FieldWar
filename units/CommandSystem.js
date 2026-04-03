import { GameState } from '../core/GameState.js'
import { hexPath, reachableHexes, hexDistance, hexNeighbors, hexToWorld } from '../core/HexGrid.js'
import { resolveAttack } from '../combat/CombatResolver.js'
import { hasLOS } from '../combat/LineOfSight.js'
import { setUnitTargetPosition } from '../render/UnitRenderer.js'
import { EventBus } from '../core/EventBus.js'

// Commands that need a target hex
export const NEEDS_TARGET_HEX = new Set([
  'advance-to', 'guard-position', 'overwatch', 'patrol', 'attack-along-path'
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
  const units = GameState.getAliveTeamUnits(team)
  if (units.length === 0) return false

  const cmd = team.emergencyCommand || team.command
  if (!cmd) {
    // No command: advance toward nearest enemy
    defaultAdvance(units, team.faction, grid, dt)
    return true
  }

  switch (cmd) {
    case 'advance-to':      return execAdvanceTo(units, team, grid, dt)
    case 'charge':          return execCharge(units, team, grid, dt)
    case 'guard-position':  return execGuard(units, team, grid, dt)
    case 'hold-the-line':   return execHold(units, team, grid, dt)
    case 'overwatch':       return execOverwatch(units, team, grid, dt)
    case 'suppressive-fire':return execSuppressiveFire(units, team, grid, dt)
    case 'ordered-retreat': return execRetreat(units, team, grid, dt)
    case 'scatter':         return execScatter(units, team, grid, dt)
    case 'skirmish':        return execSkirmish(units, team, grid, dt)
    case 'ambush':          return execAmbush(units, team, grid, dt)
    case 'screen':          return execScreen(units, team, grid, dt)
    case 'rally':           return execRally(units, team, grid, dt)
    case 'feint':           return execFeint(units, team, grid, dt)
    case 'breach':          return execCharge(units, team, grid, dt)  // breach uses charge movement
    case 'cover-team':      return execCoverTeam(units, team, grid, dt)
    case 'envelop':         return execEnvelop(units, team, grid, dt)
    case 'patrol':          return execPatrol(units, team, grid, dt)
    case 'attack-along-path': return execAttackAlongPath(units, team, grid, dt)
    case 'formation-advance': return execFormationAdvance(units, team, grid, dt)
    case 'encircle':        return execEncircle(units, team, grid, dt)
    default:
      defaultAdvance(units, team.faction, grid, dt)
      return true
  }
}

// ── COMMAND IMPLEMENTATIONS ──────────────────────────────────────────

function execAdvanceTo(units, team, grid, dt) {
  const dest = team.targetHex
  if (!dest) { defaultAdvance(units, team.faction, grid, dt); return true }
  const enemies = getEnemies(team)
  units.forEach(unit => {
    moveUnitToward(unit, dest.q, dest.r, grid, dt)
    tryAttack(unit, enemies, grid)
  })
  return true
}

function defaultAdvance(units, faction, grid, dt) {
  const enemies = faction === 'player'
    ? GameState.aiUnits
    : GameState.playerUnits

  units.forEach(unit => {
    const target = findNearestEnemy(unit, enemies)
    if (!target) return
    moveUnitToward(unit, target.q, target.r, grid, dt)
    tryAttack(unit, enemies, grid)
  })
}

function execCharge(units, team, grid, dt) {
  const enemies = getEnemies(team)
  units.forEach(unit => {
    unit.exposed = true  // will be checked for defense penalty
    const target = findNearestEnemy(unit, enemies)
    if (!target) return
    moveUnitToward(unit, target.q, target.r, grid, dt, 1.5)  // 1.5x speed
    tryAttack(unit, enemies, grid)
  })
  return true
}

function execGuard(units, team, grid, dt) {
  const guardHex = team.targetHex
  units.forEach(unit => {
    if (guardHex) {
      moveUnitToward(unit, guardHex.q, guardHex.r, grid, dt)
    }
    // Attack enemies that come within range
    const enemies = getEnemies(team)
    tryAttack(unit, enemies, grid)
  })
  return true
}

function execHold(units, team, grid, dt) {
  units.forEach(unit => {
    unit.holdingLine = true
    // Stay put, attack in range
    const enemies = getEnemies(team)
    tryAttack(unit, enemies, grid)
  })
  return true
}

function execOverwatch(units, team, grid, dt) {
  units.forEach(unit => {
    // Stay put, auto-attack first enemy entering range
    const enemies = getEnemies(team)
    const inRange = enemies.filter(e =>
      hexDistance(unit.q, unit.r, e.q, e.r) <= unit.attackRange &&
      hasLOS(GameState.grid, unit.q, unit.r, e.q, e.r)
    )
    if (inRange.length > 0) {
      tryAttack(unit, inRange, grid)
    }
  })
  return true
}

function execSuppressiveFire(units, team, grid, dt) {
  const targetTeam = GameState.getTeam(team.targetTeamId)
  if (!targetTeam) { defaultAdvance(units, team.faction, grid, dt); return true }

  const targetUnits = GameState.getAliveTeamUnits(targetTeam)
  units.forEach(unit => {
    // Move to range then fire
    const target = targetUnits[0]
    if (!target) return
    if (hexDistance(unit.q, unit.r, target.q, target.r) > unit.attackRange) {
      moveUnitToward(unit, target.q, target.r, grid, dt)
    } else {
      // Apply suppression
      targetUnits.forEach(t => { t.suppressed = true })
      tryAttack(unit, targetUnits, grid)
    }
  })
  return true
}

function execRetreat(units, team, grid, dt) {
  const retreatDir = team.faction === 'player' ? 1 : -1  // player retreats toward bottom (positive r)
  units.forEach(unit => {
    // Move away from enemies
    const enemies = getEnemies(team)
    const target = findNearestEnemy(unit, enemies)
    if (!target) {
      // Just move backward
      const destR = unit.r + retreatDir * 2
      const destQ = unit.q
      moveUnitToward(unit, destQ, destR, grid, dt)
    } else {
      // Move away from nearest enemy
      const dq = unit.q - target.q
      const dr = unit.r - target.r
      const destQ = unit.q + Math.sign(dq)
      const destR = unit.r + Math.sign(dr) + retreatDir
      moveUnitToward(unit, destQ, destR, grid, dt)
    }
  })
  return true
}

function execScatter(units, team, grid, dt) {
  units.forEach((unit, idx) => {
    // Each unit scatters in a different direction
    const angle = (idx / units.length) * Math.PI * 2
    const dq = Math.round(Math.cos(angle) * 3)
    const dr = Math.round(Math.sin(angle) * 3)
    moveUnitToward(unit, unit.q + dq, unit.r + dr, grid, dt)
  })
  return true
}

function execSkirmish(units, team, grid, dt) {
  const enemies = getEnemies(team)
  units.forEach(unit => {
    const target = findNearestEnemy(unit, enemies)
    if (!target) return
    const dist = hexDistance(unit.q, unit.r, target.q, target.r)
    if (dist <= unit.attackRange) {
      // Attack then retreat
      tryAttack(unit, [target], grid)
      execRetreat([unit], team, grid, dt)
    } else {
      moveUnitToward(unit, target.q, target.r, grid, dt)
    }
  })
  return true
}

function execAmbush(units, team, grid, dt) {
  units.forEach(unit => {
    unit.inAmbush = true
    const enemies = getEnemies(team)
    const inRange = enemies.filter(e =>
      hexDistance(unit.q, unit.r, e.q, e.r) <= unit.attackRange
    )
    if (inRange.length > 0) {
      unit.inAmbush = false  // revealed on attack
      tryAttack(unit, inRange, grid)
    }
  })
  return true
}

function execScreen(units, team, grid, dt) {
  // Find the weakest allied unit and move to protect them
  const alliedTeams = team.faction === 'player'
    ? GameState.allPlayerTeams
    : GameState.allAITeams
  let weakestUnit = null
  let minHpRatio = 1
  alliedTeams.forEach(t => {
    if (t.id === team.id) return
    GameState.getAliveTeamUnits(t).forEach(u => {
      const ratio = u.hp / u.maxHp
      if (ratio < minHpRatio) { minHpRatio = ratio; weakestUnit = u }
    })
  })

  if (weakestUnit) {
    units.forEach(unit => {
      // Move adjacent to weakest ally
      const neighbors = hexNeighbors(weakestUnit.q, weakestUnit.r)
      const dest = neighbors.find(n => {
        const h = GameState.grid.get(`${n.q},${n.r}`)
        return h?.passable && !h.unitId
      }) || weakestUnit
      moveUnitToward(unit, dest.q, dest.r, grid, dt)
    })
  } else {
    defaultAdvance(units, team.faction, grid, dt)
  }
  return true
}

function execRally(units, team, grid, dt) {
  units.forEach(unit => {
    unit.rallied = true
    // Buff adjacent friendly units
    hexNeighbors(unit.q, unit.r).forEach(({ q, r }) => {
      const u = GameState.getUnitAt(q, r)
      if (u && u.faction === unit.faction) {
        u.rallied = true
      }
    })
  })
  return true
}

function execFeint(units, team, grid, dt) {
  const enemies = getEnemies(team)
  units.forEach(unit => {
    const target = findNearestEnemy(unit, enemies)
    if (!target) return
    moveUnitToward(unit, target.q, target.r, grid, dt)
    // NO attack — just advance
  })
  return true
}

function execCoverTeam(units, team, grid, dt) {
  const targetTeam = GameState.getTeam(team.targetTeamId)
  if (!targetTeam) { defaultAdvance(units, team.faction, grid, dt); return true }

  const targetUnits = GameState.getAliveTeamUnits(targetTeam)
  const enemies = getEnemies(team)

  units.forEach((unit, idx) => {
    // Stay near target team units
    const target = targetUnits[idx % targetUnits.length]
    if (!target) return

    const dist = hexDistance(unit.q, unit.r, target.q, target.r)
    if (dist > 2) {
      moveUnitToward(unit, target.q, target.r, grid, dt)
    }
    // Intercept nearby enemies
    const nearEnemy = enemies.find(e =>
      hexDistance(unit.q, unit.r, e.q, e.r) <= unit.attackRange
    )
    if (nearEnemy) tryAttack(unit, [nearEnemy], grid)
  })
  return true
}

function execEnvelop(units, team, grid, dt) {
  const enemies = getEnemies(team)
  const partnerTeam = GameState.getTeam(team.targetTeamId)

  units.forEach((unit, idx) => {
    const target = findNearestEnemy(unit, enemies)
    if (!target) return

    // Half go left flank, half go right flank
    const side = idx % 2 === 0 ? 1 : -1
    const flankQ = target.q + side * 2
    const flankR = target.r

    const dest = findValidHex(flankQ, flankR)
    if (dest) moveUnitToward(unit, dest.q, dest.r, grid, dt)
    tryAttack(unit, enemies, grid)
  })
  return true
}

function execPatrol(units, team, grid, dt) {
  if (!team.patrolPath || team.patrolPath.length === 0) {
    defaultAdvance(units, team.faction, grid, dt)
    return true
  }

  if (!team._patrolIndex) team._patrolIndex = 0

  const waypoint = team.patrolPath[team._patrolIndex]
  units.forEach(unit => {
    const dist = hexDistance(unit.q, unit.r, waypoint.q, waypoint.r)
    if (dist <= 1) {
      team._patrolIndex = (team._patrolIndex + 1) % team.patrolPath.length
    } else {
      moveUnitToward(unit, waypoint.q, waypoint.r, grid, dt)
    }
  })
  return true
}

function execAttackAlongPath(units, team, grid, dt) {
  if (!team.patrolPath || team.patrolPath.length === 0) {
    execCharge(units, team, grid, dt)
    return true
  }

  const enemies = getEnemies(team)
  if (!team._patrolIndex) team._patrolIndex = 0
  const waypoint = team.patrolPath[Math.min(team._patrolIndex, team.patrolPath.length - 1)]

  units.forEach(unit => {
    tryAttack(unit, enemies, grid)
    const dist = hexDistance(unit.q, unit.r, waypoint.q, waypoint.r)
    if (dist <= 1) {
      team._patrolIndex = Math.min(team._patrolIndex + 1, team.patrolPath.length - 1)
    }
    moveUnitToward(unit, waypoint.q, waypoint.r, grid, dt, 1.3)
  })
  return true
}

function execFormationAdvance(units, team, grid, dt) {
  if (units.length === 0) return false
  // Use centroid of team as reference point
  const cx = units.reduce((s, u) => s + u.q, 0) / units.length
  const cr = units.reduce((s, u) => s + u.r, 0) / units.length

  const enemies = getEnemies(team)
  const target = enemies.reduce((nearest, e) => {
    const d = hexDistance(cx, cr, e.q, e.r)
    return !nearest || d < hexDistance(cx, cr, nearest.q, nearest.r) ? e : nearest
  }, null)

  if (!target) return true

  units.forEach(unit => {
    moveUnitToward(unit, target.q, target.r, grid, dt)
    tryAttack(unit, enemies, grid)
  })
  return true
}

function execEncircle(units, team, grid, dt) {
  const enemies = getEnemies(team)
  const target = enemies.find(Boolean)
  if (!target) return true

  units.forEach((unit, idx) => {
    // Spread around target at 60-degree intervals
    const angle = (idx / units.length) * Math.PI * 2
    const destQ = target.q + Math.round(Math.cos(angle) * 2)
    const destR = target.r + Math.round(Math.sin(angle) * 2)
    const dest = findValidHex(destQ, destR)
    if (dest) moveUnitToward(unit, dest.q, dest.r, grid, dt)
    tryAttack(unit, enemies, grid)
  })
  return true
}

// ── HELPERS ────────────────────────────────────────────────────────

function getEnemies(team) {
  return team.faction === 'player' ? GameState.aiUnits : GameState.playerUnits
}

function findNearestEnemy(unit, enemies) {
  if (enemies.length === 0) return null
  return enemies.reduce((nearest, e) => {
    const d = hexDistance(unit.q, unit.r, e.q, e.r)
    const nd = nearest ? hexDistance(unit.q, unit.r, nearest.q, nearest.r) : Infinity
    return d < nd ? e : nearest
  }, null)
}

function findValidHex(q, r) {
  const hex = GameState.grid.get(`${q},${r}`)
  if (hex?.passable) return { q, r }
  // Try neighbors
  const neighbors = hexNeighbors(q, r)
  return neighbors.find(n => {
    const h = GameState.grid.get(`${n.q},${n.r}`)
    return h?.passable
  })
}

// Move a unit one step toward (destQ, destR)
// Called each frame during resolution
const UNIT_SPEED = 2.0  // hexes per second base

function moveUnitToward(unit, destQ, destR, grid, dt, speedMult = 1.0) {
  if (unit.q === destQ && unit.r === destR) return

  // Check if target position is occupied
  const destHex = grid.get(`${destQ},${destR}`)
  if (!destHex?.passable) return

  // Find path — use large range so units can navigate the full map
  const path = hexPath(grid, unit.q, unit.r, destQ, destR, 30)
  if (!path || path.length === 0) return

  const nextHex = path[0]

  // Move visually (smooth interpolation handled by UnitRenderer)
  // Only actually change hex position when we "arrive" at the next hex
  // Use a timer-based approach: each unit has a moveProgress
  if (!unit._moveProgress) unit._moveProgress = 0
  const speed = UNIT_SPEED * speedMult * GameState.resolutionSpeed

  unit._moveProgress += speed * dt

  if (unit._moveProgress >= 1.0) {
    unit._moveProgress = 0
    // Update unit hex position
    GameState.moveUnit(unit, nextHex.q, nextHex.r)
    setUnitTargetPosition(unit, nextHex.q, nextHex.r)

    // Update facing
    const dq = nextHex.q - unit.q, dr = nextHex.r - unit.r
    // Facing: index of direction moved
    // (already moved, so direction from old to new)
  }
}

const ATTACK_COOLDOWN = 1.5  // seconds between attacks

function tryAttack(attacker, enemies, grid) {
  if (!attacker.alive) return
  if (attacker.attackCooldown > 0) return

  const inRange = enemies.filter(e => {
    if (!e.alive) return false
    const dist = hexDistance(attacker.q, attacker.r, e.q, e.r)
    return dist <= attacker.attackRange
  })

  if (inRange.length === 0) return

  // Attack weakest in range
  const target = inRange.reduce((weakest, e) =>
    e.hp < (weakest?.hp ?? Infinity) ? e : weakest, null)

  if (!target) return

  const result = resolveAttack(attacker, target, grid)
  attacker.attackCooldown = ATTACK_COOLDOWN

  if (result.killed) {
    EventBus.emit('unit-killed', { unitId: target.id, killerId: attacker.id })
  }

  return result
}

// Reduce attack cooldowns each frame
export function tickAttackCooldowns(units, dt) {
  units.forEach(u => {
    if (u.attackCooldown > 0) u.attackCooldown -= dt * GameState.resolutionSpeed
  })
}
