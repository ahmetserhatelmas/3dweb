import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Ruler, RotateCcw, ZoomIn, ZoomOut, Maximize2, Move, Grid3X3, Circle, Square, Minus, Target, MapPin } from 'lucide-react'
import occtimportjs from 'occt-import-js'
import './StepViewer.css'

export default function StepViewer({ fileUrl }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const modelRef = useRef(null)
  const gridRef = useRef(null)
  const measurePointsRef = useRef([])
  const measureLinesRef = useRef([])
  const measureDataRef = useRef([]) // Store point + normal + surface data
  const highlightMeshRef = useRef(null) // For highlighted surface
  const originalMaterialsRef = useRef(new Map()) // Store original materials
  const animationIdRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [distanceMode, setDistanceMode] = useState(false) // For two-surface distance measurement
  const [surfaceInfo, setSurfaceInfo] = useState(null) // {area, perimeter, centroid, diameter?, type}
  const [distanceInfo, setDistanceInfo] = useState(null) // For distance measurement
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [selectionCount, setSelectionCount] = useState(0)

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
    gridRef.current = gridHelper

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
        
        // First, move to origin
        group.position.set(-center.x, -center.y, -center.z)
        
        // Scale to fit
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 80 / maxDim
        group.scale.setScalar(scale)
        
        // Update position after scale
        group.position.multiplyScalar(scale)

        sceneRef.current.add(group)
        modelRef.current = group

        // Reset camera to look at center
        const distance = 150
        cameraRef.current.position.set(distance, distance * 0.8, distance)
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
  }, [fileUrl])

  // Clear all measurement markers and lines
  const clearMeasurements = useCallback(() => {
    measurePointsRef.current.forEach(m => {
      sceneRef.current.remove(m)
      if (m.geometry) m.geometry.dispose()
      if (m.material) m.material.dispose()
    })
    measureLinesRef.current.forEach(l => {
      sceneRef.current.remove(l)
      if (l.geometry) l.geometry.dispose()
      if (l.material) l.material.dispose()
      if (l.line) l.line.geometry?.dispose()
      if (l.cone) l.cone.geometry?.dispose()
    })
    
    // Restore original materials
    originalMaterialsRef.current.forEach((material, mesh) => {
      mesh.material = material
    })
    originalMaterialsRef.current.clear()
    
    // Remove highlight mesh
    if (highlightMeshRef.current) {
      sceneRef.current.remove(highlightMeshRef.current)
      highlightMeshRef.current.geometry?.dispose()
      highlightMeshRef.current.material?.dispose()
      highlightMeshRef.current = null
    }
    
    measurePointsRef.current = []
    measureLinesRef.current = []
    measureDataRef.current = []
    setSurfaceInfo(null)
    setDistanceInfo(null)
    setSelectionCount(0)
  }, [])

  // Analyze surface - smart detection for planar and cylindrical surfaces
  // Returns measurements in ORIGINAL units (mm) - not scaled
  const analyzeSurface = useCallback((meshObj, clickedFace, clickedPoint) => {
    const geometry = meshObj.geometry
    const positionAttr = geometry.getAttribute('position')
    const normalAttr = geometry.getAttribute('normal')
    const index = geometry.getIndex()
    
    if (!positionAttr || !normalAttr) return { type: 'unknown' }
    
    // Get scale factor to convert back to original units
    const scale = meshObj.scale.x // viewer scale
    const invScale = 1 / scale // to get original dimensions
    
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshObj.matrixWorld)
    
    // Get clicked face normal in world space
    const clickedNormal = clickedFace.normal.clone()
    clickedNormal.applyMatrix3(normalMatrix).normalize()
    
    const faceCount = index ? index.count / 3 : positionAttr.count / 3
    
    // Collect all face data with ORIGINAL coordinates
    const faceData = []
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
      
      // Get vertices in ORIGINAL coordinates (before scaling)
      const vA = new THREE.Vector3().fromBufferAttribute(positionAttr, a)
      const vB = new THREE.Vector3().fromBufferAttribute(positionAttr, b)
      const vC = new THREE.Vector3().fromBufferAttribute(positionAttr, c)
      
      const localCentroid = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3)
      
      // Get face normal
      const nA = new THREE.Vector3().fromBufferAttribute(normalAttr, a)
      const nB = new THREE.Vector3().fromBufferAttribute(normalAttr, b)
      const nC = new THREE.Vector3().fromBufferAttribute(normalAttr, c)
      const faceNormal = new THREE.Vector3().addVectors(nA, nB).add(nC).normalize()
      faceNormal.applyMatrix3(normalMatrix).normalize()
      
      // Calculate area in ORIGINAL units
      const edge1 = new THREE.Vector3().subVectors(vB, vA)
      const edge2 = new THREE.Vector3().subVectors(vC, vA)
      const crossProduct = new THREE.Vector3().crossVectors(edge1, edge2)
      const area = crossProduct.length() * 0.5 // Original area, no scaling
      
      faceData.push({
        indices: [a, b, c],
        vA, vB, vC,
        localCentroid,
        normal: faceNormal,
        area
      })
    }
    
    // Check if surface is planar (normals similar to clicked face)
    const coplanarTolerance = 0.95 // cos(~18°)
    const coplanarFaces = faceData.filter(f => Math.abs(clickedNormal.dot(f.normal)) > coplanarTolerance)
    
    // If significant portion is coplanar, treat as flat surface
    const isPlanar = coplanarFaces.length > faceData.length * 0.2
    
    if (isPlanar && coplanarFaces.length > 0) {
      // PLANAR SURFACE
      const allEdges = new Map()
      let totalArea = 0
      const centroid = new THREE.Vector3()
      
      coplanarFaces.forEach(f => {
        totalArea += f.area
        centroid.add(f.localCentroid.clone().multiplyScalar(f.area))
        
        const edges = [[f.indices[0], f.indices[1]], [f.indices[1], f.indices[2]], [f.indices[2], f.indices[0]]]
        edges.forEach(([v1, v2]) => {
          const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`
          allEdges.set(key, (allEdges.get(key) || 0) + 1)
        })
      })
      
      if (totalArea > 0) centroid.divideScalar(totalArea)
      
      // Calculate perimeter (boundary edges only)
      let perimeter = 0
      const boundaryVertices = []
      allEdges.forEach((count, key) => {
        if (count === 1) {
          const [i1, i2] = key.split('-').map(Number)
          const v1 = new THREE.Vector3().fromBufferAttribute(positionAttr, i1)
          const v2 = new THREE.Vector3().fromBufferAttribute(positionAttr, i2)
          perimeter += v1.distanceTo(v2)
          boundaryVertices.push(v1.clone(), v2.clone())
        }
      })
      
      // Check if boundary forms a circle (for diameter)
      let diameter = null
      if (boundaryVertices.length > 10) {
        // Use original coordinates for circle fitting
        const bCenterX = boundaryVertices.reduce((s, v) => s + v.x, 0) / boundaryVertices.length
        const bCenterZ = boundaryVertices.reduce((s, v) => s + v.z, 0) / boundaryVertices.length
        
        const radii = boundaryVertices.map(v => 
          Math.sqrt((v.x - bCenterX) ** 2 + (v.z - bCenterZ) ** 2)
        )
        
        const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length
        const radiusStdDev = Math.sqrt(radii.reduce((s, r) => s + (r - avgRadius) ** 2, 0) / radii.length)
        
        // Circular if radii are consistent
        if (avgRadius > 0.5 && radiusStdDev < avgRadius * 0.15) {
          diameter = avgRadius * 2
        }
      }
      
      return {
        type: diameter ? 'circular' : 'planar',
        area: totalArea,
        perimeter: perimeter,
        centroid: centroid,
        diameter: diameter,
        normal: clickedNormal
      }
    } else {
      // CYLINDRICAL or complex surface
      // Use original vertex coordinates
      const allVertices = []
      for (let i = 0; i < positionAttr.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i)
        allVertices.push(v)
      }
      
      // Find cylinder axis
      let bestDiameter = null
      let bestAxis = null
      let lowestVariance = Infinity
      
      const axes = ['Y', 'X', 'Z']
      
      for (const axis of axes) {
        let minVal, maxVal, getPlaneCoords
        
        if (axis === 'Y') {
          minVal = Math.min(...allVertices.map(v => v.y))
          maxVal = Math.max(...allVertices.map(v => v.y))
          getPlaneCoords = (v) => ({ x: v.x, y: v.z })
        } else if (axis === 'X') {
          minVal = Math.min(...allVertices.map(v => v.x))
          maxVal = Math.max(...allVertices.map(v => v.x))
          getPlaneCoords = (v) => ({ x: v.y, y: v.z })
        } else {
          minVal = Math.min(...allVertices.map(v => v.z))
          maxVal = Math.max(...allVertices.map(v => v.z))
          getPlaneCoords = (v) => ({ x: v.x, y: v.y })
        }
        
        const midVal = (minVal + maxVal) / 2
        const range = maxVal - minVal
        
        const midVertices = allVertices.filter(v => {
          const val = axis === 'Y' ? v.y : axis === 'X' ? v.x : v.z
          return Math.abs(val - midVal) < range * 0.15
        })
        
        if (midVertices.length > 5) {
          const coords = midVertices.map(getPlaneCoords)
          const centerX = coords.reduce((s, c) => s + c.x, 0) / coords.length
          const centerY = coords.reduce((s, c) => s + c.y, 0) / coords.length
          
          const radii = coords.map(c => Math.sqrt((c.x - centerX) ** 2 + (c.y - centerY) ** 2))
          const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length
          const variance = radii.reduce((s, r) => s + (r - avgRadius) ** 2, 0) / radii.length
          const stdDev = Math.sqrt(variance)
          
          if (avgRadius > 0.5 && stdDev < avgRadius * 0.2 && variance < lowestVariance) {
            lowestVariance = variance
            bestDiameter = avgRadius * 2
            bestAxis = axis
          }
        }
      }
      
      // Total surface area
      let totalArea = faceData.reduce((sum, f) => sum + f.area, 0)
      
      // Perimeter
      const allEdges = new Map()
      faceData.forEach(f => {
        const edges = [[f.indices[0], f.indices[1]], [f.indices[1], f.indices[2]], [f.indices[2], f.indices[0]]]
        edges.forEach(([v1, v2]) => {
          const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`
          allEdges.set(key, (allEdges.get(key) || 0) + 1)
        })
      })
      
      let perimeter = 0
      allEdges.forEach((count, key) => {
        if (count === 1) {
          const [i1, i2] = key.split('-').map(Number)
          const v1 = new THREE.Vector3().fromBufferAttribute(positionAttr, i1)
          const v2 = new THREE.Vector3().fromBufferAttribute(positionAttr, i2)
          perimeter += v1.distanceTo(v2)
        }
      })
      
      // Centroid
      const centroid = new THREE.Vector3()
      faceData.forEach(f => {
        centroid.add(f.localCentroid.clone().multiplyScalar(f.area))
      })
      if (totalArea > 0) centroid.divideScalar(totalArea)
      
      const isCylinder = bestDiameter !== null
      
      return {
        type: isCylinder ? 'cylinder' : 'surface',
        area: totalArea,
        perimeter: perimeter,
        centroid: centroid,
        diameter: bestDiameter,
        axis: bestAxis,
        normal: clickedNormal
      }
    }
  }, [])

  // Highlight selected surface
  const highlightSurface = useCallback((meshObj, info, isSecondSelection = false) => {
    // Store original material if not already stored
    if (!originalMaterialsRef.current.has(meshObj)) {
      originalMaterialsRef.current.set(meshObj, meshObj.material.clone())
    }
    
    // Create highlight material
    const highlightColor = isSecondSelection ? 0xff4444 : 0x44ff44
    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: highlightColor,
      metalness: 0.2,
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    })
    
    meshObj.material = highlightMaterial
  }, [])

  // Handle click for surface info (always active)
  const handleClick = useCallback((event) => {
    if (!modelRef.current || !containerRef.current) return
    
    // If distance mode is active, use distance click handler
    if (distanceMode) return

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)

    const intersects = raycaster.intersectObject(modelRef.current, true)
    
    if (intersects.length > 0) {
      const intersection = intersects[0]
      const point = intersection.point.clone()
      const face = intersection.face
      const meshObj = intersection.object
      
      // Clear previous selection
      clearMeasurements()
      
      // Get face normal in world coordinates
      const normal = face.normal.clone()
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshObj.matrixWorld)
      normal.applyMatrix3(normalMatrix).normalize()
      
      // Analyze the clicked surface
      const info = analyzeSurface(meshObj, face, point)
      
      // Highlight the surface
      highlightSurface(meshObj, info, false)
      
      // Create marker at CLICKED point (not centroid)
      const markerGeometry = new THREE.SphereGeometry(1.5, 16, 16)
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x44ff44 })
      const marker = new THREE.Mesh(markerGeometry, markerMaterial)
      marker.position.copy(point) // Use clicked point
      sceneRef.current.add(marker)
      measurePointsRef.current.push(marker)
      
      // Show normal arrow at clicked point
      const arrowHelper = new THREE.ArrowHelper(normal, point, 15, 0x44ff44, 3, 2)
      sceneRef.current.add(arrowHelper)
      measureLinesRef.current.push(arrowHelper)
      
      // Set surface info for display
      setSurfaceInfo({
        type: info.type,
        area: info.area,
        perimeter: info.perimeter,
        centroid: info.centroid,
        diameter: info.diameter
      })
    }
  }, [distanceMode, analyzeSurface, clearMeasurements, highlightSurface])

  // Handle click for distance measurement (only when distance mode is active)
  const handleDistanceClick = useCallback((event) => {
    if (!distanceMode || !modelRef.current || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)

    const intersects = raycaster.intersectObject(modelRef.current, true)
    
    if (intersects.length > 0) {
      const intersection = intersects[0]
      const point = intersection.point.clone()
      const face = intersection.face
      const meshObj = intersection.object
      
      // Get face normal
      const normal = face.normal.clone()
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshObj.matrixWorld)
      normal.applyMatrix3(normalMatrix).normalize()
      
      const info = analyzeSurface(meshObj, face, point)
      
      // First selection
      if (measureDataRef.current.length === 0) {
        clearMeasurements()
        
        measureDataRef.current.push({ point, normal, info, meshObj })
        setSelectionCount(1)
        
        highlightSurface(meshObj, info, false)
        
        // Marker at clicked point
        const markerGeometry = new THREE.SphereGeometry(1.5, 16, 16)
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x44ff44 })
        const marker = new THREE.Mesh(markerGeometry, markerMaterial)
        marker.position.copy(point) // Use clicked point
        sceneRef.current.add(marker)
        measurePointsRef.current.push(marker)
        
        setDistanceInfo({ firstSurface: info, firstPoint: point, distance: null })
        
      } else if (measureDataRef.current.length === 1) {
        // Second selection
        measureDataRef.current.push({ point, normal, info, meshObj })
        setSelectionCount(2)
        
        highlightSurface(meshObj, info, true)
        
        // Second marker at clicked point
        const markerGeometry = new THREE.SphereGeometry(1.5, 16, 16)
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 })
        const marker = new THREE.Mesh(markerGeometry, markerMaterial)
        marker.position.copy(point) // Use clicked point
        sceneRef.current.add(marker)
        measurePointsRef.current.push(marker)
        
        const data1 = measureDataRef.current[0]
        
        // Use clicked points for measurement
        const point1 = data1.point
        const point2 = point
        
        // Calculate perpendicular distance
        const diff = new THREE.Vector3().subVectors(point2, point1)
        const perpendicularDistance = Math.abs(diff.dot(data1.normal))
        
        // Projected point
        const projectedPoint = point2.clone().sub(
          data1.normal.clone().multiplyScalar(diff.dot(data1.normal))
        )

        // Draw perpendicular line (red dashed)
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([point2, projectedPoint])
        const lineMaterial = new THREE.LineDashedMaterial({ 
          color: 0xff4444, linewidth: 3, dashSize: 3, gapSize: 2
        })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        line.computeLineDistances()
        sceneRef.current.add(line)
        measureLinesRef.current.push(line)

        // Draw guide line on first surface (green dashed)
        const guideGeometry = new THREE.BufferGeometry().setFromPoints([point1, projectedPoint])
        const guideMaterial = new THREE.LineDashedMaterial({ 
          color: 0x44ff44, linewidth: 2, dashSize: 2, gapSize: 2
        })
        const guideLine = new THREE.Line(guideGeometry, guideMaterial)
        guideLine.computeLineDistances()
        sceneRef.current.add(guideLine)
        measureLinesRef.current.push(guideLine)

        // Direct line between points (orange solid)
        const directGeometry = new THREE.BufferGeometry().setFromPoints([point1, point2])
        const directMaterial = new THREE.LineBasicMaterial({ color: 0xffaa00 })
        const directLine = new THREE.Line(directGeometry, directMaterial)
        sceneRef.current.add(directLine)
        measureLinesRef.current.push(directLine)

        const directDistance = point1.distanceTo(point2)

        setDistanceInfo({
          firstSurface: data1.info,
          secondSurface: info,
          distance: perpendicularDistance,
          directDistance: directDistance
        })
        
      } else {
        // Third click - restart
        clearMeasurements()
        measureDataRef.current = []
        handleDistanceClick(event)
      }
    }
  }, [distanceMode, analyzeSurface, clearMeasurements, highlightSurface])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const clickHandler = distanceMode ? handleDistanceClick : handleClick
    container.addEventListener('click', clickHandler)
    return () => container.removeEventListener('click', clickHandler)
  }, [handleClick, handleDistanceClick, distanceMode])

  const toggleDistanceMode = () => {
    if (distanceMode) {
      clearMeasurements()
    } else {
      clearMeasurements()
      setSurfaceInfo(null)
    }
    setDistanceMode(!distanceMode)
  }

  const toggleGrid = () => {
    if (gridRef.current) {
      gridRef.current.visible = !gridRef.current.visible
      setShowGrid(!showGrid)
    }
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
          className={`control-btn ${distanceMode ? 'active' : ''}`} 
          onClick={toggleDistanceMode}
          title="Mesafe Ölçümü (İki yüzey arası)"
        >
          <Ruler size={18} />
        </button>
        <button 
          className={`control-btn ${showGrid ? 'active' : ''}`} 
          onClick={toggleGrid}
          title="Izgara Göster/Gizle"
        >
          <Grid3X3 size={18} />
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

      {/* Surface Info Panel - Always visible when a surface is selected */}
      {surfaceInfo && !distanceMode && (
        <div className="surface-info-floating">
          <div className="surface-header">
            <Target size={16} />
            <span>
              {surfaceInfo.type === 'cylinder' ? 'Silindirik Yüzey' : 
               surfaceInfo.type === 'circular' ? 'Dairesel Yüzey' : 'Düz Yüzey'}
            </span>
          </div>
          
          <div className="info-grid">
            {surfaceInfo.diameter && (
              <div className="info-item highlight">
                <Circle size={14} />
                <span>Çap (Ø):</span>
                <strong>Ø{surfaceInfo.diameter?.toFixed(2)} mm</strong>
              </div>
            )}
            
            <div className="info-item">
              <Square size={14} />
              <span>Alan:</span>
              <strong>{surfaceInfo.area?.toFixed(2)} mm²</strong>
            </div>
            
            <div className="info-item">
              <Minus size={14} />
              <span>Çevre:</span>
              <strong>{surfaceInfo.perimeter?.toFixed(2)} mm</strong>
            </div>
            
            <div className="info-item small">
              <MapPin size={14} />
              <span>Merkez:</span>
              <strong>
                ({surfaceInfo.centroid?.x?.toFixed(1)}, 
                {surfaceInfo.centroid?.y?.toFixed(1)}, 
                {surfaceInfo.centroid?.z?.toFixed(1)})
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Distance Mode Panel */}
      {distanceMode && (
        <div className="measure-info">
          <div className="measure-badge distance">
            <Ruler size={14} />
            Mesafe Ölçümü Aktif
          </div>
          
          {!distanceInfo && (
            <p className="measure-hint">Birinci yüzeyi seçin</p>
          )}
          
          {distanceInfo && (
            <div className="surface-info-panel">
              {distanceInfo.firstSurface && (
                <div className="selection-item">
                  <span className="selection-badge green">1. Yüzey</span>
                  <span className="selection-type">
                    {distanceInfo.firstSurface.type === 'cylinder' ? 'Silindirik' : 'Düz'}
                  </span>
                </div>
              )}
              
              {distanceInfo.secondSurface && (
                <div className="selection-item">
                  <span className="selection-badge red">2. Yüzey</span>
                  <span className="selection-type">
                    {distanceInfo.secondSurface.type === 'cylinder' ? 'Silindirik' : 'Düz'}
                  </span>
                </div>
              )}
              
              {!distanceInfo.distance && distanceInfo.firstSurface && (
                <p className="measure-hint">İkinci yüzeyi seçin</p>
              )}
              
              {distanceInfo.distance !== null && distanceInfo.distance !== undefined && (
                <>
                  <div className="distance-result">
                    <Ruler size={18} />
                    <div>
                      <span>Dik Mesafe</span>
                      <strong>{distanceInfo.distance?.toFixed(2)} mm</strong>
                    </div>
                  </div>
                  {distanceInfo.directDistance && (
                    <div className="distance-result direct">
                      <Minus size={18} />
                      <div>
                        <span>Doğrudan Mesafe</span>
                        <strong>{distanceInfo.directDistance?.toFixed(2)} mm</strong>
                      </div>
                    </div>
                  )}
                </>
              )}
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

