<template>
    <div class="security-wrapper">
        <!-- Page Header (공통 page-header 패턴) -->
        <div class="page-header pa-0">
            <div class="page-header-left">
                <h1 class="page-title">{{ $t('adminConsole.security.title') }}</h1>
            </div>
        </div>

        <p class="page-desc">{{ $t('adminConsole.security.pageDescription') }}</p>

        <!-- ===================== Section 1: Session Timeout ===================== -->
        <!--
            유휴 세션 타임아웃 (docs/security.md 2-1).
            읽는 주체는 src/composables/useIdleTimeout.ts 이고, 앱 시작 시 한 번
            조회하므로 여기서 바꾼 값은 다음 새로고침부터 적용된다.
        -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-timer-lock-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.security.sessionTitle') }}</span>
                <div v-if="store.securityPolicyUsingDefault.session_timeout" class="default-badge">
                    {{ $t('adminConsole.security.usingDefault') }}
                </div>
            </div>
            <div class="section-body">
                <p class="section-desc">{{ $t('adminConsole.security.sessionDescription') }}</p>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.sessionIdleMinutes') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="sessionForm.idleMinutes"
                            type="number"
                            :min="limits.idleMinutes.min"
                            :max="limits.idleMinutes.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.minuteSuffix')"
                            :error-messages="sessionErrors.idleMinutes ? [sessionErrors.idleMinutes] : []"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">{{ $t('adminConsole.security.sessionIdleHint') }}</span>
                    </div>
                </div>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.sessionWarningSeconds') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="sessionForm.warningSeconds"
                            type="number"
                            :min="limits.warningSeconds.min"
                            :max="limits.warningSeconds.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.secondSuffix')"
                            :error-messages="sessionErrors.warningSeconds ? [sessionErrors.warningSeconds] : []"
                            :disabled="sessionDisabled"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">
                            {{ $t('adminConsole.security.rangeHint', { min: limits.warningSeconds.min, max: limits.warningSeconds.max }) }}
                        </span>
                    </div>
                </div>

                <v-alert
                    :type="sessionDisabled ? 'warning' : 'info'"
                    variant="tonal"
                    density="compact"
                    class="mt-3 section-note"
                >
                    {{ sessionDisabled ? $t('adminConsole.security.sessionDisabledNote') : $t('adminConsole.security.sessionNote') }}
                </v-alert>

                <div class="action-row">
                    <span v-if="feedback.session" :class="feedbackClass(feedbackOk.session)">{{ feedback.session }}</span>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        :disabled="hasSessionError"
                        @click="saveSession"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.security.save') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== Section 2: Login Lockout ===================== -->
        <!--
            반복 로그인 실패 잠금 (docs/security.md 2-4).
            판정은 DB 훅 hook_password_verification_attempt 가 하고, 이 값은
            다음 로그인 시도부터 반영된다.
        -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-lock-alert-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.security.lockoutTitle') }}</span>
                <div v-if="store.securityPolicyUsingDefault.login_lockout" class="default-badge">
                    {{ $t('adminConsole.security.usingDefault') }}
                </div>
            </div>
            <div class="section-body">
                <p class="section-desc">{{ $t('adminConsole.security.lockoutDescription') }}</p>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.lockoutMaxAttempts') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="lockoutForm.maxAttempts"
                            type="number"
                            :min="limits.maxAttempts.min"
                            :max="limits.maxAttempts.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.countSuffix')"
                            :error-messages="lockoutErrors.maxAttempts ? [lockoutErrors.maxAttempts] : []"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">{{ $t('adminConsole.security.lockoutAttemptsHint') }}</span>
                    </div>
                </div>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.lockoutWindowMinutes') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="lockoutForm.windowMinutes"
                            type="number"
                            :min="limits.windowMinutes.min"
                            :max="limits.windowMinutes.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.minuteSuffix')"
                            :error-messages="lockoutErrors.windowMinutes ? [lockoutErrors.windowMinutes] : []"
                            :disabled="lockoutDisabled"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">{{ $t('adminConsole.security.lockoutWindowHint') }}</span>
                    </div>
                </div>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.lockoutDurationMinutes') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="lockoutForm.lockoutMinutes"
                            type="number"
                            :min="limits.lockoutMinutes.min"
                            :max="limits.lockoutMinutes.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.minuteSuffix')"
                            :error-messages="lockoutErrors.lockoutMinutes ? [lockoutErrors.lockoutMinutes] : []"
                            :disabled="lockoutDisabled"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">{{ $t('adminConsole.security.lockoutDurationHint') }}</span>
                    </div>
                </div>

                <v-alert
                    :type="lockoutDisabled ? 'warning' : 'info'"
                    variant="tonal"
                    density="compact"
                    class="mt-3 section-note"
                >
                    {{ lockoutDisabled ? $t('adminConsole.security.lockoutDisabledNote') : $t('adminConsole.security.lockoutNote') }}
                </v-alert>

                <div class="action-row">
                    <span v-if="feedback.lockout" :class="feedbackClass(feedbackOk.lockout)">{{ feedback.lockout }}</span>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        :disabled="hasLockoutError"
                        @click="saveLockout"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.security.save') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== Section 3: MFA Policy ===================== -->
        <!--
            MFA 필수 여부 (docs/security.md 2-3).
            라우터 게이트 src/utils/mfaGate.ts 가 60초 캐시로 읽는다 — 저장 시
            store 가 캐시를 무효화하므로 바로 다음 네비게이션부터 적용된다.
        -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-two-factor-authentication</v-icon>
                <span class="section-title">{{ $t('adminConsole.security.mfaTitle') }}</span>
                <div v-if="store.securityPolicyUsingDefault.mfa_policy" class="default-badge">
                    {{ $t('adminConsole.security.usingDefault') }}
                </div>
            </div>
            <div class="section-body">
                <p class="section-desc">{{ $t('adminConsole.security.mfaDescription') }}</p>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.mfaRequire') }}</span>
                    <v-switch
                        v-model="mfaForm.requireMfa"
                        color="primary"
                        hide-details
                        density="compact"
                        inset
                    />
                </div>

                <v-alert type="info" variant="tonal" density="compact" class="mt-3 section-note">
                    {{ $t('adminConsole.security.mfaSsoNote') }}
                </v-alert>

                <div class="action-row">
                    <span v-if="feedback.mfa" :class="feedbackClass(feedbackOk.mfa)">{{ feedback.mfa }}</span>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        @click="saveMfa"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.security.save') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== Section 4: Download Anomaly ===================== -->
        <!--
            다운로드 이상 탐지 임계치 (docs/security.md 3-3).
            DB 함수 detect_download_anomalies 가 매시 예약 실행 때 읽는다.
        -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-download-network-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.security.downloadTitle') }}</span>
                <div v-if="store.securityPolicyUsingDefault.download_anomaly" class="default-badge">
                    {{ $t('adminConsole.security.usingDefault') }}
                </div>
            </div>
            <div class="section-body">
                <p class="section-desc">{{ $t('adminConsole.security.downloadDescription') }}</p>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.downloadThreshold') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="downloadForm.dailyThreshold"
                            type="number"
                            :min="limits.dailyThreshold.min"
                            :max="limits.dailyThreshold.max"
                            :step="1"
                            :suffix="$t('adminConsole.security.countSuffix')"
                            :error-messages="downloadErrors.dailyThreshold ? [downloadErrors.dailyThreshold] : []"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">
                            {{ $t('adminConsole.security.rangeHint', { min: limits.dailyThreshold.min, max: limits.dailyThreshold.max }) }}
                        </span>
                    </div>
                </div>

                <v-alert type="info" variant="tonal" density="compact" class="mt-3 section-note">
                    {{ $t('adminConsole.security.downloadNote') }}
                </v-alert>

                <div class="action-row">
                    <span v-if="feedback.download" :class="feedbackClass(feedbackOk.download)">{{ feedback.download }}</span>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        :disabled="!!downloadErrors.dailyThreshold"
                        @click="saveDownload"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.security.save') }}
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== Section 5: Audit Log Retention ===================== -->
        <!--
            감사 로그 보관 정책 (docs/security.md 4-3, 항목 17).
            원래 "시스템 운영" 화면에 있었으나 보안 설정을 한 곳에 모으면서 이리로 옮겼다.
            여기서 정하는 건 "일수" 하나뿐이고, 실제로 옮기는 주체는 DB 의
            pg_cron 작업(archive_expired_audit_logs)이다.
        -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-archive-clock-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.security.retentionTitle') }}</span>
            </div>
            <div class="section-body">
                <p class="section-desc">{{ $t('adminConsole.security.retentionDescription') }}</p>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.retentionDays') }}</span>
                    <div class="number-input-wrap">
                        <v-text-field
                            v-model="retentionForm.days"
                            type="number"
                            :min="retentionMin"
                            :max="retentionMax"
                            :step="1"
                            :suffix="$t('adminConsole.security.daySuffix')"
                            :error-messages="retentionError ? [retentionError] : []"
                            variant="outlined"
                            density="compact"
                            hide-details="auto"
                            class="number-input"
                        />
                        <span class="field-hint">
                            {{ $t('adminConsole.security.rangeHint', { min: retentionMin, max: retentionMax }) }}
                        </span>
                    </div>
                </div>

                <v-divider class="field-divider" />

                <div class="field-row">
                    <span class="field-label">{{ $t('adminConsole.security.retentionCutoff') }}</span>
                    <span class="retention-cutoff">
                        <v-icon size="14" color="#9ca3af" class="mr-1">mdi-calendar-arrow-left</v-icon>
                        {{ retentionCutoffLabel }}
                    </span>
                </div>

                <v-alert type="info" variant="tonal" density="compact" class="mt-3 section-note">
                    {{ $t('adminConsole.security.retentionNote') }}
                </v-alert>

                <div class="action-row">
                    <span v-if="feedback.retention" :class="feedbackClass(feedbackOk.retention)">{{ feedback.retention }}</span>
                    <v-btn
                        color="primary"
                        variant="flat"
                        size="small"
                        :loading="store.loading"
                        :disabled="!!retentionError"
                        @click="saveRetention"
                    >
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        {{ $t('adminConsole.security.save') }}
                    </v-btn>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
/**
 * 보안 설정 (docs/security.md)
 *
 * 지금까지 SQL 로만 바꿀 수 있던 테넌트 보안 정책 네 가지 + 감사 로그 보관
 * 정책을 한 화면에 모은다. 저장 위치는 모두 public.configuration 이고,
 * 실제 쓰기·감사 기록은 adminConsole store 가 맡는다(화면은 검증과 표시만).
 *
 * 각 정책이 "언제 반영되는지" 가 다르므로(새로고침 / 다음 로그인 / 예약 작업)
 * 섹션마다 안내 문구를 둔다.
 */
import { defineComponent, reactive, computed, onMounted, watch } from 'vue';
import {
    useAdminConsoleStore,
    AUDIT_RETENTION_DEFAULT_DAYS,
    AUDIT_RETENTION_MIN_DAYS,
    AUDIT_RETENTION_MAX_DAYS,
    IDLE_MINUTES_MIN,
    IDLE_MINUTES_MAX,
    WARNING_SECONDS_MIN,
    WARNING_SECONDS_MAX,
    LOCKOUT_ATTEMPTS_MIN,
    LOCKOUT_ATTEMPTS_MAX,
    LOCKOUT_WINDOW_MIN,
    LOCKOUT_WINDOW_MAX,
    LOCKOUT_DURATION_MIN,
    LOCKOUT_DURATION_MAX,
    DOWNLOAD_THRESHOLD_MIN,
    DOWNLOAD_THRESHOLD_MAX
} from '@/stores/adminConsole';

export default defineComponent({
    name: 'SecuritySettings',

    setup() {
        const store = useAdminConsoleStore();
        // main.ts 의 createI18n 은 legacy 모드(기본값)라 setup 에서 useI18n() 을 쓸 수 없다.
        // 레포 표준대로 전역 인스턴스의 t 를 쓴다 (템플릿에서는 $t 를 그대로 쓴다).
        const t = (key, params) =>
            (params ? window.$i18n?.global?.t(key, params) : window.$i18n?.global?.t(key)) ?? key;

        const limits = {
            idleMinutes: { min: IDLE_MINUTES_MIN, max: IDLE_MINUTES_MAX },
            warningSeconds: { min: WARNING_SECONDS_MIN, max: WARNING_SECONDS_MAX },
            maxAttempts: { min: LOCKOUT_ATTEMPTS_MIN, max: LOCKOUT_ATTEMPTS_MAX },
            windowMinutes: { min: LOCKOUT_WINDOW_MIN, max: LOCKOUT_WINDOW_MAX },
            lockoutMinutes: { min: LOCKOUT_DURATION_MIN, max: LOCKOUT_DURATION_MAX },
            dailyThreshold: { min: DOWNLOAD_THRESHOLD_MIN, max: DOWNLOAD_THRESHOLD_MAX }
        };

        // v-model 로 받는 값은 문자열이라 검증·저장 시점에 숫자로 바꾼다.
        const sessionForm = reactive({ idleMinutes: '', warningSeconds: '' });
        const lockoutForm = reactive({ maxAttempts: '', windowMinutes: '', lockoutMinutes: '' });
        const mfaForm = reactive({ requireMfa: false });
        const downloadForm = reactive({ dailyThreshold: '' });
        const retentionForm = reactive({ days: String(AUDIT_RETENTION_DEFAULT_DAYS) });

        const retentionMin = AUDIT_RETENTION_MIN_DAYS;
        const retentionMax = AUDIT_RETENTION_MAX_DAYS;

        // 섹션별 저장 결과 문구 (+ 성공/실패 구분)
        const feedback = reactive({ session: '', lockout: '', mfa: '', download: '', retention: '' });
        const feedbackOk = reactive({ session: true, lockout: true, mfa: true, download: true, retention: true });

        function feedbackClass(ok) {
            return ok ? 'save-feedback' : 'save-feedback save-feedback--error';
        }

        /** 정수 + 범위 검증. 통과하면 빈 문자열을 돌려준다. */
        function validateInt(raw, min, max) {
            const text = String(raw ?? '').trim();
            if (!text) return t('adminConsole.security.valueRequired');
            const n = Number(text);
            if (!Number.isFinite(n) || !Number.isInteger(n)) return t('adminConsole.security.valueInteger');
            if (n < min || n > max) return t('adminConsole.security.valueRange', { min, max });
            return '';
        }

        const sessionDisabled = computed(() => Number(sessionForm.idleMinutes) === 0);
        const lockoutDisabled = computed(() => Number(lockoutForm.maxAttempts) === 0);

        const sessionErrors = computed(() => ({
            idleMinutes: validateInt(sessionForm.idleMinutes, limits.idleMinutes.min, limits.idleMinutes.max),
            // 유휴 타이머를 끈 상태면 경고 초는 쓰이지 않으므로 막지 않는다.
            warningSeconds: sessionDisabled.value
                ? ''
                : validateInt(sessionForm.warningSeconds, limits.warningSeconds.min, limits.warningSeconds.max)
        }));
        const hasSessionError = computed(() => Object.values(sessionErrors.value).some(Boolean));

        const lockoutErrors = computed(() => ({
            maxAttempts: validateInt(lockoutForm.maxAttempts, limits.maxAttempts.min, limits.maxAttempts.max),
            // 잠금을 끈 상태면 기간 값은 쓰이지 않는다.
            windowMinutes: lockoutDisabled.value
                ? ''
                : validateInt(lockoutForm.windowMinutes, limits.windowMinutes.min, limits.windowMinutes.max),
            lockoutMinutes: lockoutDisabled.value
                ? ''
                : validateInt(lockoutForm.lockoutMinutes, limits.lockoutMinutes.min, limits.lockoutMinutes.max)
        }));
        const hasLockoutError = computed(() => Object.values(lockoutErrors.value).some(Boolean));

        const downloadErrors = computed(() => ({
            dailyThreshold: validateInt(
                downloadForm.dailyThreshold,
                limits.dailyThreshold.min,
                limits.dailyThreshold.max
            )
        }));

        const retentionError = computed(() => validateInt(retentionForm.days, retentionMin, retentionMax));

        // "오늘 기준으로 언제 이전 로그가 옮겨지는가" — 일수만 보면 감이 안 온다.
        const retentionCutoffLabel = computed(() => {
            if (retentionError.value) return '-';
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - Number(retentionForm.days));
            return `${cutoff.toISOString().slice(0, 10)} ${t('adminConsole.security.retentionCutoffSuffix')}`;
        });

        // ---- store → 폼 동기화 ----
        function syncFromStore() {
            sessionForm.idleMinutes = String(store.sessionTimeoutPolicy.idle_timeout_minutes);
            sessionForm.warningSeconds = String(store.sessionTimeoutPolicy.warning_seconds);
            lockoutForm.maxAttempts = String(store.loginLockoutPolicy.max_attempts);
            lockoutForm.windowMinutes = String(store.loginLockoutPolicy.window_minutes);
            lockoutForm.lockoutMinutes = String(store.loginLockoutPolicy.lockout_minutes);
            mfaForm.requireMfa = !!store.mfaPolicy.require_mfa;
            downloadForm.dailyThreshold = String(store.downloadAnomalyPolicy.daily_threshold);
            retentionForm.days = String(store.auditLogRetention?.retention_days ?? AUDIT_RETENTION_DEFAULT_DAYS);
        }

        /** 저장 호출 + 결과 문구를 한 곳에서 처리한다. */
        async function runSave(section, fn) {
            feedback[section] = '';
            try {
                await fn();
                feedbackOk[section] = true;
                feedback[section] = t('adminConsole.security.saved');
            } catch (e) {
                console.error(`Failed to save security setting (${section}):`, e);
                feedbackOk[section] = false;
                feedback[section] = e?.message || t('adminConsole.security.saveFailed');
            }
        }

        async function saveSession() {
            if (hasSessionError.value) return;
            await runSave('session', () =>
                store.saveSessionTimeoutPolicy({
                    idle_timeout_minutes: Number(sessionForm.idleMinutes),
                    warning_seconds: Number(sessionForm.warningSeconds)
                })
            );
        }

        async function saveLockout() {
            if (hasLockoutError.value) return;
            await runSave('lockout', () =>
                store.saveLoginLockoutPolicy({
                    max_attempts: Number(lockoutForm.maxAttempts),
                    window_minutes: Number(lockoutForm.windowMinutes),
                    lockout_minutes: Number(lockoutForm.lockoutMinutes)
                })
            );
        }

        async function saveMfa() {
            await runSave('mfa', () => store.saveMfaPolicy({ require_mfa: !!mfaForm.requireMfa }));
        }

        async function saveDownload() {
            if (downloadErrors.value.dailyThreshold) return;
            await runSave('download', () =>
                store.saveDownloadAnomalyPolicy({ daily_threshold: Number(downloadForm.dailyThreshold) })
            );
        }

        async function saveRetention() {
            if (retentionError.value) return;
            await runSave('retention', () => store.saveAuditLogRetention(Number(retentionForm.days)));
        }

        // 값을 다시 만지면 이전 저장 결과 문구는 치운다 (오래된 "저장됨" 이 남지 않게)
        watch(() => ({ ...sessionForm }), () => { feedback.session = ''; }, { deep: true });
        watch(() => ({ ...lockoutForm }), () => { feedback.lockout = ''; }, { deep: true });
        watch(() => mfaForm.requireMfa, () => { feedback.mfa = ''; });
        watch(() => downloadForm.dailyThreshold, () => { feedback.download = ''; });
        watch(() => retentionForm.days, () => { feedback.retention = ''; });

        onMounted(async () => {
            await store.fetchSecuritySettings();
            syncFromStore();
        });

        return {
            store,
            limits,
            sessionForm,
            lockoutForm,
            mfaForm,
            downloadForm,
            retentionForm,
            retentionMin,
            retentionMax,
            sessionDisabled,
            lockoutDisabled,
            sessionErrors,
            hasSessionError,
            lockoutErrors,
            hasLockoutError,
            downloadErrors,
            retentionError,
            retentionCutoffLabel,
            feedback,
            feedbackOk,
            feedbackClass,
            saveSession,
            saveLockout,
            saveMfa,
            saveDownload,
            saveRetention
        };
    }
});
</script>

<style scoped>
/* 시스템 운영 화면(SystemOperations.vue)과 같은 섹션 카드 관례를 쓴다.
   새 스타일을 만들지 않고 클래스 구성을 그대로 맞춘다. */

/* ── Wrapper ─────────────────────────────────────────────────── */
.security-wrapper {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
}

.security-wrapper > .page-header,
.security-wrapper > .page-desc,
.security-wrapper > .section-card {
    flex-shrink: 0;
}

.page-desc {
    margin: -8px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: #6b7280;
}

/* ── Section Card ────────────────────────────────────────────── */
.section-card {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* ── Section Header ──────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
}

.section-icon {
    color: #3b82f6;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    flex: 1;
}

/* 설정 행이 아직 없는 정책임을 알리는 배지 */
.default-badge {
    background: #f3f4f6;
    color: #6b7280;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 4px;
}

/* ── Section Body ────────────────────────────────────────────── */
.section-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
}

.section-desc {
    margin: 0;
    padding: 4px 0 12px;
    font-size: 12.5px;
    line-height: 1.6;
    color: #6b7280;
}

.section-note {
    font-size: 12.5px;
}

/* ── Field Row ───────────────────────────────────────────────── */
.field-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
}

.field-label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    min-width: 160px;
    flex-shrink: 0;
}

.field-divider {
    margin: 0;
    border-color: #f3f4f6;
}

.number-input-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.number-input {
    width: 180px;
    flex: 0 0 auto;
}

.field-hint {
    font-size: 12px;
    color: #9ca3af;
}

.retention-cutoff {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    color: #374151;
    font-variant-numeric: tabular-nums;
}

/* ── Action Row ──────────────────────────────────────────────── */
.action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding-top: 16px;
}

.save-feedback {
    font-size: 12px;
    color: #6b7280;
}

.save-feedback--error {
    color: #dc2626;
}
</style>
