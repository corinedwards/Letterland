import * as THREE from 'three'
import { LetterManager } from './letterManager.js'

export class ThreeScene {
  constructor(container, shapeFactory = null) {
    this.container = container
    this.shapeFactory = shapeFactory
    this.letterManager = null
    
    this.init()
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xffffff)

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.z = 10

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // Main directional light from camera position (like sun from viewer's eyes)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 0, 10) // Same Z as camera
    directionalLight.castShadow = true
    
    // Configure shadow properties for soft shadows
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -20
    directionalLight.shadow.camera.right = 20
    directionalLight.shadow.camera.top = 20
    directionalLight.shadow.camera.bottom = -20
    directionalLight.shadow.radius = 4 // Softer shadows
    directionalLight.shadow.bias = -0.0001
    
    this.scene.add(directionalLight)

    // Subtle colored rim light
    const directionalLight2 = new THREE.DirectionalLight(0x667eea, 0.3)
    directionalLight2.position.set(-5, -5, 5)
    this.scene.add(directionalLight2)
    
    // Add invisible ground plane to receive shadows
    const groundGeometry = new THREE.PlaneGeometry(100, 100)
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -3
    ground.receiveShadow = true
    this.scene.add(ground)

    // Initialize letter manager with pre-configured shape factory
    this.letterManager = new LetterManager(this.scene, this.shapeFactory)
    this.letterManager.createLetters()
    
    // Mouse interaction setup
    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.Points.threshold = 0.5
    this.raycaster.params.Line.threshold = 0.5
    this.mouse = new THREE.Vector2()
    this.isDragging = false
    this.selectedLetter = null
    this.previousMousePosition = { x: 0, y: 0 }
    this.velocity = { x: 0, y: 0 }
    this.lastMoveTime = 0
    this.friction = 0.98
    this.hoverMode = false
    this.hoveredLetter = null
    this.lastHoveredLetter = null
    this.hoverTimeout = null
    this.globalVelocity = 0
    this.affectedLetters = new Set()
    
    this.setupMouseControls()
  }

  update() {
    if (this.letterManager) {
      this.letterManager.update()
    }
    
    // Grab mode momentum (hover momentum is handled per-letter in letterManager)
    if (!this.hoverMode && !this.isDragging && this.selectedLetter && this.velocity.x !== 0) {
      this.selectedLetter.mesh.rotation.y += this.velocity.x
      
      // Apply friction
      this.velocity.x *= this.friction
      
      // Stop if velocity is very small
      if (Math.abs(this.velocity.x) < 0.0005) {
        this.velocity.x = 0
        this.selectedLetter = null
      }
    }
    
    this.renderer.render(this.scene, this.camera)
  }

  toggleBoundingBoxes(visible) {
    if (this.letterManager) {
      this.letterManager.toggleBoundingBoxes(visible)
    }
  }

  setupMouseControls() {
    const canvas = this.renderer.domElement
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e))
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
    canvas.addEventListener('mouseup', () => this.onMouseUp())
    canvas.addEventListener('mouseleave', () => this.onMouseUp())
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e))
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e))
    
    canvas.style.cursor = 'grab'
  }
  
  onTouchStart(event) {
    const touch = event.touches[0]
    
    // Store initial touch position
    this.touchStartX = touch.clientX
    this.touchStartY = touch.clientY
    this.touchMoveThreshold = 10 // pixels
    
    // Convert touch to mouse-like event
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY
    }
    
    if (!this.hoverMode) {
      this.onMouseDown(mouseEvent)
    } else {
      this.previousMousePosition = { x: touch.clientX, y: touch.clientY }
    }
  }
  
  onTouchMove(event) {
    const touch = event.touches[0]
    
    // Calculate movement deltas
    const deltaX = Math.abs(touch.clientX - this.touchStartX)
    const deltaY = Math.abs(touch.clientY - this.touchStartY)
    
    // Only prevent default and handle 3D interaction if horizontal movement dominates
    if (deltaX > deltaY && deltaX > this.touchMoveThreshold) {
      event.preventDefault()
      
      // Convert touch to mouse-like event
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
      }
      
      this.onMouseMove(mouseEvent)
    }
    // Otherwise allow vertical scrolling to work normally
  }
  
  onTouchEnd(event) {
    event.preventDefault()
    this.onMouseUp()
  }
  
  checkHover(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const meshes = this.letterManager.letterObjects.map(obj => obj.mesh)
    const intersects = this.raycaster.intersectObjects(meshes, true)
    
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      const letter = this.letterManager.letterObjects.find(obj => 
        obj.mesh === clickedMesh || obj.mesh.children.includes(clickedMesh)
      )
      return letter
    }
    return null
  }
  
  onMouseDown(event) {
    if (this.hoverMode) return // Don't handle clicks in hover mode
    
    const letter = this.checkHover(event)
    
    if (letter) {
      this.isDragging = true
      this.selectedLetter = letter
      this.previousMousePosition = { x: event.clientX, y: event.clientY }
      this.renderer.domElement.style.cursor = 'grabbing'
    }
  }
  
  onMouseMove(event) {
    if (this.hoverMode) {
      // Track global mouse velocity
      const deltaX = event.clientX - this.previousMousePosition.x
      
      if (this.previousMousePosition.x !== 0 && Math.abs(deltaX) > 0) {
        const baseVelocity = deltaX * 0.015
        
        // Check which letter we're hovering
        const letter = this.checkHover(event)
        
        if (letter) {
          // Apply full velocity to hovered letter
          letter.hoverVelocity = baseVelocity
          
          // Apply reduced velocity to adjacent letters based on distance
          const letterIndex = this.letterManager.letterObjects.indexOf(letter)
          if (letterIndex !== -1) {
            // Left neighbor
            if (letterIndex > 0) {
              const leftLetter = this.letterManager.letterObjects[letterIndex - 1]
              leftLetter.hoverVelocity = baseVelocity * 0.35
            }
            // Right neighbor
            if (letterIndex < this.letterManager.letterObjects.length - 1) {
              const rightLetter = this.letterManager.letterObjects[letterIndex + 1]
              rightLetter.hoverVelocity = baseVelocity * 0.35
            }
          }
          
          this.hoveredLetter = letter
          this.renderer.domElement.style.cursor = 'pointer'
        } else {
          this.renderer.domElement.style.cursor = 'default'
        }
      }
      
      this.previousMousePosition = { x: event.clientX, y: event.clientY }
    } else {
      // Grab mode: rotate on drag
      if (!this.isDragging || !this.selectedLetter) return
      
      const currentTime = Date.now()
      const deltaTime = currentTime - this.lastMoveTime || 16
      
      const deltaX = event.clientX - this.previousMousePosition.x
      const deltaY = event.clientY - this.previousMousePosition.y
      
      // Calculate velocity for momentum (Y axis only)
      this.velocity.x = deltaX * 0.01  // Use horizontal mouse movement for Y rotation
      this.velocity.y = 0
      
      // Rotate based on mouse movement (Y axis only)
      this.selectedLetter.mesh.rotation.y += this.velocity.x
      
      this.previousMousePosition = { x: event.clientX, y: event.clientY }
      this.lastMoveTime = currentTime
    }
  }
  
  onMouseUp() {
    this.isDragging = false
    // Keep selectedLetter for momentum - will be cleared when momentum stops
    this.renderer.domElement.style.cursor = 'grab'
  }

  onResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    
    // Update letter positions for responsive layout
    if (this.letterManager) {
      this.letterManager.updateLayout()
    }
  }

  updateLetterSpacing(spacing, lineHeight) {
    if (this.letterManager) {
      this.letterManager.updateSpacing(spacing, lineHeight)
    }
  }

  setFriction(friction) {
    this.friction = friction
  }

  setHoverMode(enabled) {
    this.hoverMode = enabled
    this.isDragging = false
    this.selectedLetter = null
    this.hoveredLetter = null
    this.renderer.domElement.style.cursor = enabled ? 'default' : 'grab'
  }

  setBackgroundColor(color) {
    this.scene.background = new THREE.Color(color)
  }
}
