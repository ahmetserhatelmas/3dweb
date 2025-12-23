import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { RotateCcw, ZoomIn, ZoomOut, Maximize2, Move, Grid3X3, Ruler, Minus } from 'lucide-react'
import occtimportjs from 'occt-import-js'
import './StepViewer.css'

export default function StepViewer({ fileUrl }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const labelRendererRef = useRef(null) // CSS2D Renderer for labels
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const modelRef = useRef(null)
  const gridRef = useRef(null)
  const edgesRef = useRef([])
  const verticesRef = useRef([]) // Store all vertices for snapping
  const edgeEndpointsRef = useRef([]) // Store edge endpoints (higher priority for snapping)
  const measureMarkersRef = useRef([])
  const measureLinesRef = useRef([])
  const measureLabelsRef = useRef([]) // Store CSS2D labels
  const highlightedMeshesRef = useRef([])
  const animationIdRef = useRef(null)
  const measurePointsRef = useRef([])
  const modelScaleRef = useRef(1) // Store the scale factor to convert back to original units

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  
  // Current measurement state
  const [measureMode, setMeasureMode] = useState(false) // Measurement mode on/off
  const [measureValue, setMeasureValue] = useState(null)
  const [distanceStep, setDistanceStep] = useState(0) // 0: none, 1: first point, 2: complete
  const [liveDistance, setLiveDistance] = useState(null) // For showing distance while measuring
  const [straightLineMode, setStraightLineMode] = useState(false) // Düz çizgi modu

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0b0d)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)
    camera.position.set(100, 100, 100)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.sortObjects = true // Enable sorting for transparent objects
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // CSS2D Renderer for labels
    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(width, height)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)
    labelRendererRef.current = labelRenderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = true
    controls.minDistance = 10
    controls.maxDistance = 2000
    controls.enablePan = true
    controls.panSpeed = 1.0
    // Mouse buttons: LEFT=rotate, MIDDLE=zoom, RIGHT=pan
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    }
    controlsRef.current = controls

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(100, 100, 100)
    scene.add(dirLight)
    scene.add(new THREE.DirectionalLight(0xffffff, 0.4).translateX(-100))

    const gridHelper = new THREE.GridHelper(200, 20, 0x2a2f3d, 0x1a1d26)
    scene.add(gridHelper)
    gridRef.current = gridHelper

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      labelRenderer.setSize(w, h)
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
      if (container.contains(labelRenderer.domElement)) {
        container.removeChild(labelRenderer.domElement)
      }
    }
  }, [])

  // Extract vertices from geometry - for snapping to corners
  const extractVertices = useCallback((geometry, meshObj) => {
    const vertices = []
    const positionAttr = geometry.getAttribute('position')
    
    if (!positionAttr) return vertices
    
    const vertexMap = new Map()
    
    // Collect all unique vertices in world space
    for (let i = 0; i < positionAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i)
      const worldPos = v.clone().applyMatrix4(meshObj.matrixWorld)
      
      // Create a key for deduplication (rounded to avoid floating point issues)
      const key = `${worldPos.x.toFixed(3)}_${worldPos.y.toFixed(3)}_${worldPos.z.toFixed(3)}`
      
      if (!vertexMap.has(key)) {
        vertexMap.set(key, worldPos)
      }
    }
    
    return Array.from(vertexMap.values())
  }, [])

  // Extract edges from geometry - stores both scaled (for display) and original lengths
  const extractEdges = useCallback((geometry, meshObj, scaleFactor) => {
    const edges = []
    const endpoints = [] // Collect edge endpoints
    const positionAttr = geometry.getAttribute('position')
    const index = geometry.getIndex()
    
    if (!positionAttr) return { edges: [], endpoints: [] }
    
    const edgeMap = new Map()
    const endpointMap = new Map() // For deduplicating endpoints
    const faceCount = index ? index.count / 3 : positionAttr.count / 3
    
    for (let i = 0; i < faceCount; i++) {
      let a, b, c
      if (index) {
        a = index.getX(i * 3)
        b = index.getX(i * 3 + 1)
        c = index.getX(i * 3 + 2)
      } else {
        a = i * 3
        b = i * 3 + 1
        c = i * 3 + 2
      }
      
      [[a, b], [b, c], [c, a]].forEach(([v1, v2]) => {
        const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { v1, v2, count: 1 })
        } else {
          edgeMap.get(key).count++
        }
      })
    }
    
    edgeMap.forEach((edge) => {
      // Get original (unscaled) positions
      const p1Original = new THREE.Vector3().fromBufferAttribute(positionAttr, edge.v1)
      const p2Original = new THREE.Vector3().fromBufferAttribute(positionAttr, edge.v2)
      const originalLength = p1Original.distanceTo(p2Original)
      
      // Get scaled positions for display
      const p1 = p1Original.clone().applyMatrix4(meshObj.matrixWorld)
      const p2 = p2Original.clone().applyMatrix4(meshObj.matrixWorld)
      
      edges.push({
        p1: p1.clone(),
        p2: p2.clone(),
        length: originalLength, // Store ORIGINAL length in mm
        scaledLength: p1.distanceTo(p2),
        midpoint: new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5),
        isBoundary: edge.count === 1
      })
      
      // Store endpoints (deduplicate using rounded coordinates)
      const key1 = `${p1.x.toFixed(3)}_${p1.y.toFixed(3)}_${p1.z.toFixed(3)}`
      const key2 = `${p2.x.toFixed(3)}_${p2.y.toFixed(3)}_${p2.z.toFixed(3)}`
      
      if (!endpointMap.has(key1)) {
        endpointMap.set(key1, p1.clone())
      }
      if (!endpointMap.has(key2)) {
        endpointMap.set(key2, p2.clone())
      }
    })
    
    // Convert endpoints map to array
    endpoints.push(...Array.from(endpointMap.values()))
    
    return { edges, endpoints }
  }, [])

  // Find nearest endpoint - simple 3D distance from clicked point
  const findNearestEndpoint = useCallback((point, maxDistance = 2) => {
    let nearest = null
    let minDist = maxDistance
    
    edgeEndpointsRef.current.forEach(endpoint => {
      const dist = point.distanceTo(endpoint)
      
      if (dist < minDist) {
        minDist = dist
        nearest = { position: endpoint.clone(), distance: dist }
      }
    })
    
    return nearest
  }, [])

  // Find nearest vertex - simple 3D distance from clicked point
  const findNearestVertex = useCallback((point, maxDistance = 1.5) => {
    let nearest = null
    let minDist = maxDistance
    
    verticesRef.current.forEach(vertex => {
      const dist = point.distanceTo(vertex)
      
      if (dist < minDist) {
        minDist = dist
        nearest = { position: vertex.clone(), distance: dist }
      }
    })
    
    return nearest
  }, [])

  // Find nearest edge
  const findNearestEdge = useCallback((point, maxDistance = 4) => {
    let nearest = null
    let minDist = maxDistance
    
    edgesRef.current.forEach(edge => {
      const line = new THREE.Line3(edge.p1, edge.p2)
      const closest = new THREE.Vector3()
      line.closestPointToPoint(point, true, closest)
      const dist = point.distanceTo(closest)
      
      if (dist < minDist) {
        minDist = dist
        nearest = { ...edge, closestPoint: closest, distance: dist }
      }
    })
    
    return nearest
  }, [])

  // Detect circular feature - works for cylinders, circular faces, and pipes
  // Returns dimensions in ORIGINAL units (before scaling)
  const detectCircle = useCallback((meshObj, clickedPoint, face) => {
    const geometry = meshObj.geometry
    const positionAttr = geometry.getAttribute('position')
    if (!positionAttr) return null
    
    const scale = modelScaleRef.current
    
    // Get face normal in world space
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshObj.matrixWorld)
    const faceNormal = face.normal.clone().applyMatrix3(normalMatrix).normalize()
    
    // Get all vertices in ORIGINAL coordinates (before scaling)
    const allVerticesOriginal = []
    for (let i = 0; i < positionAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i)
      allVerticesOriginal.push(v.clone())
    }
    
    // Get scaled vertices for spatial queries
    const allVerticesScaled = []
    for (let i = 0; i < positionAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i)
      v.applyMatrix4(meshObj.matrixWorld)
      allVerticesScaled.push(v)
    }
    
    if (allVerticesOriginal.length < 6) return null
    
    // METHOD 1: Check for flat circular face (like pipe end)
    const clickedPlaneD = faceNormal.dot(clickedPoint)
    const coplanarIndices = []
    allVerticesScaled.forEach((v, i) => {
      const d = Math.abs(faceNormal.dot(v) - clickedPlaneD)
      if (d < 1.5) coplanarIndices.push(i)
    })
    
    if (coplanarIndices.length >= 6) {
      // Use ORIGINAL coordinates for measurement
      const coplanarOriginal = coplanarIndices.map(i => allVerticesOriginal[i])
      
      // Project to 2D plane
      const tangent = new THREE.Vector3(1, 0, 0)
      if (Math.abs(faceNormal.dot(tangent)) > 0.9) {
        tangent.set(0, 1, 0)
      }
      const bitangent = new THREE.Vector3().crossVectors(faceNormal, tangent).normalize()
      tangent.crossVectors(bitangent, faceNormal).normalize()
      
      const coords2D = coplanarOriginal.map(v => ({
        x: v.dot(tangent),
        y: v.dot(bitangent)
      }))
      
      const cx = coords2D.reduce((s, c) => s + c.x, 0) / coords2D.length
      const cy = coords2D.reduce((s, c) => s + c.y, 0) / coords2D.length
      
      const radii = coords2D.map(c => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2))
      const avgR = radii.reduce((a, b) => a + b, 0) / radii.length
      
      if (avgR > 0.3) {
        const stdDev = Math.sqrt(radii.reduce((s, r) => s + (r - avgR) ** 2, 0) / radii.length)
        const circularity = stdDev / avgR
        
        if (circularity < 0.3) {
          // Return ORIGINAL dimensions
          return { diameter: avgR * 2, radius: avgR, type: 'circular_face' }
        }
      }
    }
    
    // METHOD 2: Check for cylinder cross-section using ORIGINAL coordinates
    const axes = [
      { name: 'Y', getValue: v => v.y, getPlane: v => ({ x: v.x, y: v.z }) },
      { name: 'X', getValue: v => v.x, getPlane: v => ({ x: v.y, y: v.z }) },
      { name: 'Z', getValue: v => v.z, getPlane: v => ({ x: v.x, y: v.y }) }
    ]
    
    let bestResult = null
    let bestCircularity = Infinity
    
    for (const axis of axes) {
      // Use scaled point for level detection
      const clickedLevelScaled = axis.getValue(clickedPoint)
      const axisValuesScaled = allVerticesScaled.map(v => axis.getValue(v))
      const minVal = Math.min(...axisValuesScaled)
      const maxVal = Math.max(...axisValuesScaled)
      const range = maxVal - minVal
      
      const tolerance = Math.max(range * 0.15, 3)
      const sliceIndices = []
      allVerticesScaled.forEach((v, i) => {
        if (Math.abs(axis.getValue(v) - clickedLevelScaled) < tolerance) {
          sliceIndices.push(i)
        }
      })
      
      if (sliceIndices.length >= 6) {
        // Use ORIGINAL coordinates for measurement
        const sliceOriginal = sliceIndices.map(i => allVerticesOriginal[i])
        const coords = sliceOriginal.map(v => axis.getPlane(v))
        
        const cx = coords.reduce((s, c) => s + c.x, 0) / coords.length
        const cy = coords.reduce((s, c) => s + c.y, 0) / coords.length
        
        const radii = coords.map(c => Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2))
        const avgR = radii.reduce((a, b) => a + b, 0) / radii.length
        
        if (avgR > 0.3) {
          const stdDev = Math.sqrt(radii.reduce((s, r) => s + (r - avgR) ** 2, 0) / radii.length)
          const circularity = stdDev / avgR
          
          if (circularity < 0.35 && circularity < bestCircularity) {
            bestCircularity = circularity
            // Return ORIGINAL dimensions
            bestResult = { diameter: avgR * 2, radius: avgR, axis: axis.name, type: 'cylinder' }
          }
        }
      }
    }
    
    return bestResult
  }, [])

  // Calculate surface area - returns area in ORIGINAL units (mm²)
  const calculateSurfaceArea = useCallback((meshObj, face) => {
    const geometry = meshObj.geometry
    const positionAttr = geometry.getAttribute('position')
    const normalAttr = geometry.getAttribute('normal')
    const index = geometry.getIndex()
    
    if (!positionAttr || !normalAttr) return null
    
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshObj.matrixWorld)
    const clickedNormal = face.normal.clone().applyMatrix3(normalMatrix).normalize()
    
    const faceCount = index ? index.count / 3 : positionAttr.count / 3
    let totalArea = 0
    
    for (let i = 0; i < faceCount; i++) {
      let a, b, c
      if (index) {
        a = index.getX(i * 3)
        b = index.getX(i * 3 + 1)
        c = index.getX(i * 3 + 2)
      } else {
        a = i * 3
        b = i * 3 + 1
        c = i * 3 + 2
      }
      
      const nA = new THREE.Vector3().fromBufferAttribute(normalAttr, a)
      nA.applyMatrix3(normalMatrix).normalize()
      
      if (Math.abs(clickedNormal.dot(nA)) > 0.95) {
        // Use ORIGINAL coordinates (before scaling) for area calculation
        const vA = new THREE.Vector3().fromBufferAttribute(positionAttr, a)
        const vB = new THREE.Vector3().fromBufferAttribute(positionAttr, b)
        const vC = new THREE.Vector3().fromBufferAttribute(positionAttr, c)
        
        const edge1 = new THREE.Vector3().subVectors(vB, vA)
        const edge2 = new THREE.Vector3().subVectors(vC, vA)
        totalArea += new THREE.Vector3().crossVectors(edge1, edge2).length() * 0.5
      }
    }
    
    // Return area in original units (mm²)
    return totalArea
  }, [])

  // Load STEP file
  useEffect(() => {
    if (!fileUrl || !sceneRef.current) return

    const loadModel = async () => {
      setLoading(true)
      setError(null)
      setLoadingProgress(0)

      try {
        const occt = await occtimportjs({
          locateFile: (file) => file.endsWith('.wasm') ? '/occt-import-js.wasm' : file
        })

        setLoadingProgress(20)

        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('STEP dosyası yüklenemedi')
        
        const buffer = await response.arrayBuffer()
        setLoadingProgress(50)

        const result = occt.ReadStepFile(new Uint8Array(buffer), null)
        setLoadingProgress(70)

        if (!result.success || result.meshes.length === 0) {
          throw new Error('STEP dosyası işlenemedi')
        }

        if (modelRef.current) {
          sceneRef.current.remove(modelRef.current)
          modelRef.current.traverse((child) => {
            if (child.geometry) child.geometry.dispose()
            if (child.material) child.material.dispose()
          })
        }

        const group = new THREE.Group()
        edgesRef.current = []
        verticesRef.current = []
        edgeEndpointsRef.current = []
        
        const material = new THREE.MeshStandardMaterial({
          color: 0x00d4aa,
          metalness: 0.3,
          roughness: 0.6,
          side: THREE.FrontSide // Only render front faces
        })

        for (const mesh of result.meshes) {
          const geometry = new THREE.BufferGeometry()
          
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
            geometry.setIndex(new THREE.BufferAttribute(
              mesh.index.array instanceof Uint32Array ? mesh.index.array : new Uint32Array(mesh.index.array), 1
            ))
          }

          const meshObj = new THREE.Mesh(geometry, material.clone())
          meshObj.castShadow = true
          meshObj.receiveShadow = true
          group.add(meshObj)
        }

        setLoadingProgress(85)

        const box = new THREE.Box3().setFromObject(group)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        group.position.set(-center.x, -center.y, -center.z)
        const scale = 80 / Math.max(size.x, size.y, size.z)
        group.scale.setScalar(scale)
        group.position.multiplyScalar(scale)
        
        // Store scale factor for converting measurements back to original units
        modelScaleRef.current = scale

        sceneRef.current.add(group)
        modelRef.current = group

        // Extract edges, endpoints and vertices with scale factor for original measurements
        group.traverse((child) => {
          if (child.isMesh) {
            const { edges, endpoints } = extractEdges(child.geometry, child, scale)
            edgesRef.current.push(...edges)
            edgeEndpointsRef.current.push(...endpoints)
            verticesRef.current.push(...extractVertices(child.geometry, child))
          }
        })

        console.log(`Extracted ${edgesRef.current.length} edges, ${edgeEndpointsRef.current.length} endpoints, ${verticesRef.current.length} vertices`)

        cameraRef.current.position.set(150, 120, 150)
        cameraRef.current.lookAt(0, 0, 0)
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()

        setLoadingProgress(100)
        setLoading(false)
      } catch (err) {
        console.error('Load model error:', err)
        setError(err.message || 'Model yüklenirken hata oluştu')
        setLoading(false)
      }
    }

    loadModel()
  }, [fileUrl, extractEdges, extractVertices])

  // Clear all measurement visuals
  const clearMeasurement = useCallback(() => {
    if (sceneRef.current) {
      measureMarkersRef.current.forEach(m => {
        sceneRef.current.remove(m)
        m.geometry?.dispose()
        m.material?.dispose()
      })
      measureLinesRef.current.forEach(l => {
        sceneRef.current.remove(l)
        l.geometry?.dispose()
        l.material?.dispose()
      })
      measureLabelsRef.current.forEach(label => {
        sceneRef.current.remove(label)
      })
    }
    highlightedMeshesRef.current.forEach(({ mesh, originalMaterial }) => {
      if (mesh) mesh.material = originalMaterial
    })
    
    measureMarkersRef.current = []
    measureLinesRef.current = []
    measureLabelsRef.current = []
    highlightedMeshesRef.current = []
    measurePointsRef.current = []
    
    setMeasureValue(null)
    setDistanceStep(0)
  }, [])

  // Create highlight for edge
  const highlightEdge = useCallback((edge, color = 0x00ff88) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([edge.p1, edge.p2])
    const material = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 4,
      depthTest: false,
      transparent: true,
      opacity: 0.9
    })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 999
    sceneRef.current.add(line)
    measureLinesRef.current.push(line)
    
    // Add small markers at endpoints
    const sphereGeo = new THREE.SphereGeometry(0.5, 16, 16)
    const sphereMat = new THREE.MeshBasicMaterial({ 
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    })
    
    const m1 = new THREE.Mesh(sphereGeo, sphereMat)
    m1.position.copy(edge.p1)
    m1.renderOrder = 1000
    m1.raycast = () => {} // Don't block raycasting
    sceneRef.current.add(m1)
    measureMarkersRef.current.push(m1)
    
    const m2 = new THREE.Mesh(sphereGeo.clone(), sphereMat.clone())
    m2.position.copy(edge.p2)
    m2.renderOrder = 1000
    m2.raycast = () => {} // Don't block raycasting
    sceneRef.current.add(m2)
    measureMarkersRef.current.push(m2)
  }, [])

  // Create highlight for surface
  const highlightSurface = useCallback((meshObj, color = 0x00d4aa) => {
    const originalMaterial = meshObj.material.clone()
    highlightedMeshesRef.current.push({ mesh: meshObj, originalMaterial })
    
    meshObj.material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.2,
      roughness: 0.5,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.85
    })
  }, [])

  // Create marker point - small and doesn't block clicks
  const createMarker = useCallback((position, color = 0x00ff88) => {
    if (!sceneRef.current) return null
    
    const geometry = new THREE.SphereGeometry(0.7, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color,
      depthTest: false, // Always visible on top
      transparent: true,
      opacity: 0.95
    })
    const marker = new THREE.Mesh(geometry, material)
    marker.position.copy(position)
    marker.renderOrder = 1000 // Render on top of lines
    marker.raycast = () => {} // Don't block raycasting
    sceneRef.current.add(marker)
    measureMarkersRef.current.push(marker)
    return marker
  }, [])

  // Create 3D label for measurements
  const createLabel = useCallback((text, position, color = '#ffffff') => {
    if (!sceneRef.current) return null
    
    const div = document.createElement('div')
    div.className = 'measurement-label'
    div.textContent = text
    div.style.color = color
    div.style.fontSize = '13px'
    div.style.fontWeight = '700'
    div.style.fontFamily = 'monospace'
    div.style.padding = '3px 6px'
    div.style.background = 'rgba(0, 0, 0, 0.8)'
    div.style.borderRadius = '4px'
    div.style.border = `2px solid ${color}`
    div.style.whiteSpace = 'nowrap'
    div.style.userSelect = 'none'
    div.style.pointerEvents = 'none'

    const label = new CSS2DObject(div)
    label.position.copy(position)
    sceneRef.current.add(label)
    measureLabelsRef.current.push(label)
    return label
  }, [])

  // Create line between points
  const createLine = useCallback((p1, p2, color = 0xffaa00) => {
    if (!sceneRef.current) return null
    
    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
    const material = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 3,
      depthTest: false, // Always render on top
      transparent: true,
      opacity: 0.9
    })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 999 // Render after everything else
    sceneRef.current.add(line)
    measureLinesRef.current.push(line)
    return line
  }, [])

  // Create axis-aligned measurement lines (X, Y, Z) with labels
  const createAxisLines = useCallback((p1, p2) => {
    if (!sceneRef.current) return
    
    // Create corner points for right-angle lines
    const pX = new THREE.Vector3(p2.x, p1.y, p1.z) // X component
    const pXY = new THREE.Vector3(p2.x, p2.y, p1.z) // X+Y component

    const scale = modelScaleRef.current
    
    // Draw X axis line (red)
    if (Math.abs(p2.x - p1.x) > 0.01) {
      const geometryX = new THREE.BufferGeometry().setFromPoints([p1, pX])
      const materialX = new THREE.LineBasicMaterial({ 
        color: 0xff0000, 
        linewidth: 4,
        transparent: true,
        opacity: 0.9,
        depthTest: false
      })
      const lineX = new THREE.Line(geometryX, materialX)
      lineX.renderOrder = 999
      sceneRef.current.add(lineX)
      measureLinesRef.current.push(lineX)
      
      // Add label at midpoint
      const midX = new THREE.Vector3().lerpVectors(p1, pX, 0.5)
      const distX = Math.abs(p2.x - p1.x) / scale
      createLabel(`X: ${distX.toFixed(2)} mm`, midX, '#ff0000')
    }
    
    // Draw Y axis line (green)
    if (Math.abs(p2.y - p1.y) > 0.01) {
      const geometryY = new THREE.BufferGeometry().setFromPoints([pX, pXY])
      const materialY = new THREE.LineBasicMaterial({ 
        color: 0x00ff00, 
        linewidth: 4,
        transparent: true,
        opacity: 0.9,
        depthTest: false
      })
      const lineY = new THREE.Line(geometryY, materialY)
      lineY.renderOrder = 999
      sceneRef.current.add(lineY)
      measureLinesRef.current.push(lineY)
      
      // Add label at midpoint
      const midY = new THREE.Vector3().lerpVectors(pX, pXY, 0.5)
      const distY = Math.abs(p2.y - p1.y) / scale
      createLabel(`Y: ${distY.toFixed(2)} mm`, midY, '#00ff00')
    }
    
    // Draw Z axis line (blue)
    if (Math.abs(p2.z - p1.z) > 0.01) {
      const geometryZ = new THREE.BufferGeometry().setFromPoints([pXY, p2])
      const materialZ = new THREE.LineBasicMaterial({ 
        color: 0x0088ff, 
        linewidth: 4,
        transparent: true,
        opacity: 0.9,
        depthTest: false
      })
      const lineZ = new THREE.Line(geometryZ, materialZ)
      lineZ.renderOrder = 999
      sceneRef.current.add(lineZ)
      measureLinesRef.current.push(lineZ)
      
      // Add label at midpoint
      const midZ = new THREE.Vector3().lerpVectors(pXY, p2, 0.5)
      const distZ = Math.abs(p2.z - p1.z) / scale
      createLabel(`Z: ${distZ.toFixed(2)} mm`, midZ, '#0088ff')
    }
  }, [createLabel])

  // Handle click - two point measurement only
  const handleClick = useCallback((event) => {
    if (!modelRef.current || !containerRef.current || !measureMode) return
    
    // Sadece canvas üzerine tıklandığında çalış (panel vs. üzerinde değil)
    if (event.target.tagName !== 'CANVAS') return

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    
    // Only intersect front faces (not back faces)
    const intersects = raycaster.intersectObject(modelRef.current, true)
    
    // Filter out back-facing intersections
    const frontIntersects = intersects.filter(intersect => {
      if (!intersect.face) return true
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld)
      const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize()
      const dirToCamera = new THREE.Vector3().subVectors(cameraRef.current.position, intersect.point).normalize()
      return worldNormal.dot(dirToCamera) > 0 // Only front faces
    })
    
    if (frontIntersects.length === 0) return
    
    const intersection = frontIntersects[0]
    let point = intersection.point.clone()

    // Two point measurement - no snapping, just click position
    if (distanceStep === 0 || distanceStep === 2) {
      // Start new measurement
      clearMeasurement()
      setMeasureMode(true)
      setDistanceStep(1)

      measurePointsRef.current = [point]
      createMarker(point, 0x00ff88)

      setMeasureValue({ step: 1 })
    } else if (distanceStep === 1) {
      // Complete measurement
      const p1 = measurePointsRef.current[0]
      
      // Düz çizgi modu aktifse, en yakın eksene hizala
      if (straightLineMode) {
        const dx = Math.abs(point.x - p1.x)
        const dy = Math.abs(point.y - p1.y)
        const dz = Math.abs(point.z - p1.z)
        
        // En büyük farkı bul ve sadece o eksende hareket et
        if (dx >= dy && dx >= dz) {
          // X ekseni dominant - Y ve Z'yi sabitle
          point.y = p1.y
          point.z = p1.z
        } else if (dy >= dx && dy >= dz) {
          // Y ekseni dominant - X ve Z'yi sabitle
          point.x = p1.x
          point.z = p1.z
        } else {
          // Z ekseni dominant - X ve Y'yi sabitle
          point.x = p1.x
          point.y = p1.y
        }
      }
      
      const scaledDistance = p1.distanceTo(point)
      // Convert back to original units
      const originalDistance = scaledDistance / modelScaleRef.current
      
      // Calculate axis-aligned distances for final display
      const dx = Math.abs(point.x - p1.x) / modelScaleRef.current
      const dy = Math.abs(point.y - p1.y) / modelScaleRef.current
      const dz = Math.abs(point.z - p1.z) / modelScaleRef.current
      
      createMarker(point, 0xff4444)
      createLine(p1, point, 0xffaa00) // Main diagonal line
      createAxisLines(p1, point) // X, Y, Z axis lines
      
      setDistanceStep(2)
      setMeasureValue({ 
        distance: originalDistance, 
        dx,
        dy,
        dz,
        step: 2 
      })
      setLiveDistance(null) // Clear live distance
    }
  }, [measureMode, distanceStep, clearMeasurement, createMarker, createLine, createAxisLines])

  // Click event listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [handleClick])

  // Hover for edge preview + Live distance measurement
  useEffect(() => {
    const container = containerRef.current
    if (!container || !modelRef.current) return

    let livePreviewLine = null
    let livePreviewMarker = null
    let liveAxisLines = []

    const handleMouseMove = (event) => {
      // Remove previous live preview
      if (livePreviewLine) {
        sceneRef.current.remove(livePreviewLine)
        livePreviewLine.geometry?.dispose()
        livePreviewLine.material?.dispose()
        livePreviewLine = null
      }
      if (livePreviewMarker) {
        sceneRef.current.remove(livePreviewMarker)
        livePreviewMarker.geometry?.dispose()
        livePreviewMarker.material?.dispose()
        livePreviewMarker = null
      }
      liveAxisLines.forEach(line => {
        sceneRef.current.remove(line)
        line.geometry?.dispose()
        line.material?.dispose()
      })
      liveAxisLines = []

      // Only show preview when in measure mode
      if (!measureMode) {
        setLiveDistance(null)
        return
      }

      const rect = container.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cameraRef.current)
      const intersects = raycaster.intersectObject(modelRef.current, true)
      
      // Filter out back-facing intersections
      const frontIntersects = intersects.filter(intersect => {
        if (!intersect.face) return true
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld)
        const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize()
        const dirToCamera = new THREE.Vector3().subVectors(cameraRef.current.position, intersect.point).normalize()
        return worldNormal.dot(dirToCamera) > 0 // Only front faces
      })
      
      if (frontIntersects.length > 0) {
        let point = frontIntersects[0].point.clone()

        // Live distance preview while measuring (step 1)
        if (distanceStep === 1 && measurePointsRef.current.length > 0) {
          const p1 = measurePointsRef.current[0]
          
          // Düz çizgi modu aktifse, en yakın eksene hizala
          if (straightLineMode) {
            const dxRaw = Math.abs(point.x - p1.x)
            const dyRaw = Math.abs(point.y - p1.y)
            const dzRaw = Math.abs(point.z - p1.z)
            
            if (dxRaw >= dyRaw && dxRaw >= dzRaw) {
              point.y = p1.y
              point.z = p1.z
            } else if (dyRaw >= dxRaw && dyRaw >= dzRaw) {
              point.x = p1.x
              point.z = p1.z
            } else {
              point.x = p1.x
              point.y = p1.y
            }
          }
          
          const scaledDist = p1.distanceTo(point)
          const originalDist = scaledDist / modelScaleRef.current

          // Calculate axis-aligned distances
          const dx = Math.abs(point.x - p1.x) / modelScaleRef.current
          const dy = Math.abs(point.y - p1.y) / modelScaleRef.current
          const dz = Math.abs(point.z - p1.z) / modelScaleRef.current

          setLiveDistance({
            total: originalDist,
            dx,
            dy,
            dz
          })
          
          // Draw preview line (main diagonal)
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([p1, point])
          const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffaa00, 
            linewidth: 3,
            transparent: true,
            opacity: 0.6,
            depthTest: false
          })
          livePreviewLine = new THREE.Line(lineGeometry, lineMaterial)
          livePreviewLine.renderOrder = 999
          sceneRef.current.add(livePreviewLine)
          
          // Draw axis-aligned preview lines (X, Y, Z)
          const pX = new THREE.Vector3(point.x, p1.y, p1.z)
          const pXY = new THREE.Vector3(point.x, point.y, p1.z)
          
          // X axis line (red)
          if (Math.abs(point.x - p1.x) > 0.01) {
            const geoX = new THREE.BufferGeometry().setFromPoints([p1, pX])
            const matX = new THREE.LineBasicMaterial({ 
              color: 0xff0000, 
              linewidth: 4, 
              transparent: true, 
              opacity: 0.7,
              depthTest: false
            })
            const lineX = new THREE.Line(geoX, matX)
            lineX.renderOrder = 999
            sceneRef.current.add(lineX)
            liveAxisLines.push(lineX)
          }
          
          // Y axis line (green)
          if (Math.abs(point.y - p1.y) > 0.01) {
            const geoY = new THREE.BufferGeometry().setFromPoints([pX, pXY])
            const matY = new THREE.LineBasicMaterial({ 
              color: 0x00ff00, 
              linewidth: 4, 
              transparent: true, 
              opacity: 0.7,
              depthTest: false
            })
            const lineY = new THREE.Line(geoY, matY)
            lineY.renderOrder = 999
            sceneRef.current.add(lineY)
            liveAxisLines.push(lineY)
          }
          
          // Z axis line (blue)
          if (Math.abs(point.z - p1.z) > 0.01) {
            const geoZ = new THREE.BufferGeometry().setFromPoints([pXY, point])
            const matZ = new THREE.LineBasicMaterial({ 
              color: 0x0088ff, 
              linewidth: 4, 
              transparent: true, 
              opacity: 0.7,
              depthTest: false
            })
            const lineZ = new THREE.Line(geoZ, matZ)
            lineZ.renderOrder = 999
            sceneRef.current.add(lineZ)
            liveAxisLines.push(lineZ)
          }
          
          // Draw preview marker at hover point (small)
          const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16)
          const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffaa00,
            transparent: true,
            opacity: 0.9,
            depthTest: false
          })
          livePreviewMarker = new THREE.Mesh(markerGeometry, markerMaterial)
          livePreviewMarker.position.copy(point)
          livePreviewMarker.renderOrder = 1000
          sceneRef.current.add(livePreviewMarker)
        } else {
          setLiveDistance(null)
        }
      } else {
        setLiveDistance(null)
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      if (livePreviewLine) {
        sceneRef.current.remove(livePreviewLine)
        livePreviewLine.geometry?.dispose()
        livePreviewLine.material?.dispose()
      }
      if (livePreviewMarker) {
        sceneRef.current.remove(livePreviewMarker)
        livePreviewMarker.geometry?.dispose()
        livePreviewMarker.material?.dispose()
      }
      liveAxisLines.forEach(line => {
        sceneRef.current.remove(line)
        line.geometry?.dispose()
        line.material?.dispose()
      })
    }
  }, [measureMode, distanceStep, straightLineMode])

  // Toggle measurement mode
  const toggleMeasureMode = () => {
    if (!modelRef.current) return // Don't allow measure mode without a model
    
    if (measureMode) {
      // Turn off
      clearMeasurement()
      setMeasureMode(false)
    } else {
      // Turn on
      setMeasureMode(true)
      setDistanceStep(0)
    }
  }

  const toggleGrid = () => {
    if (gridRef.current) {
      gridRef.current.visible = !gridRef.current.visible
      setShowGrid(!showGrid)
    }
  }

  const resetView = () => {
    if (!modelRef.current) return
    cameraRef.current.position.set(150, 120, 150)
    cameraRef.current.lookAt(0, 0, 0)
    controlsRef.current.target.set(0, 0, 0)
  }

  return (
    <div 
      className={`step-viewer ${measureMode ? 'measure-mode' : ''}`}
      ref={containerRef}
    >
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

      {/* Control buttons */}
      <div className="viewer-controls">
        <button 
          className={`control-btn ${measureMode ? 'active' : ''}`}
          onClick={toggleMeasureMode}
          title="İki Nokta Mesafesi"
        >
          <Ruler size={18} />
        </button>
        <button 
          className={`control-btn ${straightLineMode ? 'active' : ''}`}
          onClick={() => setStraightLineMode(!straightLineMode)}
          title="Düz Çizgi Modu (X/Y/Z eksenine hizala)"
          disabled={!measureMode}
        >
          <Minus size={18} />
        </button>
        <div className="control-divider"></div>
        <button 
          className={`control-btn ${showGrid ? 'active' : ''}`} 
          onClick={toggleGrid}
          title="Izgara"
        >
          <Grid3X3 size={18} />
        </button>
        <button className="control-btn" onClick={resetView} title="Görünümü Sıfırla">
          <RotateCcw size={18} />
        </button>
        <button className="control-btn" onClick={() => cameraRef.current.position.multiplyScalar(0.8)} title="Yakınlaştır">
          <ZoomIn size={18} />
        </button>
        <button className="control-btn" onClick={() => cameraRef.current.position.multiplyScalar(1.2)} title="Uzaklaştır">
          <ZoomOut size={18} />
        </button>
      </div>

      {/* Measurement Panel - only show when measure mode is ON */}
      {measureMode && (
        <div className="measure-result-panel" onClick={(e) => e.stopPropagation()}>
          {/* Type indicator */}
          <div className="measure-type-badge distance">
            <Ruler size={16} />
            <span>MESAFE ÖLÇÜMÜ</span>
          </div>

          {/* Measurement value */}
          <div className="measure-value-container">
            {distanceStep === 0 && (
              <div className="measure-instruction">
                <span>🎯 İlk noktayı seçin</span>
              </div>
            )}
            {distanceStep === 1 && (
              <>
                <div className="measure-instruction">
                  <span className="step-indicator">1/2</span>
                  <span>İkinci noktayı seçin</span>
                </div>
                <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearMeasurement(); setDistanceStep(0); }}>
                  İptal
                </button>
              </>
            )}
            {distanceStep === 2 && measureValue && (
              <>
                <div className="measure-value distance">
                  <span className="value-label">Toplam Mesafe</span>
                  <span className="value-number">{measureValue.distance.toFixed(2)}</span>
                  <span className="value-unit">mm</span>
                </div>
                
                {/* Show XYZ components */}
                <div className="distance-components">
                  <div className="component-item">
                    <span className="component-label">ΔX</span>
                    <span className="component-value">{measureValue.dx.toFixed(2)} mm</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">ΔY</span>
                    <span className="component-value">{measureValue.dy.toFixed(2)} mm</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">ΔZ</span>
                    <span className="component-value">{measureValue.dz.toFixed(2)} mm</span>
                  </div>
                </div>

                {/* Clear button */}
                <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearMeasurement(); }}>
                  Yeni Ölçüm
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live Distance Display - shows while measuring */}
      {liveDistance && measureMode && distanceStep === 1 && (
        <div className="live-distance-panel" onClick={(e) => e.stopPropagation()}>
          <div className="live-distance-header">
            <Ruler size={14} />
            <span>CANLI ÖLÇÜM</span>
          </div>
          
          <div className="live-distance-values">
            <div className="live-distance-main">
              <span className="value-label">Toplam Mesafe</span>
              <div className="value-display">
                <span className="value-number">{liveDistance.total.toFixed(2)}</span>
                <span className="value-unit">mm</span>
              </div>
            </div>
            
            <div className="axis-distances">
              <div className="axis-item">
                <span className="axis-label">ΔX</span>
                <span className="axis-value">{liveDistance.dx.toFixed(2)} mm</span>
              </div>
              <div className="axis-item">
                <span className="axis-label">ΔY</span>
                <span className="axis-value">{liveDistance.dy.toFixed(2)} mm</span>
              </div>
              <div className="axis-item">
                <span className="axis-label">ΔZ</span>
                <span className="axis-value">{liveDistance.dz.toFixed(2)} mm</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="viewer-help">
        <div className="help-item">
          <RotateCcw size={14} />
          <span>Döndür: Sol tık</span>
        </div>
        <div className="help-item">
          <Move size={14} />
          <span>Kaydır: Sağ tık</span>
        </div>
        <div className="help-item">
          <Maximize2 size={14} />
          <span>Zoom: Scroll</span>
        </div>
      </div>
    </div>
  )
}
