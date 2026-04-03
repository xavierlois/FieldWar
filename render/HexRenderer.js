import * as THREE from 'three'
import { hexToWorld, HEX_RADIUS, effectiveHeight } from '../core/HexGrid.js'
import { getScene } from './SceneManager.js'

// Terrain color palette (earthy tones for dark tactical aesthetic)
const TERRAIN_COLORS = {
  0: 0x1a2318,  // valley/hole — dark olive
  1: 0x263320,  // flat — medium forest green
  2: 0x3a4a2a,  // hill — lighter sage
}

const BUILDING_COLORS = {
  tower:  0x3a3a4e,
  forest: 0x1e3d1a,
  house:  0x3d2e1e,
  rock:   0x3a3a3a,
  trench: 0x2a2010,
}

const HEX_HEIGHT_SCALE = 0.35  // visual extrusion per height level
const HEX_GAP = 0.03           // small gap between hex tiles

let hexMeshes = new Map()  // key → mesh
let hexGroup

export function initHexRenderer() {
  hexGroup = new THREE.Group()
  getScene().add(hexGroup)
}

export function renderGrid(grid) {
  // Clear existing
  if (hexGroup) {
    hexGroup.clear()
  }
  hexMeshes.clear()

  grid.forEach((hex, key) => {
    const mesh = createHexMesh(hex)
    hexGroup.add(mesh)
    hexMeshes.set(key, mesh)
  })
}

function createHexMesh(hex) {
  const h = effectiveHeight(hex)
  const visualHeight = Math.max(0.1, h * HEX_HEIGHT_SCALE + 0.1)
  const r = HEX_RADIUS - HEX_GAP

  // CylinderGeometry(radTop, radBot, height, segments)
  const geo = new THREE.CylinderGeometry(r, r, visualHeight, 6, 1, false)
  // Rotate 30° to make flat-top hex
  geo.rotateY(Math.PI / 6)

  // Determine color
  let color = TERRAIN_COLORS[hex.height] ?? TERRAIN_COLORS[1]
  if (hex.building) {
    color = BUILDING_COLORS[hex.building.type] ?? color
  }

  const mat = new THREE.MeshLambertMaterial({
    color,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(geo, mat)
  const pos = hexToWorld(hex.q, hex.r)
  mesh.position.set(pos.x, visualHeight / 2, pos.z)
  mesh.userData = { q: hex.q, r: hex.r, isHex: true }

  // Edge outline
  const edgeMat = new THREE.MeshLambertMaterial({
    color: 0x0d1117,
    side: THREE.BackSide
  })
  const edgeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.04, r + 0.04, visualHeight + 0.01, 6, 1, false),
    edgeMat
  )
  edgeMesh.geometry.rotateY(Math.PI / 6)
  mesh.add(edgeMesh)

  // Height indicator for hills
  if (hex.height === 2) {
    addHeightRings(mesh, r, visualHeight)
  }

  return mesh
}

function addHeightRings(parent, r, h) {
  const ringGeo = new THREE.TorusGeometry(r * 0.7, 0.02, 4, 6)
  const ringMat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 2
  ring.position.y = h / 2 + 0.02
  parent.add(ring)
}

export function getHexMesh(q, r) {
  return hexMeshes.get(`${q},${r}`)
}

export function updateHexVisual(q, r, grid) {
  const key = `${q},${r}`
  const hex = grid.get(key)
  if (!hex) return
  const old = hexMeshes.get(key)
  if (old) {
    hexGroup.remove(old)
    old.geometry.dispose()
    old.material.dispose()
  }
  const mesh = createHexMesh(hex)
  hexGroup.add(mesh)
  hexMeshes.set(key, mesh)
}

// Get all hex meshes for raycasting
export function getHexMeshList() {
  return [...hexMeshes.values()]
}
