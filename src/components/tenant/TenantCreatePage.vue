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
            this.$router.push('/auth/login')
        }
    },
    methods: {
        stopLoading(){
            this.isLoading = false;
        },
        async beforeCreateTenant() {
            this.isLoading = true;
            // await this.$refs.tenantInfoField.validCheck();
            this.tenantId = this.tenantInfo.id;
            const isExistTenant = await backend.getTenant(this.tenantId);
            if (!isExistTenant) {
                await this.createTenant();
            } else {
                alert("이미 존재하는 회사 아이디입니다.");
                this.isLoading = false;
            }
        },
        async createTenant() {
            await backend.putTenant(this.tenantId);
            await this.$router.push('/tenant/manage');
        }
    },
};
</script>
