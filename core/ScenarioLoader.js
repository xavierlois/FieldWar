import { GameState } from './GameState.js'
import { buildGrid, hexToWorld } from './HexGrid.js'
import { Unit, resetUnitIdCounter } from '../units/Unit.js'
import { Team, resetTeamIdCounter } from '../units/Team.js'
import { getUnitType } from '../units/UnitTypes.js'

// Auto-place teams in the deployment zone for each faction.
// Works with any hex grid layout (simple or staggered rectangular).
// Deployment zones are determined by world-Z: AI gets the lowest-Z hexes
// (top of screen), player gets the highest-Z hexes (bottom of screen).
function autoPlaceTeams(teams, grid, faction) {
  // Sort all passable hexes by world-Z
  const hexesByZ = []
  for (const hex of grid.values()) {
    if (!hex.passable) continue
    const w = hexToWorld(hex.q, hex.r)
    hexesByZ.push({ q: hex.q, r: hex.r, z: w.z })
  }
  hexesByZ.sort((a, b) => a.z - b.z)

  // Use the outermost 22% of hexes as deployment zone (≈ 4 rows out of 22)
  const zoneSize = Math.max(20, Math.ceil(hexesByZ.length * 0.22))
  const deployList = faction === 'player'
    ? hexesByZ.slice(-zoneSize)   // highest Z = player side (bottom of screen)
    : hexesByZ.slice(0, zoneSize) // lowest Z  = AI side (top of screen)

  // Build a fast lookup set
  const deploySet = new Set(deployList.map(h => `${h.q},${h.r}`))

  // Group teams by type so each type lands in its own column
  const byType = []
  const seen = new Map()
  teams.forEach(t => {
    if (!seen.has(t.unitType)) { seen.set(t.unitType, []); byType.push(seen.get(t.unitType)) }
    seen.get(t.unitType).push(t)
  })

  const colOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]

  byType.forEach((typeTeams, typeIdx) => {
    const targetQ = colOffsets[typeIdx % colOffsets.length]

    typeTeams.forEach(team => {
      let placed = false

      // Search columns outward from targetQ until a free deploy hex is found
      for (let delta = 0; delta <= 16 && !placed; delta++) {
        const candidates = delta === 0 ? [targetQ] : [targetQ + delta, targetQ - delta]
        for (const q of candidates) {
          for (const h of deployList) {
            if (h.q !== q) continue
            const hex = grid.get(`${h.q},${h.r}`)
            if (hex && hex.passable && !hex.teamId) {
              team.q = h.q; team.r = h.r; hex.teamId = team.id
              placed = true; break
            }
          }
          if (placed) break
        }
      }

      // Last resort: any free hex in deploy zone
      if (!placed) {
        for (const h of deployList) {
          const hex = grid.get(`${h.q},${h.r}`)
          if (hex?.passable && !hex.teamId) {
            team.q = h.q; team.r = h.r; hex.teamId = team.id; break
          }
        }
      }
    })
  })
}

export async function loadScenario(scenarioId, unitOverride = null) {
  resetUnitIdCounter()
  resetTeamIdCounter()
  GameState.reset()

  const resp = await fetch(`scenarios/${scenarioId}.json`)
  const data = await resp.json()

  GameState.scenarioId = scenarioId
  GameState.scenarioName = data.name
  GameState.objective = data.objective || 'eliminate_all'
  GameState.objectiveHex = data.objectiveHex || null
  GameState.objectiveTurns = data.objectiveTurns || null

  // Build grid
  const { grid, offsetQ, offsetR, cols, rows } = buildGrid(data.grid.hexes, data.buildings || [])
  GameState.grid = grid
  GameState.gridOffsetQ = offsetQ
  GameState.gridOffsetR = offsetR
  GameState.gridCols = cols
  GameState.gridRows = rows

  // Create units for both factions — use override if provided
  const playerUnitDefs = unitOverride?.player || data.units.player || []
  const aiUnitDefs = unitOverride?.ai || data.units.ai || []

  // Expand unit defs (count field)
  function expandUnits(defs, faction) {
    const units = []
    defs.forEach(def => {
      const count = def.count || 1
      for (let i = 0; i < count; i++) {
        units.push(new Unit({ type: def.type, faction }))
      }
    })
    return units
  }

  const playerUnits = expandUnits(playerUnitDefs, 'player')
  const aiUnits = expandUnits(aiUnitDefs, 'ai')

  // Register units
  playerUnits.forEach(u => GameState.units.set(u.id, u))
  aiUnits.forEach(u => GameState.units.set(u.id, u))

  // Create default teams (one team per unit type per faction)
  function createDefaultTeams(units, factionMap) {
    const byType = {}
    units.forEach(u => {
      if (!byType[u.type]) byType[u.type] = []
      byType[u.type].push(u.id)
    })
    Object.entries(byType).forEach(([type, ids]) => {
      const typeDef = getUnitType(type)
      const team = new Team({
        unitType: type,
        unitIds: ids,
        faction: units[0].faction,
        label: typeDef.label
      })
      factionMap.set(team.id, team)
    })
  }

  createDefaultTeams(playerUnits, GameState.playerTeams)
  createDefaultTeams(aiUnits, GameState.aiTeams)

  // Auto-place teams
  autoPlaceTeams([...GameState.playerTeams.values()], grid, 'player')
  autoPlaceTeams([...GameState.aiTeams.values()], grid, 'ai')

  // Register grid locations
  GameState.playerTeams.forEach(t => GameState.placeTeam(t))
  GameState.aiTeams.forEach(t => GameState.placeTeam(t))

  GameState.phase = 'pre-battle'
  return data
}

// Apply player's team split decisions (called from PreBattleScreen)
export function applyTeamSplits(splits) {
  // splits: [{unitType, groups: [[unitId, ...], [unitId, ...], ...]}]
  // Clear existing player teams from grid
  GameState.playerTeams.forEach(t => {
    const hex = GameState.grid.get(`${t.q},${t.r}`)
    if (hex && hex.teamId === t.id) hex.teamId = null
  })

  GameState.playerTeams.clear()
  // NOTE: do NOT reset team ID counter here — AI teams already hold IDs from
  // the initial loadScenario pass and resetting would cause ID collisions.

  splits.forEach(({ unitType, groups }) => {
    const typeDef = getUnitType(unitType)
    groups.forEach((unitIds, idx) => {
      if (unitIds.length === 0) return
      const label = groups.length > 1
        ? `${typeDef.label} ${String.fromCharCode(65 + idx)}`
        : typeDef.label
      const team = new Team({ unitType, unitIds, faction: 'player', label })
      GameState.playerTeams.set(team.id, team)
    })
  })

  // Auto-place new split teams
  autoPlaceTeams([...GameState.playerTeams.values()], GameState.grid, 'player')
  GameState.playerTeams.forEach(t => GameState.placeTeam(t))
}
