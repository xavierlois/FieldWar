import { hexDistance, reachableHexes, effectiveHeight, hexNeighbors, hexPath } from '../core/HexGrid.js'
import { hasLOS } from '../combat/LineOfSight.js'
import { influenceMap } from '../combat/InfluenceMap.js'
import { GameState } from '../core/GameState.js'

// Tier 2: Utility scoring for individual AI unit actions
// Returns the best action for the unit given its current command

export function scoreActions(unit, command, grid, difficulty) {
  const enemies = GameState.playerUnits
  const allies = GameState.aiUnits

  // Enumerate candidate move targets
  const reachable = reachableHexes(grid, unit.q, unit.r, unit.ap)
  const candidates = [{ q: unit.q, r: unit.r, cost: 0 }, ...reachable.entries().map ?
    [...reachable].map(([key, cost]) => {
      const [q, r] = key.split(',').map(Number)
      return { q, r, cost }
    }) :
    (() => {
      const arr = []
      reachable.forEach((cost, key) => {
        const [q, r] = key.split(',').map(Number)
        arr.push({ q, r, cost })
      })
      return arr
    })()
  ]

  if (candidates.length === 0) return { q: unit.q, r: unit.r, score: 0 }

  let best = null
  let bestScore = -Infinity

  candidates.forEach(({ q, r, cost }) => {
    const hex = grid.get(`${q},${r}`)
    if (!hex?.passable) return
    // Don't move onto a hex occupied by own unit (unless staying)
    if (q !== unit.q || r !== unit.r) {
      if (hex.unitId && hex.unitId !== unit.id) return
    }

    const score = scorePosition(unit, q, r, command, enemies, allies, grid, difficulty, cost)
    if (score > bestScore) {
      bestScore = score
      best = { q, r, score }
    }
  })

  return best || { q: unit.q, r: unit.r, score: 0 }
}

function scorePosition(unit, q, r, command, enemies, allies, grid, difficulty, apCost) {
  let score = 0
  const hex = grid.get(`${q},${r}`)
  if (!hex) return -9999

  // Easy: random noise dominates
  if (difficulty === 'easy') {
    return Math.random() * 10 - 5
  }

  const myHeight = effectiveHeight(hex)

  // ── Terrain advantage ──
  score += myHeight * 1.5

  // Cover value
  const coverMap = { none: 0, partial: 1.5, full: 2.5 }
  // (cover imported via getCoverType)

  // Influence map bonuses (Hard only)
  if (difficulty === 'hard') {
    const threat = influenceMap.getThreat(q, r)
    const cover = influenceMap.getCover(q, r)
    const flank = influenceMap.getFlank(q, r)
    score -= threat * 0.8
    score += cover * 0.6
    score += flank * 0.4
  }

  // ── Command alignment ──
  switch (command) {
    case 'charge':
    case 'attack-along-path': {
      // Want to be close to enemies
      const nearestEnemy = findNearest(q, r, enemies)
      if (nearestEnemy) {
        const dist = hexDistance(q, r, nearestEnemy.q, nearestEnemy.r)
        score += (8 - dist) * 2
        // Attack range bonus
        if (dist <= unit.attackRange) score += 5
      }
      break
    }
    case 'hold-the-line':
    case 'guard-position': {
      // Stay put or on target hex
      const stayScore = (q === unit.q && r === unit.r) ? 3 : 0
      score += stayScore + myHeight * 2
      break
    }
    case 'ordered-retreat':
    case 'scatter': {
      // Move away from enemies
      const nearestEnemy = findNearest(q, r, enemies)
      if (nearestEnemy) {
        const dist = hexDistance(q, r, nearestEnemy.q, nearestEnemy.r)
        score += dist * 1.5
      }
      // Move toward own side (AI = low r values)
      score -= r * 0.5
      break
    }
    case 'overwatch':
    case 'suppressive-fire': {
      // High ground with LOS to enemies
      score += myHeight * 2
      const coverableEnemies = enemies.filter(e =>
        hexDistance(q, r, e.q, e.r) <= unit.attackRange &&
        hasLOS(GameState.grid, q, r, e.q, e.r)
      ).length
      score += coverableEnemies * 3
      break
    }
    case 'ambush': {
      // Valley or forest for hiding
      if (hex.height === 0 || hex.building?.type === 'forest') score += 4
      // Near expected enemy path
      const nearestEnemy = findNearest(q, r, enemies)
      if (nearestEnemy) {
        const dist = hexDistance(q, r, nearestEnemy.q, nearestEnemy.r)
        if (dist <= unit.attackRange + 1) score += 3
      }
      break
    }
    case 'envelop': {
      // Get to side/rear of enemies
      const nearestEnemy = findNearest(q, r, enemies)
      if (nearestEnemy) {
        // Prefer positions to the side
        const dq = Math.abs(q - nearestEnemy.q)
        const dr = Math.abs(r - nearestEnemy.r)
        if (dq > dr) score += 3  // lateral position = flanking
        score += 5 / (hexDistance(q, r, nearestEnemy.q, nearestEnemy.r) + 1)
      }
      break
    }
    default: {
      // Default: advance toward enemies
      const nearestEnemy = findNearest(q, r, enemies)
      if (nearestEnemy) {
        const dist = hexDistance(q, r, nearestEnemy.q, nearestEnemy.r)
        score += (10 - dist) * 1.5
        if (dist <= unit.attackRange) score += 4
      }
    }
  }

  // ── Exposure penalty ──
  const exposedToCount = enemies.filter(e =>
    hexDistance(q, r, e.q, e.r) <= e.attackRange &&
    hasLOS(GameState.grid, q, r, e.q, e.r)
  ).length
  score -= exposedToCount * 1.5

  // ── AP efficiency ──
  score -= apCost * 0.2

  // ── Medium: add small noise ──
  if (difficulty === 'medium') score += (Math.random() - 0.5) * 2

  return score
}

function findNearest(q, r, units) {
  if (units.length === 0) return null
  return units.reduce((best, u) => {
    const d = hexDistance(q, r, u.q, u.r)
    return !best || d < hexDistance(q, r, best.q, best.r) ? u : best
  }, null)
}
