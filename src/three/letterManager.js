import * as THREE from 'three'
import { ShapeFactory } from './shapeFactory.js'

export class LetterManager {
  constructor(scene, shapeFactory = null) {
    this.scene = scene
    this.letters = []
    this.letterObjects = []
    this.shapeFactory = shapeFactory || new ShapeFactory()
    this.boundingBoxHelpers = []
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
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.02,
          z: (Math.random() - 0.5) * 0.02
        },
        hoverVelocity: 0  // Individual velocity for hover mode
      }
      
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
        else if (letter === 'N') { x = 0; y = -lineHeight }
        
        letterObj.mesh.position.set(x, y, 0)
      })
    } else {
      const totalWidth = spacing * (this.letterObjects.length - 1)
      const startX = -totalWidth / 2
      
      this.letterObjects.forEach((letterObj, index) => {
        letterObj.mesh.position.set(startX + index * spacing, 0, 0)
      })
    }
  }

  update() {
    this.letterObjects.forEach(letterObj => {
      // Auto-rotation removed - now manual only
      
      // Apply hover velocity with friction
      if (letterObj.hoverVelocity !== 0) {
        letterObj.mesh.rotation.y += letterObj.hoverVelocity
        letterObj.hoverVelocity *= 0.95 // Individual friction
        
        if (Math.abs(letterObj.hoverVelocity) < 0.0005) {
          letterObj.hoverVelocity = 0
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
}
