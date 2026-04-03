import { GameState } from '../core/GameState.js'
import { EventBus } from '../core/EventBus.js'
import { screenToWorld } from '../render/SceneManager.js'
import { worldToHex } from '../core/HexGrid.js'
import { getHexMeshList } from '../render/HexRenderer.js'
import { getUnitSpriteList } from '../render/UnitRenderer.js'
import * as THREE from 'three'

let canvas
let raycaster
let mouse = new THREE.Vector2()
let camera

let pointerDownPos = null
const CLICK_THRESHOLD = 8  // pixels — distinguish tap from drag

export function initInputManager(canvasEl, cam) {
  canvas = canvasEl
  camera = cam
  raycaster = new THREE.Raycaster()

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: true })
}

function onPointerDown(e) {
  e.preventDefault()
  pointerDownPos = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e) {
  if (!pointerDownPos) return
  // Could add path drawing here for patrol commands
  EventBus.emit('pointer-move', { clientX: e.clientX, clientY: e.clientY })
}

function onPointerUp(e) {
  if (!pointerDownPos) return
  const dx = e.clientX - pointerDownPos.x
  const dy = e.clientY - pointerDownPos.y
  pointerDownPos = null

  if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return  // was a drag, not a tap

  handleTap(e.clientX, e.clientY)
}

function handleTap(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // Check unit sprites first
  const unitHit = raycaster.intersectObjects(getUnitSpriteList())
  if (unitHit.length > 0) {
    const sprite = unitHit[0].object
    if (sprite.userData.unitId) {
      EventBus.emit('unit-tapped', { unitId: sprite.userData.unitId })
      return
    }
  }

  // Check hex tiles
  const hexHit = raycaster.intersectObjects(getHexMeshList())
  if (hexHit.length > 0) {
    const mesh = hexHit[0].object
    const { q, r } = mesh.userData.isHex ? mesh.userData : findHexData(mesh)
    if (q !== undefined) {
      EventBus.emit('hex-tapped', { q, r })
      return
    }
  }

  // Tapped empty space
  EventBus.emit('empty-tapped')
}

function findHexData(mesh) {
  // Walk up parent chain to find hex data
  let cur = mesh
  while (cur) {
    if (cur.userData.isHex) return cur.userData
    cur = cur.parent
  }
  return {}
}

export function getPointerHex(clientX, clientY) {
  const world = screenToWorld(clientX, clientY)
  return worldToHex(world.x, world.z)
}
