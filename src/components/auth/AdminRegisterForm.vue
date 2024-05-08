<template>
    <Form @submit="saveTenantInfo" v-slot="{ errors, isSubmitting }" class="mt-5">
        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ '어드민 정보' }}
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
            v-model="username" 
            :rules="usernameRules" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.email') }}</v-label>
        <VTextField 
            v-model="email" 
            :rules="emailRules" 
            required 
        ></VTextField>
        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAccount.password') }}</v-label>
        <VTextField
            v-model="password"
            :counter="10"
            :rules="passwordRules"
            required
            variant="outlined"
            type="password"
            color="primary"
        ></VTextField>

        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ '테넌트 정보' }}
        </v-label>
        <v-divider class="mb-4" />

        <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Tenant ID' }}</v-label>
        <VTextField 
            v-model="tenantInfo.id" 
            required 
        ></VTextField>

        <v-label class="text-subtitle-1 font-weight-medium pb-2">
            {{ 'Supabase Connection Info' }}
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
    </Form>

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
</template>

<script>
import { Form } from 'vee-validate';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: 'TenantRegister',
    components: {
        Form
    },

    data: () => ({
        tenantInfo: {
            id: '',
            apiUrl: '',
            apiKey: ''
        },

        isHelpDialogOpen: false
    }),

    methods: {
        async saveTenantInfo() {
            await (StorageBaseFactory.getStorage()).putObject('tenant_def', {
                id: this.tenantInfo.id,
                url: this.tenantInfo.apiUrl,
                secret: this.tenantInfo.apiKey
            });

            window.location.href = `http://${this.tenantInfo.id}.processgpt.io`;
        }
    }
};
</script>