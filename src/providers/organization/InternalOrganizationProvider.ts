/**
 * Internal Organization Provider
 * 내부 조직도(org_chart) 기반 구현
 */

import type {
    IOrganizationProvider,
    OrganizationMember,
    OrganizationDepartment,
    SearchOptions
} from './OrganizationProvider';
import BackendFactory from '@/components/api/BackendFactory';

// 내부 조직도 노드 구조
interface OrgChartNode {
    id: string;
    data?: {
        id?: string;
        name?: string;
        isTeam?: boolean;
        email?: string;
        pid?: string;
        position?: string;
        avatar?: string;
    };
    children?: OrgChartNode[];
}

export class InternalOrganizationProvider implements IOrganizationProvider {
    readonly name = 'internal';

    private orgChart: OrgChartNode | null = null;
    private backend = BackendFactory.createBackend();
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const orgData = await this.backend.getData('configuration', {
                match: { key: 'organization' }
            });

            if (orgData && orgData.value) {
                const orgValue = typeof orgData.value === 'string'
                    ? JSON.parse(orgData.value)
                    : orgData.value;

                this.orgChart = orgValue.chart || orgValue;
            }

            this.initialized = true;
        } catch (error) {
            console.error('[InternalOrganizationProvider] 초기화 실패:', error);
            throw error;
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    // 노드에서 부서 정보 추출
    private nodeToDepartment(node: OrgChartNode, includeMembers = false): OrganizationDepartment | null {
        if (!node.data?.isTeam) return null;

        const dept: OrganizationDepartment = {
            id: node.id,
            name: node.data?.name || node.id,
            parentId: node.data?.pid
        };

        if (includeMembers && node.children) {
            dept.members = node.children
                .filter(child => !child.data?.isTeam)
                .map(child => this.nodeToMember(child))
                .filter((m): m is OrganizationMember => m !== null);

            dept.children = node.children
                .filter(child => child.data?.isTeam)
                .map(child => this.nodeToDepartment(child, includeMembers))
                .filter((d): d is OrganizationDepartment => d !== null);
        }

        return dept;
    }

    // 노드에서 구성원 정보 추출
    private nodeToMember(node: OrgChartNode): OrganizationMember | null {
        if (node.data?.isTeam) return null;

        return {
            id: node.id || node.data?.id || '',
            name: node.data?.name || node.id || '',
            email: node.data?.email,
            position: node.data?.position,
            avatar: node.data?.avatar
        };
    }

    // 트리에서 모든 부서 수집
    private collectDepartments(node: OrgChartNode, result: OrganizationDepartment[] = []): OrganizationDepartment[] {
        if (node.data?.isTeam) {
            const dept = this.nodeToDepartment(node, false);
            if (dept) result.push(dept);
        }

        if (node.children) {
            for (const child of node.children) {
                this.collectDepartments(child, result);
            }
        }

        return result;
    }

    // 트리에서 모든 구성원 수집
    private collectMembers(node: OrgChartNode, result: OrganizationMember[] = [], departmentName?: string): OrganizationMember[] {
        const currentDept = node.data?.isTeam ? node.data.name : departmentName;

        if (!node.data?.isTeam) {
            const member = this.nodeToMember(node);
            if (member) {
                member.department = currentDept;
                result.push(member);
            }
        }

        if (node.children) {
            for (const child of node.children) {
                this.collectMembers(child, result, currentDept);
            }
        }

        return result;
    }

    // 트리에서 특정 노드 찾기
    private findNode(node: OrgChartNode, id: string): OrgChartNode | null {
        if (node.id === id || node.data?.id === id) {
            return node;
        }

        if (node.children) {
            for (const child of node.children) {
                const found = this.findNode(child, id);
                if (found) return found;
            }
        }

        return null;
    }

    // 사용자가 속한 부서 찾기
    private findUserDepartment(node: OrgChartNode, userId: string, parentDept: OrgChartNode | null = null): OrgChartNode | null {
        const currentDept = node.data?.isTeam ? node : parentDept;

        if (node.id === userId || node.data?.id === userId) {
            return currentDept;
        }

        if (node.children) {
            for (const child of node.children) {
                const found = this.findUserDepartment(child, userId, currentDept);
                if (found) return found;
            }
        }

        return null;
    }

    async getDepartments(): Promise<OrganizationDepartment[]> {
        await this.ensureInitialized();

        if (!this.orgChart) return [];

        return this.collectDepartments(this.orgChart);
    }

    async getDepartment(departmentId: string): Promise<OrganizationDepartment | null> {
        await this.ensureInitialized();

        if (!this.orgChart) return null;

        const node = this.findNode(this.orgChart, departmentId);
        if (!node || !node.data?.isTeam) return null;

        return this.nodeToDepartment(node, true);
    }

    async getMembers(options?: SearchOptions): Promise<OrganizationMember[]> {
        await this.ensureInitialized();

        if (!this.orgChart) return [];

        let members = this.collectMembers(this.orgChart);

        if (options?.departmentId) {
            const deptNode = this.findNode(this.orgChart, options.departmentId);
            if (deptNode) {
                members = this.collectMembers(deptNode);
            }
        }

        if (options?.query) {
            const query = options.query.toLowerCase();
            members = members.filter(m =>
                m.name.toLowerCase().includes(query) ||
                m.email?.toLowerCase().includes(query)
            );
        }

        if (options?.limit) {
            members = members.slice(0, options.limit);
        }

        return members;
    }

    async getMember(memberId: string): Promise<OrganizationMember | null> {
        await this.ensureInitialized();

        if (!this.orgChart) return null;

        const node = this.findNode(this.orgChart, memberId);
        if (!node || node.data?.isTeam) return null;

        const member = this.nodeToMember(node);
        if (member) {
            // 부서 정보 추가
            const deptNode = this.findUserDepartment(this.orgChart, memberId);
            if (deptNode) {
                member.department = deptNode.data?.name;
            }
        }

        return member;
    }

    async searchMembers(query: string, options?: SearchOptions): Promise<OrganizationMember[]> {
        return this.getMembers({ ...options, query });
    }

    async getMembersByDepartment(departmentId: string): Promise<OrganizationMember[]> {
        await this.ensureInitialized();

        if (!this.orgChart) return [];

        const deptNode = this.findNode(this.orgChart, departmentId);
        if (!deptNode) return [];

        // 해당 부서의 직접 멤버만 반환 (하위 부서 제외)
        const members: OrganizationMember[] = [];
        if (deptNode.children) {
            for (const child of deptNode.children) {
                if (!child.data?.isTeam) {
                    const member = this.nodeToMember(child);
                    if (member) {
                        member.department = deptNode.data?.name;
                        members.push(member);
                    }
                }
            }
        }

        return members;
    }

    async getCurrentUser(): Promise<OrganizationMember | null> {
        try {
            const userInfo = await this.backend.getUserInfo();
            if (!userInfo || !userInfo.uid) return null;

            await this.ensureInitialized();

            // 조직도에서 사용자 찾기
            const member = await this.getMember(userInfo.uid);
            if (member) return member;

            // 조직도에 없으면 기본 정보 반환
            return {
                id: userInfo.uid,
                name: userInfo.name || userInfo.email || userInfo.uid,
                email: userInfo.email
            };
        } catch (error) {
            console.error('[InternalOrganizationProvider] 현재 사용자 조회 실패:', error);
            return null;
        }
    }

    async getCurrentUserDepartment(): Promise<OrganizationDepartment | null> {
        try {
            const userInfo = await this.backend.getUserInfo();
            if (!userInfo || !userInfo.uid) return null;

            await this.ensureInitialized();

            if (!this.orgChart) return null;

            const deptNode = this.findUserDepartment(this.orgChart, userInfo.uid);
            if (!deptNode) return null;

            return this.nodeToDepartment(deptNode, false);
        } catch (error) {
            console.error('[InternalOrganizationProvider] 현재 사용자 부서 조회 실패:', error);
            return null;
        }
    }
}
