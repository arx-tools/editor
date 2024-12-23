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

export function times<T>(fn: (index: number) => T, repetitions: number): T[] {
  return Array.from({ length: repetitions }).map((value, index) => {
    return fn(index)
  })
}
