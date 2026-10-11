/**
 * 生成 PWA 图标。
 *
 * 为什么不用 sharp / resvg：为了四个 PNG 装一个几十 MB 的原生依赖不划算。
 * PNG 的格式本身很简单（签名 + IHDR + IDAT + IEND），用 node:zlib 就能编码，
 * 图形用超采样抗锯齿手算。这样仓库里零图形依赖，图标也可复现。
 *
 * 用法：node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

// ---------- PNG 编码 ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // 每行前面要加一个 filter 字节（0 = None）
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 图形 ----------

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
]

const BG_TOP = hex('#1b1b24')
const BG_BOTTOM = hex('#0a0a0e')
const AMBER = hex('#fbbf24')
const HOLE = hex('#0a0a0e')

const lerp = (a, b, t) => a + (b - a) * t

/**
 * 单点采样。坐标与半径都用 [0,1] 归一化，跟尺寸无关。
 * 图形是「胶片盘」：琥珀色圆盘 + 中心孔 + 一圈孔。
 */
function sample(x, y, markScale) {
  // 背景：垂直渐变
  let r = lerp(BG_TOP[0], BG_BOTTOM[0], y)
  let g = lerp(BG_TOP[1], BG_BOTTOM[1], y)
  let b = lerp(BG_TOP[2], BG_BOTTOM[2], y)

  const cx = 0.5
  const cy = 0.5
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)

  // maskable 版本要把图形缩小，保证落在裁切安全区里
  const rReel = 0.3 * markScale
  if (dist > rReel) return [r, g, b]

  const rHole = 0.075 * markScale
  const rOrbit = 0.163 * markScale
  const rCenter = 0.055 * markScale

  // 中心孔
  if (dist < rCenter) return [...HOLE]

  // 一圈 5 个孔
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const hx = cx + Math.cos(a) * rOrbit
    const hy = cy + Math.sin(a) * rOrbit
    if (Math.hypot(x - hx, y - hy) < rHole) return [...HOLE]
  }

  r = AMBER[0]
  g = AMBER[1]
  b = AMBER[2]
  return [r, g, b]
}

/** 超采样抗锯齿：每个输出像素采 SS×SS 个子样本再平均 */
function render(size, markScale) {
  const SS = 4
  const buf = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          const c = sample(x, y, markScale)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = SS * SS
      const o = (py * size + px) * 4
      buf[o] = Math.round(r / n)
      buf[o + 1] = Math.round(g / n)
      buf[o + 2] = Math.round(b / n)
      buf[o + 3] = 255
    }
  }

  return encodePng(size, size, buf)
}

// ---------- 输出 ----------

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// 普通图标：图形占满一些，视觉上更有分量
// maskable：图形缩小到约 60%，因为系统可能裁掉外围 20% 半径
const targets = [
  ['icon-192.png', 192, 1.0],
  ['icon-512.png', 512, 1.0],
  ['apple-touch-icon-180.png', 180, 1.0],
  ['maskable-512.png', 512, 0.66],
]

for (const [name, size, scale] of targets) {
  const png = render(size, scale)
  writeFileSync(resolve(outDir, name), png)
  console.log(`✓ ${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`)
}

console.log(`\n输出目录：${outDir}`)
