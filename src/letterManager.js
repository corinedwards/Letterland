import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

export class LetterShapeManager {
  constructor(shapeFactory) {
    this.shapeFactory = shapeFactory
    this.currentLetter = 'C'
    this.deletedBuiltInShapes = this.loadDeletedBuiltInShapes()
    this.customShapes = this.loadCustomShapes()
    
    // Apply deleted built-in shapes first
    this.applyDeletedBuiltInShapes()
    
    this.init()
  }

  init() {
    // Modal controls
    this.modal = document.getElementById('letter-manager-modal')
    this.manageBtn = document.getElementById('manage-letters')
    this.closeBtn = document.getElementById('close-manager')
    
    // Tab controls
    this.letterTabs = document.querySelectorAll('.letter-tab')
    this.shapeList = document.getElementById('shape-list')
    
    // Form controls
    this.shapeTypeSelect = document.getElementById('shape-type')
    this.shapeNameInput = document.getElementById('shape-name')
    this.shapeFileInput = document.getElementById('shape-file')
    this.textureFileInput = document.getElementById('texture-file')
    this.shapeColorInput = document.getElementById('shape-color')
    this.addShapeBtn = document.getElementById('add-shape-btn')
    this.textureGroup = document.getElementById('texture-group')
    
    this.setupEventListeners()
    this.renderShapeList()
  }

  setupEventListeners() {
    this.manageBtn.addEventListener('click', () => this.openModal())
    this.closeBtn.addEventListener('click', () => this.closeModal())
    
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal()
    })
    
    this.letterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.letterTabs.forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        this.currentLetter = tab.dataset.letter
        this.renderShapeList()
      })
    })
    
    this.shapeTypeSelect.addEventListener('change', () => {
      const isGLB = this.shapeTypeSelect.value === 'glb'
      this.textureGroup.style.display = isGLB ? 'block' : 'none'
    })
    
    this.addShapeBtn.addEventListener('click', () => this.addShape())
  }

  openModal() {
    this.modal.classList.add('active')
    this.renderShapeList()
  }

  closeModal() {
    this.modal.classList.remove('active')
  }

  renderShapeList() {
    const letter = this.currentLetter
    const builtInCount = this.getOriginalBuiltInShapeCount(letter)
    const customShapes = this.customShapes[letter] || []
    
    let html = '<h3>Built-in Shapes</h3>'
    
    for (let i = 0; i < builtInCount; i++) {
      html += `
        <div class="shape-item">
          <div class="shape-info">
            <div class="shape-name">
              ${letter} Shape ${i + 1}
              <span class="shape-built-in">Built-in</span>
            </div>
            <div class="shape-type">Procedural geometry</div>
          </div>
          <button class="delete-shape-btn" data-letter="${letter}" data-index="${i}" data-builtin="true">Delete</button>
        </div>
      `
    }
    
    if (customShapes.length > 0) {
      html += '<h3 style="margin-top: 20px;">Custom Shapes</h3>'
      customShapes.forEach((shape, index) => {
        html += `
          <div class="shape-item">
            <div class="shape-info">
              <div class="shape-name">
                ${shape.name}
                <span class="shape-custom">Custom</span>
              </div>
              <div class="shape-type">${shape.type === 'svg' ? 'SVG (Extruded)' : 'GLB Model'}${shape.texture ? ' + Texture' : ''}</div>
            </div>
            <button class="delete-shape-btn" data-letter="${letter}" data-index="${index}" data-builtin="false">Delete</button>
          </div>
        `
      })
    }
    
    this.shapeList.innerHTML = html
    
    // Add delete listeners
    this.shapeList.querySelectorAll('.delete-shape-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const letter = e.target.dataset.letter
        const index = parseInt(e.target.dataset.index)
        const isBuiltIn = e.target.dataset.builtin === 'true'
        
        if (isBuiltIn) {
          this.deleteBuiltInShape(letter, index)
        } else {
          this.deleteCustomShape(letter, index)
        }
      })
    })
  }

  async addShape() {
    const name = this.shapeNameInput.value.trim()
    const type = this.shapeTypeSelect.value
    const file = this.shapeFileInput.files[0]
    const color = this.shapeColorInput.value
    const textureFile = this.textureFileInput.files[0]
    
    if (!name) {
      alert('Please enter a shape name')
      return
    }
    
    if (!file) {
      alert('Please select a file')
      return
    }
    
    // Create custom shape entry
    const customShape = {
      name,
      type,
      color,
      fileName: file.name
    }
    
    // Read files and store as data URLs
    try {
      customShape.fileData = await this.readFileAsDataURL(file)
      
      if (textureFile && type === 'glb') {
        customShape.texture = await this.readFileAsDataURL(textureFile)
      }
      
      // Store in custom shapes
      if (!this.customShapes[this.currentLetter]) {
        this.customShapes[this.currentLetter] = []
      }
      this.customShapes[this.currentLetter].push(customShape)
      
      // Add shape creator to factory
      this.addCustomShapeToFactory(this.currentLetter, customShape)
      
      // Save to localStorage
      this.saveCustomShapes()
      
      // Reset form
      this.shapeNameInput.value = ''
      this.shapeFileInput.value = ''
      this.textureFileInput.value = ''
      
      // Refresh list
      this.renderShapeList()
      
      alert('Shape added successfully! Refresh the page to see it in action.')
    } catch (error) {
      console.error('Error adding shape:', error)
      alert('Error adding shape: ' + error.message)
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  addCustomShapeToFactory(letter, shapeData) {
    const shapeCreator = () => {
      return this.createCustomShape(shapeData)
    }
    
    this.shapeFactory.shapes[letter].push(shapeCreator)
  }

  async createCustomShape(shapeData) {
    if (shapeData.type === 'svg') {
      return await this.createFromSVGData(shapeData)
    } else if (shapeData.type === 'glb') {
      return await this.createFromGLBData(shapeData)
    }
  }

  async createFromSVGData(shapeData) {
    const loader = new SVGLoader()
    
    return new Promise((resolve, reject) => {
      // Convert data URL to blob
      fetch(shapeData.fileData)
        .then(res => res.blob())
        .then(blob => blob.text())
        .then(svgText => {
          const data = loader.parse(svgText)
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
                color: shapeData.color || 0x667eea,
                metalness: 0.5,
                roughness: 0.3
              })
              
              const mesh = new THREE.Mesh(geometry, material)
              mesh.castShadow = true
              mesh.receiveShadow = true
              group.add(mesh)
            })
          })
          
          // Center and scale the group
          const box = new THREE.Box3().setFromObject(group)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          
          group.position.sub(center)
          group.scale.set(scale, scale, scale)
          
          resolve(group)
        })
        .catch(reject)
    })
  }

  async createFromGLBData(shapeData) {
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      // Convert data URL to blob URL
      fetch(shapeData.fileData)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob)
          
          loader.load(
            blobUrl,
            async (gltf) => {
              const model = gltf.scene
              
              // Apply texture if provided
              if (shapeData.texture) {
                const textureBlob = await fetch(shapeData.texture).then(res => res.blob())
                const textureBlobUrl = URL.createObjectURL(textureBlob)
                const textureLoader = new THREE.TextureLoader()
                
                textureLoader.load(textureBlobUrl, (texture) => {
                  model.traverse((child) => {
                    if (child.isMesh) {
                      child.material.map = texture
                      child.material.needsUpdate = true
                      child.castShadow = true
                      child.receiveShadow = true
                    }
                  })
                })
              } else {
                // Apply color
                const color = new THREE.Color(shapeData.color || 0x667eea)
                model.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                      color: color,
                      metalness: 0.5,
                      roughness: 0.3
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
              
              URL.revokeObjectURL(blobUrl)
              resolve(model)
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(blobUrl)
              reject(error)
            }
          )
        })
        .catch(reject)
    })
  }

  deleteBuiltInShape(letter, index) {
    if (confirm('Are you sure you want to delete this built-in shape?')) {
      // Track deleted built-in shapes
      if (!this.deletedBuiltInShapes) {
        this.deletedBuiltInShapes = {}
      }
      if (!this.deletedBuiltInShapes[letter]) {
        this.deletedBuiltInShapes[letter] = []
      }
      this.deletedBuiltInShapes[letter].push(index)
      
      // Remove from factory
      this.shapeFactory.shapes[letter].splice(index, 1)
      
      // Save deleted list
      localStorage.setItem('deletedBuiltInShapes', JSON.stringify(this.deletedBuiltInShapes))
      
      this.renderShapeList()
      
      alert('Built-in shape deleted! Refresh the page to see changes.')
    }
  }

  deleteCustomShape(letter, index) {
    if (confirm('Are you sure you want to delete this custom shape?')) {
      this.customShapes[letter].splice(index, 1)
      
      // Remove from factory
      const builtInCount = this.getOriginalBuiltInShapeCount(letter)
      const factoryIndex = builtInCount + index
      this.shapeFactory.shapes[letter].splice(factoryIndex, 1)
      
      this.saveCustomShapes()
      this.renderShapeList()
      
      alert('Shape deleted! Refresh the page to see changes.')
    }
  }

  getOriginalBuiltInShapeCount(letter) {
    // Original counts before any modifications
    const originalCounts = {
      'C': 6,
      'O': 5,
      'R': 5,
      'I': 5,
      'N': 5
    }
    
    // Subtract deleted built-in shapes
    const deletedCount = (this.deletedBuiltInShapes && this.deletedBuiltInShapes[letter]) 
      ? this.deletedBuiltInShapes[letter].length 
      : 0
    
    return originalCounts[letter] - deletedCount
  }

  getBuiltInShapeCount(letter) {
    // Count only built-in shapes (before custom ones were added)
    const allShapes = this.shapeFactory.shapes[letter]
    const customCount = (this.customShapes[letter] || []).length
    return allShapes.length - customCount
  }

  saveCustomShapes() {
    localStorage.setItem('customLetterShapes', JSON.stringify(this.customShapes))
  }

  loadDeletedBuiltInShapes() {
    try {
      const stored = localStorage.getItem('deletedBuiltInShapes')
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Error loading deleted built-in shapes:', error)
      return {}
    }
  }

  applyDeletedBuiltInShapes() {
    // Remove deleted built-in shapes from factory
    Object.keys(this.deletedBuiltInShapes).forEach(letter => {
      const deletedIndices = this.deletedBuiltInShapes[letter]
      // Sort in reverse order to delete from end to start (preserves indices)
      deletedIndices.sort((a, b) => b - a).forEach(index => {
        if (this.shapeFactory.shapes[letter] && this.shapeFactory.shapes[letter][index]) {
          this.shapeFactory.shapes[letter].splice(index, 1)
        }
      })
    })
  }

  loadCustomShapes() {
    try {
      const stored = localStorage.getItem('customLetterShapes')
      const shapes = stored ? JSON.parse(stored) : {}
      
      // Restore custom shapes to factory
      Object.keys(shapes).forEach(letter => {
        shapes[letter].forEach(shapeData => {
          this.addCustomShapeToFactory(letter, shapeData)
        })
      })
      
      return shapes
    } catch (error) {
      console.error('Error loading custom shapes:', error)
      return {}
    }
  }
}
