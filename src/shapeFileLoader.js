import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

export class ShapeFileLoader {
  constructor() {
    this.config = null
    this.defaults = {
      color: '#000',
      metalness: 0.5,
      roughness: 0.3,
      extrudeDepth: 120,
      bevelThickness: 4,
      bevelSize: 4,
      textureFlipY: false,
      textureFilter: 'nearest',
      rotationX: Math.PI,
      rotationY: 0,
      rotationZ: 0
    }
  }

  async loadConfig() {
    try {
      const response = await fetch('/letters/shapes-config.json')
      this.config = await response.json()
      if (this.config._defaults) {
        this.defaults = { ...this.defaults, ...this.config._defaults }
      }
    } catch (error) {
      console.warn('No shapes-config.json found, using defaults')
      this.config = {}
    }
  }

  async scanLettersFolder() {
    // In a real browser environment, we can't actually scan directories
    // So we'll use import.meta.glob with Vite to get all files
    const files = import.meta.glob('/public/letters/*.(glb|gltf|svg|png|jpg|jpeg)', { eager: false })
    
    const shapes = {
      C: [],
      O: [],
      R: [],
      I: [],
      N: []
    }
    
    const textures = {}
    
    // Parse filenames
    for (const path in files) {
      const filename = path.split('/').pop()
      const match = filename.match(/^([CORIN])-(.+)\.(glb|gltf|svg|png|jpg|jpeg)$/i)
      
      if (match) {
        const letter = match[1].toUpperCase()
        const name = match[2]
        const ext = match[3].toLowerCase()
        const key = `${letter}-${name}`
        
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
          textures[key] = path.replace('/public', '')
        } else {
          shapes[letter].push({
            name,
            key,
            path: path.replace('/public', ''),
            type: ext === 'svg' ? 'svg' : 'glb',
            config: this.config[key] || {}
          })
        }
      }
    }
    
    // Match textures to shapes
    Object.values(shapes).flat().forEach(shape => {
      if (textures[shape.key]) {
        shape.texture = textures[shape.key]
      }
    })
    
    return shapes
  }

  getSettings(shapeKey) {
    const custom = this.config[shapeKey] || {}
    return { ...this.defaults, ...custom }
  }

  async loadGLB(path, settings) {
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        async (gltf) => {
          const model = gltf.scene
          
          // Apply texture if provided
          if (settings.texture) {
            try {
              const texture = await new THREE.TextureLoader().loadAsync(settings.texture)
              
              // Texture flip setting
              texture.flipY = settings.textureFlipY ?? this.defaults.textureFlipY ?? false
              
              // Texture filtering (nearest/linear)
              const useNearest = (settings.textureFilter ?? this.defaults.textureFilter) === 'nearest'
              texture.minFilter = useNearest ? THREE.NearestFilter : THREE.LinearFilter
              texture.magFilter = useNearest ? THREE.NearestFilter : THREE.LinearFilter
              
              model.traverse((child) => {
                if (child.isMesh) {
                  child.material.map = texture
                  child.material.needsUpdate = true
                  child.castShadow = true
                  child.receiveShadow = true
                }
              })
            } catch (error) {
              console.error('Failed to load texture:', error)
            }
          } else {
            // Apply color
            const color = new THREE.Color(settings.color || this.defaults.color)
            model.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: color,
                  metalness: settings.metalness ?? this.defaults.metalness,
                  roughness: settings.roughness ?? this.defaults.roughness
                })
                child.castShadow = true
                child.receiveShadow = true
              }
            })
          }
          
          // Center and scale
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          
          model.position.sub(center)
          model.scale.set(scale, scale, scale)
          
          // Apply rotation settings
          model.rotation.x = settings.rotationX ?? this.defaults.rotationX ?? 0
          model.rotation.y = settings.rotationY ?? this.defaults.rotationY ?? 0
          model.rotation.z = settings.rotationZ ?? this.defaults.rotationZ ?? 0
          
          resolve(model)
        },
        undefined,
        reject
      )
    })
  }

  async loadSVG(path, settings) {
    const loader = new SVGLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (data) => {
          const paths = data.paths
          const group = new THREE.Group()
          
          paths.forEach((path) => {
            const shapes = SVGLoader.createShapes(path)
            
            shapes.forEach((shape) => {
              const extrudeSettings = {
                depth: settings.extrudeDepth ?? this.defaults.extrudeDepth,
                bevelEnabled: true,
                bevelThickness: settings.bevelThickness ?? this.defaults.bevelThickness,
                bevelSize: settings.bevelSize ?? this.defaults.bevelSize,
                bevelSegments: 3
              }
              
              const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
              const material = new THREE.MeshStandardMaterial({
                color: settings.color || this.defaults.color,
                metalness: settings.metalness ?? this.defaults.metalness,
                roughness: settings.roughness ?? this.defaults.roughness
              })
              
              const mesh = new THREE.Mesh(geometry, material)
              mesh.castShadow = true
              mesh.receiveShadow = true
              group.add(mesh)
            })
          })
          
          // Center and scale
          const box = new THREE.Box3().setFromObject(group)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          
          // Center first by moving all children
          group.children.forEach(child => {
            child.position.sub(center)
          })
          // Then scale the whole group (flip Y to correct SVG orientation)
          group.scale.set(scale, -scale, scale)
          
          resolve(group)
        },
        undefined,
        reject
      )
    })
  }
}
