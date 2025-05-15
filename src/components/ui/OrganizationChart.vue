<template>
    <div style="height:100%;">
        <!-- organization chart -->
        <div id="tree" ref="tree" class="h-100"></div>
        <!-- dialogs -->
        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-title>{{ dialogTitle }}</v-card-title>

                <!-- add team -->
                <v-card-text v-if="dialogType == 'addTeam'" class="text-center">
                    <v-text-field v-model="newTeam.id" :label="$t('organizationChartDefinition.teamId')"></v-text-field>
                    <v-text-field v-model="newTeam.name" :label="$t('organizationChartDefinition.teamName')"></v-text-field>
                </v-card-text>

                <!-- edit team -->
                <v-card-text v-else-if="dialogType == 'edit'">
                    <v-text-field v-model="editUser.data.name" :label="$t('organizationChartDefinition.teamName')"></v-text-field>
                    <v-autocomplete v-model="editUser.children" :items="allUsers" chips 
                        closable-chips color="blue-grey-lighten-2" item-title="data.name" :item-value="item => item" 
                        multiple :label="$t('organizationChartDefinition.selectTeamMember')" small-chips>
                        <template v-slot:chip="{ props, item }">
                            <v-chip v-if="item.raw.data.img" v-bind="props" :prepend-avatar="item.raw.data.img" :text="item.raw.data.name"></v-chip>
                            <v-chip v-else v-bind="props" prepend-icon="mdi-account-circle" :text="item.raw.data.name"></v-chip>
                        </template>
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-if="item.raw.data.img" v-bind="props" :prepend-avatar="item.raw.data.img" 
                                :title="item.raw.data.name" :subtitle="item.raw.data.email"></v-list-item>
                            <v-list-item v-else v-bind="props" :title="item.raw.data.name" :subtitle="item.raw.data.email">
                                <template v-slot:prepend>
                                    <v-icon style="position: relative; margin-right: 10px; margin-left: -3px;" size="48">mdi-account-circle</v-icon>
                                </template>
                            </v-list-item>
                        </template>
                    </v-autocomplete>
                </v-card-text>

                <!-- delete team -->
                <v-card-text v-else-if="dialogType == 'delete'">
                    <div>'{{ editUser.data.name }}' {{ $t('organizationChartDefinition.deleteMessage') }}</div>
                </v-card-text>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="updateNode">{{ buttonText }}</v-btn>
                    <v-btn color="error" @click="dialog = false">{{ $t('organizationChartDefinition.close') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ApexTree from 'apextree';

export default {
    props: {
        node: {
            type: Object,
            default: {},
        },
        userList: {
            type: Array,
            default: [],
        }
    },
    data: () => ({
        tree: null,
        openMenu: false,
        editUser: null,
        dialog: false,
        dialogType: '',
        allTeams: [],
        allUsers: [],
        newTeam: {
            id: '',
            name: '',
            isTeam: true,
            img: '/images/chat-icon.png',
        },
    }),
    computed: {
        isRoot() {
            return this.editUser.id === 'root';
        },
        currentTeam() {
            return this.allTeams.find(team => team.id === this.editUser.data.pid);
        },
        dialogTitle() {
            if (this.dialogType == 'addTeam') {
                return this.$t('organizationChartDefinition.addTeam')
            } else if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.team') + ' ' + this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.team') + ' ' + this.$t('organizationChartDefinition.delete')
            }
        },
        buttonText() {
            if (this.dialogType == 'addTeam') {
                return this.$t('organizationChartDefinition.add')
            } else if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.delete')
            }
        }
    },
    watch: {
        node(newVal) {
            if (newVal && newVal.id && newVal.data) {
                this.drawTree()
                this.allTeams = newVal.children.filter(c => c.data.isTeam).map(t => ({
                    id: t.id,
                    name: t.data.name
                }))
            }
        },
        userList(newVal) {
            this.allUsers = newVal.map(user => ({
                id: user.id,
                name: user.username,
                data: {
                    name: user.username,
                    img: user.profile,
                    email: user.email,
                    role: user.role || '',
                    pid: user.pid || ''
                }
            }))
        }
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
                            ${content.id == 'root' ? `<img class="node-content-btn add-team-btn" src="/assets/images/icon/plus.svg" alt="Add Team">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn add-member-btn" src="/assets/images/icon/plus.svg" alt="Add Member">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn edit-team-btn" src="/assets/images/icon/pencil.svg" alt="Edit Team">` : ''}
                            ${content.isTeam == true ? `<img class="node-content-btn delete-team-btn" src="/assets/images/icon/trash.svg" alt="Delete Team">` : ''}
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
                    this.openDialog('addTeam');
                } else if (event.target.classList.contains('add-member-btn')) {
                    event.stopPropagation();
                    this.$emit('addUser', this.editUser);
                } else if (event.target.classList.contains('edit-team-btn')) {
                    event.stopPropagation();
                    this.openDialog('edit');
                } else if (event.target.classList.contains('delete-team-btn')) {
                    event.stopPropagation();
                    this.openDialog('delete');
                }
            });


            this.allTeams = this.node.children.filter(c => c.data.isTeam).map(t => ({
                id: t.id,
                name: t.data.name
            }));
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
                    this.editUser = foundNode;
                    if (!this.openMenu) {
                        this.openMenu = true;
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
                this.openMenu = false;
            }
        },
        openDialog(type) {
            this.dialog = true;
            this.dialogType = type;
            if (type == 'addTeam') {
                this.newTeam = {
                    id: '',
                    name: '',
                    isTeam: true,
                    img: '/src/assets/images/chat/chat-icon.png',
                }
            }
        },
        async updateNode() {
            if (this.dialogType == 'addTeam') {
                this.node.children.push({
                    id: this.newTeam.id,
                    data: this.newTeam,
                    children: []
                })
            } else if (this.dialogType == 'delete') {
                this.node.children = await this.deleteNode(this.editUser, this.node.children);
            } else if (this.dialogType == 'edit') {
                if (this.editUser.data.isTeam) {
                    this.editUser.children.forEach(user => {
                        user.data.pid = this.editUser.id;
                    })
                }
            }
            await this.drawTree();
            
            this.$emit('updateNode');
            this.dialog = false;
            this.dialogType = '';
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
        }
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

