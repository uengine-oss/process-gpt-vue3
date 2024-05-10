<template>
    <div>
        <!-- buttons -->
        <div v-if="openMenu" style="position: fixed; right: 40px; z-index: 1000; margin-top: 60px;">
            <v-btn v-if="isRoot" color="primary" class="ml-2" variant="flat" density="comfortable"
                @click="openDialog('addTeam')">
                <template v-slot:prepend>
                    <Icon icon="tabler:users-plus" width="20" height="20" />
                </template>
                팀 추가
            </v-btn>
            <div v-else class="d-flex">
                <v-btn v-if="editUser.data.isTeam" color="primary" variant="flat" density="comfortable"
                    @click="openDialog('addUser')">
                    <template v-slot:prepend>
                        <Icon icon="tabler:user-plus" width="20" height="20" />
                    </template>
                    팀원 추가
                </v-btn>
                <v-btn color="info" class="ml-2" variant="flat" density="comfortable" @click="openDialog('edit')">
                    <template v-slot:prepend>
                        <Icon icon="tabler:user-edit" width="20" height="20" />
                    </template>
                    수정
                </v-btn>
                <v-btn color="error" class="ml-2" variant="flat" density="comfortable" @click="openDialog('delete')">
                    <template v-slot:prepend>
                        <Icon icon="tabler:user-minus" width="20" height="20" />
                    </template>
                    삭제
                </v-btn>
            </div>
        </div>
        <!-- organization chart -->
        <div id="tree" ref="tree" class="h-100"></div>
        <!-- dialogs -->
        <v-dialog v-model="dialog" max-width="500">
            <v-card v-if="dialogType == 'addTeam'">
                <v-card-title>팀 추가</v-card-title>
                <v-card-text class="text-center">
                    <v-avatar color="grey" rounded="0" size="100" class="mb-5">
                        <v-img src=""></v-img>
                    </v-avatar>
                    <v-text-field label="팀 ID"></v-text-field>
                    <v-text-field label="팀명"></v-text-field>
                </v-card-text>
                <v-card-actions class="pt-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="dialog = false">추가</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>

            <v-card v-if="dialogType == 'addUser'">
                <v-card-title>팀원 추가</v-card-title>
                <v-card-text class="text-center">
                    <v-select v-model="editUser.children" :items="allUsers" label="팀원" multiple item-title="data.name">
                        <template v-slot:selection="{ item, index }">
                            <v-chip v-if="index < 4">
                                <span>{{ item.raw.data.name }}</span>
                            </v-chip>
                            <span v-if="index === 4" class="text-grey text-caption align-self-center">
                                (+{{ editUser.children.length - 4 }} others)
                            </span>
                        </template>
                    </v-select>
                </v-card-text>
                <v-card-actions class="pt-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="dialog = false">추가</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>

            <v-card v-if="dialogType == 'edit'">
                <v-card-text class="text-center">
                    <v-avatar color="grey" rounded="0" size="100" class="mb-5">
                        <v-img v-if="editUser.data.img" :src="editUser.data.img"></v-img>
                    </v-avatar>
                    <v-select v-if="!editUser.data.isTeam" v-model="editUser.data.pid" :items="allTeams" item-title="name"
                        item-value="id" label="팀"></v-select>
                    <v-text-field v-model="editUser.data.name" label="이름"></v-text-field>
                    <v-text-field v-if="editUser.data.role" v-model="editUser.data.role" label="역할"></v-text-field>
                </v-card-text>
                <v-card-actions class="pt-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="dialog = false">수정</v-btn>
                    <v-btn color="error" @click="dialog = false">취소</v-btn>
                </v-card-actions>
            </v-card>

            <v-card v-if="dialogType == 'delete'">
                <v-card-text>
                    <div v-if="editUser.data.isTeam">'{{ editUser.data.name }}' 을/를 삭제하시겠습니까?</div>
                    <div v-else>'{{ currentTeam.name }}' 에서 '{{ editUser.data.name }}' 님을 삭제하시겠습니까?</div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="dialog = false">삭제</v-btn>
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
                    <img style='width: 45px; height: 45px; border-radius: 50%;' src='${content.img}' />
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
        },
    },
}
</script>

<style scoped>
#tree {
    width: 100%;
}

@media screen and (max-width: 1080px) {
    #tree {
        height: calc(100vh - 200px) !important;
    }
}
</style>

