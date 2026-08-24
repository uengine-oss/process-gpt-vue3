<template>
    <div class="issue-board">
        <div class="issue-board__header">
            <div class="issue-board__title">
                <v-icon size="18" color="error" class="mr-1">mdi-flag-variant</v-icon>
                이슈 백로그
                <v-chip size="x-small" variant="tonal" class="ml-2">{{ issues.length }}</v-chip>
                <v-chip v-if="selectedCount" size="x-small" variant="flat" color="success" class="ml-1"> 선택 {{ selectedCount }} </v-chip>
            </div>
            <div v-if="!readonly" class="issue-board__tools">
                <v-tooltip text="솔루션이 없는 모든 이슈에 AI 옵션을 제안합니다" location="bottom">
                    <template #activator="{ props: tt }">
                        <v-btn
                            v-bind="tt"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            :loading="proposingAll"
                            @click="$emit('propose-all')"
                        >
                            <v-icon start size="14">mdi-auto-fix</v-icon>
                            AI 일괄 제안
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-btn size="x-small" variant="text" @click="openIssueDialog()">
                    <v-icon start size="14">mdi-plus</v-icon>
                    이슈
                </v-btn>
            </div>
        </div>

        <div class="issue-board__list">
            <div v-if="!issues.length" class="issue-board__empty">
                <v-icon size="40" color="grey-lighten-1">mdi-flag-outline</v-icon>
                <div class="text-body-2 text-medium-emphasis mt-2">확정된 PI Flag 이슈가 없습니다.</div>
                <div class="text-caption text-disabled">As-Is 순서도에 PI Flag를 남기거나 이슈를 직접 추가하세요.</div>
            </div>

            <div v-for="issue in issues" :key="issue.id" class="issue-item">
                <div class="issue-item__head" @click="toggle(issue.id)">
                    <v-icon size="16" class="mr-1">{{ isExpanded(issue.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                    <div class="issue-item__titlewrap">
                        <div class="issue-item__title">{{ issue.title }}</div>
                        <div class="issue-item__meta">
                            <v-chip v-if="issue.source_element_name" size="x-small" variant="tonal" color="grey">
                                <v-icon start size="11">mdi-shape-outline</v-icon>{{ issue.source_element_name }}
                            </v-chip>
                            <v-chip v-if="issue.flag_type" size="x-small" variant="tonal" color="error">{{ issue.flag_type }}</v-chip>
                            <v-chip size="x-small" variant="flat" :color="statusMeta(issue).color">{{ statusMeta(issue).label }}</v-chip>
                            <span class="issue-item__count">옵션 {{ issue.solutions.length }}</span>
                        </div>
                    </div>
                    <div class="issue-item__head-actions" @click.stop>
                        <v-btn v-if="!readonly" size="x-small" variant="text" icon @click="openIssueDialog(issue)">
                            <v-icon size="15">mdi-pencil-outline</v-icon>
                        </v-btn>
                        <v-btn v-if="!readonly" size="x-small" variant="text" icon color="error" @click="$emit('remove-issue', issue.id)">
                            <v-icon size="15">mdi-delete-outline</v-icon>
                        </v-btn>
                    </div>
                </div>

                <v-expand-transition>
                    <div v-show="isExpanded(issue.id)" class="issue-item__body">
                        <p v-if="issue.description" class="issue-item__desc">{{ issue.description }}</p>

                        <div class="issue-item__solutions">
                            <SolutionOptionCard
                                v-for="sol in issue.solutions"
                                :key="sol.id"
                                :solution="sol"
                                :selected="issue.selected_solution_id === sol.id"
                                :readonly="readonly"
                                @select="$emit('select-solution', issue.id, sol.id)"
                                @edit="openSolutionDialog(issue, sol)"
                                @delete="$emit('remove-solution', issue.id, sol.id)"
                            />
                            <div v-if="!issue.solutions.length && proposingIssueId !== issue.id" class="issue-item__nosol">
                                제안된 솔루션이 없습니다.
                            </div>
                            <div v-if="proposingIssueId === issue.id" class="issue-item__loading">
                                <v-progress-circular indeterminate size="18" width="2" color="primary" class="mr-2" />
                                AI가 솔루션 옵션을 제안하는 중...
                            </div>
                        </div>

                        <div v-if="!readonly" class="issue-item__actions">
                            <v-btn
                                size="x-small"
                                variant="tonal"
                                color="primary"
                                :loading="proposingIssueId === issue.id"
                                @click="$emit('propose', issue.id, { replace: issue.solutions.some((s) => s.ai_generated) })"
                            >
                                <v-icon start size="14">mdi-auto-fix</v-icon>
                                {{ issue.solutions.some((s) => s.ai_generated) ? 'AI 재제안' : 'AI 제안' }}
                            </v-btn>
                            <v-btn size="x-small" variant="text" @click="openSolutionDialog(issue)">
                                <v-icon start size="14">mdi-plus</v-icon>
                                옵션 추가
                            </v-btn>
                        </div>
                    </div>
                </v-expand-transition>
            </div>
        </div>

        <!-- 이슈 추가/편집 다이얼로그 -->
        <v-dialog v-model="issueDialog" max-width="520">
            <v-card>
                <v-card-title class="text-subtitle-1">{{ issueForm.id ? '이슈 편집' : '이슈 추가' }}</v-card-title>
                <v-card-text>
                    <v-text-field v-model="issueForm.title" label="이슈 제목" density="compact" variant="outlined" />
                    <v-textarea v-model="issueForm.description" label="설명" rows="3" density="compact" variant="outlined" auto-grow />
                    <v-text-field v-model="issueForm.flag_type" label="유형 (선택)" density="compact" variant="outlined" hide-details />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="issueDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" :disabled="!issueForm.title" @click="saveIssue">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 솔루션 추가/편집 다이얼로그 -->
        <v-dialog v-model="solutionDialog" max-width="560">
            <v-card>
                <v-card-title class="text-subtitle-1">{{ solutionForm.id ? '솔루션 편집' : '솔루션 옵션 추가' }}</v-card-title>
                <v-card-text>
                    <v-row dense>
                        <v-col cols="6">
                            <v-select
                                v-model="solutionForm.solution_type"
                                :items="solutionTypeItems"
                                item-title="label"
                                item-value="value"
                                label="유형"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                        <v-col cols="6">
                            <v-select
                                v-model="solutionForm.implementation_effort"
                                :items="effortItems"
                                item-title="label"
                                item-value="value"
                                label="구현 난이도"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                    </v-row>
                    <v-text-field v-model="solutionForm.title" label="제목" density="compact" variant="outlined" class="mt-2" />
                    <v-textarea v-model="solutionForm.description" label="설명" rows="2" density="compact" variant="outlined" auto-grow />
                    <v-row dense>
                        <v-col cols="6">
                            <v-text-field
                                v-model.number="solutionForm.costSaving"
                                type="number"
                                label="연간 비용 절감(원)"
                                hint="절감은 양수, 증가는 음수"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                            />
                        </v-col>
                        <v-col cols="6">
                            <v-text-field
                                v-model.number="solutionForm.fteSaving"
                                type="number"
                                step="0.1"
                                label="FTE 절감"
                                hint="절감은 양수, 증가는 음수"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                            />
                        </v-col>
                    </v-row>
                    <v-row dense>
                        <v-col cols="6">
                            <v-text-field
                                v-model.number="solutionForm.timeline_months"
                                type="number"
                                label="예상 기간(개월)"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                        <v-col cols="6">
                            <v-select
                                v-model="solutionForm.confidence"
                                :items="confidenceItems"
                                item-title="label"
                                item-value="value"
                                label="신뢰도"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                    </v-row>
                    <v-textarea
                        v-model="solutionForm.pros"
                        label="장점"
                        rows="2"
                        density="compact"
                        variant="outlined"
                        auto-grow
                        class="mt-2"
                    />
                    <v-textarea v-model="solutionForm.cons" label="단점/리스크" rows="2" density="compact" variant="outlined" auto-grow />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="solutionDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" :disabled="!solutionForm.title" @click="saveSolution">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import SolutionOptionCard from './SolutionOptionCard.vue';
import { SOLUTION_TYPES, EFFORT_META, CONFIDENCE_META, type ToBeIssue } from '@/composables/blueprint/blueprintModel';

const props = defineProps<{
    issues: ToBeIssue[];
    proposingIssueId?: string | null;
    proposingAll?: boolean;
    selectedCount?: number;
    readonly?: boolean;
}>();

const emit = defineEmits<{
    (e: 'add-issue', payload: Partial<ToBeIssue>): void;
    (e: 'update-issue', id: string, patch: Partial<ToBeIssue>): void;
    (e: 'remove-issue', id: string): void;
    (e: 'add-solution', issueId: string, partial: any): void;
    (e: 'update-solution', issueId: string, solId: string, patch: any): void;
    (e: 'remove-solution', issueId: string, solId: string): void;
    (e: 'select-solution', issueId: string, solId: string): void;
    (e: 'propose', issueId: string, opts: { replace: boolean }): void;
    (e: 'propose-all'): void;
}>();

const solutionTypeItems = SOLUTION_TYPES;
const effortItems = (Object.keys(EFFORT_META) as Array<keyof typeof EFFORT_META>).map((k) => ({ value: k, label: EFFORT_META[k].label }));
const confidenceItems = (Object.keys(CONFIDENCE_META) as Array<keyof typeof CONFIDENCE_META>).map((k) => ({
    value: k,
    label: CONFIDENCE_META[k].label
}));

// 기본 펼침: 명시적으로 접은 이슈만 collapsed 에 보관 (이후 추가되는 이슈도 기본 펼침)
const collapsed = ref<Set<string>>(new Set());
function isExpanded(id: string) {
    return !collapsed.value.has(id);
}
function toggle(id: string) {
    const next = new Set(collapsed.value);
    next.has(id) ? next.delete(id) : next.add(id);
    collapsed.value = next;
}

function statusMeta(issue: ToBeIssue) {
    if (issue.status === 'in_blueprint') return { label: '반영됨', color: 'teal' };
    if (issue.selected_solution_id) return { label: '솔루션 선택', color: 'success' };
    return { label: '검토중', color: 'grey' };
}

/* ---- issue dialog ---- */
const issueDialog = ref(false);
const issueForm = reactive<{ id: string | null; title: string; description: string; flag_type: string }>({
    id: null,
    title: '',
    description: '',
    flag_type: ''
});
function openIssueDialog(issue?: ToBeIssue) {
    issueForm.id = issue?.id || null;
    issueForm.title = issue?.title || '';
    issueForm.description = issue?.description || '';
    issueForm.flag_type = issue?.flag_type || '';
    issueDialog.value = true;
}
function saveIssue() {
    if (!issueForm.title) return;
    if (issueForm.id) {
        emit('update-issue', issueForm.id, { title: issueForm.title, description: issueForm.description, flag_type: issueForm.flag_type });
    } else {
        const created = { title: issueForm.title, description: issueForm.description, flag_type: issueForm.flag_type };
        emit('add-issue', created);
    }
    issueDialog.value = false;
}

/* ---- solution dialog ---- */
const solutionDialog = ref(false);
const solutionForm = reactive<any>({
    id: null,
    issueId: '',
    solution_type: 'RPA',
    title: '',
    description: '',
    implementation_effort: 'medium',
    costSaving: 0,
    fteSaving: 0,
    timeline_months: null,
    confidence: 'medium',
    pros: '',
    cons: ''
});
function openSolutionDialog(issue: ToBeIssue, sol?: any) {
    solutionForm.id = sol?.id || null;
    solutionForm.issueId = issue.id;
    solutionForm.solution_type = sol?.solution_type || 'RPA';
    solutionForm.title = sol?.title || '';
    solutionForm.description = sol?.description || '';
    solutionForm.implementation_effort = sol?.implementation_effort || 'medium';
    solutionForm.costSaving = sol ? -(Number(sol.expected_impact?.cost_delta) || 0) : 0;
    solutionForm.fteSaving = sol ? -(Number(sol.expected_impact?.fte_delta) || 0) : 0;
    solutionForm.timeline_months = sol?.expected_impact?.timeline_months ?? null;
    solutionForm.confidence = sol?.expected_impact?.confidence || 'medium';
    solutionForm.pros = sol?.pros || '';
    solutionForm.cons = sol?.cons || '';
    solutionDialog.value = true;
}
function saveSolution() {
    if (!solutionForm.title) return;
    const payload = {
        solution_type: solutionForm.solution_type,
        title: solutionForm.title,
        description: solutionForm.description,
        implementation_effort: solutionForm.implementation_effort,
        pros: solutionForm.pros,
        cons: solutionForm.cons,
        expected_impact: {
            cost_delta: -(Number(solutionForm.costSaving) || 0),
            fte_delta: -(Number(solutionForm.fteSaving) || 0),
            timeline_months: solutionForm.timeline_months != null ? Number(solutionForm.timeline_months) : undefined,
            confidence: solutionForm.confidence
        }
    };
    if (solutionForm.id) {
        emit('update-solution', solutionForm.issueId, solutionForm.id, payload);
    } else {
        emit('add-solution', solutionForm.issueId, payload);
    }
    solutionDialog.value = false;
}
</script>

<style scoped>
.issue-board {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fafafb;
    border-right: 1px solid rgba(0, 0, 0, 0.08);
}
.issue-board__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
    gap: 8px;
    flex-wrap: wrap;
}
.issue-board__title {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 700;
}
.issue-board__tools {
    display: flex;
    align-items: center;
    gap: 4px;
}
.issue-board__list {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 8px;
}
.issue-board__empty {
    text-align: center;
    padding: 40px 16px;
}
.issue-item {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    margin-bottom: 8px;
    overflow: hidden;
}
.issue-item__head {
    display: flex;
    align-items: flex-start;
    padding: 9px 10px;
    cursor: pointer;
    gap: 2px;
}
.issue-item__head:hover {
    background: rgba(0, 0, 0, 0.02);
}
.issue-item__titlewrap {
    flex: 1 1 auto;
    min-width: 0;
}
.issue-item__title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    color: rgba(0, 0, 0, 0.85);
}
.issue-item__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
}
.issue-item__count {
    font-size: 10.5px;
    color: rgba(0, 0, 0, 0.45);
}
.issue-item__head-actions {
    display: flex;
    flex: 0 0 auto;
}
.issue-item__body {
    padding: 4px 10px 10px;
    border-top: 1px dashed rgba(0, 0, 0, 0.06);
}
.issue-item__desc {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    margin: 6px 0;
    line-height: 1.45;
}
.issue-item__solutions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.issue-item__nosol {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.4);
    padding: 8px 0;
}
.issue-item__loading {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: rgb(var(--v-theme-primary));
    padding: 10px 0;
}
.issue-item__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
}
</style>
