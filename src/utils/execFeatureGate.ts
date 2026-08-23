/**
 * 실행(Exec) 기능 노출 게이트.
 *
 * 순서도의 실행 버튼 · Exec 모드 뷰어 · /executable 명령은 아직 시험 운영 단계라
 * 관리자(admin)에게만 노출한다. 나머지 사용자는 기존 UI(As-Is/To-Be)만 사용한다.
 * 판별 기준: 중앙 권한 상태 authClaimsState.isAdmin (role='admin' reconcile 포함).
 */
import { authClaimsState } from '@/utils/authClaims';

export function canUseExecFeatures(): boolean {
    return authClaimsState.isAdmin;
}
