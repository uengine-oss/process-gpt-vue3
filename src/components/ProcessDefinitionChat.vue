<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)" :class="{ 'is-deleted': isDeleted }">
        <AppBaseCard>
            <template v-slot:leftpart>
                <process-definition
                    class="process-definition-resize"
                    :bpmn="bpmn"
                    :processDefinition="processDefinition"
                    :key="definitionChangeCount"
                    :isViewMode="isViewMode"
                    :isXmlMode="isXmlMode"
                    :definitionPath="fullPath"
                    :definitionChat="this"
                    :validationList="validationList"
                    @update="updateDefinition"
                    @change="changeElement"
                ></process-definition>
                <process-definition-version-dialog
                    :process="processDefinition"
                    :loading="loading"
                    :open="versionDialog"
                    :definitionPath="fullPath"
                    @close="toggleVersionDialog"
                    @save="saveDefinition"
                ></process-definition-version-dialog>
                <ProcessDefinitionVersionManager
                    :process="processDefinition"
                    :open="verMangerDialog"
                    @close="toggleVerMangerDialog"
                    @changeXML="changeXML"
                ></ProcessDefinitionVersionManager>
            </template>
            <template v-slot:rightpart>
                <div class="no-scrollbar">
                    <Chat
                        :prompt="prompt"
                        :name="projectName"
                        :messages="messages"
                        :chatInfo="chatInfo"
                        :userInfo="userInfo"
                        :lock="lock"
                        :disableChat="disableChat"
                        :chatRoomId="chatRoomId"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-tools>
                            <v-row class="ma-0 pa-0 mt-3">
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            type="file"
                                            class="text-medium-emphasis"
                                            density="comfortable"
                                            @click="triggerFileInput"
                                        >
                                            <Icon icon="material-symbols:upload" width="24" height="24" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('chat.import') }}</span>
                                </v-tooltip>
                                <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn" style="display: none" />

                                <template v-if="bpmn && fullPath != ''">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                class="text-medium-emphasis"
                                                @click="toggleLock"
                                                density="comfortable"
                                            >
                                                <Icon v-if="lock" icon="f7:lock" width="24" height="24"></Icon>
                                                <Icon v-else icon="f7:lock-open" width="24" height="24"></Icon>
                                            </v-btn>
                                        </template>
                                        <span v-if="lock">{{
                                            editUser != '' && editUser != userInfo.name
                                                ? `현재 ${editUser} 님께서 수정 중입니다. 체크아웃 하는 경우 ${editUser} 님이 수정한 내용은 손상되어 저장되지 않습니다. 체크아웃 하시겠습니까?`
                                                : $t('chat.unlock')
                                        }}</span>
                                        <span v-else>{{ $t('chat.lock') }}</span>
                                    </v-tooltip>

                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                class="text-medium-emphasis"
                                                @click="toggleVerMangerDialog"
                                                density="comfortable"
                                            >
                                                <HistoryIcon size="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.history') }}</span>
                                    </v-tooltip>
                                </template>
                                <template v-else>
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                class="text-medium-emphasis"
                                                @click="toggleLock"
                                                density="comfortable"
                                            >
                                                <Icon icon="material-symbols:save" width="24" height="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.processDefinitionSave') }}</span>
                                    </v-tooltip>
                                </template>

                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-if="bpmn && fullPath != ''"
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="beforeDelete"
                                            density="comfortable"
                                        >
                                            <TrashIcon size="24" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('processDefinition.deleteProcess') }}</span>
                                </v-tooltip>

                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-if="bpmn && fullPath != ''"
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            class="text-medium-emphasis"
                                            @click="showXmlMode()"
                                            density="comfortable"
                                        >
                                            <Icon v-if="isXmlMode" icon="fluent-mdl2:modeling-view" width="24" height="24" />
                                            <Icon v-else icon="lucide:code-xml" width="24" height="24" />
                                        </v-btn>
                                    </template>
                                    <span>{{ isXmlMode ? $t('processDefinition.showModeling') : $t('processDefinition.showXML') }}</span>
                                </v-tooltip>
                            </v-row>
                        </template>
                    </Chat>
                </div>
                <v-dialog v-model="deleteDialog" max-width="500">
                    <v-card>
                        <v-card-text>
                            {{ $t('processDefinition.deleteProcessMessage') }}
                        </v-card-text>
                        <v-card-actions class="justify-center pt-0">
                            <v-btn color="primary" variant="flat" @click="deleteProcess">{{ $t('processDefinition.delete') }}</v-btn>
                            <v-btn color="error" variant="flat" @click="deleteDialog = false">{{ $t('processDefinition.cancel') }}</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat
                    :prompt="prompt"
                    :name="projectName"
                    :messages="messages"
                    :chatInfo="chatInfo"
                    :userInfo="userInfo"
                    :lock="lock"
                    :disableChat="disableChat"
                    :chatRoomId="chatRoomId"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                >
                    <template v-slot:custom-tools>
                        <div class="d-flex">
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        type="file"
                                        class="text-medium-emphasis"
                                        @click="triggerFileInput"
                                    >
                                        <Icon icon="material-symbols:upload" width="24" height="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.import') }}</span>
                            </v-tooltip>
                            <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn" style="display: none" />

                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" @click="toggleLock">
                                        <Icon v-if="lock" icon="f7:lock" width="24" height="24"></Icon>
                                        <Icon v-else icon="f7:lock-open" width="24" height="24"></Icon>
                                    </v-btn>
                                </template>
                                <span v-if="lock">{{ $t('chat.unlock') }}</span>
                                <span v-else>{{ $t('chat.lock') }}</span>
                            </v-tooltip>

                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" @click="toggleVerMangerDialog">
                                        <HistoryIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.history') }}</span>
                            </v-tooltip>

                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-if="bpmn && fullPath != ''"
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        @click="beforeDelete"
                                    >
                                        <TrashIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDefinition.deleteProcess') }}</span>
                            </v-tooltip>

                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-if="bpmn && fullPath != ''"
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        @click="showXmlMode()"
                                    >
                                        <Icon v-if="isXmlMode" icon="fluent-mdl2:modeling-view" width="24" height="24" />
                                        <Icon v-else icon="lucide:code-xml" width="24" height="24" />
                                    </v-btn>
                                </template>
                                <span>{{ isXmlMode ? $t('processDefinition.showModeling') : $t('processDefinition.showXML') }}</span>
                            </v-tooltip>
                        </div>
                    </template>
                </Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>
<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';
import xml2js from 'xml2js';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import ProcessDefinitionVersionManager from '@/components/ProcessDefinitionVersionManager.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import { useBpmnStore } from '@/stores/bpmn';

import * as jsondiff from 'jsondiffpatch';
import ChatModule from './ChatModule.vue';
import ProcessDefinitionModule from './ProcessDefinitionModule.vue';
import ChatGenerator from './ai/ProcessDefinitionGenerator';
import Chat from './ui/Chat.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});
export default {
    mixins: [ChatModule, ProcessDefinitionModule],
    name: 'ProcessDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        ProcessDefinition,
        // BpmnModelingCanvas,
        ChatGenerator,
        ProcessDefinitionVersionDialog,
        ProcessDefinitionVersionManager
    },
    data: () => ({
        isXmlMode: false,
        prompt: "",
        changedXML: '',
        path: 'proc_def',
        isChanged: false,
        chatInfo: {
            title: 'processDefinition.cardTitle',
            text: 'processDefinition.processDefinitionExplanation'
        },
        processDefinitionMap: null,
        modeler: null,
        editUser: '',
        // version
        versionDialog: false,
        verMangerDialog: false,
        // delete
        deleteDialog: false,
        isDeleted: false,
        externalSystems: [],
        validationList: {}
    }),
    async created() {
        $try(async () => {
            // Issue: init Methods가 종료되기전에, ChatGenerator를 생성하면서 this로 넘겨주는 Client 정보가 누락되는 현상 발생.
            await this.init();
            this.generator = new ChatGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
            if (this.$store.state.messages) {
                const messagesString = JSON.stringify(this.$store.state.messages);
                this.prompt = `아래 대화 내용에서 프로세스를 유추하여 프로세스 정의를 생성해주세요. 이때 가능한 프로세스를 일반화하여 작성:
                ${messagesString}.`;
                this.$store.commit('clearMessages');
            }
            if (this.$store.state.editMessages) {
                const messagesString = JSON.stringify(this.$store.state.editMessages);
                this.prompt = `아래 대화 내용을 보고 기존 프로세스에서 수정 가능한 부분을 유추하여 프로세스 정의를 수정해주세요.
                ${messagesString}.`;
                this.$store.commit('clearMessages');
            }

            if (this.fullPath && this.fullPath != '') {
                this.chatRoomId = this.fullPath;
            }
        });
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (!(newVal.path.startsWith('/definitions') || newVal.path.startsWith('/forms'))) return;
                    this.messages = [];
                    if (newVal.params.pathMatch) {
                        this.init();
                    }
                }
            }
        }
    },
    computed: {
        fullPath() {
            let path = this.$route.params.pathMatch.join('/');
            if (path.startsWith('/')) {
                path = fullPath.substring(1);
            }
            return path;
        }
    },
    async beforeRouteLeave(to, from, next) {
        const store = useBpmnStore();
        const modeler = store.getModeler;
        const xmlObj = await modeler.saveXML({ format: true, preamble: true });

        if (from.path === '/definitions/chat' && xmlObj && xmlObj.xml && !this.isViewMode) {
            const answer = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    },
    methods: {
        showXmlMode() {
            this.isXmlMode = !this.isXmlMode;
        },
        beforeDelete() {
            if (this.bpmn) {
                this.deleteDialog = true;
            }
        },
        async deleteProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    await backend.deleteDefinition(me.fullPath);
                    me.deleteDialog = false;
                    me.isDeleted = true;
                    me.EventBus.emit('definitions-updated');
                }
            });
        },
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileChange(event) {
            let me = this;
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                // 파일 내용 처리
                me.loadBPMN(content);
            };
            reader.readAsText(file);
        },
        checkedLock(defId) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const lockObj = await me.getData(`lock/${defId}`, { key: 'id' });
                    if (lockObj && lockObj.id && lockObj.user_id) {
                        me.editUser = lockObj.user_id;
                        if (lockObj.user_id == this.userInfo.name) {
                            me.lock = false;
                            me.disableChat = false;
                            me.isViewMode = false;
                        } else {
                            me.lock = true;
                            me.disableChat = true;
                            me.isViewMode = true;
                        }
                    } else {
                        me.editUser = '';
                        me.lock = true;
                        me.disableChat = true;
                        me.isViewMode = true;
                    }
                }
            });
        },
        toggleLock() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.lock) {
                        // 잠금 > 수정가능 하도록
                        if (me.processDefinition && me.useLock) {
                            await me.storage.putObject('lock', {
                                id: me.processDefinition.processDefinitionId,
                                user_id: me.userInfo.name
                            });
                        }
                        me.editUser = me.userInfo.name;
                        me.disableChat = false;
                        me.isViewMode = false;
                        me.lock = false;
                        me.definitionChangeCount++;
                    } else {
                        // 현재 수정가능 > 잠금 상태로 (저장)
                        me.toggleVersionDialog(true);
                    }
                }
            });
        },
        toggleVerMangerDialog(open) {
            // Version Manager Dialog
            this.verMangerDialog = open;
        },
        changeXML(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!info) return;
                    if (!info.id) return;

                    await me.storage.putObject(`${me.path}`, {
                        id: info.id,
                        name: info.name,
                        bpmn: info.xml
                    });
                    me.bpmn = info.xml;
                    me.definitionChangeCount++;
                    me.toggleVerMangerDialog(false);
                }
            });
        },
        async changeElement() {
            this.$nextTick(async () => {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                const xmlObj = await modeler.saveXML({ format: true, preamble: true });
                this.validationList = await backend.validate(xmlObj.xml);
            });
        },
        loadBPMN(bpmn) {
            this.bpmn = bpmn;
            this.definitionChangeCount++;
        },
        removePositionKey(obj) {
            // 배열인 경우, 각 요소에 대해 재귀적으로 함수를 호출
            if (Array.isArray(obj)) {
                return obj.map((item) => removePositionKey(item));
            }
            // 객체인 경우, 키를 순회하며 'position' 키를 제외한 새 객체 생성
            else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                Object.keys(obj).forEach((key) => {
                    if (key !== 'position') {
                        // 'position' 키가 아닌 경우, 재귀적으로 처리
                        newObj[key] = removePositionKey(obj[key]);
                    }
                });
                return newObj;
            }
            // 기본 타입인 경우, 그대로 반환
            return obj;
        },
        async updateDefinition() {
            const store = useBpmnStore();
            let modeler = store.getModeler;
            let xml = await modeler.saveXML({ format: true, preamble: true });
            console.log(xml.xml);
            this.bpmn = xml.xml;
            this.definitionChangeCount++;
            // this.processDefinition = val
            // this.bpmn = this.createBpmnXml(val)
            this.isChanged = true;
        },
        async loadData(path) {
            const me = this;
            try {
                const externalSystems = await backend.getSystemList();
                if(externalSystems) {
                    externalSystems.forEach(async (externalSystem) => {
                        const system = await backend.getSystem(externalSystem.name.replace('.json', ''));
                        me.externalSystems.push(system);
                    });
                }
                me.isDeleted = false;
                let fullPath = me.$route.params.pathMatch.join('/');
                if (fullPath.startsWith('/')) {
                    fullPath = fullPath.substring(1);
                }
                let lastPath = this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
                if (fullPath && lastPath != 'chat') {
                    let bpmn = await backend.getRawDefinition(fullPath, { type: 'bpmn' });
                    if (bpmn) {
                        me.bpmn = bpmn;
                        me.definitionChangeCount++;
                    }
                    if (me.useLock) {
                        const value = await backend.getRawDefinition(fullPath);
                        if (value) {
                            me.processDefinition = value.definition;
                            me.processDefinition.processDefinitionId = value.id;
                            me.processDefinition.processDefinitionName = value.name;
                            me.projectName = me.processDefinition.processDefinitionName;
                        }
                        me.checkedLock(lastPath);
                    } else {
                        me.processDefinition = {
                            processDefinitionId: lastPath,
                            processDefinitionName: lastPath
                        };
                        me.processDefinition = await me.convertXMLToJSON(me.bpmn);
                    }
                } else if (lastPath == 'chat') {
                    // me.processDefinition = null;
                    me.projectName = null;
                    me.bpmn = null;
                    me.processDefinition = await me.convertXMLToJSON(me.bpmn);

                    if (me.$route.query && me.$route.query.id) {
                        me.processDefinition = {
                            processDefinitionId: me.$route.query.id
                        };
                        if (me.$route.query.name) {
                            me.projectName = me.$route.query.name;
                            me.processDefinition.processDefinitionName = me.projectName;
                        }
                    }

                    me.lock = false;
                    me.disableChat = false;
                    me.isViewMode = false;
                    me.definitionChangeCount++;
                }

                // 프로세스 정의 체계도에서 넘어온 쿼리 파라미터 처리
                if (me.$route.query && me.$route.query.modeling) {
                    document.title = me.projectName;
                }
                me.processDefinitionMap = await backend.getProcessDefinitionMap();
            } catch (e) {
                console.log(e)
                alert(e);
            }
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },
        extractPropertyNameAndIndex(jsonPath) {
            let match;
            match = jsonPath.match(/^\$\.(\w+)\[(\d+)\]$/);
            if (!match) {
                match = jsonPath.match(/^\$\.(\w+)\[\?(.*)\]$/);
                return match ? { propertyName: match[1], index: match.index } : null;
            } else {
                return { propertyName: match[1], index: parseInt(match[2], 10) };
            }
        },
        modificationAdd(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            if (obj) {
                this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value);
            } else if (this.processDefinition[modification.targetJsonPath.replace('$.', '')]) {
                this.processDefinition[modification.targetJsonPath.replace('$.', '')].push(modification.value);
            }
        },
        modificationReplace(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            // const updateAtIndex = (array, index, newValue) => (array[index] = newValue, array);
            this.processDefinition[obj.propertyName][obj.index] = modification.value;
            // this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value)
        },
        modificationRemove(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            this.processDefinition[obj.propertyName].splice(obj.index, 1);
            // {
            //     action: "replace",
            //     index: 2,
            //     targetJsonPath: "$.sequences[2]",
            //     value: {
            //         "source": "AcceptLeader",
            //         "target": "ReturnFromLeave"
            //     }
            // }
        },
        async afterModelCreated(response) {
            let jsonProcess;
            try {
                jsonProcess = this.extractJSON(response);

                if (jsonProcess) {
                    let unknown = partialParse(jsonProcess);
                    if (unknown.processDefinitionId) {
                        this.processDefinition = unknown;
                        this.bpmn = this.createBpmnXml(this.processDefinition);
                        this.definitionChangeCount++;
                    }
                }
            } catch (error) {
                console.log(jsonProcess);
                console.log(error);
            }
        },

        afterGenerationFinished(response) {
            let jsonProcess = null;
            if (typeof response === 'string') {
                jsonProcess = JSON.parse(response);
            } else {
                jsonProcess = response;
            }

            if (jsonProcess) {
                let unknown = jsonProcess;

                if (unknown.megaProcessId && this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                    if (!this.processDefinitionMap.mega_proc_list.some(megaProcess => megaProcess.name == unknown.megaProcessId)) {
                        this.processDefinitionMap.mega_proc_list.push({
                            name: unknown.megaProcessId,
                            id: unknown.megaProcessId,
                            major_proc_list: [{
                                name: unknown.majorProcessId,
                                id: unknown.majorProcessId,
                                sub_proc_list: [{
                                    id: unknown.processDefinitionId,
                                    name: unknown.processDefinitionName
                                }]
                            }]
                        })
                    }
                    if (unknown.majorProcessId) {
                        this.processDefinitionMap.mega_proc_list.forEach(megaProcess => {
                            if (megaProcess.name == unknown.megaProcess) {
                                if (megaProcess.major_proc_list.some(majorProcess => majorProcess.name == unknown.majorProcessId)) {
                                    const idx = megaProcess.major_proc_list.findIndex(majorProcess => majorProcess.name == unknown.majorProcessId);
                                    if (!megaProcess.major_proc_list[idx].sub_proc_list.some(subProcess => subProcess.id == unknown.processDefinitionId)) {
                                        megaProcess.major_proc_list[idx].sub_proc_list.push({
                                            id: unknown.processDefinitionId,
                                            name: unknown.processDefinitionName
                                        })
                                    }
                                } else {
                                    megaProcess.major_proc_list.push({
                                        name: unknown.majorProcessId,
                                        id: unknown.majorProcessId,
                                        sub_proc_list: [{
                                            id: unknown.processDefinitionId,
                                            name: unknown.processDefinitionName
                                        }]
                                    })
                                }
                            }
                        })
                    }
                }
                
                if (unknown.modifications) {
                    unknown.modifications.forEach((modification) => {
                        if (modification.action == 'replace') {
                            this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                            console.log(this.processDefinition);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        } else if (modification.action == 'add') {
                            this.modificationAdd(modification);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        } else if (modification.action == 'delete') {
                            this.modificationRemove(modification);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        }
                    });

                    this.definitionChangeCount++;
                }
            }

            this.isChanged = true;
        },
        afterModelStopped(response) {},
        async saveToVectorStore(definition) {
            // Create an instance of VectorStorage
            // const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: this.openaiToken });

            // Add a text document to the store
            await vectorStore.addText(JSON.stringify(definition), {
                category: definition.processDefinitionId
            });
        },
        generateElement(name, x, y, width, height, id, canvas) {
            var me = this;
            const component = me.getComponentByName(name);
            if (!component) return null;

            if (!id) id = me.uuid();
            if (!x) x = 500;
            if (!y) x = 500;
            if (!canvas) canvas = null;

            return component.computed.createNew(canvas, id, x, y, width, height);
        },
        getComponentByName: function (name) {
            var componentByName;
            $.each(window.bpmnComponents, function (i, component) {
                if (component.default.name == name) {
                    componentByName = component;
                }
            });
            return componentByName;
        },
    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width: 1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100vh - 192px) !important;
    }
}

:deep(.left-part) {
    width: 75%;
    /* Apply specific width */
}

.is-deleted {
    position: relative;
}
.is-deleted::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5); /* 회색 오버레이 */
    z-index: 10;
}
</style>

