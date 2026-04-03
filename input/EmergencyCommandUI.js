import { GameState } from '../core/GameState.js'
import { EventBus } from '../core/EventBus.js'
import { setResolutionSpeed } from '../core/ResolutionEngine.js'
import { EMERGENCY_COMMANDS, COMMAND_DEFS } from '../units/UnitTypes.js'

const overlay = () => document.getElementById('emergency-overlay')
const banner  = () => document.getElementById('emergency-banner')
const cards   = () => document.getElementById('emergency-cards')
const resume  = () => document.getElementById('emergency-resume')

let activeTeamId = null

export function initEmergencyUI() {
  EventBus.on('emergency-tap', onEmergencyTap)
  EventBus.on('resolution-complete', onResolutionComplete)
  EventBus.on('phase-changed', onPhaseChanged)

  resume()?.addEventListener('click', closeEmergency)
}

function onEmergencyTap({ unitId }) {
  if (GameState.phase !== 'resolution') return

  const unit = GameState.units.get(unitId)
  if (!unit?.alive || unit.faction !== 'player') return

  const team = GameState.getTeamForUnit(unitId)
  if (!team) return
  if (team.emergencyUsed) return  // already used

  openEmergencyFor(team)
}

function openEmergencyFor(team) {
  activeTeamId = team.id
  setResolutionSpeed(0.2)

  const typeName = team.label
  banner().textContent = `EMERGENCY — ${typeName.toUpperCase()}`

  // Build available emergency commands for this unit type
  const cardsEl = cards()
  cardsEl.innerHTML = ''

  EMERGENCY_COMMANDS.forEach(cmdId => {
    const def = COMMAND_DEFS[cmdId]
    if (!def) return

    const card = document.createElement('div')
    card.className = 'emergency-card'
    card.innerHTML = `<span class="emergency-card-name">${def.label}</span>`
    card.addEventListener('click', () => issueEmergencyCommand(cmdId))
    cardsEl.appendChild(card)
  })

  overlay().classList.remove('hidden')
}

function issueEmergencyCommand(cmdId) {
  const team = GameState.getTeam(activeTeamId)
  if (!team) { closeEmergency(); return }

  team.emergencyCommand = cmdId
  team.emergencyUsed = true

  closeEmergency()
}

function closeEmergency() {
  setResolutionSpeed(1.0)
  overlay().classList.add('hidden')
  activeTeamId = null
}

function onResolutionComplete() {
  closeEmergency()
}

function onPhaseChanged({ phase }) {
  if (phase !== 'resolution') closeEmergency()
}
