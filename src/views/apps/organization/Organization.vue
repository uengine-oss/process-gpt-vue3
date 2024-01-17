<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <Chat
                    :messages="messages"
                    @sendMessage="beforeSendMessage"
                    @editSendMessage="editSendMessage"
                ></Chat>
            </template>

            <template v-slot:rightpart>
                <OrganizationChart
                    :nodes="organizationChart" 
                    :key="organizationChart.length"
                ></OrganizationChart>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat
                    :messages="messages"
                    :userInfo="userInfo"
                    @sendMessage="beforeSendMessage"
                    @editSendMessage="editSendMessage"
                ></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
// common components
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
// component
import OrganizationChart from '@/components/apps/organization/OrganizationChart.vue'
import Chat from '@/components/ui/Chat.vue';

import ChatGenerator from "@/components/ai/OrganizationChartGenerator";
import ChatModule from "@/components/ChatModule.vue";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        OrganizationChart,
        Chat,
    },
    data: () => ({
        path: "organization",
        organizationChart: [],
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
            const value = await this.getData(path);

            if (value) {
                if (value.organizationChart && value.organizationChart.length > 0) {
                    let orgChart = JSON.parse(value.organizationChart);
                    if (orgChart && orgChart.length > 0) {
                        this.organizationChart = orgChart;
                    }
                    if (!this.organizationChart) {
                        this.organizationChart = []
                    }
                }
            }
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },

        afterModelCreated(response) {
            this.drawChart(response);
        },

        drawChart(textData) {
            let json = this.extractJSON(textData)

            try {
                let obj = JSON.parse(json);

                if(obj && obj.organizationChart) {
                    this.organizationChart = obj.organizationChart;

                    this.organizationChart.forEach(node => node.img=`https://randomuser.me/api/portraits/women/${Math.round(Math.random() * 90)}.jpg`);

                }
            } catch (error) {
                console.log(error);
            }
        },

        afterGenerationFinished() {
            let chartText = "";
            let putObj =  {
                messages: this.messages,
                organizationChart: "",
            };

            if (this.organizationChart) {
                chartText = JSON.stringify(this.organizationChart);
                putObj.organizationChart = chartText;
            }

            this.putObject(this.path, putObj);
        },
    }
}
</script>