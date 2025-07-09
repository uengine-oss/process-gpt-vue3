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
                        @updateAgent="updateAgent"
                        @addMember="openAddDialog"
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
        <v-dialog 
            v-model="addDialog" 
            :max-width="isMobile ? '100vw' : 500"
            :fullscreen="isMobile"
        >
            <OrganizationAddDialog
                :teamInfo="editNode"
                :userList="userList"
                @addUser="addUser"
                @addAgent="addAgent"
                @closeDialog="closeAddDialog"
            ></OrganizationAddDialog>
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
import OrganizationAddDialog from "@/components/ui/OrganizationAddDialog.vue";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        OrganizationChart,
        OrganizationAddDialog,
    },
    data: () => ({
        organizationChart: {},
        organizationChartId: null,
        chatInfo: {
            title: "organizationChartDefinition.cardTitle",
            text: "organizationChartDefinition.organizationChartExplanation"
        },
        addDialog: false,
        userList: [],
        editNode: null,
    }),
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
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
    },
    watch: {
        organizationChart: {
            deep: true,
            async handler(newVal) {
                this.userList = await this.backend.getUserList();
            }
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
            this.chatRoomId = 'organization_chart_chat';
            await this.getMessages(this.chatRoomId);

            this.userList = await this.backend.getUserList();
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
        async createNewUser(user) {
            var me = this
            me.$try({
                action: async () => {
                    let userInfo = {
                        username: user.name,
                        email: user.email,
                        role: user.role
                    }
                    const result = await me.backend.createUser(userInfo);
                    if (!result.error) {
                        me.editNode.children.push({
                            id: result.user.id,
                            data: {
                                id: result.user.id,
                                img: "/images/defaultUser.png",
                                name: user.name,
                                email: user.email,
                                role: user.role,
                                pid: me.editNode.id,
                            },
                            name: user.name,
                        });
                        await me.updateNode();
                        me.$refs.organizationChart.drawTree();
                    }
                },
                successMsg: me.$t('organizationChartDefinition.addUserSuccess'),
                errorMsg: me.$t('organizationChartDefinition.addUserFailed'),
            });
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

        // dialog 관련
        openAddDialog(value) {
            this.editNode = value;
            this.addDialog = true;
        },
        closeAddDialog() {
            this.addDialog = false;
        },
        async addUser(addUserList, newUser) {
            if (newUser) {
                await this.createNewUser(newUser);
            }
            if (addUserList && addUserList.length > 0) {
                this.editNode.children = addUserList;
            }
            await this.updateNode();
            this.$refs.organizationChart.drawTree();
        },
        async addAgent(newAgent) {
            const agent = {
                id: newAgent.id,
                name: newAgent.name,
                data: newAgent
            }
            this.editNode.children.push(agent);
            await this.backend.putAgent(newAgent);
            await this.updateNode();
            this.$refs.organizationChart.drawTree();
        },
        async updateAgent(type, editAgent) {
            if (type == 'edit-agent') {
                await this.backend.putAgent(editAgent.data);
            } else if (type == 'delete') {
                await this.backend.deleteAgent(editAgent.id);
            }
        },
    }
}
</script>