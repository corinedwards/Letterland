import * as THREE from 'three'
import { LetterManager } from './letterManager.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

export class ThreeScene {
  constructor(container, shapeFactory = null, sceneSettings = {}) {
    this.container = container
    this.shapeFactory = shapeFactory
    this.letterManager = null
    
    // Apply settings from config
    this.settings = {
      spacing: sceneSettings.spacing || 3.5,
      lineHeight: sceneSettings.lineHeight || 3,
      mobileSpacing: sceneSettings.mobileSpacing || 2.5,
      mobileLineHeight: sceneSettings.mobileLineHeight || 2.5,
      friction: sceneSettings.friction || 0.98,
      hoverToSpin: sceneSettings.hoverToSpin || false,
      returnToRest: sceneSettings.returnToRest !== false,
      returnToRestSpeed: sceneSettings.returnToRestSpeed || 0.02,
      cameraZ: sceneSettings.cameraZ || 10,
      floating: sceneSettings.floating || {
        enabled: true,
        amplitude: { x: 0.1, y: 0.15, z: 0.05 },
        rotation: { x: 0.05, y: 0.08, z: 0.03 },
        speed: 1.0,
        speedVariation: 0.3
      },
      demoSpin: sceneSettings.demoSpin || {
        delay: 4000,
        scratchVelocity: 0.08,
        scratchDuration: 300,
        scratchGap: 400,
        spinVelocity: 0.9
      },
      darkModeEffects: sceneSettings.darkModeEffects || {
        rgbShift: {
          enabled: true,
          maxShiftPixels: 3.0,
          animationSpeed: 0.016,
          blurIntensity: 0.2
        },
        distortion: {
          enabled: true,
          triggerInterval: 4000,
          duration: 400,
          updateFPS: 12,
          smearWidth: 0.30,
          smearHeight: 0.30,
          segments: 4.0,
          intensityMultiplier: 4.0
        }
      }
    }
    
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
    this.camera.position.z = this.settings.cameraZ

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)
    
    // Post-processing setup
    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)
    
    // Custom RGB Shift with blur effect
    const rgbConfig = this.settings.darkModeEffects.rgbShift
    const BlurredRGBShiftShader = {
      uniforms: {
        'tDiffuse': { value: null },
        'shiftPixels': { value: rgbConfig.maxShiftPixels },
        'resolution': { value: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight) },
        'blurSamples': { value: 5 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float shiftPixels;
        uniform vec2 resolution;
        uniform float blurSamples;
        varying vec2 vUv;
        
        void main() {
          vec2 texelSize = 1.0 / resolution;
          // Convert pixel shift to UV coordinates
          float shiftAmount = shiftPixels / resolution.x;
          vec3 color = vec3(0.0);
          
          // Sample and blur each color channel separately with offset
          vec3 r = vec3(0.0);
          vec3 g = vec3(0.0);
          vec3 b = vec3(0.0);
          float totalWeight = 0.0;
          
          // Blur sampling around the shifted positions
          for(float x = -2.0; x <= 2.0; x += 1.0) {
            for(float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * ${rgbConfig.blurIntensity.toFixed(2)};
              float weight = 1.0 / (1.0 + length(offset) * 10.0);
              
              r += texture2D(tDiffuse, vUv + vec2(shiftAmount, 0.0) + offset).rgb * weight;
              g += texture2D(tDiffuse, vUv + offset).rgb * weight;
              b += texture2D(tDiffuse, vUv - vec2(shiftAmount, 0.0) + offset).rgb * weight;
              totalWeight += weight;
            }
          }
          
          r /= totalWeight;
          g /= totalWeight;
          b /= totalWeight;
          
          color = vec3(r.r, g.g, b.b);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    }
    
    this.rgbShiftPass = new ShaderPass(BlurredRGBShiftShader)
    this.rgbShiftPass.enabled = false
    
    // Distortion effect variables
    const distConfig = this.settings.darkModeEffects.distortion
    this.distortionTime = 0
    this.lastDistortionUpdate = 0
    this.distortionUpdateInterval = 1000 / distConfig.updateFPS
    this.distortionTriggerInterval = distConfig.triggerInterval
    this.lastDistortionTrigger = 0
    this.distortionDuration = distConfig.duration
    this.distortionActive = false
    this.currentDistortionOffset = 0
    this.smearPositionSeed = Math.random() * 100 // Position seed that only changes every 4 seconds
    this.composer.addPass(this.rgbShiftPass)
    
    // Custom distortion shader for chunky horizontal shifts
    const DistortionShader = {
      uniforms: {
        'tDiffuse': { value: null },
        'distortionAmount': { value: 0.0 },
        'distortionSeed': { value: 0.0 },
        'smearPositionSeed': { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float distortionAmount;
        uniform float distortionSeed;
        uniform float smearPositionSeed;
        varying vec2 vUv;
        
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)) + distortionSeed) * 43758.5453123);
        }
        
        void main() {
          vec2 uv = vUv;
          
          // Define a small rectangular smear zone (position only changes every 4 seconds)
          float smearWidth = ${distConfig.smearWidth.toFixed(2)};  // Square - matches height
          float smearHeight = ${distConfig.smearHeight.toFixed(2)}; // Square
          float smearX = fract(sin(smearPositionSeed * 12.9898) * 43758.5453) * (1.0 - smearWidth);
          float smearY = fract(sin(smearPositionSeed * 78.233) * 43758.5453) * (1.0 - smearHeight);
          
          // Check if we're inside the smear rectangle
          bool inSmearZone = uv.x >= smearX && uv.x <= (smearX + smearWidth) &&
                            uv.y >= smearY && uv.y <= (smearY + smearHeight);
          
          // Only apply intense smearing inside the small rectangle
          if (distortionAmount > 0.0 && inSmearZone) {
            float localX = (uv.x - smearX) / smearWidth;
            float repeatCount = ${distConfig.segments.toFixed(1)};
            float segment = floor(localX * repeatCount);
            float segmentRandom = random(vec2(smearX, segment + 10.0));
            uv.y += (segmentRandom - 0.5) * distortionAmount * ${distConfig.intensityMultiplier.toFixed(1)};
          }
          
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `
    }
    
    this.distortionPass = new ShaderPass(DistortionShader)
    this.distortionPass.enabled = false
    this.composer.addPass(this.distortionPass)
    
    // CRT Glow effect shader
    const CRTShader = {
      uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight) },
        'brightness': { value: 1.05 },
        'scanlineIntensity': { value: 0.15 },
        'vignetteIntensity': { value: 0.5 },
        'glowIntensity': { value: 0.3 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float brightness;
        uniform float scanlineIntensity;
        uniform float vignetteIntensity;
        uniform float glowIntensity;
        varying vec2 vUv;
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;
          
          // Phosphor glow (bloom-like effect)
          vec2 texelSize = 1.0 / resolution;
          vec3 glow = vec3(0.0);
          float glowSamples = 0.0;
          for(float x = -3.0; x <= 3.0; x += 1.0) {
            for(float y = -3.0; y <= 3.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * 2.5;
              glow += texture2D(tDiffuse, vUv + offset).rgb;
              glowSamples += 1.0;
            }
          }
          glow /= glowSamples;
          color = mix(color, glow, glowIntensity);
          
          // Brightness adjustment
          color *= brightness;
          
          gl_FragColor = vec4(color, texel.a);
        }
      `
    }
    
    this.crtPass = new ShaderPass(CRTShader)
    this.crtPass.enabled = false
    this.composer.addPass(this.crtPass)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // Main directional light from camera position
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 0, 10)
    this.scene.add(directionalLight)

    // Subtle colored rim light
    const directionalLight2 = new THREE.DirectionalLight(0x667eea, 0.3)
    directionalLight2.position.set(-5, -5, 5)
    this.scene.add(directionalLight2)

    // Initialize letter manager with pre-configured shape factory
    this.letterManager = new LetterManager(this.scene, this.shapeFactory, this.settings.returnToRest, this.settings.returnToRestSpeed, this.settings.floating)
    this.letterManager.createLetters()
    
    // Apply spacing settings from config after letters are created
    this.updateLetterSpacing(this.settings.spacing, this.settings.lineHeight)
    
    // Window resize handler
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener('resize', this.handleResize)
    
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
    this.friction = this.settings.friction
    this.hoverMode = this.settings.hoverToSpin
    this.hoveredLetter = null
    this.lastHoveredLetter = null
    this.hoverTimeout = null
    this.globalVelocity = 0
    this.affectedLetters = new Set()
    this.paused = false
    this.darkMode = false
    this.userHasInteracted = false
    this.demoTimeouts = []

    // RGB shift animation
    this.rgbShiftTime = 0

    this.setupMouseControls()
  }
  
  handleResize() {
    // Update camera
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight
    this.camera.updateProjectionMatrix()
    
    // Update renderer
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.composer.setSize(this.container.clientWidth, this.container.clientHeight)
    
    // Update CRT resolution uniform
    if (this.crtPass) {
      this.crtPass.uniforms['resolution'].value.set(this.container.clientWidth, this.container.clientHeight)
    }
    
    // Update RGB shift resolution
    if (this.rgbShiftPass) {
      this.rgbShiftPass.uniforms['resolution'].value.set(this.container.clientWidth, this.container.clientHeight)
    }
    
    // Update letter layout for mobile/desktop
    this.updateLetterSpacing(this.settings.spacing, this.settings.lineHeight)
  }

  update() {
    if (this.paused) return
    
    // Animate RGB shift effect if enabled
    if (this.rgbShiftPass && this.rgbShiftPass.enabled) {
      this.rgbShiftTime += this.settings.darkModeEffects.rgbShift.animationSpeed
      // Fade in and out between 0 and maxShiftPixels
      const pulse = (Math.sin(this.rgbShiftTime) + 1) / 2 // 0 to 1
      const shiftAmount = pulse * this.settings.darkModeEffects.rgbShift.maxShiftPixels
      this.rgbShiftPass.uniforms['shiftPixels'].value = shiftAmount
    }
    
    // Update distortion/slicing effect if enabled
    if (this.distortionPass.enabled) {
      // Trigger distortion every 4 seconds
      const now = Date.now()
      
      // Check if we should trigger a new distortion burst
      if (now - this.lastDistortionTrigger > this.distortionTriggerInterval) {
        this.lastDistortionTrigger = now
        this.distortionActive = true
        // Generate new position for this burst
        this.smearPositionSeed = Math.random() * 100
      }
      
      // Check if current distortion burst should end
      if (this.distortionActive && now - this.lastDistortionTrigger > this.distortionDuration) {
        this.distortionActive = false
        this.distortionPass.uniforms['distortionAmount'].value = 0
      }
      
      // Update distortion at 12fps while active
      if (this.distortionActive && now - this.lastDistortionUpdate > this.distortionUpdateInterval) {
        this.lastDistortionUpdate = now
        // Random offset and seed for chunky shifts (but position stays the same)
        this.distortionPass.uniforms['distortionAmount'].value = Math.random() * 0.08
        this.distortionPass.uniforms['distortionSeed'].value = Math.random() * 100
        this.distortionPass.uniforms['smearPositionSeed'].value = this.smearPositionSeed
      }
    }
    
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
        if (this.settings.returnToRest) {
          this.selectedLetter.shouldReturnToOrigin = true // Start returning to origin
        }
        this.selectedLetter = null
      }
    }
    
    // Render with post-processing
    this.composer.render()
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
    this.cancelDemo()
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
    this.cancelDemo()

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
      const isMobile = window.innerWidth < 768
      const actualSpacing = isMobile ? this.settings.mobileSpacing : spacing
      const actualLineHeight = isMobile ? this.settings.mobileLineHeight : lineHeight
      
      this.letterManager.updateSpacing(actualSpacing, actualLineHeight)
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

  setPaused(paused) {
    this.paused = paused
    if (this.letterManager) {
      this.letterManager.setPaused(paused)
    }
  }

  setDarkMode(enabled) {
    this.darkMode = enabled
    
    if (enabled) {
      // Dark mode: black background, white shapes in wireframe
      this.scene.background = new THREE.Color(0x000000)
      document.body.style.backgroundColor = '#000000'
      
      // Enable distortion/slicing and RGB shift (CRT glow off)
      this.rgbShiftPass.enabled = true
      this.distortionPass.enabled = true
      this.crtPass.enabled = false
    } else {
      // Restore normal background
      const bgColor = localStorage.getItem('bgColor') || '#ffffff'
      this.scene.background = new THREE.Color(bgColor)
      document.body.style.backgroundColor = bgColor
      
      // Disable all effects
      this.rgbShiftPass.enabled = false
      this.distortionPass.enabled = false
      this.crtPass.enabled = false
    }
    
    // Update all letter materials
    if (this.letterManager) {
      this.letterManager.setDarkMode(enabled)
    }
  }

  regenerateLetters() {
    this.letterManager.regenerateLetters()
    // Reapply spacing after regeneration
    this.updateLetterSpacing(this.settings.spacing, this.settings.lineHeight)
    // Reapply current dark mode state to new letters immediately
    this.letterManager.setDarkMode(this.darkMode || false)
  }
  
  spinLetter(name) {
    const letter = this.letterManager.letterObjects.find(obj => obj.name === name.toUpperCase())
    if (!letter) return
    letter.hoverVelocity = this.settings.demoSpin?.keyboardSpinVelocity ?? 0.4
  }

  cancelDemo() {
    this.userHasInteracted = true
    this.demoTimeouts.forEach(t => clearTimeout(t))
    this.demoTimeouts = []
  }

  runDemoSpin() {
    if (this.paused || this.userHasInteracted) return
    const { delay, scratchVelocity, scratchDuration, scratchGap, spinVelocity } = this.settings.demoSpin

    // Animate a single scratch with sine easing (0 → peak → 0 over scratchDuration ms)
    const animateScratch = (direction, rLetter) => {
      const peak = scratchVelocity * direction
      const startTime = performance.now()
      const frame = (now) => {
        if (this.userHasInteracted) return
        const t = Math.min((now - startTime) / scratchDuration, 1)
        rLetter.hoverVelocity = peak * Math.sin(t * Math.PI)
        rLetter.shouldReturnToOrigin = false
        if (t < 1) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }

    const start = () => {
      if (this.userHasInteracted) return
      const rLetter = this.letterManager.letterObjects.find(obj => obj.name === 'R')
      if (!rLetter) return

      animateScratch(-1, rLetter)
      this.demoTimeouts.push(setTimeout(() => animateScratch(+1, rLetter), scratchGap))
      this.demoTimeouts.push(setTimeout(() => animateScratch(-1, rLetter), scratchGap * 2))
      this.demoTimeouts.push(setTimeout(() => {
        if (this.userHasInteracted) return
        rLetter.hoverVelocity = spinVelocity // big fast spin — returnToRest kicks in naturally after
      }, scratchGap * 3))
    }

    this.demoTimeouts.push(setTimeout(start, delay))
  }

  dispose() {
    // Clean up event listener
    window.removeEventListener('resize', this.handleResize)
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
