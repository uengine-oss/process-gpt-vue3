<template>
    <AppBaseCard>
        <template v-slot:leftpart>
            <Chat :messages="messages"
                :chatInfo="chatInfo"
                :userInfo="userInfo" 
                :disableChat="disableChat"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @stopMessage="stopMessage"
                @getMoreChat="getMoreChat"
            ></Chat>
        </template>

        <template v-slot:rightpart>
            <OrganizationChart
                    :node="organizationChart"
                    :key="organizationChart.id"
            ></OrganizationChart>
        </template>

        <template v-slot:mobileLeftContent>
            <Chat :messages="messages"
                :chatInfo="chatInfo"
                :userInfo="userInfo" 
                :disableChat="disableChat"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @stopMessage="stopMessage"
            ></Chat>
        </template>
    </AppBaseCard>
</template>

<script>
import partialParse from "partial-json-parser";

import ChatGenerator from "@/components/ai/OrganizationChartGenerator";
import ChatModule from "@/components/ChatModule.vue";

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import Chat from "@/components/ui/Chat.vue";
import OrganizationChart from "@/components/ui/OrganizationChart.vue";

const storageKey = 'configuration'

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        OrganizationChart,
    },
    data: () => ({
        organizationChart: [],
        userList: [],
        chatInfo: {
            title: "organizationChartDefinition.cardTitle",
            text: "organizationChartDefinition.organizationChartExplanation"
        },
    }),
    async created() {
        await this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });
    },
    methods: {
        async loadData(path) {
            const data = await this.getData(`${storageKey}/organization`, {key: 'key'});

            if (data && data.value) {
                if (data.value.chart) {
                    this.organizationChart = data.value.chart;
                    console.log(data.value.chart)
                    if (!this.organizationChart) {
                        this.organizationChart = [];
                    }
                }
            }

            const message = await this.getData(`${storageKey}/organization_chat`, {key: 'key'});
            if (message && message.value) {
                if (message.value.message) {
                    this.messages = message.value.message
                }
            }

            this.userList = await this.storage.list("users");
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
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
            let messageWriting = this.messages[this.messages.length - 1];

            if (messageWriting.jsonContent) {
                let unknown
                try {
                    unknown = partialParse(messageWriting.jsonContent);
                } catch(e) {
                    console.log(e)
                    unknown = JSON.parse(messageWriting.jsonContent)
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
                    this.createNewUser(unknown.newUsers);
                }
                if (unknown && unknown.deleteUsers) {
                    this.deleteUser(unknown.deleteUsers);
                }

                const putObj =  {
                    key: 'organization',
                    value: {
                        chart: this.organizationChart,
                    }
                };
                this.drawChart(this.organizationChart);
                this.putObject(storageKey, putObj);
            }

            const msgObj =  {
                key: 'organization_chat',
                value: {
                    message: this.messages,
                }
            };
            this.putObject(storageKey, msgObj);
        },

        afterModelStopped(response) {
            const putObj =  {
                key: 'organization_chat',
                value: {
                    message: this.messages,
                }
            };
            this.putObject(storageKey, putObj);
        },

        async createNewUser(users) {
            if (users && users.length > 0) {
                users.forEach(async user => {
                    let userInfo = {
                        username: user.name,
                        email: user.email,
                        password: '000000',
                    }
                    const result = await this.storage.createUser(userInfo);
                    if (result.user) {
                        userInfo = {
                            id: result.user.id,
                            username: user.name,
                            email: user.email,
                        }
                        await this.putObject('users', userInfo);
                    }
                });
                this.userList = await this.storage.list("users");
            }
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
                this.userList = await this.storage.list("users");
            }
        }
    }
}
</script>