import { GameState } from '../core/GameState.js'
import { EventBus } from '../core/EventBus.js'
import { NEEDS_TARGET_HEX, NEEDS_TARGET_TEAM, NEEDS_ALLY_TARGET } from '../units/CommandSystem.js'
import {
  renderTeamList, renderCommandPanel, hideCommandPanel,
  updateTeamCardSelection, showTargetPrompt, showConfirmPrompt
} from '../render/UIRenderer.js'
import {
  clearAll, showSelectedTeam, showAttackRange, showTargetHex
} from '../render/SelectionRenderer.js'
import { hexesInRange } from '../core/HexGrid.js'

export function initCommandUI() {
  EventBus.on('team-selected', onTeamSelected)
  EventBus.on('command-selected', onCommandSelected)
  EventBus.on('hex-tapped', onHexTapped)
  EventBus.on('unit-tapped', onUnitTapped)
  EventBus.on('empty-tapped', onEmptyTapped)
  EventBus.on('execute-clicked', onExecuteClicked)
  EventBus.on('phase-changed', onPhaseChanged)
}

function onPhaseChanged({ phase }) {
  if (phase !== 'planning') {
    hideCommandPanel()
    clearAll()
  }
}

function onTeamSelected({ teamId }) {
  if (GameState.phase !== 'planning') return

  // Toggle selection
  if (GameState.selectedTeamId === teamId) {
    deselect()
    return
  }

  GameState.selectedTeamId = teamId
  GameState.awaitingTargetFor = null
  updateTeamCardSelection(teamId)

  const team = GameState.getTeam(teamId)
  if (!team) return

  clearAll()
  showSelectedTeam(team, GameState.grid)
  renderCommandPanel(team)
}

function onCommandSelected({ teamId, command }) {
  if (GameState.phase !== 'planning') return

  const team = GameState.getTeam(teamId)
  if (!team) return

  if (command === null) {
    // Cancel command
    team.setCommand(null)
    renderTeamList()
    renderCommandPanel(team)
    return
  }

  // Commands needing target hex
  if (NEEDS_TARGET_HEX.has(command)) {
    team.setCommand(command)
    GameState.awaitingTargetFor = teamId
    renderCommandPanel(team)
    showTargetPrompt('TAP A HEX TO SET TARGET')
    return
  }

  // Commands needing enemy target team
  if (NEEDS_TARGET_TEAM.has(command)) {
    team.setCommand(command)
    GameState.awaitingTargetFor = teamId
    renderCommandPanel(team)
    showTargetPrompt('TAP AN ENEMY TEAM TO TARGET')
    return
  }

  // Commands needing ally target team
  if (NEEDS_ALLY_TARGET.has(command)) {
    team.setCommand(command)
    GameState.awaitingTargetFor = teamId
    renderCommandPanel(team)
    showTargetPrompt('TAP AN ALLY TEAM TO SUPPORT')
    return
  }

  // Direct command
  team.setCommand(command)
  GameState.awaitingTargetFor = null
  renderTeamList()
  renderCommandPanel(team)
}

function onHexTapped({ q, r }) {
  if (GameState.phase !== 'planning') return

  // Awaiting target hex
  if (GameState.awaitingTargetFor) {
    const team = GameState.getTeam(GameState.awaitingTargetFor)
    if (team) {
      team.targetHex = { q, r }
      GameState.awaitingTargetFor = null
      clearAll()
      showSelectedTeam(team, GameState.grid)
      showTargetHex(q, r, GameState.grid)
      renderTeamList()
      renderCommandPanel(team)
    }
    return
  }

  // Check if a unit is on this hex
  const unit = GameState.getUnitAt(q, r)
  if (unit?.faction === 'player') {
    const team = GameState.getTeamForUnit(unit.id)
    if (team) {
      EventBus.emit('team-selected', { teamId: team.id })
    }
  } else {
    deselect()
  }
}

function onUnitTapped({ unitId }) {
  if (GameState.phase === 'resolution') {
    // During resolution: trigger emergency command
    EventBus.emit('emergency-tap', { unitId })
    return
  }

  if (GameState.phase !== 'planning') return

  const unit = GameState.units.get(unitId)
  if (!unit) return

  const awaitingTeam = GameState.awaitingTargetFor
    ? GameState.getTeam(GameState.awaitingTargetFor)
    : null

  if (unit.faction === 'ai' && awaitingTeam && NEEDS_TARGET_TEAM.has(awaitingTeam.command)) {
    // Targeting an enemy team
    const enemyTeam = GameState.getTeamForUnit(unitId)
    if (enemyTeam) {
      awaitingTeam.targetTeamId = enemyTeam.id
      GameState.awaitingTargetFor = null
      renderTeamList()
      renderCommandPanel(awaitingTeam)
    }
  } else if (unit.faction === 'player' && awaitingTeam && NEEDS_ALLY_TARGET.has(awaitingTeam.command)) {
    // Targeting an ally team
    const allyTeam = GameState.getTeamForUnit(unitId)
    if (allyTeam && allyTeam.id !== awaitingTeam.id) {
      awaitingTeam.targetTeamId = allyTeam.id
      GameState.awaitingTargetFor = null
      renderTeamList()
      renderCommandPanel(awaitingTeam)
    }
  } else if (unit.faction === 'player') {
    // Select this unit's team
    const team = GameState.getTeamForUnit(unitId)
    if (team) {
      EventBus.emit('team-selected', { teamId: team.id })
    }
  }
}

function onEmptyTapped() {
  if (GameState.phase !== 'planning') return
  if (GameState.awaitingTargetFor) return
  deselect()
}

function onExecuteClicked() {
  if (GameState.phase !== 'planning') return
  showConfirmPrompt(() => {
    EventBus.emit('execute-confirmed')
  })
}

function deselect() {
  GameState.selectedTeamId = null
  GameState.awaitingTargetFor = null
  updateTeamCardSelection(null)
  clearAll()
  hideCommandPanel()
}
