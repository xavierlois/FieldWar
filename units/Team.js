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

    // Positioning
    this.q = 0
    this.r = 0
    this.facing = faction === 'player' ? 2 : 5  // direction index

    // Visual State (World Position)
    this.worldX = 0
    this.worldZ = 0
    this.targetWorldX = 0
    this.targetWorldZ = 0

    // Resolution State
    this.plannedPath = []
    this.pathIndex = 0
    this.moving = false
    this.attackCooldown = 0
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

  // Called every resolution RAF frame — must be a no-op.
  // Per-resolution resets live in ResolutionEngine.startResolution().
  startResolution() {}

  setCommand(command, opts = {}) {
    this.command = command
    if (opts.targetTeamId !== undefined) this.targetTeamId = opts.targetTeamId
    if (opts.targetHex !== undefined) this.targetHex = opts.targetHex
    if (opts.patrolPath !== undefined) this.patrolPath = opts.patrolPath
  }
}

export function resetTeamIdCounter() { nextTeamId = 1 }
