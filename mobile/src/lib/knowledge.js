/**
 * 지식 베이스 문서 목록.
 *
 * 포털의 선택기(KnowledgeSpacePicker, 910줄)는 Vuetify 대화상자라 폰에 맞지 않는다.
 * 화면은 새로 그리되 **읽어 오는 곳과 담아 보내는 모양은 같게** 한다 — 다르면
 * 앱에서 고른 문서를 에이전트가 못 찾는다.
 */

/** 응답 한 건을 화면·전송에 쓸 모양으로 맞춘다. */
export function toDoc(detail) {
    if (!detail || !detail.file_name) return null;

    const sourceType = detail.source_type || 'drive';
    const folderPath = detail.folder_path || detail.drive_folder_name || '';

    return {
        // 같은 파일명이 여러 폴더에 있을 수 있다. 참조가 있으면 그것을, 없으면 폴더+이름으로 구분한다.
        key: detail.source_ref
            ? `${sourceType}:${detail.source_ref}`
            : `${folderPath}::${detail.file_name}`,
        name: detail.file_name,
        folderPath,
        mimeType: detail.mime_type || '',
        sourceType,
        sourceRef: detail.source_ref || '',
        sizeBytes: detail.size_bytes,
        modifiedTime: detail.modified_time,
        owner: detail.owner
    };
}

/** 응답 전체를 목록으로. 이름 순으로 세운다 — 폰에서는 검색보다 훑기가 먼저다. */
export function toDocs(payload) {
    const details = Array.isArray(payload?.file_details) ? payload.file_details : [];
    return details
        .map(toDoc)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/**
 * 이름으로 걸러낸다.
 *
 * 폴더 경로도 함께 본다 — 같은 이름의 파일이 여럿일 때 폴더로 구분하는 것이
 * 사용자가 실제로 하는 방식이다.
 */
export function filterDocs(docs, query) {
    const q = (query || '').toString().trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
        (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.folderPath || '').toLowerCase().includes(q)
    );
}

/** 이미 고른 것인가. 같은 파일을 두 번 담지 않게 한다. */
export function isPicked(selected, doc) {
    return (selected || []).some((d) => d.key === doc.key);
}

/** 골랐다 뺐다 한다. */
export function togglePick(selected, doc) {
    const list = selected || [];
    return isPicked(list, doc) ? list.filter((d) => d.key !== doc.key) : [...list, doc];
}
