import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import DxfParser from 'dxf-parser'

export default function DxfViewer({ fileUrl, fileName }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const animationIdRef = useRef(null)

  useEffect(() => {
    if (!fileUrl || !containerRef.current) return

    let mounted = true
    const container = containerRef.current

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    )
    camera.position.set(0, 0, 100)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Grid helper
    const gridHelper = new THREE.GridHelper(1000, 50, 0x444444, 0x333333)
    gridHelper.rotation.x = Math.PI / 2
    scene.add(gridHelper)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    // Load DXF
    const loadDxf = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('Dosya yüklenemedi')
        
        const dxfText = await response.text()
        const parser = new DxfParser()
        const dxf = parser.parseSync(dxfText)

        if (!dxf || !dxf.entities) {
          throw new Error('DXF dosyası okunamadı')
        }

        // Create geometry from DXF entities
        const group = new THREE.Group()
        
        // Color mapping for DXF colors
        const getColor = (entity) => {
          const colorIndex = entity.colorIndex || entity.color || 7
          const colors = {
            1: 0xff0000, // Red
            2: 0xffff00, // Yellow
            3: 0x00ff00, // Green
            4: 0x00ffff, // Cyan
            5: 0x0000ff, // Blue
            6: 0xff00ff, // Magenta
            7: 0xffffff, // White
            8: 0x808080, // Gray
            256: 0xffffff // ByLayer
          }
          return colors[colorIndex] || 0x00d4aa
        }

        // Process entities
        dxf.entities.forEach(entity => {
          const color = getColor(entity)
          const material = new THREE.LineBasicMaterial({ color })

          switch (entity.type) {
            case 'LINE': {
              const geometry = new THREE.BufferGeometry()
              const points = [
                new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z || 0),
                new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z || 0)
              ]
              geometry.setFromPoints(points)
              const line = new THREE.Line(geometry, material)
              group.add(line)
              break
            }
            
            case 'POLYLINE':
            case 'LWPOLYLINE': {
              if (entity.vertices && entity.vertices.length > 1) {
                const geometry = new THREE.BufferGeometry()
                const points = entity.vertices.map(v => 
                  new THREE.Vector3(v.x, v.y, v.z || 0)
                )
                if (entity.shape) points.push(points[0]) // Close shape
                geometry.setFromPoints(points)
                const line = new THREE.Line(geometry, material)
                group.add(line)
              }
              break
            }
            
            case 'CIRCLE': {
              const geometry = new THREE.BufferGeometry()
              const points = []
              const segments = 64
              for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2
                points.push(new THREE.Vector3(
                  entity.center.x + Math.cos(angle) * entity.radius,
                  entity.center.y + Math.sin(angle) * entity.radius,
                  entity.center.z || 0
                ))
              }
              geometry.setFromPoints(points)
              const circle = new THREE.Line(geometry, material)
              group.add(circle)
              break
            }
            
            case 'ARC': {
              const geometry = new THREE.BufferGeometry()
              const points = []
              const segments = 64
              const startAngle = entity.startAngle * (Math.PI / 180)
              const endAngle = entity.endAngle * (Math.PI / 180)
              let angle = startAngle
              const step = (endAngle - startAngle) / segments
              for (let i = 0; i <= segments; i++) {
                points.push(new THREE.Vector3(
                  entity.center.x + Math.cos(angle) * entity.radius,
                  entity.center.y + Math.sin(angle) * entity.radius,
                  entity.center.z || 0
                ))
                angle += step
              }
              geometry.setFromPoints(points)
              const arc = new THREE.Line(geometry, material)
              group.add(arc)
              break
            }
            
            case 'ELLIPSE': {
              const geometry = new THREE.BufferGeometry()
              const points = []
              const segments = 64
              const majorAxis = Math.sqrt(
                entity.majorAxisEndPoint.x ** 2 + 
                entity.majorAxisEndPoint.y ** 2
              )
              const minorAxis = majorAxis * entity.axisRatio
              const rotation = Math.atan2(
                entity.majorAxisEndPoint.y,
                entity.majorAxisEndPoint.x
              )
              
              for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2
                const x = Math.cos(angle) * majorAxis
                const y = Math.sin(angle) * minorAxis
                points.push(new THREE.Vector3(
                  entity.center.x + x * Math.cos(rotation) - y * Math.sin(rotation),
                  entity.center.y + x * Math.sin(rotation) + y * Math.cos(rotation),
                  entity.center.z || 0
                ))
              }
              geometry.setFromPoints(points)
              const ellipse = new THREE.Line(geometry, material)
              group.add(ellipse)
              break
            }
            
            case 'SPLINE': {
              if (entity.controlPoints && entity.controlPoints.length > 1) {
                const geometry = new THREE.BufferGeometry()
                const curve = new THREE.CatmullRomCurve3(
                  entity.controlPoints.map(p => new THREE.Vector3(p.x, p.y, p.z || 0))
                )
                const points = curve.getPoints(100)
                geometry.setFromPoints(points)
                const spline = new THREE.Line(geometry, material)
                group.add(spline)
              }
              break
            }
            
            case 'POINT': {
              const dotGeometry = new THREE.BufferGeometry()
              dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
                entity.position.x, entity.position.y, entity.position.z || 0
              ], 3))
              const dotMaterial = new THREE.PointsMaterial({ size: 3, color })
              const dot = new THREE.Points(dotGeometry, dotMaterial)
              group.add(dot)
              break
            }
            
            case 'TEXT':
            case 'MTEXT': {
              // Text rendering would require additional setup with font loaders
              // For now, we'll skip text entities
              break
            }
            
            default:
              // Handle other entity types as needed
              break
          }
        })

        if (!mounted) return

        scene.add(group)

        // Center and fit the model
        const box = new THREE.Box3().setFromObject(group)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        group.position.sub(center)
        
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = camera.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5
        
        camera.position.set(0, 0, cameraZ)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()

        setLoading(false)
      } catch (err) {
        console.error('DXF load error:', err)
        if (mounted) {
          setError(err.message || 'DXF dosyası yüklenirken hata oluştu')
          setLoading(false)
        }
      }
    }

    loadDxf()

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (controlsRef.current) {
        controlsRef.current.dispose()
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
        if (container && rendererRef.current.domElement) {
          container.removeChild(rendererRef.current.domElement)
        }
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose()
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose())
            } else {
              object.material.dispose()
            }
          }
        })
      }
    }
  }, [fileUrl])

  if (error) {
    return (
      <div className="dxf-viewer-error">
        <div className="error-content">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <a href={fileUrl} download={fileName} className="download-fallback-btn">
            Dosyayı İndir
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="dxf-viewer-container">
      {loading && (
        <div className="dxf-loading">
          <div className="loading-spinner"></div>
          <p>DXF dosyası yükleniyor...</p>
        </div>
      )}
      <div ref={containerRef} className="dxf-canvas" />
    </div>
  )
}
