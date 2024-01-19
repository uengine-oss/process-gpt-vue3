import { defineStore } from 'pinia';
import { router } from '@/router';
import { createAvatar } from '@dicebear/core';
import { initials } from '@dicebear/collection';

import CommonStorageBase from "@/components/storage/CommonStorageBase";

export const useAuthStore = defineStore({
    id: 'auth',
    state: () => ({
        storage: new CommonStorageBase(this),
    }),
    actions: {
        async logout() {
            try {
                await this.storage.logout();
                router.push("/");
            } catch (e) {
                console.log(e);
            }
        },
        async signInAcebase(email: string, password: string) {
            try {
                if (email && password) {
                    const userInfo: any = {
                        email: email,
                        password: password
                    };
                    var result: any = await this.storage.signIn('db://login', userInfo);

                    if (result) {
                        const avatar = createAvatar(initials, {
                            seed: result.user.username
                        });
                        const picture = avatar.toDataUriSync();

                        window.localStorage.setItem("author", result.user.email);
                        window.localStorage.setItem("userName", result.user.username);
                        window.localStorage.setItem("email", result.user.email);
                        window.localStorage.setItem("picture", picture);
                        window.localStorage.setItem("accessToken", result.accessToken);
                        window.localStorage.setItem("uid", result.user.uid);

                        await this.writeUserData(result.user.uid, result.user.username, result.user.email, picture);

                        router.push('/dashboard2');
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
        async signUpAcebase(username: string, email: string, password: string) {
            try {
                if (username && email && password) {
                    const avatar = createAvatar(initials, {
                        seed: username
                    });
                    const picture = avatar.toDataUriSync();
                    
                    const userInfo: any = {
                        username: username,
                        email: email,
                        password: password,
                    }
                    var result: any = await this.storage.signUp('db://login', userInfo);

                    if (result) {
                        window.localStorage.setItem("author", result.user.email);
                        window.localStorage.setItem("userName", result.user.username);
                        window.localStorage.setItem("email", result.user.email);
                        window.localStorage.setItem("picture", picture);
                        window.localStorage.setItem("accessToken", result.accessToken);
                        window.localStorage.setItem("uid", result.user.uid);

                        await this.writeUserData(result.user.uid, result.user.username, result.user.email, picture);

                        router.push('/auth/login');

                    }
                }

            } catch (e) {
                console.log(e);
            }
        },
        writeUserData(userId: string, name: string, email: string, imageUrl: string) {
            var obj = {
                username: name,
                email: email,
                profile: imageUrl,
                state: 'signIn',
                loginDate: Date.now()
            };

            var eObj = {
                uid: userId,
                userName: name,
                profile: imageUrl,
                email: email,
            };

            this.storage.putObject(`db://users/${userId}`, obj);
            
            //새로운 로그인 유저
            if (email) {
                var convertEmail = email.replace(/\./gi, '_');
                this.storage.putObject(`db://enrolledUsers/${convertEmail}`, eObj);
            }
        },
    }
});
