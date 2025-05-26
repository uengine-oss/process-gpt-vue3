<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <Chat :name="$t(chatInfo.title)"
                    :messages="messages"
                    :chatInfo="chatInfo"
                    :userInfo="userInfo" 
                    :disableChat="disableChat"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                ></Chat>
            </template>

            <template v-slot:rightpart>
                <OrganizationChart
                        :node="organizationChart"
                        :key="organizationChart.id"
                        :userList="userList"
                        @updateNode="updateNode"
                        @addUser="openUserDialog"
                        ref="organizationChart"
                ></OrganizationChart>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :name="$t(chatInfo.title)"
                    :messages="messages"
                    :chatInfo="chatInfo"
                    :userInfo="userInfo" 
                    :disableChat="disableChat"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                ></Chat>
            </template>
        </AppBaseCard>
        <v-dialog v-model="userDialog" max-width="500">
            <v-card>
                <v-card-title>{{ $t('organizationChartDefinition.addNewUser') }}</v-card-title>
                <v-card-text>
                    <v-alert icon="$info" color="primary" variant="outlined" density="compact" class="mb-2">
                        <div class="text-body-1">{{ $t('organizationChartDefinition.addNewUserExplanation') }}</div>
                    </v-alert>
                    <div v-for="(user, index) in newUserList" :key="index" class="py-2">
                        <v-text-field 
                            v-model="user.name" 
                            :label="$t('organizationChartDefinition.userName')" 
                            :rules="nameRules"
                            class="mb-2"
                        ></v-text-field>
                        <v-text-field 
                            v-model="user.email" 
                            :label="$t('organizationChartDefinition.userEmail')" 
                            :rules="emailRules" 
                            class="mb-2"
                        ></v-text-field>
                        <v-text-field 
                            v-model="user.role" 
                            :label="$t('organizationChartDefinition.role')" 
                            class="mb-2"
                        ></v-text-field>
                        <v-divider></v-divider>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="createNewUser(newUserList)" :disabled="!isValid">
                        {{ $t('organizationChartDefinition.add') }}
                    </v-btn>
                    <v-btn color="error" @click="userDialog = false">
                        {{ $t('organizationChartDefinition.close') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import partialParse from "partial-json-parser";

import ChatGenerator from "@/components/ai/OrganizationChartGenerator";
import ChatModule from "@/components/ChatModule.vue";

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import Chat from "@/components/ui/Chat.vue";
import OrganizationChart from "@/components/ui/OrganizationChart.vue";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        OrganizationChart,
    },
    data: () => ({
        organizationChart: {},
        userList: [],
        chatInfo: {
            title: "organizationChartDefinition.cardTitle",
            text: "organizationChartDefinition.organizationChartExplanation"
        },
        userDialog: false,
        newUserList: [],
        organizationChartId: null,
        editingTeam: null,
    }),
    computed: {
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
            return this.newUserList.every(user => {
                return this.emailRules.every(rule => rule(user.email) === true) && this.nameRules.every(rule => rule(user.name) === true);
            });
        }
    },
    async mounted() {
        await this.init();
        const defaultName = window.$tenantName || window.$mode;

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        if (this.organizationChart && !this.organizationChart.id) {
            this.organizationChart = {
                id: "root",
                data: {
                    id: "root",
                    img: "",
                    name: defaultName,
                },
                children: []
            };
        }
    },
    methods: {
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
        async loadData(path) {
            const data = await this.getData(`configuration`, { match: { key: 'organization' } });
            if (data && data.value) {
                this.organizationChartId = data.uuid;
                if (data.value.chart) {
                    this.organizationChart = data.value.chart;
                    if (!this.organizationChart) {
                        this.organizationChart = [];
                    }
                }
            }

            await this.getChatList('organization_chart_chat');

            this.userList = await this.backend.getUserList();
            this.chatRoomId = 'organization_chart_chat';
        },
        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
            const msgObj = this.createMessageObj(newMessage);
            const putObj =  {
                id: 'organization_chart_chat',
                uuid: this.uuid(),
                messages: msgObj,
            };
            this.putObject("chats", putObj);
        },
        afterModelCreated(response) {
            let messageWriting = this.messages[this.messages.length - 1];

            if (messageWriting.jsonContent) {
                let unknown
                try {
                    unknown = partialParse(messageWriting.jsonContent);
                } catch(e) {
                    console.log(e)
                    unknown = JSON.parse(messageWriting.jsonContent)
                }

                if (unknown && !unknown.modifications) {
                    if (unknown.organizationChart) {
                        this.drawChart(unknown);
                    }
                }
            }
        },
        drawChart(obj) {
            if (obj && obj.organizationChart) {
                this.organizationChart = obj.organizationChart;
            }
        },
        async afterGenerationFinished(response) {
            try {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting.jsonContent) {
                    let unknown;
                    try {
                        unknown = JSON.parse(messageWriting.jsonContent)
                    } catch(e) {
                        try {
                            unknown = partialParse(messageWriting.jsonContent);
                        } catch(e) {
                            console.log(e)
                            return;
                        }
                    }

                    if (unknown && unknown.modifications) {
                        unknown.modifications.forEach(modification => {
                            if (modification.action == "replace") {
                                this.jsonPathReplace(this, modification.targetJsonPath, modification.value)
                            } else if (modification.action == "add") {
                                this.jsonPathAdd(this, modification.targetJsonPath, modification.value)
                            } else if (modification.action == "delete") {
                                this.jsonPathDelete(this, modification.targetJsonPath)
                            }
                        });
                    }

                    if (unknown && unknown.newUsers) {
                        this.newUserList = unknown.newUsers;
                        this.userDialog = true;
                    } else if (unknown && unknown.deleteUsers) {
                        this.deleteUser(unknown.deleteUsers);
                    } else {
                        var putObj =  {
                            key: 'organization',
                            value: {
                                chart: this.organizationChart,
                            },
                        };
                        this.drawChart(this.organizationChart);
                        if (this.organizationChartId) {
                            putObj.uuid = this.organizationChartId;
                        }
                        await this.putObject("configuration", putObj);
                    }
                }

                const newMessage = this.messages[this.messages.length - 1];
                var putObj =  {
                    id: 'organization_chart_chat',
                    uuid: this.uuid(),
                    messages: newMessage,
                };
                this.putObject("chats", putObj);
            } catch(e) {
                console.log(e);
            }
        },
        afterModelStopped(response) {
            const newMessage = this.messages[this.messages.length - 1];
            const putObj =  {
                id: 'organization_chart_chat',
                uuid: this.uuid(),
                messages: newMessage,
            };
            this.putObject("chats", putObj);
        },
        async createNewUser(users) {
            var me = this
            me.$try({
                action: async () => {
                    if (users && users.length > 0) {
                        users.forEach(async user => {
                            let userInfo = {
                                username: user.name,
                                email: user.email,
                                role: user.role
                            }
                            const result = await me.backend.createUser(userInfo);
                            if (!result.error) {
                                me.editingTeam.children.push({
                                    id: result.user.id,
                                    data: {
                                        id: result.user.id,
                                        img: "/images/defaultUser.png",
                                        name: user.name,
                                        email: user.email,
                                        role: user.role,
                                        pid: me.editingTeam.id,
                                    },
                                    name: user.name,
                                });
                                await me.updateNode();
                                me.$refs.organizationChart.drawTree();
                            }
                        });
                        me.userList = await me.backend.getUserList();
                    }
                    me.newUserList = [];
                    me.userDialog = false;
                },
                successMsg: me.$t('organizationChartDefinition.addUserSuccess'),
                errorMsg: me.$t('organizationChartDefinition.addUserFailed'),
            });
        },
        async deleteUser(users) {
            if (users && users.length > 0) {
                users.forEach(async user => {
                    const options = {
                        match: {
                            email: user.email,
                            username: user.name,
                        }
                    }
                    await this.storage.delete('users', options);
                });
                this.userList = await this.backend.getUserList();
            }
        },
        async updateNode() {
            var putObj =  {
                key: 'organization',
                value: {
                    chart: this.organizationChart,
                }
            };
            if (this.organizationChartId) {
                putObj.uuid = this.organizationChartId;
            }
            await this.putObject("configuration", putObj);
        },
        openUserDialog(value) {
            this.editingTeam = value;
            this.newUserList = [{
                name: "",
                email: "",
                role: "",
            }];
            this.userDialog = true;
        },
        isExistUser(value) {
            return this.userList.find(user => user.email == value);
        },
    }
}
</script>