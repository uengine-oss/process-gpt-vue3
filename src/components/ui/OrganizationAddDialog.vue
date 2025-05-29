<template>
    <v-card>
        <v-card-title>
            <v-tabs v-model="tab">
                <v-tab v-for="item in tabItems" :key="item.value" :value="item.value" color="primary">
                    {{ $t(item.text) }}
                </v-tab>
            </v-tabs>
        </v-card-title>
        <v-card-text>
            <v-window v-model="tab">
                <v-window-item value="user">
                    <v-autocomplete
                        v-model="selectedList" 
                        :items="teamMembers" 
                        item-title="data.name" 
                        :item-value="item => item" 
                        :label="$t('organizationChartDefinition.selectTeamMember')" 
                        variant="outlined"
                        class="my-2"
                        color="blue-grey-lighten-2" 
                        multiple 
                        chips 
                        closable-chips 
                        small-chips
                    >
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

                    <v-checkbox 
                        v-model="isNewUser" 
                        :label="$t('organizationChartDefinition.addNewUser')"
                        color="primary" 
                        density="compact"
                    ></v-checkbox>

                    <div v-if="isNewUser">
                        <v-alert icon="$info" color="primary" variant="outlined" density="compact" class="mb-4">
                            <div class="text-body-1">{{ $t('organizationChartDefinition.addNewUserExplanation') }}</div>
                        </v-alert>

                        <v-text-field 
                            v-model="newUser.name" 
                            :label="$t('organizationChartDefinition.userName')" 
                            :rules="nameRules"
                            class="mb-2"
                        ></v-text-field>
                        <v-text-field 
                            v-model="newUser.email" 
                            :label="$t('organizationChartDefinition.userEmail')" 
                            :rules="emailRules" 
                            class="mb-2"
                        ></v-text-field>
                        <v-text-field 
                            v-model="newUser.role" 
                            :label="$t('organizationChartDefinition.role')" 
                            class="mb-2"
                        ></v-text-field>
                    </div>
                </v-window-item>

                <v-window-item value="agent" class="py-2">
                    <AgentField v-model="newAgent" :idRules="idRules" :nameRules="nameRules" />
                </v-window-item>
            </v-window>
        </v-card-text>

        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="save" :disabled="!isValid">
                {{ $t('organizationChartDefinition.save') }}
            </v-btn>
            <v-btn color="error" @click="closeDialog">
                {{ $t('organizationChartDefinition.close') }}
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import AgentField from './field/AgentField.vue';

export default {
    components: {
        AgentField
    },
    props: {
        teamInfo: {
            type: Object,
            default: () => ({}),
        },
        userList: {
            type: Array,
            default: [],
        },
        agentList: {
            type: Array,
            default: [],
        },
    },
    data: () => ({
        tab: 'user',
        tabItems: [
            {
                text: 'organizationChartDefinition.addNewUser',
                value: 'user',
            },
            {
                text: 'organizationChartDefinition.addNewAgent',
                value: 'agent',
            },
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
        },
        // 에이전트 추가
        newAgent: {
            id: '',
            name: '',
            role: '',
            goal: '',
            persona: '',
            pid: '',
            img: '/images/chat-icon.png',
            isAgent: true
        },
    }),
    computed: {
        idRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.idRequired'),
            ];
        },
        emailRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.emailRequired'),
                (value) => /.+@.+\..+/.test(value) || this.$t('organizationChartDefinition.emailInvalid'),
                (value) => !this.isExistUser(value) || this.$t('organizationChartDefinition.emailAlreadyExists'),
            ];
        },
        nameRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.nameRequired'),
            ];
        },
        isValid() {
            if (this.tab == 'user') {
                if (this.isNewUser) {
                    return this.emailRules.every(rule => rule(this.newUser.email) === true) && this.nameRules.every(rule => rule(this.newUser.name) === true);
                } else {
                    return true;
                }
            } else {
                return this.idRules.every(rule => rule(this.newAgent.id) === true);
            }
        }
    },
    mounted() {
        if (this.teamInfo.id) {
            this.newUser.pid = this.teamInfo.id
            this.newAgent.pid = this.teamInfo.id
        }
        if (this.teamInfo.children) {
            this.selectedList = this.teamInfo.children
        }

        const allMembers = [...this.userList, ...this.agentList]
        this.teamMembers = allMembers.map(member => {
            if (member.username && member.profile) {
                return {
                    id: member.id,
                    name: member.username,
                    data: {
                        id: member.id,
                        name: member.username,
                        img: member.profile || '/images/defaultUser.png',
                        email: member.email,
                        role: member.role || '',
                        pid: this.teamInfo.id || ''
                    }
                }
            } else if (member.name && 'persona' in member) {
                return {
                    id: member.id,
                    name: member.name,
                    data: {
                        id: member.id,
                        name: member.name,
                        img: '/images/chat-icon.png',
                        role: member.role || '',
                        goal: member.goal || '',
                        persona: member.persona || '',
                        isAgent: true,
                        pid: this.teamInfo.id || ''
                    }
                }
            }
        })
    },
    methods: {
        closeDialog() {
            this.$emit('closeDialog')
        },
        save() {
            if (this.tab == 'user') {
                this.selectedList.map(member => {
                    member.data.id = member.id
                    member.data.pid = this.teamInfo.id
                })
                if (this.isNewUser) {
                    this.$emit('addUser', this.selectedList, this.newUser)
                } else {
                    this.$emit('addUser', this.selectedList, null)
                }
            } else {
                this.$emit('addAgent', this.newAgent)
            }
            this.closeDialog()
        },
    }
}
</script>
