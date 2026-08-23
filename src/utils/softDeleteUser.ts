/**
 * 휴지통 소프트 삭제용 사용자 표시 문자열 생성
 *
 * SSO 환경에서는 supabase.auth.getUser() 가 AuthSessionMissingError 를 던지기 때문에
 * SSO 로그인 시 localStorage 에 저장된 사용자 정보 ([utils/ssoAuth.ts]) 를 우선 사용한다.
 *
 * 반환 포맷: "이름\n(팀)"  (proc_def / tb_bpmn_model 와 동일 표준)
 *   - 이름은 있고 팀이 없으면: "이름"
 *   - 이름이 없으면 fallback "Unknown"
 */
export function getCurrentUserForSoftDelete(): string {
    const name =
        (window.localStorage.getItem('userName') || '').trim() ||
        (window.localStorage.getItem('email') || '').trim();
    const team = (window.localStorage.getItem('orgName') || '').trim();

    if (!name) return 'Unknown';
    return team ? `${name}\n(${team})` : name;
}
