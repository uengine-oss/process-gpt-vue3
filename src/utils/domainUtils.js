/**
 * 도메인 관련 유틸리티 함수들
 */

/**
 * 현재 도메인의 기본 도메인을 추출합니다.
 * @returns {string} 기본 도메인 (예: process-gpt.io, process-gpt.4.230.158.187.nip.io)
 */
export function getBaseDomain() {
    const hostname = window.location.hostname;

    // www가 있는 경우 제거
    let domain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;

    // process-gpt가 포함된 도메인인지 확인
    if (domain.includes('process-gpt')) {
        const parts = domain.split('.');

        // process-gpt가 첫 번째 부분인 경우 (process-gpt.xxx.xxx 형태) - 메인 도메인
        if (parts[0] === 'process-gpt') {
            return domain;
        }
        // process-gpt가 첫 번째 부분이 아닌 경우 (xxx.process-gpt.io 형태) - 테넌트 도메인
        else {
            // 첫 번째 서브도메인 제거
            return parts.slice(1).join('.');
        }
    }

    return domain;
}

/**
 * 호스트명이 원시 IPv4 주소인지 확인합니다.
 * IP 직접 접속(예: 데모 서버 http://34.22.71.73:8088)은 서브도메인이 없어
 * 첫 옥텟('34')을 테넌트명으로 오인하면 안 되므로 별도 판별이 필요하다.
 * @param {string} [hostname] - 검사할 호스트명 (기본값: 현재 호스트명)
 * @returns {boolean}
 */
export function isIpAddressHost(hostname = window.location.hostname) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * 테넌트 도메인 URL을 생성합니다.
 * @param {string} tenantId - 테넌트 ID
 * @param {string} path - 경로 (기본값: '/process-architecture')
 * @returns {string} 완전한 테넌트 URL
 */
export function getTenantUrl(tenantId, path = '/process-architecture') {
    const baseDomain = getBaseDomain();
    const protocol = window.location.protocol;
    const port = window.location.port;

    let url = `${protocol}//${tenantId}.${baseDomain}${path}`;

    // 포트가 있는 경우 추가
    if (port) {
        url = `${protocol}//${tenantId}.${baseDomain}:${port}${path}`;
    }

    return url;
}

/**
 * 메인 도메인 URL을 생성합니다.
 * @param {string} path - 경로 (기본값: '/tenant/manage')
 * @returns {string} 완전한 메인 도메인 URL
 */
export function getMainDomainUrl(path = '/tenant/manage') {
    const baseDomain = getBaseDomain();
    const protocol = window.location.protocol;
    const port = window.location.port;

    let url = `${protocol}//${baseDomain}${path}`;

    // 포트가 있는 경우 추가
    if (port) {
        url = `${protocol}//${baseDomain}:${port}${path}`;
    }

    return url;
}
