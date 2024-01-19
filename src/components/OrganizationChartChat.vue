<template>
    <AppBaseCard>
        <template v-slot:leftpart>
            <ChatUI :messages="messages"
                    :alertInfo="alertInfo"
                    :disableChat="disableChat"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
            ></ChatUI>
        </template>

        <template v-slot:rightpart>
            <OrganizationChart
                    :nodes="organizationChart"
                    :key="organizationChart.length"
            ></OrganizationChart>
        </template>

        <template v-slot:mobileLeftContent>
            <ChatUI :messages="messages"
                    :alertInfo="alertInfo"
                    :disableChat="disableChat"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
            ></ChatUI>
        </template>
    </AppBaseCard>
</template>

<script>
import ChatGenerator from "@/components/ai/OrganizationChartGenerator";
import ChatModule from "@/components/ChatModule.vue";

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import ChatUI from "@/components/ui/ChatUI.vue";
import OrganizationChart from "@/components/ui/OrganizationChart.vue";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        ChatUI,
        OrganizationChart,
    },
    data: () => ({
        path: "organization",
        organizationChart: [],
        userList: [],
        alertInfo: {
            title: "조직도 관리",
            text: "대화형으로 조직도를 관리하십시오.\n 팀(부서) 롤(역할), 직원들을 등록 수정 삭제할 수 있습니다. 예를 들어, '개발팀, 관리팀을 등록하고, 홍길동님을 신입사원으로 관리팀에 등록해줘. 이메일 주소는 new@company.com 이야. 역할은 개발자로 들어오셨어. 관리팀의 팀장은 아무개 팀장님이야.' 와 같은 명령을 할 수 있습니다.",
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
            let value = await this.getData(path);

            if (value) {
                this.checkDisableChat(value);

                if (value.organizationChart && value.organizationChart.length > 0) {
                    let orgChart = JSON.parse(value.organizationChart);
                    if (orgChart && orgChart.length > 0) {
                        this.organizationChart = orgChart;
                    }
                    if (!this.organizationChart) {
                        this.organizationChart = [];
                    }
                }
            }

            this.userList = await this.getData("enrolledUsers");
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

                    this.organizationChart.forEach(node => {
                        console.log(node)
                    });

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