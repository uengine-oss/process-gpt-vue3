<template>
    <div v-if="enableEdit" class="pa-1">
        <v-card
            variant="outlined"
            class="pa-4"
            style="
                border: 2px solid rgba(var(--v-theme-primary), 0.3);
                border-radius: 12px;
                background-color: rgba(var(--v-theme-primary), 0.02);
            "
        >
            <v-row justify="end" class="ma-0 pa-0 mb-2">
                <v-spacer></v-spacer>
                <v-btn @click="closeDialog()" icon variant="text" density="compact" size="small">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-row>

            <!-- Toggle for Sub Process: Select Existing vs Create New -->
            <v-row v-if="addType == 'sub' && processType === 'add'" class="ma-0 pa-0 mb-3">
                <v-col cols="12" class="ma-0 pa-0">
                    <v-btn-toggle v-model="isNewDef" mandatory density="compact" color="primary" variant="outlined" divided class="w-100">
                        <v-btn :value="false" class="flex-grow-1" size="small">
                            <v-icon start size="16">mdi-file-search</v-icon>
                            {{ $t('processDialog.selectExisting') }}
                        </v-btn>
                        <v-btn :value="true" class="flex-grow-1" size="small">
                            <v-icon start size="16">mdi-plus</v-icon>
                            {{ $t('processDialog.createNew') }}
                        </v-btn>
                    </v-btn-toggle>
                </v-col>
            </v-row>

            <v-row class="ma-0 pa-0">
                <v-col cols="12" class="ma-0 pa-0">
                    <!-- 새 서브프로세스: 프로세스 ID를 맨 위에 (UI 통일) -->
                    <v-text-field
                        v-if="addType === 'sub' && isNewDef && processType === 'add'"
                        v-model="newProcess.id"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :rules="idRules"
                        :hint="processIdHint"
                        persistent-hint
                        class="mb-3"
                        :loading="isGeneratingId"
                        @click.stop
                    >
                        <template v-slot:label>
                            <span v-if="!isGeneratingId">{{ $t('processDialog.processId') || 'Process ID' }}</span>
                            <span v-else class="d-flex align-center">
                                <v-progress-circular indeterminate size="14" width="2" class="mr-2" />
                                {{ $t('processDialog.generatingId') || 'ID 생성 중...' }}
                            </span>
                        </template>
                        <template v-slot:append-inner>
                            <v-tooltip location="top">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        @click="generateIdFromName"
                                        icon
                                        size="x-small"
                                        variant="text"
                                        :disabled="!newProcess.name || isGeneratingId"
                                    >
                                        <v-icon size="18">mdi-auto-fix</v-icon>
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDialog.generateIdTooltip') || 'AI로 ID 추천받기' }}</span>
                            </v-tooltip>
                        </template>
                    </v-text-field>

                    <ProcessDefinitionDisplay
                        v-if="addType == 'sub' && !isNewDef && processType === 'add'"
                        v-model="newProcess"
                        :file-extensions="['.bpmn']"
                        :options="{
                            label: $t('processDialog.processDefinition'),
                            returnObject: true,
                            hideDetails: true,
                            itemValue: 'id'
                        }"
                    ></ProcessDefinitionDisplay>

                    <!-- 기존 프로세스 선택 시: 맵 표시용 이름만 편집(선택한 정의 객체는 변경하지 않음) -->
                    <v-text-field
                        v-if="addType == 'sub' && !isNewDef && processType === 'add'"
                        v-model="mapDisplayName"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :label="$t('processDialog.processName') || '프로세스명'"
                        :placeholder="$t('processDialog.displayNamePlaceholder') || '비우면 선택한 프로세스 정의명이 사용됩니다'"
                        hide-details
                        class="mt-3"
                        @keypress.enter="addProcess()"
                        @click.stop
                    />

                    <v-text-field
                        v-if="addType != 'sub' || isNewDef || processType === 'update'"
                        class="cp-process-id"
                        v-model="newProcess.name"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :label="
                            $i18n.locale === 'ko'
                                ? processType === 'add'
                                    ? (addType === 'sub' && isNewDef ? '프로세스명' : `${displayType.toUpperCase()} 프로세스 추가`)
                                    : `${displayType.toUpperCase()} 프로세스 수정`
                                : processType === 'add'
                                ? (addType === 'sub' && isNewDef ? 'Process Name' : `Add ${displayType.toUpperCase()} Process`)
                                : `Edit ${displayType.toUpperCase()} Process`
                        "
                        autofocus
                        @keypress.enter="processType === 'add' ? addProcess() : updateProcess()"
                        @click.stop
                    ></v-text-field>

                    <!-- Major 프로세스: 도메인 선택 (이름 입력 아래) -->
                    <v-select
                        v-if="(addType === 'major' || (type === 'major' && processType === 'update')) && domains && domains.length > 0"
                        v-model="newProcess.domain"
                        :items="domains"
                        :label="$t('processDefinitionMap.selectDomain') || '도메인 선택'"
                        item-title="name"
                        item-value="name"
                        clearable
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        class="mt-3"
                    />

                    <!-- PAL 전용: 서브프로세스 추가 시 공통 모듈 토글 -->
                    <v-switch
                        v-if="addType === 'sub' && processType === 'add' && isPal"
                        v-model="newProcess.commonModule"
                        :label="$t('ProcessMenu.commonModule') || '공통 모듈'"
                        color="primary"
                        hide-details
                        class="mt-2"
                    />
                </v-col>
            </v-row>

            <v-row class="ma-0 pa-0 mt-4">
                <v-spacer></v-spacer>
                <v-btn
                    @click="processType === 'add' ? addProcess() : updateProcess()"
                    :disabled="isSaveDisabled"
                    color="primary"
                    variant="flat"
                    class="rounded-pill px-6"
                    size="small"
                >
                    {{ $t('common.save') || '저장' }}
                </v-btn>
            </v-row>
        </v-card>
    </div>
</template>

<script>
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';
import ProcessDefinitionIdGenerator from '@/components/ai/ProcessDefinitionIdGenerator';
import {
    getInvalidProcessDefinitionIdMessage,
    getProcessDefinitionIdHint,
    isValidProcessDefinitionId,
    normalizeGeneratedProcessDefinitionId
} from '@/utils/processDefinitionId.js';

export default {
    components: {
        ProcessDefinitionDisplay
    },
    props: {
        process: Object,
        enableEdit: Boolean,
        type: String,
        processDialogStatus: Boolean,
        processType: String,
        domains: Array,
        defaultDomain: String
    },
    data: () => ({
        newProcess: {
            id: '',
            name: '',
            domain: '',
            commonModule: false
        },
        /** 기존 프로세스 선택 시, 선택한 정의의 이름(이름 필드 비우면 map에 이 값 사용) */
        selectedDefinitionName: '',
        /** 기존 프로세스 선택 시, 맵에 표시할 이름만 편집(선택한 정의 객체는 수정하지 않음) */
        mapDisplayName: '',
        /** ProcessDefinitionDisplay 선택 시 in-place 갱신 대비: 마지막으로 채운 정의 시그니처 */
        _mapFillPickKey: '',
        isNewDef: false,
        isGeneratingId: false,
        previousSuggestions: [],
        regenerateIdOnly: true,
        bpmnProcessInfo: '',
        idGenerator: null
    }),
    mounted() {
        if (!this.processDialogStatus) return;
        if (this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
                this.newProcess.domain = this.process.domain ?? this.defaultDomain ?? '';
            }
    },
    computed: {
        domainNames() {
            if (!this.domains) return [];
            return this.domains.map((d) => d.name);
        },
        addType() {
            if (this.type == 'map') {
                return 'mega';
            } else if (this.type == 'mega') {
                return 'major';
            } else if (this.type == 'major') {
                return 'sub';
            }
        },
        // For edit mode, use current type; for add mode, use child type
        displayType() {
            if (this.processType === 'update') {
                return this.type;
            }
            return this.addType;
        },
        isPal() {
            return typeof window !== 'undefined' && window.$pal;
        },
        currentMode() {
            return typeof window !== 'undefined' ? String(window.$mode || '') : '';
        },
        processIdHint() {
            if (this.currentMode.toLowerCase() === 'uengine') {
                return getProcessDefinitionIdHint({ mode: this.currentMode });
            }
            return this.$t('processDialog.idHint') || getProcessDefinitionIdHint({ mode: this.currentMode });
        },
        processIdInvalidMessage() {
            if (this.currentMode.toLowerCase() === 'uengine') {
                return getInvalidProcessDefinitionIdMessage({ mode: this.currentMode });
            }
            return this.$t('processDialog.idInvalid') || getInvalidProcessDefinitionIdMessage({ mode: this.currentMode });
        },
        isSaveDisabled() {
            if (this.addType === 'sub') {
                if (this.isNewDef) {
                    // Create new mode: need name and valid id
                    return !this.newProcess.name || !this.newProcess.id || !this.isValidId(this.newProcess.id);
                } else {
                    // Select existing mode: need id or name from selection
                    return !this.newProcess.id && !this.newProcess.name;
                }
            } else {
                // mega/major: need name
                return !this.newProcess.name;
            }
        },
        idRules() {
            return [
                (v) => !!v || this.$t('processDialog.idRequired') || 'ID는 필수입니다.',
                (v) => isValidProcessDefinitionId(v, { mode: this.currentMode }) || this.processIdInvalidMessage
            ];
        }
    },
    watch: {
        isNewDef(val) {
            // Reset form when toggling between modes
            this.newProcess = {
                id: '',
                name: '',
                domain: this.defaultDomain || '',
                commonModule: false
            };
            this.selectedDefinitionName = '';
            this.mapDisplayName = '';
            this._mapFillPickKey = '';
            this.previousSuggestions = [];
            this.isGeneratingId = false;
        },
        /**
         * 기존 정의 선택: Vuetify가 부모 newProcess와 동일 참조를 제자리로 채울 수 있어 deep watch 필수.
         * definitionName → displayName → name(파일명) → path 로 맵 표시명(프로세스명) 채움.
         */
        newProcess: {
            deep: true,
            handler(val) {
                if (this.addType !== 'sub' || this.isNewDef || this.processType !== 'add') return;
                if (!val || typeof val !== 'object') {
                    this.selectedDefinitionName = '';
                    this.mapDisplayName = '';
                    this._mapFillPickKey = '';
                    return;
                }
                const nextPath = String(val.path || '').trim();
                const nextId = val.id != null && String(val.id).trim() !== '' ? String(val.id).trim() : nextPath;
                if (!nextPath && !nextId) {
                    this.selectedDefinitionName = '';
                    this.mapDisplayName = '';
                    this._mapFillPickKey = '';
                    return;
                }
                const pickKey = `${nextPath}\0${nextId}\0${val.definitionName || ''}\0${val.name || ''}`;
                if (this._mapFillPickKey === pickKey) return;
                this._mapFillPickKey = pickKey;

                const display =
                    (val.definitionName && String(val.definitionName).trim()) ||
                    (val.displayName && String(val.displayName).trim()) ||
                    '';
                const fromFile =
                    (val.name && String(val.name).replace(/\.(bpmn|xml)$/i, '').trim()) || '';
                const baseFromPath = nextPath
                    ? String(nextPath)
                          .split('/')
                          .pop()
                          .replace(/\.(bpmn|xml)$/i, '')
                          .trim()
                    : '';
                const resolved =
                    display || fromFile || baseFromPath || String(nextId).replace(/\.(bpmn|xml)$/i, '').trim();
                this.selectedDefinitionName = resolved;
                this.mapDisplayName = resolved;
            }
        },
        processDialogStatus(val) {
            if (!val) return;
            if (this.processType == 'add') {
                // Reset to default state
                this.isNewDef = false;
                this.newProcess = {
                    id: '',
                    name: '',
                    domain: this.defaultDomain || '',
                    commonModule: false
                };
                this.selectedDefinitionName = '';
                this.mapDisplayName = '';
                this._mapFillPickKey = '';
                this.previousSuggestions = [];
                this.isGeneratingId = false;
            } else if (this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
                this.newProcess.domain = this.process.domain ?? this.defaultDomain ?? '';
            }
        }
    },
    methods: {
        closeDialog() {
            this.isNewDef = false;
            this.$emit('closeProcessDialog');
        },
        addProcess() {
            // For sub process: handle both select existing and create new modes
            if (this.addType === 'sub') {
                if (this.isNewDef) {
                    // Create new mode: use the entered name and id
                    if (this.newProcess.name && this.newProcess.id) {
                        const processData = {
                            id: this.newProcess.id,
                            name: this.newProcess.name,
                            isNew: true, // Flag to indicate this is a newly created process
                            ...(this.isPal && { commonModule: !!this.newProcess.commonModule })
                        };
                        this.$emit('add', processData);
                        this.closeDialog();
                    }
                } else {
                    // Select existing: id는 선택한 정의 ID, 이름은 mapDisplayName(비우면 선택한 정의명)
                    if (this.newProcess.id || this.newProcess.name) {
                        const trimmed = (this.mapDisplayName && String(this.mapDisplayName).trim()) || '';
                        const name = trimmed
                            ? trimmed.replace(/\.(bpmn|xml)$/i, '').trim()
                            : (this.selectedDefinitionName || this.newProcess.id || '');
                        this.$emit('add', {
                            id: this.newProcess.id || '',
                            name: name,
                            isNew: false,
                            ...(this.isPal && { commonModule: !!this.newProcess.commonModule })
                        });
                        this.closeDialog();
                    }
                }
            } else {
                // For mega/major processes
                if (this.newProcess.name) {
                    // Major process: 도메인 미선택 시 현재 탭 도메인 사용 (사용자 선택은 유지)
                    if (this.addType === 'major' && !this.newProcess.domain && this.defaultDomain) {
                        this.newProcess.domain = this.defaultDomain;
                    }
                    this.$emit('add', this.newProcess);
                    this.closeDialog();
                }
            }
        },
        updateProcess() {
            if (this.newProcess.id != '') {
                this.$emit('edit', this.newProcess);
                this.closeDialog();
            }
        },
        isValidId(id) {
            return isValidProcessDefinitionId(id, { mode: this.currentMode });
        },
        async generateIdFromName() {
            if (!this.newProcess.name || !this.newProcess.name.trim()) return;

            this.isGeneratingId = true;
            this.regenerateIdOnly = true;
            this.bpmnProcessInfo = this.newProcess.name;

            try {
                this.idGenerator = new ProcessDefinitionIdGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
                await this.idGenerator.generate();
            } catch (error) {
                console.error('ID 생성 중 오류 발생:', error);
                this.isGeneratingId = false;
                // Fallback to simple generation
                this.generateIdFallback();
            }
        },
        generateIdFallback() {
            this.newProcess.id = normalizeGeneratedProcessDefinitionId(this.newProcess.name, { mode: this.currentMode });
        },
        async onGenerationFinished(response) {
            try {
                // Parse AI response (format: "id: suggested_id")
                const lines = response.trim().split('\n');
                let id = '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('id:')) {
                        id = trimmedLine.split(':')[1]?.trim() || '';
                    }
                }

                if (id) {
                    id = normalizeGeneratedProcessDefinitionId(id, { mode: this.currentMode });

                    if (id) {
                        this.newProcess.id = id;
                        this.previousSuggestions.push(id);
                    } else {
                        this.generateIdFallback();
                    }
                } else {
                    this.generateIdFallback();
                }
            } catch (error) {
                console.error('ID 파싱 중 오류:', error);
                this.generateIdFallback();
            } finally {
                this.isGeneratingId = false;
            }
        }
    }
};
</script>
