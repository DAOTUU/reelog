/**
 * Reelog 的 TMDB 中转站（Cloudflare Worker）
 *
 * 解决两件事：
 *   ① 国内直连 api.themoviedb.org 被 DNS 污染、image.tmdb.org 被 TLS 拦截，
 *      而 Cloudflare 的服务器在墙外，能正常访问 TMDB。
 *   ② API Key 放在服务端，使用它的人（朋友）不需要自己申请 Key。
 *
 * 路由：
 *   GET /<口令>/api/search/movie?query=...  →  api.themoviedb.org/3/search/movie?query=...
 *   GET /<口令>/img/w342/abc.jpg            →  image.tmdb.org/t/p/w342/abc.jpg
 *
 * 环境变量：
 *   TMDB_KEY     必填。v3 API Key（32 位十六进制）或 v4 Read Access Token（eyJ 开头）。
 *   PATH_SECRET  可选，但强烈建议填。填了之后，请求路径必须以 /<口令> 开头，
 *                否则一律返回 404。这样即使 URL 被别人看到，不知道口令也用不了。
 *
 * 部署：Cloudflare 后台 → Workers → 新建 → 粘贴本文件 → 设环境变量 → 部署。
 *
 * ⚠️ 部署完**一定要绑一个自定义域名**，否则国内用不了。
 *
 * Cloudflare 默认给的 *.workers.dev 域名在国内是被墙的（实测连接超时）。
 * 把 Worker 绑到你自己的域名下就好了：
 *   Worker → 设置 → 域和路由 → 添加 → 自定义域 → 填 tmdb.你的域名
 * Cloudflare 会自动建解析记录 + 签证书，几分钟生效。实测 0.9 秒响应。
 *
 * 注意 *.pages.dev 是通的，不通的只有 *.workers.dev —— 两个域名别混为一谈。
 */

const TMDB_API_ORIGIN = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org/t/p'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
}

const json = (body, status, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  })

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: '只支持 GET / HEAD' }, 405)
    }

    const url = new URL(request.url)

    if (!env.TMDB_KEY) {
      return json({ error: '服务端没配 TMDB_KEY 环境变量' }, 500)
    }

    // ---- 口令校验 ----
    // 不设 PATH_SECRET 时跳过（不推荐，但方便本地先试通）
    let path = url.pathname
    const secret = (env.PATH_SECRET || '').trim()
    if (secret) {
      const prefix = `/${secret}`
      if (!path.startsWith(`${prefix}/`)) {
        // 故意返回 404 而不是 403：不告诉对方"这里有个受保护的服务"
        return new Response('Not found', { status: 404, headers: CORS })
      }
      path = path.slice(prefix.length)
    }

    if (path.startsWith('/api/')) {
      return proxyApi(path, url, env, request.method)
    }
    if (path.startsWith('/img/')) {
      return proxyImage(path, env, request.method)
    }

    return json({ error: '路径不对。接口是 /api/*，图片是 /img/*' }, 404)
  },
}

/** 转发 TMDB 接口。Key 由服务端注入，忽略客户端带的一切凭据。 */
async function proxyApi(path, url, env, method) {
  // /api/search/movie → /search/movie
  const target = new URL(TMDB_API_ORIGIN + path.slice('/api'.length))

  // 透传查询参数，但**先剔除客户端可能带的 api_key**——
  // 一律用服务端自己的 Key，避免有人拿它当跳板用自己的 Key。
  for (const [k, v] of url.searchParams) {
    if (k !== 'api_key') target.searchParams.set(k, v)
  }

  const key = env.TMDB_KEY.trim()
  const headers = new Headers({ accept: 'application/json' })

  if (key.startsWith('eyJ')) {
    // v4 Read Access Token 走 Bearer 头
    headers.set('Authorization', `Bearer ${key}`)
  } else {
    // v3 API Key 走查询参数
    target.searchParams.set('api_key', key)
  }

  const res = await fetch(target.toString(), { method, headers })

  return new Response(method === 'HEAD' ? null : res.body, {
    status: res.status,
    headers: {
      ...CORS,
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

/** 转发海报图床。 */
async function proxyImage(path, env, method) {
  // /img/w342/abc.jpg → /w342/abc.jpg
  const target = TMDB_IMAGE_ORIGIN + path.slice('/img'.length)

  const res = await fetch(target, {
    method,
    // 图片可以缓存在 Cloudflare 边缘，减少回源。
    // TMDB 条款禁止缓存其内容超过 6 个月，这里的边缘缓存是短期的，不违反。
    cf: { cacheTtl: 86400, cacheEverything: true },
  })

  return new Response(method === 'HEAD' ? null : res.body, {
    status: res.status,
    headers: {
      ...CORS,
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
