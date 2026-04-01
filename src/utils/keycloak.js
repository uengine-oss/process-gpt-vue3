/**
 * Keycloak 인스턴스를 가져오는 함수 (전역에 저장된 경우)
 * @returns {Object|null} Keycloak 인스턴스 또는 null
 */
function getKeycloakInstance() {
    // window.$keycloak에 저장되어 있는지 확인
    if (window.$keycloak) {
        return window.$keycloak;
    }
    return null;
}

/**
 * Keycloak 액세스 토큰을 가져오는 유틸리티 함수
 * @returns {string|null} Keycloak 액세스 토큰 또는 null
 */
export function getKeycloakToken() {
    // 방법 1: Keycloak 인스턴스에서 직접 가져오기 (가장 정확)
    const keycloak = getKeycloakInstance();
    if (keycloak && keycloak.token) {
        return keycloak.token;
    }

    // 방법 2: localStorage에서 가져오기 (main.ts에서 저장)
    // uEngine 모드에서는 'keycloak' 키를 우선 사용
    if (window.$mode === 'uEngine') {
        return localStorage.getItem('keycloak') || localStorage.getItem('accessToken');
    }
    // 다른 모드에서는 'accessToken' 우선
    return localStorage.getItem('accessToken') || localStorage.getItem('keycloak');
}

/**
 * Keycloak 리프레시 토큰을 가져오는 함수
 * @returns {string|null} 리프레시 토큰 또는 null
 */
export function getKeycloakRefreshToken() {
    const keycloak = getKeycloakInstance();
    if (keycloak && keycloak.refreshToken) {
        return keycloak.refreshToken;
    }
    return localStorage.getItem('refreshToken') || null;
}

/**
 * Keycloak ID 토큰을 가져오는 함수
 * @returns {string|null} ID 토큰 또는 null
 */
export function getKeycloakIdToken() {
    const keycloak = getKeycloakInstance();
    if (keycloak && keycloak.idToken) {
        return keycloak.idToken;
    }
    return localStorage.getItem('idToken') || null;
}

/**
 * Keycloak 토큰 정보를 파싱하여 가져오는 함수
 * @returns {Object|null} 파싱된 토큰 정보 또는 null
 */
export function getKeycloakTokenParsed() {
    const keycloak = getKeycloakInstance();
    if (keycloak && keycloak.tokenParsed) {
        return keycloak.tokenParsed;
    }

    // localStorage에서 토큰을 가져와서 파싱 시도
    const token = getKeycloakToken();
    if (token) {
        try {
            // JWT 토큰은 base64로 인코딩된 3부분으로 구성: header.payload.signature
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.warn('Failed to parse token:', e);
        }
    }
    return null;
}

/** JWT 문자열에서 payload 객체만 파싱 (sub 등) */
function parseJwtPayloadString(jwt) {
    if (!jwt || typeof jwt !== 'string') return null;
    try {
        const base64Url = jwt.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * Keycloak 사용자 고유 ID (OIDC `sub` 클레임). Admin API UserRepresentation.`id`와 동일한 UUID.
 * 액세스/ID 토큰·인스턴스·localStorage uid 순으로 시도.
 * @returns {string} 사용자 UUID 또는 빈 문자열
 */
export function getKeycloakSubject() {
    const keycloak = getKeycloakInstance();
    if (keycloak?.tokenParsed?.sub) return String(keycloak.tokenParsed.sub).trim();
    if (keycloak?.idTokenParsed?.sub) return String(keycloak.idTokenParsed.sub).trim();

    const fromAccess = getKeycloakTokenParsed();
    if (fromAccess?.sub) return String(fromAccess.sub).trim();

    const idTok = getKeycloakIdToken();
    const idPayload = parseJwtPayloadString(idTok);
    if (idPayload?.sub) return String(idPayload.sub).trim();

    const at = getKeycloakToken();
    const accessPayload = parseJwtPayloadString(at);
    if (accessPayload?.sub) return String(accessPayload.sub).trim();

    if (typeof localStorage !== 'undefined') {
        const uid = localStorage.getItem('uid');
        if (uid) return uid.trim();
    }
    return '';
}

/** UUID 형태면 true (Keycloak user id) */
function looksLikeKeycloakUserId(s) {
    const t = String(s || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

/**
 * Keycloak 사용자 `id` (Admin API 사용자 목록의 id 컬럼, OIDC sub와 동일한 UUID).
 * 로그인 후 localStorage `uid`에 두는 값과 일치시키는 것을 우선한다.
 * BPMN PUT `updatedByName`·X-User-Id 헤더 등 저장용.
 * @returns {string}
 */
export function getKeycloakUserIdForSave() {
    if (typeof localStorage !== 'undefined') {
        const fromLs = localStorage.getItem('uid');
        if (fromLs && looksLikeKeycloakUserId(fromLs)) {
            return fromLs.trim();
        }
    }
    const sub = getKeycloakSubject();
    return sub ? sub.trim() : '';
}

/**
 * Keycloak Admin API를 통해 전체 그룹 목록 가져오기
 * @param {string} token - Keycloak 액세스 토큰
 * @param {string} keycloakUrl - Keycloak 서버 URL
 * @param {string} realm - Realm 이름
 * @returns {Promise<string[]>} 그룹 이름 배열
 */
async function getGroupsFromAdminAPI(token, keycloakUrl, realm) {
    try {
        // GET /admin/realms/{realm}/groups - 전체 그룹 계층 구조 가져오기
        // populateHierarchy=true: 모든 하위 그룹 포함 (기본값이지만 명시적으로 설정)
        // search 또는 q 파라미터를 사용하면 subGroups가 반환됨
        const adminUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups?populateHierarchy=true`;
        const response = await fetch(adminUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const groups = await response.json();
            // 그룹 이름만 추출 (중첩된 그룹도 처리)
            const extractGroupNames = (groupList) => {
                const names = [];
                groupList.forEach((group) => {
                    if (group.name) {
                        names.push(group.name);
                    }
                    // 하위 그룹이 있는 경우 재귀적으로 처리
                    if (group.subGroups && group.subGroups.length > 0) {
                        names.push(...extractGroupNames(group.subGroups));
                    }
                });
                return names;
            };
            return extractGroupNames(groups).filter((g) => g && g.trim());
        } else if (response.status === 401) {
            const errorText = await response.text().catch(() => '');
            console.error('Keycloak Admin API 401 Unauthorized:', errorText);
            console.error('토큰이 만료되었거나 유효하지 않습니다. 토큰을 갱신해주세요.');
            return null;
        } else if (response.status === 403) {
            const errorText = await response.text().catch(() => '');
            console.error('Keycloak Admin API 403 Forbidden:', errorText);
            console.error('=== Admin API 접근 권한이 필요합니다 ===');
            console.error('해결 방법:');
            console.error('1. Keycloak Admin Console에 접속');
            console.error('2. Realm Settings > Users > Realm roles 또는');
            console.error('3. Users > [사용자 선택] > Role Mappings > Client roles > realm-management');
            console.error('4. 다음 역할들을 할당:');
            console.error('   - view-users (사용자 목록 조회)');
            console.error('   - query-groups (그룹 조회)');
            console.error('   - view-realm (Realm 정보 조회)');
            console.error('5. 또는 Service Account를 사용하여 Admin API 접근');
            return null;
        } else {
            const errorText = await response.text().catch(() => '');
            console.error('Admin API error:', response.status, response.statusText, errorText);
            return null;
        }
    } catch (error) {
        console.warn('Failed to fetch from Admin API:', error);
        return null;
    }
}

/**
 * Keycloak Admin API를 통해 전체 그룹 목록을 id, name 포함해 가져오기 (접근 권한 등에서 사용)
 * @param {string} token - Keycloak 액세스 토큰
 * @param {string} keycloakUrl - Keycloak 서버 URL
 * @param {string} realm - Realm 이름
 * @returns {Promise<Array<{ id: string, name: string, path?: string }>>} 그룹 객체 배열
 */
async function getGroupsWithIdsFromAdminAPI(token, keycloakUrl, realm) {
    try {
        const adminUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups?populateHierarchy=true`;
        const response = await fetch(adminUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const groups = await response.json();
            const flatten = (groupList, pathPrefix = '') => {
                const result = [];
                groupList.forEach((g) => {
                    const path = pathPrefix ? `${pathPrefix}/${g.name}` : (g.path || `/${g.name || ''}`);
                    const name = g.name || g.path?.replace(/^\//, '') || g.id || '';
                    if (g.id && name) {
                        result.push({ id: g.id, name, path: g.path || path });
                    }
                    if (g.subGroups && g.subGroups.length > 0) {
                        result.push(...flatten(g.subGroups, path));
                    }
                });
                return result;
            };
            return flatten(groups).filter((g) => g.id && g.name);
        }
        if (response.status === 403 || response.status === 401) {
            console.warn(
                'Keycloak Admin API 그룹 조회 실패: query-groups 등 Realm Management 역할이 필요합니다.'
            );
        }
        return [];
    } catch (error) {
        console.warn('Failed to fetch groups with ids from Admin API:', error);
        return [];
    }
}

/**
 * Keycloak 루트(최상위) 그룹만 반환. 조직 탭에서만 사용.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getKeycloakRootGroups() {
    try {
        if (typeof window === 'undefined' || (window.$mode && window.$mode !== 'uEngine')) {
            return [];
        }
        const keycloakUrl =
            window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm =
            window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();
        if (!token) return [];
        const adminUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups`;
        const response = await fetch(adminUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) return [];
        const groups = await response.json();
        return (groups || []).map((g) => ({ id: g.id, name: g.name || g.path?.replace(/^\//, '') || g.id || '' })).filter((g) => g.id && g.name);
    } catch (e) {
        console.warn('getKeycloakRootGroups error:', e);
        return [];
    }
}

/**
 * Keycloak 그룹 계층 구조(트리) 반환. 권한 다이얼로그 등에서 "조직" 루트 아래 트리 표시용.
 * @returns {Promise<Array<{ id: string, name: string, path?: string, children: Array }>>}
 */
export async function getKeycloakGroupsHierarchy() {
    try {
        if (typeof window === 'undefined' || (window.$mode && window.$mode !== 'uEngine')) {
            return [];
        }
        const keycloakUrl =
            window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm =
            window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();
        if (!token) return [];
        const adminUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups?populateHierarchy=true`;
        const response = await fetch(adminUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) return [];
        const groups = await response.json();
        const toNode = (g) => {
            const name = g.name || g.path?.replace(/^\//, '') || g.id || '';
            const node = { id: g.id, name, path: g.path };
            // Keycloak GroupRepresentation: subGroups (일부 프록시/버전은 필드명이 다를 수 있음)
            const sub =
                g.subGroups ||
                g.subgroups ||
                (Array.isArray(g.children) ? g.children : null) ||
                [];
            if (Array.isArray(sub) && sub.length > 0) {
                node.children = sub.map(toNode).filter((n) => n.id && n.name);
            } else {
                node.children = [];
            }
            return node;
        };
        return (groups || []).map(toNode).filter((n) => n.id && n.name);
    } catch (e) {
        console.warn('getKeycloakGroupsHierarchy error:', e);
        return [];
    }
}

/**
 * 접근 권한 설정용 Keycloak 그룹 목록 (id, name) - uEngine 모드에서 조직/조직 그룹 드롭다운에 사용
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function getKeycloakGroupsForPermission() {
    try {
        if (typeof window === 'undefined' || (window.$mode && window.$mode !== 'uEngine')) {
            return [];
        }
        const keycloakUrl =
            window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm =
            window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();
        if (!token) return [];
        const list = await getGroupsWithIdsFromAdminAPI(token, keycloakUrl, realm);
        return list.map((g) => ({ id: g.id, name: g.name }));
    } catch (e) {
        console.warn('getKeycloakGroupsForPermission error:', e);
        return [];
    }
}

/**
 * 현재 사용자의 그룹 목록 가져오기
 * @param {string} token - Keycloak 액세스 토큰
 * @param {string} keycloakUrl - Keycloak 서버 URL
 * @param {string} realm - Realm 이름
 * @param {string} userId - 사용자 ID (선택사항)
 * @returns {Promise<string[]>} 그룹 이름 배열
 */
async function getUserGroups(token, keycloakUrl, realm, userId = null) {
    try {
        // 1. 먼저 userinfo 엔드포인트를 통해 현재 사용자의 그룹 정보 가져오기 (권한 불필요)
        // userinfo는 일반 사용자 토큰으로도 접근 가능
        const userInfoUrl = `${keycloakUrl.replace(/\/$/, '')}/realms/${realm}/protocol/openid-connect/userinfo`;
        const userInfoResponse = await fetch(userInfoUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            if (userInfo.groups && userInfo.groups.length > 0) {
                const groups = Array.isArray(userInfo.groups)
                    ? userInfo.groups
                    : typeof userInfo.groups === 'string'
                    ? userInfo.groups.split(',')
                    : [];
                if (groups.length > 0) {
                    return groups.filter((g) => g && g.trim());
                }
            }
        } else {
            const errorData = await userInfoResponse.json().catch(() => ({}));
            console.warn('userinfo API response error:', {
                status: userInfoResponse.status,
                statusText: userInfoResponse.statusText,
                error: errorData.error,
                errorDescription: errorData.error_description
            });
        }

        // 2. userId가 제공된 경우 Admin API를 통해 해당 사용자의 그룹 가져오기 시도
        // 주의: Admin API는 관리자 권한이 필요하므로 403 에러가 발생할 수 있음
        if (userId) {
            try {
                const userGroupsUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users/${userId}/groups`;
                const response = await fetch(userGroupsUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const groups = await response.json();
                    const groupNames = groups.map((g) => g.name || g.path?.replace(/^\//, '') || '').filter((g) => g && g.trim());
                    if (groupNames.length > 0) {
                        return groupNames;
                    }
                } else if (response.status === 403 || response.status === 401) {
                    console.warn('User groups Admin API access denied (403/401): 관리자 권한이 필요합니다.');
                } else {
                    console.warn('User groups Admin API error:', response.status, response.statusText);
                }
            } catch (error) {
                console.warn('Failed to fetch user groups from Admin API:', error);
            }
        }
    } catch (error) {
        console.warn('Failed to fetch user groups:', error);
    }
    return null;
}

/**
 * Keycloak 그룹에 속한 사용자 목록을 가져오는 함수
 * @param {string|string[]} groupNames - 그룹 이름 또는 그룹 이름 배열
 * @returns {Promise<Array>} 사용자 목록 배열
 */
export async function getUsersByGroups(groupNames) {
    try {
        // uEngine 모드에서만 Keycloak 사용자 목록 가져오기
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        // 그룹 이름을 배열로 변환
        const groups = Array.isArray(groupNames) ? groupNames : [groupNames];
        if (groups.length === 0) {
            return [];
        }

        const allUsers = [];
        const processedUserIds = new Set(); // 중복 사용자 제거를 위한 Set

        // 각 그룹에 대해 사용자 목록 가져오기
        for (const groupName of groups) {
            if (!groupName || !groupName.trim()) {
                continue;
            }

            try {
                // 1. 그룹 이름으로 그룹 검색하여 그룹 ID 찾기
                const searchUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups?search=${encodeURIComponent(
                    groupName.trim()
                )}`;
                const searchResponse = await fetch(searchUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (searchResponse.ok) {
                    const foundGroups = await searchResponse.json();
                    // 그룹 이름으로 정확히 일치하는 그룹 찾기
                    const group = foundGroups.find((g) => g.name === groupName.trim());

                    if (group && group.id) {
                        // 2. 그룹 ID로 멤버 목록 가져오기
                        const membersUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups/${group.id}/members`;
                        const membersResponse = await fetch(membersUrl, {
                            method: 'GET',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (membersResponse.ok) {
                            const members = await membersResponse.json();
                            // 중복 제거하면서 사용자 정보 추가
                            members.forEach((user) => {
                                if (!processedUserIds.has(user.id)) {
                                    processedUserIds.add(user.id);
                                    allUsers.push({
                                        id: user.id,
                                        username: user.username || user.preferred_username,
                                        email: user.email,
                                        firstName: user.firstName,
                                        lastName: user.lastName,
                                        enabled: user.enabled
                                    });
                                }
                            });
                        } else if (membersResponse.status === 403 || membersResponse.status === 401) {
                            console.warn(`Group members API access denied for group: ${groupName}`);
                        }
                    }
                } else if (searchResponse.status === 403 || searchResponse.status === 401) {
                    console.warn(`Group search API access denied for group: ${groupName}`);
                }
            } catch (error) {
                console.warn(`Failed to fetch users for group ${groupName}:`, error);
            }
        }

        return allUsers;
    } catch (error) {
        console.error('Error loading users by groups:', error);
        return [];
    }
}

/**
 * Keycloak 전체 그룹 목록을 가져오는 함수
 * @returns {Promise<string[]>} 전체 그룹 이름 배열
 */
export async function getAllGroups() {
    try {
        // uEngine 모드에서만 Keycloak 그룹 목록 가져오기
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        // Admin API를 통해 전체 그룹 목록 가져오기
        const allGroups = await getGroupsFromAdminAPI(token, keycloakUrl, realm);
        if (allGroups && allGroups.length > 0) {
            return allGroups;
        }

        // Admin API 실패 시 빈 배열 반환
        return [];
    } catch (error) {
        console.error('Error loading all Keycloak groups:', error);
        return [];
    }
}

/**
 * 현재 사용자가 속한 그룹만 가져오는 함수 (전체 그룹 로직 활용)
 * @param {Object} options - 옵션 객체
 * @param {string} options.userId - 특정 사용자의 그룹 가져오기 (선택사항, 없으면 현재 사용자)
 * @returns {Promise<string[]>} 사용자가 속한 그룹 이름 배열
 */
export async function getUserGroupsOnly(options = {}) {
    try {
        // uEngine 모드에서만 Keycloak 그룹 목록 가져오기
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const { userId = null } = options;

        // 2. 사용자 ID 가져오기
        let targetUserId = userId;
        if (!targetUserId) {
            const tokenParsed = getKeycloakTokenParsed();
            if (tokenParsed && tokenParsed.sub) {
                targetUserId = tokenParsed.sub;
            }
        }

        if (!targetUserId) {
            console.warn('User ID not found');
            return [];
        }

        // 3. Admin API를 통해 해당 사용자의 그룹 가져오기
        try {
            const userGroupsUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users/${targetUserId}/groups`;
            const response = await fetch(userGroupsUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userGroups = await response.json();
                const userGroupNames = userGroups.map((g) => g.name || g.path?.replace(/^\//, '') || '').filter((g) => g && g.trim());

                // 전체 그룹 목록에서 사용자가 속한 그룹만 필터링
                return allGroups.filter((groupName) => userGroupNames.includes(groupName));
            } else if (response.status === 403 || response.status === 401) {
                console.warn('User groups Admin API access denied (403/401): userinfo 엔드포인트로 fallback');
                // Admin API 실패 시 userinfo 엔드포인트로 fallback
                const userGroups = await getUserGroups(token, keycloakUrl, realm, targetUserId);
                if (userGroups && userGroups.length > 0) {
                    // 전체 그룹 목록에서 사용자가 속한 그룹만 필터링
                    return allGroups.filter((groupName) => userGroups.includes(groupName));
                }
            }
        } catch (error) {
            console.warn('Failed to fetch user groups from Admin API:', error);
            // 에러 발생 시 userinfo 엔드포인트로 fallback
            const userGroups = await getUserGroups(token, keycloakUrl, realm, targetUserId);
            if (userGroups && userGroups.length > 0) {
                // 전체 그룹 목록에서 사용자가 속한 그룹만 필터링
                return allGroups.filter((groupName) => userGroups.includes(groupName));
            }
        }

        // 4. userinfo 엔드포인트로 fallback
        const userGroups = await getUserGroups(token, keycloakUrl, realm, targetUserId);
        if (userGroups && userGroups.length > 0) {
            // 전체 그룹 목록에서 사용자가 속한 그룹만 필터링
            return allGroups.filter((groupName) => userGroups.includes(groupName));
        }

        return [];
    } catch (error) {
        console.error('Error loading user groups:', error);
        return [];
    }
}

/**
 * JWT 토큰에서 그룹 정보를 추출하는 함수
 * @returns {string[]} 그룹 이름 배열
 */
export function getGroupsFromToken() {
    try {
        const tokenParsed = getKeycloakTokenParsed();
        if (tokenParsed && tokenParsed.groups) {
            // groups가 배열인 경우
            if (Array.isArray(tokenParsed.groups)) {
                return tokenParsed.groups.filter((g) => g && g.trim());
            }
            // groups가 문자열인 경우 (쉼표로 구분)
            if (typeof tokenParsed.groups === 'string') {
                return tokenParsed.groups
                    .split(',')
                    .map((g) => g.trim())
                    .filter((g) => g);
            }
        }
        return [];
    } catch (error) {
        console.error('Error extracting groups from token:', error);
        return [];
    }
}

/**
 * Keycloak Admin API GET /admin/realms/{realm}/users 응답 배열을 변환 없이 그대로 반환.
 * (필드명·중첩 구조 보존 — 관리/디버그 UI용)
 * @param {Object} options
 * @param {number} [options.max=100]
 * @param {number} [options.first=0]
 * @param {string} [options.search='']
 * @param {boolean} [options.briefRepresentation=false]
 * @returns {Promise<Object[]>}
 */
export async function fetchKeycloakUsersRaw(options = {}) {
    try {
        if (typeof window !== 'undefined' && window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const { max = 100, first = 0, search = '', briefRepresentation = false } = options;

        let usersUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users?max=${Math.min(max, 100)}&first=${first}`;

        if (search) {
            usersUrl += `&search=${encodeURIComponent(search)}`;
        }

        if (briefRepresentation) {
            usersUrl += `&briefRepresentation=true`;
        }

        const response = await fetch(usersUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return [];
        }

        const users = await response.json();
        return Array.isArray(users) ? users : [];
    } catch (error) {
        console.error('fetchKeycloakUsersRaw:', error);
        return [];
    }
}

/**
 * Keycloak Admin API를 통해 전체 사용자 목록을 가져오는 함수
 * @param {Object} options - 옵션 객체
 * @param {number} options.max - 최대 사용자 수 (기본값: 100, 최대: 100)
 * @param {number} options.first - 시작 인덱스 (기본값: 0)
 * @param {string} options.search - 검색어 (선택사항, username, email, firstName, lastName에서 검색)
 * @param {boolean} options.briefRepresentation - 간단한 표현식 사용 (기본값: false)
 * @returns {Promise<Object[]>} 사용자 객체 배열 (id, username, email, firstName, lastName, enabled 포함)
 */
export async function getAllUsers(options = {}) {
    try {
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const { max = 100, first = 0, search = '', briefRepresentation = false } = options;

        // Keycloak Admin API: GET /admin/realms/{realm}/users
        // 참고: https://www.keycloak.org/docs-api/latest/rest-api/index.html#_users_resource
        let usersUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users?max=${Math.min(max, 100)}&first=${first}`;

        if (search) {
            usersUrl += `&search=${encodeURIComponent(search)}`;
        }

        if (briefRepresentation) {
            usersUrl += `&briefRepresentation=true`;
        }

        const response = await fetch(usersUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                const errorText = await response.text().catch(() => '');
                console.error('Keycloak Admin API 401 Unauthorized:', errorText);
                console.error('토큰이 만료되었거나 유효하지 않습니다. 토큰을 갱신해주세요.');
            } else if (response.status === 403) {
                const errorText = await response.text().catch(() => '');
                console.error('Keycloak Admin API 403 Forbidden:', errorText);
                console.error('=== Admin API 접근 권한이 필요합니다 ===');
                console.error('해결 방법:');
                console.error('1. Keycloak Admin Console에 접속');
                console.error('2. Realm Settings > Users > Realm roles 또는');
                console.error('3. Users > [사용자 선택] > Role Mappings > Client roles > realm-management');
                console.error('4. 다음 역할들을 할당:');
                console.error('   - view-users (사용자 목록 조회)');
                console.error('   - query-groups (그룹 조회)');
                console.error('   - view-realm (Realm 정보 조회)');
                console.error('5. 또는 Service Account를 사용하여 Admin API 접근');
            } else {
                const errorText = await response.text().catch(() => '');
                console.error(`Failed to fetch users: ${response.status} ${response.statusText}`, errorText);
            }
            return [];
        }

        const users = await response.json();

        // 사용자 객체를 표준 형식으로 변환
        return users.map((user) => ({
            id: user.id,
            username: user.username || '',
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            enabled: user.enabled !== false,
            createdTimestamp: user.createdTimestamp,
            emailVerified: user.emailVerified || false
        }));
    } catch (error) {
        console.error('Error fetching all users from Keycloak Admin API:', error);
        return [];
    }
}

/**
 * 특정 Realm 역할(process-manager, admin 등)을 가진 사용자 목록 조회.
 * Keycloak Admin API: GET /admin/realms/{realm}/roles/{role-name}/users
 * @param {string[]} roleNames - 역할 이름 배열 (예: ['process-manager', 'admin'])
 * @param {Object} options - 옵션 (max: 역할별 최대 사용자 수, 기본 100)
 * @returns {Promise<Object[]>} 사용자 객체 배열 (id, username, email 등, 중복 제거됨)
 */
export async function getUsersByRoles(roleNames = [], options = {}) {
    try {
        if (window.$mode !== 'uEngine') {
            return [];
        }
        if (!roleNames || !Array.isArray(roleNames) || roleNames.length === 0) {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const max = options.max != null ? Math.min(options.max, 100) : 100;
        const seen = new Set();
        const result = [];

        for (const roleName of roleNames) {
            if (!roleName || typeof roleName !== 'string') continue;
            const encodedRole = encodeURIComponent(roleName);
            const url = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/roles/${encodedRole}/users?max=${max}&first=0`;

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) continue;

                const users = await response.json();
                for (const user of users) {
                    if (user.id && !seen.has(user.id)) {
                        seen.add(user.id);
                        result.push({
                            id: user.id,
                            username: user.username || user.preferred_username || '',
                            email: user.email || '',
                            firstName: user.firstName || '',
                            lastName: user.lastName || '',
                            enabled: user.enabled !== false
                        });
                    }
                }
            } catch (err) {
                console.warn(`[getUsersByRoles] role "${roleName}" failed:`, err);
            }
        }

        return result;
    } catch (error) {
        console.error('Error fetching users by roles from Keycloak:', error);
        return [];
    }
}

/**
 * user_id(Keycloak sub)로 사용자 객체 조회. id로 검색된 사용자가 있을 때만 반환.
 * - Keycloak Admin API GET user 조회, 실패 시 getAllUsers 목록에서 id로 검색 (최대 500명)
 * @param {string} userId - Keycloak user id (sub)
 * @returns {Promise<Object|null>} 사용자 객체 또는 없으면 null
 */
export async function getKeycloakUserById(userId) {
    if (!userId) return null;
    if (window.$mode !== 'uEngine') return null;
    const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
    const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
    const token = getKeycloakToken();
    if (!token) return null;
    try {
        const url = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users/${encodeURIComponent(userId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (_) {}
    try {
        for (let first = 0; first < 500; first += 100) {
            const users = await getAllUsers({ max: 100, first });
            if (!users.length) break;
            const found = users.find((u) => u.id === userId);
            if (found) return found;
        }
    } catch (_) {}
    return null;
}

/**
 * user_id(Keycloak sub)를 표시 이름으로 변환. lock 메시지 등에 사용.
 * - 현재 사용자면 localStorage의 userName 반환
 * - 그 외 1) Keycloak Admin API GET user 조회, 2) 실패 시 getAllUsers 목록에서 id로 검색 (최대 500명)
 * @param {string} userId - Keycloak user id (sub)
 * @returns {Promise<string>} 표시 이름
 */
export async function getKeycloakUserDisplayName(userId) {
    if (!userId) return '';
    if (window.$mode !== 'uEngine') return userId;
    const uid = localStorage.getItem('uid');
    const userName = localStorage.getItem('userName');
    if (uid && userId === uid) {
        return userName || localStorage.getItem('email') || userId;
    }
    if (userName && userId === userName) return userId;

    const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
    const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
    const token = getKeycloakToken();
    if (!token) return userId;

    try {
        const url = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/users/${encodeURIComponent(userId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            const user = await response.json();
            const name = user.username || user.email || [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
            return name || userId;
        }
    } catch (_) {}

    try {
        for (let first = 0; first < 500; first += 100) {
            const users = await getAllUsers({ max: 100, first });
            if (!users.length) break;
            const found = users.find((u) => u.id === userId);
            if (found) {
                const name = found.username || found.email || [found.firstName, found.lastName].filter(Boolean).join(' ').trim();
                return name || userId;
            }
        }
    } catch (_) {}

    return userId;
}

/**
 * Keycloak에서 전체 역할(Realm Roles) 목록을 가져오는 함수
 * @param {Object} options - 옵션 객체
 * @param {number} options.max - 최대 역할 수 (기본값: 100)
 * @param {number} options.first - 시작 인덱스 (기본값: 0)
 * @param {string} options.search - 검색어 (선택사항)
 * @returns {Promise<Object[]>} 역할 객체 배열 (id, name 포함)
 */
export async function getAllRoles(options = {}) {
    try {
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const { max = 100, first = 0, search = '' } = options;

        // Keycloak Admin API를 통해 Realm 역할 목록 가져오기
        let rolesUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/roles?max=${max}&first=${first}`;
        if (search) {
            rolesUrl += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(rolesUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                const errorText = await response.text().catch(() => '');
                console.error('Keycloak Admin API 401 Unauthorized:', errorText);
                console.error('토큰이 만료되었거나 유효하지 않습니다. 토큰을 갱신해주세요.');
            } else if (response.status === 403) {
                const errorText = await response.text().catch(() => '');
                console.error('Keycloak Admin API 403 Forbidden:', errorText);
                console.error('=== Admin API 접근 권한이 필요합니다 ===');
                console.error('해결 방법:');
                console.error('1. Keycloak Admin Console에 접속');
                console.error('2. Realm Settings > Users > Realm roles 또는');
                console.error('3. Users > [사용자 선택] > Role Mappings > Client roles > realm-management');
                console.error('4. 다음 역할들을 할당:');
                console.error('   - view-realm (Realm 정보 조회)');
                console.error('   - view-users (사용자 목록 조회)');
                console.error('   - query-groups (그룹 조회)');
                console.error('   - view-roles (역할 조회)');
                console.error('5. 또는 Service Account를 사용하여 Admin API 접근');
            } else {
                const errorText = await response.text().catch(() => '');
                console.error(`Failed to fetch roles: ${response.status} ${response.statusText}`, errorText);
            }
            return [];
        }

        const roles = await response.json();

        // 역할 객체를 표준 형식으로 변환
        return roles.map((role) => ({
            id: role.id,
            name: role.name || '',
            description: role.description || ''
        }));
    } catch (error) {
        console.error('Error fetching all roles:', error);
        return [];
    }
}

/**
 * Keycloak에서 전체 부서 목록을 가져오는 함수
 * Keycloak에는 부서 개념이 없으므로, 그룹이나 역할로 관리되는 경우를 처리합니다.
 * 일반적으로 부서는 그룹으로 관리되거나, 특정 역할로 관리될 수 있습니다.
 * @param {Object} options - 옵션 객체
 * @param {string} options.departmentGroupPath - 부서를 관리하는 그룹 경로 (예: '/departments') (선택사항)
 * @returns {Promise<Object[]>} 부서 객체 배열 (id, name 포함)
 */
export async function getAllDepartments(options = {}) {
    try {
        if (window.$mode !== 'uEngine') {
            return [];
        }

        const keycloakUrl = window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/';
        const realm = window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'uengine';
        const token = getKeycloakToken();

        if (!token) {
            console.warn('Keycloak token not found');
            return [];
        }

        const { departmentGroupPath = '/departments' } = options;

        // 방법 1: 부서 그룹 경로가 지정된 경우, 해당 그룹의 하위 그룹을 부서로 간주
        if (departmentGroupPath) {
            try {
                // 부서 그룹 찾기
                const groupsUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups?search=${encodeURIComponent(
                    departmentGroupPath
                )}`;
                const groupsResponse = await fetch(groupsUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (groupsResponse.ok) {
                    const groups = await groupsResponse.json();
                    const departmentGroup = groups.find((g) => g.path === departmentGroupPath);

                    if (departmentGroup) {
                        // 부서 그룹의 하위 그룹 가져오기
                        const subGroupsUrl = `${keycloakUrl.replace(/\/$/, '')}/admin/realms/${realm}/groups/${
                            departmentGroup.id
                        }?populateHierarchy=true`;
                        const subGroupsResponse = await fetch(subGroupsUrl, {
                            method: 'GET',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (subGroupsResponse.ok) {
                            const subGroup = await subGroupsResponse.json();
                            if (subGroup.subGroups && subGroup.subGroups.length > 0) {
                                return subGroup.subGroups.map((dept) => ({
                                    id: dept.id,
                                    name: dept.name || '',
                                    path: dept.path || ''
                                }));
                            }
                        } else if (subGroupsResponse.status === 403 || subGroupsResponse.status === 401) {
                            const errorText = await subGroupsResponse.text().catch(() => '');
                            console.error('Keycloak Admin API 403/401 Forbidden (departments):', errorText);
                            console.error('필요한 권한: realm-management 클라이언트의 query-groups 역할');
                        }
                    }
                } else if (groupsResponse.status === 403 || groupsResponse.status === 401) {
                    const errorText = await groupsResponse.text().catch(() => '');
                    console.error('Keycloak Admin API 403/401 Forbidden (departments search):', errorText);
                    console.error('필요한 권한: realm-management 클라이언트의 query-groups 역할');
                }
            } catch (error) {
                console.warn('Failed to fetch departments from group path:', error);
            }
        }

        // 방법 2: 부서 그룹 경로가 없거나 찾지 못한 경우, 전체 그룹 목록에서 부서 역할을 가진 그룹 찾기
        // 또는 전체 그룹 목록을 반환 (부서로 사용)
        try {
            const allGroups = await getAllGroups();
            return allGroups.map((groupName) => ({
                id: groupName,
                name: groupName,
                path: `/${groupName}`
            }));
        } catch (error) {
            console.warn('Failed to fetch departments from groups:', error);
        }

        return [];
    } catch (error) {
        console.error('Error fetching all departments:', error);
        return [];
    }
}

/**
 * Keycloak 그룹 목록을 가져오는 유틸리티 함수 (하위 호환성 유지)
 * @param {Object} options - 옵션 객체
 * @param {boolean} options.getAllGroups - 전체 그룹 목록 가져오기 (기본값: true)
 * @param {string} options.userId - 특정 사용자의 그룹 가져오기 (선택사항)
 * @returns {Promise<string[]>} 그룹 이름 배열
 * @deprecated getAllGroups() 또는 getUserGroupsOnly() 사용 권장
 */
export async function getGroups(options = {}) {
    const { getAllGroups = true } = options;

    if (getAllGroups) {
        return await getAllGroups();
    } else {
        return await getUserGroupsOnly(options);
    }
}
