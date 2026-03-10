import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Serve game/index.html for /game/ requests before SPA fallback intercepts them.
function gameEntryPlugin(): PluginOption {
  return {
    name: 'game-entry',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/game') && !req.url.includes('.')) {
          req.url = '/game/index.html'
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/game') && !req.url.includes('.')) {
          const filePath = resolve(__dirname, 'dist', 'game', 'index.html')
          res.setHeader('Content-Type', 'text/html')
          fs.createReadStream(filePath).pipe(res)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [gameEntryPlugin(), react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game/index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          news: ['./src/data/newsData.ts'],
          utils: ['./src/hooks/useScrollAnimation.ts'],
        },
      },
    },
  },
  publicDir: 'public',
  server: {
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
    },
  },
})
