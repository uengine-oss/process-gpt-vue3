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
        <TenantInfoField v-model="tenantInfo"
            ref="tenantInfoField"
            :isEdit="false"
            :isLoading='isLoading'
            @stopLoading="stopLoading"
            @beforeCreateTenant="beforeCreateTenant"
        ></TenantInfoField>
    </div>
</template>

<script>
import TenantInfoField from '@/components/tenant/TenantInfoField.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'TenantCreatePage',
    components: {
        TenantInfoField
    },
    data: () => ({
        tenantInfo: {
            id: '',
        },
        isLoading: false,
    }),
    async created() {
        const isLogin = await backend.checkDBConnection();
        if(!isLogin) {
            alert("로그인이 필요합니다.")
            this.$router.push('/auth/login')
        }
    },
    methods: {
        stopLoading(){
            this.isLoading = false;
        },
        beforeCreateTenant() {
            this.isLoading = true;
            this.createTenant();
        },
        async createTenant() {
            await this.$refs.tenantInfoField.validCheck();
            this.tenantId = this.tenantInfo.id;
            await backend.putTenant(this.tenantId);
            await this.$router.push('/tenant/manage');
        }
    },
};
</script>
