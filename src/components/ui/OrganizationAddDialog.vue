<template>
    <div>
        <!-- 팀 선택 -->
        <div class="pa-4 pb-2">
            <v-autocomplete
                v-model="selectedTeam"
                :items="teamList"
                item-title="data.name"
                :item-value="(item) => item"
                label="팀 선택"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-account-group"
                hide-details
                @update:model-value="selectTeam"
            ></v-autocomplete>
        </div>

        <!-- 팀 관리 버튼 -->
        <div class="px-4 pb-2">
            <div class="d-flex ga-2 justify-end flex-wrap">
                <v-btn
                    v-for="button in teamButtons"
                    :key="button.type"
                    @click="openTeamDialog(button.type)"
                    :color="button.color"
                    variant="flat"
                    class="rounded-pill text-none"
                    size="small"
                    :prepend-icon="button.icon"
                    :disabled="button.disabled && !selectedTeam"
                >
                    {{ $t(button.label) }}
                </v-btn>
            </div>
        </div>

        <v-divider v-if="selectedTeam" class="mb-2"></v-divider>

        <!-- 팀 관리 다이얼로그 -->
        <v-dialog v-model="teamDialog" max-width="500">
            <OrganizationTeamDialog
                :dialogType="teamDialogType"
                :editNode="selectedTeam"
                @updateTeam="handleTeamUpdate"
                @closeDialog="closeTeamDialog"
            />
        </v-dialog>

        <!-- 선택된 팀에 멤버 추가 -->
        <div v-if="selectedTeam">
            <v-card-text
                class="pa-4 pb-0 pt-0"
                style="max-height: calc(100vh - 300px); overflow: auto"
            >
                <v-autocomplete
                    v-if="!isNewUser"
                    v-model="selectedList"
                    :items="teamMembers"
                    item-title="data.name"
                    :item-value="(item) => item"
                    :label="$t('organizationChartDefinition.selectTeamMember')"
                    variant="outlined"
                    class="my-2"
                    color="blue-grey-lighten-2"
                    multiple
                    chips
                    closable-chips
                    small-chips
                    hide-details
                >
                    <template v-slot:chip="{ props, item }">
                        <v-chip
                            v-if="item.raw.data.img"
                            v-bind="props"
                            :prepend-avatar="item.raw.data.img"
                            :text="item.raw.data.name"
                        ></v-chip>
                        <v-chip v-else v-bind="props" prepend-icon="mdi-account-circle" :text="item.raw.data.name"></v-chip>
                    </template>
                    <template v-slot:item="{ props, item }">
                        <v-list-item
                            v-if="item.raw.data.img"
                            v-bind="props"
                            :prepend-avatar="item.raw.data.img"
                            :title="item.raw.data.name"
                            :subtitle="item.raw.data.email"
                        ></v-list-item>
                        <v-list-item v-else v-bind="props" :title="item.raw.data.name" :subtitle="item.raw.data.email">
                            <template v-slot:prepend>
                                <v-icon style="position: relative; margin-right: 10px; margin-left: -3px" size="48"
                                    >mdi-account-circle</v-icon
                                >
                            </template>
                        </v-list-item>
                    </template>
                </v-autocomplete>
            </v-card-text>

            <v-row class="ma-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn @click="save" :disabled="!isValid" color="primary" rounded variant="flat">
                    {{ $t('organizationChartDefinition.save') }}
                </v-btn>
            </v-row>
        </div>
    </div>
</template>

<script>
import OrganizationTeamDialog from './OrganizationTeamDialog.vue';

export default {
    components: {
        OrganizationTeamDialog
    },
    props: {
        teamInfo: {
            type: Object,
            default: () => ({})
        },
        userList: {
            type: Array,
            default: []
        },
        organizationChart: {
            type: Object,
            default: () => ({})
        }
    },
    data: () => ({
        selectedTeam: null,
        teamDialog: false,
        teamDialogType: 'add',
        teamButtons: [
            {
                type: 'delete',
                label: 'organizationChartDefinition.deleteTeam',
                icon: 'mdi-delete',
                color: 'error',
                disabled: true
            },
            {
                type: 'edit',
                label: 'organizationChartDefinition.editTeam',
                icon: 'mdi-pencil',
                color: 'grey',
                disabled: true
            },
            {
                type: 'add',
                label: 'organizationChartDefinition.addTeam',
                icon: 'mdi-plus',
                color: 'primary',
                disabled: false
            }
        ],

        selectedList: [],
        teamMembers: [],

        // 신규 사용자(팀원) 추가
        isNewUser: false,
        newUser: {
            name: '',
            email: '',
            role: '',
            pid: '',
            img: '/images/defaultUser.png'
        }
    }),
    computed: {
        teamList() {
            if (!this.organizationChart || !this.organizationChart.children) {
                return [];
            }
            return this.organizationChart.children.filter((child) => child.data && child.data.isTeam);
        },
        emailRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.emailRequired'),
                (value) => /.+@.+\..+/.test(value) || this.$t('organizationChartDefinition.emailInvalid'),
                (value) => !this.isExistUser(value) || this.$t('organizationChartDefinition.emailAlreadyExists')
            ];
        },
        nameRules() {
            return [(value) => !!value || this.$t('organizationChartDefinition.nameRequired')];
        },
        isValid() {
            if (this.isNewUser) {
                return (
                    this.newUser &&
                    this.emailRules.every((rule) => rule(this.newUser.email) === true) &&
                    this.nameRules.every((rule) => rule(this.newUser.name) === true)
                );
            }
            return true;
        }
    },
    watch: {
        teamInfo: {
            immediate: true,
            handler(newVal) {
                if (newVal && newVal.id) {
                    this.selectedTeam = newVal;
                    // teamInfo 변경 시에도 selectTeam을 호출하여 teamMembers 업데이트
                    this.selectTeam();
                }
            }
        },
        organizationChart: {
            immediate: true,
            deep: true,
            handler(newVal) {
                if (!this.selectedTeam && newVal && newVal.children) {
                    const teams = newVal.children.filter((child) => child.data && child.data.isTeam);
                    if (teams.length > 0) {
                        this.selectedTeam = teams[0];
                        // 초기 선택 시에도 selectTeam을 호출하여 teamMembers 업데이트
                        this.selectTeam();
                    }
                }
            }
        },
        userList: {
            immediate: true,
            deep: true,
            handler() {
                // userList가 변경되면 teamMembers도 업데이트
                if (this.selectedTeam) {
                    this.updateTeamData();
                }
            }
        }
    },
    mounted() {
        if (this.teamInfo && this.teamInfo.id) {
            this.selectedTeam = this.teamInfo;
        } else if (this.teamList && this.teamList.length > 0) {
            this.selectedTeam = this.teamList[0];
        }
        // 초기 선택 시에도 selectTeam을 호출하여 teamMembers 업데이트
        if (this.selectedTeam) {
            this.selectTeam();
        }
    },
    methods: {
        openTeamDialog(type) {
            this.teamDialogType = type;
            this.teamDialog = true;
        },
        closeTeamDialog() {
            this.teamDialog = false;
        },
        handleTeamUpdate(type, editNode, newTeam) {
            this.$emit('updateTeam', type, editNode, newTeam);
            this.closeTeamDialog();
        },
        selectTeam() {
            this.updateTeamData();
        },
        updateTeamData() {
            if (!this.selectedTeam) {
                return;
            }

            this.newUser.pid = this.selectedTeam.id;

            if (this.selectedTeam.children) {
                this.selectedList = this.selectedTeam.children;
            } else {
                this.selectedList = [];
            }

            this.teamMembers = this.userList.map((member) => {
                const memberIsAgent = member.isAgent ?? member.is_agent ?? false;
                if (!memberIsAgent) {
                    return {
                        id: member.id,
                        name: member.username,
                        data: {
                            id: member.id,
                            name: member.username,
                            img: member.profile || '/images/defaultUser.png',
                            email: member.email,
                            role: member.role || '',
                            pid: this.selectedTeam ? this.selectedTeam.id : ''
                        }
                    };
                } else {
                    if (member.agent_type == 'a2a') {
                        return {
                            id: member.id,
                            name: member.username,
                            data: {
                                id: member.id,
                                name: member.username,
                                img: member.profile || '/images/chat-icon.png',
                                role: member.role || '',
                                endpoint: member.endpoint || '',
                                description: member.description || '',
                                skills: member.skills || '',
                                isAgent: member.is_agent || true,
                                type: member.agent_type,
                                pid: this.selectedTeam ? this.selectedTeam.id : ''
                            }
                        };
                    } else if (member.agent_type == 'pgagent') {
                        return {
                            id: member.id,
                            name: member.username,
                            data: {
                                id: member.id,
                                name: member.username,
                                img: member.profile || '/images/chat-icon.png',
                                role: member.role || '',
                                description: member.description || '',
                                skills: member.skills || '',
                                isAgent: member.is_agent || true,
                                type: member.agent_type,
                                pid: this.selectedTeam ? this.selectedTeam.id : '',
                                alias: member.alias || ''
                            }
                        };
                    } else {
                        return {
                            id: member.id,
                            name: member.username,
                            data: {
                                id: member.id,
                                name: member.username,
                                img: member.profile || '/images/chat-icon.png',
                                role: member.role || '',
                                goal: member.goal || '',
                                persona: member.persona || '',
                                tools: member.tools || '',
                                isAgent: member.is_agent || true,
                                type: member.agent_type || 'agent',
                                pid: this.selectedTeam ? this.selectedTeam.id : ''
                            }
                        };
                    }
                }
            });
        },
        closeDialog() {
            this.$emit('closeDialog');
        },
        save() {
            if (!this.selectedTeam) {
                return;
            }

            this.selectedList.map((member) => {
                if (member && member.data) {
                    member.data.id = member.id;
                    member.data.pid = this.selectedTeam.id;
                }
            });
            if (this.isNewUser) {
                this.$emit('addUser', this.selectedTeam, this.selectedList, this.newUser);
            } else {
                this.$emit('addUser', this.selectedTeam, this.selectedList, null);
            }
        },
        isExistUser(email) {
            return this.userList.some((user) => user.email === email);
        }
    }
};
</script>

<style scoped>
.team-list-item {
    cursor: pointer;
}
</style>
