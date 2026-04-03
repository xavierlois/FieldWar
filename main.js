/**
 * FieldWar — main.js
 * App bootstrap, screen manager, event routing, game initialization
 */

import { EventBus } from './core/EventBus.js'
import { GameState } from './core/GameState.js'
import { loadScenario } from './core/ScenarioLoader.js'
import { initTurnManager, startPlanning } from './core/TurnManager.js'

import { initScene, getScene, getCamera, getRenderer } from './render/SceneManager.js'
import { initHexRenderer, renderGrid } from './render/HexRenderer.js'
import { initBuildingRenderer, renderBuildings } from './render/BuildingRenderer.js'
import { initUnitRenderer, preloadUnitTextures, renderTeams, updateTeamPositions } from './render/UnitRenderer.js'
import { initSelectionRenderer, updateOverlays } from './render/SelectionRenderer.js'
import { initCombatFeedback, updateCombatFeedback } from './render/CombatFeedback.js'
import { updateTopBar } from './render/UIRenderer.js'

import { initInputManager } from './input/InputManager.js'
import { initCommandUI } from './input/CommandUI.js'
import { initEmergencyUI } from './input/EmergencyCommandUI.js'

import { showScenarioSelect, hideScenarioSelect } from './screens/ScenarioSelectScreen.js'
import { showPreBattleScreen, hidePreBattleScreen } from './screens/PreBattleScreen.js'
import { showVictoryScreen } from './screens/VictoryScreen.js'

// ─── DOM ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas')

// ─── One-time initialization ─────────────────────────────────────────────────
initScene(canvas)
initHexRenderer()
initUnitRenderer()
initSelectionRenderer()
initBuildingRenderer(getScene())
initCombatFeedback()
initTurnManager()  // registers execute-clicked, resolution-complete handlers

// Input wired once (persists across battles)
initInputManager(canvas, getCamera())
initCommandUI()
initEmergencyUI()

// ─── RAF game loop ──────────────────────────────────────────────────────────
let lastTime = 0
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop)
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1)
  lastTime = timestamp

  updateTeamPositions([...GameState.units.values()], dt)
  updateOverlays(dt)
  updateCombatFeedback(dt)
  getRenderer().render(getScene(), getCamera())
}
requestAnimationFrame(gameLoop)

// ─── Troop presets ────────────────────────────────────────────────────────────

const TROOP_PRESETS = {
  same: {
    player: [{ type: 'foot-soldier', count: 4 }, { type: 'archer', count: 3 }, { type: 'shield-bearer', count: 2 }],
    ai:     [{ type: 'foot-soldier', count: 4 }, { type: 'archer', count: 3 }, { type: 'shield-bearer', count: 2 }]
  },
  different: {
    player: [{ type: 'foot-soldier', count: 3 }, { type: 'archer', count: 3 }, { type: 'shield-bearer', count: 2 }, { type: 'knight', count: 1 }],
    ai:     [{ type: 'knight', count: 3 }, { type: 'archer', count: 2 }, { type: 'foot-soldier', count: 3 }, { type: 'shield-bearer', count: 1 }]
  }
}

// ─── Screen transitions ───────────────────────────────────────────────────────

async function handleScenarioSelected({ troops = 'same' }) {
  hideScenarioSelect()

  const unitOverride = TROOP_PRESETS[troops] || TROOP_PRESETS.same
  await loadScenario('scenario-08', unitOverride)

  renderGrid(GameState.grid)
  await renderBuildings(GameState.grid)

  // PreBattleScreen reads unit data directly from GameState
  showPreBattleScreen()
}

async function handleBattleStart() {
  hidePreBattleScreen()

  // Preload textures then render (teams already applied by PreBattleScreen)
  await preloadUnitTextures([...GameState.units.values()])
  await renderTeams([...GameState.playerTeams.values(), ...GameState.aiTeams.values()])

  updateTopBar()
  startPlanning()
}

function handleGameOver({ winner, reason }) {
  showVictoryScreen(winner, reason)
}

function handleBackToSelect() {
  GameState.reset()
  showScenarioSelect()
}

// ─── Event wiring ────────────────────────────────────────────────────────────
EventBus.on('scenario-selected', handleScenarioSelected)
EventBus.on('battle-start',      handleBattleStart)
EventBus.on('game-over',         handleGameOver)
EventBus.on('back-to-select',    handleBackToSelect)

// ─── Boot ────────────────────────────────────────────────────────────────────
showScenarioSelect()
