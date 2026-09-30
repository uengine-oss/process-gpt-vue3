<template>
    <div class="policy-wrapper">
        <div class="page-header pa-0">
            <div class="page-header-left">
                <h1 class="page-title">운영 정책</h1>
            </div>
        </div>
        <p class="page-desc">
            공람 기간·경보 기준, 휴지통 보존 일수, FTE/원가 환산 기준을 테넌트별로 조정합니다. 값이 없으면 제품 기본값으로 동작하며,
            저장한 값은 새로 시작되는 공람·새로 계산되는 화면부터 적용됩니다.
        </p>

        <!-- ===================== 1. 공람 · 리뷰보드 경보 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-bullhorn-outline</v-icon>
                <span class="section-title">공람 기간 · 변경 관리 경보</span>
                <div v-if="usingDefault" class="default-badge">기본값 사용 중</div>
            </div>
            <div class="section-body">
                <p class="section-desc">
                    검토 승인 시 자동으로 시작되는 공람의 기간과, 프로세스 변경 관리(리뷰보드)가 "임박"·"정체"로 표시하는 기준 일수입니다.
                    이미 진행 중인 공람의 마감일(<code>public_feedback_ends_at</code>)은 바뀌지 않습니다 — 건별 조정은 리뷰보드에서 합니다.
                </p>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">공람 기간</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.public_feedback_days" type="number" :min="L.public_feedback_days.min" :max="L.public_feedback_days.max" suffix="일" variant="outlined" density="compact" hide-details="auto" class="number-input" :error-messages="errorFor('public_feedback_days')" />
                        <span class="field-hint">{{ rangeHint(L.public_feedback_days) }} · 기본 {{ D.public_feedback_days }}일. 체계도 D-day 도 이 값을 따릅니다.</span>
                    </div>
                </div>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">공람 마감 경보 (D-n)</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.feedback_alert_days" type="number" :min="L.feedback_alert_days.min" :max="L.feedback_alert_days.max" suffix="일" variant="outlined" density="compact" hide-details="auto" class="number-input" :error-messages="errorFor('feedback_alert_days')" />
                        <span class="field-hint">{{ rangeHint(L.feedback_alert_days) }} · 기본 {{ D.feedback_alert_days }}일. 마감까지 남은 일수가 이 값 이하이면 경보.</span>
                    </div>
                </div>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">정체 기준</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.stalled_days" type="number" :min="L.stalled_days.min" :max="L.stalled_days.max" suffix="일" variant="outlined" density="compact" hide-details="auto" class="number-input" :error-messages="errorFor('stalled_days')" />
                        <span class="field-hint">{{ rangeHint(L.stalled_days) }} · 기본 {{ D.stalled_days }}일. 마지막 갱신 후 이 일수가 지나면 정체.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ===================== 2. 휴지통 보존 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-delete-clock-outline</v-icon>
                <span class="section-title">휴지통 보존 일수</span>
            </div>
            <div class="section-body">
                <p class="section-desc">
                    휴지통으로 이동한 항목(프로세스·인스턴스·속성 스키마·감사 정책·KPI 목표·역할 그룹·공급사·시스템·PI Flag 유형)이
                    영구 삭제되기까지의 일수입니다. 실제 삭제는 DB 예약 작업(<code>purge_expired_recycle_bin</code>, 매일 03:30)이 수행하므로
                    휴지통 화면을 열지 않아도 정리됩니다.
                </p>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">보존 일수</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.recycle_bin_retention_days" type="number" :min="L.recycle_bin_retention_days.min" :max="L.recycle_bin_retention_days.max" suffix="일" variant="outlined" density="compact" hide-details="auto" class="number-input" :error-messages="errorFor('recycle_bin_retention_days')" />
                        <span class="field-hint">{{ rangeHint(L.recycle_bin_retention_days) }} · 기본 {{ D.recycle_bin_retention_days }}일</span>
                    </div>
                </div>
                <v-alert type="warning" variant="tonal" density="compact" class="mt-3 section-note">
                    일수를 줄이면 이미 휴지통에 있는 항목도 새 기준으로 다음 예약 실행 때 삭제됩니다.
                </v-alert>
            </div>
        </div>

        <!-- ===================== 3. FTE · 원가 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-calculator-variant-outline</v-icon>
                <span class="section-title">FTE · 원가 기준</span>
            </div>
            <div class="section-body">
                <p class="section-desc">
                    프로세스 속성의 FTE 계산기, To-Be 청사진 ROI, 카탈로그 저장 시 FTE 환산에 쓰는 기준값입니다.
                    FTE = (건당 소요시간 × 연간 횟수 × 인원) ÷ 연간 근무시간. 연간 횟수 = 입력 횟수 × 주기 환산 계수.
                </p>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">연간 근무시간</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.annual_working_hours" type="number" :min="L.annual_working_hours.min" :max="L.annual_working_hours.max" suffix="시간" variant="outlined" density="compact" hide-details="auto" class="number-input" :error-messages="errorFor('annual_working_hours')" />
                        <span class="field-hint">기본 {{ D.annual_working_hours }}시간 (52주 × 40시간)</span>
                    </div>
                </div>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">주기 환산 계수</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.cycle_Monthly" type="number" :min="1" :max="366" label="월간 → 연" variant="outlined" density="compact" hide-details="auto" class="number-input number-input--sm" :error-messages="errorFor('cycle_Monthly')" />
                        <v-text-field v-model="form.cycle_Weekly" type="number" :min="1" :max="366" label="주간 → 연" variant="outlined" density="compact" hide-details="auto" class="number-input number-input--sm" :error-messages="errorFor('cycle_Weekly')" />
                        <v-text-field v-model="form.cycle_Daily" type="number" :min="1" :max="366" label="일간 → 연" variant="outlined" density="compact" hide-details="auto" class="number-input number-input--sm" :error-messages="errorFor('cycle_Daily')" />
                        <span class="field-hint">기본 {{ D.cycle_factors.Monthly }} / {{ D.cycle_factors.Weekly }} / {{ D.cycle_factors.Daily }} (연간은 항상 1)</span>
                    </div>
                </div>
                <v-divider class="field-divider" />
                <div class="field-row">
                    <span class="field-label">연간 인건비 단가 (1 FTE)</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="form.annual_cost_per_fte" type="number" :min="0" :step="1000000" variant="outlined" density="compact" hide-details="auto" class="number-input number-input--lg" :error-messages="errorFor('annual_cost_per_fte')" />
                        <v-text-field v-model="form.currency" label="통화" placeholder="KRW" maxlength="8" variant="outlined" density="compact" hide-details="auto" class="number-input number-input--sm" :error-messages="errorFor('currency')" />
                        <span class="field-hint">기본 {{ formatNumber(D.annual_cost_per_fte) }} {{ D.currency }} · ROI 초기값(건별 수정 가능)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="action-row sticky-actions">
            <span v-if="feedback" :class="feedbackOk ? 'save-feedback' : 'save-feedback save-feedback--error'">{{ feedback }}</span>
            <v-btn variant="text" size="small" :disabled="saving" @click="resetToDefaults">기본값으로</v-btn>
            <v-btn color="primary" variant="flat" size="small" :loading="saving" :disabled="hasErrors" @click="save">
                <v-icon size="16" start>mdi-content-save-outline</v-icon>
                저장
            </v-btn>
        </div>
    </div>
</template>

<script>
/**
 * 운영 정책 (specs/010-tenant-terminology-policy US5)
 *
 * 코드 여러 곳에 박혀 있던 정책 상수(공람 30일 · D-7 · 정체 7일 · 휴지통 30일 · 2080시간 ·
 * 주기 계수 · 인건비 단가)를 configuration(key='operation_policy') 한 행으로 모은다.
 * 읽는 주체는 tenantCustomizationService 의 getter 들이고, 휴지통 정리는 DB 함수가 같은 행을 읽는다.
 * 보안 설정(SecuritySettings.vue)과 같은 섹션 카드 관례를 쓴다.
 */
import { defineComponent, reactive, ref, computed, onMounted } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { DEFAULT_OPERATION_POLICY, OPERATION_POLICY_LIMITS } from '@/utils/tenantCustomizationCore';
import { loadTenantCustomization, saveOperationPolicy, tenantCustomization } from '@/services/tenantCustomizationService';

export default defineComponent({
    name: 'OperationPolicySettings',

    setup() {
        const adminStore = useAdminConsoleStore();
        const D = DEFAULT_OPERATION_POLICY;
        const L = OPERATION_POLICY_LIMITS;

        const form = reactive({
            public_feedback_days: '',
            feedback_alert_days: '',
            stalled_days: '',
            recycle_bin_retention_days: '',
            annual_working_hours: '',
            cycle_Monthly: '',
            cycle_Weekly: '',
            cycle_Daily: '',
            annual_cost_per_fte: '',
            currency: ''
        });
        const saving = ref(false);
        const feedback = ref('');
        const feedbackOk = ref(true);
        const usingDefault = computed(() => tenantCustomization.usingDefault.operation_policy);

        function fillForm(policy) {
            form.public_feedback_days = String(policy.public_feedback_days);
            form.feedback_alert_days = String(policy.feedback_alert_days);
            form.stalled_days = String(policy.stalled_days);
            form.recycle_bin_retention_days = String(policy.recycle_bin_retention_days);
            form.annual_working_hours = String(policy.annual_working_hours);
            form.cycle_Monthly = String(policy.cycle_factors.Monthly);
            form.cycle_Weekly = String(policy.cycle_factors.Weekly);
            form.cycle_Daily = String(policy.cycle_factors.Daily);
            form.annual_cost_per_fte = String(policy.annual_cost_per_fte);
            form.currency = policy.currency;
        }

        const rangeHint = (limit) => `${limit.min}~${limit.max}`;
        const formatNumber = (n) => new Intl.NumberFormat('ko-KR').format(n);

        function validateInt(raw, limit) {
            const text = String(raw ?? '').trim();
            if (!text) return '값을 입력하세요.';
            const n = Number(text);
            if (!Number.isFinite(n) || !Number.isInteger(n)) return '정수를 입력하세요.';
            if (n < limit.min || n > limit.max) return `${limit.min}~${limit.max} 사이여야 합니다.`;
            return '';
        }

        const errors = computed(() => ({
            public_feedback_days: validateInt(form.public_feedback_days, L.public_feedback_days),
            feedback_alert_days: validateInt(form.feedback_alert_days, L.feedback_alert_days),
            stalled_days: validateInt(form.stalled_days, L.stalled_days),
            recycle_bin_retention_days: validateInt(form.recycle_bin_retention_days, L.recycle_bin_retention_days),
            annual_working_hours: validateInt(form.annual_working_hours, L.annual_working_hours),
            cycle_Monthly: validateInt(form.cycle_Monthly, L.cycle_Monthly),
            cycle_Weekly: validateInt(form.cycle_Weekly, L.cycle_Weekly),
            cycle_Daily: validateInt(form.cycle_Daily, L.cycle_Daily),
            annual_cost_per_fte: validateInt(form.annual_cost_per_fte, L.annual_cost_per_fte),
            currency: /^[A-Za-z]{3,8}$/.test(String(form.currency || '').trim()) ? '' : '통화 코드는 영문 3~8자입니다.'
        }));
        const errorFor = (key) => (errors.value[key] ? [errors.value[key]] : []);
        const hasErrors = computed(() => Object.values(errors.value).some(Boolean));

        function toPolicy() {
            return {
                public_feedback_days: Number(form.public_feedback_days),
                feedback_alert_days: Number(form.feedback_alert_days),
                stalled_days: Number(form.stalled_days),
                recycle_bin_retention_days: Number(form.recycle_bin_retention_days),
                annual_working_hours: Number(form.annual_working_hours),
                cycle_factors: { Monthly: Number(form.cycle_Monthly), Weekly: Number(form.cycle_Weekly), Daily: Number(form.cycle_Daily) },
                annual_cost_per_fte: Number(form.annual_cost_per_fte),
                currency: String(form.currency || '').trim().toUpperCase()
            };
        }

        async function save() {
            if (hasErrors.value) return;
            saving.value = true;
            feedback.value = '';
            try {
                const before = { ...tenantCustomization.policy, cycle_factors: { ...tenantCustomization.policy.cycle_factors } };
                const saved = await saveOperationPolicy(toPolicy());
                fillForm(saved);
                await adminStore.writeAdminAuditLog({
                    action: 'operation_policy_update',
                    target_type: 'system',
                    target_id: 'operation_policy',
                    target_name: '운영 정책',
                    before_value: before,
                    after_value: saved
                });
                feedbackOk.value = true;
                feedback.value = '저장했습니다.';
            } catch (e) {
                console.error('[OperationPolicySettings] save error:', e);
                feedbackOk.value = false;
                feedback.value = '저장에 실패했습니다.';
            } finally {
                saving.value = false;
            }
        }

        function resetToDefaults() {
            fillForm(D);
        }

        onMounted(async () => {
            await loadTenantCustomization();
            fillForm(tenantCustomization.policy);
        });

        return { D, L, form, saving, feedback, feedbackOk, usingDefault, rangeHint, formatNumber, errorFor, hasErrors, save, resetToDefaults };
    }
});
</script>

<style scoped>
/* SecuritySettings.vue 와 같은 섹션 카드 관례 */
.policy-wrapper {
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
.policy-wrapper > .page-header,
.policy-wrapper > .page-desc,
.policy-wrapper > .section-card {
    flex-shrink: 0;
}
.page-desc {
    margin: -8px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: #6b7280;
}
.section-card {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
}
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
.default-badge {
    background: #f3f4f6;
    color: #6b7280;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 4px;
}
.section-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
}
.section-desc {
    margin: 0;
    padding: 4px 0 12px;
    font-size: 12.5px;
    line-height: 1.6;
    color: #6b7280;
}
.section-desc code {
    font-size: 11.5px;
    background: #f3f4f6;
    padding: 1px 4px;
    border-radius: 4px;
}
.section-note {
    font-size: 12.5px;
}
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
.number-input--sm {
    width: 120px;
}
.number-input--lg {
    width: 220px;
}
.field-hint {
    font-size: 12px;
    color: #9ca3af;
}
.action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
}
.save-feedback {
    font-size: 12px;
    color: #6b7280;
}
.save-feedback--error {
    color: #dc2626;
}
</style>
