import { useState } from 'react'
import { probe, TmdbError } from '../tmdb/client'
import {
  DEFAULT_API_BASE,
  DEFAULT_IMAGE_BASE,
  TMDB_DEFAULTS,
  canRequest,
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
            <span className="opacity-70"> · 走中转站时留空</span>
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

        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <button
            type="button"
            disabled={busy || !canRequest(cfg)}
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
          {!canRequest(cfg) && (
            <span className="text-meta text-muted">
              先填上面的 Key，或展开高级设置填中转站地址
            </span>
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

      <p className="text-meta mt-3 px-1 leading-relaxed text-muted">
        三种用法，挑一种：
      </p>
      <ul className="text-meta mt-1.5 space-y-2 px-1 leading-relaxed text-muted">
        <li>
          <strong className="text-ink-2">① 自己填 Key</strong>
          ：Key 只存在这台设备的浏览器里，不上传、不进仓库。但国内直连
          api.themoviedb.org 不通，需要整台设备挂代理。
        </li>
        <li>
          <strong className="text-ink-2">② 用别人的中转站</strong>
          ：展开下面的高级设置，把「API 地址」和「图片地址」换成对方给的
          两个地址，Key 留空。
          <strong className="text-ink-2">不用自己申请 Key，也不用挂代理。</strong>
        </li>
        <li>
          <strong className="text-ink-2">③ 自己搭中转站</strong>
          ：仓库里的 <code className="text-ink-2">worker/tmdb-proxy.js</code>
          就是一个 Cloudflare Worker，部署后把地址分享出去，别人也能免 Key 免代理。
        </li>
      </ul>
    </>
  )
}
