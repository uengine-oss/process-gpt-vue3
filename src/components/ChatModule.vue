<script>
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

export default {
    data: () => ({
        generator: null,
        messages: [],
        userInfo: {},
        disableChat: false,
        // tests: {},
        // testEnabled: false
    }),
    methods: {
        async init() {
            this.disableChat = false;
            this.userInfo = auth.storage.userInfo;
            
            await this.loadData(this.getDataPath());
            await this.loadMessages(this.getDataPath());
        },
        async getChatList(){
            var me = this
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

        getDataPath(){
            return this.$route.href.replace("#/", "");
        },

        async loadData(path){
        },

        runTest(){
            if(this.tests){
                Object.values(tests).forEach(test => test(this))
            }
        },
    
        async loadMessages(path) {
            const callPath = path ? path : this.path;
            await auth.storage.watch(`db://${callPath}`, (callback) => {
                if (callback) {
                    if (callback.messages) {
                        this.messages = callback.messages;
                    } else {
                        this.messages = [];
                    }
                }
            });
        },

        async getData(path) {
            let value;
            if (path) {
                value = await auth.storage.getObject(`db://${path}`);
            } else {
                value = await auth.storage.getObject(`db://${this.path}`);
            }
            return value;
        },
    
        async sendMessage(message) {
            if (message !== "") {
                const chatObj = {
                    role: "user",
                    content: message
                }
                this.messages.push(chatObj);

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

        async sendEditedMessage(index) {
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

        sendNotification(uid, obj) {
            const path = `users/${uid}/notifications`;
            this.pushObject(path, obj);
        },
    
        async putObject(path, obj) {
            await auth.storage.putObject(`db://${path}`, obj);
        },

        async pushObject(path, obj) {
            await auth.storage.pushObject(`db://${path}`, obj);
        },

        async setObject(path, obj) {
            await auth.storage.setObject(`db://${path}`, obj);
        },

        async delete(path) {
            await auth.storage.delete(`db://${path}`);
        },

        async getUid(email) {
            let uid = "";
            const userList = await this.getData("users");
            if (userList) {
                const ids = Object.keys(userList);
                ids.forEach(id => {
                    if (userList[id].email == email) {
                        uid = id;
                    }
                });
            }
            return uid;
        },
    
        onModelCreated(response) {
            let messageWriting = this.messages[this.messages.length -1];
            messageWriting.content = response;
    
            this.afterModelCreated(response);
        },
    
        onGenerationFinished(responses) {
            // console.log(responses);
            let messageWriting = this.messages[this.messages.length -1];
            delete messageWriting.isLoading;
    
            this.afterGenerationFinished();
        },
    
        onError(error) {
            if (error.code === "invalid_api_key") {
                var apiKey = prompt("API Key 를 입력하세요.");
                localStorage.setItem("openAIToken", apiKey);
                
                this.generator.generate();
                
            } else {
                let messageWriting = this.messages[this.messages.length -1];
                if (messageWriting.role =="system" && messageWriting.isLoading) {
                    delete messageWriting.isLoading;
                    messageWriting.content = error.message;
                } else {
                    this.messages.push({
                        role: "system",
                        content: error.message,
                    });
                }
            }
        },

        checkDisableChat(value) {
        },

        extractProcessJson(text) {            
            let textAndJson = text.split("\`\`\`");
            console.log(text)
            if(textAndJson) {
                return textAndJson[1];
            }
        },

        hasUnclosedTripleBackticks(inputString) {
            // 백틱 세 개의 시작과 끝을 찾는 정규 표현식
            const regex = /`{3}/g;
            let match;
            let isOpen = false;

            // 모든 백틱 세 개의 시작과 끝을 찾습니다
            while ((match = regex.exec(inputString)) !== null) {
                // 현재 상태를 토글합니다 (열림 -> 닫힘, 닫힘 -> 열림)
                isOpen = !isOpen;
            }

            // 마지막으로 찾은 백틱 세 개가 닫혀있지 않은 경우 true 반환
            return isOpen;
        },

        extractJSON(inputString, checkFunction) {
            try{
                JSON.parse(inputString) // if no problem, just return the whole thing
                return inputString
            }catch(e){}

            if(this.hasUnclosedTripleBackticks(inputString)){
                inputString = inputString + "\n```"
            }

            // 정규 표현식 정의
            const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;

            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            const match = inputString.match(regex);

            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if(checkFunction)
                    match.forEach(shouldBeJson=>{
                        if(checkFunction(shouldBeJson)) return shouldBeJson
                    })
                else    
                    return match[1];
            }

            // 매치된 결과가 없으면 null 반환
            return null;
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

        createTest(){
            return null
        }
    },
}
</script>