import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import dotenv from 'dotenv'
dotenv.config()

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        VITE_DB_URL: `"${process.env.VITE_DB_URL}"`, // wrapping in "" since it's a string
        VITE_DB_PW: `"${process.env.VITE_DB_PW}"`
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
            '@': fileURLToPath(new URL('./src', import.meta.url))
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
            '/complete': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/vision-complete': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/query': {
                target: 'http://localhost:8005',
                changeOrigin: true,
            },
            '/retrieve': {
                target: 'http://localhost:8005',
                changeOrigin: true,
            },
            '/process-db-schema': {
                target: 'http://localhost:8001',
                changeOrigin: true,
            },
            '/drop-process-table': {
                target: 'http://localhost:8001',
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
