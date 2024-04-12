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
                <mashup v-model="src" @change="checkHTML" :key="mashupKey"/>
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
        path: 'form_def',
        chatInfo: {
            title: 'uiDefinition.cardTitle',
            text: "uiDefinition.uiDefinitionExplanation"
        },
        processDefinitionMap: null,
        modeler: null,
        src:``,

        prevFormOutput: "", // 폼 디자이너에게 이미 이전에 생성된 HTML 결과물을 전달하기 위해서
        mashupKey: 0 // src가 변경되었을 경우, Mashup 컴포넌트를 다시 렌더링하기 위해서
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
    },
    beforeDestroy() {
        this.src = null;
    },
    async mounted() {


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
        checkHTML({kEditorContent, html}) {
            console.log(html)
            localStorage["keditor.editing.content"] = kEditorContent;
        },


        /**
         * Supabase에서 Form 관련 데이터를 가져와서 KEditor에 반영하기 위해서 사용
         * @param {*} path 
         */
        async loadData(path) {
            if (this.$route.params.id && this.$route.params.id != 'chat') {
                path = `${this.path}/${this.$route.params.id}`
                const formDefData = await this.getData(path, { key: "id" })

                this.applyNewSrcToMashup(
                    this.loadHTMLToKEditorContent(formDefData.html)
                )
            }
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
                if(messageWriting.jsonContent) {
                    this.applyNewSrcToMashup(
                        this.loadHTMLToKEditorContent(messageWriting.jsonContent.htmlOutput)
                    )
                }

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

                try {

                    const processedFragment = textFragment.match(/\{[\s\S]*\}/)[0].replaceAll("\n", "").replaceAll("`", `"`)
                    return JSON.parse(processedFragment)

                } catch (error) {
                    console.log("유효 문자열 JSON 파싱 과정에서 오류 발생!")
                    console.log(error)
                    console.log(textFragment)
                }
            }

            return null
        },

        /**
         * AI가 생성한 결과물을 KEditor에 적합한 Html 형식으로 변환하기 위해서
         * @param {*} aiResult AI가 생성한 결과물
         */
        loadHTMLToKEditorContent(aiResult) {
            const dom = new DOMParser().parseFromString(aiResult, 'text/html')


            // 컨테이너인 경우, data-type 속성을 추가해서 KEditor에서 인식할 수 있도록 만들기 위해서서
            const nodes = dom.querySelectorAll('[class^="col-sm-"]')
            nodes.forEach(node => {
                node.setAttribute('data-type', 'container-content')
            })

            // 컴포넌트인 경우, `vuemount_${crypto.randomUUID()}`를 id를 가지는 div로 감싸도록 만들기
            // 해당 div마다 추후에 createApp으로 렌더링의 대상이되고, ref를 통해서 접근할 수 있도록 함
            const components = Array.from(dom.querySelectorAll('*')).filter(el => el.tagName.toLowerCase().endsWith('-field'));
            components.forEach(component => {
                const parent = document.createElement('div')
                parent.setAttribute('id', `vuemount_${crypto.randomUUID()}`)

                component.parentNode.insertBefore(parent, component)
                parent.appendChild(component)
            })

            // Section이 없는 경우, Section으로 감싸서 새로 생성하고, 있는 경우 그대로 사용함
            let targetSection = null
            if(dom.body.children.length === 1 && dom.body.children[0].tagName.toLowerCase() !== 'section') {
                const section = document.createElement('section')
                section.innerHTML = dom.body.innerHTML
                targetSection = section
            }
            else 
                targetSection = dom.body.children[0]

            // KEdtior에서 인식할 수 있도록 클래스 추가하기
            targetSection.setAttribute('class', 'keditor-ui keditor-container-inner')


            return targetSection.outerHTML.replace(/&quot;/g, `'`)
        },

        /**
         * mashup에 새로운 src를 제공해서 재랜더링하기 위해서
         */
         applyNewSrcToMashup(src) {
            this.src = src
            this.mashupKey += 1
        }
    }
};
</script>

<style scoped></style>
