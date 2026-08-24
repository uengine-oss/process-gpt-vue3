/**
 * 사용자 식별자(UUID / email / employee_no) 를 표시 가능한 사용자 객체로 변환하기 위한 공용 타입·포맷·정규화 헬퍼.
 *
 * [역할 분리]
 *   - lookup (ID → UserIdentity): ProcessGPTBackend.resolveUserIdentities — DB 접근 책임
 *   - normalize (검색 응답 → UserIdentity): userIdentityFromSearchResult (이 파일)
 *   - format (UserIdentity → 표시 문자열): formatIdentity* (이 파일)
 *
 * [표시 포맷 정책]
 *   포맷은 사용처별 차이를 허용하므로 4가지 format 함수를 제공한다.
 *   호출자가 사용처의 폭·맥락에 맞춰 골라 쓴다.
 *
 * [현 시점 파편화 현황 — 점진적 마이그레이션 대상]
 *   - src/views/review-board/ProcessReviewBoard.vue              resolveOwnerNames
 *   - src/views/process-hierarchy/ProcessHierarchyProperties.vue resolveOwnerNames
 *   - src/components/ui/OwnerSettingDialog.vue                   인라인 lookup
 *   - src/views/admin/tabs/CallActivityManagement.vue            resolveOwnerNames
 *   - 그 외 ProcessHierarchyAIGuide.vue, useProcessArchitecture.ts 등
 */

export interface UserIdentity {
    id: string | null;              // users.id (UUID)
    email: string | null;
    username: string | null;        // 표시 이름
    employee_no: string | null;     // 사번
    org_code: string | null;        // 조직 코드 (예: '00004968')
    org_name: string | null;        // 조직명
    department_id: string | null;   // 부서 ID
    department_name: string | null; // 부서명
}

/**
 * backend.searchUsersByName 응답의 단일 항목을 UserIdentity 로 정규화한다.
 *
 * 백엔드 응답 필드명이 users 테이블 컬럼과 달라서 매핑이 필요하다
 * (name vs username, user_id vs id 등).
 */
export function userIdentityFromSearchResult(raw: any): UserIdentity {
    return {
        // id 슬롯은 실제 UUID 만. 사내 SSO 응답엔 UUID 가 없어서 보통 null.
        id: raw?.id ?? null,
        email: raw?.email ?? null,
        username: raw?.username ?? raw?.name ?? null,
        // 사내 SSO 의 user_id 는 사실상 사번(예: "skt1108666") 이라 employee_no 슬롯으로 매핑.
        employee_no: raw?.employee_no ?? raw?.user_id ?? null,
        // 사내 SSO 검색 응답은 org_id 로 옴, users 테이블은 org_code 로 있음 — 둘 다 같은 조직 코드라 통합
        org_code: raw?.org_code ?? raw?.org_id ?? null,
        org_name: raw?.org_name ?? null,
        department_id: raw?.department_id ?? null,
        department_name: raw?.department_name ?? null,
    };
}

// ─── format 함수 ─────────────────────────────────────────────
// lookup 결과(UserIdentity 또는 null) 를 사용처별 포맷 문자열로 변환.
// 미해결(null) 또는 username 누락 시 fallback 으로 떨어진다.

function pickName(u: UserIdentity | null, fallback: string): string {
    const candidate = (u?.username || u?.email || u?.employee_no || '').trim();
    return candidate || fallback;
}

function pickTeam(u: UserIdentity | null): string {
    return (u?.org_name || u?.department_name || '').trim();
}

/**
 * "권미연"
 * 좁은 칩·아이콘 라벨 등 이름만 보여주는 곳.
 */
export function formatIdentityName(u: UserIdentity | null, fallback = ''): string {
    return pickName(u, fallback);
}

/**
 * "권미연 (Platform Team)"
 * 리뷰 보드·담당자 다이얼로그 등 보통 폭의 셀.
 */
export function formatIdentityWithTeam(u: UserIdentity | null, fallback = ''): string {
    const name = pickName(u, fallback);
    if (!name) return fallback;
    const team = pickTeam(u);
    return team ? `${name} (${team})` : name;
}

/**
 * "권미연 / Platform Team / 10001234"
 * 감사 로그처럼 사번까지 명시해야 하는 곳.
 */
export function formatIdentityFull(u: UserIdentity | null, fallback = ''): string {
    if (!u) return fallback;
    const parts: string[] = [];
    if (u.username) parts.push(u.username);
    if (u.org_name) parts.push(u.org_name);
    if (u.employee_no) parts.push(u.employee_no);
    return parts.length > 0 ? parts.join(' / ') : fallback;
}

/**
 * "권미연\n(Platform Team)"
 * 휴지통 deleted_by · audit 트리거 호환 포맷.
 * (utils/softDeleteUser.ts 의 getCurrentUserForSoftDelete 와 동일 규약)
 */
export function formatIdentitySoftDelete(u: UserIdentity | null, fallback = 'Unknown'): string {
    const name = pickName(u, fallback);
    if (!name) return fallback;
    const team = pickTeam(u);
    return team ? `${name}\n(${team})` : name;
}
