import * as THREE from 'three'
import { ShapeFactory } from './shapeFactory.js'

export class LetterManager {
  constructor(scene, shapeFactory = null, returnToRest = true, returnToRestSpeed = 0.02, floating = {}) {
    this.scene = scene
    this.letters = []
    this.letterObjects = []
    this.shapeFactory = shapeFactory || new ShapeFactory()
    this.boundingBoxHelpers = []
    this.returnToRest = returnToRest
    this.returnToRestSpeed = returnToRestSpeed
    this.floating = {
      enabled: floating.enabled !== false,
      amplitude: floating.amplitude || { x: 0.1, y: 0.15, z: 0.05 },
      rotation: floating.rotation || { x: 0.05, y: 0.08, z: 0.03 },
      speed: floating.speed || 1.0,
      speedVariation: floating.speedVariation || 0.3
    }
    this.time = 0
    this.paused = false
  }

  createLetters() {
    const letterNames = ['C', 'O', 'R', 'I', 'N']
    
    letterNames.forEach((letter, index) => {
      // Get a random shape for this letter
      const shape = this.shapeFactory.getRandomShape(letter)
      
      // Enable shadows on the shape
      shape.castShadow = true
      shape.receiveShadow = true
      if (shape.children) {
        shape.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
      }
      
      const letterObj = {
        name: letter,
        mesh: shape,
        index: index,
        shapeName: shape.userData.shapeName, // Store for dark mode restoration
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.02,
          z: (Math.random() - 0.5) * 0.02
        },
        hoverVelocity: 0,  // Individual velocity for hover mode
        initialRotation: { x: 0, y: 0, z: 0 },  // Store initial rotation
        shouldReturnToOrigin: false,  // Flag for auto-return
        returnProgress: 0,  // Track progress for easing (0 to 1)
        returnStartRotation: 0,  // Store rotation when return begins
        lastDirection: 1,  // Track last rotation direction (1 or -1)
        basePosition: { x: 0, y: 0, z: 0 },  // Store base position for floating
        floatingOffset: {
          x: Math.random() * Math.PI * 2,  // Random phase offset
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2
        },
        floatingRotationOffset: {
          x: Math.random() * Math.PI * 2,  // Random phase offset for rotation
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2
        },
        floatingSpeed: 1 + (Math.random() - 0.5) * this.floating.speedVariation  // Random speed multiplier
      }
      
      // Store original textures and material properties for dark mode restoration
      shape.traverse((child) => {
        if (child.isMesh && child.material) {
          // Store original material properties
          child.userData.originalColor = child.material.color.clone()
          child.userData.originalMetalness = child.material.metalness
          child.userData.originalRoughness = child.material.roughness
          child.userData.originalWireframe = child.material.wireframe
          
          if (child.material.map) {
            child.userData.originalMap = child.material.map
          }
          if (child.material.emissive) {
            child.userData.originalEmissive = child.material.emissive.clone()
          }
          if (child.material.emissiveMap) {
            child.userData.originalEmissiveMap = child.material.emissiveMap
          }
          if (child.material.emissiveIntensity !== undefined) {
            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity
          }
          // Store original geometry for SVG shapes (to handle bevel removal)
          if (child.geometry && child.geometry.type === 'ExtrudeGeometry') {
            child.userData.hasExtrude = true
            child.userData.originalGeometry = child.geometry
          }
        }
      })
      
      // Create 2D bounding rectangle (XY plane only)
      const bbox = new THREE.Box3().setFromObject(shape)
      const width = bbox.max.x - bbox.min.x
      const height = bbox.max.y - bbox.min.y
      
      const rectGeometry = new THREE.PlaneGeometry(width, height)
      const rectMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        side: THREE.DoubleSide
      })
      const rectangle = new THREE.Mesh(rectGeometry, rectMaterial)
      rectangle.visible = false
      letterObj.rectangle = rectangle
      
      // Create axis helper at center
      const axisHelper = new THREE.AxesHelper(1.5)
      axisHelper.visible = false
      letterObj.axisHelper = axisHelper
      
      this.boundingBoxHelpers.push({ rectangle, axisHelper })
      
      this.letterObjects.push(letterObj)
      this.scene.add(shape)
      this.scene.add(rectangle)
      this.scene.add(axisHelper)
    })

    this.updateLayout()
  }

  updateLayout() {
    const isMobile = window.innerWidth < 768
    
    if (isMobile) {
      // Mobile: Stack as CO / RI / N
      this.letterObjects.forEach((letterObj, index) => {
        const letter = letterObj.name
        let x = 0, y = 0
        
        if (letter === 'C') { x = -2; y = 3 }
        else if (letter === 'O') { x = 2; y = 3 }
        else if (letter === 'R') { x = -2; y = 0 }
        else if (letter === 'I') { x = 2; y = 0 }
        else if (letter === 'N') { x = 0; y = -3 }
        
        letterObj.mesh.position.set(x, y, 0)
      })
    } else {
      // Desktop: Horizontal layout
      const spacing = this.currentSpacing || 3.5
      const totalWidth = spacing * (this.letterObjects.length - 1)
      const startX = -totalWidth / 2
      
      this.letterObjects.forEach((letterObj, index) => {
        letterObj.mesh.position.set(startX + index * spacing, 0, 0)
      })
    }
  }

  updateSpacing(spacing, lineHeight = 3) {
    this.currentSpacing = spacing
    this.currentLineHeight = lineHeight
    const isMobile = window.innerWidth < 768
    
    if (isMobile) {
      // Mobile: Stack as CO / RI / N with adjustable spacing
      this.letterObjects.forEach((letterObj, index) => {
        const letter = letterObj.name
        let x = 0, y = 0
        
        if (letter === 'C') { x = -spacing * 0.6; y = lineHeight }
        else if (letter === 'O') { x = spacing * 0.6; y = lineHeight }
        else if (letter === 'R') { x = -spacing * 0.6; y = 0 }
        else if (letter === 'I') { x = spacing * 0.6; y = 0 }
        else if (letter === 'N') { x = -spacing * 0.6; y = -lineHeight }
        
        letterObj.mesh.position.set(x, y, 0)
        
        // Store base position for floating effect
        letterObj.basePosition.x = x
        letterObj.basePosition.y = y
        letterObj.basePosition.z = 0
      })
    } else {
      const totalWidth = spacing * (this.letterObjects.length - 1)
      const startX = -totalWidth / 2
      
      this.letterObjects.forEach((letterObj, index) => {
        const x = startX + index * spacing
        letterObj.mesh.position.set(x, 0, 0)
        
        // Store base position for floating effect
        letterObj.basePosition.x = x
        letterObj.basePosition.y = 0
        letterObj.basePosition.z = 0
      })
    }
  }

  update() {
    if (!this.paused) {
      this.time += 0.016 // Approximate frame time
    }
    
    this.letterObjects.forEach(letterObj => {
      // Auto-rotation removed - now manual only
      
      // Apply floating effect
      if (this.floating.enabled && !this.paused) {
        const t = this.time * this.floating.speed * letterObj.floatingSpeed
        
        letterObj.mesh.position.x = letterObj.basePosition.x + 
          Math.sin(t + letterObj.floatingOffset.x) * this.floating.amplitude.x
        letterObj.mesh.position.y = letterObj.basePosition.y + 
          Math.sin(t + letterObj.floatingOffset.y) * this.floating.amplitude.y
        letterObj.mesh.position.z = letterObj.basePosition.z + 
          Math.sin(t + letterObj.floatingOffset.z) * this.floating.amplitude.z
        
        // Apply floating rotation to X and Z only (Y is for manual spinning)
        letterObj.mesh.rotation.x = letterObj.initialRotation.x + 
          Math.sin(t * 0.8 + letterObj.floatingRotationOffset.x) * this.floating.rotation.x
        letterObj.mesh.rotation.z = letterObj.initialRotation.z + 
          Math.sin(t * 0.9 + letterObj.floatingRotationOffset.z) * this.floating.rotation.z
      }
      
      // Apply hover velocity with friction
      if (letterObj.hoverVelocity !== 0) {
        letterObj.mesh.rotation.y += letterObj.hoverVelocity
        letterObj.hoverVelocity *= 0.95 // Individual friction
        
        // Track direction of rotation
        letterObj.lastDirection = Math.sign(letterObj.hoverVelocity)
        
        if (Math.abs(letterObj.hoverVelocity) < 0.0005) {
          letterObj.hoverVelocity = 0
          if (this.returnToRest) {
            letterObj.shouldReturnToOrigin = true // Start returning to origin
            letterObj.returnProgress = 0 // Reset progress
            letterObj.returnStartRotation = letterObj.mesh.rotation.y // Store current rotation
          }
        }
      }
      
      // Slowly return to initial rotation when velocity is zero, with easing (Y axis only)
      if (letterObj.shouldReturnToOrigin && letterObj.hoverVelocity === 0) {
        // Ease in-out function (smooth acceleration and deceleration)
        const easeInOutCubic = (t) => {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        }
        
        // Increment progress
        letterObj.returnProgress += this.returnToRestSpeed
        
        if (letterObj.returnProgress >= 1) {
          // Completed return to initial Y rotation
          letterObj.mesh.rotation.y = letterObj.initialRotation.y
          letterObj.shouldReturnToOrigin = false
          letterObj.returnProgress = 0
        } else {
          // Apply eased interpolation on Y axis only
          const eased = easeInOutCubic(letterObj.returnProgress)
          
          // Calculate target with shortest angular distance
          const getAngularDistance = (current, target) => {
            let diff = target - current
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            return diff
          }
          
          const rotationDiff = getAngularDistance(letterObj.returnStartRotation, letterObj.initialRotation.y)
          
          // Apply eased rotation to Y only
          letterObj.mesh.rotation.y = letterObj.returnStartRotation + (rotationDiff * eased)
        }
      }
      
      // Update rectangle and axis helper to follow the mesh
      if (letterObj.rectangle) {
        letterObj.rectangle.position.copy(letterObj.mesh.position)
        letterObj.rectangle.rotation.copy(letterObj.mesh.rotation)
      }
      if (letterObj.axisHelper) {
        letterObj.axisHelper.position.copy(letterObj.mesh.position)
        letterObj.axisHelper.rotation.copy(letterObj.mesh.rotation)
      }
    })
  }

  toggleBoundingBoxes(visible) {
    this.letterObjects.forEach(letterObj => {
      if (letterObj.rectangle) letterObj.rectangle.visible = visible
      if (letterObj.axisHelper) letterObj.axisHelper.visible = visible
    })
  }

  getLetterMeshes() {
    return this.letterObjects.map(obj => obj.mesh)
  }

  // Method to load custom 3D model for a letter
  async loadCustomModel(letter, modelPath) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene
          model.scale.set(1, 1, 1)
          resolve(model)
        },
        undefined,
        (error) => reject(error)
      )
    })
  }

  // Method to create shape from SVG
  async createFromSVG(svgPath) {
    const { SVGLoader } = await import('three/examples/jsm/loaders/SVGLoader.js')
    const loader = new SVGLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        svgPath,
        (data) => {
          const paths = data.paths
          const group = new THREE.Group()
          
          paths.forEach((path) => {
            const shapes = SVGLoader.createShapes(path)
            
            shapes.forEach((shape) => {
              const extrudeSettings = {
                depth: 0.5,
                bevelEnabled: true,
                bevelThickness: 0.1,
                bevelSize: 0.1,
                bevelSegments: 3
              }
              
              const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
              const material = new THREE.MeshStandardMaterial({
                color: path.color || 0x667eea,
                metalness: 0.5,
                roughness: 0.3
              })
              
              const mesh = new THREE.Mesh(geometry, material)
              group.add(mesh)
            })
          })
          
          // Center the group
          const box = new THREE.Box3().setFromObject(group)
          const center = box.getCenter(new THREE.Vector3())
          group.position.sub(center)
          
          resolve(group)
        },
        undefined,
        (error) => reject(error)
      )
    })
  }

  setPaused(paused) {
    this.paused = paused
  }

  setDarkMode(enabled) {
    // Update all letter materials
    this.letterObjects.forEach(letterObj => {
      const shapeName = letterObj.shapeName || `${letterObj.name}-default`
      const settings = this.shapeFactory.fileLoader.getSettings(shapeName)
      
      // Traverse all meshes in the letter (handles both single meshes and groups with children)
      letterObj.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (enabled) {
            // Dark mode: white wireframe with no textures
            child.material.color.setHex(0xffffff)
            child.material.wireframe = true
            child.material.map = null // Remove texture
            child.material.flatShading = true
            child.material.metalness = 0 // Ensure consistent appearance
            child.material.roughness = 1 // Full roughness for uniform look
            // Add emissive to make it glow white for consistent brightness
            if (child.material.emissive) {
              child.material.emissive.setHex(0xffffff)
              child.material.emissiveIntensity = 0.5
            }
            if (child.material.emissiveMap) {
              child.material.emissiveMap = null
            }
            
            // For extruded SVG shapes, create flat version (no bevels)
            if (child.userData.hasExtrude && child.geometry.parameters) {
              const params = child.geometry.parameters
              if (params.shapes && params.options) {
                const flatOptions = {
                  ...params.options,
                  bevelEnabled: false,
                  bevelThickness: 0,
                  bevelSize: 0
                }
                const flatGeometry = new THREE.ExtrudeGeometry(params.shapes, flatOptions)
                child.userData.flatGeometry = flatGeometry
                child.geometry = flatGeometry
              }
            }
          } else {
            // Restore original material properties from stored values
            if (child.userData.originalColor) {
              child.material.color.copy(child.userData.originalColor)
            }
            if (child.userData.originalMetalness !== undefined) {
              child.material.metalness = child.userData.originalMetalness
            }
            if (child.userData.originalRoughness !== undefined) {
              child.material.roughness = child.userData.originalRoughness
            }
            if (child.userData.originalWireframe !== undefined) {
              child.material.wireframe = child.userData.originalWireframe
            }
            child.material.flatShading = false
            
            // Restore texture if it was originally there
            if (child.userData.originalMap) {
              child.material.map = child.userData.originalMap
            }
            if (child.userData.originalEmissiveMap) {
              child.material.emissiveMap = child.userData.originalEmissiveMap
            }
            
            // Restore original geometry with bevels
            if (child.userData.originalGeometry) {
              child.geometry = child.userData.originalGeometry
            }
            
            if (child.userData.originalEmissive) {
              child.material.emissive.copy(child.userData.originalEmissive)
            }
            if (child.userData.originalEmissiveIntensity !== undefined) {
              child.material.emissiveIntensity = child.userData.originalEmissiveIntensity
            }
          }
          child.material.needsUpdate = true
        }
      })
    })
  }
}
