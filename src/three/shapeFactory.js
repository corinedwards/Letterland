import * as THREE from 'three'

export class ShapeFactory {
  constructor() {
    this.shapes = {
      C: [
        this.createCShape1.bind(this),
        this.createCShape2.bind(this),
        this.createCShape3.bind(this),
        this.createCShape4.bind(this),
        this.createCShape5.bind(this),
        this.createCShapeCustomSVG.bind(this)
      ],
      O: [
        this.createOShape1.bind(this),
        this.createOShape2.bind(this),
        this.createOShape3.bind(this),
        this.createOShape4.bind(this),
        this.createOShape5.bind(this)
      ],
      R: [
        this.createRShape1.bind(this),
        this.createRShape2.bind(this),
        this.createRShape3.bind(this),
        this.createRShape4.bind(this),
        this.createRShape5.bind(this)
      ],
      I: [
        this.createIShape1.bind(this),
        this.createIShape2.bind(this),
        this.createIShape3.bind(this),
        this.createIShape4.bind(this),
        this.createIShape5.bind(this)
      ],
      N: [
        this.createNShape1.bind(this),
        this.createNShape2.bind(this),
        this.createNShape3.bind(this),
        this.createNShape4.bind(this),
        this.createNShape5.bind(this)
      ]
    }
  }

  getRandomShape(letter) {
    const shapeCreators = this.shapes[letter]
    const randomIndex = Math.floor(Math.random() * shapeCreators.length)
    return shapeCreators[randomIndex]()
  }

  // Helper to create gradient material
  createMaterial(baseColor) {
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.6,
      roughness: 0.4,
      flatShading: false
    })
  }

  // === C SHAPES ===
  createCShape1() {
    // Torus segment (classic C shape)
    const geometry = new THREE.TorusGeometry(1, 0.3, 16, 50, Math.PI * 1.5)
    return new THREE.Mesh(geometry, this.createMaterial(0x667eea))
  }

  createCShape2() {
    // Box with cutout (angular C)
    const shape = new THREE.Shape()
    shape.moveTo(-1, -1.5)
    shape.lineTo(-1, 1.5)
    shape.lineTo(0.5, 1.5)
    shape.lineTo(0.5, 1)
    shape.lineTo(-0.5, 1)
    shape.lineTo(-0.5, -1)
    shape.lineTo(0.5, -1)
    shape.lineTo(0.5, -1.5)
    shape.lineTo(-1, -1.5)
    
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1 })
    return new THREE.Mesh(geometry, this.createMaterial(0x764ba2))
  }

  createCShape3() {
    // Cylindrical C
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 32, 1, true, 0, Math.PI * 1.6)
    const mesh = new THREE.Mesh(geometry, this.createMaterial(0x5851db))
    mesh.rotation.z = Math.PI / 2
    return mesh
  }

  createCShape4() {
    // Chunky C with sphere ends
    const group = new THREE.Group()
    const tube = new THREE.TorusGeometry(1, 0.4, 20, 50, Math.PI * 1.5)
    const tubeMesh = new THREE.Mesh(tube, this.createMaterial(0x667eea))
    group.add(tubeMesh)
    return group
  }

  createCShape5() {
    // Wireframe C
    const geometry = new THREE.TorusGeometry(1, 0.25, 8, 20, Math.PI * 1.5)
    const material = new THREE.MeshStandardMaterial({
      color: 0x667eea,
      wireframe: true,
      metalness: 0.8
    })
    return new THREE.Mesh(geometry, material)
  }
createCShapeCustomSVG() {
    // Custom SVG extruded C
    // Create the shape directly from the SVG path
    const shape = new THREE.Shape()
    
    // Parse the SVG path: M230 0V92L212 138H81L66 64H39V275H66L81 198H221V327H0V0H230Z
    // Simplified approximation - create a C-like shape
    shape.moveTo(2.3, 0)
    shape.lineTo(2.3, 0.92)
    shape.lineTo(2.12, 1.38)
    shape.lineTo(0.81, 1.38)
    shape.lineTo(0.66, 0.64)
    shape.lineTo(0.39, 0.64)
    shape.lineTo(0.39, 2.75)
    shape.lineTo(0.66, 2.75)
    shape.lineTo(0.81, 1.98)
    shape.lineTo(2.21, 1.98)
    shape.lineTo(2.21, 3.27)
    shape.lineTo(0, 3.27)
    shape.lineTo(0, 0)
    shape.lineTo(2.3, 0)
    
    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 3
    }
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    
    // Calculate center from geometry bounds
    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox
    const centerX = (bbox.max.x + bbox.min.x) / 2
    const centerY = (bbox.max.y + bbox.min.y) / 2
    const centerZ = (bbox.max.z + bbox.min.z) / 2
    
    // Translate geometry to center it at origin
    geometry.translate(-centerX, -centerY, -centerZ)
    
    // Scale to fit roughly 2 units tall
    const height = bbox.max.y - bbox.min.y
    const scale = 2 / height
    geometry.scale(scale, -scale, scale) // Flip Y to correct orientation
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.3,
      roughness: 0.6
    })
    
    return new THREE.Mesh(geometry, material)
  }

  
  // === O SHAPES ===
  createOShape1() {
    // Torus (donut)
    const geometry = new THREE.TorusGeometry(1, 0.3, 16, 50)
    return new THREE.Mesh(geometry, this.createMaterial(0x667eea))
  }

  createOShape2() {
    // Sphere
    const geometry = new THREE.SphereGeometry(1, 32, 32)
    return new THREE.Mesh(geometry, this.createMaterial(0x764ba2))
  }

  createOShape3() {
    // Octahedron
    const geometry = new THREE.OctahedronGeometry(1.2)
    return new THREE.Mesh(geometry, this.createMaterial(0x5851db))
  }

  createOShape4() {
    // Ring (flat donut)
    const geometry = new THREE.RingGeometry(0.7, 1.3, 32)
    const mesh = new THREE.Mesh(geometry, this.createMaterial(0x667eea))
    return mesh
  }

  createOShape5() {
    // Dodecahedron
    const geometry = new THREE.DodecahedronGeometry(1)
    return new THREE.Mesh(geometry, this.createMaterial(0x764ba2))
  }

  // === R SHAPES ===
  createRShape1() {
    // Combined shapes for R
    const group = new THREE.Group()
    
    // Vertical stem
    const stem = new THREE.BoxGeometry(0.3, 2.5, 0.5)
    const stemMesh = new THREE.Mesh(stem, this.createMaterial(0x667eea))
    stemMesh.position.set(-0.6, 0, 0)
    group.add(stemMesh)
    
    // Top loop
    const loop = new THREE.TorusGeometry(0.6, 0.15, 16, 32, Math.PI)
    const loopMesh = new THREE.Mesh(loop, this.createMaterial(0x667eea))
    loopMesh.position.set(0, 0.6, 0)
    loopMesh.rotation.z = -Math.PI / 2
    group.add(loopMesh)
    
    // Diagonal leg
    const leg = new THREE.BoxGeometry(0.3, 1.2, 0.5)
    const legMesh = new THREE.Mesh(leg, this.createMaterial(0x667eea))
    legMesh.position.set(0.3, -0.7, 0)
    legMesh.rotation.z = 0.5
    group.add(legMesh)
    
    return group
  }

  createRShape2() {
    // Capsule-based R
    const group = new THREE.Group()
    const geometry1 = new THREE.CapsuleGeometry(0.2, 2, 8, 16)
    const mesh1 = new THREE.Mesh(geometry1, this.createMaterial(0x764ba2))
    mesh1.position.set(-0.5, 0, 0)
    group.add(mesh1)
    
    const geometry2 = new THREE.SphereGeometry(0.5, 16, 16)
    const mesh2 = new THREE.Mesh(geometry2, this.createMaterial(0x764ba2))
    mesh2.position.set(0, 0.7, 0)
    group.add(mesh2)
    
    return group
  }

  createRShape3() {
    // Geometric R with boxes
    const group = new THREE.Group()
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 0.6), this.createMaterial(0x5851db))
    box1.position.set(-0.6, 0, 0)
    group.add(box1)
    
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), this.createMaterial(0x5851db))
    box2.position.set(0, 0.9, 0)
    group.add(box2)
    
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), this.createMaterial(0x5851db))
    box3.position.set(0.1, 0, 0)
    group.add(box3)
    
    return group
  }

  createRShape4() {
    // Cone-based R
    const group = new THREE.Group()
    const cone = new THREE.ConeGeometry(0.3, 2.5, 4)
    const mesh = new THREE.Mesh(cone, this.createMaterial(0x667eea))
    mesh.position.set(-0.5, 0, 0)
    group.add(mesh)
    return group
  }

  createRShape5() {
    // Tetrahedron cluster R
    const group = new THREE.Group()
    for (let i = 0; i < 5; i++) {
      const tetra = new THREE.TetrahedronGeometry(0.4)
      const mesh = new THREE.Mesh(tetra, this.createMaterial(0x764ba2))
      mesh.position.set(-0.5, -1 + i * 0.5, 0)
      group.add(mesh)
    }
    return group
  }

  // === I SHAPES ===
  createIShape1() {
    // Simple cylinder
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 32)
    return new THREE.Mesh(geometry, this.createMaterial(0x667eea))
  }

  createIShape2() {
    // Box beam
    const geometry = new THREE.BoxGeometry(0.4, 2.5, 0.6)
    return new THREE.Mesh(geometry, this.createMaterial(0x764ba2))
  }

  createIShape3() {
    // Capsule
    const geometry = new THREE.CapsuleGeometry(0.25, 2, 8, 16)
    return new THREE.Mesh(geometry, this.createMaterial(0x5851db))
  }

  createIShape4() {
    // Stacked cubes
    const group = new THREE.Group()
    for (let i = 0; i < 5; i++) {
      const cube = new THREE.BoxGeometry(0.5, 0.5, 0.5)
      const mesh = new THREE.Mesh(cube, this.createMaterial(0x667eea))
      mesh.position.y = -1 + i * 0.5
      group.add(mesh)
    }
    return group
  }

  createIShape5() {
    // Tapered cylinder
    const geometry = new THREE.CylinderGeometry(0.2, 0.4, 2.5, 8)
    return new THREE.Mesh(geometry, this.createMaterial(0x764ba2))
  }

  // === N SHAPES ===
  createNShape1() {
    // Classic N with 3 boxes
    const group = new THREE.Group()
    
    const left = new THREE.BoxGeometry(0.4, 2.5, 0.5)
    const leftMesh = new THREE.Mesh(left, this.createMaterial(0x667eea))
    leftMesh.position.set(-0.7, 0, 0)
    group.add(leftMesh)
    
    const diagonal = new THREE.BoxGeometry(0.4, 3, 0.5)
    const diagMesh = new THREE.Mesh(diagonal, this.createMaterial(0x667eea))
    diagMesh.rotation.z = -0.5
    group.add(diagMesh)
    
    const right = new THREE.BoxGeometry(0.4, 2.5, 0.5)
    const rightMesh = new THREE.Mesh(right, this.createMaterial(0x667eea))
    rightMesh.position.set(0.7, 0, 0)
    group.add(rightMesh)
    
    return group
  }

  createNShape2() {
    // Cylindrical N
    const group = new THREE.Group()
    const cyl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 16), this.createMaterial(0x764ba2))
    cyl1.position.set(-0.7, 0, 0)
    group.add(cyl1)
    
    const cyl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 16), this.createMaterial(0x764ba2))
    cyl2.rotation.z = -0.5
    group.add(cyl2)
    
    const cyl3 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 16), this.createMaterial(0x764ba2))
    cyl3.position.set(0.7, 0, 0)
    group.add(cyl3)
    
    return group
  }

  createNShape3() {
    // Capsule N
    const group = new THREE.Group()
    const cap1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 2, 8, 16), this.createMaterial(0x5851db))
    cap1.position.set(-0.7, 0, 0)
    group.add(cap1)
    
    const cap2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 2.5, 8, 16), this.createMaterial(0x5851db))
    cap2.rotation.z = -0.5
    group.add(cap2)
    
    const cap3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 2, 8, 16), this.createMaterial(0x5851db))
    cap3.position.set(0.7, 0, 0)
    group.add(cap3)
    
    return group
  }

  createNShape4() {
    // Zigzag N
    const group = new THREE.Group()
    const points = [
      new THREE.Vector3(-0.7, -1.2, 0),
      new THREE.Vector3(-0.7, 1.2, 0),
      new THREE.Vector3(0.7, -1.2, 0),
      new THREE.Vector3(0.7, 1.2, 0)
    ]
    
    const geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      64,
      0.2,
      8,
      false
    )
    return new THREE.Mesh(geometry, this.createMaterial(0x667eea))
  }

  createNShape5() {
    // Prism N
    const group = new THREE.Group()
    const prism1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6), this.createMaterial(0x764ba2))
    prism1.position.set(-0.7, 0, 0)
    group.add(prism1)
    
    const prism2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 6), this.createMaterial(0x764ba2))
    prism2.rotation.z = -0.5
    group.add(prism2)
    
    const prism3 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 6), this.createMaterial(0x764ba2))
    prism3.position.set(0.7, 0, 0)
    group.add(prism3)
    
    return group
  }
}
