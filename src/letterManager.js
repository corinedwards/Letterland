export class LetterShapeManager {
  constructor(shapeFactory) {
    this.shapeFactory = shapeFactory
    this.currentLetter = 'C'
  }

  async initialize() {
    // Setup UI
    this.init()
  }

  init() {
    // Modal controls
    this.modal = document.getElementById('letter-manager-modal')
    this.manageBtn = document.getElementById('manage-letters')
    this.closeBtn = document.getElementById('close-manager')
    
    // Only setup UI if elements exist
    if (!this.modal || !this.manageBtn || !this.closeBtn) {
      console.warn('Letter manager UI elements not found, skipping UI setup')
      return
    }
    
    // Tab controls
    this.letterTabs = document.querySelectorAll('.letter-tab')
    this.shapeList = document.getElementById('shape-list')
    
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
    const customShapes = this.shapeFactory.loadedCustomShapes[letter] || []
    
    let html = ''
    
    if (customShapes.length > 0) {
      html += '<h3>Custom Shapes (from /public/letters/)</h3>'
      customShapes.forEach((shape) => {
        html += `
          <div class="shape-item">
            <div class="shape-info">
              <div class="shape-name">
                ${shape.name}
                <span class="shape-custom">Custom</span>
              </div>
              <div class="shape-type">File: ${shape.key}</div>
            </div>
          </div>
        `
      })
    } else {
      html = '<p style="text-align: center; color: #999; padding: 40px;">No custom shapes found. Add LETTER-name.svg or LETTER-name.glb files to /public/letters/</p>'
    }
    
    this.shapeList.innerHTML = html
  }
}
