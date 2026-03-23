import * as THREE from 'three'
import { ShapeFactory } from './three/shapeFactory.js'

// ── State ──────────────────────────────────────────────────────────────
let currentLetter = 'C'
let currentShapeIndex = 0
const savedShapeIndex = {}
let currentColorIndex = 0
let currentMesh = null
let initialRotation = { x: 0, y: 0, z: 0 }
let floatingTime = 0
let floatingOffset = { x: 0, y: 0, z: 0 }
let floatingRotOffset = { x: 0, y: 0, z: 0 }
let floatingSpeed = 1
let floatingEnabled = true
let floatingIntensity = 1
let rotatingEnabled = false
let rotateSpeed = 1
let letterSize = 1

let shapeFactory, bgColors, floatingConfig, shapeNotes
let renderer, threeScene, camera
let lightAmbient, lightKey, lightFill

const savePref = (k, v) => localStorage.setItem('li.' + k, v)
const getPref  = (k, def) => localStorage.getItem('li.' + k) ?? def

// ── Init ───────────────────────────────────────────────────────────────
async function init() {
  shapeFactory = new ShapeFactory()
  await shapeFactory.loadCustomShapes()

  const sceneSettings = shapeFactory.fileLoader.config._scene || {}
  bgColors = sceneSettings.bgColors || ['#ffffff']
  shapeNotes = shapeFactory.fileLoader.config._shapeNotes || {}
  floatingConfig = sceneSettings.floating || {
    enabled: true,
    amplitude: { x: 0.04, y: 0.06, z: 0.05 },
    rotation: { x: 0, y: 0, z: 0.03 },
    speed: 2.0,
    speedVariation: 0.6
  }

  setupThree()
  populateLetters()
  populateColors()
  setupPreviewControls()
  setupShapeNote()
  restorePrefs()

  document.getElementById('loading').style.display = 'none'
  animate()
}

// ── Three.js ───────────────────────────────────────────────────────────
const CANVAS_BLEED_PX = 300 // extra pixels added to canvas (150px bleed per side)

function sizeCanvas(box) {
  const canvas = document.getElementById('canvas')
  const w = box.clientWidth
  const h = box.clientHeight
  renderer.setSize(w + CANVAS_BLEED_PX, h + CANVAS_BLEED_PX)
  canvas.style.position = 'absolute'
  canvas.style.left = `${-CANVAS_BLEED_PX / 2}px`
  canvas.style.top  = `${-CANVAS_BLEED_PX / 2}px`
}

function setupThree() {
  const canvas = document.getElementById('canvas')
  const box = document.getElementById('canvas-box')

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(window.devicePixelRatio)
  sizeCanvas(box)

  threeScene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(45, box.clientWidth / box.clientHeight, 0.1, 100)
  camera.position.z = 3

  lightAmbient = new THREE.AmbientLight(0xffffff, 1.5)
  threeScene.add(lightAmbient)
  lightKey = new THREE.DirectionalLight(0xffffff, 2.5)
  lightKey.position.set(2, 3, 4)
  threeScene.add(lightKey)
  lightFill = new THREE.DirectionalLight(0xffffff, 0.6)
  lightFill.position.set(-3, -1, -2)
  threeScene.add(lightFill)

  window.addEventListener('resize', onResize)
}

function updateCanvasLayout() {
  if (!renderer) return
  const box = document.getElementById('canvas-box')
  camera.aspect = box.clientWidth / box.clientHeight
  camera.updateProjectionMatrix()
  sizeCanvas(box)
}

function onResize() {
  updateCanvasLayout()
}

// ── Load a shape ───────────────────────────────────────────────────────
function loadShape(letter, index) {
  if (currentMesh) {
    threeScene.remove(currentMesh)
    currentMesh = null
  }

  const names = shapeFactory.shapeNames[letter]
  if (!names?.length) return

  const clampedIndex = Math.max(0, Math.min(index, names.length - 1))
  const shapeName = names[clampedIndex]
  const mesh = shapeFactory.getShapeByName(letter, shapeName)

  initialRotation = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z }
  floatingOffset = {
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2
  }
  floatingRotOffset = {
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2
  }
  floatingSpeed = 1 + (Math.random() - 0.5) * floatingConfig.speedVariation
  floatingTime = 0

  threeScene.add(mesh)
  currentMesh = mesh
  currentShapeIndex = clampedIndex
  savedShapeIndex[letter] = clampedIndex
  savePref('shapeIndex', JSON.stringify(savedShapeIndex))

  // Restore per-set lights
  const setName = shapeName.includes('-') ? shapeName.slice(shapeName.indexOf('-') + 1) : shapeName
  const savedLights = JSON.parse(getPref('lights.' + setName, 'null'))
  if (savedLights) {
    lightAmbient.intensity = savedLights.ambient
    lightKey.intensity     = savedLights.key
    lightFill.intensity    = savedLights.fill
    document.getElementById('light-ambient').value = savedLights.ambient
    document.getElementById('light-key').value     = savedLights.key
    document.getElementById('light-fill').value    = savedLights.fill
    document.getElementById('light-ambient-val').textContent = savedLights.ambient.toFixed(1)
    document.getElementById('light-key-val').textContent     = savedLights.key.toFixed(1)
    document.getElementById('light-fill-val').textContent    = savedLights.fill.toFixed(1)
  }

  updateActiveShape(clampedIndex)
  updateProps(shapeName)
  updateShapeLabel(letter, shapeName)
}

// ── Animation loop ─────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate)
  floatingTime += 0.016

  if (currentMesh && floatingEnabled) {
    const t = floatingTime * floatingConfig.speed * floatingSpeed
    const amp = floatingConfig.amplitude
    const rot = floatingConfig.rotation

    currentMesh.position.x = Math.sin(t + floatingOffset.x) * amp.x * floatingIntensity
    currentMesh.position.y = Math.sin(t + floatingOffset.y) * amp.y * floatingIntensity
    currentMesh.position.z = Math.sin(t + floatingOffset.z) * amp.z * floatingIntensity

    currentMesh.rotation.x = initialRotation.x + Math.sin(t * 0.8 + floatingRotOffset.x) * rot.x
    currentMesh.rotation.z = initialRotation.z + Math.sin(t * 0.9 + floatingRotOffset.z) * rot.z
  }

  if (currentMesh && rotatingEnabled) {
    currentMesh.rotation.y += 0.01 * rotateSpeed
  }

  renderer.render(threeScene, camera)
}

// ── UI: populate ───────────────────────────────────────────────────────
function populateLetters() {
  const row = document.getElementById('letter-row')
  for (const letter of ['C', 'O', 'R', 'I', 'N']) {
    const btn = document.createElement('button')
    btn.className = 'letter-btn' + (letter === currentLetter ? ' active' : '')
    btn.textContent = letter
    btn.addEventListener('click', () => {
      document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      // Try to match the same set name (e.g. "ShotTheSerif") in the new letter
      const currentName = shapeFactory.shapeNames[currentLetter]?.[currentShapeIndex] ?? ''
      const setName = currentName.includes('-') ? currentName.slice(currentName.indexOf('-') + 1) : ''
      const names = shapeFactory.shapeNames[letter] || []
      const matchIndex = setName ? names.findIndex(n => n.slice(n.indexOf('-') + 1) === setName) : -1
      currentLetter = letter
      savePref('letter', letter)
      populateShapes(letter)
      loadShape(letter, matchIndex !== -1 ? matchIndex : (savedShapeIndex[letter] ?? 0))
    })
    row.appendChild(btn)
  }
}

function populateShapes(letter) {
  const list = document.getElementById('shape-list')
  list.innerHTML = ''
  const names = shapeFactory.shapeNames[letter] || []
  names.forEach((name, i) => {
    const btn = document.createElement('button')
    btn.className = 'shape-btn'
    btn.textContent = name
    btn.title = name
    btn.addEventListener('click', () => loadShape(letter, i))
    list.appendChild(btn)
  })
}

function renderColorList() {
  const list = document.getElementById('color-list')
  list.innerHTML = ''
  const scene = shapeFactory.fileLoader.config._scene || {}
  const names = scene.bgColorNames || []
  const notes = scene.bgColorNotes || []
  const wcagData    = scene.bgColorWCAG    || []
  const apcaData    = scene.bgColorAPCA    || []
  const checkedData = scene.bgColorChecked || []

  bgColors.forEach((color, i) => {
    // Use div, not button — nested <button> inside <button> is invalid HTML
    const item = document.createElement('div')
    item.className = 'color-item' + (i === currentColorIndex ? ' active' : '')
    item.style.backgroundColor = color

    const hexWrap = document.createElement('span')
    hexWrap.className = 'color-label color-label-hex'
    hexWrap.textContent = color.toUpperCase()

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'color-label color-label-name'
    nameInput.value = names[i] || 'Unnamed'
    nameInput.addEventListener('click', e => e.stopPropagation())
    nameInput.addEventListener('input', () => { if (i === currentColorIndex) updateColorInfo(i) })
    nameInput.addEventListener('blur', () => saveColorData())

    const noteInput = document.createElement('input')
    noteInput.type = 'text'
    noteInput.className = 'color-label-note'
    noteInput.value = notes[i] || ''
    noteInput.placeholder = 'note or url…'
    noteInput.addEventListener('click', e => e.stopPropagation())
    noteInput.addEventListener('input', () => { if (i === currentColorIndex) updateColorInfo(i) })
    noteInput.addEventListener('blur', () => saveColorData())

    const wcagInput = document.createElement('input')
    wcagInput.type = 'text'
    wcagInput.className = 'color-label-wcag'
    wcagInput.value = wcagData[i] || ''
    wcagInput.placeholder = 'WCAG…'
    wcagInput.addEventListener('click', e => e.stopPropagation())
    wcagInput.addEventListener('blur', () => saveColorData())

    const apcaInput = document.createElement('input')
    apcaInput.type = 'text'
    apcaInput.className = 'color-label-apca'
    apcaInput.value = apcaData[i] || ''
    apcaInput.placeholder = 'APCA…'
    apcaInput.addEventListener('click', e => e.stopPropagation())
    apcaInput.addEventListener('blur', () => saveColorData())

    // Manual check toggle
    const checkBtn = document.createElement('span')
    checkBtn.className = 'color-check-btn' + (checkedData[i] ? ' checked' : '')
    checkBtn.textContent = checkedData[i] ? '✓ checked' : '○ unchecked'
    checkBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const isChecked = checkBtn.classList.toggle('checked')
      checkBtn.textContent = isChecked ? '✓ checked' : '○ unchecked'
      const s = shapeFactory.fileLoader.config._scene
      if (!s.bgColorChecked) s.bgColorChecked = []
      s.bgColorChecked[i] = isChecked
      saveColorData()
    })

    const delLink = document.createElement('a')
    delLink.className = 'color-delete-link'
    delLink.href = '#'
    delLink.textContent = 'delete'
    delLink.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const res = await fetch('/api/delete-color', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index: i })
        })
        const result = await res.json()
        if (result.ok) {
          const s = shapeFactory.fileLoader.config._scene
          const splice = (arr) => Array.isArray(arr) && arr.splice(i, 1)
          splice(s.bgColors)
          splice(s.bgColorNames)
          splice(s.bgColorNotes)
          splice(s.bgColorWCAG)
          splice(s.bgColorAPCA)
          splice(s.bgColorChecked)
          if (currentColorIndex >= bgColors.length) currentColorIndex = bgColors.length - 1
          const wrap = document.getElementById('canvas-wrap')
          wrap.style.background = bgColors[currentColorIndex] || '#fff'
          updateColorInfo(currentColorIndex)
          renderColorList()
        } else {
          alert(`Error: ${result.error}`)
        }
      } catch {
        alert('Could not reach dev server')
      }
    })

    const btnGroup = document.createElement('div')
    btnGroup.className = 'color-btn-group'
    btnGroup.appendChild(checkBtn)

    item.appendChild(hexWrap)
    item.appendChild(nameInput)
    item.appendChild(noteInput)
    item.appendChild(wcagInput)
    item.appendChild(apcaInput)

    const footer = document.createElement('div')
    footer.className = 'color-card-footer'
    footer.appendChild(checkBtn)
    footer.appendChild(delLink)

    item.appendChild(footer)

    item.addEventListener('click', () => {
      document.querySelectorAll('.color-item').forEach(s => s.classList.remove('active'))
      item.classList.add('active')
      currentColorIndex = i
      savePref('colorIndex', i)
      document.getElementById('canvas-wrap').style.background = color
      updateColorInfo(i)
    })
    list.appendChild(item)
  })
}

async function saveColorData(showFeedback = false) {
  const names   = Array.from(document.querySelectorAll('.color-label-name')).map(el => el.value.trim() || 'Unnamed')
  const notes   = Array.from(document.querySelectorAll('.color-label-note')).map(el => el.value.trim())
  const wcag    = Array.from(document.querySelectorAll('.color-label-wcag')).map(el => el.value.trim())
  const apca    = Array.from(document.querySelectorAll('.color-label-apca')).map(el => el.value.trim())
  const checked = Array.from(document.querySelectorAll('.color-check-btn')).map(btn => btn.classList.contains('checked'))
  const statusEl = document.getElementById('save-status')
  const saveBtn  = document.getElementById('save-btn')

  try {
    const res = await fetch('/api/save-color-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, notes, wcag, apca, checked })
    })
    const result = await res.json()
    if (result.ok) {
      if (showFeedback) {
        saveBtn.classList.add('saved')
        saveBtn.textContent = 'Saved ✓'
        statusEl.textContent = 'shapes-config.json updated'
        setTimeout(() => {
          saveBtn.classList.remove('saved')
          saveBtn.textContent = 'Save names to config'
          statusEl.textContent = ''
        }, 2500)
      } else {
        statusEl.textContent = 'auto-saved'
        setTimeout(() => { statusEl.textContent = '' }, 1200)
      }
    } else {
      statusEl.textContent = `Error: ${result.error}`
    }
  } catch {
    statusEl.textContent = 'Could not reach dev server'
  }
}

function populateColors() {
  renderColorList()
  document.getElementById('canvas-wrap').style.background = bgColors[0] || '#fff'
  updateColorInfo(0)
  document.getElementById('save-btn').addEventListener('click', () => saveColorData(true))
}

function updateActiveShape(index) {
  document.querySelectorAll('.shape-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index)
  })
}

// ── Props readout ──────────────────────────────────────────────────────
function updateProps(shapeName) {
  document.getElementById('shape-heading').innerHTML =
    `<strong>${shapeName}</strong>`

  const noteInput = document.getElementById('shape-note')
  noteInput.value = shapeNotes[shapeName] || ''
  noteInput.dataset.shape = shapeName
  updateShapeDesc(shapeNotes[shapeName] || '')

  const settings = shapeFactory.fileLoader.getSettings(shapeName)
  const defaults = shapeFactory.fileLoader.defaults

  const table = document.getElementById('props-table')
  table.innerHTML = ''

  for (const [key, value] of Object.entries(settings)) {
    const isCustom = defaults[key] !== value
    const tr = document.createElement('tr')

    const keyTd = document.createElement('td')
    keyTd.className = 'prop-key' + (isCustom ? ' is-custom' : '')
    keyTd.textContent = key

    const valTd = document.createElement('td')
    if (!isCustom) {
      valTd.className = 'prop-val-def'
      valTd.textContent = formatValue(value)
    } else if (typeof value === 'string') {
      valTd.className = 'prop-val-str'
      valTd.textContent = `"${value}"`
    } else if (typeof value === 'number') {
      valTd.className = 'prop-val-num'
      valTd.textContent = value
    } else if (typeof value === 'boolean') {
      valTd.className = 'prop-val-bool'
      valTd.textContent = value
    } else {
      valTd.textContent = String(value)
    }

    tr.appendChild(keyTd)
    tr.appendChild(valTd)
    table.appendChild(tr)
  }
}

function formatValue(value) {
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

// ── Shape label ────────────────────────────────────────────────────────
function updateShapeLabel(letter, shapeName) {
  const el = document.getElementById('canvas-shape-label')
  if (!el) return
  const info = shapeFactory.loadedCustomShapes[letter]?.find(s => s.key === shapeName)
  if (!info) { el.innerHTML = ''; return }

  const filename = info.path.split('/').pop()

  el.innerHTML = `<span class="label-name">${filename}</span>`
}

// ── Color info bar ─────────────────────────────────────────────────────
function updateColorInfo(index) {
  const color = bgColors[index]
  const nameInputs = document.querySelectorAll('.color-label-name')
  const noteInputs = document.querySelectorAll('.color-label-note')
  const name = nameInputs[index]?.value || ''
  const note = noteInputs[index]?.value || ''

  document.getElementById('canvas-info-hex').textContent = color.toUpperCase()
  document.getElementById('canvas-info-name').textContent = (name && name !== 'Unnamed') ? name : ''
  document.getElementById('canvas-info-note').textContent = note
}

// ── Preview controls ───────────────────────────────────────────────────
function setupPreviewControls() {
  const toggleBtn = document.getElementById('float-toggle')
  const rotateBtn = document.getElementById('rotate-toggle')
  const intensitySlider = document.getElementById('float-intensity')
  const intensityVal = document.getElementById('float-intensity-val')
  const rotateSpeedSlider = document.getElementById('rotate-speed')
  const rotateSpeedVal = document.getElementById('rotate-speed-val')

  toggleBtn.addEventListener('click', () => {
    floatingEnabled = !floatingEnabled
    toggleBtn.classList.toggle('is-on', floatingEnabled)
    toggleBtn.textContent = floatingEnabled ? 'On' : 'Off'
    savePref('floating', floatingEnabled)
  })

  rotateBtn.addEventListener('click', () => {
    rotatingEnabled = !rotatingEnabled
    rotateBtn.classList.toggle('is-on', rotatingEnabled)
    rotateBtn.textContent = rotatingEnabled ? 'On' : 'Off'
    savePref('rotating', rotatingEnabled)
  })

  intensitySlider.addEventListener('input', () => {
    floatingIntensity = parseFloat(intensitySlider.value)
    intensityVal.textContent = floatingIntensity.toFixed(1) + '×'
    savePref('floatIntensity', floatingIntensity)
  })

  rotateSpeedSlider.addEventListener('input', () => {
    rotateSpeed = parseFloat(rotateSpeedSlider.value)
    rotateSpeedVal.textContent = rotateSpeed.toFixed(1) + '×'
    savePref('rotateSpeed', rotateSpeed)
  })

  const letterSizeSlider = document.getElementById('letter-size')
  const letterSizeVal = document.getElementById('letter-size-val')
  letterSizeSlider.addEventListener('input', () => {
    letterSize = parseFloat(letterSizeSlider.value)
    letterSizeVal.textContent = letterSize.toFixed(1) + '×'
    camera.position.z = 3 / letterSize
    savePref('letterSize', letterSize)
  })

  const boxSizeSlider = document.getElementById('box-size')
  const boxSizeValEl = document.getElementById('box-size-val')
  boxSizeSlider.addEventListener('input', () => {
    const val = parseFloat(boxSizeSlider.value)
    boxSizeValEl.textContent = val
    const box = document.getElementById('canvas-box')
    box.style.width = val + 'vmin'
    box.style.height = val + 'vmin'
    requestAnimationFrame(updateCanvasLayout)
    savePref('boxSize', val)
  })

  const saveCurrentLights = () => {
    const shapeName = shapeFactory.shapeNames[currentLetter]?.[currentShapeIndex] ?? ''
    const setName = shapeName.includes('-') ? shapeName.slice(shapeName.indexOf('-') + 1) : shapeName
    if (setName) savePref('lights.' + setName, JSON.stringify({
      ambient: lightAmbient.intensity,
      key:     lightKey.intensity,
      fill:    lightFill.intensity
    }))
  }

  const mkLight = (id, valId, light) => {
    const slider = document.getElementById(id)
    const label  = document.getElementById(valId)
    slider.addEventListener('input', () => {
      light.intensity = parseFloat(slider.value)
      label.textContent = parseFloat(slider.value).toFixed(1)
      saveCurrentLights()
    })
  }
  mkLight('light-ambient', 'light-ambient-val', lightAmbient)
  mkLight('light-key',     'light-key-val',     lightKey)
  mkLight('light-fill',    'light-fill-val',    lightFill)
}

// ── Shape note ─────────────────────────────────────────────────────────
function updateShapeDesc(text) {
  const el = document.getElementById('canvas-shape-desc')
  if (el) el.textContent = text
}

function setupShapeNote() {
  const input = document.getElementById('shape-note')
  const status = document.getElementById('shape-note-status')

  input.addEventListener('input', () => updateShapeDesc(input.value))

  input.addEventListener('blur', async () => {
    const shapeName = input.dataset.shape
    if (!shapeName) return
    const note = input.value.trim()
    if (note) shapeNotes[shapeName] = note
    else delete shapeNotes[shapeName]

    try {
      const res = await fetch('/api/save-shape-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shapeName, note })
      })
      const result = await res.json()
      if (result.ok) {
        status.textContent = 'saved'
        setTimeout(() => { status.textContent = '' }, 1500)
      } else {
        status.textContent = `error: ${result.error}`
      }
    } catch {
      status.textContent = 'could not reach dev server'
    }
  })
}

// ── Restore persisted prefs ────────────────────────────────────────────
function restorePrefs() {
  // Toggles
  floatingEnabled  = getPref('floating',  'true')  === 'true'
  rotatingEnabled  = getPref('rotating',  'false') === 'true'
  const floatBtn   = document.getElementById('float-toggle')
  const rotateBtn  = document.getElementById('rotate-toggle')
  floatBtn.classList.toggle('is-on', floatingEnabled)
  floatBtn.textContent  = floatingEnabled  ? 'On' : 'Off'
  rotateBtn.classList.toggle('is-on', rotatingEnabled)
  rotateBtn.textContent = rotatingEnabled ? 'On' : 'Off'

  // Float intensity
  floatingIntensity = parseFloat(getPref('floatIntensity', '1'))
  const fiSlider = document.getElementById('float-intensity')
  fiSlider.value = floatingIntensity
  document.getElementById('float-intensity-val').textContent = floatingIntensity.toFixed(1) + '×'

  // Rotate speed
  rotateSpeed = parseFloat(getPref('rotateSpeed', '1'))
  const rsSlider = document.getElementById('rotate-speed')
  rsSlider.value = rotateSpeed
  document.getElementById('rotate-speed-val').textContent = rotateSpeed.toFixed(1) + '×'

  // Letter size
  letterSize = parseFloat(getPref('letterSize', '1'))
  const lsSlider = document.getElementById('letter-size')
  lsSlider.value = letterSize
  document.getElementById('letter-size-val').textContent = letterSize.toFixed(1) + '×'
  camera.position.z = 3 / letterSize

  // Box size
  const boxSize = parseFloat(getPref('boxSize', '50'))
  const bsSlider = document.getElementById('box-size')
  bsSlider.value = boxSize
  document.getElementById('box-size-val').textContent = boxSize
  const box = document.getElementById('canvas-box')
  box.style.width  = boxSize + 'vmin'
  box.style.height = boxSize + 'vmin'
  requestAnimationFrame(updateCanvasLayout)

  // Letter + shape (lights restored inside loadShape)
  const letter = getPref('letter', 'C')
  Object.assign(savedShapeIndex, JSON.parse(getPref('shapeIndex', '{}')))
  currentLetter = letter
  document.querySelectorAll('.letter-btn').forEach(b => b.classList.toggle('active', b.textContent === letter))
  populateShapes(letter)
  loadShape(letter, savedShapeIndex[letter] ?? 0)

  // Color
  const colorIdx = parseInt(getPref('colorIndex', '0'))
  const colorBtns = document.querySelectorAll('.color-item')
  colorBtns[colorIdx]?.click()
}

// ── Go ─────────────────────────────────────────────────────────────────
init().catch(console.error)
