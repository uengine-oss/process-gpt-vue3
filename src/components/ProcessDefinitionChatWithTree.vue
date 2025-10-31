<template>
    <div>
        <v-row class="ma-0 pa-0 process-definition-chat-tree-box">
            <!-- 왼쪽: TreeView -->
            <v-col cols="12" md="3" class="pa-0">
                <v-card elevation="10" class="pa-3 tree-view-card">
                    <v-row class="ma-0 pa-0">
                        <v-card-title class="pa-2 mb-2">
                            <v-icon class="mr-2">mdi-file-tree</v-icon>
                            프로세스 체계도
                        </v-card-title>
                        <v-spacer></v-spacer>
                        
                        <div class="d-flex ga-2">
                            <!-- <v-btn color="grey" variant="flat">추가</v-btn>
                            <v-btn color="grey" variant="flat">삭제</v-btn> -->
                            <v-btn color="grey" variant="flat" @click="selectedProcessId = null">새 프로세스</v-btn>
                        </div>
                    </v-row>
                    
                    <!-- TreeView -->
                    <div v-if="isLoadingProcessDefinitionMap" class="text-center pa-5">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                        <div class="mt-3">로딩 중...</div>
                    </div>
                    
                    <v-treeview
                        v-else-if="!isLoadingProcessDefinitionMap && Object.keys(nodes).length > 0"
                        :config="config"
                        :nodes="nodes"
                        class="process-tree"
                        @nodeOpened="handleNodeOpened"
                        @nodeClosed="handleNodeClosed"
                    >
                        <template #before-input="{ node }">
                            <span 
                                @click="node.data?.type === 'sub' ? handleNodeClick(node) : null"
                                style="cursor: pointer;"
                            ></span>
                        </template>
                        
                        <template #after-input="{ node }">
                            <span class="node-action-buttons">
                                <!-- mega와 major는 추가 버튼 표시 -->
                                <button 
                                    v-if="node.data?.type === 'mega' || node.data?.type === 'major'"
                                    class="node-action-btn add-btn" 
                                    :title="node.data?.type === 'mega' ? 'Major 프로세스 추가' : 'Sub 프로세스 추가'"
                                    @click.stop="handleNodeAddAction(node)"
                                >
                                    +
                                </button>
                                
                                <!-- 모든 타입에 수정 버튼 표시 -->
                                <button 
                                    class="node-action-btn edit-btn" 
                                    title="수정"
                                    @click.stop="handleNodeEditAction(node)"
                                >
                                    ✎
                                </button>
                                
                                <!-- 모든 타입에 삭제 버튼 표시 -->
                                <button 
                                    class="node-action-btn delete-btn" 
                                    title="삭제"
                                    @click.stop="handleNodeDeleteAction(node)"
                                >
                                    ✕
                                </button>
                            </span>
                        </template>
                    </v-treeview>
                    
                    <v-alert v-else-if="!isLoadingProcessDefinitionMap && Object.keys(nodes).length === 0" type="info" variant="tonal" class="mt-3">
                        프로세스 정의가 없습니다.
                    </v-alert>
                </v-card>
            </v-col>

            <!-- 오른쪽: ProcessDefinitionChat -->
            <v-col cols="12" md="9" class="pa-0 chat-container">
                <v-card flat class="pa-3">
                    <div class="ma-0 pa-0 align-center d-flex">
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
                                <v-list-item v-bind="props">
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
                                v-if="!selectedProcessId"
                                color="success" 
                                variant="flat"
                                @click="openFileDialog"
                                :loading="isParsingExcel"
                            >
                                <v-icon class="mr-2">mdi-file-excel</v-icon>
                                {{ uploadedFileName || $t('processDefinitionTree.uploadExcel') }}
                            </v-btn>
                            <v-btn 
                                v-if="!selectedProcessId"
                                color="primary" 
                                variant="flat"
                                @click="handleCreateMap"
                                :disabled="!parsedExcelData"
                            >
                                {{ $t('processDefinitionTree.createMap') }}
                            </v-btn>
                            <v-btn 
                                color="info" 
                                variant="flat"
                                @click="handleDownloadExcel"
                            >
                                <v-icon class="mr-2">mdi-download</v-icon>
                                엑셀 다운로드
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
                    :key="selectedProcessId || 'default'"
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
                        Major 프로세스 추가
                    </span>
                    <span v-else>
                        {{ currentNodeType === 'mega' ? 'Mega 프로세스 수정' : 
                           currentNodeType === 'major' ? 'Major 프로세스 수정' : 
                           currentNodeType === 'sub' ? 'Sub 프로세스 수정' : '프로세스 수정' }}
                    </span>
                </v-card-title>
                
                <v-card-text class="pa-4">
                    <v-text-field
                        v-model="processForm.name"
                        label="프로세스 이름"
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
                        {{ processDialogMode === 'add' ? '추가' : '수정' }}
                    </v-btn>
                    <v-btn
                        color="error"
                        variant="flat"
                        @click="closeProcessDialog"
                    >
                        취소
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';
import ProcessDialog from '@/components/apps/definition-map/ProcessDialog.vue';
import BackendFactory from '@/components/api/BackendFactory';
import VTreeview from 'vue3-treeview';
import 'vue3-treeview/dist/style.css';
import * as XLSX from 'xlsx';

const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessDefinitionChatWithTree',
    components: {
        ProcessDefinitionChat,
        ProcessDialog,
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
        uploadedFileName: null,
        isParsingExcel: false,
        parsedExcelData: null,
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
        }
    },
    methods: {
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
                    this.$nextTick(() => {
                        this.expandSavedNodes();
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
                    if (element.name) {
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
                        mega.major_proc_list.push({
                            id: newProcess.id || this.generateUniqueId(),
                            name: newProcess.name,
                            sub_proc_list: []
                        });
                    }
                } else if (parentType === 'major') {
                    // Major에 Sub 추가 (기존 정의 또는 신규)
                    for (const mega of this.processDefinitionMap.mega_proc_list) {
                        const major = mega.major_proc_list?.find(m => m.id === parentId);
                        if (major) {
                            if (!major.sub_proc_list) major.sub_proc_list = [];
                            
                            // ProcessDialog에서 반환된 newProcess 구조 확인
                            // id와 name만 있으면 기존 정의, 그 외 필드가 있으면 신규
                            const subProcess = {
                                id: newProcess.id || this.generateUniqueId(),
                                name: newProcess.name || newProcess.label || newProcess.id
                            };
                            
                            // 기존 프로세스 정의를 선택한 경우
                            if (newProcess.path || newProcess.label) {
                                subProcess.new = false;
                            } else {
                                // 새로 생성한 경우
                                subProcess.new = true;
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
                    
                    // 트리 상태 복구
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.restoreTreeState();
                        }, 500);
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
                                    state: { opened: this.openedNodes.includes(subId) }
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
            this.selectedNodeId = nodeId;

            // sub 프로세스만 클릭 가능 (실제 프로세스 정의)
            if (typeof nodeId === 'string' && nodeId.startsWith('sub_')) {
                const processId = node.data?.processDefinitionId || nodeId.replace('sub_', '');
                
                // selectedProcessId를 업데이트하여 ProcessDefinitionChat에 전달
                this.selectedProcessId = processId;
            }
        },

        /**
         * 트리 새로고침 (외부에서 호출 가능)
         */
        async refreshTree() {
            await this.loadProcessDefinitionMap();
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

            await this.processExcelFile(file);
            
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
                    
                    console.log(`엑셀 파일이 성공적으로 파싱되었습니다. (${result.sheetCount}개 시트)`);
                } else {
                    console.error('❌ 엑셀 파싱 실패:', result.error);
                    console.log(`엑셀 파일 파싱에 실패했습니다: ${result.error}`);
                }
            } catch (error) {
                console.error('❌ 엑셀 파일 처리 중 오류:', error);
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
                        
                        // 엑셀 파일 파싱
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        const elapsed = (Date.now() - startTime) / 1000;
                        console.log(`⏱️ XLSX 파싱 시간: ${elapsed.toFixed(2)}초`);
                        
                        // 모든 시트의 데이터를 추출
                        const result = {};
                        
                        workbook.SheetNames.forEach(sheetName => {
                            const worksheet = workbook.Sheets[sheetName];
                            // 시트를 JSON으로 변환 (두 가지 형태로)
                            const jsonArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                            const jsonObjects = XLSX.utils.sheet_to_json(worksheet);
                            
                            result[sheetName] = {
                                array: jsonArray,      // 배열 형태
                                objects: jsonObjects   // 객체 배열 형태
                            };
                        });
                        
                        resolve({
                            success: true,
                            data: result,
                            sheetNames: workbook.SheetNames,
                            sheetCount: workbook.SheetNames.length,
                            workbook: workbook
                        });
                        
                    } catch (parseError) {
                        console.error('❌ XLSX 파싱 중 오류:', parseError);
                        resolve({
                            success: false,
                            error: parseError.message
                        });
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('❌ 파일 읽기 중 오류:', error);
                    resolve({
                        success: false,
                        error: '파일 읽기 실패'
                    });
                };
                
                reader.readAsArrayBuffer(file);
            });
        },

        /**
         * 맵 생성 버튼 클릭 핸들러
         */
        async handleCreateMap() {
            if (!this.parsedExcelData) {
                console.error('파싱된 엑셀 데이터가 없습니다.');
                return;
            }

            try {
                console.log('🚀 프로세스 맵 생성 시작');
                
                // 파싱된 엑셀 데이터를 문자열로 변환
                let excelContent = '';
                this.parsedExcelData.sheetNames.forEach(sheetName => {
                    const sheetData = this.parsedExcelData.data[sheetName];
                    excelContent += `\n\n[시트: ${sheetName}]\n`;
                    excelContent += JSON.stringify(sheetData.objects, null, 2);
                });

                console.log('📋 엑셀 내용:', excelContent);

                // 메시지 생성
                const message = {
                    text: excelContent + '\n\n위 내용을 보고 프로세스를 생성해줘',
                    images: [],
                    mentionedUsers: []
                };

                // 자식 컴포넌트(ProcessDefinitionChat)의 beforeSendMessage 메서드 호출
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.beforeSendMessage) {
                    await chatComponent.beforeSendMessage(message);
                } else {
                    console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
                }
                
            } catch (error) {
                console.error('❌ 프로세스 맵 생성 실패:', error);
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

            // 자식 컴포넌트(ProcessDefinitionChat)의 searchAndFocusActivity 메서드 호출
            const chatComponent = this.$refs.processDefinitionChat;
            if (chatComponent && chatComponent.searchAndFocusActivity) {
                const found = chatComponent.searchAndFocusActivity(this.searchValue);
                
                if (found) {
                    console.log('✅ 액티비티를 찾아 포커싱했습니다.');
                } else {
                    console.log('❌ 일치하는 액티비티를 찾을 수 없습니다.');
                    // 사용자에게 알림 (선택적)
                    // alert(`"${this.searchValue}"와 일치하는 액티비티를 찾을 수 없습니다.`);
                }
            } else {
                console.error('ProcessDefinitionChat 컴포넌트를 찾을 수 없습니다.');
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

            // 자식 컴포넌트(ProcessDefinitionChat)의 searchAndFocusActivity 메서드 호출
            const chatComponent = this.$refs.processDefinitionChat;
            if (chatComponent && chatComponent.searchAndFocusActivity) {
                chatComponent.searchAndFocusActivity(value);
            }
        },

        /**
         * 검색 입력 변경 시 (타이핑 중)
         */
        handleSearchInput(value) {
            this.searchInputText = value;
            
            // 실시간 검색 (디바운스 없이 즉시 실행)
            if (value && value.trim() !== '') {
                const chatComponent = this.$refs.processDefinitionChat;
                if (chatComponent && chatComponent.searchAndFocusActivity) {
                    chatComponent.searchAndFocusActivity(value);
                }
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

                // 3. Roles(역할/Lane) 시트
                if (processDefinition.roles && processDefinition.roles.length > 0) {
                    const rolesData = [
                        ['역할 이름', 'Endpoint', '담당 업무', 'X좌표', 'Y좌표', '너비', '높이']
                    ];
                    
                    processDefinition.roles.forEach(role => {
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
                         '도구', 'Layer', 'Order', 'X좌표', 'Y좌표', '너비', '높이']
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
                        { wch: 35 },  // 도구
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

/* 노드 액션 버튼 컨테이너 */
.process-tree :deep(.node-action-buttons) {
    display: flex;
    gap: 4px;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.process-tree :deep(.node-wrapper) {
    display: flex;
    align-items: center;
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

.process-tree :deep(.node-action-btn:hover) {
    transform: scale(1.1);
}

/* 추가 버튼 */
.process-tree :deep(.add-btn) {
    border-color: #4caf50;
    color: #4caf50;
}

.process-tree :deep(.add-btn:hover) {
    background-color: #4caf50;
    color: #fff;
}

/* 수정 버튼 */
.process-tree :deep(.edit-btn) {
    border-color: #2196f3;
    color: #2196f3;
}

.process-tree :deep(.edit-btn:hover) {
    background-color: #2196f3;
    color: #fff;
}

/* 삭제 버튼 */
.process-tree :deep(.delete-btn) {
    border-color: #f44336;
    color: #f44336;
}

.process-tree :deep(.delete-btn:hover) {
    background-color: #f44336;
    color: #fff;
}
</style>

