/**
 * 화면에서 서명 URL 을 쓰기 위한 얇은 층.
 *
 * 왜 따로 있는가
 *   서명 URL 은 **비동기로만** 얻을 수 있는데 템플릿의 `:src` 는 동기다.
 *   그래서 "일단 비워 두고, 주소가 오면 다시 그린다" 가 필요하다.
 *   `signedSrc()` 가 그 역할을 한다 — 처음에는 `undefined`(속성 자체를 달지 않아
 *   깨진 이미지 아이콘이 뜨지 않는다)를 주고, 주소가 오면 반응형으로 바뀐다.
 *
 * 만료 처리
 *   서명 URL 은 1시간이다. 채팅처럼 하루 종일 열어 두는 화면에서는 그 사이에
 *   이미지가 죽는다. 그래서 5분마다 만료가 가까운 것을 지도에서 지운다.
 *   지우면 반응형으로 다시 그려지고, 그릴 때 새 주소를 받아 온다.
 *
 * 규칙은 `src/shared/storageUrl` 하나뿐이다. 판별(공개 URL 되돌리기 등)은
 * 전부 거기 있고 여기는 Vue 에 붙이는 일만 한다.
 */
import { reactive } from 'vue';

import { DEFAULT_BUCKET, parseStorageRef, resolveStorageUrl, SIGNED_URL_TTL_SECONDS } from '@/shared/storageUrl';

export { DEFAULT_BUCKET, parseStorageRef, resolveStorageUrl, SIGNED_URL_TTL_SECONDS };
export { clearSignedUrlCache, createSignedStorageUrl, isStorageObjectUrl, resolveStorageUrls } from '@/shared/storageUrl';

/** 만료까지 이만큼 남으면 다시 받는다. shared 쪽 캐시 여유와 같은 값. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** 값에서 주소로 쓸 만한 칸을 고른다. 첨부 객체는 저장된 시기마다 칸 이름이 다르다. */
function pickRef(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return '';
    // 경로가 있으면 경로가 먼저다 — 절대 URL 은 만료됐을 수 있다.
    return value.path || value.file_path || value.url || value.fileUrl || value.publicUrl || value.public_url || value.signedUrl || '';
}

/**
 * 한 화면이 쓰는 서명 URL 모음.
 *
 * @param {string} defaultBucket 경로만 주어졌을 때 뒤질 버킷
 */
export function createSignedUrlView(defaultBucket = DEFAULT_BUCKET) {
    // key -> { url, at }. reactive 라서 값이 채워지면 템플릿이 다시 그려진다.
    const resolved = reactive({});
    const requested = new Set();
    let sweeper = null;

    function refOf(value, bucket) {
        const raw = pickRef(value);
        if (!raw) return null;
        const hint = (typeof value === 'object' && (value.bucket || value.file_bucket)) || bucket || defaultBucket;
        return parseStorageRef(raw, hint);
    }

    /**
     * 템플릿에서 바로 쓴다. `:src="signedSrc(image)"`.
     *
     * @returns {string|undefined} 아직 못 받았으면 undefined — 속성이 붙지 않는다.
     */
    function signedSrc(value, bucket) {
        const raw = pickRef(value);
        if (!raw) return undefined;

        const ref = refOf(value, bucket);
        // 서명할 대상이 아니면(바깥 주소·data:·앱 정적 경로) 그대로 쓴다.
        if (!ref) return raw;

        const key = `${ref.bucket}/${ref.path}`;
        const hit = resolved[key];
        if (hit) return hit.url || undefined;

        if (!requested.has(key)) {
            requested.add(key);
            resolveStorageUrl(ref, {})
                .then((url) => {
                    resolved[key] = { url: url || '', at: Date.now() };
                })
                .catch(() => {
                    resolved[key] = { url: '', at: Date.now() };
                })
                .finally(() => {
                    requested.delete(key);
                });
        }
        return undefined;
    }

    /** 지금 당장 주소가 필요할 때(클릭해서 새 창 열기 등). */
    async function signedUrl(value, bucket) {
        const ref = refOf(value, bucket);
        if (!ref) return String(pickRef(value) || '').trim();
        const url = await resolveStorageUrl(ref, {});
        if (url) resolved[`${ref.bucket}/${ref.path}`] = { url, at: Date.now() };
        return url;
    }

    /** 만료가 가까운 것을 버린다. 버리면 다시 그려지면서 새로 받는다. */
    function sweep() {
        const deadline = Date.now() - (SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS);
        for (const key of Object.keys(resolved)) {
            if (resolved[key]?.at <= deadline) delete resolved[key];
        }
    }

    function start() {
        if (sweeper || typeof window === 'undefined') return;
        sweeper = window.setInterval(sweep, SWEEP_INTERVAL_MS);
    }

    function stop() {
        if (!sweeper) return;
        window.clearInterval(sweeper);
        sweeper = null;
    }

    return { signedSrc, signedUrl, sweep, start, stop };
}

/**
 * Options API 용. `mixins: [storageUrlMixin]` 하면 `signedSrc` · `signedUrl` 이 생긴다.
 *
 * 기본 버킷은 `files` 다. 채팅 이미지처럼 다른 버킷이면 부를 때 두 번째 인자로
 * 넘긴다 — `signedSrc(image, 'chat-images')`.
 */
export const storageUrlMixin = {
    // 일부러 data() 에 넣지 않는다 — 모음 자체가 반응형으로 감싸지면 안쪽의
    // reactive 지도를 두 번 감싸게 되고, 함수까지 프록시를 통과한다.
    created() {
        this.__signedUrlView = createSignedUrlView(DEFAULT_BUCKET);
        this.__signedUrlView.start();
    },
    beforeUnmount() {
        this.__signedUrlView?.stop();
    },
    methods: {
        signedSrc(value, bucket) {
            return this.__signedUrlView?.signedSrc(value, bucket);
        },
        async signedUrl(value, bucket) {
            return (await this.__signedUrlView?.signedUrl(value, bucket)) || '';
        }
    }
};
