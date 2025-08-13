<template>
    <div elevation="10">
        <v-row class="ma-0 pa-0">
            <v-col cols="12" sm="6">
                <v-card flat class="pa-1">
                    <v-card-item class="pa-0">
                        <h5 class="text-h5">{{ $t('accountTab.profileImageChange') }}</h5>
                        <div class="text-center mt-6 mb-6">
                            <v-avatar size="120">
                                <img :src="selectedProfileImage || picture || ''" height="120" alt="image" />
                            </v-avatar>
                        </div>
                        <div class="d-flex justify-center mb-7">
                            <v-dialog width="650" v-model="imageChangeDialog">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" color="secondary" class="mx-2" rounded="pill" variant="flat" text="이미지 선택">{{
                                        $t('accountTab.imageSelect') }}</v-btn>
                                </template>

                                <v-card style="padding:30px;">
                                    <v-row>
                                        <v-col>
                                            <v-row>
                                                <img v-for="(profileImage, name) in profileImages"
                                                    @click="() => imageChange(profileImage)" class="change-profile-image"
                                                    :key="name" :src="profileImage" width="100" height="100" alt="Mathew"
                                                    style="border-radius: 50%; padding:10px;" />
                                            </v-row>
                                        </v-col>
                                    </v-row>
                                </v-card>
                            </v-dialog>
                            <!-- <v-btn color="error" class="mx-2" variant="outlined" rounded="pill">Reset</v-btn> -->
                        </div>
                        <!-- <div class="text-subtitle-1 text-grey100 text-center my-sm-8 my-6">
                            {{ $t('accountTab.imageSelect') }}
                        </div> -->
                    </v-card-item>
                </v-card>
            </v-col>

            <v-divider v-if="!isMobile" vertical></v-divider>

            <v-col cols="12" sm="6">
                <v-card flat class="pa-1">
                    <v-card-item class="pa-0">
                        <h5 class="text-h5 pb-2">{{ $t('accountTab.personalDetails') }}</h5>
                        <div class="text-subtitle-1 text-grey100">{{ $t('accountTab.personalDetailsExplanation') }}
                        </div>
                        <div class="mt-5 pb-4">
                            <v-row>
                                <v-col cols="12" md="6">
                                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.name') }}</v-label>
                                    <v-text-field color="primary" variant="outlined" type="text" v-model="userInfo.name"
                                        hide-details />
                                </v-col>
                                <v-col cols="12" md="6">
                                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.email') }}</v-label>
                                    <v-text-field color="primary" variant="outlined" type="email" v-model="userInfo.email"
                                        hide-details readonly></v-text-field>
                                </v-col>
                                <!-- <v-col cols="12" md="6">
                                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.phone') }}</v-label>
                                    <v-text-field color="primary" variant="outlined" type="text" v-model="storephone"
                                        hide-details></v-text-field>
                                </v-col>
                                <v-col cols="12">
                                    <v-label class="mb-2 font-weight-medium">{{ $t('accountTab.address') }}</v-label>
                                    <v-text-field color="primary" variant="outlined" type="text" v-model="storeaddress"
                                        hide-details></v-text-field>
                                </v-col> -->
                            </v-row>
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>
        </v-row>
        <div class="d-flex justify-end mt-5 pb-6">
            <v-btn @click="changeTenant" size="large" color="secondary" rounded="pill" class="mr-2" variant="flat">
                {{ $t('accountTab.changeTenant') }}
            </v-btn>
            <v-btn @click="updateUser" size="large" color="primary" rounded="pill" class="mr-4" variant="flat">
                {{ $t('accountTab.save') }}
            </v-btn>
            <!-- <v-btn size="large" class="bg-lighterror text-error"  rounded="pill">닫기</v-btn> -->
        </div>
    </div>
</template>

<script>
import { profileImages } from '@/components/pages/account-settings/profileImage';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        userInfo: {},
        imageChangeDialog: false,
        selectedProfileImage: "",
        profileImages
    }),
    async created() {
        this.userInfo = await backend.getUserInfo();
        this.selectedProfileImage = this.userInfo.profile;
    },
    methods: {
        imageChange(image) {
            this.selectedProfileImage = image;
            this.imageChangeDialog = false;
        },
        async updateUser() {
            const userInfo = {
                id: this.userInfo.uid,
                email: this.userInfo.email,
                username: this.userInfo.name,
                profile: this.selectedProfileImage
            }
            await backend.updateUserInfo({ type: 'update', user: userInfo });
            window.location.reload();
        },
        changeTenant() {
            // www로 이동하면서 로컬스토리지 클리어 파라미터 추가
            if(!location.port || location.port == '') {
                location.href = `https://www.process-gpt.io/tenant/manage?clear=true`;
            } else {
                location.href = `http://www.process-gpt.io:${location.port}/tenant/manage?clear=true`;
            }
        }
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    }
};
</script>

<style>
.change-profile-image:hover {
    cursor: pointer;
    opacity: 0.8;
}
</style>