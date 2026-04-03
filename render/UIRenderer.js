import { GameState } from '../core/GameState.js'
import { COMMAND_DEFS, getUnitType } from '../units/UnitTypes.js'
import { EventBus } from '../core/EventBus.js'

// Cache DOM elements
const els = {
  scenarioName: () => document.getElementById('scenario-name'),
  turnCounter:  () => document.getElementById('turn-counter'),
  phaseLabel:   () => document.getElementById('phase-label'),
  teamList:     () => document.getElementById('team-list'),
  commandPanel: () => document.getElementById('command-panel'),
  executeBtn:   () => document.getElementById('execute-btn'),
  bottomPanel:  () => document.getElementById('bottom-panel'),
}

export function updateTopBar() {
  els.scenarioName().textContent = GameState.scenarioName || 'FieldWar'
  els.turnCounter().textContent = `Round ${GameState.turn}`

  const phaseEl = els.phaseLabel()
  const phaseMap = {
    planning:   { text: 'PLAN', cls: '' },
    resolution: { text: 'BATTLE', cls: '' },
    assessment: { text: 'ASSESS', cls: '' },
    'pre-battle': { text: 'DEPLOY', cls: '' },
  }
  const info = phaseMap[GameState.phase] || { text: '—', cls: '' }
  phaseEl.textContent = info.text
  phaseEl.className = info.cls
}

export function renderTeamList() {
  const container = els.teamList()
  container.innerHTML = ''

  const teams = GameState.allPlayerTeams.filter(t => t.isAlive)
  teams.forEach(team => {
    const aliveUnits = GameState.getAliveTeamUnits(team)
    if (aliveUnits.length === 0) return

    const typeDef = getUnitType(team.unitType)
    const card = document.createElement('div')
    card.className = 'team-card'
    if (team.id === GameState.selectedTeamId) card.classList.add('selected')
    if (team.command) card.classList.add('has-command')
    if (team.emergencyUsed) card.classList.add('emergency-used')
    card.dataset.teamId = team.id

    // AP pips
    const totalAP = aliveUnits.reduce((s, u) => s + u.ap, 0)
    const maxAP = aliveUnits.reduce((s, u) => s + u.maxAP, 0)
    const pipCount = Math.min(aliveUnits[0].maxAP, 5)
    const spentCount = aliveUnits[0].maxAP - (aliveUnits[0].ap)
    let pipsHTML = ''
    for (let i = 0; i < pipCount; i++) {
      pipsHTML += `<div class="ap-pip${i < spentCount ? ' spent' : ''}"></div>`
    }

    card.innerHTML = `
      <div class="team-icon">${typeDef.icon}</div>
      <div class="team-info">
        <div class="team-label">${team.label}</div>
        <div class="team-count">${aliveUnits.length} unit${aliveUnits.length !== 1 ? 's' : ''}</div>
      </div>
      ${team.command
        ? `<div class="team-command-badge">${COMMAND_DEFS[team.command]?.label || team.command}</div>`
        : ''}
      <div class="team-ap-pips">${pipsHTML}</div>
    `

    card.addEventListener('click', () => {
      EventBus.emit('team-selected', { teamId: team.id })
    })

    container.appendChild(card)
  })
}

export function renderCommandPanel(team) {
  const panel = els.commandPanel()
  if (!team) {
    panel.classList.remove('visible')
    return
  }

  panel.classList.add('visible')
  panel.innerHTML = ''

  const typeDef = getUnitType(team.unitType)
  const header = document.createElement('div')
  header.className = 'command-panel-header'
  header.textContent = `${typeDef.icon} ${team.label} — Select Command`
  panel.appendChild(header)

  const row = document.createElement('div')
  row.className = 'command-cards-row'

  const commands = typeDef.commands
  commands.forEach(cmdId => {
    const def = COMMAND_DEFS[cmdId]
    if (!def) return

    const card = document.createElement('div')
    card.className = 'command-card'
    if (team.command === cmdId) card.classList.add('active')
    card.innerHTML = `
      <span class="command-card-name">${def.label}</span>
      <span class="command-card-desc">${def.desc}</span>
    `
    card.addEventListener('click', () => {
      EventBus.emit('command-selected', { teamId: team.id, command: cmdId })
    })
    row.appendChild(card)
  })

  // Mouse wheel scrolls horizontally (scrollbar is hidden for aesthetics)
  row.addEventListener('wheel', e => {
    e.preventDefault()
    row.scrollLeft += e.deltaY + e.deltaX
  }, { passive: false })

  panel.appendChild(row)

  // Cancel button if command set
  if (team.command) {
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn-secondary'
    cancelBtn.style.fontSize = '11px'
    cancelBtn.style.padding = '6px'
    cancelBtn.style.letterSpacing = '1px'
    cancelBtn.textContent = 'CANCEL COMMAND'
    cancelBtn.addEventListener('click', () => {
      EventBus.emit('command-selected', { teamId: team.id, command: null })
    })
    panel.appendChild(cancelBtn)
  }
}

export function showExecuteButton(visible) {
  const btn = els.executeBtn()
  if (visible) {
    btn.classList.remove('hidden')
    btn.classList.add('btn')
    btn.onclick = () => EventBus.emit('execute-clicked')
  } else {
    btn.classList.add('hidden')
  }
}

export function showPhaseUI(phase) {
  const commandPanel = els.commandPanel()

  if (phase === 'planning') {
    showExecuteButton(true)
  } else {
    showExecuteButton(false)
    commandPanel.classList.remove('visible')
  }

  updateTopBar()
}

export function hideCommandPanel() {
  els.commandPanel().classList.remove('visible')
  els.commandPanel().innerHTML = ''
}

// Highlight selected team card
export function updateTeamCardSelection(teamId) {
  document.querySelectorAll('.team-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.teamId === teamId)
  })
}

// Show awaiting target indicator
export function showTargetPrompt(message) {
  const header = document.querySelector('.command-panel-header')
  if (header) {
    header.textContent = message
    header.style.color = '#E8820C'
  }
}

export function showConfirmPrompt(onYes) {
  // Check if any teams still have no command
  const teamsWithoutCommand = GameState.allPlayerTeams
    .filter(t => t.isAlive && !t.command)
  if (teamsWithoutCommand.length === 0) {
    onYes()
    return
  }
  const count = teamsWithoutCommand.length
  const confirmed = confirm(`${count} team${count !== 1 ? 's have' : ' has'} no command. Execute anyway?`)
  if (confirmed) onYes()
}
