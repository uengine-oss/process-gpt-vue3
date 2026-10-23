import { router } from '@/router';
import { defineStore } from 'pinia';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export const useAuthStore = defineStore({
    id: 'auth',
    actions: {
        async logout() {
            try {
                await storage?.signOut();
                if (router.currentRoute.value.path === '/') {
                    window.location.reload();
                } else {
                    router.push('/');
                }
            } catch (e) {
                console.log(e);
            }
        },
        async signInWithKeycloak() {
            try {
                const result: any = await storage?.signInWithKeycloak();

                if (!result.error) {
                    router.push('/definition-map');
                } else {
                    await (window as any).$app_.try({
                        action: () => Promise.reject(new Error()),
                        errorMsg: result.errorMsg
                    });
                }
            } catch (e) {
                console.log(e);
            }
        },
        async signIn(email: string, password: string) {
            try {
                if (email && password) {
                    const userInfo: any = {
                        email: email,
                        password: password
                    };
                    const result: any = await storage?.signIn(userInfo);

                    if (result?.error) {
                        // signIn 이 이미 메시지를 띄운 경우(errorMsg 없음)에는 중복 표시하지 않는다.
                        if (result.errorMsg) {
                            await (window as any).$app_.try({
                                action: () => Promise.reject(new Error()),
                                errorMsg: result.errorMsg
                            });
                        }
                    } else {
                        const tenantId = window.$tenantName;
                        await backend.setTenant(tenantId);
                        router.push(window.$isTenantServer ? '/tenant/manage' : '/definition-map');
                    }
                }
            } catch (e: any) {
                // 여기서 조용히 넘어가면 사용자는 '아무 일도 안 일어난' 화면만 본다.
                // 로그인은 실패 이유를 잘못 알려주면 자기 계정을 의심하게 되는 자리다.
                console.error('[auth] 로그인 실패:', e);
                const isNetwork = /Failed to fetch|NetworkError|ERR_CONNECTION|fetch failed|Load failed|network/i.test(
                    [e?.message, e?.cause?.message, String(e || '')].filter(Boolean).join(' ')
                );
                const key = isNetwork ? 'connectionFailed' : 'unexpectedError';
                await (window as any).$app_.try({
                    action: () => Promise.reject(new Error()),
                    errorMsg: (window as any).$i18n.global.t(`StorageBaseSupabase.${key}`)
                });
            }
        },
        async signUp(username: string, email: string, password: string, proxy: any) {
            try {
                if (username && email && password) {
                    const userInfo: any = {
                        username: username,
                        email: email,
                        password: password
                    };
                    const result: any = await storage?.signUp(userInfo);

                    if (result.error) {
                        if (result.errorMsg === 'Email rate limit exceeded') {
                            await (window as any).$app_.try({
                                action: () => Promise.reject(new Error(proxy.$t('auth.emailRateLimitExceeded'))),
                                errorMsg: proxy.$t('auth.emailRateLimitExceeded')
                            });
                        } else if (result.errorMsg === 'User already registered') {
                            await (window as any).$app_.try({
                                action: () => Promise.reject(new Error(proxy.$t('auth.userAlreadyRegistered'))),
                                errorMsg: proxy.$t('auth.userAlreadyRegistered')
                            });
                        } else {
                            await (window as any).$app_.try({
                                action: () => Promise.reject(new Error(result.errorMsg)),
                                errorMsg: result.errorMsg
                            });
                        }
                    } else {
                        const tenantId = window.$tenantName;
                        await backend.setTenant(tenantId);
                        if (result['isNewUser']) {
                            await (window as any).$app_.try({
                                action: () => Promise.resolve(),
                                successMsg: proxy.$t('auth.verificationEmailSent')
                            });
                            router.push('/auth/login');
                        } else {
                            await (window as any).$app_.try({
                                action: () => Promise.resolve(),
                                successMsg: proxy.$t('auth.registrationSuccess')
                            });
                            router.push('/definition-map');
                        }
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
        async resetPassword(email: string, proxy: any) {
            try {
                const result: any = await storage?.resetPassword(email);
                if (!result.error) {
                    await (window as any).$app_.try({
                        action: () => Promise.resolve(),
                        successMsg: proxy.$t('auth.emailSent')
                    });
                    router.push('/auth/login');
                }
            } catch (e) {
                console.log(e);
            }
        },
        async updatePassword(password: string, proxy: any) {
            try {
                const result: any = await backend?.updateUser({ password: password });
                if (!result.error) {
                    await (window as any).$app_.try({
                        action: () => Promise.resolve(),
                        successMsg: proxy.$t('auth.passwordUpdated')
                    });
                    router.push('/auth/login');
                }
            } catch (e) {
                console.log(e);
            }
        }
    }
});
