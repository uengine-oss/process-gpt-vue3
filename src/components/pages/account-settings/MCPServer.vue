<template>
    <v-row class="justify-center ma-0 pa-0">
        <!-- 좌측: 리스트 -->
        <v-col cols="6" class="mcp-list-col">
            <v-card flat class="pa-1">
                <v-card-item class="pa-0">
                    <!-- <h5 class="text-h5 mb-4">MCP Servers</h5> -->
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
                            :placeholder="$t('MCPServer.searchMCPServers')"
                            single-line
                            hide-details
                        ></v-text-field>
                    </v-row>
                    <div class="mcp-server-list-box">
                        <v-list>
                            <template v-for="(server, key) in filteredMcpServers" :key="key">
                                <v-list-item class="mb-2" :class="{ 'bg-grey-lighten-4': editingKey === key }">
                                    <template v-slot:prepend>
                                        <v-icon :icon="getServerIcon(server)" :color="getServerColor(server)" size="24"></v-icon>
                                    </template>

                                    <v-list-item-title class="font-weight-medium">
                                        {{ formatServerName(key) }}
                                    </v-list-item-title>

                                    <v-list-item-subtitle class="text-caption">
                                        {{ getServerDescription(server) }}
                                    </v-list-item-subtitle>

                                    <div
                                        v-if="validationStatusMap[key]"
                                        class="text-caption mt-1 d-flex align-center"
                                        :class="
                                            isValidationClickable(key) ? 'text-primary validation-summary-link' : 'text-medium-emphasis'
                                        "
                                        @click.stop="isValidationClickable(key) && toggleExpand(key)"
                                    >
                                        <v-icon v-if="isValidationClickable(key)" size="12" class="mr-1">{{
                                            expandedServers[key] ? 'mdi-chevron-down' : 'mdi-chevron-right'
                                        }}</v-icon>
                                        {{ validationSummaryText(key) }}
                                    </div>

                                    <template v-slot:append>
                                        <div class="d-flex align-center">
                                            <v-icon
                                                v-if="validationStatusMap[key]"
                                                icon="mdi-circle"
                                                size="12"
                                                class="mr-2"
                                                :color="validationDotColor(key)"
                                            ></v-icon>
                                            <v-btn
                                                :icon="isDefaultServer(key) ? 'mdi-eye' : 'mdi-pencil'"
                                                variant="text"
                                                size="small"
                                                class="mr-2"
                                                @click.stop="editJson(key)"
                                            ></v-btn>
                                            <v-switch
                                                :model-value="server.enabled"
                                                color="primary"
                                                hide-details
                                                density="compact"
                                                @update:model-value="toggleServer(key, server.enabled)"
                                            ></v-switch>
                                        </div>
                                    </template>
                                </v-list-item>

                                <v-expand-transition>
                                    <div v-if="expandedServers[key]" class="pl-4 pr-2 pb-2">
                                        <McpValidationResult :result="validationStatusMap[key]" />
                                    </div>
                                </v-expand-transition>
                            </template>

                            <!-- <v-list-item class="mt-4" @click="addNewMCP">
                                <template v-slot:prepend>
                                    <v-icon icon="mdi-plus" color="primary" size="24"></v-icon>
                                </template>

                                <v-list-item-title class="font-weight-medium text-primary"> 새 MCP 서버 추가 </v-list-item-title>
                            </v-list-item> -->
                        </v-list>
                    </div>
                </v-card-item>
            </v-card>
        </v-col>

        <!-- 세로 디바이더 (데스크톱에서만 표시) -->
        <v-divider vertical class="mcp-divider"></v-divider>

        <!-- 우측: 수정 화면 (데스크톱) -->
        <v-col cols="6" class="mcp-edit-col pa-0" style="padding: 16px 16px 0px 16px !important">
            <div v-if="editingKey && !isAddMode" flat>
                <div class="pt-0 pb-4">
                    <v-row class="ma-0 pa-0 align-center">
                        <h5 class="text-h5 mb-3">{{ formatServerName(editingKey) }}</h5>
                    </v-row>
                    <vue-monaco-editor v-model:value="mcpJsonText" language="json" :options="getEditorOptions()" @mount="handleMount" />
                    <!-- <v-textarea
                        v-model="mcpJsonText"
                        label="MCP JSON"
                        hide-details
                        no-resize
                        class="limited-textarea"
                    /> -->
                </div>

                <div class="d-flex justify-space-between pb-2">
                    <v-btn
                        v-if="editingKey && !isEditingDefaultServer"
                        class="mr-2"
                        color="error"
                        variant="flat"
                        rounded
                        @click="deleteServer"
                        :loading="saving || adding"
                        >{{ $t('accountTab.delete') }}
                    </v-btn>
                    <div class="d-flex align-center ml-auto">
                        <v-btn color="grey" variant="flat" rounded class="mr-2" @click="closeEdit">{{ $t('accountTab.cancel') }}</v-btn>
                        <v-btn
                            v-if="!isEditingDefaultServer"
                            color="primary"
                            variant="flat"
                            rounded
                            @click="saveServerChanges"
                            :loading="saving"
                            >{{ $t('accountTab.save') }}
                        </v-btn>
                    </div>
                </div>
            </div>

            <div v-else-if="isAddMode && !editingKey" flat>
                <div class="pt-0 pb-4">
                    <h5 class="text-h5 mb-3">New MCP</h5>
                    <vue-monaco-editor
                        v-model:value="newJsonText"
                        language="json"
                        :options="monacoEditorOptions"
                        @mount="handleMount"
                        class="mcp-monaco-editor"
                    />
                    <!-- <v-textarea
                        v-model="newJsonText"
                        label="MCP JSON"
                        hide-details
                        no-resize
                        class="limited-textarea"
                    /> -->
                </div>

                <div class="d-flex justify-end pb-2">
                    <div class="d-flex align-center ml-auto">
                        <v-btn color="grey" variant="flat" rounded class="mr-2" @click="closeEdit">{{ $t('accountTab.cancel') }}</v-btn>
                        <v-btn color="primary" variant="flat" rounded @click="saveNewMCP" :loading="adding">{{
                            $t('accountTab.add')
                        }}</v-btn>
                    </div>
                </div>
            </div>

            <v-card v-else elevation="10" class="d-flex align-center justify-center add-mcp-server" @click="addNewMCP">
                <div class="text-center">
                    <v-icon size="64" color="gray" class="mb-4 server-icon">mdi-server</v-icon>
                    <v-list-item class="mt-4 add-mcp-server-item">
                        <v-row class="pa-0 ma-0 align-center">
                            <v-icon icon="mdi-plus" color="gray" size="24" class="plus-icon" style="padding-top: 1px"></v-icon>
                            <v-list-item-title class="font-weight-medium text-gray ml-2 server-title">{{
                                $t('accountTab.addMCPServer')
                            }}</v-list-item-title>
                        </v-row>
                    </v-list-item>
                </div>
            </v-card>
        </v-col>
    </v-row>

    <!-- 모바일용 수정 다이얼로그 -->
    <v-dialog v-model="editDialog" fullscreen transition="dialog-bottom-transition">
        <v-card>
            <!-- 상단 헤더 (배경 제거) -->
            <div class="pa-4 pb-0">
                <v-row class="ma-0 pa-0 align-center">
                    <h5 class="text-h5 mr-auto">{{ editingKey ? formatServerName(editingKey) : 'New MCP' }}</h5>
                    <Icons @click="closeEdit" :icon="'close'" :size="16" />
                </v-row>
            </div>

            <v-card-text class="pa-4">
                <vue-monaco-editor
                    v-if="editingKey"
                    v-model:value="mcpJsonText"
                    language="json"
                    :options="getEditorOptions()"
                    @mount="handleMount"
                />
                <vue-monaco-editor v-else v-model:value="newJsonText" language="json" :options="monacoEditorOptions" @mount="handleMount" />
                <!-- <v-textarea 
                    v-if="editingKey" 
                    v-model="mcpJsonText" 
                    label="MCP JSON" 
                    hide-details
                    no-resize
                    class="mobile-textarea"
                />
                <v-textarea
                    v-else
                    v-model="newJsonText"
                    label="MCP JSON"
                    hide-details
                    no-resize
                    class="mobile-textarea"
                /> -->
            </v-card-text>

            <!-- 하단 버튼 -->
            <div class="pa-4 pt-0">
                <div class="d-flex align-center ml-auto">
                    <v-btn
                        v-if="editingKey && !isEditingDefaultServer"
                        class="mr-2"
                        color="error"
                        variant="flat"
                        rounded
                        @click="deleteServer"
                        :loading="saving || adding"
                        >{{ $t('accountTab.delete') }}
                    </v-btn>
                    <v-btn
                        v-if="!editingKey || !isEditingDefaultServer"
                        @click="editingKey ? saveServerChanges : saveNewMCP"
                        class="ml-auto"
                        color="primary"
                        variant="flat"
                        rounded
                        :loading="saving || adding"
                        >{{ editingKey ? $t('accountTab.save') : $t('accountTab.add') }}
                    </v-btn>
                </div>
            </div>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { useMcpEditorStore } from '@/stores/mcpEditor';
import mcpValidatorService from '@/services/McpValidatorService';
import McpValidationResult from './McpValidationResult.vue';

const backend = BackendFactory.createBackend();

export default {
    components: { McpValidationResult },
    setup() {
        const mcpEditorStore = useMcpEditorStore();
        return { mcpEditorStore };
    },
    data: () => ({
        selectedToolToAdd: null,
        saving: false,
        adding: false,
        validationStatusMap: {},
        expandedServers: {},
        mcpServers: {},
        editDialog: false,
        searchQuery: '',
        monacoEditorOptions: {
            automaticLayout: true,
            formatOnType: true,
            formatOnPaste: true,
            readOnly: false,
            // --- 아래는 JSON 설정 편집 사용성 개선용 ---
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            // 긴 url/토큰 값이 가로 스크롤 없이 보이도록 줄바꿈
            wordWrap: 'on',
            // 좁은 편집 영역이라 미니맵은 자리만 차지한다
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            // v-dialog(오버레이) 안에서 자동완성·마우스오버 위젯이 잘리는 것을 방지
            fixedOverflowWidgets: true,
            // 우클릭 잘라내기/복사/붙여넣기 메뉴
            contextmenu: true,
            fontSize: 13,
            lineNumbers: 'on',
            bracketPairColorization: { enabled: true },
            renderLineHighlight: 'line',
            scrollbar: { alwaysConsumeMouseWheel: false }
        }
    }),
    computed: {
        // Store의 상태를 computed로 연결
        editingKey: {
            get() {
                return this.mcpEditorStore.editingKey;
            },
            set(value) {
                this.mcpEditorStore.editingKey = value;
            }
        },
        mcpJsonText: {
            get() {
                return this.mcpEditorStore.mcpJsonText;
            },
            set(value) {
                this.mcpEditorStore.updateMcpJsonText(value);
            }
        },
        newJsonText: {
            get() {
                return this.mcpEditorStore.newJsonText;
            },
            set(value) {
                this.mcpEditorStore.updateNewJsonText(value);
            }
        },
        isAddMode: {
            get() {
                return this.mcpEditorStore.isAddMode;
            },
            set(value) {
                this.mcpEditorStore.isAddMode = value;
            }
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        filteredMcpServers() {
            if (!this.searchQuery || this.searchQuery.trim() === '') {
                return this.mcpServers;
            }

            const query = this.searchQuery.toLowerCase();
            const filtered = {};

            Object.keys(this.mcpServers).forEach((key) => {
                const server = this.mcpServers[key];
                const serverName = this.formatServerName(key).toLowerCase();
                const serverDescription = this.getServerDescription(server).toLowerCase();

                // 타이틀(서버명)과 서브타이틀(설명)에서 검색
                if (serverName.includes(query) || serverDescription.includes(query)) {
                    filtered[key] = server;
                }
            });

            return filtered;
        },
        isDefaultServer() {
            return (key) => {
                const server = this.mcpServers[key];
                return server && server.is_default === true;
            };
        },
        isEditingDefaultServer() {
            return this.editingKey && this.isDefaultServer(this.editingKey);
        }
    },
    async mounted() {
        await this.loadData();
    },
    methods: {
        handleMount(editor) {
            if (!editor) return;

            const height = window.innerHeight - 320;
            editor.layout({ height: height, width: editor.getLayoutInfo().width });

            // NOTE: Monaco 인스턴스를 data()/컴포넌트 상태에 보관하면 안 된다.
            // Vue 3 가 반응형 프록시로 감싸면서 Monaco 의 거대한 내부 객체 그래프를 훑기 시작해
            // 예외 없이 화면이 멈춘다. 필요한 곳에서는 아래처럼 콜백 인자로 받은 editor 만 쓴다.

            // 붙여넣기 후 정렬 보정.
            //
            // formatOnPaste 는 "붙여넣은 범위"만 서식화하므로, 한 줄로 압축(minify)된 JSON 전체를
            // 붙여넣으면 줄바꿈이 없어 사실상 그대로 한 줄로 남는다. 그래서 붙여넣기 직후 내용이
            // 통째로 유효한 JSON 이면 보기 좋게 다시 펼쳐 준다.
            // JSON.parse/stringify 로 처리하므로 언어 서버 상태와 무관하게 항상 동작한다.
            if (typeof editor.onDidPaste === 'function') {
                editor.onDidPaste(() => {
                    // 붙여넣기 편집이 모델에 반영된 뒤 실행
                    setTimeout(() => this.prettifyEditorJson(editor), 0);
                });
            }

            // 편집기에서 포커스가 빠질 때 한 번 더 정렬한다.
            // (타이핑 도중에 정렬하면 커서가 튀므로 입력이 끝난 시점에만 손댄다)
            if (typeof editor.onDidBlurEditorText === 'function') {
                editor.onDidBlurEditorText(() => {
                    this.prettifyEditorJson(editor);
                });
            }
        },

        /** JSON 형식 오류를 사용자에게 알린다. (조용히 실패해서 '저장이 안 먹는' 것처럼 보이던 문제 방지) */
        notifyJsonError(error) {
            const detail = (error && error.message) || '';
            const message = `JSON 형식이 올바르지 않습니다. 내용을 확인해 주세요.${detail ? `\n(${detail})` : ''}`;
            const app = window.$app_;
            if (app) {
                app.snackbarMessage = message;
                app.snackbarColor = 'error';
                app.snackbar = true;
            } else {
                alert(message);
            }
        },

        /** 편집기 내용이 유효한 JSON 이면 들여쓰기를 정리한다. (유효하지 않으면 사용자의 입력을 건드리지 않음) */
        prettifyEditorJson(editor) {
            try {
                const model = editor.getModel && editor.getModel();
                if (!model) return;

                const raw = model.getValue();
                if (!raw || !raw.trim()) return;

                const pretty = JSON.stringify(JSON.parse(raw), null, 4);
                if (pretty === raw) return;

                // pushEditOperations 로 적용해야 Ctrl+Z 한 번으로 되돌릴 수 있다.
                const position = editor.getPosition && editor.getPosition();
                model.pushEditOperations([], [{ range: model.getFullModelRange(), text: pretty }], () => null);
                if (position && editor.setPosition) {
                    // 정렬 후 커서가 문서 밖으로 나가지 않도록 보정
                    const lineCount = model.getLineCount();
                    const line = Math.min(position.lineNumber, lineCount);
                    editor.setPosition({ lineNumber: line, column: Math.min(position.column, model.getLineMaxColumn(line)) });
                }
            } catch (e) {
                // JSON 이 아직 완성되지 않은 상태(편집 중)면 그대로 둔다.
            }
        },
        getEditorOptions() {
            return {
                ...this.monacoEditorOptions,
                readOnly: this.isEditingDefaultServer
            };
        },
        async loadData() {
            const configuredData = await backend.getMCPByTenant();
            if (configuredData && configuredData.mcpServers) {
                Object.keys(configuredData.mcpServers).forEach((key) => {
                    if (configuredData.mcpServers[key].enabled === undefined) {
                        configuredData.mcpServers[key].enabled = true;
                    }
                });
                this.mcpServers = configuredData.mcpServers;
            } else if (configuredData) {
                Object.keys(configuredData).forEach((key) => {
                    if (configuredData[key].enabled === undefined) {
                        configuredData[key].enabled = true;
                    }
                });
                this.mcpServers = configuredData;
            }

            Object.keys(this.mcpServers).forEach((key) => {
                if (this.mcpServers[key].enabled) {
                    this.autoValidateServer(key, this.mcpServers[key]);
                }
            });
        },
        editJson(serverKey) {
            this.isAddMode = false;
            this.editingKey = serverKey;
            const server = this.mcpServers[serverKey];

            // 기본 서버인 경우 is_default 속성 제외
            let serverData = { ...server };
            if (this.isDefaultServer(serverKey)) {
                const { is_default, ...serverWithoutDefault } = serverData;
                serverData = serverWithoutDefault;
            }

            const jsonData = {
                mcpServers: {
                    [serverKey]: serverData
                }
            };
            this.mcpJsonText = JSON.stringify(jsonData, null, 4);

            if (window.innerWidth < 1024) {
                this.editDialog = true;
            }
        },
        addNewMCP() {
            this.editingKey = null;
            this.mcpJsonText = '';
            this.selectedToolToAdd = null;
            this.isAddMode = true;

            const newJson = { mcpServers: {} };
            this.newJsonText = JSON.stringify(newJson, null, 4);

            if (window.innerWidth < 1024) {
                this.editDialog = true;
            }
        },
        closeEdit() {
            this.mcpEditorStore.clearEditingState();
            this.editDialog = false;
        },
        async autoValidateServer(key, serverConfig) {
            if (!serverConfig || !serverConfig.enabled) return;

            this.validationStatusMap = { ...this.validationStatusMap, [key]: { status: 'validating' } };
            try {
                const { is_default, enabled, ...configToValidate } = serverConfig;
                const result = await mcpValidatorService.validateServer(key, configToValidate);
                this.validationStatusMap = {
                    ...this.validationStatusMap,
                    [key]: result || { status: 'error', error_message: 'No validation result' }
                };
            } catch (error) {
                this.validationStatusMap = { ...this.validationStatusMap, [key]: { status: 'error', error_message: error.message } };
            }
        },
        clearValidation(key) {
            const statusMap = { ...this.validationStatusMap };
            delete statusMap[key];
            this.validationStatusMap = statusMap;

            const expanded = { ...this.expandedServers };
            delete expanded[key];
            this.expandedServers = expanded;
        },
        toggleExpand(key) {
            this.expandedServers = { ...this.expandedServers, [key]: !this.expandedServers[key] };
        },
        validationDotColor(key) {
            const status = this.validationStatusMap[key] && this.validationStatusMap[key].status;
            if (status === 'success') return 'success';
            if (status === 'error') return 'error';
            return 'grey';
        },
        isValidationClickable(key) {
            const status = this.validationStatusMap[key] && this.validationStatusMap[key].status;
            return status === 'success' || status === 'error';
        },
        validationSummaryText(key) {
            const info = this.validationStatusMap[key];
            if (!info) return '';
            if (info.status === 'success') {
                return this.$t('MCPServer.toolsAvailable', { count: (info.tools || []).length });
            }
            if (info.status === 'error') {
                return this.$t('MCPServer.validationFailed');
            }
            return this.$t('MCPServer.validating');
        },
        async toggleServer(key, value) {
            try {
                this.mcpServers[key].enabled = !value;
                // 기본 서버의 enabled 상태만 저장 (나머지는 그대로 유지)
                const dataToSave = {
                    mcpServers: this.mcpServers
                };
                await backend.setMCPByTenant(dataToSave);

                if (this.mcpServers[key].enabled) {
                    this.autoValidateServer(key, this.mcpServers[key]);
                } else {
                    this.clearValidation(key);
                }
            } catch (error) {
                this.mcpServers[key].enabled = !value;
                console.error('서버 토글 중 오류:', error);
            }
        },
        async saveServerChanges() {
            if (!this.editingKey) return;

            // 기본 서버는 수정 불가능
            if (this.isDefaultServer(this.editingKey)) {
                console.warn('기본 서버는 수정할 수 없습니다.');
                return;
            }

            this.saving = true;
            try {
                let parsedJson = {};
                try {
                    parsedJson = JSON.parse(this.mcpJsonText);
                } catch (e) {
                    // 예전에는 조용히 return 해서, 저장 버튼을 눌러도 아무 반응이 없는 것처럼 보였다.
                    this.notifyJsonError(e);
                    return;
                }

                let updatedServer = {};

                if (parsedJson.mcpServers && parsedJson.mcpServers[this.editingKey]) {
                    // mcpServers 구조에서 해당 서버 정보 추출
                    let serverData = parsedJson.mcpServers[this.editingKey];

                    // serverData 안에 또 mcpServers가 중첩되어 있는 경우 처리
                    if (serverData.mcpServers) {
                        // 중첩된 구조에서 실제 서버 데이터 추출
                        const nestedKey = Object.keys(serverData.mcpServers)[0];
                        if (nestedKey) {
                            serverData = serverData.mcpServers[nestedKey];
                        }
                    }

                    // 모든 속성을 그대로 복사하고, enabled 기본값만 설정
                    updatedServer = {
                        ...serverData,
                        enabled: serverData.enabled !== undefined ? serverData.enabled : true
                    };
                } else {
                    // 직접 서버 설정인 경우
                    updatedServer = {
                        ...parsedJson,
                        enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : true
                    };
                }

                const savedKey = this.editingKey;
                const updatedServers = {
                    ...JSON.parse(JSON.stringify(this.mcpServers)),
                    [savedKey]: updatedServer
                };

                const dataToSave = {
                    mcpServers: updatedServers
                };

                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                if (updatedServer.enabled) {
                    this.autoValidateServer(savedKey, updatedServer);
                } else {
                    this.clearValidation(savedKey);
                }
                this.closeEdit();
            } catch (error) {
                console.error('서버 저장 중 오류:', error);
            } finally {
                this.saving = false;
            }
        },
        async deleteServer() {
            if (!this.editingKey) return;

            // 기본 서버는 삭제 불가능
            if (this.isDefaultServer(this.editingKey)) {
                console.warn('기본 서버는 삭제할 수 없습니다.');
                return;
            }

            try {
                const deletedKey = this.editingKey;
                const updatedServers = { ...this.mcpServers };
                delete updatedServers[deletedKey];
                const dataToSave = {
                    mcpServers: updatedServers
                };
                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                this.clearValidation(deletedKey);
                this.closeEdit();
            } catch (error) {
                console.error('서버 삭제 중 오류:', error);
            }
        },
        formatServerName(key) {
            return key
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        },
        getServerIcon(server) {
            if (server.command === 'npx') return 'mdi-npm';
            if (server.command === 'uvx') return 'mdi-package-variant';
            if (server.command === 'deno') return 'mdi-language-javascript';
            if (server.type === 'url' || server.type === 'sse' || server.type === 'http') return 'mdi-web';
            return 'mdi-server';
        },
        getServerColor(server) {
            if (server.command === 'npx') return 'orange';
            if (server.command === 'uvx') return 'blue';
            if (server.command === 'deno') return 'green';
            if (server.type === 'url' || server.type === 'sse' || server.type === 'http') return 'purple';
            return 'grey';
        },
        getServerDescription(server) {
            if (server.description) return server.description;
            if (server.command === 'npx') return 'Node.js Package';
            if (server.command === 'uvx') return 'Python Package';
            if (server.command === 'deno') return 'Deno Runtime';
            if (server.type === 'url' || server.type === 'sse' || server.type === 'http') return 'Web Service';
            return 'Custom Server';
        },
        async saveNewMCP() {
            if (!this.newJsonText.trim()) return;

            this.adding = true;
            try {
                let parsedJson = {};
                try {
                    parsedJson = JSON.parse(this.newJsonText);
                } catch (e) {
                    console.error('JSON 파싱 오류:', e);
                    this.notifyJsonError(e);
                    return;
                }

                // mcpServers 구조가 있는 경우와 없는 경우를 구분하여 처리
                let serverKey = '';
                let newServer = {};

                if (parsedJson.mcpServers) {
                    // mcpServers 구조가 있는 경우
                    const mcpServers = parsedJson.mcpServers;
                    serverKey = Object.keys(mcpServers)[0];
                    if (!serverKey) {
                        serverKey = `custom-server-${Date.now()}`;
                    }

                    let serverData = mcpServers[serverKey];

                    // serverData 안에 또 mcpServers가 중첩되어 있는 경우 처리
                    if (serverData.mcpServers) {
                        // 중첩된 구조에서 실제 서버 데이터 추출
                        const nestedKey = Object.keys(serverData.mcpServers)[0];
                        if (nestedKey) {
                            serverKey = nestedKey; // 실제 서버 키로 업데이트
                            serverData = serverData.mcpServers[nestedKey];
                        }
                    }

                    // 모든 속성을 그대로 복사하고, enabled 기본값만 설정
                    newServer = {
                        ...serverData,
                        enabled: serverData.enabled !== undefined ? serverData.enabled : true
                    };
                } else {
                    // mcpServers 구조가 없는 경우 (직접 서버 설정)
                    serverKey = `custom-server-${Date.now()}`;

                    // 모든 속성을 그대로 복사하고, enabled 기본값만 설정
                    newServer = {
                        ...parsedJson,
                        enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : true
                    };
                }

                const updatedServers = {
                    ...this.mcpServers,
                    [serverKey]: newServer
                };
                const dataToSave = {
                    mcpServers: updatedServers
                };

                await backend.setMCPByTenant(dataToSave);
                this.mcpServers = updatedServers;
                if (newServer.enabled) {
                    this.autoValidateServer(serverKey, newServer);
                }
                this.newJsonText = '';
                this.selectedToolToAdd = null;
                this.closeEdit();
            } catch (error) {
                console.error('사용자 정의 서버 추가 중 오류:', error);
            } finally {
                this.adding = false;
            }
        }
    }
};
</script>

<style scoped>
/* 좌우 분할 레이아웃을 데스크톱 폭(모바일 다이얼로그 전환 기준인 1024px)까지는
   화면 배율/해상도와 무관하게 항상 좌우로 고정한다.
   (Vuetify 기본 lg 브레이크포인트(1280px)와 모바일 다이얼로그 전환 기준(1024px)이
   서로 달라 그 사이 구간에서 우측 영역이 사라지던 문제 방지) */
.mcp-edit-col,
.mcp-divider {
    display: none;
}
@media (min-width: 1024px) {
    .mcp-list-col {
        flex: 0 0 50% !important;
        max-width: 50% !important;
    }
    .mcp-edit-col {
        display: block !important;
        flex: 0 0 50% !important;
        max-width: 50% !important;
    }
    .mcp-divider {
        display: block !important;
    }
}

.limited-textarea :deep(.v-field__input) {
    height: calc(100vh - 320px) !important;
    overflow-y: auto !important;
}

.mobile-textarea :deep(.v-field__input) {
    height: calc(100vh - 130px) !important;
    overflow-y: auto !important;
}
.add-mcp-server {
    height: calc(100vh - 236px);
    border: 3px dashed rgba(128, 128, 128, 0.5);
}
.add-mcp-server:hover {
    border: 3px dashed rgba(var(--v-theme-primary), 1);
    background-color: rgba(var(--v-theme-primary), 0.1);
}
.add-mcp-server:hover .server-icon {
    color: rgb(var(--v-theme-primary)) !important;
}
.add-mcp-server:hover .plus-icon {
    color: rgb(var(--v-theme-primary)) !important;
}
.add-mcp-server:hover .server-title {
    color: rgb(var(--v-theme-primary)) !important;
}
.v-list-item {
    transition: background-color 0.2s ease;
}
.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}
.v-list-item.add-mcp-server-item:hover {
    background-color: rgba(var(--v-theme-primary), 0);
}
.validation-summary-link {
    cursor: pointer;
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
