<template>
    <div style="width:100%; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 500px;">
            <v-label class="text-subtitle-1 font-weight-medium pb-2">
                {{ $t('createAdminAccount.createTenantHeader') }}
            </v-label>
            <v-divider class="mb-4" />

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAdminAccount.tenantID') }}</v-label>
            <VTextField 
                v-model="value.id" 
                type="text"
                :disabled="isEdit"
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
                v-model="value.url" 
                type="url"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Secret' }}</v-label>
            <VTextField 
                v-model="value.secret"
                type="password"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Host' }}</v-label>
            <VTextField 
                v-model="value.host"
                type="url"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Database Name' }}</v-label>
            <VTextField 
                v-model="value.databaseName"
                type="text"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Port' }}</v-label>
            <VTextField 
                v-model="value.port"
                type="number"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'User' }}</v-label>
            <VTextField 
                v-model="value.user"
                type="text"
                required 
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Password' }}</v-label>
            <VTextField 
                v-model="value.password"
                type="password"
                required 
            ></VTextField>
        </div>
    </div>

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
export default {
    name: 'TenantInfoField',
    props: {
        modelValue: {
            type: Object,
            required: true,
        },
        isEdit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],

    computed: {
        value: {
            get() {
                return this.modelValue
            },
            set(value) {
                this.$emit('update:modelValue', value)
            }
        }
    },

    data: () => ({
        isHelpDialogOpen: false
    })
};
</script>
