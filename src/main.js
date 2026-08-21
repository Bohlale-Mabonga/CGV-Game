import * as THREE from 'three'
import './style.css'

// --------------------------------------------------
// Scene
// --------------------------------------------------

const scene = new THREE.Scene()

scene.background = new THREE.Color(0x101018)

// --------------------------------------------------
// Camera
// --------------------------------------------------

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

camera.position.set(0, 2, 5)

// --------------------------------------------------
// Renderer
// --------------------------------------------------

const renderer = new THREE.WebGLRenderer({
  antialias: true
})

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

document.querySelector('#app').appendChild(renderer.domElement)

// --------------------------------------------------
// Lighting
// --------------------------------------------------

const ambientLight = new THREE.AmbientLight(
  0xffffff,
  0.5
)

scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(
  0xffffff,
  1
)

directionalLight.position.set(5, 10, 5)
directionalLight.castShadow = true

scene.add(directionalLight)

// --------------------------------------------------
// Test objects
// --------------------------------------------------

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)

const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x4488ff
})

const cube = new THREE.Mesh(
  cubeGeometry,
  cubeMaterial
)

cube.castShadow = true
cube.position.y = 1

scene.add(cube)

// Ground

const groundGeometry = new THREE.PlaneGeometry(
  20,
  20
)

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x333333
})

const ground = new THREE.Mesh(
  groundGeometry,
  groundMaterial
)

ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true

scene.add(ground)

// --------------------------------------------------
// Resize handling
// --------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth / window.innerHeight

  camera.updateProjectionMatrix()

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  )
})

// --------------------------------------------------
// Game loop
// --------------------------------------------------

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  cube.rotation.x += delta
  cube.rotation.y += delta

  renderer.render(scene, camera)
}

animate()
