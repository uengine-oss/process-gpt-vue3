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

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        OrganizationChart,
    },
    data: () => ({
        path: "organization",
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
            let value = await this.getData(`${path}/1`, {key: 'id'});

            if (value) {
                this.checkDisableChat(value);

                if (value.messages) {
                    this.messages = value.messages;
                }

                if (value.organization_chart && value.organization_chart.length > 0) {
                    let orgChart = JSON.parse(value.organization_chart);
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
                    console.log(er)
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
            let putObj =  {
                id: 1,
                messages: this.messages,
                organization_chart: "",
            };
            if (this.organizationChart) {
                chartText = JSON.stringify(this.organizationChart);
                putObj.organization_chart = chartText;

                this.drawChart(this.organizationChart);
            }
            this.putObject(this.path, putObj);
        },

        afterModelStopped(response) {
            let putObj =  {
                id: 1,
                messages: this.messages,
            };
            this.putObject(this.path, putObj);
        },
    }
}
</script>