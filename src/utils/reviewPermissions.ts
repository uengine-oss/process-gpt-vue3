import { ROLES, hasRoleAtLeast } from '@/utils/roles';
import { getSsoUser } from '@/utils/ssoAuth';

export interface ReviewUserContext {
    role?: string | null;
    userId?: string | null;
    userName?: string | null;
    employeeNo?: string | null;
}

export interface ReviewStateLike {
    state?: string | null;
    submitted_by?: string | null;
    submitted_by_name?: string | null;
    submitted_by_id?: string | null;
    owner_id?: string | null;
    owner?: string | null;
    owner_name?: string | null;
    hq_status?: string | null;
    field_status?: string | null;
    pi_owners?: string[] | null;
    piOwners?: string[] | null;
    hq_owners?: string[] | null;
    hqOwners?: string[] | null;
    field_owners?: string[] | null;
    fieldOwners?: string[] | null;
    master_owner?: string | null;
    masterOwner?: string | null;
    unresolved_count?: number | string | null;
}

function normalizeText(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function normalizeIdentityAliases(value: string | null | undefined): string[] {
    const normalized = normalizeText(value);
    if (!normalized) return [];

    const aliases = new Set<string>([normalized]);
    const withoutTeamSuffix = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (withoutTeamSuffix) aliases.add(withoutTeamSuffix);
    return Array.from(aliases);
}

function matchesAnyUserCandidate(value: string | null | undefined, userCandidates: string[]): boolean {
    return normalizeIdentityAliases(value).some((alias) => userCandidates.includes(alias));
}

function getCurrentUserCandidates(user: ReviewUserContext): string[] {
    return [...getCurrentUserIdCandidates(user), ...getCurrentUserNameCandidates(user)];
}

function getCurrentUserIdCandidates(user: ReviewUserContext): string[] {
    const values = new Set<string>();
    const push = (value: string | null | undefined) => {
        const normalized = normalizeText(value);
        if (normalized) values.add(normalized);
    };

    push(user.userId);
    push(user.employeeNo);

    if (typeof window !== 'undefined') {
        push(window.localStorage.getItem('uid'));
        push(window.localStorage.getItem('employeeNo'));
    }

    const ssoUser = getSsoUser();
    push(ssoUser?.id);
    push(ssoUser?.employee_no);

    return Array.from(values);
}

function getCurrentUserNameCandidates(user: ReviewUserContext): string[] {
    const values = new Set<string>();
    const push = (value: string | null | undefined) => {
        const normalized = normalizeText(value);
        if (normalized) values.add(normalized);
    };

    push(user.userName);

    if (typeof window !== 'undefined') {
        push(window.localStorage.getItem('userName'));
        push(window.localStorage.getItem('email'));
        push(window.localStorage.getItem('author'));
        push((window as any).$userName || '');
    }

    const ssoUser = getSsoUser();
    push(ssoUser?.username);
    push(ssoUser?.email);

    return Array.from(values);
}

export function isReviewFinished(state: string | null | undefined): boolean {
    return ['published', 'rejected', 'cancelled', 'archived'].includes(String(state || '').toLowerCase());
}

export function isSelfReviewSubmission(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    if (!review) return false;

    const currentPiOwners = getPiOwnerList(review);
    if (currentPiOwners.length > 0) {
        return currentPiOwners.some((candidate) => matchesAnyUserCandidate(candidate, getCurrentUserCandidates(user)));
    }

    const primaryReviewIds = [review.submitted_by_id].map(normalizeText).filter(Boolean);
    const reviewIdCandidates = primaryReviewIds.length > 0 ? primaryReviewIds : [review.owner_id].map(normalizeText).filter(Boolean);
    const currentUserIds = getCurrentUserIdCandidates(user);
    if (reviewIdCandidates.some((candidate) => matchesAnyUserCandidate(candidate, currentUserIds))) {
        return true;
    }

    const primaryReviewNames = [review.submitted_by, review.submitted_by_name].map(normalizeText).filter(Boolean);
    const reviewNameCandidates =
        primaryReviewNames.length > 0 ? primaryReviewNames : [review.owner, review.owner_name].map(normalizeText).filter(Boolean);
    const currentUserNames = getCurrentUserNameCandidates(user);

    return reviewNameCandidates.some((candidate) => matchesAnyUserCandidate(candidate, currentUserNames));
}

export function canSubmitReview(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.EDITOR);
}

export function canCommentOnReview(
    role: string | null | undefined,
    review?: ReviewStateLike | null,
    user?: ReviewUserContext | null
): boolean {
    if (hasRoleAtLeast(role, ROLES.REVIEWER)) return true;
    if (review && user && isSelfReviewSubmission(review, user)) return true;
    return false;
}

export function canManageReview(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    if (!review) return false;
    if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) return false;
    if (isReviewFinished(review.state)) return false;
    if (isSelfReviewSubmission(review, user)) return false;
    return true;
}

export function isDesignatedOwner(
    ownerList: string[] | null | undefined,
    user: ReviewUserContext,
    options: { adminBypass?: boolean } = {}
): boolean {
    const { adminBypass = true } = options;
    if (adminBypass && hasRoleAtLeast(user.role, ROLES.ADMIN)) return true;

    const normalizedOwners = (ownerList || []).map(normalizeText).filter(Boolean);
    if (normalizedOwners.length === 0) return false;

    const userIdCandidates = getCurrentUserIdCandidates(user);
    const userNameCandidates = getCurrentUserNameCandidates(user);
    const allCandidates = [...userIdCandidates, ...userNameCandidates];
    return normalizedOwners.some((owner) => matchesAnyUserCandidate(owner, allCandidates));
}

function normalizeOwnerList(...values: Array<string | string[] | null | undefined>): string[] {
    const owners = new Set<string>();
    values.forEach((value) => {
        const list = Array.isArray(value) ? value : [value];
        list.forEach((item) => {
            const normalized = normalizeText(item);
            if (normalized) owners.add(normalized);
        });
    });
    return Array.from(owners);
}

function getPiOwnerList(review: ReviewStateLike | null | undefined): string[] {
    const explicitPiOwners = normalizeOwnerList(review?.pi_owners, review?.piOwners);
    return explicitPiOwners.length ? explicitPiOwners : normalizeOwnerList(review?.owner, review?.owner_name, review?.owner_id);
}

function getHQOwnerList(review: ReviewStateLike | null | undefined): string[] {
    return normalizeOwnerList(review?.hq_owners, review?.hqOwners);
}

function getFieldOwnerList(review: ReviewStateLike | null | undefined): string[] {
    return normalizeOwnerList(review?.field_owners, review?.fieldOwners);
}

function getPublicFeedbackOwnerList(review: ReviewStateLike | null | undefined): string[] {
    return normalizeOwnerList(getPiOwnerList(review), getHQOwnerList(review), getFieldOwnerList(review));
}

function getMasterOwnerList(review: ReviewStateLike | null | undefined): string[] {
    return normalizeOwnerList(review?.master_owner, review?.masterOwner);
}

export function canApproveHQReview(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    return (
        canManageReview(review, user) &&
        ['in_review', 'review'].includes(String(review?.state || '')) &&
        (review?.hq_status || 'pending') === 'pending' &&
        isDesignatedOwner(getHQOwnerList(review), user)
    );
}

export function canApproveFieldReview(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    return (
        canManageReview(review, user) &&
        ['in_review', 'review'].includes(String(review?.state || '')) &&
        (review?.field_status || 'pending') === 'pending' &&
        isDesignatedOwner(getFieldOwnerList(review), user)
    );
}

export function canRejectReview(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    if (!canManageReview(review, user)) return false;
    const state = String(review?.state || '');
    if (state === 'final_edit') {
        return isDesignatedOwner(getMasterOwnerList(review), user);
    }
    return ['in_review', 'review', 'public_feedback'].includes(state);
}

export function canEndPublicFeedbackReview(
    review: ReviewStateLike | null | undefined,
    user: ReviewUserContext,
    options: { bypassSelfCheckIfAdmin?: boolean } = {}
): boolean {
    if (!review) return false;
    if (String(review?.state || '') !== 'public_feedback') return false;
    if (!isDesignatedOwner(getPublicFeedbackOwnerList(review), user)) return false;

    const { bypassSelfCheckIfAdmin = false } = options;
    // admin 권한자에 한해 self-submission 체크 우회 — 본인 발의 공람도 조절 가능
    if (bypassSelfCheckIfAdmin && hasRoleAtLeast(user.role, ROLES.ADMIN)) {
        if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) return false;
        if (isReviewFinished(review.state)) return false;
        return true;
    }
    return canManageReview(review, user);
}

export function canPublishReview(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    if (!review) return false;
    if (!hasRoleAtLeast(user.role, ROLES.OWNER)) return false;
    if (isReviewFinished(review.state)) return false;
    if (isSelfReviewSubmission(review, user)) return false;
    if (!['final_edit', 'approved_level2'].includes(String(review.state || ''))) return false;
    return isDesignatedOwner(getMasterOwnerList(review), user);
}

export function canManageReopenRequest(review: ReviewStateLike | null | undefined, role: string | null | undefined): boolean {
    return !!review && String(review.state || '') === 'reopen_requested' && hasRoleAtLeast(role, ROLES.OWNER);
}

export function canRequestReopen(role: string | null | undefined): boolean {
    return hasRoleAtLeast(role, ROLES.REVIEWER);
}

export function canAccessApprovalInbox(review: ReviewStateLike | null | undefined, user: ReviewUserContext): boolean {
    if (!review) return false;

    // 승인함은 "지금 이 사용자가 다음 승인 단계를 실제로 처리할 수 있는 건"만 노출한다.
    if (['in_review', 'review'].includes(String(review.state || ''))) {
        return canApproveHQReview(review, user) || canApproveFieldReview(review, user);
    }

    if (String(review.state || '') === 'public_feedback') {
        return canEndPublicFeedbackReview(review, user);
    }

    if (String(review.state || '') === 'final_edit') {
        return canPublishReview(review, user) && Number(review.unresolved_count || 0) === 0;
    }

    if (String(review.state || '') === 'reopen_requested') {
        return canManageReopenRequest(review, user.role);
    }

    return false;
}
