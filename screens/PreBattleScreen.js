import { GameState } from '../core/GameState.js'
import { applyTeamSplits } from '../core/ScenarioLoader.js'
import { getUnitType } from '../units/UnitTypes.js'
import { EventBus } from '../core/EventBus.js'

const overlay = () => document.getElementById('screen-overlay')

export function showPreBattleScreen() {
  const el = overlay()
  el.classList.remove('hidden')

  // Build unit type counts from player units
  const typeCounts = {}
  GameState.playerUnits.forEach(u => {
    typeCounts[u.type] = (typeCounts[u.type] || [])
    typeCounts[u.type].push(u.id)
  })

  // Build AI summary
  const aiTypeCounts = {}
  GameState.aiUnits.forEach(u => {
    aiTypeCounts[u.type] = (aiTypeCounts[u.type] || 0) + 1
  })

  const splits = {}  // unitType → number of teams selected
  Object.entries(typeCounts).forEach(([type, ids]) => {
    splits[type] = 1  // default: 1 team
  })

  function render() {
    el.innerHTML = `
      <div class="screen">
        <div>
          <div class="screen-title">${GameState.scenarioName}</div>
          <div class="screen-subtitle">DEPLOY YOUR FORCES</div>
        </div>

        <div class="side-preview">
          <div class="side-block player">
            <div class="side-label">Your Forces</div>
            ${Object.entries(typeCounts).map(([type, ids]) => {
              const def = getUnitType(type)
              return `<div style="font-size:13px;margin-bottom:3px">${def.icon} ${def.label}: ${ids.length}</div>`
            }).join('')}
          </div>
          <div class="side-block enemy">
            <div class="side-label">Enemy Forces</div>
            ${Object.entries(aiTypeCounts).map(([type, count]) => {
              const def = getUnitType(type)
              return `<div style="font-size:13px;margin-bottom:3px">${def.icon} ${def.label}: ${count}</div>`
            }).join('')}
          </div>
        </div>

        <div>
          <div class="screen-subtitle" style="margin-bottom:8px">TEAM FORMATION</div>
          <div class="screen-subtitle" style="font-size:11px;color:var(--text-muted);margin-bottom:12px;text-transform:none;letter-spacing:0">
            Split units into teams. Each team acts as one under a single command.
          </div>
          <div class="team-split-group">
            ${Object.entries(typeCounts).map(([type, ids]) => {
              const def = getUnitType(type)
              const count = ids.length
              const maxTeams = count
              const selected = splits[type]
              const btns = Array.from({ length: maxTeams }, (_, i) => i + 1)
                .map(n => `<button class="split-btn${selected === n ? ' active' : ''}" data-type="${type}" data-n="${n}">${n}</button>`)
                .join('')
              return `
                <div class="split-unit-type">
                  <div class="split-icon">${def.icon}</div>
                  <div class="split-info">
                    <div class="split-name">${def.label}</div>
                    <div class="split-count">${count} unit${count !== 1 ? 's' : ''}</div>
                  </div>
                  <div class="split-btns">${btns}</div>
                </div>
              `
            }).join('')}
          </div>
        </div>

        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
          <button class="btn-primary" id="start-battle-btn">START BATTLE</button>
          <button class="btn-secondary" id="back-btn">← BACK</button>
        </div>
      </div>
    `

    // Split buttons
    el.querySelectorAll('.split-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type
        const n = parseInt(btn.dataset.n)
        splits[type] = n
        render()  // re-render
      })
    })

    // Start battle
    el.querySelector('#start-battle-btn').addEventListener('click', () => {
      const splitDefs = Object.entries(typeCounts).map(([type, ids]) => {
        const n = splits[type]
        const groups = []
        const perGroup = Math.floor(ids.length / n)
        let extra = ids.length % n
        let start = 0
        for (let i = 0; i < n; i++) {
          const size = perGroup + (extra > 0 ? 1 : 0)
          extra--
          groups.push(ids.slice(start, start + size))
          start += size
        }
        return { unitType: type, groups }
      })

      applyTeamSplits(splitDefs)
      hidePreBattleScreen()
      EventBus.emit('battle-start')
    })

    // Back
    el.querySelector('#back-btn').addEventListener('click', () => {
      hidePreBattleScreen()
      EventBus.emit('back-to-select')
    })
  }

  render()
}

export function hidePreBattleScreen() {
  overlay().classList.add('hidden')
  overlay().innerHTML = ''
}
