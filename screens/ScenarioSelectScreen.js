import { EventBus } from '../core/EventBus.js'

const overlay = () => document.getElementById('screen-overlay')

export function showScenarioSelect() {
  const el = overlay()
  el.classList.remove('hidden')
  el.innerHTML = `
    <div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">
      <canvas id="title-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;"></canvas>

      <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:48px 24px 36px;">

        <div style="text-align:center;margin-top:20px;">
          <div style="
            font-family:'Barlow Condensed',sans-serif;
            font-size:80px; font-weight:700; letter-spacing:12px;
            text-transform:uppercase; line-height:0.88;
            color:#e6edf3;
            text-shadow:0 0 60px rgba(43,127,212,0.6),0 0 20px rgba(43,127,212,0.3),0 4px 24px rgba(0,0,0,0.9);
          ">FIELD</div>
          <div style="
            font-family:'Barlow Condensed',sans-serif;
            font-size:80px; font-weight:700; letter-spacing:12px;
            text-transform:uppercase; line-height:0.88;
            color:#2B7FD4;
            text-shadow:0 0 60px rgba(43,127,212,0.9),0 0 30px rgba(43,127,212,0.5),0 4px 24px rgba(0,0,0,0.9);
          ">WAR</div>
          <div style="
            font-family:'Share Tech Mono',monospace;
            font-size:11px; letter-spacing:5px; color:#8b949e;
            margin-top:14px; text-transform:uppercase;
            text-shadow:0 1px 4px rgba(0,0,0,0.8);
          ">Hex Tactical Combat</div>
        </div>

        <div style="width:100%;display:flex;flex-direction:column;gap:10px;">
          <div style="
            font-family:'Barlow Condensed',sans-serif;
            font-size:11px; letter-spacing:3px; color:#8b949e;
            text-align:center; text-transform:uppercase; margin-bottom:6px;
          ">Choose Your Battle</div>

          <button class="troops-btn" data-troops="same" style="
            display:flex; align-items:center; gap:14px;
            background:rgba(22,27,34,0.92); border:1px solid #30363d;
            border-radius:4px; padding:16px 18px; cursor:pointer;
            transition:all 0.12s; width:100%; text-align:left;
            font-family:'Barlow Condensed',sans-serif;
          ">
            <div style="font-size:28px;line-height:1;">⚔</div>
            <div>
              <div style="font-size:17px;font-weight:700;letter-spacing:2px;color:#e6edf3;text-transform:uppercase;">Same Troops</div>
              <div style="font-size:12px;color:#8b949e;margin-top:2px;letter-spacing:1px;">Mirror match · balanced armies</div>
            </div>
          </button>

          <button class="troops-btn" data-troops="different" style="
            display:flex; align-items:center; gap:14px;
            background:rgba(22,27,34,0.92); border:1px solid #30363d;
            border-radius:4px; padding:16px 18px; cursor:pointer;
            transition:all 0.12s; width:100%; text-align:left;
            font-family:'Barlow Condensed',sans-serif;
          ">
            <div style="font-size:28px;line-height:1;">♜</div>
            <div>
              <div style="font-size:17px;font-weight:700;letter-spacing:2px;color:#e6edf3;text-transform:uppercase;">Different Troops</div>
              <div style="font-size:12px;color:#8b949e;margin-top:2px;letter-spacing:1px;">Asymmetric · strategic choices</div>
            </div>
          </button>
        </div>

      </div>
    </div>
  `

  // Draw hex map after layout is ready
  requestAnimationFrame(() => {
    const canvas = document.getElementById('title-canvas')
    if (canvas) _drawTitleMap(canvas)
  })

  // Hover glow effect
  el.querySelectorAll('.troops-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#2B7FD4'
      btn.style.background = 'rgba(43,127,212,0.12)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#30363d'
      btn.style.background = 'rgba(22,27,34,0.92)'
    })
    btn.addEventListener('click', () => {
      EventBus.emit('scenario-selected', { troops: btn.dataset.troops })
    })
  })
}

export function hideScenarioSelect() {
  overlay().classList.add('hidden')
  overlay().innerHTML = ''
}

// ── Canvas map drawing ─────────────────────────────────────────

function _drawTitleMap(canvas) {
  const W = canvas.offsetWidth || 360
  const H = canvas.offsetHeight || 640
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#070c0e'
  ctx.fillRect(0, 0, W, H)

  // Hex grid — flat-top, R=20px
  const R = 20
  const HH = Math.sqrt(3) * R
  const cols = Math.ceil(W / (R * 1.5)) + 2
  const rows = Math.ceil(H / HH) + 3

  // Deterministic LCG
  let seed = 0xABCD1234
  const rand = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0
    return (seed >>> 0) / 0xFFFFFFFF
  }

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cx = (col - 0.5) * R * 1.5
      const cy = (row - 1) * HH + (col % 2 ? HH * 0.5 : 0)
      const rv = rand()
      let fill, stroke
      if      (rv < 0.07) { fill = '#0f1f0f'; stroke = '#1a381a' }  // forest
      else if (rv < 0.14) { fill = '#181812'; stroke = '#28281a' }  // hill
      else if (rv < 0.18) { fill = '#0c1520'; stroke = '#142030' }  // water / river
      else                { fill = '#0c1410'; stroke = '#142018' }  // plain
      _hexFill(ctx, cx, cy, R * 0.97, fill, stroke)
    }
  }

  // Unit markers — player (blue) bottom, AI (orange) top
  const playerPositions = [
    [0.22, 0.70], [0.38, 0.66], [0.54, 0.70], [0.70, 0.66],
    [0.30, 0.81], [0.50, 0.79], [0.68, 0.77]
  ]
  const aiPositions = [
    [0.22, 0.30], [0.38, 0.26], [0.54, 0.30], [0.70, 0.26],
    [0.30, 0.19], [0.50, 0.21], [0.68, 0.23]
  ]

  playerPositions.forEach(([fx, fy]) => _unitDot(ctx, fx * W, fy * H, '#2B7FD4', '#1a5290'))
  aiPositions.forEach(([fx, fy])     => _unitDot(ctx, fx * W, fy * H, '#E8820C', '#9e580a'))

  // Battle line
  ctx.save()
  ctx.strokeStyle = 'rgba(232,130,12,0.15)'
  ctx.lineWidth = 1
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(0, H * 0.5)
  ctx.lineTo(W, H * 0.5)
  ctx.stroke()
  ctx.restore()

  // Radial vignette — darken edges
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.9)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(0.6, 'rgba(0,0,0,0.3)')
  vg.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
}

function _hexFill(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 0.5
  ctx.stroke()
}

function _unitDot(ctx, x, y, color, shadow) {
  // Outer glow
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fillStyle = shadow
  ctx.fill()
  // Inner fill
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  // Rim
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
}
