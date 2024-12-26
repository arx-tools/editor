import { getHeaderSize } from 'arx-header-size'
import { implode } from 'node-pkware/simple'
import { DLF, LLF, FTS } from 'arx-convert'
import {
  type ArxLLF,
  type ArxDLF,
  type ArxFTS,
  ArxPolygonFlags,
  type ArxPolygon,
  type ArxTextureContainer,
  type ArxRoom,
  type ArxVertex,
} from 'arx-convert/types'
import { getCellCoords, MAP_DEPTH_IN_CELLS, MAP_WIDTH_IN_CELLS, type QuadrupleOf } from 'arx-convert/utils'
import JSZip from 'jszip'
import {
  concatArrayBuffers,
  didLeftMouseButtonTriggerTheEvent,
  distanceToFarthestBoundingBoxEdge,
  downloadBinaryAs,
  MimeTypes,
  randomIntBetween,
  sliceArrayBufferAt,
  times,
} from '@src/functions.js'
import {
  AmbientLight,
  ArrowHelper,
  type BufferAttribute,
  type BufferGeometry,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  TextureLoader,
  Triangle,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { ViewportGizmo } from 'three-viewport-gizmo'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// -----------------

const l1PrisonStoneGround19 = new TextureLoader().load('textures/l1_prison_[stone]_ground19.jpg')
const l1PrisonStoneGround19Material = new MeshBasicMaterial({ map: l1PrisonStoneGround19 })

// -----------------

const defaultCameraPosition = new Vector3(-350, 200, 350)
const defaultOrientationOfGeometry = new Quaternion(0, 0, 0, 1)

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const renderer = new WebGLRenderer({ antialias: true, canvas })

const canvasWidth = Number.parseInt(canvas.getAttribute('width') as string, 10)
const canvasHeight = Number.parseInt(canvas.getAttribute('height') as string, 10)

const fov = 45
const aspect = canvasWidth / canvasHeight
const camera = new PerspectiveCamera(fov, aspect, 1, 4000)

const orientationOfGeometry = defaultOrientationOfGeometry.clone()

camera.position.x = defaultCameraPosition.x
camera.position.y = defaultCameraPosition.y
camera.position.z = defaultCameraPosition.z

const scene = new Scene()

const group = new Group()

scene.add(group)

const light = new AmbientLight()
scene.add(light)

let controls: OrbitControls | undefined
let viewportGizmo: ViewportGizmo | undefined

function render(): void {
  renderer.render(scene, camera)

  if (controls !== undefined) {
    controls.update()
  }

  if (viewportGizmo !== undefined) {
    viewportGizmo.render()
  }
}

let lastRequestedAnimationFrameId = 0

function animate(): void {
  render()
  lastRequestedAnimationFrameId = requestAnimationFrame(animate)
}

function handleFocus(): void {
  cancelAnimationFrame(lastRequestedAnimationFrameId)
  animate()
}

function handleBlur(): void {
  cancelAnimationFrame(lastRequestedAnimationFrameId)
}

/**
 * @docs https://threejs.org/docs/#examples/en/controls/OrbitControls
 */
function setupOrbitControls(): void {
  controls = new OrbitControls(camera, renderer.domElement)

  controls.enableRotate = true
  controls.enablePan = true
  controls.enableZoom = true

  controls.enableDamping = true
  controls.dampingFactor = 0.1

  controls.minDistance = 100
  controls.maxDistance = 2000

  // disable the next line to allow looking under the 3D model
  controls.maxPolarAngle = Math.PI / 2

  controls.autoRotate = false

  // how far the camera can be panned from the origin
  controls.maxTargetRadius = 100

  viewportGizmo = new ViewportGizmo(camera, renderer, {
    type: 'sphere',
    container: canvas.parentElement as HTMLElement,
  })
  viewportGizmo.attachControls(controls)
}

let gridHelper: GridHelper | undefined

function addGrid(): void {
  if (gridHelper !== undefined) {
    return
  }

  const size = distanceToFarthestBoundingBoxEdge(group, orientationOfGeometry)
  const scale = Math.floor(Math.log2(size / 10))

  const gridSize = 1000 * 2 ** scale
  const gridUnitSize = 10 * 2 ** scale

  gridHelper = new GridHelper(gridSize, gridSize / gridUnitSize)
  scene.add(gridHelper)
}

function removeGrid(): void {
  if (gridHelper === undefined) {
    return
  }

  scene.remove(gridHelper)

  gridHelper.dispose()
  gridHelper = undefined
}

let playerMarkerBody: ArrowHelper | undefined
let playerMarkerFace: ArrowHelper | undefined

function addPlayerMarkerBody(): void {
  if (playerMarkerBody !== undefined) {
    return
  }

  const dir = new Vector3(0, -1, 0)
  dir.normalize()

  const length = 180
  const origin = new Vector3(0, length, 0)
  const color = 0xff_ff_00

  playerMarkerBody = new ArrowHelper(dir, origin, length, color, length)
  scene.add(playerMarkerBody)
}

function removePlayerMarkerBody(): void {
  if (playerMarkerBody === undefined) {
    return
  }

  scene.remove(playerMarkerBody)
  playerMarkerBody.dispose()
  playerMarkerBody = undefined
}

function addPlayerMarkerFace(): void {
  if (playerMarkerFace !== undefined) {
    return
  }

  const dir = new Vector3(0, 0, -1)
  dir.normalize()

  const length = 80
  const origin = new Vector3(0, 170, 0)
  const color = 0xff_00_00

  playerMarkerFace = new ArrowHelper(dir, origin, length, color, length)
  scene.add(playerMarkerFace)
}

function removePlayerMarkerFace(): void {
  if (playerMarkerFace === undefined) {
    return
  }

  scene.remove(playerMarkerFace)
  playerMarkerFace.dispose()
  playerMarkerFace = undefined
}

function addGeometry(at: Vector3 = new Vector3(0, 0, 0)): void {
  const geometry = new PlaneGeometry(100, 100, 1, 1)
  geometry.rotateX(MathUtils.degToRad(-90))
  geometry.translate(at.x, at.y, at.z)

  const plane = new Mesh(geometry, l1PrisonStoneGround19Material)
  group.add(plane)
}

function calculateRoomData(polygons: ArxPolygon[]): ArxRoom[] {
  const rooms: ArxRoom[] = times(() => {
    return { portals: [], polygons: [] }
  }, 2)

  const polygonsPerCellCounter: Record<string, number> = {}

  polygons.forEach(({ vertices }) => {
    const [cellX, cellY] = getCellCoords(vertices)

    const key = `${cellX}|${cellY}`

    if (key in polygonsPerCellCounter) {
      polygonsPerCellCounter[key] = polygonsPerCellCounter[key] + 1
    } else {
      polygonsPerCellCounter[key] = 0
    }

    rooms[1].polygons.push({ cellX, cellY, polygonIdx: polygonsPerCellCounter[key] })
  })

  return rooms
}

function calculateNormals({ vertices, flags }: { vertices: QuadrupleOf<Vector3>; flags: ArxPolygonFlags }): {
  norm: Vector3
  norm2: Vector3
} {
  const [a, b, c, d] = vertices

  const norm = new Vector3(0, 0, 0)
  const norm2 = new Vector3(0, 0, 0)

  const triangle = new Triangle(a, b, c)
  triangle.getNormal(norm)

  const isQuad = (flags & ArxPolygonFlags.Quad) !== 0

  if (isQuad) {
    const triangle2 = new Triangle(d, c, b)
    triangle2.getNormal(norm2)
  }

  return { norm, norm2 }
}

export type GeometryVertex = {
  idx: number
  vector: Vector3
}

/**
 * Gets the non-indexed version of vertices of a geometry.
 * Should be used when converting it to Arx polygon data as Arx uses non-indexed geometry.
 */
function getNonIndexedVertices(geometry: BufferGeometry): GeometryVertex[] {
  const vertices: GeometryVertex[] = []

  const index = geometry.getIndex()
  const coords = geometry.getAttribute('position') as BufferAttribute

  if (index === null) {
    // non-indexed geometry, all vertices are unique
    for (let idx = 0; idx < coords.count; idx++) {
      vertices.push({
        idx,
        vector: new Vector3(coords.getX(idx), coords.getY(idx), coords.getZ(idx)),
      })
    }
  } else {
    // indexed geometry, has shared vertices
    for (let i = 0; i < index.count; i++) {
      const idx = index.getX(i)
      vertices.push({
        idx,
        vector: new Vector3(coords.getX(idx), coords.getY(idx), coords.getZ(idx)),
      })
    }
  }

  return vertices
}

function roundToNDecimals(decimals: number, x: number): number {
  return Math.round(x * 10 ** decimals) / 10 ** decimals
}

/**
 * Recursively applies the rotation and other transformations to geometries,
 * meaning if the mesh has its position set to 0/0/4, then add that vector to
 * every polygon's vertex in the geometry and reset the position to 0/0/0
 */
export function applyTransformations(threeJsObj: Object3D): void {
  threeJsObj.updateMatrix()

  if (threeJsObj instanceof Mesh) {
    ;(threeJsObj.geometry as BufferGeometry).applyMatrix4(threeJsObj.matrix)
  }

  threeJsObj.children.forEach((child) => {
    child.applyMatrix4(threeJsObj.matrix)
    applyTransformations(child)
  })

  threeJsObj.position.set(0, 0, 0)
  threeJsObj.rotation.set(0, 0, 0)
  threeJsObj.scale.set(1, 1, 1)
  threeJsObj.updateMatrix()
}

function flipUVVertically(vertices: QuadrupleOf<ArxVertex>): void {
  const [a, b, c, d] = vertices

  a.v = -a.v
  b.v = -b.v
  c.v = -c.v
  d.v = -d.v
}

function normalizeUV(vertices: QuadrupleOf<ArxVertex>): void {
  let correctedU = false
  let correctedV = false

  vertices.forEach((vertex) => {
    let { u, v } = vertex

    if (u < 0) {
      if (u % 1 === 0) {
        u = 0
        correctedU = true
      } else {
        u = 1 + (u % 1)
      }
    } else if (u > 1) {
      u = u % 1
    } else if (correctedU) {
      u = 1
    }

    if (v < 0) {
      if (v % 1 === 0) {
        v = 0
        correctedV = true
      } else {
        v = 1 + (v % 1)
      }
    } else if (v > 1) {
      v = v % 1
    } else if (correctedV) {
      v = 1
    }

    vertex.u = u
    vertex.v = v
  })
}

function toArxData(): { fts: ArxFTS; dlf: ArxDLF; llf: ArxLLF } {
  const now = Math.floor(Date.now() / 1000)
  const generatorId = `Arx Fatalis Browser Editor - v1.0.0`

  const levelIdx = 1

  const player = {
    position: { x: 0, y: -180, z: 0 }, // 0/0/0 + adjustToPlayerHeight()
    orientation: { a: 0, b: 0, g: 0 },
  }

  const config = {
    offset: { x: 6000, y: 0, z: 6000 },
  }

  const polygonData: ArxPolygon[] = group.children
    .filter((threeJsObj: Object3D) => {
      return threeJsObj instanceof Mesh
    })
    .map((threeJsObj: Mesh) => {
      const tmp = threeJsObj.clone()

      // https://discourse.threejs.org/t/how-to-perform-a-deep-clone-of-a-scene/5408/3
      tmp.traverse((o: Object3D) => {
        if (o instanceof Mesh) {
          const x = o.geometry as BufferGeometry
          o.geometry = x.clone()
        }
      })

      applyTransformations(tmp)

      return tmp
    })
    .map((threeJsObj: Mesh) => {
      const { geometry } = threeJsObj

      const uvs = geometry.getAttribute('uv') as BufferAttribute

      const vertexPrecision = 10

      const flags: ArxPolygonFlags = ArxPolygonFlags.Quad
      const [a, b, c, d, e, f] = getNonIndexedVertices(geometry).map(({ idx, vector }) => {
        return {
          x: config.offset.x + roundToNDecimals(vertexPrecision, vector.x),
          y: config.offset.y - roundToNDecimals(vertexPrecision, vector.y),
          z: config.offset.z - roundToNDecimals(vertexPrecision, vector.z),
          u: uvs.getX(idx),
          v: uvs.getY(idx),
        }
      })

      // const vertices = [c, e, a, b] as QuadrupleOf<ArxVertex>
      const vertices = [a, b, c, e] as QuadrupleOf<ArxVertex>
      flipUVVertically(vertices)
      normalizeUV(vertices)

      const { norm, norm2 } = calculateNormals({
        vertices: vertices.map(({ x, y, z }) => {
          return new Vector3(x, y, z)
        }) as QuadrupleOf<Vector3>,
        flags,
      })

      return {
        vertices,
        norm,
        norm2,
        textureContainerId: 1,
        flags,
        transval: 0,
        area: 10_000,
        room: 1,
      }
    })

  const textureContainers: ArxTextureContainer[] = [
    {
      id: 1,
      filename: 'l1_prison_[stone]_ground19.jpg',
    },
  ]

  const todo = {
    uniqueHeaders: [],
    cells: times(() => {
      return {}
    }, MAP_DEPTH_IN_CELLS * MAP_WIDTH_IN_CELLS),
    anchors: [],
    rooms: calculateRoomData(polygonData),
    roomDistances: [
      {
        distance: -1,
        startPosition: { x: 0, y: 0, z: 0 },
        endPosition: { x: 1, y: 0, z: 0 },
      },
      {
        distance: -1,
        startPosition: { x: 0, y: 0, z: 0 },
        endPosition: { x: 0, y: 1, z: 0 },
      },
      {
        distance: -1,
        startPosition: { x: 0.984_375, y: 0.984_375, z: 0 },
        endPosition: { x: 0, y: 0, z: 0 },
      },
      {
        distance: -1,
        startPosition: { x: 0, y: 0, z: 0 },
        endPosition: { x: 0, y: 0, z: 0 },
      },
    ],
  }

  // ----

  const dlf: ArxDLF = {
    header: {
      lastUser: generatorId,
      time: now,
      posEdit: player.position,
      angleEdit: player.orientation,
      numberOfBackgroundPolygons: polygonData.length,
    },
    scene: {
      levelIdx,
    },
    interactiveObjects: [],
    fogs: [],
    paths: [],
    zones: [],
  }

  // -- eddig oké --

  const fts: ArxFTS = {
    header: {
      levelIdx,
    },
    uniqueHeaders: todo.uniqueHeaders,
    sceneHeader: {
      mScenePosition: config.offset,
    },
    cells: todo.cells,
    anchors: todo.anchors,
    portals: [],
    rooms: todo.rooms,
    roomDistances: todo.roomDistances,
    polygons: polygonData,
    textureContainers,
  }

  const llf: ArxLLF = {
    header: {
      lastUser: generatorId,
      time: now,
      numberOfBackgroundPolygons: polygonData.length,
    },
    colors: polygonData.flatMap(({ vertices }) => {
      return times(() => {
        return { r: 255, g: 255, b: 255, a: 1 }
      }, vertices.length)
    }),
    lights: [],
  }

  return { fts, dlf, llf }
}

function compile({ fts, dlf, llf }: { fts: ArxFTS; dlf: ArxDLF; llf: ArxLLF }): {
  rawLlf: ArrayBuffer
  rawDlf: ArrayBuffer
  rawFts: ArrayBuffer
} {
  const llfData = LLF.save(llf)
  const { total: llfHeaderSize } = getHeaderSize(llfData, 'llf')
  const [llfHeader, llfBody] = sliceArrayBufferAt(llfData, llfHeaderSize)
  const rawLlf = concatArrayBuffers([llfHeader, implode(llfBody, 'binary', 'large')])

  const dlfData = DLF.save(dlf)
  const { total: dlfHeaderSize } = getHeaderSize(dlfData, 'dlf')
  const [dlfHeader, dlfBody] = sliceArrayBufferAt(dlfData, dlfHeaderSize)
  const rawDlf = concatArrayBuffers([dlfHeader, implode(dlfBody, 'binary', 'large')])

  const ftsData = FTS.save(fts, true)
  const { total: ftsHeaderSize } = getHeaderSize(ftsData, 'fts')
  const [ftsHeader, ftsBody] = sliceArrayBufferAt(ftsData, ftsHeaderSize)
  const rawFts = concatArrayBuffers([ftsHeader, implode(ftsBody, 'binary', 'large')])

  return { rawLlf, rawDlf, rawFts }
}

// -----------------

document.getElementById('show-grid')?.addEventListener('change', (e) => {
  const checkbox = e.target as HTMLInputElement

  if (checkbox.checked) {
    addGrid()
  } else {
    removeGrid()
  }
})

document.getElementById('show-player')?.addEventListener('change', (e) => {
  const checkbox = e.target as HTMLInputElement

  if (checkbox.checked) {
    addPlayerMarkerBody()
    addPlayerMarkerFace()
  } else {
    removePlayerMarkerBody()
    removePlayerMarkerFace()
  }
})

document.getElementById('download')?.addEventListener('click', async () => {
  const { fts, dlf, llf } = toArxData()
  const { rawFts, rawDlf, rawLlf } = compile({ fts, dlf, llf })

  const zip = new JSZip()

  zip.file('game/graph/levels/level1/fast.fts', rawFts)
  zip.file('graph/levels/level1/level1.dlf', rawDlf)
  zip.file('graph/levels/level1/level1.llf', rawLlf)

  const zipContents = await zip.generateAsync({ type: 'blob' })

  downloadBinaryAs(`arx-fatalis-generated-map`, zipContents, MimeTypes.ZIP)
})

window.addEventListener('focus', handleFocus)
window.addEventListener('blur', handleBlur)

// -----------

setupOrbitControls()

addGeometry()

if ((document.getElementById('show-grid') as HTMLInputElement).checked) {
  addGrid()
}

if ((document.getElementById('show-player') as HTMLInputElement).checked) {
  addPlayerMarkerBody()
  addPlayerMarkerFace()
}

animate()

const lastMousePos = new Vector2(0, 0)

canvas.addEventListener('mousedown', (e) => {
  if (!didLeftMouseButtonTriggerTheEvent(e)) {
    return
  }

  lastMousePos.x = e.clientX
  lastMousePos.y = e.clientY
})

canvas.addEventListener('mouseup', (e) => {
  if (!didLeftMouseButtonTriggerTheEvent(e)) {
    return
  }

  const currentMousePos = new Vector2(e.clientX, e.clientY)
  if (!currentMousePos.equals(lastMousePos)) {
    return
  }

  addGeometry(new Vector3(randomIntBetween(-500, 500), 0, randomIntBetween(-500, 500)))
})
