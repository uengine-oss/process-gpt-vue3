import { router } from '@/router';
import { defineStore } from 'pinia';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

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
                
                    var result: any = await storage?.signInWithKeycloak();

                    if (!result.error) {
                        router.push('/definition-map');
                    } else {
                        alert(result.errorMsg);
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
                    var result: any = await storage?.signIn(userInfo);
                    
                    if (result.error) {
                        alert(result.errorMsg);
                    } else {
                        router.push(window.$isTenantServer ? '/tenant/manage' : '/definition-map')
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
        async signUp(username: string, email: string, password: string) {
            try {
                if (username && email && password) {
                    const userInfo: any = {
                        username: username,
                        email: email,
                        password: password
                    };
                    var result: any = await storage?.signUp(userInfo);

                    if (result.error) {
                        if(result.errorMsg === 'Email rate limit exceeded'){
                            alert(`${result.errorMsg}\n\n연결된 Supabase 의 SMTP 설정을 변경하여 이메일 전송 한도를 변경하거나 잠시 뒤에 다시 시도해주세요.\n\nSMTP 설정은 Supabase 대시보드의 Project Settings > Authentication > SMTP Settings 섹션에서 확인하실 수 있습니다.`);
                        } else {
                            alert(result.errorMsg);
                        }
                    } else {
                        if (window.$isTenantServer) {
                            alert("계정 인증 메일을 전송해드렸습니다. 이메일 확인 후 다시 로그인하세요.");
                            router.push('/auth/login');
                        } else {
                            router.push('/definition-map');
                        }
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
        async resetPassword(email: string) {
            try {
                var result: any = await storage?.resetPassword(email);
                if (!result.error) {
                    alert('메일이 발송되었습니다.');
                    router.push('/auth/login');
                }
            } catch (e) {
                console.log(e);
            }
        },
        async updatePassword(password: string) {
            try {
                var result: any = await storage?.updateUser({ password: password });
                if (!result.error) {
                    alert('비밀번호가 변경되었습니다.');
                    router.push('/auth/login');
                }
            } catch (e) {
                console.log(e);
            }
        }
    }
});
