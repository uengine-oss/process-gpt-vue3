<template>
    <div style="height: 100%; width:100%; background-color:white;">
        <v-icon @click="$router.push('/tenant/manage')" size="24"
            class="tenant-back-btn"
        >mdi-arrow-left
        </v-icon>

        <v-row no-gutters justify="center">
            <h1 class="text-grey200">회사 생성</h1>
        </v-row>
        <!-- <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                주어진 정보를 통해서 새로운 회사를 생성합니다.
            </p>
        </v-row> -->
        <TenantInfoField v-model="tenantInfo" :isEdit="false" ref="tenantInfoField" @stopLoading="stopLoading"></TenantInfoField>

        <v-row no-gutters style="margin-top: 30px; margin-bottom: 100px;" justify="center">
            <v-btn 
                size="large" 
                class="mt-2" 
                color="primary"  
                rounded="pill"
                type="submit"
                style="width: 500px;"
                :loading="isLoading"
                @click="beforeCreateTenant"
            >생성하기</v-btn>
        </v-row>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import TenantInfoField from '@/components/tenant/TenantInfoField.vue';

export default {
    name: 'TenantCreatePage',
    components: {
        TenantInfoField
    },

    data: () => ({
        tenantInfo: {
            id: '',
            url: '',
            secret: '',
            host: 'aws-0-ap-northeast-2.pooler.supabase.com',
            databaseName: 'postgres',
            port: '6543',
            user: '',
            password: '',
        },
        isLoading: false,
        storage: null
    }),

    methods: {
        stopLoading(){
            this.isLoading = false;
        },
        beforeCreateTenant(){
            this.isLoading = true;
            this.createTenant();
        },
        async createTenant() {
            let me = this
            me.$try({
                context: me,
                action: async () => {
                    await me.$refs.tenantInfoField.validCheck()

                    const userInfo = await me.storage.getUserInfo();

                    await me.storage.putObject('tenant_def', {
                        id: me.tenantInfo.id,
                        url: me.tenantInfo.url,
                        secret: me.tenantInfo.secret,
                        host: me.tenantInfo.host,
                        dbname: me.tenantInfo.databaseName,
                        port: me.tenantInfo.port,
                        user: me.tenantInfo.user,
                        pw: me.tenantInfo.password,
                        owner: userInfo.email
                    });

                    // #region 사용자 정보에 추가한 테넌트 ID 업데이트
                    const dbUserInfo = await me.storage.getObject(`users/${userInfo.uid}`, {key: 'id'})
                    await me.storage.putObject(`users/${userInfo.uid}`, {
                        ...dbUserInfo,
                        tenants: (dbUserInfo.tenants) ? [...dbUserInfo.tenants, me.tenantInfo.id] : [me.tenantInfo.id]
                    });
                    // #endregion
                    await me.$router.push('/tenant/manage');
                },
                successMsg: '회사가 정상적으로 생성되었습니다. 생성된 회사가 관리하는 페이지에 접속 시 현재 로그인된 계정을 이메일 인증 이후 사용하실 수 있습니다.'
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
        this.storage = StorageBaseFactory.getStorage()
    },
};
</script>
