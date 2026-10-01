<template>
    <div class="term-wrapper">
        <div class="page-header pa-0">
            <div class="page-header-left">
                <h1 class="page-title">용어·분류 설정</h1>
            </div>
        </div>
        <p class="page-desc">
            제품 고유 용어(도메인/메가/메이저/서브, 0~4단계, 설계·구축·감시·제어)를 테넌트의 업무 체계에 맞게 바꿉니다.
            저장 즉시 화면에 반영되며, 값이 없으면 제품 기본값으로 동작합니다.
        </p>

        <!-- ===================== 1. 계층 레벨명 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-file-tree-outline</v-icon>
                <span class="section-title">계층 레벨명</span>
                <div v-if="usingDefault.terminology" class="default-badge">기본값 사용 중</div>
            </div>
            <div class="section-body">
                <p class="section-desc">체계도 범례·매트릭스·트리·잠금 범위·온톨로지 등 모든 화면이 이 이름을 씁니다.</p>
                <v-divider class="field-divider" />
                <div v-for="level in hierarchyLevels" :key="level.key" class="field-row">
                    <span class="field-label">{{ level.label }}</span>
                    <div class="number-input-wrap">
                        <v-text-field v-model="termForm.hierarchy[level.key]" :placeholder="level.placeholder" maxlength="30" variant="outlined" density="compact" hide-details="auto" class="text-input" />
                        <span class="field-hint">기본: {{ level.placeholder }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ===================== 2. 진행 단계 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-progress-check</v-icon>
                <span class="section-title">진행 단계명 · 색상</span>
            </div>
            <div class="section-body">
                <p class="section-desc">
                    체계도 집계 바·리뷰보드 칸반·대시보드·프로세스 배지가 같은 라벨과 색을 씁니다. 표시명은 집계·필터에, 짧은 이름은 칩·범례에 쓰입니다.
                </p>
                <table class="edit-table">
                    <thead>
                        <tr>
                            <th style="width: 140px">단계</th>
                            <th>표시명</th>
                            <th>짧은 이름</th>
                            <th style="width: 150px">색상</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="stage in stageRows" :key="stage.key">
                            <td class="text-medium-emphasis">{{ stage.title }}</td>
                            <td><v-text-field v-model="termForm.stages[stage.key].label" :placeholder="stage.def.label" maxlength="30" variant="outlined" density="compact" hide-details /></td>
                            <td><v-text-field v-model="termForm.stages[stage.key].shortLabel" :placeholder="stage.def.shortLabel" maxlength="30" variant="outlined" density="compact" hide-details /></td>
                            <td>
                                <div class="color-cell">
                                    <input type="color" :value="termForm.stages[stage.key].color || stage.def.color" class="color-swatch" @input="(e) => (termForm.stages[stage.key].color = e.target.value)" />
                                    <v-text-field v-model="termForm.stages[stage.key].color" :placeholder="stage.def.color" maxlength="7" variant="outlined" density="compact" hide-details class="color-text" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div class="action-row">
                    <span v-if="feedback.term" :class="feedbackClass(feedbackOk.term)">{{ feedback.term }}</span>
                    <v-btn variant="text" size="small" :disabled="saving.term" @click="resetTerminology">기본값으로</v-btn>
                    <v-btn color="primary" variant="flat" size="small" :loading="saving.term" @click="saveTerm">
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        용어 저장
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== 3. 프로세스 분류축 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-view-column-outline</v-icon>
                <span class="section-title">프로세스 분류축 (카드 보기 열)</span>
                <div v-if="usingDefault.process_classification" class="default-badge">기본값 사용 중</div>
            </div>
            <div class="section-body">
                <p class="section-desc">
                    체계도 카드 보기의 열입니다. 메이저 프로세스는 명시 분류값 → (ID 코드 순번) → 이름 키워드 순으로 열이 정해지고, 어디에도 맞지 않으면 폴백 열로 갑니다.
                    열 이동 시 <code>proc_map</code> 에는 라벨이 아니라 <strong>key</strong> 가 기록되므로 라벨을 바꿔도 데이터가 깨지지 않습니다.
                </p>
                <table class="edit-table">
                    <thead>
                        <tr>
                            <th style="width: 60px"></th>
                            <th style="width: 130px">key</th>
                            <th style="width: 140px">라벨</th>
                            <th style="width: 120px">색상</th>
                            <th style="width: 170px">아이콘 (mdi)</th>
                            <th>매칭 키워드 (쉼표 구분)</th>
                            <th style="width: 44px"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(col, idx) in classForm.columns" :key="idx">
                            <td>
                                <div class="order-btns">
                                    <button class="move-btn" :disabled="idx === 0" @click="moveColumn(idx, -1)"><v-icon size="14">mdi-arrow-up</v-icon></button>
                                    <button class="move-btn" :disabled="idx === classForm.columns.length - 1" @click="moveColumn(idx, 1)"><v-icon size="14">mdi-arrow-down</v-icon></button>
                                </div>
                            </td>
                            <td><v-text-field v-model="col.key" placeholder="비우면 라벨에서 생성" maxlength="32" variant="outlined" density="compact" hide-details /></td>
                            <td><v-text-field v-model="col.label" maxlength="30" variant="outlined" density="compact" hide-details /></td>
                            <td>
                                <div class="color-cell">
                                    <input type="color" :value="col.color || '#607D8B'" class="color-swatch" @input="(e) => (col.color = e.target.value)" />
                                </div>
                            </td>
                            <td>
                                <div class="d-flex align-center ga-1">
                                    <v-icon size="18" :color="col.color || '#607D8B'">{{ col.icon || 'mdi-view-column-outline' }}</v-icon>
                                    <v-text-field v-model="col.icon" placeholder="mdi-…" variant="outlined" density="compact" hide-details />
                                </div>
                            </td>
                            <td><v-text-field v-model="col.keywordsText" placeholder="예: 영업, sales" variant="outlined" density="compact" hide-details /></td>
                            <td><v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" :disabled="classForm.columns.length <= 1" @click="removeColumn(idx)" /></td>
                        </tr>
                    </tbody>
                </table>
                <div class="d-flex align-center ga-3 mt-2 flex-wrap">
                    <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addColumn">열 추가</v-btn>
                    <v-select v-model="classForm.fallback_key" :items="fallbackOptions" item-title="label" item-value="value" label="미매칭 폴백 열" variant="outlined" density="compact" hide-details style="max-width: 220px" />
                    <v-switch v-model="classForm.infer_stage_from_code" color="primary" density="compact" hide-details inset label="ID 코드(X.1, X.2…) 순번으로 열 추론" />
                </div>
                <v-divider class="field-divider mt-4" />
                <div class="field-row">
                    <span class="field-label">도메인 이름 추론</span>
                    <div class="number-input-wrap">
                        <v-switch v-model="classForm.infer_domain" color="primary" density="compact" hide-details inset :label="classForm.infer_domain ? '켜짐' : '꺼짐'" />
                        <span class="field-hint">
                            도메인이 명시되지 않은 메이저를 프로세스 이름·ID 에 포함된 도메인명으로 추론합니다. 고정 시드는 없으며 테넌트 도메인 목록만 근거로 씁니다.
                            끄면 명시 배정만 반영됩니다(추론 도메인 검토는 체계도 → 도메인 관리).
                        </span>
                    </div>
                </div>
                <div class="action-row">
                    <span v-if="feedback.cls" :class="feedbackClass(feedbackOk.cls)">{{ feedback.cls }}</span>
                    <v-btn variant="text" size="small" :disabled="saving.cls" @click="resetClassification">기본값으로</v-btn>
                    <v-btn variant="outlined" size="small" :loading="migrating" prepend-icon="mdi-database-sync-outline" @click="migrateStoredValues">저장된 분류 값을 key 로 변환</v-btn>
                    <v-btn color="primary" variant="flat" size="small" :loading="saving.cls" @click="saveCls">
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        분류축 저장
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- ===================== 4. 역할 표시 라벨 ===================== -->
        <div class="section-card">
            <div class="section-header">
                <v-icon class="section-icon" size="20">mdi-account-badge-outline</v-icon>
                <span class="section-title">역할 표시 라벨</span>
                <div v-if="usingDefault.role_labels" class="default-badge">기본값 사용 중</div>
            </div>
            <div class="section-body">
                <p class="section-desc">5개 역할의 표시명과 설명을 바꿉니다. 역할 자체(권한·추가/삭제)는 바뀌지 않습니다.</p>
                <table class="edit-table">
                    <thead>
                        <tr>
                            <th style="width: 120px">역할</th>
                            <th style="width: 200px">표시명</th>
                            <th>설명</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="role in roleRows" :key="role.key">
                            <td><code class="role-code">{{ role.key }}</code></td>
                            <td><v-text-field v-model="roleForm[role.key].label" :placeholder="role.def.label" maxlength="40" variant="outlined" density="compact" hide-details /></td>
                            <td><v-text-field v-model="roleForm[role.key].description" :placeholder="role.def.description" maxlength="300" variant="outlined" density="compact" hide-details /></td>
                        </tr>
                    </tbody>
                </table>
                <div class="action-row">
                    <span v-if="feedback.role" :class="feedbackClass(feedbackOk.role)">{{ feedback.role }}</span>
                    <v-btn variant="text" size="small" :disabled="saving.role" @click="resetRoles">기본값으로</v-btn>
                    <v-btn color="primary" variant="flat" size="small" :loading="saving.role" @click="saveRoles">
                        <v-icon size="16" start>mdi-content-save-outline</v-icon>
                        역할 라벨 저장
                    </v-btn>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
/**
 * 용어·분류 설정 (specs/010-tenant-terminology-policy US2·US3·US4·US6)
 *
 * 저장 위치는 configuration(terminology / process_classification / role_labels).
 * 실제 런타임 반영(i18n 병합, STAGE_DEFS, 분류 설정, ROLE_META)은 tenantCustomizationService 가 맡고,
 * 이 화면은 입력·검증·감사 로그만 한다.
 */
import { defineComponent, reactive, ref, computed, onMounted } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import BackendFactory from '@/components/api/BackendFactory';
import {
    DEFAULT_CLASSIFICATION,
    DEFAULT_HIERARCHY_TERMS,
    DEFAULT_STAGE_TERMS,
    HIERARCHY_LEVELS,
    STAGE_KEYS,
    migrateProcMapStageValues,
    normalizeClassification
} from '@/utils/tenantCustomizationCore';
import { ROLE_HIERARCHY, getDefaultRoleMeta } from '@/utils/roles';
import { loadTenantCustomization, saveTerminology, saveClassification, saveRoleLabels, tenantCustomization } from '@/services/tenantCustomizationService';

const HIERARCHY_TITLES = { domain: '1단계 (도메인)', mega: '2단계 (메가)', major: '3단계 (메이저)', sub: '4단계 (서브)' };
const STAGE_TITLES = {
    draft: '0단계',
    in_review: '1단계',
    public_feedback: '2단계',
    final_edit: '3단계',
    published: '4단계',
    wip: '차세대 기획 중',
    sunset: '폐기 예정'
};

export default defineComponent({
    name: 'TerminologySettings',

    setup() {
        const adminStore = useAdminConsoleStore();
        const usingDefault = computed(() => tenantCustomization.usingDefault);

        const saving = reactive({ term: false, cls: false, role: false });
        const feedback = reactive({ term: '', cls: '', role: '' });
        const feedbackOk = reactive({ term: true, cls: true, role: true });
        const feedbackClass = (ok) => (ok ? 'save-feedback' : 'save-feedback save-feedback--error');
        const migrating = ref(false);

        // ---- 용어 ----
        const hierarchyLevels = HIERARCHY_LEVELS.map((key) => ({ key, label: HIERARCHY_TITLES[key], placeholder: DEFAULT_HIERARCHY_TERMS[key] }));
        const stageRows = STAGE_KEYS.map((key) => ({ key, title: STAGE_TITLES[key], def: DEFAULT_STAGE_TERMS[key] }));
        const termForm = reactive({ hierarchy: {}, stages: {} });

        function fillTerm(term) {
            for (const level of HIERARCHY_LEVELS) {
                termForm.hierarchy[level] = term.hierarchy[level] !== DEFAULT_HIERARCHY_TERMS[level] ? term.hierarchy[level] : '';
            }
            for (const key of STAGE_KEYS) {
                const def = DEFAULT_STAGE_TERMS[key];
                const cur = term.stages[key];
                termForm.stages[key] = {
                    label: cur.label !== def.label ? cur.label : '',
                    shortLabel: cur.shortLabel !== def.shortLabel ? cur.shortLabel : '',
                    color: cur.color.toLowerCase() !== def.color.toLowerCase() ? cur.color : ''
                };
            }
        }

        function resetTerminology() {
            for (const level of HIERARCHY_LEVELS) termForm.hierarchy[level] = '';
            for (const key of STAGE_KEYS) termForm.stages[key] = { label: '', shortLabel: '', color: '' };
        }

        async function saveTerm() {
            saving.term = true;
            feedback.term = '';
            try {
                const before = JSON.parse(JSON.stringify(tenantCustomization.terminology));
                const saved = await saveTerminology({ hierarchy: { ...termForm.hierarchy }, stages: JSON.parse(JSON.stringify(termForm.stages)) });
                fillTerm(saved);
                await adminStore.writeAdminAuditLog({
                    action: 'terminology_update',
                    target_type: 'system',
                    target_id: 'terminology',
                    target_name: '용어 설정',
                    before_value: before,
                    after_value: saved
                });
                feedbackOk.term = true;
                feedback.term = '저장했습니다.';
            } catch (e) {
                console.error('[TerminologySettings] terminology save error:', e);
                feedbackOk.term = false;
                feedback.term = '저장에 실패했습니다.';
            } finally {
                saving.term = false;
            }
        }

        // ---- 분류축 ----
        const classForm = reactive({ columns: [], fallback_key: 'shared', infer_stage_from_code: true, infer_domain: true });

        function fillClassification(cfg) {
            classForm.columns = cfg.columns.map((c) => ({ key: c.key, label: c.label, color: c.color, icon: c.icon, keywordsText: (c.keywords || []).join(', ') }));
            classForm.fallback_key = cfg.fallback_key;
            classForm.infer_stage_from_code = cfg.infer_stage_from_code;
            classForm.infer_domain = cfg.infer_domain;
        }

        const fallbackOptions = computed(() =>
            classForm.columns.map((c) => ({ value: c.key || c.label, label: `${c.label || c.key || '(이름 없음)'} (${c.key || '자동'})` }))
        );

        function addColumn() {
            classForm.columns.push({ key: '', label: '', color: '#607D8B', icon: 'mdi-view-column-outline', keywordsText: '' });
        }
        function removeColumn(idx) {
            if (classForm.columns.length <= 1) return;
            classForm.columns.splice(idx, 1);
        }
        function moveColumn(idx, delta) {
            const next = idx + delta;
            if (next < 0 || next >= classForm.columns.length) return;
            const [moved] = classForm.columns.splice(idx, 1);
            classForm.columns.splice(next, 0, moved);
        }
        function resetClassification() {
            fillClassification(normalizeClassification(DEFAULT_CLASSIFICATION));
        }

        function toClassification() {
            return {
                columns: classForm.columns.map((c) => ({ key: c.key, label: c.label, color: c.color, icon: c.icon, keywords: c.keywordsText })),
                fallback_key: classForm.fallback_key,
                infer_stage_from_code: classForm.infer_stage_from_code,
                infer_domain: classForm.infer_domain
            };
        }

        async function saveCls() {
            saving.cls = true;
            feedback.cls = '';
            try {
                const before = JSON.parse(JSON.stringify(tenantCustomization.classification));
                const saved = await saveClassification(toClassification());
                fillClassification(saved);
                await adminStore.writeAdminAuditLog({
                    action: 'process_classification_update',
                    target_type: 'system',
                    target_id: 'process_classification',
                    target_name: '프로세스 분류축',
                    before_value: before,
                    after_value: saved
                });
                feedbackOk.cls = true;
                feedback.cls = '저장했습니다.';
            } catch (e) {
                console.error('[TerminologySettings] classification save error:', e);
                feedbackOk.cls = false;
                feedback.cls = '저장에 실패했습니다.';
            } finally {
                saving.cls = false;
            }
        }

        /** proc_map 에 라벨로 저장된 분류 값을 현재 열 key 로 일괄 변환 (읽기는 라벨도 허용하므로 선택 작업) */
        async function migrateStoredValues() {
            if (!window.confirm('프로세스 체계(proc_map)에 라벨로 저장된 분류 값을 현재 열 key 로 변환합니다. 계속할까요?')) return;
            migrating.value = true;
            feedback.cls = '';
            try {
                const backend = BackendFactory.createBackend();
                const map = await backend.getProcessDefinitionMap();
                const columns = normalizeClassification(toClassification()).columns;
                const changed = migrateProcMapStageValues(map, columns);
                if (changed > 0) {
                    await backend.putProcessDefinitionMap(map);
                }
                await adminStore.writeAdminAuditLog({
                    action: 'process_classification_migrate',
                    target_type: 'system',
                    target_id: 'proc_map',
                    target_name: '분류 값 key 변환',
                    after_value: { changed_fields: changed, columns: columns.map((c) => c.key) }
                });
                feedbackOk.cls = true;
                feedback.cls = changed > 0 ? `${changed}개 분류 값을 key 로 변환했습니다.` : '변환할 값이 없습니다(이미 key 로 저장됨).';
            } catch (e) {
                console.error('[TerminologySettings] migrate error:', e);
                feedbackOk.cls = false;
                feedback.cls = '변환에 실패했습니다.';
            } finally {
                migrating.value = false;
            }
        }

        // ---- 역할 라벨 ----
        const roleRows = ROLE_HIERARCHY.map((key) => ({ key, def: getDefaultRoleMeta(key) }));
        const roleForm = reactive(Object.fromEntries(ROLE_HIERARCHY.map((r) => [r, { label: '', description: '' }])));

        function fillRoles(labels) {
            for (const role of ROLE_HIERARCHY) {
                roleForm[role].label = labels?.[role]?.label || '';
                roleForm[role].description = labels?.[role]?.description || '';
            }
        }
        function resetRoles() {
            fillRoles({});
        }
        async function saveRoles() {
            saving.role = true;
            feedback.role = '';
            try {
                const before = JSON.parse(JSON.stringify(tenantCustomization.roleLabels));
                const saved = await saveRoleLabels(JSON.parse(JSON.stringify(roleForm)));
                fillRoles(saved);
                await adminStore.writeAdminAuditLog({
                    action: 'role_labels_update',
                    target_type: 'system',
                    target_id: 'role_labels',
                    target_name: '역할 표시 라벨',
                    before_value: before,
                    after_value: saved
                });
                feedbackOk.role = true;
                feedback.role = '저장했습니다.';
            } catch (e) {
                console.error('[TerminologySettings] role labels save error:', e);
                feedbackOk.role = false;
                feedback.role = '저장에 실패했습니다.';
            } finally {
                saving.role = false;
            }
        }

        onMounted(async () => {
            await loadTenantCustomization();
            fillTerm(tenantCustomization.terminology);
            fillClassification(tenantCustomization.classification);
            fillRoles(tenantCustomization.roleLabels);
        });

        return {
            usingDefault,
            saving,
            feedback,
            feedbackOk,
            feedbackClass,
            migrating,
            hierarchyLevels,
            stageRows,
            termForm,
            resetTerminology,
            saveTerm,
            classForm,
            fallbackOptions,
            addColumn,
            removeColumn,
            moveColumn,
            resetClassification,
            saveCls,
            migrateStoredValues,
            roleRows,
            roleForm,
            resetRoles,
            saveRoles
        };
    }
});
</script>

<style scoped>
/* SecuritySettings.vue 와 같은 섹션 카드 관례 */
.term-wrapper {
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
.term-wrapper > .page-header,
.term-wrapper > .page-desc,
.term-wrapper > .section-card {
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
.text-input {
    width: 260px;
    flex: 0 0 auto;
}
.field-hint {
    font-size: 12px;
    color: #9ca3af;
    max-width: 640px;
}
.edit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.edit-table th {
    text-align: left;
    font-size: 11.5px;
    font-weight: 600;
    color: #6b7280;
    padding: 6px 8px;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}
.edit-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
}
.color-cell {
    display: flex;
    align-items: center;
    gap: 6px;
}
.color-swatch {
    width: 32px;
    height: 32px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0;
    background: none;
    cursor: pointer;
}
.color-text {
    width: 100px;
}
.order-btns {
    display: flex;
    gap: 4px;
}
.move-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fff;
    color: #6b7280;
    cursor: pointer;
}
.move-btn:disabled {
    opacity: 0.35;
    cursor: default;
}
.role-code {
    font-size: 12px;
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
}
.action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding-top: 16px;
    flex-wrap: wrap;
}
.save-feedback {
    font-size: 12px;
    color: #6b7280;
}
.save-feedback--error {
    color: #dc2626;
}
</style>
