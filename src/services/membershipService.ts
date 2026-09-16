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
    let query = client().from(kind === 'signup' ? 'signup_requests' : 'admin_requests').select('*')
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
}
export async function reviewRequest(kind: RequestKind, id: string, decision: RequestStatus, reason = '', signupRole = 'viewer') {
    const { error } = await client().rpc('review_membership_request', {
        request_kind: kind, request_id: id, decision, review_reason: reason, signup_role: signupRole
    });
    if (error) throw error;
}
export async function getRequestCounts() {
    const { data, error } = await client().rpc('membership_request_counts');
    if (error) throw error;
    return data as { signup: number; role: number; total: number };
}
