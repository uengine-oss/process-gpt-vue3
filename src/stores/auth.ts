import { router } from '@/router';
import { defineStore } from 'pinia';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { mapPasswordServerError } from '@/utils/passwordPolicy';
import { getAal, needsChallenge } from '@/utils/mfa';
import { MFA_CHALLENGE_PATH } from '@/utils/mfaGate';

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
                    router.push('/process-architecture');
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
                        const target = window.$isTenantServer ? '/tenant/manage' : '/process-architecture';

                        // MFA(TOTP) (docs/security.md 2-3, 항목 3)
                        // 비밀번호만 통과한 세션(currentLevel=aal1, nextLevel=aal2)은 보호 화면을
                        // 거치지 않고 바로 챌린지 화면으로 보낸다. 라우터 가드(mfaGate)도 같은 판정을
                        // 하지만, 여기서 먼저 분기해야 보호 화면이 한 번 깜빡이지 않는다.
                        const aal = await getAal();
                        if (needsChallenge(aal)) {
                            router.push({ path: MFA_CHALLENGE_PATH, query: { redirect: target } });
                        } else {
                            router.push(target);
                        }
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
                            // GoTrue 비밀번호 정책 위반은 원문 대신 사용자 문구로 바꿔 안내한다.
                            const policyMsg = mapPasswordServerError(result.errorMsg, (key: string, named?: any) => proxy.$t(key, named));
                            const errorMsg = policyMsg || result.errorMsg;
                            await (window as any).$app_.try({
                                action: () => Promise.reject(new Error(errorMsg)),
                                errorMsg: errorMsg
                            });
                        }
                    } else {
                        if (result.approvalPending) {
                            await (window as any).$app_.try({
                                action: () => Promise.resolve(),
                                successMsg: result.isNewUser
                                    ? '가입 신청이 접수되었습니다. 이메일 인증과 관리자 승인 후 이용할 수 있습니다.'
                                    : '가입 신청이 접수되었습니다. 관리자 승인을 기다려 주세요.'
                            });
                            await router.push(result.isNewUser ? '/auth/login' : '/auth/signup-pending');
                            return;
                        }
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
                            router.push('/process-architecture');
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
            const translate = (key: string, named?: any) => proxy.$t(key, named);
            try {
                const result: any = await backend?.updateUser({ password: password });
                // 결과가 없으면(로그인 정보 없음 등) 기존과 동일하게 조용히 종료한다.
                if (!result) return;
                if (result.error) {
                    // GoTrue 비밀번호 정책 위반 메시지를 사용자 문구로 변환한다.
                    const rawMsg = result.errorMsg || result.error?.message || result.error;
                    const errorMsg = mapPasswordServerError(rawMsg, translate) || rawMsg;
                    await (window as any).$app_.try({
                        action: () => Promise.reject(new Error(errorMsg)),
                        errorMsg: errorMsg
                    });
                    return;
                }
                await (window as any).$app_.try({
                    action: () => Promise.resolve(),
                    successMsg: proxy.$t('auth.passwordUpdated')
                });
                router.push('/auth/login');
            } catch (e: any) {
                console.log(e);
                const rawMsg = e?.response?.data?.message || e?.response?.data?.detail || e?.message;
                const policyMsg = mapPasswordServerError(rawMsg, translate);
                if (policyMsg) {
                    await (window as any).$app_.try({
                        action: () => Promise.reject(new Error(policyMsg)),
                        errorMsg: policyMsg
                    });
                }
            }
        }
    }
});
