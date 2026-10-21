import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [vue(), vuetify({ autoImport: true })],
    resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
    optimizeDeps: { entries: ['e2e/process-editing/index.html'] },
    server: { host: '127.0.0.1', port: 8097, strictPort: true }
});
