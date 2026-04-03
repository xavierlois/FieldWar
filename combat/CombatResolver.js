import { effectiveHeight, getCoverType, getFlankType } from '../core/HexGrid.js'
import { hasLOS } from './LineOfSight.js'
import { GameState } from '../core/GameState.js'
import { EventBus } from '../core/EventBus.js'

// Resolve an attack between two units
// Returns { damage, killed, blocked }
export function resolveAttack(attacker, defender, grid) {
  // Check LOS for ranged
  if (attacker.attackRange > 1) {
    if (!hasLOS(grid, attacker.q, attacker.r, defender.q, defender.r)) {
      return { damage: 0, killed: false, blocked: true, reason: 'no-los' }
    }
  }

  let damage = attacker.attackValue

  // Elevation bonus
  const aHex = grid.get(`${attacker.q},${attacker.r}`)
  const dHex = grid.get(`${defender.q},${defender.r}`)
  const aH = aHex ? effectiveHeight(aHex) : 1
  const dH = dHex ? effectiveHeight(dHex) : 1

  if (aH > dH) damage += 1
  if (aH < dH) damage -= 1

  // Charge bonus
  const attackerTeam = GameState.getTeamForUnit(attacker.id)
  if (attackerTeam?.command === 'charge') damage += 2

  // Breach bonus vs Shield Bearers
  if (attackerTeam?.command === 'breach' && defender.type === 'shield-bearer') damage += 2

  // Cover reduction
  const cover = getCoverType(dHex)
  if (cover === 'full') return { damage: 0, killed: false, blocked: true, reason: 'full-cover' }
  if (cover === 'partial') damage -= 1

  // Flanking bonus
  const flank = getFlankType(attacker.q, attacker.r, defender.q, defender.r, defender.facing)
  if (flank === 'side') damage += 1
  if (flank === 'rear') damage += 2

  // Defender base defense stat
  damage -= defender.defense

  // Command and status defense bonuses
  damage -= getDefenseBonus(defender)

  // Ambush surprise bonus
  if (attacker.inAmbush) damage += 1

  damage = Math.max(0, damage)

  const killed = defender.takeDamage(damage)

  // After charge, unit is exposed
  if (attackerTeam?.command === 'charge') {
    attacker.exposed = true
  }

  EventBus.emit('unit-attacked', { attackerId: attacker.id, defenderId: defender.id, damage, killed })

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
