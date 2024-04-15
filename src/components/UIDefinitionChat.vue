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
                <mashup v-if="isShowMashup" ref="mashup" v-model="kEditorInput" :key="mashupKey" 
                        @onSaveFormDefinition="saveFormDefinition" :storedFormDefData="storedFormDefData"/>
                <card v-else class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                </card>
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

        storedFormDefData: null ,
        isShowMashup: false
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
                    if (newVal.params.id && newVal.params.id != 'chat')
                        this.loadData();
                    else
                        this.isShowMashup = true
                } else
                    this.isShowMashup = true
            }
        }, 
    },
    methods: {
        /**
         * 'Save' 버튼을 누를 경우, 최종 결과를 Supabase에 저장하기 위해서
         */
        async saveFormDefinition({id, name, html}){
            const isNewSave = (this.$route.params.id !== id)
            if(isNewSave) {
                const isFormAlreadyExist = (await this.getData(`form_def/${id}`, { key: "id" }) !== null)
                if(isFormAlreadyExist) {
                    if(!confirm(`'${id}'는 이미 존재하는 폼 디자인 ID 입니다! 그래도 저장하시겠습니까?`))
                        return
                }
            }


            await this.putObject("form_def", {
                id, name, html,
                messages: []
            });
            
            
            alert("저장 완료!")
            if(isNewSave) {
                this.$router.push(`/ui-definitions/${id}`)
            }
        },


        /**
         * Supabase에서 Form 관련 데이터를 가져와서 KEditor에 반영하기 위해서 사용
         * @param {*} path 
         */
        async loadData(path) {
            if (this.$route.params.id && this.$route.params.id != 'chat') {
                path = `${this.path}/${this.$route.params.id}`
                this.storedFormDefData = await this.getData(path, { key: "id" })
                if(!this.storedFormDefData) {
                    alert(`'${this.$route.params.id}' ID 를 가지는 폼 디자인 정보가 없습니다! 새 폼 만들기 화면으로 이동됩니다.`)
                    this.$router.push(`/ui-definitions/chat`)
                    this.isShowMashup = true
                    return
                }

                this.applyNewSrcToMashup(
                    this.loadHTMLToKEditorContent(this.storedFormDefData.html)
                )
                this.isShowMashup = true
            }
            else
                this.isShowMashup = true
        },


        /**
         * AI에 메세지를 보내기 위해서 사용
         * @param {*} newMessage 
         */
        beforeSendMessage(newMessage) {
            this.prevFormOutput = this.$refs.mashup.getKEditorContentHtml()
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
                // 속성중에서 name, alias인 경우, [가-힣a-zA-Z0-9_\-. ]에 해당하는 문자가 아닌 경우, 전부 제거함
                ['name', 'alias'].forEach(attr => {
                    if(component.hasAttribute(attr)) {
                        const validChars = component.getAttribute(attr).match(/[가-힣a-zA-Z0-9_\-. ]/g);
                        const cleanedAttr = validChars ? validChars.join('') : attr;
                        component.setAttribute(attr, cleanedAttr);
                    }
                });

                // 속성중에서 items인 경우, 키와 값 각각이 [가-힣a-zA-Z0-9_\-. ]에 해당하는 문자가 아닌 경우, 전부 제거함
                if(component.hasAttribute("items"))
                {
                    try {

                        let items = JSON.parse(component.getAttribute("items").replace(/'/g, '"'))
                        let newItems = []

                        items.forEach(item => {
                            Object.keys(item).forEach(key => {
                                const value = item[key];
                                const validKeyChars = key.match(/[가-힣a-zA-Z0-9_\-. ]/g);
                                const validValueChars = value.match(/[가-힣a-zA-Z0-9_\-. ]/g);

                                const cleanedKey = validKeyChars ? validKeyChars.join('') : '';
                                const cleanedValue = validValueChars ? validValueChars.join('') : '';
                                newItems.push({[cleanedKey]: cleanedValue })
                            });
                        });

                        component.setAttribute("items", JSON.stringify(newItems));

                    } catch(error) {
                        console.log(error)
                        component.setAttribute("items", "[]")
                    }
    
                }

                const parent = document.createElement('div')
                parent.setAttribute('id', `vuemount_${crypto.randomUUID()}`)

                // AI 예외 처리
                // component의 태그명이 'date-field'인 경우, 'text-field'태그로 name, alias 속성을 가지도록 추가
                if(component.tagName.toLowerCase() === 'date-field') {
                    const textField = document.createElement('text-field')
                    textField.setAttribute("name", component.getAttribute("name") ?? "name")
                    textField.setAttribute("alias", component.getAttribute("alias") ?? "alias")
                
                    component.parentNode.insertBefore(parent, textField)
                    parent.appendChild(textField)      
                }
                else {
                    component.parentNode.insertBefore(parent, component)
                    parent.appendChild(component)
                }
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


            const loadedValidHTML = targetSection.outerHTML.replace(/&quot;/g, `'`)
            console.log("### 로드된 유효 HTML 텍스트 ###")
            console.log(loadedValidHTML)
            return loadedValidHTML
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
