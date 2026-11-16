import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite monta o front (npm start / npm run build) e o Vitest roda os testes (npm test).
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }, // mesma porta de antes; a API libera CORS para ela
  preview: { port: 3000 },
  test: {
    include: ['src/**/*.test.{js,jsx}'], // a API tem os próprios testes (node --test, em api/)
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    css: false,
  },
});
