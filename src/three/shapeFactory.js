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
          
          // Add texture path if exists
          if (shapeData.texture) {
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
          
          // Add to shape creators
          this.shapes[letter].push(() => mesh.clone())
          
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
    return shapeCreators[randomIndex]()
  }

}
