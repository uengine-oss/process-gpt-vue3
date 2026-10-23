// 이음오피스 웹 편집기(ieumoffice-web office-host) 연동.
// VITE_OFFICE_WEB_URL 이 있으면 docx·xlsx·pptx·pdf·hwp(x)·md·html 문서를 기존 HTML 투영 뷰어 대신
// 원본 형식 그대로 여는 편집기(iframe)로 연다. 값이 없으면 기존 뷰어를 그대로 쓴다.

const EDITOR_BY_EXT = {
    docx: 'docs',
    odt: 'docs',
    xlsx: 'sheets',
    xlsm: 'sheets',
    xls: 'sheets',
    csv: 'sheets',
    pptx: 'slides',
    pdf: 'pdf',
    md: 'markdown',
    markdown: 'markdown',
    html: 'html',
    htm: 'html',
    xmind: 'mindmap',
    hwp: 'hwp',
    hwpx: 'hwp'
};

export function officeWebUrl() {
    const raw = (window._env_?.VITE_OFFICE_WEB_URL || import.meta.env.VITE_OFFICE_WEB_URL || '').toString().trim();
    return raw.replace(/\/+$/, '');
}

export function isOfficeEditorEnabled() {
    return !!officeWebUrl();
}

function extOf(nameOrUrl) {
    const clean = (nameOrUrl || '').toString().split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

/** 파일 이름(또는 URL)에 맞는 편집기 이름. 편집할 수 없는 형식이면 null */
export function officeEditorFor(nameOrUrl) {
    return EDITOR_BY_EXT[extOf(nameOrUrl)] || null;
}

/** 편집기가 켜져 있고 이 파일을 열 수 있는가 */
export function canOpenInOfficeEditor(nameOrUrl) {
    return isOfficeEditorEnabled() && !!officeEditorFor(nameOrUrl);
}

/** 폼 값의 path 는 URL 이거나 files 버킷의 키다. 편집기 서버가 받을 수 있게 URL 로 바꾼다 */
export function resolveDocumentUrl(path, bucket = 'files') {
    if (!path || typeof path !== 'string') return '';
    if (/^https?:\/\//i.test(path)) return path;
    try {
        const { data } = window.$supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl || '';
    } catch (e) {
        return '';
    }
}

/** 편집기 iframe 주소. 로그인 토큰은 편집기 서버가 연결을 받을 때 확인한다 */
export async function officeEditorUrl({ fileUrl, name, readOnly = false }) {
    const base = officeWebUrl();
    const editor = officeEditorFor(name || fileUrl);
    const src = resolveDocumentUrl(fileUrl);
    if (!base || !editor || !src) return '';
    const params = new URLSearchParams({ src });
    if (name) params.set('name', name);
    if (readOnly) params.set('readonly', '1');
    try {
        const { data } = (await window.$supabase?.auth?.getSession?.()) || {};
        const token = data?.session?.access_token;
        if (token) params.set('token', token);
    } catch (e) {
        // 토큰 없이 연다: 편집기 서버가 인증을 요구하면 연결을 거절한다
    }
    return `${base}/office/${editor}/?${params.toString()}`;
}

/** 편집기 iframe 이 보내는 메시지인지 */
export function isOfficeEditorMessage(event, frameWindow) {
    return !!frameWindow && event.source === frameWindow && event.data?.source === 'ieum-office';
}
