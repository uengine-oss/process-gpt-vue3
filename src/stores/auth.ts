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

                    if (result.error) {
                        await (window as any).$app_.try({
                            action: () => Promise.reject(new Error()),
                            errorMsg: result.errorMsg
                        });
                    } else {
                        const tenantId = window.$tenantName;
                        await backend.setTenant(tenantId);
                        router.push(window.$isTenantServer ? '/tenant/manage' : '/definition-map');
                    }
                }
            } catch (e) {
                console.log(e);
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
                        // 폐쇄망 등 이메일 인증이 비활성화(autoconfirm)된 환경에서는 signUp 직후 세션이 즉시 발급된다.
                        // 세션이 있으면 인증 대기 없이 바로 로그인 처리하고, 세션이 없으면(이메일 확인 필요) 기존 안내를 유지한다.
                        if (result['session']) {
                            await (window as any).$app_.try({
                                action: () => Promise.resolve(),
                                successMsg: proxy.$t('auth.registrationSuccess')
                            });
                            router.push(window.$isTenantServer ? '/tenant/manage' : '/definition-map');
                        } else {
                            await (window as any).$app_.try({
                                action: () => Promise.resolve(),
                                successMsg: proxy.$t('auth.verificationEmailSent')
                            });
                            router.push('/auth/login');
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
