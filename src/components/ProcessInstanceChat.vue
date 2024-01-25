<template>
    <AppBaseCard>
        <!-- Process Designer Dialog -->
        <template v-slot:leftpart>
            <div class="no-scrollbar">
                <ProcessInstanceList></ProcessInstanceList>
            </div>
        </template>
        <template v-slot:rightpart>
            <v-dialog v-model="isViewProcess" max-width="1000">
                <v-card>
                    <v-card-text style="height: 1000px; width: 1000px">
                        <bpmn-modeling-canvas
                            v-if="onLoad"
                            :monitor="true"
                            :readOnly="false"
                            :projectName="projectName"
                            v-model="model"
                            :movable="false"
                            :resizable="false"
                            :connectable="false"
                            :selectable="true"
                        ></bpmn-modeling-canvas>
                        <div v-else style="height: 100%; text-align: center">
                            <v-progress-circular style="top: 50%" indeterminate color="primary"></v-progress-circular>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="secondary" class="px-4 rounded-pill mx-auto" @click="isViewProcess = false" variant="tonal"
                            >Close Dialog</v-btn
                        >
                    </v-card-actions>
                </v-card>
            </v-dialog>
            <Chat
                :messages="messages"
                :alertInfo="alertInfo"
                :userInfo="userInfo" 
                :disableChat="disableChat"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @viewProcess="viewProcess"
            ></Chat>
        </template>

        <template v-slot:mobileLeftContent>
            <ProcessInstanceList></ProcessInstanceList>
        </template>
    </AppBaseCard>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';
import { format } from 'date-fns';

import ChatGenerator from './ai/ProcessInstanceGenerator.js';
import ChatModule from '@/components/ChatModule.vue';

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import Chat from "@/components/ui/Chat.vue";
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';
import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        ProcessInstanceList,
        BpmnModelingCanvas
    },
    data: () => ({
        processDefinition: null,
        processInstance: null,
        path: 'instances',
        organizationChart: [],
        alertInfo: {
            title: '프로세스 실행',
            text: "대화형으로 프로세스를 실행하십시오. \n 예를 들어, '휴가를 신청할게: 1. 사유: 개인사유 2. 휴가 시작일: 오늘 3. 휴가 복귀일: 금요일' 와 같은 명령을 할 수 있습니다."
        },
        isViewProcess: false,
        onLoad: false,
        model: {
            elements: {},
            relations: {},
            basePlatform: null,
            basePlatformConf: {},
            toppingPlatforms: null,
            toppingPlatformsConf: {},
            processVariableDescriptors: [],
            scm: {}
        },
        projectName: '',
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        if(localStorage.getItem('instancePrompt')){
            let prompt = JSON.parse(localStorage.getItem('instancePrompt'))
            this.beforeSendMessage(prompt.content)
            localStorage.removeItem('instancePrompt')
        }
    },
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    await this.init();
                    this.generator = new ChatGenerator(this, {
                        isStream: true,
                        preferredLanguage: 'Korean'
                    });
                }
            }
        },
    },
    methods: {
        async viewProcess() {
            this.onLoad = false;
            let definitionInfo = null;
            let instanceId = "";
            if (this.$route.params && this.$route.params.id) {
                instanceId = this.$route.params.id;
                this.isViewProcess = !this.isViewProcess;
            } else if (this.processInstance && this.processInstance.processInstanceId) {
                instanceId = this.processInstance.processInstanceId;
                this.isViewProcess = !this.isViewProcess;
            } else {
                alert("실행 중인 프로세스 인스턴스를 선택하세요.");
                return;
            }
            const instanceInfo = await this.getData(`instances/${instanceId}`);
            if (instanceInfo) {
                definitionInfo = await this.getData(`definitions/${instanceInfo.definitionId}`);
            }
            if (definitionInfo) {
                let definition = partialParse(definitionInfo.model);
                definition.activities.forEach(function (activity) {
                    if (activity.id == instanceInfo.nextActivityId) activity.status = 'Running';
                });
                this.model = this.createUEngine(definition);
                this.onLoad = true;
            }
        },
        async loadData(path) {
            let value = await this.getData(path);
            if (value) {
                this.checkDisableChat(value);
            }

            value = await this.getData("organization");
            
            if (value && value.organizationChart) {
                this.organizationChart = JSON.parse(value.organizationChart);
                
                if (!this.organizationChart) {
                    this.organizationChart = [];
                }
            }
        },
        checkDisableChat(value) {
            if (value.status && value.status == 'Completed') {
                this.disableChat = true;
            }

            if (value.nextUserId && value.nextUserId !== this.userInfo.email) {
                this.disableChat = true;
            }
        },
        async beforeSendMessage(newMessage) {
            if(!this.generator.contexts) {
                this.processDefinition = null;
                let contexts = await this.queryFromVectorDB(newMessage);
                if (!contexts || contexts.length < 1) {
                    await this.saveDefinitionToVectorDB();
                    contexts = await this.queryFromVectorDB(newMessage);
                }
                this.processDefinition = contexts[0];
                this.generator.setContexts(contexts);
            }
            this.sendMessage(newMessage);
        },
        afterModelCreated(response) {
            let jsonInstance = this.extractJSON(response);
            if (jsonInstance) {
                this.processInstance = partialParse(jsonInstance);
            }
        },
        async afterGenerationFinished(response) {
            if (this.processInstance) {
                if (typeof this.processInstance === 'string') {
                    this.processInstance = partialParse(this.processInstance);
                }

                await this.saveInstance();
                await this.sendTodolist();
            }
        },
        async saveInstance(status) {
            if (this.processInstance) {
                let path = `${this.path}/${this.processInstance.processInstanceId}`;
                let putObj = await this.getData(path);

                if (putObj) {
                    putObj.messages = this.messages;
                    putObj.currentUserId = this.processInstance.currentUserEmail;
                    putObj.currentActivityId = this.processInstance.currentActivityId;
                    putObj.currentActivityName = this.processInstance.currentActivityName;
                    putObj.nextUserId = this.processInstance.nextUserEmail;
                    putObj.nextActivityId = this.processInstance.nextActivityId;
                    putObj.nextActivityName = this.processInstance.nextActivityName;

                    let newParticipants = [this.processInstance.currentUserEmail, this.processInstance.nextUserEmail];
                    newParticipants = [...putObj.participants, ...newParticipants];
                    const set = new Set(newParticipants);
                    putObj.participants = [...set];

                    if (status) {
                        putObj.status = status;
                    }
                } else {
                    putObj = {
                        messages: this.messages,
                        definitionId: this.processInstance.processDefinitionId,
                        instanceName: this.processInstance.processInstanceName,
                        currentUserId: this.processInstance.currentUserEmail,
                        currentActivityId: this.processInstance.currentActivityId,
                        currentActivityName: this.processInstance.currentActivityName,
                        nextUserId: this.processInstance.nextUserEmail,
                        nextActivityId: this.processInstance.nextActivityId,
                        nextActivityName: this.processInstance.nextActivityName,
                        participants: [this.processInstance.currentUserEmail, this.processInstance.nextUserEmail],
                        status: 'Running'
                    };
                }

                await this.putObject(path, putObj);
            }
        },
        async sendTodolist() {
            if (this.processInstance) {
                if (this.processInstance.currentUserEmail !== "") {
                    const path = `todolist/${this.processInstance.currentUserEmail}`;
                    const pushObj = {
                        definitionId: this.processInstance.processDefinitionId,
                        definitionName: this.processInstance.processDefinitionName,
                        instanceId: this.processInstance.processInstanceId,
                        instanceName: this.processInstance.processInstanceName,
                        activityId: this.processInstance.currentActivityId,
                        activityName: this.processInstance.currentActivityName,
                        userId: this.processInstance.currentUserEmail,
                        status: 'Completed',
                        endDate: format(new Date(), 'yyyy-MM-dd')
                    };

                    const workItem = await this.checkTodolist(path, pushObj);
                    if (workItem) {
                        pushObj.startDate = workItem.startDate;
                        await this.delete(`${path}/${workItem.key}`);
                    }
                    
                    if (this.processDefinition && this.processDefinition.activities) {
                        const actIdx = this.processDefinition.activities.findIndex(activity => 
                            activity.id == pushObj.activityId
                        );
                        if (actIdx < 1) {
                            pushObj.startDate = format(new Date(), 'yyyy-MM-dd');
                        }
                    }

                    await this.pushObject(path, pushObj);
                    await this.saveUserInstance(pushObj);
                }

                if (this.processInstance.nextUserEmail !== '' && this.checkUserEmail(this.processInstance.nextUserEmail)) {
                    const path = `todolist/${this.processInstance.nextUserEmail}`;
                    const pushObj = {
                        definitionId: this.processInstance.processDefinitionId,
                        definitionName: this.processInstance.processDefinitionName,
                        instanceId: this.processInstance.processInstanceId,
                        instanceName: this.processInstance.processInstanceName,
                        activityId: this.processInstance.nextActivityId,
                        activityName: this.processInstance.nextActivityName,
                        activityName: this.processInstance.nextActivityName,
                        userId: this.processInstance.nextUserEmail,
                        status: 'Running',
                        startDate: format(new Date(), 'yyyy-MM-dd')
                    };

                    await this.pushObject(path, pushObj);
                    await this.saveUserInstance(pushObj);
                    await this.beforeSendNotification(pushObj);

                } else {
                    let actIdx = -1;
                    if (this.processDefinition && this.processDefinition.activities) {
                        actIdx = this.processDefinition.activities.findIndex(activity => 
                            activity.id == this.processInstance.nextActivityId
                        );
                    }
                    if (actIdx > -1) {
                        alert("다음 담당자가 조직도상에 없습니다. 담당자를 다시 지정해주시거나 담당자를 등록해주세요");
                    } else {
                        this.saveInstance('Completed');
                    }
                }
            }
        },

        async saveDefinitionToVectorDB() {
            let definitions = await this.getData("definitions");
            if (definitions) {
                const apiToken = this.generator.getToken();
                const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

                let list = Object.values(definitions);
                list.forEach(async (item) => {
                    var definition = partialParse(item.model);
                    await vectorStore.addText(JSON.stringify(definition), {
                        category: definition.processDefinitionId
                    });
                })
            }
        },

        async queryFromVectorDB(messsage){
            const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

            // Perform a similarity search
            const results = await vectorStore.similaritySearch({
                query: messsage
            });

            if (results.similarItems) {
                return results.similarItems.map((item) => item.text);
            }
        },

        async checkTodolist(path, obj) {
            let workItem;
            let todolist = await this.getData(path);
            if (todolist) {
                todolist = Object.values(todolist);
                todolist.forEach((item) => {
                    if (item.instanceId == obj.instanceId && item.activityId == obj.activityId) {
                        workItem = item;
                    }
                });
            }
            return workItem;
        },

        checkUserEmail(email) {
            const checked = this.organizationChart.some((user) => user.email == email);
            return checked;
        },

        async saveUserInstance(item) {
            if (this.checkUserEmail(item.userId)) {
                var convertEmail = item.userId.replace(/\./gi, '_');
                const userInfo = await this.getData(`enrolledUsers/${convertEmail}`);
                if (userInfo && userInfo.uid) {
                    const path = `users/${userInfo.uid}/instances`;
                    let putObj = [item.instanceId];

                    let instanceList = await this.getData(path);
                    if (instanceList) {
                        instanceList = [...instanceList, ...putObj];
                        const set = new Set(instanceList);
                        putObj = [...set];
                    }

                    await this.putObject(path, putObj);
                }
            }
        },

        async beforeSendNotification(item) {
            var convertEmail = item.userId.replace(/\./gi, '_');
            const userInfo = await this.getData(`enrolledUsers/${convertEmail}`);
            if (userInfo && userInfo.uid) {
                const notiInfo = {
                    noti_type: "instances",
                    isChecked: false,
                    chatId: item.instanceId,
                    title: item.activityName,
                    subtitle: item.definitionName,
                };
                this.sendNotification(userInfo.uid, notiInfo);
            }
        },

        createTests() {
            return {
                // function(me){
                //     let lastReply = me.messages[me.messages.length - 1].content
                //     let json = me.extractJSON(lastReply, (message)=>{
                //             try{
                //                 JSON.parse(message);
                //                 return true
                //             }catch(e){
                //                 return false
                //             }
                //         }
                //     )
                //     if(json.processDefinitionId) alert("success")
                // }
            };
        }
    }
};
</script>
