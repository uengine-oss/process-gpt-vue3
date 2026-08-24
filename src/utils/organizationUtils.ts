/**
 * Organization Utilities
 * 조직도에서 사용자 정보를 조회하는 유틸리티 함수
 */

import BackendFactory from '@/components/api/BackendFactory';

interface OrganizationNode {
    id: string;
    data?: {
        id?: string;
        name?: string;
        isTeam?: boolean;
        isAgent?: boolean;
        email?: string;
        pid?: string;
        org_code?: string;
        org_name?: string;
    };
    children?: OrganizationNode[];
}

interface TeamInfo {
    teamId: string;
    teamName: string;
}

function normalizeIdentifier(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function addIdentifier(target: Set<string>, value: unknown) {
    const normalized = normalizeIdentifier(value);
    if (normalized) target.add(normalized);
}

function nodeMatchesTeam(node: OrganizationNode, teamKeys: Set<string>): boolean {
    if (!node?.data?.isTeam || teamKeys.size === 0) return false;

    return [node.id, node.data?.id, node.data?.name, node.data?.org_code, node.data?.org_name].some((value) =>
        teamKeys.has(normalizeIdentifier(value))
    );
}

/**
 * 노드가 주어진 사용자 식별자 중 하나와 매칭되는지 확인한다
 * (uid, email, name 등 여러 형태로 저장될 수 있으므로 복수 식별자로 비교)
 */
function nodeMatchesUser(node: OrganizationNode, userIds: Set<string>): boolean {
    if (userIds.has(normalizeIdentifier(node.id))) return true;
    if (node.data) {
        if (userIds.has(normalizeIdentifier(node.data.id))) return true;
        if (userIds.has(normalizeIdentifier(node.data.email))) return true;
        if (userIds.has(normalizeIdentifier(node.data.name))) return true;
    }
    return false;
}

/**
 * 트리 구조에서 특정 사용자의 부모 팀 노드를 찾는다
 * @param node - 현재 노드
 * @param userIds - 찾고자 하는 사용자 식별자 Set (uid, email, name 등)
 * @param parentTeam - 현재까지 추적된 부모 팀
 * @returns 찾은 팀 정보 또는 null
 */
function findUserTeamInTree(node: OrganizationNode, userIds: Set<string>, parentTeam: TeamInfo | null = null): TeamInfo | null {
    if (!node) return null;

    // 현재 노드가 찾는 사용자인 경우
    if (nodeMatchesUser(node, userIds)) {
        return parentTeam;
    }

    // 현재 노드가 팀인지 확인
    const isTeam = node.data && node.data.isTeam;
    const currentTeam: TeamInfo | null = isTeam ? { teamId: node.id, teamName: node.data?.name || node.id } : parentTeam;

    // 자식 노드들 탐색
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findUserTeamInTree(child, userIds, currentTeam);
            if (result) return result;
        }
    }

    return null;
}

function findUserTeamNodeInTree(
    node: OrganizationNode,
    userIds: Set<string>,
    parentTeamNode: OrganizationNode | null = null
): OrganizationNode | null {
    if (!node) return null;

    if (nodeMatchesUser(node, userIds)) {
        return parentTeamNode;
    }

    const isTeam = node.data && node.data.isTeam;
    const currentTeamNode = isTeam ? node : parentTeamNode;

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findUserTeamNodeInTree(child, userIds, currentTeamNode);
            if (result) return result;
        }
    }

    return null;
}

/**
 * 사용자 정보로부터 조직도 매칭에 사용할 식별자 Set을 만든다
 */
function buildUserIdSet(userInfo: { uid?: string; email?: string; name?: string; employee_no?: string }): Set<string> {
    const ids = new Set<string>();
    for (const v of [
        userInfo.uid,
        userInfo.email,
        userInfo.name,
        userInfo.employee_no,
        localStorage.getItem('uid'),
        localStorage.getItem('email'),
        localStorage.getItem('userName'),
        localStorage.getItem('employeeNo')
    ]) {
        const n = normalizeIdentifier(v);
        if (n) ids.add(n);
    }
    return ids;
}

function buildUserOrgKeySet(userInfo: { org_code?: string; org_name?: string }): Set<string> {
    const keys = new Set<string>();
    addIdentifier(keys, userInfo.org_code);
    addIdentifier(keys, userInfo.org_name);
    addIdentifier(keys, localStorage.getItem('orgName'));
    return keys;
}

function findTeamNodeByOrgContext(node: OrganizationNode, teamKeys: Set<string>): OrganizationNode | null {
    if (!node) return null;

    if (nodeMatchesTeam(node, teamKeys)) {
        return node;
    }

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findTeamNodeByOrgContext(child, teamKeys);
            if (result) return result;
        }
    }

    return null;
}

/**
 * 현재 로그인 사용자의 소속 팀명을 가져온다
 * @returns 팀명 또는 null
 */
export async function getCurrentUserTeamName(): Promise<string | null> {
    try {
        const backend = BackendFactory.createBackend();

        // 1. 현재 사용자 정보 조회
        const userInfo = await backend.getUserInfo();
        if (!userInfo || !userInfo.uid) {
            console.warn('[organizationUtils] 사용자 정보를 찾을 수 없습니다');
            return null;
        }

        // 2. 조직도 데이터 조회
        const orgData = await backend.getData('configuration', {
            match: { key: 'organization' }
        });

        if (!orgData || !orgData.value) {
            console.warn('[organizationUtils] 조직도 데이터를 찾을 수 없습니다');
            return null;
        }

        // 3. 조직도 차트 추출 (value가 문자열일 수 있음)
        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            console.warn('[organizationUtils] 조직도 차트 구조를 찾을 수 없습니다');
            return null;
        }

        // 4. 조직도 트리에서 사용자의 팀 찾기 (uid, email, name 모두 시도)
        const userIdSet = buildUserIdSet(userInfo);
        const userTeam = findUserTeamInTree(organizationChart, userIdSet, null);

        if (userTeam && userTeam.teamName) {
            return userTeam.teamName;
        }

        return null;
    } catch (error) {
        console.error('[organizationUtils] 사용자 팀 정보 조회 실패:', error);
        return null;
    }
}

/**
 * 현재 로그인 사용자의 소속 팀 정보를 가져온다
 * @returns 팀 정보 (teamId, teamName) 또는 null
 */
export async function getCurrentUserTeamInfo(): Promise<TeamInfo | null> {
    try {
        const backend = BackendFactory.createBackend();

        const userInfo = await backend.getUserInfo();
        if (!userInfo || !userInfo.uid) {
            return null;
        }

        const orgData = await backend.getData('configuration', {
            match: { key: 'organization' }
        });

        if (!orgData || !orgData.value) {
            return null;
        }

        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            return null;
        }

        const userIdSet = buildUserIdSet(userInfo);
        return findUserTeamInTree(organizationChart, userIdSet, null);
    } catch (error) {
        console.error('[organizationUtils] 사용자 팀 정보 조회 실패:', error);
        return null;
    }
}

/**
 * 트리에서 사용자가 속한 모든 조직 ID를 찾는다 (사용자 ID 및 상위 팀 ID 포함)
 * @param node - 현재 노드
 * @param userIds - 찾고자 하는 사용자 식별자 Set
 * @param path - 현재까지의 경로 (팀 ID들)
 * @returns 사용자가 속한 모든 조직 ID 또는 null
 */
function findUserOrganizationsInTree(node: OrganizationNode, userIds: Set<string>, path: string[] = []): string[] | null {
    if (!node) return null;

    // 현재 노드가 팀인 경우 경로에 추가
    const isTeam = node.data && node.data.isTeam;
    const currentPath = isTeam ? [...path, node.id] : path;

    // 현재 노드가 찾는 사용자인 경우
    if (nodeMatchesUser(node, userIds)) {
        return currentPath;
    }

    // 자식 노드들 탐색
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findUserOrganizationsInTree(child, userIds, currentPath);
            if (result) return result;
        }
    }

    return null;
}

/**
 * 주어진 팀 ID 목록에 속한 모든 멤버의 이메일(또는 id)을 수집한다
 */
function collectMemberEmailsFromTeams(node: OrganizationNode, teamIds: Set<string>, collecting = false): string[] {
    if (!node) return [];

    const isTeam = node.data && node.data.isTeam;
    const shouldCollect = collecting || (isTeam && teamIds.has(node.id));

    const emails: string[] = [];

    // 팀이 아닌 리프 노드(사용자)인 경우 이메일 수집
    if (!isTeam && shouldCollect) {
        const email = node.data?.email || '';
        if (email) emails.push(email);
    }

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            emails.push(...collectMemberEmailsFromTeams(child, teamIds, shouldCollect));
        }
    }

    return emails;
}

function collectTeamMemberIdentifiers(teamNode: OrganizationNode): string[] {
    const identifiers = new Set<string>();

    const walk = (node: OrganizationNode | null | undefined) => {
        if (!node) return;

        if (!node.data?.isTeam) {
            addIdentifier(identifiers, node.id);
            addIdentifier(identifiers, node.data?.id);
            addIdentifier(identifiers, node.data?.email);
            addIdentifier(identifiers, node.data?.name);
            return;
        }

        for (const child of node.children || []) {
            walk(child);
        }
    };

    walk(teamNode);

    return [...identifiers];
}

function collectTeamIdentifiers(teamNode: OrganizationNode): string[] {
    const identifiers = new Set<string>();
    addIdentifier(identifiers, teamNode.id);
    addIdentifier(identifiers, teamNode.data?.id);
    addIdentifier(identifiers, teamNode.data?.name);
    addIdentifier(identifiers, teamNode.data?.org_code);
    addIdentifier(identifiers, teamNode.data?.org_name);
    return [...identifiers];
}

/**
 * 현재 로그인 사용자가 속한 모든 조직 ID를 가져온다
 * 권한 체크 시 사용 (팀 기반 권한 포함)
 * @returns 조직 ID 배열 또는 빈 배열
 */
export async function getCurrentUserOrganizations(): Promise<string[]> {
    try {
        const backend = BackendFactory.createBackend();

        // 1. 현재 사용자 정보 조회
        const userInfo = await backend.getUserInfo();
        if (!userInfo || !userInfo.uid) {
            console.warn('[organizationUtils] 사용자 정보를 찾을 수 없습니다');
            return [];
        }

        // 2. 조직도 데이터 조회
        const orgData = await backend.getData('configuration', {
            match: { key: 'organization' }
        });

        if (!orgData || !orgData.value) {
            console.warn('[organizationUtils] 조직도 데이터를 찾을 수 없습니다');
            return [];
        }

        // 3. 조직도 차트 추출
        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            console.warn('[organizationUtils] 조직도 차트 구조를 찾을 수 없습니다');
            return [];
        }

        // 4. 조직도 트리에서 사용자가 속한 모든 조직 찾기 (uid, email, name 모두 시도)
        const userIdSet = buildUserIdSet(userInfo);
        const organizations = findUserOrganizationsInTree(organizationChart, userIdSet, []);

        return organizations || [];
    } catch (error) {
        console.error('[organizationUtils] 사용자 조직 정보 조회 실패:', error);
        return [];
    }
}

/**
 * 현재 로그인 사용자와 같은 조직(팀)에 속한 모든 멤버의 이메일 목록을 가져온다
 * @returns 이메일 배열 또는 빈 배열
 */
export async function getCurrentUserOrgMemberEmails(): Promise<string[]> {
    try {
        const backend = BackendFactory.createBackend();
        const userInfo = await backend.getUserInfo();
        if (!userInfo || !userInfo.uid) return [];

        const orgData = await backend.getData('configuration', { match: { key: 'organization' } });
        if (!orgData || !orgData.value) return [];

        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
        const organizationChart = orgValue.chart || orgValue;
        if (!organizationChart) return [];

        // 사용자가 속한 팀 ID 목록 (uid, email, name 모두 시도)
        const userIdSet = buildUserIdSet(userInfo);
        const orgIds = findUserOrganizationsInTree(organizationChart, userIdSet, []);
        if (!orgIds || orgIds.length === 0) return [];

        // 해당 팀들에 속한 모든 멤버 이메일 수집
        return collectMemberEmailsFromTeams(organizationChart, new Set(orgIds));
    } catch (error) {
        console.error('[organizationUtils] 조직 멤버 이메일 조회 실패:', error);
        return [];
    }
}

/**
 * 현재 로그인 사용자가 속한 "직속 팀"의 멤버 식별자 목록을 가져온다.
 * owner 값이 uid/email/name 중 무엇으로 저장되어 있어도 비교할 수 있도록 여러 식별자를 수집한다.
 */
export async function getCurrentUserTeamMemberIdentifiers(): Promise<string[]> {
    try {
        const backend = BackendFactory.createBackend();
        const userInfo = await backend.getUserInfo();
        if (!userInfo) return [];

        const orgData = await backend.getData('configuration', { match: { key: 'organization' } });
        if (!orgData || !orgData.value) return [];

        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
        const organizationChart = orgValue.chart || orgValue;
        if (!organizationChart) return [];

        const userIdSet = buildUserIdSet(userInfo);
        console.log('[organizationUtils] userIdSet:', [...userIdSet]);
        const orgKeySet = buildUserOrgKeySet(userInfo);
        let teamNode = findUserTeamNodeInTree(organizationChart, userIdSet, null);
        if (!teamNode && orgKeySet.size > 0) {
            teamNode = findTeamNodeByOrgContext(organizationChart, orgKeySet);
            console.log('[organizationUtils] fallback teamNode by org context:', teamNode?.id, teamNode?.data?.name);
        }
        console.log('[organizationUtils] teamNode:', teamNode?.id, teamNode?.data?.name, 'children:', teamNode?.children?.length);
        if (!teamNode) {
            console.warn('[organizationUtils] 직속 팀을 찾지 못했습니다. userIdSet:', [...userIdSet], 'orgKeySet:', [...orgKeySet]);
            return [...userIdSet];
        }

        const identifiers = collectTeamMemberIdentifiers(teamNode);
        for (const value of userIdSet) identifiers.push(value);
        console.log('[organizationUtils] team member identifiers:', identifiers);
        return identifiers;
    } catch (error) {
        console.error('[organizationUtils] 팀 멤버 식별자 조회 실패:', error);
        return [];
    }
}

/**
 * 현재 로그인 사용자가 속한 "직속 팀" 자체의 식별자 목록을 가져온다.
 * BPMN laneOrganization 이 팀 id/name 중 무엇으로 저장되어 있어도 비교할 수 있도록 여러 식별자를 수집한다.
 */
export async function getCurrentUserTeamIdentifiers(): Promise<string[]> {
    try {
        const backend = BackendFactory.createBackend();
        const userInfo = await backend.getUserInfo();
        if (!userInfo) return [];

        const orgData = await backend.getData('configuration', { match: { key: 'organization' } });
        if (!orgData || !orgData.value) return [];

        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
        const organizationChart = orgValue.chart || orgValue;
        if (!organizationChart) return [];

        const userIdSet = buildUserIdSet(userInfo);
        const orgKeySet = buildUserOrgKeySet(userInfo);
        let teamNode = findUserTeamNodeInTree(organizationChart, userIdSet, null);
        if (!teamNode && orgKeySet.size > 0) {
            teamNode = findTeamNodeByOrgContext(organizationChart, orgKeySet);
        }

        if (!teamNode) return [];
        return collectTeamIdentifiers(teamNode);
    } catch (error) {
        console.error('[organizationUtils] 팀 식별자 조회 실패:', error);
        return [];
    }
}
