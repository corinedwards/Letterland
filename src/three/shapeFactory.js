import * as THREE from 'three'
import { ShapeFileLoader } from '../shapeFileLoader.js'

export class ShapeFactory {
  constructor() {
    this.fileLoader = new ShapeFileLoader()
    this.loadedCustomShapes = {}
    
    // Start with empty arrays - will be populated by custom shapes
    this.shapes = {
      C: [],
      O: [],
      R: [],
      I: [],
      N: []
    }
    
    // Store shape names for dark mode restoration
    this.shapeNames = {
      C: [],
      O: [],
      R: [],
      I: [],
      N: []
    }
  }

  async loadCustomShapes() {
    console.log('Loading custom shapes from public/letters/...')
    
    await this.fileLoader.loadConfig()
    const customShapes = await this.fileLoader.scanLettersFolder()
    
    // Load each custom shape
    for (const letter in customShapes) {
      for (const shapeData of customShapes[letter]) {
        try {
          console.log(`Loading ${shapeData.key}...`)
          const settings = this.fileLoader.getSettings(shapeData.key)
          
          // Config texture takes priority; auto-matched file is fallback
          if (settings.texture) {
            settings.texture = import.meta.env.BASE_URL + 'letters/' + settings.texture
          } else if (shapeData.texture) {
            settings.texture = shapeData.texture
          }
          
          let mesh
          if (shapeData.type === 'glb') {
            mesh = await this.fileLoader.loadGLB(shapeData.path, settings)
          } else {
            mesh = await this.fileLoader.loadSVG(shapeData.path, settings)
          }
          
          // Store loaded shape
          if (!this.loadedCustomShapes[letter]) {
            this.loadedCustomShapes[letter] = []
          }
          this.loadedCustomShapes[letter].push({
            name: shapeData.name,
            key: shapeData.key,
            mesh: mesh
          })
          
          // Add to shape creators - clone with deep material cloning
          this.shapes[letter].push(() => {
            const clonedMesh = mesh.clone()
            // Deep clone materials so each letter has its own material instance
            clonedMesh.traverse((child) => {
              if (child.isMesh && child.material) {
                const originalMaterial = child.material
                child.material = child.material.clone()
                // Preserve texture references when cloning
                if (originalMaterial.map) {
                  child.material.map = originalMaterial.map
                  child.material.needsUpdate = true
                }
                if (originalMaterial.emissiveMap) {
                  child.material.emissiveMap = originalMaterial.emissiveMap
                  child.material.needsUpdate = true
                }
              }
            })
            return clonedMesh
          })
          
          // Store shape name for dark mode restoration
          this.shapeNames[letter].push(shapeData.key)
          
          console.log(`✓ Loaded ${shapeData.key}`)
        } catch (error) {
          console.error(`Failed to load ${shapeData.key}:`, error)
        }
      }
    }
    
    console.log('Custom shapes loaded!')
  }

  getRandomShape(letter) {
    const shapeCreators = this.shapes[letter]
    const randomIndex = Math.floor(Math.random() * shapeCreators.length)
    const shape = shapeCreators[randomIndex]()

    // Store shape name for later reference (dark mode restore)
    shape.userData.shapeName = this.shapeNames[letter][randomIndex]

    return shape
  }

  getShapeByName(letter, shapeName) {
    const idx = this.shapeNames[letter]?.indexOf(shapeName)
    if (idx == null || idx === -1) return this.getRandomShape(letter)
    const shape = this.shapes[letter][idx]()
    shape.userData.shapeName = shapeName
    return shape
  }

}
