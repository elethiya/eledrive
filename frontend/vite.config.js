import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from root or current directory
  const env = {
    ...loadEnv(mode, '../', ''),
    ...loadEnv(mode, process.cwd(), ''),
  }

  const backendPort = env.PORT || '8080'
  const frontendPort = parseInt(env.FRONTEND_PORT || env.VITE_PORT || '5173', 10)

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
