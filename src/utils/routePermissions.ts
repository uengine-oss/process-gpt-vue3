/**
 * 사이드바 메뉴 + 권한 정의 단일 소스.
 *
 * VerticalSidebar.vue, RoleMenuMatrix.vue, 라우터 가드 모두 이 모듈에서 import.
 * 새 메뉴 추가·라벨 변경·권한 조정 시 이 파일 한 곳만 수정.
 *
 * 향후 menu_role_overrides DB 도입 시 이 파일이 "코드 기본값(fallback)" 역할을 그대로 수행.
 */
import { hasRoleAtLeast, type RoleType } from '@/utils/roles';
import { getMenuOverrideRole } from '@/utils/menuRoleOverrides';

/** 사이드바 섹션 키 */
export type SidebarSectionKey = 'process' | 'analytics' | 'admin' | 'notice' | 'request';

/** 사이드바 섹션 라벨 (한글) */
export const SECTION_LABELS: Record<SidebarSectionKey, string> = {
    process: '프로세스 관리',
    analytics: '분석',
    admin: '관리자',
    notice: '공지사항',
    request: '권한 신청'
};

/** 메뉴 정의 한 항목의 모양 */
export interface MenuDefinition {
    /** 라우트 경로 (path 없는 action 메뉴는 빈 문자열) */
    path: string;
    /** 사용자에게 표시할 한글 라벨 */
    label: string;
    /** 사이드바 섹션 */
    section: SidebarSectionKey;
    /** 사이드바 아이콘 키 */
    icon: string;
    /** 최소 접근 역할 (코드 기본값) */
    requiredRole: RoleType;
    /**
     * 데이터 접근 하한 — DB override 로도 이 역할 아래로는 낮출 수 없다.
     *
     * 화면이 읽는 테이블의 RLS 가 특정 역할 이상을 요구하는 경우 지정한다.
     * 하한보다 낮은 역할로 열어주면 페이지에는 들어오지만 RLS 가 행을 걸러
     * "빈 화면"만 보게 되므로, 그런 조합 자체를 허용하지 않는다.
     */
    minRole?: RoleType;
    /** 사이드바에서 숨김 (URL 직접 접근만 허용) */
    hiddenInSidebar?: boolean;
    /** path 대신 사이드바에서 액션 호출 */
    action?: string;
    /** 매트릭스(권한 조정 UI)에서 노출 제외 */
    excludeFromMatrix?: boolean;
}

/**
 * 전체 메뉴 정의.
 *
 * 변경 가이드
 *  - 신규 메뉴 추가: 아래 배열에 한 줄 추가 → 사이드바·라우터 가드·매트릭스 자동 반영
 *  - 사이드바에는 숨기고 URL 만 열어두기: hiddenInSidebar: true
 *  - 권한 신청 페이지처럼 매트릭스에서 보호되어야 하는 항목: excludeFromMatrix: true
 *  - path 없는 외부 링크/액션 메뉴: path: '', action: '<핸들러명>'
 */
export const MENU_DEFINITIONS: MenuDefinition[] = [
    // 프로세스
    {
        path: '/process-architecture',
        label: '프로세스 체계도',
        section: 'process',
        icon: 'sitemap',
        requiredRole: 'reviewer'
    },
    {
        path: '/todolist',
        label: '내 할일',
        section: 'process',
        icon: 'inbox',
        requiredRole: 'admin'
    },
    // {
    //     path: '/list-pages/instances',
    //     label: '프로세스 인스턴스',
    //     section: 'process',
    //     icon: 'in-progress',
    //     requiredRole: 'viewer'
    // },
    {
        path: '/review-board',
        label: '프로세스 리뷰 보드',
        section: 'process',
        icon: 'clipboard-check',
        requiredRole: 'editor',
        hiddenInSidebar: true
    },
    // {
    //     path: '/an-transformation-studio',
    //     label: 'AN 변환 스튜디오',
    //     section: 'process',
    //     icon: 'sparkles',
    //     requiredRole: 'admin'
    // },
    {
        path: '/call-activity-management',
        label: '프로세스 리스트',
        section: 'process',
        icon: 'delegation',
        requiredRole: 'owner'
    },

    // 분석
    {
        path: '/analysis-dashboard',
        label: '분석 대시보드',
        section: 'analytics',
        icon: 'dashboard',
        requiredRole: 'reviewer',
        // 승인상태(proc_def_approval_state) SELECT 가 reviewer+ RLS —
        // viewer 로 열어주면 상태·집계가 전부 비어 빈 그래프만 보인다.
        minRole: 'reviewer'
    },
    {
        path: '/analytics',
        label: '분석 대시보드',
        section: 'analytics',
        icon: 'dashboard',
        requiredRole: 'reviewer',
        minRole: 'reviewer',
        hiddenInSidebar: true,
        excludeFromMatrix: true
    },
    {
        path: '/ontology-explorer',
        label: '온톨로지 익스플로러',
        section: 'analytics',
        icon: 'sitemap',
        requiredRole: 'reviewer'
    },
    // {
    //     path: '/ontology-explorer-new',
    //     label: '온톨로지 익스플로러(신)',
    //     section: 'analytics',
    //     icon: 'sitemap',
    //     requiredRole: 'reviewer'
    // },

    // 관리자
    {
        path: '/admin-console/property-schemas',
        label: '속성 스키마',
        section: 'admin',
        icon: 'formList',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/data-freeze',
        label: '수정 잠금',
        section: 'admin',
        icon: 'lock',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/recycle-bin',
        label: '휴지통',
        section: 'admin',
        icon: 'trash',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/system-operations',
        label: '시스템 운영',
        section: 'admin',
        icon: 'settings',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/kpi-targets',
        label: 'KPI 목표',
        section: 'admin',
        icon: 'target',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/usage-adoption',
        label: '사용 활성도',
        section: 'admin',
        icon: 'graph-up-linear',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/audit-trail',
        label: '감사 로그',
        section: 'admin',
        icon: 'document',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/exec-instances',
        label: '실행 인스턴스',
        section: 'admin',
        icon: 'play-outline',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/governance-studio',
        label: '거버넌스 스튜디오',
        section: 'admin',
        icon: 'brain',
        requiredRole: 'admin',
        hiddenInSidebar: true,
        excludeFromMatrix: true
    },
    {
        path: '/policy-document',
        label: '사내 정책문서',
        section: 'admin',
        icon: 'submit-document',
        requiredRole: 'admin'
    },
    {
        path: '/admin-console/signup-approvals',
        label: '회원가입 승인',
        section: 'admin',
        icon: 'check-mark',
        requiredRole: 'admin',
        hiddenInSidebar: true,
        excludeFromMatrix: true
    },
    {
        path: '/admin-console/admin-requests',
        label: '역할 관리 / 권한 승인',
        section: 'admin',
        icon: 'user-admin',
        requiredRole: 'admin',
        excludeFromMatrix: true
    },
    {
        path: '/admin-console/suppliers',
        label: '내부조직역할 관리',
        section: 'admin',
        icon: 'users-group-rounded-line-duotone',
        requiredRole: 'owner'
    },
    {
        path: '/admin-console/organization-dmn-rules',
        label: '조직 DMN Rule 관리',
        section: 'admin',
        icon: 'sidebarDMN',
        requiredRole: 'owner',
        hiddenInSidebar: true
    },
    {
        path: '/admin-console/pi-flags',
        label: 'PI Flag',
        section: 'admin',
        icon: 'flag-line-duotone',
        requiredRole: 'owner'
    },
    {
        path: '/systems',
        label: '시스템 관리',
        section: 'admin',
        icon: 'server-line-duotone',
        requiredRole: 'owner'
    },
    {
        path: '/external-api-health',
        label: 'api 연동 상태',
        section: 'admin',
        icon: 'device-imac-cog',
        requiredRole: 'admin',
        hiddenInSidebar: true,
        excludeFromMatrix: true
    },
    {
        path: '/admin-console/task-types',
        label: 'Task 종류 설정',
        section: 'admin',
        icon: 'completed-task',
        requiredRole: 'admin'
    },
    {
        path: '/work-assignment',
        label: '업무분장',
        section: 'admin',
        icon: 'users-group-rounded-line-duotone',
        requiredRole: 'admin'
    },

    // 공지 (외부 confluence 페이지 — path 없음)
    {
        path: '',
        label: '공지사항',
        section: 'notice',
        icon: 'bell-bing-line-duotone',
        requiredRole: 'viewer',
        action: 'openNoticeConfluencePage',
        excludeFromMatrix: true
    },

    // 권한 신청 (모든 인증 사용자 접근, 매트릭스에서 보호)
    {
        path: '/admin-request',
        label: '권한 변경 신청',
        section: 'request',
        icon: 'user-admin',
        requiredRole: 'viewer',
        excludeFromMatrix: true
    }
];

/**
 * 경로 → 최소 접근 역할 매핑 (MENU_DEFINITIONS 에서 자동 파생).
 * 사이드바·라우터 가드의 권한 룩업에 사용.
 */
export const ROUTE_REQUIRED_ROLES: Record<string, RoleType> = Object.fromEntries(
    MENU_DEFINITIONS.filter((m) => m.path).map((m) => [m.path, m.requiredRole])
);

/**
 * 경로 → 데이터 접근 하한 매핑 (MENU_DEFINITIONS.minRole 에서 자동 파생).
 * DB override 가 이 값보다 낮아도 하한으로 끌어올려 판정한다.
 */
export const ROUTE_MIN_ROLES: Record<string, RoleType> = Object.fromEntries(
    MENU_DEFINITIONS.filter((m) => m.path && m.minRole).map((m) => [m.path, m.minRole as RoleType])
);

/** 정확 일치 → 최장 prefix 순으로 경로 매핑에서 값을 찾는다. (동적 라우트 /foo/:id 대응) */
function matchByPath<T>(table: Record<string, T>, path: string): T | null {
    if (path in table) return table[path];

    let matched: { path: string; value: T } | null = null;
    for (const [routePath, value] of Object.entries(table)) {
        if (path === routePath || path.startsWith(routePath + '/')) {
            if (!matched || routePath.length > matched.path.length) {
                matched = { path: routePath, value };
            }
        }
    }
    return matched ? matched.value : null;
}

/** 주어진 경로의 데이터 접근 하한 (없으면 null) */
export function lookupMinRole(path: string): RoleType | null {
    return matchByPath(ROUTE_MIN_ROLES, path);
}

/**
 * 주어진 경로의 최소 접근 역할을 반환.
 *
 * 판정 순서
 *   1순위 — DB override (menu_role_overrides 메모리 캐시)
 *   2순위 — 코드 기본값 ROUTE_REQUIRED_ROLES
 *   매칭 없음 — null (별도 권한 체크 없음, 인증 사용자 통과)
 *
 * 어느 쪽으로 판정되든 minRole(데이터 접근 하한) 아래로는 내려가지 않는다.
 * 하한보다 낮은 override 는 화면만 열어주고 RLS 가 데이터를 막아 빈 화면이 되므로,
 * override 를 무시하고 하한을 적용한다. (예: 분석 대시보드 viewer override → reviewer)
 */
export function lookupRequiredRole(path: string): RoleType | null {
    const minRole = lookupMinRole(path);
    const clamp = (role: RoleType): RoleType => (minRole && !hasRoleAtLeast(role, minRole) ? minRole : role);

    // 1순위: DB override
    const override = getMenuOverrideRole(path);
    if (override) return clamp(override);

    // 2순위: 코드 기본값 (정확 일치 후 prefix 매칭)
    const base = matchByPath(ROUTE_REQUIRED_ROLES, path);
    return base ? clamp(base) : null;
}
