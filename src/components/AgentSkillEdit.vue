<template>
    <v-card flat v-if="skillFile">
        <v-card-title class="d-flex align-center justify-space-between px-0">
            <div class="d-flex align-center text-h6">
                <v-text-field
                    v-if="!readOnly && isEditable"
                    v-model="fileName"
                    class="ml-2 my-2"
                    hide-details
                    style="min-width: 300px; flex: 1;"
                    density="compact"
                ></v-text-field>
                <span v-else class="ml-3">{{ fileName }}</span>
            </div>
            <div class="d-flex align-center gap-2 mr-2">
                <v-btn v-if="isMarkdown" @click="toggleMarkdownPreview" variant="text" icon size="small">
                    <v-icon>{{ markdownPreview ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                </v-btn>
                <v-btn v-if="!readOnly" @click="saveSkillFile" variant="text" icon color="primary" :loading="isLoading" size="small">
                    <v-icon>mdi-content-save</v-icon>
                </v-btn>
                <v-btn v-if="!readOnly && isEditable" @click="deleteDialog = true" variant="text" icon color="error" size="small">
                    <v-icon>mdi-delete</v-icon>
                </v-btn>
            </div>
        </v-card-title>
        <v-card-text class="h-100 px-0">
            <!-- <v-textarea 
                v-model="skillContent"
                rows="19"
            ></v-textarea> -->
            <div v-if="markdownPreview" class="h-100 markdown-preview markdown-content">
                <div v-html="markdownHtml"></div>
            </div>
            <vue-monaco-editor
                v-else
                v-model:value="skillContent"
                :language="editorLanguage"
                :options="monacoEditorOptions"
                @mount="handleMount"
            />
        </v-card-text>
    </v-card>

    <!-- delete dialog -->
    <v-dialog v-model="deleteDialog" width="400">
        <v-card>
            <v-card-title>
                {{ $t('AgentSkillEdit.deleteDialogTitle') }}
            </v-card-title>
            <v-card-text>
                {{ $t('AgentSkillEdit.deleteDialogMessage') }}
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn @click="deleteDialog = false" variant="flat" color="error" rounded>
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn @click="deleteSkillFile" variant="flat" color="primary" rounded>
                    {{ $t('common.delete') }}
                </v-btn>
            </v-card-actions>

        </v-card>
    </v-dialog>
</template>

<script>
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import BackendFactory from '@/components/api/BackendFactory';

// marked + highlight.js 연동 (코드 블록 문법 하이라이팅)
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (_) {}
        }
        try {
            return hljs.highlightAuto(code).value;
        } catch (_) {}
        return code;
    }
});

export default {
    name: 'AgentSkillEdit',
    props: {
        skillFile: {
            type: Object,
            default: () => ({})
        },
        readOnly: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            backend: null,
            skillName: '',
            fileName: '',
            skillContent: '',
            deleteDialog: false,
            isLoading: false,

            // markdown preview
            markdownPreview: false
        }
    },
    computed: {
        monacoEditorOptions() {
            return {
                automaticLayout: true,
                formatOnType: true,
                formatOnPaste: true,
                readOnly: this.readOnly
            };
        },
        markdownHtml() {
            if (!this.markdownPreview || !this.skillContent) return '';
            return marked(this.skillContent);
        },
        isMarkdown() {
            return this.fileName && (this.fileName.endsWith('.md') || this.fileName.endsWith('.markdown'));
        },
        isEditable() {
            return this.fileName && this.fileName !== 'SKILL.md' && !this.isLoading;
        },
        editorLanguage() {
            const filePath = this.fileName || '';
            const extension = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
            const languageMap = {
                json: 'json',
                md: 'markdown',
                markdown: 'markdown',
                js: 'javascript',
                jsx: 'javascript',
                ts: 'typescript',
                tsx: 'typescript',
                vue: 'vue',
                html: 'html',
                css: 'css',
                scss: 'scss',
                py: 'python',
                java: 'java',
                yaml: 'yaml',
                yml: 'yaml',
                txt: 'plaintext'
            };
            return languageMap[extension] || 'plaintext';
        }
    },
    watch: {
        skillFile: {
            handler(newVal) {
                this.markdownPreview = false;

                if (newVal) {
                    this.skillName = newVal.skill_name;
                    this.skillContent = newVal.content;
                    this.fileName = newVal.file_path.split('/').pop();
                } else {
                    this.skillName = '';
                    this.fileName = '';
                    this.skillContent = '';
                }
            },
            deep: true
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    mounted() {
        if (this.skillFile) {
            this.skillName = this.skillFile.skill_name;
            this.skillContent = this.skillFile.content;
            this.fileName = this.skillFile.file_path.split('/').pop();
        }
    },
    methods: {
        saveSkillFile() {
            this.isLoading = true;
            this.backend
                .putSkillFile(this.skillName, this.fileName, this.skillContent)
                .then(() => {
                    this.$try({
                        context: this,
                        action: () => {
                            this.$emit('file-saved');
                        },
                        successMsg: '스킬 파일이 성공적으로 저장되었습니다.'
                    });
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        async deleteSkillFile() {
            this.deleteDialog = false;
            this.isLoading = true;
            try {
                await this.backend.deleteSkillFile(this.skillName, this.fileName);
                this.$try({
                    context: this,
                    action: () => {
                        this.$emit('file-deleted');
                    },
                    successMsg: '스킬 파일이 성공적으로 삭제되었습니다.'
                });
            } finally {
                this.isLoading = false;
            }
        },
        handleMount(editor) {
            // Monaco Editor 마운트 후 높이 설정
            if (editor) {
                editor.layout({ height: 320, width: editor.getLayoutInfo().width });
            }
        },
        toggleMarkdownPreview() {
            this.markdownPreview = !this.markdownPreview;
        }
    }
}
</script>

<style scoped>
.markdown-preview {
    height: 100%;
    min-height: 320px;
    overflow-y: auto;
    padding: 16px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 4px;
    background: rgb(var(--v-theme-surface));
}
</style>