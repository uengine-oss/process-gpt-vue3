<template>
    <v-card flat v-if="skillFile">
        <v-card-title class="d-flex align-center justify-space-between pa-0">
            <div class="d-flex align-center text-h6">
                <v-text-field
                    v-if="!readOnly && isEditable"
                    v-model="fileName"
                    class="ml-2 my-2"
                    hide-details
                    style="min-width: 300px; flex: 1"
                    density="compact"
                ></v-text-field>
                <span v-else class="ml-3">{{ fileName }}</span>
            </div>
            <div class="d-flex align-center gap-2 mr-2">
                <v-btn v-if="isEditable" @click="openDeleteDialog" variant="text" icon color="error" size="small">
                    <v-icon>mdi-delete</v-icon>
                </v-btn>
                <v-btn v-if="isMarkdown" @click="toggleMarkdownPreview" variant="text" icon size="small">
                    <v-icon>{{ markdownPreview ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                </v-btn>
                <v-btn v-if="!readOnly" @click="saveDialog = true" variant="text" icon color="primary" :loading="isLoading" size="small">
                    <v-icon>mdi-content-save</v-icon>
                </v-btn>
                <v-btn v-if="!readOnly && isEditable" @click="openDeleteDialog" variant="text" icon color="error" size="small">
                    <v-icon>mdi-delete</v-icon>
                </v-btn>
            </div>
        </v-card-title>
        <v-card-text class="h-100 px-0">
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

    <SkillSaveDialog
        v-model="saveDialog"
        :skill-name="skillName"
        :file-path="filePath"
        :content="skillContent"
        :file-name="fileName"
        @saved="onSaved"
    />

    <!-- delete dialog -->
    <v-dialog v-model="deleteDialog" max-width="500px" persistent>
        <v-card>
            <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                {{ $t('AgentSkillEdit.deleteDialogTitle') }}
                <v-btn variant="text" density="compact" icon @click="deleteDialog = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text class="pa-4 pb-0">
                <p class="mb-3">{{ $t('AgentSkillEdit.deleteDialogMessage') }}</p>
                <v-text-field
                    v-model="deleteCommitMessage"
                    :label="$t('AgentSkillEdit.commitMessageLabel')"
                    :placeholder="$t('AgentSkillEdit.deleteCommitMessagePlaceholder')"
                    hide-details="auto"
                    autofocus
                    @keyup.enter="deleteCommitMessage.trim() && confirmDelete()"
                ></v-text-field>
            </v-card-text>
            <v-card-actions class="d-flex justify-end align-center pa-4">
                <v-btn variant="text" @click="deleteDialog = false">
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn color="error" rounded variant="flat" :disabled="!deleteCommitMessage.trim()" @click="confirmDelete">
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
import SkillSaveDialog from '@/components/SkillSaveDialog.vue';

marked.setOptions({
    breaks: true,
    gfm: true,
    highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try { return hljs.highlight(code, { language: lang }).value; } catch (_) {}
        }
        try { return hljs.highlightAuto(code).value; } catch (_) {}
        return code;
    }
});

export default {
    name: 'AgentSkillEdit',
    components: { SkillSaveDialog },
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
            filePath: '',
            skillContent: '',
            currentBranch: 'main',

            saveDialog: false,

            deleteDialog: false,
            deleteCommitMessage: '',

            isLoading: false,
            markdownPreview: false
        };
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
            const ext = (this.fileName || '').split('.').pop().toLowerCase();
            const map = {
                json: 'json', md: 'markdown', markdown: 'markdown',
                js: 'javascript', jsx: 'javascript',
                ts: 'typescript', tsx: 'typescript',
                vue: 'vue', html: 'html', css: 'css', scss: 'scss',
                py: 'python', java: 'java', yaml: 'yaml', yml: 'yaml', txt: 'plaintext'
            };
            return map[ext] || 'plaintext';
        }
    },
    watch: {
        skillFile: {
            handler(newVal) {
                this.markdownPreview = false;
                if (newVal) {
                    this.skillName = newVal.skill_name;
                    this.skillContent = newVal.content;
                    this.filePath = newVal.file_path;
                    this.fileName = newVal.file_path.split('/').pop();
                    this.fetchCurrentBranch();
                } else {
                    this.skillName = '';
                    this.fileName = '';
                    this.filePath = '';
                    this.skillContent = '';
                    this.currentBranch = 'main';
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
            this.filePath = this.skillFile.file_path;
            this.fileName = this.skillFile.file_path.split('/').pop();
            this.fetchCurrentBranch();
        }
    },
    methods: {
        async fetchCurrentBranch() {
            if (!this.skillName) return;
            try {
                const result = await this.backend.getSkillBranches(this.skillName);
                if (result.branches.length > 0) {
                    this.currentBranch = result.default_branch || result.branches[0].name;
                }
            } catch (_) {
                // keep default
            }
        },
        onSaved({ mode }) {
            const msg = mode === 'direct'
                ? '스킬 파일이 성공적으로 저장되었습니다.'
                : 'PR이 성공적으로 생성되었습니다.';
            this.$try({
                context: this,
                action: () => { this.$emit('file-saved'); },
                successMsg: msg
            });
        },
        openDeleteDialog() {
            this.deleteCommitMessage = '';
            this.deleteDialog = true;
        },
        confirmDelete() {
            if (!this.deleteCommitMessage.trim()) return;
            this.deleteDialog = false;
            this.deleteSkillFile();
        },
        async deleteSkillFile() {
            this.isLoading = true;
            try {
                await this.backend.deleteSkillFile(
                    this.skillName, this.fileName,
                    this.deleteCommitMessage, this.currentBranch
                );
                this.$try({
                    context: this,
                    action: () => { this.$emit('file-deleted'); },
                    successMsg: '스킬 파일이 성공적으로 삭제되었습니다.'
                });
            } finally {
                this.isLoading = false;
            }
        },
        handleMount(editor) {
            if (editor) {
                editor.layout({ height: 320, width: editor.getLayoutInfo().width });
            }
        },
        toggleMarkdownPreview() {
            this.markdownPreview = !this.markdownPreview;
        }
    }
};
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
