/**
 * 에이전트를 부른다.
 *
 * 왜 필요한가
 *   `chats` 표에 사용자 메시지를 쓰는 것만으로는 답이 오지 않는다. 데이터베이스가
 *   에이전트를 깨우지 않기 때문이다 — 포털도 화면에서 직접 스트리밍을 호출한다.
 *   이것이 없으면 메시지는 저장되는데 영원히 답이 없는 대화가 된다.
 *
 * 주소를 왜 절대 경로로 만드는가
 *   포털은 `/process-gpt-deepagents` 같은 상대 경로로 부른다. 같은 서버에서 뜨니까
 *   된다. 앱은 화면이 `https://localhost` 라서 상대 경로로 부르면 앱 자신에게
 *   요청하게 되고 아무 데도 닿지 않는다.
 */

import { isUsable } from './attachments.js';

/** 오케스트레이션별 서비스 경로. 포털과 같아야 한다. */
const BASE_PATHS = {
    deepagents: '/process-gpt-deepagents'
};

/** 그 밖의 모든 것. */
const DEFAULT_BASE_PATH = '/agent';

/** 이 대화가 어느 엔진으로 가는가. */
export function basePathFor(orchestration) {
    const o = (orchestration || '').toString().trim();
    return BASE_PATHS[o] || DEFAULT_BASE_PATH;
}

/** 앱에서 실제로 부를 절대 주소. */
export function streamUrl(origin, orchestration) {
    const base = (origin || '').replace(/\/+$/, '');
    return `${base}${basePathFor(orchestration)}`;
}

/**
 * 파일 하나를 에이전트가 읽는 모양으로 바꾼다. 포털 normalizeInputFile 과 같다.
 */
function toInputFile(f) {
    const url = f.url || f.fileUrl || f.publicUrl || f.signedUrl || '';
    const name = f.name || f.fileName || '';
    const contentType = f.contentType || f.fileType || '';
    const size = f.size || f.fileSize || null;
    const out = { url, name, contentType };
    if (size) out.size = size;
    return out;
}

/**
 * 에이전트에게 보낼 본문.
 *
 * 첨부는 요청 본문의 `files` 칸에만 넣어서는 에이전트가 알아채지 못한다.
 * 포털은 **메시지 글 끝에 `[InputData]` 블록을 붙여** 무엇이 딸려 왔는지 알린다.
 * 이것이 없으면 사진을 보내도 "첨부된 사진이 없습니다" 라는 답이 돌아온다 —
 * 실제로 그렇게 답했다.
 *
 * 포털과 글자 하나까지 같은 모양이어야 한다. 서버가 이 블록을 글에서 찾아 읽는다.
 */
export function buildAgentMessage(text, { images = [], files = [], sessionFiles = [] } = {}) {
    const body = (text || '').toString();
    const pics = (Array.isArray(images) ? images : []).filter((i) => i?.url);
    const docs = (Array.isArray(files) ? files : []).filter(isUsable).map(toInputFile);
    // 이번 턴에 붙인 것과 이 대화에서 지금까지 붙인 것을 합친다(중복 제거).
    const session = dedupeFiles([
        ...(Array.isArray(sessionFiles) ? sessionFiles : []).filter(isUsable).map(toInputFile),
        ...docs
    ]);

    if (!pics.length && !docs.length && !session.length) return body;

    const inputData = {};
    if (pics.length) inputData.images = pics.map((i) => ({ id: i.id || '', url: i.url }));
    if (docs.length) {
        // 하위 호환: 첫 파일은 file, 전체는 files — 포털과 같다.
        inputData.file = docs[0];
        inputData.files = docs;
    }
    // 이 대화에서 지금까지 오간 파일 전체.
    //
    // 이것이 없으면 다음 턴에 에이전트가 "첨부된 문서가 없습니다" 라고 답한다 —
    // 실제로 그랬다. 파일을 붙인 그 턴에만 알고, 바로 다음 질문에서 잊는다.
    // 포털은 대화의 모든 파일을 매번 다시 실어 보낸다(session_files). 같게 한다.
    if (session.length) inputData.session_files = session;

    return `${body}

[InputData]
${JSON.stringify(inputData)}`;
}

/** 같은 파일을 여러 번 싣지 않는다. 주소가 같으면 같은 파일이다. */
function dedupeFiles(files) {
    const seen = new Set();
    const out = [];
    for (const f of files) {
        const key = f?.url || f?.name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(f);
    }
    return out;
}

/**
 * 요청에 실을 값을 만든다.
 *
 * 빠뜨리면 조용히 실패하는 것들이 있다.
 *   tenant_id  없으면 앞단이 401 로 끊는다
 *   user_jwt   같은 이유. 헤더와 본문 양쪽에 실린다
 *   conversation_id  없으면 답이 어느 방에도 저장되지 않는다
 *
 * 사용자 메시지와 응답에 서로 다른 uuid 를 준다. 같은 값을 쓰면 에이전트 응답이
 * 사용자 메시지 행을 덮어써 질문이 사라진다.
 */
export function buildParams({
    text,
    roomId,
    session,
    tenantId = '',
    jwt = '',
    docs = null,
    files = null,
    images = null,
    sessionFiles = null,
    mentioned = null,
    metadata = null,
    ids = null
}) {
    const user = session?.user;
    // 주소가 없는 첨부는 보내지 않는다. 에이전트가 열지 못하는 것을 넘기면
    // "파일을 봤다" 고 답하면서 내용은 모르는 상태가 된다.
    const usable = (Array.isArray(files) ? files : []).filter(isUsable);
    return {
        message: buildAgentMessage(text, { images, files: usable, sessionFiles }),
        message_uuid: ids?.message || null,
        response_message_uuid: ids?.response || null,
        tenant_id: tenantId || '',
        user_uid: user?.id || '',
        user_email: user?.email || '',
        user_name: (globalThis.localStorage?.getItem('userName') || user?.email || '').toString(),
        user_jwt: jwt || '',
        conversation_id: roomId || null,
        // 지목한 상대. 비어 있으면 서버가 누가 답할지 고른다.
        mentioned_users: (Array.isArray(mentioned) ? mentioned : []).map((m) => ({
            id: m?.id || '',
            username: m?.username || ''
        })),
        file: usable[0] || null,
        files: usable,
        file_count: usable.length,
        metadata: withKnowledge(metadata, docs)
    };
}

/**
 * 고른 지식 문서를 실어 보낸다.
 *
 * 화면에서 골라 놓고 보내지 않으면, 사용자는 문서를 참고해 답한 줄 알지만
 * 에이전트는 그 문서를 본 적이 없다. 틀린 답을 믿게 되는 쪽이 더 나쁘다.
 */
export function withKnowledge(metadata, docs) {
    const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
    const list = Array.isArray(docs) ? docs : [];
    if (!list.length) return base;

    base.knowledge_docs = list.map((d) => ({
        key: d.key,
        name: d.name,
        source_type: d.sourceType,
        source_ref: d.sourceRef,
        folder_path: d.folderPath
    }));
    return base;
}
