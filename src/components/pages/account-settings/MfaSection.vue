<script setup lang="ts">
/**
 * MFA(TOTP) 등록·해제 섹션 (docs/security.md 2-3, 항목 3)
 *
 * 계정 설정 > 계정 탭(AccountTab.vue) 아래에 붙는다. 기존 화면 레이아웃은 건드리지 않고
 * 섹션 하나만 더한다.
 *
 * 등록  : enroll → QR(또는 수동 시크릿) → 인증 앱의 6자리 코드로 challenge+verify
 * 해제  : 확인 다이얼로그 + 현재 코드 재검증 → unenroll
 *
 * SSO(헤더 교환) 로그인은 IdP 의 MFA 정책을 따르므로 이 섹션을 감춘다.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
    enrollTotp,
    isMfaSupported,
    listTotpFactors,
    mfaErrorMessage,
    unenrollTotp,
    verifyTotp,
    type TotpEnrollment,
    type TotpFactor
} from '@/utils/mfa';
import { invalidateMfaPolicyCache, isMfaRequired } from '@/utils/mfaGate';
import { isSsoAuthenticated } from '@/utils/ssoAuth';

const i18n = () => (window as any).$i18n?.global;
const t = (key: string, params?: any): string => (params ? i18n()?.t(key, params) : i18n()?.t(key)) ?? key;

const route = useRoute();

const loading = ref(true);
const factors = ref<TotpFactor[]>([]);
const requireMfa = ref(false);
const errorMessage = ref('');

/** 등록 진행 중인 팩터 (enroll 응답). null 이면 등록 화면이 닫혀 있다. */
const enrollment = ref<TotpEnrollment | null>(null);
const enrollCode = ref('');
const enrolling = ref(false);
const verifying = ref(false);
const secretVisible = ref(false);

const unenrollDialog = ref(false);
const unenrollTarget = ref<TotpFactor | null>(null);
const unenrollCode = ref('');
const unenrolling = ref(false);
const unenrollError = ref('');

const isSso = (() => {
    try {
        return isSsoAuthenticated();
    } catch (_e) {
        return false;
    }
})();

const visible = computed(() => !isSso && isMfaSupported());
const enabled = computed(() => factors.value.length > 0);
/** 라우터 가드가 "등록하라"며 보낸 경우 (mfaGate 의 MFA_ENROLL_QUERY) */
const forcedHere = computed(() => route.query.mfaRequired === '1');

function notify(message: string, color: 'success' | 'error' = 'success') {
    const app = (window as any).$app_;
    if (!app) return;
    app.snackbarMessage = message;
    app.snackbarColor = color;
    app.snackbar = true;
}

async function reload() {
    errorMessage.value = '';
    try {
        const [{ verified }, required] = await Promise.all([listTotpFactors(), isMfaRequired()]);
        factors.value = verified;
        requireMfa.value = required;
    } catch (e) {
        errorMessage.value = mfaErrorMessage(e);
    } finally {
        loading.value = false;
    }
}

onMounted(reload);

function formatDate(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

async function startEnroll() {
    if (enrolling.value) return;
    enrolling.value = true;
    errorMessage.value = '';
    enrollCode.value = '';
    secretVisible.value = false;
    try {
        // friendly_name 은 계정당 유일해야 한다 — 여러 기기를 등록할 수 있게 시각을 붙인다.
        enrollment.value = await enrollTotp(`Process-GPT ${new Date().toISOString().slice(0, 10)}`);
    } catch (e) {
        errorMessage.value = mfaErrorMessage(e);
    } finally {
        enrolling.value = false;
    }
}

async function cancelEnroll() {
    const pending = enrollment.value;
    enrollment.value = null;
    enrollCode.value = '';
    if (!pending) return;
    try {
        // 검증하지 않고 닫은 팩터는 지워 둔다 (다음 등록 시 이름 충돌을 막는다).
        await unenrollTotp(pending.factorId);
    } catch (_e) {
        /* best-effort — 다음 enroll 이 cleanupUnverifiedFactors 로 다시 정리한다 */
    }
}

async function confirmEnroll() {
    if (!enrollment.value || verifying.value) return;
    const code = enrollCode.value.replace(/\D/g, '');
    if (code.length !== 6) {
        errorMessage.value = t('mfa.codeLength', { length: 6 });
        return;
    }

    verifying.value = true;
    errorMessage.value = '';
    try {
        await verifyTotp(enrollment.value.factorId, code);
        enrollment.value = null;
        enrollCode.value = '';
        invalidateMfaPolicyCache();
        await reload();
        notify(t('mfa.enrollSuccess'));
    } catch (e) {
        errorMessage.value = t('mfa.verifyFailed');
        enrollCode.value = '';
    } finally {
        verifying.value = false;
    }
}

function openUnenroll(factor: TotpFactor) {
    unenrollTarget.value = factor;
    unenrollCode.value = '';
    unenrollError.value = '';
    unenrollDialog.value = true;
}

async function confirmUnenroll() {
    const target = unenrollTarget.value;
    if (!target || unenrolling.value) return;

    const code = unenrollCode.value.replace(/\D/g, '');
    if (code.length !== 6) {
        unenrollError.value = t('mfa.codeLength', { length: 6 });
        return;
    }

    unenrolling.value = true;
    unenrollError.value = '';
    try {
        // 해제 전에 현재 코드를 한 번 더 확인한다 — 잠깐 자리를 비운 브라우저에서
        // 2단계 인증이 소리 없이 꺼지는 일을 막는다.
        await verifyTotp(target.id, code);
        await unenrollTotp(target.id);
        unenrollDialog.value = false;
        unenrollTarget.value = null;
        await reload();
        notify(t('mfa.unenrollSuccess'));
    } catch (e) {
        unenrollError.value = t('mfa.verifyFailed');
        unenrollCode.value = '';
    } finally {
        unenrolling.value = false;
    }
}

async function copySecret() {
    if (!enrollment.value?.secret) return;
    try {
        await navigator.clipboard.writeText(enrollment.value.secret);
        notify(t('mfa.secretCopied'));
    } catch (_e) {
        notify(t('mfa.secretCopyFailed'), 'error');
    }
}
</script>

<template>
    <div v-if="visible" class="pa-4">
        <v-divider class="mb-6"></v-divider>

        <div class="text-center mb-4">
            <h5 class="text-h5 pb-2">{{ $t('mfa.sectionTitle') }}</h5>
            <div class="text-subtitle-1 text-grey100">{{ $t('mfa.sectionDescription') }}</div>
        </div>

        <v-alert v-if="forcedHere && !enabled" type="warning" variant="tonal" density="comfortable" class="mb-4">
            {{ $t('mfa.requiredByTenant') }}
        </v-alert>
        <v-alert v-else-if="requireMfa" type="info" variant="tonal" density="comfortable" class="mb-4">
            {{ $t('mfa.policyRequired') }}
        </v-alert>

        <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">{{ errorMessage }}</v-alert>

        <div v-if="loading" class="d-flex justify-center py-4">
            <v-progress-circular indeterminate color="primary" size="28"></v-progress-circular>
        </div>

        <template v-else>
            <!-- 등록된 팩터 목록 -->
            <v-list v-if="enabled" density="comfortable" class="mb-4 rounded border">
                <v-list-item v-for="factor in factors" :key="factor.id">
                    <template v-slot:prepend>
                        <v-icon color="success">mdi-shield-check</v-icon>
                    </template>
                    <v-list-item-title class="font-weight-medium">{{ factor.friendlyName }}</v-list-item-title>
                    <v-list-item-subtitle v-if="formatDate(factor.createdAt)">
                        {{ $t('mfa.registeredAt', { date: formatDate(factor.createdAt) }) }}
                    </v-list-item-subtitle>
                    <template v-slot:append>
                        <v-btn variant="text" color="error" size="small" @click="openUnenroll(factor)">
                            {{ $t('mfa.disable') }}
                        </v-btn>
                    </template>
                </v-list-item>
            </v-list>

            <div v-else-if="!enrollment" class="text-subtitle-1 text-grey100 mb-4">
                {{ $t('mfa.notEnrolled') }}
            </div>

            <!-- 등록 진행 -->
            <div v-if="enrollment" class="mb-2">
                <div class="text-subtitle-1 font-weight-medium mb-2">{{ $t('mfa.scanQr') }}</div>
                <div class="d-flex justify-center mb-3">
                    <img
                        v-if="enrollment.qrCode"
                        :src="enrollment.qrCode"
                        alt="TOTP QR"
                        width="200"
                        height="200"
                        style="background: #fff; padding: 8px; border-radius: 8px"
                    />
                </div>

                <div class="text-body-2 text-grey100 mb-1">{{ $t('mfa.manualEntry') }}</div>
                <div class="d-flex align-center mb-4 ga-2">
                    <v-text-field
                        :model-value="secretVisible ? enrollment.secret : '••••••••••••••••'"
                        readonly
                        hide-details
                        density="compact"
                        variant="outlined"
                        class="font-monospace"
                    ></v-text-field>
                    <v-btn variant="text" size="small" @click="secretVisible = !secretVisible">
                        <v-icon>{{ secretVisible ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                    </v-btn>
                    <v-btn variant="text" size="small" @click="copySecret">
                        <v-icon>mdi-content-copy</v-icon>
                    </v-btn>
                </div>

                <v-label class="mb-2 font-weight-medium">{{ $t('mfa.enterCode') }}</v-label>
                <v-text-field
                    v-model="enrollCode"
                    variant="outlined"
                    density="comfortable"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    hide-details
                    class="mb-4"
                    @keyup.enter="confirmEnroll"
                ></v-text-field>

                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="cancelEnroll">{{ $t('mfa.cancel') }}</v-btn>
                    <v-btn color="primary" variant="elevated" class="rounded-pill" :loading="verifying" @click="confirmEnroll">
                        {{ $t('mfa.confirmEnroll') }}
                    </v-btn>
                </div>
            </div>

            <div v-else-if="!enabled" class="d-flex justify-end">
                <v-btn color="primary" variant="elevated" class="rounded-pill" :loading="enrolling" @click="startEnroll">
                    {{ $t('mfa.enable') }}
                </v-btn>
            </div>
        </template>

        <!-- 해제 확인 -->
        <v-dialog v-model="unenrollDialog" width="460">
            <v-card>
                <v-card-title class="text-h6">{{ $t('mfa.disableTitle') }}</v-card-title>
                <v-card-text>
                    <p class="mb-4">{{ $t('mfa.disableWarning') }}</p>
                    <v-alert v-if="requireMfa" type="warning" variant="tonal" density="compact" class="mb-4">
                        {{ $t('mfa.disableBlockedByPolicy') }}
                    </v-alert>
                    <v-label class="mb-2 font-weight-medium">{{ $t('mfa.enterCodeToDisable') }}</v-label>
                    <v-text-field
                        v-model="unenrollCode"
                        variant="outlined"
                        density="comfortable"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        hide-details
                        @keyup.enter="confirmUnenroll"
                    ></v-text-field>
                    <v-alert v-if="unenrollError" type="error" variant="tonal" density="compact" class="mt-3">
                        {{ unenrollError }}
                    </v-alert>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="unenrollDialog = false">{{ $t('mfa.cancel') }}</v-btn>
                    <v-btn color="error" variant="elevated" :loading="unenrolling" @click="confirmUnenroll">
                        {{ $t('mfa.disable') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.font-monospace :deep(input) {
    font-family: monospace;
    letter-spacing: 1px;
}
</style>
