<template>
    <div>
        <v-row class="ma-0 pa-0">
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
                            <v-btn color="grey" variant="flat">추가</v-btn>
                            <v-btn color="grey" variant="flat">삭제</v-btn>
                        </div>
                    </v-row>
                    
                    <!-- TreeView -->
                    <v-treeview
                        v-if="Object.keys(nodes).length > 0"
                        :config="config"
                        :nodes="nodes"
                        class="process-tree"
                    >
                        <template #text="{ node }">
                            <div 
                                @click="handleNodeClick(node)"
                                :class="[
                                    'tree-node-text',
                                    { 'is-sub': node.id.startsWith('sub_') }
                                ]"
                            >
                                <v-icon size="small" class="mr-2">
                                    <template v-if="node.id.startsWith('mega_')">mdi-folder-network</template>
                                    <template v-else-if="node.id.startsWith('major_')">mdi-folder</template>
                                    <template v-else>mdi-file-document</template>
                                </v-icon>
                                {{ node.text }}
                                <v-chip v-if="node.data?.new" size="x-small" color="success" class="ml-2">NEW</v-chip>
                            </div>
                        </template>
                    </v-treeview>
                    
                    <v-alert v-else type="info" variant="tonal" class="mt-3">
                        프로세스 정의가 없습니다.
                    </v-alert>
                </v-card>
            </v-col>

            <!-- 오른쪽: ProcessDefinitionChat -->
            <v-col cols="12" md="9" class="pa-0 chat-container">
                <v-card flat class="pa-3">
                    <div class="ma-0 pa-0 align-center d-flex">
                        <!-- 검색창 -->
                        <v-row class="align-center flex-fill border border-borderColor header-search rounded-pill px-5 ma-0 pa-0">
                            <Icons :icon="'magnifer-linear'" :size="22" />
                            <v-text-field v-model="searchValue" variant="plain" density="compact"
                                class="position-relative pt-0 ml-3 custom-placeholer-color" :placeholder="$t('chatListing.search')"
                                single-line hide-details
                            ></v-text-field>
                        </v-row>
                        <v-spacer></v-spacer>
                        
                        <!-- 버튼들 -->
                        <div class="d-flex ga-2">
                            <v-btn color="grey" variant="flat">{{ $t('processDefinitionTree.uploadExcel') }}</v-btn>
                            <v-btn color="grey" variant="flat">{{ $t('processDefinitionTree.createMap') }}</v-btn>
                        </div>
                    </div>
                </v-card>
                
                <ProcessDefinitionChat
                    ref="processDefinitionChat"
                    :chatMode="chatMode"
                    :key="$route.fullPath"
                />
            </v-col>
        </v-row>
    </div>
</template>

<script>
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';
import BackendFactory from '@/components/api/BackendFactory';
import VTreeview from 'vue3-treeview';
import 'vue3-treeview/dist/style.css';

const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessDefinitionChatWithTree',
    components: {
        ProcessDefinitionChat,
        VTreeview,
    },
    props: {
        chatMode: {
            type: String,
            default: ""
        },
    },
    data: () => ({
        nodes: {},
        config: {
            roots: []
        },
        processDefinitionMap: null,
        selectedNodeId: null,
        search: '',
    }),
    async created() {
        await this.loadProcessDefinitionMap();
        await this.loadFirstSubProcess();
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
         * 프로세스 정의 체계도를 Supabase에서 로드
         */
        async loadProcessDefinitionMap() {
            try {
                this.processDefinitionMap = await backend.getProcessDefinitionMap();
                
                if (this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                    this.convertToVue3TreeviewFormat(this.processDefinitionMap.mega_proc_list);
                    console.log('🌲 Nodes loaded:', this.nodes);
                    console.log('🌲 Config:', this.config);
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
                    data: { type: 'mega', originalId: mega.id }
                };

                if (mega.major_proc_list && Array.isArray(mega.major_proc_list)) {
                    mega.major_proc_list.forEach(major => {
                        const majorId = `major_${major.id}`;
                        this.nodes[megaId].children.push(majorId);
                        
                        this.nodes[majorId] = {
                            id: majorId,
                            text: major.name,
                            children: [],
                            data: { type: 'major', originalId: major.id }
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
            console.log('🖱️ 노드 클릭:', node);
            
            if (!node || !node.id) {
                return;
            }

            const nodeId = node.id;
            this.selectedNodeId = nodeId;

            // sub 프로세스만 클릭 가능 (실제 프로세스 정의)
            if (typeof nodeId === 'string' && nodeId.startsWith('sub_')) {
                const processId = nodeId.replace('sub_', '');
                console.log('✅ Sub 프로세스 선택:', processId);
                this.navigateToProcess(processId);
            } else {
                console.log('ℹ️ Mega 또는 Major 프로세스 (클릭만 됨)');
            }
        },

        /**
         * 선택된 프로세스 정의로 이동
         * @param {String} processId - 프로세스 정의 ID
         */
        navigateToProcess(processId) {
            console.log('📍 navigateToProcess 실행');
            console.log('📍 Process ID:', processId);
            
            // ProcessDefinitionChat 컴포넌트가 라우팅을 통해 로드되도록 함
            const currentPath = this.$route.path;
            const newPath = `/definitions-tree/${processId}`;
            
            console.log('📍 Current Path:', currentPath);
            console.log('📍 New Path:', newPath);

            // 이미 해당 경로에 있으면 강제 새로고침
            if (currentPath === newPath) {
                console.log('🔄 같은 경로 - 강제 새로고침');
                this.$router.go(0);
            } else {
                console.log('➡️ 새 경로로 이동');
                this.$router.push(newPath);
            }
        },

        /**
         * 트리 새로고침 (외부에서 호출 가능)
         */
        async refreshTree() {
            await this.loadProcessDefinitionMap();
        },

        /**
         * 첫 번째 서브프로세스 자동 로드
         */
        async loadFirstSubProcess() {
            // 이미 특정 프로세스 경로에 있으면 스킵
            const currentPath = this.$route.path;
            if (currentPath !== '/definitions-tree' && currentPath !== '/definitions-tree/chat' && !currentPath.endsWith('/')) {
                return;
            }

            try {
                let firstSubProcessId = null;

                // nodes에서 첫 번째 서브프로세스 찾기
                for (const nodeId in this.nodes) {
                    if (nodeId.startsWith('sub_')) {
                        const node = this.nodes[nodeId];
                        if (node.data && node.data.processDefinitionId) {
                            firstSubProcessId = node.data.processDefinitionId;
                            this.selectedNodeId = nodeId;
                            break;
                        }
                    }
                }

                // 첫 번째 서브프로세스로 이동
                if (firstSubProcessId) {
                    const targetPath = `/definitions-tree/${firstSubProcessId}`;
                    console.log('🎯 첫 번째 서브프로세스로 이동:', targetPath);
                    // replace를 사용해서 뒤로가기 시 history에 남지 않도록 함
                    this.$router.replace(targetPath);
                }
            } catch (error) {
                console.error('첫 번째 서브프로세스 로드 실패:', error);
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
</style>

