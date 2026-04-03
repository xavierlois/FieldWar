import { effectiveHeight, getCoverType, getFlankType } from '../core/HexGrid.js'
import { hasLOS } from './LineOfSight.js'
import { GameState } from '../core/GameState.js'
import { EventBus } from '../core/EventBus.js'

// Resolve an attack between two units
// Returns { damage, killed, blocked }
export function resolveAttack(attackerTeam, defenderTeam, grid) {
  const attackers = GameState.getAliveTeamUnits(attackerTeam)
  const defenders = GameState.getAliveTeamUnits(defenderTeam)

  if (attackers.length === 0 || defenders.length === 0) {
    return { damage: 0, killed: false, blocked: true, reason: 'no-combatants' }
  }

  // Check LOS for ranged
  if (attackers[0].attackRange > 1) {
    if (!hasLOS(grid, attackerTeam.q, attackerTeam.r, defenderTeam.q, defenderTeam.r)) {
      return { damage: 0, killed: false, blocked: true, reason: 'no-los' }
    }
  }

  // One attack roll per team call — pick a random attacker
  const attacker = attackers[Math.floor(Math.random() * attackers.length)]
  const aliveDefenders = GameState.getAliveTeamUnits(defenderTeam)
  if (aliveDefenders.length === 0) return { damage: 0, killed: false, blocked: true, reason: 'no-defenders' }
  const defender = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)]

  // Elevation bonus
  const aHex = grid.get(`${attackerTeam.q},${attackerTeam.r}`)
  const dHex = grid.get(`${defenderTeam.q},${defenderTeam.r}`)
  const aH = aHex ? effectiveHeight(aHex) : 1
  const dH = dHex ? effectiveHeight(dHex) : 1

  let damage = attacker.attackValue
  if (aH > dH) damage += 1
  if (aH < dH) damage -= 1

  // Charge / breach bonus
  if (attackerTeam.command === 'charge') damage += 2
  if (attackerTeam.command === 'breach' && defender.type === 'shield-bearer') damage += 2

  // Cover reduction
  const cover = getCoverType(dHex)
  if (cover === 'full') return { damage: 0, killed: false, blocked: true, reason: 'full-cover' }
  if (cover === 'partial') damage -= 1

  // Flanking bonus
  const flank = getFlankType(attackerTeam.q, attackerTeam.r, defenderTeam.q, defenderTeam.r, defenderTeam.facing ?? 0)
  if (flank === 'side') damage += 1
  if (flank === 'rear') damage += 2

  // Defense
  damage -= defender.defense
  damage -= getDefenseBonus(defender)
  if (attacker.inAmbush) damage += 1

  damage = Math.max(0, damage)
  const killed = defender.takeDamage(damage)

  EventBus.emit('unit-attacked', { attackerId: attacker.id, defenderId: defender.id, damage, killed })

  // After charge, team is exposed
  if (attackerTeam.command === 'charge') {
    attackers.forEach(u => u.exposed = true)
  }

  return { damage, killed, blocked: false }
}

function getDefenseBonus(unit) {
  let bonus = 0
  if (unit.holdingLine) bonus += 1
  if (unit.rallied) bonus += 1
  if (unit.exposed) bonus -= 1

  // Teams with Hold the Line command
  const team = GameState.getTeamForUnit(unit.id)
  if (team?.command === 'hold-the-line' || team?.emergencyCommand === 'hold-the-line') bonus += 1
  if (team?.command === 'guard-position') bonus += 1

  return bonus
}

// Resolve all pending damage at end of resolution
export function flushPendingDamage() {
  GameState.pendingDamage.forEach(({ unitId, amount }) => {
    const unit = GameState.units.get(unitId)
    if (!unit || !unit.alive) return
    const killed = unit.takeDamage(amount)
    EventBus.emit('unit-damaged', { unitId, amount, killed })
  })
  GameState.pendingDamage = []
}

// Queue damage (for simultaneous resolution)
export function queueDamage(unitId, amount, attackerId) {
  GameState.pendingDamage.push({ unitId, amount, attackerId })
}
