import { writeActivityLog } from '@/services/activityAuditLog';

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestKind = 'signup' | 'role';
export interface MembershipRequest {
    id: string;
    user_id: string;
    username: string;
    email: string;
    status: RequestStatus;
    requested_role?: string;
    reason?: string;
    reject_reason?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
}
function client() {
    if (!window.$supabase) throw new Error('로그인 정보를 불러오지 못했습니다.');
    return window.$supabase;
}
export async function getMembership() {
    const { data, error } = await client().rpc('my_membership');
    if (error) throw error;
    return data as { status: RequestStatus | 'missing'; role?: string; is_admin?: boolean; tenant_id?: string; reject_reason?: string };
}
export async function listMembershipRequests(kind: RequestKind, status?: RequestStatus, mine = false) {
    const { data: sessionData, error: authError } = await client().auth.getSession();
    if (authError) throw authError;
    const user = sessionData.session?.user;
    if (!user) throw new Error('로그인이 필요합니다.');
    // 목록은 화면 표시 전용이고, 승인/반려는 request id(uuid)로 처리한다.
    // 그래서 이메일 마스킹 뷰를 읽는다 — 승인 권한자(admin)와 본인 신청에는
    // 뷰가 원본을 그대로 돌려주므로 승인 화면 동작은 그대로다.
    // (supabase/migrations/20260911_pii_masking.sql)
    const table = kind === 'signup' ? 'signup_requests' : 'admin_requests';
    const source = (window as any).$pal ? `${table}_masked` : table;
    let query = client().from(source).select('*')
        .eq('tenant_id', user.app_metadata.tenant_id).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (mine) query = query.eq('user_id', user.id);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MembershipRequest[];
}
export async function requestRole(requestedRole: string, reason: string) {
    const { error } = await client().rpc('request_membership_role', { requested_role: requestedRole, reason });
    if (error) throw error;
    // 활동 로그 (PAL 전용, 실패 무시) — RPC가 request id를 돌려주지 않아 신청자 user id를 target 으로 쓴다
    const { data: sessionData } = await client().auth.getSession();
    writeActivityLog({
        action: 'role_request_submit',
        target_type: 'role_request',
        target_id: sessionData?.session?.user?.id,
        target_name: requestedRole,
        after_value: { requested_role: requestedRole, reason }
    });
}
export async function reviewRequest(kind: RequestKind, id: string, decision: RequestStatus, reason = '', signupRole = 'viewer') {
    const { error } = await client().rpc('review_membership_request', {
        request_kind: kind, request_id: id, decision, review_reason: reason, signup_role: signupRole
    });
    if (error) throw error;
    // 활동 로그 (PAL 전용, 실패 무시)
    writeActivityLog({
        action: decision === 'approved' ? 'role_request_approve' : 'role_request_reject',
        target_type: 'role_request',
        target_id: id,
        after_value: { request_kind: kind, decision, review_reason: reason, signup_role: signupRole }
    });
}
export async function getRequestCounts() {
    const { data, error } = await client().rpc('membership_request_counts');
    if (error) throw error;
    return data as { signup: number; role: number; total: number };
}
