<script>
import jp from 'jsonpath';

import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { encodingForModel } from "js-tiktoken";
import _ from 'lodash';
import GeneratorAgent from "./GeneratorAgent.vue";
export default {
    mixins: [GeneratorAgent],
    data: () => ({
        replyUser: null,
        isInitDone: false,
        storage: null,
        generator: null,
        messages: [],
        userInfo: {},
        disableChat: false,
        chatRoomList: [],
        openaiToken: null,
        agentInfo: {
            draftPrompt: '',
            isRunning: false,
            isConnection: false,
        },
        backend: null,
        lastSendMessage: null,
        ProcessGPTActive: false,
    }),
    computed: {
        useLock() {
            if (window.$mode == "ProcessGPT") {
                return true;
            } else {
                return false;
            }
        }
    },
    mounted() {
        var me = this
        me.connectAgent()
        me.receiveAgent(function (callback) {
            if (callback.connection) {
                me.agentInfo.isConnection = true
                if (callback.data) {
                    let message = callback.data
                    let duplication = me.messages.find(mes => mes.role == message.role && JSON.stringify(mes.content) === JSON.stringify(message.content))
                    if (duplication) return;

                    message['_template'] = 'agent'
                    me.messages.push(message)
                    // me.saveMessages(me.messages)
                }

                if (callback.isFinished) {
                    me.agentInfo.isRunning = false
                } else {
                    me.agentInfo.isRunning = true
                }
            } else {
                me.agentInfo.isConnection = false
                me.agentInfo.isRunning = false
            }
        })
    },
    beforeUnmount() {
        this.releaseAgent()
    },
    async created() {
        var me = this;
        this.storage = StorageBaseFactory.getStorage();
        this.openaiToken = await this.getToken();

        // this.debouncedGenerate = _.debounce(this.startGenerate, 3000);
    },
    methods: {
        requestDraftAgent(newVal) {
            var me = this
            me.$try({
                context: me,
                action() {
                    if (newVal) me.agentInfo.draftPrompt = newVal

                    if (!me.agentInfo.draftPrompt) return;
                    me.agentInfo.isRunning = true
                    me.requestAgent(me.agentInfo.draftPrompt)
                },
                // onFail() {
                // }
            })
        },
        async getToken(){
            let option = {
                key: "key"
            }
            const res = await this.storage.getObject('db://configuration/openai_key', option);
            return res?.value?.key || window.localStorage.getItem('openAIToken') || null;
        },
        async init() {
            this.disableChat = false;
            if (this.useLock) {
                this.userInfo = await this.storage.getUserInfo();
            }
            this.backend = BackendFactory.createBackend();

            await this.loadData(this.getDataPath());
            // await this.loadMessages(this.getDataPath());
        },
        async getChatList(chatRoomId) {
            var me = this;
            me.messages = []
            me.userInfo = await this.storage.getUserInfo();
           
            await this.storage.watch(`db://chats/${chatRoomId}`, async (data) => {
                if(data && data.new){
                    if(data.eventType == "DELETE"){
                        let messageIndex = me.messages.findIndex(msg => msg.uuid === data.old.uuid);
                        if (messageIndex !== -1) {
                            me.messages.splice(messageIndex, 1);
                        }
                    } else {
                        if(data.new.messages.email != me.userInfo.email){
                            if(data.new.id == me.currentChatRoom.id){
                                if ((me.messages && me.messages.length > 0) 
                                && (data.new.messages.role == 'system' && me.messages[me.messages.length - 1].role == 'system') 
                                &&  me.messages[me.messages.length - 1].content === data.new.messages.content) {
                                    me.messages[me.messages.length - 1] = data.new.messages
                                } else {
                                    me.messages.push(data.new.messages)
                                }
                            }
                            
                            let idx = me.chatRoomList.findIndex(x => x.id == data.new.id)
                            if(idx != -1){
                                me.chatRoomList[idx].message.msg = data.new.messages.messageForUser ? data.new.messages.messageForUser : data.new.messages.content
                                me.chatRoomList[idx].message.createdAt = data.new.messages.timeStamp
    
                                if(me.chatRoomList[idx].id != me.currentChatRoom.id){
                                    const participantWithEmail = me.chatRoomList[idx].participants.find(participant => participant.email === me.userInfo.email);
                                    participantWithEmail.isExistUnReadMessage = true
                                    
                                }
                            }
                        }
                    }
                }
            });

            // `db://chats/${chatRoomId}`, options
            // let option = {
            //     key: "id"
            // }
            let options = { 
                orderBy: 'id',
                startAt: chatRoomId,
                endAt: chatRoomId
            }
            await this.storage.list(`chats`, options).then(function (messages) {
                if (messages) {
                    let allMessages = messages.map(message => message.messages);
                    allMessages.sort((a, b) => {
                        return new Date(a.timeStamp) - new Date(b.timeStamp);
                    });
                    me.messages = allMessages;
                    me.EventBus.emit('messages-updated');
                }
                me.isInitDone = true;
            });

        },
        // async getMoreChat() {
        //     var option = {
        //         sort: 'desc',
        //         orderBy: null,
        //         size: 11,
        //         startAt: null,
        //         endAt: this.messages[0].timeStamp
        //     };
        //     let messages = await this.storage.list(`chats/1/messages`, option);
        //     if (messages) {
        //         messages.splice(0, 1);
        //         this.messages = messages.reverse().concat(this.messages);
        //     }
        // },

        getDataPath() {
            return this.$route.href.replace('/', '');
        },

        async loadData(path) {},

        runTest() {
            if (this.tests) {
                Object.values(tests).forEach((test) => test(this));
            }
        },

        async loadMessages(path, options) {
            const callPath = path ? path : this.path;
            
            const value = await this.getData(callPath, options);
            if (value && value.messages) {
                this.messages = value.messages
            }

            await this.storage.watch(`db://${callPath}`, async () => {
                const value = await this.getData(callPath, options);
                if (value && value.messages) {
                    this.messages = value.messages
                }
            });
        },

        async getData(path, options) {
            let value;
            if (path) {
                value = await this.storage.getObject(`db://${path}`, options);
            } else {
                value = await this.storage.getObject(`db://${this.path}`, options);
            }
            return value;
        },
        createMessageObj(message, role) {
            let obj;

            if (this.replyUser) {
                obj = {
                    name: role ? role : this.userInfo.name,
                    email: role ? role + '@uengine.org' : this.userInfo.email,
                    role: role ? role : 'user',
                    timeStamp: Date.now(),
                    content: message,
                    replyUserName: this.replyUser.name,
                    replyContent: this.replyUser.content,
                    replyUserEmail: this.replyUser.email,
                };
            } else {
                obj = {
                    name: role ? role : this.userInfo.name,
                    email: role ? role + '@uengine.org' : this.userInfo.email,
                    role: role ? role : 'user',
                    timeStamp: Date.now(),
                    content: message,
                };
            }

            return obj;
        },
        async sendMessage(message) {
            if (message.text !== '') {
                let chatMsgs = [];

                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        if (msg.content) {
                            chatMsgs.push({
                                role: msg.role,
                                content: msg.content
                            });
                        }
                    });
                }

                let chatObj = {
                    role: 'user'
                };
                if(this.generator){
                    this.generator.model = "gpt-4o";
                }
                if (message.image && message.image != '') {
                    chatObj.content = [
                        {
                            "type": "text",
                            "text": message.text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": message.image
                            }
                        }
                    ];

                    this.generator.model = "gpt-4-vision-preview";

                } else {
                    chatObj.content= message.text;
                }
                
                chatMsgs.push(chatObj);
                this.generator.previousMessages = [this.generator.previousMessages[0], ...chatMsgs];

                chatObj = this.createMessageObj(message.text);
                if (message.image && message.image != '') {
                    chatObj['image'] = message.image;
                }

                if(!this.messages){
                    this.messages = []
                }

                this.messages.push(chatObj);

                if (message && message.callType && message.callType == 'chats') {
                    this.lastSendMessage = message.text
                    // if (message.mentionedUsers.length == 0) {
                    //     this.debouncedGenerate();
                    // } else if(message.mentionedUsers.some(user => user.id === 'system_id')){
                    //     this.startGenerate();
                    // }
                    // if(message.mentionedUsers){
                        if(this.ProcessGPTActive || message.mentionedUsers.some(user => user.id === 'system_id') || message.text.startsWith('>') || message.text.startsWith('!')){
                            this.startGenerate();
                        }
                    // }
                } else {
                    // this.debouncedGenerate();
                    this.startGenerate();
                }
                
                this.replyUser = null;
            }
        },
        async startGenerate() {
            this.messages.push({
                role: 'system',
                content: '...',
                isLoading: true
            });

            const encoding = encodingForModel("gpt-3.5-turbo-16k");
            let stringifiedMessages = JSON.stringify(this.generator.previousMessages);
            let tokens = encoding.encode(stringifiedMessages);
            let tokenLength = tokens.length;

            // 16385
            while (tokenLength > 16000 && this.generator.previousMessages.length > 1) {
                this.generator.previousMessages.splice(1, 1); 
                stringifiedMessages = JSON.stringify(this.generator.previousMessages);
                tokens = encoding.encode(stringifiedMessages);
                tokenLength = tokens.length;
            }
            
            await this.generator.generate();
        },
        stopMessage() {
            this.generator.stop();
        },

        async sendEditedMessage(index) {
            if (index) {
                this.messages.splice(index);

                let chatMsgs = [];
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        chatMsgs.push({
                            role: msg.role,
                            content: msg.content
                        });
                    });
                }

                this.messages.push({
                    role: 'system',
                    content: '...',
                    isLoading: true
                });

                this.generator.previousMessages = [...this.generator.previousMessages, ...chatMsgs];
                await this.generator.generate();
            }
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

        async putObject(path, obj, options) {
            await this.storage.putObject(`db://${path}`, obj, options);
        },

        async pushObject(path, obj, options) {
            await this.storage.pushObject(`db://${path}`, obj, options);
        },

        async setObject(path, obj, options) {
            await this.storage.setObject(`db://${path}`, obj, options);
        },

        async delete(path, options) {
            await this.storage.delete(`db://${path}`, options);
        },

        onModelCreated(response) {
            this.$try({
                context: this,
                action: async () => { // Changed to arrow function
                    let messageWriting = this.messages[this.messages.length - 1];
                    messageWriting.content = response;
                    messageWriting.jsonContent = this.extractJSON(response);
                    // messageWriting.systemRequest = false;

                    if (messageWriting.jsonContent) {
                        let regex = /^.*?`{3}(?:json|markdown)?\n(.*?)`{3}.*?$/s;
                        const match = messageWriting.content.match(regex);
                        if (match) {
                            messageWriting.content = messageWriting.content.replace(match[1], '');
                            regex = /`{3}(?:json|markdown)?\s?\n/g;
                            messageWriting.content = messageWriting.content.replace(regex, '');
                            messageWriting.content = messageWriting.content.replace(/\s?\n?`{3}?\s?\n/g, '');
                            messageWriting.content = messageWriting.content.replace(/`{3}/g, '');
                        }
                    }
                    
                    this.afterModelCreated(response);
                },
                onFail: () => {
                    this.onModelStopped();
                }
            })
        },
        deleteVectorStorage(id) {
            let db;
            const request = window.indexedDB.open('VectorStorageDatabase');
            request.onerror = (event) => {
                console.error("Why didn't you allow my web app to use IndexedDB?!");
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                db.transaction(['documents'], 'readwrite').objectStore('documents').delete(id);
                

                db.close();
            };
        },
        onGenerationFinished(response) {
            let messageWriting = this.messages[this.messages.length - 1];
            messageWriting.timeStamp = Date.now();

            this.messages.forEach((message) => {
                if (message.role == 'system') {
                    delete message.isLoading;
                }
            });

            this.afterGenerationFinished(response);
        },

        onModelStopped(response) {
            let messageWriting = this.messages[this.messages.length - 1];
            delete messageWriting.isLoading;
            messageWriting.timeStamp = Date.now();

            this.afterModelStopped(response);
        },

        onError(error) {
            if (error.code === 'invalid_api_key') {
                var apiKey = prompt('API Key 를 입력하세요.');
                let token = {
                    "key": 'openai_key',
                    "value": {
                        "key": apiKey
                    }
                }
                this.putObject('configuration', token);
                this.openaiToken = apiKey;
                this.startGenerate();
            } else {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting.role == 'system' && messageWriting.isLoading) {
                    delete messageWriting.isLoading;
                    messageWriting.content = error;
                } else {
                    this.messages.push({
                        role: 'system',
                        content: error
                    });
                }
            }
        },

        checkDisableChat(value) {},

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
            try {
                JSON.parse(inputString); // if no problem, just return the whole thing
                return inputString;
            } catch (e) {}

            if (this.hasUnclosedTripleBackticks(inputString)) {
                inputString = inputString + '\n```';
            }

            // 정규 표현식 정의
            //const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;
            const regex = /```(?:json)?\s*([\s\S]*?)\s*```/;


            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            const match = inputString.match(regex);

            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if (checkFunction)
                    match.forEach((shouldBeJson) => {
                        if (checkFunction(shouldBeJson)) return shouldBeJson;
                    });
                else return match[1];
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

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },

        createTest() {
            return null;
        },
        // createUEngine(process) {
        //     const elements = {};
        //     const relations = {};
        //     // let tracingTag = 1;
        //     let currentY = 250; // 첫번째 role의 y 좌표
        //     let absY = 250;
        //     const roleIds = {}; // role 이름과 ID를 매핑하기 위한 객체
        //     // Add swimlane if there are more than one role
        //     let swimlaneId = null;
        //     if (process.roles) {
        //         if (process.roles.length > 1) {
        //             swimlaneId = this.uuid();
        //             const swimlaneHeight = process.roles.length * 120; // role의 height 합
        //             elements[swimlaneId] = {
        //                 _type: 'org.uengine.kernel.Role',
        //                 name: 'Pool',
        //                 displayName: 'Pool',
        //                 roleResolutionContext: {
        //                     endpoint: 'example@uengine.org',
        //                     _type: 'org.uengine.kernel.DirectRoleResolutionContext'
        //                 },
        //                 selected: false,
        //                 elementView: {
        //                     _type: 'org.uengine.kernel.view.DefaultActivityView',
        //                     id: swimlaneId,
        //                     x: 290, // role의 x보다 10 작음
        //                     y: currentY,
        //                     width: 400, // 예시 값
        //                     height: swimlaneHeight,
        //                     style: JSON.stringify({
        //                         stroke: 'black',
        //                         'fill-r': '.5',
        //                         'fill-cx': '.5',
        //                         'fill-cy': '.5',
        //                         fill: '#ffffff',
        //                         'fill-opacity': 0,
        //                         'label-position': 'center',
        //                         'label-direction': 'vertical',
        //                         'vertical-align': 'top',
        //                         cursor: 'move'
        //                     }),
        //                     parent: null
        //                 },
        //                 _instanceInfo: [],
        //                 oldName: 'Swimlane'
        //             };
        //             absY = currentY - swimlaneHeight / 2;
        //         }

        //         // Add roles and set their parent to swimlane if it exists
        //         process.roles.forEach((role, idx) => {
        //             const roleId = this.uuid();
        //             roleIds[role.name] = roleId;
        //             const roleHeight = 120; // 예시 값
        //             elements[roleId] = {
        //                 _type: 'org.uengine.kernel.Role',
        //                 name: role.name,
        //                 displayName: role.name,
        //                 roleResolutionContext: {
        //                     endpoint: 'example@uengine.org',
        //                     _type: 'org.uengine.kernel.DirectRoleResolutionContext'
        //                 },
        //                 selected: false,
        //                 elementView: {
        //                     _type: 'org.uengine.kernel.view.DefaultActivityView',
        //                     id: roleId,
        //                     x: 300, // 예시 값
        //                     y: absY + roleHeight / 2,
        //                     width: 380, // swimlane width - 20
        //                     height: roleHeight,
        //                     style: JSON.stringify({
        //                         stroke: 'black',
        //                         'fill-r': '.5',
        //                         'fill-cx': '.5',
        //                         'fill-cy': '.5',
        //                         fill: '#ffffff',
        //                         'fill-opacity': 0,
        //                         'label-position': 'center',
        //                         'label-direction': 'vertical',
        //                         'vertical-align': 'top',
        //                         cursor: 'move'
        //                     }),
        //                     parent: swimlaneId
        //                 },
        //                 _instanceInfo: [],
        //                 oldName: role.name
        //             };
        //             absY += roleHeight; // 다음 role의 y 좌표 업데이트
        //         });
        //     }

        //     // Add start event

        //     // tracingTag++;
        //     let startEventId = null;
        //     let endEventId = null;
        //     let beforeActivity = null;
        //     // Add activities, connect them with sequence flows, and add end event
        //     if (process.activities) {
        //         process.activities.forEach((activity, index) => {
        //             const activityId = activity.id;
        //             const activityType = activity.type === 'UserActivity' ? 'HumanActivity' : activity.type;
        //             const isRole = activityType === 'Role';
        //             // const role = roleIds[activity.role]; // Get the role ID
        //             // Set the position and size for roles, otherwise use default values for other activities and events
        //             const x = isRole ? 100 : 576; // 예시 값
        //             const y = isRole ? currentY : 463; // 예시 값
        //             const width = isRole ? 380 : 100; // 예시 값
        //             const height = isRole ? 80 : 70; // 예시 값
        //             if (index === 0) {
        //                 startEventId = 'start-event';
        //                 elements[startEventId] = {
        //                     _type: 'org.uengine.kernel.bpmn.StartEvent',
        //                     name: 'start-event',
        //                     role: roleIds[activity.role],
        //                     tracingTag: startEventId,
        //                     selected: false,
        //                     status: null,
        //                     elementView: {
        //                         _type: 'org.uengine.kernel.view.DefaultActivityView',
        //                         id: startEventId,
        //                         x: 500, // 예시 값
        //                         y: 400, // 예시 값
        //                         width: 30,
        //                         height: 30,
        //                         style: JSON.stringify({
        //                             stroke: 'black',
        //                             'fill-r': '.5',
        //                             'fill-cx': '.5',
        //                             'fill-cy': '.5',
        //                             fill: 'white',
        //                             'fill-opacity': 0,
        //                             'label-position': 'bottom',
        //                             'label-width': 120,
        //                             'stroke-width': 1.5,
        //                             cursor: 'move'
        //                         })
        //                     }
        //                 };
        //                 // tracingTag++;
        //             }
        //             elements[activityId] = {
        //                 _type: 'org.uengine.kernel.' + activityType,
        //                 name: activity.name,
        //                 role: roleIds[activity.role],
        //                 tracingTag: activityId,
        //                 selected: false,
        //                 status: activity.status,
        //                 elementView: {
        //                     _type: 'org.uengine.kernel.view.DefaultActivityView',
        //                     id: activityId,
        //                     x: x,
        //                     y: y,
        //                     width: width,
        //                     height: height,
        //                     style: JSON.stringify({
        //                         stroke: 'black',
        //                         'fill-r': 1,
        //                         'fill-cx': 0.1,
        //                         'fill-cy': 0.1,
        //                         fill: '#FFFFFF',
        //                         'fill-opacity': 0,
        //                         'label-position': 'center',
        //                         'stroke-width': 1.2,
        //                         r: '10',
        //                         cursor: 'move'
        //                     }),
        //                     parent: isRole ? swimlaneId : roleIds[activity.role]
        //                 }
        //             };
        //             // tracingTag++;
        //             if (index === process.activities.length - 1) {
        //                 endEventId = 'end-event';
        //                 elements[endEventId] = {
        //                     _type: 'org.uengine.kernel.bpmn.EndEvent',
        //                     name: 'end-event',
        //                     status: null,
        //                     tracingTag: endEventId,
        //                     selected: false,
        //                     role: roleIds[activity.role],
        //                     elementView: {
        //                         _type: 'org.uengine.kernel.view.DefaultActivityView',
        //                         id: endEventId,
        //                         x: x + width + 20, // 예시 값
        //                         y: y, // 예시 값
        //                         width: 30,
        //                         height: 30,
        //                         style: JSON.stringify({
        //                             stroke: 'black',
        //                             'fill-r': '.5',
        //                             'fill-cx': '.5',
        //                             'fill-cy': '.5',
        //                             fill: 'white',
        //                             'fill-opacity': 0,
        //                             'label-position': 'bottom',
        //                             'stroke-width': 3,
        //                             'label-width': 120,
        //                             cursor: 'move'
        //                         }),
        //                         parent: null
        //                     }
        //                 };
        //                 // tracingTag++;
        //             }
        //             if (isRole) {
        //                 // Update currentY for the next role
        //                 currentY += height;
        //             }

        //             // Connect previous activity to current activity with sequence flow
        //             if (!isRole) {
        //                 const sequenceId = this.uuid();
        //                 const sourceRef = index === 0 ? startEventId : beforeActivity;
        //                 // const targetRef = index === process.activities.length - 1 ? endEventId : activityId;
        //                 relations[sequenceId] = {
        //                     name: '',
        //                     _type: 'org.uengine.kernel.bpmn.SequenceFlow',
        //                     selected: false,
        //                     from: sourceRef,
        //                     to: activityId,
        //                     sourceRef: sourceRef,
        //                     targetRef: activityId,
        //                     priority: 1,
        //                     relationView: {
        //                         style: '{}',
        //                         id: sequenceId,
        //                         value: '' // 예시 값
        //                     },
        //                     condition: {
        //                         _type: 'org.uengine.kernel.Evaluate',
        //                         pv: {
        //                             _type: 'org.uengine.kernel.ProcessVariable',
        //                             name: ''
        //                         },
        //                         condition: '==',
        //                         val: ''
        //                     }
        //                 };
        //                 beforeActivity = activityId;
        //             }
        //             if (index === process.activities.length - 1) {
        //                 const endSequenceId = this.uuid();
        //                 relations[endSequenceId] = {
        //                     name: '',
        //                     _type: 'org.uengine.kernel.bpmn.SequenceFlow',
        //                     selected: false,
        //                     from: activityId,
        //                     to: endEventId,
        //                     priority: 1,
        //                     sourceRef: activityId,
        //                     targetRef: endEventId,
        //                     relationView: {
        //                         style: '{}',
        //                         id: endSequenceId,
        //                         value: '' // 예시 값
        //                     },
        //                     condition: {
        //                         _type: 'org.uengine.kernel.Evaluate',
        //                         pv: {
        //                             _type: 'org.uengine.kernel.ProcessVariable',
        //                             name: ''
        //                         },
        //                         condition: '==',
        //                         val: ''
        //                     }
        //                 };
        //             }
        //         });
        //     }
        //     let processVariables;
        //     if (process.data) {
        //         processVariables = process.data.map((data) => ({
        //             name: data.name,
        //             displayName: {
        //                 text: data.name,
        //                 _type: 'org.uengine.contexts.TextContext'
        //             },
        //             defaultValueInString: '',
        //             global: false,
        //             persistOption: 'BPMS',
        //             typeClassName: 'java.lang.String',
        //             _type: 'org.uengine.kernel.ProcessVariable'
        //         }));
        //     }

        //     const finalJson = {
        //         elements: elements,
        //         relations: relations,
        //         version: 3,
        //         definitionId: process.processDefinitionId,
        //         scm: {
        //             tag: null,
        //             org: null,
        //             repo: null,
        //             forkedOrg: null,
        //             forkedRepo: null
        //         },
        //         processVariableDescriptors: processVariables,
        //         _changedByLocaleSelector: false,
        //         name: process.processDefinitionName
        //     };
        //     if (Object.keys(elements).length > 0) {
        //         this.adjustElementsWithinRoles(process, elements);
        //     }

        //     this.projectName = process.processDefinitionName;
        //     return finalJson;
        //     // this.$emit("update:model", result)
        // },
        // adjustElementsWithinRoles(process, elements) {
        //     let maxRoleWidth = 0;
        //     let maxRoleX = 0;
        //     let beforeX = 0;
        //     let poolId;
        //     let activityLength = 0;
        //     if (process.activities) activityLength = Object.keys(process.activities).length;
        //     // Adjust the x position of activities and events to be within the role boundaries
        //     Object.values(elements).forEach((element) => {
        //         if (element._type === 'org.uengine.kernel.Role') {
        //             // Set Start Event Position --> 우선 첫 위치부터
        //             // absX 를 무조건 120에 두도록 설정
        //             poolId = element.elementView.parent;
        //             if (element.name !== 'Pool') {
        //                 maxRoleWidth = activityLength <= 0 ? element.elementView.width : 250 * activityLength;
        //                 if (maxRoleWidth - element.elementView.width > 0) {
        //                     // 현재 abs
        //                     let abs = this.absPos(element);
        //                     maxRoleX = 110 + maxRoleWidth / 2;
        //                     if (abs.absX !== 120) {
        //                         element.elementView.x = maxRoleX;
        //                     }
        //                 }
        //                 element.elementView.width = maxRoleWidth;
        //             }
        //         } else if (element.role) {
        //             if (element._type === 'org.uengine.kernel.bpmn.StartEvent') {
        //                 const role = elements[element.role];
        //                 const absRolePos = this.absPos(role);
        //                 beforeX = absRolePos.absX + element.elementView.width / 2 + 50;
        //                 element.elementView.x = beforeX;
        //                 element.elementView.y = role.elementView.y;
        //             } else {
        //                 const role = elements[element.role];
        //                 beforeX = beforeX + element.elementView.width / 2 + 100;
        //                 element.elementView.x = beforeX;
        //                 element.elementView.y = role ? role.elementView.y : 300;
        //             }
        //         }
        //     });
        //     if (poolId) {
        //         elements[poolId].elementView.width = maxRoleWidth + 20;
        //         elements[poolId].elementView.x = 90 + elements[poolId].elementView.width / 2;
        //     }
        // },
        // absPos(element) {
        //     let result = {
        //         absX: element.elementView.x - element.elementView.width / 2,
        //         absY: element.elementView.y - element.elementView.height / 2
        //     };
        //     return result;
        // }
    }
};
</script>
