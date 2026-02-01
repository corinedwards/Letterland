import './style.css'
import { ThreeScene } from './three/scene.js'
import { ShapeFactory } from './three/shapeFactory.js'

// Async initialization
async function initApp() {
  // Show loading message
  const container = document.getElementById('three-container')
  container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: Courier; font-size: 14pt;">Loading shapes...</div>'
  
  // Initialize shape factory first
  const shapeFactory = new ShapeFactory()
  
  // Load custom shapes from public/letters/ folder
  await shapeFactory.loadCustomShapes()

  // Get scene settings from config
  const sceneSettings = shapeFactory.fileLoader.config._scene || {}

  // Clear loading message
  container.innerHTML = ''

  // Now initialize Three.js scene with settings from config
  const scene = new ThreeScene(container, shapeFactory, sceneSettings)
  
  return { scene }
}

// Start the app
const app = await initApp()
const scene = app.scene

// Control buttons
const refreshBtn = document.getElementById('refresh')
const bgColorPicker = document.getElementById('bg-color')
const bgColorValue = document.getElementById('bg-color-value')

// Restore bg color from localStorage
let bgColor = localStorage.getItem('bgColor') || '#ffffff'
bgColorPicker.value = bgColor
bgColorValue.textContent = bgColor
scene.setBackgroundColor(bgColor)
document.body.style.backgroundColor = bgColor

refreshBtn.addEventListener('click', () => {
  location.reload()
})

// Background color picker
bgColorPicker.addEventListener('input', (e) => {
  const color = e.target.value
  bgColorValue.textContent = color
  localStorage.setItem('bgColor', color)
  scene.setBackgroundColor(color)
  document.body.style.backgroundColor = color
})

// Handle window resize
window.addEventListener('resize', () => {
  scene.onResize()
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  scene.update()
}

animate()
