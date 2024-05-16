<template>
    <Form @submit="processAdminSignup" v-slot="{ errors, isSubmitting }" class="mt-5">
        <!-- #region 어드민 계정 정보 입력 -->
        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ $t('createAdminAccount.createAccountHeader') }}
        </v-label>
        <v-divider class="mb-4" />

        <!-- Social -->
        <v-row class="d-flex mb-3">
            <v-col cols="12" sm="12">
                <v-btn variant="outlined" size="large" class="border text-subtitle-1 text-gray200 font-weight-semibold" block>
                    <!-- <img :src="google" height="16" class="mr-2" alt="google" /> -->
                    <span class="d-sm-flex d-none mr-1">{{ $t('createAccount.google') }}</span>
                </v-btn>
            </v-col>
        </v-row>
        <div class="d-flex align-center text-center mb-6">
            <div class="text-h6 w-100 px-5 font-weight-regular auth-divider position-relative">
                <span class="bg-surface px-5 py-3 position-relative text-subtitle-1 text-grey100">{{ $t('createAccount.or') }}</span>
            </div>  
        </div>

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.userName') }}</v-label>
        <VTextField 
            v-model="accountInfo.username" 
            :rules="accountInfoRules.username" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.email') }}</v-label>
        <VTextField 
            v-model="accountInfo.email" 
            :rules="accountInfoRules.email" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.password') }}</v-label>
        <VTextField
            v-model="accountInfo.password"
            :counter="10"
            :rules="accountInfoRules.password"
            required
            variant="outlined"
            type="password"
            color="primary"
        ></VTextField>
        <!-- #endregion -->
        <!-- #region 테넌트 정보 입력 -->
        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ $t('createAdminAccount.createTenantHeader') }}
        </v-label>
        <v-divider class="mb-4" />

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAdminAccount.tenantID') }}</v-label>
        <VTextField 
            v-model="tenantInfo.id" 
            required 
        ></VTextField>

        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ $t('createAdminAccount.supabaseConnectionInfo') }}
            <v-btn icon @click="isHelpDialogOpen = true">
                <v-icon>mdi-help-circle</v-icon>
            </v-btn>
        </v-label>
        <v-divider class="mb-4" />

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'URL' }}</v-label>
        <VTextField 
            v-model="tenantInfo.apiUrl" 
            required 
        ></VTextField>

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Secret' }}</v-label>
        <VTextField 
            v-model="tenantInfo.apiKey" 
            required 
        ></VTextField>

        <v-btn 
            size="large" 
            class="mt-2" 
            color="primary" 
            block 
            rounded="pill"
            :loading="isSubmitting"
            type="submit"
        >Sign up</v-btn>
        <!-- #endregion -->
    </Form>

    <!-- #region Supabase 연결 설정 입력 도움말 다이얼로그 -->
    <v-dialog v-model="isHelpDialogOpen" max-width="500">
        <v-card>
            <v-card-item>
                <v-card-title>
                    {{ 'Supabase Connection Info Help' }}
                </v-card-title>
      
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="isHelpDialogOpen = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-item>

            <v-card-text>
                <img src="@/assets/images/tenant/help.png" class="w-100" />
                <p>
                    {{ '생성된 Supabase 프로젝트 > 좌측 Project Setting 버튼 > Configuration에서 각의 항목을 확인할 수 있습니다.' }}
                </p>
            </v-card-text>

            <v-card-actions style="justify-content: right;">
                <v-btn ref="saveButton" @click="isHelpDialogOpen = false" class="w-100" > OK </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
    <!-- #endregion -->
</template>

<script>
import { Form } from 'vee-validate';
import { useAuthStore } from '@/stores/auth';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: 'AdminRegisterForm',
    components: {
        Form
    },

    data: () => ({
        accountInfo: {
            username: '',
            email: '',
            password: ''
        },
        accountInfoRules: {
            username: [
                (v) => !!v || 'Name is required',
                (v) => (v && v.length <= 10) || 'Name must be less than 10 characters'
            ],
            email: [(v) => !!v || 'E-mail is required', (v) => /.+@.+\..+/.test(v) || 'E-mail must be valid'],
            password: [
                (v) => !!v || 'Password is required',
                (v) => (v && v.length <= 10) || 'Password must be less than 10 characters'
            ],
        },

        tenantInfo: {
            id: '',
            apiUrl: '',
            apiKey: ''
        },

        isHelpDialogOpen: false
    }),


    methods: {
        // #region 어드민 가입 처리
        async processAdminSignup() {
            await this.saveAccountInfo();
            await this.saveTenantInfo();
            window.location.href = `http://${this.tenantInfo.id}.processgpt.io`;
        },

        async saveAccountInfo() {
            await this.authStore.signUp(this.accountInfo.username, this.accountInfo.email, this.accountInfo.password);
        },

        async saveTenantInfo() {
            await this.storage.putObject('tenant_def', {
                id: this.tenantInfo.id,
                url: this.tenantInfo.apiUrl,
                secret: this.tenantInfo.apiKey
            });
        }
        // #endregion
    },

    created() {
        this.authStore = useAuthStore()
        this.storage = StorageBaseFactory.getStorage()
    },
};
</script>

