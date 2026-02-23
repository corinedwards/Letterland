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
      demoSpinOverlay: sceneSettings.demoSpinOverlay || {},
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

    // Camera setup — 50° telephoto FOV for desktop, 75° for mobile
    const isMobileInit = this.container.clientWidth < 768
    this.camera = new THREE.PerspectiveCamera(
      isMobileInit ? 75 : 50,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.z = isMobileInit ? this.settings.cameraZ : this.computeDesktopCameraZ()

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
    
    // Resize handler — observes the container directly so CSS height changes
    // (e.g. via HMR or media queries) are picked up without a window resize event.
    // Debounced so rapid-fire events during drag-resize don't cause flickering.
    this.handleResize = this.handleResize.bind(this)
    let _resizeTimer = null
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(_resizeTimer)
      _resizeTimer = setTimeout(() => this.handleResize(), 50)
    })
    this.resizeObserver.observe(this.container)
    
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

    // Group cycling — parsed from the raw config (before key expansion) so comma-separated
    // groups like "C-Chunky, O-Chunky, ..." are preserved as coordinated sets.
    this.shapeGroups = this._parseShapeGroups(this.shapeFactory?.fileLoader?.rawConfig || {})
    this.currentGroupIndex = -1 // -1 = random mode
    this.demoSpinOverlay = null
    const oc = this.settings.demoSpinOverlay
    this.demoSpinOverlayRadius       = oc.radius        ?? 0.75
    this.demoSpinOverlayTickHalf     = (oc.tickLength   ?? 0.48) / 2
    this.demoSpinOverlayTickN        = oc.tickDensity   ?? 60
    this.demoSpinOverlayLineColor    = oc.lineColor     ?? '#ff1493'
    this.demoSpinOverlayGlowColor    = oc.glowColor     ?? '#ff1493'
    this.demoSpinOverlayXRotation    = oc.orbitXRotation ?? 96
    this.demoSpinOverlayYRotation    = (oc.orbitYRotation ?? 0) * Math.PI / 180
    this.demoSpinOverlayNeedleSpeed  = oc.needleSpeed   ?? 0.5
    this.demoRingFadeInOffset  = oc.ringFadeInOffset  ?? -600
    this.demoRingFadeInLength  = oc.ringFadeInLength  ?? 500
    this.demoRingFadeOutOffset = oc.ringFadeOutOffset ?? 1500
    this.demoRingFadeOutLength = oc.ringFadeOutLength ?? 500
    this.demoNeedleFadeOutOffset = oc.needleFadeOutOffset ?? 2500
    this.demoNeedleFadeOutLength = oc.needleFadeOutLength ?? 1400
    this.demoNeedleFadeInLength  = oc.needleFadeInLength  ?? 400
    this.devRingFadeStartTime   = null
    this.devRingFadeDir         = 1
    this.devRingFadeLength      = 500
    this.devRingFadeStartOpacity = 0
    this.devOrbitRing = null

    // RGB shift animation
    this.rgbShiftTime = 0

    this.setupMouseControls()
  }

  // Compute desktop camera Z to fit the letter array at ~90% of the frustum width.
  // Uses 50° FOV (telephoto) — less perspective distortion than 75°.
  // Minimum 3.5 keeps the camera from getting too close.
  computeDesktopCameraZ() {
    const fovRad = 50 * Math.PI / 180
    const aspect = this.container.clientWidth / this.container.clientHeight
    const letterArrayWidth = this.settings.spacing * 4 + 2
    const z = letterArrayWidth / (0.90 * 2 * Math.tan(fovRad / 2) * aspect)
    return Math.max(3.5, z)
  }

  handleResize() {
    // Update camera
    const isMobile = this.container.clientWidth < 768
    this.camera.fov = isMobile ? 75 : 50
    this.camera.position.z = isMobile ? this.settings.cameraZ : this.computeDesktopCameraZ()
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

    // Dev orbit ring — create once, then just track R letter position each frame
    if (this.letterManager) {
      const rLetter = this.letterManager.letterObjects.find(obj => obj.name === 'R')
      if (rLetter?.mesh) {
        if (!this.devOrbitRing) this.createDevOrbitRing()
        rLetter.mesh.getWorldPosition(this.devOrbitRing.group.position)
      }
    }

    // Animate ring globalOpacity
    if (this.devOrbitRing && this.devRingFadeStartTime !== null) {
      const t = Math.min((Date.now() - this.devRingFadeStartTime) / this.devRingFadeLength, 1)
      this.devOrbitRing.mat.uniforms.globalOpacity.value = this.devRingFadeDir > 0
        ? t                                        // fade in:  0 → 1
        : this.devRingFadeStartOpacity * (1 - t)   // fade out: startOpacity → 0
      if (t >= 1) this.devRingFadeStartTime = null
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
    
    // Update demo orb if active
    if (this.demoSpinOverlay) this.updateDemoOrb()

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
      // Any mouse movement over the canvas counts as interaction — cancel demo once
      if (!this.userHasInteracted) this.cancelDemo()

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
    const isMobile = this.container.clientWidth < 768
    this.camera.position.z = isMobile ? this.settings.cameraZ : this.computeDesktopCameraZ()
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

  // Parse config keys into a list of groups: [{ label, assignments: { C: 'ShapeName', ... } }]
  // Keys starting with _ are skipped. For each remaining key, the first LETTER-ShapeName
  // occurrence per letter is used (later duplicates for the same letter are ignored).
  _parseShapeGroups(config) {
    const LETTERS = new Set(['C', 'O', 'R', 'I', 'N'])
    const skip = new Set(['_readme', '_scene', '_defaults'])
    const groups = []
    for (const key of Object.keys(config)) {
      if (skip.has(key)) continue
      const assignments = {}
      key.split(',').forEach(part => {
        const dash = part.trim().indexOf('-')
        if (dash === -1) return
        const letter = part.trim().slice(0, dash).toUpperCase()
        const fullKey = part.trim() // e.g. "C-ShotTheSerif" — must match shapeNames[letter]
        if (LETTERS.has(letter) && !(letter in assignments)) {
          assignments[letter] = fullKey
        }
      })
      if (Object.keys(assignments).length >= 3) {
        groups.push({ label: key.trim(), assignments })
      }
    }
    return groups
  }

  // Advance to the next group (wraps around). Unspecified letters get random shapes.
  cycleGroup() {
    if (this.shapeGroups.length === 0) return
    this.currentGroupIndex = (this.currentGroupIndex + 1) % this.shapeGroups.length
    const { assignments } = this.shapeGroups[this.currentGroupIndex]
    this.letterManager.regenerateLetters(assignments)
    this.updateLetterSpacing(this.settings.spacing, this.settings.lineHeight)
    this.letterManager.setDarkMode(this.darkMode || false)
  }

  // Back to fully random shape selection
  randomMode() {
    this.currentGroupIndex = -1
    this.regenerateLetters()
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
    this.hideDemoOrb()
    // Only fade out if the ring is actually visible — avoids a flash on every user spin
    if ((this.devOrbitRing?.mat.uniforms.globalOpacity.value ?? 0) > 0) {
      this._startRingFade(-1)
    }
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

      this.createDemoOrb(rLetter)

      animateScratch(-1, rLetter)
      this.demoTimeouts.push(setTimeout(() => animateScratch(+1, rLetter), scratchGap))
      this.demoTimeouts.push(setTimeout(() => animateScratch(-1, rLetter), scratchGap * 2))
      this.demoTimeouts.push(setTimeout(() => {
        if (this.userHasInteracted) return
        rLetter.hoverVelocity = spinVelocity // big fast spin — returnToRest kicks in naturally after
      }, scratchGap * 3))
      // Fade the orb out after the spin has had time to decay
      this.demoTimeouts.push(setTimeout(() => this.hideDemoOrb(), scratchGap * 3 + this.demoNeedleFadeOutOffset))
      // Fade ring out
      this.demoTimeouts.push(setTimeout(() => {
        if (!this.userHasInteracted) this._startRingFade(-1)
      }, scratchGap * 3 + this.demoRingFadeOutOffset))
    }

    // Fade ring in (offset is relative to spin start, so absolute time = delay + offset)
    const fadeInAt = Math.max(0, delay + this.demoRingFadeInOffset)
    this.demoTimeouts.push(setTimeout(() => {
      if (!this.userHasInteracted) this._startRingFade(1)
    }, fadeInAt))

    this.demoTimeouts.push(setTimeout(start, delay))
  }

  buildOrbitPoints(radius) {
    const points = []
    const N = 64
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const rotY = this.demoSpinOverlayYRotation
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const bx = radius * Math.cos(a)
      const by = radius * Math.sin(a) * Math.cos(tilt)
      const bz = radius * Math.sin(a) * Math.sin(tilt)
      points.push(new THREE.Vector3(
        bx * Math.cos(rotY) + bz * Math.sin(rotY),
        by,
        -bx * Math.sin(rotY) + bz * Math.cos(rotY) + 0.3
      ))
    }
    return points
  }

  buildTickPoints(radius) {
    const N = this.demoSpinOverlayTickN
    const tickHalf = this.demoSpinOverlayTickHalf
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const rotY = this.demoSpinOverlayYRotation
    // Orbit plane normal — ticks stand perpendicular to the orbit plane, following X and Y rotation
    const nx = Math.cos(tilt) * Math.sin(rotY)
    const ny = -Math.sin(tilt)
    const nz = Math.cos(tilt) * Math.cos(rotY)
    const points = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const bx = radius * Math.cos(a)
      const by = radius * Math.sin(a) * Math.cos(tilt)
      const bz = radius * Math.sin(a) * Math.sin(tilt)
      const px = bx * Math.cos(rotY) + bz * Math.sin(rotY)
      const py = by
      const pz = -bx * Math.sin(rotY) + bz * Math.cos(rotY) + 0.3
      points.push(new THREE.Vector3(px - nx*tickHalf, py - ny*tickHalf, pz - nz*tickHalf))
      points.push(new THREE.Vector3(px + nx*tickHalf, py + ny*tickHalf, pz + nz*tickHalf))
    }
    return points
  }

  // Per-vertex alpha for the half-ring fade — front half visible, back half fades to transparent.
  // Works with any blend mode since we use real alpha, not the additive colour trick.
  _facingAlpha(bx, bz, radius, sinRotY, cosRotY) {
    const facingZ = -bx * sinRotY + bz * cosRotY
    return Math.max(0, Math.min(1, facingZ / radius))
  }

  buildOrbitAlphas(radius) {
    const N = 64
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const sinRotY = Math.sin(this.demoSpinOverlayYRotation)
    const cosRotY = Math.cos(this.demoSpinOverlayYRotation)
    const arr = new Float32Array(N + 1)
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      arr[i] = this._facingAlpha(radius * Math.cos(a), radius * Math.sin(a) * Math.sin(tilt), radius, sinRotY, cosRotY)
    }
    return arr
  }

  buildTickAlphas(radius) {
    const N = this.demoSpinOverlayTickN
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const sinRotY = Math.sin(this.demoSpinOverlayYRotation)
    const cosRotY = Math.cos(this.demoSpinOverlayYRotation)
    const arr = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const alpha = this._facingAlpha(radius * Math.cos(a), radius * Math.sin(a) * Math.sin(tilt), radius, sinRotY, cosRotY)
      arr[i * 2]     = alpha
      arr[i * 2 + 1] = alpha
    }
    return arr
  }

  _ringShaderMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        lineColor:     { value: new THREE.Color(this.demoSpinOverlayLineColor) },
        globalOpacity: { value: 0 },
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3  lineColor;
        uniform float globalOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(lineColor, vAlpha * globalOpacity);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })
  }

  _startRingFade(dir) {
    // Record current opacity so fade-out starts from wherever we are (not always from 1)
    this.devRingFadeStartOpacity = this.devOrbitRing?.mat.uniforms.globalOpacity.value ?? 0
    this.devRingFadeStartTime    = Date.now()
    this.devRingFadeDir          = dir
    this.devRingFadeLength       = dir > 0 ? this.demoRingFadeInLength : this.demoRingFadeOutLength
  }

  _updateRingGeos() {
    if (!this.devOrbitRing) return
    const r = this.demoSpinOverlayRadius
    this.devOrbitRing.geo.setFromPoints(this.buildOrbitPoints(r))
    this.devOrbitRing.geo.setAttribute('alpha', new THREE.BufferAttribute(this.buildOrbitAlphas(r), 1))
    this.devOrbitRing.tickGeo.setFromPoints(this.buildTickPoints(r))
    this.devOrbitRing.tickGeo.setAttribute('alpha', new THREE.BufferAttribute(this.buildTickAlphas(r), 1))
  }

  createDevOrbitRing() {
    const group = new THREE.Group()
    const mat = this._ringShaderMaterial()

    const r = this.demoSpinOverlayRadius
    const geo = new THREE.BufferGeometry().setFromPoints(this.buildOrbitPoints(r))
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.buildOrbitAlphas(r), 1))
    const ring = new THREE.LineLoop(geo, mat)
    group.add(ring)

    const tickGeo = new THREE.BufferGeometry().setFromPoints(this.buildTickPoints(r))
    tickGeo.setAttribute('alpha', new THREE.BufferAttribute(this.buildTickAlphas(r), 1))
    const ticks = new THREE.LineSegments(tickGeo, mat)
    group.add(ticks)

    this.scene.add(group)
    this.devOrbitRing = { group, ring, geo, mat, ticks, tickGeo }
  }

  setDemoOrbRadius(r) {
    this.demoSpinOverlayRadius = r
    this._updateRingGeos()
  }

  setTickLength(v) {
    this.demoSpinOverlayTickHalf = v / 2
    this._updateRingGeos()
  }

  setTickDensity(n) {
    this.demoSpinOverlayTickN = n
    this._updateRingGeos()
  }

  setLineColor(hexStr) {
    this.demoSpinOverlayLineColor = hexStr
    if (this.devOrbitRing) this.devOrbitRing.mat.uniforms.lineColor.value.set(hexStr)
  }

  setGlowColor(hexStr) {
    this.demoSpinOverlayGlowColor = hexStr
    if (this.demoSpinOverlay) {
      this.demoSpinOverlay.needleMat.color.set(hexStr)
      this.demoSpinOverlay.light.color.set(hexStr)
    }
  }

  setNeedleSpeed(v)           { this.demoSpinOverlayNeedleSpeed = v }
  setRingFadeInOffset(ms)     { this.demoRingFadeInOffset = ms }
  setRingFadeInLength(ms)     { this.demoRingFadeInLength = ms }
  setRingFadeOutOffset(ms)    { this.demoRingFadeOutOffset = ms }
  setRingFadeOutLength(ms)    { this.demoRingFadeOutLength = ms }
  setNeedleFadeOutOffset(ms)  { this.demoNeedleFadeOutOffset = ms }
  setNeedleFadeOutLength(ms)  { this.demoNeedleFadeOutLength = ms }
  setNeedleFadeInLength(ms)   { this.demoNeedleFadeInLength = ms }

  setOrbitXRotation(deg) {
    this.demoSpinOverlayXRotation = deg
    this._updateRingGeos()
  }

  setOrbitYRotation(deg) {
    this.demoSpinOverlayYRotation = deg * Math.PI / 180
    this._updateRingGeos()
  }

  createDemoOrb(rLetter) {
    const NEEDLE_HALF = 0.20 // 0.40 total length

    // Cylinder mesh so we get real thickness (WebGL ignores linewidth on Line)
    const needleGeo = new THREE.CylinderGeometry(0.025, 0.025, NEEDLE_HALF * 2, 8)
    const needleMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.demoSpinOverlayGlowColor),
      blending: THREE.NormalBlending,
      transparent: true,
      depthWrite: false,
      opacity: 1
    })
    const needle = new THREE.Mesh(needleGeo, needleMat)
    this.scene.add(needle)

    // Point light for a subtle glow cast onto the letter surface
    const light = new THREE.PointLight(new THREE.Color(this.demoSpinOverlayGlowColor), 0, 3)
    this.scene.add(light)

    // Start at the frontmost point of the orbit (max Z toward camera)
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const startAngle = Math.atan2(Math.sin(tilt) * Math.cos(this.demoSpinOverlayYRotation), -Math.sin(this.demoSpinOverlayYRotation))

    this.demoSpinOverlay = {
      needle, needleMat, needleGeo,
      light, NEEDLE_HALF,
      angle: startAngle,
      opacity: 0,
      fadingOut: false,
      fadeInStartTime: Date.now(),
      fadeStartTime: null,
      rLetter,
    }
  }

  updateDemoOrb() {
    const orb = this.demoSpinOverlay
    const rLetter = orb.rLetter
    if (!rLetter?.mesh) return

    // Orbit tilted 96° around X axis — sweeps mostly left/right with depth variation,
    // like a finger tracing horizontally across the face of the letter
    const worldPos = new THREE.Vector3()
    rLetter.mesh.getWorldPosition(worldPos)
    const radius = this.demoSpinOverlayRadius
    const tilt = this.demoSpinOverlayXRotation * Math.PI / 180
    const rotY = this.demoSpinOverlayYRotation
    orb.angle += rLetter.hoverVelocity * this.demoSpinOverlayNeedleSpeed

    const bx = radius * Math.cos(orb.angle)
    const by = radius * Math.sin(orb.angle) * Math.cos(tilt)
    const bz = radius * Math.sin(orb.angle) * Math.sin(tilt)
    const x = worldPos.x + bx * Math.cos(rotY) + bz * Math.sin(rotY)
    const y = worldPos.y + by
    const z = worldPos.z + (-bx * Math.sin(rotY) + bz * Math.cos(rotY)) + 0.3

    // Position and orient the needle cylinder along the orbit plane normal
    orb.needle.position.set(x, y, z)
    const nx = Math.cos(tilt) * Math.sin(rotY)
    const ny = -Math.sin(tilt)
    const nz = Math.cos(tilt) * Math.cos(rotY)
    orb.needle.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(nx, ny, nz)
    )

    orb.light.position.set(x, y, z)

    if (orb.fadingOut) {
      const t = Math.min((Date.now() - orb.fadeStartTime) / this.demoNeedleFadeOutLength, 1)
      orb.opacity = 1 - t
      if (t >= 1) { this.disposeDemoOrb(); return }
    } else {
      const t = Math.min((Date.now() - orb.fadeInStartTime) / Math.max(this.demoNeedleFadeInLength, 1), 1)
      orb.opacity = t
    }
    orb.needleMat.opacity = orb.opacity
    orb.light.intensity = orb.opacity * 1.5
  }

  hideDemoOrb() {
    if (this.demoSpinOverlay) {
      this.demoSpinOverlay.fadingOut = true
      this.demoSpinOverlay.fadeStartTime = Date.now()
    }
  }

  disposeDemoOrb() {
    const orb = this.demoSpinOverlay
    if (!orb) return
    this.scene.remove(orb.needle)
    this.scene.remove(orb.light)
    orb.needleMat.dispose()
    orb.needleGeo.dispose()
    this.demoSpinOverlay = null
  }

  dispose() {
    // Clean up resize observer
    if (this.resizeObserver) this.resizeObserver.disconnect()
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose()
    }
  }
}
