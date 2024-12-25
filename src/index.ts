import { getHeaderSize } from 'arx-header-size'
import { implode } from 'node-pkware/simple'
import { DLF, LLF, FTS } from 'arx-convert'
import { type ArxLLF, type ArxDLF, type ArxFTS, ArxPolygonFlags } from 'arx-convert/types'
import JSZip from 'jszip'
import {
  concatArrayBuffers,
  distanceToFarthestBoundingBoxEdge,
  downloadBinaryAs,
  MimeTypes,
  sliceArrayBufferAt,
  times,
} from '@src/functions.js'
import {
  AmbientLight,
  ArrowHelper,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  TextureLoader,
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

function addGeometry(): void {
  const geometry = new PlaneGeometry(100, 100, 1, 1)
  geometry.rotateX(MathUtils.degToRad(-90))

  const plane = new Mesh(geometry, l1PrisonStoneGround19Material)
  group.add(plane)
}

function generateMapData(): { fts: ArxFTS; dlf: ArxDLF; llf: ArxLLF } {
  const now = Math.floor(Date.now() / 1000)

  const llf: ArxLLF = {
    header: {
      lastUser: 'Arx Browser Editor',
      time: now,
      numberOfBackgroundPolygons: 1,
    },
    colors: [
      { r: 255, g: 255, b: 255, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 },
    ],
    lights: [],
  }

  // ----

  const dlf: ArxDLF = {
    header: {
      lastUser: 'Arx Browser Editor',
      time: now,
      posEdit: { x: 0, y: -180, z: 0 },
      angleEdit: { a: 0, b: 0, g: 0 },
      numberOfBackgroundPolygons: 1,
    },
    scene: {
      levelIdx: 1,
    },
    interactiveObjects: [],
    fogs: [],
    paths: [],
    zones: [],
  }

  // ----

  const fts: ArxFTS = {
    header: {
      levelIdx: 1,
    },
    uniqueHeaders: [],
    sceneHeader: {
      mScenePosition: { x: 6000, y: -170, z: 6000 },
    },
    cells: times(() => {
      return {}
    }, 160 * 160),
    anchors: [],
    portals: [],
    rooms: [
      {
        portals: [],
        polygons: [],
      },
      {
        portals: [],
        polygons: [
          {
            cellX: 60,
            cellY: 59,
            polygonIdx: 0,
          },
        ],
      },
    ],
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
    polygons: [
      {
        vertices: [
          { x: 6050, y: 0, z: 5950, u: 1, v: 1 },
          { x: 6050, y: 0, z: 6050, u: 1, v: 0 },
          { x: 5950, y: 0, z: 5950, u: 0, v: 1 },
          { x: 5950, y: 0, z: 6050, u: 0, v: 0 },
        ],
        norm: { x: 0, y: -1, z: 0 },
        norm2: { x: 0, y: -1, z: 0 },
        textureContainerId: 1,
        flags: ArxPolygonFlags.Quad,
        transval: 0,
        area: 10_000,
        room: 1,
      },
    ],
    textureContainers: [
      {
        id: 1,
        filename: 'l1_prison_[stone]_ground19.jpg',
      },
    ],
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
  const { fts, dlf, llf } = generateMapData()
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
