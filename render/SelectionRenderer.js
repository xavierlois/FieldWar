import * as THREE from 'three'
import { hexToWorld, effectiveHeight, HEX_RADIUS } from '../core/HexGrid.js'
import { getScene } from './SceneManager.js'
import { GameState } from '../core/GameState.js'

const PLAYER_COLOR = 0x2B7FD4
const ATTACK_COLOR = 0xE8820C
const SELECT_COLOR = 0xffffff
const VALID_OPACITY = 0.35
const SELECT_OPACITY = 0.7

let overlayGroup
let selectionRings = []
let validMoveOverlays = []
let attackRangeOverlays = []

export function initSelectionRenderer() {
  overlayGroup = new THREE.Group()
  overlayGroup.renderOrder = 1
  getScene().add(overlayGroup)
}

export function clearAll() {
  overlayGroup.clear()
  selectionRings = []
  validMoveOverlays = []
  attackRangeOverlays = []
}

export function showSelectedTeam(team, grid) {
  clearAll()
  const aliveUnits = team.unitIds
    .map(id => GameState.units.get(id))
    .filter(u => u?.alive)

  if (aliveUnits.length > 0) {
    const anchorUnit = aliveUnits[0]
    addHexOverlay(anchorUnit.q, anchorUnit.r, grid, SELECT_COLOR, SELECT_OPACITY, true)
  }
}

export function showValidMoves(hexes, grid) {
  hexes.forEach(({ q, r }) => {
    const overlay = addHexOverlay(q, r, grid, PLAYER_COLOR, VALID_OPACITY)
    validMoveOverlays.push(overlay)
  })
}

export function showAttackRange(hexes, grid) {
  hexes.forEach(({ q, r }) => {
    const overlay = addHexOverlay(q, r, grid, ATTACK_COLOR, VALID_OPACITY)
    attackRangeOverlays.push(overlay)
  })
}

export function showTargetHex(q, r, grid, color = PLAYER_COLOR) {
  addHexOverlay(q, r, grid, color, 0.6, true)
}

function addHexOverlay(q, r, grid, color, opacity, pulse = false) {
  const hex = grid.get(`${q},${r}`)
  if (!hex) return null

  const h = effectiveHeight(hex)
  const y = h * 0.25 + 0.08 + 0.02

  const geo = new THREE.CylinderGeometry(HEX_RADIUS - 0.03, HEX_RADIUS - 0.03, 0.03, 6, 1)
  geo.rotateY(Math.PI / 6)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(geo, mat)
  const pos = hexToWorld(q, r)
  mesh.position.set(pos.x, y, pos.z)
  mesh.renderOrder = 2
  overlayGroup.add(mesh)

  if (pulse) {
    mesh.userData.pulse = true
    mesh.userData.phase = Math.random() * Math.PI * 2
  }

  return mesh
}

// Animate pulse effect on selection overlays
let pulseT = 0
export function updateOverlays(dt) {
  pulseT += dt * 2.5
  overlayGroup.children.forEach(mesh => {
    if (mesh.userData.pulse) {
      const phase = mesh.userData.phase || 0
      mesh.material.opacity = 0.4 + 0.3 * Math.sin(pulseT + phase)
    }
  })
}

// Path preview for Patrol / Attack Along Path commands
let pathLine = null
export function showPatrolPath(waypoints, grid) {
  clearPath()
  if (waypoints.length < 2) return

  const points = waypoints.map(({ q, r }) => {
    const pos = hexToWorld(q, r)
    const hex = grid.get(`${q},${r}`)
    const h = hex ? effectiveHeight(hex) : 1
    return new THREE.Vector3(pos.x, h * 0.25 + 0.18, pos.z)
  })

  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: 0.6,
    transparent: true,
    linewidth: 2,
  })
  pathLine = new THREE.Line(geo, mat)
  pathLine.renderOrder = 3
  getScene().add(pathLine)
}

export function clearPath() {
  if (pathLine) {
    getScene().remove(pathLine)
    pathLine.geometry.dispose()
    pathLine = null
  }
}
