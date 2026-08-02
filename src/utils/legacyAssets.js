/**
 * index.html 에서 무조건 내려받던 레거시 전역 자산을
 * 실제로 필요한 화면에서만 불러오기 위한 로더.
 *
 * 예전에는 jQuery·jQuery-UI·lodash·CKEditor4·KEditor·Bootstrap3·OpenGraph 를
 * 모든 페이지에서 파서 블로킹으로 받았다(합계 약 3.7 MB). 로그인 화면조차
 * 이 전부를 기다려야 했다.
 *
 * 각 자산은 1회만 로드되며, 같은 자산에 대한 동시 호출은 같은 Promise 를 공유한다.
 */
const pending = new Map();

/**
 * @param {string} src 스크립트 경로
 * @param {() => boolean} [isReady] 이미 로드됐는지 판별하는 술어.
 *        index.html 의 defer 스크립트처럼 이 로더가 만들지 않은 태그는
 *        load 이벤트를 이미 놓쳤을 수 있으므로, 전역 정의 여부로 판단한다.
 */
function loadScript(src, isReady) {
    if (isReady && isReady()) return Promise.resolve();
    if (pending.has(src)) return pending.get(src);

    const promise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        const el = existing || document.createElement('script');

        const onLoad = () => resolve();
        const onError = () => reject(new Error(`Failed to load ${src}`));

        el.addEventListener('load', onLoad);
        el.addEventListener('error', onError);

        if (!existing) {
            el.src = src;
            el.async = false; // 여러 스크립트를 문서 순서대로 실행시키기 위해
            document.head.appendChild(el);
        } else if (isReady) {
            // 이미 실행이 끝나 load 이벤트를 놓쳤을 가능성에 대비한 폴백.
            const started = Date.now();
            const poll = setInterval(() => {
                if (isReady()) {
                    clearInterval(poll);
                    resolve();
                } else if (Date.now() - started > 15000) {
                    clearInterval(poll);
                    reject(new Error(`Timed out waiting for ${src}`));
                }
            }, 50);
        }
    });

    pending.set(src, promise);
    return promise;
}

function loadStylesheet(href) {
    if (pending.has(href)) return pending.get(href);

    const promise = new Promise((resolve) => {
        if (document.querySelector(`link[href="${href}"]`)) {
            resolve();
            return;
        }
        const el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = href;
        // 스타일 로드 실패가 화면 동작을 막지는 않도록 실패도 resolve 처리
        el.addEventListener('load', () => resolve());
        el.addEventListener('error', () => resolve());
        document.head.appendChild(el);
    });

    pending.set(href, promise);
    return promise;
}

/** 순서가 중요한 스크립트들을 직렬로 로드한다. */
async function loadScriptsInOrder(entries) {
    for (const [src, isReady] of entries) {
        await loadScript(src, isReady);
    }
}

/**
 * jQuery + jQuery UI.
 * 현재는 index.html 에서 defer 로 함께 내려받으므로 보통 즉시 resolve 된다.
 * 나중에 index.html 에서 완전히 걷어내도 이 함수를 통해 동작한다.
 */
export function ensureJQuery() {
    return loadScriptsInOrder([
        ['/static/lib/jquery.min.js', () => typeof window.jQuery === 'function'],
        ['/static/lib/jquery-ui.min.js', () => typeof window.jQuery?.ui !== 'undefined']
    ]);
}

/** 전역 lodash(`_`). 일부 레거시 컴포넌트가 전역으로 사용한다. */
export function ensureLodash() {
    return loadScript('/static/lib/lodash.min.js', () => typeof window._ === 'function');
}

/** 폼 디자이너(KEditor) 스택: jQuery → CKEditor4 → Bootstrap3 → KEditor */
export async function ensureFormDesigner() {
    await ensureJQuery();
    await loadScriptsInOrder([
        ['/plugins/ckeditor-4.5.6/ckeditor.js', () => typeof window.CKEDITOR !== 'undefined'],
        ['/plugins/ckeditor-4.5.6/adapters/jquery.js', () => typeof window.jQuery?.fn?.ckeditor === 'function'],
        ['/plugins/bootstrap-3.3.6/js/bootstrap.min.js', () => typeof window.jQuery?.fn?.modal === 'function'],
        ['/plugins/keditor/keditor.js', () => typeof window.jQuery?.fn?.keditor === 'function']
    ]);
    await loadStylesheet('/plugins/font-awesome-4.5.0/css/font-awesome.min.css');
}

/** 레거시 OpenGraph 다이어그램 엔진 (전역 `OG`). jQuery-UI 에 의존한다. */
export async function ensureOpenGraphLib() {
    await ensureJQuery();
    await loadScript('/static/lib/opengraph/OpenGraph-0.1.3-SNAPSHOT.js', () => typeof window.OG !== 'undefined');
}
