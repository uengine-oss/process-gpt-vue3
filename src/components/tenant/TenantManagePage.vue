<template>
    <v-container class="bg-surface" style="height: 100%">
        <v-row no-gutters>
            <Logo/>
        </v-row>

        <v-row no-gutters justify="center" class="mt-7">
            <h1 class="text-grey200" style="font-size: 40px;">{{ $t('tenantManagePage.title') }}</h1>
        </v-row>
        <v-row no-gutters justify="center">
            <p v-if="isOwner" class="font-weight-semibold text-grey100 text-h5" style="text-align: center;">
                {{ $t('tenantManagePage.subTitle1') }}
            </p>
            <p v-else class="font-weight-semibold text-grey100 text-h5" style="text-align: center;">
                {{ $t('tenantManagePage.subTitle3') }}
            </p>
        </v-row>

        <v-row no-gutters justify="center" class="mt-5">
            <v-card @click="toAddTenentPage()"
                elevation="9" variant="outlined"
                style="padding: 10px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 10px !important;
                    width: 500px;"
                    color="primary"
            >
                <v-row class="pa-0 ma-0">
                    <Icons  :icon="'plus'" :size="16" class="mr-2" />
                    <div>{{ $t('tenantManagePage.createCompany') }}</div>
                </v-row>
            </v-card>
        </v-row>

        <div style="display: flex; justify-content: center; align-items: center;">
            <div style="height: 450px; width: 500px; overflow-y: auto;">
                <v-row no-gutters justify="center" class="mt-3" v-for="(tenantInfo, index) in tenantInfos" :key="index">
                    <v-card @click="toSelectedTenantPage(tenantInfo.id)"
                        elevation="9" variant="outlined"
                        style="padding: 10px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            border-radius: 10px !important;
                            width: 500px;
                            height: 45px;"
                    >
                        <v-row class="pa-0 ma-0">
                            <v-col cols="1">
                                <v-icon size="24">mdi-office-building-outline</v-icon>     
                            </v-col>
                            <v-col cols="8">
                                &nbsp; {{ tenantInfo.id }}
                            </v-col>
                            <v-col v-if="isOwner" cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="사용자 초대">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click.stop="openInviteDialog(tenantInfo.id)" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                                <v-icon size="24">mdi-account-plus</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </v-sheet>
                            </v-col>
                            <v-col v-if="isOwner" cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="수정">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click.stop="toEditTenantPage(tenantInfo.id)" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                                <v-icon size="24">mdi-pencil</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </v-sheet>
                            </v-col>
                            <v-col v-if="isOwner" cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="삭제">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click.stop="deleteDialog = true; tenantIdToDelete = tenantInfo.id" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                                <Icons :icon="'trash'" />
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </v-sheet>
                            </v-col>
                        </v-row>
                    </v-card>
                </v-row>
            </div>
        </div>
    </v-container>

    <v-dialog v-model="deleteDialog" max-width="500">
        <v-card>
            <v-card-text>
                회사를 삭제하시겠습니까?
            </v-card-text>
            <v-card-actions class="justify-center pt-0">
                <v-btn color="primary" variant="flat" @click="deleteTenant(); deleteDialog = false">삭제</v-btn>
                <v-btn color="error" variant="flat" @click="deleteDialog = false">취소</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="inviteDialog" max-width="600" persistent>
        <v-card class="pa-4">
            <v-card-title class="text-center pb-4">
                <v-icon class="mr-2" size="28" color="primary">mdi-account-plus</v-icon>
                <span class="text-h5 font-weight-bold">사용자 초대</span>
            </v-card-title>
            
            <v-card-text class="pb-2">
                <v-form ref="inviteForm" v-model="inviteFormValid">
                    <v-row>
                        <v-col cols="12">
                            <v-text-field
                                v-model="newUser.name"
                                label="사용자 이름"
                                prepend-inner-icon="mdi-account"
                                variant="outlined"
                                :rules="[v => !!v || '사용자 이름을 입력해주세요']"
                                required
                                class="mb-2"
                            ></v-text-field>
                        </v-col>
                        
                        <v-col cols="12">
                            <v-text-field
                                v-model="newUser.email"
                                label="이메일"
                                prepend-inner-icon="mdi-email"
                                variant="outlined"
                                type="email"
                                :rules="[
                                    v => !!v || '이메일을 입력해주세요',
                                    v => /.+@.+\..+/.test(v) || '올바른 이메일 형식을 입력해주세요'
                                ]"
                                required
                                class="mb-2"
                            ></v-text-field>
                        </v-col>
                        
                        <v-col cols="12">
                            <v-select
                                v-model="newUser.role"
                                label="역할"
                                prepend-inner-icon="mdi-account-tie"
                                variant="outlined"
                                :items="roleOptions"
                                item-title="text"
                                item-value="value"
                                :rules="[v => !!v || '역할을 선택해주세요']"
                                required
                            ></v-select>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>

            <v-card-actions class="justify-center pt-4">
                <v-btn 
                    color="primary" 
                    variant="flat" 
                    size="large"
                    class="px-8 mr-4"
                    :disabled="!inviteFormValid"
                    @click="inviteUser"
                >
                    <v-icon class="mr-2">mdi-send</v-icon>
                    초대하기
                </v-btn>
                <v-btn 
                    color="grey" 
                    variant="outlined" 
                    size="large"
                    class="px-8"
                    @click="closeInviteDialog"
                >
                    <v-icon class="mr-2">mdi-close</v-icon>
                    닫기
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import Logo from '@/layouts/full/logo/Logo.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'TenantManagePage',
    components: {
        Logo
    },
    data: () => ({
        tenantInfos: [],
        deleteDialog: false,
        tenantIdToDelete: null,
        isOwner: false,
        inviteDialog: false,
        inviteFormValid: false,
        currentTenantId: null,
        newUser: {
            name: '',
            email: '',
            role: ''
        },
        roleOptions: [
            { text: '관리자', value: 'admin' },
            { text: '사용자', value: 'user' },
            { text: '뷰어', value: 'viewer' }
        ]
    }),
    async created() {
        const isLogin = await backend.checkDBConnection();
        if(!isLogin) {
            this.$router.push('/auth/login')
        }
        const tenants = await backend.getTenants();
        
        if (tenants && tenants.length > 0) {
            this.tenantInfos = tenants;
            this.isOwner = true;
        } else {
            // tenantInfos가 없다면 users 테이블에서 유저 정보를 가져온다
            try {
                const users = await backend.getUserAllTenants();
                
                if (users && users.length > 0) {
                    // tenant_id를 추출하여 고유한 tenant 목록을 만든다
                    const uniqueTenants = [...new Set(users.map(user => user.tenant_id))];
                    
                    if (uniqueTenants.length === 1) {
                        // 유저 정보가 하나의 tenant에만 속해있다면 바로 리다이렉션
                        const tenantId = uniqueTenants[0];
                        if (tenantId) {
                            if (tenantId == 'localhost') {
                                this.window.location.href = 'http://localhost:8088/definition-map';
                            } else {
                                this.toSelectedTenantPage(tenantId);
                            }
                        }
                    } else if (uniqueTenants.length > 1) {
                        // 여러 tenant가 있다면 tenant 목록으로 설정
                        this.tenantInfos = uniqueTenants.map(tenantId => ({ id: tenantId }));
                    }
                }
            } catch (error) {
                console.error('Error fetching user list:', error);
            }
        }
    },
    methods: {
        async createNewUser(user) {
            var me = this
            me.$try({
                action: async () => {
                    let userInfo = {
                        username: user.name,
                        email: user.email,
                        role: user.role,
                        tenant_id: me.currentTenantId
                    }
                    const result = await backend.createUser(userInfo);
                    console.log(result)
                },
                successMsg: me.$t('organizationChartDefinition.addUserSuccess'),
                errorMsg: me.$t('organizationChartDefinition.addUserFailed'),
            });
        },
        toAddTenentPage() {
            this.$router.push('/tenant/create')
        },

        toEditTenantPage(tenantId) {
            this.$router.push(`/tenant/edit/${tenantId}`)
        },

        async deleteTenant() {
            await backend.deleteTenant(this.tenantIdToDelete)
            this.tenantInfos = this.tenantInfos.filter(tenant => tenant.id !== this.tenantIdToDelete)
        },

        openInviteDialog(tenantId) {
            this.currentTenantId = tenantId;
            this.inviteDialog = true;
        },

        closeInviteDialog() {
            this.inviteDialog = false;
            this.resetInviteForm();
        },

        resetInviteForm() {
            this.newUser = {
                name: '',
                email: '',
                role: ''
            };
            this.inviteFormValid = false;
            if (this.$refs.inviteForm) {
                this.$refs.inviteForm.reset();
            }
        },

        async inviteUser() {
            if (!this.inviteFormValid) return;
            
            try {
                await this.createNewUser(this.newUser);
                this.closeInviteDialog();
            } catch (error) {
                console.error('사용자 초대 중 오류 발생:', error);
            }
        },
        
        async toSelectedTenantPage(tenantId) {
            await backend.setTenant(tenantId);
            
            // Android 웹뷰 브릿지 체크
            if (window.AndroidBridge) {
                // 네이티브 앱에 테넌트 변경 요청
                window.AndroidBridge.changeTenant(tenantId);
                return;
            }

            // 일반 웹 브라우저인 경우 기존 로직 실행
            if(!location.port || location.port == '') {
                location.href = `https://${tenantId}.process-gpt.io/definition-map`;
            } else {
                location.href = `http://${tenantId}.process-gpt.io:${location.port}/definition-map`;
            }
        }
    },
};
</script>
