import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/test/**/*.test.{js,jsx,ts,tsx}'],
  },
})
