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

                <!-- Process Description -->
                <div class="mb-4">
                    <label class="text-subtitle-2 font-weight-semibold d-block mb-1">
                        {{ translate('processArchitecture.newProcessDialog.description', '프로세스 설명') }}
                    </label>
                    <v-textarea
                        v-model="form.description"
                        :placeholder="translate('processArchitecture.newProcessDialog.descriptionPlaceholder', '프로세스 설명을 입력하세요')"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        rows="2"
                        auto-grow
                    />
                </div>

                <!-- Call Activity Subprocess Toggle -->
                <div class="mb-3">
                    <v-checkbox
                        v-model="form.isCallActivitySub"
                        density="compact"
                        hide-details
                        color="primary"
                    >
                        <template #label>
                            <div class="d-flex align-center ga-1">
                                <v-icon size="16" color="blue-grey">mdi-call-split</v-icon>
                                <span class="text-body-2">{{ translate('processArchitecture.newProcessDialog.callActivitySub', '프로세스 모듈 (계층도 미등록)') }}</span>
                            </div>
                        </template>
                    </v-checkbox>
                </div>

                <!-- Hierarchy Location -->
                <div v-if="!form.isCallActivitySub" class="mb-4">
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
                                :items="primaryOwnerOptions"
                                item-title="label"
                                item-value="email"
                                :label="$t('processArchitecture.newProcessDialog.primaryOwner')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                v-model:search="ownerSearchText.primaryOwner"
                                :loading="ownerSearchLoading.primaryOwner"
                                :no-data-text="'이름을 입력해 주세요'"
                                :custom-filter="() => true"
                                :placeholder="$t('processArchitecture.newProcessDialog.ownerPlaceholder')"
                                @update:search="onUserSearch('primaryOwner', $event)"
                                @update:model-value="onOwnerSelectionChange('primaryOwner')"
                            />
                        </v-col>
                        <v-col cols="12" class="mb-2">
                            <v-autocomplete
                                v-model="form.fieldOwners"
                                :items="fieldOwnerOptions"
                                item-title="label"
                                item-value="email"
                                :label="translate('processArchitecture.newProcessDialog.fieldOwners', '현업담당자')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                multiple
                                chips
                                closable-chips
                                v-model:search="ownerSearchText.fieldOwners"
                                :loading="ownerSearchLoading.fieldOwners"
                                :no-data-text="'이름을 입력해 주세요'"
                                :custom-filter="() => true"
                                :placeholder="
                                    translate('processArchitecture.newProcessDialog.fieldOwnerPlaceholder', '현업 담당자를 선택하세요')
                                "
                                @update:search="onUserSearch('fieldOwners', $event)"
                                @update:model-value="onOwnerSelectionChange('fieldOwners')"
                            />
                        </v-col>
                        <v-col cols="12" class="mb-2">
                            <v-autocomplete
                                v-model="form.hqOwners"
                                :items="hqOwnerOptions"
                                item-title="label"
                                item-value="email"
                                :label="translate('processArchitecture.newProcessDialog.hqOwners', '검토담당자')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                multiple
                                chips
                                closable-chips
                                v-model:search="ownerSearchText.hqOwners"
                                :loading="ownerSearchLoading.hqOwners"
                                :no-data-text="'이름을 입력해 주세요'"
                                :custom-filter="() => true"
                                :placeholder="
                                    translate('processArchitecture.newProcessDialog.hqOwnerPlaceholder', '본사 담당자를 선택하세요')
                                "
                                @update:search="onUserSearch('hqOwners', $event)"
                                @update:model-value="onOwnerSelectionChange('hqOwners')"
                            />
                        </v-col>
                        <v-col cols="12">
                            <v-autocomplete
                                v-model="form.masterOwner"
                                :items="masterOwnerOptions"
                                item-title="label"
                                item-value="email"
                                :label="$t('processArchitecture.newProcessDialog.master')"
                                variant="outlined"
                                density="compact"
                                hide-details
                                clearable
                                v-model:search="ownerSearchText.masterOwner"
                                :loading="ownerSearchLoading.masterOwner"
                                :no-data-text="'이름을 입력해 주세요'"
                                :custom-filter="() => true"
                                :placeholder="$t('processArchitecture.newProcessDialog.masterPlaceholder')"
                                @update:search="onUserSearch('masterOwner', $event)"
                                @update:model-value="onOwnerSelectionChange('masterOwner')"
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
                            :items="selectableExistingProcesses"
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
                        >
                            <template #item="{ item, props }">
                                <v-list-item v-bind="props" :title="undefined">
                                    <div class="d-flex align-center">
                                        <span :class="item.raw.isCallActivitySub ? 'text-purple' : 'text-primary'" class="rg-type-text mr-1">
                                            {{ item.raw.isCallActivitySub ? '모듈' : '체계도' }}
                                        </span>
                                        <span>{{ item.raw.name }}</span>
                                    </div>
                                </v-list-item>
                            </template>
                            <template #selection="{ item }">
                                <div class="d-flex align-center">
                                    <span :class="item.raw.isCallActivitySub ? 'text-purple' : 'text-primary'" class="rg-type-text mr-1">
                                        {{ item.raw.isCallActivitySub ? '모듈' : '체계도' }}
                                    </span>
                                    <span>{{ item.raw.name }}</span>
                                </div>
                            </template>
                        </v-autocomplete>
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
                        :items="selectableExistingProcesses"
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
import { ref, computed, watch, getCurrentInstance, nextTick } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { generateProcessId, isPidInUse } from './processIdUtils';
import { getMajorBusinessDomain } from './processClassification';
import { userIdentityFromSearchResult, formatIdentityWithTeam } from '@/utils/userIdentity';
import { isCallActivitySubModule } from '@/utils/processStages';

const props = defineProps<{
    modelValue: boolean;
    procMap: any;
    domains: any[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'created', proc: { id: string; name: string; description?: string }): void;
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
    description: '',
    domain: null as string | null,
    mega: null as string | null,
    major: null as string | null,
    primaryOwner: null as string | null,
    fieldOwners: [] as string[],
    hqOwners: [] as string[],
    masterOwner: null as string | null,
    creationType: 'scratch' as 'scratch' | 'template' | 'clone' | 'upload',
    sourceProcessId: null as string | null,
    sourceMappings: [] as string[],
    isCallActivitySub: false
});

const creating = ref(false);
const existingProcesses = ref<any[]>([]);
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
async function collectBpmnDefinitionsOnly(): Promise<{ id: string; name: string; isCallActivitySub: boolean }[]> {
    try {
        const list = await (backend as any).listDefinitionStatusLite('');
        return (list || []).map((item: any) => ({
            id: String(item.id || ''),
            name: item.name || item.id || '',
            isCallActivitySub: isCallActivitySubModule(item)
        }));
    } catch (e) {
        console.error('Failed to collect BPMN definitions:', e);
        return [];
    }
}

type UserOption = { email: string; label: string };
type UserSearchResult = { email?: string; user_id?: string; name?: string; org_name?: string };

/** 외부 조직도 API로 사용자 검색 */
const ownerFields = ['primaryOwner', 'fieldOwners', 'hqOwners', 'masterOwner'] as const;
type OwnerField = (typeof ownerFields)[number];
const ownerSearchText = ref<Record<OwnerField, string>>({
    primaryOwner: '',
    fieldOwners: '',
    hqOwners: '',
    masterOwner: ''
});
const ownerSearchLoading = ref<Record<OwnerField, boolean>>({
    primaryOwner: false,
    fieldOwners: false,
    hqOwners: false,
    masterOwner: false
});
const ownerSearchOptions = ref<Record<OwnerField, UserOption[]>>({
    primaryOwner: [],
    fieldOwners: [],
    hqOwners: [],
    masterOwner: []
});
const ownerOptionCache = ref<Record<string, UserOption>>({});
const ownerSearchTimers: Partial<Record<OwnerField, ReturnType<typeof setTimeout>>> = {};

function cacheOwnerOptions(options: UserOption[]) {
    for (const option of options) {
        if (option.email) {
            ownerOptionCache.value[option.email] = option;
        }
    }
}

function mapUserSearchResults(users: UserSearchResult[] = []): UserOption[] {
    // 사내 SSO 검색 결과를 통합 UserIdentity 로 정규화한 뒤 autocomplete 옵션으로 변환.
    // 매 검색마다 fresh 데이터를 받으므로 공용 캐시에는 적재하지 않는다.
    return users
        .map((u) => {
            const identity = userIdentityFromSearchResult(u);
            const value = identity.email || identity.id || identity.employee_no || '';
            return {
                email: value,
                label: formatIdentityWithTeam(identity, value)
            };
        })
        .filter((u) => !!u.email);
}

function getSelectedOwnerEmails(field: OwnerField): string[] {
    switch (field) {
        case 'primaryOwner':
            return form.value.primaryOwner ? [form.value.primaryOwner] : [];
        case 'fieldOwners':
            return form.value.fieldOwners;
        case 'hqOwners':
            return form.value.hqOwners;
        case 'masterOwner':
            return form.value.masterOwner ? [form.value.masterOwner] : [];
        default:
            return [];
    }
}

function getSelectedOwnerOptions(field: OwnerField): UserOption[] {
    return getSelectedOwnerEmails(field).map((email) => ownerOptionCache.value[email] || { email, label: email });
}

function mergeOwnerOptions(...optionGroups: UserOption[][]): UserOption[] {
    const merged = new Map<string, UserOption>();
    for (const options of optionGroups) {
        for (const option of options) {
            if (option.email && !merged.has(option.email)) {
                merged.set(option.email, option);
            }
        }
    }
    return [...merged.values()];
}

function setOwnerSearchOptions(field: OwnerField, options: UserOption[]) {
    cacheOwnerOptions(options);
    ownerSearchOptions.value[field] = options;
}

function isSingleOwnerField(field: OwnerField) {
    return field === 'primaryOwner' || field === 'masterOwner';
}

function getSingleOwnerSelectionLabel(field: OwnerField) {
    const email = field === 'primaryOwner' ? form.value.primaryOwner : field === 'masterOwner' ? form.value.masterOwner : null;
    return email ? ownerOptionCache.value[email]?.label || email : '';
}

function clearOwnerSearch(field: OwnerField, searchText = '') {
    if (ownerSearchTimers[field]) {
        clearTimeout(ownerSearchTimers[field]);
        ownerSearchTimers[field] = undefined;
    }
    ownerSearchText.value[field] = searchText;
    ownerSearchLoading.value[field] = false;
    ownerSearchOptions.value[field] = [];
}

function onOwnerSelectionChange(field: OwnerField) {
    nextTick(() => {
        clearOwnerSearch(field, isSingleOwnerField(field) ? getSingleOwnerSelectionLabel(field) : '');
    });
}

function resetOwnerSearchState(options: UserOption[] = []) {
    ownerOptionCache.value = {};
    cacheOwnerOptions(options);
    for (const field of ownerFields) {
        clearOwnerSearch(field);
        ownerSearchOptions.value[field] = [...options];
    }
}

function onUserSearch(field: OwnerField, keyword: string) {
    if (ownerSearchTimers[field]) clearTimeout(ownerSearchTimers[field]);
    const searchKeyword = keyword?.trim();
    if (!searchKeyword || (isSingleOwnerField(field) && searchKeyword === getSingleOwnerSelectionLabel(field))) {
        ownerSearchLoading.value[field] = false;
        ownerSearchOptions.value[field] = [];
        return;
    }
    ownerSearchTimers[field] = setTimeout(async () => {
        ownerSearchLoading.value[field] = true;
        try {
            const result = await backend.searchUsersByName(searchKeyword);
            if (ownerSearchText.value[field].trim() === searchKeyword) {
                setOwnerSearchOptions(field, mapUserSearchResults(result.users || []));
            }
        } catch (e) {
            console.error('Failed to search users:', e);
        } finally {
            if (ownerSearchText.value[field].trim() === searchKeyword) {
                ownerSearchLoading.value[field] = false;
            }
        }
    }, 300);
}

/** 초기 로드용 (빈 목록) */
async function loadUsersFromOrgChart(): Promise<UserOption[]> {
    return [];
}

// Load existing processes and users when dialog opens
watch(
    () => props.modelValue,
    async (open) => {
        if (open) {
            try {
                const [bpmnDefs, users] = await Promise.all([collectBpmnDefinitionsOnly(), loadUsersFromOrgChart()]);
                existingProcesses.value = bpmnDefs;
                resetOwnerSearchState(users);
            } catch (e) {
                console.error('Failed to load data:', e);
            }
        }
    }
);

const domainOptions = computed(() => props.domains || []);

// proc_map(정의체계도)에 실제 등록된 프로세스 ID 집합.
// 삭제된(휴지통으로 이동한) 항목은 proc_map에서 제거되므로 이 집합에 포함되지 않는다.
const procMapActiveProcessIds = computed<Set<string>>(() => {
    const ids = new Set<string>();
    const megaList = props.procMap?.mega_proc_list || [];
    for (const mega of megaList) {
        for (const major of (mega.major_proc_list || [])) {
            for (const sub of (major.sub_proc_list || [])) {
                if (sub?.id) ids.add(String(sub.id));
            }
        }
    }
    return ids;
});

// 템플릿/복제/소스 매핑 드롭다운에 표시할 대상:
// - 기본: proc_def(deleted_at IS NULL) AND proc_map에 존재하는 것만
// - 복제(clone) 인 경우: CA 서브 프로세스(프로세스 모듈, type: 'call-activity-sub')는 proc_map에
//   등록되지 않지만 복제 소스로는 허용되어야 하므로 함께 노출
const selectableExistingProcesses = computed(() => {
    const activeIds = procMapActiveProcessIds.value;
    const isClone = form.value.creationType === 'clone';
    return existingProcesses.value.filter((p: any) => {
        if (activeIds.has(String(p.id || ''))) return true;
        if (isClone && p?.isCallActivitySub) return true;
        return false;
    });
});

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

function createOwnerOptions(field: OwnerField, excluded: Array<string | null | undefined>) {
    const excludedSet = new Set(excluded.filter(Boolean));
    return mergeOwnerOptions(getSelectedOwnerOptions(field), ownerSearchOptions.value[field]).filter((u) => !excludedSet.has(u.email));
}

const primaryOwnerOptions = computed(() =>
    createOwnerOptions('primaryOwner', [...form.value.fieldOwners, ...form.value.hqOwners, form.value.masterOwner])
);

const fieldOwnerOptions = computed(() =>
    createOwnerOptions('fieldOwners', [form.value.primaryOwner, ...form.value.hqOwners, form.value.masterOwner])
);

const hqOwnerOptions = computed(() =>
    createOwnerOptions('hqOwners', [form.value.primaryOwner, ...form.value.fieldOwners, form.value.masterOwner])
);

const masterOwnerOptions = computed(() =>
    createOwnerOptions('masterOwner', [form.value.primaryOwner, ...form.value.fieldOwners, ...form.value.hqOwners])
);

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
                    bestDomainName = getMajorBusinessDomain(major, props.domains) || mega.name || '';
                }
            }
            // Also score against major name itself
            const majorScore = computeKeywordScore(keywords, (major.name || '').toLowerCase());
            if (majorScore > bestScore) {
                bestScore = majorScore;
                bestMega = mega;
                bestMajor = major;
                bestDomainName = getMajorBusinessDomain(major, props.domains) || mega.name || '';
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
    if (!form.value.isCallActivitySub) {
        if (!form.value.domain || !form.value.mega || !form.value.major) return false;
    }
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
        description: '',
        domain: null,
        mega: null,
        major: null,
        primaryOwner: null,
        fieldOwners: [],
        hqOwners: [],
        masterOwner: null,
        creationType: 'scratch',
        sourceProcessId: null,
        sourceMappings: [],
        isCallActivitySub: false
    };
    similarProcesses.value = [];
    aiSuggestion.value = null;
    errorSnackbar.value = false;
    errorMessage.value = '';
    clearUploadedBpmn();
    resetOwnerSearchState();
}

async function createProcess() {
    if (!canCreate.value) return;
    creating.value = true;
    try {
        let newId: string;
        const name = form.value.name.trim();
        const description = form.value.description.trim();
        const coOwners = [...new Set([...form.value.fieldOwners, ...form.value.hqOwners])];
        const sourceLineage = form.value.processMode === 'tobe' ? [...form.value.sourceMappings] : [];
        const ownerModel = {
            primaryOwner: form.value.primaryOwner,
            fieldOwners: [...form.value.fieldOwners],
            hqOwners: [...form.value.hqOwners],
            masterOwner: form.value.masterOwner
        };

        const isCloneFlow =
            form.value.processMode === 'asis' &&
            form.value.creationType !== 'scratch' &&
            form.value.creationType !== 'upload';

        if (isCloneFlow) {
            // Clone/Template: duplicate an existing local process definition.
            // proc_map 등록은 backend(duplicateLocalProcess)에서 일괄 처리하며,
            // 사용자가 선택한 Mega/Major 위치 및 추가 필드(pid/owners/type 등)를 옵션으로 전달한다.
            // '프로세스 모듈(계층도 미등록)' 체크 시에는 proc_map 등록을 스킵하고 모듈 마커를 부여한다.
            const sourceId = form.value.sourceProcessId;
            const sourceDef = await backend.getRawDefinition(sourceId);
            if (!sourceDef?.bpmn) {
                throw new Error(
                    translate(
                        'processArchitecture.newProcessDialog.sourceDefinitionLoadFailed',
                        '원본 프로세스 정의를 불러오지 못했습니다.'
                    )
                );
            }

            // 원본 definition의 모듈 마커(type)를 사용자의 선택에 맞춰 재설정:
            // 체계도 프로세스 → 모듈 복제, 모듈 → 체계도 복제 어느 쪽도 원본 마커를 물려받지 않도록
            let cloneDefinition: any = {};
            try {
                const rawDef = sourceDef.definition;
                cloneDefinition = typeof rawDef === 'string' ? JSON.parse(rawDef || '{}') : { ...(rawDef || {}) };
            } catch {
                cloneDefinition = {};
            }
            if (form.value.isCallActivitySub) {
                cloneDefinition.type = 'call-activity-sub';
            } else if (cloneDefinition.type === 'call-activity-sub') {
                delete cloneDefinition.type;
            }

            let subEntryExtras: Record<string, any> | null = null;
            if (!form.value.isCallActivitySub) {
                const currentMap = await backend.getProcessDefinitionMap();
                const workingMap = currentMap && currentMap.mega_proc_list ? currentMap : { mega_proc_list: [] };
                subEntryExtras = buildSubEntryExtrasForProcMap(
                    workingMap,
                    form.value.mega,
                    form.value.major,
                    description
                );
            }

            const result = await backend.duplicateLocalProcess(
                sourceId,
                name,
                sourceDef.bpmn,
                cloneDefinition,
                {
                    targetMegaId: form.value.mega,
                    targetMajorId: form.value.major,
                    subEntryExtras: subEntryExtras || undefined,
                    skipProcMap: form.value.isCallActivitySub
                }
            );
            newId = result?.newId || result?.id || result;
        } else {
            // Create new process: build initial BPMN with Lane + StartEvent -> ManualTask -> EndEvent
            const laneName = localStorage.getItem('orgName') || 'Lane 1';

            const defaultBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Process" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <uengine:ProcessVariables id="ProcessVariables_1">
      <uengine:ProcessVariable key="variable1" value="value1"/>
      <uengine:ProcessVariable key="variable2" value="value2"/>
    </uengine:ProcessVariables>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="${laneName}">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ManualTask_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:manualTask id="ManualTask_1" name="Manual Task">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:manualTask>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ManualTask_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ManualTask_1" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="190" y="80" width="570" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="232" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="238" y="225" width="24" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManualTask_1_di" bpmnElement="ManualTask_1">
        <dc:Bounds x="340" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="512" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="520" y="225" width="20" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="268" y="200"/>
        <di:waypoint x="340" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="440" y="200"/>
        <di:waypoint x="512" y="200"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
            const idPrefix = form.value.isCallActivitySub ? 'ca-' : '';
            const defId = name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            const uniqueId = `${idPrefix}${defId}-${Date.now()}`;
            const initialBpmn = form.value.processMode === 'asis' && form.value.creationType === 'upload' ? uploadedBpmnXml.value : defaultBpmn;

            await backend.putRawDefinition(initialBpmn, uniqueId, {
                name,
                description,
                owner: form.value.primaryOwner || undefined,
                field_owners: form.value.fieldOwners,
                hq_owners: form.value.hqOwners,
                master_owner: form.value.masterOwner || undefined,
                co_owners: coOwners,
                master: form.value.masterOwner || undefined,
                version: '0.1',
                version_tag: null,
                definition: {
                    processDefinitionId: uniqueId,
                    processDefinitionName: name,
                    description,
                    shortDescription: description,
                    data: [],
                    roles: [],
                    ...(form.value.isCallActivitySub ? { type: 'call-activity-sub' } : {}),
                    meta: {
                        process_mode: form.value.processMode,
                        owners: ownerModel,
                        source_lineage: sourceLineage
                    }
                }
            });
            newId = uniqueId;
        }

        if (newId) {
            await syncProcessDefinitionMetadata(newId, name, description, ownerModel, coOwners, sourceLineage);
            // Clone/Template 경로는 backend(duplicateLocalProcess)에서 proc_map 등록을 마쳤으므로 스킵
            // Call Activity 서브프로세스는 계층도에 등록하지 않음
            if (!isCloneFlow && !form.value.isCallActivitySub) {
                await updateProcMap(newId, name, description);
            }
            emit('created', { id: newId, name, description });
        }
        close();
    } catch (e: any) {
        console.error('Failed to create process:', e);
        errorMessage.value =
            e?.message ||
            String(e) ||
            translate('processArchitecture.newProcessDialog.createFailed', '프로세스를 생성하지 못했습니다.');
        errorSnackbar.value = true;
    } finally {
        creating.value = false;
    }
}

async function syncProcessDefinitionMetadata(
    defId: string,
    name: string,
    description: string,
    ownerModel: {
        primaryOwner: string | null;
        fieldOwners: string[];
        hqOwners: string[];
        masterOwner: string | null;
    },
    coOwners: string[],
    sourceLineage: string[]
) {
    try {
        const current = await backend.getRawDefinition(defId);
        if (!current?.bpmn) return;

        await backend.putRawDefinition(current.bpmn, defId, {
            ...current,
            name,
            description,
            owner: ownerModel.primaryOwner || undefined,
            field_owners: ownerModel.fieldOwners,
            hq_owners: ownerModel.hqOwners,
            master_owner: ownerModel.masterOwner || undefined,
            co_owners: coOwners,
            master: ownerModel.masterOwner || undefined,
            version: current.version || '0.1',
            version_tag: current.version_tag || null,
            definition: {
                ...(current.definition || {}),
                processDefinitionId: defId,
                processDefinitionName: name,
                description,
                shortDescription: description,
                meta: {
                    ...((current.definition || {}).meta || {}),
                    process_mode: form.value.processMode,
                    owners: ownerModel,
                    source_lineage: sourceLineage
                }
            }
        });
    } catch (e) {
        console.warn('Failed to sync process definition metadata:', e);
    }
}

// 주어진 map 상태 기준으로 target 위치의 PID를 계산하고
// sub_proc_list entry의 추가 필드(owners/type/source 등)를 구성해 반환.
// id/name은 backend(duplicateLocalProcess) 또는 updateProcMap에서 병합한다.
function buildSubEntryExtrasForProcMap(
    map: any,
    targetMegaId: string | null | undefined,
    targetMajorId: string | null | undefined,
    description: string
): Record<string, any> | null {
    if (!targetMegaId || !targetMajorId) return null;

    const megaList = map?.mega_proc_list || [];
    const megaIndex = megaList.findIndex((m: any) => m.id === targetMegaId);
    if (megaIndex === -1) return null;

    const majorList = megaList[megaIndex].major_proc_list || [];
    const majorIndex = majorList.findIndex((m: any) => m.id === targetMajorId);
    if (majorIndex === -1) return null;

    const subList: any[] = majorList[majorIndex].sub_proc_list || [];

    let pid = generateProcessId(map, targetMegaId, targetMajorId);
    if (pid && isPidInUse(map, pid)) {
        const prefix = targetMajorId + '.';
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

    const coOwners = [...new Set([...form.value.fieldOwners, ...form.value.hqOwners])];
    return {
        pid: pid || '',
        description,
        type: form.value.processMode === 'tobe' ? 'tobe' : 'asis',
        ...(form.value.primaryOwner ? { owner: form.value.primaryOwner } : {}),
        ...(form.value.fieldOwners.length > 0 ? { field_owners: form.value.fieldOwners } : {}),
        ...(form.value.hqOwners.length > 0 ? { hq_owners: form.value.hqOwners } : {}),
        ...(form.value.masterOwner ? { master_owner: form.value.masterOwner } : {}),
        ...(form.value.masterOwner ? { master: form.value.masterOwner } : {}),
        ...(coOwners.length > 0 ? { co_owners: coOwners } : {}),
        ...(form.value.processMode === 'tobe' ? { source_process_ids: form.value.sourceMappings } : {}),
        ...(form.value.processMode === 'tobe' && form.value.sourceMappings.length > 0
            ? { source_mappings: form.value.sourceMappings }
            : {})
    };
}

async function updateProcMap(newId: string, name: string, description: string) {
    try {
        const currentMap = await backend.getProcessDefinitionMap();
        const map = currentMap && currentMap.mega_proc_list ? currentMap : { mega_proc_list: [] };

        const targetMegaId = form.value.mega;
        const targetMajorId = form.value.major;

        const extras = buildSubEntryExtrasForProcMap(map, targetMegaId, targetMajorId, description);
        if (!extras) return;

        const megaList = map.mega_proc_list || [];
        const megaIndex = megaList.findIndex((m: any) => m.id === targetMegaId);
        const majorList = megaList[megaIndex].major_proc_list || [];
        const majorIndex = majorList.findIndex((m: any) => m.id === targetMajorId);
        if (!majorList[majorIndex].sub_proc_list) {
            majorList[majorIndex].sub_proc_list = [];
        }

        majorList[majorIndex].sub_proc_list.push({
            id: newId,
            proc_def_id: newId,
            name,
            ...extras
        });
        megaList[megaIndex].major_proc_list = majorList;
        map.mega_proc_list = megaList;
        await backend.putProcessDefinitionMap(map);
        await backend.syncProcessDefinitionHierarchyFromMap?.(newId, map);
    } catch (e) {
        console.error('Failed to update proc_map:', e);
    }
}
</script>

<style scoped>
/* 복제 / 템플릿 dropdown 항목 앞 라벨(체계도 · 모듈) 텍스트 스타일 */
.rg-type-text {
    font-size: 10px;
    font-weight: 600;
}

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
