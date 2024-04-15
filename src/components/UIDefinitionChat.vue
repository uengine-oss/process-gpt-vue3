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
                <mashup v-model="kEditorInput" @onChangeKEditorContent="updatePrevFormOutput"
                        :key="mashupKey" @onSaveFormDefinition="saveFormDefinition"
                        :storedFormDefData="storedFormDefData"/>
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
import * as jsondiff from 'jsondiffpatch';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import Mashup from '@/components/designer/Mashup.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/FormDesignGenerator';
import Chat from './ui/Chat.vue';

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
        ChatGenerator
    },
    data: () => ({
        path: 'form_def',
        chatInfo: {
            title: 'uiDefinition.cardTitle',
            text: "uiDefinition.uiDefinitionExplanation"
        },

        kEditorInput:``, // Mashup 컴포넌트의 KEditor을 업데이트하기 위해서 전달되는 값
        mashupKey: 0, // kEditorInput가 변경되었을 경우, Mashup 컴포넌트를 다시 렌더링하기 위해서

        prevFormOutput: "", // 폼 디자이너에게 이미 이전에 생성된 HTML 결과물을 전달하기 위해서
        prevMessageFormat: "", // 사용자가 KEditor를 변경할때마다 해당 포맷을 기반으로 System 메세지를 재구축해서 보내기 위해서

        storedFormDefData: null 
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
    },
    watch: {
        /**
         * URL에서 폼을 가리키는 ID가 변경되었을 경우, 재업데이트를 위해서
         */
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
    methods: {
        /**
         * KEditor의 내용이 변경될때마다 AI에게 변경된 내용을 전달하기 위해서
         */
        updatePrevFormOutput({html}) {
            this.prevFormOutput = html
        },

        /**
         * 'Save' 버튼을 누를 경우, 최종 결과를 Supabase에 저장하기 위해서
         */
        async saveFormDefinition({id, name, html}){
            await this.putObject("form_def", {
                id, name, html,
                messages: []
            });
            
            alert("저장 완료!")
        },


        /**
         * Supabase에서 Form 관련 데이터를 가져와서 KEditor에 반영하기 위해서 사용
         * @param {*} path 
         */
        async loadData(path) {
            if (this.$route.params.id && this.$route.params.id != 'chat') {
                path = `${this.path}/${this.$route.params.id}`
                this.storedFormDefData = await this.getData(path, { key: "id" })

                this.applyNewSrcToMashup(
                    this.loadHTMLToKEditorContent(this.storedFormDefData.html)
                )
            }
        },


        /**
         * AI에 메세지를 보내기 위해서 사용
         * @param {*} newMessage 
         */
        beforeSendMessage(newMessage) {
            this.generator.sendMessageWithPrevFormOutput(newMessage)
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

                let fragmentToParse = ""
                try {

                    const processedFragment = textFragment.match(/\{[\s\S]*\}/)[0].replaceAll("\n", "").replaceAll("`", `"`) // JSON에서 유효하지 않은 '\n', '`' 문자 제거
                    
                    
                    // AI가 잘못된 응답을 냈을 경우, 이를 대응하기 위한 수단들

                    // AI 응답이 `"` 문자열을 '\'로 파싱하지 않은 경우, 수동으로 파싱하기 위해서
                    const matchedHtmlOutput = processedFragment.match(/"htmlOutput"\s*:\s*"(.*)".*}/)[1]                  
                    if(matchedHtmlOutput.includes(`\\"`)) fragmentToParse = processedFragment
                    else fragmentToParse = processedFragment.replace(matchedHtmlOutput, matchedHtmlOutput.replaceAll(`"`, `\\"`))
                    
                    // AI 응답이 items에서 items='[{'남자':'male'},{'여자':'female'}' 와 같이 '안에서 "로 감싸지 않은 경우, 이를 대응하기 위해서
                    const matchedItems = [...fragmentToParse.matchAll(/items='(.*?)'>/g)].map((g) => g[1])
                    if(matchedItems) {
                        for (let j=0; j<matchedItems.length; j++) {
                            const matchedItem = matchedItems[j]
                            if(matchedItem.includes(`'`)) {
                                fragmentToParse = fragmentToParse.replace(matchedItem, matchedItem.replaceAll(`'`, `"`))
                            }
                        }
                    }

                } catch (error) {
                    console.log("### 유효 문자열을 JSON에 적합한 문자열로 변환시키는 과정에서 오류 발생! ###")
                    console.log(error)
                    console.log(textFragment)
                    return null
                }

                try {

                    return JSON.parse(fragmentToParse)

                } catch (error) {
                    console.log("### JSON 문자열을 최종 파싱하는 과정에서 오류 발생! ###")
                    console.log(error)
                    console.log(textFragment)
                    console.log(fragmentToParse)
                    return null
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
        applyNewSrcToMashup(kEditorInput) {
            this.kEditorInput = kEditorInput
            this.mashupKey += 1
        }
    },

    beforeDestroy() {
        this.kEditorInput = null;
    },
};
</script>

<style scoped></style>
