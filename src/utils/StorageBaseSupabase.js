import { getBaseDomain, getMainDomainUrl } from './domainUtils.js';
import { getTenantId } from './tenant';
import { isAdminRole } from './roles';
// 웹과 앱이 같은 규칙으로 기기를 구분해야 한다. 다르면 같은 사람의 기기가
// 서로 다른 방식으로 등록돼 알림이 엉뚱한 곳으로 간다.
import { deviceId, deviceType } from '@/shared/deviceIdentity/index.js';
// files · chat-images 버킷은 비공개다(20260911_storage_private_buckets.sql).
// 공개 URL 은 더 이상 열리지 않으므로 주소는 전부 서명해서 만든다.
import { parseStorageRef, resolveStorageUrl } from '@/shared/storageUrl/index.js';
// 파일을 가져간 사건은 남긴다 (docs/security.md 3-3, 20260911_file_download_log.sql).
import { DOWNLOAD_ACTIONS, recordFileDownload } from '@/shared/downloadAudit/index.js';

class StorageBaseError extends Error {
    constructor(message, cause, args) {
        super(message, { cause: cause });

        this.args = args;
    }
}

export default class StorageBaseSupabase {
    //extends StorageBase{

    /**
     * 로그인/로그아웃/로그인 실패 감사 기록 (supabase/migrations/20260911000001_auth_audit_log.sql)
     *
     * IP / User-Agent 는 여기서 보내지 않는다. 클라이언트 값은 위조 가능하므로
     * SECURITY DEFINER RPC 가 서버측 요청 헤더에서 직접 캡처한다.
     *
     * 이 함수는 어떤 경우에도 예외를 던지지 않는다 — 감사 기록 실패가
     * 로그인/로그아웃 흐름을 깨서는 안 된다.
     *
     * @param {{action:'login'|'login_failed'|'logout'|'login_oauth', email?:string|null,
     *          success:boolean, errorMessage?:string|null, tenantId?:string|null,
     *          metadata?:object}} params
     */
    async recordAuthAudit({ action, email, success, errorMessage, tenantId, metadata }) {
        try {
            const supabase = window.$supabase;
            if (!supabase || typeof supabase.rpc !== 'function') return;

            const { error } = await supabase.rpc('record_auth_audit', {
                p_action: action,
                p_email: email ?? null,
                p_success: Boolean(success),
                p_error_message: errorMessage ?? null,
                p_tenant_id: tenantId ?? null,
                p_metadata: metadata ?? {}
            });

            // supabase-js 는 RPC 오류를 throw 하지 않고 error 로 돌려준다.
            // (테이블/함수 미배포 환경에서도 로그인은 정상 진행돼야 한다)
            if (error) {
                console.warn('[auth_login_audit] 기록 실패:', error.message || error);
            }
        } catch (e) {
            // 감사 로그 기록 실패는 UX를 깨지 않도록 조용히 무시 (콘솔만)
            console.warn('[auth_login_audit] 기록 실패:', e);
        }
    }

    async isConnection() {
        try {
            // 먼저 현재 세션 상태를 확인
            const { data: currentSession, error: sessionError } = await window.$supabase.auth.getSession();

            // 세션이 유효한 경우
            if (!sessionError && currentSession.session && currentSession.session.user) {
                await this.writeUserData(currentSession);
                return true;
            }

            // 세션이 없거나 만료된 경우, 저장된 토큰으로 복구 시도
            let accessToken = '';
            let refreshToken = '';

            // Check if we're in webview mode
            if (window.AndroidBridge) {
                try {
                    const sessionTokenStr = window.AndroidBridge.getSessionToken();
                    if (sessionTokenStr) {
                        const sessionTokens = JSON.parse(sessionTokenStr);
                        accessToken = sessionTokens.access_token || '';
                        refreshToken = sessionTokens.refresh_token || '';
                    }
                } catch (e) {
                    console.error('Error parsing session tokens:', e);
                    accessToken = '';
                    refreshToken = '';
                }
            } else {
                if (document.cookie && document.cookie.includes('; ')) {
                    accessToken = document.cookie
                        .split('; ')
                        .find((row) => row.startsWith('access_token'))
                        ?.split('=')[1];
                    refreshToken = document.cookie
                        .split('; ')
                        .find((row) => row.startsWith('refresh_token'))
                        ?.split('=')[1];
                }
            }

            // 저장된 토큰이 있는 경우 세션 복구 시도
            if (accessToken && refreshToken && accessToken.length > 0 && refreshToken.length > 0) {
                try {
                    const { error: setSessionError } = await window.$supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (setSessionError) {
                        console.log('setSession failed, attempting refresh:', setSessionError.message);
                        // setSession이 실패한 경우 refresh 시도
                        await this.refreshSession();
                    }
                } catch (setSessionErr) {
                    console.log('setSession exception, attempting refresh:', setSessionErr.message);
                    await this.refreshSession();
                }
            } else {
                // 저장된 토큰이 없는 경우 refresh 시도
                await this.refreshSession();
            }

            // 최종 세션 상태 확인
            const { data: finalSession, error: finalError } = await window.$supabase.auth.getSession();
            if (finalError || !finalSession.session) {
                return false;
            }

            if (finalSession.session && finalSession.session.user) {
                await this.writeUserData(finalSession);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking Supabase connection:', error);
            return false;
        }
    }

    /**
     * @param {{ clearOnError?: boolean }} [options] - clearOnError: false 이면 갱신 실패 시 세션을 지우지 않음 (예: setTenant 직후 메타데이터만 갱신된 경우)
     */
    async refreshSession(options = {}) {
        const clearOnError = options.clearOnError !== false;
        try {
            const { data: refreshData, error: refreshError } = await window.$supabase.auth.refreshSession();

            if (refreshError) {
                console.error('Error refreshing session:', refreshError);

                // refresh_token_already_used 오류인 경우 특별 처리
                if (refreshError.message && refreshError.message.includes('refresh_token_already_used')) {
                    console.log('Refresh token already used, clearing session and redirecting to login');
                    await this.clearSession();
                    return;
                }

                // 기타 refresh 오류인 경우 세션 클리어 (clearOnError 가 true 일 때만)
                if (clearOnError) {
                    await this.clearSession();
                }
            } else if (refreshData && refreshData.session) {
                // Refresh 성공한 경우 새 토큰 저장
                // Check if we're in webview mode
                if (window.AndroidBridge) {
                    console.log('refreshSession - webview mode');
                    window.AndroidBridge.saveSessionToken(refreshData.session.access_token, refreshData.session.refresh_token);
                    console.log(
                        'refreshSession - webview mode - saveSessionToken',
                        refreshData.session.access_token,
                        refreshData.session.refresh_token
                    );
                } else {
                    const baseDomain = getBaseDomain();
                    if (baseDomain.includes('process-gpt')) {
                        document.cookie = `access_token=${refreshData.session.access_token}; domain=.${baseDomain}; path=/; Secure; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; domain=.${baseDomain}; path=/; Secure; SameSite=Lax`;
                    } else {
                        document.cookie = `access_token=${refreshData.session.access_token}; path=/; SameSite=Lax`;
                        document.cookie = `refresh_token=${refreshData.session.refresh_token}; path=/; SameSite=Lax`;
                    }
                }
                window.localStorage.setItem('accessToken', refreshData.session.access_token);
            }
        } catch (e) {
            console.error('Error in refreshSession:', e);
            if (clearOnError) {
                await this.clearSession();
            }
        }
    }

    async clearSession() {
        try {
            const cookieOptionsBase = `path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;

            // Check if we're in webview mode
            if (window.AndroidBridge) {
                window.AndroidBridge.clearSession();
            } else {
                const baseDomain = getBaseDomain();
                if (baseDomain.includes('process-gpt')) {
                    document.cookie = `access_token=; domain=.${baseDomain}; ${cookieOptionsBase}; Secure`;
                    document.cookie = `refresh_token=; domain=.${baseDomain}; ${cookieOptionsBase}; Secure`;
                } else {
                    document.cookie = `access_token=; ${cookieOptionsBase}`;
                    document.cookie = `refresh_token=; ${cookieOptionsBase}`;
                }
            }
            window.localStorage.removeItem('accessToken');
        } catch (e) {
            console.error('Error clearing session:', e);
        }
    }

    async checkTenantOwner(tenantId) {
        try {
            const data = await this.getObject(`tenants/${tenantId}`, { key: 'id' });
            if (data && data.owner) {
                const user = await this.getUserInfo();
                if (data.owner == user.uid) {
                    return true;
                }
            } else {
                return false;
            }
        } catch (e) {
            throw new StorageBaseError('error in checkTenantOwner', e, arguments);
        }
    }

    /**
     * 로그인 직전 "이 이메일이 이 테넌트에 등록돼 있는가" 만 확인한다.
     *
     * 인증(auth.users)은 테넌트 구분이 없으므로 이 확인이 없으면 A 테넌트 계정으로
     * B 테넌트 서브도메인에 로그인할 수 있다. 없앨 수 없는 인가 관문이다.
     *
     * 예전에는 anon 으로 public.users 를 직접 select 해서 행 전체를 받아왔다.
     * 20260911000011_users_rls_tenant_scope.sql 이 anon 의 users 조회를 막았으므로
     * SECURITY DEFINER RPC 로 옮긴다. 돌려받는 값은 boolean 하나뿐이다 —
     * 호출부가 쓰던 값이 "행이 있느냐" 뿐이었고(users 에는 is_delete 류 컬럼이 없다),
     * 이메일 목록을 내려주면 그 자체가 계정 열거 수단이 된다.
     *
     * @param {string} email
     * @returns {Promise<boolean>}
     */
    async loginPrecheck(email) {
        const tenantId = window.$tenantName || null;
        const { data, error } = await window.$supabase.rpc('login_precheck', {
            p_email: email,
            p_tenant_id: tenantId
        });

        if (!error) {
            return data === true;
        }

        // RPC 가 아직 배포되지 않은 DB(마이그레이션 이전)에서 전원 로그인 불가가
        // 되는 것을 막는다. "함수 없음" 일 때만 예전 직접 조회로 되돌아간다.
        // (RLS 가 이미 좁혀진 DB 라면 이 조회는 어차피 빈 결과를 준다)
        const code = error.code || '';
        const missingFunction = code === 'PGRST202' || code === '42883' || /Could not find the function/i.test(error.message || '');
        if (!missingFunction) {
            throw new StorageBaseError('error in loginPrecheck', error, arguments);
        }

        const filter = { match: { email } };
        if (tenantId) {
            filter.match.tenant_id = tenantId;
        }
        const existUser = await this.getObject('users', filter);
        return !!(existUser && existUser.id);
    }

    async signIn(userInfo) {
        try {
            // 메인(테넌트 미지정) 서버에서는 테넌트 소속을 따질 대상이 없으므로
            // 사전 확인 자체를 건너뛴다 — 기존 동작 그대로다.
            const skipPrecheck = !!(window.$isTenantServer && !window.$tenantName);
            const userExists = skipPrecheck ? false : await this.loginPrecheck(userInfo.email);
            if (skipPrecheck || userExists) {
                const result = await window.$supabase.auth.signInWithPassword({
                    email: userInfo.email,
                    password: userInfo.password
                });

                if (!result.error) {
                    // 로그인 성공 — 실패만 남기면 "언제 로그인했는지"를 알 수 없으므로 성공도 기록한다.
                    await this.recordAuthAudit({
                        action: 'login',
                        email: userInfo.email,
                        success: true,
                        errorMessage: null,
                        tenantId: window.$tenantName || null,
                        metadata: { method: 'password' }
                    });
                    return result.data;
                } else if (result.error && result.error.message.includes('Email not confirmed')) {
                    await this.recordAuthAudit({
                        action: 'login',
                        email: userInfo.email,
                        success: false,
                        errorMessage: result.error.message,
                        tenantId: window.$tenantName || null,
                        metadata: { method: 'password', reason: 'email_not_confirmed' }
                    });
                    // 계정 인증이 완료 되지 않았습니다. 메시지 출력 부분
                    await window.$app_.try({
                        action: () => Promise.reject(new Error()),
                        errorMsg: window.$i18n.global.t('StorageBaseSupabase.emailNotConfirmed')
                    });
                    return {
                        error: true
                    };
                } else {
                    await this.recordAuthAudit({
                        action: 'login',
                        email: userInfo.email,
                        success: false,
                        errorMessage: result.error?.message || 'login_failed',
                        tenantId: window.$tenantName || null,
                        metadata: { method: 'password' }
                    });
                    // 계정 없음/비밀번호 오류를 구분하지 않고 하나의 문구로 응답한다.
                    // (구분해서 안내하면 응답만 보고 계정 존재 여부를 알아낼 수 있다)
                    await window.$app_.try({
                        action: () => Promise.reject(new Error()),
                        errorMsg: window.$i18n.global.t('StorageBaseSupabase.invalidCredentials')
                    });
                    return {
                        error: true
                    };
                }
            } else {
                await this.recordAuthAudit({
                    action: 'login',
                    email: userInfo.email,
                    success: false,
                    errorMessage: 'not_registered_email',
                    tenantId: window.$tenantName || null,
                    metadata: { method: 'password', reason: 'not_registered_email' }
                });
                // 가입되지 않은 이메일이어도 비밀번호 오류와 동일한 문구로 응답한다.
                await window.$app_.try({
                    action: () => Promise.reject(new Error()),
                    errorMsg: window.$i18n.global.t('StorageBaseSupabase.invalidCredentials')
                });
                return {
                    error: true
                };
            }
        } catch (e) {
            throw new StorageBaseError('error in signIn', e, arguments);
        }
    }
    async signInWithKeycloak() {
        try {
            const { data, error } = await window.$supabase.auth.signInWithOAuth({
                provider: 'keycloak',
                options: {
                    scopes: 'openid'
                }
            });

            // OAuth는 리다이렉트 기반이라 여기서 “최종 성공/실패”를 알 수 없고,
            // 대신 시도 시작/실패만 기록한다. (최종 성공은 SIGNED_IN 이벤트에서 기록)
            if (error) {
                await this.recordAuthAudit({
                    action: 'login_oauth',
                    email: null,
                    success: false,
                    errorMessage: error.message,
                    tenantId: window.$tenantName || null,
                    metadata: { provider: 'keycloak' }
                });
            } else {
                await this.recordAuthAudit({
                    action: 'login_oauth',
                    email: null,
                    success: true,
                    errorMessage: null,
                    tenantId: window.$tenantName || null,
                    metadata: { provider: 'keycloak' }
                });
            }
        } catch (e) {
            throw new StorageBaseError('error in signInWithKeycloak', e, arguments);
        }
    }
    async signUp(userInfo) {
        try {
            // 로그인 전 public.users 조회는 RLS 정책에 따라 거부될 수 있으므로
            // 선행 중복 검사를 하지 않고 Supabase Auth의 결과를 사용한다.
            const result = await window.$supabase.auth.signUp({
                email: userInfo.email,
                password: userInfo.password,
                options: {
                    data: {
                        name: userInfo.username,
                        // 조직도 사전등록 매칭 시 어느 테넌트의 배치를 적용할지 식별한다.
                        // 실제 권한 부여는 DB trigger가 pending_org_members를 기준으로 수행한다.
                        tenant_id: window.$tenantName
                    },
                    emailRedirectTo: window.location.origin
                }
            });

            if (result.error) {
                result.errorMsg = result.error.message;
                return result;
            }

            // 이메일 확인이 켜진 Supabase는 기존 계정의 존재를 노출하지 않기 위해
            // 오류 대신 identities가 빈 user를 반환할 수 있다.
            if (result.data?.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
                return {
                    error: true,
                    errorMsg: '이미 가입된 이메일입니다.'
                };
            }

            // autoconfirm 환경에서는 가입 즉시 session이 발급되므로
            // 메일 확인 안내 대신 바로 서비스로 이동한다.
            result.data['isNewUser'] = !result.data.session;
            result.data['approvalPending'] = !!window.$pal;
            return result.data;
        } catch (e) {
            throw new StorageBaseError('error in signUp', e, arguments);
        }
    }

    async signOut() {
        try {
            // 가능한 한 인증된 상태에서 로그아웃 시각을 먼저 기록
            const auditEmail = window.localStorage.getItem('email');
            await this.recordAuthAudit({
                action: 'logout',
                email: auditEmail,
                success: true,
                errorMessage: null,
                tenantId: window.$tenantName || null,
                metadata: { source: 'StorageBaseSupabase.signOut' }
            });

            window.localStorage.removeItem('accessToken');
            window.localStorage.removeItem('author');
            window.localStorage.removeItem('userName');
            window.localStorage.removeItem('email');
            window.localStorage.removeItem('picture');
            window.localStorage.removeItem('uid');
            window.localStorage.removeItem('isAdmin');
            window.localStorage.removeItem('execution');
            window.localStorage.removeItem('role');

            // Check if we're in webview mode
            if (window.AndroidBridge) {
                window.AndroidBridge.clearSession();
            } else {
                const baseDomain = getBaseDomain();
                if (baseDomain.includes('process-gpt')) {
                    document.cookie = `access_token=; domain=.${baseDomain}; path=/`;
                    document.cookie = `refresh_token=; domain=.${baseDomain}; path=/`;
                } else {
                    document.cookie = 'access_token=; path=/';
                    document.cookie = 'refresh_token=; path=/';
                }
            }

            return await window.$supabase.auth.signOut();
        } catch (e) {
            throw new StorageBaseError('error in signOut', e, arguments);
        }
    }

    async getUserInfo() {
        try {
            if (await this.isConnection()) {
                const userData = await window.$supabase.auth.getUser();
                if (userData.error) {
                    throw new StorageBaseError('error in getUserInfo', userData.error, arguments);
                } else if (userData.data.user) {
                    const uid = userData.data.user.id;
                    const filter = { id: uid };
                    if (window.$tenantName) {
                        filter.tenant_id = window.$tenantName;
                    }

                    // 테넌트가 없는 경우 여러 결과가 나올 수 있으므로 항상 limit(1) 사용
                    var { data, error } = await window.$supabase.from('users').select().match(filter).limit(1);

                    if (!error && data && data.length > 0) {
                        const userData = data[0];
                        return {
                            email: userData.email,
                            name: userData.username,
                            profile: userData.profile,
                            uid: userData.id,
                            role: userData.role,
                            tenant_id: userData.tenant_id
                        };
                    } else if (error) {
                        throw new StorageBaseError('error in getUserInfo', error, arguments);
                    }
                }
            } else {
                // 루트 페이지('/'), 인증 플로우, BPMN E2E 화면에서는 로그인 체크 시 리다이렉트하지 않음
                // (E2E 화면은 로컬 자동 레이아웃을 세션 없이 검증하는 공개 테스트 경로)
                const path = window.location.pathname;
                if (path === '/' || path.startsWith('/auth/') || path.startsWith('/bpmn-auto-layout-e2e')) {
                    return null;
                }

                await window.$app_.try({
                    action: () => Promise.reject(new Error())
                    // errorMsg: window.$i18n.global.t('StorageBaseSupabase.loginRequired')
                });
                window.location.href = '/auth/login';
            }
        } catch (e) {
            if (e instanceof StorageBaseError && e.cause) {
                console.error('Error in getUserInfo:', e.cause);
            } else {
                console.error('Unexpected error in getUserInfo:', e);
            }
            throw new StorageBaseError('error in getUserInfo', e, arguments);
        }
    }

    async resetPassword(email) {
        try {
            // NOTE:
            // - GoTrue/Supabase Auth는 redirectTo를 넘기지 않으면 ConfirmationURL의 redirect_to에
            //   Site URL(대시보드 기본값)만 넣어서, 메일 링크 클릭 시 루트(/)로 이동한다.
            // - 대시보드 "Redirect URLs"는 허용 목록일 뿐, 실제 redirect_to는 API 호출 시
            //   redirectTo로 전달해야 반영된다. 따라서 항상 redirectTo를 넘겨 재설정 페이지로 직행하도록 한다.
            // - 멀티테넌트 환경에서는 비밀번호 재설정 메일 링크가 메인 도메인 재설정 페이지로 가야 하므로
            //   getMainDomainUrl('/auth/reset-password')를 사용한다. (로컬은 origin 기준)
            const isLocal =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname === '0.0.0.0';

            const options = {
                redirectTo: isLocal
                    ? new URL('/auth/reset-password', window.location.origin).toString()
                    : getMainDomainUrl('/auth/reset-password')
            };

            const result = await window.$supabase.auth.resetPasswordForEmail(email, options);
            return result;
        } catch (e) {
            throw new StorageBaseError('error in resetPassword', e, arguments);
        }
    }

    async getString(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            const column = options.column ? options.column : '*';
            if (options && options.match) {
                const { data, error } = await window.$supabase.from(obj.table).select(column).match(options.match).maybeSingle();

                if (error) {
                    return error;
                } else if (data) {
                    if (column != '*') {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase
                    .from(obj.table)
                    .select(column)
                    .eq(obj.searchKey, obj.searchVal)
                    .maybeSingle();

                if (error) {
                    return error;
                } else if (data) {
                    if (column != '*') {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            } else {
                const { data, error } = await window.$supabase.from(obj.table).select(column).maybeSingle();

                if (error) {
                    return error;
                } else if (data) {
                    if (column != '*') {
                        return data[column];
                    } else {
                        return data;
                    }
                }
            }
        } catch (error) {
            if (error.code === 'PGRST116' || error.code === '42703') {
                console.log(error.message);
                return '';
            }
            throw new StorageBaseError('error in getString', error, arguments);
        }
    }

    async getObject(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { data, error } = await window.$supabase.from(obj.table).select().match(options.match).maybeSingle();

                if (error) {
                    throw new StorageBaseError('error in getObject', error, arguments);
                } else if (data) {
                    return data;
                }
            } else if (obj.searchVal) {
                const { data, error } = await window.$supabase.from(obj.table).select().eq(obj.searchKey, obj.searchVal).maybeSingle();

                if (error) {
                    throw new StorageBaseError('error in getObject', error, arguments);
                } else if (data) {
                    return data;
                }
            } else {
                const { data, error } = await window.$supabase.from(obj.table).select().maybeSingle();

                if (error) {
                    throw new StorageBaseError('error in getObject', error, arguments);
                } else if (data) {
                    return data;
                }
            }
        } catch (error) {
            // PostgREST 오류는 StorageBaseError 의 cause 로 감싸 던지므로 양쪽을 함께 본다.
            // (행 없음 PGRST116 / 없는 컬럼 42703 은 기존처럼 관대하게 빈 객체로 처리)
            const code = error?.code || error?.cause?.code;
            if (code === 'PGRST116' || code === '42703') {
                console.log(error?.cause?.message || error.message);
                return {};
            } else {
                throw error instanceof StorageBaseError ? error : new StorageBaseError('error in getObject', error);
            }
        }
    }

    // PUT
    async putString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else if (options && options.onConflict) {
                const { error } = await window.$supabase.from(obj.table).upsert(value, { onConflict: options.onConflict });
                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in putString' + error.message, error, arguments);
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in putString', error, arguments);
        }
    }

    async putObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            let result;
            if (options && options.match) {
                result = await window.$supabase.from(obj.table).upsert(value).match(options.match);
            } else if (options && options.onConflict) {
                result = await window.$supabase.from(obj.table).upsert(value, { onConflict: options.onConflict });
            } else if (obj.searchVal) {
                result = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);
            } else {
                result = await window.$supabase.from(obj.table).upsert(value);
            }

            const { error, status, statusText } = result;
            if (status != 200 && error) {
                throw new StorageBaseError('error in putObject:' + status + ' ' + statusText + ' ' + error.message, error, arguments);
            }
            return result;
        } catch (error) {
            throw new StorageBaseError('error in putObject', error, arguments);
        }
    }

    // PUSH
    async pushString(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in pushString', error, arguments);
                }
            }
        } catch (error) {
            throw new Error('error in pushString', { cause: error, args: arguments });
        }
    }

    async pushObject(path, value, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).match(options.match);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else if (obj.searchVal) {
                const { error } = await window.$supabase.from(obj.table).upsert(value).eq(obj.searchKey, obj.searchVal);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            } else {
                const { error } = await window.$supabase.from(obj.table).upsert(value);

                if (error) {
                    throw new StorageBaseError('error in pushObject', error, arguments);
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in pushObject', error, arguments);
        }
    }

    // DELETE
    async delete(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { error, status, statusText } = await window.$supabase.from(obj.table).delete().match(options.match);

                if (error && status != 200) {
                    throw new StorageBaseError('error in delete ' + status + ' ' + statusText, error, arguments);
                }
            } else if (obj.searchVal) {
                const { error, status, statusText } = await window.$supabase.from(obj.table).delete().eq(obj.searchKey, obj.searchVal);

                if (error && status != 200) {
                    throw new StorageBaseError('error in delete ' + status + ' ' + statusText, error, arguments);
                }
            }

            return false;
        } catch (error) {
            throw new StorageBaseError('error in delete', error, arguments);
        }
    }

    async _watch_off(ref) {
        // unsubscribe 만으로는 클라이언트 캐시에서 topic 이 즉시 사라지지 않아,
        // 같은 이름으로 곧바로 재구독하면 위의 'after subscribe()' 오류가 난다.
        try {
            return await window.$supabase.removeChannel(ref);
        } catch (e) {
            return await ref.unsubscribe();
        }
    }

    async _watch(options, callback) {
        /*
            options: {
                channel: 'custom-channel', // 채널명
                type: 'postgres_changes', // 이벤트 타입
                event: '*', // 이벤트명
                schema: 'public', // 스키마명
                table: 'users' // 테이블명
            }
        */
        let ref = window.$supabase;
        // 채널 설정
        const channelName = options.channel || 'custom-channel';
        // supabase-js 는 같은 topic 을 요청하면 '이미 subscribe 된' 캐시 채널을 돌려준다.
        // 그 채널에 다시 .on('postgres_changes') 를 걸면
        //   cannot add `postgres_changes` callbacks ... after `subscribe()`
        // 로 throw 된다. 고정 채널명을 쓰는 구독(events-<taskId> 등)이 재마운트될 때
        // 실제로 발생하므로, 새로 만들기 전에 남아 있는 동명 채널을 먼저 제거한다.
        try {
            const stale = (window.$supabase.getChannels() || []).filter((c) => c && c.topic === `realtime:${channelName}`);
            for (const c of stale) {
                await window.$supabase.removeChannel(c);
            }
        } catch (e) {
            console.warn('[realtime] 기존 채널 정리 실패:', channelName, e);
        }
        ref = ref.channel(channelName);

        // 이벤트 타입 지정
        const eventType = options.type || 'postgres_changes';
        /* 
            'postgres_changes': Postgres 테이블의 INSERT, UPDATE, DELETE 등 데이터 변경 감지
            'broadcast': 같은 채널에 연결된 클라이언트끼리 메시지를 주고받을 때 사용 (실시간 채팅, 알림, 커스텀 이벤트 등에 활용)
            'presence': 같은 채널에 접속한 사용자들의 접속/이탈 상태(접속자 목록, 온라인/오프라인 등)를 실시간으로 감지
        */

        // 이벤트 옵션
        let eventOptions = {};
        if (eventType === 'postgres_changes') {
            eventOptions = {
                event: options.event || '*', // INSERT, UPDATE, DELETE, *
                schema: options.schema || 'public',
                table: options.table,
                filter: options.filter
            };
        } else if (eventType === 'broadcast') {
            eventOptions = {
                event: options.event || 'message'
            };
        } else if (eventType === 'presence') {
            eventOptions = {
                event: options.event || 'sync'
            };
        }

        ref = ref.on(eventType, eventOptions, (payload) => {
            callback(payload);
        });
        await ref.subscribe();

        return ref;
    }

    async watch(path, channel, callback, options = {}) {
        try {
            let obj = this.formatDataPath(path);
            let watchOptions = {
                event: '*',
                schema: 'public',
                table: obj.table
            };

            // 기존 chats 테이블 필터링 로직
            if (obj.table === 'chats' && path.startsWith('db://chats/')) {
                obj.chatRoomIds = path.split('/')[3];
                watchOptions.filter = obj.chatRoomIds ? `` : null;
            }

            // 새로운 필터 옵션 지원
            if (options.filter) {
                watchOptions.filter = options.filter;
            }

            const subscription = await window.$supabase
                .channel(channel)
                .on('postgres_changes', watchOptions, (payload) => {
                    // console.log('Change received!', payload);
                    callback(payload);
                })
                .subscribe((status) => {
                    if (options.onStatusChange) {
                        options.onStatusChange(status);
                    }
                });

            return subscription;
        } catch (error) {
            throw new StorageBaseError('error in watch', error, arguments);
        }
    }

    async watch_added(path, callback) {
        try {
            let obj = this.formatDataPath(path);
            await window.$supabase
                .channel('room1')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: obj.table
                    },
                    (payload) => {
                        // console.log('Change received!', payload);
                        callback(payload);
                    }
                )
                .subscribe();
        } catch (error) {
            throw new StorageBaseError('error in watch_added', error, arguments);
        }
    }

    async unwatch(path) {
        try {
            let obj = this.formatDataPath(path);
            const subscription = window.$supabase.channel('room1').on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: obj.table
                },
                (payload) => {
                    console.log('Change received!', payload);
                }
            );

            await subscription.unsubscribe();

            console.log(`Unsubscribed from changes on ${obj.table}`);
        } catch (error) {
            throw new StorageBaseError('error in unwatch', error, arguments);
        }
    }

    async list(path, options) {
        try {
            // options: {
            //     key: 'key:value' // default key:'orderBy:Field'  First filtering
            //     sort: "desc", // default "asc"
            //     orderBy: 'when',
            //     size: 10,
            //     startAt: orderBy key contains values
            //     endAt: orderBy key contains values
            //     startAfter:  orderBy key then value
            //     endBefore: orderBy key then value
            //     snapshot: true // return snapshot
            // }

            if (!options) options = {};
            const orderByField = options.orderBy || 'id';
            const isAscending = !options.sort || !options.sort.includes('desc');
            let query = window.$supabase;

            if (path) {
                query = query.from(path);
            } else {
                query = query.from();
            }

            // key 처리 - 컬럼명
            if (options.key) {
                query = query.select(options.key);
            } else {
                query = query.select();
            }

            // orderBy 처리
            if (options.orderBy) {
                query = query.order(orderByField, { ascending: isAscending });
            }
            if (options.secondaryOrderBy) {
                const secondaryAscending = !options.secondarySort || !options.secondarySort.includes('desc');
                query = query.order(options.secondaryOrderBy, { ascending: secondaryAscending });
            }

            /* 
                gt: >
                gte: >=
                lt: <
                lte: <=
                eq: == 

                startAt: >=
                startAfter: >
                endAt: <=
                endBefore: <
                
            */
            // 범위 쿼리 처리
            if (options.startAt && !options.endAt && !options.endBefore) {
                query = query.gte(orderByField, options.startAt);
            } else if (options.startAt && options.endAt) {
                if (options.startAt == options.endAt) {
                    query = query.eq(orderByField, options.startAt);
                } else {
                    query = query.gte(orderByField, options.startAt).lte(orderByField, options.endAt);
                }
            } else if (options.endAt && !options.startAt && !options.startAfter) {
                query = query.lte(orderByField, options.endAt);
            } else if (options.startAfter && !options.endBefore && !options.endAt) {
                query = query.gt(orderByField, options.startAfter);
            } else if (options.startAfter && options.endBefore) {
                if (options.startAfter == options.endBefore) {
                    query = query.eq(orderByField, options.startAfter);
                } else {
                    query = query.gt(orderByField, options.startAfter).lt(orderByField, options.endBefore);
                }
            } else if (options.endBefore && !options.startAfter && !options.startAt) {
                query = query.lt(orderByField, options.endBefore);
            } else if (options.startAt && options.endBefore && !options.endAt) {
                query = query.gte(orderByField, options.startAt).lt(orderByField, options.endBefore);
            } else if (options.startAfter && options.endAt && !options.startAt) {
                query = query.gt(orderByField, options.startAfter).lte(orderByField, options.endAt);
            }

            // like 처리
            if (options.like) {
                query = query.like(options.like.key, options.like.value);
            }

            // 일치 처리
            if (options.match) {
                query = query.match(options.match);
            }

            if (options.inArray) {
                query = query.in(options.inArray.column, options.inArray.values);
            }
            // Add match condition for text[] type column
            if (options.matchArray) {
                query = query.contains(options.matchArray.column, options.matchArray.values);
            }

            if (options.not) {
                query = query.not(options.not.key, options.not.operator, options.not.value);
            }
            if (options.maybeSingle) {
                query = query.maybeSingle();
            }
            // size 처리
            if (options.size) {
                query = query.limit(options.size);
            }

            if (options.range) {
                query = query.range(options.range.from, options.range.to);
            }

            const { data, error } = await query;
            if (error) {
                // 에러 객체를 그대로 반환하면 호출부는 그것을 '결과 배열'로 오인한다.
                // 진실된 truthy 객체라서 `|| []` 도 `if (data)` 도 막지 못하고,
                // 결국 첫 배열 메서드에서 `x.sort is not a function` 으로 터진다.
                // (운영에서 관측된 t.sort 오류의 근본 원인)
                throw new StorageBaseError('error in list', error, arguments);
            }
            return data || [];
        } catch (error) {
            throw new StorageBaseError('error in list', error, arguments);
        }
    }

    async callProcedure(procedure, params) {
        try {
            const { data, error } = await window.$supabase.rpc(procedure, params);

            if (error) {
                console.error('Error calling function:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in callProcedure:', error);
            return error;
        }
    }

    async writeUserData(value, userInfo) {
        try {
            if (value.session) {
                window.localStorage.setItem('accessToken', value.session.access_token);

                // Check if we're in webview mode
                if (window.AndroidBridge) {
                    window.AndroidBridge.saveSessionToken(value.session.access_token, value.session.refresh_token);
                } else {
                    const baseDomain = getBaseDomain();
                    if (baseDomain.includes('process-gpt')) {
                        document.cookie = `access_token=${value.session.access_token}; domain=.${baseDomain}; path=/; Secure; SameSite=Lax`;
                        document.cookie = `refresh_token=${value.session.refresh_token}; domain=.${baseDomain}; path=/; Secure; SameSite=Lax`;
                    } else {
                        document.cookie = `access_token=${value.session.access_token}; path=/; SameSite=Lax`;
                        document.cookie = `refresh_token=${value.session.refresh_token}; path=/; SameSite=Lax`;
                    }
                }
            }
            if (value.session.user) {
                window.localStorage.setItem('author', value.session.user.email);
                window.localStorage.setItem('uid', value.session.user.id);

                let filter = { id: value.session.user.id };
                if (window.$tenantName) {
                    filter.tenant_id = window.$tenantName;
                }
                // 메인 도메인($tenantName 없음)에서는 동일 id로 여러 테넌트 행이 있어 maybeSingle()이 실패하므로, 한 행만 조회
                const isMainDomain = !window.$tenantName;
                const { data: rawData, error } = isMainDomain
                    ? await window.$supabase.from('users').select('*').match(filter).limit(1)
                    : await window.$supabase.from('users').select('*').match(filter).maybeSingle();
                const data = isMainDomain ? (Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : null) : rawData;

                if (error) {
                    // 조회 실패(커넥션 풀 고갈 503/504, statement timeout 57014, 네트워크 오류 등)는
                    // "유저 없음"이 아니다. 여기서 signOut 하면 멀쩡한 세션을 서버에서 죽여
                    // 로그인 → 수십 초 뒤 자동 로그아웃 → /auth/login 무한 루프가 된다.
                    // 세션을 유지하고 다음 isConnection() 호출의 재시도에 맡긴다.
                    console.warn('writeUserData: users 조회 실패 — 세션은 유지합니다:', error.message || error);
                    return;
                }

                if (data && !error) {
                    // 덮어쓰기 전의 값을 잡아둔다. 아래에서 실제로 바뀌었을 때만 이벤트를 쏘기 위함이다.
                    // 값이 없으면 사이드바가 mount 시 읽는 기본값(비관리자)과 같으므로 false 로 본다.
                    const prevIsAdmin = window.localStorage.getItem('isAdmin') === 'true';
                    const nextIsAdmin = data.is_admin === true || data.is_admin === 'true' || isAdminRole(data.role);
                    window.localStorage.setItem('isAdmin', String(nextIsAdmin));
                    window.localStorage.setItem('picture', data.profile || '');
                    if (data.role && data.role !== '') {
                        window.localStorage.setItem('role', data.role);
                    }
                    window.localStorage.setItem('userName', data.username || '');
                    window.localStorage.setItem('email', data.email || '');
                    window.localStorage.setItem('uid', data.id || '');

                    // FCM 토큰 처리 - user_devices 테이블 사용
                    let fcm_token;

                    // Check if we're in webview mode
                    if (window.AndroidBridge) {
                        // Get FCM token from Android bridge
                        try {
                            fcm_token = window.AndroidBridge.getFcmToken();
                        } catch (e) {
                            console.log('Failed to get FCM token from AndroidBridge:', e);
                            fcm_token = null;
                        }
                    }

                    const userEmail = data.email || '';

                    // 이 브라우저를 알림 받을 기기 중 하나로 등록·갱신한다.
                    //
                    // 예전에는 이메일 하나로 한 줄만 두었다. 그래서 회사 PC 에서
                    // 웹을 켜면 휴대폰 앱의 토큰이 덮어써져 **휴대폰 알림이
                    // 조용히 끊겼다.** 끊긴 줄도 모른다. 지금은 기기마다 한 줄이고,
                    // 이 브라우저는 자기 줄만 고친다.
                    //
                    // last_active_at 을 함께 찍는 것이 중요하다. 알림을 어느 기기로
                    // 보낼지는 서버가 이 시각으로 정한다 — 이 값이 없으면 PC 앞에
                    // 앉아 있어도 PC 는 "안 쓰는 기기" 가 된다.
                    if (userEmail) {
                        try {
                            const row = {
                                user_email: userEmail,
                                device_id: deviceId(window),
                                device_type: deviceType(window),
                                last_active_at: new Date().toISOString()
                            };
                            // 토큰을 못 받는 브라우저도 있다. 그때는 줄만 두어
                            // "지금 여기를 보고 있다" 는 사실을 남긴다.
                            if (fcm_token) row.device_token = fcm_token;

                            const { error: deviceError } = await window.$supabase
                                .from('user_devices')
                                .upsert(row, { onConflict: 'user_email,device_id' });
                            if (deviceError) console.error('user_devices 갱신 오류:', deviceError);
                        } catch (e) {
                            // 알림 등록 실패가 로그인을 막을 이유는 없다.
                            console.warn('user_devices 갱신 실패:', e);
                        }
                    }

                    // 값이 실제로 달라졌을 때만 알린다.
                    //
                    // 예전에는 is_admin 이 참이기만 하면 매번 쐈다. writeUserData 는 isConnection()
                    // 경로로 불리고, isConnection() 은 getUserInfo() 가 부르므로 getUserInfo() 를
                    // 호출하는 화면마다 이벤트가 나갔다. VerticalSidebar 는 이 이벤트를 받으면
                    // loadSidebar() → getDefinitionList() 로 proc_def 전체 목록을 다시 받는다.
                    // 그래서 관리자 계정은 채팅방을 열 때마다 정의 목록을 2회씩 재조회했다.
                    // (일반 계정은 이 분기를 타지 않아 증상이 없었다 — 관리자만 느린 버그였다)
                    //
                    // 강등(true→false)도 메뉴를 다시 그려야 하므로 함께 알린다.
                    if (nextIsAdmin !== prevIsAdmin) {
                        const event = new CustomEvent('localStorageChange', { detail: { key: 'isAdmin', value: nextIsAdmin } });
                        window.dispatchEvent(event);
                    }
                } else {
                    // 정상 응답인데 행이 없음 — 이 테넌트에 users 행이 없는 유저만 로그아웃시킨다.
                    await this.signOut();
                    throw new StorageBaseError('error in writeUserData', 'user not found', arguments);
                }
            }
        } catch (e) {
            if (e instanceof StorageBaseError) throw e; // user not found — 위에서 이미 signOut 했다
            // 토큰 미러링·user_devices 갱신 같은 부가 작업의 실패로 세션을 죽이지 않는다.
            console.warn('writeUserData: 부가 작업 실패 — 세션은 유지합니다:', e);
        }
    }

    formatDataPath(path, options) {
        try {
            path = path.includes('://') ? path.split('://')[1] : path;
            let obj = {
                table: ''
            };

            if (path.includes('/')) {
                obj.table = path.split('/')[0];
                if (options && options.key) {
                    obj.searchKey = options.key;
                    obj.searchVal = path.split('/')[1];
                }
            } else {
                obj.table = path;
            }

            return obj;
        } catch (error) {
            throw new StorageBaseError('error in formatDataPath', error, arguments);
        }
    }

    async getCount(path, options) {
        try {
            let obj = this.formatDataPath(path, options);
            if (options && options.match) {
                const { count, error } = await window.$supabase.from(obj.table).select('*', { count: 'exact' }).match(options.match);

                if (error) {
                    return error;
                } else {
                    return count;
                }
            } else if (obj.searchVal) {
                const { count, error } = await window.$supabase
                    .from(obj.table)
                    .select('*', { count: 'exact' })
                    .eq(obj.searchKey, obj.searchVal);

                if (error) {
                    return error;
                } else {
                    return count;
                }
            } else {
                const { count, error } = await window.$supabase.from(obj.table).select('*', { count: 'exact' });

                if (error) {
                    return error;
                } else {
                    return count;
                }
            }
        } catch (error) {
            throw new StorageBaseError('error in getCount', error, arguments);
        }
    }

    async callProcedure(procedure, params) {
        try {
            const { data, error } = await window.$supabase.rpc(procedure, params);

            if (error) {
                console.error('Error calling function:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in callProcedure:', error);
            return error;
        }
    }

    async search(keyword) {
        let results = [];
        if (window.$jms || window.$pal) {
            results = await Promise.all([this.searchProcDef(keyword)]);
        } else {
            results = await Promise.all([
                this.searchProcInst(keyword),
                this.searchProcDef(keyword),
                this.searchChatRoom(keyword),
                this.searchChat(keyword)
            ]);
        }
        results = results.filter((item) => item !== null);
        return results;
    }

    async searchProcInst(keyword) {
        try {
            const email = window.localStorage.getItem('email');
            const data = await this.callProcedure('search_bpm_proc_inst', {
                keyword,
                user_email: email
            });

            if (data && data.length > 0) {
                const list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.proc_inst_id && item.proc_inst_id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.proc_inst_id);
                    }
                    if (item.proc_inst_name && item.proc_inst_name.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.proc_inst_name);
                    }
                    if (item.variables_data && JSON.stringify(item.variables_data).toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(JSON.stringify(item.variables_data));
                    }
                    return {
                        title: item.proc_inst_name,
                        href: `/instancelist/${btoa(item.proc_inst_id)}`,
                        matches: matchingColumns
                    };
                });
                if (list.length > 0) {
                    return {
                        type: 'instance',
                        header: '프로세스 인스턴스',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchProcDef(keyword) {
        try {
            // 전역 검색이 다른 테넌트의 프로세스 정의까지 노출하지 않도록 테넌트로 좁힌다.
            let query = window.$supabase
                .from('proc_def')
                .select()
                .eq('isdeleted', false)
                .or(`id.ilike.%${keyword}%,name.ilike.%${keyword}%,bpmn.ilike.%${keyword}%`);
            const tenantId = getTenantId();
            if (tenantId) query = query.eq('tenant_id', tenantId);
            const { data, error } = await query;

            if (error) throw new StorageBaseError('error in searchProcDef', error, arguments);

            if (data && data.length > 0) {
                let list = data.map((item) => {
                    if (!item.id) return null;
                    const matchingColumns = [];
                    const lowerKeyword = keyword.toLowerCase();

                    if (item.id && item.id.toLowerCase().includes(lowerKeyword)) {
                        matchingColumns.push(item.id);
                    }
                    if (item.name && item.name.toLowerCase().includes(lowerKeyword)) {
                        matchingColumns.push(item.name);
                    }
                    if (item.bpmn && item.bpmn.toLowerCase().includes(lowerKeyword)) {
                        matchingColumns.push(item.bpmn);
                    }

                    return {
                        title: item.name,
                        href: `/definitions/${item.id}`,
                        matches: matchingColumns
                    };
                });
                list = list.filter((item) => item !== null);
                if (list.length > 0) {
                    return {
                        type: 'definition',
                        header: '프로세스 정의',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchFormDef(keyword) {
        try {
            const { data, error } = await window.$supabase.from('form_def').select().ilike('id', `%${keyword}%`);

            if (error) throw new StorageBaseError('error in searchFormDef', error, arguments);

            if (data && data.length > 0) {
                let list = data.map((item) => {
                    const matchingColumns = [];
                    if (item.id && item.id.toLowerCase().includes(keyword.toLowerCase())) {
                        matchingColumns.push(item.id);
                    }
                    return {
                        title: item.id,
                        href: `/ui-definitions/${item.id}`,
                        matches: matchingColumns
                    };
                });
                list = list.filter((item) => item !== null);
                if (list.length > 0) {
                    return {
                        type: 'form',
                        header: '화면 정의',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchChatRoom(keyword) {
        try {
            const email = window.localStorage.getItem('email');
            // 전역 검색이 다른 테넌트의 채팅방까지 노출하지 않도록 테넌트로 좁힌다.
            let query = window.$supabase.from('chat_rooms').select().or(`name.ilike.%${keyword}%`);
            const tenantId = getTenantId();
            if (tenantId) query = query.eq('tenant_id', tenantId);
            const { data, error } = await query;

            if (error) throw new StorageBaseError('error in searchChat', error, arguments);

            const filteredData = data.filter((item) => item.participants.some((participant) => participant.email === email));
            if (filteredData && filteredData.length > 0) {
                let list = filteredData.map((item) => {
                    const matchingColumns = [item.participants.map((user) => user.username).join(', ')];
                    return {
                        title: item.name,
                        href: `/chats?id=${item.id}`,
                        matches: matchingColumns
                    };
                });
                list = list.filter((item) => item !== null);
                if (list.length > 0) {
                    return {
                        type: 'chat-room',
                        header: '채팅방',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async searchChat(keyword) {
        try {
            const data = await this.callProcedure('search_chat_room_chats', { keyword: keyword });

            if (data && data.length > 0) {
                let list = data.map((item) => {
                    const email = window.localStorage.getItem('email');
                    if (item.participants && item.participants.some((participant) => participant.email === email)) {
                        const matchingColumns = [`${item.messages.name}: ${item.messages.content}`];
                        return {
                            title: item.name,
                            href: `/chats?id=${item.id}`,
                            matches: matchingColumns
                        };
                    } else {
                        return null;
                    }
                });
                list = list.filter((item) => item !== null);
                if (list.length > 0) {
                    return {
                        type: 'chat',
                        header: '채팅 메시지',
                        list: list
                    };
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async uploadImage(fileName, image) {
        try {
            const { data, error } = await window.$supabase.storage.from('chat-images').upload(fileName, image);

            if (error) {
                return error;
            }

            return data;
        } catch (error) {
            throw new StorageBaseError('error in uploadImage', error, arguments);
        }
    }

    /**
     * 채팅 이미지 주소. 만료 1시간짜리 서명 URL 이다.
     *
     * 옛 메시지에는 `path` 대신 공개 URL 이 통째로 저장돼 있다. 그 값을 그대로
     * 넣어도 버킷·경로를 되찾아 다시 서명하므로 지난 대화의 사진도 보인다.
     */
    async getImageUrl(path) {
        try {
            return await resolveStorageUrl(path, { bucket: 'chat-images' });
        } catch (error) {
            throw new StorageBaseError('error in getImageUrl', error, arguments);
        }
    }

    async uploadFile(fileName, file) {
        try {
            const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
            const storageFileName = `uploads/${Date.now()}_${crypto.randomUUID().substring(0, 8)}${ext}`;

            const { data, error } = await window.$supabase.storage.from('files').upload(storageFileName, file, {
                cacheControl: '3600',
                upsert: false,
                metadata: {
                    original_filename: fileName
                }
            });

            if (error) {
                return error;
            }

            // 저장해도 되는 값은 **경로뿐**이다.
            // 서명 URL 은 1시간이면 만료되므로 폼 데이터나 DB 에 남기면 나중에 깨진다.
            // 지금 당장 열어야 하는 쪽(업로드 직후 새 창 등)만 signedUrl 을 쓴다.
            const signedUrl = await this.getFileUrl(data.path);

            return {
                ...data,
                originalFileName: fileName,
                bucket: 'files',
                signedUrl: signedUrl,
                // 옛 이름들. 절대 URL 을 저장하던 호출부가 빈 값을 받아
                // 자연스럽게 "경로만 저장" 으로 넘어가게 둔다.
                publicUrl: '',
                fullPath: data.path
            };
        } catch (error) {
            throw new StorageBaseError('error in uploadFile', error, arguments);
        }
    }

    /**
     * 파일 주소. 만료 1시간짜리 서명 URL 이다.
     *
     * 경로(`uploads/...`)든, 예전에 저장해 둔 공개 URL 이든 받는다.
     * 공개 URL 은 버킷·경로를 되찾아 다시 서명하므로 옛 데이터도 열린다.
     *
     * 이 주소를 받은 사람은 1시간 동안 파일을 내려받을 수 있다. 그래서 발급 자체를
     * 다운로드 이력에 남긴다(action='signed_url'). 채팅 이미지 표시용
     * `getImageUrl` 은 목록 한 번에 수십 건이 쌓여 이력이 소음으로 덮이므로 제외한다.
     */
    async getFileUrl(path) {
        try {
            const url = await resolveStorageUrl(path, { bucket: 'files' });
            // 실제로 서명한 경우에만 남긴다 — 바깥 주소·data:·앱 정적 경로는 대상이 아니다.
            const ref = parseStorageRef(path, 'files');
            if (ref && url) {
                // 기록 실패가 파일 열기를 막지 않는다 (헬퍼가 삼킨다).
                await recordFileDownload({
                    bucket: ref.bucket,
                    path: ref.path,
                    action: DOWNLOAD_ACTIONS.SIGNED_URL,
                    metadata: { source: 'StorageBaseSupabase.getFileUrl' }
                });
            }
            return url;
        } catch (error) {
            throw new StorageBaseError('error in getFileUrl', error, arguments);
        }
    }

    /**
     * 파일을 내려받는다.
     *
     * 예전에는 공개 URL 을 fetch 했지만 버킷이 비공개가 되면서 그 길이 막혔다.
     * 이제는 로그인 세션을 쓰는 `download()` 로 받는다 — 서명 URL 을 한 번 더
     * 거칠 필요가 없고, RLS 가 그대로 적용된다.
     */
    async downloadFile(path) {
        try {
            const ref = parseStorageRef(path, 'files');
            if (!ref) {
                return { message: `다운로드할 수 없는 경로입니다: ${path}` };
            }

            const { data: blob, error } = await window.$supabase.storage.from(ref.bucket).download(ref.path);

            if (error) {
                console.log(error);
                return error;
            }
            if (!blob) return null;

            // 업로드 때 `<타임스탬프>_<uuid8>.<확장자>` 로 이름을 바꾼다. 앞머리를 떼면
            // 원래 이름이 남는 형식이라 그 규칙을 유지한다(떼고 나서 비면 그대로 쓴다).
            const lastSegment = ref.path.split('/').pop() || '';
            const originalFileName = lastSegment.split('_').slice(1).join('_') || lastSegment;
            const file = new File([blob], originalFileName, { type: blob.type });

            // 다운로드 이력 (docs/security.md 3-3). 기록 실패는 헬퍼가 삼키므로
            // 여기서 다운로드 흐름이 끊기는 일은 없다.
            await recordFileDownload({
                bucket: ref.bucket,
                path: ref.path,
                fileName: originalFileName,
                action: DOWNLOAD_ACTIONS.DOWNLOAD,
                metadata: { source: 'StorageBaseSupabase.downloadFile', size: blob.size ?? null }
            });

            return {
                file: file,
                file_path: ref.path,
                originalFileName: originalFileName
            };
        } catch (error) {
            throw new StorageBaseError('error in downloadFile', error, arguments);
        }
    }
}
