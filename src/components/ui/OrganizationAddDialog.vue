<template>
    <v-card>
        <v-row class="ma-0 pa-4 pb-0 align-center">
            <v-card-title class="pa-0">
                {{teamInfo.data ? teamInfo.data.name : teamInfo.name}} {{ $t('OrganizationAddDialog.add') }}
            </v-card-title>
            <v-spacer></v-spacer>
            <v-btn @click="closeDialog"
                class="ml-auto" 
                variant="text" 
                density="compact"
                icon
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-row>
        <v-card-title class="pa-4 pb-0 pt-0">
            <v-tabs v-if="!isMobile" v-model="tab">
                <v-tab v-for="item in tabItems" :key="item.value" :value="item.value" color="primary">
                    {{ $t(item.text) }}
                </v-tab>
            </v-tabs>
            <!-- 모바일: 버튼 형태 -->
            <div v-else>
                <div class="d-flex flex-wrap ga-2">
                    <v-btn
                        v-for="item in tabItems"
                        :key="item.value"
                        :variant="tab === item.value ? 'flat' : 'text'"
                        :color="tab === item.value ? 'primary' : 'default'"
                        size="small"
                        @click="tab = item.value"
                    >
                        {{ $t(item.text) }}
                    </v-btn>
                </div>
            </div>
        </v-card-title>
        <v-card-text class="pa-4 pb-0">
            <v-window v-model="tab">
                <v-window-item value="user">
                    <v-autocomplete
                        v-if="!isNewUser"
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

                <v-window-item value="agent">
                    <AgentField v-model="newAgent"
                        class="agent-field-dialog-contents"
                        :nameRules="nameRules"
                        :teamInfo="teamInfo"
                        :dialogReset="dialogReset"
                    />
                </v-window-item>

                <v-window-item value="a2a">
                    <AgentField v-model="newAgent"
                        class="agent-field-dialog-contents"
                        :nameRules="nameRules"
                        :teamInfo="teamInfo"
                        :type="tab"
                        :dialogReset="dialogReset"
                    />
                </v-window-item>
            </v-window>
        </v-card-text>

        <v-row class="ma-0 pa-4 pr-2 pt-0 align-center">
            <v-spacer></v-spacer>
            <v-btn @click="save"
                :disabled="!isValid"
                color="primary"
                variant="elevated" 
                class="rounded-pill"
                density="compact"
            >{{ $t('organizationChartDefinition.save') }}</v-btn>
        </v-row>
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
            {
                // text: 'organizationChartDefinition.addNewA2A',
                text: 'A2A 에이전트 추가',
                value: 'a2a',
            },
        ],
        
        selectedList: [],
        teamMembers: [],
        dialogReset: false,

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
            isAgent: true,
            type: 'agent',
            url: '',
            description: '',
            tools: ''
        },
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
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
                    return this.newUser && 
                           this.emailRules.every(rule => rule(this.newUser.email) === true) && 
                           this.nameRules.every(rule => rule(this.newUser.name) === true);
                } else {
                    return true;
                }
            } else {
                return this.newAgent && this.nameRules.every(rule => rule(this.newAgent.name) === true);
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

        this.teamMembers = this.userList.map(member => {
            if (!member.is_agent) {
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
            } else {
                if ('persona' in member && member.persona !== '') {
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
                            isAgent: true,
                            type: 'agent',
                            pid: this.teamInfo.id || ''
                        }
                    }
                } else if ('url' in member && member.url !== '') {
                    return {
                        id: member.id,
                        name: member.username,
                        data: {
                            id: member.id,
                            name: member.username,
                            img: member.profile || '/images/chat-icon.png',
                            role: member.role || '',
                            url: member.url || '',
                            description: member.description || '',
                            skills: member.skills || '',
                            isAgent: true,
                            type: 'a2a',
                            pid: this.teamInfo.id || ''
                        }
                    }
                }
            }
        })
    },
    methods: {
        closeDialog() {
            this.$emit('closeDialog');
            this.dialogReset = true;
            // 다음 tick에서 false로 설정하여 다음 dialog open을 위해 준비
            this.$nextTick(() => {
                this.dialogReset = false;
            });
        },
        save() {
            if (this.tab == 'user') {
                this.selectedList.map(member => {
                    if (member && member.data) {
                        member.data.id = member.id
                        member.data.pid = this.teamInfo.id
                    }
                })
                if (this.isNewUser) {
                    this.$emit('addUser', this.selectedList, this.newUser)
                } else {
                    this.$emit('addUser', this.selectedList, null)
                }
            } else {
                this.newAgent.type = this.tab
                this.$emit('addAgent', this.newAgent)
            }
            this.closeDialog()
        },
        isExistUser(email) {
            return this.userList.some(user => user.email === email)
        }
    }
}
</script>
