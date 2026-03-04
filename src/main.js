import './style.css'
import { ThreeScene } from './three/scene.js'
import { ShapeFactory } from './three/shapeFactory.js'

// Async initialization
async function initApp() {
  // Restore settings from localStorage FIRST (before anything renders)
  const bgColor = localStorage.getItem('bgColor') || '#ffffff'
  const isDarkMode = localStorage.getItem('isDarkMode') === 'true'
  
  // Apply background and dark mode immediately (before fade-in)
  document.documentElement.style.backgroundColor = bgColor
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
        const hideDelay = sceneSettings.demoLoadDelay ? 5000 : 0
        setTimeout(() => {
          overlay.classList.add('hidden')
          setTimeout(() => {
            overlay.remove()
            scene.runDemoSpin()
          }, 400)
        }, hideDelay)
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
  flashActivated(refreshBtn)
  scene.regenerateLetters()
  announce('Letter shapes shuffled')
})

// Pause motion toggle
pauseMotionBtn.addEventListener('click', () => {
  flashActivated(pauseMotionBtn)
  const paused = pauseMotionBtn.getAttribute('aria-pressed') !== 'true'
  pauseMotionBtn.setAttribute('aria-pressed', String(paused))
  localStorage.setItem('isPaused', paused)
  scene.setPaused(paused)
  updateNAStates()
})

// Dark mode toggle
darkModeBtn.addEventListener('click', () => {
  flashActivated(darkModeBtn)
  const darkMode = darkModeBtn.getAttribute('aria-pressed') !== 'true'
  darkModeBtn.setAttribute('aria-pressed', String(darkMode))
  localStorage.setItem('isDarkMode', darkMode)
  scene.setDarkMode(darkMode)
  document.body.classList.toggle('dark-mode', darkMode)
  announce(darkMode ? 'Dark mode on' : 'Dark mode off')
  updateNAStates()
})

// Background colour — cycle through presets (shift-click to go backwards)
bgColorBtn.addEventListener('click', (e) => {
  flashActivated(bgColorBtn)
  bgColorIndex = (bgColorIndex + (e.shiftKey ? -1 : 1) + bgColors.length) % bgColors.length
  const color = bgColors[bgColorIndex]
  localStorage.setItem('bgColor', color)
  scene.setBackgroundColor(color)
  bgColorLabel.textContent = color.toUpperCase()
  announce(`Background colour: ${color.toUpperCase()}`)
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

function announce(message) {
  const el = document.getElementById('announcer')
  el.textContent = ''
  requestAnimationFrame(() => { el.textContent = message })
}

function flashActivated(el) {
  if (!el) return
  el.classList.remove('is-activated')
  void el.offsetWidth // force reflow to restart animation
  el.classList.add('is-activated')
  el.addEventListener('animationend', () => el.classList.remove('is-activated'), { once: true })
}

function flashKey(key) {
  flashActivated(document.querySelector(`.keyboard-key[data-key="${key}"]`))
}

// Keyboard shortcuts (WCAG 2.1.4 compliant — only fire when no interactive element has focus)
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return

  // Skip if a form element or button has focus
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return

  switch (e.key) {
    case 's': flashKey('s'); refreshBtn.click(); break
    case 'd': flashKey('d'); darkModeBtn.click(); break
    case 'b': flashKey('b'); bgColorBtn.click(); break
    case 'B': flashKey('b'); bgColorBtn.dispatchEvent(new MouseEvent('click', { shiftKey: true })); break
    case 'p': flashKey('p'); pauseMotionBtn.click(); break
    case 'c': case 'C': flashKey('c'); scene.spinLetter('C'); break
    case 'o': case 'O': flashKey('o'); scene.spinLetter('O'); break
    case 'r': case 'R': flashKey('r'); scene.spinLetter('R'); break
    case 'i': case 'I': flashKey('i'); scene.spinLetter('I'); break
    case 'n': case 'N': flashKey('n'); scene.spinLetter('N'); break
    case 'g': case 'G': scene.cycleGroup(); break
  }
})

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  scene.update()
}

animate()
