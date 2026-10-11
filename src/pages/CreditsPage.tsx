import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/icons'

/**
 * 署名页。
 *
 * TMDB 的条款对署名有硬性规定，这个页面的排布是照着条款来的：
 *  ① 必须使用官方 logo，且**不得修改**颜色、比例、方向 —— 所以这里直接用
 *     从 themoviedb.org 下载的原文件，没有做任何重新着色。
 *  ② logo **不得比本应用自己的标识更显眼** —— 所以 Reelog 的图标和名称
 *     在页面最上方，尺寸也更大；TMDB 的 logo 在下方的从属区块里。
 *  ③ 必须放置声明原文："This product uses the TMDB API but is not endorsed
 *     or certified by TMDB."
 *  ④ 必须在 About / Credits 类页面里 —— 这就是这个页面存在的唯一理由。
 *  ⑤ 名称只能写 "TMDB" 或 "The Movie Database"，且回链指向 themoviedb.org。
 */
export default function CreditsPage() {
  const navigate = useNavigate()

  return (
    <div className="anim-slide-in min-h-full bg-canvas">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="flex items-center gap-1 px-2.5 pt-2 pb-2.5">
          <button
            type="button"
            aria-label="返回"
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-ink transition-opacity active:opacity-55"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <h1 className="text-title flex-1 text-ink">关于</h1>
        </div>
      </header>

      <div className="px-6 pt-9 pb-14">
        {/* —— 本应用自己的标识。必须比下面的 TMDB logo 更显眼。 —— */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="size-20 rounded-[1.25rem]"
          />
          <h2 className="text-display mt-4 text-ink">Reelog</h2>
          <p className="text-meta mt-1 text-muted">院线观影记录</p>
        </div>

        <hr className="my-9 border-line" />

        {/* —— TMDB 署名。放在从属位置，尺寸小于上方标识。 —— */}
        <section className="flex flex-col items-center text-center">
          <p className="text-meta text-muted">影片元数据与海报来自</p>

          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-block"
          >
            {/* 官方原文件，未做任何修改 */}
            <img
              src="/tmdb/square.svg"
              alt="The Movie Database (TMDB)"
              className="w-[104px]"
            />
          </a>

          <p className="text-meta mt-6 leading-relaxed text-ink-2">
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
          <p className="text-meta mt-2 leading-relaxed text-muted">
            本应用的影片数据与图片由 TMDB 提供，但未经 TMDB 认可或认证。
          </p>

          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-meta mt-5 inline-block text-accent"
          >
            themoviedb.org
          </a>
        </section>

        <hr className="my-9 border-line" />

        <section className="text-meta space-y-3 leading-relaxed text-muted">
          <p>
            Reelog 是一个<strong className="text-ink-2">个人非商业</strong>
            的开源项目，仅用于记录自己在影院看过的电影。
          </p>
          <p>
            所有观影记录与海报
            <strong className="text-ink-2">只存在你自己的设备上</strong>
            ，不上传到任何服务器，也没有账号体系。
          </p>
          <p className="pt-2">版本 0.1.0</p>
        </section>
      </div>
    </div>
  )
}
