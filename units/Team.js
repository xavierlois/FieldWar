let nextTeamId = 1

export class Team {
  constructor({ unitType, unitIds, faction, label }) {
    this.id = `team_${nextTeamId++}`
    this.unitType = unitType
    this.unitIds = [...unitIds]    // array of unit IDs
    this.faction = faction          // 'player' | 'ai'
    this.label = label              // e.g. "Archers A"

    this.command = null             // current command assigned this round
    this.emergencyUsed = false      // one emergency per resolution phase
    this.targetTeamId = null        // for Cover Team, Envelop, etc.
    this.targetHex = null           // {q, r} for Guard, Overwatch etc.
    this.patrolPath = []            // [{q,r}] for Patrol command
  }

  get isAlive() { return this.unitIds.length > 0 }

  removeUnit(unitId) {
    this.unitIds = this.unitIds.filter(id => id !== unitId)
  }

  resetForRound() {
    this.command = null
    this.emergencyUsed = false
    this.targetTeamId = null
    this.targetHex = null
  }

  setCommand(command, opts = {}) {
    this.command = command
    if (opts.targetTeamId !== undefined) this.targetTeamId = opts.targetTeamId
    if (opts.targetHex !== undefined) this.targetHex = opts.targetHex
    if (opts.patrolPath !== undefined) this.patrolPath = opts.patrolPath
  }
}

export function resetTeamIdCounter() { nextTeamId = 1 }
