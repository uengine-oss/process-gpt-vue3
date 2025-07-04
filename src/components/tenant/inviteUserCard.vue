<template>
    <!-- 유저 초대 섹션 -->
    <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
            <div class="mb-6">
                <h2 class="text-h4 text-grey-darken-2 mb-2">👥 사용자 초대</h2>
                <p class="text-subtitle-1 text-grey-darken-1">회사에 함께할 동료들을 초대해보세요</p>
            </div>
            
            <v-card class="invite-card" elevation="2">
                <v-card-text class="pa-6">
                    <div v-for="(user, index) in inviteUserlist" :key="index" class="user-invite-item">
                        <v-card class="mb-4" outlined>
                            <v-card-text class="pa-4">
                                <v-row align="center" no-gutters>
                                    <v-col cols="12" sm="8" class="pr-sm-3">
                                        <v-text-field
                                            v-model="user.email"
                                            label="이메일 주소"
                                            type="email"
                                            :error="!isValidEmail(user.email) && user.email !== ''"
                                            :error-messages="getEmailErrorMessage(user.email)"
                                            outlined
                                            dense
                                            prepend-inner-icon="mdi-email-outline"
                                            placeholder="example@company.com"
                                            hide-details
                                        ></v-text-field>
                                    </v-col>
                                    <v-col cols="10" sm="3" class="px-sm-2">
                                        <v-select
                                            v-model="user.is_admin"
                                            :items="roleOptions"
                                            item-title="text"
                                            item-value="value"
                                            label="역할"
                                            outlined
                                            dense
                                            prepend-inner-icon="mdi-account-circle-outline"
                                            hide-details
                                        ></v-select>
                                    </v-col>
                                    <v-col cols="2" sm="1" class="text-center pl-sm-2">
                                        <v-btn
                                            :disabled="inviteUserlist.length === 1"
                                            icon
                                            color="error"
                                            @click="removeUser(index)"
                                            class="delete-btn"
                                        >
                                            <v-icon>mdi-delete-outline</v-icon>
                                        </v-btn>
                                    </v-col>
                                </v-row>
                                <!-- 에러 메시지를 별도 행으로 표시 -->
                                <v-row v-if="!isValidEmail(user.email) && user.email !== ''" no-gutters>
                                    <v-col cols="12" sm="8" class="pr-sm-3">
                                        <div class="text-caption mt-1 ml-3" style="color: #f44336 !important;">
                                            {{ getEmailErrorMessage(user.email) }}
                                        </div>
                                    </v-col>
                                </v-row>
                            </v-card-text>
                        </v-card>
                    </div>

                    <v-row justify="center" class="my-6">
                        <v-btn
                            outlined
                            color="primary"
                            @click="addUser"
                            class="add-user-btn"
                        >
                            <v-icon left>mdi-plus</v-icon>
                            사용자 추가
                        </v-btn>
                    </v-row>

                    <v-divider class="my-6"></v-divider>

                    <v-row justify="center" class="mb-4">
                        <v-col cols="auto" class="mr-3">
                            <v-btn
                                color="primary"
                                large
                                elevation="2"
                                :loading="isInviteLoading"
                                :disabled="hasInvalidEmails()"
                                @click="inviteUsers"
                                class="invite-submit-btn"
                                min-width="180"
                            >
                                <v-icon style="margin-right: 5px;" left>mdi-send</v-icon>
                                초대 보내기
                            </v-btn>
                        </v-col>
                        <v-col v-if="type === 'createTenant'" cols="auto" >
                            <v-btn
                                large
                                outlined
                                color="grey"
                                @click="skipInvitation"
                                class="skip-btn"
                                min-width="180"
                            >
                                <v-icon left>mdi-skip-next</v-icon>
                                건너뛰고 시작하기
                            </v-btn>
                        </v-col>
                    </v-row>
                    <v-row justify="center">
                        <p class="text-caption text-grey-darken-1">
                            초대된 사용자들에게 이메일이 발송됩니다
                        </p>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'InviteUserCard',
    props: {
        tenantInfo: {
            type: Object,
            default: () => ({})
        },
        type: {
            type: String,
            default: 'createTenant'
        },
        userList: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        isInviteLoading: false,
        inviteUserlist: [
            {
                email: '',
                is_admin: false
            }
        ],
        roleOptions: [
            { text: '사용자', value: false },
            { text: '관리자', value: true }
        ]
    }),
    methods: {
        isValidEmail(email) {
            if (!email) return true; // 빈 값은 유효한 것으로 처리
            const emailRegex = /.+@.+\..+/;
            if (!emailRegex.test(email)) return false;
            
            // userList가 있고 이메일이 입력된 경우에만 중복 체크
            if (this.userList && this.userList.length > 0 && email) {
                return !this.userList.some(user => user.email === email);
            }
            return true;
        },
        getEmailErrorMessage(email) {
            if (!email) return '';
            const emailRegex = /.+@.+\..+/;
            if (!emailRegex.test(email)) {
                return '올바른 이메일 형식이 아닙니다';
            }
            if (this.userList && this.userList.length > 0) {
                if (this.userList.some(user => user.email === email)) {
                    return '이미 등록된 이메일입니다';
                }
            }
            return '';
        },
        hasInvalidEmails() {
            return this.inviteUserlist.some(user => 
                !this.isValidEmail(user.email) || user.email === ''
            );
        },
        addUser() {
            this.inviteUserlist.push({
                email: '',
                is_admin: false
            });
        },
        removeUser(index) {
            if (this.inviteUserlist.length > 1) {
                this.inviteUserlist.splice(index, 1);
            }
        },
        async inviteUsers() {
            this.isInviteLoading = true;
            var me = this
            me.$try({
                action: async () => {
                    const tenantId = this.tenantInfo && this.tenantInfo.id ? this.tenantInfo.id : (window.location.host.includes('.process-gpt.io') ? window.location.host.split('.')[0] : window.location.host.split(':')[0]);
                    for (const user of this.inviteUserlist) {
                        let userInfo = {
                            email: user.email,
                            is_admin: user.is_admin,
                            tenant_id: tenantId
                        }
                        const result = await backend.inviteUser(userInfo);
                        if(result) {
                            user.id = result.response.user.id
                            user.profile = "/images/defaultUser.png"
                            user.name = user.email.split('@')[0]
                        }
                    }
                    this.isInviteLoading = false;
                    if(this.type === 'createTenant') {
                        window.location.href = `https://${this.tenantInfo.id}.process-gpt.io/definition-map`
                    } else {
                        this.$emit('close', this.inviteUserlist);
                    }
                },
                onFail: () => {
                    this.isInviteLoading = false;
                },
                successMsg: me.$t('organizationChartDefinition.addUserSuccess'),
                errorMsg: me.$t('organizationChartDefinition.addUserFailed'),
            });
        },
        skipInvitation() {
            window.location.href = `https://${this.tenantInfo.id}.process-gpt.io/definition-map`
        }
    }
};
</script>

<style scoped>
/* 유저 초대 섹션 스타일 */
.invite-card {
    border-radius: 16px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.user-invite-item {
    transition: all 0.3s ease;
}

.user-invite-item .v-card {
    border-radius: 12px !important;
    border: 2px solid #f0f0f0 !important;
    transition: all 0.3s ease;
}

.user-invite-item .v-card:hover {
    border-color: #1976d2 !important;
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15) !important;
}

.delete-btn {
    transition: all 0.3s ease;
}

.delete-btn:hover {
    transform: scale(1.1);
}

.add-user-btn {
    border-radius: 24px !important;
    border: 2px dashed #1976d2 !important;
    padding: 12px 24px !important;
    transition: all 0.3s ease;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
}

.add-user-btn:hover {
    background-color: rgba(25, 118, 210, 0.1) !important;
    transform: translateY(-2px);
}

.invite-submit-btn {
    border-radius: 28px !important;
    font-weight: 600 !important;
    text-transform: none !important;
    transition: all 0.3s ease;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
}

.invite-submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(25, 118, 210, 0.3) !important;
}

.skip-btn {
    border-radius: 28px !important;
    font-weight: 600 !important;
    text-transform: none !important;
    transition: all 0.3s ease;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border: 2px solid #757575 !important;
}

.skip-btn:hover {
    transform: translateY(-2px);
    background-color: rgba(117, 117, 117, 0.1) !important;
    border-color: #424242 !important;
}

@media only screen and (max-width: 960px) {
    .mb-8 {
        margin-bottom: 3rem !important;
    }
}
</style>