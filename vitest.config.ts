import { defineConfig } from 'vitest/config'

// 单独一份配置，刻意不加载 vite.config.ts——
// 那里面的 PWA 插件对纯函数测试毫无用处，只会拖慢启动。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
