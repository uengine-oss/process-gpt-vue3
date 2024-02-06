import { defineStore } from 'pinia';
import { router } from '@/router';

import StorageBase from '@/utils/StorageBase';
const storage = StorageBase.getStorage('supabase');

export const useAuthStore = defineStore({
    id: 'auth',
    actions: {
        async logout() {
            try {
                await storage?.signOut();
                router.push("/");
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

                    if (result) {
                        router.push('/dashboard2');
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
                        password: password,
                    }
                    var result: any = await storage?.signUp(userInfo);

                    if (result) {
                        router.push('/auth/login');
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
    }
});
