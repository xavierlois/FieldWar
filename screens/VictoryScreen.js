import { EventBus } from '../core/EventBus.js'
import { GameState } from '../core/GameState.js'

const overlay = () => document.getElementById('screen-overlay')

export function showVictoryScreen(winner, reason) {
  const el = overlay()
  el.classList.remove('hidden')

  const isWin = winner === 'player'
  const title = isWin ? 'VICTORY' : 'DEFEAT'
  const color = isWin ? 'win' : 'lose'
  const emoji = isWin ? '🏆' : '💀'

  el.innerHTML = `
    <div class="screen">
      <div class="victory-content">
        <div style="font-size:64px">${emoji}</div>
        <div class="victory-result ${color}">${title}</div>
        <div class="victory-details">${reason || ''}</div>
        <div style="color:var(--text-muted);font-size:13px">
          Round ${GameState.turn} · ${GameState.scenarioName}
        </div>
      </div>

      <div class="victory-buttons">
        ${isWin ? `<button class="btn-primary" id="next-scenario-btn">NEXT MISSION →</button>` : ''}
        <button class="btn-secondary" id="retry-btn">RETRY MISSION</button>
        <button class="btn-secondary" id="menu-btn">MISSION SELECT</button>
      </div>
    </div>
  `

  const currentId = GameState.scenarioId
  const num = parseInt(currentId?.replace('scenario-0', '') || '1')

  el.querySelector('#retry-btn')?.addEventListener('click', () => {
    el.classList.add('hidden')
    EventBus.emit('scenario-selected', { id: currentId, difficulty: GameState.difficulty })
  })

  el.querySelector('#menu-btn')?.addEventListener('click', () => {
    el.classList.add('hidden')
    EventBus.emit('back-to-select')
  })

  el.querySelector('#next-scenario-btn')?.addEventListener('click', () => {
    el.classList.add('hidden')
    const nextId = `scenario-0${num + 1}`
    EventBus.emit('scenario-selected', { id: nextId, difficulty: GameState.difficulty })
  })
}
