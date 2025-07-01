<template>
    <div style="height:100%;">
        <!-- organization chart -->
        <div id="tree" ref="tree" class="h-100"></div>
        
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
        node(newVal) {
            if (newVal && newVal.id && newVal.data) {
                this.drawTree()
            }
        },
    },
    async mounted() {
        if (this.node && this.node.id && this.node.data) {
            const options = {
                contentKey: 'data',
                width: 800,
                height: 500,
                nodeWidth: 155,
                nodeHeight: 115,
                childrenSpacing: 50,
                siblingSpacing: 20,
                direction: 'top',
                enableExpandCollapse: true,
                nodeTemplate: (content) =>`
                <div class='node-content' id='${content.id}' style='display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;'>
                    ${content.id == 'root' ? '' : (content.img ? `<img class="node-content-img" src='${content.img}' />` : `<img class="node-content-img" src='/images/defaultUser.png' />`)}
                    <div class="node-content-text-box">
                        <div style="font-weight: bold; font-family: Arial; font-size: 14px;">${content.name}</div>
                        ${content.email ? `<div style="font-family: Arial; font-size: 12px">${content.email}</div>` : ''}
                        ${content.role ? `<div style="font-family: Arial; color:gray; font-size: 11px">${content.role}</div>` : ''}
                        <div class="node-content-btn-box">
                            ${content.id == 'root' ? `<img class="node-content-btn add-team-btn" src="/assets/images/icon/plus.svg">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn add-member-btn" src="/assets/images/icon/plus.svg">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn edit-team-btn" src="/assets/images/icon/pencil.svg">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn delete-team-btn" src="/assets/images/icon/trash.svg">` : ''}
                            ${content.isAgent == true ? `<img class="node-content-btn edit-agent-btn" src="/assets/images/icon/pencil.svg">` : ''}
                            ${content.isAgent == true ? `<img class="node-content-btn delete-agent-btn" src="/assets/images/icon/trash.svg">` : ''}
                            ${!content.isAgent && !content.isTeam && content.id != 'root' ? `<img class="node-content-btn edit-member-btn" src="/assets/images/icon/pencil.svg">` : ''}
                        </div>
                    </div>
                </div>
                `,
                enableToolbar: true,
            };
            this.tree = new ApexTree(document.getElementById('tree'), options);
            await this.drawTree()

            document.addEventListener('click', (event) => {
                if (event.target.classList.contains('add-team-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openTeamDialog('add');
                } else if (event.target.classList.contains('edit-team-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openTeamDialog('edit');
                } else if (event.target.classList.contains('delete-team-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openTeamDialog('delete');
                } else if (event.target.classList.contains('add-member-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.$emit('addMember', this.editNode);
                } else if (event.target.classList.contains('edit-member-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openEditDialog('edit-user');
                } else if (event.target.classList.contains('edit-agent-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openEditDialog('edit-agent');
                } else if (event.target.classList.contains('delete-agent-btn')) {
                    event.stopPropagation();
                    this.closeBadgesDiagram();
                    this.openEditDialog('delete');
                }
            });
        }

        this.$refs.tree.addEventListener('click', this.handleNodeClick);
        this.$refs.tree.addEventListener('contextmenu', this.handleNodeClick);
    },
    methods: {
        drawTree() {
            this.tree.render(this.node);
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
                const foundNode = this.findNodeById(this.node, target.id);
                if (foundNode && foundNode.data) {
                    this.editNode = foundNode;
                    
                    // Agent 클릭 시 뱃지 다이어그램 표시, 아닌 경우 닫기
                    if (foundNode.data.isAgent) {
                        this.selectedAgent = foundNode.data;
                        this.showBadgesDiagram = true;
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
    },
}
</script>

<style scoped>
#tree {
    width: 100%;
    height:100%;
}

@media screen and (max-width: 1080px) {
    #tree {
        height: calc(100vh - 200px) !important;
    }
}
</style>

