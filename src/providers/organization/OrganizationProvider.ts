/**
 * Organization Provider Interface
 * 조직 정보 제공자 인터페이스 - 내부 조직도 또는 외부 시스템으로 교체 가능
 */

// 조직 구성원 인터페이스
export interface OrganizationMember {
    id: string;
    name: string;
    email?: string;
    department?: string;
    position?: string;
    avatar?: string;
}

// 부서/팀 인터페이스
export interface OrganizationDepartment {
    id: string;
    name: string;
    parentId?: string;
    members?: OrganizationMember[];
    children?: OrganizationDepartment[];
}

// 검색 옵션
export interface SearchOptions {
    query?: string;
    departmentId?: string;
    limit?: number;
    includeInactive?: boolean;
}

// 조직 정보 제공자 인터페이스
export interface IOrganizationProvider {
    // Provider 이름
    readonly name: string;

    // 초기화 (필요시)
    initialize?(): Promise<void>;

    // 전체 부서 목록 조회
    getDepartments(): Promise<OrganizationDepartment[]>;

    // 특정 부서 조회
    getDepartment(departmentId: string): Promise<OrganizationDepartment | null>;

    // 전체 구성원 목록 조회
    getMembers(options?: SearchOptions): Promise<OrganizationMember[]>;

    // 특정 구성원 조회
    getMember(memberId: string): Promise<OrganizationMember | null>;

    // 구성원 검색 (이름, 이메일 등)
    searchMembers(query: string, options?: SearchOptions): Promise<OrganizationMember[]>;

    // 특정 부서의 구성원 목록
    getMembersByDepartment(departmentId: string): Promise<OrganizationMember[]>;

    // 현재 사용자 정보
    getCurrentUser(): Promise<OrganizationMember | null>;

    // 현재 사용자의 부서 정보
    getCurrentUserDepartment(): Promise<OrganizationDepartment | null>;
}

// Provider 타입
export type OrganizationProviderType = 'internal' | 'external' | 'keycloak' | 'ldap' | 'custom';

// Provider 설정
export interface OrganizationProviderConfig {
    type: OrganizationProviderType;
    // 외부 API 설정 (external 타입일 때)
    apiUrl?: string;
    apiKey?: string;
    // 커스텀 설정
    customConfig?: Record<string, any>;
}
