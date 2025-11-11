<template>
    <div>
        <v-row class="ma-0 pa-0 process-definition-chat-tree-box">
            <!-- 왼쪽: TreeView -->
            <v-col v-if="isTreeViewVisible" cols="12" md="3" class="pa-0">
                <v-card elevation="10" class="pa-3 tree-view-card">
                    <v-row class="ma-0 pa-0">
                        <v-card-title class="ma-0 pa-0">
                            <v-icon class="mr-2" size="20">mdi-file-tree</v-icon>
                            {{ $t('ProcessDefinitionChatWithTree.processHierarchy') }}
                        </v-card-title>
                        <v-spacer></v-spacer>
                        
                        <!-- <div class="d-flex ga-2">
                            <v-btn @click="selectedProcessId = null"
                                color="primary"
                                variant="flat" 
                                class="rounded-pill"
                                density="compact"
                            >{{ $t('ProcessDefinitionChatWithTree.newProcess') }}
                            </v-btn>
                        </div> -->
                    </v-row>

                    <div class="process-definition-chat-tree-box-inner mt-2">
                        <!-- TreeView -->
                        <div v-if="isLoadingProcessDefinitionMap" class="text-center pa-5">
                            <v-progress-circular indeterminate color="primary"></v-progress-circular>
                            <div class="mt-3">{{ $t('common.loading') }}</div>
                        </div>
                        
                        <v-treeview
                            v-else-if="!isLoadingProcessDefinitionMap && Object.keys(nodes).length > 0"
                            :config="config"
                            :nodes="nodes"
                            class="process-tree"
                            @nodeOpened="handleNodeOpened"
                            @nodeClosed="handleNodeClosed"
                            @nodeClicked="handleNodeClick"
                        >
                            <template #before-input="{ node }">
                                <span 
                                    :class="{ 'selected-indicator': node.state?.selected }" 
                                    class="node-indicator"
                                ></span>
                            </template>
                            
                            <template #after-input="{ node }">
                                <div class="node-action-buttons" v-if="node && node.data">
                                    <v-tooltip 
                                        v-for="(btn, index) in getNodeActionButtons(node)" 
                                        :key="index"
                                        location="bottom"
                                    >
                                        <template v-slot:activator="{ props }">
                                            <v-btn 
                                                v-bind="props" 
                                                icon 
                                                variant="text" 
                                                type="file" 
                                                class="node-action-btn" 
                                                density="comfortable" 
                                                @click.stop="btn.action(node)"
                                            >
                                                <Icons :icon="btn.icon" :size="btn.size" :color="btn.iconColor" />
                                            </v-btn>
                                        </template>
                                        <span>{{ btn.tooltip }}</span>
                                    </v-tooltip>
                                </div>
                            </template>
                        </v-treeview>
                        
                        <v-alert v-else-if="!isLoadingProcessDefinitionMap && Object.keys(nodes).length === 0" type="info" variant="tonal" class="mt-3">
                            {{ $t('ProcessDefinitionChatWithTree.noProcessDefinition') }}
                        </v-alert>
                    </div>
                </v-card>
            </v-col>

            <!-- 오른쪽: ProcessDefinitionChat -->
            <v-col cols="12" :md="isTreeViewVisible ? 9 : 12" class="pa-0 chat-container">
                <v-card flat class="pa-3">
                    <div class="ma-0 pa-0 align-center d-flex">
                        <!-- 트리뷰 토글 버튼 -->
                        <v-btn 
                            icon
                            flat
                            @click="isTreeViewVisible = !isTreeViewVisible"
                            class="mr-2"
                            size="32"
                        >
                            <Icons :icon="'list-bold-duotone'"/>
                        </v-btn>
                        
                        <!-- 검색창 (자동완성 지원) -->
                        <v-autocomplete
                            v-model="searchValue"
                            :items="processElementList"
                            variant="outlined"
                            density="compact"
                            :placeholder="$t('chatListing.search')"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            hide-details
                            class="flex-fill rounded-pill"
                            @update:model-value="handleRealtimeSearch"
                            @update:search="handleSearchInput"
                            @focus="updateElementList"
                            auto-select-first
                        >
                            <template v-slot:item="{ props, item }">
                                <v-list-item v-bind="props" :title="item.raw.name">
                                    <!-- <template v-slot:prepend>
                                        <v-icon>{{ item.raw.icon }}</v-icon>
                                    </template> -->
                                    <!-- <v-list-item-title>{{ item.raw.name }}</v-list-item-title> -->
                                </v-list-item>
                            </template>
                        </v-autocomplete>
                        <v-spacer></v-spacer>
                        
                        <!-- 버튼들 -->
                        <div class="d-flex ga-2">
                            <v-btn
                                @click="openFileDialog"
                                color="grey"
                                variant="flat"
                                class="rounded-pill"
                                density="compact"
                            >
                                <v-icon class="mr-2">mdi-file-excel</v-icon>
                                {{ uploadedFileName || $t('processDefinitionTree.uploadExcel') }}
                            </v-btn>
                            <v-btn 
                                @click="handleCreateMap"
                                :disabled="!selectedFile"
                                :loading="isParsingExcel"
                                color="grey"
                                variant="flat"
                                class="rounded-pill"
                                density="compact"
                            >
                                {{ $t('processDefinitionTree.createMap') }}
                            </v-btn>
                            <v-btn 
                                @click="toggleFlowView"
                                :color="showFlowOverlay ? 'primary' : 'grey'"
                                variant="flat"
                                class="rounded-pill"
                                density="compact"
                            >
                                <v-icon class="mr-2">mdi-chart-timeline-variant</v-icon>
                                {{ showFlowOverlay ? 'BPMN으로 보기' : 'Flow로 보기' }}
                            </v-btn>
                            <v-btn 
                                @click="handleDownloadExcel"
                                color="grey"
                                variant="flat"
                                class="rounded-pill"
                                density="compact"
                            >
                                <v-icon class="mr-2">mdi-download</v-icon>
                                {{ $t('ProcessDefinitionChatWithTree.downloadExcel') }}
                            </v-btn>
                        </div>
                        
                        <!-- 숨겨진 파일 입력 -->
                        <input
                            ref="fileInput"
                            type="file"
                            accept=".xlsx,.xls"
                            style="display: none"
                            @change="handleFileSelect"
                        />
                    </div>
                </v-card>
                
                <ProcessDefinitionChat
                    ref="processDefinitionChat"
                    :chatMode="chatMode"
                    :selectedProcessDefinitionId="selectedProcessId"
                    :treeProcessLocation="treeProcessLocation"
                    :showFlowOverlay="showFlowOverlay"
                    :currentProcessDefinitionForFlow="currentProcessDefinitionForFlow"
                    :showActivityPanel="showActivityPanel"
                    :selectedFlowActivity="selectedFlowActivity"
                    :key="selectedProcessId || 'default'"
                    @closeFlowOverlay="closeFlowOverlay"
                    @closeActivityPanel="closeActivityPanel"
                    @node-double-click="handleFlowNodeDoubleClick"
                    @save-activity-changes="saveActivityChanges"
                    @generation-finished="handleGenerationFinished"
                    @process-definition-ready="handleProcessDefinitionReady"
                />
            </v-col>
        </v-row>

        <!-- Major -> Sub 추가 시 ProcessDialog 사용 -->
        <ProcessDialog
            v-if="processDialog && processDialogMode === 'add' && currentNodeType === 'major'"
            :process="processForm"
            :enableEdit="true"
            :type="currentNodeType"
            :processDialogStatus="processDialog"
            :processType="processDialogMode"
            :subProcessDialogStauts="true"
            @add="handleProcessAdd"
            @closeProcessDialog="closeProcessDialog"
        />

        <!-- Mega -> Major 추가 및 수정용 간단한 다이얼로그 -->
        <v-dialog v-model="processDialog" max-width="500" persistent 
            v-else-if="processDialog && (processDialogMode === 'update' || currentNodeType === 'mega')">
            <v-card>
                <v-card-title class="pa-4">
                    <span v-if="processDialogMode === 'add'">
                        {{ $t('ProcessDefinitionChatWithTree.addMajorProcess') }}
                    </span>
                    <span v-else>
                        {{ currentNodeType === 'mega' ? $t('ProcessDefinitionChatWithTree.editMegaProcess') : 
                           currentNodeType === 'major' ? $t('ProcessDefinitionChatWithTree.editMajorProcess') : 
                           currentNodeType === 'sub' ? $t('ProcessDefinitionChatWithTree.editSubProcess') : $t('ProcessDefinitionChatWithTree.editProcess') }}
                    </span>
                </v-card-title>
                
                <v-card-text class="pa-4">
                    <v-text-field
                        v-model="processForm.name"
                        :label="$t('ProcessDefinitionChatWithTree.processName')"
                        variant="outlined"
                        density="comfortable"
                        autofocus
                        @keyup.enter="saveProcessDialog"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions class="pa-4 pt-0 justify-center">
                    <v-btn
                        color="primary"
                        variant="flat"
                        @click="saveProcessDialog"
                    >
                        {{ processDialogMode === 'add' ? $t('ProcessDefinitionChatWithTree.add') : $t('ProcessDefinitionChatWithTree.edit') }}
                    </v-btn>
                    <v-btn
                        color="error"
                        variant="flat"
                        @click="closeProcessDialog"
                    >
                        {{ $t('ProcessDefinitionChatWithTree.cancel') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </div>
</template>

<script>
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';
import ProcessDialog from '@/components/apps/definition-map/ProcessDialog.vue';
import ProcessFlowExample from '@/components/ProcessFlowExample.vue';
import BackendFactory from '@/components/api/BackendFactory';
import VTreeview from 'vue3-treeview';
import 'vue3-treeview/dist/style.css';
import * as XLSX from 'xlsx-js-style';
import { useCustomizerStore } from '@/stores/customizer';

const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessDefinitionChatWithTree',
    components: {
        ProcessDefinitionChat,
        ProcessDialog,
        ProcessFlowExample,
        VTreeview,
    },
    props: {
        
    },
    data: () => ({
        nodes: {},
        config: {
            roots: [],
            checkboxes: false,
            editable: false,
            disabled: false
        },
        chatMode: 'tree',
        processDefinitionMap: null,
        selectedNodeId: null,
        selectedProcessId: null,
        search: '',
        searchValue: '',
        searchInputText: '',
        processElementList: [],
        // 엑셀 파일 업로드 관련
        selectedFile: null,
        uploadedFileName: null,
        isParsingExcel: false,
        parsedExcelData: null,
        originalWorkbook: null, // 원본 엑셀 워크북 저장
        originalWorkbookInfo: null, // 원본 엑셀 구조 정보 저장
        // 프로세스 정의 체계도 로딩 상태
        isLoadingProcessDefinitionMap: false,
        // 프로세스 다이얼로그
        processDialog: false,
        processDialogMode: 'add',
        currentNodeType: '',
        currentNode: null,
        processForm: {
            id: '',
            name: ''
        },
        // 트리 상태 관리
        openedNodes: [],
        // 트리뷰 표시 상태
        isTreeViewVisible: true,
        // Flow 오버레이 표시 상태
        showFlowOverlay: false,
        // Vue Flow에 표시할 현재 프로세스 정의
        currentProcessDefinitionForFlow: null,
        // 트리에서 생성된 프로세스의 위치 정보 (AI 생성 시 사용)
        treeProcessLocation: null,
        // Flow에서 선택된 액티비티
        selectedFlowActivity: null,
        // 속성 패널 표시 여부
        showActivityPanel: false,
    }),
    async created() {
        // 저장된 트리 상태 불러오기
        try {
            const saved = localStorage.getItem('processTreeOpenedNodes');
            if (saved) {
                this.openedNodes = JSON.parse(saved);
            }
        } catch (error) {
            console.error('트리 상태 불러오기 실패:', error);
        }
        
        await this.loadProcessDefinitionMap();
    },
    async mounted() {
        // DOM 조작 제거 - slot으로 대체됨
        // 사이드바가 열려있으면 닫기
        const customizer = useCustomizerStore();
        if (customizer.Sidebar_drawer) {
            customizer.SET_SIDEBAR_DRAWER();
        }

        const processMap = await backend.getProcessDefinitionMap();
        let firstSubProcessId = null;
        let firstSubProcessLocation = null;

        // mega_proc_list를 순회하며 첫 번째 서브프로세스 찾기
        if (processMap && processMap.mega_proc_list) {
            for (const megaProc of processMap.mega_proc_list) {
                if (megaProc.major_proc_list && megaProc.major_proc_list.length > 0) {
                    for (const majorProc of megaProc.major_proc_list) {
                        if (majorProc.sub_proc_list && majorProc.sub_proc_list.length > 0) {
                            const firstSubProc = majorProc.sub_proc_list[0];
                            firstSubProcessId = firstSubProc.id;
                            
                            // 첫 번째 프로세스의 위치 정보 저장
                            firstSubProcessLocation = {
                                megaProcessId: megaProc.id,
                                majorProcessId: majorProc.id,
                                processDefinitionId: firstSubProc.id,
                                megaProcessName: megaProc.name,
                                majorProcessName: majorProc.name,
                                processDefinitionName: firstSubProc.name
                            };
                            break;
                        }
                    }
                }
                if (firstSubProcessId) break;
            }
        }

        this.selectedProcessId = firstSubProcessId;
        this.selectedNodeId = firstSubProcessId ? `sub_${firstSubProcessId}` : null;
        this.treeProcessLocation = firstSubProcessLocation;
        
        // 트리가 로드된 후 선택 상태 업데이트 및 클릭 이벤트 추가
        this.$nextTick(() => {
            if (this.selectedNodeId && this.nodes[this.selectedNodeId]) {
                this.nodes[this.selectedNodeId].state.selected = true;
            }
            
            // 트리 노드 클릭 이벤트 추가
            this.attachNodeClickEvents();
        });
    },
    updated() {
        // DOM 조작 제거 - slot으로 대체됨
    },
    watch: {
        // 라우트 변경 감지 - 프로세스 정의 체계도 새로고침
        '$route': {
            deep: true,
            async handler(newVal, oldVal) {
                // definitions 페이지 내에서 이동할 때만 체계도 새로고침
                if (newVal.path.startsWith('/definitions') && oldVal.path.startsWith('/definitions')) {
                    await this.loadProcessDefinitionMap();
                }
            }
        },
        // nodes 객체 변경 감지
        nodes: {
            deep: true,
            handler() {
                // DOM 조작 제거 - slot으로 대체됨
            }
        },
        // 선택된 노드 ID 변경 감지
        selectedNodeId: {
            handler(newId, oldId) {
                // 이전 선택 노드의 selected 상태 제거
                if (oldId && this.nodes[oldId]) {
                    this.nodes[oldId].state.selected = false;
                }
                // 새 선택 노드의 selected 상태 설정
                if (newId && this.nodes[newId]) {
                    this.nodes[newId].state.selected = true;
                }
            }
        },
        // 선택된 프로세스 ID 변경 감지
        selectedProcessId: {
            handler(newId, oldId) {
                if (newId !== oldId && oldId) {
                    console.log('🔄 프로세스 변경 감지:', oldId, '→', newId);
                    
                    this.$nextTick(() => {
                        setTimeout(() => {
                            const chatComponent = this.$refs.processDefinitionChat;
                            
                            if (this.showFlowOverlay) {
                                if (chatComponent && chatComponent.isConsultingMode) {
                                    // Flow 모드인데 컨설팅 모드로 바뀌면 BPMN으로 전환
                                    console.log('🔄 컨설팅 모드 감지 - BPMN으로 전환');
                                    this.showFlowOverlay = false;
                                } else if (chatComponent && chatComponent.processDefinition) {
                                    // Flow 모드이고 일반 모드면 Flow 데이터 갱신
                                    console.log('🔄 일반 모드 - Flow 데이터 갱신');
                                    this.showFlowOverlay = false;
                                    this.$nextTick(() => {
                                        this.toggleFlowView();
                                    });
                                }
                            }
                        }, 500);
                    });
                }
            }
        }
    },
    methods: {
        /**
         * 노드별 액션 버튼 목록 반환
         */
        getNodeActionButtons(node) {
            const buttons = [];
            const nodeType = node.data?.type;

            // Mega, Major는 추가 버튼
            if (nodeType === 'mega' || nodeType === 'major') {
                buttons.push({
                    icon: 'plus',
                    tooltip: nodeType === 'mega' ? this.$t('ProcessDefinitionChatWithTree.addMajorProcess') : this.$t('ProcessDefinitionChatWithTree.addSubProcess'),
                    action: this.handleNodeAddAction,
                    iconColor: '',
                    size: 10
                });
            }
            // 삭제 버튼
            buttons.push({
                icon: 'trash',
                tooltip: this.$t('ProcessDefinitionChatWithTree.delete'),
                action: this.handleNodeDeleteAction,
                iconColor: '#FB977D',
                size: 12
            });

            // 수정 버튼
            buttons.push({
                icon: 'pencil',
                tooltip: this.$t('ProcessDefinitionChatWithTree.editProcessName'),
                action: this.handleNodeEditAction,
                iconColor: '',
                size: 10
            });

            // Sub 프로세스 열기 버튼
            // if (nodeType === 'sub') {
            //     buttons.push({
            //         icon: 'open',
            //         tooltip: this.$t('ProcessDefinitionChatWithTree.openProcess'),
            //         action: this.handleNodeClick,
            //         iconColor: '',
            //         size: 12
            //     });
            // }



            return buttons;
        },

        /**
         * 노드가 열렸을 때 처리
         */
        handleNodeOpened(node) {
            if (node && node.id) {
                if (!this.openedNodes.includes(node.id)) {
                    this.openedNodes.push(node.id);
                }
                this.saveTreeState();
            }
        },

        /**
         * 노드가 닫혔을 때 처리
         */
        handleNodeClosed(node) {
            if (node && node.id) {
                const index = this.openedNodes.indexOf(node.id);
                if (index > -1) {
                    this.openedNodes.splice(index, 1);
                }
                this.saveTreeState();
            }
        },

        /**
         * 트리 상태를 localStorage에 저장
         */
        saveTreeState() {
            try {
                localStorage.setItem('processTreeOpenedNodes', JSON.stringify(this.openedNodes));
            } catch (error) {
                console.error('트리 상태 저장 실패:', error);
            }
        },

        /**
         * localStorage에서 트리 상태 복구
         */
        restoreTreeState() {
            try {
                const saved = localStorage.getItem('processTreeOpenedNodes');
                if (saved) {
                    this.openedNodes = JSON.parse(saved);
                    // 이중 $nextTick으로 DOM 완전 렌더링 대기
                    this.$nextTick(() => {
                        this.$nextTick(() => {
                            this.expandSavedNodes();
                        });
                    });
                }
            } catch (error) {
                console.error('트리 상태 복구 실패:', error);
            }
        },

        /**
         * 저장된 노드들을 펼치기
         */
        expandSavedNodes() {
            this.openedNodes.forEach(nodeId => {
                const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
                if (nodeElement) {
                    const iconWrapper = nodeElement.querySelector('.icon-wrapper');
                    if (iconWrapper && !iconWrapper.classList.contains('opened')) {
                        iconWrapper.click();
                    }
                }
            });
        },
        // 프로세스 요소 목록 업데이트 (검색창 포커스 시 호출)
        updateElementList() {
            const chatComponent = this.$refs.processDefinitionChat;
            if (!chatComponent || !chatComponent.processDefinition) {
                this.processElementList = [];
                return;
            }

            const processDefinition = chatComponent.processDefinition;
            const elementList = [];

            const getIcon = (elementType) => {
                switch (elementType) {
                    case 'Activity':
                        return 'mdi-file-document-edit-outline';
                    case 'Event':
                        return 'mdi-lightning-bolt-circle';
                    case 'Gateway':
                        return 'mdi-source-branch';
                    case 'Sequence':
                        return 'mdi-arrow-right-bold';
                    default:
                        return 'mdi-circle-outline';
                }
            };

            // Elements 구조인 경우
            if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                processDefinition.elements.forEach(element => {
                    if (element.name && element.elementType != 'Sequence') {
                        elementList.push({
                            title: element.name,
                            value: element.name,
                            name: element.name,
                            type: element.elementType,
                            icon: getIcon(element.elementType)
                        });
                    }
                });
            } else {
                // 분리된 구조인 경우
                // Activities
                if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                    processDefinition.activities.forEach(activity => {
                        if (activity.name) {
                            elementList.push({
                                title: activity.name,
                                value: activity.name,
                                name: activity.name,
                                type: 'Activity',
                                icon: getIcon('Activity')
                            });
                        }
                    });
                }

                // Events
                if (processDefinition.events && Array.isArray(processDefinition.events)) {
                    processDefinition.events.forEach(event => {
                        if (event.name) {
                            elementList.push({
                                title: event.name,
                                value: event.name,
                                name: event.name,
                                type: 'Event',
                                icon: getIcon('Event')
                            });
                        }
                    });
                }

                // Gateways
                if (processDefinition.gateways && Array.isArray(processDefinition.gateways)) {
                    processDefinition.gateways.forEach(gateway => {
                        if (gateway.name) {
                            elementList.push({
                                title: gateway.name,
                                value: gateway.name,
                                name: gateway.name,
                                type: 'Gateway',
                                icon: getIcon('Gateway')
                            });
                        }
                    });
                }
            }

            this.processElementList = elementList;
            console.log('🔍 요소 목록 업데이트됨:', elementList.length, '개');
        },

        /**
         * 노드 추가 액션 핸들러
         */
        handleNodeAddAction(node) {
            this.processDialogMode = 'add';
            this.currentNodeType = node.data?.type || '';
            this.currentNode = node;
            this.processForm = { id: '', name: '' };
            this.processDialog = true;
        },

        /**
         * 노드 수정 액션 핸들러
         */
        handleNodeEditAction(node) {
            this.processDialogMode = 'update';
            this.currentNodeType = node.data?.type || '';
            this.currentNode = node;
            this.processForm = {
                id: node.data?.originalId || '',
                name: node.text || ''
            };
            this.processDialog = true;
        },

        /**
         * 노드 삭제 액션 핸들러
         */
        handleNodeDeleteAction(node) {
            const nodeName = node.text;
            if (confirm(`"${nodeName}" 프로세스를 삭제하시겠습니까?`)) {
                this.deleteProcessNode(node.data?.type, node);
            }
        },

        /**
         * 프로세스 추가 핸들러
         */
        async handleProcessAdd(newProcess) {
            try {
                const parentType = this.currentNodeType;
                const parentId = this.currentNode.data?.originalId;

                if (parentType === 'mega') {
                    // Mega에 Major 추가
                    const mega = this.processDefinitionMap.mega_proc_list.find(m => m.id === parentId);
                    if (mega) {
                        if (!mega.major_proc_list) mega.major_proc_list = [];
                        const majorId = newProcess.id || this.generateUniqueId();
                        mega.major_proc_list.push({
                            id: majorId,
                            name: newProcess.name,
                            sub_proc_list: []
                        });
                        
                        // 새로 생성한 Major 프로세스 위치 정보 저장
                        if (!newProcess.path && !newProcess.label) {
                            this.treeProcessLocation = {
                                megaProcessId: mega.id,
                                majorProcessId: majorId,
                                megaProcessName: mega.name,
                                majorProcessName: newProcess.name
                            };
                        }
                    }
                } else if (parentType === 'major') {
                    // Major에 Sub 추가 (기존 정의 또는 신규)
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        const major = mega.major_proc_list?.find(m => m.id === parentId);
                        if (major) {
                            if (!major.sub_proc_list) major.sub_proc_list = [];
                            
                            // ProcessDialog에서 반환된 newProcess 구조 확인
                            // id와 name만 있으면 기존 정의, 그 외 필드가 있으면 신규
                            const subProcessId = newProcess.id || this.generateUniqueId();
                            const subProcess = {
                                id: subProcessId,
                                name: newProcess.name || newProcess.label || newProcess.id
                            };
                            
                            // 기존 프로세스 정의를 선택한 경우
                            if (newProcess.path || newProcess.label) {
                                subProcess.new = false;
                            } else {
                                // 새로 생성한 경우
                                subProcess.new = true;
                                
                                // 트리에서 생성한 프로세스의 위치 정보 저장
                                this.treeProcessLocation = {
                                    megaProcessId: mega.id,
                                    majorProcessId: major.id,
                                    processDefinitionId: subProcessId,
                                    megaProcessName: mega.name,
                                    majorProcessName: major.name,
                                    processDefinitionName: newProcess.name
                                };
                                
                                // 생성된 프로세스 자동 선택
                                this.selectedProcessId = subProcessId;
                                this.selectedNodeId = `sub_${subProcessId}`;
                            }
                            
                            major.sub_proc_list.push(subProcess);
                            break;
                        }
                    }
                }

                await backend.putProcessDefinitionMap(this.processDefinitionMap);
                await this.refreshTree();
                this.closeProcessDialog();
            } catch (error) {
                console.error('프로세스 추가 실패:', error);
            }
        },

        /**
         * 프로세스 수정 핸들러
         */
        async handleProcessEdit(updatedProcess) {
            try {
                const nodeId = this.currentNode.data?.originalId;
                const nodeType = this.currentNodeType;

                if (nodeType === 'mega') {
                    const mega = this.processDefinitionMap.mega_proc_list.find(m => m.id === nodeId);
                    if (mega) mega.name = updatedProcess.name;
                } else if (nodeType === 'major') {
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        const major = mega.major_proc_list?.find(m => m.id === nodeId);
                        if (major) {
                            major.name = updatedProcess.name;
                            break;
                        }
                    }
                } else if (nodeType === 'sub') {
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        for (const major of mega.major_proc_list || []) {
                            const sub = major.sub_proc_list?.find(s => s.id === nodeId);
                            if (sub) {
                                sub.name = updatedProcess.name;
                                break;
                            }
                        }
                    }
                }

                await backend.putProcessDefinitionMap(this.processDefinitionMap);
                await this.refreshTree();
                this.closeProcessDialog();
            } catch (error) {
                console.error('프로세스 수정 실패:', error);
            }
        },

        /**
         * 프로세스 노드 삭제
         */
        async deleteProcessNode(nodeType, node) {
            try {
                const nodeId = node.data?.originalId;

                if (nodeType === 'mega') {
                    const index = this.processDefinitionMap.mega_proc_list.findIndex(m => m.id === nodeId);
                    if (index !== -1) this.processDefinitionMap.mega_proc_list.splice(index, 1);
                } else if (nodeType === 'major') {
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        const index = mega.major_proc_list?.findIndex(m => m.id === nodeId);
                        if (index !== -1) {
                            mega.major_proc_list.splice(index, 1);
                            break;
                        }
                    }
                } else if (nodeType === 'sub') {
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        for (const major of mega.major_proc_list || []) {
                            const index = major.sub_proc_list?.findIndex(s => s.id === nodeId);
                            if (index !== -1) {
                                major.sub_proc_list.splice(index, 1);
                                break;
                            }
                        }
                    }
                }

                await backend.putProcessDefinitionMap(this.processDefinitionMap);
                await this.refreshTree();
            } catch (error) {
                console.error('프로세스 삭제 실패:', error);
            }
        },

        /**
         * 고유 ID 생성
         */
        generateUniqueId() {
            const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            return s4() + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },

        /**
         * 프로세스 다이얼로그 저장
         */
        async saveProcessDialog() {
            if (!this.processForm.name || this.processForm.name.trim() === '') {
                alert('프로세스 이름을 입력해주세요.');
                return;
            }

            if (this.processDialogMode === 'add') {
                await this.handleProcessAdd(this.processForm);
            } else if (this.processDialogMode === 'update') {
                await this.handleProcessEdit(this.processForm);
            }
        },

        /**
         * 프로세스 다이얼로그 닫기
         */
        closeProcessDialog() {
            this.processDialog = false;
            this.processForm = { id: '', name: '' };
            this.currentNode = null;
            this.currentNodeType = '';
        },

        /**
         * 프로세스 정의 체계도를 Supabase에서 로드
         */
        async loadProcessDefinitionMap() {
            this.isLoadingProcessDefinitionMap = true;
            
            try {
                this.processDefinitionMap = await backend.getProcessDefinitionMap();
                
                if (this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                    this.convertToVue3TreeviewFormat(this.processDefinitionMap.mega_proc_list);
                    
                    // 트리 상태 복구 - 이중 $nextTick으로 DOM 렌더링 보장
                    this.$nextTick(() => {
                        this.$nextTick(() => {
                            this.restoreTreeState();
                        });
                    });
                }
            } catch (error) {
                console.error('프로세스 정의 체계도 로드 실패:', error);
                this.$try({
                    context: this,
                    action: () => {
                        throw error;
                    },
                    errorMsg: '프로세스 정의 체계도를 불러오는데 실패했습니다.'
                });
            } finally {
                this.isLoadingProcessDefinitionMap = false;
            }
        },

        /**
         * 프로세스 정의 체계도를 vue3-treeview 형식으로 변환
         * @param {Array} megaProcList - mega_proc_list 배열
         */
        convertToVue3TreeviewFormat(megaProcList) {
            if (!megaProcList || !Array.isArray(megaProcList)) {
                return;
            }

            this.nodes = {};
            this.config.roots = [];

            megaProcList.forEach(mega => {
                const megaId = `mega_${mega.id}`;
                this.config.roots.push(megaId);
                
                this.nodes[megaId] = {
                    id: megaId,
                    text: mega.name,
                    children: [],
                    data: { type: 'mega', originalId: mega.id },
                    state: { opened: this.openedNodes.includes(megaId) }
                };

                if (mega.major_proc_list && Array.isArray(mega.major_proc_list)) {
                    mega.major_proc_list.forEach(major => {
                        const majorId = `major_${major.id}`;
                        this.nodes[megaId].children.push(majorId);
                        
                        this.nodes[majorId] = {
                            id: majorId,
                            text: major.name,
                            children: [],
                            data: { type: 'major', originalId: major.id },
                            state: { opened: this.openedNodes.includes(majorId) }
                        };

                        if (major.sub_proc_list && Array.isArray(major.sub_proc_list)) {
                            major.sub_proc_list.forEach(sub => {
                                const subId = `sub_${sub.id}`;
                                this.nodes[majorId].children.push(subId);
                                
                                this.nodes[subId] = {
                                    id: subId,
                                    text: sub.name,
                                    children: [],
                                    data: { 
                                        type: 'sub', 
                                        originalId: sub.id,
                                        processDefinitionId: sub.id,
                                        new: sub.new || false
                                    },
                                    state: { 
                                        opened: this.openedNodes.includes(subId),
                                        selected: this.selectedNodeId === subId
                                    }
                                };
                            });
                        }
                    });
                }
            });
        },

        /**
         * 트리 노드 클릭 핸들러
         * @param {Object} node - 클릭된 노드 객체
         */
        handleNodeClick(node) {
            if (!node || !node.id) {
                return;
            }

            const nodeId = node.id;
            
            // 새 노드 선택 (watch에서 selected 상태 업데이트)
            this.selectedNodeId = nodeId;

            // sub 프로세스만 클릭 가능 (실제 프로세스 정의)
            if (typeof nodeId === 'string' && nodeId.startsWith('sub_')) {
                const processId = node.data?.processDefinitionId || nodeId.replace('sub_', '');
                
                // 다른 프로세스로 전환할 때 업로드한 엑셀 정보 초기화
                if (this.selectedProcessId !== processId) {
                    console.log('🔄 프로세스 전환 감지 - 업로드 엑셀 정보 초기화');
                    this.originalWorkbook = null;
                    this.originalWorkbookInfo = null;
                    this.uploadedFileName = null;
                    this.selectedFile = null;
                    this.parsedExcelData = null;
                }
                
                // selectedProcessId를 업데이트하여 ProcessDefinitionChat에 전달
                this.selectedProcessId = processId;
                this.searchValue = '';
                
                // 선택된 프로세스의 위치 정보 찾기 (mega, major 정보)
                this.findAndSetProcessLocation(processId);
            }
        },
        
        /**
         * 선택된 프로세스의 트리 위치 정보를 찾아서 설정
         * @param {String} processId - 프로세스 ID
         */
        findAndSetProcessLocation(processId) {
            if (!this.processDefinitionMap || !this.processDefinitionMap.mega_proc_list) {
                this.treeProcessLocation = null;
                return;
            }
            
            // 모든 mega, major를 순회하며 해당 프로세스 찾기
            for (const mega of this.processDefinitionMap.mega_proc_list) {
                if (mega.major_proc_list) {
                    for (const major of mega.major_proc_list) {
                        if (major.sub_proc_list) {
                            const sub = major.sub_proc_list.find(s => s.id === processId);
                            if (sub) {
                                // 찾은 경우 위치 정보 저장
                                this.treeProcessLocation = {
                                    megaProcessId: mega.id,
                                    majorProcessId: major.id,
                                    processDefinitionId: sub.id,
                                    megaProcessName: mega.name,
                                    majorProcessName: major.name,
                                    processDefinitionName: sub.name
                                };
                                return;
                            }
                        }
                    }
                }
            }
            
            // 찾지 못한 경우 null로 설정
            this.treeProcessLocation = null;
        },

        /**
         * 트리 새로고침 (외부에서 호출 가능)
         */
        async refreshTree() {
            await this.loadProcessDefinitionMap();
            
            // 트리 다시 로드 후 클릭 이벤트 재부착
            this.$nextTick(() => {
                this.attachNodeClickEvents();
            });
        },
        
        /**
         * 트리 노드에 클릭 이벤트 추가
         */
        attachNodeClickEvents() {
            console.log('🔧 트리 노드 클릭 이벤트 추가 시작');
            
            // 약간의 지연을 두고 DOM이 완전히 렌더링될 때까지 대기
            setTimeout(() => {
                // 모든 트리 노드 찾기
                const treeNodes = document.querySelectorAll('.process-tree .tree-node');
                console.log('📋 찾은 트리 노드 수:', treeNodes.length);
                
                treeNodes.forEach((treeNode) => {
                    const nodeWrapper = treeNode.querySelector('.node-wrapper');
                    if (!nodeWrapper) return;
                    
                    // 기존 리스너 제거 방지
                    if (nodeWrapper.hasAttribute('data-click-attached')) return;
                    
                    nodeWrapper.setAttribute('data-click-attached', 'true');
                    
                    // 노드 ID 미리 확인
                    let nodeId = treeNode.id || 
                                treeNode.getAttribute('id') || 
                                treeNode.getAttribute('data-id') ||
                                treeNode.dataset.id;
                    
                    if (!nodeId) {
                        const inputWrapper = nodeWrapper.querySelector('.input-wrapper');
                        const nodeText = inputWrapper ? inputWrapper.textContent.trim() : '';
                        for (const [id, node] of Object.entries(this.nodes)) {
                            if (node.text === nodeText) {
                                nodeId = id;
                                break;
                            }
                        }
                    }
                    
                    // 서브 프로세스만 cursor pointer 적용
                    if (nodeId && nodeId.startsWith('sub_')) {
                        nodeWrapper.style.cursor = 'pointer';
                    } else {
                        nodeWrapper.style.cursor = 'default';
                    }
                    
                    // 클릭 이벤트 추가
                    nodeWrapper.addEventListener('click', (e) => {
                        // 버튼 클릭은 제외
                        if (e.target.closest('.node-action-btn') || e.target.closest('.node-action-buttons')) {
                            return;
                        }
                        
                        console.log('🖱️ 노드 클릭됨:', nodeId);
                        
                        // 서브 프로세스만 클릭 가능
                        if (nodeId && this.nodes[nodeId] && nodeId.startsWith('sub_')) {
                            this.handleNodeClick(this.nodes[nodeId]);
                        }
                    });
                });
            }, 500);
        },

        /**
         * 파일 다이얼로그 열기
         */
        openFileDialog() {
            this.$refs.fileInput.click();
        },

        /**
         * 파일 선택 핸들러
         */
        async handleFileSelect(event) {
            const file = event.target.files?.[0];
            if (!file) return;

            // 파일만 저장하고 파싱은 하지 않음
            this.selectedFile = file;
            this.uploadedFileName = file.name;
            console.log('📄 파일 선택됨:', file.name);
            
            // 파일 입력 초기화 (같은 파일을 다시 선택할 수 있도록)
            event.target.value = '';
        },

        /**
         * 엑셀 파일 처리
         */
        async processExcelFile(file) {
            console.log('📄 엑셀 파일 처리 시작:', file.name);
            
            this.isParsingExcel = true;
            this.uploadedFileName = null;
            
            try {
                // XLSX 라이브러리로 파싱
                const result = await this.parseWithXLSX(file);
                
                if (result.success) {
                    this.uploadedFileName = file.name;
                    this.parsedExcelData = result;
                    
                    console.log('✅ 엑셀 파싱 성공:', result);
                    console.log('📊 시트 목록:', result.sheetNames);
                    console.log('📊 시트 수:', result.sheetCount);
                    
                    // 파싱된 데이터 출력 (디버깅용)
                    result.sheetNames.forEach(sheetName => {
                        console.log(`📋 시트 "${sheetName}":`, result.data[sheetName]);
                    });
                    
                    // alert(`엑셀 파일이 성공적으로 파싱되었습니다.\n시트 수: ${result.sheetCount}개`);
                } else {
                    console.error('❌ 엑셀 파싱 실패:', result.error);
                    alert(`엑셀 파일 파싱 실패\n\n${result.error}\n\n올바른 엑셀 파일(.xlsx, .xls)인지 확인해주세요.`);
                }
            } catch (error) {
                console.error('❌ 엑셀 파일 처리 중 오류:', error);
                alert(`엑셀 파일 처리 오류\n\n${error.message}`);
            } finally {
                this.isParsingExcel = false;
            }
        },

        /**
         * XLSX 라이브러리를 사용하여 엑셀 파싱
         */
        parseWithXLSX(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        const data = e.target.result;
                        const startTime = Date.now();
                        
                        console.log('📄 파일 데이터 크기:', data.byteLength, 'bytes');
                        console.log('📦 XLSX 라이브러리 정보:', {
                            'XLSX 존재': typeof XLSX !== 'undefined',
                            'XLSX.read 존재': typeof XLSX.read === 'function',
                            'XLSX.version': XLSX.version
                        });
                        
                        // 엑셀 파일 파싱 (xlsx-js-style로 모든 정보 보존)
                        const workbook = XLSX.read(data, { 
                            type: 'array',
                            cellStyles: true,     // ✨ 스타일 정보 보존 (필수!)
                            cellFormula: true,    // 수식 정보 보존
                            cellDates: true       // 날짜 형식 보존
                        });
                        
                        const elapsed = (Date.now() - startTime) / 1000;
                        console.log(`⏱️ XLSX 파싱 시간: ${elapsed.toFixed(2)}초`);
                        console.log('📦 워크북 객체:', workbook);
                        console.log('📦 워크북 키들:', Object.keys(workbook));
                        
                        // 워크북 유효성 검증
                        if (!workbook) {
                            console.error('❌ 워크북이 null입니다.');
                            resolve({
                                success: false,
                                error: '엑셀 파일을 읽을 수 없습니다.'
                            });
                            return;
                        }
                        
                        if (!workbook.SheetNames) {
                            console.error('❌ SheetNames가 없습니다:', workbook);
                            resolve({
                                success: false,
                                error: '엑셀 파일 형식이 올바르지 않습니다.'
                            });
                            return;
                        }
                        
                        if (!Array.isArray(workbook.SheetNames)) {
                            console.error('❌ SheetNames가 배열이 아닙니다:', typeof workbook.SheetNames);
                            resolve({
                                success: false,
                                error: '엑셀 파일 구조가 올바르지 않습니다.'
                            });
                            return;
                        }
                        
                        if (workbook.SheetNames.length === 0) {
                            console.error('❌ 시트가 없습니다.');
                            resolve({
                                success: false,
                                error: '엑셀 파일에 시트가 없습니다.'
                            });
                            return;
                        }
                        
                        console.log('✅ 워크북 유효성 검증 완료');
                        console.log('📋 시트 목록:', workbook.SheetNames);
                        
                        // 원본 워크북 저장
                        this.originalWorkbook = workbook;
                        
                        // 원본 구조 정보 저장
                        this.originalWorkbookInfo = {
                            sheetNames: [...workbook.SheetNames],
                            fileName: file.name,
                            uploadDate: new Date().toISOString()
                        };
                        
                        console.log('💾 원본 엑셀 형식 저장 완료:', this.originalWorkbookInfo);
                        
                        // Sheets 객체 존재 확인 (먼저 검증)
                        if (!workbook.Sheets || typeof workbook.Sheets !== 'object') {
                            console.error('❌ workbook.Sheets가 없거나 올바르지 않습니다.');
                            resolve({
                                success: false,
                                error: '엑셀 파일의 시트 정보를 읽을 수 없습니다.'
                            });
                            return;
                        }
                        
                        // 스타일 정보 로드 확인 (디버깅용)
                        console.log('✅ Sheets 객체 확인 완료');
                        
                        if (workbook.SheetNames.length > 0) {
                            const firstSheetName = workbook.SheetNames[0];
                            const firstSheet = workbook.Sheets[firstSheetName];
                            
                            if (firstSheet) {
                                const firstCellKey = Object.keys(firstSheet).find(key => !key.startsWith('!'));
                                const firstCell = firstCellKey ? firstSheet[firstCellKey] : null;
                                
                                console.log('📏 스타일 정보 확인:', {
                                    '시트명': firstSheetName,
                                    '열너비(!cols)': firstSheet['!cols'] ? '✓ 있음' : '✗ 없음',
                                    '행높이(!rows)': firstSheet['!rows'] ? '✓ 있음' : '✗ 없음',
                                    '병합셀(!merges)': firstSheet['!merges'] ? `✓ ${firstSheet['!merges'].length}개` : '✗ 없음',
                                    '첫번째셀': firstCellKey,
                                    '첫번째셀스타일(s)': firstCell?.s ? '✓ 있음' : '✗ 없음',
                                    '첫번째셀정보': firstCell
                                });
                                
                                // A1과 B1 셀 상세 확인
                                console.log('🔍 A1 셀 상세:', firstSheet['A1']);
                                console.log('🔍 B1 셀 상세:', firstSheet['B1']);
                                
                                // 워크북 Styles 확인
                                if (workbook.Styles) {
                                    console.log('🎨 워크북 Fonts:', workbook.Styles.Fonts);
                                    console.log('🎨 워크북 CellXf:', workbook.Styles.CellXf);
                                    console.log('🎨 워크북 Fills:', workbook.Styles.Fills);
                                }
                            } else {
                                console.warn('⚠️ 첫 번째 시트를 찾을 수 없습니다.');
                            }
                        }
                        
                        // 모든 시트의 데이터를 추출
                        const result = {};
                        
                        for (let i = 0; i < workbook.SheetNames.length; i++) {
                            const sheetName = workbook.SheetNames[i];
                            try {
                            const worksheet = workbook.Sheets[sheetName];
                                
                                if (!worksheet) {
                                    console.warn(`⚠️ 시트 "${sheetName}"를 찾을 수 없습니다.`);
                                    continue;
                                }
                                
                            // 시트를 JSON으로 변환 (두 가지 형태로)
                                const jsonArray = XLSX.utils.sheet_to_json(worksheet, { 
                                    header: 1,
                                    defval: '',
                                    blankrows: true
                                });
                                const jsonObjects = XLSX.utils.sheet_to_json(worksheet, {
                                    defval: '',
                                    blankrows: false
                                });
                            
                            result[sheetName] = {
                                array: jsonArray,      // 배열 형태
                                objects: jsonObjects   // 객체 배열 형태
                            };
                                
                                console.log(`📊 시트 "${sheetName}": ${jsonArray.length}행, ${jsonObjects.length}개 객체`);
                            } catch (sheetError) {
                                console.error(`❌ 시트 "${sheetName}" 처리 실패:`, sheetError);
                                // 시트 하나 실패해도 계속 진행
                            }
                        }
                        
                        resolve({
                            success: true,
                            data: result,
                            sheetNames: workbook.SheetNames,
                            sheetCount: workbook.SheetNames.length,
                            workbook: workbook
                        });
                        
                    } catch (parseError) {
                        console.error('❌ XLSX 파싱 중 오류:', parseError);
                        console.error('오류 스택:', parseError.stack);
                        resolve({
                            success: false,
                            error: `파싱 오류: ${parseError.message}`
                        });
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('❌ 파일 읽기 중 오류:', error);
                    resolve({
                        success: false,
                        error: '파일을 읽을 수 없습니다.'
                    });
                };
                
                try {
                reader.readAsArrayBuffer(file);
                } catch (readError) {
                    console.error('❌ FileReader 시작 실패:', readError);
                    resolve({
                        success: false,
                        error: `파일 읽기 시작 실패: ${readError.message}`
                    });
                }
            });
        },

        /**
         * 맵 생성 버튼 클릭 핸들러
         */
        async handleCreateMap() {
            if (!this.selectedFile) {
                alert('파일을 먼저 선택해주세요.');
                return;
            }

            try {
                // 먼저 파일 파싱
                console.log('📄 엑셀 파일 파싱 시작');
                await this.processExcelFile(this.selectedFile);
                
                if (!this.parsedExcelData || !this.parsedExcelData.success) {
                    console.error('파일 파싱에 실패했습니다.');
                    // alert은 processExcelFile에서 이미 표시됨
                    return;
                }
                
                console.log('🚀 프로세스 맵 생성 시작');
                
                // 파싱된 엑셀 데이터를 문자열로 변환
                let excelContent = '';
                this.parsedExcelData.sheetNames.forEach(sheetName => {
                    const sheetData = this.parsedExcelData.data[sheetName];
                    excelContent += `\n\n[시트: ${sheetName}]\n`;
                    excelContent += JSON.stringify(sheetData.objects, null, 2);
                });

                // console.log('📋 엑셀 내용:', excelContent);

                // 메시지 생성
                const message = {
                    text: excelContent,
                    images: [],
                    mentionedUsers: []
                };

                // 자식 컴포넌트(ProcessDefinitionChat)의 beforeSendMessage 메서드 호출
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.beforeSendMessage) {
                    await chatComponent.beforeSendMessage(message);
                } else {
                    console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
                    alert('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
                }
                
            } catch (error) {
                console.error('❌ 프로세스 맵 생성 실패:', error);
                alert(`프로세스 맵 생성 실패\n\n${error.message}`);
            }
        },

        /**
         * 검색 버튼 클릭 또는 엔터 키 입력 핸들러
         */
        handleSearch() {
            if (!this.searchValue || this.searchValue.trim() === '') {
                console.log('검색어를 입력해주세요.');
                return;
            }

            console.log('🔍 액티비티 검색:', this.searchValue);

            let found = false;

            // Flow 모드인 경우
            if (this.showFlowOverlay) {
                const chatComponent = this.$refs.processDefinitionChat;
                const flowComponent = chatComponent?.$refs?.processFlowExample;
                
                if (flowComponent && flowComponent.searchAndFocusActivity) {
                    console.log('🎯 Flow 모드 검색');
                    found = flowComponent.searchAndFocusActivity(this.searchValue);
                } else {
                    console.error('ProcessFlowExample 컴포넌트를 찾을 수 없습니다.');
                }
            } 
            // BPMN 모드인 경우
            else {
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.searchAndFocusActivity) {
                    console.log('🎯 BPMN 모드 검색');
                    found = chatComponent.searchAndFocusActivity(this.searchValue);
                } else {
                    console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
                }
            }

            if (found) {
                console.log('✅ 액티비티를 찾아 포커싱했습니다.');
            } else {
                console.log('❌ 일치하는 액티비티를 찾을 수 없습니다.');
            }
        },

        /**
         * 실시간 검색 (자동완성 선택 또는 직접 입력 시)
         */
        handleRealtimeSearch(value) {
            console.log('🔍 실시간 검색:', value);
            
            if (!value || value.trim() === '') {
                return;
            }

            // Flow 모드인 경우
            if (this.showFlowOverlay) {
                const chatComponent = this.$refs.processDefinitionChat;
                const flowComponent = chatComponent?.$refs?.processFlowExample;
                
                if (flowComponent && flowComponent.searchAndFocusActivity) {
                    flowComponent.searchAndFocusActivity(value);
                }
            } 
            // BPMN 모드인 경우
            else {
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.searchAndFocusActivity) {
                    chatComponent.searchAndFocusActivity(value);
                }
            }
        },

        /**
         * 검색 입력 변경 시 (타이핑 중)
         */
        handleSearchInput(value) {
            this.searchInputText = value;
            
            // 실시간 검색 (디바운스 없이 즉시 실행)
            if (value && value.trim() !== '') {
                // Flow 모드인 경우
                if (this.showFlowOverlay) {
                    setTimeout(() => {
                        const chatComponent = this.$refs.processDefinitionChat;
                        const flowComponent = chatComponent?.$refs?.processFlowExample;
                        
                        if (flowComponent && flowComponent.searchAndFocusActivity) {
                            flowComponent.searchAndFocusActivity(value);
                        }
                    }, 100);
                } 
                // BPMN 모드인 경우
                else {
                    const chatComponent = this.$refs.processDefinitionChat;
                    if (chatComponent && chatComponent.searchAndFocusActivity) {
                        chatComponent.searchAndFocusActivity(value);
                    }
                }
            }
        },

        /**
         * Flow 뷰 토글 (BPMN ↔ Flow)
         */
        toggleFlowView(type) {
            const chatComponent = this.$refs.processDefinitionChat;
            
            if (!this.showFlowOverlay || (type == 'flow' && !chatComponent.isConsultingMode)) {
                // Flow 뷰 열기
                if (chatComponent && chatComponent.processDefinition) {
                    // 프로세스 정의를 복사하여 저장 (참조 문제 방지)
                    this.currentProcessDefinitionForFlow = JSON.parse(JSON.stringify(chatComponent.processDefinition));
                    this.showFlowOverlay = true;
                } else {
                    console.warn('⚠️ 표시할 프로세스 정의가 없습니다.');
                    alert('표시할 프로세스 정의가 없습니다. 먼저 프로세스를 선택해주세요.');
                }
            } else {
                // BPMN 뷰로 돌아가기
                this.closeFlowOverlay();
            }

            this.handleSearchInput(this.searchValue);
        },

        /**
         * AI 생성 완료 시 Flow 형식으로 전환
         */
        handleGenerationFinished() {
            console.log('✅ AI 생성 완료 - Flow 형식으로 전환');
            this.$nextTick(() => {
                this.toggleFlowView();
            });
        },

        /**
         * processDefinition이 준비되면 자동으로 Flow 열기
         */
        handleProcessDefinitionReady() {
            // if (!this.showFlowOverlay) {
                console.log('✅ processDefinition 준비됨 - Flow 자동 열기');
                this.$nextTick(() => {
                    this.toggleFlowView('flow');
                });
            // }
        },

        /**
         * Flow 오버레이 닫기
         */
        closeFlowOverlay() {
            this.showFlowOverlay = false;
            this.showActivityPanel = false;
            this.selectedFlowActivity = null;
            // 다음에 열 때 최신 데이터를 가져오기 위해 초기화
            this.$nextTick(() => {
                this.currentProcessDefinitionForFlow = null;
            });
        },

        /**
         * Flow 노드 더블클릭 핸들러
         */
        handleFlowNodeDoubleClick(nodeData) {
            console.log('🖱️ 노드 더블클릭:', nodeData);
            console.log('📋 backflowSequenceId:', nodeData.backflowSequenceId);
            console.log('📋 backflowRequiredTime:', nodeData.backflowRequiredTime);
            
            // 선택된 액티비티 정보 저장 (깊은 복사로 원본 보호)
            this.selectedFlowActivity = JSON.parse(JSON.stringify(nodeData));
            this.showActivityPanel = true;
        },

        /**
         * 액티비티 패널 닫기
         */
        closeActivityPanel() {
            this.showActivityPanel = false;
            this.selectedFlowActivity = null;
        },

        /**
         * 액티비티 변경사항 저장
         */
        async saveActivityChanges() {
            try {
                if (!this.selectedFlowActivity) return;
                
                console.log('💾 액티비티 저장 시작:', this.selectedFlowActivity);
                
                // 원본 프로세스 정의에서 해당 액티비티 찾아서 업데이트
                const chatComponent = this.$refs.processDefinitionChat;
                if (!chatComponent || !chatComponent.processDefinition) {
                    console.error('❌ 프로세스 정의를 찾을 수 없습니다.');
                    return;
                }
                
                const processDefinition = chatComponent.processDefinition;
                let updated = false;
                
                // 액티비티 이름 (content 또는 name)
                const activityName = this.selectedFlowActivity.content || this.selectedFlowActivity.name;
                
                // 1. 원본 processDefinition 업데이트
                // Elements 구조인 경우
                if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                    const element = processDefinition.elements.find(el => 
                        el.id === this.selectedFlowActivity.id || el.name === activityName
                    );
                    if (element) {
                        element.system = this.selectedFlowActivity.footer; // footer가 시스템/도구
                        element.description = this.selectedFlowActivity.description;
                        element.role = this.selectedFlowActivity.header; // header가 역할
                        updated = true;
                        console.log('✅ Element 업데이트:', element);
                    }
                    
                    // 들어오는 시퀀스의 requiredTime 업데이트
                    if (this.selectedFlowActivity.incomingSequenceId) {
                        const sequence = processDefinition.elements.find(el => 
                            el.id === this.selectedFlowActivity.incomingSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = this.selectedFlowActivity.requiredTime;
                            console.log('✅ Incoming Sequence requiredTime 업데이트:', sequence);
                        }
                    }
                    
                    // 역행 시퀀스의 requiredTime 업데이트
                    if (this.selectedFlowActivity.backflowSequenceId) {
                        const sequence = processDefinition.elements.find(el => 
                            el.id === this.selectedFlowActivity.backflowSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = this.selectedFlowActivity.backflowRequiredTime;
                            console.log('✅ Backflow Sequence requiredTime 업데이트:', sequence);
                        }
                    }
                } 
                // Activities 분리 구조인 경우
                else if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                    const activity = processDefinition.activities.find(act => 
                        act.id === this.selectedFlowActivity.id || act.name === activityName
                    );
                    if (activity) {
                        activity.system = this.selectedFlowActivity.footer; // footer가 시스템/도구
                        activity.description = this.selectedFlowActivity.description;
                        activity.role = this.selectedFlowActivity.header; // header가 역할
                        updated = true;
                        console.log('✅ Activity 업데이트:', activity);
                    }
                    
                    // 들어오는 시퀀스의 requiredTime 업데이트
                    if (this.selectedFlowActivity.incomingSequenceId && processDefinition.sequences) {
                        const sequence = processDefinition.sequences.find(seq => 
                            seq.id === this.selectedFlowActivity.incomingSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = this.selectedFlowActivity.requiredTime;
                            console.log('✅ Incoming Sequence requiredTime 업데이트:', sequence);
                        }
                    }
                    
                    // 역행 시퀀스의 requiredTime 업데이트
                    if (this.selectedFlowActivity.backflowSequenceId && processDefinition.sequences) {
                        const sequence = processDefinition.sequences.find(seq => 
                            seq.id === this.selectedFlowActivity.backflowSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = this.selectedFlowActivity.backflowRequiredTime;
                            console.log('✅ Backflow Sequence requiredTime 업데이트:', sequence);
                        }
                    }
                }
                
                if (updated) {
                    // 2. currentProcessDefinitionForFlow를 완전히 새로운 객체로 교체 (Vue 반응성 트리거)
                    // 기존 객체를 null로 설정한 후 다시 할당하여 강제 리렌더링
                    this.currentProcessDefinitionForFlow = null;
                    
                    this.$nextTick(() => {
                        // 깊은 복사로 완전히 새로운 객체 생성
                        this.currentProcessDefinitionForFlow = JSON.parse(JSON.stringify(processDefinition));
                        console.log('✅ Flow 화면 업데이트 완료');
                    });
                    
                    console.log('✅ 액티비티 업데이트 완료 (메모리에만 저장)');
                } else {
                    console.error('❌ 액티비티를 찾을 수 없습니다:', activityName);
                }
                
            } catch (error) {
                console.error('❌ 액티비티 저장 실패:', error);
            }
        },

        /**
         * 프로세스 정의를 엑셀 파일로 다운로드
         */
        async handleDownloadExcel() {
            try {
                console.log('📥 엑셀 다운로드 시작');

                const chatComponent = this.$refs.processDefinitionChat;
                if (!chatComponent || !chatComponent.processDefinition) {
                    console.error('프로세스 정의를 찾을 수 없습니다.');
                    alert('다운로드할 프로세스 정의가 없습니다.');
                    return;
                }

                const processDefinition = chatComponent.processDefinition;
                console.log('📋 프로세스 정의:', processDefinition);
                
                // 원본 엑셀이 있으면 그 형식을 기반으로 다운로드
                if (this.originalWorkbook && this.originalWorkbookInfo) {
                    console.log('🔄 원본 엑셀 형식 기반으로 다운로드');
                    await this.downloadExcelWithOriginalFormat(processDefinition);
                    return;
                }

                // 구조 판별: elements가 있으면 새로운 구조, 없으면 이전 구조
                const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements);
                const hasOldStructure = processDefinition.activities && Array.isArray(processDefinition.activities);
                
                console.log('📊 구조 타입:', hasElementsStructure ? 'Elements 구조' : 'Activities 분리 구조');

                // 워크북 생성
                const workbook = XLSX.utils.book_new();

                // 1. 프로세스 기본 정보 시트
                const processInfoData = [
                    ['항목', '내용'],
                    ['Mega Process ID', processDefinition.megaProcessId || ''],
                    ['Major Process ID', processDefinition.majorProcessId || ''],
                    ['프로세스 ID', processDefinition.processDefinitionId || ''],
                    ['프로세스 이름', processDefinition.processDefinitionName || ''],
                    ['설명', processDefinition.description || ''],
                    ['수평 레이아웃', processDefinition.isHorizontal ? '예' : '아니오'],
                    ['자동 레이아웃', processDefinition.isAutoLayout ? '예' : '아니오'],
                    ['생성일', new Date().toLocaleDateString('ko-KR')]
                ];
                const processInfoSheet = XLSX.utils.aoa_to_sheet(processInfoData);
                processInfoSheet['!cols'] = [
                    { wch: 20 },
                    { wch: 50 }
                ];
                XLSX.utils.book_append_sheet(workbook, processInfoSheet, '1.프로세스정보');

                // 2. 프로세스 변수(Data) 시트
                if (processDefinition.data && processDefinition.data.length > 0) {
                    const dataSheetData = [
                        ['변수명', '설명', '타입']
                    ];
                    
                    processDefinition.data.forEach(variable => {
                        dataSheetData.push([
                            variable.name || '',
                            variable.description || '',
                            variable.type || ''
                        ]);
                    });

                    const dataSheet = XLSX.utils.aoa_to_sheet(dataSheetData);
                    dataSheet['!cols'] = [
                        { wch: 20 },  // 변수명
                        { wch: 50 },  // 설명
                        { wch: 15 }   // 타입
                    ];
                    XLSX.utils.book_append_sheet(workbook, dataSheet, '2.프로세스변수');
                }

                // 3. Roles(역할/Lane) 시트 - 실제 사용된 role만 추출
                if (processDefinition.roles && processDefinition.roles.length > 0) {
                    // 사용된 role 목록 수집
                    const usedRoles = new Set();
                    
                    // Elements 구조인 경우
                    if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                        processDefinition.elements.forEach(element => {
                            if (element.role) {
                                usedRoles.add(element.role);
                            }
                        });
                    } else {
                        // 분리된 구조인 경우
                        // Activities에서 role 수집
                        if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                            processDefinition.activities.forEach(activity => {
                                if (activity.role) {
                                    usedRoles.add(activity.role);
                                }
                            });
                        }
                        
                        // Events에서 role 수집
                        if (processDefinition.events && Array.isArray(processDefinition.events)) {
                            processDefinition.events.forEach(event => {
                                if (event.role) {
                                    usedRoles.add(event.role);
                                }
                            });
                        }
                        
                        // Gateways에서 role 수집
                        if (processDefinition.gateways && Array.isArray(processDefinition.gateways)) {
                            processDefinition.gateways.forEach(gateway => {
                                if (gateway.role) {
                                    usedRoles.add(gateway.role);
                                }
                            });
                        }
                    }
                    
                    // 실제 사용된 role만 필터링
                    const filteredRoles = processDefinition.roles.filter(role => 
                        usedRoles.has(role.name)
                    );
                    
                    console.log('📊 전체 Role 수:', processDefinition.roles.length);
                    console.log('✅ 사용된 Role 수:', filteredRoles.length);
                    console.log('🔍 사용된 Role 목록:', Array.from(usedRoles));
                    
                    if (filteredRoles.length > 0) {
                        const rolesData = [
                            ['역할 이름', 'Endpoint', '담당 업무', 'X좌표', 'Y좌표', '너비', '높이']
                        ];
                        
                        filteredRoles.forEach(role => {
                            rolesData.push([
                                role.name || '',
                                role.endpoint || '',
                                role.resolutionRule || '',
                                role.boundary?.minX || '',
                                role.boundary?.minY || '',
                                role.boundary?.width || '',
                                role.boundary?.height || ''
                            ]);
                        });

                        const rolesSheet = XLSX.utils.aoa_to_sheet(rolesData);
                        rolesSheet['!cols'] = [
                            { wch: 20 },  // 역할 이름
                            { wch: 25 },  // Endpoint
                            { wch: 40 },  // 담당 업무
                            { wch: 10 },  // X좌표
                            { wch: 10 },  // Y좌표
                            { wch: 10 },  // 너비
                            { wch: 10 }   // 높이
                        ];
                        XLSX.utils.book_append_sheet(workbook, rolesSheet, '3.역할(Lane)');
                    } else {
                        console.log('⚠️ 사용된 Role이 없습니다. Role 시트를 생성하지 않습니다.');
                    }
                }

                // 4. 액티비티 시트 (구조에 따라 분기)
                let activities = [];
                if (hasElementsStructure) {
                    // Elements 구조: elementType === 'Activity'인 것만 추출
                    activities = processDefinition.elements.filter(el => el.elementType === 'Activity');
                } else if (hasOldStructure) {
                    // 이전 구조: activities 배열 직접 사용
                    activities = processDefinition.activities;
                }

                if (activities.length > 0) {
                    const activitiesData = [
                        ['ID', '이름', '타입', '역할', '설명', '지시사항', 
                         '소요시간(일)', '체크포인트', '입력데이터', '출력데이터', 
                         '도구(tool)', '시스템(system)', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
                    ];
                    
                    activities.forEach(activity => {
                        // properties가 JSON 문자열인 경우 파싱
                        let parsedProps = {};
                        if (activity.properties && typeof activity.properties === 'string') {
                            try {
                                parsedProps = JSON.parse(activity.properties);
                            } catch (e) {
                                console.warn('properties 파싱 실패:', e);
                            }
                        }

                        const checkpoints = activity.checkpoints || parsedProps.checkpoints || [];
                        const description = activity.description || parsedProps.description || '';

                        activitiesData.push([
                            activity.id || '',
                            activity.name || '',
                            activity.type || '',
                            activity.role || parsedProps.role || '',
                            description,
                            activity.instruction || '',
                            activity.duration || '',
                            Array.isArray(checkpoints) ? checkpoints.join(', ') : '',
                            Array.isArray(activity.inputData) ? activity.inputData.join(', ') : '',
                            Array.isArray(activity.outputData) ? activity.outputData.join(', ') : '',
                            activity.tool || '',
                            activity.system || '',
                            activity.layer || '',
                            activity.order || '',
                            activity.x || '',
                            activity.y || '',
                            activity.width || '',
                            activity.height || ''
                        ]);
                    });

                    const activitiesSheet = XLSX.utils.aoa_to_sheet(activitiesData);
                    activitiesSheet['!cols'] = [
                        { wch: 30 },  // ID
                        { wch: 25 },  // 이름
                        { wch: 15 },  // 타입
                        { wch: 15 },  // 역할
                        { wch: 40 },  // 설명
                        { wch: 40 },  // 지시사항
                        { wch: 12 },  // 소요시간
                        { wch: 30 },  // 체크포인트
                        { wch: 30 },  // 입력데이터
                        { wch: 30 },  // 출력데이터
                        { wch: 35 },  // 도구(tool)
                        { wch: 35 },  // 시스템(system)
                        { wch: 8 },   // Layer
                        { wch: 8 },   // Order
                        { wch: 8 },   // X좌표
                        { wch: 8 },   // Y좌표
                        { wch: 8 },   // 너비
                        { wch: 8 }    // 높이
                    ];
                    XLSX.utils.book_append_sheet(workbook, activitiesSheet, '4.액티비티');
                }

                // 5. 이벤트 시트 (구조에 따라 분기)
                let events = [];
                if (hasElementsStructure) {
                    // Elements 구조: elementType === 'Event'인 것만 추출
                    events = processDefinition.elements.filter(el => el.elementType === 'Event');
                } else if (processDefinition.events && Array.isArray(processDefinition.events)) {
                    // 이전 구조: events 배열 직접 사용
                    events = processDefinition.events;
                }

                if (events.length > 0) {
                    const eventsData = [
                        ['ID', '이름', '타입', '역할', '설명', '트리거', 
                         'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
                    ];
                    
                    events.forEach(event => {
                        // properties가 JSON 문자열인 경우 파싱
                        let parsedProps = {};
                        if (event.properties && typeof event.properties === 'string') {
                            try {
                                parsedProps = JSON.parse(event.properties);
                            } catch (e) {
                                console.warn('properties 파싱 실패:', e);
                            }
                        }

                        const description = event.description || parsedProps.description || '';

                        eventsData.push([
                            event.id || '',
                            event.name || '',
                            event.type || '',
                            event.role || '',
                            description,
                            event.trigger || '',
                            event.bpmnType || '',
                            event.layer || '',
                            event.order || '',
                            event.x || '',
                            event.y || '',
                            event.width || '',
                            event.height || ''
                        ]);
                    });

                    const eventsSheet = XLSX.utils.aoa_to_sheet(eventsData);
                    eventsSheet['!cols'] = [
                        { wch: 30 },  // ID
                        { wch: 25 },  // 이름
                        { wch: 15 },  // 타입
                        { wch: 15 },  // 역할
                        { wch: 40 },  // 설명
                        { wch: 30 },  // 트리거
                        { wch: 20 },  // BPMN타입
                        { wch: 8 },   // Layer
                        { wch: 8 },   // Order
                        { wch: 8 },   // X좌표
                        { wch: 8 },   // Y좌표
                        { wch: 8 },   // 너비
                        { wch: 8 }    // 높이
                    ];
                    XLSX.utils.book_append_sheet(workbook, eventsSheet, '5.이벤트');
                }

                // 6. 게이트웨이 시트 (구조에 따라 분기)
                let gateways = [];
                if (hasElementsStructure) {
                    // Elements 구조: elementType === 'Gateway'인 것만 추출
                    gateways = processDefinition.elements.filter(el => el.elementType === 'Gateway');
                } else if (processDefinition.gateways && Array.isArray(processDefinition.gateways)) {
                    // 이전 구조: gateways 배열 직접 사용
                    gateways = processDefinition.gateways;
                }

                if (gateways.length > 0) {
                    const gatewaysData = [
                        ['ID', '이름', '타입', '역할', '설명', '조건', 
                         'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
                    ];
                    
                    gateways.forEach(gateway => {
                        // properties가 JSON 문자열인 경우 파싱
                        let parsedProps = {};
                        if (gateway.properties && typeof gateway.properties === 'string') {
                            try {
                                parsedProps = JSON.parse(gateway.properties);
                            } catch (e) {
                                console.warn('properties 파싱 실패:', e);
                            }
                        }

                        const description = gateway.description || parsedProps.description || '';
                        const condition = gateway.condition ? 
                            (typeof gateway.condition === 'object' ? JSON.stringify(gateway.condition) : gateway.condition) : '';

                        gatewaysData.push([
                            gateway.id || '',
                            gateway.name || '',
                            gateway.type || '',
                            gateway.role || '',
                            description,
                            condition,
                            gateway.bpmnType || '',
                            gateway.layer || '',
                            gateway.order || '',
                            gateway.x || '',
                            gateway.y || '',
                            gateway.width || '',
                            gateway.height || ''
                        ]);
                    });

                    const gatewaysSheet = XLSX.utils.aoa_to_sheet(gatewaysData);
                    gatewaysSheet['!cols'] = [
                        { wch: 30 },  // ID
                        { wch: 25 },  // 이름
                        { wch: 15 },  // 타입
                        { wch: 15 },  // 역할
                        { wch: 40 },  // 설명
                        { wch: 30 },  // 조건
                        { wch: 20 },  // BPMN타입
                        { wch: 8 },   // Layer
                        { wch: 8 },   // Order
                        { wch: 8 },   // X좌표
                        { wch: 8 },   // Y좌표
                        { wch: 8 },   // 너비
                        { wch: 8 }    // 높이
                    ];
                    XLSX.utils.book_append_sheet(workbook, gatewaysSheet, '6.게이트웨이');
                }

                // 7. 시퀀스(흐름) 시트 (구조에 따라 분기)
                let sequences = [];
                if (hasElementsStructure) {
                    // Elements 구조: elementType === 'Sequence'인 것만 추출
                    sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence');
                } else if (processDefinition.sequences && Array.isArray(processDefinition.sequences)) {
                    // 이전 구조: sequences 배열 직접 사용
                    sequences = processDefinition.sequences;
                }

                if (sequences.length > 0) {
                    const sequencesData = [
                        ['ID', '이름', '시작(Source)', '종료(Target)', '조건', 'Waypoints']
                    ];
                    
                    sequences.forEach(seq => {
                        // properties가 JSON 문자열인 경우 파싱
                        let parsedProps = {};
                        if (seq.properties && typeof seq.properties === 'string') {
                            try {
                                parsedProps = JSON.parse(seq.properties);
                            } catch (e) {
                                console.warn('properties 파싱 실패:', e);
                            }
                        }

                        const waypoints = seq.waypoints && Array.isArray(seq.waypoints) 
                            ? seq.waypoints.map(wp => `(${wp.x},${wp.y})`).join(' → ')
                            : '';
                        
                        const condition = seq.condition || parsedProps.condition || '';
                        const conditionStr = typeof condition === 'object' ? JSON.stringify(condition) : condition;

                        sequencesData.push([
                            seq.id || '',
                            seq.name || '',
                            seq.source || '',
                            seq.target || '',
                            conditionStr,
                            waypoints
                        ]);
                    });

                    const sequencesSheet = XLSX.utils.aoa_to_sheet(sequencesData);
                    sequencesSheet['!cols'] = [
                        { wch: 30 },  // ID
                        { wch: 30 },  // 이름
                        { wch: 30 },  // 시작
                        { wch: 30 },  // 종료
                        { wch: 40 },  // 조건
                        { wch: 50 }   // Waypoints
                    ];
                    XLSX.utils.book_append_sheet(workbook, sequencesSheet, '7.시퀀스(흐름)');
                }

                // 8. SubProcesses 시트
                if (processDefinition.subProcesses && processDefinition.subProcesses.length > 0) {
                    const subProcessesData = [
                        ['ID', '이름', '설명', '타입']
                    ];
                    
                    processDefinition.subProcesses.forEach(subProc => {
                        subProcessesData.push([
                            subProc.id || '',
                            subProc.name || '',
                            subProc.description || '',
                            subProc.type || ''
                        ]);
                    });

                    const subProcessesSheet = XLSX.utils.aoa_to_sheet(subProcessesData);
                    subProcessesSheet['!cols'] = [
                        { wch: 30 },  // ID
                        { wch: 30 },  // 이름
                        { wch: 50 },  // 설명
                        { wch: 20 }   // 타입
                    ];
                    XLSX.utils.book_append_sheet(workbook, subProcessesSheet, '8.서브프로세스');
                }

                // 파일 이름 생성
                const fileName = `${processDefinition.processDefinitionName || 'process'}_${new Date().getTime()}.xlsx`;

                // 엑셀 파일 생성 및 다운로드
                XLSX.writeFile(workbook, fileName);

                console.log('✅ 엑셀 파일 다운로드 완료:', fileName);
                
            } catch (error) {
                console.error('❌ 엑셀 다운로드 실패:', error);
                alert('엑셀 파일 다운로드에 실패했습니다.');
            }
        },

        /**
         * 원본 엑셀 형식을 기반으로 프로세스 정의를 다운로드
         */
        async downloadExcelWithOriginalFormat(processDefinition) {
            try {
                // ✅ 원본 엑셀이 없으면 기존 7개 시트 형식으로 다운로드
                if (!this.originalWorkbook) {
                    console.log('📝 원본 엑셀 없음 → 기존 7개 시트 형식으로 생성');
                    // TODO: 7개 시트 생성 로직 구현 필요 (주석처리된 로직 재활용)
                    alert('원본 엑셀이 없습니다. 먼저 엑셀을 업로드해주세요.');
                    return;
                }
                
                console.log('📝 원본 워크북 기반 다운로드 시작');
                
                // ✅ Deep Clone (스타일 유지)
                const workbookCopy = JSON.parse(JSON.stringify(this.originalWorkbook));
                
                console.log('✅ 원본 워크북 복사 완료');
                console.log('📋 원본 시트 목록:', workbookCopy.SheetNames);
                
                // ✅ 모든 시트의 모든 셀 스타일을 fill 구조로 변환 + font 매핑
                console.log('🎨 스타일 변환 시작 (fgColor → fill 구조 + font 매핑)');
                let convertedCells = 0;
                let fontMappedCells = 0;
                
                for (const sheetName of workbookCopy.SheetNames) {
                    const sheet = workbookCopy.Sheets[sheetName];
                    
                    for (const cellAddress in sheet) {
                        if (cellAddress.startsWith('!')) continue; // 특수 속성 건너뛰기
                        
                        const cell = sheet[cellAddress];
                        if (cell && cell.s) {
                            let targetFgColorRgb = null;
                            
                            // s.fgColor 또는 s.bgColor가 직접 있으면 fill 구조로 변환
                            if (cell.s.fgColor || cell.s.bgColor || cell.s.patternType) {
                                if (!cell.s.fill) {
                                    // fill 구조로 변환
                                    cell.s.fill = {};
                                    
                                    if (cell.s.patternType) {
                                        cell.s.fill.patternType = cell.s.patternType;
                                        delete cell.s.patternType;
                                    }
                                    
                                    if (cell.s.fgColor) {
                                        cell.s.fill.fgColor = cell.s.fgColor;
                                        targetFgColorRgb = cell.s.fgColor.rgb;
                                        delete cell.s.fgColor;
                                    }
                                    
                                    if (cell.s.bgColor) {
                                        cell.s.fill.bgColor = cell.s.bgColor;
                                        delete cell.s.bgColor;
                                    }
                                    
                                    convertedCells++;
                                }
                            } else if (cell.s.fill && cell.s.fill.fgColor && cell.s.fill.fgColor.rgb) {
                                // 이미 fill 구조인 경우
                                targetFgColorRgb = cell.s.fill.fgColor.rgb;
                            }
                            
                            // ✅ Font 매핑 (배경색 기반)
                            if (!cell.s.font && targetFgColorRgb && workbookCopy.Styles) {
                                const cellXf = workbookCopy.Styles.CellXf;
                                const fonts = workbookCopy.Styles.Fonts;
                                const fills = workbookCopy.Styles.Fills;
                                
                                if (fills && cellXf && fonts) {
                                    // 배경색으로 fillId 찾기
                                    let fillId = 0;
                                    for (let i = 0; i < fills.length; i++) {
                                        if (fills[i].fgColor && fills[i].fgColor.rgb === targetFgColorRgb) {
                                            fillId = i;
                                            break;
                                        }
                                    }
                                    
                                    // fillId로 CellXf 찾아서 fontId 가져오기
                                    for (let i = 0; i < cellXf.length; i++) {
                                        const xf = cellXf[i];
                                        const xfFillId = xf.fillId || xf.fillid || 0;
                                        
                                        if (xfFillId == fillId && (xf.applyFont === true || xf.applyfont === "1")) {
                                            const fontId = xf.fontId || xf.fontid || 0;
                                            if (fonts[fontId]) {
                                                cell.s.font = JSON.parse(JSON.stringify(fonts[fontId]));
                                                fontMappedCells++;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                console.log(`✅ 스타일 변환 완료: ${convertedCells}개 셀 (fill 구조 변환)`);
                console.log(`✅ Font 매핑 완료: ${fontMappedCells}개 셀 (배경색 기반)`);
                
                // ========== 시트 내용 업데이트 (⚠️ 스타일은 절대 건드리지 않고 값만 업데이트) ==========
                
                // 1️⃣ 첫 번째 시트 업데이트 (임의 구조 처리 - 헤더 찾아서 매핑)
                const firstSheetName = workbookCopy.SheetNames[0];
                if (firstSheetName) {
                    console.log(`🔄 첫 번째 시트 내용 업데이트: ${firstSheetName} (스타일 유지)`);
                    await this.updateOriginalSheetWithNewData(
                        workbookCopy.Sheets[firstSheetName], 
                        processDefinition
                    );
                }
                
                console.log('✅ 첫 번째 시트 내용 업데이트 완료');
                
                // 2️⃣ 표준 시트들 업데이트 (원본에 있는 경우만!)
                const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements);
                
                // ✅ 원본에 표준 시트가 있는지 확인
                const hasStandardSheets = workbookCopy.SheetNames.some(name => 
                    ['1.프로세스정보', '2.프로세스변수', '3.역할(Lane)', '4.액티비티', '5.이벤트', '6.게이트웨이', '7.시퀀스(흐름)', '8.서브프로세스'].includes(name)
                );
                
                if (hasStandardSheets) {
                    console.log('📝 표준 시트 내용 업데이트 시작 (원본에 존재하는 시트만, 스타일 유지)');
                } else {
                    console.log('ℹ️ 임의 구조 엑셀 - 표준 시트 추가하지 않음');
                }
                
                // 1. 프로세스 정보 시트 (원본에 있을 때만)
                if (hasStandardSheets && workbookCopy.SheetNames.includes('1.프로세스정보')) {
                    this.addOrUpdateSheet(workbookCopy, '1.프로세스정보', this.createProcessInfoData(processDefinition), false);
                }
                
                // 2. 프로세스 변수 시트 (원본에 있을 때만)
                if (hasStandardSheets && processDefinition.data && processDefinition.data.length > 0 && workbookCopy.SheetNames.includes('2.프로세스변수')) {
                    this.addOrUpdateSheet(workbookCopy, '2.프로세스변수', this.createDataSheetData(processDefinition), false);
                }
                
                // 3. 역할(Lane) 시트 (원본에 있을 때만)
                if (hasStandardSheets && processDefinition.roles && processDefinition.roles.length > 0 && workbookCopy.SheetNames.includes('3.역할(Lane)')) {
                    const filteredRoles = this.getFilteredRoles(processDefinition);
                    if (filteredRoles.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '3.역할(Lane)', this.createRolesData(filteredRoles), false);
                    }
                }
                
                // 4. 액티비티 시트 (원본에 있을 때만)
                if (hasStandardSheets && workbookCopy.SheetNames.includes('4.액티비티')) {
                    let activities = [];
                    if (hasElementsStructure) {
                        activities = processDefinition.elements.filter(el => el.elementType === 'Activity');
                    } else if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                        activities = processDefinition.activities;
                    }
                    
                    if (activities.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '4.액티비티', this.createActivitiesData(activities), false);
                    }
                }
                
                // 5. 이벤트 시트 (원본에 있을 때만)
                if (hasStandardSheets && workbookCopy.SheetNames.includes('5.이벤트')) {
                    let events = [];
                    if (hasElementsStructure) {
                        events = processDefinition.elements.filter(el => el.elementType === 'Event');
                    } else if (processDefinition.events && Array.isArray(processDefinition.events)) {
                        events = processDefinition.events;
                    }
                    
                    if (events.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '5.이벤트', this.createEventsData(events), false);
                    }
                }
                
                // 6. 게이트웨이 시트 (원본에 있을 때만)
                if (hasStandardSheets && workbookCopy.SheetNames.includes('6.게이트웨이')) {
                    let gateways = [];
                    if (hasElementsStructure) {
                        gateways = processDefinition.elements.filter(el => el.elementType === 'Gateway');
                    } else if (processDefinition.gateways && Array.isArray(processDefinition.gateways)) {
                        gateways = processDefinition.gateways;
                    }
                    
                    if (gateways.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '6.게이트웨이', this.createGatewaysData(gateways), false);
                    }
                }
                
                // 7. 시퀀스(흐름) 시트 (원본에 있을 때만)
                if (hasStandardSheets && workbookCopy.SheetNames.includes('7.시퀀스(흐름)')) {
                    let sequences = [];
                    if (hasElementsStructure) {
                        sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence');
                    } else if (processDefinition.sequences && Array.isArray(processDefinition.sequences)) {
                        sequences = processDefinition.sequences;
                    }
                    
                    if (sequences.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '7.시퀀스(흐름)', this.createSequencesData(sequences), false);
                    }
                }
                
                // 8. 서브프로세스 시트 (원본에 있을 때만)
                if (hasStandardSheets && processDefinition.subProcesses && processDefinition.subProcesses.length > 0 && workbookCopy.SheetNames.includes('8.서브프로세스')) {
                    this.addOrUpdateSheet(workbookCopy, '8.서브프로세스', this.createSubProcessesData(processDefinition.subProcesses), false);
                }
                
                if (hasStandardSheets) {
                    console.log('✅ 표준 시트 내용 업데이트 완료');
                }
                
                // 파일 이름 생성 (원본 이름 기반)
                const originalName = this.originalWorkbookInfo.fileName.replace(/\.[^/.]+$/, '');
                const fileName = `${originalName}_updated_${new Date().getTime()}.xlsx`;
                
                // 엑셀 파일 생성 및 다운로드 (xlsx-js-style 표준 방식)
                console.log('💾 원본 엑셀 다운로드 시작...');
                console.log('📊 워크북 정보:', {
                    시트수: workbookCopy.SheetNames.length,
                    시트명: workbookCopy.SheetNames
                });
                
                // xlsx-js-style은 셀의 's' 속성으로 스타일을 자동 처리
                XLSX.writeFile(workbookCopy, fileName, {
                    bookType: 'xlsx',
                    bookSST: false,
                    type: 'binary',
                    cellStyles: true  // ✅ 스타일 쓰기 활성화
                });
                
                console.log('✅ 원본 형식 기반 엑셀 다운로드 완료:', fileName);
                // alert(`원본 엑셀 형식으로 다운로드 완료!\n\n파일명: ${fileName}`);
                
            } catch (error) {
                console.error('❌ 원본 형식 기반 다운로드 실패:', error);
                console.error('상세 오류:', error.stack);
                alert(`엑셀 다운로드 실패\n\n${error.message}`);
            }
        },

        /**
         * 시트 Deep Clone (스타일, 병합, 너비, 색상 모두 복사)
         */
        deepCloneSheetWithStyles(originalSheet) {
            const sheetCopy = {};
            
            // 모든 셀과 속성 복사 (스타일 정보 포함)
            Object.keys(originalSheet).forEach(key => {
                if (key.startsWith('!')) {
                    // 특수 속성 (병합, 너비, 범위 등) 복사
                    if (Array.isArray(originalSheet[key])) {
                        sheetCopy[key] = JSON.parse(JSON.stringify(originalSheet[key]));
                    } else if (typeof originalSheet[key] === 'object' && originalSheet[key] !== null) {
                        sheetCopy[key] = JSON.parse(JSON.stringify(originalSheet[key]));
                    } else {
                        sheetCopy[key] = originalSheet[key];
                    }
                } else {
                    // 일반 셀 복사 (v, w, t, s 등 모든 속성 포함)
                    // s 속성이 스타일 정보를 담고 있음
                    if (typeof originalSheet[key] === 'object' && originalSheet[key] !== null) {
                        sheetCopy[key] = JSON.parse(JSON.stringify(originalSheet[key]));
                    } else {
                        sheetCopy[key] = originalSheet[key];
                    }
                }
            });
            
            return sheetCopy;
        },

        /**
         * 원본 시트의 데이터만 업데이트 (형식은 완벽히 유지)
         */
        updateOriginalSheetWithNewData(sheet, processDefinition) {
            try {
                console.log('📝 원본 시트 데이터 업데이트 시작');
                
                // 구조 판별
                const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements);
                
                // Activities 추출
                let activities = [];
                if (hasElementsStructure) {
                    activities = processDefinition.elements.filter(el => el.elementType === 'Activity');
                } else if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                    activities = processDefinition.activities;
                }
                
                console.log(`📊 업데이트할 액티비티 수: ${activities.length}`);
                
                // 원본 시트의 데이터 영역 찾기 (헤더 행 찾기)
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1000');
                let headerRow = -1;
                
                // "No" 또는 "Activity" 같은 헤더를 찾아서 헤더 행 확인
                for (let row = range.s.r; row <= range.e.r; row++) {
                    for (let col = range.s.c; col <= range.e.c; col++) {
                        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                        const cell = sheet[cellAddress];
                        
                        if (cell && cell.v) {
                            const cellValue = String(cell.v).trim().toLowerCase();
                            if (cellValue.includes('no') || 
                                cellValue.includes('activity') ||
                                cellValue.includes('담당')) {
                                headerRow = row;
                                console.log(`✅ 헤더 행 찾음: ${headerRow + 1}행`);
                                break;
                            }
                        }
                    }
                    if (headerRow !== -1) break;
                }
                
                if (headerRow === -1) {
                    console.warn('⚠️ 헤더 행을 찾을 수 없습니다.');
                    return;
                }
                
                // 헤더의 열 매핑 생성 (원본 엑셀의 실제 구조 파악)
                const columnMapping = this.createColumnMapping(sheet, headerRow, range);
                console.log('📋 열 매핑:', columnMapping);
                
                // 첫 데이터 행
                const firstDataRow = headerRow + 1;
                
                // 기존 데이터 행 찾기 (몇 행까지 데이터가 있는지)
                let lastDataRow = firstDataRow;
                for (let row = firstDataRow; row <= range.e.r; row++) {
                    let hasData = false;
                    for (let col = range.s.c; col <= range.e.c; col++) {
                        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                        const cell = sheet[cellAddress];
                        if (cell && cell.v && String(cell.v).trim() !== '') {
                            hasData = true;
                            break;
                        }
                    }
                    if (hasData) {
                        lastDataRow = row;
                    }
                }
                
                console.log(`📊 기존 데이터 행: ${firstDataRow + 1} ~ ${lastDataRow + 1}`);
                
                // 각 액티비티를 기존 행에 매핑하여 업데이트
                activities.forEach((activity, index) => {
                    const rowNum = firstDataRow + index;
                    
                    // 기존 행이 있으면 해당 행의 셀들을 업데이트
                    // 없으면 마지막 데이터 행의 스타일을 복사해서 새 행 생성
                    const isExistingRow = rowNum <= lastDataRow;
                    const templateRow = isExistingRow ? rowNum : lastDataRow;
                    
                    console.log(`🔄 ${index + 1}번 액티비티 업데이트: ${activity.name}`);
                    
                    // 각 열에 데이터 입력 (열 매핑에 따라)
                    this.updateCellValue(sheet, rowNum, columnMapping.no, index + 1, templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.activityName, activity.name || '', templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.description, activity.description || '', templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.role, activity.role || '', templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.input, 
                        activity.inputData ? (Array.isArray(activity.inputData) ? activity.inputData.join(', ') : activity.inputData) : '', 
                        templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.output, 
                        activity.outputData ? (Array.isArray(activity.outputData) ? activity.outputData.join(', ') : activity.outputData) : '', 
                        templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.system, activity.system || '', templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.duration, activity.duration || '', templateRow);
                    this.updateCellValue(sheet, rowNum, columnMapping.instruction, activity.instruction || '', templateRow);
                    
                    // 기타 열들은 빈 값으로 유지 (기존 값 보존)
                });
                
                console.log(`✅ ${activities.length}개 액티비티 업데이트 완료 (원본 형식 완벽 유지)`);
                
            } catch (error) {
                console.error('❌ 원본 시트 업데이트 실패:', error);
                console.error('상세 오류:', error.stack);
            }
        },

        /**
         * 헤더 행의 열 매핑 생성
         */
        createColumnMapping(sheet, headerRow, range) {
            const mapping = {
                no: -1,
                activityName: -1,
                description: -1,
                role: -1,
                input: -1,
                output: -1,
                system: -1,
                duration: -1,
                instruction: -1
            };
            
            // 헤더 행의 모든 셀을 검사하여 각 열이 무엇인지 파악
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
                const cell = sheet[cellAddress];
                
                if (cell && cell.v) {
                    const headerText = String(cell.v).trim().toLowerCase();
                    
                    if (headerText.includes('no') && !headerText.includes('description')) {
                        mapping.no = col;
                    } else if (headerText.includes('activity') && headerText.includes('명')) {
                        mapping.activityName = col;
                    } else if (headerText.includes('상세') || headerText.includes('업무') || headerText.includes('description')) {
                        mapping.description = col;
                    } else if (headerText.includes('담당') || headerText.includes('조직') || headerText.includes('role')) {
                        mapping.role = col;
                    } else if (headerText.includes('input') || headerText === 'input') {
                        mapping.input = col;
                    } else if (headerText.includes('output') || headerText === 'output') {
                        mapping.output = col;
                    } else if (headerText.includes('system') || headerText === 'system') {
                        mapping.system = col;
                    } else if (headerText.includes('핵심') || headerText.includes('data')) {
                        mapping.duration = col;
                    } else if (headerText.includes('소요') || headerText.includes('시간')) {
                        mapping.instruction = col;
                    }
                }
            }
            
            return mapping;
        },

        /**
         * 셀 값만 업데이트 (스타일 완벽 보존)
         */
        updateCellValue(sheet, rowNum, colNum, value, templateRow) {
            if (colNum === -1) return; // 해당 열이 없으면 스킵
            
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            const templateCellAddress = XLSX.utils.encode_cell({ r: templateRow, c: colNum });
            
            // 기존 셀이 있으면 값만 업데이트
            if (sheet[cellAddress]) {
                // 기존 셀의 모든 속성을 보존하고 값만 변경
                const originalCell = sheet[cellAddress];
                sheet[cellAddress] = {
                    ...originalCell,  // 모든 기존 속성 유지 (스타일 포함)
                    v: value,
                    w: String(value),
                    t: typeof value === 'number' ? 'n' : 's'
                };
            } else {
                // 새 셀을 만들어야 하는 경우 템플릿 행의 모든 속성 복사
                const templateCell = sheet[templateCellAddress];
                
                if (templateCell) {
                    // 템플릿 셀의 모든 속성을 복사하고 값만 변경
                    sheet[cellAddress] = {
                        ...JSON.parse(JSON.stringify(templateCell)),
                        v: value,
                        w: String(value),
                        t: typeof value === 'number' ? 'n' : 's'
                    };
                } else {
                    // 템플릿도 없으면 기본 셀 생성
                    sheet[cellAddress] = {
                        v: value,
                        w: String(value),
                        t: typeof value === 'number' ? 'n' : 's'
                    };
                }
            }
        },

        /**
         * 새 시트 추가 또는 기존 시트 업데이트
         */
        addOrUpdateSheet(workbook, sheetName, data, appendIfNotExists = true) {
            try {
                const sheetIndex = workbook.SheetNames.indexOf(sheetName);
                
                if (sheetIndex !== -1) {
                    // 기존 시트가 있으면 업데이트
                    console.log(`🔄 시트 업데이트: ${sheetName}`);
                    
                    // ✅ 이미 변환된 워크북의 시트 사용 (fill 변환 완료된 상태)
                    if (workbook.Sheets && workbook.Sheets[sheetName]) {
                        
                        console.log(`✅ 원본 시트 발견 - 스타일 보존하며 업데이트: ${sheetName}`);
                        
                        // ✅ 이미 변환된 시트를 Deep Clone (fill 구조 유지)
                        const convertedSheet = workbook.Sheets[sheetName];
                        const styledSheet = this.deepCloneSheetWithStyles(convertedSheet);
                        
                        // 데이터만 업데이트 (스타일 유지)
                        this.updateSheetDataWithStyles(styledSheet, data, convertedSheet);
                        
                        workbook.Sheets[sheetName] = styledSheet;
                    } else {
                        // 원본에 없는 시트면 새로 생성
                        console.log(`📝 새로운 시트 생성: ${sheetName}`);
                        const newSheet = XLSX.utils.aoa_to_sheet(data);
                        this.setColumnWidths(newSheet, sheetName);
                        workbook.Sheets[sheetName] = newSheet;
                    }
                } else if (appendIfNotExists) {
                    // 새 시트 추가
                    console.log(`➕ 새 시트 추가: ${sheetName}`);
                    const newSheet = XLSX.utils.aoa_to_sheet(data);
                    
                    // 열 너비 설정
                    this.setColumnWidths(newSheet, sheetName);
                    
                    XLSX.utils.book_append_sheet(workbook, newSheet, sheetName);
                }
            } catch (error) {
                console.error(`❌ 시트 처리 실패 (${sheetName}):`, error);
            }
        },
        
        /**
         * 스타일을 보존하면서 시트 데이터 업데이트
         */
        updateSheetDataWithStyles(sheet, data, originalSheet) {
            try {
                let stylesCopied = 0;
                let cellsUpdated = 0;
                
                // 데이터의 각 행을 순회하면서 셀 값만 업데이트
                for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
                    const row = data[rowIndex];
                    
                    for (let colIndex = 0; colIndex < row.length; colIndex++) {
                        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                        const newValue = row[colIndex];
                        const originalCell = originalSheet[cellAddress];
                        
                        if (originalCell) {
                            // ⚠️ 스타일은 그대로 복사 (이미 fill 변환 완료)
                            const updatedCell = {
                                v: newValue,
                                w: String(newValue),
                                t: typeof newValue === 'number' ? 'n' : 's',
                                z: originalCell.z
                            };
                            
                            // h 속성 복사 (HTML 렌더링)
                            if (originalCell.h) {
                                updatedCell.h = originalCell.h;
                            }
                            
                            // ✅ 스타일을 그대로 복사 (절대 변환하지 않음!)
                            if (originalCell.s) {
                                updatedCell.s = originalCell.s;  // 그대로 복사
                                stylesCopied++;
                            }
                            
                            sheet[cellAddress] = updatedCell;
                            cellsUpdated++;
                        } else {
                            // 원본 셀이 없으면 새로 생성
                            sheet[cellAddress] = {
                                v: newValue,
                                w: String(newValue),
                                t: typeof newValue === 'number' ? 'n' : 's'
                            };
                            cellsUpdated++;
                        }
                    }
                }
                
                // 범위 업데이트
                const range = XLSX.utils.encode_range({
                    s: { r: 0, c: 0 },
                    e: { r: data.length - 1, c: Math.max(...data.map(row => row.length)) - 1 }
                });
                sheet['!ref'] = range;
                
                console.log(`✅ 스타일 보존 업데이트 완료:`, {
                    범위: range,
                    업데이트셀수: cellsUpdated,
                    스타일복사수: stylesCopied
                });
                
                // A1 셀 최종 확인
                if (sheet['A1']) {
                    console.log('🔍 A1 셀 최종 상태:', {
                        값: sheet['A1'].v,
                        스타일: sheet['A1'].s
                    });
                }
            } catch (error) {
                console.error('❌ 스타일 보존 업데이트 실패:', error);
            }
        },

        /**
         * 스타일을 xlsx-js-style 포맷으로 변환
         * @param {Object} style - 원본 스타일 객체
         * @param {String} rAttr - 셀의 r 속성 (폰트 정보 포함)
         */
        convertStyleToXlsxJsStyle(style, rAttr) {
            if (!style) return undefined;
            
            const xlsxStyle = {};
            
            // Fill (배경색) - 명확하게 필요한 속성만 추가
            if (style.fgColor || style.bgColor || style.patternType) {
                xlsxStyle.fill = {
                    patternType: style.patternType || 'solid'
                };
                
                if (style.fgColor) {
                    xlsxStyle.fill.fgColor = {};
                    
                    // RGB 값 처리 - 반드시 6자리로
                    if (style.fgColor.rgb) {
                        let rgb = String(style.fgColor.rgb).toUpperCase();
                        console.log(`🔍 RGB 변환: 원본="${style.fgColor.rgb}" → 대문자="${rgb}"`);
                        
                        // FF로 시작하는 8자리면 FF 제거
                        if (rgb.length === 8 && rgb.startsWith('FF')) {
                            rgb = rgb.substring(2);
                            console.log(`✂️ FF 제거: "${rgb}"`);
                        }
                        
                        // 최종 RGB 값 설정
                        xlsxStyle.fill.fgColor.rgb = rgb;
                        console.log(`✅ 최종 RGB 설정: "${xlsxStyle.fill.fgColor.rgb}"`);
                    }
                    
                    // theme 속성이 있으면 복사
                    if (style.fgColor.theme !== undefined) {
                        xlsxStyle.fill.fgColor.theme = style.fgColor.theme;
                    }
                }
                
                // bgColor는 indexed 64 제외 (문자열/숫자 둘 다 체크)
                if (style.bgColor && 
                    style.bgColor.indexed != 64 && 
                    style.bgColor.indexed !== "64") {
                    xlsxStyle.fill.bgColor = { ...style.bgColor };
                }
            }
            
            // Font (폰트) - fill 색상으로 CellXf를 찾아서 fontId 가져오기
            if (style.font) {
                // 원본에 font가 직접 있으면 사용
                xlsxStyle.font = JSON.parse(JSON.stringify(style.font));
            } else if (this.originalWorkbook && this.originalWorkbook.Styles) {
                const cellXf = this.originalWorkbook.Styles.CellXf;
                const fonts = this.originalWorkbook.Styles.Fonts;
                const fills = this.originalWorkbook.Styles.Fills;
                
                // 현재 스타일의 fgColor로 Fills 배열에서 fillId 찾기
                let fillId = 0; // 기본값
                if (style.fgColor && style.fgColor.rgb && fills) {
                    for (let i = 0; i < fills.length; i++) {
                        if (fills[i].fgColor && fills[i].fgColor.rgb === style.fgColor.rgb) {
                            fillId = i;
                            console.log(`🎨 Fill 색상 "${style.fgColor.rgb}" → Fills[${i}]`);
                            break;
                        }
                    }
                }
                
                // fillId를 사용하고 applyFont가 true인 CellXf 찾기
                if (cellXf && fonts) {
                    for (let i = 0; i < cellXf.length; i++) {
                        const xf = cellXf[i];
                        const xfFillId = xf.fillId || xf.fillid || 0;
                        
                        // fillId가 일치하고 applyFont가 true인 것 찾기
                        if (xfFillId == fillId && (xf.applyFont === true || xf.applyfont === "1")) {
                            const fontId = xf.fontId || xf.fontid || 0;
                            if (fonts[fontId]) {
                                xlsxStyle.font = JSON.parse(JSON.stringify(fonts[fontId]));
                                console.log(`📝 CellXf[${i}] (fillId:${fillId}, applyFont:true) → Font[${fontId}]:`, xlsxStyle.font);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Border (테두리)
            if (style.border) {
                xlsxStyle.border = JSON.parse(JSON.stringify(style.border));
            }
            
            // Alignment (정렬)
            if (style.alignment) {
                xlsxStyle.alignment = JSON.parse(JSON.stringify(style.alignment));
            }
            
            // Number Format
            if (style.numFmt) {
                xlsxStyle.numFmt = style.numFmt;
            }
            
            return xlsxStyle;
        },
        
        /**
         * 시트별 열 너비 설정
         */
        setColumnWidths(sheet, sheetName) {
            if (sheetName === '1.프로세스정보') {
                sheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
            } else if (sheetName === '2.프로세스변수') {
                sheet['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 15 }];
            } else if (sheetName === '3.역할(Lane)') {
                sheet['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
            } else if (sheetName === '4.액티비티') {
                sheet['!cols'] = [
                    { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 40 },
                    { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 35 }, { wch: 35 }, 
                    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
                ];
            } else if (sheetName === '5.이벤트') {
                sheet['!cols'] = [
                    { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 30 },
                    { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
                ];
            } else if (sheetName === '6.게이트웨이') {
                sheet['!cols'] = [
                    { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 30 },
                    { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
                ];
            } else if (sheetName === '7.시퀀스(흐름)') {
                sheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 50 }];
            } else if (sheetName === '8.서브프로세스') {
                sheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 50 }, { wch: 20 }];
            }
        },

        /**
         * 프로세스 정보 데이터 생성
         */
        createProcessInfoData(processDefinition) {
            return [
                ['항목', '내용'],
                ['Mega Process ID', processDefinition.megaProcessId || ''],
                ['Major Process ID', processDefinition.majorProcessId || ''],
                ['프로세스 ID', processDefinition.processDefinitionId || ''],
                ['프로세스 이름', processDefinition.processDefinitionName || ''],
                ['설명', processDefinition.description || ''],
                ['수평 레이아웃', processDefinition.isHorizontal ? '예' : '아니오'],
                ['자동 레이아웃', processDefinition.isAutoLayout ? '예' : '아니오'],
                ['생성일', new Date().toLocaleDateString('ko-KR')]
            ];
        },

        /**
         * 프로세스 변수 데이터 생성
         */
        createDataSheetData(processDefinition) {
            const data = [['변수명', '설명', '타입']];
            processDefinition.data.forEach(variable => {
                data.push([
                    variable.name || '',
                    variable.description || '',
                    variable.type || ''
                ]);
            });
            return data;
        },

        /**
         * 실제 사용된 역할만 필터링
         */
        getFilteredRoles(processDefinition) {
            const usedRoles = new Set();
            
            if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                processDefinition.elements.forEach(element => {
                    if (element.role) usedRoles.add(element.role);
                });
            } else {
                if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                    processDefinition.activities.forEach(activity => {
                        if (activity.role) usedRoles.add(activity.role);
                    });
                }
                if (processDefinition.events && Array.isArray(processDefinition.events)) {
                    processDefinition.events.forEach(event => {
                        if (event.role) usedRoles.add(event.role);
                    });
                }
                if (processDefinition.gateways && Array.isArray(processDefinition.gateways)) {
                    processDefinition.gateways.forEach(gateway => {
                        if (gateway.role) usedRoles.add(gateway.role);
                    });
                }
            }
            
            return processDefinition.roles.filter(role => usedRoles.has(role.name));
        },

        /**
         * 역할 데이터 생성
         */
        createRolesData(roles) {
            const data = [['역할 이름', 'Endpoint', '담당 업무', 'X좌표', 'Y좌표', '너비', '높이']];
            roles.forEach(role => {
                data.push([
                    role.name || '',
                    role.endpoint || '',
                    role.resolutionRule || '',
                    role.boundary?.minX || '',
                    role.boundary?.minY || '',
                    role.boundary?.width || '',
                    role.boundary?.height || ''
                ]);
            });
            return data;
        },

        /**
         * 액티비티 데이터 생성
         */
        createActivitiesData(activities) {
            const data = [[
                'ID', '이름', '타입', '역할', '설명', '지시사항', 
                '소요시간(일)', '체크포인트', '입력데이터', '출력데이터', 
                '도구(tool)', '시스템(system)', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이'
            ]];
            
            activities.forEach(activity => {
                let parsedProps = {};
                if (activity.properties && typeof activity.properties === 'string') {
                    try {
                        parsedProps = JSON.parse(activity.properties);
                    } catch (e) {
                        console.warn('properties 파싱 실패:', e);
                    }
                }

                const checkpoints = activity.checkpoints || parsedProps.checkpoints || [];
                const description = activity.description || parsedProps.description || '';

                data.push([
                    activity.id || '',
                    activity.name || '',
                    activity.type || '',
                    activity.role || parsedProps.role || '',
                    description,
                    activity.instruction || '',
                    activity.duration || '',
                    Array.isArray(checkpoints) ? checkpoints.join(', ') : '',
                    Array.isArray(activity.inputData) ? activity.inputData.join(', ') : '',
                    Array.isArray(activity.outputData) ? activity.outputData.join(', ') : '',
                    activity.tool || '',
                    activity.system || '',
                    activity.layer || '',
                    activity.order || '',
                    activity.x || '',
                    activity.y || '',
                    activity.width || '',
                    activity.height || ''
                ]);
            });
            
            return data;
        },

        /**
         * 이벤트 데이터 생성
         */
        createEventsData(events) {
            const data = [[
                'ID', '이름', '타입', '역할', '설명', '트리거', 
                'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이'
            ]];
            
            events.forEach(event => {
                let parsedProps = {};
                if (event.properties && typeof event.properties === 'string') {
                    try {
                        parsedProps = JSON.parse(event.properties);
                    } catch (e) {
                        console.warn('properties 파싱 실패:', e);
                    }
                }

                const description = event.description || parsedProps.description || '';

                data.push([
                    event.id || '',
                    event.name || '',
                    event.type || '',
                    event.role || '',
                    description,
                    event.trigger || '',
                    event.bpmnType || '',
                    event.layer || '',
                    event.order || '',
                    event.x || '',
                    event.y || '',
                    event.width || '',
                    event.height || ''
                ]);
            });
            
            return data;
        },

        /**
         * 게이트웨이 데이터 생성
         */
        createGatewaysData(gateways) {
            const data = [[
                'ID', '이름', '타입', '역할', '설명', '조건', 
                'BPMN타입', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이'
            ]];
            
            gateways.forEach(gateway => {
                let parsedProps = {};
                if (gateway.properties && typeof gateway.properties === 'string') {
                    try {
                        parsedProps = JSON.parse(gateway.properties);
                    } catch (e) {
                        console.warn('properties 파싱 실패:', e);
                    }
                }

                const description = gateway.description || parsedProps.description || '';
                const condition = gateway.condition ? 
                    (typeof gateway.condition === 'object' ? JSON.stringify(gateway.condition) : gateway.condition) : '';

                data.push([
                    gateway.id || '',
                    gateway.name || '',
                    gateway.type || '',
                    gateway.role || '',
                    description,
                    condition,
                    gateway.bpmnType || '',
                    gateway.layer || '',
                    gateway.order || '',
                    gateway.x || '',
                    gateway.y || '',
                    gateway.width || '',
                    gateway.height || ''
                ]);
            });
            
            return data;
        },

        /**
         * 시퀀스 데이터 생성
         */
        createSequencesData(sequences) {
            const data = [['ID', '이름', '시작(Source)', '종료(Target)', '조건', 'Waypoints']];
            
            sequences.forEach(seq => {
                let parsedProps = {};
                if (seq.properties && typeof seq.properties === 'string') {
                    try {
                        parsedProps = JSON.parse(seq.properties);
                    } catch (e) {
                        console.warn('properties 파싱 실패:', e);
                    }
                }

                const waypoints = seq.waypoints && Array.isArray(seq.waypoints) 
                    ? seq.waypoints.map(wp => `(${wp.x},${wp.y})`).join(' → ')
                    : '';
                
                const condition = seq.condition || parsedProps.condition || '';
                const conditionStr = typeof condition === 'object' ? JSON.stringify(condition) : condition;

                data.push([
                    seq.id || '',
                    seq.name || '',
                    seq.source || '',
                    seq.target || '',
                    conditionStr,
                    waypoints
                ]);
            });
            
            return data;
        },

        /**
         * 서브프로세스 데이터 생성
         */
        createSubProcessesData(subProcesses) {
            const data = [['ID', '이름', '설명', '타입']];
            
            subProcesses.forEach(subProc => {
                data.push([
                    subProc.id || '',
                    subProc.name || '',
                    subProc.description || '',
                    subProc.type || ''
                ]);
            });
            
            return data;
        }
    }
};
</script>

<style scoped>
/* 트리뷰 카드 스타일 */
.tree-view-card {
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid #e0e0e0;
}

/* 채팅 컨테이너 스타일 */
.chat-container {
    height: 100%;
}

/* 프로세스 트리 스타일 */
.process-tree {
    user-select: none;
}

/* node-wrapper는 JavaScript에서 동적으로 cursor 설정 */

/* 선택 표시기 */
.node-indicator {
    width: 3px;
    height: 20px;
    margin-right: 8px;
    background-color: transparent;
    border-radius: 2px;
    transition: background-color 0.2s ease;
}

.node-indicator.selected-indicator {
    background-color: #1976d2;
}

/* 선택된 노드의 input-wrapper 스타일 */
.process-tree :deep(.selected-indicator ~ .input-wrapper) {
    font-weight: 600 !important;
    color: #1976d2 !important;
    background-color: rgba(25, 118, 210, 0.08) !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    margin-left: 0 !important;
}

/* checkbox가 있을 경우 */
.process-tree :deep(.selected-indicator ~ .checkbox-wrapper ~ .input-wrapper) {
    font-weight: 600 !important;
    color: #1976d2 !important;
    background-color: rgba(25, 118, 210, 0.08) !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
}

/* 트리 노드 텍스트 스타일 */
.tree-node-text {
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    width: 100%;
}

/* Sub 프로세스는 클릭 가능 */
.tree-node-text.is-sub {
    cursor: pointer;
}


.tree-node-text.is-sub:hover {
    background-color: rgba(25, 118, 210, 0.08);
    color: #1976d2;
}

/* 스크롤바 스타일 */
.tree-view-card::-webkit-scrollbar {
    width: 6px;
}

.tree-view-card::-webkit-scrollbar-track {
    background: transparent;
}

.tree-view-card::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    border-radius: 3px;
}

.tree-view-card::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0;
}

/* 노드 래퍼를 flex로 설정하여 버튼 우측 정렬 */
.process-tree :deep(.node-wrapper) {
    min-height: 24px;
    display: flex;
    align-items: center;
}

/* 노드 액션 버튼 컨테이너 */
.process-tree :deep(.node-action-buttons) {
    display: inline-flex;
    gap: 4px;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.process-tree :deep(.node-wrapper:hover .node-action-buttons) {
    opacity: 1;
}

/* 노드 액션 버튼 스타일 */
.process-tree :deep(.node-action-btn) {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #ddd;
    background-color: #fff;
    color: #666;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.2s ease;
}

:deep(.input-wrapper) {
    margin-left: 4px !important;
}

/* 트리 계층 구조 라인 스타일 */
/* tree-level1, tree-level2 등 자식 ul에 적용 */
.process-tree :deep(ul[class*="tree-level"]) {
    position: relative;
    padding-left: 16px;
    overflow: visible;
}

/* 자식 노드 그룹에 수직 라인 추가 */
.process-tree :deep(ul[class*="tree-level"]::before) {
    content: '';
    position: absolute;
    left: 6px;
    top: -8px;
    bottom: 0;
    width: 1px;
    background-color: #cbd5e0;
}

/* 각 자식 노드에 수평 연결 라인 추가 */
.process-tree :deep(ul[class*="tree-level"] > li.tree-node) {
    position: relative;
}

.process-tree :deep(ul[class*="tree-level"] > li.tree-node::before) {
    content: '';
    position: absolute;
    left: -10px;
    top: 10px;
    width: 20px;
    height: 1px;
    background-color: #cbd5e0;
}

/* 마지막 자식 노드의 수직 라인 조정 */
.process-tree :deep(ul[class*="tree-level"] > li.tree-node:last-child::after) {
    content: '';
    position: absolute;
    left: -10px;
    top: 10px;
    bottom: 0;
    width: 1px;
    background-color: #fff;
    z-index: 1;
}

/* 노드 wrapper에 배경색 추가 (라인이 뒤로 가도록) */
.process-tree :deep(.node-wrapper) {
    position: relative;
    z-index: 2;
    background-color: #fff;
}

/* icon-wrapper 영역을 좁게 조정 */
.process-tree :deep(.icon-wrapper) {
    position: relative;
    z-index: 1;
    width: 12px !important;
    min-width: 12px !important;
}

</style>

