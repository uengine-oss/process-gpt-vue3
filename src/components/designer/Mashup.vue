<template>
    <div class="mashup-editor">
        <div class="editor-toolbar">
            <span class="editor-title">{{ $t('Mashup.hoverText') }}</span>
            <div class="editor-actions">
                <v-btn size="small" variant="text" @click="clearStat">Clear</v-btn>
            </div>
        </div>

        <v-textarea
            v-model="editorContent"
            class="editor-input"
            auto-grow
            density="comfortable"
            hide-details
            label="Form HTML"
            rows="18"
            spellcheck="false"
            variant="outlined"
            @update:modelValue="handleEditorChange"
        />
    </div>
</template>

<script>
export default {
    name: 'mash-up',
    props: {
        modelValue: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'onChangeKEditorContent', 'onInitKEditorContent', 'onSaveFormDefinition'],
    expose: ['getKEditorContentHtml', 'clearStat'],
    data() {
        return {
            editorContent: this.modelValue || ''
        };
    },
    watch: {
        modelValue(newValue) {
            if (newValue !== this.editorContent) {
                this.editorContent = newValue || '';
            }
        }
    },
    mounted() {
        this.$emit('onInitKEditorContent', this.getKEditorContentHtml());
    },
    methods: {
        emitEditorState() {
            const html = this.getKEditorContentHtml();
            this.$emit('update:modelValue', html);
            this.$emit('onChangeKEditorContent', {
                kEditorContent: html,
                html
            });
        },
        handleEditorChange() {
            this.emitEditorState();
        },
        clearStat() {
            this.editorContent = '';
            this.emitEditorState();
        },
        getKEditorContentHtml() {
            return this.editorContent || '';
        }
    }
};
</script>

<style scoped>
.mashup-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.editor-toolbar {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
}

.editor-title {
    font-size: 16px;
    font-weight: 600;
}

.editor-actions {
    display: flex;
    gap: 8px;
}

.editor-input :deep(textarea) {
    font-family: Monaco, Menlo, Consolas, monospace;
    min-height: 480px;
}
</style>
