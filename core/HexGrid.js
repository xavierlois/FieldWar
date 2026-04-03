// Axial hex coordinate system (flat-top hexes)
// q = column, r = row

export const HEX_RADIUS = 1.0  // Three.js world units

// 6 neighbor directions for flat-top hex (axial)
export const HEX_DIRS = [
  { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
  { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 }
]

export function hexKey(q, r) { return `${q},${r}` }

// Axial → world position (flat-top hex layout)
export function hexToWorld(q, r) {
  return {
    x: HEX_RADIUS * 1.5 * q,
    z: HEX_RADIUS * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
  }
}

// World position → nearest axial hex (for raycasting)
export function worldToHex(x, z) {
  const q = (2 / 3 * x) / HEX_RADIUS
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / HEX_RADIUS
  return hexRound(q, r)
}

// Hex distance
export function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
}

// Round fractional hex to nearest integer hex
export function hexRound(fq, fr) {
  const fs = -fq - fr
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs)
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

// Get all hexes within range N of (q,r)
export function hexesInRange(q, r, n) {
  const results = []
  for (let dq = -n; dq <= n; dq++) {
    for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) {
      results.push({ q: q + dq, r: r + dr })
    }
  }
  return results
}

// Hex neighbors
export function hexNeighbors(q, r) {
  return HEX_DIRS.map(d => ({ q: q + d.q, r: r + d.r }))
}

// Direction index from one hex to adjacent hex (0-5, or -1 if not adjacent)
export function hexDirection(fromQ, fromR, toQ, toR) {
  const dq = toQ - fromQ, dr = toR - fromR
  return HEX_DIRS.findIndex(d => d.q === dq && d.r === dr)
}

// Flank angle: 0=front, 1=flank side, 2=rear (relative to facing direction)
// facing: direction index (0-5) the unit is currently facing
export function getFlankType(attackerQ, attackerR, defenderQ, defenderR, defenderFacing) {
  const atkDir = hexDirection(defenderQ, defenderR, attackerQ, attackerR)
  if (atkDir === -1) return 'front' // not adjacent
  const diff = ((atkDir - defenderFacing) % 6 + 6) % 6
  if (diff === 0) return 'rear'
  if (diff === 1 || diff === 5) return 'side'
  if (diff === 2 || diff === 4) return 'side'
  return 'front'
}

// BFS pathfinding on the hex grid
export function hexPath(grid, fromQ, fromR, toQ, toR, maxRange = 20) {
  const start = hexKey(fromQ, fromR)
  const end = hexKey(toQ, toR)
  if (start === end) return []

  const queue = [{ q: fromQ, r: fromR, path: [] }]
  const visited = new Set([start])

  while (queue.length > 0) {
    const { q, r, path } = queue.shift()
    if (path.length >= maxRange) continue

    for (const dir of HEX_DIRS) {
      const nq = q + dir.q, nr = r + dir.r
      const key = hexKey(nq, nr)
      if (visited.has(key)) continue
      const hex = grid.get(key)
      if (!hex || !hex.passable) continue

      const newPath = [...path, { q: nq, r: nr }]
      if (key === end) return newPath
      visited.add(key)
      queue.push({ q: nq, r: nr, path: newPath })
    }
  }
  return null // no path
}

// Get all reachable hexes within AP budget from (q, r)
export function reachableHexes(grid, q, r, apBudget) {
  const start = hexKey(q, r)
  const results = new Map([[start, 0]])
  const queue = [{ q, r, ap: 0 }]

  while (queue.length > 0) {
    const cur = queue.shift()
    for (const dir of HEX_DIRS) {
      const nq = cur.q + dir.q, nr = cur.r + dir.r
      const key = hexKey(nq, nr)
      const hex = grid.get(key)
      if (!hex || !hex.passable) continue
      const cost = moveCost(hex)
      const totalAP = cur.ap + cost
      if (totalAP > apBudget) continue
      if (results.has(key) && results.get(key) <= totalAP) continue
      results.set(key, totalAP)
      queue.push({ q: nq, r: nr, ap: totalAP })
    }
  }
  results.delete(start) // exclude starting position
  return results
}

export function moveCost(hex) {
  let cost = 1
  if (hex.height === 2) cost += 1 // uphill costs extra (simplified: we check delta height)
  if (hex.building?.type === 'forest' || hex.building?.type === 'trench') cost += 1
  return cost
}

// Grid factory: creates hex data from scenario definition
export function buildGrid(hexDefs, buildingDefs = []) {
  const grid = new Map()

  // Find bounds for offset calculation
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity
  hexDefs.forEach(({ q, r }) => {
    minQ = Math.min(minQ, q); maxQ = Math.max(maxQ, q)
    minR = Math.min(minR, r); maxR = Math.max(maxR, r)
  })
  const cols = maxQ - minQ + 1
  const rows = maxR - minR + 1
  const offsetQ = minQ + Math.floor(cols / 2)
  const offsetR = minR + Math.floor(rows / 2)

  hexDefs.forEach(def => {
    const q = def.q - offsetQ
    const r = def.r - offsetR
    grid.set(hexKey(q, r), {
      q, r,
      height: def.height ?? 1,
      building: null,
      unitId: null,
      passable: true,
    })
  })

  buildingDefs.forEach(def => {
    const q = def.q - offsetQ
    const r = def.r - offsetR
    const key = hexKey(q, r)
    const hex = grid.get(key)
    if (!hex) return
    hex.building = { type: def.type, occupantTeamId: null }
    if (def.type === 'house' || def.type === 'rock') hex.passable = false
  })

  return { grid, offsetQ, offsetR, cols, rows }
}

// Effective height of a hex (includes building bonus)
export function effectiveHeight(hex) {
  if (!hex) return 0
  let h = hex.height
  if (hex.building?.type === 'tower') h += 2
  if (hex.building?.type === 'forest') h += 1
  return h
}

// Cover value of a hex
export function getCoverType(hex) {
  if (!hex) return 'none'
  if (hex.building?.type === 'house') return 'full'
  if (hex.building?.type === 'rock') return 'partial'
  if (hex.building?.type === 'forest') return 'partial'
  if (hex.building?.type === 'trench') return 'partial'
  if (hex.height === 0) return 'partial' // valley
  return 'none'
}
