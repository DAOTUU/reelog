import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // prompt 而非 autoUpdate：不静默刷新，避免打断正在录入的表单
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Reelog — 院线观影记录',
        short_name: 'Reelog',
        description: '记录在影院看过的电影',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        // ⚠️ 必须为 standalone。minimal-ui 会让 PWA 跑在 Safari 里，
        // 受 ITP 的 7 天存储清理；standalone 跑在独立容器中则可豁免。
        // 依据：WebKit bug 232302，Apple 工程师 John Wilander 的官方回复。
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'portrait',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        // 刻意不注册任何 TMDB 相关的 runtimeCaching。
        // 应用运行时本就不请求 TMDB CDN（海报在添加时下载并本地转存），
        // 这里留空即是防御：缓存会掩盖网络已恢复的事实。
      },
      devOptions: { enabled: false },
    }),
  ],
})
