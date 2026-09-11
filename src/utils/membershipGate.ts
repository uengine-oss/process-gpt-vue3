import { getMembership } from '@/services/membershipService';
import { applyMembershipClaims } from '@/utils/authClaims';
export const SIGNUP_PENDING_PATH = '/auth/signup-pending';

export async function membershipRedirect(path: string): Promise<string | null> {
    if (!window.$pal || path.startsWith('/auth/') || path.startsWith('/external-forms/') || path.startsWith('/design-system')) return null;
    const { data, error } = await window.$supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return '/auth/login';
    const membership = await getMembership();
    applyMembershipClaims(membership);
    return membership.status === 'approved' ? null : SIGNUP_PENDING_PATH;
}
