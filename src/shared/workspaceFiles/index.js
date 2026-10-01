/**
 * 작업 폴더에 뜨는 산출물 파일을 어떻게 다룰지 가린다.
 *
 * 산출물은 두 종류다.
 *
 *   * **텍스트 산출물** — bpmn·md·json·form 처럼 내용이 그대로 실려 와 화면이 렌더한다.
 *   * **문서 산출물** — docx·pdf 처럼 바이너리라 내용이 없고, 비공개 버킷의 서명 주소로 온다.
 *
 * 둘을 가르는 규칙이 화면 코드 안에만 있으면, 문서 산출물은 "미리보기 가능한 확장자"
 * 목록에 없다는 이유로 목록에서 통째로 빠진다 — 실제로 그랬다. 만들어졌다는 말만 남고
 * 받을 길이 없었다. 그 규칙을 여기 모아 따로 시험할 수 있게 한다.
 */

/** 텍스트 산출물의 확장자별 아이콘. 이 목록이 곧 "내용으로 미리보기되는 형식" 이다. */
export const TEXT_FILE_ICONS = {
    '.json': 'mdi-code-json',
    '.md': 'mdi-language-markdown-outline',
    '.html': 'mdi-language-html5',
    '.htm': 'mdi-language-html5',
    '.form': 'mdi-form-select',
    '.xml': 'mdi-xml',
    '.bpmn': 'mdi-sitemap-outline',
    '.dmn': 'mdi-table-large',
    '.yaml': 'mdi-cog-outline',
    '.yml': 'mdi-cog-outline',
    '.txt': 'mdi-text-box-outline',
    '.csv': 'mdi-table'
};

/** 문서 산출물(바이너리)의 확장자별 아이콘. */
export const DOCUMENT_FILE_ICONS = {
    '.pdf': 'mdi-file-pdf-box',
    '.doc': 'mdi-file-word-outline',
    '.docx': 'mdi-file-word-outline',
    '.xls': 'mdi-file-excel-outline',
    '.xlsx': 'mdi-file-excel-outline',
    '.ppt': 'mdi-file-powerpoint-outline',
    '.pptx': 'mdi-file-powerpoint-outline',
    '.hwp': 'mdi-file-document-outline',
    '.hwpx': 'mdi-file-document-outline',
    '.png': 'mdi-file-image-outline',
    '.jpg': 'mdi-file-image-outline',
    '.jpeg': 'mdi-file-image-outline',
    '.gif': 'mdi-file-image-outline',
    '.webp': 'mdi-file-image-outline',
    '.svg': 'mdi-file-image-outline'
};

/** 내용으로 미리보기되는 형식. */
export const TEXT_PREVIEW_EXTENSIONS = new Set(Object.keys(TEXT_FILE_ICONS));

/** 주소만으로 브라우저가 그릴 수 있는 이미지 형식. */
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** 파일 항목의 확장자(앞에 점 포함, 소문자). 없으면 빈 문자열. */
export function fileExtensionOf(file) {
    const explicit = (file?.ext || '').toString().trim().toLowerCase();
    if (explicit) return explicit.startsWith('.') ? explicit : `.${explicit}`;
    const name = (file?.name || file?.path || '').toString().split('/').pop() || '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** 목록에 보일 아이콘. */
export function fileIconOf(ext) {
    const normalized = (ext || '').toString().toLowerCase();
    const key = normalized.startsWith('.') ? normalized : `.${normalized}`;
    return TEXT_FILE_ICONS[key] || DOCUMENT_FILE_ICONS[key] || 'mdi-file-outline';
}

/**
 * 문서 산출물인가 — 내용이 아니라 받을 수 있는 주소를 들고 오는 항목.
 *
 * 서버가 `file_artifact` 에 주소를 실어 보낼 때 `document` 표식을 붙인다. 표식이 없는
 * 옛 메시지(새로고침 복원)도 주소가 있으면 문서로 본다.
 */
export function isDocumentFile(file) {
    if (!file || typeof file !== 'object') return false;
    if (file.document === true) return true;
    return Boolean(file.url && !file.content);
}

/**
 * 이 문서를 화면에서 그릴 수 있는가 — `'pdf' | 'image' | 'none'`.
 *
 * `'none'` 은 미리보기를 지원하지 않는 형식(docx·xlsx·pptx·hwp)이다. 그릴 수 없다고
 * 숨기지는 않는다 — 목록에 띄우고 받게 한다.
 */
export function documentPreviewKind(file) {
    if (!isDocumentFile(file)) return 'none';
    const ext = fileExtensionOf(file);
    if (ext === '.pdf') return 'pdf';
    return IMAGE_EXTENSIONS.has(ext) ? 'image' : 'none';
}

/**
 * 받을 때 쓸 주소 — 받은 파일이 사용자가 본 이름으로 떨어지게 한다.
 *
 * 산출물은 다른 오리진(저장소)에 있다. 크로스 오리진이면 브라우저가 `<a download>` 의
 * 이름을 무시해서, 받은 파일이 `9cc5011e-….docx` 같은 객체 키로 떨어진다 — 무엇인지 알 수
 * 없다. 서명 주소는 `download` 파라미터로 내려받을 이름을 정할 수 있으므로 그것을 쓴다.
 * 서명이 경로만 덮기 때문에 파라미터를 붙여도 주소는 그대로 유효하다.
 */
export function downloadUrlFor(url, fileName) {
    const text = String(url || '');
    const name = String(fileName || '').trim();
    if (!text || !name) return text;
    if (!text.includes('/storage/v1/object/sign/')) return text;
    if (/[?&]download=/.test(text)) return text;
    return `${text}${text.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`;
}

/**
 * 이 레코드가 이번 대화에서 **에이전트가 만든** 문서인가.
 *
 * 메시지의 산출물 목록(`pdfFiles`)에는 사용자가 올린 첨부도 함께 담긴다. 그것까지 작업
 * 폴더에 띄우면 입력이 산출물로 둔갑한다. 서버가 거둔 산출물만 비공개 버킷(`artifacts/`)에
 * 들어가고 해시를 달고 나오므로, 그 둘을 함께 본다.
 */
export function isTurnArtifactRecord(file) {
    if (!file || typeof file !== 'object') return false;
    const fileId = String(file.file_id || file.fileId || '');
    if (!fileId.startsWith('artifacts/')) return false;
    if (!String(file.sha256 || '')) return false;
    return Boolean(file.url || file.fileUrl);
}
