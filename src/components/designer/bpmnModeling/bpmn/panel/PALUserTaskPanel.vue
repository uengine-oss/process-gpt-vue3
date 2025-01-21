<template>
    
    <div class="gpt-user-task-panel ma-0">
        <quill-editor
            :content="activity.description"
            content-type="html"
            class="mb-4"
            style="height: 50vh;"
            :options="options"
            @update:content="onTextChange"
        ></quill-editor>
        <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-4"></Checkpoints>
        
        <div class="d-flex justify-space-between align-center">
            <h6 class="text-body-1 ml-2">첨부파일</h6>
            <v-btn
                @click="$refs.fileInput.click()"
            >
                + 
            </v-btn>
        </div>
        <v-file-input
            ref="fileInput"
            type="file"
            multiple
            style="display: none"
            @update:modelValue="onFileChange"
        />
        <div v-if="activity.attachments && activity.attachments.length > 0" style="border: 1px solid lightgray;">
            <div v-for="(attachment, index) in activity.attachments" :key="index">
                <div class="d-flex align-center cursor-pointer">
                    <v-icon @click="openFile(attachment)">mdi-file-document-outline</v-icon>
                    <div class="ml-2 mr-auto" @click="openFile(attachment)">{{ replaceText(attachment) }}</div>
                    <v-icon v-if="!isViewMode" @click="activity.attachments = activity.attachments.filter(a => a !== attachment)">mdi-delete-outline</v-icon>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';

import { defineAsyncComponent } from 'vue';
const FormDefinition = defineAsyncComponent(() => import('@/components/FormDefinition.vue'));

import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'pal-user-task-panel',
    components: {
        Instruction,
        Checkpoints,
        FormDefinition,
        QuillEditor
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        isPreviewMode: Boolean,
        role: String,
        roles: Array,
        variableForHtmlFormContext: Object,
        definition: Object,
        name: String
    },
    data() {
        return {
            copyUengineProperties: null,
            copyDefinition: null,
            backend: null,
            activity: {},
            formId: '',
            tempFormHtml: '',
            activeTab: 'setting',
            fieldsJson: []
        };
    },
    created() {
        var me = this;
        this.backend = BackendFactory.createBackend();
        me.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties));
        if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
            const activity = this.processDefinition.activities.find(activity => activity.id === this.element.id);
            if (activity) {
                this.activity = activity;
            } else {
                console.log('Activity not found');
            }
        }
    },
    async mounted() {
        let me = this;
        await me.init();
    },
    computed: {
        isPal() {
            return window.$pal;
        },
        options() {
            return {
                // placeholder: this.$t('PALUserTaskPanel.insertDescription'),
                readOnly: this.isViewMode,
                modules: this.isViewMode ? {toolbar: false} : {},
                theme: 'snow'
            }
        }
    },
    watch: {
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                console.log(this.processDefinition)
                this.EventBus.emit('process-definition-updated', this.processDefinition);
            }
        },
    },
    methods: {
        async init() {
            var me = this;
            me.copyDefinition = me.definition;
        },
        async beforeSave() {
            var me = this;
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
        onTextChange(text) {
            var me = this;
            me.activity.description = text;
        },
        onFileChange(files) {
            var me = this;
            if (!me.activity.attachments) {
                me.activity.attachments = [];
            }
            if (files && files.length > 0) {
                files.forEach(async (file) => {
                    const fileName = `uploads/${Date.now()}_${file.name}`;
                    const data = await me.backend.uploadFile(fileName, file);
                    if (data && data.path) {
                        me.activity.attachments.push(data.path);
                    }
                });
            }
            me.$emit('update:processDefinition', me.processDefinition);
        },
        async openFile(path) {
            const downloadUrl = await this.backend.getFileUrl(path);
            window.open(downloadUrl, '_blank');
        },
        replaceText(text) {
            if (typeof text === 'string' && text.includes('uploads/')) {
                return text.replace('uploads/', '');
            }
            return text;
        }
    }
};
</script>

<style scoped>
.gpt-user-task-panel {
    margin: -16px;
}
</style>