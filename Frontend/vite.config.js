import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://localhost:8000'
  const port = parseInt(env.VITE_PORT || '5173', 10)

  return {
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      port,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'formik'],
    },
  }
})
