/**
 * Supabase Auth 유틸리티
 * JWT 자동 갱신 및 세션 관리
 */

/**
 * 유효한 JWT 토큰을 가져옵니다.
 * - 세션이 만료 임박(5분 이내)이면 자동으로 갱신
 * - 세션이 없거나 갱신 실패 시 null 반환
 * 
 * @returns {Promise<string|null>} 유효한 access_token 또는 null
 */
export async function getValidToken() {
    const supabase = window.$supabase;
    if (!supabase) {
        console.warn('[supabaseAuth] $supabase 클라이언트가 없습니다.');
        return null;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('[supabaseAuth] 세션 조회 실패:', error.message);
            return null;
        }

        if (!session) {
            console.warn('[supabaseAuth] 세션이 없습니다. 로그인이 필요합니다.');
            return null;
        }

        // 디버깅: 세션 정보 출력
        console.log('[supabaseAuth] 세션 확인:', {
            expires_at: session.expires_at,
            expires_at_date: new Date(session.expires_at * 1000).toLocaleString(),
            now: new Date().toLocaleString()
        });

        // 토큰 만료 시간 확인
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;

        // 이미 만료되었거나 5분(300초) 이내면 갱신 시도
        if (timeUntilExpiry < 300) {
            const status = timeUntilExpiry <= 0 ? '만료됨' : '만료 임박';
            console.log(`[supabaseAuth] 토큰 ${status} (${timeUntilExpiry}초), 갱신 시도...`);
            
            // refresh_token을 명시적으로 전달하여 갱신
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: session.refresh_token
            });
            
            if (refreshError) {
                console.error('[supabaseAuth] 토큰 갱신 실패:', refreshError.message);
                // 갱신 실패해도 현재 토큰이 아직 유효하면 사용
                if (timeUntilExpiry > 0) {
                    console.log('[supabaseAuth] 기존 토큰 사용 (아직 유효함)');
                    return session.access_token;
                }
                // refresh_token으로도 실패하면 setSession으로 재시도
                console.log('[supabaseAuth] setSession으로 재시도...');
                try {
                    const { data: setData, error: setError } = await supabase.auth.setSession({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token
                    });
                    if (!setError && setData.session) {
                        console.log('[supabaseAuth] setSession 성공');
                        return setData.session.access_token;
                    }
                } catch (e) {
                    console.error('[supabaseAuth] setSession 실패:', e);
                }
                return null;
            }

            console.log('[supabaseAuth] 토큰 갱신 성공');
            return refreshData.session?.access_token || null;
        }

        return session.access_token;
    } catch (error) {
        console.error('[supabaseAuth] 예외 발생:', error);
        return null;
    }
}

/**
 * 현재 세션 정보를 가져옵니다.
 * @returns {Promise<Object|null>} 세션 객체 또는 null
 */
export async function getCurrentSession() {
    const supabase = window.$supabase;
    if (!supabase) return null;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch (error) {
        console.error('[supabaseAuth] 세션 조회 실패:', error);
        return null;
    }
}

/**
 * 세션 변경 리스너 등록
 * @param {Function} callback - 세션 변경 시 호출될 콜백
 * @returns {Function} 구독 해제 함수
 */
export function onAuthStateChange(callback) {
    const supabase = window.$supabase;
    if (!supabase) {
        console.warn('[supabaseAuth] $supabase 클라이언트가 없습니다.');
        return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });

    return () => subscription?.unsubscribe();
}

/**
 * 토큰이 유효한지 확인
 * @returns {Promise<boolean>}
 */
export async function isTokenValid() {
    const token = await getValidToken();
    return token !== null;
}

export default {
    getValidToken,
    getCurrentSession,
    onAuthStateChange,
    isTokenValid
};
