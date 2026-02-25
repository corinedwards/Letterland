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

    // Flatten all shapes into a single list and load them all in parallel.
    // Previously sequential (27 awaits in series); now one Promise.all so all
    // network fetches and SVG extrusions overlap.
    const tasks = Object.entries(customShapes).flatMap(([letter, shapes]) =>
      shapes.map(shapeData => ({ letter, shapeData }))
    )

    const results = await Promise.allSettled(tasks.map(async ({ letter, shapeData }) => {
      const settings = this.fileLoader.getSettings(shapeData.key)

      // Config texture takes priority; auto-matched file is fallback
      if (settings.texture) {
        settings.texture = import.meta.env.BASE_URL + 'letters/' + settings.texture
      } else if (shapeData.texture) {
        settings.texture = shapeData.texture
      }

      // Baked SVG GLBs have centering/scaling/Y-flip already applied to vertices.
      // Skip the default rotationX: π — the geometry is already correctly oriented.
      if (shapeData.bakedSVG) {
        settings.rotationX = 0
        settings.rotationY = 0
        settings.rotationZ = 0
      }

      const mesh = shapeData.type === 'glb'
        ? await this.fileLoader.loadGLB(shapeData.path, settings)
        : await this.fileLoader.loadSVG(shapeData.path, settings)

      return { letter, shapeData, mesh }
    }))

    // Store results — skip any that failed individually
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Failed to load shape:', result.reason)
        continue
      }
      const { letter, shapeData, mesh } = result.value

      if (!this.loadedCustomShapes[letter]) this.loadedCustomShapes[letter] = []
      this.loadedCustomShapes[letter].push({ name: shapeData.name, key: shapeData.key, mesh })

      // Add to shape creators — clone with deep material cloning
      this.shapes[letter].push(() => {
        const clonedMesh = mesh.clone()
        clonedMesh.traverse((child) => {
          if (child.isMesh && child.material) {
            const originalMaterial = child.material
            child.material = child.material.clone()
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

      this.shapeNames[letter].push(shapeData.key)
      console.log(`✓ Loaded ${shapeData.key}`)
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
