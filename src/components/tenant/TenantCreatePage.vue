<template>
    <v-container class="bg-surface" style="height: 100%">
        <v-row no-gutters>
            <v-icon @click="$router.push('/tenant/manage')" size="24">mdi-arrow-left</v-icon>
        </v-row>

        <v-row no-gutters justify="center" style="margin-top: 50.5px;">
            <h1 class="text-grey200" style="font-size: 40px;">테넌트 생성</h1>
        </v-row>
        <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                주어진 정보를 통해서 새로운 테넌트를 생성합니다.
            </p>
        </v-row>

        <v-row no-gutters style="margin-top: 30px;" justify="center">
            <TenantInfoField v-model="tenantInfo" :isEdit="false"></TenantInfoField>
        </v-row>

        <v-row no-gutters justify="center">
            <v-btn 
                size="large" 
                class="mt-2" 
                color="primary"  
                rounded="pill"
                type="submit"
                style="width: 500px;"
                @click="createTenant"
            >생성하기</v-btn>
        </v-row>
    </v-container>
</template>

<script>
import Logo from '@/layouts/full/logo/Logo.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import TenantInfoField from '@/components/tenant/TenantInfoField.vue';

export default {
    name: 'TenantCreatePage',
    components: {
        Logo,
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
        async createTenant() {
            await this.storage.putObject('tenant_def', {
                id: this.tenantInfo.id,
                url: this.tenantInfo.url,
                secret: this.tenantInfo.secret,
                host: this.tenantInfo.host,
                dbname: this.tenantInfo.databaseName,
                port: this.tenantInfo.port,
                user: this.tenantInfo.user,
                pw: this.tenantInfo.password
            });

            // #region 사용자 정보에 추가한 테넌트 ID 업데이트
            const userInfo = await this.storage.getUserInfo();
            const dbUserInfo = await this.storage.getObject(`users/${userInfo.uid}`, {key: 'id'})
            await this.storage.putObject(`users/${userInfo.uid}`, {
                ...dbUserInfo,
                tenants: (dbUserInfo.tenants) ? [...dbUserInfo.tenants, this.tenantInfo.id] : [this.tenantInfo.id]
            });
            // #endregion

            this.$router.push('/tenant/manage');
        }
    },

    async created() {
        this.storage = StorageBaseFactory.getStorage()
    },
};
</script>
