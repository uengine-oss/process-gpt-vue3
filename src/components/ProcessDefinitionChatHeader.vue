<template>
    <div>
        <div style="position: sticky; top:0px; z-index:1; background-color:white;">
            <div class="align-right gap-3 justify-space-between" 
                :style="modelValueStyle ? 'padding: 15.5px 16px 0 16px;' : 'padding: 16px;'"
            >
                <div v-if="modelValue && modelValue !== ''" class="d-flex gap-2 align-center">
                    <v-text-field v-if="!lock && editUser != '' && editUser == userInfo.name" v-model="processName"
                        label="프로세스 정의명" variant="underlined" hide-details class="pa-0 ma-0"></v-text-field>
                    <h5 v-else class="text-h5 mb-n1">{{ modelValue }}</h5>
                </div>
                <h5 v-else class="text-h5 mb-n1">프로세스 정의</h5>
                
                <div class="custom-tools">
                    <div class="d-flex" 
                        :style="modelValueStyle ? 'margin: 5px 0 5.5px 0;' : 'margin-top: 12px;'">
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
                
                        <div v-if="bpmn && fullPath != 'chat'">
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
                
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                        density="comfortable" @click="toggleVerMangerDialog">
                                        <HistoryIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.history') }}</span>
                            </v-tooltip>
                
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                        density="comfortable" @click="beforeDelete">
                                        <TrashIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDefinition.deleteProcess') }}</span>
                            </v-tooltip>
                    
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
        modelValueStyle() {
            if(this.modelValue && this.modelValue !== '' && !this.lock && this.editUser != '' && this.editUser == this.userInfo.name) {
                return true
            } else {
                return false
            }
        }
    },
    methods: {
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileChange() {
            this.$emit('handleFileChange');
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
        }
    }
};
</script>