<script>
import { getGlobalContext } from '@/stores/auth';

const globalContext = getGlobalContext();

export default {
    data: () => ({
        prompt: null,
        isInitDone: false,
        storage: null,
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
            this.userInfo = globalContext.storage.userInfo;
            
            await this.loadData(this.getDataPath());
            await this.loadMessages(this.getDataPath());
        },
        async getChatList(){
            var me = this
            me.userInfo = globalContext.storage.userInfo;
            // globalContext.storage.delete(`db://chats/1`)
            var option = {
                sort: "desc",
                orderBy: null,
                size: 20,
                startAt: null,
                endAt: null,
            }
            globalContext.storage.watch_added(`db://chats/1/messages`, option, function (item) {
                if(me.isInitDone){
                    if(item.role == 'system'){
                        if(me.messages[me.messages.length - 1].role == 'system'){
                            me.messages[me.messages.length - 1] = item
                        } else {
                            me.messages.push(item)
                        }
                    } else {
                        if(item.email != me.userInfo.email){
                            me.messages.push(item)
                        }
                    }
                }
            });
            await globalContext.storage.list(`db://chats/1/messages`, option).then(function (messages){
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
            let messages = await globalContext.storage.list(`db://chats/1/messages`, option)
            if(messages){
                messages.splice(0, 1)
                this.messages = messages.reverse().concat(this.messages);
            }
        },

        getDataPath(){
            return this.$route.href.replace("#/", "");
        },

        async loadData(path) {
        },

        runTest(){
            if(this.tests){
                Object.values(tests).forEach(test => test(this))
            }
        },
    
        async loadMessages(path) {
            const callPath = path ? path : this.path;
            await globalContext.storage.watch(`db://${callPath}`, (callback) => {
                if (callback) {
                    if (callback.messages) {
                        this.messages = callback.messages;
                    } else {
                        this.messages = [];
                    }
                } else {
                    this.messages = [];
                }
            });
        },

        async getData(path) {
            let value;
            if (path) {
                value = await globalContext.storage.getObject(`db://${path}`);
            } else {
                value = await globalContext.storage.getObject(`db://${this.path}`);
            }
            return value;
        },
        
        async sendMessage(message) {
            if (message !== "") {
                let chatMsgs = [];
                
                var currentDate = new Date();
                var milliseconds = currentDate.getMilliseconds(); 
                var timeStamp = currentDate.toTimeString().split(' ')[0] + '.' + milliseconds.toString().padStart(3, '0');

                if(this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        chatMsgs.push({
                            role: msg.role,
                            content: msg.content
                        })
                    });
                }

                if(!this.pushMessage) {
                    let chatObj = {
                        role: "user",
                        content: message
                    }
                    chatMsgs.push(chatObj);

                    chatObj = {
                        name: this.userInfo.name,
                        email: this.userInfo.email,
                        role: 'user',
                        timeStamp: timeStamp,
                        content: message
                    }
                    this.messages.push(chatObj);

                } else {
                    this.prompt = {
                        content: message,
                        requestUserEmail: this.userInfo.email,
                        requestUserName: this.userInfo.name,
                    }
                }

                this.generator.previousMessages = [
                    ...this.generator.previousMessages,
                    ...chatMsgs
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

                let chatMsgs = [];
                if(this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        chatMsgs.push({
                            role: msg.role,
                            content: msg.content
                        })
                    });
                }

                this.generator.previousMessages = [
                    ...this.generator.previousMessages,
                    ...chatMsgs
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

        async saveMessages(path, obj) {
            if(this.prompt && this.prompt.content){
                if(obj.role == 'system' && obj.content && obj.content.includes("시작하시겠습니까")){
                    obj.prompt = this.prompt
                    this.prompt = null
                }
            }
            await globalContext.storage.putObject(`db://${path}`, obj);
        },

        jsonPathReplace(src, jsonPath, newData) {
            // JSONPath를 사용하여 경로의 노드들을 찾음
            const nodes = jp.nodes(src, jsonPath);

            // 각 노드의 경로를 사용하여 src에서 해당 위치를 찾아 newData로 교체
            nodes.forEach((node) => {
                let currentObj = src;
                // 마지막 프로퍼티 전까지 객체를 탐색
                for (let i = 1; i < node.path.length - 1; i++) {
                    currentObj = currentObj[node.path[i]];
                }

                // 마지막 프로퍼티를 newData로 변경
                currentObj[node.path[node.path.length - 1]] = newData;
            });

            return src;
        },

        jsonPathAdd(src, jsonPath, newData) {
            // JSONPath를 사용하여 경로의 노드들을 찾음
            const nodes = jp.nodes(src, jsonPath);

            // 각 노드의 경로를 사용하여 src에서 해당 위치를 찾아 newData를 추가
            nodes.forEach((node) => {
                let currentObj = src;
                // 마지막 프로퍼티 전까지 객체를 탐색
                for (let i = 1; i < node.path.length; i++) {
                    currentObj = currentObj[node.path[i]];
                }

                // Array 타입인 경우, newData를 배열에 추가
                if (Array.isArray(currentObj)) {
                    currentObj.push(newData);
                } else {
                    // Object 타입인 경우, 오류 처리 또는 다른 방법으로 추가
                    console.error('Target is not an array. Cannot add new data.');
                }
            });

            return src;
        },

        jsonPathDelete(src, jsonPath) {
            // JSONPath를 사용하여 경로의 노드들을 찾음
            const nodes = jp.nodes(src, jsonPath);

            // 각 노드의 경로를 사용하여 src에서 해당 위치를 찾아 제거
            nodes.forEach((node) => {
                let currentObj = src;
                // 마지막 프로퍼티 전까지 객체를 탐색
                for (let i = 1; i < node.path.length - 1; i++) {
                    currentObj = currentObj[node.path[i]];
                }

                // 마지막 프로퍼티가 배열의 요소를 가리키는 경우 splice로 제거
                const propertyIndex = node.path[node.path.length - 1];
                if (Array.isArray(currentObj) && Number.isInteger(propertyIndex)) {
                    currentObj.splice(propertyIndex, 1);
                } else {
                    console.error('Target is not an array element. Cannot remove.');
                }
            });

            return src;
        },

        async putObject(path, obj) {
            await globalContext.storage.putObject(`db://${path}`, obj);
        },

        async pushObject(path, obj) {
            await globalContext.storage.pushObject(`db://${path}`, obj);
        },

        async setObject(path, obj) {
            await globalContext.storage.setObject(`db://${path}`, obj);
        },

        async delete(path) {
            await globalContext.storage.delete(`db://${path}`);
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
            var currentDate = new Date();
            var milliseconds = currentDate.getMilliseconds(); 
            var timeStamp = currentDate.toTimeString().split(' ')[0] + '.' + milliseconds.toString().padStart(3, '0');

            let messageWriting = this.messages[this.messages.length -1];
            delete messageWriting.isLoading;
            messageWriting.timeStamp = timeStamp;
    
            this.afterGenerationFinished();
            
            if(this.pushMessage && responses) {
                if(responses == '.') {
                    this.messages.splice(this.messages.length - 1, 1)
                } else {
                    this.pushMessage(responses, 'system');
                }
            }
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