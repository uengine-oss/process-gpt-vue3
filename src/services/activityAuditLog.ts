import type { Router } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import { lookupMenuLabel } from '@/utils/routePermissions';

/**
 * 활동 로그(admin_audit_log) 공용 기록 헬퍼.
 *
 * - PAL 모드 전용: 비 PAL 에서는 아무것도 하지 않는다 (insertAdminAuditLog 가 PalModeBackend 에만 존재).
 * - 로그 실패가 본 기능 흐름을 깨면 안 되므로 예외는 전부 삼킨다 (record_auth_audit 과 같은 관례).
 * - 컴포넌트에서는 adminConsole 스토어의 writeAdminAuditLog 를 써도 되고,
 *   pinia 밖(서비스·라우터 훅)에서는 이 함수를 쓴다. 두 경로 모두 같은 테이블에 적재된다.
 */
export interface ActivityLogEntry {
    action: string;
    target_type: string;
    target_id?: string;
    target_name?: string;
    before_value?: any;
    after_value?: any;
    comment?: string;
}

export function writeActivityLog(entry: ActivityLogEntry): void {
    if (!(window as any).$pal) return;
    try {
        const backend = BackendFactory.createBackend() as any;
        Promise.resolve(backend.insertAdminAuditLog?.(entry)).catch((e: any) => {
            console.error('[activityAuditLog] 기록 실패:', e);
        });
    } catch (e) {
        console.error('[activityAuditLog] 기록 실패:', e);
    }
}

/**
 * 페이지 조회(page_view) 로그 대상 라우트.
 * 사용자·관리자 활성 페이지 전체 — 하위 경로(prefix) 포함.
 */
const PAGE_VIEW_PREFIXES = [
    '/process-architecture',
    '/process-hierarchy',
    '/version-comparison',
    '/review-board',
    '/call-activity-management',
    '/glossary',
    '/organization',
    '/organization-before',
    '/admin-request',
    '/analysis-dashboard',
    '/admin-console'
];

/** MENU_DEFINITIONS 에 없는 라우트의 한글 라벨 보강 (사이드바 미노출 페이지) */
const EXTRA_ROUTE_LABELS: Record<string, string> = {
    '/process-hierarchy': '프로세스 순서도',
    '/version-comparison': '프로세스 버전 비교'
};

function isTrackedPath(path: string): boolean {
    return PAGE_VIEW_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

function pageLabel(path: string): string {
    const extra = Object.keys(EXTRA_ROUTE_LABELS).find((p) => path === p || path.startsWith(p + '/'));
    if (extra) return EXTRA_ROUTE_LABELS[extra];
    return lookupMenuLabel(path) || path;
}

let lastLoggedKey: string | null = null;

/**
 * 라우트 진입 시 page_view 활동 로그를 남긴다. main.ts 에서 PAL 모드일 때만 호출.
 * 같은 path 연속 진입(쿼리만 변경)은 중복 적재하지 않는다.
 * 단, 프로세스 순서도는 어떤 프로세스를 보는지가 쿼리(id)로 전달되므로
 * 프로세스가 바뀌면 별도 조회로 기록한다.
 */
export function startPageViewLogging(router: Router): void {
    router.afterEach((to) => {
        const path = to.path;
        if (!isTrackedPath(path)) {
            lastLoggedKey = null;
            return;
        }

        // 순서도류 페이지: 조회 대상 프로세스(쿼리 id·name)까지 로그에 포함
        const isProcessView = path === '/process-hierarchy' || path.startsWith('/process-hierarchy/') || path === '/version-comparison';
        const procId = isProcessView && typeof to.query.id === 'string' ? to.query.id : '';
        const procName = isProcessView && typeof to.query.name === 'string' ? to.query.name : '';

        const key = procId ? `${path}?id=${procId}` : path;
        if (key === lastLoggedKey) return;
        lastLoggedKey = key;

        // 단순 조회이므로 변경 내역(before/after)은 남기지 않는다.
        // 조회 대상 프로세스는 target_id(프로세스 id)·target_name(페이지명(프로세스명))으로 식별한다.
        const label = pageLabel(path);
        writeActivityLog({
            action: 'page_view',
            target_type: 'page',
            target_id: procId || path,
            target_name: procName ? `${label}(${procName})` : label
        });
    });
}
