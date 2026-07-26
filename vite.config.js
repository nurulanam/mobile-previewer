import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset URLs. Render (and any static host) serves this app from the
  // domain root, but './' also keeps it working if it's ever published under a
  // sub-path such as GitHub Pages. Safe here because there's a single HTML
  // entry point and no client-side routing.
  base: './',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
  },
})
