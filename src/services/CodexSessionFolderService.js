/**
 * 채팅방에서 고른 폴더를 codex 대화 워크스페이스에 **원본 그대로** 올린다.
 *
 * 지식베이스 업로드(memento 인제스트 → 파싱·청킹·임베딩)와 다른 경로다. 여기서는
 * 전처리를 하지 않는다. 서버는 파일을 그대로 디스크에 두고, codex 가 턴 안에서
 * 셸(`ls`/`rg`/`sed`)로 직접 뒤진다. 파일 내용이 컨텍스트에 실리지 않으므로
 * 파일 수 상한을 두지 않는다.
 *
 * 게이트웨이 `process-gpt-codex` 라우트와 같은 고정 prefix 만 쓴다.
 */
const BASE_URL = '/process-gpt-codex';

// 한 요청에 다 실으면 대용량 폴더에서 타임아웃/메모리로 통째로 실패한다.
// 배치로 쪼개면 진행률도 보여줄 수 있고, 실패해도 그 배치만 다시 보내면 된다.
const BATCH_FILES = 40;
const BATCH_BYTES = 16 * 1024 * 1024;

function relativePathOf(file) {
    // webkitdirectory 로 고르면 webkitRelativePath 에 선택한 폴더명부터의 상대경로가 담긴다.
    return (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
}

/** 크기·개수 기준으로 배치를 나눈다. 큰 파일 하나는 혼자 한 배치가 된다. */
function splitBatches(files) {
    const batches = [];
    let current = [];
    let bytes = 0;
    for (const file of files) {
        if (current.length && (current.length >= BATCH_FILES || bytes + file.size > BATCH_BYTES)) {
            batches.push(current);
            current = [];
            bytes = 0;
        }
        current.push(file);
        bytes += file.size || 0;
    }
    if (current.length) batches.push(current);
    return batches;
}

class CodexSessionFolderService {
    /**
     * @param {File[]} files webkitdirectory 로 고른 파일들
     * @param {{tenantId: string, conversationId: string, ignoreDefaults?: boolean}} scope
     * @param {(progress: {sent: number, total: number, bytes: number}) => void} [onProgress]
     */
    async upload(files, scope, onProgress) {
        const list = Array.from(files || []).filter((f) => f && relativePathOf(f));
        if (!list.length) throw new Error('업로드할 파일이 없습니다');
        const { tenantId, conversationId, ignoreDefaults = true } = scope || {};
        if (!tenantId || !conversationId) throw new Error('tenant/대화 정보가 없어 폴더를 올릴 수 없습니다');

        const batches = splitBatches(list);
        let sent = 0;
        let bytes = 0;
        let skipped = [];
        let summary = null;

        for (let index = 0; index < batches.length; index += 1) {
            const batch = batches[index];
            const form = new FormData();
            form.append('tenant_id', tenantId);
            form.append('conversation_id', conversationId);
            // 첫 배치만 기존 폴더를 지운다 — 이어지는 배치가 앞 배치를 날리면 안 된다.
            form.append('replace', index === 0 ? 'true' : 'false');
            // 총 개수를 첫 배치에 알려 준다. 새로고침·네트워크 끊김으로 중간에 멈추면
            // 서버가 "일부만 올라왔다"를 알아채고 에이전트에게 경고할 수 있다.
            if (index === 0) form.append('expected_files', String(list.length));
            form.append('ignore_defaults', ignoreDefaults ? 'true' : 'false');
            for (const file of batch) {
                form.append('paths', relativePathOf(file));
                form.append('files', file, file.name);
            }
            const response = await fetch(`${BASE_URL}/session/folder`, { method: 'POST', body: form });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`폴더 업로드 실패 (${response.status}) ${detail.slice(0, 200)}`);
            }
            const result = await response.json().catch(() => ({}));
            sent += batch.length;
            bytes += batch.reduce((sum, f) => sum + (f.size || 0), 0);
            skipped = skipped.concat(Array.isArray(result.skipped) ? result.skipped : []);
            summary = result;
            if (onProgress) onProgress({ sent, total: list.length, bytes });
        }
        return { ...(summary || {}), sent, bytes, skipped };
    }

    async describe(tenantId, conversationId) {
        const params = new URLSearchParams({ tenant_id: tenantId, conversation_id: conversationId });
        const response = await fetch(`${BASE_URL}/session/folder?${params}`);
        if (!response.ok) return { present: false, files: 0 };
        return await response.json().catch(() => ({ present: false, files: 0 }));
    }

    async clear(tenantId, conversationId) {
        const params = new URLSearchParams({ tenant_id: tenantId, conversation_id: conversationId });
        const response = await fetch(`${BASE_URL}/session/folder?${params}`, { method: 'DELETE' });
        return response.ok;
    }
}

export default new CodexSessionFolderService();
export { CodexSessionFolderService, relativePathOf };
