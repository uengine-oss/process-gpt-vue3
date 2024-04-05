<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                    <Chat :chatInfo="chatInfo" :messages="messages" :userInfo="userInfo"
                        @sendMessage="beforeSendMessage" @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage"
                    ></Chat>
                </div>
            </template>
            <template v-slot:rightpart>
                <mashup v-model="src" @change="checkHTML"/>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :chatInfo="chatInfo" :messages="messages" :userInfo="userInfo"
                        @sendMessage="beforeSendMessage" @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage"
                    ></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>

import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import Mashup from '@/components/designer/Mashup.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import * as jsondiff from 'jsondiffpatch';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/FormDesignGenerator';
import Chat from './ui/Chat.vue';
// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    },
});
export default {
    mixins: [ChatModule],
    name: 'ProcessDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        Mashup,
        // BpmnModelingCanvas,
        ChatGenerator
    },
    data: () => ({
        uiCode: null,
        changedXML: "",
        projectName: '',
        path: 'ui',
        chatInfo: {
            title: 'uiDefinition.cardTitle',
            text: "uiDefinition.uiDefinitionExplanation"
        },
        processDefinitionMap: null,
        modeler: null,
        src:null,

        formOutput: "", // 폼 디자이너에서 생성된 결과물을 보여주기 위해서
        prevFormOutput: "" // 폼 디자이너에게 이미 이전에 생성된 HTML 결과물을 전달하기 위해서
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        this.src = localStorage["keditor.editing.content"]
    },
    beforeDestroy() {
        this.src = null;
    },
    mounted() {
        // if (this.$route.query && this.$route.query.id) {
        //     this.processDefinition = {
        //         processDefinitionId: this.$route.query.id
        //     }
        //     if (this.$route.query.name) {
        //         this.projectName = this.$route.query.name;
        //         this.processDefinition.processDefinitionName = this.projectName;
        //     }
        // }
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (newVal.params.id && newVal.params.id != 'chat') {
                        this.loadData();
                    }
                }
            }
        },
       
    },
    computed: {
        
    },
    methods: {
        checkHTML(html) {
            localStorage["keditor.editing.content"] = html;
        },


        /**
         * AI 관련 데이터 초기화하기 위해서 사용
         * @param {*} path 
         */
        async loadData(path) {

        },


        /**
         * AI에 메세지를 보내기 위해서 사용
         * @param {*} newMessage 
         */
        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },



        /**
         * AI 메세지에서 실시간으로 JSON을 추출하기 위해서
         * @param {*} response 
         */
        async afterModelCreated(response) {
            this.processResponse(response)
        },

        /**
         * 최종적인 AI 메세지에서 JSON을 추출하기 위해서
         * @param {*} response 
         */
        afterGenerationFinished(response) {
            this.processResponse(response)
        },

        /**
         * AI의 결과물에서 JSON을 추출하고, 생성된 HTML을 보여주기 위해서
         */
        processResponse(response) {
            try {

                // AI의 응답에서 JSON을 추출하기 위해서
                let messageWriting = this.messages[this.messages.length - 1]
                messageWriting.jsonContent = this.extractLastJSON(response);
                messageWriting.content = messageWriting.content.replace(messageWriting.jsonContent, "")

                // 생성된 HTML을 보여주기 위해서
                if(messageWriting.jsonContent) 
                    this.formOutput = messageWriting.jsonContent.htmlOutput

            } catch (error) {
                console.log(error);
            }
        },


        /**
         * 마지막 최종 결과 Html이 표시된 JSON을 추출하기 위해서
         */
        extractLastJSON(inputString) {
            const textFragments = inputString.split("```")
            for (let i=textFragments.length - 1; i>=0; i--) {
                const textFragment = textFragments[i]
                if((!textFragment.includes("{")) || (!textFragment.includes("}")) || (!textFragment.includes("htmlOutput"))) continue

                const processedFragment = textFragment.match(/\{[\s\S]*\}/)[0].replaceAll("\n", "").replaceAll("`", `"`)
                return JSON.parse(processedFragment)
            }

            return null
        }
    }
};
</script>

<style scoped></style>
