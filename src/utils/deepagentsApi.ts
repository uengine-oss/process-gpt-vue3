/**
 * process-gpt-deepagents 스킬 API 전용 axios 인스턴스.
 *
 * 서버(core/api/tenant_auth.py)는 더 이상 요청이 보낸 tenant_id 파라미터를 믿지 않는다.
 * JWT 를 검증해 얻은 "사용자가 실제로 속한 테넌트"와 대조해, 일치할 때만 통과시킨다.
 * (파라미터만 바꿔 다른 테넌트의 스킬 디렉토리·git 자격증명에 접근하던 경로 차단)
 *
 * 따라서 모든 스킬 API 호출에는 Authorization: Bearer <access_token> 이 실려야 한다.
 * Supabase 세션 토큰을 우선 쓰고, SSO 모드에서는 SSO 액세스 토큰으로 폴백한다.
 */
import axios from 'axios';
import { getValidToken } from '@/utils/supabaseAuth';
import { getSsoToken } from '@/utils/ssoAuth';

export async function getAgentApiToken(): Promise<string | null> {
    try {
        const token = await getValidToken();
        if (token) return token;
    } catch (e) {
        console.warn('[deepagentsApi] Supabase 토큰 조회 실패, SSO 토큰으로 폴백:', e);
    }
    return getSsoToken();
}

const deepagentsApi = axios.create();

deepagentsApi.interceptors.request.use(async (config) => {
    const token = await getAgentApiToken();
    if (token) {
        (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
});

// @/utils/axios 와 동일한 오류 형태를 유지한다(호출부가 error.detail 등 응답 본문을 읽음).
deepagentsApi.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject((error.response && error.response.data) || 'Target service has some problem')
);

export default deepagentsApi;
