/**
 * Organization Provider Factory
 * 조직 정보 제공자 팩토리 - Provider 타입에 따라 적절한 구현체 반환
 */

import type {
    IOrganizationProvider,
    OrganizationProviderType,
    OrganizationProviderConfig
} from './OrganizationProvider';
import { InternalOrganizationProvider } from './InternalOrganizationProvider';

// 싱글톤 인스턴스 캐시
let currentProvider: IOrganizationProvider | null = null;
let currentProviderType: OrganizationProviderType | null = null;

// 기본 설정 (configuration 테이블에서 로드하거나 환경변수로 설정 가능)
let providerConfig: OrganizationProviderConfig = {
    type: 'internal'
};

/**
 * Provider 설정 변경
 * @param config - 새로운 Provider 설정
 */
export function setOrganizationProviderConfig(config: OrganizationProviderConfig): void {
    providerConfig = config;
    // 설정 변경 시 기존 인스턴스 무효화
    if (currentProviderType !== config.type) {
        currentProvider = null;
        currentProviderType = null;
    }
}

/**
 * 현재 Provider 설정 조회
 */
export function getOrganizationProviderConfig(): OrganizationProviderConfig {
    return { ...providerConfig };
}

/**
 * Organization Provider 인스턴스 생성
 * @param type - Provider 타입 (기본값: 설정된 타입 또는 'internal')
 * @returns Provider 인스턴스
 */
export function createOrganizationProvider(type?: OrganizationProviderType): IOrganizationProvider {
    const providerType = type || providerConfig.type;

    // 캐시된 인스턴스가 있고 타입이 같으면 재사용
    if (currentProvider && currentProviderType === providerType) {
        return currentProvider;
    }

    let provider: IOrganizationProvider;

    switch (providerType) {
        case 'internal':
            provider = new InternalOrganizationProvider();
            break;

        case 'external':
            // TODO: 외부 API 기반 Provider 구현
            // provider = new ExternalOrganizationProvider(providerConfig);
            console.warn('[OrganizationProviderFactory] external provider not implemented, falling back to internal');
            provider = new InternalOrganizationProvider();
            break;

        case 'keycloak':
            // TODO: Keycloak 기반 Provider 구현
            // provider = new KeycloakOrganizationProvider(providerConfig);
            console.warn('[OrganizationProviderFactory] keycloak provider not implemented, falling back to internal');
            provider = new InternalOrganizationProvider();
            break;

        case 'ldap':
            // TODO: LDAP 기반 Provider 구현
            // provider = new LdapOrganizationProvider(providerConfig);
            console.warn('[OrganizationProviderFactory] ldap provider not implemented, falling back to internal');
            provider = new InternalOrganizationProvider();
            break;

        case 'custom':
            // TODO: 커스텀 Provider 구현
            // provider = new CustomOrganizationProvider(providerConfig);
            console.warn('[OrganizationProviderFactory] custom provider not implemented, falling back to internal');
            provider = new InternalOrganizationProvider();
            break;

        default:
            provider = new InternalOrganizationProvider();
    }

    // 캐시 저장
    currentProvider = provider;
    currentProviderType = providerType;

    return provider;
}

/**
 * 기본 Provider 인스턴스 가져오기 (편의 함수)
 */
export function getOrganizationProvider(): IOrganizationProvider {
    return createOrganizationProvider();
}

/**
 * Provider 인스턴스 초기화 및 반환
 */
export async function initializeOrganizationProvider(): Promise<IOrganizationProvider> {
    const provider = createOrganizationProvider();
    if (provider.initialize) {
        await provider.initialize();
    }
    return provider;
}

// 기본 export
export default {
    createOrganizationProvider,
    getOrganizationProvider,
    initializeOrganizationProvider,
    setOrganizationProviderConfig,
    getOrganizationProviderConfig
};
