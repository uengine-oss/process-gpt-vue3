<template>
    <div style="height: 100%; width:100%; background-color:white;">
        <v-icon @click="$router.push('/tenant/manage')" size="24"
            class="tenant-back-btn"
        >mdi-arrow-left
        </v-icon>

        <v-row no-gutters justify="center">
            <h1 class="text-grey200">테넌트 편집</h1>
        </v-row>
        <!-- <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                선택한 테넌트의 내용을 편집합니다.
            </p>
        </v-row> -->

        <TenantInfoField v-model="tenantInfo" :isEdit="true" ref="tenantInfoField"></TenantInfoField>
        <v-row no-gutters justify="center">
            <v-btn 
                size="large" 
                class="mt-2" 
                color="primary"  
                rounded="pill"
                type="submit"
                style="width: 500px;"
                @click="editTenant"
            >수정하기</v-btn>
        </v-row>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import TenantInfoField from '@/components/tenant/TenantInfoField.vue';

export default {
    name: 'TenantEditPage',
    components: {
        TenantInfoField
    },

    data: () => ({
        tenantInfo: {
            id: '',
            url: '',
            secret: '',
            host: '',
            databaseName: '',
            port: '',
            user: '',
            password: '',
        },

        storage: null
    }),

    methods: {
        async editTenant() {
            let me = this
            me.$try({
                context: me,
                action: async () => {
                    await me.$refs.tenantInfoField.validCheck()

                    await me.storage.putObject('tenant_def', {
                        id: me.tenantInfo.id,
                        url: me.tenantInfo.url,
                        secret: me.tenantInfo.secret,
                        host: me.tenantInfo.host,
                        dbname: me.tenantInfo.databaseName,
                        port: me.tenantInfo.port,
                        user: me.tenantInfo.user,
                        pw: me.tenantInfo.password
                    });

                    await me.$router.push('/tenant/manage');
                },
                successMsg: '테넌트가 정상적으로 수정되었습니다.'
            });
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

                // #region 편집할 테넌트 정보 가져오기
                const tenantId = me.$route.params.tenantId
                const dbTenantInfo = await me.storage.getObject(`tenant_def/${tenantId}`, {key: 'id'})
                me.tenantInfo = {
                    id: dbTenantInfo.id,
                    url: dbTenantInfo.url,
                    secret: dbTenantInfo.secret,
                    host: dbTenantInfo.host,
                    databaseName: dbTenantInfo.dbname,
                    port: dbTenantInfo.port,
                    user: dbTenantInfo.user,
                    password: dbTenantInfo.pw,
                }
                // #endregion
            }
        });
    },
};
</script>
