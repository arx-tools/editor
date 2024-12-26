import { Box3, type Mesh, type Quaternion, type Group } from 'three'

export enum MimeTypes {
  /**
   * TODO: find source that validates this
   */
  Binary = 'file/binary',
  PlainText = 'text/plain',
  /**
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml#application
   */
  ZIP = 'application/zip',
}

function downloadAs(filename: string, data: string): void {
  const link = document.createElement('a')
  link.setAttribute('href', data)
  link.setAttribute('download', filename)

  link.style.display = 'none'
  document.body.append(link)

  link.click()
  link.remove()
}

export function downloadTextAs(filename: string, data: string, mimeType: MimeTypes = MimeTypes.PlainText): void {
  const url = `data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`

  downloadAs(filename, url)
}

export function downloadBinaryAs(filename: string, data: string | ArrayBuffer | Blob, mimeType?: MimeTypes): void {
  let url: string
  if (mimeType === undefined) {
    url = URL.createObjectURL(new Blob([data]))
  } else {
    url = URL.createObjectURL(new Blob([data], { type: mimeType }))
  }

  downloadAs(filename, url)

  URL.revokeObjectURL(url)
}

/**
 * @see https://stackoverflow.com/a/49129872/1806628
 */
export function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 0) {
    return new ArrayBuffer(0)
  }

  const totalLength = buffers.reduce((sum, buffer) => {
    return sum + buffer.byteLength
  }, 0)

  const combinedBuffer = new Uint8Array(totalLength)

  let offset = 0
  buffers.forEach((buffer) => {
    combinedBuffer.set(new Uint8Array(buffer), offset)
    offset = offset + buffer.byteLength
  })

  return combinedBuffer.buffer
}

export function repeat<T>(value: T, repetitions: number): T[] {
  return Array.from({ length: repetitions }).map(() => {
    return value
  })
}

export function times<T>(fn: (index: number) => T, repetitions: number): T[] {
  return Array.from({ length: repetitions }).map((value, index) => {
    return fn(index)
  })
}

export function sliceArrayBufferAt(buffer: ArrayBuffer, at: number): [ArrayBuffer, ArrayBuffer] {
  const view = new Uint8Array(buffer)
  const left = view.slice(0, at).buffer
  const right = view.slice(at).buffer
  return [left, right]
}

/**
 * creates a random floating point number between a (inclusive) and b (exclusive)
 */
export function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

/**
 * creates a random integer between min and max (both inclusive)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
 */
export function randomIntBetween(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// --------------------------------------------------------

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button#value
 */
export enum MouseButtons {
  Left = 0,
  Middle = 1,
  Right = 2,
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons#value
 */
export enum MouseButtonPressed {
  None = 0,
  Left = 1 << 0,
  Right = 1 << 1,
  Middle = 1 << 2,
}

export function didLeftMouseButtonTriggerTheEvent(e: MouseEvent): boolean {
  return e.button === (MouseButtons.Left as number)
}

export function isLeftMouseButtonDown(e: MouseEvent): boolean {
  return (e.buttons & MouseButtonPressed.Left) > 0
}

// --------------------------------------------------------
// -------------------- three.js stuff --------------------
// --------------------------------------------------------

/**
 * case 1: if there are no geometries, then the `min` and `max` Vectors will contain `Infinity` as values.
 *
 * case 2: some weird edge case is happening inside `ThreeScene`'s watcher for `props.geometry` when
 * creating "disc extrusion die"s, which results in `min` and `max` Vectors containing `NaN` as values.
 *
 * @see https://github.com/mrdoob/three.js/issues/8175 - might be related to this very old issue, but it's not 100%
 *
 * both cases are covered by `Number.isFinite()`
 */
function isValidBox3({ min, max }: Box3): boolean {
  return (
    Number.isFinite(min.x) &&
    Number.isFinite(min.y) &&
    Number.isFinite(min.z) &&
    Number.isFinite(max.x) &&
    Number.isFinite(max.y) &&
    Number.isFinite(max.z)
  )
}

/**
 * @param object a Mesh or a Group of Meshes
 * @param orientation where the `object` is facing - needs to be specified like this as we can't calculate this from the
 * coordinates of the object
 */
export function getBoundingBox(object: Mesh | Group, orientation?: Quaternion): Box3 {
  const boundingBox = new Box3()

  // if `orientation` is specified, then we reverse the `object`'s orientation (on a clone, not on the original object)
  // so we get the same bounding box independent of orientation
  // this is needed because the bounding box cannot be rotated
  if (orientation !== undefined) {
    object = object.clone()
    object.applyQuaternion(orientation.clone().invert())
  }

  boundingBox.setFromObject(object)

  return boundingBox
}

export function distanceToFarthestBoundingBoxEdge(object: Mesh | Group, orientation?: Quaternion): number {
  const bbox = getBoundingBox(object, orientation)

  if (!isValidBox3(bbox)) {
    return 0
  }

  const { min, max } = bbox

  return Math.max(Math.abs(min.x), Math.abs(max.x), Math.abs(min.y), Math.abs(max.y), Math.abs(min.z), Math.abs(max.z))
}
