import { implode } from 'node-pkware/simple'
import { DLF, LLF, FTS } from 'arx-convert'
import { type ArxLLF, type ArxDLF, type ArxFTS } from 'arx-convert/types'
import JSZip from 'jszip'
import { concatArrayBuffers, downloadBinaryAs, MimeTypes, times } from '@src/functions.js'

// -----------------

document.getElementById('download')?.addEventListener('click', async () => {
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
        filename: 'L1_PRISON_[STONE]_GROUND19.jpg',
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
