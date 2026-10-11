/**
 * 合并两份数据。
 *
 * 这是整个项目里风险最高的一个函数：写错的后果是**静默丢数据**——
 * 界面一切正常，几个月后你才发现少了东西。所以它是纯函数，
 * 不碰数据库、不碰文件，只吃两个数组吐一个数组，便于单独测试。
 *
 * 核心原则：**只增不删，永不破坏性。**
 */

export type Mergeable = {
  id: string
  updatedAt: number
  deletedAt: number | null
}

export type MergeStats = {
  /** 本地没有，新增 */
  added: number
  /** 两边都有，导入方更新，覆盖了本地 */
  updated: number
  /** 两边都有，本地更新或一样，不动 */
  unchanged: number
  /** 覆盖发生时，被覆盖的内容和导入方确实不同（提示用，不阻塞） */
  overwritten: number
}

export type MergeResult<T> = {
  toPut: T[]
  stats: MergeStats
}

/**
 * 比较两条记录的「实质内容」是否相同。
 *
 * 两个坑：
 * ① 必须排除 updatedAt —— 进入覆盖分支的前提就是两边时间戳不同，
 *    把它算进去的话这个函数永远返回 false，「被覆盖」的统计就没意义了。
 * ② 必须做稳定序列化 —— JSON.stringify 的结果依赖键的顺序，
 *    而键顺序在不同写入路径下不保证一致。
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`

  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([k]) => k !== 'updatedAt')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  return `{${entries
    .map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`)
    .join(',')}}`
}

function sameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export function mergeCollections<T extends Mergeable>(
  local: T[],
  incoming: T[],
): MergeResult<T> {
  const byId = new Map(local.map((r) => [r.id, r]))
  const toPut: T[] = []
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0, overwritten: 0 }

  for (const inc of incoming) {
    const cur = byId.get(inc.id)

    // 本地没有 → 新增
    if (!cur) {
      toPut.push(inc)
      stats.added++
      continue
    }

    // 同 id 比 updatedAt，导入方更新才覆盖。
    // 相等时保留本地——避免同一份数据反复导入产生无意义的写入。
    if (inc.updatedAt > cur.updatedAt) {
      if (!sameContent(cur, inc)) stats.overwritten++
      toPut.push(inc)
      stats.updated++
    } else {
      stats.unchanged++
    }
  }

  // ⚠️ 注意：local 里存在、incoming 里没有的记录，一律保留。
  // 合并是并集，绝不能因为「导入包里没有」就删本地的东西。
  return { toPut, stats }
}

/**
 * 把 mergeCollections 的结果套用到本地数组上，得到合并后的完整集合。
 * 导入预览需要看「合并之后长什么样」才能查重，光看 toPut 不够。
 */
export function applyMerge<T extends Mergeable>(local: T[], toPut: T[]): T[] {
  const map = new Map(local.map((r) => [r.id, r]))
  for (const r of toPut) map.set(r.id, r)
  return [...map.values()]
}

/**
 * 疑似重复：同 tmdbId + 同观影日期，但 id 不同。
 *
 * 只做提示，**不自动合并**——两个不同影院看同一部片是合法情况，
 * 自动合并会误伤。让用户自己判断。
 */
export function findPotentialDuplicates<T extends Mergeable>(
  records: T[],
  getId: (r: T) => number | null,
  getDate: (r: T) => string,
): T[][] {
  const groups = new Map<string, T[]>()

  for (const r of records) {
    if (r.deletedAt) continue
    const tmdbId = getId(r)
    if (tmdbId === null) continue
    const key = `${tmdbId}@${getDate(r)}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  return [...groups.values()].filter((g) => g.length > 1)
}
