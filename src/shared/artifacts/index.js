/**
 * 대화에서 만들어진 산출물을 알아본다.
 *
 * 에이전트는 답변 본문에 JSON 을 실어 산출물을 알린다 — 한글 문서(HWPX),
 * 워드(DOCX), 슬라이드, 프로세스 정의 같은 것들이다. 알아보지 못하면 사용자는
 * 중괄호 덩어리를 보거나, 만들어진 것을 열어 볼 방법이 없다.
 *
 * 판별 규칙은 포털(ChatRoomPage 의 isSlidePayload · isDocxPayload ·
 * extractHwpxPayload)과 같아야 한다. 두 벌이면 앱에서만 산출물이 안 보인다.
 */

/** 코드블록에 싸여 오기도 한다. 벗겨서 JSON 으로 읽는다. */
export function parsePayload(content) {
    const raw = String(content || '').trim();
    if (!raw) return null;

    const stripped = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!stripped.startsWith('{')) return null;

    try {
        const parsed = JSON.parse(stripped);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_e) {
        return null;
    }
}

function fileNameOf(p) {
    return String(p?.file_name || p?.fileName || '').trim();
}

function urlOf(p) {
    return String(p?.file_url || p?.fileUrl || p?.url || p?.download_url || p?.html_url || '').trim();
}

/** 슬라이드인가. 포털과 같은 판별. */
export function isSlide(p) {
    return Boolean(p && typeof p === 'object' && p.slide_markdown);
}

/** 워드 문서인가. */
export function isDocx(p) {
    if (!p || typeof p !== 'object') return false;
    const ct = String(p.content_type || p.contentType || '');
    return ct.includes('wordprocessingml') || fileNameOf(p).toLowerCase().endsWith('.docx');
}

/** 한글 문서인가. */
export function isHwpx(p) {
    if (!p || typeof p !== 'object') return false;
    const ct = String(p.content_type || p.contentType || '');
    return ct.includes('hwp') || fileNameOf(p).toLowerCase().endsWith('.hwpx');
}

/** 프로세스 정의인가. */
export function isProcessDefinition(p) {
    return Boolean(p && typeof p === 'object' && (p.processDefinitionName || p.activities || p.slide_markdown === undefined && p.roles && p.activities));
}

const KIND_LABEL = {
    slide: '슬라이드',
    docx: '워드 문서',
    hwpx: '한글 문서',
    file: '파일'
};

/**
 * 답변에서 산출물 하나를 뽑는다.
 *
 * @returns {null | {kind:string, label:string, title:string, url:string, markdown:string, images:string[]}}
 */
export function toArtifact(content) {
    const p = parsePayload(content);
    if (!p) return null;

    const kind = isSlide(p) ? 'slide' : isHwpx(p) ? 'hwpx' : isDocx(p) ? 'docx' : urlOf(p) ? 'file' : '';
    if (!kind) return null;

    return {
        kind,
        label: KIND_LABEL[kind] || '산출물',
        title: String(p.deck_title || p.title || fileNameOf(p) || KIND_LABEL[kind] || '산출물').trim(),
        url: urlOf(p),
        markdown: kind === 'slide' ? String(p.slide_markdown || '') : '',
        images: Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : []
    };
}

/** 앱 안에서 바로 보여 줄 수 있는가. 아니면 내려받아 밖에서 열어야 한다. */
export function canPreview(artifact) {
    if (!artifact) return false;
    if (artifact.kind === 'slide') return Boolean(artifact.markdown || artifact.images.length);
    return /\.(png|jpe?g|gif|webp|bmp|svg|pdf|txt|md|csv|json)(\?|$)/i.test(artifact.url || '');
}
