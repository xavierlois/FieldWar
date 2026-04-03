// Inline SVG sprites for unit types
// All are top-down silhouette style, 64x64 viewBox
// Faction color is applied as a tint overlay in the renderer

export const UNIT_SVGS = {
  'foot-soldier': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="#1a1f2e" opacity="0.6"/>
    <ellipse cx="32" cy="36" rx="12" ry="14" fill="currentColor"/>
    <circle cx="32" cy="18" r="10" fill="currentColor"/>
    <line x1="46" y1="8" x2="46" y2="58" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <polygon points="46,4 43,13 49,13" fill="currentColor"/>
  </svg>`,

  'archer': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="#1a1f2e" opacity="0.6"/>
    <ellipse cx="32" cy="37" rx="10" ry="12" fill="currentColor"/>
    <circle cx="32" cy="20" r="9" fill="currentColor"/>
    <path d="M48 12 Q50 30 48 48" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
    <line x1="48" y1="12" x2="48" y2="48" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
    <line x1="24" y1="30" x2="46" y2="30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="46,30 41,27 41,33" fill="currentColor"/>
  </svg>`,

  'shield-bearer': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="#1a1f2e" opacity="0.6"/>
    <rect x="10" y="20" width="22" height="30" rx="4" fill="currentColor" opacity="0.9"/>
    <line x1="10" y1="35" x2="32" y2="35" stroke="currentColor" stroke-width="1" opacity="0.3"/>
    <line x1="21" y1="20" x2="21" y2="50" stroke="currentColor" stroke-width="1" opacity="0.3"/>
    <ellipse cx="44" cy="36" rx="9" ry="12" fill="currentColor" opacity="0.8"/>
    <circle cx="44" cy="20" r="9" fill="currentColor"/>
  </svg>`,

  'swordsman': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="#1a1f2e" opacity="0.6"/>
    <ellipse cx="32" cy="37" rx="11" ry="13" fill="currentColor"/>
    <circle cx="32" cy="20" r="9" fill="currentColor"/>
    <line x1="44" y1="10" x2="20" y2="46" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <line x1="36" y1="22" x2="28" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="42" cy="12" r="3" fill="currentColor"/>
  </svg>`,

  'knight': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="#1a1f2e" opacity="0.6"/>
    <ellipse cx="32" cy="42" rx="20" ry="12" fill="currentColor" opacity="0.9"/>
    <ellipse cx="28" cy="28" rx="10" ry="8" fill="currentColor"/>
    <circle cx="38" cy="18" r="9" fill="currentColor"/>
    <line x1="14" y1="48" x2="10" y2="58" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="26" y1="50" x2="24" y2="58" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="38" y1="50" x2="40" y2="58" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="46" x2="54" y2="56" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="46" y1="12" x2="46" y2="4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <line x1="42" y1="8" x2="50" y2="8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
}

export const BUILDING_SVGS = {
  'tower': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="18" width="32" height="38" fill="#4a4a5e" stroke="#6a6a8e" stroke-width="1.5"/>
    <rect x="12" y="14" width="10" height="8" fill="#4a4a5e" stroke="#6a6a8e" stroke-width="1.5"/>
    <rect x="27" y="10" width="10" height="10" fill="#4a4a5e" stroke="#6a6a8e" stroke-width="1.5"/>
    <rect x="42" y="14" width="10" height="8" fill="#4a4a5e" stroke="#6a6a8e" stroke-width="1.5"/>
    <rect x="26" y="36" width="12" height="20" fill="#3a3a4e"/>
    <rect x="28" y="26" width="8" height="8" fill="#2a2a3e"/>
  </svg>`,

  'forest': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="28" r="14" fill="#2d5a27" opacity="0.9"/>
    <circle cx="40" cy="26" r="13" fill="#3a6e33" opacity="0.9"/>
    <circle cx="32" cy="20" r="12" fill="#4a8040" opacity="0.9"/>
    <circle cx="20" cy="38" r="10" fill="#2d5a27" opacity="0.8"/>
    <circle cx="44" cy="38" r="10" fill="#3a6e33" opacity="0.8"/>
    <circle cx="32" cy="42" r="9" fill="#244820" opacity="0.7"/>
  </svg>`,

  'house': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="28" width="40" height="28" fill="#5a4a3a" stroke="#7a6a5a" stroke-width="1.5"/>
    <polygon points="8,30 32,10 56,30" fill="#7a5a4a" stroke="#9a7a6a" stroke-width="1.5"/>
    <rect x="26" y="40" width="12" height="16" fill="#3a2a1a"/>
    <rect x="16" y="32" width="10" height="10" fill="#7a9ab0" opacity="0.5"/>
    <rect x="38" y="32" width="10" height="10" fill="#7a9ab0" opacity="0.5"/>
  </svg>`,

  'rock': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="36" rx="24" ry="18" fill="#5a5a5a"/>
    <polygon points="12,38 20,20 36,14 50,22 54,40 42,52 22,52" fill="#6a6a6a" stroke="#4a4a4a" stroke-width="1"/>
    <polygon points="20,28 32,20 44,26 40,36 22,36" fill="#7a7a7a"/>
  </svg>`,

  'trench': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="22" width="48" height="20" fill="#3a2e1a" stroke="#5a4e3a" stroke-width="1.5"/>
    <line x1="8" y1="30" x2="56" y2="30" stroke="#4a3e2a" stroke-width="1"/>
    <line x1="20" y1="22" x2="20" y2="42" stroke="#4a3e2a" stroke-width="1"/>
    <line x1="32" y1="22" x2="32" y2="42" stroke="#4a3e2a" stroke-width="1"/>
    <line x1="44" y1="22" x2="44" y2="42" stroke="#4a3e2a" stroke-width="1"/>
    <rect x="8" y="18" width="48" height="4" fill="#5a4e2a"/>
    <rect x="8" y="42" width="48" height="4" fill="#5a4e2a"/>
  </svg>`,
}

// Convert SVG string to Data URI for use as texture
export function svgToDataURI(svgStr) {
  const encoded = encodeURIComponent(svgStr)
  return `data:image/svg+xml,${encoded}`
}

// Create a colored canvas from SVG + tint color
export function svgToCanvas(svgStr, tintColor, size = 64) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      // Fill with tint color first
      ctx.fillStyle = tintColor
      ctx.fillRect(0, 0, size, size)
      // Draw SVG with multiply blend
      ctx.globalCompositeOperation = 'multiply'
      ctx.drawImage(img, 0, 0, size, size)
      // Draw SVG again for the silhouette
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(img, 0, 0, size, size)
      ctx.globalCompositeOperation = 'source-over'
      resolve(canvas)
    }
    // Replace currentColor with tint
    const colored = svgStr.replace(/currentColor/g, tintColor)
    img.src = svgToDataURI(colored)
  })
}

// Simpler: draw SVG with tint color replacing currentColor
export function createUnitCanvas(unitType, tintColor, size = 64) {
  const svgStr = UNIT_SVGS[unitType] || UNIT_SVGS['foot-soldier']
  return svgToCanvas(svgStr, tintColor, size)
}

// Create a unit canvas with a count badge drawn on top
// Returns { canvas, ctx, baseCanvas } so the count can be redrawn cheaply
export async function createTeamCanvas(unitType, tintColor, size, count) {
  const baseCanvas = await createUnitCanvas(unitType, tintColor, size)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  drawTeamCount(ctx, baseCanvas, size, count)
  return { canvas, ctx, baseCanvas }
}

// Redraw base + count badge onto an existing ctx (synchronous — call when count changes)
export function drawTeamCount(ctx, baseCanvas, size, count) {
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(baseCanvas, 0, 0)
  if (count <= 1) return
  // Badge circle
  const r = size * 0.22
  const bx = size - r - 2, by = size - r - 2
  ctx.beginPath()
  ctx.arc(bx, by, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = size * 0.03
  ctx.stroke()
  // Count text
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), bx, by)
}

export function createBuildingCanvas(buildingType, size = 64) {
  const svgStr = BUILDING_SVGS[buildingType] || BUILDING_SVGS['rock']
  return svgToCanvas(svgStr, '#888888', size)
}
