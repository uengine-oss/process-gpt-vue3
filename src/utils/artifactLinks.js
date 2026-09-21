/**
 * 에이전트 산출물의 내려받기 주소를 다룬다.
 *
 * 산출물은 비공개 버킷에 있고, 주소는 한 시간이면 죽는다. 그래서 채팅 메시지에 저장된
 * 주소는 시간이 지나면 아무 소용이 없다 — 어제 대화를 다시 연 사람에게는 "만들었습니다"
 * 라는 문장과 죽은 링크만 남는다.
 *
 * 파일 자체는 그대로 있다. 레코드에 함께 실려 온 `file_id` 로 새 주소를 받으면 된다.
 * 이 모듈이 그 판단(아직 살아 있는가)과 요청(다시 발급)을 갖는다. 화면 코드에서 떼어
 * 놓은 이유는 이 규칙만 따로 시험할 수 있어야 해서다.
 */

/** 이 레코드가 지금 들고 있는 주소. */
export function artifactUrlOf(fileObj) {
    if (!fileObj) return '';
    return fileObj.url || fileObj.fileUrl || fileObj.publicUrl || fileObj.signedUrl || '';
}

/** 다시 발급받을 열쇠. 없으면 이 파일은 지금 주소가 전부다(옛 공개 버킷). */
export function artifactIdOf(fileObj) {
    if (!fileObj) return '';
    return fileObj.file_id || fileObj.fileId || '';
}

/**
 * 저장된 주소가 아직 살아 있는가.
 *
 * 만료 시각이 없으면 만료가 없다는 뜻이다(옛 공개 버킷의 영구 주소). 내려받는 데도
 * 시간이 걸리므로, 곧 죽을 주소는 미리 바꾼다.
 */
export function isArtifactUrlFresh(fileObj, now = Date.now(), graceMs = 30 * 1000) {
    const expiresAt = fileObj?.url_expires_at || fileObj?.urlExpiresAt || '';
    if (!expiresAt) return true;
    const deadline = Date.parse(expiresAt);
    if (Number.isNaN(deadline)) return true;
    return deadline - now > graceMs;
}

/**
 * 새 주소를 받아 레코드에 반영한다.
 *
 * @param fileObj 산출물 레코드(`chats.messages.pdfFiles` 의 한 건)
 * @param request `(fileId) => Promise<{ file_url, url_expires_at }>`
 * @returns 새 주소. 받지 못하면 빈 문자열 — 지어낸 주소를 돌려주지 않는다.
 */
export async function reissueArtifactUrl(fileObj, request) {
    const fileId = artifactIdOf(fileObj);
    if (!fileId || typeof request !== 'function') return '';
    let data;
    try {
        data = await request(fileId);
    } catch (e) {
        return '';
    }
    const fresh = data?.file_url || '';
    if (!fresh) return '';
    // 받아 둔 주소를 레코드에도 반영해, 같은 화면에서 또 누를 때 다시 묻지 않는다.
    fileObj.url = fresh;
    fileObj.fileUrl = fresh;
    if (data.url_expires_at) fileObj.url_expires_at = data.url_expires_at;
    return fresh;
}

/** 지금 쓸 수 있는 주소. 만료됐으면 다시 발급받아 돌려준다. */
export async function usableArtifactUrl(fileObj, request) {
    const current = artifactUrlOf(fileObj);
    if (current && isArtifactUrlFresh(fileObj)) return current;
    return (await reissueArtifactUrl(fileObj, request)) || current;
}
