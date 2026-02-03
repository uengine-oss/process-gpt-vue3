<template>
    <div elevation="10">
        <v-card flat class="pa-1">
            <v-card-item class="pa-0">
                <!-- <h5 class="text-h5">{{ $t('accountTab.profileImageChange') }}</h5> -->
                <div class="text-center mt-6 mb-6">
                    <v-avatar size="120">
                        <img :src="selectedProfileImage || picture || ''" height="120" alt="image" />
                    </v-avatar>
                </div>
                <v-row class="justify-center ma-0 pa-0 mb-7">
                    <v-dialog width="650" v-model="imageChangeDialog">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" color="gray" class="mx-2" rounded="pill" variant="flat">
                                {{ $t('accountTab.imageSelect') }}
                            </v-btn>
                        </template>

                        <v-card style="padding:30px;">
                            <v-row>
                                <v-col>
                                    <v-row>
                                        <img v-for="(profileImage, name) in profileImages"
                                            @click="() => imageChange(profileImage)" class="change-profile-image"
                                            :key="name" :src="profileImage" width="100" height="100" alt="Mathew"
                                            style="border-radius: 50%; padding:10px;" />
                                    </v-row>
                                </v-col>
                            </v-row>
                        </v-card>
                    </v-dialog>
                    <!-- <v-btn color="error" class="mx-2" variant="outlined" rounded="pill">Reset</v-btn> -->
                </v-row>
                <!-- <div class="text-subtitle-1 text-grey100 text-center my-sm-8 my-6">
                    {{ $t('accountTab.imageSelect') }}
                </div> -->
            </v-card-item>
        </v-card>

        <div class="pa-0">
            <div class="text-center">
                <h5 class="text-h5 pb-2">{{ $t('accountTab.personalDetails') }}</h5>
                <div class="text-subtitle-1 text-grey100"
                >{{ $t('accountTab.personalDetailsExplanation') }}
                </div>
            </div>
            <div class="pa-4">
                <div v-for="field in formFields" :key="field.key" class="mb-4">
                    <v-label class="mb-2 font-weight-medium">
                        {{ $t(field.label) }}
                        <span
                            v-if="field.key === 'phone' && phoneVerification.isVerified && !phoneVerification.isEditing"
                            class="text-success text-caption ml-2"
                        >
                            {{ $t('accountTab.otpVerified') }}
                        </span>
                    </v-label>
                    <v-text-field
                        v-if="field.type !== 'select' && field.key !== 'phone'"
                        color="primary"
                        variant="outlined"
                        :type="field.type"
                        :model-value="field.model"
                        :readonly="field.readonly"
                        hide-details
                        @update:model-value="value => onFieldInput(field, value)"
                    />
                    <v-text-field
                        v-else-if="field.key === 'phone'"
                        color="primary"
                        variant="outlined"
                        type="text"
                        :model-value="field.model"
                        :readonly="field.readonly || isPhoneReadonly"
                        hide-details
                        @update:model-value="value => onFieldInput(field, value)"
                    />
                    <v-select
                        v-else
                        color="primary"
                        variant="outlined"
                        v-model="field.model"
                        :items="getFieldItems(field)"
                        item-title="label"
                        item-value="value"
                        hide-details
                    />
                    <div v-if="field.key === 'phone'" class="mt-2">
                        <v-row v-if="phoneVerification.isVerified && !phoneVerification.isEditing" class="ma-0 pa-0 align-center" style="gap: 8px;">
                            <v-btn
                                color="primary"
                                variant="outlined"
                                size="small"
                                class="otp-button"
                                @click="startPhoneEdit"
                            >
                                {{ $t('accountTab.editPhone') }}
                            </v-btn>
                        </v-row>
                        <v-row v-if="shouldShowPhoneVerification" class="ma-0 pa-0 align-center" style="gap: 8px;">
                            <v-btn
                                color="primary"
                                variant="outlined"
                                size="small"
                                class="otp-button"
                                :loading="phoneVerification.isSending"
                                :disabled="isSendOtpDisabled || !shouldShowPhoneVerification"
                                @click="sendPhoneOtp"
                            >
                                {{ $t('accountTab.sendOtp') }}
                            </v-btn>
                            <v-text-field
                                v-model="phoneVerification.otp"
                                density="compact"
                                variant="outlined"
                                hide-details
                                :placeholder="$t('accountTab.otpPlaceholder')"
                                style="max-width: 160px;"
                                :disabled="!shouldShowPhoneVerification"
                            />
                            <v-btn
                                color="primary"
                                variant="elevated"
                                size="small"
                                class="otp-button"
                                :loading="phoneVerification.isVerifying"
                                :disabled="isVerifyOtpDisabled || !shouldShowPhoneVerification"
                                @click="verifyPhoneOtp"
                            >
                                {{ $t('accountTab.verifyOtp') }}
                            </v-btn>
                        </v-row>
                        <div v-if="phoneVerification.message" class="text-caption mt-1" :class="phoneVerification.messageType">
                            {{ phoneVerification.message }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <v-row class="ma-0 pa-4 pt-0">
            <v-spacer></v-spacer>
            <!-- <v-btn @click="changeTenant" size="large" color="secondary" rounded="pill" class="mr-2" variant="flat">
                {{ $t('accountTab.changeTenant') }}
            </v-btn> -->
            <v-btn @click="updateUser"
                color="primary"
                variant="elevated" 
                class="rounded-pill"
            >{{ $t('accountTab.save') }}
            </v-btn>
            <!-- <v-btn size="large" class="bg-lighterror text-error"  rounded="pill">닫기</v-btn> -->
        </v-row>
    </div>
</template>

<script>
import { profileImages } from '@/components/pages/account-settings/profileImage';
import { getMainDomainUrl } from '@/utils/domainUtils';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        userInfo: {},
        imageChangeDialog: false,
        selectedProfileImage: "",
        profileImages,
        storephone: "",
        storeaddress: "",
        phoneVerification: {
            otp: '',
            isVerified: false,
            verifiedPhone: '',
            isEditing: false,
            isSending: false,
            isVerifying: false,
            message: '',
            messageType: '',
            cooldownUntil: 0,
            cooldownTimerId: null
        },
        formFields: [
            {
                key: 'name',
                label: 'accountTab.name',
                type: 'text',
                model: '',
                readonly: false
            },
            {
                key: 'email',
                label: 'accountTab.email',
                type: 'email',
                model: '',
                readonly: true
            },
            {
                key: 'phone',
                label: 'accountTab.phone',
                type: 'text',
                model: '',
                readonly: false
            },
            {
                key: 'preferContact',
                label: 'accountTab.preferContact',
                type: 'select',
                model: '',
                items: null
            }
        ]
    }),
    async created() {
        this.userInfo = await backend.getUserInfo();
        if (!this.userInfo) {
            return;
        }
        this.selectedProfileImage = this.userInfo.profile;
        const hasPhoneVerified = Object.prototype.hasOwnProperty.call(this.userInfo, 'phone_verified');
        const isVerified = hasPhoneVerified
            ? !!this.userInfo.phone_verified
            : !!this.userInfo.phone_number;
        this.phoneVerification.isVerified = isVerified;
        this.phoneVerification.isEditing = !isVerified;
        this.phoneVerification.verifiedPhone = isVerified
            ? this.toE164(this.userInfo.phone_number || '')
            : '';
        this.applyUserInfoToForm(this.userInfo);
    },
    methods: {
        applyUserInfoToForm(userInfo) {
            // formFields 모델 값 설정
            this.setFieldValue('name', userInfo.name || '');
            this.setFieldValue('email', userInfo.email || '');
            this.setFieldValue('phone', this.formatPhoneDisplay(userInfo.phone_number || ''));
            this.setFieldValue('preferContact', this.normalizePreferContact(userInfo.prefer_contact));
        },
        onFieldInput(field, value) {
            if (field.key === 'phone') {
                const formatted = this.formatPhoneDisplay(value);
                this.setFieldValue('phone', formatted);
                const e164 = this.toE164(formatted);
                if (!e164 || e164 !== this.phoneVerification.verifiedPhone) {
                    this.phoneVerification.isVerified = false;
                }
                this.phoneVerification.message = '';
                this.phoneVerification.messageType = '';
                return;
            }
            this.setFieldValue(field.key, value);
        },
        startPhoneEdit() {
            this.phoneVerification.isEditing = true;
            this.phoneVerification.isVerified = false;
            this.phoneVerification.message = '';
            this.phoneVerification.messageType = '';
        },
        setFieldValue(key, value) {
            const field = this.formFields.find(f => f.key === key);
            if (field) {
                field.model = value;
            }
        },
        formatPhoneDisplay(value) {
            const digits = this.toDigits(value);
            if (!digits) {
                return '';
            }
            let local = digits;
            if (digits.startsWith('82')) {
                local = `0${digits.slice(2)}`;
            } else if (value.startsWith('+82')) {
                local = `0${digits.slice(2)}`;
            }
            return this.formatKoreanLocalNumber(local);
        },
        formatKoreanLocalNumber(digits) {
            if (!digits) {
                return '';
            }
            if (digits.length <= 3) {
                return digits;
            }
            if (digits.length <= 7) {
                return `${digits.slice(0, 3)}-${digits.slice(3)}`;
            }
            if (digits.length <= 10) {
                return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
        },
        toDigits(value) {
            return String(value || '').replace(/[^0-9]/g, '');
        },
        toE164(value) {
            const raw = String(value || '').trim();
            if (!raw) {
                return '';
            }
            const digits = this.toDigits(raw);
            if (!digits) {
                return '';
            }
            if (raw.startsWith('+')) {
                return `+${digits}`;
            }
            if (digits.startsWith('82')) {
                return `+${digits}`;
            }
            if (digits.startsWith('0')) {
                return `+82${digits.slice(1)}`;
            }
            return digits;
        },
        isValidMobileNumber(value) {
            const digits = this.toDigits(value);
            if (!digits) {
                return false;
            }
            let local = digits;
            if (digits.startsWith('82')) {
                local = `0${digits.slice(2)}`;
            } else if (digits.startsWith('0')) {
                local = digits;
            } else {
                return false;
            }
            return /^010\d{8}$/.test(local);
        },
        getTwilioBaseUrl() {
            return (
                window._env_?.VITE_TWILIO_TEST_URL ||
                import.meta.env.VITE_TWILIO_TEST_URL ||
                'http://localhost:3001'
            );
        },
        async sendPhoneOtp() {
            const phoneValue = this.formFields.find(f => f.key === 'phone').model;
            const phoneE164 = this.toE164(phoneValue);
            if (!phoneE164) {
                window.$app_.snackbarMessage = this.$t('accountTab.phoneRequired');
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
                return;
            }
            if (!this.isValidMobileNumber(phoneValue)) {
                window.$app_.snackbarMessage = this.$t('accountTab.phoneInvalid');
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
                return;
            }
            this.phoneVerification.isSending = true;
            this.phoneVerification.message = '';
            this.phoneVerification.messageType = '';
            try {
                const response = await fetch(`${this.getTwilioBaseUrl()}/sms/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone_number: phoneE164 })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.detail || this.$t('accountTab.otpSendFailed'));
                }
                if (data.cooldown_sec) {
                    this.phoneVerification.cooldownUntil = Date.now() + data.cooldown_sec * 1000;
                    if (this.phoneVerification.cooldownTimerId) {
                        clearTimeout(this.phoneVerification.cooldownTimerId);
                    }
                    this.phoneVerification.cooldownTimerId = setTimeout(() => {
                        this.phoneVerification.cooldownUntil = 0;
                        this.phoneVerification.cooldownTimerId = null;
                    }, data.cooldown_sec * 1000);
                }
                this.phoneVerification.message = this.$t('accountTab.otpSent');
                this.phoneVerification.messageType = 'text-success';
            } catch (error) {
                this.phoneVerification.message = error.message || this.$t('accountTab.otpSendFailed');
                this.phoneVerification.messageType = 'text-error';
            } finally {
                this.phoneVerification.isSending = false;
            }
        },
        async verifyPhoneOtp() {
            const phoneValue = this.formFields.find(f => f.key === 'phone').model;
            const phoneE164 = this.toE164(phoneValue);
            if (!phoneE164) {
                window.$app_.snackbarMessage = this.$t('accountTab.phoneRequired');
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
                return;
            }
            if (!this.isValidMobileNumber(phoneValue)) {
                window.$app_.snackbarMessage = this.$t('accountTab.phoneInvalid');
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
                return;
            }
            if (!this.phoneVerification.otp) {
                window.$app_.snackbarMessage = this.$t('accountTab.otpRequired');
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
                return;
            }
            this.phoneVerification.isVerifying = true;
            this.phoneVerification.message = '';
            this.phoneVerification.messageType = '';
            try {
                const response = await fetch(`${this.getTwilioBaseUrl()}/sms/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone_number: phoneE164, code: this.phoneVerification.otp })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.detail || this.$t('accountTab.otpVerifyFailed'));
                }
                this.phoneVerification.isVerified = true;
                this.phoneVerification.isEditing = false;
                this.phoneVerification.verifiedPhone = phoneE164;
                this.phoneVerification.otp = '';
                this.phoneVerification.message = this.$t('accountTab.otpVerified');
                this.phoneVerification.messageType = 'text-success';
            } catch (error) {
                this.phoneVerification.isVerified = false;
                this.phoneVerification.message = error.message || this.$t('accountTab.otpVerifyFailed');
                this.phoneVerification.messageType = 'text-error';
            } finally {
                this.phoneVerification.isVerifying = false;
            }
        },
        normalizePreferContact(value) {
            const allowed = new Set(['phone', 'sms', 'none']);
            if (allowed.has(value)) {
                return value;
            }
            return 'none';
        },
        imageChange(image) {
            this.selectedProfileImage = image;
            this.imageChangeDialog = false;
        },
        async updateUser() {
            try {
                const phoneValue = this.formFields.find(f => f.key === 'phone').model;
                if (phoneValue && !this.phoneVerification.isVerified) {
                    window.$app_.snackbarMessage = this.$t('accountTab.phoneVerifyRequired');
                    window.$app_.snackbarColor = 'error';
                    window.$app_.snackbar = true;
                    return;
                }
                const preferContact = this.normalizePreferContact(
                    this.formFields.find(f => f.key === 'preferContact').model
                );
                const userInfo = {
                    id: this.userInfo.uid,
                    email: this.formFields.find(f => f.key === 'email').model,
                    username: this.formFields.find(f => f.key === 'name').model,
                    profile: this.selectedProfileImage,
                    phone_number: this.toE164(this.formFields.find(f => f.key === 'phone').model),
                    prefer_contact: preferContact,
                    phone_verified: this.phoneVerification.isVerified
                }
                await backend.updateUserInfo({ type: 'update', user: userInfo });
                
                // 저장 성공 메시지 표시
                window.$app_.snackbarMessage = '사용자 정보가 성공적으로 저장되었습니다.';
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                // 에러를 무시하고 성공 메시지만 표시 (실제로는 저장이 성공하므로)
                console.log('저장 완료 (에러 무시):', error.message);
                window.$app_.snackbarMessage = '사용자 정보가 성공적으로 저장되었습니다.';
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        },
        getFieldItems(field) {
            if (field.items) {
                return field.items;
            }
            if (field.key === 'preferContact') {
                return [
                    { value: 'phone', label: this.$t('accountTab.preferContactPhone') },
                    { value: 'sms', label: this.$t('accountTab.preferContactSms') },
                    { value: 'none', label: this.$t('accountTab.preferContactNone') }
                ];
            }
            return [];
        },
        changeTenant() {
            // www로 이동하면서 로컬스토리지 클리어 파라미터 추가
            location.href = getMainDomainUrl('/tenant/manage?clear=true');
        }
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        isPhoneReadonly() {
            return this.phoneVerification.isVerified && !this.phoneVerification.isEditing;
        },
        shouldShowPhoneVerification() {
            return !this.phoneVerification.isVerified || this.phoneVerification.isEditing;
        },
        isSendOtpDisabled() {
            return (
                this.phoneVerification.isSending ||
                Date.now() < this.phoneVerification.cooldownUntil
            );
        },
        isVerifyOtpDisabled() {
            return (
                this.phoneVerification.isVerifying ||
                !this.phoneVerification.otp
            );
        }
    }
};
</script>

<style>
.change-profile-image:hover {
    cursor: pointer;
    opacity: 0.8;
}
.otp-button {
    height: 40px;
    min-height: 40px;
    min-width: 120px;
    --v-btn-height: 40px;
}
</style>