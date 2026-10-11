/**
 * 生成记录 ID。
 *
 * 不用自增数字：导入时要按 id 合并两台设备的数据，自增必然撞号。
 *
 * 也不能直接调 crypto.randomUUID()——它要求安全上下文（HTTPS 或 localhost），
 * 在局域网 http://192.168.x.x 下会直接抛错。开发阶段要用手机连本地服务器测试，
 * 所以这里必须带兜底。
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
