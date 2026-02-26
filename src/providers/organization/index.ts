/**
 * Organization Provider Module
 * 조직 정보 제공자 모듈 - 교체 가능한 조직 정보 시스템
 */

// 인터페이스 및 타입
export type {
    IOrganizationProvider,
    OrganizationMember,
    OrganizationDepartment,
    SearchOptions,
    OrganizationProviderType,
    OrganizationProviderConfig
} from './OrganizationProvider';

// Provider 구현체
export { InternalOrganizationProvider } from './InternalOrganizationProvider';

// 팩토리 및 유틸리티
export {
    createOrganizationProvider,
    getOrganizationProvider,
    initializeOrganizationProvider,
    setOrganizationProviderConfig,
    getOrganizationProviderConfig
} from './OrganizationProviderFactory';
