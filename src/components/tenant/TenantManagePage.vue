<template>
    <v-container class="bg-surface" style="height: 100%">
        <v-row no-gutters>
            <Logo/>
        </v-row>

        <v-row no-gutters justify="center" class="mt-7">
            <h1 class="text-grey200" style="font-size: 40px;">회사 관리</h1>
        </v-row>
        <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                새로운 회사를 생성하거나 선택한 회사가 관리하는 페이지로 이동합니다.<br>
                (* 모바일 환경에서는 가입 진행이 불가능합니다.)
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
                    <div>새로운 회사 생성</div>
                </v-row>
            </v-card>
        </v-row>

        <div style="display: flex; justify-content: center; align-items: center;">
            <div style="height: 450px; width: 500px; overflow-y: auto;">
                <v-row no-gutters justify="center" class="mt-3" v-for="tenantInfo in tenantInfos">
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
                            <v-col cols="9">
                                &nbsp; {{ tenantInfo.id }}
                            </v-col>
                            <v-col cols="1">
                                <v-sheet style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
                                    <v-tooltip text="수정">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click="(e) => {e.stopPropagation(); toEditTenantPage(tenantInfo.id)}" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
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
                                            <v-btn @click="(e) => {e.stopPropagation(); tenantIdToDelete = tenantInfo.id; deleteDialog = true}" icon v-bind="props" style="width: 24px; height: 24px; min-height: 24px; min-width: 24px;">
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
                <v-btn color="primary" variant="flat" @click="deleteTenant(tenantIdToDelete); deleteDialog = false">삭제</v-btn>
                <v-btn color="error" variant="flat" @click="deleteDialog = false">취소</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import Logo from '@/layouts/full/logo/Logo.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: 'TenantManagePage',
    components: {
        Logo
    },

    data: () => ({
        tenantInfos: [],
        deleteDialog: false,
        tenantIdToDelete: null,

        storage: null,
        userInfo: null
    }),

    methods: {
        toAddTenentPage() {
            this.$router.push('/tenant/create')
        },

        toEditTenantPage(tenantId) {
            this.$router.push(`/tenant/edit/${tenantId}`)
        },

        async deleteTenant(tenantId) {
            let me = this
            me.$try({
                context: me,
                action: async () => {
                    await me.storage.delete(`tenant_def/${tenantId}`, { key: 'id' });
                    const dbUserInfo = await me.storage.getObject(`users/${me.userInfo.uid}`, {key: 'id'})
                    await me.storage.putObject(`users/${me.userInfo.uid}`, {
                        ...dbUserInfo,
                        tenants: dbUserInfo.tenants.filter(tenant => tenant !== tenantId)
                    });

                    me.tenantInfos = me.tenantInfos.filter(tenantInfo => tenantInfo.id !== tenantId)
                },
                successMsg: '회사가 정상적으로 삭제되었습니다.'
            });
        },
        
        toSelectedTenantPage(tenantId) {
            if(!location.port || location.port == '')
                location.href = `https://${tenantId}.process-gpt.io`
            else
                location.href = `http://${tenantId}.process-gpt.io:${location.port}`
        }
    },

    async created() {
        let me = this
        const checkIsLogin = async () => {
            const isLogin = localStorage.getItem("accessToken") ? true : false
            if(!isLogin) {
                alert("로그인이 필요합니다.")
                await me.$router.push('/auth/login')
                return false
            }
            return true
        }

        if(!(await checkIsLogin())) return
        me.$try({
            context: me,
            action: async () => {
                me.storage = StorageBaseFactory.getStorage()
                me.userInfo = await me.storage.getUserInfo();

                const tenants = (await me.storage.getObject(`users/${me.userInfo.uid}`, {key: 'id'})).tenants
                if(tenants) {
                    for (const tenant of tenants) {
                        const tenantInfo = await me.storage.getObject(`tenant_def/${tenant}`, {key: 'id'})
                        if(tenantInfo) me.tenantInfos.push(tenantInfo)
                    }
                }
            }
        });
    },
};
</script>
