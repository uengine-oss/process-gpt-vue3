<template>
    <div>
        <v-card flat class="mb-4 bg-lightprimary">
            <v-card-title class="text-h6 cursor-pointer d-flex align-center justify-space-between" @click="toggleExpanded">
                <div class="d-flex align-center">
                    <v-icon class="mr-2">mdi-information-outline</v-icon>
                    참고 정보
                </div>
                <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
            </v-card-title>
            <v-expand-transition>
                <v-card-text v-show="expanded" class="pa-4 pt-0">
                    <div v-for="field in inputFields" :key="field.formId" class="mb-4">
                        <div>
                            <div class="text-subtitle-1 font-weight-medium">
                                <v-icon class="mr-2" size="small">mdi-form-select</v-icon>
                                {{ getActivityName(field.formId) }}
                            </div>
                            <v-divider class="my-2"></v-divider>
                            <v-row class="ma-0 pa-0">
                                <v-col v-for="(value, key) in field.formValue" :key="key" cols="12"
                                    class="pa-4 pb-0 pl-0"
                                >
                                    <div class="d-flex align-center">
                                        <div class="text-caption text-medium-emphasis mr-3 flex-shrink-0">
                                            {{ getFieldText(key, field.formId) }}
                                        </div>
                                        <div class="text-body-2">
                                            {{ formatValue(value) }}
                                        </div>
                                    </div>
                                </v-col>
                            </v-row>
                        </div>
                    </div>
                </v-card-text>
            </v-expand-transition>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";

export default {
    props: {
        inputFields: Array,
        workItem: Object, // workItem에서 procDefId 추출용
    },
    data() {
        return {
            expanded: true, // 기본적으로 펼쳐진 상태
            backend: null,
            fieldMetadata: {}, // 폼별 필드 메타데이터 저장 (레이지 로딩)
            activityMetadata: null, // proc_def의 activities 정보 (레이지 로딩)
        }
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();
        
        // 백그라운드에서 비동기로 메타데이터 로딩 (UI 블로킹 없음)
        if (this.inputFields && Array.isArray(this.inputFields)) {
            const formIds = [...new Set(this.inputFields.map(field => field.formId))];
            
            // 비동기로 로딩하여 UI 블로킹하지 않음
            formIds.forEach(formId => {
                this.fetchFieldsMetadata(formId);
            });
        }
        
        // proc_def의 activities 정보도 백그라운드에서 로딩
        if (this.workItem && this.workItem.worklist && this.workItem.worklist.defId) {
            this.fetchActivityMetadata();
        }
    },
    watch: {
        // inputFields가 변경될 때 새로운 formId에 대해 메타데이터 로딩
        inputFields(newFields) {
            if (newFields && Array.isArray(newFields)) {
                const formIds = [...new Set(newFields.map(field => field.formId))];
                
                // 새로운 formId만 비동기로 로딩
                formIds.forEach(formId => {
                    if (!this.fieldMetadata[formId]) {
                        this.fetchFieldsMetadata(formId);
                    }
                });
            }
        },
        // workItem이 변경될 때 액티비티 메타데이터 로딩
        workItem(newWorkItem) {
            if (newWorkItem && newWorkItem.worklist && newWorkItem.worklist.defId) {
                this.activityMetadata = null; // 초기화
                this.fetchActivityMetadata();
            }
        }
    },
    methods: {
        toggleExpanded() {
            this.expanded = !this.expanded;
        },
        // formId를 통해 fields_json 메타데이터를 백그라운드에서 가져오는 함수
        async fetchFieldsMetadata(formDefId) {
            // 이미 로딩중이거나 로딩완료된 경우 중복 요청 방지
            if (this.fieldMetadata[formDefId] !== undefined) {
                return;
            }

            // 로딩 중임을 표시 (빈 배열로 초기화)
            this.fieldMetadata[formDefId] = [];

            try {
                // backend의 getData 메서드를 활용
                const formObject = await this.backend.getData(`form_def/${formDefId}`, { key: 'id' });
                
                if (formObject && formObject.fields_json) {
                    // Vue 3에서는 직접 할당으로 반응성 자동 처리
                    this.fieldMetadata[formDefId] = formObject.fields_json;
                } else {
                    this.fieldMetadata[formDefId] = [];
                }
            } catch (error) {
                this.fieldMetadata[formDefId] = [];
            }
        },
        // proc_def에서 activities 정보를 백그라운드에서 가져오는 함수
        async fetchActivityMetadata() {
            if (this.activityMetadata !== null) {
                return; // 이미 로딩중이거나 완료된 경우
            }

            // 로딩 중임을 표시
            this.activityMetadata = [];

            try {
                const procDefId = this.workItem.worklist.defId;
                
                const process = await this.backend.getRawDefinition(procDefId);
                
                if (process && process.definition && process.definition.activities) {
                    this.activityMetadata = process.definition.activities;
                } else {
                    this.activityMetadata = [];
                }
            } catch (error) {
                this.activityMetadata = [];
            }
        },
        // formId로 해당하는 activity name을 찾는 헬퍼 함수 (레이지 방식)
        getActivityName(formId) {
            // 메타데이터가 아직 로딩되지 않은 경우 formId 반환
            if (!this.activityMetadata || !Array.isArray(this.activityMetadata)) {
                return formId;
            }
            
            // activities에서 tool이 "formHandler:formId"와 일치하는 항목 찾기
            const activity = this.activityMetadata.find(activity => 
                activity.tool === `formHandler:${formId}`
            );
            
            if (activity && activity.name) {
                return activity.name;
            }
            
            // 찾을 수 없는 경우 원래 formId 반환
            return formId;
        },
        // key 값으로 해당하는 text를 찾는 헬퍼 함수 (레이지 방식)
        getFieldText(key, formDefId) {
            const metadata = this.fieldMetadata[formDefId];
            
            // 메타데이터가 아직 로딩되지 않았거나 로딩 중인 경우 key 반환
            if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
                return key;
            }
            
            // 메타데이터에서 해당 key의 text 찾기
            const field = metadata.find(item => item.key === key);
            if (field && field.text) {
                return field.text;
            }
            
            // 해당 키를 찾을 수 없는 경우 원래 key 값 반환
            return key;
        },
        formatValue(value) {
            if (value === null || value === undefined) {
                return '';
            }
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                // 객체인 경우 JSON.stringify로 변환하되, 너무 길면 잘라서 표시
                const jsonString = JSON.stringify(value, null, 2);
                if (jsonString.length > 100) {
                    return jsonString.substring(0, 100) + '...';
                }
                return jsonString;
            }
            return String(value);
        },
    }
}
</script>