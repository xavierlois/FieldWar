import * as THREE from 'three'
import { GameState } from '../core/GameState.js'

let scene, camera, renderer, clock
let resizeObserver

const CAMERA_DISTANCE = 22
const CAMERA_ANGLE = Math.PI / 4  // 45 degrees tilt

// Grid world-space bounds (scenario-08: 9 cols × 18 rows, flat-top hexes, HEX_RADIUS=1.0)
// x: ±6.0,  z: ~±12.1  (from buildGrid centering)
const GRID_Z_HALF = 12.5  // world-z half-extent (grid edge to grid edge) + small margin
const GRID_X_HALF = 7.0   // world-x half-extent + small margin

// Compute the orthographic half-size that just fits the full grid on screen.
// On height-constrained screens (landscape/desktop): fit by z-extent.
// On width-constrained screens (narrow portrait): fit by x-extent.
function computeSize(aspect) {
  const sizeH = GRID_Z_HALF * Math.sin(CAMERA_ANGLE)  // z-extent → camera-space height
  const sizeW = GRID_X_HALF / aspect                   // x-extent → camera-space width
  return Math.max(sizeH, sizeW) * 1.12                 // 12% padding so grid isn't edge-to-edge
}

export function initScene(canvas) {
  clock = new THREE.Clock()

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d1117)
  scene.fog = new THREE.Fog(0x0d1117, 35, 60)

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = false

  // Camera (orthographic for clean tactical look)
  camera = createCamera(canvas.clientWidth, canvas.clientHeight)

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(5, 15, 8)
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0x8899aa, 0.3)
  fillLight.position.set(-5, 10, -5)
  scene.add(fillLight)

  // Handle resize
  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(canvas.parentElement)
  onResize()

  return { scene, camera, renderer, clock }
}

function createCamera(width, height) {
  const aspect = width / height
  const size = computeSize(aspect)
  const cam = new THREE.OrthographicCamera(
    -size * aspect, size * aspect,
    size, -size,
    0.1, 200
  )
  cam.position.set(0, CAMERA_DISTANCE * Math.sin(CAMERA_ANGLE), CAMERA_DISTANCE * Math.cos(CAMERA_ANGLE))
  cam.lookAt(0, 0, 0)
  return cam
}

function onResize() {
  const container = renderer.domElement.parentElement
  const w = container.clientWidth
  const h = container.clientHeight
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const aspect = w / h
  const size = computeSize(aspect)
  camera.left   = -size * aspect
  camera.right  =  size * aspect
  camera.top    =  size
  camera.bottom = -size
  camera.updateProjectionMatrix()
}

export function getScene() { return scene }
export function getCamera() { return camera }
export function getRenderer() { return renderer }
export function getClock() { return clock }

export function render() {
  renderer.render(scene, camera)
}

export function screenToWorld(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1

  const vec = new THREE.Vector3(x, y, 0.5)
  vec.unproject(camera)

  // Cast ray from camera through the unprojected point onto Y=0 plane
  const dir = vec.sub(camera.position).normalize()
  const dist = -camera.position.y / dir.y
  const point = camera.position.clone().add(dir.multiplyScalar(dist))
  return { x: point.x, z: point.z }
}

export function dispose() {
  if (resizeObserver) resizeObserver.disconnect()
  renderer.dispose()
}
