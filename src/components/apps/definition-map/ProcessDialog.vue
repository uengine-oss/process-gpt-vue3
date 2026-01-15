<template>
    <div v-if="enableEdit" class="pa-1">
        <v-card variant="outlined" class="pa-4" style="border: 2px solid rgba(var(--v-theme-primary), 0.3); border-radius: 12px; background-color: rgba(var(--v-theme-primary), 0.02);">
            <v-row justify="end" class="ma-0 pa-0 mb-2">
                <v-spacer></v-spacer>
                <v-btn @click="closeDialog()"
                    icon
                    variant="text"
                    density="compact"
                    size="small"
                >
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-row>

            <!-- Toggle for Sub Process: Select Existing vs Create New -->
            <v-row v-if="addType == 'sub' && processType === 'add'" class="ma-0 pa-0 mb-3">
                <v-col cols="12" class="ma-0 pa-0">
                    <v-btn-toggle
                        v-model="isNewDef"
                        mandatory
                        density="compact"
                        color="primary"
                        variant="outlined"
                        divided
                        class="w-100"
                    >
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

                    <!-- 도메인은 상위 탭에서 선택하므로 입력 필드 제거 -->

                    <v-text-field
                        v-if="addType != 'sub' || isNewDef || processType === 'update'"
                        class="cp-process-id"
                        v-model="newProcess.name"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :label="$i18n.locale === 'ko' ? (processType === 'add' ? `${displayType.toUpperCase()} 프로세스 추가` : `${displayType.toUpperCase()} 프로세스 수정`) : (processType === 'add' ? `Add ${displayType.toUpperCase()} Process` : `Edit ${displayType.toUpperCase()} Process`)"
                        autofocus
                        @keypress.enter="processType === 'add' ? addProcess() : updateProcess()"
                        @click.stop
                    ></v-text-field>

                    <!-- ID field for new subprocess creation -->
                    <v-text-field
                        v-if="addType === 'sub' && isNewDef && processType === 'add'"
                        v-model="newProcess.id"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :rules="idRules"
                        :hint="$t('processDialog.idHint') || '영문 소문자, 숫자, 언더스코어(_)만 사용'"
                        persistent-hint
                        class="mt-2"
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
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue'
import ProcessDefinitionIdGenerator from '@/components/ai/ProcessDefinitionIdGenerator'

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
            domain: ''
        },
        isNewDef: false,
        isGeneratingId: false,
        previousSuggestions: [],
        regenerateIdOnly: true,
        bpmnProcessInfo: '',
        idGenerator: null
    }),
    mounted() {
            if(!this.processDialogStatus) return;
            if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
                this.newProcess.domain = this.process.domain;
            }
    },
    computed: {
        domainNames() {
            if (!this.domains) return [];
            return this.domains.map(d => d.name);
        },
        addType() {
            if (this.type == 'map') {
                return "mega";
            } else if (this.type == 'mega') {
                return "major";
            } else if (this.type == 'major') {
                return "sub";
            }
        },
        // For edit mode, use current type; for add mode, use child type
        displayType() {
            if (this.processType === 'update') {
                return this.type;
            }
            return this.addType;
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
                v => !!v || this.$t('processDialog.idRequired') || 'ID는 필수입니다.',
                v => /^[a-z][a-z0-9_]*$/.test(v) || this.$t('processDialog.idInvalid') || '영문 소문자로 시작, 소문자/숫자/언더스코어만 허용'
            ];
        }
    },
    watch: {
        isNewDef(val) {
            // Reset form when toggling between modes
            this.newProcess = {
                id: '',
                name: '',
                domain: this.defaultDomain || ''
            };
            this.previousSuggestions = [];
            this.isGeneratingId = false;
        },
        processDialogStatus(val) {
            if(!val) return
            if (this.processType == 'add') {
                // Reset to default state
                this.isNewDef = false;
                this.newProcess = {
                    id: '',
                    name: '',
                    domain: this.defaultDomain || ''
                };
                this.previousSuggestions = [];
                this.isGeneratingId = false;
            } else if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
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
                            isNew: true  // Flag to indicate this is a newly created process
                        };
                        this.$emit("add", processData);
                        this.closeDialog();
                    }
                } else {
                    // Select existing mode: use selected process
                    if (this.newProcess.id || this.newProcess.name) {
                        // Remove file extension from name if exists
                        const name = this.newProcess.name ?
                            this.newProcess.name.replace(/\.(bpmn|xml)$/i, '') :
                            this.newProcess.id;
                        this.$emit("add", {
                            id: this.newProcess.id || '',
                            name: name,
                            isNew: false
                        });
                        this.closeDialog();
                    }
                }
            } else {
                // For mega/major processes
                if (this.newProcess.name) {
                    // Major process인 경우 선택된 도메인 탭을 자동으로 설정
                    if (this.addType === 'major' && this.defaultDomain) {
                        this.newProcess.domain = this.defaultDomain;
                    }
                    this.$emit("add", this.newProcess);
                    this.closeDialog();
                }
            }
        },
        updateProcess() {
            if (this.newProcess.id != '') {
                this.$emit("edit", this.newProcess);
                this.closeDialog();
            }
        },
        isValidId(id) {
            return /^[a-z][a-z0-9_]*$/.test(id);
        },
        async generateIdFromName() {
            if (!this.newProcess.name || !this.newProcess.name.trim()) return;

            this.isGeneratingId = true;
            this.regenerateIdOnly = true;
            this.bpmnProcessInfo = this.newProcess.name;

            try {
                this.idGenerator = new ProcessDefinitionIdGenerator(this, {
                    isStream: true,
                    preferredLanguage: "Korean"
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
            // Simple fallback when AI fails
            let id = this.newProcess.name
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '')
                .replace(/^[0-9_]+/, '')
                .replace(/_+/g, '_')
                .replace(/_$/, '');

            if (!id) {
                id = 'process_' + Date.now().toString(36);
            }
            this.newProcess.id = id;
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
                    // Clean up the ID to ensure it's valid
                    id = id.toLowerCase()
                        .replace(/[^a-z0-9_]/g, '_')
                        .replace(/^[0-9_]+/, '')
                        .replace(/_+/g, '_')
                        .replace(/_$/, '');

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
    },
}
</script>