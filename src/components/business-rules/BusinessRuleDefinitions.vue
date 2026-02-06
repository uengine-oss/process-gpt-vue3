<template>
    <div class="br-def-page is-work-height">
        <!-- 상단 헤더(다른 정의 화면과 유사한 sticky toolbar 스타일) -->
        <v-card elevation="10" rounded="lg" class="br-page-header">
            <div class="br-page-title">
                <v-icon class="mr-2" color="primary" size="22">mdi-clipboard-text-outline</v-icon>
                <div>
                    <div class="br-title">{{ $t('businessRuleDefinition.title') }}</div>
                    <div class="br-subtitle text-medium-emphasis">{{ $t('businessRuleDefinition.subtitle') }}</div>
                </div>
            </div>
            <div class="br-page-actions">
                <v-btn color="primary" variant="flat" rounded class="rounded-pill" @click="startNewRule">
                    <v-icon start>mdi-plus</v-icon>
                    {{ $t('businessRuleDefinition.newRule') }}
                </v-btn>
            </div>
        </v-card>

        <v-row class="ma-0 pa-0 br-body-row" no-gutters>
            <!-- 목록 -->
            <v-col cols="4" class="pa-0 br-col" style="min-width: 320px; max-width: 420px;">
                <v-card elevation="10" rounded="lg" class="br-side-card">
                    <div class="br-side-header">
                        <div class="br-side-title">{{ $t('businessRuleDefinition.listTitle') }}</div>
                        <v-spacer />
                        <v-chip size="small" variant="tonal" color="primary">{{ filteredRules.length }}</v-chip>
                    </div>

                    <div class="br-side-search">
                        <v-text-field
                            v-model="search"
                            :label="$t('businessRuleDefinition.search')"
                            variant="outlined"
                            density="comfortable"
                            prepend-inner-icon="mdi-magnify"
                            hide-details
                        />
                    </div>

                    <div class="br-side-list">
                        <v-skeleton-loader
                            v-if="isLoading"
                            type="list-item-two-line, list-item-two-line, list-item-two-line"
                            class="mx-auto"
                        />
                        <template v-else>
                            <v-list density="comfortable" class="br-list">
                                <v-list-item
                                    v-for="rule in filteredRules"
                                    :key="rule.id"
                                    :active="selectedRuleId === rule.id"
                                    rounded="lg"
                                    class="br-list-item"
                                    @click="openRule(rule.id)"
                                >
                                    <template #prepend>
                                        <v-avatar size="28" color="primary" variant="tonal" class="mr-3">
                                            <v-icon size="16">mdi-table</v-icon>
                                        </v-avatar>
                                    </template>
                                    <v-list-item-title class="br-list-title">{{ rule.name }}</v-list-item-title>
                                    <v-list-item-subtitle v-if="rule.description" class="br-list-subtitle">
                                        {{ rule.description }}
                                    </v-list-item-subtitle>
                                    <template #append>
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="small"
                                            @click.stop="copyRule(rule.id)"
                                            class="mr-1"
                                        >
                                            <v-icon size="18">mdi-content-copy</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="small"
                                            @click.stop="confirmDeleteRule(rule.id, rule.name)"
                                        >
                                            <v-icon size="18">mdi-delete-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-list-item>
                            </v-list>
                            <div v-if="filteredRules.length === 0" class="br-empty text-medium-emphasis">
                                {{ $t('businessRuleDefinition.empty') }}
                            </div>
                        </template>
                    </div>
                </v-card>
            </v-col>

            <!-- 편집 -->
            <v-col class="pa-0 br-col" style="min-width: 520px;">
                <v-card elevation="10" rounded="lg" class="br-editor-card">
                    <!-- 편집 카드 상단 sticky 헤더 -->
                    <div class="br-editor-header">
                        <div class="br-editor-title">
                            <v-icon class="mr-2" color="primary" size="20">mdi-pencil-outline</v-icon>
                            <div>
                                <div class="br-editor-title-text">
                                    {{ isEditing ? (draft?.name || $t('businessRuleDefinition.editTitle')) : $t('businessRuleDefinition.editTitle') }}
                                </div>
                                <div class="br-editor-subtitle text-medium-emphasis">
                                    {{ isEditing ? $t('businessRuleDefinition.editSubtitle') : $t('businessRuleDefinition.selectHint') }}
                                </div>
                            </div>
                        </div>
                    <div class="br-editor-actions" v-if="isEditing">
                        <v-switch
                            v-model="isAdvancedMode"
                            :label="$t('businessRuleDefinition.advancedMode')"
                            color="primary"
                            density="compact"
                            hide-details
                            inset
                            class="mr-2"
                            @update:model-value="onToggleAdvancedMode"
                        />
                        <v-btn
                            v-if="isUEngineMode && draft?.id"
                            variant="text"
                            rounded
                            class="mr-2"
                            @click="openVersionManager"
                        >
                            <v-icon start>mdi-history</v-icon>
                            {{ $t('businessRuleDefinition.versionManagement') }}
                        </v-btn>
                        <v-btn
                            v-if="draft?.id"
                            variant="text"
                            rounded
                            class="mr-2"
                            @click="openTestRunner"
                        >
                            <v-icon start>mdi-play-circle-outline</v-icon>
                            테스트 실행
                        </v-btn>
                            <v-btn variant="text" rounded @click="cancelEdit">
                                {{ $t('businessRuleDefinition.cancel') }}
                            </v-btn>
                            <v-btn color="primary" variant="flat" rounded :disabled="!canSave" @click="saveRule">
                                {{ $t('businessRuleDefinition.save') }}
                            </v-btn>
                        </div>
                    </div>

                    <div class="br-editor-body">
                        <div v-if="isLoading" class="text-medium-emphasis">
                            {{ $t('businessRuleDefinition.loading') }}
                        </div>

                        <div v-else-if="!isEditing" class="br-editor-empty text-medium-emphasis">
                            <v-icon size="48" class="mb-2">mdi-arrow-left-circle-outline</v-icon>
                            <div style="font-weight: 700;">{{ $t('businessRuleDefinition.selectRuleHint') }}</div>
                            <div style="font-size: 13px;">또는 ‘새 규칙’으로 새로 만들 수 있어요.</div>
                        </div>

                        <div v-else class="br-editor-content" :class="{ 'br-advanced': isAdvancedMode }">
                            <!-- 1) 룰 기본 정보 -->
                            <div class="mb-4">
                                <div class="mb-2" style="font-weight: 700;">{{ $t('businessRuleDefinition.sectionBasic') }}</div>
                                <v-text-field
                                    v-model="draft.name"
                                    :label="$t('businessRuleDefinition.ruleName')"
                                    variant="outlined"
                                    density="comfortable"
                                    class="mb-2"
                                />
                                <v-textarea
                                    v-model="draft.description"
                                    :label="$t('businessRuleDefinition.ruleDescription')"
                                    variant="outlined"
                                    density="comfortable"
                                    rows="2"
                                    auto-grow
                                />
                            </div>

                            <v-divider class="my-4" />

                            <template v-if="!isAdvancedMode">
                                <!-- 2) 판단 항목 정의(메타 정보) -->
                                <div class="mb-4">
                                    <div class="mb-2" style="font-weight: 700;">{{ $t('businessRuleDefinition.sectionConditions') }}</div>
                                    <div class="text-medium-emphasis mb-3" style="font-size: 13px;">
                                        판단 항목은 “규칙 표에서 사용할 재료”를 정의하는 곳입니다. 실제 값 입력은 아래 규칙 표에서만 합니다.
                                    </div>

                                    <v-card variant="outlined" class="pa-3 mb-3">
                                        <!-- 엑셀(표) 형태: 입력 항목(열) 정의 -->
                                        <v-table class="excel-table" density="compact">
                                            <thead>
                                                <tr>
                                                    <th style="width: 56px;">#</th>
                                                    <th style="min-width: 260px;">{{ $t('businessRuleDefinition.itemName') }}</th>
                                                    <th style="width: 200px;">{{ $t('businessRuleDefinition.inputMode') }}</th>
                                                    <th style="min-width: 260px;">{{ $t('businessRuleDefinition.optionsLabel') }}</th>
                                                    <th style="width: 56px;"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="(i, idx) in draft.inputs" :key="i._rowId">
                                                    <td class="text-medium-emphasis" style="font-size: 12px;">{{ idx + 1 }}</td>
                                                    <td>
                                                        <v-text-field
                                                            v-model="i.label"
                                                            @blur="ensureInputKey(i)"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                            :placeholder="$t('businessRuleDefinition.itemNamePlaceholder')"
                                                        />
                                                    </td>
                                                    <td>
                                                        <v-select
                                                            v-model="i.inputMode"
                                                            :items="inputModeItems"
                                                            @update:model-value="onInputModeChanged(i)"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                    </td>
                                                    <td>
                                                        <v-combobox
                                                            v-if="i.inputMode === 'enum'"
                                                            v-model="i.options"
                                                            :items="i.options"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                            multiple
                                                            chips
                                                            closable-chips
                                                            placeholder="예: VIP, GOLD, SILVER"
                                                        />
                                                        <div v-else class="text-medium-emphasis" style="font-size: 12px; padding: 6px 0;">
                                                            -
                                                        </div>
                                                    </td>
                                                    <td class="text-right">
                                                        <v-btn icon variant="text" density="comfortable" @click="removeInput(idx)">
                                                            <v-icon>mdi-delete</v-icon>
                                                        </v-btn>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </v-table>

                                        <v-row class="ma-0 pa-0 mt-3 justify-end">
                                            <v-btn variant="outlined" rounded @click="addInput">
                                                {{ $t('businessRuleDefinition.addInput') }}
                                            </v-btn>
                                        </v-row>
                                    </v-card>
                                </div>

                                <v-divider class="my-4" />

                                <!-- 3) 규칙(조건 + 결과) 묶음: 규칙 추가 시 이 카드가 1개씩 늘어남 -->
                                <div class="mb-4">
                                    <div class="mb-2" style="font-weight: 700;">규칙</div>
                                    <div class="text-medium-emphasis mb-3" style="font-size: 13px;">
                                        위에 있는 규칙이 우선 적용됩니다.
                                    </div>

                                    <v-card
                                        v-for="(r, rIdx) in draft.rules"
                                        :key="r._rowId"
                                        variant="outlined"
                                        class="pa-3 mb-3"
                                        :class="{ 'br-rule-disabled': r.enabled === false }"
                                        :style="{ opacity: r.enabled !== false ? 1 : 0.6 }"
                                    >
                                        <v-row class="ma-0 pa-0 align-center mb-2">
                                            <div style="font-weight: 700;">{{ $t('businessRuleDefinition.ruleNumber', { n: rIdx + 1 }) }}</div>
                                            <v-spacer />
                                            <v-switch
                                                v-model="r.enabled"
                                                :label="$t('businessRuleDefinition.ruleEnabled')"
                                                color="primary"
                                                density="compact"
                                                hide-details
                                                inset
                                                class="mr-2"
                                                :true-value="true"
                                                :false-value="false"
                                            />
                                            <v-btn
                                                icon
                                                variant="text"
                                                density="comfortable"
                                                @click="removeRuleRow(rIdx)"
                                            >
                                                <v-icon>mdi-delete</v-icon>
                                            </v-btn>
                                        </v-row>

                                        <!-- 판단 기준 설정 (이 규칙의 조건들) -->
                                        <div class="mb-2" style="font-weight: 700;">{{ $t('businessRuleDefinition.conditionSettings') }}</div>
                                        <v-table class="excel-table" density="compact">
                                            <thead>
                                                <tr>
                                                    <th style="width: 56px;">#</th>
                                                    <th style="min-width: 220px;">{{ $t('businessRuleDefinition.conditionItem') }}</th>
                                                    <th style="width: 180px;">{{ $t('businessRuleDefinition.conditionOperator') }}</th>
                                                    <th style="min-width: 260px;">{{ $t('businessRuleDefinition.conditionValue') }}</th>
                                                    <th style="width: 56px;"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="(c, cIdx) in r.conditions" :key="`cond_${r._rowId}_${cIdx}`">
                                                    <td class="text-medium-emphasis" style="font-size: 12px;">{{ cIdx + 1 }}</td>
                                                    <td>
                                                        <v-select
                                                            v-model="c.key"
                                                            :items="inputSelectItems()"
                                                            item-title="title"
                                                            item-value="value"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                            @update:model-value="onRuleConditionKeyChanged(r, c)"
                                                        />
                                                    </td>
                                                    <td>
                                                        <v-select
                                                            v-model="c.operator"
                                                            :items="operatorItemsForInputKey(c.key)"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                    </td>
                                                    <td>
                                                        <v-text-field
                                                            v-if="inputModeByKey(c.key) === 'number'"
                                                            v-model="c.value"
                                                            type="number"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-select
                                                            v-else-if="inputModeByKey(c.key) === 'boolean'"
                                                            v-model="c.value"
                                                            :items="booleanValueItems"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-select
                                                            v-else-if="inputModeByKey(c.key) === 'enum'"
                                                            v-model="c.value"
                                                            :items="enumValueItemsByKey(c.key)"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-text-field
                                                            v-else-if="inputModeByKey(c.key) === 'date'"
                                                            v-model="c.value"
                                                            type="date"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-text-field
                                                            v-else-if="inputModeByKey(c.key) === 'time'"
                                                            v-model="c.value"
                                                            type="time"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-text-field
                                                            v-else-if="inputModeByKey(c.key) === 'dateTime'"
                                                            v-model="c.value"
                                                            type="datetime-local"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                        <v-text-field
                                                            v-else
                                                            v-model="c.value"
                                                            variant="underlined"
                                                            density="compact"
                                                            hide-details
                                                        />
                                                    </td>
                                                    <td class="text-right">
                                                        <v-btn icon variant="text" density="comfortable" @click="removeRuleCondition(r, cIdx)">
                                                            <v-icon>mdi-delete</v-icon>
                                                        </v-btn>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </v-table>
                                        <v-row class="ma-0 pa-0 mt-3 justify-end">
                                            <v-btn variant="outlined" rounded @click="addRuleCondition(r)">{{ $t('businessRuleDefinition.addCondition') }}</v-btn>
                                        </v-row>

                                        <v-divider class="my-4" />

                                        <!-- 결과 설정 -->
                                        <div class="mb-2" style="font-weight: 700;">{{ $t('businessRuleDefinition.resultSettings') }}</div>
                                        <v-row class="ma-0 pa-0" style="gap: 12px;">
                                            <v-col class="pa-0" cols="3" style="min-width: 220px;">
                                                <v-select
                                                    v-model="r.result.outcome"
                                                    :items="outcomeItems"
                                                    variant="outlined"
                                                    density="comfortable"
                                                    hide-details
                                                />
                                            </v-col>
                                            <v-col class="pa-0">
                                                <v-text-field
                                                    v-model="r.result.note"
                                                    variant="outlined"
                                                    density="comfortable"
                                                    hide-details
                                                    :placeholder="$t('businessRuleDefinition.notePlaceholder')"
                                                />
                                            </v-col>
                                        </v-row>
                                    </v-card>

                                    <v-row class="ma-0 pa-0 mt-2 justify-end">
                                        <v-btn variant="outlined" rounded @click="addRuleRow">{{ $t('businessRuleDefinition.addRule') }}</v-btn>
                                    </v-row>
                                </div>
                            </template>

                            <template v-else>
                                <div class="mb-2" style="font-weight: 700;">{{ $t('businessRuleDefinition.dmnAdvancedEdit') }}</div>
                                <div class="text-medium-emphasis mb-3" style="font-size: 13px;">
                                    {{ $t('businessRuleDefinition.dmnAdvancedDescription') }}
                                </div>
                                <v-card variant="outlined" class="pa-2 br-dmn-card">
                                    <DmnModeler
                                        ref="dmnEditor"
                                        :dmn="draft.dmnXml"
                                        :isViewMode="false"
                                        :key="dmnRenderKey"
                                    />
                                </v-card>
                            </template>

                            <!-- 4) 저장/취소 -->
                            <!-- 하단 버튼은 상단 헤더로 이동(정의 편집 화면 공통 UX) -->
                        </div>
                    </div>
                </v-card>
            </v-col>
        </v-row>
        
        <!-- 버전 관리 다이얼로그 (UEngine 모드 전용) -->
        <business-rule-version-manager
            v-if="showVersionManager && isUEngineMode && draft?.id"
            :rule-id="draft?.id"
            :rule-name="draft?.name"
            @close="showVersionManager = false"
            @versionChanged="handleVersionChanged"
        />

        <!-- 테스트 실행기 다이얼로그 -->
        <business-rule-test-runner
            v-model="showTestRunner"
            :rule-id="draft?.id"
            :rule-name="draft?.name"
            @close="showTestRunner = false"
        />

        <!-- 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="500" persistent>
            <v-card>
                <v-card-title class="text-h6">{{ $t('businessRuleDefinition.deleteConfirmTitle') }}</v-card-title>
                <v-card-text>
                    <div class="mb-2">{{ $t('businessRuleDefinition.deleteConfirmMessage', { name: ruleToDelete?.name || '' }) }}</div>
                    <div class="text-medium-emphasis" style="font-size: 13px;">
                        {{ $t('businessRuleDefinition.deleteConfirmHint') }}
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialog = false">
                        {{ $t('businessRuleDefinition.cancel') }}
                    </v-btn>
                    <v-btn color="error" variant="flat" @click="deleteRule">
                        {{ $t('businessRuleDefinition.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 복사 다이얼로그 -->
        <v-dialog v-model="copyDialog" max-width="500" persistent>
            <v-card>
                <v-card-title class="text-h6">{{ $t('businessRuleDefinition.copyTitle') }}</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="copiedRuleName"
                        :label="$t('businessRuleDefinition.copyRuleNameLabel')"
                        variant="outlined"
                        density="comfortable"
                        :placeholder="$t('businessRuleDefinition.copyRuleNamePlaceholder')"
                        autofocus
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="copyDialog = false; copiedRuleName = ''">
                        {{ $t('businessRuleDefinition.cancel') }}
                    </v-btn>
                    <v-btn 
                        color="primary" 
                        variant="flat" 
                        :disabled="!copiedRuleName || !copiedRuleName.trim()"
                        @click="executeCopyRule"
                    >
                        {{ $t('businessRuleDefinition.copy') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DmnModeler from '@/components/DmnModeler.vue';
import { businessRuleToDmnXml, dmnXmlToBusinessRule } from '@/utils/businessRuleDmn';
import BusinessRuleVersionManager from './BusinessRuleVersionManager.vue';
import BusinessRuleTestRunner from './BusinessRuleTestRunner.vue';

export default {
    name: 'business-rule-definitions',
    components: { 
        DmnModeler,
        BusinessRuleVersionManager,
        BusinessRuleTestRunner
    },
    data() {
        return {
            backend: null,
            isLoading: false,
            rules: [],
            search: '',
            selectedRuleId: null,
            isEditing: false,
            draft: null,
            isAdvancedMode: false,
            dmnRenderKey: 0,
            // 고급 모드 왕복 시 입력 손실 방지용 스냅샷
            advancedEnterSnapshot: null, // { inputs, rules }
            advancedEnterDmnXml: '',
            // 마지막으로 테이블(inputs/rules)과 dmnXml이 동기화됐던 시점의 시그니처
            lastTableSignature: '',
            inputModeItems: [
                { title: '숫자 입력', value: 'number' },
                { title: '예/아니오', value: 'boolean' },
                { title: '선택지', value: 'enum' },
                { title: '날짜', value: 'date' },
                { title: '시간', value: 'time' },
                { title: '날짜+시간', value: 'dateTime' },
                { title: '기간(일/시간)', value: 'dayTimeDuration' },
                { title: '기간(년/월)', value: 'yearMonthDuration' },
                { title: 'Any', value: 'any' }
            ],
            outcomeItems: [
                { title: '승인', value: 'approve' },
                { title: '조건부 승인', value: 'conditional' },
                { title: '거절', value: 'reject' }
            ],
            booleanValueItems: [
                { title: '예', value: true },
                { title: '아니오', value: false }
            ],
            showVersionManager: false,
            showTestRunner: false,
            deleteDialog: false,
            ruleToDelete: null,
            copyDialog: false,
            ruleToCopy: null,
            copiedRuleName: ''
        };
    },
    computed: {
        filteredRules() {
            const q = String(this.search || '').trim().toLowerCase();
            if (!q) return this.rules;
            return this.rules.filter((r) => String(r.name || '').toLowerCase().includes(q));
        },
        canSave() {
            if (!this.draft) return false;
            if (!this.draft.name || String(this.draft.name).trim().length === 0) return false;
            if (!Array.isArray(this.draft.inputs) || this.draft.inputs.length === 0) return false;
            if (!Array.isArray(this.draft.rules) || this.draft.rules.length === 0) return false;
            return true;
        },
        isUEngineMode() {
            return window.$mode === 'uEngine';
        }
    },
    async created() {
        this.backend = BackendFactory.createBackend();
        await this.refreshList();

        await this.handleDeepLink();
    },
    watch: {
        // 새로고침/직접 URL 입력(/business-rule/new)도 동일하게 동작하도록 path 기반으로 감지
        '$route.fullPath': {
            async handler() {
                await this.handleDeepLink();
            }
        },
        // 기본 모드에서 표를 편집하면 dmnXml을 "자동"으로 최신화한다.
        // (dmnXml이 단일 진실 source)
        draft: {
            deep: true,
            handler() {
                if (!this.draft) return;
                if (!this.isEditing) return;
                if (this.isAdvancedMode) return; // 고급 모드에서는 모델러가 dmnXml을 직접 편집한다.
                if (this.__isApplyingDmnToTable) return;

                const sig = this.computeTableSignature();
                if (sig === this.lastTableSignature) return;
                this.lastTableSignature = sig;

                clearTimeout(this.__dmnSyncTimer);
                this.__dmnSyncTimer = setTimeout(() => {
                    // 표(입력/규칙/결과) -> dmnXml 최신화
                    this.syncDraftTableToDmnXml();
                }, 80);
            }
        }
    },
    methods: {
        __dmnSyncTimer: null,
        __isApplyingDmnToTable: false,
        computeTableSignature() {
            // 테이블 변경 여부를 감지하기 위한 "안정적인" 시그니처
            const inputs = Array.isArray(this.draft?.inputs) ? this.draft.inputs : [];
            const rules = Array.isArray(this.draft?.rules) ? this.draft.rules : [];
            const payload = {
                inputs: inputs.map((i) => ({
                    label: i?.label ?? '',
                    key: i?.key ?? '',
                    inputMode: i?.inputMode ?? '',
                    options: Array.isArray(i?.options) ? i.options : []
                })),
                rules: rules.map((r) => ({
                    conditions: Array.isArray(r?.conditions) ? r.conditions.map((c) => ({
                        key: c?.key ?? '',
                        operator: c?.operator ?? '',
                        value: c?.value ?? ''
                    })) : [],
                    result: {
                        outcome: r?.result?.outcome ?? '',
                        note: r?.result?.note ?? ''
                    },
                    enabled: r?.enabled !== undefined ? r.enabled : true
                }))
            };
            try {
                return JSON.stringify(payload);
            } catch (e) {
                return String(Date.now());
            }
        },
        syncLastTableSignature() {
            this.lastTableSignature = this.computeTableSignature();
        },
        shouldRegenerateDmnFromTable() {
            // 테이블이 마지막 동기화 이후 바뀌었을 때만 테이블->DMN 재생성
            const sig = this.computeTableSignature();
            return !this.lastTableSignature || sig !== this.lastTableSignature;
        },
        bumpDmnRenderKey() {
            this.dmnRenderKey += 1;
        },
        async onToggleAdvancedMode(next) {
            const enabled = Boolean(next);
            if (!this.draft) {
                this.isAdvancedMode = false;
                return;
            }

            if (enabled) {
                // 기본 모드에서는 watch가 dmnXml을 자동 최신화한다.
                // 고급 모드로 들어갈 때는 dmnXml을 "덮어쓰지 않고" 그대로 모델러에 전달한다.
                this.isAdvancedMode = true;
                this.bumpDmnRenderKey();
                await this.$nextTick();
                this.openDecisionTableViewIfPossible();
                return;
            }

            // 고급 모드 → 기본 모드:
            // dmnXml이 단일 진실이므로, 현재 모델러 XML을 가져와서 dmnXml 갱신 후 표를 재구성한다.
                const currentXml = String(await this.getDmnXmlFromEditorOrDraft() || '').trim();
                if (!currentXml) {
                    // 저장할 수 없는 상태면 모드 전환을 막는다(입력 손실 방지)
                    this.notifyWarning(this.$t('businessRuleDefinition.advancedModeLoadFailed'));
                    this.isAdvancedMode = true;
                    return;
                }
                const ok = await this.syncFromDmnEditorToDraft();
                if (!ok) {
                    // 동기화 실패 시 모드 전환을 막는다(적용 안됨/날아감 방지)
                    this.notifyWarning(this.$t('businessRuleDefinition.advancedModeSyncFailed'));
                    this.isAdvancedMode = true;
                    return;
                }
            this.isAdvancedMode = false;
            this.advancedEnterSnapshot = null;
            this.advancedEnterDmnXml = '';
        },
        ensureDraftDmnXml() {
            if (!this.draft) return;
            const existing = typeof this.draft.dmnXml === 'string' ? this.draft.dmnXml.trim() : '';
            if (existing) return;
            try {
                this.draft.dmnXml = businessRuleToDmnXml({
                    id: this.draft.id,
                    name: this.draft.name,
                    description: this.draft.description,
                    inputs: this.draft.inputs || [],
                    rules: this.draft.rules || []
                });
            } catch (e) {
                this.draft.dmnXml = '';
            }
        },
        syncDraftTableToDmnXml() {
            // inputs/rules(테이블) -> dmnXml 최신화
            if (!this.draft) return;
            try {
                this.draft.dmnXml = businessRuleToDmnXml({
                    id: this.draft.id,
                    name: this.draft.name,
                    description: this.draft.description,
                    inputs: this.draft.inputs || [],
                    rules: this.draft.rules || []
                });
            } catch (e) {
                // 실패 시 기존값 유지(사용자 입력 손실 방지)
            }
        },
        async syncFromDmnEditorToDraft() {
            if (!this.draft) return false;
            // DMN이 바뀐 경우에도, DMN에 표현되지 않는 UI 메타(예: enum options)는
            // 가능한 범위에서 기존 값을 유지한다.
            const prevInputs = Array.isArray(this.draft.inputs) ? this.draft.inputs : [];
            const prevByKey = new Map(prevInputs.map((i) => [String(i?.key || '').trim(), i]));

            const xml = await this.getDmnXmlFromEditorOrDraft();
            if (!xml) return false;
            this.draft.dmnXml = xml;
            const parsed = dmnXmlToBusinessRule(xml);
            if (!parsed) return false;

            // DMN → 테이블(입력항목/규칙)로 동기화
            if (Array.isArray(parsed.inputs) && parsed.inputs.length > 0) {
                this.draft.inputs = parsed.inputs.map((i) => ({
                    _rowId: String(Date.now() + Math.random()),
                    label: i.label ?? '',
                    key: i.key ?? i.item ?? '',
                    inputMode: i.inputMode ?? 'number',
                    options: (() => {
                        const next = Array.isArray(i.options) ? i.options : [];
                        if (next.length > 0) return next;
                        const k = String(i.key ?? i.item ?? '').trim();
                        const prev = prevByKey.get(k);
                        return Array.isArray(prev?.options) ? prev.options : [];
                    })()
                }));
            }
            if (Array.isArray(parsed.rules) && parsed.rules.length > 0) {
                this.draft.rules = parsed.rules.map((r) => ({
                    _rowId: String(Date.now() + Math.random()),
                    conditions: Array.isArray(r.conditions) ? r.conditions.map((c) => ({
                        key: c?.key ?? c?.item ?? '',
                        operator: c?.operator ?? 'eq',
                        value: c?.value ?? ''
                    })) : [{ key: '', operator: 'eq', value: '' }],
                    result: {
                        outcome: r?.result?.outcome ?? 'approve',
                        note: typeof r?.result?.note === 'string' ? r.result.note : ''
                    },
                    enabled: r?.enabled !== undefined ? r.enabled : true
                }));
            }
            this.normalizeDraft();
            return true;
        },
        async getDmnXmlFromEditorOrDraft() {
            // editor가 떠 있으면 editor 기준, 아니면 draft 기준
            try {
                const ref = this.$refs?.dmnEditor;
                if (ref && typeof ref.saveDMN === 'function') {
                    const xml = await ref.saveDMN();
                    return typeof xml === 'string' ? xml : '';
                }
            } catch (e) {
                // ignore and fallback to draft
            }
            return typeof this.draft?.dmnXml === 'string' ? this.draft.dmnXml : '';
        },
        openDecisionTableViewIfPossible() {
            try {
                const ref = this.$refs?.dmnEditor;
                if (!ref || typeof ref.getViews !== 'function' || typeof ref.openView !== 'function') return;
                const views = ref.getViews();
                const v = Array.isArray(views) ? views.find((x) => x && (x.type === 'decisionTable' || x.type === 'decision-table')) : null;
                if (v) ref.openView(v);
            } catch (e) {
                // ignore
            }
        },
        inputSelectItems() {
            const inputs = Array.isArray(this.draft?.inputs) ? this.draft.inputs : [];
            return inputs
                .map((i) => ({
                    title: String(i?.label || '').trim() || '항목',
                    value: String(i?.key || '').trim()
                }))
                .filter((x) => x.value);
        },
        inputByKey(key) {
            const k = String(key || '').trim();
            const inputs = Array.isArray(this.draft?.inputs) ? this.draft.inputs : [];
            return inputs.find((i) => String(i?.key || '').trim() === k) || null;
        },
        inputModeByKey(key) {
            return String(this.inputByKey(key)?.inputMode || '');
        },
        enumValueItemsByKey(key) {
            const inp = this.inputByKey(key);
            const opts = Array.isArray(inp?.options) ? inp.options : [];
            return opts.map((o) => ({ title: String(o), value: String(o) }));
        },
        operatorItemsForInputKey(key) {
            const inp = this.inputByKey(key);
            return this.operatorItemsForInput(inp);
        },
        onRuleConditionKeyChanged(ruleRow, cond) {
            if (!ruleRow || !cond) return;
            // 입력 방식에 따라 기본 연산자 보정
            const inp = this.inputByKey(cond.key);
            const allowed = this.operatorItemsForInput(inp).map((x) => x.value);
            if (!allowed.includes(cond.operator)) {
                cond.operator = this.defaultOperatorForInput(inp);
            }
            // 값 초기화(입력 방식 바뀌면 기존 값이 의미가 없을 수 있음)
            cond.value = '';
        },
        addRuleCondition(ruleRow) {
            if (!ruleRow) return;
            if (!Array.isArray(ruleRow.conditions)) ruleRow.conditions = [];
            const firstKey = this.inputSelectItems()[0]?.value || '';
            const inp = this.inputByKey(firstKey);
            ruleRow.conditions.push({
                key: firstKey,
                operator: this.defaultOperatorForInput(inp),
                value: ''
            });
        },
        removeRuleCondition(ruleRow, idx) {
            if (!ruleRow || !Array.isArray(ruleRow.conditions)) return;
            // 첫 번째 조건은 삭제 대신 내용만 비움(기존 요구사항 유지)
            if (idx === 0) {
                const first = ruleRow.conditions[0];
                if (!first) return;
                first.key = first.key || '';
                const inp = this.inputByKey(first.key);
                first.operator = this.defaultOperatorForInput(inp);
                first.value = '';
                return;
            }
            ruleRow.conditions.splice(idx, 1);
        },
        coerceConditionValue(operator, value) {
            // 입력 위젯은 입력 방식에 따라 달라질 수 있어 값 타입을 안전하게 보정한다.
            const op = String(operator || '');
            const raw = typeof value === 'string' ? value.trim() : value;

            // 숫자 비교는 number로 저장(권장)
            if ((op === 'gte' || op === 'lte') && typeof raw === 'string' && raw.length > 0) {
                const isNum = /^-?\d+(\.\d+)?$/.test(raw);
                if (isNum) return Number(raw);
            }

            // boolean은 true/false로 유지
            if (typeof raw === 'boolean') return raw;

            return value;
        },
        async handleDeepLink() {
            // deep-link 지원:
            // - /business-rule/new (route param이 없을 수 있음)
            // - /business-rule/:ruleId
            const path = String(this.$route?.path || '');
            const ruleId = this.$route?.params?.ruleId;
            const isNew = path === '/business-rule/new' || ruleId === 'new';

            if (isNew) {
                this.startNewRule();
                return;
            }
            if (ruleId) {
                await this.openRule(ruleId);
            }
        },
        notifyWarning(message) {
            // 공통 토스트/알럿 사용(기술용어 금지)
            if (this.$try) {
                this.$try({ context: this, action: async () => {}, warningMsg: message });
            } else if (window.$app_) {
                window.$app_.snackbarMessage = message;
                window.$app_.snackbarColor = 'warning';
                window.$app_.snackbar = true;
            } else {
                // 최후 fallback
                alert(message);
            }
        },
        emptyDraft() {
            return {
                id: null,
                name: '',
                description: '',
                inputs: [
                    { _rowId: String(Date.now()), label: '', key: '', inputMode: 'number', options: [] }
                ],
                rules: [
                    {
                        _rowId: String(Date.now() + 1),
                        conditions: [{ key: '', operator: 'eq', value: '' }],
                        result: { outcome: 'approve', note: '' }
                    }
                ],
                dmnXml: ''
            };
        },
        async refreshList() {
            this.isLoading = true;
            try {
                const list = await this.backend.listBusinessRules();
                this.rules = Array.isArray(list) ? list : [];
            } catch (e) {
                this.rules = [];
                this.notifyWarning(this.$t('businessRuleDefinition.loadFailed'));
            } finally {
                this.isLoading = false;
            }
        },
        async openRule(ruleId) {
            this.isLoading = true;
            try {
                const rule = await this.backend.getBusinessRule(ruleId);
                if (!rule) {
                    this.notifyWarning(this.$t('businessRuleDefinition.notFound'));
                    return;
                }
                this.selectedRuleId = rule.id;
                this.draft = JSON.parse(JSON.stringify(rule));
                this.isAdvancedMode = false;
                this.bumpDmnRenderKey();
                this.normalizeDraft();
                this.isEditing = true;
                if (this.$route.params.ruleId !== ruleId) {
                    this.$router.replace(`/business-rule/${ruleId}`);
                }
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleDefinition.loadFailed'));
            } finally {
                this.isLoading = false;
            }
        },
        startNewRule() {
            this.selectedRuleId = null;
            this.draft = this.emptyDraft();
            this.normalizeDraft();
            this.isEditing = true;
            this.isAdvancedMode = false;
            this.bumpDmnRenderKey();
            if (this.$route.params.ruleId !== 'new') {
                this.$router.replace('/business-rule/new');
            }
        },
        normalizeDraft() {
            if (!this.draft) return;

            if (!Array.isArray(this.draft.inputs) || this.draft.inputs.length === 0) {
                this.draft.inputs = [{ _rowId: String(Date.now()), label: '', key: '', inputMode: 'number', options: [] }];
            } else {
                this.draft.inputs = this.draft.inputs.map((i) => ({
                    _rowId: i._rowId || String(Math.random()),
                    label: i.label ?? (i.item ?? ''), // 과거 데이터 호환
                    key: i.key ?? (i.item ?? ''), // 과거 데이터 호환
                    inputMode: i.inputMode ?? 'number',
                    options: Array.isArray(i.options) ? i.options : []
                }));
            }

            // key 자동 보정(화면 비노출)
            this.draft.inputs.forEach((i) => this.ensureInputKey(i));

            if (!Array.isArray(this.draft.rules) || this.draft.rules.length === 0) {
                this.draft.rules = [{ 
                    _rowId: String(Date.now() + 1), 
                    conditions: [{ key: '', operator: 'eq', value: '' }], 
                    result: { outcome: 'approve', note: '' },
                    enabled: true
                }];
            } else {
                this.draft.rules = this.draft.rules.map((r) => ({
                    _rowId: r._rowId || String(Math.random()),
                    conditions: Array.isArray(r.conditions) ? r.conditions.map((c) => ({
                        key: c?.key ?? c?.item ?? '',
                        operator: c?.operator ?? 'eq',
                        value: c?.value ?? ''
                    })) : [{ key: '', operator: 'eq', value: '' }],
                    result: {
                        outcome: r?.result?.outcome ?? 'approve',
                        note: typeof r?.result?.note === 'string' ? r.result.note : ''
                    },
                    enabled: r?.enabled !== undefined ? r.enabled : true
                }));
            }
            // 각 규칙행: 최소 1개의 조건 보장
            this.draft.rules.forEach((r) => {
                if (!Array.isArray(r.conditions) || r.conditions.length === 0) {
                    r.conditions = [{ key: '', operator: 'eq', value: '' }];
                }
            });

            // dmnXml이 단일 진실(source)이다.
            // - dmnXml이 있으면: dmnXml -> 표(입력/규칙)로 재구성(표는 UI용)
            // - dmnXml이 없으면: 현재 표를 기준으로 dmnXml 생성(부트스트랩)
            if (typeof this.draft.dmnXml !== 'string') this.draft.dmnXml = '';
            const xml = String(this.draft.dmnXml || '').trim();
            if (xml) {
                this.__isApplyingDmnToTable = true;
                try {
                    const parsed = dmnXmlToBusinessRule(xml);
                    if (parsed) {
                        // enum options 같은 UI 메타는 가능한 범위에서 유지
                        const prevInputs = Array.isArray(this.draft.inputs) ? this.draft.inputs : [];
                        const prevByKey = new Map(prevInputs.map((i) => [String(i?.key || '').trim(), i]));

                        if (Array.isArray(parsed.inputs) && parsed.inputs.length > 0) {
                            this.draft.inputs = parsed.inputs.map((i) => {
                                const k = String(i.key ?? i.item ?? '').trim();
                                const prev = prevByKey.get(k);
                                return {
                                    _rowId: String(Date.now() + Math.random()),
                                    label: i.label ?? '',
                                    key: i.key ?? i.item ?? '',
                                    inputMode: i.inputMode ?? 'number',
                                    options: Array.isArray(prev?.options) ? prev.options : []
                                };
                            });
                        }
                        if (Array.isArray(parsed.rules) && parsed.rules.length > 0) {
                            this.draft.rules = parsed.rules.map((r) => ({
                                _rowId: String(Date.now() + Math.random()),
                                conditions: Array.isArray(r.conditions)
                                    ? r.conditions.map((c) => ({
                                          key: c?.key ?? c?.item ?? '',
                                          operator: c?.operator ?? 'eq',
                                          value: c?.value ?? ''
                                      }))
                                    : [{ key: '', operator: 'eq', value: '' }],
                                result: {
                                    outcome: r?.result?.outcome ?? 'approve',
                                    note: typeof r?.result?.note === 'string' ? r.result.note : ''
                                },
                                enabled: r?.enabled !== undefined ? r.enabled : true
                            }));
                        }
                    }
                } finally {
                    this.__isApplyingDmnToTable = false;
                }
            } else {
                this.ensureDraftDmnXml();
            }
            // 동기화 기준 시그니처 업데이트(무한 루프 방지)
            this.lastTableSignature = this.computeTableSignature();
        },
        defaultOperatorForInput(inp) {
            const mode = String(inp?.inputMode || 'number');
            if (mode === 'number') return 'gte';
            if (mode === 'boolean') return 'eq';
            if (mode === 'enum') return 'eq';
            if (mode === 'date') return 'after';
            if (mode === 'time') return 'after';
            if (mode === 'dateTime') return 'after';
            if (mode === 'dayTimeDuration') return 'gte';
            if (mode === 'yearMonthDuration') return 'gte';
            if (mode === 'any') return 'eq';
            return 'eq';
        },
        operatorItemsForInput(inp) {
            const mode = String(inp?.inputMode || 'number');
            if (mode === 'number') return [
                { title: '이상', value: 'gte' },
                { title: '이하', value: 'lte' },
                { title: '같다', value: 'eq' }
            ];
            if (mode === 'boolean') return [
                { title: '같다', value: 'eq' }
            ];
            if (mode === 'enum') return [
                { title: '같다', value: 'eq' },
                { title: '포함', value: 'contains' }
            ];
            if (mode === 'date') return [
                { title: '이전', value: 'before' },
                { title: '이후', value: 'after' },
                { title: '같다', value: 'eq' }
            ];
            if (mode === 'time' || mode === 'dateTime') return [
                { title: '이전', value: 'before' },
                { title: '이후', value: 'after' },
                { title: '같다', value: 'eq' }
            ];
            if (mode === 'dayTimeDuration' || mode === 'yearMonthDuration') return [
                { title: '이상', value: 'gte' },
                { title: '이하', value: 'lte' },
                { title: '같다', value: 'eq' }
            ];
            if (mode === 'any') return [
                { title: '같다', value: 'eq' }
            ];
            return [{ title: '같다', value: 'eq' }];
        },
        enumValueItems(inp) {
            const opts = Array.isArray(inp?.options) ? inp.options : [];
            return opts.map((o) => ({ title: String(o), value: String(o) }));
        },
        makeInternalKey(label) {
            const raw = String(label || '').trim();
            const s = raw
                .replace(/[^a-zA-Z0-9가-힣]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '');
            return s || '';
        },
        ensureInputKey(inp) {
            if (!inp) return;
            const label = String(inp.label || '').trim();
            const current = String(inp.key || '').trim();
            if (current) return;
            const next = this.makeInternalKey(label);
            inp.key = next || `key_${String(inp._rowId || Math.random()).replace(/[^a-zA-Z0-9]+/g, '')}`;
        },
        onInputModeChanged(inp) {
            // 입력 방식 변경 → 규칙 표의 값 입력 UI/허용 연산자에 즉시 반영
            if (!this.draft || !Array.isArray(this.draft.rules)) return;
            // 각 규칙의 조건들 중 해당 key를 쓰는 조건은 연산자/값을 보정
            const key = String(inp?.key || '').trim();
            if (!key) return;
            const allowed = this.operatorItemsForInput(inp).map((x) => x.value);
            this.draft.rules.forEach((r) => {
                const conds = Array.isArray(r?.conditions) ? r.conditions : [];
                conds.forEach((c) => {
                    if (String(c?.key || '') !== key) return;
                    if (!allowed.includes(c.operator)) c.operator = this.defaultOperatorForInput(inp);
                    c.value = '';
                });
            });
        },
        addInput() {
            const newInput = { _rowId: String(Date.now() + Math.random()), label: '', key: '', inputMode: 'number', options: [] };
            this.draft.inputs.push(newInput);
            // 규칙행은 셀 매트릭스가 아니라, 조건 행에서 항목을 선택하는 방식이므로 자동 추가하지 않는다.
        },
        removeInput(idx) {
            if (!Array.isArray(this.draft.inputs)) return;
            if (this.draft.inputs.length === 1) {
                // 첫 항목은 삭제 대신 내용만 비움
                this.draft.inputs[0].label = '';
                this.draft.inputs[0].key = '';
                this.draft.inputs[0].inputMode = 'number';
                this.draft.inputs[0].options = [];
                // 각 규칙행의 해당 셀도 비움
                this.draft.rules.forEach((r) => {
                    if (!Array.isArray(r.conditions)) r.conditions = [];
                    r.conditions = r.conditions.filter((c) => c && String(c.key || '') !== '');
                });
                return;
            }
            const removed = this.draft.inputs[idx];
            this.draft.inputs.splice(idx, 1);
            const key = String(removed?.key || '');
            this.draft.rules.forEach((r) => {
                if (!Array.isArray(r.conditions)) r.conditions = [];
                r.conditions = r.conditions.filter((c) => String(c?.key || '') !== key);
            });
        },
        addRuleRow() {
            const row = {
                _rowId: String(Date.now() + Math.random()),
                conditions: [{ key: '', operator: 'eq', value: '' }],
                result: { outcome: 'approve', note: '' },
                enabled: true
            };
            this.draft.rules.push(row);
        },
        removeRuleRow(idx) {
            if (!Array.isArray(this.draft.rules)) return;
            if (this.draft.rules.length === 1) {
                // 첫 행은 삭제 대신 내용만 비움
                const r = this.draft.rules[0];
                r.result = { outcome: 'approve', note: '' };
                r.conditions = [{ key: '', operator: 'eq', value: '' }];
                return;
            }
            this.draft.rules.splice(idx, 1);
        },
        cancelEdit() {
            // 새로 만들기 취소면 초기 화면으로
            if (!this.selectedRuleId) {
                this.isEditing = false;
                this.draft = null;
                this.isAdvancedMode = false;
                this.$router.replace('/business-rule');
                return;
            }
            // 편집 취소면 다시 로드
            this.openRule(this.selectedRuleId);
        },
        async saveRule() {
            try {
                // 고급 모드면 DMN → 테이블 동기화 후 저장
                if (this.isAdvancedMode) {
                    const ok = await this.syncFromDmnEditorToDraft();
                    if (!ok) {
                        this.notifyWarning(this.$t('businessRuleDefinition.advancedModeSaveFailed'));
                        return;
                    }
                } else {
                    // 기본 모드: 입력칸(note 포함) 변경사항이 DMN annotations에 반영되도록 저장 직전에 DMN을 최신화
                    this.syncDraftTableToDmnXml();
                    this.syncLastTableSignature();
                }
                // 저장은 dmnXml만을 진실(source)로 사용한다.
                // inputs/rules/conditions/result 같은 내부 모델은 서버에 저장하지 않는다.
                const payload = {
                    id: this.draft?.id ?? null,
                    name: this.draft?.name ?? '',
                    description: this.draft?.description ?? '',
                    dmnXml: typeof this.draft?.dmnXml === 'string' ? this.draft.dmnXml : ''
                };
                const res = await this.backend.saveBusinessRule(payload);
                const id = res?.id || payload.id;
                await this.refreshList();
                if (id) {
                    await this.openRule(id);
                }
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleDefinition.saveFailed'));
            }
        },
        async copyRule(ruleId) {
            try {
                const rule = await this.backend.getBusinessRule(ruleId);
                if (!rule) {
                    this.notifyWarning(this.$t('businessRuleDefinition.notFound'));
                    return;
                }
                this.ruleToCopy = rule;
                this.copiedRuleName = `${rule.name || ruleId} ${this.$t('businessRuleDefinition.copySuffix')}`;
                this.copyDialog = true;
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleDefinition.loadFailed'));
            }
        },
        async executeCopyRule() {
            if (!this.ruleToCopy || !this.copiedRuleName || !this.copiedRuleName.trim()) {
                return;
            }

            try {
                // 새 ID 생성 (uuid 또는 타임스탬프 기반)
                const newId = this.__generateNewRuleId();
                const copiedRule = {
                    ...this.ruleToCopy,
                    id: newId,
                    name: this.copiedRuleName.trim(),
                    description: this.ruleToCopy.description || ''
                };

                // ID 제거하여 새 룰로 저장
                delete copiedRule.id;
                const result = await this.backend.saveBusinessRule(copiedRule, { isNew: true });
                const savedId = result?.id || newId;

                // 목록 갱신
                await this.refreshList();

                // 복사된 룰 열기
                await this.openRule(savedId);

                // 성공 메시지
                if (this.$try) {
                    this.$try({ 
                        context: this, 
                        action: async () => {}, 
                        successMsg: this.$t('businessRuleDefinition.copySuccess') 
                    });
                } else if (window.$app_) {
                    window.$app_.snackbarMessage = this.$t('businessRuleDefinition.copySuccess');
                    window.$app_.snackbarColor = 'success';
                    window.$app_.snackbar = true;
                }
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleDefinition.copyFailed'));
            } finally {
                this.copyDialog = false;
                this.ruleToCopy = null;
                this.copiedRuleName = '';
            }
        },
        __generateNewRuleId() {
            // 간단한 UUID 생성 (브라우저 환경)
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            // Fallback
            return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },
        confirmDeleteRule(ruleId, ruleName) {
            this.ruleToDelete = { id: ruleId, name: ruleName };
            this.deleteDialog = true;
        },
        async deleteRule() {
            if (!this.ruleToDelete?.id) {
                this.deleteDialog = false;
                return;
            }

            const ruleId = this.ruleToDelete.id;
            try {
                await this.backend.deleteBusinessRule(ruleId);
                
                // 삭제된 룰이 현재 편집 중인 룰이면 편집 화면 닫기
                if (this.selectedRuleId === ruleId) {
                    this.selectedRuleId = null;
                    this.isEditing = false;
                    this.draft = null;
                }
                
                // 목록 갱신
                await this.refreshList();
                
                // 성공 메시지
                if (this.$try) {
                    this.$try({ 
                        context: this, 
                        action: async () => {}, 
                        successMsg: this.$t('businessRuleDefinition.deleteSuccess') 
                    });
                } else if (window.$app_) {
                    window.$app_.snackbarMessage = this.$t('businessRuleDefinition.deleteSuccess');
                    window.$app_.snackbarColor = 'success';
                    window.$app_.snackbar = true;
                }
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleDefinition.deleteFailed'));
            } finally {
                this.deleteDialog = false;
                this.ruleToDelete = null;
            }
        },
        openVersionManager() {
            if (!this.draft?.id) {
                this.notifyWarning(this.$t('businessRuleDefinition.selectRuleFirstForVersion'));
                return;
            }
            // 버전 관리 다이얼로그 열기
            this.showVersionManager = true;
        },
        openTestRunner() {
            if (!this.draft?.id) {
                this.notifyWarning('테스트를 실행하려면 먼저 룰을 선택하세요.');
                return;
            }
            // 테스트 실행기 다이얼로그 열기
            this.showTestRunner = true;
        },
        async handleVersionChanged(data) {
            // 버전 변경: 버전 파일을 현재 룰 파일로 덮어쓰기
            if (!data || !data.versionDto || !data.ruleId) return;
            
            try {
                const versionDto = data.versionDto;
                const ruleId = data.ruleId;
                
                // 버전 파일의 JSON을 현재 룰 ID로 덮어쓰기 (id는 현재 룰 ID 유지)
                const versionedPayload = {
                    ...versionDto,
                    id: ruleId, // 현재 룰 ID 유지
                    version: versionDto.version || '1.0',
                    created_at: versionDto.created_at || new Date().toISOString(),
                    created_by: versionDto.created_by || this.backend.__getCurrentUserId?.() || ''
                };
                
                // 버전 파일의 내용을 현재 룰 파일로 덮어쓰기
                await this.backend.putRawDefinition(
                    JSON.stringify(versionedPayload),
                    `businessRules/${encodeURIComponent(ruleId)}`,
                    { type: 'rule' }
                );
                
                // 저장 후 전체 룰 정보를 다시 로드하여 draft 업데이트
                const rule = await this.backend.getBusinessRule(ruleId);
                if (rule) {
                    this.selectedRuleId = rule.id;
                    this.draft = JSON.parse(JSON.stringify(rule));
                    this.isAdvancedMode = false;
                    this.bumpDmnRenderKey();
                    this.normalizeDraft();
                    this.isEditing = true;
                }
                
                // 다이얼로그 닫기
                this.showVersionManager = false;
                
                this.$try({
                    action: async () => {},
                    successMsg: this.$t('businessRuleDefinition.versionApplied', { version: data.version })
                });
            } catch (e) {
                console.error('버전 변경 처리 실패:', e);
                this.$try({
                    action: async () => {},
                    warningMsg: this.$t('businessRuleDefinition.versionChangeFailed')
                });
            }
        }
    }
};
</script>

<style scoped>
.br-rule-disabled {
    background-color: rgba(0, 0, 0, 0.02);
}
.br-def-page {
    /* 상단 전체 바/사이드바 기준 그리드에 맞추기 위해
       바깥 padding은 레이아웃(v-container px-4 등)에 맡긴다. */
    height: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    /* right-part(부모)가 overflow:auto 이므로, 페이지 자체 스크롤을 막고 카드 내부에서만 스크롤되게 한다 */
    overflow: hidden;
}
.br-def-page.is-work-height {
    /* 공통 레이아웃 기준(프로젝트 전역 is-work-height)과 동일한 계산으로 고정 */
    height: calc(100vh - 131px);
}
.br-page-header {
    position: sticky;
    top: 0;
    z-index: 5;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.br-page-title {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}
.br-page-actions {
    margin-left: auto;
}
.br-title {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.2;
}
.br-subtitle {
    font-size: 12.5px;
    line-height: 1.2;
}
.br-body-row {
    flex: 1;
    min-height: 0; /* 중요: 자식 overflow가 동작하도록 */
    gap: 16px;
}
.br-col {
    height: 100%;
    min-height: 0;
}
.br-side-card {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.br-side-header {
    padding: 12px 14px 6px 14px;
    display: flex;
    align-items: center;
}
.br-side-title {
    font-weight: 800;
    font-size: 14px;
}
.br-side-search {
    padding: 0 14px 10px 14px;
}
.br-side-list {
    padding: 0 8px 10px 8px;
    overflow: auto;
    flex: 1;
    min-height: 0;
}
.br-list-item {
    margin: 2px 6px;
}
.br-list-title {
    font-weight: 700;
}
.br-list-subtitle {
    font-size: 12.5px;
}
.br-empty {
    padding: 12px;
    font-size: 13px;
}
.br-editor-card {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.br-editor-header {
    position: sticky;
    top: 0;
    z-index: 4;
    background: white;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.br-editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.br-editor-title-text {
    font-weight: 800;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 520px;
}
.br-editor-subtitle {
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.br-editor-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
.br-editor-body {
    padding: 14px;
    overflow: auto;
    flex: 1;
    min-height: 0;
}
.br-editor-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
}
.br-editor-content {
    max-width: 980px;
}

.br-editor-content.br-advanced {
    /* 고급 모드에서는 DMN 편집기가 넓게 보이도록 폭 제한 해제 */
    max-width: none;
}

.br-dmn-card {
    /* 고급 편집기(모델러) 공간을 더 크게 확보 */
    height: calc(100vh - 360px);
    min-height: 620px;
    max-height: 980px;
    overflow: hidden;
}
.br-dmn-card :deep(.vue-dmn-diagram-container) {
    height: 100%;
}

.excel-table :deep(th),
.excel-table :deep(td) {
    padding: 6px 10px;
    vertical-align: middle;
}
.excel-table :deep(th) {
    font-weight: 700;
    font-size: 12px;
}
.excel-table :deep(.v-field) {
    --v-field-padding-top: 2px;
    --v-field-padding-bottom: 2px;
}
</style>
