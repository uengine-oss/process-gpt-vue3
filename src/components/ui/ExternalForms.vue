<template>
    <div :style="{ 'max-width': isMobile ? '100%' : '800px' }" class="mx-auto my-4">
        <DynamicForm v-if="html" ref="dynamicForm" :formHTML="html" v-model="formData" class="dynamic-form" :readonly="isCompleted"></DynamicForm>
        <div v-if="!isCompleted" class="my-4">
            <v-btn @click="sendFormData" color="primary" block :loading="isSubmitting">제출</v-btn>
        </div>
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
            isSubmitting: false
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
        isCompleted() {
            if (this.instanceId) {
                return true;
            } else {
                return false;
            }
        },
        isMobile() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        }
    },
    async created() {
        if (!this.processDefinitionId || !this.activityId || !this.formId) {
            alert('잘못된 접근입니다.');
            this.$router.push('/');
        }

        this.html = await backend.getRawDefinition(this.formId, { type: 'form' });

        if (this.instanceId) {
            const value = await backend.getVariableWithTaskId(this.instanceId, '', this.formId);
            this.formData = value.valueMap;
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

            let input = {
                process_definition_id: me.processDefinitionId,
                process_instance_id: 'new',
                activity_id: me.activityId,
                role_mappings: roleMappings,
                answer: {}
            };

            input.answer[me.formId] = me.formData;

            backend.start(input).then((result) => {
                me.isSubmitting = false;
                alert('제출되었습니다.');
            })
            .catch(error => {
                console.log(error);
            });

            me.isSubmitting = true;
        }
    }
}
</script>


