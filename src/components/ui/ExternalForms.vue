<template>
    <div :style="{ 'max-width': isMobile ? '100%' : '800px' }" class="mx-auto my-4">
        <!-- 폼을 찾을 수 없는 경우 에러 메시지 -->
        <div v-if="formNotFound" class="text-center pa-8">
            <v-icon color="error" size="64" class="mb-4">mdi-alert-circle-outline</v-icon>
            <h3 class="text-h6 mb-2">{{ $t('ExternalForms.formNotFound') }}</h3>
            <p class="text-body-2 text--secondary">
                {{ $t('ExternalForms.formNotFoundMessage') }}
            </p>
        </div>
        <template v-else>
            <!-- 참조 폼 목록 -->
            <div v-if="refForms.length > 0" class="mb-6">
                <v-card 
                    v-for="(refForm, index) in refForms" 
                    :key="'refForm-'+index"
                    class="mb-4"
                    variant="outlined"
                    :color="'grey-lighten-4'"
                >
                    <v-card-title class="d-flex align-center pa-4" style="background-color: #f5f5f5; border-bottom: 2px solid #e0e0e0;">
                        <v-icon class="mr-2" color="info">mdi-information-outline</v-icon>
                        <div class="flex-grow-1">
                            <div class="text-body-1 font-weight-medium">
                                {{ refForm.name || $t('ExternalForms.previousStep') }}
                            </div>
                            <div class="text-caption text--secondary mt-1">
                                {{ $t('ExternalForms.previousStepDescription') }}
                            </div>
                        </div>
                    </v-card-title>
                    <v-card-text class="pa-4">
                        <DynamicForm 
                            :ref="'refForm-'+index" 
                            :formHTML="refForm.html" 
                            v-model="refForm.formData" 
                            class="dynamic-form" 
                            :readonly="true"
                        ></DynamicForm>
                    </v-card-text>
                </v-card>
            </div>
            <!-- 현재 폼 -->
            <v-card v-if="html" class="mb-4" variant="outlined">
                <v-card-title v-if="refForms.length > 0" class="pa-4" style="background-color: #e3f2fd; border-bottom: 2px solid #2196f3;">
                    <v-icon class="mr-2" color="primary">mdi-file-document-edit-outline</v-icon>
                    <span class="text-body-1 font-weight-medium">
                        {{ $t('ExternalForms.currentStep') }}
                    </span>
                </v-card-title>
                <v-card-text class="pa-4">
                    <DynamicForm 
                        ref="dynamicForm" 
                        :formHTML="html" 
                        v-model="formData" 
                        class="dynamic-form" 
                        :readonly="isSubmitted"
                    ></DynamicForm>
                </v-card-text>
            </v-card>
            <!-- 제출 버튼 -->
            <div class="my-4">
                <v-btn @click="sendFormData"
                    block
                    :color="isSubmitted ? '' : 'primary'"
                    :loading="isSubmitting"
                    :disabled="isSubmitted || !html || formNotFound">
                    {{ isSubmitted ? $t('ExternalForms.submitted') : $t('ExternalForms.submit') }}
                </v-btn>
            </div>
        </template>
    </div>
</template>


<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm
    },
    data() {
        return {
            html: '',
            formData: {},
            isSubmitting: false,
            isSubmitted: false,
            refForms: [],
            formNotFound: false
        }
    },
    computed: {
        formId() {
            if (this.$route.params.formId) {
                return this.$route.params.formId;
            } else {
                return null;
            }
        },
        processDefinitionId() {
            if (this.$route.query.process_definition_id) {
                return this.$route.query.process_definition_id;
            } else {
                return null;
            }
        },
        activityId() {
            if (this.$route.query.activity_id) {
                return this.$route.query.activity_id;
            } else {
                return null;
            }
        },
        instanceId() {
            if (this.$route.query.process_instance_id) {
                return this.$route.query.process_instance_id;
            } else {
                return null;
            }
        },
        taskId() {
            if (this.$route.query.task_id) {
                return this.$route.query.task_id;
            } else {
                this.isSubmitted = false;
                this.formData = {};
                return null;
            }
        },
        isMobile() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        }
    },
    async mounted() {
        try {
            this.html = await backend.getRawDefinition(this.formId, { type: 'form' });
            
            // 폼을 찾지 못한 경우 처리
            if (!this.html || this.html.trim() === '') {
                this.formNotFound = true;
                this.isSubmitted = true;
                return;
            }
        } catch (error) {
            console.error('폼 조회 중 오류 발생:', error);
            this.formNotFound = true;
            this.isSubmitted = true;
            return;
        }

        if (this.taskId) {
            const value = await backend.getVariableWithTaskId(this.instanceId, this.taskId, this.formId);
            this.formData = value.valueMap || {};
            if (value.valueMap) {
                this.isSubmitted = true;
            }
        }

        if (this.instanceId && this.activityId) {
            const worklist = await backend.getWorkListByInstId(this.instanceId);
            if (worklist.length > 0) {
                const currentTask = worklist.find(item => item.tracingTag === this.activityId);
                if (currentTask) {
                    if (currentTask.status === 'DONE' || currentTask.status === 'COMPLETED') {
                        this.isSubmitted = true;
                    }
                    // 폼 정보 조회
                    const formId = currentTask.tool ? currentTask.tool.split('formHandler:')[1] : null;
                    if (formId) {
                        const formData = await backend.getVariableWithTaskId(this.instanceId, currentTask.taskId, formId);
                        if (formData) {
                            this.formData = formData.valueMap || {};
                        }
                    }
                    // 참조 폼 목록 조회
                    try {
                        const refForms = await backend.getRefForm(currentTask.taskId);
                        if (refForms && Array.isArray(refForms)) {
                            this.refForms = refForms
                                .filter(item => item && item.html) // html이 있는 항목만 필터링
                                .map(item => {
                                    return {
                                        name: item.name || '', // 참조 폼 이름도 함께 저장
                                        html: item.html,
                                        formData: item.formData || {}
                                    }
                                });
                        }
                    } catch (error) {
                        console.error('참조 폼 조회 중 오류 발생:', error);
                        // 참조 폼 로드 실패해도 메인 폼은 계속 표시
                        this.refForms = [];
                    }
                }
            }
        }

        if (!this.processDefinitionId || !this.activityId || !this.formId) {
            alert(this.$t('ExternalForms.invalidAccess'));
            this.isSubmitted = true;
            this.formNotFound = true;
        }
    },
    methods: {
        async sendFormData() {
            var me = this;

            const roleMappings = [{
                name: '외부 고객',
                endpoint: 'external_customer',
                resolutionRule: 'External Customer'
            }]

            let formValues = {};
            if (me.formId) {
                formValues[me.formId] = me.formData;
            }

            let input = {
                process_definition_id: me.processDefinitionId,
                process_instance_id: me.instanceId ? me.instanceId : 'new',
                activity_id: me.activityId,
                role_mappings: roleMappings,
                answer: "",
                form_values: formValues
            };

            backend.start(input).then((response) => {
                me.isSubmitting = false;
                me.isSubmitted = true;
                if (response && response.id) {
                    const taskId = response.id;
                    this.$router.push({ query: { ...this.$route.query, task_id: taskId } });
                }
            })
            .catch(error => {
                console.log(error);
            });

            me.$try({
                action: () => {
                    me.isSubmitting = true;
                },
                successMsg: me.$t('ExternalForms.submittedMessage'),
            });
        },
        async validateFormURL() {
            if (!this.processDefinitionId || !this.activityId || !this.formId) {
                return false;
            } else {
                if (this.taskId) {
                    const value = await backend.getWorkItem(this.taskId);
                    if (value && value.worklist) {
                        return true;
                    } else {
                        return false;
                    }
                } else if (this.instanceId) {
                    const value = await backend.getWorkListByInstId(this.instanceId);
                    if (value && value.length > 0) {
                        return true;
                    } else {
                        return false;
                    }
                } else if (!this.instanceId && !this.taskId) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    }
}
</script>


