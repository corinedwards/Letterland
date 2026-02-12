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
      wireframe: false,
      emissive: '#000000',
      emissiveIntensity: 0.2,
      extrudeDepth: 120,
      bevelThickness: 4,
      bevelSize: 4,
      textureFlipY: false,
      textureFilter: 'nearest',
      rotationX: Math.PI,
      rotationY: 0,
      rotationZ: 0,
      scale: 1
    }
  }

  async loadConfig() {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`${import.meta.env.BASE_URL}letters/shapes-config.json?t=${Date.now()}`)
      const rawConfig = await response.json()

      // Expand comma-separated keys into individual entries
      this.config = {}
      for (const [key, value] of Object.entries(rawConfig)) {
        if (key.includes(',')) {
          // Split comma-separated keys and assign to each
          const keys = key.split(',').map(k => k.trim())
          keys.forEach(k => {
            // Merge with existing config for this key (allows individual overrides)
            this.config[k] = { ...value, ...this.config[k] }
          })
        } else {
          // Merge with any previously set values from comma-separated keys
          this.config[key] = { ...this.config[key], ...value }
        }
      }

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
          textures[key] = import.meta.env.BASE_URL + path.replace('/public/', '')
        } else {
          shapes[letter].push({
            name,
            key,
            path: import.meta.env.BASE_URL + path.replace('/public/', ''),
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
                  child.material.color.setHex(0xffffff) // WHITE so texture shows correctly
                  child.material.needsUpdate = true
                }
              })
            } catch (error) {
              console.error('Failed to load texture:', error)
            }
          } else {
            // Apply color
            const color = new THREE.Color(settings.color || this.defaults.color)
            const emissive = new THREE.Color(settings.emissive || this.defaults.emissive)
            model.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: color,
                  metalness: settings.metalness ?? this.defaults.metalness,
                  roughness: settings.roughness ?? this.defaults.roughness,
                  wireframe: settings.wireframe ?? this.defaults.wireframe,
                  emissive: emissive,
                  emissiveIntensity: settings.emissiveIntensity ?? this.defaults.emissiveIntensity
                })
              }
            })
          }
          
          // Center and scale
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim

          // Apply custom scale factor from config
          const customScale = settings.scale ?? this.defaults.scale
          const finalScale = scale * customScale

          model.position.sub(center)
          model.scale.set(finalScale, finalScale, finalScale)
          
          // Apply rotation settings to each mesh (to override any baked-in rotations)
          const rotX = settings.rotationX ?? this.defaults.rotationX ?? 0
          const rotY = settings.rotationY ?? this.defaults.rotationY ?? 0
          const rotZ = settings.rotationZ ?? this.defaults.rotationZ ?? 0
          
          if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
            model.traverse((child) => {
              if (child.isMesh) {
                child.rotation.x = rotX
                child.rotation.y = rotY
                child.rotation.z = rotZ
              }
            })
          }
          
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

          // First calculate dimensions to determine scaling
          const tempBox = new THREE.Box3()
          paths.forEach((path) => {
            const shapes = SVGLoader.createShapes(path)
            shapes.forEach((shape) => {
              const tempGeom = new THREE.ExtrudeGeometry(shape, { depth: 0, bevelEnabled: false })
              const tempMesh = new THREE.Mesh(tempGeom)
              tempBox.expandByObject(tempMesh)
            })
          })
          const tempSize = tempBox.getSize(new THREE.Vector3())
          const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z)

          // Create geometry with extrude depth as percentage of shape size
          paths.forEach((path) => {
            const shapes = SVGLoader.createShapes(path)

            shapes.forEach((shape) => {
              // Interpret extrudeDepth as percentage: 100 = same as largest dimension
              const depthValue = ((settings.extrudeDepth ?? this.defaults.extrudeDepth) / 100) * maxDim
              const bevelThicknessValue = ((settings.bevelThickness ?? this.defaults.bevelThickness) / 100) * maxDim
              const bevelSizeValue = ((settings.bevelSize ?? this.defaults.bevelSize) / 100) * maxDim

              const extrudeSettings = {
                depth: depthValue,
                bevelEnabled: true,
                bevelThickness: bevelThicknessValue,
                bevelSize: bevelSizeValue,
                bevelSegments: 3
              }

              const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
              const emissive = new THREE.Color(settings.emissive || this.defaults.emissive)
              const material = new THREE.MeshStandardMaterial({
                color: settings.color || this.defaults.color,
                metalness: settings.metalness ?? this.defaults.metalness,
                roughness: settings.roughness ?? this.defaults.roughness,
                wireframe: settings.wireframe ?? this.defaults.wireframe,
                emissive: emissive,
                emissiveIntensity: settings.emissiveIntensity ?? this.defaults.emissiveIntensity
              })

              const mesh = new THREE.Mesh(geometry, material)
              group.add(mesh)
            })
          })

          // Center and scale
          const box = new THREE.Box3().setFromObject(group)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const finalMaxDim = Math.max(size.x, size.y, size.z)
          const normalizationScale = 2 / finalMaxDim

          // Apply custom scale factor from config
          const customScale = settings.scale ?? this.defaults.scale
          const finalScale = normalizationScale * customScale

          // Center first by moving all children
          group.children.forEach(child => {
            child.position.sub(center)
          })
          // Then scale the whole group (flip Y to correct SVG orientation)
          group.scale.set(finalScale, -finalScale, finalScale)
          
          resolve(group)
        },
        undefined,
        reject
      )
    })
  }
}
