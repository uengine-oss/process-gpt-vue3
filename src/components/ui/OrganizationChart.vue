<template>
    <div style="height:100%;">
        <!-- buttons -->
        <div v-if="openMenu" style="position: absolute; right: 20px; z-index: 1000; top: 60px;">
            <v-row class="ma-0 pa-0">
                <v-spacer></v-spacer>
                <v-btn v-if="isRoot" color="primary" class="ml-2" variant="flat" density="comfortable"
                    @click="openDialog('addTeam')">
                    <template v-slot:prepend>
                        <Icons :icon="'users-plus'" :size="20" />
                    </template>
                    팀 추가
                </v-btn>
                <div v-else class="d-flex">
                    <v-btn color="primary" class="ml-2" variant="flat" density="comfortable" @click="openDialog('edit')">
                        <template v-slot:prepend>
                            <Icons :icon="'user-edit'" :size="20" />
                        </template>
                        수정
                    </v-btn>
                    <v-btn color="error" class="ml-2" variant="flat" density="comfortable" @click="openDialog('delete')">
                        <template v-slot:prepend>
                            <Icons :icon="'user-minus'" :size="20" />
                        </template>
                        삭제
                    </v-btn>
                </div>
            </v-row>
        </div>
        <!-- organization chart -->
        <div id="tree" ref="tree" class="h-100"></div>
        <!-- dialogs -->
        <v-dialog v-model="dialog" max-width="500">
            <v-card v-if="dialogType == 'addTeam'">
                <v-card-title>팀 추가</v-card-title>
                <v-card-text class="text-center">
                    <v-text-field v-model="newTeam.id" label="팀 ID"></v-text-field>
                    <v-text-field v-model="newTeam.name" label="팀명"></v-text-field>
                </v-card-text>
                <v-card-actions class="pt-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="updateNode">추가</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>

            <v-card v-if="dialogType == 'edit'">
                <v-card-title class="">수정</v-card-title>
                <v-card-text class="text-center">
                    <v-avatar v-if="!editUser.data.isTeam" color="grey" rounded="0" size="100" class="mb-5">
                        <v-img v-if="editUser.data.img" :src="editUser.data.img"></v-img>
                    </v-avatar>

                    <v-select v-if="!editUser.data.isTeam" v-model="editUser.data.pid" :items="allTeams" item-title="name"
                        item-value="id" label="팀"></v-select>
                    
                    <v-text-field v-model="editUser.data.name" label="이름"></v-text-field>
                    
                    <v-text-field v-if="editUser.data.role" v-model="editUser.data.role" label="역할"></v-text-field>
                    
                    <v-autocomplete v-if="editUser.data.isTeam" v-model="editUser.children" :items="allUsers" chips 
                        closable-chips color="blue-grey-lighten-2" item-title="data.name" :item-value="item => item" 
                        multiple label="팀원 선택" small-chips>
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
                <v-card-actions class="pt-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="updateNode">수정</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>

            <v-card v-if="dialogType == 'delete'">
                <v-card-title>{{ editUser.data.isTeam ? '팀' : '팀원' }} 삭제</v-card-title>
                <v-card-text>
                    <div v-if="editUser.data.isTeam">'{{ editUser.data.name }}' 을/를 삭제하시겠습니까?</div>
                    <div v-else>'{{ currentTeam.name }}' 에서 '{{ editUser.data.name }}' 님을 삭제하시겠습니까?</div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="updateNode">삭제</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ApexTree from 'apextree'

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
            img: '/src/assets/images/chat/chat-icon.png',
        },
    }),
    computed: {
        isRoot() {
            return this.editUser.id === 'root';
        },
        currentTeam() {
            return this.allTeams.find(team => team.id === this.editUser.data.pid);
        },
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
                nodeWidth: 200,
                nodeHeight: 100,
                childrenSpacing: 50,
                siblingSpacing: 20,
                direction: 'top',
                enableExpandCollapse: true,
                nodeTemplate: (content) =>`
                <div class='node-content' id='${content.id}' style='display: flex; padding: 10px; flex-direction: row;justify-content: space-between; align-items: center; height: 100%;'>
                    ${content.img ? `<img style='width: 45px; height: 45px; border-radius: 50%;' src='${content.img}' />` : ''}
                    <div style='margin-left: 10px'>
                        <div style="font-weight: bold; font-family: Arial; font-size: 14px;">${content.name}</div>
                        ${content.email ? `<div style="font-family: Arial; font-size: 12px">${content.email}</div>` : ''}
                        ${content.role ? `<div style="font-family: Arial; font-size: 12px">${content.role}</div>` : ''}
                    </div>
                </div>
                `,
                enableToolbar: true,
            };
            this.tree = new ApexTree(document.getElementById('tree'), options);
            await this.drawTree()

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
                    this.previousTarget.style.backgroundColor = '';
                }
                const foundNode = this.findNodeById(this.node, target.id);
                if (foundNode && foundNode.data) {
                    this.editUser = foundNode;
                    if (!this.openMenu) {
                        this.openMenu = true;
                    }
                }
                target.style.backgroundColor = '#d7d7d7';
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

