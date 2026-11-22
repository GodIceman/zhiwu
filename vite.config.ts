import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const deploymentBase = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: deploymentBase,
  // Keep the iOS minimum version aligned with this browser feature baseline.
  build: { target: ['chrome111', 'edge111', 'firefox114', 'safari16.4'] },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '知物',
        short_name: '知物',
        description: '本地优先的个人物品与订阅价值管理工具',
        lang: 'zh-CN',
        id: deploymentBase,
        theme_color: '#0f3f39',
        background_color: '#eff3ef',
        display: 'standalone',
        orientation: 'portrait',
        start_url: deploymentBase,
        scope: deploymentBase,
        icons: [
          {
            src: `${deploymentBase}zhiwu-icon.png`,
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
