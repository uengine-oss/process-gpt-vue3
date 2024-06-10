<template>
    <v-container class="bg-surface" style="height: 100%">
        <v-row no-gutters>
            <v-icon @click="$router.push('/tenant/manage')" size="24">mdi-arrow-left</v-icon>
        </v-row>

        <v-row no-gutters justify="center" style="margin-top: 50.5px;">
            <h1 class="text-grey200" style="font-size: 40px;">테넌트 편집</h1>
        </v-row>
        <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                선택한 테넌트의 내용을 편집합니다.
            </p>
        </v-row>

        <v-row no-gutters style="margin-top: 30px;" justify="center">
            <TenantInfoField v-model="tenantInfo" :isEdit="true"></TenantInfoField>
        </v-row>

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
    </v-container>
</template>

<script>
import Logo from '@/layouts/full/logo/Logo.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import TenantInfoField from '@/components/tenant/TenantInfoField.vue';

export default {
    name: 'TenantEditPage',
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
        async editTenant() {
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

            this.$router.push('/tenant/manage');
        }
    },

    async created() {
        this.storage = StorageBaseFactory.getStorage()

        // #region 편집할 테넌트 정보 가져오기
        const tenantId = this.$route.params.tenantId
        const dbTenantInfo = await this.storage.getObject(`tenant_def/${tenantId}`, {key: 'id'})
        this.tenantInfo = {
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
    },
};
</script>
