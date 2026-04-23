import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const distDir = path.resolve(__dirname, '../../Chrome_wrk/extension/dist')

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: distDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat: path.resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'chat.js',
        assetFileNames: 'chat[extname]'
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})