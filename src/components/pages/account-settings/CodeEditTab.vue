<template>
    <v-row class="justify-center ma-0 pa-0">
        <!-- 좌측: 프로세스 > 액티비티 트리 -->
        <v-col cols="6" class="code-list-col">
            <v-card flat class="pa-1">
                <v-card-item class="pa-0">
                    <!-- 검색 UI -->
                    <v-row
                        class="align-center flex-fill border border-borderColor header-search rounded-pill px-5 ma-0 pa-0 mb-3"
                        style="min-width: 100%"
                    >
                        <Icons :icon="'magnifer-linear'" :size="22" />
                        <v-text-field
                            v-model="searchQuery"
                            variant="plain"
                            density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color"
                            :placeholder="$t('codeEdit.searchPlaceholder')"
                            single-line
                            hide-details
                        ></v-text-field>
                    </v-row>

                    <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-3">
                        {{ loadError }}
                    </v-alert>

                    <div class="code-list-box">
                        <div v-if="loading" class="pa-4 text-center">
                            <v-progress-circular indeterminate color="primary" size="28"></v-progress-circular>
                        </div>

                        <div v-else-if="filteredGroups.length === 0" class="pa-4 text-center text-medium-emphasis text-body-2">
                            {{ searchQuery ? $t('codeEdit.noSearchResult') : $t('codeEdit.noCode') }}
                        </div>

                        <v-list v-else density="compact">
                            <template v-for="group in filteredGroups" :key="group.procDefId">
                                <!-- 프로세스 -->
                                <v-list-item class="process-row" @click="toggleGroup(group.procDefId)">
                                    <template v-slot:prepend>
                                        <v-icon size="20" class="mr-1">
                                            {{ isExpanded(group.procDefId) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                        </v-icon>
                                        <v-icon icon="mdi-sitemap-outline" color="primary" size="20"></v-icon>
                                    </template>

                                    <v-list-item-title class="font-weight-medium">
                                        {{ group.procDefName }}
                                    </v-list-item-title>

                                    <v-list-item-subtitle class="text-caption">
                                        {{ $t('codeEdit.activityCount', { count: group.items.length }) }}
                                    </v-list-item-subtitle>
                                </v-list-item>

                                <!-- 액티비티 -->
                                <v-expand-transition>
                                    <div v-if="isExpanded(group.procDefId)">
                                        <v-list-item
                                            v-for="item in group.items"
                                            :key="item.id"
                                            class="activity-row mb-1"
                                            :class="{ 'bg-grey-lighten-4': selectedId === item.id }"
                                            @click="selectItem(item)"
                                        >
                                            <template v-slot:prepend>
                                                <v-icon icon="mdi-code-braces" size="18" :color="item.deactivatedAt ? 'grey' : 'success'">
                                                </v-icon>
                                            </template>

                                            <v-list-item-title class="text-body-2">
                                                {{ item.activityName }}
                                            </v-list-item-title>

                                            <v-list-item-subtitle class="text-caption">
                                                <span :class="item.code ? 'text-success' : 'text-medium-emphasis'">
                                                    {{ $t('codeEdit.deterministicCode') }}
                                                    {{ item.code ? 'O' : 'X' }}
                                                </span>
                                                <span class="mx-1">·</span>
                                                <span :class="item.compensation ? 'text-success' : 'text-medium-emphasis'">
                                                    {{ $t('codeEdit.compensationCode') }}
                                                    {{ item.compensation ? 'O' : 'X' }}
                                                </span>
                                            </v-list-item-subtitle>

                                            <template v-slot:append>
                                                <v-chip v-if="item.deactivatedAt" size="x-small" color="grey" variant="tonal">
                                                    {{ $t('codeEdit.inactive') }}
                                                </v-chip>
                                            </template>
                                        </v-list-item>
                                    </div>
                                </v-expand-transition>
                            </template>
                        </v-list>
                    </div>
                </v-card-item>
            </v-card>
        </v-col>

        <!-- 세로 디바이더 (데스크톱에서만 표시) -->
        <v-divider vertical class="code-divider"></v-divider>

        <!-- 우측: 편집 화면 (데스크톱) -->
        <v-col cols="6" class="code-edit-col pa-0" style="padding: 16px 16px 0px 16px !important">
            <div v-if="selectedItem" flat>
                <div class="pt-0 pb-4">
                    <v-row class="ma-0 pa-0 align-center">
                        <h5 class="text-h5 mb-1 text-truncate">
                            {{ selectedItem.procDefName }}
                            <v-icon size="16" class="mx-1">mdi-chevron-right</v-icon>
                            {{ selectedItem.activityName }}
                        </h5>
                    </v-row>

                    <div class="d-flex align-center mb-2">
                        <v-chip size="x-small" class="mr-2" :color="selectedItem.deactivatedAt ? 'grey' : 'success'" variant="tonal">
                            {{ selectedItem.deactivatedAt ? $t('codeEdit.inactive') : $t('codeEdit.active') }}
                        </v-chip>
                        <span v-if="selectedItem.deactivatedReason" class="text-caption text-medium-emphasis">
                            {{ $t('codeEdit.deactivatedReason', { reason: selectedItem.deactivatedReason }) }}
                        </span>
                    </div>

                    <v-tabs v-model="codeTab" density="compact" color="primary" class="mb-2">
                        <v-tab value="code">{{ $t('codeEdit.deterministicCode') }}</v-tab>
                        <v-tab value="compensation">{{ $t('codeEdit.compensationCode') }}</v-tab>
                        <v-tab value="parameters">
                            {{ $t('codeEdit.parameters') }}
                            <v-icon v-if="hasSpecIssue" size="14" class="ml-1" :color="specCheck.valid ? 'warning' : 'error'">
                                mdi-alert-circle
                            </v-icon>
                        </v-tab>
                    </v-tabs>

                    <v-alert v-if="specAlert" :type="specAlert.type" variant="tonal" density="compact" class="mb-2 text-caption">
                        {{ specAlert.text }}
                    </v-alert>

                    <ParameterSpecEditor
                        v-if="codeTab === 'parameters'"
                        v-model="draft.parameters"
                        :code="draft.code"
                        :activity-options="selectedItem.activityOptions || []"
                        :monaco-options="monacoEditorOptions"
                        :box-class="specAlert ? 'param-box-with-alert' : 'param-box'"
                    />
                    <div v-else class="code-editor-box" :class="{ 'code-editor-box-with-alert': specAlert }">
                        <vue-monaco-editor
                            v-model:value="editingText"
                            language="python"
                            :options="monacoEditorOptions"
                            @mount="handleMount"
                        />
                    </div>
                </div>

                <div class="d-flex align-center pb-2">
                    <div class="d-flex align-center ml-auto">
                        <v-btn color="grey" variant="flat" rounded class="mr-2" @click="resetDraft" :disabled="!isDirty">
                            {{ $t('accountTab.cancel') }}
                        </v-btn>
                        <v-btn
                            color="primary"
                            variant="flat"
                            rounded
                            :loading="saving"
                            :disabled="!isDirty || !specCheck.valid"
                            @click="saveCode"
                        >
                            {{ $t('accountTab.save') }}
                        </v-btn>
                    </div>
                </div>
            </div>

            <v-card v-else elevation="10" class="d-flex align-center justify-center empty-code-panel">
                <div class="text-center">
                    <v-icon size="64" color="gray" class="mb-4">mdi-code-braces</v-icon>
                    <div class="text-body-2 text-medium-emphasis">{{ $t('codeEdit.selectActivity') }}</div>
                </div>
            </v-card>
        </v-col>
    </v-row>

    <!-- 모바일용 편집 다이얼로그 -->
    <v-dialog v-model="editDialog" fullscreen transition="dialog-bottom-transition">
        <v-card v-if="selectedItem">
            <div class="pa-4 pb-0">
                <v-row class="ma-0 pa-0 align-center">
                    <h5 class="text-h6 mr-auto text-truncate">
                        {{ selectedItem.procDefName }}
                        <v-icon size="14" class="mx-1">mdi-chevron-right</v-icon>
                        {{ selectedItem.activityName }}
                    </h5>
                    <Icons @click="closeEdit" :icon="'close'" :size="16" />
                </v-row>
            </div>

            <v-card-text class="pa-4">
                <v-tabs v-model="codeTab" density="compact" color="primary" class="mb-2">
                    <v-tab value="code">{{ $t('codeEdit.deterministicCode') }}</v-tab>
                    <v-tab value="compensation">{{ $t('codeEdit.compensationCode') }}</v-tab>
                    <v-tab value="parameters">
                        {{ $t('codeEdit.parameters') }}
                        <v-icon v-if="hasSpecIssue" size="14" class="ml-1" :color="specCheck.valid ? 'warning' : 'error'">
                            mdi-alert-circle
                        </v-icon>
                    </v-tab>
                </v-tabs>
                <v-alert v-if="specAlert" :type="specAlert.type" variant="tonal" density="compact" class="mb-2 text-caption">
                    {{ specAlert.text }}
                </v-alert>
                <ParameterSpecEditor
                    v-if="codeTab === 'parameters'"
                    v-model="draft.parameters"
                    :code="draft.code"
                    :activity-options="selectedItem.activityOptions || []"
                    :monaco-options="monacoEditorOptions"
                    box-class="param-box-mobile"
                />
                <div v-else class="code-editor-box-mobile">
                    <vue-monaco-editor v-model:value="editingText" language="python" :options="monacoEditorOptions" @mount="handleMount" />
                </div>
            </v-card-text>

            <div class="pa-4 pt-0">
                <div class="d-flex align-center">
                    <v-btn color="grey" variant="flat" rounded class="mr-2" @click="closeEdit">
                        {{ $t('accountTab.close') }}
                    </v-btn>
                    <v-btn
                        class="ml-auto"
                        color="primary"
                        variant="flat"
                        rounded
                        :loading="saving"
                        :disabled="!isDirty || !specCheck.valid"
                        @click="saveCode"
                    >
                        {{ $t('accountTab.save') }}
                    </v-btn>
                </div>
            </div>
        </v-card>
    </v-dialog>
</template>

<script>
/**
 * 결정론적 코드 / 보상(undo) 처리 코드 편집 화면.
 *
 * 저장소 접근은 전부 backend 어댑터에 맡긴다. 어떤 테이블의 어떤 컬럼인지, 같은 액티비티의
 * 비활성 이력 행 중 어느 것이 편집 대상인지는 실행 런타임과 맞춰야 하는 규칙이라 화면이 아니라
 * `ProcessGPTBackend.getDeterministicCodeList` 쪽에 있다.
 *
 * 파라미터 스펙을 코드와 같은 화면에서 고치게 두는 이유: 코드가 쓰는 `${이름}` 과 스펙에 적힌
 * 이름이 어긋나면 실행이 조용히 실패한다(에이전트 폴백). 한쪽만 고칠 수 있으면 어긋뜨리기만 쉽다.
 */
import BackendFactory from '@/components/api/BackendFactory';
import { checkParameterSpec } from '@/utils/deterministicCodeSpec';
import ParameterSpecEditor from './ParameterSpecEditor.vue';

const backend = BackendFactory.createBackend();

export default {
    components: { ParameterSpecEditor },
    data: () => ({
        loading: false,
        saving: false,
        loadError: '',
        searchQuery: '',
        rows: [],
        expandedGroups: {},
        selectedId: '',
        codeTab: 'code',
        // 편집 중 내용. 탭을 오가도 저장 전 수정이 사라지지 않도록 세 필드를 함께 들고 있는다.
        // parameters 는 jsonb 지만 화면에서는 JSON 텍스트로 다룬다(저장 직전에 파싱).
        draft: { code: '', compensation: '', parameters: '' },
        original: { code: '', compensation: '', parameters: '' },
        editDialog: false,
        monacoEditorOptions: {
            automaticLayout: true,
            readOnly: false,
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            wordWrap: 'on',
            // 좁은 편집 영역이라 미니맵은 자리만 차지한다
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            // v-dialog(오버레이) 안에서 자동완성·마우스오버 위젯이 잘리는 것을 방지
            fixedOverflowWidgets: true,
            contextmenu: true,
            fontSize: 13,
            lineNumbers: 'on',
            bracketPairColorization: { enabled: true },
            renderLineHighlight: 'line',
            scrollbar: { alwaysConsumeMouseWheel: false }
        }
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        selectedItem() {
            return this.rows.find((row) => row.id === this.selectedId) || null;
        },
        /** 프로세스 > 액티비티 2단 구조. 프로세스명·액티비티명 순으로 정렬한다. */
        groups() {
            const byProcess = {};
            this.rows.forEach((row) => {
                if (!byProcess[row.procDefId]) {
                    byProcess[row.procDefId] = {
                        procDefId: row.procDefId,
                        procDefName: row.procDefName,
                        items: []
                    };
                }
                byProcess[row.procDefId].items.push(row);
            });
            const result = Object.values(byProcess);
            result.forEach((group) => group.items.sort((a, b) => a.activityName.localeCompare(b.activityName)));
            return result.sort((a, b) => a.procDefName.localeCompare(b.procDefName));
        },
        filteredGroups() {
            const query = (this.searchQuery || '').trim().toLowerCase();
            if (!query) return this.groups;

            return this.groups
                .map((group) => {
                    // 프로세스명이 걸리면 그 프로세스의 액티비티를 모두 보여 준다.
                    if (group.procDefName.toLowerCase().includes(query)) return group;
                    const items = group.items.filter(
                        (item) =>
                            item.activityName.toLowerCase().includes(query) ||
                            String(item.activityId || '')
                                .toLowerCase()
                                .includes(query)
                    );
                    return items.length > 0 ? { ...group, items } : null;
                })
                .filter(Boolean);
        },
        editingText: {
            get() {
                return this.draft[this.codeTab] || '';
            },
            set(value) {
                this.draft[this.codeTab] = value;
            }
        },
        isDirty() {
            return (
                this.draft.code !== this.original.code ||
                this.draft.compensation !== this.original.compensation ||
                this.draft.parameters !== this.original.parameters
            );
        },
        /** 파라미터 스펙의 형식 검사 + 결정론적 코드와의 이름 대조. */
        specCheck() {
            return checkParameterSpec(this.draft.parameters, this.draft.code);
        },
        /**
         * 배너는 **저장을 막는 이유**만 말한다. 이름이 어긋난 파라미터는 편집기가 그 자리에서
         * 표시하므로, 같은 내용을 위에서 한 번 더 늘어놓으면 읽히지 않는다.
         */
        specAlert() {
            const check = this.specCheck;
            if (!check.valid) return { type: 'error', text: this.$t('codeEdit.specInvalid', { message: check.message }) };
            return null;
        },
        /** 탭에 붙는 표시 — 접혀 있어도 손볼 곳이 있다는 것은 알아야 한다. */
        hasSpecIssue() {
            const check = this.specCheck;
            return !check.valid || check.missing.length > 0 || check.unused.length > 0;
        }
    },
    watch: {
        // 검색 중에는 결과가 곧바로 보여야 하므로 걸린 프로세스를 자동으로 펼친다.
        searchQuery(value) {
            if (!value || !value.trim()) return;
            this.filteredGroups.forEach((group) => {
                this.expandedGroups[group.procDefId] = true;
            });
        }
    },
    async mounted() {
        await this.loadData();
    },
    methods: {
        notify(message, color) {
            const app = window.$app_;
            if (app) {
                app.snackbarMessage = message;
                app.snackbarColor = color;
                app.snackbar = true;
            } else if (color === 'error') {
                alert(message);
            }
        },
        async loadData() {
            this.loading = true;
            this.loadError = '';
            try {
                this.rows = await backend.getDeterministicCodeList();
            } catch (e) {
                console.error('[CodeEditTab] 코드 목록 조회 실패:', e);
                this.loadError = this.$t('codeEdit.loadFailed');
            } finally {
                this.loading = false;
            }
        },
        isExpanded(procDefId) {
            return this.expandedGroups[procDefId] === true;
        },
        toggleGroup(procDefId) {
            this.expandedGroups[procDefId] = !this.expandedGroups[procDefId];
        },
        selectItem(item) {
            if (this.isDirty && !window.confirm(this.$t('codeEdit.discardConfirm'))) return;

            this.selectedId = item.id;
            this.codeTab = 'code';
            this.original = {
                code: item.code || '',
                compensation: item.compensation || '',
                parameters: item.parameters ? JSON.stringify(item.parameters, null, 4) : ''
            };
            this.draft = { ...this.original };
            if (this.isMobile) this.editDialog = true;
        },
        resetDraft() {
            this.draft = { ...this.original };
        },
        closeEdit() {
            this.editDialog = false;
        },
        handleMount(editor) {
            if (!editor) return;
            // NOTE: Monaco 인스턴스를 data()/컴포넌트 상태에 보관하면 안 된다.
            // Vue 3 가 반응형 프록시로 감싸면서 Monaco 의 거대한 내부 객체 그래프를 훑기 시작해
            // 예외 없이 화면이 멈춘다. 필요한 곳에서는 콜백 인자로 받은 editor 만 쓴다.
            editor.layout();
        },
        async saveCode() {
            const item = this.selectedItem;
            if (!item) return;

            // 저장 버튼이 이미 막고 있지만, 깨진 스펙이 DB 로 들어가면 실행이 통째로 멈추므로 한 번 더 본다.
            if (!this.specCheck.valid) {
                this.notify(this.$t('codeEdit.specInvalid', { message: this.specCheck.message }), 'error');
                return;
            }

            this.saving = true;
            try {
                const parameters = this.draft.parameters.trim() ? JSON.parse(this.draft.parameters) : null;
                await backend.updateDeterministicCode(item.id, {
                    code: this.draft.code,
                    compensation: this.draft.compensation,
                    parameters
                });

                item.code = this.draft.code;
                item.compensation = this.draft.compensation;
                item.parameters = parameters;
                this.original = { ...this.draft };
                this.notify(this.$t('codeEdit.saved'), 'success');
            } catch (e) {
                console.error('[CodeEditTab] 코드 저장 실패:', e);
                this.notify(this.$t('codeEdit.saveFailed'), 'error');
            } finally {
                this.saving = false;
            }
        }
    }
};
</script>

<style scoped>
/* 좌우 분할 레이아웃을 데스크톱 폭(모바일 다이얼로그 전환 기준인 1024px)까지는
   화면 배율/해상도와 무관하게 항상 좌우로 고정한다. (MCP 서버 탭과 동일 규칙) */
.code-edit-col,
.code-divider {
    display: none;
}
@media (min-width: 1024px) {
    .code-list-col {
        flex: 0 0 50% !important;
        max-width: 50% !important;
    }
    .code-edit-col {
        display: block !important;
        flex: 0 0 50% !important;
        max-width: 50% !important;
    }
    .code-divider {
        display: block !important;
    }
}

.code-list-box {
    height: calc(100vh - 300px);
    overflow-y: auto;
}

.code-editor-box {
    height: calc(100vh - 400px);
}

/* 대조 배너가 뜬 만큼 편집 영역을 줄인다. 그러지 않으면 아래 저장 버튼이 밀려 잘린다. */
.code-editor-box-with-alert {
    height: calc(100vh - 452px);
}

/* 파라미터 편집 영역은 자식 컴포넌트가 그리므로 :deep 으로 높이를 준다.
   폼/JSON 전환 줄(48px)이 위에 하나 더 있어 코드 편집기보다 그만큼 낮다. */
:deep(.param-box) {
    height: calc(100vh - 448px);
    overflow-y: auto;
}
:deep(.param-box-with-alert) {
    height: calc(100vh - 500px);
    overflow-y: auto;
}
:deep(.param-box-mobile) {
    height: calc(100vh - 298px);
    overflow-y: auto;
}

.code-editor-box-mobile {
    height: calc(100vh - 250px);
}

.empty-code-panel {
    height: calc(100vh - 236px);
    border: 3px dashed rgba(128, 128, 128, 0.5);
}

.v-list-item {
    transition: background-color 0.2s ease;
}
.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}
.activity-row {
    padding-left: 40px !important;
}

/* 모바일 다이얼로그 스타일 */
.dialog-bottom-transition-enter-active,
.dialog-bottom-transition-leave-active {
    transition: transform 0.3s ease-in-out;
}
.dialog-bottom-transition-enter-from,
.dialog-bottom-transition-leave-to {
    transform: translateY(100%);
}
</style>
