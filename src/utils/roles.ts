/**
 * 역할 기반 접근 제어 (RBAC)
 *
 * | Role     | Actions                                                                      |
 * |----------|------------------------------------------------------------------------------|
 * | Admin    | Re-open 요청 승인, 시스템 전역 설정, 전체 로그 조회, 권한 강제 회수, 마스터 코드 관리 |
 * | Owner    | 프로세스 신규 생성, 프로세스 최종 승인/배포(Publish) 결정권                         |
 * | Editor   | 승인/반려(도메인별), 캔버스 모델링, 속성/FTE 입력, 승인 요청                       |
 * | Reviewer | Published 모델 및 분석 대시보드 조회, 공람 기간 댓글 작성                      |
 * | Viewer   | 공지사항 및 권한 신청 화면 조회                                                |
 */

export const ROLES = {
    ADMIN: 'admin',
    OWNER: 'owner',
    EDITOR: 'editor',
    REVIEWER: 'reviewer',
    VIEWER: 'viewer'
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

/** 역할 목록 (권한 높은 순서) */
export const ROLE_HIERARCHY: RoleType[] = [
    ROLES.ADMIN,
    ROLES.OWNER,
    ROLES.EDITOR,
    ROLES.REVIEWER,
    ROLES.VIEWER
];

/** 역할별 표시 정보 */
export const ROLE_META: Record<RoleType, { label: string; labelEn: string; color: string; icon: string; description: string }> = {
    [ROLES.ADMIN]: {
        label: '관리자',
        labelEn: 'Admin',
        color: 'error',
        icon: 'mdi-shield-crown',
        description: 'owner 권한 + 모든 프로세스 편집(소유자 제약 무시), 정의 관리(BPMN·룰) 사이드바, 점검 모드 진입'
    },
    [ROLES.OWNER]: {
        label: '소유자',
        labelEn: 'Owner',
        color: 'deep-purple',
        icon: 'mdi-account-key',
        description: 'editor 권한 + 리뷰 배포(Publish), Re-open 승인, 호출 액티비티 관리, 어드민 콘솔(스키마·KPI·감사로그·시스템관리 등)'
    },
    [ROLES.EDITOR]: {
        label: '편집자',
        labelEn: 'Editor',
        color: 'primary',
        icon: 'mdi-pencil',
        description: 'reviewer 권한 + 리뷰보드 진입, 본인 담당 프로세스 캔버스 편집, 리뷰 제출·승인/반려'
    },
    [ROLES.REVIEWER]: {
        label: '검토자',
        labelEn: 'Reviewer',
        color: 'orange',
        icon: 'mdi-eye',
        description: 'viewer 권한 + 분석 대시보드·체계도·BPMN 정의 조회, 리뷰 댓글, Re-open 요청'
    },
    [ROLES.VIEWER]: {
        label: '뷰어',
        labelEn: 'Viewer',
        color: 'grey',
        icon: 'mdi-eye-outline',
        description: '공지사항·관리자 요청 화면 조회'
    }
};

const ROLE_LEVEL: Record<string, number> = {
    [ROLES.ADMIN]: 100,
    [ROLES.OWNER]: 80,
    [ROLES.EDITOR]: 60,
    [ROLES.REVIEWER]: 40,
    [ROLES.VIEWER]: 20
};

function level(role: string | null | undefined): number {
    if (!role) return 0;
    return ROLE_LEVEL[role.toLowerCase()] ?? 0;
}

/** is_admin=true 또는 role이 없는 기존 사용자를 새 역할로 변환 */
export function resolveRole(isAdmin: boolean | undefined, role: string | null | undefined): RoleType {
    if (role && ROLE_LEVEL[role.toLowerCase()]) {
        return role.toLowerCase() as RoleType;
    }
    return isAdmin ? ROLES.ADMIN : ROLES.VIEWER;
}

/** 특정 역할 이상인지 확인 */
export function hasRoleAtLeast(userRole: string | null | undefined, requiredRole: RoleType): boolean {
    return level(userRole) >= level(requiredRole);
}

// --- 편의 함수 ---

export function isAdmin(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.ADMIN);
}

export function isOwnerOrAbove(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.OWNER);
}

export function isEditorOrAbove(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.EDITOR);
}

export function isReviewerOrAbove(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.REVIEWER);
}

export function canEdit(role: string | null | undefined): boolean {
    return isEditorOrAbove(role);
}

export function canPublish(role: string | null | undefined): boolean {
    return isOwnerOrAbove(role);
}

export function canComment(role: string | null | undefined): boolean {
    return isReviewerOrAbove(role);
}
