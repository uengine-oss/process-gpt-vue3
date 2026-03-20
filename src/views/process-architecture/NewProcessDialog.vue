<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="660" persistent scrollable>
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center pa-4 pb-2">
                <span class="text-h6">{{ $t('processArchitecture.newProcessDialog.title') }}</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <!-- As-Is / To-Be Toggle -->
            <div class="d-flex align-center justify-center pa-3 pb-0">
                <v-btn-toggle v-model="form.processMode" mandatory density="compact" color="primary" class="mode-toggle">
                    <v-btn value="asis" size="small" min-width="120">
                        <v-icon start size="16">mdi-clock-outline</v-icon>
                        {{ $t('processArchitecture.newProcessDialog.asIs') }}
                    </v-btn>
                    <v-btn value="tobe" size="small" min-width="120">
                        <v-icon start size="16">mdi-rocket-launch-outline</v-icon>
                        {{ $t('processArchitecture.newProcessDialog.toBe') }}
                    </v-btn>
                </v-btn-toggle>
            </div>

            <v-card-text class="pa-4">
                <!-- Process Name -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-1">
                        {{ $t('processArchitecture.newProcessDialog.processName') }} *
                    </label>
                    <v-text-field
                        v-model="form.name"
                        :placeholder="$t('processArchitecture.newProcessDialog.processNamePlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        :rules="[(v) => !!v || $t('processArchitecture.newProcessDialog.nameRequired')]"
                        @update:model-value="onNameInput"
                    />
                    <!-- Similar name warning -->
                    <div v-if="similarProcesses.length > 0" class="mt-1">
                        <div class="text-caption text-orange-darken-2">
                            <v-icon size="14" color="orange-darken-2">mdi-alert-outline</v-icon>
                            {{ $t('processArchitecture.newProcessDialog.similarNameWarning') }}
                        </div>
                        <div v-for="similar in similarProcesses.slice(0, 3)" :key="similar.id" class="text-caption mt-1">
                            <a href="#" class="text-primary" @click.prevent="navigateToSimilar(similar)">{{ similar.name }}</a>
                        </div>
                    </div>
                </div>

                <!-- Hierarchy Location -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.hierarchyLocation') }} *
                    </label>
                    <!-- AI Suggestion Banner -->
                    <v-alert
                        v-if="aiSuggestion"
                        density="compact"
                        variant="tonal"
                        color="primary"
                        icon="mdi-lightbulb-outline"
                        class="mb-2"
                        closable
                        @click:close="aiSuggestion = null"
                    >
                        <div class="d-flex align-center justify-space-between flex-wrap ga-1">
                            <span class="text-caption">
                                {{ $t('processArchitecture.newProcessDialog.aiSuggestion') }}:
                                <strong>{{ aiSuggestion.domainName }}</strong> &rsaquo;
                                <strong>{{ aiSuggestion.megaName }}</strong> &rsaquo;
                                <strong>{{ aiSuggestion.majorName }}</strong>
                            </span>
                            <v-btn size="x-small" color="primary" variant="flat" @click="applySuggestion">
                                {{ $t('processArchitecture.newProcessDialog.applySuggestion') }}
                            </v-btn>
                        </div>
                    </v-alert>
                    <v-row dense>
                        <v-col cols="4">
                            <v-select
                                v-model="form.domain"
                                :items="domainOptions"
                                item-title="name"
                                item-value="name"
                                :label="$t('processArchitecture.newProcessDialog.domain')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                @update:model-value="onDomainChange"
                            >
                                <template #item="{ item, props: itemProps }">
                                    <v-list-item v-bind="itemProps">
                                        <template #append>
                                            <v-chip
                                                v-if="aiSuggestion && aiSuggestion.domainName === item.raw.name"
                                                size="x-small"
                                                color="primary"
                                                variant="tonal"
                                                class="ml-1"
                                            >
                                                {{ $t('processArchitecture.newProcessDialog.recommended') }}
                                            </v-chip>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="4">
                            <v-select
                                v-model="form.mega"
                                :items="megaOptions"
                                item-title="name"
                                item-value="id"
                                :label="$t('processArchitecture.newProcessDialog.megaProcess')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                :disabled="!form.domain"
                            >
                                <template #item="{ item, props: itemProps }">
                                    <v-list-item v-bind="itemProps">
                                        <template #append>
                                            <v-chip
                                                v-if="aiSuggestion && aiSuggestion.megaId === item.raw.id"
                                                size="x-small"
                                                color="primary"
                                                variant="tonal"
                                                class="ml-1"
                                            >
                                                {{ $t('processArchitecture.newProcessDialog.recommended') }}
                                            </v-chip>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="4">
                            <v-select
                                v-model="form.major"
                                :items="majorOptions"
                                item-title="name"
                                item-value="id"
                                :label="$t('processArchitecture.newProcessDialog.majorProcess')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                :disabled="!form.mega"
                            >
                                <template #item="{ item, props: itemProps }">
                                    <v-list-item v-bind="itemProps">
                                        <template #append>
                                            <v-chip
                                                v-if="aiSuggestion && aiSuggestion.majorId === item.raw.id"
                                                size="x-small"
                                                color="primary"
                                                variant="tonal"
                                                class="ml-1"
                                            >
                                                {{ $t('processArchitecture.newProcessDialog.recommended') }}
                                            </v-chip>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>
                    <div v-if="!form.domain || !form.mega || !form.major" class="text-caption text-grey mt-1">
                        {{ $t('processArchitecture.newProcessDialog.hierarchyRequired') }}
                    </div>
                    <!-- Auto-generated PID preview -->
                    <div v-if="previewPid" class="d-flex align-center mt-1 ga-1">
                        <v-icon size="14" color="primary">mdi-tag-outline</v-icon>
                        <span class="text-caption text-primary font-weight-medium">
                            {{ $t('processArchitecture.newProcessDialog.pidPreview') }}: {{ previewPid }}
                        </span>
                    </div>
                </div>

                <!-- Owners -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.owners') }}
                    </label>
                    <v-row dense>
                        <v-col cols="12" class="mb-2">
                            <v-autocomplete
                                v-model="form.primaryOwner"
                                :items="userOptions"
                                item-title="label"
                                item-value="email"
                                :label="$t('processArchitecture.newProcessDialog.primaryOwner')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                :placeholder="$t('processArchitecture.newProcessDialog.ownerPlaceholder')"
                            />
                        </v-col>
                        <v-col cols="12" class="mb-2">
                            <v-autocomplete
                                v-model="form.coOwners"
                                :items="coOwnerOptions"
                                item-title="label"
                                item-value="email"
                                :label="$t('processArchitecture.newProcessDialog.coOwner')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                multiple
                                chips
                                closable-chips
                                :placeholder="$t('processArchitecture.newProcessDialog.coOwnerPlaceholder')"
                            />
                        </v-col>
                        <v-col cols="12">
                            <v-autocomplete
                                v-model="form.master"
                                :items="userOptions"
                                item-title="label"
                                item-value="email"
                                :label="$t('processArchitecture.newProcessDialog.master')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                :placeholder="$t('processArchitecture.newProcessDialog.masterPlaceholder')"
                            />
                        </v-col>
                    </v-row>
                </div>

                <!-- Creation Type (As-Is only) -->
                <div v-if="form.processMode === 'asis'" class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.creationType') }}
                    </label>
                    <v-btn-toggle v-model="form.creationType" mandatory density="compact" color="primary">
                        <v-btn value="scratch" size="small">
                            {{ $t('processArchitecture.newProcessDialog.scratch') }}
                        </v-btn>
                        <v-btn value="template" size="small">
                            {{ $t('processArchitecture.newProcessDialog.template') }}
                        </v-btn>
                        <v-btn value="clone" size="small">
                            {{ $t('processArchitecture.newProcessDialog.clone') }}
                        </v-btn>
                        <v-btn value="upload" size="small">
                            {{ $t('processArchitecture.newProcessDialog.upload') }}
                        </v-btn>
                    </v-btn-toggle>

                    <!-- Info Box -->
                    <v-alert
                        :text="creationTypeInfo"
                        color="info"
                        variant="tonal"
                        density="compact"
                        class="mt-2"
                        icon="mdi-information-outline"
                    />

                    <!-- Template / Clone selector -->
                    <div v-if="form.creationType === 'template' || form.creationType === 'clone'" class="mt-3">
                        <v-autocomplete
                            v-model="form.sourceProcessId"
                            :items="existingProcesses"
                            item-title="name"
                            item-value="id"
                            :label="
                                form.creationType === 'template'
                                    ? $t('processArchitecture.newProcessDialog.selectTemplate')
                                    : $t('processArchitecture.newProcessDialog.selectCloneSource')
                            "
                            variant="outlined"
                            density="compact"
                            hide-details
                            clearable
                        />
                    </div>

                    <div v-else-if="form.creationType === 'upload'" class="mt-3">
                        <div class="upload-card">
                            <div class="text-body-2 text-medium-emphasis mb-3">
                                {{ $t('processArchitecture.newProcessDialog.uploadHint') }}
                            </div>
                            <div class="d-flex align-center justify-space-between flex-wrap ga-3">
                                <div class="min-w-0">
                                    <div class="text-subtitle-2">
                                        {{
                                            uploadedBpmnFileName ||
                                            ($t('processArchitecture.newProcessDialog.uploadRequired') || 'BPMN XML 파일을 업로드해야 생성할 수 있습니다.')
                                        }}
                                    </div>
                                    <div v-if="uploadedBpmnFileName" class="text-caption text-medium-emphasis mt-1">
                                        {{ $t('processArchitecture.newProcessDialog.selectedUploadFile') || '선택된 파일' }}:
                                        {{ uploadedBpmnFileName }}
                                    </div>
                                </div>
                                <div class="d-flex align-center flex-wrap ga-2">
                                    <v-btn color="primary" variant="outlined" size="small" prepend-icon="mdi-upload" @click="triggerBpmnUpload">
                                        {{
                                            uploadedBpmnFileName
                                                ? $t('processArchitecture.newProcessDialog.replaceUploadFile') || '다른 파일 선택'
                                                : $t('processArchitecture.newProcessDialog.selectUploadFile') || 'BPMN 파일 선택'
                                        }}
                                    </v-btn>
                                    <v-btn v-if="uploadedBpmnFileName" variant="text" size="small" @click="clearUploadedBpmn">
                                        {{ $t('common.reset') || '초기화' }}
                                    </v-btn>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Source Mapping (To-Be only) -->
                <div v-if="form.processMode === 'tobe'" class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-2">
                        {{ $t('processArchitecture.newProcessDialog.sourceMapping') }}
                    </label>
                    <v-alert
                        :text="$t('processArchitecture.newProcessDialog.sourceMappingInfo')"
                        color="info"
                        variant="tonal"
                        density="compact"
                        class="mb-3"
                        icon="mdi-information-outline"
                    />
                    <v-autocomplete
                        v-model="form.sourceMappings"
                        :items="existingProcesses"
                        item-title="name"
                        item-value="id"
                        :label="$t('processArchitecture.newProcessDialog.selectSourceProcesses')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        clearable
                        multiple
                        chips
                        closable-chips
                        :placeholder="$t('processArchitecture.newProcessDialog.sourceMappingPlaceholder')"
                    />
                </div>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn variant="text" @click="close">
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn color="primary" variant="flat" :disabled="!canCreate" :loading="creating" @click="createProcess">
                    {{ $t('processArchitecture.newProcessDialog.createAndOpen') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <input ref="bpmnFileInput" type="file" accept=".bpmn,.xml" style="display: none" @change="handleBpmnUploadChange" />

    <!-- Error Snackbar -->
    <v-snackbar v-model="errorSnackbar" color="error" :timeout="4000" location="top">
        {{ errorMessage }}
        <template #actions>
            <v-btn variant="text" @click="errorSnackbar = false">{{ $t('common.close') }}</v-btn>
        </template>
    </v-snackbar>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { generateProcessId, isPidInUse } from './processIdUtils';

const props = defineProps<{
    modelValue: boolean;
    procMap: any;
    domains: any[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'created', proc: { id: string; name: string }): void;
}>();

const backend = BackendFactory.createBackend() as any;
const instance = getCurrentInstance();

function translate(key: string, fallback: string) {
    const value = (instance?.proxy as any)?.$t?.(key);
    return value && value !== key ? value : fallback;
}

const form = ref({
    processMode: 'asis' as 'asis' | 'tobe',
    name: '',
    domain: null as string | null,
    mega: null as string | null,
    major: null as string | null,
    primaryOwner: null as string | null,
    coOwners: [] as string[],
    master: null as string | null,
    creationType: 'scratch' as 'scratch' | 'template' | 'clone' | 'upload',
    sourceProcessId: null as string | null,
    sourceMappings: [] as string[]
});

const creating = ref(false);
const existingProcesses = ref<any[]>([]);
const userOptions = ref<any[]>([]);
const nameCheckTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const similarProcesses = ref<any[]>([]);
const errorSnackbar = ref(false);
const errorMessage = ref('');
const bpmnFileInput = ref<HTMLInputElement | null>(null);
const uploadedBpmnXml = ref('');
const uploadedBpmnFileName = ref('');

// AI suggestion state
interface AiSuggestion {
    domainName: string;
    megaId: string;
    megaName: string;
    majorId: string;
    majorName: string;
    score: number;
}
const aiSuggestion = ref<AiSuggestion | null>(null);
const suggestionTimer = ref<ReturnType<typeof setTimeout> | null>(null);

/** 프로세스 목록 조회 (tenant_id 필터 포함) */
async function collectBpmnDefinitionsOnly(): Promise<{ id: string; name: string }[]> {
    try {
        const list = await (backend as any).listDefinitionStatusLite('');
        return (list || []).map((item: any) => ({
            id: String(item.id || ''),
            name: item.name || item.id || ''
        }));
    } catch (e) {
        console.error('Failed to collect BPMN definitions:', e);
        return [];
    }
}

/** 조직도 트리에서 사용자(isTeam이 아닌) 노드를 평탄화하여 추출 */
function extractUsersFromOrgTree(node: any, teamName = ''): { email: string; label: string }[] {
    if (!node) return [];
    const isTeam = node.data?.isTeam;
    const currentTeam = isTeam ? (node.data?.name || node.id) : teamName;
    const users: { email: string; label: string }[] = [];
    if (!isTeam && node.data) {
        const email = node.data.email || node.data.id || node.id;
        const name = node.data.name || node.id;
        users.push({ email, label: currentTeam ? `${name} (${currentTeam})` : name });
    }
    if (node.children?.length) {
        for (const child of node.children) {
            users.push(...extractUsersFromOrgTree(child, currentTeam));
        }
    }
    return users;
}

/** 조직도에서 사용자 목록 불러오기 */
async function loadUsersFromOrgChart(): Promise<{ email: string; label: string }[]> {
    try {
        const orgData = await backend.getData('configuration', { match: { key: 'organization' } });
        if (!orgData?.value) return [];
        const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
        const chart = orgValue.chart || orgValue;
        if (!chart) return [];
        return extractUsersFromOrgTree(chart);
    } catch (e) {
        console.error('Failed to load org chart users:', e);
        return [];
    }
}

// Load existing processes and users when dialog opens
watch(
    () => props.modelValue,
    async (open) => {
        if (open) {
            try {
                const [bpmnDefs, users] = await Promise.all([
                    collectBpmnDefinitionsOnly(),
                    loadUsersFromOrgChart()
                ]);
                existingProcesses.value = bpmnDefs;
                userOptions.value = users;
            } catch (e) {
                console.error('Failed to load data:', e);
            }
        }
    }
);

const domainOptions = computed(() => props.domains || []);

const megaOptions = computed(() => {
    if (!props.procMap?.mega_proc_list) return [];
    return props.procMap.mega_proc_list.map((m: any) => ({ id: m.id, name: m.name }));
});

const majorOptions = computed(() => {
    if (!form.value.mega || !props.procMap?.mega_proc_list) return [];
    const mega = props.procMap.mega_proc_list.find((m: any) => m.id === form.value.mega);
    if (!mega) return [];
    return (mega.major_proc_list || []).map((m: any) => ({ id: m.id, name: m.name }));
});

// Co-owner options: exclude primary owner and master
const coOwnerOptions = computed(() => {
    return userOptions.value.filter((u) => u.email !== form.value.primaryOwner && u.email !== form.value.master);
});

// Reset cascading selects when domain changes
function onDomainChange() {
    form.value.mega = null;
    form.value.major = null;
}

// Reset major when mega changes
watch(
    () => form.value.mega,
    () => {
        form.value.major = null;
    }
);

// Debounced name similarity check + AI suggestion
function onNameInput() {
    if (nameCheckTimer.value) clearTimeout(nameCheckTimer.value);
    if (suggestionTimer.value) clearTimeout(suggestionTimer.value);
    similarProcesses.value = [];
    aiSuggestion.value = null;
    const name = form.value.name.trim();
    if (name.length < 2) return;
    nameCheckTimer.value = setTimeout(() => {
        checkSimilarNames(name);
    }, 500);
    suggestionTimer.value = setTimeout(() => {
        computeAiSuggestion(name);
    }, 500);
}

/** Compute location suggestion by keyword-matching existing sub-processes */
function computeAiSuggestion(name: string) {
    if (!props.procMap?.mega_proc_list) return;
    const lowerName = name.toLowerCase();
    const keywords = lowerName.split(/[\s\-_]+/).filter((k) => k.length >= 2);
    if (keywords.length === 0) return;

    let bestScore = 0;
    let bestMega: any = null;
    let bestMajor: any = null;
    let bestDomainName = '';

    for (const mega of props.procMap.mega_proc_list) {
        for (const major of mega.major_proc_list || []) {
            for (const sub of major.sub_proc_list || []) {
                const subName = (sub.name || '').toLowerCase();
                const score = computeKeywordScore(keywords, subName);
                if (score > bestScore) {
                    bestScore = score;
                    bestMega = mega;
                    bestMajor = major;
                    bestDomainName = major.domain || major.domain_id || mega.name || '';
                }
            }
            // Also score against major name itself
            const majorScore = computeKeywordScore(keywords, (major.name || '').toLowerCase());
            if (majorScore > bestScore) {
                bestScore = majorScore;
                bestMega = mega;
                bestMajor = major;
                bestDomainName = major.domain || major.domain_id || mega.name || '';
            }
        }
    }

    if (bestScore > 0 && bestMega && bestMajor) {
        // Find the actual domain name from domains prop
        const domainObj = props.domains?.find((d: any) => d.name === bestDomainName || d.id === bestDomainName);
        aiSuggestion.value = {
            domainName: domainObj?.name || bestDomainName,
            megaId: bestMega.id,
            megaName: bestMega.name,
            majorId: bestMajor.id,
            majorName: bestMajor.name,
            score: bestScore
        };
    }
}

function computeKeywordScore(keywords: string[], target: string): number {
    let score = 0;
    for (const kw of keywords) {
        if (target.includes(kw)) score += kw.length;
    }
    return score;
}

function applySuggestion() {
    if (!aiSuggestion.value) return;
    form.value.domain = aiSuggestion.value.domainName;
    form.value.mega = aiSuggestion.value.megaId;
    // major options depend on mega, so we set major after mega is set
    // Use nextTick-like approach: wait one microtask for computed majorOptions to update
    Promise.resolve().then(() => {
        form.value.major = aiSuggestion.value!.majorId;
    });
}

function checkSimilarNames(name: string) {
    const lowerName = name.toLowerCase();
    const matches = existingProcesses.value.filter((p) => {
        const pName = (p.name || '').toLowerCase();
        // Check substring match or close similarity
        if (pName.includes(lowerName) || lowerName.includes(pName)) return true;
        // Simple character overlap check (>60% overlap)
        return levenshteinSimilarity(lowerName, pName) > 0.6;
    });
    similarProcesses.value = matches.slice(0, 5);
}

function levenshteinSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = levenshteinDistance(a, b);
    return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
    const m = a.length,
        n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function navigateToSimilar(process: { id: string; name: string }) {
    window.open(`/definitions/chat?id=${process.id}&name=${encodeURIComponent(process.name)}&modeling=true`, '_blank');
}

function validateBpmnXml(xml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('invalid xml');
    }

    const rootName = doc.documentElement?.localName?.toLowerCase();
    if (rootName !== 'definitions') {
        throw new Error('invalid bpmn definitions');
    }

    return doc;
}

function getFirstProcessNode(doc: Document) {
    return Array.from(doc.getElementsByTagName('*')).find((node) => node.localName?.toLowerCase() === 'process') || null;
}

function triggerBpmnUpload() {
    bpmnFileInput.value?.click();
}

function clearUploadedBpmn() {
    uploadedBpmnXml.value = '';
    uploadedBpmnFileName.value = '';
}

async function handleBpmnUploadChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (input) {
        input.value = '';
    }

    try {
        const xml = String((await file.text()) || '').trim();
        if (!xml) {
            throw new Error('empty xml');
        }

        const doc = validateBpmnXml(xml);
        uploadedBpmnXml.value = xml;
        uploadedBpmnFileName.value = file.name;

        if (!form.value.name.trim()) {
            const processNode = getFirstProcessNode(doc);
            const uploadedName = processNode?.getAttribute('name') || processNode?.getAttribute('id') || '';
            if (uploadedName) {
                form.value.name = uploadedName;
                onNameInput();
            }
        }
        errorSnackbar.value = false;
        errorMessage.value = '';
    } catch (e) {
        console.error('Failed to load BPMN upload:', e);
        clearUploadedBpmn();
        errorMessage.value = translate(
            'processArchitecture.newProcessDialog.invalidUploadFile',
            '유효한 BPMN XML 파일만 업로드할 수 있습니다.'
        );
        errorSnackbar.value = true;
    }
}

const creationTypeInfo = computed(() => {
    switch (form.value.creationType) {
        case 'scratch':
            return translate('processArchitecture.newProcessDialog.scratchInfo', '새로운 빈 캔버스에서 프로세스를 처음부터 설계합니다.');
        case 'template':
            return translate('processArchitecture.newProcessDialog.templateInfo', '기존 표준 템플릿을 기반으로 프로세스를 빠르게 시작합니다.');
        case 'clone':
            return translate('processArchitecture.newProcessDialog.cloneInfo', '기존 프로세스를 복사하여 유사한 프로세스를 효율적으로 생성합니다.');
        case 'upload':
            return translate('processArchitecture.newProcessDialog.uploadInfo', 'BPMN/XML 파일을 바로 올려 새 프로세스를 생성합니다.');
        default:
            return '';
    }
});

// Auto-generated PID preview (shown when mega+major are selected)
const previewPid = computed(() => {
    if (!form.value.mega || !form.value.major) return '';
    return generateProcessId(props.procMap, form.value.mega, form.value.major);
});

const canCreate = computed(() => {
    if (!form.value.name.trim()) return false;
    if (!form.value.domain || !form.value.mega || !form.value.major) return false;
    if (form.value.processMode === 'asis') {
        if (form.value.creationType === 'upload' && !uploadedBpmnXml.value) return false;
        if ((form.value.creationType === 'template' || form.value.creationType === 'clone') && !form.value.sourceProcessId) return false;
    }
    return true;
});

function close() {
    emit('update:modelValue', false);
    resetForm();
}

function resetForm() {
    form.value = {
        processMode: 'asis',
        name: '',
        domain: null,
        mega: null,
        major: null,
        primaryOwner: null,
        coOwners: [],
        master: null,
        creationType: 'scratch',
        sourceProcessId: null,
        sourceMappings: []
    };
    similarProcesses.value = [];
    aiSuggestion.value = null;
    errorSnackbar.value = false;
    errorMessage.value = '';
    clearUploadedBpmn();
}

async function createProcess() {
    if (!canCreate.value) return;
    creating.value = true;
    try {
        let newId: string;
        const name = form.value.name.trim();

        if (form.value.processMode === 'asis' && form.value.creationType !== 'scratch' && form.value.creationType !== 'upload') {
            // Clone/Template: duplicate an existing local process definition
            const sourceId = form.value.sourceProcessId;
            const sourceDef = await backend.getRawDefinition(sourceId);
            if (!sourceDef?.bpmn) {
                throw new Error('원본 프로세스 정의를 불러오지 못했습니다.');
            }

            const result = await backend.duplicateLocalProcess(
                sourceId,
                name,
                sourceDef.bpmn,
                sourceDef.definition || null
            );
            newId = result?.newId || result?.id || result;
        } else {
            // Create new process: save empty BPMN definition
            const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:activiti="http://activiti.org/bpmn"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
  typeLanguage="http://www.w3.org/2001/XMLSchema"
  expressionLanguage="http://www.w3.org/1999/XPath"
  targetNamespace="http://www.activiti.org/test">
  <process id="${name.toLowerCase().replace(/\s+/g, '-')}" name="${name}" isExecutable="true">
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${name}">
    <bpmndi:BPMNPlane id="BPMNPlane_${name}" bpmnElement="${name.toLowerCase().replace(/\s+/g, '-')}">
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;
            const defId = name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const uniqueId = `${defId}-${Date.now()}`;
            const initialBpmn = form.value.processMode === 'asis' && form.value.creationType === 'upload' ? uploadedBpmnXml.value : emptyBpmn;

            await backend.putRawDefinition(initialBpmn, uniqueId, {
                name,
                owner: form.value.primaryOwner || undefined,
                version: '0.1',
                version_tag: null,
                definition: {
                    processDefinitionId: uniqueId,
                    data: [],
                    roles: []
                }
            });
            newId = uniqueId;
        }

        if (newId) {
            // Update proc_map with new process in the right location
            await updateProcMap(newId, name);
            emit('created', { id: newId, name });
        }
        close();
    } catch (e: any) {
        console.error('Failed to create process:', e);
        errorMessage.value = e?.message || String(e) || 'Failed to create process';
        errorSnackbar.value = true;
    } finally {
        creating.value = false;
    }
}

async function updateProcMap(newId: string, name: string) {
    try {
        const currentMap = await backend.getProcessDefinitionMap();
        const map = currentMap && currentMap.mega_proc_list ? currentMap : { mega_proc_list: [] };

        const targetMegaId = form.value.mega;
        const targetMajorId = form.value.major;

        const megaList = map.mega_proc_list || [];
        const megaIndex = megaList.findIndex((m: any) => m.id === targetMegaId);

        if (megaIndex !== -1) {
            const majorList = megaList[megaIndex].major_proc_list || [];
            const majorIndex = majorList.findIndex((m: any) => m.id === targetMajorId);

            if (majorIndex !== -1) {
                if (!majorList[majorIndex].sub_proc_list) {
                    majorList[majorIndex].sub_proc_list = [];
                }

                // Generate PID based on parent hierarchy (auto-incremented)
                // Keep incrementing until a non-duplicate PID is found
                let pid = generateProcessId(map, targetMegaId, targetMajorId);
                if (pid && isPidInUse(map, pid)) {
                    // Find the next available index manually
                    const prefix = targetMajorId + '.';
                    const subList: any[] = majorList[majorIndex].sub_proc_list;
                    const existingIndices: number[] = subList
                        .map((sub: any) => {
                            const id: string = sub.id || '';
                            if (id.startsWith(prefix) && !id.slice(prefix.length).includes('.')) {
                                const n = parseInt(id.slice(prefix.length), 10);
                                return isNaN(n) ? null : n;
                            }
                            return null;
                        })
                        .filter((n): n is number => n !== null);
                    let nextIdx = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;
                    while (isPidInUse(map, `${targetMajorId}.${nextIdx}`)) {
                        nextIdx++;
                    }
                    pid = `${targetMajorId}.${nextIdx}`;
                }

                majorList[majorIndex].sub_proc_list.push({
                    id: newId,
                    proc_def_id: newId,
                    pid: pid || '',
                    name,
                    type: form.value.processMode === 'tobe' ? 'tobe' : 'asis',
                    ...(form.value.primaryOwner ? { owner: form.value.primaryOwner } : {}),
                    ...(form.value.master ? { master: form.value.master } : {}),
                    ...(form.value.coOwners.length > 0 ? { co_owners: form.value.coOwners } : {}),
                    ...(form.value.processMode === 'tobe' && form.value.sourceMappings.length > 0
                        ? { source_mappings: form.value.sourceMappings }
                        : {})
                });
                megaList[megaIndex].major_proc_list = majorList;
                map.mega_proc_list = megaList;
                await backend.putProcessDefinitionMap(map);
            }
        }
    } catch (e) {
        console.error('Failed to update proc_map:', e);
    }
}
</script>

<style scoped>
.mode-toggle :deep(.v-btn) {
    text-transform: none;
    letter-spacing: 0;
}

.upload-card {
    border: 1px dashed rgba(59, 130, 246, 0.35);
    border-radius: 12px;
    padding: 16px;
    background: rgba(59, 130, 246, 0.04);
}
</style>
