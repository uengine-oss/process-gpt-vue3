/**
 * 조직도 트리 모델 헬퍼 (순수 함수)
 *
 * 저장 포맷은 기존 `configuration` (key='organization') 의 `value.chart` 를 그대로 유지한다.
 * 다른 화면(organizationUtils, PermissionDialog, ManageAccessTab)이 같은 구조를 읽으므로
 * 노드 모양(id / data / children)은 절대 바꾸지 않는다.
 *
 *   root ─┬─ 부서(data.isTeam === true) ─┬─ 하위 부서(data.isTeam === true)
 *         │                              └─ 구성원(data.isTeam !== true)
 *         └─ 부서 …
 *
 * 기존 구현과 달리 부서의 중첩 깊이에 제한이 없다. organizationUtils 의 탐색 함수들은
 * 이미 재귀 구조를 가정하고 있어 중첩 부서와 호환된다.
 */

export interface OrgNodeData {
    id: string;
    name?: string;
    /** users 테이블 원본 컬럼명 (구성원 노드에 남아있을 수 있음) */
    username?: string;
    email?: string;
    /** 사용자 역할 (RoleType | 'superAdmin') */
    role?: string;
    profile?: string;
    img?: string;
    /** true 면 부서 노드 */
    isTeam?: boolean;
    isAgent?: boolean;
    is_agent?: boolean;
    /** 부모 노드 id */
    pid?: string;
    /** 부서장으로 지정된 구성원 id */
    leaderId?: string;
    /** 부서 설명 */
    description?: string;
    [key: string]: any;
}

export interface OrgNode {
    id: string;
    name?: string;
    data: OrgNodeData;
    children?: OrgNode[];
}

export const ROOT_ID = 'root';

export function uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const s4 = () =>
        Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function createRoot(name: string): OrgNode {
    return {
        id: ROOT_ID,
        data: { id: ROOT_ID, name: name || '조직', img: '', isTeam: true },
        children: []
    };
}

export function createTeam(name: string, parentId: string): OrgNode {
    const id = uuid();
    return {
        id,
        name,
        data: { id, name, isTeam: true, img: '/images/chat-icon.png', pid: parentId },
        children: []
    };
}

/** users 테이블 행 → 조직도 구성원 노드 */
export function createMemberNode(user: any, parentId: string): OrgNode {
    const name = user.username || user.name || user.email || user.id;
    return {
        id: user.id,
        name,
        data: {
            id: user.id,
            name,
            username: user.username || name,
            email: user.email,
            role: user.role,
            profile: user.profile || user.img,
            img: user.profile || user.img,
            isAgent: !!(user.is_agent ?? user.isAgent),
            is_agent: !!(user.is_agent ?? user.isAgent),
            pending: user.pending === true,
            pid: parentId
        }
    };
}

export function isRoot(node: OrgNode | null | undefined): boolean {
    return !!node && node.id === ROOT_ID;
}

export function isTeam(node: OrgNode | null | undefined): boolean {
    return !!node && (node.id === ROOT_ID || node.data?.isTeam === true);
}

export function isMember(node: OrgNode | null | undefined): boolean {
    return !!node && !isTeam(node);
}

export function isAgentNode(node: OrgNode | null | undefined): boolean {
    return !!node && (node.data?.isAgent === true || node.data?.is_agent === true);
}

export function displayName(node: OrgNode | null | undefined): string {
    if (!node) return '';
    return node.data?.name || node.data?.username || node.name || node.id;
}

/** 부서 노드의 직속 하위 부서 */
export function childTeams(node: OrgNode | null | undefined): OrgNode[] {
    return (node?.children || []).filter(isTeam);
}

/** 부서 노드의 직속 구성원 */
export function childMembers(node: OrgNode | null | undefined): OrgNode[] {
    return (node?.children || []).filter(isMember);
}

export function walk(node: OrgNode | null | undefined, visit: (n: OrgNode, parent: OrgNode | null, depth: number) => void): void {
    const step = (current: OrgNode, parent: OrgNode | null, depth: number) => {
        visit(current, parent, depth);
        for (const child of current.children || []) step(child, current, depth + 1);
    };
    if (node) step(node, null, 0);
}

export function findNode(root: OrgNode | null | undefined, id: string): OrgNode | null {
    if (!root || !id) return null;
    let found: OrgNode | null = null;
    walk(root, (n) => {
        if (!found && (n.id === id || n.data?.id === id)) found = n;
    });
    return found;
}

export function findParent(root: OrgNode | null | undefined, id: string): OrgNode | null {
    if (!root || !id) return null;
    let found: OrgNode | null = null;
    walk(root, (n, parent) => {
        if (!found && parent && (n.id === id || n.data?.id === id)) found = parent;
    });
    return found;
}

/** root → … → 대상 노드까지의 경로 (대상 포함) */
export function pathTo(root: OrgNode | null | undefined, id: string): OrgNode[] {
    if (!root) return [];
    const stack: OrgNode[] = [];
    let result: OrgNode[] | null = null;

    const step = (current: OrgNode) => {
        if (result) return;
        stack.push(current);
        if (current.id === id || current.data?.id === id) {
            result = [...stack];
        } else {
            for (const child of current.children || []) step(child);
        }
        stack.pop();
    };
    step(root);
    return result || [];
}

/** 부서 경로 문자열 (예: "회사 / 개발본부 / 플랫폼팀") */
export function pathLabel(root: OrgNode | null | undefined, id: string, separator = ' / '): string {
    return pathTo(root, id).filter(isTeam).map(displayName).join(separator);
}

/** 전체 부서 목록 (깊이·경로 포함, 화면 선택용) */
export function collectTeams(root: OrgNode | null | undefined, includeRoot = true): Array<{ node: OrgNode; depth: number; path: string }> {
    const out: Array<{ node: OrgNode; depth: number; path: string }> = [];
    const step = (node: OrgNode, depth: number, path: string[]) => {
        if (!isTeam(node)) return;
        const nextPath = [...path, displayName(node)];
        if (includeRoot || !isRoot(node)) {
            out.push({ node, depth, path: nextPath.join(' / ') });
        }
        for (const child of childTeams(node)) step(child, depth + 1, nextPath);
    };
    if (root) step(root, 0, []);
    return out;
}

/** 하위 부서까지 포함한 구성원 노드 (중복 id 제거) */
export function collectMembers(node: OrgNode | null | undefined, deep = true): OrgNode[] {
    const seen = new Set<string>();
    const out: OrgNode[] = [];
    const step = (current: OrgNode) => {
        for (const child of current.children || []) {
            if (isMember(child)) {
                if (!seen.has(child.id)) {
                    seen.add(child.id);
                    out.push(child);
                }
            } else if (deep) {
                step(child);
            }
        }
    };
    if (node) step(node);
    return out;
}

/** 부서 전체(하위 포함) 구성원 수 */
export function memberCount(node: OrgNode | null | undefined, deep = true): number {
    return deep ? collectMembers(node, true).length : childMembers(node).length;
}

/** targetId 가 nodeId 의 하위(자기 자신 포함)인지 — 순환 이동 방지 */
export function isDescendant(root: OrgNode | null | undefined, nodeId: string, targetId: string): boolean {
    const node = findNode(root, nodeId);
    if (!node) return false;
    let hit = false;
    walk(node, (n) => {
        if (n.id === targetId) hit = true;
    });
    return hit;
}

/** 노드를 트리에서 떼어낸다. 반환값은 떼어낸 노드 (없으면 null) */
export function detachNode(root: OrgNode, id: string): OrgNode | null {
    const parent = findParent(root, id);
    if (!parent || !parent.children) return null;
    const index = parent.children.findIndex((child) => child.id === id);
    if (index < 0) return null;
    const [removed] = parent.children.splice(index, 1);
    return removed;
}

/** 부모 부서에 노드를 붙인다. 이미 같은 id 가 있으면 무시 */
export function attachNode(root: OrgNode, parentId: string, node: OrgNode): boolean {
    const parent = findNode(root, parentId);
    if (!parent || !isTeam(parent)) return false;
    if (!parent.children) parent.children = [];
    if (parent.children.some((child) => child.id === node.id)) return false;
    node.data = { ...node.data, pid: parent.id };
    parent.children.push(node);
    return true;
}

/** 노드를 다른 부서로 이동. 순환/자기자신/중복은 false 반환 */
export function moveNode(root: OrgNode, nodeId: string, newParentId: string): boolean {
    if (!nodeId || !newParentId || nodeId === newParentId) return false;
    const target = findNode(root, nodeId);
    const parent = findNode(root, newParentId);
    if (!target || !parent || !isTeam(parent)) return false;
    if (isTeam(target) && isDescendant(root, nodeId, newParentId)) return false;
    if ((parent.children || []).some((child) => child.id === nodeId)) return false;

    const detached = detachNode(root, nodeId);
    if (!detached) return false;
    return attachNode(root, newParentId, detached);
}

/**
 * 특정 부서에서만 구성원을 제거한다.
 * (같은 사람이 여러 부서에 속할 수 있으므로 전체 삭제와 구분)
 */
export function removeMemberFromTeam(root: OrgNode, teamId: string, memberId: string): boolean {
    const team = findNode(root, teamId);
    if (!team || !team.children) return false;
    const before = team.children.length;
    team.children = team.children.filter((child) => !(isMember(child) && child.id === memberId));
    return team.children.length !== before;
}

/** 조직도 전체에서 특정 id 노드를 모두 제거 (사용자/에이전트 삭제 동기화용) */
export function removeNodeEverywhere(root: OrgNode, id: string): boolean {
    let removed = false;
    const step = (node: OrgNode) => {
        if (!node.children) return;
        const before = node.children.length;
        node.children = node.children.filter((child) => child.id !== id);
        if (node.children.length !== before) removed = true;
        node.children.forEach(step);
    };
    step(root);
    return removed;
}

/** 부서명 비교용 정규화 — 공백/대소문자 차이는 같은 이름으로 본다 */
export function normalizeTeamName(name: unknown): string {
    return String(name ?? '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

/**
 * 조직도 전체에서 같은 부서명이 이미 있는지 검사한다.
 * users.department_name 으로 부서를 식별하는 화면들이 있어 형제 노드가 아니라 전역으로 막는다.
 *
 * @param excludeId 검사에서 제외할 노드 id (이름 변경 시 자기 자신)
 */
export function isDuplicateTeamName(root: OrgNode | null | undefined, name: string, excludeId: string | null = null): boolean {
    const target = normalizeTeamName(name);
    if (!target) return false;
    let duplicated = false;
    walk(root, (node) => {
        if (duplicated || !isTeam(node)) return;
        if (excludeId && node.id === excludeId) return;
        if (normalizeTeamName(displayName(node)) === target) duplicated = true;
    });
    return duplicated;
}

/** 조직도 어딘가에 배치된 사용자 id 집합 */
export function assignedMemberIds(root: OrgNode | null | undefined): Set<string> {
    const ids = new Set<string>();
    walk(root, (n) => {
        if (isMember(n)) ids.add(n.id);
    });
    return ids;
}

/** 사용자 id → 소속 부서 노드 목록 */
export function teamsOfMember(root: OrgNode | null | undefined, memberId: string): OrgNode[] {
    const out: OrgNode[] = [];
    walk(root, (n, parent) => {
        if (isMember(n) && n.id === memberId && parent) out.push(parent);
    });
    return out;
}

/**
 * 저장된 트리를 화면에서 쓰기 좋은 형태로 정규화한다.
 * - data 누락 보정, children 배열 보장, pid 재계산
 * - 부서 노드가 아닌데 children 을 가진 레거시 데이터(구 버전의 "세로 체인" 변환 흔적)를 평탄화
 */
export function normalizeTree(raw: any, fallbackName: string): OrgNode {
    if (!raw || typeof raw !== 'object' || !raw.id) {
        return createRoot(fallbackName);
    }

    const normalizeNode = (node: any, parentId: string | null): OrgNode => {
        const data = { ...(node.data && typeof node.data === 'object' ? node.data : {}) };
        const id = node.id || data.id || uuid();
        data.id = id;
        if (!data.name) data.name = node.name || data.username || id;
        if (parentId) data.pid = parentId;

        const nodeIsTeam = id === ROOT_ID || data.isTeam === true;
        if (id === ROOT_ID) data.isTeam = true;

        const rawChildren: any[] = Array.isArray(node.children) ? node.children : [];
        const children: OrgNode[] = [];

        for (const child of rawChildren) {
            if (!child) continue;
            const normalizedChild = normalizeNode(child, id);
            if (nodeIsTeam) {
                children.push(normalizedChild);
            } else {
                // 구성원 아래에 매달린 레거시 노드는 조부모(현재 부모) 레벨로 끌어올린다.
                children.push(normalizedChild);
            }
        }

        if (!nodeIsTeam) {
            // 구성원 노드는 children 을 갖지 않는다 — 끌어올릴 대상은 호출부에서 처리
            return { id, name: data.name, data, children };
        }

        // 부서 노드: 구성원 아래에 잘못 매달린 노드들을 이 부서로 승격시켜 평탄화한다.
        // 구 버전은 팀원을 부모-자식 체인으로 이어 붙여 저장했으므로 깊이 제한 없이 끌어올려야 한다.
        const flattened: OrgNode[] = [];
        const seen = new Set<string>();
        const pushUnique = (candidate: OrgNode) => {
            if (seen.has(candidate.id)) return;
            seen.add(candidate.id);
            flattened.push(candidate);
        };

        const lift = (child: OrgNode) => {
            if (isTeam(child)) {
                child.data = { ...child.data, pid: id };
                pushUnique(child);
                return;
            }
            const nested = child.children || [];
            child.children = undefined;
            child.data = { ...child.data, pid: id };
            pushUnique(child);
            for (const nestedChild of nested) lift(nestedChild);
        };

        for (const child of children) lift(child);

        return { id, name: data.name, data, children: flattened };
    };

    const root = normalizeNode(raw, null);
    root.id = ROOT_ID;
    root.data.id = ROOT_ID;
    root.data.isTeam = true;
    if (!root.data.name) root.data.name = fallbackName;
    if (!root.children) root.children = [];
    return root;
}

/** 저장 직전 직렬화 — undefined children 정리 */
export function serializeTree(root: OrgNode): OrgNode {
    const clean = (node: OrgNode): OrgNode => {
        const out: OrgNode = { id: node.id, name: node.data?.name || node.name, data: { ...node.data } };
        if (isTeam(node)) {
            out.children = (node.children || []).map(clean);
        }
        return out;
    };
    return clean(root);
}
