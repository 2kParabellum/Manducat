import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // относительные пути: сборку можно открыть с любого адреса и завернуть в мобильное приложение
  build: { target: 'es2022' },
});
