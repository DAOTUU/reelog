/** 把 data: URI 解析成 Blob。仅用于开发期的模拟海报，接入真实 TMDB 后不再需要。 */
export function dataUriToBlob(uri: string): Blob {
  const comma = uri.indexOf(',')
  if (comma < 0) throw new Error('不是合法的 data URI')

  const head = uri.slice(0, comma)
  const body = uri.slice(comma + 1)

  const mime = /^data:([^;,]+)/.exec(head)?.[1] ?? 'application/octet-stream'

  if (head.includes('base64')) {
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }

  // 非 base64 走百分号编码
  return new Blob([decodeURIComponent(body)], { type: mime })
}
