<script>
import partialParse from "partial-json-parser";

import CommonStorageBase from "@/components/storage/CommonStorageBase";

export default {
    data: () => ({
        isInitDone: false,
        storage: null,
        generator: null,
        messages: [],
        userInfo: {},
        chatDialog: false,
    }),
    methods: {
        async init() {
            var me = this
            me.storage = new CommonStorageBase(this);
            me.userInfo = await me.storage.getUserInfo();
            // this.storage.delete(`db://chats/1`)
            var option = {
                sort: "desc",
                orderBy: null,
                size: 20,
                startAt: null,
                endAt: null,
            }
            me.storage.watch_added(`db://chats/1/messages`, option, function (item) {
                if(me.isInitDone){
                    if(item.role == 'system'){
                        me.messages[me.messages.length - 1] = item
                    } else {
                        me.messages.push(item)
                    }
                }
            });
            await me.storage.list(`db://chats/1/messages`, option).then(function (messages){
                if(messages){
                    me.messages = messages.reverse();
                }
                me.isInitDone = true
            })
        },

        async getMoreChat(){
            var option = {
                sort: "desc",
                orderBy: null,
                size: 11,
                startAt: null,
                endAt: this.messages[0].timeStamp,
            }
            let messages = await this.storage.list(`db://chats/1/messages`, option)
            if(messages){
                messages.splice(0, 1)
                this.messages = messages.reverse().concat(this.messages);
            }
        },
    
        async loadMessages(path) {
            let value;
            if (path) {
                value = await this.storage.getObject(`db://${path}`);
            } else {
                value = await this.storage.getObject(`db://${this.path}`);
            }
    
            if (value && value.messages) {
                return partialParse(value.messages);
            } else {
                return this.messages;
            }
        },

        async getData(path) {
            let value;
            if (path) {
                value = await this.storage.getObject(`db://${path}`);
            } else {
                value = await this.storage.getObject(`db://${this.path}`);
            }
            return value;
        },
    
        async sendMessage(message) {
            if (message !== "") {
                
                let messages = []
                this.messages.forEach(function (msg){
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    })
                })

                const chatObj = {
                    role: "user",
                    content: message
                }
                messages.push(chatObj);

                this.generator.previousMessages = [
                    ...this.generator.previousMessages,
                    ...messages
                ];
    
                await this.generator.generate();
    
                this.messages.push({
                    role:'system',
                    content: '...',
                    isLoading: true,
                });
            }
        },

        async editSendMessage(index) {
            if (index) {
                this.messages.splice(index);

                this.generator.previousMessages = [
                    ...this.generator.previousMessages,
                    ...this.messages
                ];

                await this.generator.generate();

                this.messages.push({
                    role:'system',
                    content: '...',
                    isLoading: true,
                });
            }
        },
    
        async saveMessages(path, obj) {
            await this.storage.putObject(`db://${path}`, obj);
        },
    
        onModelCreated(response) {
            let messageWriting = this.messages[this.messages.length -1];
            messageWriting.content = response;
    
            this.afterModelCreated(response);
        },
    
        onGenerationFinished(response) {
            let messageWriting = this.messages[this.messages.length -1];
            delete messageWriting.isLoading;
    
            var msgText = "";
            if (this.messages) {
                msgText = JSON.stringify(this.messages);
            }
    
            var putObj =  {
                messages: msgText,
            }
    
            this.afterGenerationFinished(putObj);
            this.beforeSendMessage(response, 'system')
        },
    
        onError(error) {
            if (error.code === "invalid_api_key") {
                var apiKey = prompt("API Key 를 입력하세요.");
                localStorage.setItem("openAIToken", apiKey);
                
                this.generator.generate();
                
            } else {
                let messageWriting = this.messages[this.messages.length -1];
                delete messageWriting.isLoading;
                messageWriting.content = error.message;
            }
        },

        toggleChatDialog() {
            this.chatDialog = !this.chatDialog;
        },

        extractProcessJson(text) {            
            let textAndJson = text.split("--- json ---")
            if(textAndJson && textAndJson.length==2) return textAndJson[1]
        },
        extractJSON(text) {            
            const regex = /```json\s*([\s\S]*?)(?:\n\s*```|$)/;
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        },
        extractXML(text) {            
            const regex = /```xml\s*([\s\S]*?)(?:\n\s*```|$)/;
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        },
        extractBPMN(text) {
            const regex = /```bpmn\s*([\s\S]*?)(?:\n\s*```|$)/;
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        },
        extractCode(text) {
            const regex = /```\s*([\s\S]*?)(?:\n\s*```|$)/;
            const match = text.match(regex);
            return match ? match[1].trim() : null;
        },

        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        },
    },
}
</script>