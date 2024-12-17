import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import dotenv from 'dotenv'
import path from 'path';
dotenv.config()
const env = loadEnv('development', process.cwd(), '')

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        SUPABASE_URL: `"${env.API_EXTERNAL_URL}"`,
        SUPABASE_KEY: `"${env.SERVICE_ROLE_KEY}"`
    },
    plugins: [
        vue(),
        vuetify({
            autoImport: true,
            styles: { configFile: 'src/scss/variables.scss' }
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            'apextree': path.resolve(__dirname, 'node_modules/apextree/apextree.min.js'),
            'vue': 'vue/dist/vue.esm-bundler.js'
        }
    },
    css: {
        preprocessorOptions: {
            scss: {}
        }
    },
    optimizeDeps: {
        exclude: ['vuetify'],
        entries: ['./src/**/*.vue']
    },
    server: {
        proxy: {
            '/query': {
                target: 'http://localhost:8005',
                changeOrigin: true,
            },
            '/retrieve': {
                target: 'http://localhost:8005',
                changeOrigin: true,
            },
            '/complete': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/vision-complete': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/process-db-schema': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/drop-process-table': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/process-search': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/vision-process-search': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            }
        }
    }
    // build: {
    //     rollupOptions: {
    //         treeshake:  false 
    //     }
    // },
});
