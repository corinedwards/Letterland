import './style.css'
import { ThreeScene } from './three/scene.js'
import { ShapeFactory } from './three/shapeFactory.js'

// Async initialization
async function initApp() {
  // Restore settings from localStorage FIRST (before anything renders)
  const bgColor = localStorage.getItem('bgColor') || '#ffffff'
  const isDarkMode = localStorage.getItem('isDarkMode') === 'true'
  
  // Apply background and dark mode immediately (before fade-in)
  document.body.style.backgroundColor = bgColor
  const overlay = document.getElementById('loading-overlay')
  if (overlay) {
    overlay.style.backgroundColor = bgColor
  }
  if (isDarkMode) {
    document.body.classList.add('dark-mode')
  }
  
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
  
  // Wait for first render frame before hiding loading overlay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = document.getElementById('loading-overlay')
      if (overlay) {
        overlay.classList.add('hidden')
        // Remove from DOM after transition
        setTimeout(() => {
        overlay.remove()
        scene.runDemoSpin()
      }, 400)
      }
      document.body.classList.add('loaded')
    })
  })
  
  const bgColors = sceneSettings.bgColors || ['#ffffff']
  return { scene, bgColors }
}

// Start the app
const app = await initApp()
const scene = app.scene
const bgColors = app.bgColors

// Control buttons
const refreshBtn = document.getElementById('refresh')
const pauseMotionBtn = document.getElementById('pause-motion')
const darkModeBtn = document.getElementById('dark-mode')
const bgColorBtn = document.getElementById('bg-color-btn')
const bgColorLabel = document.getElementById('bg-color-label')

// Restore settings from localStorage
const savedBgColor = localStorage.getItem('bgColor') || bgColors[0]
const isPaused = localStorage.getItem('isPaused') === 'true'
const isDarkMode = localStorage.getItem('isDarkMode') === 'true'

// Find saved colour in the preset list, defaulting to 0
let bgColorIndex = bgColors.findIndex(c => c.toLowerCase() === savedBgColor.toLowerCase())
if (bgColorIndex === -1) bgColorIndex = 0

pauseMotionBtn.setAttribute('aria-pressed', String(isPaused))
darkModeBtn.setAttribute('aria-pressed', String(isDarkMode))

scene.setBackgroundColor(bgColors[bgColorIndex])
bgColorLabel.textContent = bgColors[bgColorIndex].toUpperCase()
scene.setPaused(isPaused)
scene.setDarkMode(isDarkMode)

// Apply initial NA states after restoring from localStorage
updateNAStates()

// Shuffle / regenerate
refreshBtn.addEventListener('click', () => {
  scene.regenerateLetters()
})

// Pause motion toggle
pauseMotionBtn.addEventListener('click', () => {
  const paused = pauseMotionBtn.getAttribute('aria-pressed') !== 'true'
  pauseMotionBtn.setAttribute('aria-pressed', String(paused))
  localStorage.setItem('isPaused', paused)
  scene.setPaused(paused)
  updateNAStates()
})

// Dark mode toggle
darkModeBtn.addEventListener('click', () => {
  const darkMode = darkModeBtn.getAttribute('aria-pressed') !== 'true'
  darkModeBtn.setAttribute('aria-pressed', String(darkMode))
  localStorage.setItem('isDarkMode', darkMode)
  scene.setDarkMode(darkMode)
  document.body.classList.toggle('dark-mode', darkMode)
  updateNAStates()
})

// Background colour — cycle through presets (shift-click to go backwards)
bgColorBtn.addEventListener('click', (e) => {
  bgColorIndex = (bgColorIndex + (e.shiftKey ? -1 : 1) + bgColors.length) % bgColors.length
  const color = bgColors[bgColorIndex]
  localStorage.setItem('bgColor', color)
  scene.setBackgroundColor(color)
  document.body.style.backgroundColor = color
  bgColorLabel.textContent = color.toUpperCase()
})

function updateNAStates() {
  const paused = pauseMotionBtn.getAttribute('aria-pressed') === 'true'
  const darkMode = darkModeBtn.getAttribute('aria-pressed') === 'true'
  setButtonNA(darkModeBtn, paused)
  setButtonNA(bgColorBtn, paused || darkMode)
  setButtonNA(refreshBtn, paused)
}

function setButtonNA(btn, isNA) {
  btn.classList.toggle('is-na', isNA)
  btn.disabled = isNA
}

// Keyboard shortcuts (WCAG 2.1.4 compliant — only fire when no interactive element has focus)
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return

  // Skip if a form element or button has focus
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return

  switch (e.key) {
    case 's': refreshBtn.click(); break
    case 'd': darkModeBtn.click(); break
    case 'b': bgColorBtn.click(); break
    case 'B': bgColorBtn.dispatchEvent(new MouseEvent('click', { shiftKey: true })); break
    case 'p': pauseMotionBtn.click(); break
    case 'c': case 'C': scene.spinLetter('C'); break
    case 'o': case 'O': scene.spinLetter('O'); break
    case 'r': case 'R': scene.spinLetter('R'); break
    case 'i': case 'I': scene.spinLetter('I'); break
    case 'n': case 'N': scene.spinLetter('N'); break
    case 'g': case 'G': scene.cycleGroup(); break
  }
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  scene.update()
}

animate()
