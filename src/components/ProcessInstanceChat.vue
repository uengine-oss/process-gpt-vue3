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
                        <process-definition 
                            v-if="onLoad"    
                            style="width: 100%; height: 100%" 
                            :bpmn="bpmn" 
                            :processDefinition="processDefinition"
                        ></process-definition>
                        <div v-else style="height: 100%; text-align: center">
                            <v-progress-circular style="top: 50%" indeterminate color="primary"></v-progress-circular>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="secondary"
                            class="px-4 rounded-pill mx-auto" 
                            @click="isViewProcess = false" 
                            variant="tonal"
                        >Close Dialog</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
            
            <v-dialog v-model="definitionDialog" max-width="800">
                <v-card>
                    <v-card-title class="text-h5">
                        프로세스 정의 목록
                    </v-card-title>
                    <v-card-text>
                        <v-data-table
                            v-model="processDefinition"
                            :headers="headers"
                            :items="definitions"
                            item-value="id"
                            select-strategy="single"
                            show-select
                            return-object
                        ></v-data-table>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="success" 
                            class="px-4 rounded-pill mx-auto"
                            variant="tonal"
                            @click="beforeSendMessage()"
                        >Select</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>

            <Chat :messages="messages"
                :chatInfo="chatInfo"
                :userInfo="userInfo" 
                :disableChat="disableChat"
                :type="path"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="sendEditedMessage"
                @stopMessage="stopMessage"
                @getMoreChat="getMoreChat"
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

import ChatGenerator from './ai/ProcessInstanceGenerator.js';
import ChatModule from '@/components/ChatModule.vue';

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import Chat from "@/components/ui/Chat.vue";
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        ProcessInstanceList,
        ProcessDefinition,
    },
    data: () => ({
        headers: [
            { title: 'id', align: 'start', key: 'processDefinitionId' },
            { title: 'name', align: 'start', key: 'processDefinitionName' },
            { title: 'description', align: 'start', key: 'description' },
        ],
        definitions: null,
        definitionDialog: false,
        processDefinition: null,
        processInstance: null,
        path: 'instances',
        organizationChart: [],
        chatInfo: {
            title: 'processExecution.cardTitle',
            text: "processExecution.processDefinitionExplanation"
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
                if (newVal.query !== oldVal.query) {
                    this.messages = [];
                    await this.init();
                }
            }
        },
    },
    methods: {
        async viewProcess() {
            this.onLoad = false;
            let definitionInfo = null;
            let instanceId = "";
            if (this.$route.query.id) {
                instanceId = this.$route.query.id;
                this.isViewProcess = !this.isViewProcess;
            } else if (this.processInstance && this.processInstance.proc_inst_id) {
                instanceId = this.processInstance.proc_inst_id;
                this.isViewProcess = !this.isViewProcess;
            } else {
                alert("실행 중인 프로세스 인스턴스를 선택하세요.");
                return;
            }
            var definitionId = instanceId.split('.')[0];
            const instanceInfo = await this.getData(`${definitionId}/${instanceId}`, {key: "proc_inst_id"});
            if (instanceInfo) {
                definitionInfo = await this.getData(`definitions/${definitionId}`, {key: "id"});
            }
            if (definitionInfo) {
                let definition = partialParse(definitionInfo.model);
                definition.activities.forEach(function (activity) {
                    if (activity.id == instanceInfo.nextActivityId) activity.status = 'Running';
                });
                this.onLoad = true;
            }
        },
        async loadData(path) {
            let value;
            this.processInstance = null;

            if (this.$route.query.id) {
                const id = this.$route.query.id;
                value = await this.getData(`${this.path}/${id}`, {key: "id"});
                if (value && value.messages) {
                    this.messages = value.messages;
                }

                var def_id = id.split('.')[0];
                value = await this.getData(`${def_id}/${id}`, {key: "proc_inst_id"});
                if (value) {
                    this.processInstance = value;
                }
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
            if (newMessage) {
                if (this.processInstance && this.processInstance.proc_inst_id) {
                    this.generator.beforeGenerate(newMessage, false);

                    this.sendMessage(newMessage);
                } else {
                    this.generator.beforeGenerate(newMessage, true);

                    var procDefs = await this.queryFromVectorDB(newMessage);
                    procDefs = procDefs.map(item => JSON.parse(item));
                    this.definitions = procDefs;
                    this.definitionDialog = true;
                }
            } else {
                if (this.processInstance && this.processInstance.proc_inst_id) {
                    this.generator.beforeGenerate(newMessage, false);
                } else {
                    this.generator.beforeGenerate(newMessage, true);
                }

                this.definitionDialog = false;
                this.sendMessage(this.generator.input.answer);
            }
        },
        afterModelCreated(response) {
        },
        async afterGenerationFinished(response) {
            let messageWriting = this.messages[this.messages.length - 1];
            messageWriting.content = response;
            
            const jsonData = JSON.parse(response);
            if (jsonData) {
                this.saveInstance(jsonData);

                if (!this.$route.query.id) {
                    this.processInstance = jsonData;
                    this.$router.replace(`chat?id=${jsonData.instanceId}`);
                }
            }
            // if (this.processInstance) {
            //     if (typeof this.processInstance === 'string') {
            //         this.processInstance = partialParse(this.processInstance);
            //     }
            //     await this.saveInstance();
            //     await this.saveTodolist();
            // }
        },
        afterModelStopped(response) {
            let path = '';

            if (this.$route.query.id) {
                path = this.$route.query.id;
            } else if (this.processInstance && this.processInstance.processInstanceId) {
                path = this.processInstance.processInstanceId;
            }
            
            if (path != '') {
                let putObj = {
                    messages: this.messages
                };
                this.putObject(`${this.path}/${path}`, putObj, {key: 'id'});
            }
        },
        async saveInstance(data) {
            if (data) {
                let putObj = {
                    id: data.instanceId,
                    user_id: this.userInfo.email,
                    messages: this.messages
                }
                await this.putObject(this.path, putObj);
                // this.checkDisableChat(putObj);
            }
        },
        async saveTodolist() {
            if (this.processInstance) {
                const checkedNextAct = await this.checkNextActivity(this.processInstance.currentActivityId, this.processInstance.nextActivityId);
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
                        endDate: Date.now(),
                    };

                    if (checkedNextAct) {
                        pushObj.status = 'done';
                    } else {
                        pushObj.status = 'pending';
                    }

                    const workItem = await this.checkTodolist(path, pushObj);
                    if (workItem) {
                        pushObj.startDate = workItem.startDate;
                        await this.delete(`${path}/${workItem.key}`);
                    } else {
                        pushObj.startDate = Date.now();
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
                        startDate: Date.now(),
                    };

                    if (checkedNextAct) {
                        pushObj.status = 'in_progress';
                    } else {
                        pushObj.status = 'todo';
                    }

                    if (this.processInstance.nextActivityId == "end_process") {
                        pushObj.activityId = "";
                        pushObj.activityName = "";
                    }

                    const workItem = await this.checkTodolist(path, pushObj);
                    if (workItem) {
                        await this.delete(`${path}/${workItem.key}`);
                    }

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
                    if (item.definition) {
                        await vectorStore.addText(JSON.stringify(item.definition), {
                            category: item.definition.processDefinitionId
                        });
                    }
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
                return results.similarItems.map(item => item.text);
            } else {
                this.saveDefinitionToVectorDB();
                this.queryFromVectorDB(messsage);
            }
        },

        async checkNextActivity(prevId, nextId) {
            var res = false;
            if (nextId) {
                if (nextId == "end_process") {
                    res = true;
                } else {
                    var contexts = await this.queryFromVectorDB(prevId);
                    if (!contexts || contexts.length < 1) {
                        await this.saveDefinitionToVectorDB();
                        contexts = await this.queryFromVectorDB(prevId);
                    }
                    var definition = JSON.parse(contexts[0]);
                    var prevIdx = definition.activities.findIndex(act => act.id == prevId);
                    var nextIdx = definition.activities.findIndex(act => act.id == nextId);
                    if (prevIdx < nextIdx) {
                        res = true;
                    }
                }
            }
            return res;
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
                const userInfo = await this.getData(`users/${convertEmail}`);
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
            const userInfo = await this.getData(`users/${convertEmail}`);
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
