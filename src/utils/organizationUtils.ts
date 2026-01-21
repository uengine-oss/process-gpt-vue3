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
        email?: string;
        pid?: string;
    };
    children?: OrganizationNode[];
}

interface TeamInfo {
    teamId: string;
    teamName: string;
}

/**
 * 트리 구조에서 특정 사용자의 부모 팀 노드를 찾는다
 * @param node - 현재 노드
 * @param userId - 찾고자 하는 사용자 ID
 * @param parentTeam - 현재까지 추적된 부모 팀
 * @returns 찾은 팀 정보 또는 null
 */
function findUserTeamInTree(
    node: OrganizationNode,
    userId: string,
    parentTeam: TeamInfo | null = null
): TeamInfo | null {
    if (!node) return null;

    // 현재 노드가 찾는 사용자인 경우
    if (node.id === userId || (node.data && node.data.id === userId)) {
        return parentTeam;
    }

    // 현재 노드가 팀인지 확인
    const isTeam = node.data && node.data.isTeam;
    const currentTeam: TeamInfo | null = isTeam
        ? { teamId: node.id, teamName: node.data?.name || node.id }
        : parentTeam;

    // 자식 노드들 탐색
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findUserTeamInTree(child, userId, currentTeam);
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
        const orgValue = typeof orgData.value === 'string'
            ? JSON.parse(orgData.value)
            : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            console.warn('[organizationUtils] 조직도 차트 구조를 찾을 수 없습니다');
            return null;
        }

        // 4. 조직도 트리에서 사용자의 팀 찾기
        const userTeam = findUserTeamInTree(organizationChart, userInfo.uid, null);

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

        const orgValue = typeof orgData.value === 'string'
            ? JSON.parse(orgData.value)
            : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            return null;
        }

        return findUserTeamInTree(organizationChart, userInfo.uid, null);
    } catch (error) {
        console.error('[organizationUtils] 사용자 팀 정보 조회 실패:', error);
        return null;
    }
}

/**
 * 트리에서 사용자가 속한 모든 조직 ID를 찾는다 (사용자 ID 및 상위 팀 ID 포함)
 * @param node - 현재 노드
 * @param userId - 찾고자 하는 사용자 ID
 * @param path - 현재까지의 경로 (팀 ID들)
 * @returns 사용자가 속한 모든 조직 ID 또는 null
 */
function findUserOrganizationsInTree(
    node: OrganizationNode,
    userId: string,
    path: string[] = []
): string[] | null {
    if (!node) return null;

    // 현재 노드가 팀인 경우 경로에 추가
    const isTeam = node.data && node.data.isTeam;
    const currentPath = isTeam ? [...path, node.id] : path;

    // 현재 노드가 찾는 사용자인 경우
    if (node.id === userId || (node.data && node.data.id === userId)) {
        return currentPath;
    }

    // 자식 노드들 탐색
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const result = findUserOrganizationsInTree(child, userId, currentPath);
            if (result) return result;
        }
    }

    return null;
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
        const orgValue = typeof orgData.value === 'string'
            ? JSON.parse(orgData.value)
            : orgData.value;

        const organizationChart = orgValue.chart || orgValue;

        if (!organizationChart) {
            console.warn('[organizationUtils] 조직도 차트 구조를 찾을 수 없습니다');
            return [];
        }

        // 4. 조직도 트리에서 사용자가 속한 모든 조직 찾기
        const organizations = findUserOrganizationsInTree(organizationChart, userInfo.uid, []);

        return organizations || [];
    } catch (error) {
        console.error('[organizationUtils] 사용자 조직 정보 조회 실패:', error);
        return [];
    }
}
