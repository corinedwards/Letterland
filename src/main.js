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
const pauseMotionCheckbox = document.getElementById('pause-motion')
const darkModeCheckbox = document.getElementById('dark-mode')

// Restore settings from localStorage
let bgColor = localStorage.getItem('bgColor') || '#ffffff'
let isPaused = localStorage.getItem('isPaused') === 'true'
let isDarkMode = localStorage.getItem('isDarkMode') === 'true'

bgColorPicker.value = bgColor
bgColorValue.textContent = bgColor
pauseMotionCheckbox.checked = isPaused
darkModeCheckbox.checked = isDarkMode

scene.setBackgroundColor(bgColor)
document.body.style.backgroundColor = bgColor
scene.setPaused(isPaused)

// Apply dark mode if enabled
if (isDarkMode) {
  scene.setDarkMode(true)
  document.body.classList.add('dark-mode')
}

refreshBtn.addEventListener('click', () => {
  location.reload()
})

// Pause motion toggle
pauseMotionCheckbox.addEventListener('change', (e) => {
  const paused = e.target.checked
  localStorage.setItem('isPaused', paused)
  scene.setPaused(paused)
})

// Dark mode toggle
darkModeCheckbox.addEventListener('change', (e) => {
  const darkMode = e.target.checked
  localStorage.setItem('isDarkMode', darkMode)
  scene.setDarkMode(darkMode)
  
  if (darkMode) {
    document.body.classList.add('dark-mode')
  } else {
    document.body.classList.remove('dark-mode')
  }
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
