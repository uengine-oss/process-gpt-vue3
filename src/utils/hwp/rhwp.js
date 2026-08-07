/**
 * rhwp(@rhwp/core) 로더 — HWP/HWPX 를 브라우저에서 원본 그대로 렌더한다.
 *
 * WASM 이 7.2MB 라 앱 번들에 넣지 않고, 뷰어가 처음 열릴 때만 동적 import 한다.
 * 초기화는 앱 전체에서 한 번만 수행한다.
 */
import { repairHwp, browserCodec } from './hwp-repair.js';

let readyPromise = null;
let mod = null;

/** 지연 초기화. 여러 뷰어가 동시에 떠도 한 번만 로드된다. */
export function ensureRhwp() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
        // WASM 은 브라우저 폰트에 접근할 수 없어 줄바꿈·정렬 계산을 이 콜백에 의존한다.
        // init() 이전에 등록해야 한다.
        if (!globalThis.measureTextWidth) {
            let ctx = null;
            let lastFont = '';
            globalThis.measureTextWidth = (font, text) => {
                if (!ctx) ctx = document.createElement('canvas').getContext('2d');
                if (font !== lastFont) {
                    ctx.font = font;
                    lastFont = font;
                }
                return ctx.measureText(text).width;
            };
        }
        const [core, wasmUrl] = await Promise.all([
            import('@rhwp/core'),
            import('@rhwp/core/rhwp_bg.wasm?url').then((m) => m.default)
        ]);
        await core.default({ module_or_path: wasmUrl });
        mod = core;
        return core;
    })();
    return readyPromise;
}

const isHwpx = (b) => b[0] === 0x50 && b[1] === 0x4b;

/**
 * 렌더용 문서를 연다.
 *
 * rhwp 는 HWPX 를 직접 렌더할 때 그림 참조를 풀지 못해 **이미지를 통째로 누락**한다.
 * HWP 로 한 번 변환하고 보정을 거치면 이미지·그림 크기·머리말/꼬리말이 모두 살아난다.
 * 보정이 실패하면 원본으로 렌더한다(프리뷰가 아예 안 나오는 것보다 낫다).
 */
export async function openDocument(bytes) {
    const core = await ensureRhwp();
    const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    if (isHwpx(src)) {
        try {
            const raw = new core.HwpDocument(src).exportHwp();
            const { out } = await repairHwp(raw, browserCodec, { sourceHwpx: src });
            return new core.HwpDocument(out);
        } catch (e) {
            console.warn('[rhwp] HWP 경유 렌더 실패 — 원본으로 렌더합니다', e);
        }
    }
    return new core.HwpDocument(src);
}

export function getModule() {
    return mod;
}
