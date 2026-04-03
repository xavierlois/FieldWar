import { hexToWorld, effectiveHeight, hexDistance } from '../core/HexGrid.js'
import { getUnitType } from '../units/UnitTypes.js'

// Check line of sight between two hex positions
// Returns true if attacker can see target
export function hasLOS(grid, fromQ, fromR, toQ, toR) {
  if (fromQ === toQ && fromR === toR) return true

  // Get all hexes on the line between from and to
  const hexLine = getHexLine(fromQ, fromR, toQ, toR)
  const fromH = getHexHeight(grid, fromQ, fromR)
  const toH = getHexHeight(grid, toQ, toR)

  // Check intermediate hexes for blocking
  for (let i = 1; i < hexLine.length - 1; i++) {
    const { q, r } = hexLine[i]
    const hex = grid.get(`${q},${r}`)
    if (!hex) continue

    const h = effectiveHeight(hex)
    const t = i / (hexLine.length - 1)
    // Interpolated height at this point along the ray
    const interpolatedH = fromH + (toH - fromH) * t

    // House blocks LOS completely
    if (hex.building?.type === 'house' || hex.building?.type === 'rock') {
      return false
    }

    // Higher ground blocks if taller than the interpolated line
    if (h > interpolatedH + 0.5) {
      return false
    }
  }
  return true
}

function getHexHeight(grid, q, r) {
  const hex = grid.get(`${q},${r}`)
  return hex ? effectiveHeight(hex) : 0
}

export function getDynamicAttackRange(team, grid, targetQ, targetR) {
  const uClass = getUnitType(team.unitType)
  const baseRange = uClass.attackRange || 1
  if (team.unitType === 'archer') {
    const fromH = getHexHeight(grid, team.q, team.r)
    const toH = getHexHeight(grid, targetQ, targetR)
    return fromH > toH ? 3 : 2
  }
  return baseRange
}

// Get hex coordinates along a line (cube coordinate lerp)
function getHexLine(q1, r1, q2, r2) {
  const dist = hexDistance(q1, r1, q2, r2)
  if (dist === 0) return [{ q: q1, r: r1 }]

  const results = []
  for (let i = 0; i <= dist; i++) {
    const t = i / dist
    const fq = q1 + (q2 - q1) * t
    const fr = r1 + (r2 - r1) * t
    const fs = -fq - fr

    let rq = Math.round(fq), rr = Math.round(fr), rs = Math.round(fs)
    const dq = Math.abs(rq - fq), dr = Math.abs(rr - fr), ds = Math.abs(rs - fs)
    if (dq > dr && dq > ds) rq = -rr - rs
    else if (dr > ds) rr = -rq - rs

    results.push({ q: rq, r: rr })
  }
  return results
}

// Get all hexes within attack range that have LOS
export function getAttackHexes(grid, fromQ, fromR, range) {
  const results = []
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
      const q = fromQ + dq, r = fromR + dr
      if (q === fromQ && r === fromR) continue
      if (!grid.has(`${q},${r}`)) continue
      if (hasLOS(grid, fromQ, fromR, q, r)) {
        results.push({ q, r })
      }
    }
  }
  return results
}
