import { hexDistance, effectiveHeight } from '../core/HexGrid.js'
import { influenceMap } from '../combat/InfluenceMap.js'
import { GameState } from '../core/GameState.js'
import { getUnitType } from '../units/UnitTypes.js'

// Tier 1: Strategic AI — assigns commands to AI teams each round

const MACRO_STATES = ['advance', 'engage', 'hold', 'retreat']

export class CommanderAI {
  constructor() {
    this.macroState = 'advance'
    this.difficulty = 'medium'
  }

  setDifficulty(d) { this.difficulty = d }

  // Called once per planning phase
  planTurn() {
    const playerUnits = GameState.playerUnits
    const aiUnits = GameState.aiUnits

    if (aiUnits.length === 0) return

    // Update influence maps (hard only)
    if (this.difficulty === 'hard') {
      influenceMap.update(GameState.grid, playerUnits, aiUnits)
    }

    // Analyze board situation
    const situation = this.analyzeSituation(playerUnits, aiUnits)
    this.macroState = situation.macroState

    // Assign commands to each AI team
    GameState.allAITeams.forEach(team => {
      if (!team.isAlive) return
      const command = this.selectCommand(team, situation)
      team.setCommand(command.cmd, command.opts || {})
    })
  }

  analyzeSituation(playerUnits, aiUnits) {
    const situation = {
      macroState: 'advance',
      playerCount: playerUnits.length,
      aiCount: aiUnits.length,
      aiHpRatio: this.avgHpRatio(aiUnits),
      playerHpRatio: this.avgHpRatio(playerUnits),
      aiHasElevation: this.hasMajorityElevation(aiUnits),
      playerClustered: this.isClustered(playerUnits),
      aiExposed: this.hasExposedUnits(aiUnits, playerUnits),
      playerReachable: this.anyInAttackRange(aiUnits, playerUnits),
    }

    // Determine macro state
    const ratio = situation.aiCount / Math.max(1, situation.playerCount)
    const hpRatio = situation.aiHpRatio

    if (hpRatio < 0.3 || ratio < 0.5) {
      situation.macroState = 'retreat'
    } else if (situation.aiHasElevation || hpRatio > 0.8) {
      situation.macroState = situation.playerReachable ? 'engage' : 'hold'
    } else if (situation.playerReachable) {
      situation.macroState = 'engage'
    } else {
      situation.macroState = 'advance'
    }

    return situation
  }

  selectCommand(team, situation) {
    const typeDef = getUnitType(team.unitType)
    const teamUnits = GameState.getAliveTeamUnits(team)
    if (teamUnits.length === 0) return { cmd: 'ordered-retreat' }

    const avgHp = teamUnits.reduce((s, u) => s + u.hp / u.maxHp, 0) / teamUnits.length
    const difficulty = this.difficulty

    // Easy: mostly random
    if (difficulty === 'easy') {
      const opts = typeDef.commands
      return { cmd: opts[Math.floor(Math.random() * opts.length)] }
    }

    // Tactical command selection by unit type + macro state
    switch (situation.macroState) {
      case 'retreat':
        if (team.unitType === 'shield-bearer') return { cmd: 'screen' }
        return { cmd: 'ordered-retreat' }

      case 'hold':
        if (team.unitType === 'archer') return { cmd: 'overwatch' }
        if (team.unitType === 'shield-bearer') return { cmd: 'hold-the-line' }
        return { cmd: 'guard-position' }

      case 'engage': {
        if (team.unitType === 'archer') {
          if (situation.playerClustered) return { cmd: 'suppressive-fire', opts: this.findTargetTeam(team) }
          return { cmd: 'overwatch' }
        }
        if (team.unitType === 'knight') {
          if (this.hasFlankingOpportunity(team)) return { cmd: 'envelop' }
          return { cmd: 'charge' }
        }
        if (team.unitType === 'swordsman') {
          if (avgHp > 0.6) return { cmd: 'charge' }
          return { cmd: 'skirmish' }
        }
        if (team.unitType === 'shield-bearer') {
          const needsProtection = this.findWeakAlliedTeam(team)
          if (needsProtection) return { cmd: 'cover-team', opts: { targetTeamId: needsProtection } }
          return { cmd: 'hold-the-line' }
        }
        return { cmd: 'charge' }
      }

      case 'advance':
      default: {
        if (team.unitType === 'archer') return { cmd: 'feint' }
        if (team.unitType === 'knight') return { cmd: 'formation-advance' }
        if (team.unitType === 'shield-bearer') {
          const needsProtection = this.findWeakAlliedTeam(team)
          if (needsProtection) return { cmd: 'cover-team', opts: { targetTeamId: needsProtection } }
          return { cmd: 'formation-advance' }
        }
        return { cmd: 'feint' }
      }
    }
  }

  // Emergency command during resolution (triggered by TriggerSystem)
  emergencyCommand(team, triggerType) {
    const teamUnits = GameState.getAliveTeamUnits(team)
    const avgHp = teamUnits.length > 0
      ? teamUnits.reduce((s, u) => s + u.hp / u.maxHp, 0) / teamUnits.length
      : 0

    let cmd = 'ordered-retreat'
    switch (triggerType) {
      case 'casualties':
        cmd = avgHp < 0.25 ? 'scatter' : 'ordered-retreat'
        break
      case 'surrounded':
        cmd = 'scatter'
        break
      case 'ambush':
        cmd = avgHp > 0.5 ? 'charge' : 'scatter'
        break
      case 'ally_lost':
        cmd = 'guard-position'
        break
      case 'opportunity':
        cmd = 'charge'
        break
    }

    team.emergencyCommand = cmd
    team.emergencyUsed = true
  }

  // ── Helpers ──────────────────────────────────

  avgHpRatio(units) {
    if (units.length === 0) return 0
    return units.reduce((s, u) => s + u.hp / u.maxHp, 0) / units.length
  }

  hasMajorityElevation(units) {
    if (units.length === 0) return false
    const highCount = units.filter(u => {
      const hex = GameState.grid.get(`${u.q},${u.r}`)
      return hex && effectiveHeight(hex) >= 2
    }).length
    return highCount >= units.length / 2
  }

  isClustered(units) {
    if (units.length < 2) return false
    let pairs = 0
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        if (hexDistance(units[i].q, units[i].r, units[j].q, units[j].r) <= 2) pairs++
      }
    }
    return pairs >= units.length
  }

  hasExposedUnits(aiUnits, playerUnits) {
    return aiUnits.some(u =>
      playerUnits.some(e => hexDistance(u.q, u.r, e.q, e.r) <= e.attackRange + 1)
    )
  }

  anyInAttackRange(aiUnits, playerUnits) {
    return aiUnits.some(ai =>
      playerUnits.some(p => hexDistance(ai.q, ai.r, p.q, p.r) <= ai.attackRange + 2)
    )
  }

  hasFlankingOpportunity(team) {
    if (this.difficulty !== 'hard') return false
    const units = GameState.getAliveTeamUnits(team)
    return units.some(u => influenceMap.getFlank(u.q, u.r) > 1)
  }

  findTargetTeam(aiTeam) {
    const largestPlayerTeam = [...GameState.playerTeams.values()]
      .filter(t => t.isAlive)
      .reduce((largest, t) => {
        const size = GameState.getAliveTeamUnits(t).length
        return size > (largest ? GameState.getAliveTeamUnits(largest).length : 0) ? t : largest
      }, null)
    return largestPlayerTeam ? { targetTeamId: largestPlayerTeam.id } : {}
  }

  findWeakAlliedTeam(shieldTeam) {
    let weakestId = null
    let minRatio = 0.8
    GameState.allAITeams.forEach(t => {
      if (t.id === shieldTeam.id) return
      const units = GameState.getAliveTeamUnits(t)
      if (units.length === 0) return
      const ratio = units.reduce((s, u) => s + u.hp / u.maxHp, 0) / units.length
      if (ratio < minRatio) { minRatio = ratio; weakestId = t.id }
    })
    return weakestId
  }
}

export const commanderAI = new CommanderAI()
