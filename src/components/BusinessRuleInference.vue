<template>
    <Chat 
        :messages="messages"
        :ownerInfo="ownerInfo"
        :userInfo="userInfo"
        :chatRoomId="chatRoomId"
        :chatInfo="chatInfo"
        @sendMessage="beforeSendMessage"
        @stopMessage="stopMessage"
    />
</template>

<script>
import Chat from "@/components/ui/Chat.vue";
import AgentChatModule from "@/components/AgentChatModule.vue";
import DmnInferenceGenerator from "@/components/ai/DmnInferenceGenerator.js";

export default {
    name: 'BusinessRuleInference',
    mixins: [AgentChatModule],
    components: {
        Chat
    },
    props: {
        ownerInfo: Object,
        dmnList: Array
    },
    emits: ['stopMessage'],
    data() {
        return {
            chatRoomId: '',
            type: 'rule-inference',
            dmnXmlList: [],
            chatInfo: {
                title: 'AgentChatInfo.businessRuleTabs.inference'
            }
        }
    },
    watch: {
        dmnList: {
            handler(newList) {
                if (newList && newList.length > 0) {
                    this.updateDmnXmlList();
                }
            },
            immediate: true
        }
    },
    created() {
        this.type = 'rule-inference';
        this.generator = new DmnInferenceGenerator(this, {
            preferredLanguage: 'Korean'
        });
        
        this.updateDmnXmlList();
    },
    async mounted() {
        this.chatRoomId = `${this.id}-${this.type}`;
        await this.getMessages(this.chatRoomId);
    },
    methods: {
        updateDmnXmlList() {
            if (this.dmnList && this.dmnList.length > 0) {
                this.dmnXmlList = this.dmnList.map(dmn => ({
                    id: dmn.id,
                    name: dmn.name,
                    xml: dmn.bpmn
                }));
                
                if (this.generator) {
                    this.generator.dmnXmlList = this.dmnXmlList;
                }
            }
        },

        afterModelCreated(response) {
            const messageWriting = this.messages[this.messages.length - 1];
            if (messageWriting && messageWriting.role && messageWriting.role == 'agent') {
                messageWriting.content = response
            } else {
                let obj = this.createMessageObj(response, 'agent')
                obj.name = this.ownerInfo.username
                obj.profile = this.ownerInfo.profile
                obj.content = response
                obj.uuid = this.uuid()
                this.messages.push(obj)
            }
        },
        
        async afterGenerationFinished(response) {
            if (response && response != '') {
                let obj = this.createMessageObj(response, 'agent')
                obj.name = this.ownerInfo.username
                obj.profile = this.ownerInfo.profile
                obj.content = response
                obj.uuid = this.uuid()
                await this.putMessage(obj)
            }
        }
    }
}
</script>

