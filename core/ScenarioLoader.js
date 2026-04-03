import { GameState } from './GameState.js'
import { buildGrid } from './HexGrid.js'
import { Unit, resetUnitIdCounter } from '../units/Unit.js'
import { Team, resetTeamIdCounter } from '../units/Team.js'
import { getUnitType } from '../units/UnitTypes.js'

// Auto-place units in back rows for each faction
function autoPlaceUnits(units, grid, faction, gridRows, gridCols) {
  const placed = []
  const startRows = faction === 'player'
    ? [gridRows - 1, gridRows - 2, gridRows - 3]  // bottom rows (high r)
    : [0, 1, 2]                                     // top rows (low r)

  // Center columns
  const midQ = Math.floor(gridCols / 2)
  const colOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4]

  let placedCount = 0
  for (const rowIdx of startRows) {
    for (const colOffset of colOffsets) {
      if (placedCount >= units.length) break
      const q = midQ + colOffset - Math.floor(gridCols / 2)
      // Map rowIdx to actual r coordinate (grid is centered)
      const r = rowIdx - Math.floor(gridRows / 2)
      const key = `${q},${r}`
      const hex = grid.get(key)
      if (!hex || !hex.passable || hex.unitId) continue
      units[placedCount].q = q
      units[placedCount].r = r
      placed.push(units[placedCount])
      placedCount++
    }
    if (placedCount >= units.length) break
  }
  return placed
}

export async function loadScenario(scenarioId) {
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

  // Create units for both factions
  const playerUnitDefs = data.units.player || []
  const aiUnitDefs = data.units.ai || []

  // Expand unit defs (count field)
  function expandUnits(defs, faction) {
    const units = []
    defs.forEach(def => {
      const count = def.count || 1
      for (let i = 0; i < count; i++) {
        units.push(new Unit({ type: def.type, faction, q: 0, r: 0 }))
      }
    })
    return units
  }

  const playerUnits = expandUnits(playerUnitDefs, 'player')
  const aiUnits = expandUnits(aiUnitDefs, 'ai')

  // Auto-place units in back rows
  autoPlaceUnits(playerUnits, grid, 'player', rows, cols)
  autoPlaceUnits(aiUnits, grid, 'ai', rows, cols)

  // Register units + place on grid
  playerUnits.forEach(u => { GameState.units.set(u.id, u); GameState.placeUnit(u) })
  aiUnits.forEach(u => { GameState.units.set(u.id, u); GameState.placeUnit(u) })

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

  GameState.phase = 'pre-battle'
  return data
}

// Apply player's team split decisions (called from PreBattleScreen)
export function applyTeamSplits(splits) {
  // splits: [{unitType, groups: [[unitId, ...], [unitId, ...], ...]}]
  // Clear existing player teams
  GameState.playerTeams.clear()
  resetTeamIdCounter()

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
}
