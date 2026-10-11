import { describe, expect, it } from 'vitest'
import {
  TMDB_DEFAULTS,
  canRequest,
  usingCustomApiBase,
  type TmdbConfig,
} from './settings'

const cfg = (patch: Partial<TmdbConfig>): TmdbConfig => ({
  ...TMDB_DEFAULTS,
  ...patch,
})

describe('usingCustomApiBase', () => {
  it('默认地址不算自定义', () => {
    expect(usingCustomApiBase(cfg({}))).toBe(false)
  })

  it('末尾多个斜杠不影响判断', () => {
    expect(
      usingCustomApiBase(cfg({ apiBase: `${TMDB_DEFAULTS.apiBase}/` })),
    ).toBe(false)
  })

  it('指向中转站时算自定义', () => {
    expect(
      usingCustomApiBase(
        cfg({ apiBase: 'https://tmdb-proxy.daotuu1234.workers.dev/k7m2x9p4/api' }),
      ),
    ).toBe(true)
  })
})

describe('canRequest', () => {
  it('填了 Key 就可以', () => {
    expect(canRequest(cfg({ apiKey: 'abc123' }))).toBe(true)
  })

  it('什么都没配就不行', () => {
    expect(canRequest(cfg({ apiKey: '' }))).toBe(false)
  })

  // ⚠️ 这条对应真实场景：朋友用中转站，Key 留空
  it('没 Key 但配了中转站地址，可以', () => {
    expect(
      canRequest(
        cfg({
          apiKey: '',
          apiBase: 'https://tmdb-proxy.daotuu1234.workers.dev/k7m2x9p4/api',
          imageBase: 'https://tmdb-proxy.daotuu1234.workers.dev/k7m2x9p4/img',
        }),
      ),
    ).toBe(true)
  })

  it('Key 只有空格，等于没填', () => {
    expect(canRequest(cfg({ apiKey: '   ' }))).toBe(false)
  })
})
