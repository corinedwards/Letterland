import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { EdgesGeometry } from 'three'
import { LineSegments } from 'three'
import { LineBasicMaterial } from 'three'

export class ShapeFileLoader {
  constructor() {
    this.config = null
    this.defaults = {
      color: '#000',
      metalness: 0.5,
      roughness: 0.3,
      wireframe: false,
      edges: false,
      edgeColor: '#000000',
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
      this.rawConfig = rawConfig // keep original before key expansion (used for group parsing)

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

    // Collect all file paths grouped by key so we can detect baked SVG/GLB pairs
    const byKey = {}   // key → { letter, name, glb?, svg? }

    for (const path in files) {
      const filename = path.split('/').pop()
      const match = filename.match(/^([CORIN])-(.+)\.(glb|gltf|svg|png|jpg|jpeg)$/i)
      if (!match) continue

      const letter = match[1].toUpperCase()
      const name   = match[2]
      const ext    = match[3].toLowerCase()
      const key    = `${letter}-${name}`

      if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        textures[key] = import.meta.env.BASE_URL + path.replace('/public/', '')
        continue
      }

      if (!byKey[key]) byKey[key] = { letter, name }
      if (ext === 'svg') {
        byKey[key].svg = path
      } else {
        byKey[key].glb = path
      }
    }

    // Build shape list — when both GLB and SVG exist for the same key, prefer
    // the GLB (it's a baked version) and mark it so loadGLB skips rotation.
    for (const [key, entry] of Object.entries(byKey)) {
      const { letter, name } = entry
      const usePath = entry.glb ?? entry.svg
      const ext     = usePath.split('.').pop().toLowerCase()
      const bakedSVG = !!(entry.glb && entry.svg)   // GLB was baked from this SVG

      shapes[letter].push({
        name,
        key,
        path: import.meta.env.BASE_URL + usePath.replace('/public/', ''),
        type: ext === 'svg' ? 'svg' : 'glb',
        bakedSVG,
        config: this.config[key] || {}
      })
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

              const emissiveIntensity = settings.emissiveIntensity ?? this.defaults.emissiveIntensity
              const threeApp = settings['3dapp']

              model.traverse((child) => {
                if (child.isMesh) {
                  if (threeApp === 'blender') {
                    // Blender GLBs: replace material entirely for full config control
                    child.material = new THREE.MeshStandardMaterial({
                      map: texture,
                      color: 0xffffff,
                      metalness: settings.metalness ?? this.defaults.metalness,
                      roughness: settings.roughness ?? this.defaults.roughness,
                      emissiveMap: emissiveIntensity > 0 ? texture : null,
                      emissive: emissiveIntensity > 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
                      emissiveIntensity: emissiveIntensity
                    })
                  } else if (threeApp === 'blockbench') {
                    // Blockbench GLBs: patch existing material to preserve z-fighting fixes
                    child.material.map = texture
                    child.material.color.setHex(0xffffff)
                    child.material.metalness = settings.metalness ?? this.defaults.metalness
                    child.material.roughness = settings.roughness ?? this.defaults.roughness
                    // Guard: MeshBasicMaterial has no emissive property
                    if (emissiveIntensity > 0 && child.material.emissive) {
                      child.material.emissiveMap = texture
                      child.material.emissive.setHex(0xffffff)
                      child.material.emissiveIntensity = emissiveIntensity
                    }
                  } else {
                    console.warn(`Unknown or missing 3dapp value "${threeApp}" for textured GLB — no material applied`)
                  }
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
          
          // Apply rotation to the model group (preserves individual mesh rotations from Blender)
          const rotX = settings.rotationX ?? this.defaults.rotationX ?? 0
          const rotY = settings.rotationY ?? this.defaults.rotationY ?? 0
          const rotZ = settings.rotationZ ?? this.defaults.rotationZ ?? 0

          model.rotation.set(rotX, rotY, rotZ)

          // Add edges if enabled (non-x-ray wireframe)
          const useEdges = settings.edges ?? this.defaults.edges
          if (useEdges) {
            model.traverse((child) => {
              if (child.isMesh) {
                const edgesGeometry = new EdgesGeometry(child.geometry)
                const edgesMaterial = new LineBasicMaterial({
                  color: settings.edgeColor || this.defaults.edgeColor
                })
                const edges = new LineSegments(edgesGeometry, edgesMaterial)
                // Position edges to match the mesh
                edges.position.copy(child.position)
                edges.rotation.copy(child.rotation)
                edges.scale.copy(child.scale)
                model.add(edges)
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

              const useEdges = settings.edges ?? this.defaults.edges

              const material = new THREE.MeshStandardMaterial({
                color: settings.color || this.defaults.color,
                metalness: settings.metalness ?? this.defaults.metalness,
                roughness: settings.roughness ?? this.defaults.roughness,
                wireframe: useEdges ? false : (settings.wireframe ?? this.defaults.wireframe),
                emissive: emissive,
                emissiveIntensity: settings.emissiveIntensity ?? this.defaults.emissiveIntensity
              })

              const mesh = new THREE.Mesh(geometry, material)
              group.add(mesh)

              // Add edges if enabled (non-x-ray wireframe)
              if (useEdges) {
                const edgesGeometry = new EdgesGeometry(geometry)
                const edgesMaterial = new LineBasicMaterial({
                  color: settings.edgeColor || this.defaults.edgeColor
                })
                const edges = new LineSegments(edgesGeometry, edgesMaterial)
                group.add(edges)
              }
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
