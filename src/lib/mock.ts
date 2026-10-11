import type { HallFormat, VersionType } from './constants'

/**
 * 生成一张占位海报（SVG data URI）。
 *
 * 真实应用里海报是加片时从 TMDB 下载、转码后存进 IndexedDB 的。这里用程序生成的
 * 渐变图代替，是为了在没有网络、没有真实数据的情况下也能看出设计效果。
 * 无海报时的真实占位逻辑与这里一致：不发起任何网络请求。
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function makePoster(title: string, hue: number): string {
  const h2 = (hue + 26) % 360
  const h3 = (hue + 54) % 360

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
<defs>
<linearGradient id="bg" x1="0.1" y1="0" x2="0.85" y2="1">
<stop offset="0%" stop-color="hsl(${hue},44%,31%)"/>
<stop offset="52%" stop-color="hsl(${h2},40%,16%)"/>
<stop offset="100%" stop-color="hsl(${h3},34%,8%)"/>
</linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.1" r="0.95">
<stop offset="0%" stop-color="hsl(${hue},74%,60%)" stop-opacity="0.5"/>
<stop offset="58%" stop-color="hsl(${hue},74%,60%)" stop-opacity="0.07"/>
<stop offset="100%" stop-color="hsl(${hue},74%,60%)" stop-opacity="0"/>
</radialGradient>
<linearGradient id="shade" x1="0" y1="0.42" x2="0" y2="1">
<stop offset="0%" stop-color="#000" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.58"/>
</linearGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/>
</filter>
</defs>
<rect width="300" height="450" fill="url(#bg)"/>
<rect width="300" height="450" fill="url(#glow)"/>
<rect width="300" height="450" fill="url(#shade)"/>
<rect width="300" height="450" filter="url(#grain)" opacity="0.07"/>
<rect x="26" y="366" width="34" height="2" fill="#fff" opacity="0.55"/>
<text x="26" y="404" font-family="PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif" font-size="31" font-weight="700" letter-spacing="1" fill="#fff" opacity="0.97">${esc(title)}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export type PreviewRecord = {
  id: string
  title: string
  originalTitle?: string
  year: number
  poster: string
  watchedOn: string
  cinema: string
  hallFormat: HallFormat
  versionType: VersionType
  rating: number
  review: string
  rewatchCount: number
}

type Seed = [
  title: string,
  original: string,
  year: number,
  hue: number,
  date: string,
  cinema: string,
  hall: HallFormat,
  version: VersionType,
  rating: number,
  rewatch: number,
  review: string,
]

const SEEDS: Seed[] = [
  ['沙丘 2', 'Dune: Part Two', 2024, 28, '2026-09-27', '万达影城·朝阳大悦城', 'IMAX', '原版字幕', 5, 1, '沙虫那段在 IMAX 里是真的震。第二次看反而更注意到声音设计。'],
  ['奥本海默', 'Oppenheimer', 2023, 8, '2026-09-13', '英皇电影城·合生汇', 'IMAX', '原版字幕', 4.5, 0, '三小时不觉得长。黑白和彩色切换的那几个点很妙。'],
  ['宇宙探索编辑部', '', 2023, 190, '2026-08-30', '保利国际影城·天安门店', '普通', '原版字幕', 5, 0, '年度最佳。伪纪录片拍法配这个题材，又荒诞又真诚。'],
  ['疯狂麦克斯：狂暴女神', 'Furiosa', 2024, 18, '2026-08-16', '横店电影城·王府井', '杜比影院', '原版字幕', 4, 0, '动作戏的节奏感还在，但不如狂暴之路那么一气呵成。'],
  ['默杀', '', 2024, 210, '2026-07-21', 'CGV影城·西单', '普通', '国语配音', 3.5, 0, '类型片该有的都有，就是收尾太满了。'],
  ['抓娃娃', '', 2024, 45, '2026-07-06', '万达影城·CBD', '普通', '国语配音', 4, 0, '笑是真好笑，但笑完有点不是滋味。'],
  ['热辣滚烫', '', 2024, 340, '2026-06-22', '大地影院·望京', '巨幕', '国语配音', 4, 0, '最后那场比赛拍得克制，反而是全片最有劲的地方。'],
  ['飞驰人生 2', '', 2024, 205, '2026-06-08', '博纳国际影城·悠唐', 'IMAX', '国语配音', 4.5, 1, '赛车戏的实拍质感太顶了。重看一遍专门盯车。'],
  ['周处除三害', '', 2023, 260, '2026-05-25', '首都电影院·西单', '普通', '原版字幕', 4, 0, '前半段和后半段像两部片子，但都好看。'],
  ['坠落的审判', 'Anatomie d’une chute', 2023, 155, '2026-05-11', '百老汇电影中心·当代MOMA', '普通', '原版字幕', 4.5, 0, '法庭戏全靠对话推进，居然一点不闷。'],
  ['哥斯拉大战金刚 2', 'Godzilla x Kong', 2024, 120, '2026-04-27', '万达影城·丰台', '4K', '原版字幕', 3, 0, '纯看特效，剧情可以当不存在。'],
  ['第二十条', '', 2024, 95, '2026-04-13', '耀莱成龙影城·五棵松', '普通', '国语配音', 3.5, 0, '喜剧外壳包裹的现实题材，力度比预期强。'],
]

export const PREVIEW_RECORDS: PreviewRecord[] = SEEDS.map((s, i) => ({
  id: `demo-${i}`,
  title: s[0],
  originalTitle: s[1] || undefined,
  year: s[2],
  poster: makePoster(s[0], s[3]),
  watchedOn: s[4],
  cinema: s[5],
  hallFormat: s[6],
  versionType: s[7],
  rating: s[8],
  rewatchCount: s[9],
  review: s[10],
}))
