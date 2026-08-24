<template>
    <div class="restructure-studio">
        <div class="studio-header">
            <div>
                <div class="studio-title">Re-structuring Mode</div>
                <div class="studio-subtitle">
                    영향도 분석, orphan transfer, target architecture draft, 점검 모드 cut-over를 한 흐름으로 다룹니다.
                </div>
            </div>
            <div class="d-flex align-center flex-wrap ga-2">
                <v-chip size="small" :color="maintenanceEnabled ? 'error' : 'grey'" variant="flat">
                    {{ maintenanceEnabled ? '점검 모드 활성' : '점검 모드 비활성' }}
                </v-chip>
                <v-btn size="small" variant="text" class="text-none" @click="$emit('openSystemOps')">
                    점검 모드 설정
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

                <template v-else-if="selectedOperation === 'add-major'">
                    <v-select
                        v-model="targetMegaId"
                        :items="megaOptions"
                        item-title="label"
                        item-value="value"
                        label="추가할 Mega"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-text-field
                        v-model="newMajorName"
                        label="새 Major 이름"
                        placeholder="예: 고객 접점 운영"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-select
                        v-if="domainOptions.length > 0"
                        v-model="newMajorDomain"
                        :items="domainOptions"
                        item-title="label"
                        item-value="value"
                        label="도메인"
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
                <template v-else-if="selectedOperation === 'delete-mega'">
                    <v-select
                        v-model="selectedMegaId"
                        :items="megaOptions"
                        item-title="label"
                        item-value="value"
                        label="삭제할 Mega"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mt-3"
                    />
                    <v-select
                        v-if="selectedMegaMajorCount > 0"
                        v-model="targetMegaId"
                        :items="megaTransferTargetOptions"
                        item-title="label"
                        item-value="value"
                        label="Major Transfer Target Mega"
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
                    {{ orphanRiskMessage }}
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
                        <v-chip size="small" :color="draftApprovalStatusColor" variant="tonal">{{ draftApprovalStatusLabel }}</v-chip>
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
            <v-btn variant="outlined" class="text-none" @click="$emit('openReviewBoard', selectedDraftJob?.id || '')">
                <v-icon start size="14">mdi-shield-check-outline</v-icon>
                특별 결재 라인 검토
            </v-btn>
            <v-btn
                color="deep-orange"
                variant="flat"
                class="text-none"
                :disabled="!draftPayload || !maintenanceEnabled || selectedDraftJob?.approval_status !== 'approved'"
                @click="$emit('applyDraft', draftPayload)"
            >
                <v-icon start size="14">mdi-rocket-launch-outline</v-icon>
                점검 모드 Cut-over 적용
            </v-btn>
        </div>

        <v-alert
            v-if="draftPayload && selectedDraftJob?.approval_status !== 'approved'"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
        >
            특별 결재 라인에서 승인 완료 후 cut-over를 적용할 수 있습니다.
        </v-alert>
        <v-alert
            v-else-if="draftPayload && !maintenanceEnabled"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
        >
            cut-over 적용 전 `Admin System Operations`에서 점검 모드를 활성화해야 합니다.
        </v-alert>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { generateProcessId, getNextSequenceFromIds } from '@/utils/processIdGenerator';
import { formatKST, formatDateKST, todayKST } from '@/utils/datetime';

const LOCAL_DRAFT_KEY = 'process_architecture_restructure_drafts';

type RestructureOperation = 'rename-mega' | 'move-major' | 'add-major' | 'delete-major' | 'delete-mega';

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

interface MaintenanceMode {
    enabled?: boolean;
    message?: string;
    activated_by?: string;
    activated_at?: string;
}

const props = defineProps<{
    procMap: any;
    domains?: any[];
    maintenanceMode?: MaintenanceMode | null;
    cutoverJobs?: any[];
}>();
const maintenanceEnabled = computed<boolean>(() => props.maintenanceMode?.enabled === true);

const emit = defineEmits<{
    (e: 'applyDraft', payload: RestructureDraftPayload): void;
    (e: 'scheduleCutover', payload: RestructureDraftPayload): void;
    (e: 'openSystemOps'): void;
    (e: 'openReviewBoard', jobId?: string): void;
}>();

const selectedOperation = ref<RestructureOperation>('rename-mega');
const selectedMegaId = ref('');
const selectedMajorId = ref('');
const targetMegaId = ref('');
const transferTargetMajorId = ref('');
const newMegaName = ref('');
const newMajorName = ref('');
const newMajorDomain = ref('');
const draftPayload = ref<RestructureDraftPayload | null>(null);
const canAutoRestoreDraft = ref(true);

const operationOptions = [
    { value: 'rename-mega', label: 'Mega Rename' },
    { value: 'move-major', label: 'Major Move' },
    { value: 'add-major', label: 'Major Add' },
    { value: 'delete-major', label: 'Major Delete + Transfer' },
    { value: 'delete-mega', label: 'Mega Delete + Transfer' }
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
const addMajorTargetMega = computed(
    () => (props.procMap?.mega_proc_list || []).find((mega: any) => mega.id === targetMegaId.value) || null
);
const selectedMegaMajorCount = computed(() => (selectedMega.value?.major_proc_list || []).length);

const domainOptions = computed(() =>
    (props.domains || []).map((domain: any) => ({
        value: domain.name || domain.id,
        label: domain.name || domain.id
    }))
);

const targetMegaOptions = computed(() => {
    if (!selectedMajor.value) return megaOptions.value;
    return megaOptions.value.filter((mega) => mega.value !== selectedMajor.value?.megaId);
});

const transferTargetOptions = computed(() => {
    const currentMajorId = selectedMajor.value?.value;
    return majorOptions.value.filter((major) => major.value !== currentMajorId);
});

const megaTransferTargetOptions = computed(() => megaOptions.value.filter((mega) => mega.value !== selectedMegaId.value));
const selectedDraftJob = computed<any>(() => {
    const draftId = draftPayload.value?.id;
    if (!draftId) return null;
    return (props.cutoverJobs || []).find((job: any) => job.draft_id === draftId || job.id === `cutover-${draftId}`) || null;
});
const draftApprovalStatusLabel = computed(() => {
    const status = selectedDraftJob.value?.approval_status || 'pending';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
});
const draftApprovalStatusColor = computed(() => {
    const status = selectedDraftJob.value?.approval_status || 'pending';
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'error';
    return 'warning';
});
const orphanRiskMessage = computed(() =>
    selectedOperation.value === 'delete-mega'
        ? '삭제 대상 Mega에 하위 Major가 있어 transfer target이 없으면 구조 손실이 발생합니다.'
        : '삭제 대상 Major에 하위 프로세스가 있어 transfer mapping이 없으면 orphan가 발생합니다.'
);

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

    if (selectedOperation.value === 'add-major') {
        const targetMega = addMajorTargetMega.value;
        return {
            impactedMegaCount: targetMega ? 1 : 0,
            impactedMajorCount: targetMega ? 1 : 0,
            impactedSubCount: 0,
            orphanRisk: false,
            summaryLines: targetMega
                ? [
                      `${targetMega.name || targetMega.id}에 Major ${newMajorName.value.trim() || '새 Major'}가 추가됩니다.`,
                      newMajorDomain.value
                          ? `도메인 ${newMajorDomain.value} 기준으로 계층도에 배치됩니다.`
                          : '도메인 미지정 상태로 추가됩니다.'
                  ]
                : ['Major를 추가할 Mega를 선택하면 영향 범위를 계산합니다.']
        };
    }

    if (selectedOperation.value === 'delete-mega') {
        const mega = selectedMega.value;
        const requiresTransfer = (mega?.major_proc_list || []).length > 0 && !targetMegaId.value;
        const transferTarget = megaTransferTargetOptions.value.find((item) => item.value === targetMegaId.value);
        const impactedSubCount = (mega?.major_proc_list || []).reduce(
            (sum: number, major: any) => sum + ((major.sub_proc_list || []).length || 0),
            0
        );
        return {
            impactedMegaCount: mega ? 1 : 0,
            impactedMajorCount: mega ? (mega.major_proc_list || []).length : 0,
            impactedSubCount: mega ? impactedSubCount : 0,
            orphanRisk: requiresTransfer,
            summaryLines: mega
                ? [
                      `${mega.name || mega.id} Mega가 삭제됩니다.`,
                      mega.major_proc_list?.length
                          ? transferTarget
                              ? `하위 Major ${mega.major_proc_list.length}개와 Sub-process ${impactedSubCount}개는 ${transferTarget.label}로 이관됩니다.`
                              : `하위 Major ${mega.major_proc_list.length}개가 있어 transfer target이 없으면 구조 손실이 발생합니다.`
                          : '하위 Major가 없어 바로 삭제할 수 있습니다.'
                  ]
                : ['삭제할 Mega를 선택하면 영향 범위를 계산합니다.']
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
        if (!targetMegaOptions.value.some((mega) => mega.value === targetMegaId.value)) return '현재 소속과 다른 목적 Mega를 선택하세요.';
        return '';
    }

    if (selectedOperation.value === 'add-major') {
        if (!targetMegaId.value) return 'Major를 추가할 Mega를 선택하세요.';
        if (!megaOptions.value.some((mega) => mega.value === targetMegaId.value)) return 'Major를 추가할 Mega를 선택하세요.';
        if (!newMajorName.value.trim()) return '새 Major 이름을 입력하세요.';
        if (domainOptions.value.length > 0 && !newMajorDomain.value) return '도메인을 선택하세요.';
        return '';
    }

    if (selectedOperation.value === 'delete-mega') {
        if (!selectedMegaId.value) return '삭제할 Mega를 선택하세요.';
        if (selectedMegaMajorCount.value > 0 && !targetMegaId.value) {
            return '하위 Major 이관 대상 Mega를 선택해야 삭제할 수 있습니다.';
        }
        if (targetMegaId.value && !megaTransferTargetOptions.value.some((mega) => mega.value === targetMegaId.value)) {
            return '삭제 대상과 다른 Mega를 이관 대상으로 선택하세요.';
        }
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
            ? `Mega rename: ${selectedMega.value?.name || '미선택'} → ${newMegaName.value.trim() || '새 이름'}`
            : selectedOperation.value === 'move-major'
            ? `Major move: ${selectedMajor.value?.label || '미선택'}`
            : selectedOperation.value === 'add-major'
            ? `Major add: ${newMajorName.value.trim() || '새 Major'}`
            : selectedOperation.value === 'delete-mega'
            ? `Mega delete: ${selectedMega.value?.name || '미선택'}`
            : `Major delete: ${selectedMajor.value?.label || '미선택'}`,
    versionLabel: draftPayload.value?.versionLabel || `r-${todayKST()}`
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
        if (selectedOperation.value === 'add-major' && !targetMegaId.value && options.length > 0) {
            targetMegaId.value = options[0].value;
        }
        if (selectedOperation.value === 'delete-mega' && !targetMegaId.value && megaTransferTargetOptions.value.length > 0) {
            targetMegaId.value = megaTransferTargetOptions.value[0].value;
        }
    },
    { immediate: true }
);

watch(
    domainOptions,
    (options) => {
        if (!newMajorDomain.value && options.length > 0) {
            newMajorDomain.value = options[0].value;
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

watch(
    [selectedOperation, selectedMegaId, selectedMajorId, targetMegaId, transferTargetMajorId, newMegaName, newMajorName, newMajorDomain],
    () => {
        if (draftPayload.value) {
            canAutoRestoreDraft.value = false;
        }
        draftPayload.value = null;
    }
);

watch(selectedOperation, (operation) => {
    if (operation === 'move-major') {
        targetMegaId.value = '';
    } else if (operation === 'add-major' && !targetMegaId.value && megaOptions.value.length > 0) {
        targetMegaId.value = megaOptions.value[0].value;
    } else if (operation === 'delete-mega') {
        targetMegaId.value = megaTransferTargetOptions.value[0]?.value || '';
    }
});

watch(selectedMajorId, () => {
    transferTargetMajorId.value = '';
    if (selectedOperation.value === 'move-major') {
        targetMegaId.value = '';
    }
});

watch(selectedMegaId, () => {
    if (selectedOperation.value === 'delete-mega') {
        if (!megaTransferTargetOptions.value.some((mega) => mega.value === targetMegaId.value)) {
            targetMegaId.value = megaTransferTargetOptions.value[0]?.value || '';
        }
    }
});

function cloneProcMap() {
    return JSON.parse(JSON.stringify(props.procMap || { mega_proc_list: [] }));
}

function collectMajorIds(map: any): string[] {
    const ids: string[] = [];
    for (const mega of map?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            if (major.id) ids.push(String(major.id));
        }
    }
    return ids;
}

function createNextMajorId(map: any): string {
    return generateProcessId('major', getNextSequenceFromIds(collectMajorIds(map), 'major'));
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

    if (selectedOperation.value === 'add-major') {
        const targetMega = (nextMap.mega_proc_list || []).find((mega: any) => mega.id === targetMegaId.value);
        if (targetMega) {
            targetMega.major_proc_list = [...(targetMega.major_proc_list || [])];
            targetMega.major_proc_list.push({
                id: createNextMajorId(nextMap),
                name: newMajorName.value.trim(),
                domain: newMajorDomain.value || undefined,
                ...(newMajorDomain.value ? { domain_id: newMajorDomain.value } : {}),
                sub_proc_list: []
            });
        }
        return nextMap;
    }

    if (selectedOperation.value === 'delete-mega') {
        const megaIndex = (nextMap.mega_proc_list || []).findIndex((mega: any) => mega.id === selectedMegaId.value);
        if (megaIndex < 0) return nextMap;

        const removedMega = nextMap.mega_proc_list.splice(megaIndex, 1)[0];
        if ((removedMega?.major_proc_list || []).length > 0) {
            const targetMega = (nextMap.mega_proc_list || []).find((mega: any) => mega.id === targetMegaId.value);
            if (targetMega) {
                targetMega.major_proc_list = [...(targetMega.major_proc_list || []), ...(removedMega.major_proc_list || [])];
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
            // 이동되는 sub의 pid를 새 major 기준으로 재계산
            const existingSubs = targetMajor.sub_proc_list || [];
            const prefix = targetMajor.id + '.';
            let maxIndex = 0;
            for (const sub of existingSubs) {
                const pid = sub.pid || sub.id || '';
                if (pid.startsWith(prefix)) {
                    const suffix = pid.slice(prefix.length);
                    if (!suffix.includes('.')) {
                        const n = parseInt(suffix, 10);
                        if (!isNaN(n) && n > maxIndex) maxIndex = n;
                    }
                }
            }
            const transferredSubs = (removedMajor.sub_proc_list || []).map((sub: any) => {
                maxIndex++;
                return { ...sub, pid: `${targetMajor.id}.${maxIndex}` };
            });
            targetMajor.sub_proc_list = [...existingSubs, ...transferredSubs];
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

function readPersistedDrafts(): RestructureDraftPayload[] {
    try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        console.error('Failed to read persisted restructure drafts:', e);
        return [];
    }
}

function hydrateDraftFromJob(job: any): RestructureDraftPayload | null {
    if (!job?.draft_id || !job?.draft_map) return null;
    return {
        id: job.draft_id,
        createdAt: job.created_at || new Date().toISOString(),
        operation: job.operation,
        summary: job.summary || '',
        approvalType: job.approval_type || 'structure_restructure',
        approvalTitle: job.approval_title || job.summary || '',
        versionLabel: job.version_label || '',
        map: job.draft_map,
        changeSummary: Array.isArray(job.change_summary) ? job.change_summary : [],
        beforeSnapshot: {
            megaCount: job.before_snapshot?.mega_count || 0,
            majorCount: job.before_snapshot?.major_count || 0,
            subCount: job.before_snapshot?.sub_count || 0,
            highlights: job.before_snapshot?.highlights || []
        },
        afterSnapshot: {
            megaCount: job.after_snapshot?.mega_count || 0,
            majorCount: job.after_snapshot?.major_count || 0,
            subCount: job.after_snapshot?.sub_count || 0,
            highlights: job.after_snapshot?.highlights || []
        },
        blastRadius: {
            impactedMegaCount: job.impacted_mega_count || 0,
            impactedMajorCount: job.impacted_major_count || 0,
            impactedSubCount: job.impacted_sub_count || 0,
            orphanRisk: false
        }
    };
}

function restoreLatestDraft() {
    if (!canAutoRestoreDraft.value || draftPayload.value) return;

    const jobs = Array.isArray(props.cutoverJobs) ? props.cutoverJobs : [];
    const persistedDrafts = readPersistedDrafts();
    const latestJob = jobs[0] || null;

    if (latestJob?.draft_id) {
        const matchedDraft = persistedDrafts.find((draft) => draft.id === latestJob.draft_id);
        if (matchedDraft) {
            draftPayload.value = matchedDraft;
            return;
        }
    }

    if (persistedDrafts.length > 0) {
        draftPayload.value = persistedDrafts[0];
        return;
    }

    const restoredFromJob = hydrateDraftFromJob(latestJob);
    if (restoredFromJob) {
        draftPayload.value = restoredFromJob;
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
        versionLabel: `target-${formatDateKST(now)}`,
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
    canAutoRestoreDraft.value = false;
    persistDraft(payload);
    // Draft 생성 시 cut-over 예정 job을 scheduled 상태로 남겨 운영자가 추적할 수 있게 한다.
    emit('scheduleCutover', payload);
}

function formatDateTime(value: string) {
    try {
        return formatKST(value);
    } catch {
        return value;
    }
}

watch(
    () => props.cutoverJobs,
    () => {
        restoreLatestDraft();
    },
    { deep: true, immediate: true }
);

onMounted(() => {
    restoreLatestDraft();
});
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
