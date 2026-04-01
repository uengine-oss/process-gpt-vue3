<template>
    <div class="chat-info-header">
        <div>
            <div
                class="align-right gap-3 justify-space-between"
                :style="modelValueStyle ? 'padding: 12px 16px 2px 16px;' : 'padding: 9px 16px 9px 16px;'"
            >
                <v-row class="ma-0 pa-0 align-center" style="min-height: 48px">
                    <div class="d-flex justify-space-between align-start flex-grow-1 mb-2">
                        <div style="flex: 1; min-width: 0" class="d-flex align-center">
                            <div v-if="fullPath != 'chat'" class="d-flex gap-2 align-center flex-grow-1">
                                <v-text-field
                                    v-if="isEditableTitle"
                                    v-model="processName"
                                    :label="$t('ProcessDefinitionChatHeader.processDefinitionName')"
                                    variant="underlined"
                                    hide-details
                                    class="pa-0 ma-0"
                                ></v-text-field>
                                <div v-else-if="!isMobile">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <h5
                                                v-bind="props"
                                                :class="['text-h5', 'mb-n1', { 'process-title-truncate': !expandedTexts.title }]"
                                                style="white-space: normal; word-break: break-word"
                                            >
                                                {{ getDisplayText(modelValue, 'title', 24) }}
                                                <v-btn
                                                    v-if="shouldShowToggleButton(modelValue, 24)"
                                                    @click="toggleTextExpansion('title')"
                                                    variant="text"
                                                    size="small"
                                                    color="primary"
                                                    class="pa-0 text-caption ml-1"
                                                    style="min-width: auto; height: auto; vertical-align: baseline"
                                                >
                                                    {{ expandedTexts.title ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                                                </v-btn>
                                            </h5>
                                        </template>
                                        <span>{{ modelValue }}</span>
                                    </v-tooltip>
                                </div>
                            </div>
                            <h5 v-else-if="modelValue" class="text-h5 mb-n1">{{ modelValue }}</h5>
                            <h5 v-else class="text-h5 mb-n1">{{ $t('processDefinition.title') }}</h5>
                        </div>

                        <!-- 삭제 아이콘 -->
                        <div
                            v-if="canManageProcess && chatMode != 'consulting' && fullPath != 'chat'"
                            class="playwright-chat-header-delete-icon ml-4 flex-shrink-0 align-start"
                        >
                            <v-tooltip v-if="isDeleted" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="beforeRestore"
                                    >
                                        <v-icon>mdi-refresh</v-icon>
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDefinition.restoreProcess') }}</span>
                            </v-tooltip>
                            <v-tooltip v-else location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="beforeDelete"
                                    >
                                        <v-icon color="error">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDefinition.deleteProcess') }}</span>
                            </v-tooltip>
                        </div>
                    </div>
                </v-row>

                <div class="custom-tools">
                    <v-row class="ma-0 pa-0 pt-1" :style="modelValueStyle ? 'margin: 5px 0 5.5px 0;' : ''">
                        <div class="mr-0 d-flex" v-if="Pal">
                            <!-- PDF 저장: BPMN만 / 전체(태스크 매뉴얼 포함) — SubProcessDetail과 동일 -->
                            <v-menu location="bottom">
                                <template v-slot:activator="{ props: menuProps }">
                                    <v-tooltip location="bottom" :text="$t('processDefinition.savePDF')">
                                        <template v-slot:activator="{ props: tooltipProps }">
                                            <v-btn
                                                v-bind="{ ...menuProps, ...tooltipProps }"
                                                icon
                                                variant="text"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                            >
                                                <v-icon>mdi-file-pdf-box</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </template>
                                <v-list density="compact" min-width="240">
                                    <v-list-item @click="savePDF('full')">
                                        <v-list-item-title>{{ $t('subProcessDetail.pdfSaveFull') }}</v-list-item-title>
                                        <v-list-item-subtitle>{{ $t('subProcessDetail.pdfSaveFullHint') }}</v-list-item-subtitle>
                                    </v-list-item>
                                    <v-list-item @click="savePDF('bpmn')">
                                        <v-list-item-title>{{ $t('subProcessDetail.pdfSaveBpmnOnly') }}</v-list-item-title>
                                        <v-list-item-subtitle>{{ $t('subProcessDetail.pdfSaveBpmnOnlyHint') }}</v-list-item-subtitle>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </div>
                        <!-- 저장 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- BPMN 가져오기 메뉴 (직접 불러오기 / 엑셀 업로드) - PAL 모드에서도 표시 -->
                            <v-menu v-if="canManageProcess && fullPath != 'definition-map'" offset-y location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props: tooltipProps }">
                                            <v-btn
                                                v-bind="{ ...props, ...tooltipProps }"
                                                icon
                                                variant="text"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                            >
                                                <Icons :icon="'upload'" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.importMenu') }}</span>
                                    </v-tooltip>
                                </template>
                                <v-list density="compact">
                                    <v-list-item @click="triggerBpmnFileInput" :title="$t('chat.importBpmnFile')" />
                                    <v-list-item @click="triggerExcelFileInput" :title="$t('chat.importFromExcel')" />
                                </v-list>
                            </v-menu>
                            <input
                                type="file"
                                ref="fileInput"
                                @change="onBpmnFileChange"
                                accept=".bpmn,.jsonold,.csv"
                                style="display: none"
                            />
                            <input type="file" ref="excelFileInput" @change="onExcelFileChange" accept=".xlsx" style="display: none" />
                            <div v-if="showDefinitionActionButtons">
                                <!-- ProcessDefinitionChatHeader.vue 프로세스 정의 수정 및 저장 아이콘 -->
                                <!-- 잠금 상태: 편집 버튼 1개 -->
                                <template v-if="effectiveLock">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                type="button"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                                @click="toggleLock"
                                            >
                                                <Icons :icon="'pencil'" :size="18" />
                                            </v-btn>
                                        </template>
                                        <span v-if="editUser != '' && editUser != currentUserLockId">
                                            현재 {{ lockHolderLabel }} 님께서 수정 중입니다. 체크아웃 하는 경우 {{ lockHolderLabel }} 님이 수정한 내용은 손상되어 저장되지 않습니다. 체크아웃 하시겠습니까?
                                        </span>
                                        <span v-else>{{ $t('chat.unlock') }}</span>
                                    </v-tooltip>
                                </template>
                                <!-- 편집 중 + uEngine: 잠금(저장 없이) + 저장 버튼 분리 -->
                                <template v-else-if="mode === 'uEngine'">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                type="button"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                                @click="lockOnly"
                                            >
                                                <Icons :icon="'lock'" :size="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.lockOnly') }}</span>
                                    </v-tooltip>
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                type="button"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                                @click="toggleLock"
                                            >
                                                <Icons :icon="'save'" :size="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.processDefinitionSave') }}</span>
                                    </v-tooltip>
                                </template>
                                <!-- 편집 중 + 비 uEngine: 저장 버튼 1개 (기존) -->
                                <template v-else>
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                type="button"
                                                class="text-medium-emphasis"
                                                density="comfortable"
                                                @click="toggleLock"
                                            >
                                                <Icons :icon="'save'" :size="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.lock') }}</span>
                                    </v-tooltip>
                                </template>
                            </div>

                            <!-- 저장아이콘 -->
                            <div v-else>
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            type="button"
                                            class="text-medium-emphasis"
                                            density="comfortable"
                                            @click="toggleLock"
                                        >
                                            <Icons :icon="'save'" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('chat.processDefinitionSave') }}</span>
                                </v-tooltip>
                            </div>
                        </div>
                        <!-- 보기 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- 히스토리 아이콘 -->
                            <v-tooltip v-if="showHistoryButton" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <div v-bind="props" style="display: inline-block">
                                        <v-btn
                                            icon
                                            variant="text"
                                            type="button"
                                            class="text-medium-emphasis"
                                            density="comfortable"
                                            @click="toggleVerMangerDialog"
                                            :disabled="isHistoryButtonDisabled"
                                        >
                                            <HistoryIcon size="24" />
                                        </v-btn>
                                    </div>
                                </template>
                                <span>{{ historyTooltipText }}</span>
                            </v-tooltip>
                            <!-- xml보기 아이콘 -->
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        type="button"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="showXmlMode"
                                    >
                                        <Icons :icon="'code-xml'" :color="isXmlMode ? '#1976D2' : '#666666'" />
                                    </v-btn>
                                </template>
                                <span>{{ isXmlMode ? $t('processDefinition.showModeling') : $t('processDefinition.showXML') }}</span>
                            </v-tooltip>
                        </div>

                        <!-- 실행 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- 시뮬레이션 아이콘 -->
                            <v-tooltip v-if="useSimulate" location="bottom" :text="$t('processDefinition.simulate')">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        @click="executeSimulate"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                    >
                                        <Icons :icon="'bug-play'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <!-- 실행 아이콘 -->
                            <v-tooltip v-if="useExecute" location="bottom" :text="$t('processDefinition.execution')">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        @click="executeProcess"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                    >
                                        <Icons :icon="'play'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- 외부 고객 아이콘 -->
                        <div class="mr-4 d-flex" v-if="bpmn && hasExternalCustomerRole">
                            <v-tooltip location="bottom" :text="$t('processDefinition.webFormUrl')">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        type="button"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="createFormUrl"
                                    >
                                        <Icons :icon="'document'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- 마켓플레이스 -->
                        <div class="mr-4 d-flex" v-if="bpmn && useMarketplace">
                            <v-tooltip location="bottom" :text="$t('ProcessDefinitionChatHeader.addMarketplace')">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        type="button"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="openMarketplaceDialog"
                                    >
                                        <Icons :icon="'addMarketplace'" style="margin-top: 4px" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- BPMN 검증: 아이콘 클릭=검증, 호버=자동검증 드롭다운 -->
                        <div v-if="showDefinitionActionButtons && bpmn" class="ml-auto pl-2 d-flex align-center flex-shrink-0">
                            <v-menu
                                location="bottom end"
                                :close-on-content-click="false"
                                open-on-hover
                                transition="fade-transition"
                            >
                                <template v-slot:activator="{ props: menuProps }">
                                    <v-btn
                                        v-bind="menuProps"
                                        icon
                                        variant="text"
                                        type="button"
                                        density="comfortable"
                                        class="text-medium-emphasis"
                                        :title="$t('ProcessDefinitionChatHeader.validateBpmn')"
                                        @click="onValidateIconClick"
                                    >
                                        <v-icon size="22">mdi-clipboard-check-outline</v-icon>
                                    </v-btn>
                                </template>
                                <v-card class="validation-auto-dropdown pa-3" elevation="8" rounded="lg" min-width="248">
                                    <div class="text-caption font-weight-medium mb-2">
                                        {{ $t('ProcessDefinitionChatHeader.autoValidation') }}
                                    </div>
                                    <div class="d-flex align-center justify-space-between gap-2">
                                        <span class="text-body-2 text-medium-emphasis">{{
                                            $t('ProcessDefinitionChatHeader.autoValidationOnSave')
                                        }}</span>
                                        <v-switch
                                            v-model="autoValidationEnabled"
                                            color="primary"
                                            density="compact"
                                            hide-details
                                            inset
                                            class="ma-0 pa-0 validation-switch-sm"
                                        />
                                    </div>
                                    <p class="text-caption text-medium-emphasis mt-2 mb-0 opacity-80">
                                        {{ $t('ProcessDefinitionChatHeader.autoValidationMenuHint') }}
                                    </p>
                                </v-card>
                            </v-menu>
                        </div>
                    </v-row>
                </div>
            </div>

            <v-divider class="ma-0" />
        </div>
    </div>
</template>

<script>
import { readAutoBpmnValidation, writeAutoBpmnValidation } from '@/utils/bpmnValidationPrefs';

export default {
    props: {
        modelValue: String,
        bpmn: String,
        fullPath: String,
        lock: Boolean,
        canManageProcess: Boolean,
        editUser: String,
        /** uEngine: 이름(uid) 표기(잠금 툴팁·체크아웃 안내) */
        editUserDisplayLabel: {
            type: String,
            default: ''
        },
        userInfo: Object,
        isXmlMode: Boolean,
        isEditable: Boolean,
        isDeleted: Boolean,
        chatMode: String
    },
    data() {
        return {
            processName: '',
            expandedTexts: {
                title: false
            },
            hasVersionsToCompare: true,
            /** 저장 시 자동 BPMN 검증 (localStorage 동기화, 기본 true) */
            autoValidationEnabled: true
        };
    },
    async created() {
        this.processName = this.modelValue;
        this.autoValidationEnabled = readAutoBpmnValidation();
        await this.checkVersionsAvailability();
    },
    watch: {
        autoValidationEnabled(val) {
            writeAutoBpmnValidation(val);
        },
        modelValue(newVal) {
            this.processName = newVal;
        },
        processName(newVal) {
            this.$emit('update:modelValue', newVal);
        },
        fullPath() {
            this.checkVersionsAvailability();
        }
    },
    computed: {
        mode() {
            return window.$mode;
        },
        Pal() {
            return window.$pal;
        },
        effectiveLock() {
            return this.lock;
        },
        currentUserName() {
            return this.userInfo?.name || '';
        },
        /** uEngine은 잠금 user_id가 uid이므로 uid와 비교 */
        currentUserLockId() {
            if (this.mode === 'uEngine') return (typeof localStorage !== 'undefined' && localStorage.getItem('uid')) || '';
            return this.currentUserName;
        },
        lockHolderLabel() {
            return (this.editUserDisplayLabel || this.editUser || '').trim();
        },
        modelValueStyle() {
            const selfId = this.mode === 'uEngine' ? this.currentUserLockId : this.currentUserName;
            if (
                this.modelValue &&
                this.modelValue !== '' &&
                !this.effectiveLock &&
                this.editUser != '' &&
                this.editUser == selfId
            ) {
                return true;
            }
            return false;
        },
        isEditableTitle() {
            const checkGPT = this.mode === 'ProcessGPT' ? this.editUser != '' && this.editUser == this.currentUserName : true;
            return !this.effectiveLock && checkGPT;
        },
        hasDefinitionContext() {
            return this.fullPath != 'chat' && this.fullPath != 'definition-map' && !this.isMobile;
        },
        showDefinitionActionButtons() {
            if (this.mode === 'uEngine') {
                return this.hasDefinitionContext;
            }
            return !!this.bpmn && this.hasDefinitionContext;
        },
        showHistoryButton() {
            if (this.mode === 'uEngine') {
                return this.fullPath != 'chat' && this.fullPath != 'definition-map';
            }
            return !!this.bpmn && this.fullPath != 'chat' && this.fullPath != 'definition-map';
        },
        hasExternalCustomerRole() {
            return !!this.bpmn && (this.bpmn.includes('ExternalCustomer') || this.bpmn.includes('externalCustomer'));
        },
        useSimulate() {
            // if (!this.Pal && this.fullPath != 'definition-map' && this.mode != 'ProcessGPT') {
            //     return true;
            // } else {
            //     return false;
            // }
            return !this.Pal;
        },
        useExecute() {
            if (this.mode == 'ProcessGPT') {
                return false;
            } else if (!this.Pal && this.fullPath != 'definition-map' && this.fullPath != 'chat') {
                return true;
            } else {
                return false;
            }
        },
        useMarketplace() {
            return this.mode == 'ProcessGPT';
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        isHistoryButtonDisabled() {
            return this.effectiveLock || !this.hasVersionsToCompare;
        },
        historyTooltipText() {
            if (this.effectiveLock) {
                return this.$t('chat.historyDisabled');
            } else if (!this.hasVersionsToCompare) {
                return this.$t('ProcessDefinitionVersionManager.noVersionsAvailable');
            } else {
                return this.$t('chat.history');
            }
        }
    },
    methods: {
        executeProcess() {
            this.$emit('executeProcess');
        },
        executeSimulate() {
            console.log('simulate');
            this.$emit('executeSimulate');
        },
        triggerBpmnFileInput() {
            this.$refs.fileInput.click();
        },
        triggerExcelFileInput() {
            this.$refs.excelFileInput.click();
        },
        onBpmnFileChange(event) {
            this.$emit('handleFileChange', event, { source: 'bpmn' });
            event.target.value = '';
        },
        onExcelFileChange(event) {
            this.$emit('handleFileChange', event, { source: 'excel' });
            event.target.value = '';
        },
        toggleLock() {
            this.$emit('toggleLock');
        },
        lockOnly() {
            this.$emit('lockOnly');
        },
        toggleVerMangerDialog() {
            this.$emit('toggleVerMangerDialog', true);
        },
        beforeDelete() {
            this.$emit('beforeDelete');
        },
        beforeRestore() {
            this.$emit('beforeRestore');
        },
        showXmlMode() {
            this.$emit('showXmlMode');
        },
        savePDF(mode) {
            this.$emit('savePDF', mode);
        },
        createFormUrl() {
            this.$emit('createFormUrl');
        },
        openMarketplaceDialog() {
            this.$emit('toggleMarketplaceDialog', true);
        },
        getTruncatedText(text, maxLength) {
            if (!text || text.length <= maxLength) {
                return text;
            }
            return text.substring(0, maxLength) + '...';
        },
        shouldShowToggleButton(text, maxLength) {
            return text && text.length > maxLength;
        },
        toggleTextExpansion(textType) {
            this.expandedTexts[textType] = !this.expandedTexts[textType];
        },
        getDisplayText(text, textType, maxLength) {
            if (!text) return '';

            const isExpanded = this.expandedTexts[textType];
            return isExpanded ? text : this.getTruncatedText(text, maxLength);
        },
        onValidateIconClick(e) {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            this.$emit('validateBpmn');
        },
        async checkVersionsAvailability() {
            if (!this.fullPath || this.fullPath === 'chat' || this.fullPath === 'definition-map') {
                this.hasVersionsToCompare = true;
                return;
            }

            try {
                const BackendFactory = (await import('@/components/api/BackendFactory')).default;
                const backend = BackendFactory.createBackend();

                const result = await backend.getDefinitionVersions(this.fullPath, {
                    key: 'version',
                    sort: 'asc',
                    orderBy: 'timeStamp',
                    type: 'bpmn'
                });

                // 버전이 2개 이상이어야 비교 가능
                this.hasVersionsToCompare = result && result.length > 1;
            } catch (error) {
                this.hasVersionsToCompare = true;
            }
        }
    }
};
</script>

<style scoped>
.validation-auto-dropdown {
    border: 1px solid rgba(0, 0, 0, 0.08);
}
.validation-switch-sm {
    transform: scale(0.82);
    transform-origin: center right;
}
.validation-switch-sm :deep(.v-switch) {
    margin-top: 0;
    margin-bottom: 0;
}
</style>
