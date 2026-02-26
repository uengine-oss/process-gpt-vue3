<template>
    <div class="chat-info-header">
        <div>
            <!-- Phase 1-1: Info Row (Breadcrumbs + Status Badge + Saved Status + Read-only Badge) -->
            <div v-if="fullPath != 'chat' && fullPath != 'definition-map'" class="pdch-info-row d-flex align-center gap-2 px-4 pt-2 pb-1" style="flex-wrap: wrap;">
                <!-- Breadcrumbs -->
                <template v-if="breadcrumbs && breadcrumbs.length > 0">
                    <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
                        <v-chip size="x-small" variant="tonal" color="grey">{{ crumb }}</v-chip>
                        <v-icon v-if="idx < breadcrumbs.length - 1" size="12" class="text-medium-emphasis">mdi-chevron-right</v-icon>
                    </template>
                </template>
                <v-spacer />
                <!-- Status Badge -->
                <v-chip v-if="approvalState && approvalState.state" size="x-small" :color="statusColor" variant="flat">
                    {{ statusLabel }}
                </v-chip>
                <!-- Saved Status -->
                <span v-if="lastSavedTime" class="text-caption text-medium-emphasis">
                    {{ savedTimeText }}
                </span>
                <!-- Read-only Badge -->
                <v-chip v-if="readOnlyBadgeText" size="x-small" variant="tonal" color="grey-darken-1">
                    {{ readOnlyBadgeText }}
                </v-chip>
            </div>

            <div class="align-right gap-3 justify-space-between"
                :style="modelValueStyle ? 'padding: 12px 16px 2px 16px;' : 'padding: 9px 16px 9px 16px;'"
            >
                <v-row class="ma-0 pa-0 align-end"
                    style="min-height: 48px;"
                >
                    <div style="width: 91%;" class="mb-2">
                        <div v-if="fullPath != 'chat'" class="d-flex gap-2 align-center"
                        >
                            <v-text-field v-if="isEditableTitle" v-model="processName"
                                :label="$t('ProcessDefinitionChatHeader.processDefinitionName')" variant="underlined" hide-details class="pa-0 ma-0"
                                :maxlength="20" :counter="20"
                            ></v-text-field>
                            <div v-else>
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <h5
                                            v-bind="props"
                                            :class="['text-h5', 'mb-n1', { 'process-title-truncate': !expandedTexts.title }]"
                                            style="white-space: normal; word-break: break-word;"
                                        >
                                            {{ getDisplayText(modelValue, 'title', 24) }}
                                            <v-btn
                                                v-if="shouldShowToggleButton(modelValue, 24)"
                                                @click="toggleTextExpansion('title')"
                                                variant="text"
                                                size="small"
                                                color="primary"
                                                class="pa-0 text-caption ml-1"
                                                style="min-width: auto; height: auto; vertical-align: baseline;"
                                            >
                                                {{ expandedTexts.title ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                                            </v-btn>
                                        </h5>
                                    </template>
                                    <span>{{ modelValue }}</span>
                                </v-tooltip>
                            </div>
                        </div>
                        <h5 v-else class="text-h5 mb-n1">{{ $t('processDefinition.title') }}</h5>
                    </div>

                    <!-- 삭제 아이콘 -->
                    <div v-if="chatMode != 'consulting' && fullPath != 'chat'" class="ml-2" style="width: 5%;">
                        <v-tooltip v-if="isDeleted" location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                    density="comfortable" @click="beforeRestore"
                                >
                                <div class="mdi mdi-refresh" style="font-size: 24px;"></div>
                                </v-btn>
                            </template>
                            <span>{{ $t('processDefinition.restoreProcess') }}</span>
                        </v-tooltip>
                        <v-tooltip v-else location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                    density="comfortable" @click="beforeDelete"
                                >
                                    <TrashIcon size="24" style="color:#FB977D"/>
                                </v-btn>
                            </template>
                            <span>{{ $t('processDefinition.deleteProcess') }}</span>
                        </v-tooltip>
                    </div>
                </v-row>

                <div class="custom-tools">
                    <v-row class="ma-0 pa-0 pt-1"
                        :style="modelValueStyle ? 'margin: 5px 0 5.5px 0;' : ''"
                    >

                        <!-- PDF 저장, 이미지 캡처: View Mode에서만 표시 -->
                        <div class="mr-4 d-flex" v-if="bpmn && lock">
                            <!-- PDF 저장 아이콘 -->
                            <v-tooltip location="bottom" :text="$t('processDefinition.savePDF')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="savePDF" icon variant="text" class="text-medium-emphasis" density="comfortable">
                                        <v-icon>mdi-file-pdf-box</v-icon>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <!-- 이미지 캡처 아이콘 -->
                            <v-tooltip location="bottom" :text="$t('processDefinition.capture')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="capturePng" icon variant="text" class="text-medium-emphasis" density="comfortable">
                                        <Icons :icon="'image-download'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- 저장 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- 파일업로드 아이콘: Edit Mode에서만 표시 -->
                            <v-tooltip v-if="fullPath != 'definition-map' && !lock" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                        density="comfortable" @click="triggerFileInput">
                                        <Icons :icon="'upload'" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.import') }}</span>
                            </v-tooltip>
                            <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn,.jsonold,.csv,.xlsx,.pdf,.docx,.doc" style="display: none" />
                            <!-- Phase 4-5: URL Input Toggle -->
                            <v-tooltip v-if="fullPath != 'definition-map' && !lock" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                        density="comfortable" @click="$emit('toggleUrlInput')">
                                        <v-icon>mdi-link-plus</v-icon>
                                    </v-btn>
                                </template>
                                <span>{{ $t('aiCopilot.addUrl') }}</span>
                            </v-tooltip>

                            <!-- Phase 1-2: Mode Switcher (View / Edit / History) -->
                            <div v-if="bpmn && fullPath != 'chat' && fullPath != 'definition-map' && !isMobile" class="d-flex align-center">
                                <v-btn-toggle
                                    :model-value="currentMode"
                                    @update:model-value="onModeChange"
                                    density="compact"
                                    variant="outlined"
                                    divided
                                    mandatory
                                    class="pdch-mode-toggle"
                                >
                                    <v-btn value="view" size="small">
                                        <v-icon size="16" start>mdi-eye-outline</v-icon>
                                        {{ $t('toolbarInfo.viewMode') }}
                                    </v-btn>
                                    <v-btn value="edit" size="small">
                                        <v-icon size="16" start>mdi-pencil-outline</v-icon>
                                        {{ $t('toolbarInfo.editMode') }}
                                    </v-btn>
                                    <v-btn value="history" size="small" :disabled="lock">
                                        <v-icon size="16" start>mdi-history</v-icon>
                                        {{ $t('toolbarInfo.historyMode') }}
                                    </v-btn>
                                </v-btn-toggle>
                            </div>

                            <!-- 모바일 또는 기타: 기존 저장 아이콘 -->
                            <div v-else-if="bpmn && (isMobile || fullPath == 'chat' || fullPath == 'definition-map')">
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                            density="comfortable" @click="toggleLock">
                                            <Icons :icon="'save'" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('chat.processDefinitionSave') }}</span>
                                </v-tooltip>
                            </div>
                        </div>
                        <!-- 보기 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- Validate 버튼 (Phase 1-3) -->
                            <v-tooltip v-if="bpmn && fullPath != 'chat' && fullPath != 'definition-map'" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                        density="comfortable" @click="validateBpmn">
                                        <v-icon>mdi-shield-check-outline</v-icon>
                                    </v-btn>
                                </template>
                                <span>{{ $t('validation.title') }}</span>
                            </v-tooltip>
                            <!-- xml보기 아이콘 -->
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                        density="comfortable" @click="showXmlMode">
                                        <Icons :icon="'code-xml'" :color="isXmlMode ? '#1976D2' : '#666666'"/>
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
                                    <v-btn v-bind="props" @click="executeSimulate" icon variant="text" class="text-medium-emphasis" density="comfortable"
                                    >
                                        <Icons :icon="'bug-play'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <!-- 실행 아이콘 -->
                            <v-tooltip v-if="useExecute" location="bottom" :text="$t('processDefinition.execution')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="executeProcess" icon variant="text" class="text-medium-emphasis" density="comfortable"
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
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                        density="comfortable" @click="createFormUrl">
                                        <Icons :icon="'document'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- 마켓플레이스 -->
                        <div class="mr-4 d-flex" v-if="bpmn && useMarketplace">
                            <v-tooltip location="bottom" :text="$t('ProcessDefinitionChatHeader.addMarketplace')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis"
                                        density="comfortable" @click="openMarketplaceDialog"
                                    >
                                        <Icons :icon="'addMarketplace'" style="margin-top: 4px;" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- Phase 4-3: Time-Travel As-Is/To-Be Toggle -->
                        <div class="mr-4 d-flex align-center" v-if="bpmn && fullPath != 'chat' && fullPath != 'definition-map'">
                            <v-btn-toggle
                                v-model="timeTravelMode"
                                density="compact"
                                variant="outlined"
                                divided
                                mandatory
                                class="pdch-time-toggle"
                            >
                                <v-btn value="asIs" size="small">
                                    {{ $t('timeTravel.asIs') }}
                                </v-btn>
                                <v-btn value="toBe" size="small">
                                    {{ $t('timeTravel.toBe') }}
                                </v-btn>
                            </v-btn-toggle>
                        </div>

                        <!-- 프로세스 복제 -->
                        <div class="mr-4 d-flex" v-if="bpmn && fullPath != 'chat'">
                            <v-tooltip location="bottom" :text="$t('ProcessDefinitionChatHeader.duplicateProcess')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                        density="comfortable" @click="duplicateProcess"
                                    >
                                        <v-icon>mdi-content-copy</v-icon>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>

                        <!-- 개선 요청 (Published 상태일 때만) -->
                        <div class="mr-2 d-flex align-center" v-if="isPublishedProcess">
                            <v-btn
                                size="small"
                                color="warning"
                                variant="tonal"
                                density="comfortable"
                                class="pdch-reopen-btn"
                                @click="openReopenDialog"
                            >
                                <v-icon start size="15">mdi-comment-alert-outline</v-icon>
                                개선 요청
                            </v-btn>
                        </div>
                    </v-row>
                </div>
            </div>

            <v-divider class="ma-0" />
        </div>
    </div>

    <!-- 개선 요청 다이얼로그 -->
    <v-dialog v-model="reopenDialog" max-width="480" persistent>
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center pa-4 pb-2">
                <v-icon size="20" color="warning" class="mr-2">mdi-comment-alert</v-icon>
                <span class="text-subtitle-1 font-weight-bold">{{ $t('approvalState.requestReopenTitle') }}</span>
            </v-card-title>
            <v-card-text class="pt-2">
                <p class="text-body-2 text-medium-emphasis mb-3">
                    배포된 프로세스에 대해 개선이 필요한 경우 사유를 입력하면 관리자(Master)가 검토 후 승인합니다.
                </p>
                <v-textarea
                    v-model="reopenReason"
                    :label="$t('approvalState.requestReopenReason')"
                    :placeholder="$t('approvalState.requestReopenReasonPlaceholder')"
                    variant="outlined"
                    rows="4"
                    hide-details
                    auto-grow
                />
                <p v-if="reopenError" class="text-caption text-error mt-2">
                    {{ $t('approvalState.requestReopenReasonRequired') }}
                </p>
            </v-card-text>
            <v-card-actions class="px-4 pb-4">
                <v-spacer />
                <v-btn variant="text" size="small" @click="closeReopenDialog">취소</v-btn>
                <v-btn
                    color="warning"
                    variant="flat"
                    size="small"
                    :loading="reopenLoading"
                    @click="submitReopen"
                >
                    <v-icon start size="15">mdi-send</v-icon>
                    {{ $t('approvalState.requestReopenSubmit') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

const STATUS_COLOR_MAP = {
    draft: 'grey',
    in_review: 'warning',
    public_feedback: 'info',
    published: 'success',
    reopen_requested: 'orange',
};

export default {
    props: {
        modelValue: String,
        bpmn: String,
        fullPath: String,
        lock: Boolean,
        editUser: String,
        userInfo: Object,
        isXmlMode: Boolean,
        isEditable: Boolean,
        isDeleted: Boolean,
        chatMode: String,
        approvalState: {
            type: Object,
            default: null
        },
        breadcrumbs: {
            type: Array,
            default: () => []
        },
        lastSavedTime: {
            type: Date,
            default: null
        }
    },
    emits: ['update:modelValue', 'handleFileChange', 'toggleVerMangerDialog', 'executeProcess', 'executeSimulate',
        'toggleLock', 'showXmlMode', 'beforeDelete', 'beforeRestore', 'savePDF', 'capturePng',
        'createFormUrl', 'toggleMarketplaceDialog', 'duplicateProcess', 'reopenSubmitted', 'validateBpmn',
        'timeTravelChanged', 'toggleUrlInput'],
    data() {
        return {
            processName: "",
            expandedTexts: {
                title: false
            },
            reopenDialog: false,
            reopenReason: '',
            reopenError: false,
            reopenLoading: false,
            timeTravelMode: 'asIs',
            savedTimeTimer: null,
            savedTimeNow: new Date(),
        }
    },
    created() {
        this.processName = this.modelValue;
        // Update "saved N min ago" every 30s
        this.savedTimeTimer = setInterval(() => {
            this.savedTimeNow = new Date();
        }, 30000);
    },
    beforeUnmount() {
        if (this.savedTimeTimer) clearInterval(this.savedTimeTimer);
    },
    watch: {
        modelValue(newVal) {
            this.processName = newVal
        },
        timeTravelMode(newVal) {
            this.$emit('timeTravelChanged', newVal);
        },
        processName(newVal) {
            if (newVal && newVal.length > 20) {
                this.processName = newVal.substring(0, 20);
                return;
            }
            this.$emit('update:modelValue', newVal);
        }
    },
    computed: {
        mode() {
            return window.$mode;
        },
        Pal() {
            return window.$pal;
        },
        modelValueStyle() {
            if(this.modelValue && this.modelValue !== '' && !this.lock && this.editUser != '' && this.editUser == this.userInfo.name) {
                return true
            } else {
                return false
            }
        },
        isEditableTitle() {
            const checkGPT =  this.mode === 'ProcessGPT' ? ( this.editUser != '' && this.editUser == this.userInfo.name) : true;
            return !this.lock && checkGPT;
        },
        hasExternalCustomerRole() {
            return this.bpmn.includes('ExternalCustomer') || this.bpmn.includes('externalCustomer');
        },
        useSimulate() {
            return true
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
        isPublishedProcess() {
            const state = this.approvalState?.state;
            return state === 'published' || state === 'reopen_requested';
        },
        // Phase 1-1: Status Badge
        statusColor() {
            return STATUS_COLOR_MAP[this.approvalState?.state] || 'grey';
        },
        statusLabel() {
            const state = this.approvalState?.state;
            if (!state) return '';
            return this.$t(`progressBadge.${state}`) || state;
        },
        // Phase 1-1: Saved Time
        savedTimeText() {
            if (!this.lastSavedTime) return '';
            const diff = Math.floor((this.savedTimeNow - this.lastSavedTime) / 60000);
            if (diff < 1) return this.$t('toolbarInfo.savedJustNow');
            return this.$t('toolbarInfo.savedAgo', { n: diff });
        },
        // Phase 1-1: Read-only Badge
        readOnlyBadgeText() {
            if (this.lock && this.editUser && this.editUser !== '' && this.editUser !== this.userInfo?.name) {
                return this.$t('toolbarInfo.editingBy', { name: this.editUser });
            }
            if (this.lock) {
                return this.$t('toolbarInfo.readOnly');
            }
            return null;
        },
        // Phase 1-2: Current mode
        currentMode() {
            return this.lock ? 'view' : 'edit';
        },
    },
    methods: {
        // Phase 1-2: Mode change handler
        onModeChange(newMode) {
            if (newMode === 'history') {
                this.toggleVerMangerDialog();
            } else if (newMode === 'edit' && this.lock) {
                this.toggleLock();
            } else if (newMode === 'view' && !this.lock) {
                this.toggleLock();
            }
        },
        executeProcess() {
            this.$emit("executeProcess");
        },
        executeSimulate() {
            console.log("simulate")
            this.$emit('executeSimulate');
        },
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileChange(event) {
            this.$emit('handleFileChange', event);
        },
        toggleLock() {
            this.$emit('toggleLock');
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
        savePDF() {
            this.$emit('savePDF');
        },
        capturePng() {
            this.$emit('capturePng');
        },
        createFormUrl() {
            this.$emit('createFormUrl');
        },
        openMarketplaceDialog() {
            this.$emit('toggleMarketplaceDialog', true);
        },
        duplicateProcess() {
            this.$emit('duplicateProcess');
        },
        validateBpmn() {
            this.$emit('validateBpmn');
        },
        openReopenDialog() {
            this.reopenReason = '';
            this.reopenError = false;
            this.reopenDialog = true;
        },
        closeReopenDialog() {
            this.reopenDialog = false;
            this.reopenReason = '';
            this.reopenError = false;
        },
        async submitReopen() {
            if (!this.reopenReason.trim()) {
                this.reopenError = true;
                return;
            }
            this.reopenLoading = true;
            try {
                await backend.requestReopen(this.fullPath, this.reopenReason.trim());
                this.closeReopenDialog();
                this.$emit('reopenSubmitted');
            } catch (e) {
                console.error('[ProcessDefinitionChatHeader] requestReopen error:', e);
            } finally {
                this.reopenLoading = false;
            }
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
        }
    }
};
</script>

<style scoped>
.pdch-reopen-btn {
    font-size: 12px !important;
    letter-spacing: 0;
}
.pdch-info-row {
    min-height: 28px;
    font-size: 12px;
}
.pdch-mode-toggle {
    height: 30px !important;
}
.pdch-mode-toggle .v-btn {
    text-transform: none !important;
    font-size: 11px !important;
    letter-spacing: 0 !important;
    padding: 0 8px !important;
}
.pdch-time-toggle {
    height: 28px !important;
}
.pdch-time-toggle .v-btn {
    text-transform: none !important;
    font-size: 10px !important;
    letter-spacing: 0 !important;
    padding: 0 8px !important;
}
</style>
