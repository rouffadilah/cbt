import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/cbt/', // TAMBAHKAN BARIS INI! Sesuaikan dengan nama repository GitHub Anda
})