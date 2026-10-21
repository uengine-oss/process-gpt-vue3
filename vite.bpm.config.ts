import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

// 일반 BPM 모드(PAL 아님)를 PAL 개발 서버(:5173)와 따로 띄우기 위한 설정.
// PAL 플래그는 package.json 의 dev:bpm 스크립트가 환경변수로 덮어쓴다.
// (vite.config.ts 의 dotenv.config() 가 .env 를 process.env 에 먼저 올리므로 .env.<mode> 로는 못 덮는다.)
// 두 dev 서버가 같은 의존성 캐시를 동시에 재최적화하며 충돌하지 않도록 cacheDir 를 분리한다.
export default mergeConfig(
    baseConfig,
    defineConfig({
        cacheDir: 'node_modules/.vite-bpm',
        server: {
            port: 8081,
            strictPort: true
        }
    })
);
