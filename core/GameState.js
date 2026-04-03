// Single source of truth for all game data

export const GameState = {
  // Phase
  phase: 'scenario-select',  // 'scenario-select' | 'pre-battle' | 'planning' | 'resolution' | 'assessment' | 'end'

  // Scenario
  scenarioId: null,
  scenarioName: '',
  objective: 'eliminate_all',
  objectiveHex: null,
  objectiveTurns: null,

  // Turn
  turn: 1,
  difficulty: 'medium',  // 'easy' | 'medium' | 'hard'

  // Grid (Map<"q,r", HexData>)
  grid: new Map(),
  gridOffsetQ: 0,
  gridOffsetR: 0,
  gridCols: 9,
  gridRows: 14,

  // Units (Map<unitId, Unit>)
  units: new Map(),

  // Teams
  playerTeams: new Map(),  // Map<teamId, Team>
  aiTeams: new Map(),       // Map<teamId, Team>

  // Resolution
  resolutionSpeed: 1.0,     // 1.0 normal, 0.2 slow-mo
  pendingDamage: [],         // [{unitId, amount, attackerId}]
  resolutionComplete: false,

  // Win/loss
  winner: null,  // null | 'player' | 'ai'
  winReason: '',

  // UI state
  selectedTeamId: null,
  selectedCommandForTeam: null,
  awaitingTargetFor: null,  // teamId waiting for target hex/team selection

  // Helper getters
  get allUnits() { return [...this.units.values()] },
  get aliveUnits() { return [...this.units.values()].filter(u => u.alive) },
  get playerUnits() { return this.aliveUnits.filter(u => u.faction === 'player') },
  get aiUnits() { return this.aliveUnits.filter(u => u.faction === 'ai') },
  get allPlayerTeams() { return [...this.playerTeams.values()] },
  get allAITeams() { return [...this.aiTeams.values()] },

  getTeamForUnit(unitId) {
    for (const t of this.playerTeams.values()) {
      if (t.unitIds.includes(unitId)) return t
    }
    for (const t of this.aiTeams.values()) {
      if (t.unitIds.includes(unitId)) return t
    }
    return null
  },

  getTeam(teamId) {
    return this.playerTeams.get(teamId) || this.aiTeams.get(teamId)
  },

  getAliveTeamUnits(team) {
    return team.unitIds.map(id => this.units.get(id)).filter(u => u?.alive)
  },

  getUnitAt(q, r) {
    const hex = this.grid.get(`${q},${r}`)
    if (!hex?.unitId) return null
    return this.units.get(hex.unitId) || null
  },

  placeUnit(unit) {
    const old = this.grid.get(unit.key)
    if (old) old.unitId = null
    const hex = this.grid.get(`${unit.q},${unit.r}`)
    if (hex) hex.unitId = unit.id
  },

  moveUnit(unit, q, r) {
    const oldHex = this.grid.get(unit.key)
    if (oldHex) oldHex.unitId = null
    unit.q = q; unit.r = r
    // Update facing: face the direction we just moved
    const newHex = this.grid.get(unit.key)
    if (newHex) newHex.unitId = unit.id
  },

  removeUnit(unit) {
    const hex = this.grid.get(unit.key)
    if (hex) hex.unitId = null
    unit.alive = false
    // Remove from team
    const team = this.getTeamForUnit(unit.id)
    if (team) team.removeUnit(unit.id)
  },

  reset() {
    this.phase = 'scenario-select'
    this.turn = 1
    this.winner = null
    this.winReason = ''
    this.grid = new Map()
    this.units = new Map()
    this.playerTeams = new Map()
    this.aiTeams = new Map()
    this.selectedTeamId = null
    this.selectedCommandForTeam = null
    this.awaitingTargetFor = null
    this.resolutionSpeed = 1.0
    this.pendingDamage = []
    this.resolutionComplete = false
    this._objectiveHeldTurns = 0
    this.objectiveHex = null
    this.objectiveTurns = null
  }
}
