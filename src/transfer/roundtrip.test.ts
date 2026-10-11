import { zip } from 'fflate'
import { describe, expect, it } from 'vitest'
import { parseBackupZip } from './import'
import { BACKUP_FORMAT, BACKUP_VERSION, extFromMime, type BackupFile } from './schema'

/**
 * 导出包格式的往返测试。
 *
 * 合并算法单独测了，但「打出来的包能不能解回去」是另一回事——
 * 文件名、扩展名推导、mimeType 这些接缝处的错误同样会静默丢数据，
 * 而且通常要等到换设备那天才发现。
 */

function zipToBlob(entries: Record<string, Uint8Array>): Promise<Blob> {
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => {
      if (err) reject(err)
      else resolve(new Blob([data as BlobPart], { type: 'application/zip' }))
    })
  })
}

const sampleBackup = (): BackupFile => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: 1728000000000,
  records: [
    {
      id: 'r1',
      tmdbId: 693134,
      title: '沙丘 2',
      year: 2024,
      posterKey: 'r1',
      watchedOn: '2026-09-27',
      cinema: '万达影城',
      hallFormat: 'IMAX',
      versionType: '原版字幕',
      rating: 5,
      review: '',
      rewatchCount: 1,
      createdAt: 1,
      updatedAt: 2,
      deletedAt: null,
    },
  ],
  watchlist: [],
  posters: [
    { key: 'r1', mimeType: 'image/jpeg', width: 400, height: 600, file: 'posters/r1.jpg' },
  ],
})

describe('备份包往返', () => {
  it('能解回记录与海报', async () => {
    const backup = sampleBackup()
    const posterBytes = new Uint8Array([1, 2, 3, 4, 5])

    const blob = await zipToBlob({
      'data.json': new TextEncoder().encode(JSON.stringify(backup)),
      'posters/r1.jpg': posterBytes,
    })

    const parsed = await parseBackupZip(blob)

    expect(parsed.backup.records).toHaveLength(1)
    expect(parsed.backup.records[0].title).toBe('沙丘 2')
    expect(parsed.backup.records[0].rewatchCount).toBe(1)
    expect(parsed.posterBlobs.get('r1')).toBeDefined()
    expect(parsed.posterBlobs.get('r1')!.type).toBe('image/jpeg')
  })

  it('缺少 data.json 时给出可读的错误', async () => {
    const blob = await zipToBlob({ 'readme.txt': new TextEncoder().encode('hi') })
    await expect(parseBackupZip(blob)).rejects.toThrow(/data\.json/)
  })

  it('格式不匹配时拒绝', async () => {
    const blob = await zipToBlob({
      'data.json': new TextEncoder().encode(JSON.stringify({ format: 'other' })),
    })
    await expect(parseBackupZip(blob)).rejects.toThrow(/格式不匹配/)
  })

  it('版本比应用新时拒绝，而不是尝试解析', async () => {
    const backup = { ...sampleBackup(), version: BACKUP_VERSION + 1 }
    const blob = await zipToBlob({
      'data.json': new TextEncoder().encode(JSON.stringify(backup)),
    })
    await expect(parseBackupZip(blob)).rejects.toThrow(/比当前应用支持的/)
  })

  it('海报文件缺失时记录仍能导入，只是没有图', async () => {
    const backup = sampleBackup()
    const blob = await zipToBlob({
      'data.json': new TextEncoder().encode(JSON.stringify(backup)),
      // 故意不放 posters/r1.jpg
    })
    const parsed = await parseBackupZip(blob)
    expect(parsed.backup.records).toHaveLength(1)
    expect(parsed.posterBlobs.size).toBe(0)
  })
})

describe('扩展名推导', () => {
  it('WebP 存为 .webp，JPEG 存为 .jpg', () => {
    expect(extFromMime('image/webp')).toBe('webp')
    expect(extFromMime('image/jpeg')).toBe('jpg')
  })

  // iOS Safari 的 canvas 没有 WebP 编码器，会静默返回 PNG。
  // 硬编码 .webp 会产出名实不符的文件。
  it('未知类型回退到 .bin 而不是猜', () => {
    expect(extFromMime('image/heic')).toBe('bin')
    expect(extFromMime('')).toBe('bin')
  })
})

