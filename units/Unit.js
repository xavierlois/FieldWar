import { getUnitType } from './UnitTypes.js'
import { hexKey } from '../core/HexGrid.js'

let nextId = 1

export class Unit {
  constructor({ type, faction, q, r }) {
    this.id = `unit_${nextId++}`
    this.type = type
    this.faction = faction  // 'player' | 'ai'

    const def = getUnitType(type)
    this.maxHp = def.hp
    this.hp = def.hp
    this.maxAP = def.ap
    this.ap = def.ap
    this.move = def.move
    this.attackRange = def.attackRange
    this.attackValue = def.attackValue

    // Position
    this.q = q
    this.r = r
    this.facing = faction === 'player' ? 2 : 5  // face toward enemy side (direction index)

    // Visual state (used by renderer)
    this.worldX = 0
    this.worldZ = 0
    this.targetWorldX = 0
    this.targetWorldZ = 0

    // Resolution state
    this.plannedPath = []       // [{q,r}] path to follow this resolution
    this.pathIndex = 0          // current step in plannedPath
    this.moving = false
    this.attackTarget = null    // unitId of attack target
    this.attackCooldown = 0

    // Status effects
    this.suppressed = false     // AP-1 next turn if suppressed
    this.exposed = false        // -1 defense if exposed (after Charge)
    this.rallied = false        // +1 defense if rallied
    this.inAmbush = false       // hidden until first attack
    this.holdingLine = false    // +1 defense, no advance
    this.emergencyCommand = null

    this.alive = true
  }

  get key() { return hexKey(this.q, this.r) }

  resetAP() {
    this.ap = this.maxAP
    if (this.suppressed) { this.ap = Math.max(1, this.ap - 1) }
    this.suppressed = false
    this.exposed = false
    this.rallied = false
    this.holdingLine = false
    this.inAmbush = false
    this.emergencyCommand = null
    this.plannedPath = []
    this.pathIndex = 0
    this.moving = false
    this.attackTarget = null
    this.attackCooldown = 0
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) this.alive = false
    return !this.alive  // returns true if killed
  }

  getDefenseBonus() {
    let bonus = 0
    if (this.holdingLine) bonus += 1
    if (this.rallied) bonus += 1
    if (this.exposed) bonus -= 1
    return bonus
  }

  toJSON() {
    return {
      id: this.id, type: this.type, faction: this.faction,
      hp: this.hp, maxHp: this.maxHp, ap: this.ap,
      q: this.q, r: this.r, facing: this.facing, alive: this.alive
    }
  }
}

export function resetUnitIdCounter() { nextId = 1 }
