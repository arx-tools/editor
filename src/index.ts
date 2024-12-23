import { implode } from 'node-pkware/simple'
import { DLF, LLF, FTS } from 'arx-convert'
import { type ArxLLF, type ArxDLF, type ArxFTS } from 'arx-convert/types'
import JSZip from 'jszip'
import {
  concatArrayBuffers,
  distanceToFarthestBoundingBoxEdge,
  downloadBinaryAs,
  MimeTypes,
  times,
} from '@src/functions.js'
import {
  DirectionalLight,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  MeshPhongMaterial,
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

const defaultCameraPosition = new Vector3(50, 25, 100)
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

// -----------

const geometry = new PlaneGeometry(100, 100, 1, 1)
geometry.rotateX(MathUtils.degToRad(-90))

const texture = new TextureLoader().load('textures/l1_prison_[stone]_ground19.jpg')

const material = new MeshPhongMaterial({ map: texture })

const plane = new Mesh(geometry, material)
group.add(plane)

// -----------

scene.add(group)

const color = 0xff_ff_ff
const intensity = 3
const light = new DirectionalLight(color, intensity)
light.position.set(-1, 2, 4)
scene.add(light)

let controls: OrbitControls | undefined
let gizmo: ViewportGizmo | undefined

function render(): void {
  // if (controls !== undefined) {
  //   controls.update()
  // }

  renderer.render(scene, camera)

  if (gizmo !== undefined) {
    gizmo.render()
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

  /*
  controls.enableRotate = true
  controls.enablePan = true
  controls.enableZoom = true

  controls.enableDamping = true
  controls.dampingFactor = 0.1

  controls.minDistance = 100

  // disable the next line to allow looking under the 3D model
  controls.maxPolarAngle = Math.PI / 2

  controls.minZoom = 0.25
  controls.maxZoom = 2

  controls.autoRotate = false

  // how far the camera can be panned from the origin
  controls.maxTargetRadius = 100
  */

  gizmo = new ViewportGizmo(camera, renderer, { type: 'cube' })
  gizmo.attachControls(controls)
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

window.addEventListener('focus', handleFocus)
window.addEventListener('blur', handleBlur)

addGrid()
setupOrbitControls()
animate()

// -----------------

document.getElementById('download')?.addEventListener('click', async () => {
  // TODO: generate data based on contents of scene

  const now = Math.floor(Date.now() / 1000)

  // ----

  const llfData: ArxLLF = {
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

  const llf = LLF.save(llfData).buffer
  const rawLlf = implode(llf, 'binary', 'large')

  // ----

  const dlfData: ArxDLF = {
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

  const dlf = DLF.save(dlfData).buffer
  const dlfHeader = new Uint8Array(dlf).slice(0, 8520)
  const dlfBody = new Uint8Array(dlf).slice(8520)
  const rawDlf = concatArrayBuffers([dlfHeader, implode(dlfBody, 'binary', 'large')])

  // ----

  const ftsData: ArxFTS = {
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
        flags: 64,
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

  const fts = FTS.save(ftsData).buffer
  const ftsHeader = new Uint8Array(fts).slice(0, 280 + 768 * ftsData.uniqueHeaders.length)
  const ftsBody = new Uint8Array(fts).slice(280 + 768 * ftsData.uniqueHeaders.length)
  const rawFts = concatArrayBuffers([ftsHeader, implode(ftsBody, 'binary', 'large')])

  // ----

  const zip = new JSZip()

  zip.file('game/graph/levels/level1/fast.fts', rawFts)
  zip.file('graph/levels/level1/level1.dlf', rawDlf)
  zip.file('graph/levels/level1/level1.llf', rawLlf)

  const content = await zip.generateAsync({ type: 'blob' })
  downloadBinaryAs(`arx-fatalis-generated-map`, content, MimeTypes.ZIP)
})
