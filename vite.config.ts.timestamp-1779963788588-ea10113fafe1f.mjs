// vite.config.ts
import { fileURLToPath, URL } from "url";
import { createRequire } from "module";
import { defineConfig, loadEnv } from "file:///C:/Users/user/Desktop/ProcessGPT/process-gpt-vue3/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/user/Desktop/ProcessGPT/process-gpt-vue3/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vuetify from "file:///C:/Users/user/Desktop/ProcessGPT/process-gpt-vue3/node_modules/vite-plugin-vuetify/dist/index.js";
import dotenv from "file:///C:/Users/user/Desktop/ProcessGPT/process-gpt-vue3/node_modules/dotenv/lib/main.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\user\\Desktop\\ProcessGPT\\process-gpt-vue3";
var __vite_injected_original_import_meta_url = "file:///C:/Users/user/Desktop/ProcessGPT/process-gpt-vue3/vite.config.ts";
dotenv.config();
var env = loadEnv("development", process.cwd(), "");
var require2 = createRequire(__vite_injected_original_import_meta_url);
var monacoEditorPlugin = require2("vite-plugin-monaco-editor").default || require2("vite-plugin-monaco-editor");
function spaFallbackPlugin() {
  return {
    name: "spa-fallback-definition-map",
    configureServer(server) {
      const handler = (req, res, next) => {
        var _a;
        const url = ((_a = req.url) == null ? void 0 : _a.split("?")[0]) || "";
        if (req.method === "GET" && url.startsWith("/definition-map")) {
          req.url = "/index.html";
        }
        next();
      };
      server.middlewares.stack.unshift({ route: "", handle: handler });
    }
  };
}
var vite_config_default = defineConfig({
  define: {
    // SUPABASE_URL: `"${env.API_EXTERNAL_URL}"`,
    // SUPABASE_KEY: `"${env.SERVICE_ROLE_KEY}"`
  },
  plugins: [
    spaFallbackPlugin(),
    vue(),
    vuetify({
      autoImport: true,
      styles: { configFile: "src/scss/variables.scss" }
    }),
    monacoEditorPlugin({
      languageWorkers: ["editorWorkerService", "typescript", "json", "html"]
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      apextree: path.resolve(__vite_injected_original_dirname, "node_modules/apextree/apextree.min.js"),
      "@fullcalendar/core": path.resolve(__vite_injected_original_dirname, "node_modules/@fullcalendar/core"),
      vue: "vue/dist/vue.esm-bundler.js",
      // Node.js 내장 모듈들을 빈 객체로 대체 (브라우저 환경에서 사용 불가)
      https: "rollup-plugin-node-polyfills/polyfills/empty"
    }
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  },
  optimizeDeps: {
    include: ["@fullcalendar/core"],
    exclude: ["vuetify"],
    entries: ["./src/**/*.vue"]
  },
  server: {
    proxy: {
      "/query": {
        target: "http://localhost:8005",
        changeOrigin: true
      },
      "/retrieve": {
        target: "http://localhost:8005",
        changeOrigin: true
      },
      "/memento/": {
        target: "http://localhost:8005",
        changeOrigin: true,
        rewrite: (path2) => path2.replace(/^\/memento/, "")
      },
      "/complete": {
        // Windows에서 localhost가 IPv6(::1)로 붙으면서 WSL/Docker 리스너로 가는 경우가 있어 IPv4로 고정
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/vision-complete": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/process-db-schema": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/drop-process-table": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/process-search": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/vision-process-search": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/langchain-chat": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      // Work Assistant Agent API
      "/agent/": {
        // Windows에서 localhost가 IPv6(::1)로 붙으면서 WSL/Docker 리스너로 가는 경우가 있어 IPv4로 고정
        target: "http://127.0.0.1:8008",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path2) => path2.replace(/^\/agent/, "")
      },
      // Agent Router API (per-agent pod warmup/proxy)
      "/agent-router/": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        // agent-router는 자체적으로 /agent-router prefix를 지원한다.
        // 따라서 여기서는 /agent-router prefix만 제거해서 그대로 전달한다.
        // - /agent-router/<agentId>/warmup -> /<agentId>/warmup
        // - /agent-router/route -> /route
        // - (레거시) /agent-router/agents/<agentId>/... -> /agents/<agentId>/...
        rewrite: (path2) => path2.replace(/^\/agent-router/, "")
      },
      // DeepAgents Router API
      "/process-gpt-deepagents/": {
        target: "http://127.0.0.1:8888",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path2) => path2.replace(/^\/process-gpt-deepagents/, "")
      }
    }
  },
  build: {
    rollupOptions: {
      // Node.js 내장 모듈들을 외부 모듈로 처리하여 번들에서 제외
      external: ["https"],
      output: {
        // 외부 모듈에 대한 globals 설정
        globals: {
          https: "{}"
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXERlc2t0b3BcXFxcUHJvY2Vzc0dQVFxcXFxwcm9jZXNzLWdwdC12dWUzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx1c2VyXFxcXERlc2t0b3BcXFxcUHJvY2Vzc0dQVFxcXFxwcm9jZXNzLWdwdC12dWUzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy91c2VyL0Rlc2t0b3AvUHJvY2Vzc0dQVC9wcm9jZXNzLWdwdC12dWUzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAndXJsJztcclxuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ21vZHVsZSc7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSc7XHJcbmltcG9ydCB2dWV0aWZ5IGZyb20gJ3ZpdGUtcGx1Z2luLXZ1ZXRpZnknO1xyXG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5kb3RlbnYuY29uZmlnKCk7XHJcbmNvbnN0IGVudiA9IGxvYWRFbnYoJ2RldmVsb3BtZW50JywgcHJvY2Vzcy5jd2QoKSwgJycpO1xyXG5cclxuY29uc3QgcmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoaW1wb3J0Lm1ldGEudXJsKTtcclxuY29uc3QgbW9uYWNvRWRpdG9yUGx1Z2luID0gcmVxdWlyZSgndml0ZS1wbHVnaW4tbW9uYWNvLWVkaXRvcicpLmRlZmF1bHQgfHwgcmVxdWlyZSgndml0ZS1wbHVnaW4tbW9uYWNvLWVkaXRvcicpO1xyXG5cclxuZnVuY3Rpb24gc3BhRmFsbGJhY2tQbHVnaW4oKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6ICdzcGEtZmFsbGJhY2stZGVmaW5pdGlvbi1tYXAnLFxyXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXI6IGFueSkge1xyXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gKHJlcTogYW55LCByZXM6IGFueSwgbmV4dDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsPy5zcGxpdCgnPycpWzBdIHx8ICcnO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdHRVQnICYmIHVybC5zdGFydHNXaXRoKCcvZGVmaW5pdGlvbi1tYXAnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcS51cmwgPSAnL2luZGV4Lmh0bWwnO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMuc3RhY2sudW5zaGlmdCh7IHJvdXRlOiAnJywgaGFuZGxlOiBoYW5kbGVyIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBkZWZpbmU6IHtcclxuICAgICAgICAvLyBTVVBBQkFTRV9VUkw6IGBcIiR7ZW52LkFQSV9FWFRFUk5BTF9VUkx9XCJgLFxyXG4gICAgICAgIC8vIFNVUEFCQVNFX0tFWTogYFwiJHtlbnYuU0VSVklDRV9ST0xFX0tFWX1cImBcclxuICAgIH0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgc3BhRmFsbGJhY2tQbHVnaW4oKSxcclxuICAgICAgICB2dWUoKSxcclxuICAgICAgICB2dWV0aWZ5KHtcclxuICAgICAgICAgICAgYXV0b0ltcG9ydDogdHJ1ZSxcclxuICAgICAgICAgICAgc3R5bGVzOiB7IGNvbmZpZ0ZpbGU6ICdzcmMvc2Nzcy92YXJpYWJsZXMuc2NzcycgfVxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG1vbmFjb0VkaXRvclBsdWdpbih7XHJcbiAgICAgICAgICAgIGxhbmd1YWdlV29ya2VyczogWydlZGl0b3JXb3JrZXJTZXJ2aWNlJywgJ3R5cGVzY3JpcHQnLCAnanNvbicsICdodG1sJ11cclxuICAgICAgICB9KVxyXG4gICAgXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcclxuICAgICAgICAgICAgYXBleHRyZWU6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdub2RlX21vZHVsZXMvYXBleHRyZWUvYXBleHRyZWUubWluLmpzJyksXHJcbiAgICAgICAgICAgICdAZnVsbGNhbGVuZGFyL2NvcmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL0BmdWxsY2FsZW5kYXIvY29yZScpLFxyXG4gICAgICAgICAgICB2dWU6ICd2dWUvZGlzdC92dWUuZXNtLWJ1bmRsZXIuanMnLFxyXG4gICAgICAgICAgICAvLyBOb2RlLmpzIFx1QjBCNFx1QzdBNSBcdUJBQThcdUI0QzhcdUI0RTRcdUM3NDQgXHVCRTQ4IFx1QUMxRFx1Q0NCNFx1Qjg1QyBcdUIzMDBcdUNDQjQgKFx1QkUwQ1x1Qjc3Q1x1QzZCMFx1QzgwMCBcdUQ2NThcdUFDQkRcdUM1RDBcdUMxMUMgXHVDMEFDXHVDNkE5IFx1QkQ4OFx1QUMwMClcclxuICAgICAgICAgICAgaHR0cHM6ICdyb2xsdXAtcGx1Z2luLW5vZGUtcG9seWZpbGxzL3BvbHlmaWxscy9lbXB0eSdcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgY3NzOiB7XHJcbiAgICAgICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICAgICAgICBzY3NzOiB7fVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgICBpbmNsdWRlOiBbJ0BmdWxsY2FsZW5kYXIvY29yZSddLFxyXG4gICAgICAgIGV4Y2x1ZGU6IFsndnVldGlmeSddLFxyXG4gICAgICAgIGVudHJpZXM6IFsnLi9zcmMvKiovKi52dWUnXVxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICAgIHByb3h5OiB7XHJcbiAgICAgICAgICAgICcvcXVlcnknOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDUnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICcvcmV0cmlldmUnOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDUnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICcvbWVtZW50by8nOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDUnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL21lbWVudG8vLCAnJylcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgJy9jb21wbGV0ZSc6IHtcclxuICAgICAgICAgICAgICAgIC8vIFdpbmRvd3NcdUM1RDBcdUMxMUMgbG9jYWxob3N0XHVBQzAwIElQdjYoOjoxKVx1Qjg1QyBcdUJEOTlcdUM3M0NcdUJBNzRcdUMxMUMgV1NML0RvY2tlciBcdUI5QUNcdUMyQTRcdUIxMDhcdUI4NUMgXHVBQzAwXHVCMjk0IFx1QUNCRFx1QzZCMFx1QUMwMCBcdUM3ODhcdUM1QjQgSVB2NFx1Qjg1QyBcdUFDRTBcdUM4MTVcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgJy92aXNpb24tY29tcGxldGUnOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICcvcHJvY2Vzcy1kYi1zY2hlbWEnOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICcvZHJvcC1wcm9jZXNzLXRhYmxlJzoge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4MDAwJyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL3Byb2Nlc3Mtc2VhcmNoJzoge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4MDAwJyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL3Zpc2lvbi1wcm9jZXNzLXNlYXJjaCc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgJy9sYW5nY2hhaW4tY2hhdCc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gV29yayBBc3Npc3RhbnQgQWdlbnQgQVBJXHJcbiAgICAgICAgICAgICcvYWdlbnQvJzoge1xyXG4gICAgICAgICAgICAgICAgLy8gV2luZG93c1x1QzVEMFx1QzExQyBsb2NhbGhvc3RcdUFDMDAgSVB2Nig6OjEpXHVCODVDIFx1QkQ5OVx1QzczQ1x1QkE3NFx1QzExQyBXU0wvRG9ja2VyIFx1QjlBQ1x1QzJBNFx1QjEwOFx1Qjg1QyBcdUFDMDBcdUIyOTQgXHVBQ0JEXHVDNkIwXHVBQzAwIFx1Qzc4OFx1QzVCNCBJUHY0XHVCODVDIFx1QUNFMFx1QzgxNVxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4MDA4JyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDAsXHJcbiAgICAgICAgICAgICAgICBwcm94eVRpbWVvdXQ6IDAsXHJcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYWdlbnQvLCAnJylcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gQWdlbnQgUm91dGVyIEFQSSAocGVyLWFnZW50IHBvZCB3YXJtdXAvcHJveHkpXHJcbiAgICAgICAgICAgICcvYWdlbnQtcm91dGVyLyc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMScsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAwLFxyXG4gICAgICAgICAgICAgICAgcHJveHlUaW1lb3V0OiAwLFxyXG4gICAgICAgICAgICAgICAgLy8gYWdlbnQtcm91dGVyXHVCMjk0IFx1Qzc5MFx1Q0NCNFx1QzgwMVx1QzczQ1x1Qjg1QyAvYWdlbnQtcm91dGVyIHByZWZpeFx1Qjk3QyBcdUM5QzBcdUM2RDBcdUQ1NUNcdUIyRTQuXHJcbiAgICAgICAgICAgICAgICAvLyBcdUI1MzBcdUI3N0NcdUMxMUMgXHVDNUVDXHVBRTMwXHVDMTFDXHVCMjk0IC9hZ2VudC1yb3V0ZXIgcHJlZml4XHVCOUNDIFx1QzgxQ1x1QUM3MFx1RDU3NFx1QzExQyBcdUFERjhcdUIzMDBcdUI4NUMgXHVDODA0XHVCMkVDXHVENTVDXHVCMkU0LlxyXG4gICAgICAgICAgICAgICAgLy8gLSAvYWdlbnQtcm91dGVyLzxhZ2VudElkPi93YXJtdXAgLT4gLzxhZ2VudElkPi93YXJtdXBcclxuICAgICAgICAgICAgICAgIC8vIC0gL2FnZW50LXJvdXRlci9yb3V0ZSAtPiAvcm91dGVcclxuICAgICAgICAgICAgICAgIC8vIC0gKFx1QjgwOFx1QUM3MFx1QzJEQykgL2FnZW50LXJvdXRlci9hZ2VudHMvPGFnZW50SWQ+Ly4uLiAtPiAvYWdlbnRzLzxhZ2VudElkPi8uLi5cclxuICAgICAgICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hZ2VudC1yb3V0ZXIvLCAnJylcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gRGVlcEFnZW50cyBSb3V0ZXIgQVBJXHJcbiAgICAgICAgICAgICcvcHJvY2Vzcy1ncHQtZGVlcGFnZW50cy8nOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg4ODgnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgdGltZW91dDogMCxcclxuICAgICAgICAgICAgICAgIHByb3h5VGltZW91dDogMCxcclxuICAgICAgICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9wcm9jZXNzLWdwdC1kZWVwYWdlbnRzLywgJycpXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgICAgIC8vIE5vZGUuanMgXHVCMEI0XHVDN0E1IFx1QkFBOFx1QjRDOFx1QjRFNFx1Qzc0NCBcdUM2NzhcdUJEODAgXHVCQUE4XHVCNEM4XHVCODVDIFx1Q0M5OFx1QjlBQ1x1RDU1OFx1QzVFQyBcdUJDODhcdUI0RTRcdUM1RDBcdUMxMUMgXHVDODFDXHVDNjc4XHJcbiAgICAgICAgICAgIGV4dGVybmFsOiBbJ2h0dHBzJ10sXHJcbiAgICAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICAgICAgLy8gXHVDNjc4XHVCRDgwIFx1QkFBOFx1QjRDOFx1QzVEMCBcdUIzMDBcdUQ1NUMgZ2xvYmFscyBcdUMxMjRcdUM4MTVcclxuICAgICAgICAgICAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBodHRwczogJ3t9J1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpVixTQUFTLGVBQWUsV0FBVztBQUNwWCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFNBQVM7QUFDaEIsT0FBTyxhQUFhO0FBQ3BCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFVBQVU7QUFOakIsSUFBTSxtQ0FBbUM7QUFBNEssSUFBTSwyQ0FBMkM7QUFPdFEsT0FBTyxPQUFPO0FBQ2QsSUFBTSxNQUFNLFFBQVEsZUFBZSxRQUFRLElBQUksR0FBRyxFQUFFO0FB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
