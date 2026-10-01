/**
 * 파일을 가져간 사건을 남긴다 (docs/security.md 3-3, 보안 확인표 항목 8·18).
 *
 * 왜 필요한가
 *   버킷이 비공개가 되면서(20260911_storage_private_buckets.sql) 파일을 꺼내는
 *   길은 두 가지로 좁혀졌다 — `storage.download()` 로 바이트를 직접 받거나,
 *   서명 URL 을 발급받아 그 주소로 받거나. 둘 다 "파일이 사용자 손에 들어간"
 *   사건이므로 같은 표(`public.file_download_log`)에 남긴다.
 *
 * 무엇을 보내지 않는가
 *   사용자 id · 이메일 · IP · User-Agent 는 **보내지 않는다.** 클라이언트가 보낸
 *   값은 위조 가능하다. SECURITY DEFINER RPC 가 `auth.uid()` 와 요청 헤더에서
 *   서버측으로 직접 채운다(supabase/migrations/20260911_file_download_log.sql).
 *
 * 어디서 부르지 않는가
 *   화면에 그리기 위한 서명 URL(`createSignedStorageUrl` / 채팅 이미지)에는 넣지
 *   않는다. 목록 한 번에 수십 건이 쌓여 이력이 소음으로 덮인다. **다운로드를
 *   의도한 호출부가 명시적으로** 부른다.
 *
 * 실패해도 절대 던지지 않는다. 감사 기록이 다운로드를 막으면 안 된다.
 *
 * 이 파일은 Vue 를 모른다. 어느 계층에서든 그대로 부를 수 있다.
 */

/** RPC 가 받는 액션. 그 밖의 값은 서버가 조용히 버린다. */
export const DOWNLOAD_ACTIONS = Object.freeze({
    /** 바이트를 직접 받았다 (storage.download) */
    DOWNLOAD: 'download',
    /** 다운로드용 서명 URL 을 발급했다 (그 주소로 받을 수 있다) */
    SIGNED_URL: 'signed_url',
    /** 화면에서 열어 봤다 (미리보기 등) */
    VIEW: 'view'
});

function clientOf(client) {
    // 노드(테스트)에는 window 가 없다. 그쪽은 client 를 직접 넘긴다.
    return client || (typeof window !== 'undefined' ? window.$supabase : null);
}

/**
 * 다운로드 한 건을 기록한다.
 *
 * @param {object} params
 * @param {string} params.bucket    버킷 이름 (files, chat-images …)
 * @param {string} params.path      버킷 안 경로. 절대 URL 이 아니라 경로여야 한다.
 * @param {string} [params.fileName] 사용자에게 보인 이름. path 는 `<ts>_<uuid8>.<ext>` 라 읽기 어렵다.
 * @param {'download'|'signed_url'|'view'} [params.action='download']
 * @param {object} [params.metadata] 호출 지점(source) 등 부가 정보. 개인정보·토큰은 넣지 않는다.
 * @param {object} [params.client]  supabase 클라이언트. 없으면 window.$supabase.
 * @returns {Promise<boolean>} 기록됐으면 true. 실패해도 던지지 않고 false.
 */
export async function recordFileDownload({ bucket, path, fileName, action, metadata, client } = {}) {
    try {
        const supabase = clientOf(client);
        if (!supabase || typeof supabase.rpc !== 'function') return false;
        if (!bucket || !path) return false;

        const { error } = await supabase.rpc('record_file_download', {
            p_bucket: String(bucket),
            p_path: String(path),
            p_file_name: fileName ? String(fileName) : null,
            p_action: action || DOWNLOAD_ACTIONS.DOWNLOAD,
            p_metadata: metadata && typeof metadata === 'object' ? metadata : {}
        });

        // supabase-js 는 RPC 오류를 throw 하지 않고 error 로 돌려준다.
        // (마이그레이션이 아직 적용되지 않은 환경에서도 다운로드는 정상 진행돼야 한다)
        if (error) {
            console.warn('[file_download_log] 기록 실패:', error.message || error);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[file_download_log] 기록 실패:', e?.message || e);
        return false;
    }
}
