<template>
    <div style="height:100%;">
        <!-- organization chart -->
        <div id="tree" ref="tree" style="width: 100% !important; height: 100% !important;"></div>
        
        <!-- Agent Badges Diagram -->
        <AgentBadgesDiagram 
            :show="showBadgesDiagram" 
            :agentData="selectedAgent" 
            @close="closeBadgesDiagram"
        />
        
        <!-- dialogs -->
        <v-dialog v-model="teamDialog" max-width="500">
            <OrganizationTeamDialog 
                :dialogType="teamDialogType" 
                :editNode="editNode"
                @updateTeam="updateTeam"
                @closeDialog="closeTeamDialog"
            ></OrganizationTeamDialog>
        </v-dialog>
        <v-dialog 
            v-model="editDialog" 
            :max-width="isMobile ? '100vw' : 500"
            :fullscreen="isMobile"
        >
            <OrganizationEditDialog
                :dialogType="editDialogType"
                :editNode="editNode"
                @updateNode="updateNode"
                @closeDialog="closeEditDialog"
            ></OrganizationEditDialog>
        </v-dialog>
    </div>
</template>

<script>
import ApexTree from 'apextree';
import OrganizationTeamDialog from './OrganizationTeamDialog.vue';
import OrganizationEditDialog from './OrganizationEditDialog.vue';
import AgentBadgesDiagram from './AgentBadgesDiagram.vue';

export default {
    components: {
        OrganizationTeamDialog,
        OrganizationEditDialog,
        AgentBadgesDiagram
    },
    props: {
        node: {
            type: Object,
            default: {},
        },
    },
    data: () => ({
        tree: null,
        userList: [],
        
        // dialog
        editNode: null,
        teamDialog: false,
        editDialog: false,
        
        // badges diagram
        showBadgesDiagram: false,
        selectedAgent: null,
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
    },
    watch: {
        async node(newVal) {
            if (newVal && newVal.id && newVal.data) {
                await this.loadUserList();
                this.drawTree()
            }
        },
    },
    async mounted() {
        // 사용자 목록 로드
        await this.loadUserList();
        
        if (this.node && this.node.id && this.node.data) {
            const options = {
                contentKey: 'data',
                nodeWidth: 155,
                nodeHeight: 100,
                childrenSpacing: 50,
                siblingSpacing: 20,
                direction: 'top',
                enableExpandCollapse: true,
                nodeTemplate: (content) => {
                    console.log('🎨 [ApexTree] 노드 템플릿 렌더링:', content.id, content);
                    // 실제 사용자 데이터 가져오기
                    const userData = this.getUserData(content);
                    return `
                    <div class='node-content' id='${content.id}'>
                        <div class="node-content-text-box">
                            <div style="display: flex;">
                                ${content.id == 'root' || content.isTeam ? '' : (userData.profile ? `<img class="node-content-img" src='${userData.profile}' onerror="this.src='/images/defaultUser.png'" />` : `<img class="node-content-img" src='/images/defaultUser.png' />`)}
                                <div style="flex: 1;"></div>
                                <div class="node-content-btn-box">
                                    ${content.id == 'root' ? `<div class="node-content-btn add-team-btn"><img class="node-content-icon" src="/assets/images/icon/plus.svg"></div>` : ''}
                                    ${content.isTeam == true ? `<div class="node-content-btn add-member-btn"><img class="node-content-icon" src="/assets/images/icon/plus.svg"></div>` : ''}
                                    ${content.isTeam == true ? `<div class="node-content-btn edit-team-btn"><img class="node-content-icon" src="/assets/images/icon/pencil.svg"></div>` : ''}
                                    ${content.isTeam == true ? `<div class="node-content-btn delete-team-btn"><img class="node-content-icon" src="/assets/images/icon/trash.svg"></div>` : ''}
                                    ${content.isAgent == true ? `<div class="node-content-btn edit-agent-btn"><img class="node-content-icon" src="/assets/images/icon/pencil.svg"></div>` : ''}
                                    ${content.isAgent == true ? `<div class="node-content-btn delete-agent-btn"><img class="node-content-icon" src="/assets/images/icon/trash.svg"></div>` : ''}
                                    ${!content.isAgent && !content.isTeam && content.id != 'root' ? `<div class="node-content-btn edit-member-btn"><img class="node-content-icon" src="/assets/images/icon/pencil.svg"></div>` : ''}

                                </div>
                            </div>
                            <div class="node-content-title-box" data-node-id="${content.id}">
                                <div style="font-weight: bold; font-family: Arial; font-size: 14px;">${userData.username || content.name}</div>
                                ${userData.email ? `<div style="font-family: Arial; font-size: 12px">${userData.email}</div>` : ''}
                                ${userData.role ? `<div style="font-family: Arial; color:gray; font-size: 11px">${userData.role}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    `;
                },
                enableToolbar: true,
            };
            this.tree = new ApexTree(document.getElementById('tree'), options);
            await this.drawTree()

            document.addEventListener('click', (event) => {
                const button = event.target.closest('.node-content-btn');
                if (button) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    
                    if (button.classList.contains('add-team-btn')) {
                        this.openTeamDialog('add');
                    } else if (button.classList.contains('edit-team-btn')) {
                        this.openTeamDialog('edit');
                    } else if (button.classList.contains('delete-team-btn')) {
                        this.openTeamDialog('delete');
                    } else if (button.classList.contains('add-member-btn')) {
                        this.$emit('addMember', this.editNode);
                    } else if (button.classList.contains('edit-member-btn')) {
                        this.openEditDialog('edit-user');
                    } else if (button.classList.contains('edit-agent-btn')) {
                        this.openEditDialog('edit-agent');
                    } else if (button.classList.contains('delete-agent-btn')) {
                        this.openEditDialog('delete');

                    }
                }
            });


        }

        this.$refs.tree.addEventListener('click', this.handleNodeClick);
        this.$refs.tree.addEventListener('contextmenu', this.handleNodeClick);
        
        // 터치 이벤트 핸들러 추가
        this.$refs.tree.addEventListener('touchstart', this.handleTouch, { passive: false });
        this.$refs.tree.addEventListener('touchmove', this.handleTouch, { passive: false });
        this.$refs.tree.addEventListener('touchend', this.handleTouch, { passive: false });
    },

    methods: {
        async loadUserList() {
            try {
                // backend 인스턴스가 없으면 생성
                if (!this.backend) {
                    const BackendFactory = (await import('@/components/api/BackendFactory')).default;
                    this.backend = BackendFactory.createBackend();
                }
                this.userList = await this.backend.getUserList({});
            } catch (error) {
                this.userList = [];
            }
        },
        getUserData(content) {
            // root나 팀인 경우 원본 데이터 사용
            if (content.id === 'root' || content.isTeam) {
                return content;
            }
            
            // 사용자 ID로 실제 사용자 데이터 찾기
            const user = this.userList.find(u => u.id === content.id);
            if (user) {
                return {
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    profile: user.profile
                };
            }
            
            // 사용자를 찾지 못한 경우 원본 데이터 사용
            return content;
        },
        drawTree() {
            // 팀원들을 세로 배치하기 위한 데이터 변환
            const transformedNode = this.transformForVerticalLayout(this.node);
            console.log('🔍 [OrganizationChart] 원본 노드:', this.node);
            console.log('🔍 [OrganizationChart] 변환된 노드:', transformedNode);
            console.log('🔍 [OrganizationChart] 환경 정보:', {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                hostname: window.location.hostname,
                isDevelopment: process.env.NODE_ENV === 'development'
            });
            this.tree.render(transformedNode);
        },
        transformForVerticalLayout(node) {
            if (!node) return node;
            
            console.log('🔄 [transformForVerticalLayout] 처리 중인 노드:', node.id, node.data);
            
            // 깊은 복사를 통해 원본 데이터 보존
            const clonedNode = JSON.parse(JSON.stringify(node));
            
            // 자식 노드들을 변환
            if (clonedNode.children && clonedNode.children.length > 0) {
                console.log('👥 [transformForVerticalLayout] 자식 노드 수:', clonedNode.children.length);
                
                clonedNode.children = clonedNode.children.map(child => {
                    const transformedChild = this.transformForVerticalLayout(child);
                    
                    // 팀 노드인 경우 팀원들을 세로로 연결
                    if (transformedChild.data && transformedChild.data.isTeam && 
                        transformedChild.children && transformedChild.children.length > 0) {
                        
                        console.log('🏢 [transformForVerticalLayout] 팀 발견:', transformedChild.data.name, '팀원 수:', transformedChild.children.length);
                        
                        // 팀원들을 체인 형태로 연결
                        const members = transformedChild.children;
                        if (members.length > 1) {
                            console.log('🔗 [transformForVerticalLayout] 팀원들을 체인으로 연결:', members.map(m => m.data?.name || m.id));
                            
                            // 첫 번째 팀원부터 시작하여 체인 연결
                            for (let i = 0; i < members.length - 1; i++) {
                                members[i].children = [members[i + 1]];
                            }
                            // 마지막 팀원은 자식이 없음
                            members[members.length - 1].children = [];
                            
                            // 팀의 자식은 첫 번째 팀원만
                            transformedChild.children = [members[0]];
                            
                            console.log('✅ [transformForVerticalLayout] 체인 연결 완료');
                        }
                    }
                    
                    return transformedChild;
                });
            }
            
            console.log('✨ [transformForVerticalLayout] 변환 완료:', clonedNode.id);
            return clonedNode;
        },
        findNodeById(node, id) {
            if (node.id === id) {
                return node;
            }
            if (node.children) {
                for (let child of node.children) {
                    let found = this.findNodeById(child, id);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        },
        // 원본 데이터에서 노드를 찾는 메서드 (변환 전 데이터 사용)
        findOriginalNodeById(node, id) {
            if (node.id === id) {
                return node;
            }
            if (node.children) {
                for (let child of node.children) {
                    let found = this.findOriginalNodeById(child, id);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        },
        handleNodeClick(event) {
            event.preventDefault();
            const target = event.target.closest('.node-content');
            if (target) {
                if (this.previousTarget && this.previousTarget !== target) {
                    const previousTextBox = this.previousTarget.querySelector('.node-content-text-box');
                    if (previousTextBox) {
                        previousTextBox.style.backgroundColor = '';
                    }
                }
                // 원본 데이터에서 노드를 찾아서 사용
                const foundNode = this.findOriginalNodeById(this.node, target.id);
                if (foundNode && foundNode.data) {
                    this.editNode = foundNode;
                    
                    // Agent 클릭 시 뱃지 다이어그램 토글, 아닌 경우 닫기
                    if (foundNode.data.isAgent) {
                        // 이미 같은 Agent가 선택되어 있고 다이어그램이 열려있으면 닫기
                        if (this.showBadgesDiagram && this.selectedAgent && this.selectedAgent.id === foundNode.data.id) {
                            this.closeBadgesDiagram();
                        } else {
                            // 새로운 Agent이거나 다이어그램이 닫혀있으면 열기
                            this.selectedAgent = foundNode.data;
                            this.showBadgesDiagram = true;
                        }
                    } else {
                        this.closeBadgesDiagram();
                    }
                }
                const textBox = target.querySelector('.node-content-text-box');
                if (textBox) {
                    textBox.style.backgroundColor = `rgba(var(--v-theme-primary), 0.20)`;
                }
                this.previousTarget = target;
            } else {
                if (this.previousTarget) {
                    this.previousTarget.style.backgroundColor = '';
                }
                // 빈 공간 클릭 시에도 뱃지 다이어그램 닫기
                this.closeBadgesDiagram();
            }
        },
        closeBadgesDiagram() {
            this.showBadgesDiagram = false;
            this.selectedAgent = null;
        },
        openTeamDialog(type) {
            this.teamDialog = true;
            this.teamDialogType = type;
        },
        closeTeamDialog() {
            this.teamDialog = false;
            this.teamDialogType = '';
        },
        async updateTeam(type, editNode, newTeam) {
            if (type == 'add') {
                this.node.children.push({
                    id: newTeam.id,
                    data: newTeam,
                    children: []
                })
            } else if (type == 'delete') {
                this.node.children = await this.deleteNode(editNode, this.node.children);
            } else if (type == 'edit') {
                if (editNode.data.isTeam) {
                    this.node.children.forEach(team => {
                        if (team.id == editNode.id) {
                            team = editNode
                        }
                    })
                }
            }
            await this.drawTree();
            this.$emit('updateNode');
            this.closeTeamDialog();
        },
        deleteNode(obj, children) {
            if (children && children.some(item => item.id == obj.id)) {
                children = children.filter(item => item.id != obj.id);
            } else {
                children.forEach(async (item) => {
                    item.children = await this.deleteNode(obj, item.children);
                })
            }
            return children;
        },
        openEditDialog(type) {
            this.editDialog = true;
            this.editDialogType = type;
        },
        closeEditDialog() {
            this.editDialog = false;
            this.editDialogType = '';
        },
        async updateNode(type, editNode) {
            if (type == 'edit') {
                this.node.children.forEach(team => {
                    if (team.id == editNode.id) {
                        team = editNode
                    }
                })
            } else if (type == 'delete') {
                this.node.children = await this.deleteNode(editNode, this.node.children);
            }
            this.$emit('updateAgent', type, editNode);
            await this.drawTree();
            this.$emit('updateNode');
            this.closeEditDialog();
        },
        handleTouch(e) {
            
            // 버튼 영역이면 터치 이벤트 처리하지 않음
            if (e.target.closest('.node-content-btn')) {
                return;
            }
            
            // 터치 끝날 때 클릭으로 처리 (모바일에서 더 안정적)
            if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const nodeContent = target?.closest('.node-content');
                
                if (nodeContent) {
                    // 직접 handleNodeClick 호출
                    const syntheticEvent = {
                        type: 'click',
                        target: nodeContent,
                        preventDefault: () => {},
                        stopPropagation: () => {}
                    };
                    this.handleNodeClick(syntheticEvent);
                }
                e.preventDefault();
                return;
            }
            
            // 기존 터치-마우스 변환 로직 (스크롤/줌을 위해 유지)
            if (e.touches && e.touches.length === 1) {
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent(
                    e.type === 'touchstart' ? 'mousedown' :
                    e.type === 'touchmove' ? 'mousemove' :
                    e.type === 'touchend' ? 'mouseup' : '',
                    {
                        bubbles: true,
                        cancelable: true,
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                    }
                );
                e.target.dispatchEvent(mouseEvent);
                e.preventDefault();
            }
        },

    },
}
</script>

<style scoped>
#tree {
    width: 100% !important;
    height: 99% !important;
}
@media screen and (max-width: 768px) {
    #tree {
        height: calc(100vh - 40px) !important;
    }
}
</style>

