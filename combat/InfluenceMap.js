import { hexesInRange, hexDistance, effectiveHeight } from '../core/HexGrid.js'
import { GameState } from '../core/GameState.js'
import { hasLOS } from './LineOfSight.js'

// Influence maps for Hard AI difficulty
// Updated once per round

export class InfluenceMap {
  constructor() {
    this.threat = new Map()    // danger level per hex (from player units)
    this.control = new Map()   // faction control (-1 ai, +1 player)
    this.cover = new Map()     // defensive value per hex
    this.flanks = new Map()    // flanking opportunity value per hex
  }

  update(grid, playerUnits, aiUnits) {
    this.threat.clear()
    this.control.clear()
    this.cover.clear()
    this.flanks.clear()

    // Initialize all hexes to 0
    grid.forEach((hex, key) => {
      this.threat.set(key, 0)
      this.control.set(key, 0)
      this.cover.set(key, 0)
      this.flanks.set(key, 0)
    })

    // Threat map: player unit attack ranges
    playerUnits.forEach(unit => {
      const range = unit.attackRange + 1
      hexesInRange(unit.q, unit.r, range).forEach(({ q, r }) => {
        const key = `${q},${r}`
        if (!grid.has(key)) return
        const dist = hexDistance(unit.q, unit.r, q, r)
        const threatVal = (unit.attackValue * unit.hp) / (dist + 1)
        this.threat.set(key, (this.threat.get(key) || 0) + threatVal)
      })
    })

    // Control map: unit proximity dominance
    playerUnits.forEach(u => {
      hexesInRange(u.q, u.r, 3).forEach(({ q, r }) => {
        const key = `${q},${r}`
        if (!grid.has(key)) return
        this.control.set(key, (this.control.get(key) || 0) + 1)
      })
    })
    aiUnits.forEach(u => {
      hexesInRange(u.q, u.r, 3).forEach(({ q, r }) => {
        const key = `${q},${r}`
        if (!grid.has(key)) return
        this.control.set(key, (this.control.get(key) || 0) - 1)
      })
    })

    // Cover map: defensive value
    grid.forEach((hex, key) => {
      let cover = 0
      if (hex.height === 0) cover += 1
      if (hex.height === 2) cover += 1
      if (hex.building?.type === 'forest') cover += 2
      if (hex.building?.type === 'trench') cover += 2
      if (hex.building?.type === 'house') cover += 3
      if (hex.building?.type === 'rock') cover += 2
      this.cover.set(key, cover)
    })

    // Flanking corridors: low-threat paths around enemy
    aiUnits.forEach(unit => {
      hexesInRange(unit.q, unit.r, 4).forEach(({ q, r }) => {
        const key = `${q},${r}`
        if (!grid.has(key)) return
        const threat = this.threat.get(key) || 0
        if (threat < 2) {
          this.flanks.set(key, (this.flanks.get(key) || 0) + 1)
        }
      })
    })
  }

  getThreat(q, r)  { return this.threat.get(`${q},${r}`) || 0 }
  getControl(q, r) { return this.control.get(`${q},${r}`) || 0 }
  getCover(q, r)   { return this.cover.get(`${q},${r}`) || 0 }
  getFlank(q, r)   { return this.flanks.get(`${q},${r}`) || 0 }
}

export const influenceMap = new InfluenceMap()
