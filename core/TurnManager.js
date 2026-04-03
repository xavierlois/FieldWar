import { GameState } from './GameState.js'
import { EventBus } from './EventBus.js'
import { commanderAI } from '../ai/CommanderAI.js'
import { startResolution } from './ResolutionEngine.js'
import { renderTeamList, renderCommandPanel, showPhaseUI, updateTopBar } from '../render/UIRenderer.js'
import { clearAll } from '../render/SelectionRenderer.js'

export function initTurnManager() {
  EventBus.on('execute-confirmed', onExecute)
  EventBus.on('resolution-complete', onResolutionComplete)
}

export function startPlanning() {
  GameState.phase = 'planning'
  GameState.selectedTeamId = null

  // Reset team commands for new round
  ;[...GameState.allPlayerTeams, ...GameState.allAITeams].forEach(t => t.resetForRound())

  // Reset unit AP
  GameState.aliveUnits.forEach(u => { u.resetAP(); u._deathProcessed = false })

  updateTopBar()
  renderTeamList()
  renderCommandPanel(null)
  showPhaseUI('planning')
  clearAll()

  EventBus.emit('phase-changed', { phase: 'planning' })
}

function onExecute() {
  if (GameState.phase !== 'planning') return

  // AI plans its turn
  commanderAI.setDifficulty(GameState.difficulty)
  commanderAI.planTurn()

  GameState.phase = 'resolution'
  updateTopBar()
  showPhaseUI('resolution')
  renderTeamList()
  clearAll()

  EventBus.emit('phase-changed', { phase: 'resolution' })
  startResolution()
}

function onResolutionComplete() {
  GameState.phase = 'assessment'
  updateTopBar()

  // Brief pause before checking win conditions
  setTimeout(() => {
    const winner = checkWinConditions()
    if (winner) {
      GameState.winner = winner.faction
      GameState.winReason = winner.reason
      GameState.phase = 'end'
      EventBus.emit('game-over', { winner: winner.faction, reason: winner.reason })
    } else {
      GameState.turn++
      startPlanning()
    }
  }, 1500)
}

function checkWinConditions() {
  const playerAlive = GameState.playerUnits.length > 0
  const aiAlive = GameState.aiUnits.length > 0

  // Eliminate all enemies
  if (GameState.objective === 'eliminate_all') {
    if (!aiAlive) return { faction: 'player', reason: 'All enemy units eliminated!' }
    if (!playerAlive) return { faction: 'ai', reason: 'All your units were eliminated.' }
  }

  // Hold objective hex for N turns
  if (GameState.objective === 'hold_objective' && GameState.objectiveHex) {
    const { q, r } = GameState.objectiveHex
    const hex = GameState.grid.get(`${q},${r}`)
    if (hex?.unitId) {
      const unit = GameState.units.get(hex.unitId)
      if (unit?.faction === 'player') {
        if (!GameState._objectiveHeldTurns) GameState._objectiveHeldTurns = 0
        GameState._objectiveHeldTurns++
        if (GameState._objectiveHeldTurns >= (GameState.objectiveTurns || 3)) {
          return { faction: 'player', reason: 'Objective held!' }
        }
      } else {
        GameState._objectiveHeldTurns = 0
      }
    }
    if (!aiAlive) return { faction: 'player', reason: 'All enemy units eliminated!' }
    if (!playerAlive) return { faction: 'ai', reason: 'All your units were eliminated.' }
  }

  // Survive N rounds
  if (GameState.objective === 'survive') {
    if (!playerAlive) return { faction: 'ai', reason: 'All your units were eliminated.' }
    if (GameState.turn >= (GameState.objectiveTurns || 5)) {
      return { faction: 'player', reason: `Survived ${GameState.objectiveTurns} rounds!` }
    }
  }

  return null
}
