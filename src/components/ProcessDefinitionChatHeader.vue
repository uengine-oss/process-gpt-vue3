<template>
    <div>
        <div style="position: sticky; top:0px; z-index:1; background-color:white;">
            <div class="align-right gap-3 justify-space-between" 
                :style="modelValueStyle ? 'padding: 12px 16px 2px 16px;' : 'padding: 9px 16px 9px 16px;'"
            >
                <v-row class="ma-0 pa-0">
                    <div v-if="fullPath != 'chat'" class="d-flex gap-2 align-center"
                        style="max-width:80%;"
                    >
                        <v-text-field v-if="isEditableTitle" v-model="processName"
                            label="프로세스 정의명" variant="underlined" hide-details class="pa-0 ma-0"
                            style="min-width:150px; width:150px;"
                        ></v-text-field>
                        <v-tooltip v-else  location="bottom">
                            <template v-slot:activator="{ props }">
                                <h5 v-bind="props" class="text-h5 mb-n1 process-title-truncate">{{ modelValue }}</h5>
                            </template>
                            <span>{{ modelValue }}</span>
                        </v-tooltip>
                    </div>
                    <h5 v-else class="text-h5 mb-n1">{{ $t('processDefinition.title') }}</h5>
                    <v-spacer></v-spacer>
                    <!-- 삭제 아이콘 -->
                    <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                density="comfortable" @click="beforeDelete"
                            >
                                <TrashIcon size="24" style="color:#FB977D"/>
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinition.deleteProcess') }}</span>
                    </v-tooltip>
                </v-row>
                
                <div class="custom-tools">
                    <v-row class="ma-0 pa-0 pt-3"
                        :style="modelValueStyle ? 'margin: 5px 0 5.5px 0;' : 'margin-top: 12px;'"
                    >
                    
                        <div class="mr-0 d-flex" v-if="Pal">
                            <!-- PDF 저장 아이콘 -->
                            <v-tooltip location="bottom" :text="$t('processDefinition.savePDF')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="savePDF" icon variant="text" class="text-medium-emphasis" density="comfortable">
                                        <v-icon>mdi-file-pdf-box</v-icon>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                        <!-- 저장 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- 파일업로드 아이콘 -->
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                        density="comfortable" @click="triggerFileInput">
                                        <Icons :icon="'upload'" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.import') }}</span>
                            </v-tooltip>
                            <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn ,.jsonold" style="display: none" />
                    
                            <div v-if="bpmn || fullPath != 'chat'">
                                <!-- 자물쇠 아이콘 -->
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                            density="comfortable" @click="toggleLock">
                                            <Icons :icon="lock ? 'lock' : 'unLock'"/>
                                        </v-btn>
                                    </template>
                                    <span v-if="lock">
                                        {{ editUser != '' && editUser != userInfo.name
                                            ? `현재 ${editUser} 님께서 수정 중입니다. 체크아웃 하는 경우 ${editUser} 님이 수정한 내용은 손상되어 저장되지 않습니다. 체크아웃 하시겠습니까?`
                                            : $t('chat.unlock') }}
                                    </span>
                                    <span v-else>{{ $t('chat.lock') }}</span>
                                </v-tooltip>
                            </div>
                    
                            <!-- 저장아이콘 -->
                            <div v-else>
                                <v-tooltip location="bottom">   
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                            density="comfortable" @click="toggleLock">
                                            <Icons :icon="'save'" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('chat.processDefinitionSave') }}</span>
                                </v-tooltip>
                            </div>
                        </div>
                        <!-- 보기 관련 버튼  -->
                        <div class="mr-4 d-flex">
                            <!-- 히스토리 아이콘 -->
                            <v-tooltip v-if="bpmn && fullPath != 'chat'" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                        density="comfortable" @click="toggleVerMangerDialog">
                                        <HistoryIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.history') }}</span>
                            </v-tooltip>
                            <!-- xml보기 아이콘 -->
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                        density="comfortable" @click="showXmlMode">
                                        <Icons :icon="'code-xml'" :color="isXmlMode ? '#1976D2' : '#666666'"/>
                                    </v-btn>
                                </template>
                                <span>{{ isXmlMode ? $t('processDefinition.showModeling') : $t('processDefinition.showXML') }}</span>
                            </v-tooltip>
                        </div>
                        
                        <!-- 실행 관련 버튼  -->
                        <div class="mr-4 d-flex" v-if="!Pal">
                            <!-- 시뮬레이션 아이콘 -->
                            <v-tooltip location="bottom" :text="$t('processDefinition.simulate')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="executeSimulate" icon variant="text" class="text-medium-emphasis" density="comfortable"
                                    >
                                        <Icons :icon="'bug-play'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>

                            <!-- 실행 아이콘 -->
                            <v-tooltip location="bottom" :text="$t('processDefinition.execution')">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" @click="executeProcess" icon variant="text" class="text-medium-emphasis" density="comfortable"
                                    >
                                        <Icons :icon="'play'" />
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                    </v-row>
                </div>
            </div>

            <v-divider class="ma-0" />
        </div>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: String,
        bpmn: String,
        fullPath: String,
        lock: Boolean,
        editUser: String,
        userInfo: Object,
        isXmlMode: Boolean,
    },
    data() {
        return {
            processName: ""
        }
    },
    created() {
        this.processName = this.modelValue
    },
    watch: {
        modelValue(newVal) {
            this.processName = newVal
        },
        processName(newVal) {
            this.$emit('update:modelValue', newVal);
        }
    },
    computed: {
        Pal() {
            return window.$pal;
        },
        modelValueStyle() {
            if(this.modelValue && this.modelValue !== '' && !this.lock && this.editUser != '' && this.editUser == this.userInfo.name) {
                return true
            } else {
                return false
            }
        },
        isEditableTitle() {
            const checkGPT =  window.$mode === 'ProcessGPT' ? ( this.editUser != '' && this.editUser == this.userInfo.name) : true;
            return !this.lock && checkGPT;
        }
    },
    methods: {
        executeProcess() {
            this.$emit("executeProcess");
        },
        executeSimulate() {
            console.log("simulate")
            this.$emit('executeSimulate');
        },
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileChange(event) {
            this.$emit('handleFileChange', event);
        },
        toggleLock() {
            this.$emit('toggleLock');
        },
        toggleVerMangerDialog() {
            this.$emit('toggleVerMangerDialog', true);
        },
        beforeDelete() {
            this.$emit('beforeDelete');
        },
        showXmlMode() {
            this.$emit('showXmlMode');
        },
        savePDF() {
            this.$emit('savePDF');
        }
    }
};
</script>