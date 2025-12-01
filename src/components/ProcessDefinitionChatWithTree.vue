<template>
    <div>
        <v-row class="ma-0 pa-0 process-definition-chat-tree-box">
            <!-- 왼쪽: TreeView -->
            <v-col v-if="isTreeViewVisible" cols="12" class="pa-0 tree-view-container" :style="{ width: treeViewWidth + 'px', maxWidth: treeViewWidth + 'px', flexBasis: treeViewWidth + 'px' }">
                <v-card elevation="10" class="pa-3 tree-view-card">
                    <v-row class="ma-0 pa-0">
                        <v-card-title class="ma-0 pa-0">
                            <v-icon class="mr-2" size="20">mdi-file-tree</v-icon>
                            {{ $t('ProcessDefinitionChatWithTree.processHierarchy') }}
                        </v-card-title>
                        <v-spacer></v-spacer>
                        
                        <div class="d-flex ga-2">
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn 
                                        v-bind="props"
                                        @click="handleMegaAddAction"
                                        icon
                                        variant="text"
                                        class="mega-add-btn"
                                    >
                                        <Icons icon="plus" :size="12" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('ProcessDefinitionChatWithTree.addMegaProcess') }}</span>
                            </v-tooltip>
                        </div>
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

                    <!-- 리사이즈 핸들 - 트리뷰 카드 내부 우측에 배치 -->
                    <div
                        class="resize-handle"
                        @mousedown="startResize"
                    ></div>
                </v-card>
            </v-col>

            <!-- 오른쪽: ProcessDefinitionChat -->
            <v-col cols="12" class="pa-0 chat-container" :style="{ width: isTreeViewVisible ? `calc(100% - ${treeViewWidth}px)` : '100%', maxWidth: isTreeViewVisible ? `calc(100% - ${treeViewWidth}px)` : '100%', flexBasis: isTreeViewVisible ? `calc(100% - ${treeViewWidth}px)` : '100%' }">
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
                    @process-definition-updated="handleProcessDefinitionUpdated"
                    @upload-excel-to-storage="handleUploadExcelToStorage"
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

        <!-- Mega 추가/수정 및 Major 추가/수정용 간단한 다이얼로그 -->
        <v-dialog v-model="processDialog" max-width="500" persistent 
            v-else-if="processDialog && (processDialogMode === 'update' || (processDialogMode === 'add' && currentNodeType === 'mega' || currentNodeType === 'root'))">
            <v-card>
                <v-card-title class="pa-4">
                    <span v-if="processDialogMode === 'add'">
                        {{ currentNodeType === 'root' ? $t('ProcessDefinitionChatWithTree.addMegaProcess') : 
                           currentNodeType === 'major' ? $t('ProcessDefinitionChatWithTree.addMajorProcess') : 
                           $t('ProcessDefinitionChatWithTree.addMajorProcess') }}
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
import ExcelJS from 'exceljs';
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
        // 트리뷰 너비 (픽셀)
        treeViewWidth: 350,
        // 리사이즈 중 여부
        isResizing: false,
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
        
        // 저장된 트리뷰 너비 불러오기
        try {
            const savedWidth = localStorage.getItem('processTreeViewWidth');
            if (savedWidth) {
                this.treeViewWidth = parseInt(savedWidth, 10);
            }
        } catch (error) {
            console.error('트리뷰 너비 불러오기 실패:', error);
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
        
        // 리사이즈 이벤트 리스너 등록
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

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
        },
        // 트리뷰 표시 상태 변경 감지
        isTreeViewVisible: {
            handler(newValue) {
                if (newValue) {
                    // 트리뷰가 다시 보일 때 클릭 이벤트 재부착
                    console.log('🔄 트리뷰 다시 표시 - 클릭 이벤트 재부착');
                    this.$nextTick(() => {
                        this.attachNodeClickEvents();
                    });
                }
            }
        }
    },
    beforeUnmount() {
        // 리사이즈 이벤트 리스너 제거
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
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
         * Mega 프로세스 추가 액션 핸들러 (트리 상단 버튼)
         */
        handleMegaAddAction() {
            this.processDialogMode = 'add';
            this.currentNodeType = 'root';
            this.currentNode = null; // Mega는 최상위이므로 부모 노드 없음
            this.processForm = { id: '', name: '' };
            this.processDialog = true;
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
                const parentId = this.currentNode?.data?.originalId;

                // processDefinitionMap이 없으면 초기화
                if (!this.processDefinitionMap) {
                    this.processDefinitionMap = {
                        mega_proc_list: []
                    };
                }
                if (!this.processDefinitionMap.mega_proc_list) {
                    this.processDefinitionMap.mega_proc_list = [];
                }

                if (parentType === 'root' && !parentId) {
                    // Mega 프로세스 추가 (최상위)
                    const megaId = newProcess.id || this.generateUniqueId();
                    const megaProcess = {
                        id: megaId,
                        name: newProcess.name,
                        major_proc_list: []
                    };
                    this.processDefinitionMap.mega_proc_list.push(megaProcess);
                } else if (parentType === 'mega' && parentId) {
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
                
                // processDefinitionMap이 없거나 mega_proc_list가 없으면 초기화
                if (!this.processDefinitionMap) {
                    this.processDefinitionMap = {
                        mega_proc_list: []
                    };
                }
                if (!this.processDefinitionMap.mega_proc_list) {
                    this.processDefinitionMap.mega_proc_list = [];
                }
                
                if (this.processDefinitionMap.mega_proc_list) {
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
                // 에러 발생 시에도 빈 구조로 초기화
                this.processDefinitionMap = {
                    mega_proc_list: []
                };
                this.convertToVue3TreeviewFormat([]);
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
         * 리사이즈 시작
         */
        startResize() {
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        },

        /**
         * 마우스 이동 처리 (리사이즈)
         */
        handleMouseMove(e) {
            if (!this.isResizing) return;

            const minWidth = 250;
            const maxWidth = window.innerWidth * 0.5; // 화면의 50%까지
            const newWidth = e.clientX;

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                this.treeViewWidth = newWidth;
            }
        },

        /**
         * 마우스 업 처리 (리사이즈 종료)
         */
        handleMouseUp() {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // 트리뷰 너비 저장
                try {
                    localStorage.setItem('processTreeViewWidth', this.treeViewWidth.toString());
                } catch (error) {
                    console.error('트리뷰 너비 저장 실패:', error);
                }
            }
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
         * Supabase Storage에 엑셀 파일 업로드
         * @returns {Promise<string|null>} 업로드된 파일의 공개 URL 또는 null
         */
        async uploadExcelToStorage() {
            try {
                if (!this.selectedFile) {
                    console.log('⚠️ 업로드할 파일이 없습니다.');
                    return null;
                }

                console.log('📤 Supabase Storage에 엑셀 파일 업로드 시작:', this.selectedFile.name);

                // 파일명 생성: 타임스탬프 + 원본 파일명
                const timestamp = Date.now();
                const sanitizedFileName = this.selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storageFileName = `${timestamp}_${sanitizedFileName}`;

                // Supabase Storage에 업로드
                const { data, error } = await window.$supabase.storage
                    .from('excel-templates')
                    .upload(storageFileName, this.selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    console.error('❌ Supabase Storage 업로드 실패:', error);
                    throw error;
                }

                console.log('✅ Supabase Storage 업로드 성공:', data);

                // 공개 URL 가져오기
                const { data: publicUrlData } = window.$supabase.storage
                    .from('excel-templates')
                    .getPublicUrl(storageFileName);

                const publicUrl = publicUrlData.publicUrl;
                console.log('🔗 엑셀 파일 공개 URL:', publicUrl);

                return publicUrl;

            } catch (error) {
                console.error('❌ 엑셀 파일 업로드 중 오류:', error);
                alert(`엑셀 파일 업로드 실패: ${error.message}`);
                return null;
            }
        },

        /**
         * emit으로 받은 엑셀 업로드 요청 처리
         * @param {Function} callback - 결과를 전달할 콜백 함수
         */
        async handleUploadExcelToStorage(callback) {
            try {
                const excelTemplateUrl = await this.uploadExcelToStorage();
                // 콜백 함수를 통해 결과 전달
                if (callback && typeof callback === 'function') {
                    callback(excelTemplateUrl);
                }
            } catch (error) {
                console.error('❌ handleUploadExcelToStorage 오류:', error);
                // 에러 발생 시 null 전달
                if (callback && typeof callback === 'function') {
                    callback(null);
                }
            }
        },

        /**
         * URL에서 엑셀 파일을 로드하여 originalWorkbook에 저장
         * @param {string} url - 엑셀 파일 URL
         * @returns {Promise<boolean>} 로드 성공 여부
         */
        async loadExcelFromUrl(url) {
            try {
                console.log('📥 URL에서 엑셀 파일 로드 시작:', url);

                // URL에서 파일 다운로드
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const blob = await response.blob();
                console.log('✅ 파일 다운로드 완료, 크기:', blob.size, 'bytes');

                // Blob을 ArrayBuffer로 변환
                const arrayBuffer = await blob.arrayBuffer();

                // ExcelJS로 파싱 (스타일 포함)
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(arrayBuffer);

                console.log('✅ 엑셀 파싱 완료');
                const sheetNames = workbook.worksheets.map(ws => ws.name);
                console.log('📋 시트 목록:', sheetNames);

                // originalWorkbook에 저장
                this.originalWorkbook = workbook;
                this.originalWorkbookInfo = {
                    fileName: url.split('/').pop() || 'template.xlsx',
                    sheetNames: sheetNames,
                    sheetCount: workbook.worksheets.length
                };

                console.log('💾 원본 엑셀 형식 저장 완료:', this.originalWorkbookInfo);

                return true;

            } catch (error) {
                console.error('❌ URL에서 엑셀 파일 로드 실패:', error);
                return false;
            }
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
         * ExcelJS를 사용하여 엑셀 파싱
         */
        parseWithXLSX(file) {
            return new Promise(async (resolve, reject) => {
                try {
                    const startTime = Date.now();
                    
                    console.log('📄 파일 크기:', file.size, 'bytes');
                    console.log('📦 ExcelJS 라이브러리:', ExcelJS);
                    
                    // ArrayBuffer로 읽기
                    const arrayBuffer = await file.arrayBuffer();
                    console.log('📄 ArrayBuffer 크기:', arrayBuffer.byteLength, 'bytes');
                    
                    // ExcelJS로 워크북 로드
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(arrayBuffer);
                    
                    const elapsed = (Date.now() - startTime) / 1000;
                    console.log(`⏱️ ExcelJS 파싱 시간: ${elapsed.toFixed(2)}초`);
                    console.log('📦 워크북 객체:', workbook);
                    
                    // 워크북 유효성 검증
                    if (!workbook) {
                        console.error('❌ 워크북이 null입니다.');
                        resolve({
                            success: false,
                            error: '엑셀 파일을 읽을 수 없습니다.'
                        });
                        return;
                    }
                    
                    if (!workbook.worksheets || !Array.isArray(workbook.worksheets)) {
                        console.error('❌ worksheets가 없습니다:', workbook);
                        resolve({
                            success: false,
                            error: '엑셀 파일 형식이 올바르지 않습니다.'
                        });
                        return;
                    }
                    
                    if (workbook.worksheets.length === 0) {
                        console.error('❌ 시트가 없습니다.');
                        resolve({
                            success: false,
                            error: '엑셀 파일에 시트가 없습니다.'
                        });
                        return;
                    }
                    
                    console.log('✅ 워크북 유효성 검증 완료');
                    console.log('📋 시트 수:', workbook.worksheets.length);
                    
                    // 원본 워크북 저장
                    this.originalWorkbook = workbook;
                    
                    // 시트 이름 목록 추출
                    const sheetNames = workbook.worksheets.map(ws => ws.name);
                    
                    // 원본 구조 정보 저장
                    this.originalWorkbookInfo = {
                        sheetNames: [...sheetNames],
                        fileName: file.name,
                        uploadDate: new Date().toISOString(),
                        sheetCount: workbook.worksheets.length
                    };
                    
                    console.log('💾 원본 엑셀 형식 저장 완료:', this.originalWorkbookInfo);
                    
                    // 스타일 정보 로드 확인 (디버깅용)
                    console.log('✅ Worksheets 확인 완료');
                    
                    if (workbook.worksheets.length > 0) {
                        const firstSheet = workbook.worksheets[0];
                        const firstSheetName = firstSheet.name;
                        
                        console.log('📋 첫 번째 시트:', firstSheetName);
                        
                        // A1 셀 확인
                        const cellA1 = firstSheet.getCell('A1');
                        console.log('🔍 A1 셀 상세:', {
                            값: cellA1.value,
                            스타일: cellA1.style,
                            폰트: cellA1.font,
                            채우기: cellA1.fill,
                            테두리: cellA1.border
                        });
                        
                        // 열 너비 정보
                        console.log('📏 열 정보:', {
                            열수: firstSheet.columnCount,
                            행수: firstSheet.rowCount
                        });
                    }
                    
                    // 모든 시트의 데이터를 추출
                    const result = {};
                    
                    for (let i = 0; i < workbook.worksheets.length; i++) {
                        const worksheet = workbook.worksheets[i];
                        const sheetName = worksheet.name;
                        
                        try {
                            if (!worksheet) {
                                console.warn(`⚠️ 시트 "${sheetName}"를 찾을 수 없습니다.`);
                                continue;
                            }
                            
                            // 시트를 배열 형태로 변환
                            const jsonArray = [];
                            worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                                const rowData = [];
                                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                    // ExcelJS는 formula 결과값이 있으면 result, 없으면 value 사용
                                    let cellValue = cell.value;
                                    if (cellValue && typeof cellValue === 'object') {
                                        // formula, richText 등 복잡한 객체 처리
                                        if (cellValue.result !== undefined) {
                                            cellValue = cellValue.result;
                                        } else if (cellValue.richText) {
                                            cellValue = cellValue.richText.map(t => t.text).join('');
                                        } else if (cellValue.text) {
                                            cellValue = cellValue.text;
                                        }
                                    }
                                    rowData[colNumber - 1] = cellValue !== null && cellValue !== undefined ? cellValue : '';
                                });
                                jsonArray.push(rowData);
                            });
                            
                            // 시트를 객체 배열 형태로 변환 (헤더 기반)
                            const jsonObjects = [];
                            if (jsonArray.length > 1) {
                                const headers = jsonArray[0];
                                for (let r = 1; r < jsonArray.length; r++) {
                                    const row = jsonArray[r];
                                    const obj = {};
                                    let hasData = false;
                                    for (let c = 0; c < headers.length; c++) {
                                        if (row[c] !== null && row[c] !== undefined && row[c] !== '') {
                                            obj[headers[c]] = row[c];
                                            hasData = true;
                                        }
                                    }
                                    if (hasData) {
                                        jsonObjects.push(obj);
                                    }
                                }
                            }
                            
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
                        sheetNames: sheetNames,
                        sheetCount: workbook.worksheets.length,
                        workbook: workbook
                    });
                    
                } catch (parseError) {
                    console.error('❌ ExcelJS 파싱 중 오류:', parseError);
                    console.error('오류 스택:', parseError.stack);
                    resolve({
                        success: false,
                        error: `파싱 오류: ${parseError.message}`
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
        async toggleFlowView(type) {
            const chatComponent = this.$refs.processDefinitionChat;
            
            if (!this.showFlowOverlay || (type == 'flow' && !chatComponent.isConsultingMode)) {
                // Flow 뷰 열기
                if (chatComponent && chatComponent.processDefinition) {
                    // BPMN 맵에서 변경된 내용이 있을 수 있으므로 최신 BPMN을 processDefinition으로 변환
                    if (chatComponent.bpmn) {
                        try {
                            console.log('🔄 Flow 모드 전환 전 BPMN을 processDefinition으로 변환');
                            await chatComponent.changeBpmn(chatComponent.bpmn);
                        } catch (error) {
                            console.error('❌ BPMN to processDefinition 변환 오류:', error);
                        }
                    }
                    
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
         * processDefinition이 업데이트되면 Flow 다시 렌더링
         */
        handleProcessDefinitionUpdated(processDefinition) {
            // Flow가 열려있을 때만 업데이트
            if (this.showFlowOverlay && processDefinition) {
                console.log('🔄 프로세스 정의 업데이트 감지 - Flow 다시 렌더링');
                
                // 현재 프로세스 정의를 null로 설정한 후 다시 할당하여 강제 리렌더링
                this.currentProcessDefinitionForFlow = null;
                
                this.$nextTick(() => {
                    // 깊은 복사로 완전히 새로운 객체 생성
                    this.currentProcessDefinitionForFlow = JSON.parse(JSON.stringify(processDefinition));
                    console.log('✅ Flow 다시 렌더링 완료');
                });
            }
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
                
                let processDefinition = chatComponent.processDefinition;  // ✅ const → let으로 변경
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
                        element.issues = this.selectedFlowActivity.issues; // issue가 이슈
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
                        activity.issues = this.selectedFlowActivity.issues; // issue가 이슈
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

                    // ✅ BPMN Modeler를 통해 최신 XML 생성 (system, issues, requiredTime 포함)
                    let updatedBpmn = chatComponent.bpmn;
                    try {
                        // ✅ 방법 1: 먼저 processDefinition을 elements 구조로 변환
                        if (!processDefinition.elements && processDefinition.activities) {
                            console.log('🔄 예전 구조 감지 - elements 구조로 변환 시작');
                            
                            // convertOldFormatToElements 메서드 사용
                            if (chatComponent.convertOldFormatToElements) {
                                processDefinition = await chatComponent.convertOldFormatToElements(processDefinition);
                                console.log('✅ elements 구조 변환 완료');
                            }
                        }
                        
                        console.log('🔍 processDefinition 구조 확인:');
                        console.log('  - elements 타입:', Array.isArray(processDefinition.elements) ? '배열' : (typeof processDefinition.elements));
                        console.log('  - elements 개수:', Array.isArray(processDefinition.elements) ? processDefinition.elements.length : (processDefinition.elements ? Object.keys(processDefinition.elements).length : 0));
                        
                        // ✅ 방법 2: createBpmnXml로 XML 생성
                        if (chatComponent.createBpmnXml && processDefinition.elements) {
                            updatedBpmn = chatComponent.createBpmnXml(processDefinition, false);
                            console.log('✅ 최신 XML 생성 완료 (system, issues, requiredTime 포함)');
                        } else {
                            console.warn('⚠️ createBpmnXml 실패, 기존 BPMN 사용');
                        }
                    } catch (error) {
                        console.error('❌ XML 생성 중 오류:', error);
                        console.error('상세 스택:', error.stack);
                        // 오류 발생 시 기존 BPMN 사용
                    }

                    const info = {                   
                        name: chatComponent.processDefinition.processDefinitionName,                
                        type: "bpmn",
                        definition: processDefinition  // ✅ 변환된 processDefinition 사용
                    }
                    
                    // ✅ 새로 생성한 XML로 저장
                    await backend.putRawDefinition(updatedBpmn, chatComponent.processDefinition.processDefinitionId, info);
                    console.log('✅ 액티비티 업데이트 완료 (최신 XML 저장)');
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
                
                // 1단계: 현재 업로드된 엑셀 파일이 있는지 체크
                if (this.originalWorkbook && this.originalWorkbookInfo) {
                    console.log('🔄 [1단계] 업로드된 원본 엑셀 형식 기반으로 다운로드');
                    await this.downloadExcelWithOriginalFormat(processDefinition);
                    return;
                }

                // 2단계: processDefinition에 excel_template_url이 있는지 체크
                if (processDefinition.excel_template_url) {
                    console.log('🔄 [2단계] 저장된 엑셀 템플릿 URL에서 파일 불러오기:', processDefinition.excel_template_url);
                    const loaded = await this.loadExcelFromUrl(processDefinition.excel_template_url);
                    if (loaded) {
                        console.log('✅ 엑셀 템플릿 로드 완료, 원본 형식으로 다운로드');
                        await this.downloadExcelWithOriginalFormat(processDefinition);
                        return;
                    } else {
                        console.warn('⚠️ 엑셀 템플릿 로드 실패, 기본 양식으로 다운로드');
                    }
                }

                // 3단계: 위 둘 다 없으면 7개 시트 양식으로 다운로드
                console.log('🔄 [3단계] 기본 7개 시트 양식으로 다운로드');

                // 구조 판별: elements가 있으면 새로운 구조, 없으면 이전 구조
                const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements);
                const hasOldStructure = processDefinition.activities && Array.isArray(processDefinition.activities);
                
                console.log('📊 구조 타입:', hasElementsStructure ? 'Elements 구조' : 'Activities 분리 구조');

                // 워크북 생성 (ExcelJS)
                const workbook = new ExcelJS.Workbook();

                // 1. 프로세스 기본 정보 시트
                const processInfoSheet = workbook.addWorksheet('1.프로세스정보');
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
                processInfoSheet.addRows(processInfoData);
                processInfoSheet.getColumn(1).width = 20;
                processInfoSheet.getColumn(2).width = 50;

                // 2. 프로세스 변수(Data) 시트
                if (processDefinition.data && processDefinition.data.length > 0) {
                    const dataSheet = workbook.addWorksheet('2.프로세스변수');
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

                    dataSheet.addRows(dataSheetData);
                    dataSheet.getColumn(1).width = 20;  // 변수명
                    dataSheet.getColumn(2).width = 50;  // 설명
                    dataSheet.getColumn(3).width = 15;  // 타입
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
                        const rolesSheet = workbook.addWorksheet('3.역할(Lane)');
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

                        rolesSheet.addRows(rolesData);
                        rolesSheet.getColumn(1).width = 20;  // 역할 이름
                        rolesSheet.getColumn(2).width = 25;  // Endpoint
                        rolesSheet.getColumn(3).width = 40;  // 담당 업무
                        rolesSheet.getColumn(4).width = 10;  // X좌표
                        rolesSheet.getColumn(5).width = 10;  // Y좌표
                        rolesSheet.getColumn(6).width = 10;  // 너비
                        rolesSheet.getColumn(7).width = 10;  // 높이
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

                // ✅ 시퀀스 정보를 기반으로 액티비티 순서 정렬
                if (activities.length > 0) {
                    activities = this.sortActivitiesBySequence(activities, processDefinition);
                    const activitiesSheet = workbook.addWorksheet('4.액티비티');
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

                    activitiesSheet.addRows(activitiesData);
                    activitiesSheet.getColumn(1).width = 30;   // ID
                    activitiesSheet.getColumn(2).width = 25;   // 이름
                    activitiesSheet.getColumn(3).width = 15;   // 타입
                    activitiesSheet.getColumn(4).width = 15;   // 역할
                    activitiesSheet.getColumn(5).width = 40;   // 설명
                    activitiesSheet.getColumn(6).width = 40;   // 지시사항
                    activitiesSheet.getColumn(7).width = 12;   // 소요시간
                    activitiesSheet.getColumn(8).width = 30;   // 체크포인트
                    activitiesSheet.getColumn(9).width = 30;   // 입력데이터
                    activitiesSheet.getColumn(10).width = 30;  // 출력데이터
                    activitiesSheet.getColumn(11).width = 35;  // 도구(tool)
                    activitiesSheet.getColumn(12).width = 35;  // 시스템(system)
                    activitiesSheet.getColumn(13).width = 8;   // Layer
                    activitiesSheet.getColumn(14).width = 8;   // Order
                    activitiesSheet.getColumn(15).width = 8;   // X좌표
                    activitiesSheet.getColumn(16).width = 8;   // Y좌표
                    activitiesSheet.getColumn(17).width = 8;   // 너비
                    activitiesSheet.getColumn(18).width = 8;   // 높이
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
                    const eventsSheet = workbook.addWorksheet('5.이벤트');
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

                    eventsSheet.addRows(eventsData);
                    eventsSheet.getColumn(1).width = 30;   // ID
                    eventsSheet.getColumn(2).width = 25;   // 이름
                    eventsSheet.getColumn(3).width = 15;   // 타입
                    eventsSheet.getColumn(4).width = 15;   // 역할
                    eventsSheet.getColumn(5).width = 40;   // 설명
                    eventsSheet.getColumn(6).width = 30;   // 트리거
                    eventsSheet.getColumn(7).width = 20;   // BPMN타입
                    eventsSheet.getColumn(8).width = 8;    // Layer
                    eventsSheet.getColumn(9).width = 8;    // Order
                    eventsSheet.getColumn(10).width = 8;   // X좌표
                    eventsSheet.getColumn(11).width = 8;   // Y좌표
                    eventsSheet.getColumn(12).width = 8;   // 너비
                    eventsSheet.getColumn(13).width = 8;   // 높이
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
                    const gatewaysSheet = workbook.addWorksheet('6.게이트웨이');
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

                    gatewaysSheet.addRows(gatewaysData);
                    gatewaysSheet.getColumn(1).width = 30;   // ID
                    gatewaysSheet.getColumn(2).width = 25;   // 이름
                    gatewaysSheet.getColumn(3).width = 15;   // 타입
                    gatewaysSheet.getColumn(4).width = 15;   // 역할
                    gatewaysSheet.getColumn(5).width = 40;   // 설명
                    gatewaysSheet.getColumn(6).width = 30;   // 조건
                    gatewaysSheet.getColumn(7).width = 20;   // BPMN타입
                    gatewaysSheet.getColumn(8).width = 8;    // Layer
                    gatewaysSheet.getColumn(9).width = 8;    // Order
                    gatewaysSheet.getColumn(10).width = 8;   // X좌표
                    gatewaysSheet.getColumn(11).width = 8;   // Y좌표
                    gatewaysSheet.getColumn(12).width = 8;   // 너비
                    gatewaysSheet.getColumn(13).width = 8;   // 높이
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
                    const sequencesSheet = workbook.addWorksheet('7.시퀀스(흐름)');
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

                    sequencesSheet.addRows(sequencesData);
                    sequencesSheet.getColumn(1).width = 30;  // ID
                    sequencesSheet.getColumn(2).width = 30;  // 이름
                    sequencesSheet.getColumn(3).width = 30;  // 시작
                    sequencesSheet.getColumn(4).width = 30;  // 종료
                    sequencesSheet.getColumn(5).width = 40;  // 조건
                    sequencesSheet.getColumn(6).width = 50;  // Waypoints
                }

                // 8. SubProcesses 시트
                if (processDefinition.subProcesses && processDefinition.subProcesses.length > 0) {
                    const subProcessesSheet = workbook.addWorksheet('8.서브프로세스');
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

                    subProcessesSheet.addRows(subProcessesData);
                    subProcessesSheet.getColumn(1).width = 30;  // ID
                    subProcessesSheet.getColumn(2).width = 30;  // 이름
                    subProcessesSheet.getColumn(3).width = 50;  // 설명
                    subProcessesSheet.getColumn(4).width = 20;  // 타입
                }

                // 파일 이름 생성
                const fileName = `${processDefinition.processDefinitionName || 'process'}_${new Date().getTime()}.xlsx`;

                // ExcelJS로 엑셀 파일 생성 및 다운로드
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(url);

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
                    alert('원본 엑셀이 없습니다. 먼저 엑셀을 업로드해주세요.');
                    return;
                }
                
                console.log('📝 원본 워크북 기반 다운로드 시작');
                
                // ✅ ExcelJS Deep Clone (스타일 유지)
                // ExcelJS는 buffer로 serialize → 다시 load하여 완벽한 복사
                const cloneBuffer = await this.originalWorkbook.xlsx.writeBuffer();
                const workbookCopy = new ExcelJS.Workbook();
                await workbookCopy.xlsx.load(cloneBuffer);
                
                console.log('✅ 원본 워크북 복사 완료');
                console.log('📋 원본 시트 수:', workbookCopy.worksheets.length);
                
                // ExcelJS는 스타일을 자동으로 보존하므로 변환 불필요
                console.log('✅ ExcelJS는 스타일을 자동으로 보존합니다.');
                
                // ========== 시트 내용 업데이트 (ExcelJS는 스타일 자동 보존) ==========
                
                // 1️⃣ 첫 번째 시트 업데이트 (임의 구조 처리 - 헤더 찾아서 매핑)
                const firstSheet = workbookCopy.worksheets[0];
                if (firstSheet) {
                    console.log(`🔄 첫 번째 시트 내용 업데이트: ${firstSheet.name} (스타일 유지)`);
                    await this.updateOriginalSheetWithNewData(
                        firstSheet, 
                        processDefinition
                    );
                }
                
                console.log('✅ 첫 번째 시트 내용 업데이트 완료');
                
                // 2️⃣ 표준 시트들 업데이트 (원본에 있는 경우만!)
                const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements);
                
                // ✅ 원본에 표준 시트가 있는지 확인
                const sheetNames = workbookCopy.worksheets.map(ws => ws.name);
                const hasStandardSheets = sheetNames.some(name => 
                    ['1.프로세스정보', '2.프로세스변수', '3.역할(Lane)', '4.액티비티', '5.이벤트', '6.게이트웨이', '7.시퀀스(흐름)', '8.서브프로세스'].includes(name)
                );
                
                if (hasStandardSheets) {
                    console.log('📝 표준 시트 내용 업데이트 시작 (원본에 존재하는 시트만, 스타일 유지)');
                } else {
                    console.log('ℹ️ 임의 구조 엑셀 - 표준 시트 추가하지 않음');
                }
                
                // 1. 프로세스 정보 시트 (원본에 있을 때만)
                if (hasStandardSheets && sheetNames.includes('1.프로세스정보')) {
                    this.addOrUpdateSheet(workbookCopy, '1.프로세스정보', this.createProcessInfoData(processDefinition), false);
                }
                
                // 2. 프로세스 변수 시트 (원본에 있을 때만)
                if (hasStandardSheets && processDefinition.data && processDefinition.data.length > 0 && sheetNames.includes('2.프로세스변수')) {
                    this.addOrUpdateSheet(workbookCopy, '2.프로세스변수', this.createDataSheetData(processDefinition), false);
                }
                
                // 3. 역할(Lane) 시트 (원본에 있을 때만)
                if (hasStandardSheets && processDefinition.roles && processDefinition.roles.length > 0 && sheetNames.includes('3.역할(Lane)')) {
                    const filteredRoles = this.getFilteredRoles(processDefinition);
                    if (filteredRoles.length > 0) {
                        this.addOrUpdateSheet(workbookCopy, '3.역할(Lane)', this.createRolesData(filteredRoles), false);
                    }
                }
                
                // 4. 액티비티 시트 (원본에 있을 때만)
                if (hasStandardSheets && sheetNames.includes('4.액티비티')) {
                    let activities = [];
                    if (hasElementsStructure) {
                        activities = processDefinition.elements.filter(el => el.elementType === 'Activity');
                    } else if (processDefinition.activities && Array.isArray(processDefinition.activities)) {
                        activities = processDefinition.activities;
                    }
                    
                    // ✅ 시퀀스 정보를 기반으로 액티비티 순서 정렬
                    if (activities.length > 0) {
                        activities = this.sortActivitiesBySequence(activities, processDefinition);
                        this.addOrUpdateSheet(workbookCopy, '4.액티비티', this.createActivitiesData(activities), false);
                    }
                }
                
                // 5. 이벤트 시트 (원본에 있을 때만)
                if (hasStandardSheets && sheetNames.includes('5.이벤트')) {
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
                if (hasStandardSheets && sheetNames.includes('6.게이트웨이')) {
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
                if (hasStandardSheets && sheetNames.includes('7.시퀀스(흐름)')) {
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
                if (hasStandardSheets && processDefinition.subProcesses && processDefinition.subProcesses.length > 0 && sheetNames.includes('8.서브프로세스')) {
                    this.addOrUpdateSheet(workbookCopy, '8.서브프로세스', this.createSubProcessesData(processDefinition.subProcesses), false);
                }
                
                if (hasStandardSheets) {
                    console.log('✅ 표준 시트 내용 업데이트 완료');
                }
                
                // 파일 이름 생성 (원본 이름 기반)
                const originalName = this.originalWorkbookInfo.fileName.replace(/\.[^/.]+$/, '');
                const fileName = `${originalName}_updated_${new Date().getTime()}.xlsx`;
                
                // ExcelJS로 엑셀 파일 생성 및 다운로드
                console.log('💾 원본 엑셀 다운로드 시작...');
                console.log('📊 워크북 정보:', {
                    시트수: workbookCopy.worksheets.length,
                    시트명: workbookCopy.worksheets.map(ws => ws.name)
                });
                
                // ExcelJS는 스타일을 자동으로 포함하여 buffer 생성
                const downloadBuffer = await workbookCopy.xlsx.writeBuffer();
                const blob = new Blob([downloadBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(url);
                
                console.log('✅ 원본 형식 기반 엑셀 다운로드 완료:', fileName);
                
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
         * 원본 시트의 데이터만 업데이트 (ExcelJS 버전 - 형식은 완벽히 유지)
         */
        updateOriginalSheetWithNewData(worksheet, processDefinition) {
            try {
                console.log('📝 원본 시트 데이터 업데이트 시작 (ExcelJS)');
                
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
                
                // ✅ 시퀀스 정보를 기반으로 액티비티 순서 정렬
                activities = this.sortActivitiesBySequence(activities, processDefinition);
                console.log(`✅ 시퀀스 기반 정렬 완료: ${activities.length}개 액티비티`);
                
                // ExcelJS로 헤더 행 찾기
                let headerRowNum = -1;
                const maxRowsToCheck = Math.min(worksheet.rowCount, 50); // 처음 50행만 체크
                
                for (let rowNum = 1; rowNum <= maxRowsToCheck; rowNum++) {
                    const row = worksheet.getRow(rowNum);
                    if (!row || !row.values) continue;
                    
                    for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
                        const cell = row.getCell(colNum);
                        if (cell && cell.value) {
                            const cellValue = String(cell.value).trim().toLowerCase();
                            if (cellValue.includes('no') || 
                                cellValue.includes('activity') ||
                                cellValue.includes('담당')) {
                                headerRowNum = rowNum;
                                console.log(`✅ 헤더 행 찾음: ${headerRowNum}행`);
                                break;
                            }
                        }
                    }
                    if (headerRowNum !== -1) break;
                }
                
                if (headerRowNum === -1) {
                    console.warn('⚠️ 헤더 행을 찾을 수 없습니다.');
                    return;
                }
                
                // 헤더의 열 매핑 생성 (ExcelJS 방식)
                const columnMapping = this.createColumnMappingExcelJS(worksheet, headerRowNum);
                console.log('📋 열 매핑:', columnMapping);
                
                // ✅ 설명 행(Description Row) 감지 및 보존
                let firstDataRowNum = headerRowNum + 1;
                
                // 헤더 다음 행이 설명 행인지 확인 (※로 시작하거나 Activity명이 없는 경우)
                const potentialDescRow = worksheet.getRow(headerRowNum + 1);
                if (potentialDescRow && potentialDescRow.values) {
                    let isDescriptionRow = false;
                    let hasActivityName = false;
                    
                    // 첫 번째 셀이나 Activity 명 열을 확인
                    potentialDescRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
                        const cellValue = String(cell.value || '').trim();
                        
                        // ※나 특수 문자로 시작하면 설명 행
                        if (cellValue.startsWith('※') || cellValue.startsWith('*')) {
                            isDescriptionRow = true;
                        }
                        
                        // Activity명 열에 실제 액티비티 이름이 있는지 확인
                        if (colNum === columnMapping.activityName && cellValue !== '' && !cellValue.startsWith('※') && !cellValue.startsWith('*')) {
                            hasActivityName = true;
                        }
                    });
                    
                    // 설명 행 판정: ※로 시작하거나, Activity명이 없는 경우
                    if (isDescriptionRow || !hasActivityName) {
                        firstDataRowNum = headerRowNum + 2; // 설명 행 다음부터 데이터
                        console.log(`✅ 설명 행 발견: ${headerRowNum + 1}행 - 보존됨`);
                    }
                }
                
                console.log(`📊 실제 액티비티 데이터 시작: ${firstDataRowNum}행`);
                
                // 기존 데이터 행 찾기 (ExcelJS)
                let lastDataRowNum = firstDataRowNum;
                for (let rowNum = firstDataRowNum; rowNum <= worksheet.rowCount; rowNum++) {
                    const row = worksheet.getRow(rowNum);
                    if (!row || !row.values) continue;
                    
                    let hasData = false;
                    row.eachCell({ includeEmpty: false }, (cell) => {
                        if (cell.value && String(cell.value).trim() !== '') {
                            hasData = true;
                        }
                    });
                    
                    if (hasData) {
                        lastDataRowNum = rowNum;
                    } else if (rowNum > lastDataRowNum + 5) {
                        // 5행 연속 빈 행이면 중단
                        break;
                    }
                }
                
                console.log(`📊 기존 데이터 행: ${firstDataRowNum} ~ ${lastDataRowNum}`);
                
                // ✅ 템플릿 행의 스타일 보존 (마지막 데이터 행 사용)
                const templateRowNum = lastDataRowNum >= firstDataRowNum ? lastDataRowNum : firstDataRowNum;
                const templateRow = worksheet.getRow(templateRowNum);
                const templateStyles = {};
                
                if (templateRow) {
                    for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
                        const cell = templateRow.getCell(colNum);
                        if (cell && cell.style) {
                            // ExcelJS 스타일 복사 (deep clone)
                            templateStyles[colNum] = JSON.parse(JSON.stringify(cell.style));
                        }
                    }
                }
                console.log(`📋 템플릿 스타일 보존 완료: ${Object.keys(templateStyles).length}개 열`);
                
                // ✅ 액티비티 이름 정규화 함수 (특수문자, 공백 제거하고 소문자로)
                const normalizeActivityName = (name) => {
                    if (!name) return '';
                    return String(name)
                        .trim()
                        .replace(/[\s\(\)\[\]\{\}<>\/\-_,\.]/g, '') // 특수문자 제거
                        .toLowerCase();
                };
                
                // ✅ 기존 데이터 행을 읽어서 보존 (ExcelJS)
                const existingDataMap = new Map(); // key: 정규화된 액티비티 이름, value: 행 전체 데이터
                console.log(`📖 기존 데이터 행 읽기 시작: ${firstDataRowNum} ~ ${lastDataRowNum}`);
                
                for (let rowNum = firstDataRowNum; rowNum <= lastDataRowNum; rowNum++) {
                    const row = worksheet.getRow(rowNum);
                    if (!row || !row.values) continue;
                    
                    const rowData = {};
                    let activityName = '';
                    
                    // 해당 행의 모든 셀 데이터 읽기
                    for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
                        const cell = row.getCell(colNum);
                        if (cell) {
                            rowData[colNum] = {
                                value: cell.value,
                                style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : null,
                                type: cell.type
                            };
                            
                            // 액티비티 이름 열인 경우 키로 사용
                            if (colNum === columnMapping.activityName && cell.value) {
                                activityName = String(cell.value).trim();
                            }
                        }
                    }
                    
                    // 액티비티 이름이 있으면 Map에 저장 (정규화된 이름을 키로 사용)
                    if (activityName && activityName !== '') {
                        const normalizedName = normalizeActivityName(activityName);
                        existingDataMap.set(normalizedName, rowData);
                        console.log(`📝 기존 데이터 보존: "${activityName}" → 정규화: "${normalizedName}"`);
                    }
                }
                
                console.log(`✅ 기존 데이터 ${existingDataMap.size}개 보존 완료`);
                
                // ✅ 기존 데이터 행만 지우기 (필요한 만큼만)
                const maxRowsToClear = Math.max(lastDataRowNum - firstDataRowNum + 1, activities.length);
                console.log(`🗑️ 기존 행 임시 삭제 시작: ${firstDataRowNum} ~ ${firstDataRowNum + maxRowsToClear - 1}`);
                
                for (let rowNum = firstDataRowNum; rowNum < firstDataRowNum + maxRowsToClear; rowNum++) {
                    const row = worksheet.getRow(rowNum);
                    if (row) {
                        // 모든 셀 값 삭제 (나중에 복원 또는 새로 추가)
                        row.eachCell({ includeEmpty: true }, (cell) => {
                            cell.value = null;
                        });
                    }
                }
                console.log(`✅ 기존 행 임시 삭제 완료 (${maxRowsToClear}행)`);
                
                // ✅ 시퀀스 정보로 선행/후행 계산
                const activityIndexMap = new Map(); // activity.id -> index
                activities.forEach((activity, index) => {
                    activityIndexMap.set(activity.id, index);
                });
                
                // 시퀀스 정보 추출
                let sequences = [];
                if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                    sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence');
                } else if (processDefinition.sequences && Array.isArray(processDefinition.sequences)) {
                    sequences = processDefinition.sequences;
                }
                
                // 각 액티비티의 선행/후행 계산
                const predecessorMap = new Map(); // activity.id -> [predecessor indices]
                const successorMap = new Map(); // activity.id -> [successor indices]
                
                sequences.forEach(seq => {
                    if (seq.source && seq.target) {
                        const sourceIndex = activityIndexMap.get(seq.source);
                        const targetIndex = activityIndexMap.get(seq.target);
                        
                        // source가 activity이고 target도 activity인 경우만
                        if (sourceIndex !== undefined && targetIndex !== undefined) {
                            // target의 선행에 source 추가
                            if (!predecessorMap.has(seq.target)) {
                                predecessorMap.set(seq.target, []);
                            }
                            predecessorMap.get(seq.target).push(sourceIndex + 1); // 1-based index
                            
                            // source의 후행에 target 추가
                            if (!successorMap.has(seq.source)) {
                                successorMap.set(seq.source, []);
                            }
                            successorMap.get(seq.source).push(targetIndex + 1); // 1-based index
                        }
                    }
                });
                
                console.log('📊 선행/후행 계산 완료');
                
                // ✅ 디버깅: 저장된 액티비티 이름 목록 출력
                console.log('📋 저장된 정규화된 액티비티 이름 목록:', Array.from(existingDataMap.keys()));
                
                // ✅ ExcelJS로 정렬된 순서대로 액티비티 데이터 재배치
                activities.forEach((activity, index) => {
                    const rowNum = firstDataRowNum + index;
                    const activityName = activity.name || '';
                    const normalizedName = normalizeActivityName(activityName);
                    
                    console.log(`🔄 ${index + 1}번 액티비티 재배치: "${activityName}" (행 ${rowNum})`);
                    console.log(`   - 정규화된 이름: "${normalizedName}"`);
                    
                    const row = worksheet.getRow(rowNum);
                    const existingData = existingDataMap.get(normalizedName); // 정규화된 이름으로 검색
                    
                    // ✅ 디버깅: 매칭 결과 출력
                    if (existingData) {
                        console.log(`   ✅ 매칭 성공! 원본 데이터 있음`);
                    } else {
                        console.log(`   ❌ 매칭 실패! 원본 데이터 없음`);
                        console.log(`   - Map에 저장된 정규화된 키들:`, Array.from(existingDataMap.keys()).map(k => `"${k}"`));
                    }
                    
                    // 선행/후행 계산
                    const predecessors = predecessorMap.get(activity.id) || [];
                    const successors = successorMap.get(activity.id) || [];
                    const predecessorText = predecessors.length > 0 ? predecessors.join(', ') : '';
                    const successorText = successors.length > 0 ? successors.join(', ') : '';
                    
                    if (existingData) {
                        // ✅ 기존 데이터가 있으면 모든 셀 복원 (ExcelJS - 스타일 포함)
                        console.log(`  📦 기존 데이터 복원: "${activityName}"`);
                        
                        for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
                            const cellData = existingData[colNum];
                            if (cellData) {
                                const cell = row.getCell(colNum);
                                cell.value = cellData.value;
                                if (cellData.style) {
                                    cell.style = cellData.style;
                                }
                            }
                        }
                        
                        // ✅ 값이 있는 컬럼만 업데이트, 없으면 원본 유지
                        if (columnMapping.activityName && columnMapping.activityName !== -1) {
                            row.getCell(columnMapping.activityName).value = activityName;
                        }
                        
                        if (columnMapping.description && columnMapping.description !== -1 && activity.description) {
                            row.getCell(columnMapping.description).value = activity.description;
                        }
                        
                        if (columnMapping.system && columnMapping.system !== -1 && activity.system) {
                            row.getCell(columnMapping.system).value = activity.system;
                        }
                        
                        if (columnMapping.role && columnMapping.role !== -1 && activity.role) {
                            row.getCell(columnMapping.role).value = activity.role;
                        }
                        
                        // ✅ Input, Output 등도 값이 있으면 업데이트, 없으면 원본 유지
                        if (columnMapping.input && columnMapping.input !== -1) {
                            const inputValue = activity.input || (activity.inputData ? (Array.isArray(activity.inputData) ? activity.inputData.join(', ') : activity.inputData) : null);
                            if (inputValue) {
                                row.getCell(columnMapping.input).value = inputValue;
                            }
                        }
                        
                        if (columnMapping.output && columnMapping.output !== -1) {
                            const outputValue = activity.output || (activity.outputData ? (Array.isArray(activity.outputData) ? activity.outputData.join(', ') : activity.outputData) : null);
                            if (outputValue) {
                                row.getCell(columnMapping.output).value = outputValue;
                            }
                        }
                        
                        if (columnMapping.coreData && columnMapping.coreData !== -1 && activity.coreData) {
                            row.getCell(columnMapping.coreData).value = activity.coreData;
                        }
                        
                        if (columnMapping.participants && columnMapping.participants !== -1 && activity.participants) {
                            row.getCell(columnMapping.participants).value = activity.participants;
                        }
                        
                        if (columnMapping.no && columnMapping.no !== -1) {
                            row.getCell(columnMapping.no).value = index + 1;
                        }
                        
                        if (columnMapping.predecessor && columnMapping.predecessor !== -1) {
                            row.getCell(columnMapping.predecessor).value = predecessorText;
                        }
                        
                        if (columnMapping.successor && columnMapping.successor !== -1) {
                            row.getCell(columnMapping.successor).value = successorText;
                        }
                        
                    } else {
                        // ✅ 새로운 액티비티는 템플릿 스타일로 추가 (ExcelJS)
                        console.log(`  ✨ 새로운 액티비티 추가: "${activityName}"`);
                        
                        // 각 열에 데이터 설정
                        const setCellWithTemplate = (colNum, value) => {
                            if (!colNum || colNum === -1) return;
                            const cell = row.getCell(colNum);
                            cell.value = value;
                            if (templateStyles[colNum]) {
                                cell.style = templateStyles[colNum];
                            }
                        };
                        
                        setCellWithTemplate(columnMapping.no, index + 1);
                        setCellWithTemplate(columnMapping.activityName, activityName);
                        setCellWithTemplate(columnMapping.description, activity.description || '');
                        setCellWithTemplate(columnMapping.role, activity.role || '');
                        setCellWithTemplate(columnMapping.system, activity.system || '');
                        // ✅ Input, Output, 핵심 Data, 참여자수는 빈 값 (원본이 없으므로)
                        setCellWithTemplate(columnMapping.input, '');
                        setCellWithTemplate(columnMapping.output, '');
                        setCellWithTemplate(columnMapping.coreData, '');
                        setCellWithTemplate(columnMapping.participants, '');
                        setCellWithTemplate(columnMapping.predecessor, predecessorText);
                        setCellWithTemplate(columnMapping.successor, successorText);
                    }
                });
                
                console.log(`✅ ${activities.length}개 액티비티 업데이트 완료 (ExcelJS - 원본 스타일 유지)`);
                
                // ✅ 남은 빈 행 제거 (더 확실한 방법)
                const newLastDataRowNum = firstDataRowNum + activities.length - 1;
                const rowsToDelete = lastDataRowNum - newLastDataRowNum;
                
                if (rowsToDelete > 0) {
                    console.log(`🗑️ 빈 행 제거: ${newLastDataRowNum + 1}행부터 ${rowsToDelete}개 행 삭제`);
                    
                    // 방법 1: 역순으로 하나씩 삭제 (더 확실함)
                    for (let rowNum = lastDataRowNum; rowNum > newLastDataRowNum; rowNum--) {
                        const row = worksheet.getRow(rowNum);
                        if (row) {
                            // 모든 셀 값 제거
                            row.values = [];
                            // 행 높이도 제거
                            row.height = undefined;
                        }
                    }
                    
                    // 방법 2: spliceRows로 실제 행 삭제
                    worksheet.spliceRows(newLastDataRowNum + 1, rowsToDelete);
                    
                    console.log(`✅ 빈 행 ${rowsToDelete}개 제거 완료`);
                }
                
                // ✅ 테이블 범위 자동 조정 (ExcelJS Table 객체)
                console.log(`📊 테이블 객체 확인: worksheet.tables =`, worksheet.tables);
                
                if (worksheet.tables && worksheet.tables.length > 0) {
                    console.log(`📊 테이블 ${worksheet.tables.length}개 발견 - 범위 조정 시작`);
                    
                    worksheet.tables.forEach((table, index) => {
                        try {
                            // 테이블의 현재 범위 파싱
                            const tableRef = table.ref;
                            console.log(`  테이블 ${index + 1} 원본 범위: ${tableRef}`);
                            const match = tableRef.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
                            
                            if (match) {
                                const [, startCol, startRow, endCol, endRow] = match;
                                const tableStartRow = parseInt(startRow);
                                const tableEndRow = parseInt(endRow);
                                
                                console.log(`  테이블 ${index + 1}: ${tableRef} (${tableStartRow}~${tableEndRow}행)`);
                                console.log(`  헤더 행: ${headerRowNum}, 새 마지막 행: ${newLastDataRowNum}`);
                                
                                // 헤더 행이 테이블 범위 안에 있는지 확인
                                if (tableStartRow <= headerRowNum && tableEndRow >= headerRowNum) {
                                    // 새로운 테이블 범위 계산 (헤더 + 데이터 행)
                                    const newTableEndRow = newLastDataRowNum;
                                    
                                    if (newTableEndRow >= tableStartRow) {
                                        const newRef = `${startCol}${startRow}:${endCol}${newTableEndRow}`;
                                        console.log(`  ✏️ 테이블 범위 조정: ${tableRef} → ${newRef}`);
                                        table.ref = newRef;
                                        console.log(`  ✅ 테이블 범위 업데이트 완료`);
                                    } else {
                                        console.warn(`  ⚠️ 새 테이블 종료 행(${newTableEndRow})이 시작 행(${tableStartRow})보다 작음`);
                                    }
                                } else {
                                    console.log(`  ℹ️ 헤더 행(${headerRowNum})이 테이블 범위(${tableStartRow}~${tableEndRow}) 밖에 있음 - 스킵`);
                                }
                            } else {
                                console.warn(`  ⚠️ 테이블 범위 파싱 실패: ${tableRef}`);
                            }
                        } catch (tableError) {
                            console.error(`  ❌ 테이블 ${index + 1} 범위 조정 실패:`, tableError);
                        }
                    });
                    
                    console.log(`✅ 모든 테이블 범위 조정 완료`);
                } else {
                    console.log(`ℹ️ 테이블 없음 - 범위 조정 스킵`);
                }
                
            } catch (error) {
                console.error('❌ 원본 시트 업데이트 실패:', error);
                console.error('상세 오류:', error.stack);
            }
        },

        /**
         * 시퀀스 정보를 기반으로 액티비티를 정렬 (실제 그려진 순서대로)
         * @param {Array} activities - 정렬할 액티비티 배열
         * @param {Object} processDefinition - 프로세스 정의 객체
         * @returns {Array} 정렬된 액티비티 배열
         */
        sortActivitiesBySequence(activities, processDefinition) {
            try {
                // 시퀀스 정보 추출
                let sequences = [];
                if (processDefinition.elements && Array.isArray(processDefinition.elements)) {
                    sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence');
                } else if (processDefinition.sequences && Array.isArray(processDefinition.sequences)) {
                    sequences = processDefinition.sequences;
                }

                if (!sequences || sequences.length === 0) {
                    console.log('⚠️ 시퀀스 정보가 없어 원본 순서 유지');
                    return activities;
                }

                console.log(`📊 시퀀스 정보: ${sequences.length}개`);

                // 모든 노드 ID 수집 (events, activities, gateways)
                const allNodeIds = new Set();
                activities.forEach(act => allNodeIds.add(act.id));
                
                if (processDefinition.events) {
                    const events = Array.isArray(processDefinition.events) 
                        ? processDefinition.events 
                        : processDefinition.elements?.filter(el => el.elementType === 'Event') || [];
                    events.forEach(evt => allNodeIds.add(evt.id));
                }
                
                if (processDefinition.gateways) {
                    const gateways = Array.isArray(processDefinition.gateways)
                        ? processDefinition.gateways
                        : processDefinition.elements?.filter(el => el.elementType === 'Gateway') || [];
                    gateways.forEach(gw => allNodeIds.add(gw.id));
                }

                // 그래프 구조 생성 (인접 리스트)
                const graph = new Map();
                const inDegree = new Map();
                
                // 모든 노드 초기화
                allNodeIds.forEach(nodeId => {
                    graph.set(nodeId, []);
                    inDegree.set(nodeId, 0);
                });

                // 시퀀스로부터 그래프 간선 추가
                sequences.forEach(seq => {
                    if (seq.source && seq.target && allNodeIds.has(seq.source) && allNodeIds.has(seq.target)) {
                        graph.get(seq.source).push(seq.target);
                        inDegree.set(seq.target, (inDegree.get(seq.target) || 0) + 1);
                    }
                });

                // 시작 노드 찾기 (inDegree가 0인 노드들)
                const startNodes = Array.from(allNodeIds).filter(nodeId => inDegree.get(nodeId) === 0);
                
                if (startNodes.length === 0) {
                    console.log('⚠️ 시작 노드를 찾을 수 없어 원본 순서 유지');
                    return activities;
                }

                console.log(`📍 시작 노드: ${startNodes.length}개`, startNodes);

                // BFS를 통한 방문 순서 결정
                const visitOrder = new Map(); // nodeId -> 방문 순서 번호
                const queue = [...startNodes];
                const visited = new Set();
                let orderCounter = 0;

                // 시작 노드들의 순서 설정
                startNodes.forEach(nodeId => {
                    visitOrder.set(nodeId, orderCounter++);
                });

                while (queue.length > 0) {
                    const currentNodeId = queue.shift();
                    
                    if (visited.has(currentNodeId)) continue;
                    visited.add(currentNodeId);

                    // 다음 노드들을 큐에 추가
                    const neighbors = graph.get(currentNodeId) || [];
                    neighbors.forEach(nextNodeId => {
                        const currentInDegree = inDegree.get(nextNodeId) - 1;
                        inDegree.set(nextNodeId, currentInDegree);
                        
                        if (currentInDegree === 0 && !visited.has(nextNodeId)) {
                            if (!visitOrder.has(nextNodeId)) {
                                visitOrder.set(nextNodeId, orderCounter++);
                            }
                            queue.push(nextNodeId);
                        }
                    });
                }

                // 방문하지 못한 노드 처리 (순환이나 분리된 노드)
                allNodeIds.forEach(nodeId => {
                    if (!visitOrder.has(nodeId)) {
                        visitOrder.set(nodeId, orderCounter++);
                    }
                });

                console.log(`📋 방문 순서 결정 완료: ${visitOrder.size}개 노드`);

                // 액티비티만 필터링하여 순서대로 정렬
                const activityIds = activities.map(act => act.id);
                const orderedActivityIds = Array.from(visitOrder.entries())
                    .filter(([nodeId]) => activityIds.includes(nodeId))
                    .sort((a, b) => a[1] - b[1]) // 방문 순서로 정렬
                    .map(([nodeId]) => nodeId);

                console.log(`📊 정렬된 액티비티 ID 순서:`, orderedActivityIds);

                // 순서대로 액티비티 재배열
                const sortedActivities = [];
                orderedActivityIds.forEach(id => {
                    const activity = activities.find(act => act.id === id);
                    if (activity) {
                        sortedActivities.push(activity);
                    }
                });

                // 혹시 누락된 액티비티가 있다면 마지막에 추가
                activities.forEach(activity => {
                    if (!sortedActivities.find(act => act.id === activity.id)) {
                        sortedActivities.push(activity);
                    }
                });

                console.log(`✅ 액티비티 정렬 완료: ${sortedActivities.length}개`);
                return sortedActivities;

            } catch (error) {
                console.error('❌ 액티비티 정렬 중 오류:', error);
                console.error('상세 오류:', error.stack);
                // 오류 발생 시 원본 순서 반환
                return activities;
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
                instruction: -1,
                predecessor: -1,  // 선행 (선행자 수)
                successor: -1     // 후행 (후행자 수)
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
                    } else if (headerText.includes('선행') || headerText.includes('predecessor')) {
                        mapping.predecessor = col;
                    } else if (headerText.includes('후행') || headerText.includes('successor') || headerText.includes('라여자')) {
                        mapping.successor = col;
                    }
                }
            }
            
            return mapping;
        },

        /**
         * ExcelJS용 열 매핑 생성
         */
        createColumnMappingExcelJS(worksheet, headerRowNum) {
            const mapping = {
                no: -1,
                activityName: -1,
                description: -1,
                role: -1,
                input: -1,
                output: -1,
                system: -1,
                coreData: -1,        // 핵심 Data
                participants: -1,    // 참여자수
                predecessor: -1,
                successor: -1
            };
            
            const headerRow = worksheet.getRow(headerRowNum);
            if (!headerRow || !headerRow.values) return mapping;
            
            // 헤더 행의 모든 셀을 검사하여 각 열이 무엇인지 파악
            headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
                if (cell && cell.value) {
                    const headerText = String(cell.value).trim().toLowerCase();
                    
                    if (headerText.includes('no') && !headerText.includes('description')) {
                        mapping.no = colNum;
                    } else if (headerText.includes('activity') && headerText.includes('명')) {
                        mapping.activityName = colNum;
                    } else if (headerText.includes('상세') || headerText.includes('업무') || headerText.includes('description')) {
                        mapping.description = colNum;
                    } else if (headerText.includes('담당') || headerText.includes('조직') || headerText.includes('role')) {
                        mapping.role = colNum;
                    } else if (headerText.includes('input') || headerText === 'input') {
                        mapping.input = colNum;
                    } else if (headerText.includes('output') || headerText === 'output') {
                        mapping.output = colNum;
                    } else if (headerText.includes('system') || headerText === 'system') {
                        mapping.system = colNum;
                    } else if (headerText.includes('핵심') && headerText.includes('data')) {
                        mapping.coreData = colNum;
                    } else if (headerText.includes('참여자') || headerText.includes('소요') || headerText.includes('시간')) {
                        mapping.participants = colNum;
                    } else if (headerText.includes('선행') || headerText.includes('predecessor')) {
                        mapping.predecessor = colNum;
                    } else if (headerText.includes('후행') || headerText.includes('successor')) {
                        mapping.successor = colNum;
                    }
                }
            });
            
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
         * 셀 값 업데이트 (보존된 템플릿 스타일 사용)
         */
        updateCellValueWithStyle(sheet, rowNum, colNum, value, templateStyles) {
            if (colNum === -1) return; // 해당 열이 없으면 스킵
            
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            
            // 새 셀 생성 (템플릿 스타일 적용)
            const cell = {
                v: value,
                w: String(value),
                t: typeof value === 'number' ? 'n' : 's'
            };
            
            // 보존된 템플릿 스타일이 있으면 적용
            if (templateStyles && templateStyles[colNum]) {
                cell.s = JSON.parse(JSON.stringify(templateStyles[colNum]));
            }
            
            sheet[cellAddress] = cell;
        },

        /**
         * 셀 값 업데이트 (기존 행의 스타일 사용)
         */
        updateCellValueWithExistingStyle(sheet, rowNum, colNum, value, existingData) {
            if (colNum === -1) return; // 해당 열이 없으면 스킵
            
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            
            // 기존 데이터에서 스타일 가져오기
            const cellData = existingData[colNum];
            
            const cell = {
                v: value,
                w: String(value),
                t: typeof value === 'number' ? 'n' : 's'
            };
            
            // 기존 스타일이 있으면 적용
            if (cellData && cellData.style) {
                cell.s = JSON.parse(JSON.stringify(cellData.style));
            }
            
            sheet[cellAddress] = cell;
        },

        /**
         * ExcelJS용: 새 시트 추가 또는 기존 시트 업데이트
         */
        addOrUpdateSheet(workbook, sheetName, data, appendIfNotExists = true) {
            try {
                // ExcelJS에서 시트 찾기
                let worksheet = workbook.getWorksheet(sheetName);
                
                if (worksheet) {
                    // 기존 시트가 있으면 데이터만 업데이트 (스타일 보존)
                    console.log(`🔄 시트 업데이트 (ExcelJS): ${sheetName}`);
                    this.updateSheetDataWithStylesExcelJS(worksheet, data);
                } else if (appendIfNotExists) {
                    // 새 시트 추가
                    console.log(`➕ 새 시트 추가 (ExcelJS): ${sheetName}`);
                    worksheet = workbook.addWorksheet(sheetName);
                    worksheet.addRows(data);
                    this.setColumnWidthsExcelJS(worksheet, sheetName);
                }
            } catch (error) {
                console.error(`❌ 시트 처리 실패 (${sheetName}):`, error);
            }
        },
        
        /**
         * ExcelJS용: 스타일을 보존하면서 시트 데이터 업데이트
         */
        updateSheetDataWithStylesExcelJS(worksheet, data) {
            try {
                console.log(`📝 ExcelJS 시트 데이터 업데이트 (스타일 보존): ${worksheet.name}`);
                
                // 각 행마다 데이터 업데이트
                data.forEach((rowData, rowIndex) => {
                    const row = worksheet.getRow(rowIndex + 1); // 1-based
                    rowData.forEach((cellValue, colIndex) => {
                        const cell = row.getCell(colIndex + 1); // 1-based
                        // 값만 업데이트, 스타일은 ExcelJS가 자동으로 보존
                        cell.value = cellValue;
                    });
                    row.commit(); // 행 변경사항 적용
                });
                
                console.log(`✅ 시트 업데이트 완료: ${data.length}행`);
            } catch (error) {
                console.error('❌ updateSheetDataWithStylesExcelJS 실패:', error);
            }
        },

        /**
         * ExcelJS용: 열 너비 설정
         */
        setColumnWidthsExcelJS(worksheet, sheetName) {
            const widths = {
                '1.프로세스정보': [20, 50],
                '2.프로세스변수': [20, 50, 15],
                '3.역할(Lane)': [20, 25, 40, 10, 10, 10, 10],
                '4.액티비티': [30, 25, 15, 15, 40, 40, 12, 30, 30, 30, 35, 35, 8, 8, 8, 8, 8, 8],
                '5.이벤트': [30, 25, 15, 15, 40, 30, 20, 8, 8, 8, 8, 8, 8],
                '6.게이트웨이': [30, 25, 15, 15, 40, 30, 20, 8, 8, 8, 8, 8, 8],
                '7.시퀀스(흐름)': [30, 30, 30, 30, 40, 50],
                '8.서브프로세스': [30, 30, 50, 20]
            };
            
            const colWidths = widths[sheetName];
            if (colWidths) {
                colWidths.forEach((width, index) => {
                    worksheet.getColumn(index + 1).width = width;
                });
            }
        },

        /**
         * 스타일을 보존하면서 시트 데이터 업데이트 (기존 xlsx-js-style 버전)
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
/* 트리뷰 컨테이너 */
.tree-view-container {
    position: relative;
}

/* 트리뷰 카드 스타일 */
.tree-view-card {
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid #e0e0e0;
    position: relative;
}

/* 리사이즈 핸들 - 트리뷰 카드 우측에 absolute 배치 */
.resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    background-color: transparent;
    transition: background-color 0.2s ease;
    z-index: 100;
}

.resize-handle:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

.resize-handle:active {
    background-color: rgba(25, 118, 210, 0.6);
}

/* 리사이즈 중일 때 */
.resize-handle::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 3px;
    height: 40px;
    background-color: rgba(25, 118, 210, 0.2);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.resize-handle:hover::before {
    opacity: 1;
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

/* Mega 추가 버튼 스타일 (노드 액션 버튼과 동일하되 조금 더 크게) */
.mega-add-btn {
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
    border-radius: 4px !important;
    border: 1px solid #ddd !important;
    background-color: #fff !important;
    color: #666 !important;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
    transition: all 0.2s ease;
}

.mega-add-btn:hover {
    background-color: #f5f5f5 !important;
    border-color: #bbb !important;
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


