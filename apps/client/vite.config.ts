import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // relative paths: the build can be opened from any URL and wrapped into a mobile app
  build: { target: 'es2022' },
});
