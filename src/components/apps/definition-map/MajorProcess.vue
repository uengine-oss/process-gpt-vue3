<template>
    <div class="mb-3 major-hover">
        <v-card
            class="align-center pa-2 pr-2 pl-2 cp-major"
            elevation="10"
            style="border-radius: 10px !important; margin-bottom: 5px; border: 4px solid rgba(var(--v-theme-primary), 0.2)"
        >
            <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-1 font-weight-semibold">
                <v-row class="ma-0 pa-0 align-center">
                    <v-col cols="auto" class="ma-0 pa-0 text-left flex-grow-1 d-flex align-center" style="min-width: 0">
                        <!-- 전체 탭에서 도메인 표시 (이름 왼쪽) -->
                        <!-- <v-chip v-if="!selectedDomain && value.domain"
                            size="x-small"
                            :style="domainColor ? { backgroundColor: domainColor, color: domainTextColor } : {}"
                            :color="domainColor ? undefined : 'primary'"
                            :variant="domainColor ? 'flat' : 'tonal'"
                            class="mr-2 flex-shrink-0"
                        >
                            {{ value.domain }}
                        </v-chip> -->
                        <div
                            class="text-truncate font-weight-bold cursor-pointer"
                            style="font-size: 0.9rem"
                            @click="goProcess(parent.name, 'mega')"
                        >
                            {{ value.name }}
                        </div>
                    </v-col>
                    <v-col cols="auto" class="ma-0 pa-0">
                        <ProcessMenu
                            :size="14"
                            :type="type"
                            :process="value"
                            :enableEdit="enableEdit"
                            :selectedDomain="selectedDomain"
                            @add="openSubProcessDialog('add')"
                            @delete="deleteProcess"
                            @editProcessdialog="editProcessdialog"
                            @setPermission="openPermissionDialog(value)"
                        />
                    </v-col>
                </v-row>
            </h6>
            <ProcessDialog
                v-else-if="processDialogStatus && enableEdit && processType === 'update'"
                :enableEdit="enableEdit"
                :process="value"
                :processDialogStatus="processDialogStatus"
                :processType="processType"
                :type="type"
                :domains="domains"
                :defaultDomain="selectedDomain"
                @edit="editProcess"
                @closeProcessDialog="closeProcessDialog"
            />
        </v-card>

        <draggable
            v-if="enableEdit"
            class="dragArea list-group"
            :list="value.sub_proc_list"
            :animation="200"
            ghost-class="ghost-card"
            group="subProcess"
        >
            <transition-group>
                <div v-for="item in value.sub_proc_list" :key="item.id" class="cursor-pointer" v-show="isSubProcessVisible(item)">
                    <SubProcess
                        :value="item"
                        :parent="value"
                        :enableEdit="enableEdit"
                        @clickProcess="clickProcess"
                        :isExecutionByProject="isExecutionByProject"
                        @clickPlayBtn="clickPlayBtn"
                    />
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in filteredSubProcList" :key="item.id">
                <SubProcess
                    :value="item"
                    :parent="value"
                    :enableEdit="enableEdit"
                    @clickProcess="clickProcess"
                    :isExecutionByProject="isExecutionByProject"
                    @clickPlayBtn="clickPlayBtn"
                />
            </div>
        </div>
        <!-- Add Sub Process Dialog: 특정 도메인 탭에서만 표시 -->
        <ProcessDialog
            v-if="processDialogStatus && enableEdit && processType === 'add' && (selectedDomain || isPalUengine)"
            :enableEdit="enableEdit"
            :process="value"
            :processDialogStatus="processDialogStatus"
            :processType="processType"
            :type="type"
            @add="addProcess"
            @closeProcessDialog="closeProcessDialog"
            style="margin-top: 20px !important"
        />
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import SubProcess from './SubProcess.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue';
import BackendFactory from '@/components/api/BackendFactory';
import { getDefaultBpmnXml } from '@/utils/defaultBpmnXml.js';
import { syncBpmnDefinitionDisplayName } from '@/utils/procDefListMeta';

export default {
    components: {
        ProcessMenu,
        SubProcess,
        ProcessDialog
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
        isExecutionByProject: Boolean,
        selectedDomain: [String, Number],
        domains: Array,
        filteredProcDefIds: Array // null = no filter, [] = filter active but no matches
    },
    data: () => ({
        type: 'major'
    }),
    created() {
        // 다른 곳에서 프로세스 다이얼로그가 열리면 자신의 다이얼로그 닫기
        this._processDialogId = Math.random().toString(36).substr(2, 9);
        this._closeDialogHandler = (event) => {
            if (event.detail !== this._processDialogId) {
                this.processDialogStatus = false;
            }
        };
        window.addEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    beforeUnmount() {
        window.removeEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    computed: {
        isPalUengine() {
            return typeof window !== 'undefined' && window.$pal && window.$mode === 'uEngine';
        },
        domainColor() {
            if (!this.value.domain || !this.domains) return null;
            const domain = this.domains.find((d) => d.name === this.value.domain);
            return domain?.color || null;
        },
        domainTextColor() {
            if (!this.domainColor) return '#000000';
            const hex = this.domainColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.5 ? '#000000' : '#FFFFFF';
        },
        filteredSubProcList() {
            // null = no filter active, show all
            if (this.filteredProcDefIds === null || !this.value.sub_proc_list) {
                return this.value.sub_proc_list || [];
            }
            // Filter by proc_def_ids from process_organizations table
            return this.value.sub_proc_list.filter((sub) => {
                return this.filteredProcDefIds.includes(sub.id);
            });
        }
    },
    methods: {
        async addProcess(newProcess) {
            // 같은 레벨에 동일한 이름이 있는지 검증
            const isDuplicate = this.value.sub_proc_list.some((item) => item.name.toLowerCase() === newProcess.name.toLowerCase());
            if (isDuplicate) {
                this.$toast.error(this.$t('processDefinitionMap.duplicateName') || '동일한 이름의 프로세스가 이미 존재합니다.');
                return;
            }

            // Use provided ID or generate one (for existing process selection)
            let processId = newProcess.id;
            if (!processId) {
                // Fallback: generate ID from parent and name (for legacy/existing selection)
                processId = `${this.parent.name}_${newProcess.name}`
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, '_')
                    .replace(/_+/g, '_');
            }

            // 새로 만드는 서브프로세스: 기본 BPMN XML로 먼저 저장 후 맵에만 추가 (편집 버튼으로 이동)
            if (newProcess.isNew) {
                const backend = BackendFactory.createBackend();
                try {
                    const defaultXml = getDefaultBpmnXml(newProcess.name || 'Lane 1');
                    await backend.putRawDefinition(defaultXml, processId, {
                        type: 'bpmn',
                        name: newProcess.name
                    });
                } catch (e) {
                    console.error('[MajorProcess] 기본 BPMN 저장 실패:', e);
                    this.$toast?.error?.(this.$t('processDefinitionMap.saveFailed') || '프로세스 정의 저장에 실패했습니다.');
                    return;
                }
            } else if (typeof window !== 'undefined' && window.$mode === 'uEngine') {
                try {
                    const backend = BackendFactory.createBackend();
                    const r = await syncBpmnDefinitionDisplayName(backend, processId, newProcess.name);
                    if (!r.ok && r.reason !== 'no_xml' && r.reason !== 'empty') {
                        console.warn('[MajorProcess] 정의 표시명(TB name) 동기화:', r.reason);
                    }
                } catch (e) {
                    console.warn('[MajorProcess] 정의 표시명 동기화 실패:', e);
                }
            }

            this.value.sub_proc_list.push({
                id: processId,
                name: newProcess.name,
                ...(newProcess.commonModule !== undefined && { commonModule: !!newProcess.commonModule })
            });
        },
        openSubProcessDialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        deleteProcess() {
            this.parent.major_proc_list = this.parent.major_proc_list.filter((item) => item.id != this.value.id);

            // 성공 메시지 표시
            if (window.$app_) {
                window.$app_.snackbarMessage = this.$t('successMsg.delete');
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                window.$app_.snackbarSuccessStatus = true;
            }
        },
        editProcess(process) {
            // BaseProcess는 domain을 설정하지 않음 → Major 전용 오버라이드
            this.value.id = process.id;
            this.value.name = process.name;
            this.value.domain = process.domain ?? '';
        },
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value) {
            this.$emit('clickPlayBtn', value);
        },
        isSubProcessVisible(item) {
            // null = no filter active, show all
            if (this.filteredProcDefIds === null) {
                return true;
            }
            return this.filteredProcDefIds.includes(item.id);
        }
    }
};
</script>

<style></style>
