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
                const spaRoutes = ['/definition-map', '/bpmn-auto-layout-e2e', '/instancelist'];
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
            // Analytics(OLAP) 서비스. Spring Cloud Gateway 의 analytic 라우트와 동일하게
            // /api/analytics/** 를 analytic-service 로 보내고 /api/analytics prefix 를 /api 로 rewrite 한다.
            // (gateway application.yml: RewritePath=/api/analytics/?(?<segment>.*), /api/${segment})
            // dev 에서는 로컬 실행 중인 analytic backend(:8899)로 직접 프록시한다.
            '/api/analytics': {
                target: 'http://127.0.0.1:8899',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/analytics\/?/, '/api/')
            },
            // 인스턴스 실행 등 /completion/* 호출은 nginx 게이트웨이(:8088) 경유로.
            // nginx 가 /completion prefix 를 strip 해서 completion 서비스로 라우팅한다.
            // (반드시 아래 '/complete' 보다 먼저 매칭되도록 최상단에 둔다.)
            '/completion/': {
                target: 'http://127.0.0.1:8088',
                changeOrigin: true
            },
            // 인스턴스 자동분류 · Top List · 유사 인스턴스 API.
            // dev 에서는 서비스 published 포트(:8013)로 직접 프록시(게이트웨이 재기동 불필요).
            // 운영에서는 nginx 가 /instance-classifier prefix 를 strip 해 서비스로 라우팅한다.
            '/instance-classifier/': {
                target: 'http://127.0.0.1:8013',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/instance-classifier/, '')
            },
            // BSC 전략맵 · KPI · 이니셔티브 · 설문 (strategy 서비스).
            // dev 에서는 서비스 published 포트(:8014)로 직접 프록시.
            // 운영에서는 nginx 가 /strategy-service prefix 를 strip 해 서비스로 라우팅한다.
            '/strategy-service/': {
                target: 'http://127.0.0.1:8014',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/strategy-service/, '')
            },
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
                // 호스트 :8000 이 다른 프로젝트(ontology-studio python 백엔드)와 충돌하므로
                // nginx 게이트웨이(:8088)를 경유해 completion 으로 라우팅한다.
                target: 'http://127.0.0.1:8088',
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
