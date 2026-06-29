// 약식 폴더 권한 (PoC) — 일반 사용자는 허용된 폴더(+하위)의 자료만 볼 수 있다.
// PocAdmin / superAdmin / admin 은 전체 조회. 권한은 folder_permissions 테이블에 저장된다.
//
// 사용처: KnowledgeSpacePicker(채팅 모달), KnowledgeFilesTab(지식 베이스 페이지) 등
// 폴더/파일 목록을 보여주는 모든 곳에서 동일하게 적용한다.

function normalizeFolder(p) {
    return (p || '').replace(/^\/+|\/+$/g, '');
}

/**
 * 현재 로그인 사용자의 허용 폴더 목록을 조회한다.
 * @returns {Promise<string[]|null>} null = 전체 허용(관리자), string[] = 허용 folder_path 목록
 */
export async function fetchAllowedFolders() {
    const role = (typeof localStorage !== 'undefined' && localStorage.getItem('role')) || '';
    const isAdmin = (typeof localStorage !== 'undefined' && localStorage.getItem('isAdmin')) === 'true';
    // 관리자 계열은 전체 조회 (null)
    if (role === 'PocAdmin' || role === 'superAdmin' || isAdmin) return null;

    const uid = (typeof localStorage !== 'undefined' && localStorage.getItem('uid')) || '';
    if (typeof window === 'undefined' || !window.$supabase || !uid) return null;

    try {
        const { data, error } = await window.$supabase
            .from('folder_permissions')
            .select('folder_path')
            .match({ tenant_id: window.$tenantName, user_id: uid });
        if (error) throw error;
        return (data || []).map((r) => normalizeFolder(r.folder_path)).filter(Boolean);
    } catch (e) {
        console.error('[folderPermissions] fetch failed', e);
        // 권한 조회 실패 시 보수적으로 차단 (권한 누출 방지)
        return [];
    }
}

/**
 * folderPath 가 허용 범위(allow) 안인지 판정.
 * @param {string} folderPath 검사할 폴더 경로
 * @param {string[]|null} allow fetchAllowedFolders() 결과. null 이면 전체 허용.
 */
export function isFolderAllowed(folderPath, allow) {
    if (allow == null) return true; // 전체 허용(관리자)
    const fp = normalizeFolder(folderPath);
    return allow.some((a) => fp === a || fp.startsWith(a + '/'));
}
