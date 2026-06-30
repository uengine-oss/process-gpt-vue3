import { fileURLToPath, URL } from 'url';
import { createRequire } from 'module';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
const env = loadEnv('development', process.cwd(), '');

const require = createRequire(import.meta.url);
const monacoEditorPlugin = require('vite-plugin-monaco-editor').default || require('vite-plugin-monaco-editor');
const uengineGatewayTarget = env.VITE_UENGINE_GATEWAY_URL || 'http://127.0.0.1:8088';

function spaFallbackPlugin() {
    return {
        name: 'spa-fallback-definition-map',
        configureServer(server: any) {
            const handler = (req: any, res: any, next: any) => {
                const url = req.url?.split('?')[0] || '';
                const spaRoutes = ['/definition-map', '/bpmn-auto-layout-e2e'];
                if (req.method === 'GET' && spaRoutes.some((route) => url.startsWith(route))) {
                    req.url = '/index.html';
                }
                next();
            };
            server.middlewares.stack.unshift({ route: '', handle: handler });
        }
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        // SUPABASE_URL: `"${env.API_EXTERNAL_URL}"`,
        // SUPABASE_KEY: `"${env.SERVICE_ROLE_KEY}"`
    },
    plugins: [
        spaFallbackPlugin(),
        vue(),
        vuetify({
            autoImport: true,
            styles: { configFile: 'src/scss/variables.scss' }
        }),
        monacoEditorPlugin({
            languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html']
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            apextree: path.resolve(__dirname, 'node_modules/apextree/apextree.min.js'),
            '@fullcalendar/core': path.resolve(__dirname, 'node_modules/@fullcalendar/core'),
            vue: 'vue/dist/vue.esm-bundler.js',
            // Node.js 내장 모듈들을 빈 객체로 대체 (브라우저 환경에서 사용 불가)
            https: 'rollup-plugin-node-polyfills/polyfills/empty'
        }
    },
    css: {
        preprocessorOptions: {
            scss: {}
        }
    },
    optimizeDeps: {
        include: ['@fullcalendar/core'],
        exclude: ['vuetify'],
        entries: ['./src/**/*.vue']
    },
    server: {
        proxy: {
            '/query': {
                target: 'http://localhost:8005',
                changeOrigin: true
            },
            '/retrieve': {
                target: 'http://localhost:8005',
                changeOrigin: true
            },
            '/memento/': {
                target: 'http://localhost:8005',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/memento/, '')
            },
            '/complete': {
                // Windows에서 localhost가 IPv6(::1)로 붙으면서 WSL/Docker 리스너로 가는 경우가 있어 IPv4로 고정
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            // 임시저장(draft) 프로세스 실엔진 검증 + LLM 자동개선 (completion)
            '/validate-and-improve': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                timeout: 0,
                proxyTimeout: 0
            },
            '/vision-complete': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/process-db-schema': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/drop-process-table': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/process-search': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/vision-process-search': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/langchain-chat': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            // Work Assistant Agent API
            '/agent/': {
                // Windows에서 localhost가 IPv6(::1)로 붙으면서 WSL/Docker 리스너로 가는 경우가 있어 IPv4로 고정
                target: 'http://127.0.0.1:8008',
                changeOrigin: true,
                timeout: 0,
                proxyTimeout: 0,
                rewrite: (path) => path.replace(/^\/agent/, '')
            },
            // Agent Router API (per-agent pod warmup/proxy)
            '/agent-router/': {
                target: 'http://127.0.0.1:8001',
                changeOrigin: true,
                timeout: 0,
                proxyTimeout: 0,
                // agent-router는 자체적으로 /agent-router prefix를 지원한다.
                // 따라서 여기서는 /agent-router prefix만 제거해서 그대로 전달한다.
                // - /agent-router/<agentId>/warmup -> /<agentId>/warmup
                // - /agent-router/route -> /route
                // - (레거시) /agent-router/agents/<agentId>/... -> /agents/<agentId>/...
                rewrite: (path) => path.replace(/^\/agent-router/, '')
            },
            // DeepAgents Router API
            '/process-gpt-deepagents/': {
                target: 'http://127.0.0.1:8888',
                changeOrigin: true,
                timeout: 0,
                proxyTimeout: 0,
                rewrite: (path) => path.replace(/^\/process-gpt-deepagents/, '')
            },
            '/definition': {
                target: uengineGatewayTarget,
                changeOrigin: true,
                // '/definition' prefix 가 SPA 라우트 '/definitions/:id', '/definition-map' 까지 잡아
                // 브라우저 직접 진입 시 Spring 게이트웨이로 가 Whitelabel 500 이 나던 문제 수정:
                // HTML 네비게이션(text/html)은 프록시하지 않고 SPA(index.html)가 처리하게 우회한다.
                // (XHR/API 호출은 Accept 가 application/json·*/* 이라 그대로 게이트웨이로 간다.)
                bypass: (req) => {
                    const accept = req.headers && req.headers.accept ? String(req.headers.accept) : '';
                    if (req.method === 'GET' && accept.includes('text/html')) return '/index.html';
                    return undefined;
                }
            },
            '/version': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/versions': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/instance': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/instances': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/work-item': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/worklist': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/dry-run': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/start-and-complete': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/validate': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/test': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/download': {
                target: uengineGatewayTarget,
                changeOrigin: true
            },
            '/business-rules': {
                target: uengineGatewayTarget,
                changeOrigin: true
            }
        }
    },
    build: {
        rollupOptions: {
            // Node.js 내장 모듈들을 외부 모듈로 처리하여 번들에서 제외
            external: ['https'],
            output: {
                // 외부 모듈에 대한 globals 설정
                globals: {
                    https: '{}'
                }
            }
        }
    }
});
