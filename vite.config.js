export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://xexus.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})