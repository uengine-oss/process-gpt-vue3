function normalizeRoleName(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
}

export function getStoredRoleList(): string[] {
    const roleSet = new Set<string>();

    const rolesValue = localStorage.getItem('roles') || '';
    rolesValue
        .split(',')
        .map((role) => normalizeRoleName(role))
        .filter(Boolean)
        .forEach((role) => roleSet.add(role));

    const singleRole = normalizeRoleName(localStorage.getItem('role'));
    if (singleRole) {
        roleSet.add(singleRole);
    }

    return Array.from(roleSet);
}

export function isSuperAdmin(): boolean {
    return normalizeRoleName(localStorage.getItem('role')) === 'superadmin';
}

export function isAdminUser(): boolean {
    return localStorage.getItem('isAdmin') === 'true';
}

export function hasProcessManagerRole(): boolean {
    return getStoredRoleList().includes('process-manager');
}

export function canManageProcess(): boolean {
    return isSuperAdmin() || isAdminUser() || hasProcessManagerRole();
}

/** admin만 lock 제약 없이 deleteLock/강제 체크아웃 가능. process-manager는 lock 걸린 대로 유지 */
export function canBypassLock(): boolean {
    return isAdminUser();
}
