<template>
    <div class="restructure-studio">
        <div class="studio-header">
            <div>
                <div class="studio-title">Re-structuring Mode</div>
                <div class="studio-subtitle">
                    영향도 분석, orphan transfer, target architecture draft, maintenance cut-over를 한 흐름으로 다룹니다.
                </div>
            </div>
            <div class="d-flex align-center flex-wrap ga-2">
                <v-chip size="small" :color="maintenanceMode?.enabled ? 'error' : 'grey'" variant="flat">
                    {{ maintenanceMode?.enabled ? 'Maintenance Active' : 'Maintenance Off' }}
                </v-chip>
                <v-btn size="small" variant="text" class="text-none" @click="$emit('openSystemOps')">
                    Maintenance 설정
                </v-btn>
            </div>
        </div>

        <div class="studio-grid">
            <div class="studio-card">
                <div class="studio-card__title">Scenario Builder</div>
                <div class="studio-card__subtitle">구조개편 작업을 선택하고 영향도 분석용 draft를 생성합니다.</div>

                <v-select
                    v-model="selectedOperation"
                    :items="operationOptions"
                    item-title="label"
                    item-value="value"
                    label="구조개편 작업"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mt-4"
                />

                <template v-if="selectedOperation === 'rename-mega'">
                    <v-select
                        v-model="selectedMegaId"
                        :items="megaOptions"
                        item-title="label"
                        item-value="value"
                        label="대상 Mega"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-text-field
                        v-model="newMegaName"
                        label="새 Mega 이름"
                        placeholder="예: Customer Growth Platform"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                </template>

                <template v-else-if="selectedOperation === 'move-major'">
                    <v-select
                        v-model="selectedMajorId"
                        :items="majorOptions"
                        item-title="label"
                        item-value="value"
                        label="이동할 Major"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-select
                        v-model="targetMegaId"
                        :items="targetMegaOptions"
                        item-title="label"
                        item-value="value"
                        label="목적 Mega"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                </template>

                <template v-else-if="selectedOperation === 'delete-major'">
                    <v-select
                        v-model="selectedMajorId"
                        :items="majorOptions"
                        item-title="label"
                        item-value="value"
                        label="삭제할 Major"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-select
                        v-if="selectedMajor?.subCount"
                        v-model="transferTargetMajorId"
                        :items="transferTargetOptions"
                        item-title="label"
                        item-value="value"
                        label="Orphan Transfer Target"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                </template>

                <v-alert v-if="validationMessage" type="warning" variant="tonal" density="compact" class="mt-4">
                    {{ validationMessage }}
                </v-alert>
                <v-alert
                    v-else-if="blastRadius.orphanRisk"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mt-4"
                >
                    삭제 대상 Major에 하위 프로세스가 있어 transfer mapping이 없으면 orphan가 발생합니다.
                </v-alert>
            </div>

            <div class="studio-card">
                <div class="studio-card__title">Blast Radius</div>
                <div class="studio-card__subtitle">구조개편 시 영향받는 상위 구조와 하위 프로세스를 계산합니다.</div>

                <div class="metric-grid mt-4">
                    <div class="metric-card">
                        <div class="metric-card__label">Impacted Mega</div>
                        <div class="metric-card__value">{{ blastRadius.impactedMegaCount }}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card__label">Impacted Major</div>
                        <div class="metric-card__value">{{ blastRadius.impactedMajorCount }}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-card__label">Impacted Sub</div>
                        <div class="metric-card__value">{{ blastRadius.impactedSubCount }}</div>
                    </div>
                </div>

                <div class="summary-list mt-4">
                    <div v-for="line in blastRadius.summaryLines" :key="line" class="summary-item">
                        <v-icon size="14" color="primary">mdi-arrow-right</v-icon>
                        <span>{{ line }}</span>
                    </div>
                </div>

                <div class="approval-pack mt-4">
                    <div class="approval-pack__title">Special Approval Package</div>
                    <div class="approval-pack__body">{{ approvalPackage.title }}</div>
                    <div class="approval-pack__meta">
                        approval_type={{ approvalPackage.type }} · {{ approvalPackage.versionLabel }}
                    </div>
                </div>
            </div>
        </div>

        <div v-if="draftPayload" class="draft-card mt-4">
            <div class="d-flex align-center justify-space-between flex-wrap ga-2">
                <div>
                    <div class="draft-card__title">Target Architecture Draft</div>
                    <div class="draft-card__subtitle">{{ draftPayload.summary }}</div>
                </div>
                <div class="d-flex align-center flex-wrap ga-2">
                    <v-chip size="small" color="primary" variant="tonal">{{ draftPayload.id }}</v-chip>
                    <v-chip size="small" color="indigo" variant="tonal">{{ draftPayload.versionLabel }}</v-chip>
                </div>
            </div>
            <div class="draft-card__meta mt-3">
                생성 시각 {{ formatDateTime(draftPayload.createdAt) }} · approval entry {{ draftPayload.approvalType }}
            </div>
        </div>

        <div class="studio-actions mt-4">
            <v-btn color="primary" variant="flat" class="text-none" :disabled="!!validationMessage" @click="generateDraft">
                <v-icon start size="14">mdi-source-branch-plus</v-icon>
                Target Architecture Draft 생성
            </v-btn>
            <v-btn variant="outlined" class="text-none" @click="$emit('openReviewBoard')">
                <v-icon start size="14">mdi-shield-check-outline</v-icon>
                특별 결재 라인 검토
            </v-btn>
            <v-btn
                color="deep-orange"
                variant="flat"
                class="text-none"
                :disabled="!draftPayload || !maintenanceMode?.enabled"
                @click="$emit('applyDraft', draftPayload)"
            >
                <v-icon start size="14">mdi-rocket-launch-outline</v-icon>
                Maintenance Cut-over 적용
            </v-btn>
        </div>

        <v-alert
            v-if="draftPayload && !maintenanceMode?.enabled"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
        >
            cut-over 적용 전 `Admin System Operations`에서 maintenance mode를 활성화해야 합니다.
        </v-alert>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const LOCAL_DRAFT_KEY = 'process_architecture_restructure_drafts';

type RestructureOperation = 'rename-mega' | 'move-major' | 'delete-major';

interface RestructureDraftPayload {
    id: string;
    createdAt: string;
    operation: RestructureOperation;
    summary: string;
    approvalType: string;
    approvalTitle: string;
    versionLabel: string;
    map: any;
    changeSummary: string[];
    beforeSnapshot: {
        megaCount: number;
        majorCount: number;
        subCount: number;
        highlights: string[];
    };
    afterSnapshot: {
        megaCount: number;
        majorCount: number;
        subCount: number;
        highlights: string[];
    };
    blastRadius: {
        impactedMegaCount: number;
        impactedMajorCount: number;
        impactedSubCount: number;
        orphanRisk: boolean;
    };
}

interface MajorOption {
    value: string;
    label: string;
    megaId: string;
    megaName: string;
    subCount: number;
}

const props = defineProps<{
    procMap: any;
    maintenanceMode?: {
        enabled?: boolean;
        message?: string;
        activated_by?: string;
        activated_at?: string;
    } | null;
}>();

const emit = defineEmits<{
    (e: 'applyDraft', payload: RestructureDraftPayload): void;
    (e: 'scheduleCutover', payload: RestructureDraftPayload): void;
    (e: 'openSystemOps'): void;
    (e: 'openReviewBoard'): void;
}>();

const selectedOperation = ref<RestructureOperation>('rename-mega');
const selectedMegaId = ref('');
const selectedMajorId = ref('');
const targetMegaId = ref('');
const transferTargetMajorId = ref('');
const newMegaName = ref('');
const draftPayload = ref<RestructureDraftPayload | null>(null);

const operationOptions = [
    { value: 'rename-mega', label: 'Mega Rename' },
    { value: 'move-major', label: 'Major Move' },
    { value: 'delete-major', label: 'Major Delete + Transfer' }
];

const megaOptions = computed(() =>
    (props.procMap?.mega_proc_list || []).map((mega: any) => ({
        value: mega.id,
        label: mega.name || mega.id
    }))
);

const majorOptions = computed<MajorOption[]>(() => {
    const options: MajorOption[] = [];
    for (const mega of props.procMap?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            options.push({
                value: major.id,
                label: `${mega.name || mega.id} / ${major.name || major.id}`,
                megaId: mega.id,
                megaName: mega.name || mega.id,
                subCount: (major.sub_proc_list || []).length
            });
        }
    }
    return options;
});

const selectedMega = computed(() => (props.procMap?.mega_proc_list || []).find((mega: any) => mega.id === selectedMegaId.value) || null);
const selectedMajor = computed(() => majorOptions.value.find((major) => major.value === selectedMajorId.value) || null);

const targetMegaOptions = computed(() => {
    if (!selectedMajor.value) return megaOptions.value;
    return megaOptions.value.filter((mega) => mega.value !== selectedMajor.value?.megaId);
});

const transferTargetOptions = computed(() => {
    const currentMajorId = selectedMajor.value?.value;
    return majorOptions.value.filter((major) => major.value !== currentMajorId);
});

const blastRadius = computed(() => {
    if (selectedOperation.value === 'rename-mega') {
        const mega = selectedMega.value;
        const impactedMajors = (mega?.major_proc_list || []).length;
        const impactedSubCount = (mega?.major_proc_list || []).reduce(
            (sum: number, major: any) => sum + ((major.sub_proc_list || []).length || 0),
            0
        );
        return {
            impactedMegaCount: mega ? 1 : 0,
            impactedMajorCount: mega ? impactedMajors : 0,
            impactedSubCount: mega ? impactedSubCount : 0,
            orphanRisk: false,
            summaryLines: mega
                ? [
                      `${mega.name || mega.id} 하위 Major ${impactedMajors}개가 새 이름 기준으로 노출됩니다.`,
                      `하위 Sub-process ${impactedSubCount}개는 구조 변화 없이 상위 라벨만 갱신됩니다.`
                  ]
                : ['대상 Mega를 선택하면 영향 범위를 계산합니다.']
        };
    }

    if (selectedOperation.value === 'move-major') {
        const major = selectedMajor.value;
        return {
            impactedMegaCount: major ? 2 : 0,
            impactedMajorCount: major ? 1 : 0,
            impactedSubCount: major?.subCount || 0,
            orphanRisk: false,
            summaryLines: major
                ? [
                      `${major.label}가 새 Mega로 이관됩니다.`,
                      `하위 Sub-process ${major.subCount}개가 함께 이동하며 orphan는 발생하지 않습니다.`
                  ]
                : ['이동할 Major와 목적 Mega를 선택하면 영향 범위를 계산합니다.']
        };
    }

    const major = selectedMajor.value;
    const requiresTransfer = (major?.subCount || 0) > 0 && !transferTargetMajorId.value;
    const transferTarget = transferTargetOptions.value.find((item) => item.value === transferTargetMajorId.value);
    return {
        impactedMegaCount: major ? 1 : 0,
        impactedMajorCount: major ? 1 : 0,
        impactedSubCount: major?.subCount || 0,
        orphanRisk: requiresTransfer,
        summaryLines: major
            ? [
                  `${major.label}가 삭제됩니다.`,
                  major.subCount > 0
                      ? transferTarget
                          ? `하위 Sub-process ${major.subCount}개는 ${transferTarget.label}로 transfer mapping 됩니다.`
                          : `하위 Sub-process ${major.subCount}개는 transfer target 없이는 orphan가 됩니다.`
                      : '하위 Sub-process가 없어 transfer mapping은 필요하지 않습니다.'
              ]
            : ['삭제할 Major를 선택하면 영향 범위를 계산합니다.']
    };
});

const validationMessage = computed(() => {
    if (selectedOperation.value === 'rename-mega') {
        if (!selectedMegaId.value) return '이름을 바꿀 Mega를 선택하세요.';
        if (!newMegaName.value.trim()) return '새 Mega 이름을 입력하세요.';
        if (selectedMega.value && newMegaName.value.trim() === (selectedMega.value.name || selectedMega.value.id)) {
            return '기존 이름과 다른 Mega 이름을 입력하세요.';
        }
        return '';
    }

    if (selectedOperation.value === 'move-major') {
        if (!selectedMajorId.value) return '이동할 Major를 선택하세요.';
        if (!targetMegaId.value) return '목적 Mega를 선택하세요.';
        return '';
    }

    if (!selectedMajorId.value) return '삭제할 Major를 선택하세요.';
    if ((selectedMajor.value?.subCount || 0) > 0 && !transferTargetMajorId.value) {
        return '하위 프로세스 이관 대상 Major를 선택해야 삭제할 수 있습니다.';
    }
    return '';
});

const approvalPackage = computed(() => ({
    type: 'structure_restructure',
    title:
        selectedOperation.value === 'rename-mega'
            ? `Mega rename: ${(selectedMega.value?.name || '미선택')} → ${newMegaName.value.trim() || '새 이름'}`
            : selectedOperation.value === 'move-major'
            ? `Major move: ${selectedMajor.value?.label || '미선택'}`
            : `Major delete: ${selectedMajor.value?.label || '미선택'}`,
    versionLabel: draftPayload.value?.versionLabel || `r-${new Date().toISOString().slice(0, 10)}`
}));

function buildSnapshot(map: any, highlights: string[] = []) {
    const megaList = map?.mega_proc_list || [];
    const megaCount = megaList.length;
    const majorCount = megaList.reduce(
        (sum: number, mega: any) => sum + ((mega.major_proc_list || []).length || 0),
        0
    );
    const subCount = megaList.reduce(
        (sum: number, mega: any) =>
            sum +
            (mega.major_proc_list || []).reduce(
                (majorSum: number, major: any) => majorSum + ((major.sub_proc_list || []).length || 0),
                0
            ),
        0
    );

    return {
        megaCount,
        majorCount,
        subCount,
        highlights
    };
}

watch(
    megaOptions,
    (options) => {
        if (!selectedMegaId.value && options.length > 0) {
            selectedMegaId.value = options[0].value;
        }
    },
    { immediate: true }
);

watch(
    majorOptions,
    (options) => {
        if (!selectedMajorId.value && options.length > 0) {
            selectedMajorId.value = options[0].value;
        }
    },
    { immediate: true }
);

watch([selectedOperation, selectedMegaId, selectedMajorId, targetMegaId, transferTargetMajorId, newMegaName], () => {
    draftPayload.value = null;
});

watch(selectedMajorId, () => {
    transferTargetMajorId.value = '';
    if (selectedOperation.value === 'move-major') {
        targetMegaId.value = '';
    }
});

function cloneProcMap() {
    return JSON.parse(JSON.stringify(props.procMap || { mega_proc_list: [] }));
}

function buildDraftMap() {
    const nextMap = cloneProcMap();

    if (selectedOperation.value === 'rename-mega') {
        const mega = (nextMap.mega_proc_list || []).find((item: any) => item.id === selectedMegaId.value);
        if (mega) {
            mega.name = newMegaName.value.trim();
        }
        return nextMap;
    }

    if (selectedOperation.value === 'move-major') {
        let movedMajor: any = null;
        for (const mega of nextMap.mega_proc_list || []) {
            if (mega.id !== selectedMajor.value?.megaId) continue;
            const index = (mega.major_proc_list || []).findIndex((major: any) => major.id === selectedMajorId.value);
            if (index >= 0) {
                movedMajor = mega.major_proc_list.splice(index, 1)[0];
                break;
            }
        }

        if (movedMajor) {
            const targetMega = (nextMap.mega_proc_list || []).find((mega: any) => mega.id === targetMegaId.value);
            if (targetMega) {
                targetMega.major_proc_list = [...(targetMega.major_proc_list || []), movedMajor];
            }
        }

        return nextMap;
    }

    let removedMajor: any = null;
    for (const mega of nextMap.mega_proc_list || []) {
        const index = (mega.major_proc_list || []).findIndex((major: any) => major.id === selectedMajorId.value);
        if (index >= 0) {
            removedMajor = mega.major_proc_list.splice(index, 1)[0];
            break;
        }
    }

    if (removedMajor && (removedMajor.sub_proc_list || []).length > 0) {
        for (const mega of nextMap.mega_proc_list || []) {
            const targetMajor = (mega.major_proc_list || []).find((major: any) => major.id === transferTargetMajorId.value);
            if (!targetMajor) continue;
            targetMajor.sub_proc_list = [...(targetMajor.sub_proc_list || []), ...(removedMajor.sub_proc_list || [])];
            break;
        }
    }

    return nextMap;
}

function persistDraft(payload: RestructureDraftPayload) {
    try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) || '[]');
        const next = [payload, ...saved].slice(0, 10);
        localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(next));
    } catch (e) {
        console.error('Failed to persist restructure draft:', e);
    }
}

function generateDraft() {
    if (validationMessage.value) return;

    const beforeMap = cloneProcMap();
    const map = buildDraftMap();
    const now = new Date().toISOString();
    const payload: RestructureDraftPayload = {
        id: `RSTR-${Date.now().toString().slice(-6)}`,
        createdAt: now,
        operation: selectedOperation.value,
        summary: blastRadius.value.summaryLines.join(' '),
        approvalType: 'structure_restructure',
        approvalTitle: approvalPackage.value.title,
        versionLabel: `target-${new Date(now).toISOString().slice(0, 10)}`,
        map,
        changeSummary: [...blastRadius.value.summaryLines],
        beforeSnapshot: buildSnapshot(beforeMap, ['As-Is baseline']),
        afterSnapshot: buildSnapshot(map, blastRadius.value.summaryLines.slice(0, 3)),
        blastRadius: {
            impactedMegaCount: blastRadius.value.impactedMegaCount,
            impactedMajorCount: blastRadius.value.impactedMajorCount,
            impactedSubCount: blastRadius.value.impactedSubCount,
            orphanRisk: blastRadius.value.orphanRisk
        }
    };

    draftPayload.value = payload;
    persistDraft(payload);
    // Draft 생성 시 cut-over 예정 job을 scheduled 상태로 남겨 운영자가 추적할 수 있게 한다.
    emit('scheduleCutover', payload);
}

function formatDateTime(value: string) {
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
}
</script>

<style scoped>
.restructure-studio {
    padding: 18px 20px;
    margin-bottom: 16px;
    border: 1px solid #f4c29b;
    border-radius: 18px;
    background:
        radial-gradient(circle at top left, rgba(251, 146, 60, 0.14), transparent 38%),
        linear-gradient(180deg, #fffaf5 0%, #ffffff 100%);
}

.studio-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.studio-title {
    font-size: 16px;
    font-weight: 700;
    color: #7c2d12;
}

.studio-subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: #9a3412;
}

.studio-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 16px;
    margin-top: 16px;
}

.studio-card {
    padding: 16px;
    border: 1px solid #f3e8d8;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.88);
}

.studio-card__title {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
}

.studio-card__subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #6b7280;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.metric-card {
    padding: 12px;
    border-radius: 12px;
    background: #fff7ed;
    border: 1px solid #fdba74;
}

.metric-card__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #9a3412;
}

.metric-card__value {
    margin-top: 10px;
    font-size: 22px;
    font-weight: 700;
    color: #7c2d12;
}

.summary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #374151;
}

.approval-pack {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px dashed #c084fc;
    background: #faf5ff;
}

.approval-pack__title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #7c3aed;
}

.approval-pack__body {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #4c1d95;
}

.approval-pack__meta {
    margin-top: 6px;
    font-size: 11px;
    color: #6d28d9;
}

.draft-card {
    padding: 14px 16px;
    border: 1px solid #c7d2fe;
    border-radius: 14px;
    background: #eef2ff;
}

.draft-card__title {
    font-size: 14px;
    font-weight: 700;
    color: #312e81;
}

.draft-card__subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #4338ca;
}

.draft-card__meta {
    font-size: 12px;
    color: #4f46e5;
}

.studio-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
}

@media (max-width: 980px) {
    .studio-header {
        flex-direction: column;
    }

    .studio-grid {
        grid-template-columns: 1fr;
    }

    .metric-grid {
        grid-template-columns: 1fr;
    }

    .studio-actions {
        justify-content: stretch;
    }
}
</style>
