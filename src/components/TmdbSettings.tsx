import { useState } from 'react'
import { probe, TmdbError } from '../tmdb/client'
import {
  DEFAULT_API_BASE,
  DEFAULT_IMAGE_BASE,
  TMDB_DEFAULTS,
  loadTmdbConfig,
  saveTmdbConfig,
  usingCustomBase,
  type TmdbConfig,
} from '../tmdb/settings'

const fieldCls =
  'text-body w-full bg-transparent text-ink placeholder:text-muted focus:outline-none'

export default function TmdbSettings() {
  const [cfg, setCfg] = useState<TmdbConfig>(loadTmdbConfig())
  const [advanced, setAdvanced] = useState(() => usingCustomBase(cfg))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string }>()

  function update(patch: Partial<TmdbConfig>) {
    setCfg(saveTmdbConfig(patch))
  }

  async function test() {
    setBusy(true)
    setResult(undefined)
    try {
      await probe(cfg)
      setResult({ ok: true, text: '连接成功，可以搜索了。' })
    } catch (e) {
      setResult({
        ok: false,
        text: e instanceof TmdbError ? e.message : '连接失败',
      })
    } finally {
      setBusy(false)
    }
  }

  const overridden = usingCustomBase(cfg)

  return (
    <>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        <label className="block px-4 py-3.5">
          <span className="text-meta mb-2 block text-muted">
            API Key 或 Read Access Token
          </span>
          <input
            value={cfg.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder="粘贴 v3 的 API Key，或 v4 的 Read Access Token"
            autoComplete="off"
            spellCheck={false}
            className={fieldCls}
          />
        </label>

        <div className="px-4 py-3.5">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-meta text-accent"
          >
            {advanced ? '收起高级设置' : '高级设置（走代理时需要）'}
          </button>
          {overridden && !advanced && (
            <span className="text-meta ml-2 text-muted">· 已自定义地址</span>
          )}
        </div>

        {advanced && (
          <>
            <label className="block px-4 py-3.5">
              <span className="text-meta mb-2 block text-muted">API 地址</span>
              <input
                value={cfg.apiBase}
                onChange={(e) => update({ apiBase: e.target.value })}
                placeholder={DEFAULT_API_BASE}
                spellCheck={false}
                className={fieldCls}
              />
            </label>
            <label className="block px-4 py-3.5">
              <span className="text-meta mb-2 block text-muted">图片地址</span>
              <input
                value={cfg.imageBase}
                onChange={(e) => update({ imageBase: e.target.value })}
                placeholder={DEFAULT_IMAGE_BASE}
                spellCheck={false}
                className={fieldCls}
              />
            </label>
            <label className="block px-4 py-3.5">
              <span className="text-meta mb-2 block text-muted">返回语言</span>
              <input
                value={cfg.lang}
                onChange={(e) => update({ lang: e.target.value })}
                placeholder={TMDB_DEFAULTS.lang}
                spellCheck={false}
                className={fieldCls}
              />
            </label>
          </>
        )}

        <div className="flex gap-3 px-4 py-3.5">
          <button
            type="button"
            disabled={busy || !cfg.apiKey.trim()}
            onClick={test}
            className="text-meta rounded-md bg-surface-2 px-3 py-1.5 font-medium text-ink-2 transition-opacity active:opacity-55 disabled:opacity-40"
          >
            {busy ? '测试中…' : '测试连接'}
          </button>
          {overridden && (
            <button
              type="button"
              onClick={() =>
                update({
                  apiBase: DEFAULT_API_BASE,
                  imageBase: DEFAULT_IMAGE_BASE,
                })
              }
              className="text-meta text-muted"
            >
              恢复默认地址
            </button>
          )}
        </div>
      </div>

      {result && (
        <p
          className={`text-meta mt-2 px-1 leading-relaxed ${
            result.ok ? 'text-muted' : 'text-red-500'
          }`}
        >
          {result.text}
        </p>
      )}

      <p className="text-meta mt-2 px-1 leading-relaxed text-muted">
        Key 只存在这台设备的浏览器里，不会上传到任何地方，也不在仓库里。
        <br />
        <strong className="text-ink-2">连不上时</strong>
        ：国内直连 api.themoviedb.org 是不通的。整台设备挂代理后应该就能连；
        如果代理只监听某个端口、浏览器没走它，可以把上面的地址改成代理的转发地址
        —— 注意代理必须返回 CORS 头，否则浏览器会拦下请求。
      </p>
    </>
  )
}
