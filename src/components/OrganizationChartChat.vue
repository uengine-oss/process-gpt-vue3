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
                    :nodes="organizationChart"
                    :key="organizationChart.length"
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
                this.checkDisableChat(data.value);

                if (data.value.messages) {
                    this.messages = value.messages;
                }

                if (data.value.chart && data.value.chart.length > 0) {
                    let orgChart = JSON.parse(data.value.chart);
                    if (orgChart && orgChart.length > 0) {
                        this.organizationChart = orgChart;
                    }
                    if (!this.organizationChart) {
                        this.organizationChart = [];
                    }
                }
            }

            this.userList = await this.getData("users");
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
                    this.drawChart(unknown);
                }
            }
        },

        drawChart(obj) {
            if(obj && obj.organizationChart) {
                this.organizationChart = obj.organizationChart;
            }
        },

        afterGenerationFinished(response) {
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
            }

            let chartText = "";
            const putObj =  {
                key: 'organization',
                value: {
                    messages: this.messages,
                    chart: "",
                }
            };
            if (this.organizationChart) {
                chartText = JSON.stringify(this.organizationChart);
                putObj.value.chart = chartText;
                this.drawChart(this.organizationChart);
                this.putObject(storageKey, putObj);
            }
        },

        afterModelStopped(response) {
            const putObj =  {
                key: 'organization',
                value: {
                    messages: this.messages,
                }
            };
            this.putObject(storageKey, putObj);
        },
    }
}
</script>