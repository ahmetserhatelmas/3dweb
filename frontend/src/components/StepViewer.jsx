import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Ruler, RotateCcw, ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react'
import occtimportjs from 'occt-import-js'
import './StepViewer.css'

export default function StepViewer({ fileUrl }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const modelRef = useRef(null)
  const measurePointsRef = useRef([])
  const measureLinesRef = useRef([])
  const animationIdRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurement, setMeasurement] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0b0d)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)
    camera.position.set(100, 100, 100)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = true
    controls.minDistance = 10
    controls.maxDistance = 2000
    controlsRef.current = controls

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight2.position.set(-100, 50, -100)
    scene.add(directionalLight2)

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 20, 0x2a2f3d, 0x1a1d26)
    scene.add(gridHelper)

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationIdRef.current)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Load STEP file
  useEffect(() => {
    if (!fileUrl || !sceneRef.current) return

    const loadModel = async () => {
      setLoading(true)
      setError(null)
      setLoadingProgress(0)

      try {
        // Initialize occt-import-js with WASM location
        const occt = await occtimportjs({
          locateFile: (file) => {
            if (file.endsWith('.wasm')) {
              return '/occt-import-js.wasm'
            }
            return file
          }
        })

        setLoadingProgress(20)

        // Fetch STEP file
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('STEP dosyası yüklenemedi')
        
        const buffer = await response.arrayBuffer()
        setLoadingProgress(50)

        // Parse STEP file
        const fileBuffer = new Uint8Array(buffer)
        const result = occt.ReadStepFile(fileBuffer, null)
        
        setLoadingProgress(70)

        if (!result.success || result.meshes.length === 0) {
          throw new Error('STEP dosyası işlenemedi')
        }

        // Remove old model
        if (modelRef.current) {
          sceneRef.current.remove(modelRef.current)
          modelRef.current.traverse((child) => {
            if (child.geometry) child.geometry.dispose()
            if (child.material) child.material.dispose()
          })
        }

        // Create new model group
        const group = new THREE.Group()
        
        // Material for the model
        const material = new THREE.MeshStandardMaterial({
          color: 0x00d4aa,
          metalness: 0.3,
          roughness: 0.6,
          side: THREE.DoubleSide
        })

        // Process meshes
        for (const mesh of result.meshes) {
          const geometry = new THREE.BufferGeometry()
          
          // Convert to Float32Array if needed
          const positions = mesh.attributes.position.array instanceof Float32Array 
            ? mesh.attributes.position.array 
            : new Float32Array(mesh.attributes.position.array)
          
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
          
          if (mesh.attributes.normal) {
            const normals = mesh.attributes.normal.array instanceof Float32Array
              ? mesh.attributes.normal.array
              : new Float32Array(mesh.attributes.normal.array)
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
          } else {
            geometry.computeVertexNormals()
          }
          
          if (mesh.index) {
            const indices = mesh.index.array instanceof Uint32Array
              ? mesh.index.array
              : new Uint32Array(mesh.index.array)
            geometry.setIndex(new THREE.BufferAttribute(indices, 1))
          }

          const meshObj = new THREE.Mesh(geometry, material.clone())
          meshObj.castShadow = true
          meshObj.receiveShadow = true
          group.add(meshObj)
        }

        setLoadingProgress(90)

        // Center and scale model
        const box = new THREE.Box3().setFromObject(group)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        group.position.sub(center)
        
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 100 / maxDim
        group.scale.setScalar(scale)

        sceneRef.current.add(group)
        modelRef.current = group

        // Reset camera
        const distance = maxDim * scale * 2
        cameraRef.current.position.set(distance, distance, distance)
        cameraRef.current.lookAt(0, 0, 0)
        controlsRef.current.target.set(0, 0, 0)

        setLoadingProgress(100)
        setLoading(false)

      } catch (err) {
        console.error('Load model error:', err)
        setError(err.message || 'Model yüklenirken hata oluştu')
        setLoading(false)
      }
    }

    loadModel()
  }, [fileUrl])

  // Handle click for measurement
  const handleClick = useCallback((event) => {
    if (!measureMode || !modelRef.current || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)

    const intersects = raycaster.intersectObject(modelRef.current, true)
    
    if (intersects.length > 0) {
      const point = intersects[0].point

      // Create marker
      const markerGeometry = new THREE.SphereGeometry(1, 16, 16)
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 })
      const marker = new THREE.Mesh(markerGeometry, markerMaterial)
      marker.position.copy(point)
      sceneRef.current.add(marker)
      measurePointsRef.current.push(marker)

      // If we have 2 points, draw line and calculate distance
      if (measurePointsRef.current.length === 2) {
        const p1 = measurePointsRef.current[0].position
        const p2 = measurePointsRef.current[1].position

        // Draw line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        sceneRef.current.add(line)
        measureLinesRef.current.push(line)

        // Calculate distance (in model units = mm)
        const distance = p1.distanceTo(p2)
        setMeasurement(distance.toFixed(2))

        // Automatically turn off measure mode
        // setMeasureMode(false)
      }
    }
  }, [measureMode])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [handleClick])

  const clearMeasurements = () => {
    measurePointsRef.current.forEach(m => {
      sceneRef.current.remove(m)
      m.geometry.dispose()
      m.material.dispose()
    })
    measureLinesRef.current.forEach(l => {
      sceneRef.current.remove(l)
      l.geometry.dispose()
      l.material.dispose()
    })
    measurePointsRef.current = []
    measureLinesRef.current = []
    setMeasurement(null)
  }

  const toggleMeasureMode = () => {
    if (measureMode) {
      clearMeasurements()
    }
    setMeasureMode(!measureMode)
  }

  const resetView = () => {
    if (!modelRef.current) return
    const box = new THREE.Box3().setFromObject(modelRef.current)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2
    cameraRef.current.position.set(distance, distance, distance)
    cameraRef.current.lookAt(0, 0, 0)
    controlsRef.current.target.set(0, 0, 0)
  }

  const zoomIn = () => {
    cameraRef.current.position.multiplyScalar(0.8)
  }

  const zoomOut = () => {
    cameraRef.current.position.multiplyScalar(1.2)
  }

  return (
    <div className="step-viewer" ref={containerRef}>
      {loading && (
        <div className="viewer-loading">
          <div className="loading-spinner"></div>
          <p>Model yükleniyor... {loadingProgress}%</p>
          <div className="progress-bar" style={{ width: '200px' }}>
            <div className="progress-bar-fill" style={{ width: `${loadingProgress}%` }}></div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="viewer-error">
          <p>❌ {error}</p>
        </div>
      )}

      <div className="viewer-controls">
        <button 
          className={`control-btn ${measureMode ? 'active' : ''}`} 
          onClick={toggleMeasureMode}
          title="Ölçüm Modu"
        >
          <Ruler size={18} />
        </button>
        <button className="control-btn" onClick={resetView} title="Görünümü Sıfırla">
          <RotateCcw size={18} />
        </button>
        <button className="control-btn" onClick={zoomIn} title="Yakınlaştır">
          <ZoomIn size={18} />
        </button>
        <button className="control-btn" onClick={zoomOut} title="Uzaklaştır">
          <ZoomOut size={18} />
        </button>
      </div>

      {measureMode && (
        <div className="measure-info">
          <div className="measure-badge">
            <Ruler size={14} />
            Ölçüm Modu Aktif
          </div>
          <p>Model üzerinde iki noktaya tıklayın</p>
          {measurement && (
            <div className="measurement-result">
              <span>Mesafe:</span>
              <strong>{measurement} mm</strong>
            </div>
          )}
          <button className="btn btn-sm btn-secondary" onClick={clearMeasurements}>
            Temizle
          </button>
        </div>
      )}

      <div className="viewer-help">
        <div className="help-item">
          <Move size={14} />
          <span>Sol tık + sürükle: Döndür</span>
        </div>
        <div className="help-item">
          <Maximize2 size={14} />
          <span>Scroll: Yakınlaştır/Uzaklaştır</span>
        </div>
      </div>
    </div>
  )
}

