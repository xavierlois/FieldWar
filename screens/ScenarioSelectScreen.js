import { EventBus } from '../core/EventBus.js'

const SCENARIOS = [
  { id: 'scenario-01', name: 'Hold the Bridge',    teaches: 'Guard · Basic combat',        unlocked: true },
  { id: 'scenario-02', name: 'The Ambush',          teaches: 'Ambush · Overwatch · LOS',    unlocked: true },
  { id: 'scenario-03', name: 'Take the Hill',       teaches: 'Elevation · Charge',          unlocked: true },
  { id: 'scenario-04', name: 'Protect the Archer',  teaches: 'Cover Team · Screen',         unlocked: true },
  { id: 'scenario-05', name: 'Envelopment',         teaches: 'Envelop · Flanking',          unlocked: true },
  { id: 'scenario-06', name: 'The Siege',           teaches: 'Buildings · Tower',           unlocked: true },
  { id: 'scenario-07', name: 'Fighting Retreat',    teaches: 'Retreat · Scatter',           unlocked: true },
  { id: 'scenario-08', name: 'Full Engagement',     teaches: 'All mechanics',               unlocked: true },
]

const overlay = () => document.getElementById('screen-overlay')

export function showScenarioSelect(difficulty = 'medium') {
  const el = overlay()
  el.classList.remove('hidden')

  el.innerHTML = `
    <div class="screen">
      <div>
        <div class="screen-title">FieldWar</div>
        <div class="screen-subtitle">SELECT MISSION · ${difficulty.toUpperCase()}</div>
      </div>

      <div style="margin-bottom:4px">
        <div class="screen-subtitle" style="margin-bottom:8px">DIFFICULTY</div>
        <div class="difficulty-row">
          <button class="diff-btn${difficulty === 'easy'   ? ' active' : ''}" data-diff="easy">EASY</button>
          <button class="diff-btn${difficulty === 'medium' ? ' active' : ''}" data-diff="medium">MEDIUM</button>
          <button class="diff-btn${difficulty === 'hard'   ? ' active' : ''}" data-diff="hard">HARD</button>
        </div>
      </div>

      <div class="scenario-list">
        ${SCENARIOS.map((s, i) => `
          <div class="scenario-item${s.unlocked ? '' : ' scenario-locked'}" data-id="${s.id}">
            <div class="scenario-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="scenario-info">
              <div class="scenario-name-text">${s.name}</div>
              <div class="scenario-teaches">${s.teaches}</div>
            </div>
            <div style="color:var(--text-muted);font-size:18px">${s.unlocked ? '›' : '🔒'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  let selectedDiff = difficulty

  // Difficulty buttons
  el.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDiff = btn.dataset.diff
      el.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      el.querySelector('.screen-subtitle').textContent = `SELECT MISSION · ${selectedDiff.toUpperCase()}`
    })
  })

  // Scenario items
  el.querySelectorAll('.scenario-item').forEach(item => {
    if (item.classList.contains('scenario-locked')) return
    item.addEventListener('click', () => {
      EventBus.emit('scenario-selected', { id: item.dataset.id, difficulty: selectedDiff })
    })
  })
}

export function hideScenarioSelect() {
  overlay().classList.add('hidden')
  overlay().innerHTML = ''
}
