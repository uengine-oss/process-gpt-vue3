<template>
    <div style="width:100%; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 100%; max-width: 500px;">
            <v-label class="text-subtitle-1 font-weight-medium pb-2">
                {{ $t('createAdminAccount.createTenantHeader') }}
            </v-label>
            <v-divider class="mb-4" />

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAdminAccount.tenantID') }}</v-label>
            <VTextField
                v-model.trim="value.id" 
                type="text"
                :disabled="isEdit"
                required
                ref="tenantId"
            ></VTextField>


            <v-label class="text-subtitle-1 font-weight-medium pb-2">
                {{ $t('createAdminAccount.supabaseConnectionInfo') }}
                <v-btn icon @click="openHelpPage">
                    <v-icon>mdi-help-circle</v-icon>
                </v-btn>
            </v-label>
            <v-divider class="mb-4" />

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'URL' }}</v-label>
            <VTextField 
                v-model.trim="value.url" 
                type="url"
                required
                ref="url"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Secret' }}</v-label>
            <VTextField 
                v-model.trim="value.secret"
                type="password"
                required
                ref="secret"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Host' }}</v-label>
            <VTextField 
                v-model.trim="value.host"
                type="url"
                required
                ref="host"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Database Name' }}</v-label>
            <VTextField 
                v-model.trim="value.databaseName"
                type="text"
                required
                ref="databaseName"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Port' }}</v-label>
            <VTextField 
                v-model.trim="value.port"
                type="number"
                required
                ref="port"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'User' }}</v-label>
            <VTextField 
                v-model.trim="value.user"
                type="text"
                required
                ref="user"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Password' }}</v-label>
            <VTextField 
                v-model.trim="value.password"
                type="password"
                required
                ref="password"
            ></VTextField>
        </div>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';

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
    expose: ['validCheck'],

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
        storage: null
    }),

    async created() {
        this.storage = StorageBaseFactory.getStorage()
    },

    methods: {
        openHelpPage() {
            window.open('/tenant/help', '_blank')
        },

        async validCheck() {
            // #region 빈 값 여부 검사
            if(!this.value.id || this.value.id === '') {
                this.$refs.tenantId.focus()
                throw new Error("테넌트 ID를 입력해주세요.")
            }

            if(!this.value.url || this.value.url === '') {
                this.$refs.url.focus()
                throw new Error("URL을 입력해주세요.")
            }

            if(!this.value.secret || this.value.secret === '') {
                this.$refs.secret.focus()
                throw new Error("Secret을 입력해주세요.")
            }

            if(!this.value.host || this.value.host === '') {
                this.$refs.host.focus()
                throw new Error("Host를 입력해주세요.")
            }

            if(!this.value.databaseName || this.value.databaseName === '') {
                this.$refs.databaseName.focus()
                throw new Error("Database Name을 입력해주세요.")
            }

            if(!this.value.port || this.value.port === '') {
                this.$refs.port.focus()
                throw new Error("Port를 입력해주세요.")
            }

            if(!this.value.user || this.value.user === '') {
                this.$refs.user.focus()
                throw new Error("User를 입력해주세요.")
            }

            if(!this.value.password || this.value.password === '') {
                this.$refs.password.focus()
                throw new Error("Password를 입력해주세요.")
            }
            // #endregion

            // #region 데이터 타입 유효성 검사
            if(this.value.port.match(/^[0-9]+$/) === null) {
                this.$refs.port.focus()
                throw new Error("Port는 숫자만 입력해주세요.")
            }
            // #endregion

            // #region 테넌트 ID 중복 여부 검사
            if(this.isEdit === false) {
                const dbTenantInfo = await this.storage.getObject(`tenant_def/${this.value.id}`, {key: 'id'})
                if(dbTenantInfo !== undefined) {
                    this.$refs.tenantId.focus()
                    throw new Error(`'${this.value.id}'는 이미 존재하는 테넌트 ID입니다. 다른 ID를 사용해주세요.`)
                }
            }
            // #endregion
        }
    }
};
</script>
