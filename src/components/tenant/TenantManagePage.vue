<template>
    <v-container v-if="!isLoading" class="bg-surface" style="height: 100%">
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
            <v-card @click="!isNavigating ? toAddTenentPage() : null"
                elevation="9" variant="outlined"
                style="padding: 10px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 10px !important;
                    width: 500px;"
                    color="primary"
                :disabled="isNavigating"
                :class="{ 'disabled-card': isNavigating }"
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
                    <v-card @click="!isNavigating ? toSelectedTenantPage(tenantInfo.id) : null"
                        elevation="9" variant="outlined"
                        style="padding: 10px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            border-radius: 10px !important;
                            width: 500px;
                            height: 45px;"
                        :disabled="isNavigating"
                        :class="{ 'disabled-card': isNavigating }"
                    >
                        <v-row class="pa-0 ma-0">
                            <v-col cols="1">
                                <v-icon size="24">mdi-office-building-outline</v-icon>     
                            </v-col>
                            <v-col :cols="getColSize(tenantInfo)">
                                &nbsp; {{ tenantInfo.id }}
                            </v-col>
                            <v-col v-if="isNavigating && selectedTenantId === tenantInfo.id" cols="1" class="d-flex align-center justify-center">
                                <v-progress-circular
                                    indeterminate
                                    size="20"
                                    width="2"
                                    color="primary"
                                ></v-progress-circular>
                            </v-col>
                            <v-col cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="수정">
                                        <template v-slot:activator="{ props }">
                                            <v-btn :disabled="!tenantInfo.isOwned || isNavigating" @click.stop="!isNavigating ? toEditTenantPage(tenantInfo.id) : null" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                                <v-icon size="24">mdi-pencil</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </v-sheet>
                            </v-col>
                            <v-col cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="삭제">
                                        <template v-slot:activator="{ props }">
                                            <v-btn :disabled="!tenantInfo.isOwned || isNavigating" @click.stop="!isNavigating ? (deleteDialog = true, tenantIdToDelete = tenantInfo.id) : null" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
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

    <v-container v-else>
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background-color: white;"
            class="main-page-skeleton"
        >
            <v-row class="ma-0 pa-0" style="height: 100%;">
                <v-col cols="2" class="pa-4">
                    <v-skeleton-loader type="card"></v-skeleton-loader>
                </v-col>
                <v-col cols="10" class="pa-4">
                    <v-skeleton-loader class="main-page-skeleton-right1" type="card"></v-skeleton-loader>
                    <v-skeleton-loader class="main-page-skeleton-right2" type="card"></v-skeleton-loader>
                </v-col>
            </v-row>
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
        isLoading: true,
        isNavigating: false,
        selectedTenantId: null,
    }),
    async created() {
        const isLogin = await backend.checkDBConnection();
        if(!isLogin) {
            this.$router.push('/auth/login')
        }
        
        // URL 파라미터에서 clear=true인지 확인하고 로컬스토리지 클리어
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clear') === 'true') {
            localStorage.removeItem('tenantId');
            // URL에서 clear 파라미터 제거
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        if(localStorage.getItem('tenantId')) {
            this.toSelectedTenantPage(localStorage.getItem('tenantId'));
        } else {
            try {
                let allTenantInfos = [];
                // 소유한 테넌트들 가져오기
                const ownedTenants = await backend.getTenants() || [];
                ownedTenants.forEach(tenant => {
                    allTenantInfos.push({
                        id: tenant.id,
                        isOwned: true
                    });
                });
                
                // 속한 모든 테넌트들 가져오기 (소유한 것 + 직원으로 속한 것)
                const users = await backend.getUserAllTenants() || [];
                users.forEach(user => {
                    if(user.tenant_id && !allTenantInfos.some(tenant => tenant.id === user.tenant_id)) {
                        allTenantInfos.push({
                            id: user.tenant_id,
                            isOwned: false
                        });
                    }
                });
                
                
                if (allTenantInfos.length === 0) {
                    // 속한 테넌트가 없는 경우 (유저4)
                    this.tenantInfos = [];
                    this.isOwner = false;
                    this.isLoading = false;
                }
                // else if (allTenantInfos.length === 1) {
                //     // 하나의 테넌트에만 속한 경우 바로 리다이렉션 (유저3)
                //     const tenantId = allTenantInfos[0].id;
                //     if (tenantId && tenantId !== 'process-gpt') {
                //         this.toSelectedTenantPage(tenantId);
                //     } 
                // } 
                else {
                    // 여러 테넌트에 속한 경우 목록 표시 (유저1, 유저2)
                    this.tenantInfos = allTenantInfos;
                    this.isOwner = allTenantInfos.some(tenant => tenant.isOwned);
                    this.isLoading = false;
                }
            } catch (error) {
                console.error('Error fetching tenant list:', error);
                this.isLoading = false;
            }
        }
        
    },
    methods: {
        toAddTenentPage() {
            this.$router.push('/tenant/create')
        },

        toEditTenantPage(tenantId) {
            this.$router.push(`/tenant/edit/${tenantId}`)
        },

        async deleteTenant() {
            await backend.deleteTenant(this.tenantIdToDelete)
            if(localStorage.getItem('tenantId') && localStorage.getItem('tenantId') === this.tenantIdToDelete) {
                localStorage.removeItem('tenantId');
            }
            this.tenantInfos = this.tenantInfos.filter(tenant => tenant.id !== this.tenantIdToDelete)
        },
        
        getColSize(tenantInfo) {
            const isLoadingThisTenant = this.isNavigating && this.selectedTenantId === tenantInfo.id;
            const isOwned = tenantInfo.isOwned;
            
            if (isLoadingThisTenant && isOwned) {
                // 로딩 중이고 소유한 테넌트인 경우: 프로그레스 바 + 수정/삭제 버튼 공간 확보
                return '7';
            } else if (isLoadingThisTenant) {
                // 로딩 중이지만 소유하지 않은 테넌트인 경우: 프로그레스 바 공간만 확보
                return '8';
            } else if (isOwned) {
                // 소유한 테넌트인 경우: 수정/삭제 버튼 공간 확보
                return '9';
            } else {
                // 일반적인 경우: 최대 공간 사용
                return '9';
            }
        },

        async toSelectedTenantPage(tenantId) {
            this.isNavigating = true;
            this.selectedTenantId = tenantId;
            
            try {
                await backend.setTenant(tenantId);
                
                localStorage.setItem('tenantId', tenantId);
                // Android 웹뷰 브릿지 체크
                if (window && window.AndroidBridge) {
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
            } catch (error) {
                console.error('테넌트 선택 중 오류가 발생했습니다:', error);
                this.isNavigating = false;
                this.selectedTenantId = null;
            }
        }
    },
};
</script>

<style scoped>
.disabled-card {
    opacity: 0.6;
    pointer-events: none;
    cursor: not-allowed !important;
}
</style>
