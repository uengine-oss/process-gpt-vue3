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
                        router.push('/dashboard2');
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
                        await storage?.writeUserData(result);
                        router.push(window.$isTenantServer ? '/tenant/manage' : '/dashboard2')
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
                        alert(result.errorMsg);
                    } else {
                        await storage?.writeUserData(result);
                        router.push(window.$isTenantServer ? '/tenant/manage' : '/dashboard2');
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
        async updatePassword(email: string, password: string) {
            try {
                var result: any = await storage?.updateUser(password);
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
