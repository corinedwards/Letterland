import './style.css'
import { ThreeScene } from './three/scene.js'
import { LetterShapeManager } from './letterManager.js'
import { ShapeFactory } from './three/shapeFactory.js'

// Async initialization
async function initApp() {
  // Show loading message
  const container = document.getElementById('three-container')
  container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: Courier; font-size: 14pt;">Loading custom shapes...</div>'
  
  // Initialize shape factory first
  const shapeFactory = new ShapeFactory()

  // Initialize letter manager and load custom shapes
  const letterShapeManager = new LetterShapeManager(shapeFactory)
  await letterShapeManager.initialize()

  // Clear loading message
  container.innerHTML = ''

  // Now initialize Three.js scene with the modified factory
  const scene = new ThreeScene(container, shapeFactory)
  
  return { scene, letterShapeManager }
}

// Start the app
const app = await initApp()
const scene = app.scene
const letterShapeManager = app.letterShapeManager

// Control buttons
const toggleBoundsBtn = document.getElementById('toggle-bounds')
const refreshBtn = document.getElementById('refresh')
const spacingSlider = document.getElementById('spacing-slider')
const spacingInput = document.getElementById('spacing-input')
const lineHeightSlider = document.getElementById('lineheight-slider')
const lineHeightInput = document.getElementById('lineheight-input')
const frictionSlider = document.getElementById('friction-slider')
const frictionInput = document.getElementById('friction-input')
const hoverModeCheckbox = document.getElementById('hover-mode')
const bgColorPicker = document.getElementById('bg-color')

// Restore all values from localStorage
let boundsVisible = localStorage.getItem('boundsVisible') === 'true'
let spacing = parseFloat(localStorage.getItem('spacing')) || 3.5
let lineHeight = parseFloat(localStorage.getItem('lineHeight')) || 3
let friction = parseFloat(localStorage.getItem('friction')) || 0.98
let hoverMode = localStorage.getItem('hoverMode') === 'true'
let bgColor = localStorage.getItem('bgColor') || '#ffffff'

// Set initial values
spacingSlider.value = spacing
spacingInput.value = spacing
lineHeightSlider.value = lineHeight
lineHeightInput.value = lineHeight
frictionSlider.value = friction
frictionInput.value = friction
hoverModeCheckbox.checked = hoverMode
bgColorPicker.value = bgColor

// Apply initial settings
scene.toggleBoundingBoxes(boundsVisible)
scene.updateLetterSpacing(spacing, lineHeight)
scene.setFriction(friction)
scene.setHoverMode(hoverMode)
scene.setBackgroundColor(bgColor)
document.body.style.backgroundColor = bgColor

toggleBoundsBtn.addEventListener('click', () => {
  boundsVisible = !boundsVisible
  localStorage.setItem('boundsVisible', boundsVisible)
  scene.toggleBoundingBoxes(boundsVisible)
})

refreshBtn.addEventListener('click', () => {
  location.reload()
})

// Spacing controls
spacingSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value)
  spacingInput.value = value
  localStorage.setItem('spacing', value)
  const lineHeight = parseFloat(lineHeightSlider.value)
  scene.updateLetterSpacing(value, lineHeight)
})

spacingInput.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value) || 0
  spacingSlider.value = value
  localStorage.setItem('spacing', value)
  const lineHeight = parseFloat(lineHeightInput.value) || 0
  scene.updateLetterSpacing(value, lineHeight)
})

// Line height controls
lineHeightSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value)
  lineHeightInput.value = value
  localStorage.setItem('lineHeight', value)
  const spacing = parseFloat(spacingSlider.value)
  scene.updateLetterSpacing(spacing, value)
})

lineHeightInput.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value) || 0
  lineHeightSlider.value = value
  localStorage.setItem('lineHeight', value)
  const spacing = parseFloat(spacingInput.value) || 0
  scene.updateLetterSpacing(spacing, value)
})

// Friction controls
frictionSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value)
  frictionInput.value = value
  localStorage.setItem('friction', value)
  scene.setFriction(value)
})

frictionInput.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value) || 0
  frictionSlider.value = value
  localStorage.setItem('friction', value)
  scene.setFriction(value)
})

// Hover mode toggle
hoverModeCheckbox.addEventListener('change', (e) => {
  localStorage.setItem('hoverMode', e.target.checked)
  scene.setHoverMode(e.target.checked)
})

// Background color picker
bgColorPicker.addEventListener('input', (e) => {
  const color = e.target.value
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
