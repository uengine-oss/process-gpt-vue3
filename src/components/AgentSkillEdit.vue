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
            <v-alert
                v-if="directiveRemoved"
                type="warning"
                density="compact"
                variant="tonal"
                class="mx-2 mb-1 text-caption"
                icon="mdi-alert-circle-outline"
            >
                extends 또는 상속 지시문을 삭제하면 에이전트가 스킬 로드에 실패할 수 있습니다
            </v-alert>
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
        :current-branch="selectedBranch"
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

                <!-- feature 브랜치에서 삭제 시 커밋 방식 선택 -->
                <v-radio-group
                    v-if="isOnFeatureBranch"
                    v-model="deleteBranchMode"
                    class="mb-3"
                    hide-details
                    density="compact"
                >
                    <v-radio value="current" :label="$t('AgentSkillEdit.deleteBranchModeCurrent')" />
                    <v-radio value="new-branch" :label="$t('AgentSkillEdit.deleteBranchModeNew')" />
                </v-radio-group>

                <!-- 새 브랜치 모드: 브랜치명 + PR 제목 입력 -->
                <template v-if="isOnFeatureBranch && deleteBranchMode === 'new-branch'">
                    <v-text-field
                        v-model="deletePrBranchName"
                        :label="$t('AgentSkillEdit.deletePrBranchLabel')"
                        hide-details="auto"
                        density="compact"
                        class="mb-3"
                    />
                    <v-text-field
                        v-model="deletePrTitle"
                        :label="$t('AgentSkillEdit.deletePrTitleLabel')"
                        hide-details="auto"
                        density="compact"
                        class="mb-3"
                    />
                </template>

                <v-text-field
                    v-model="deleteCommitMessage"
                    :label="$t('AgentSkillEdit.commitMessageLabel')"
                    :placeholder="$t('AgentSkillEdit.deleteCommitMessagePlaceholder')"
                    hide-details="auto"
                    autofocus
                    @keyup.enter="isDeleteFormValid && confirmDelete()"
                >
                    <template #append-inner>
                        <v-tooltip :text="$t('SkillSaveDialog.generateCommitMsg')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    :loading="generatingDeleteCommitMsg"
                                    :disabled="generatingDeleteCommitMsg"
                                    icon
                                    variant="text"
                                    size="x-small"
                                    color="primary"
                                    @click.stop="generateDeleteCommitMessage"
                                >
                                    <v-icon size="16">mdi-auto-fix</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </template>
                </v-text-field>
            </v-card-text>
            <v-card-actions class="d-flex justify-end align-center pa-4">
                <v-btn variant="text" @click="deleteDialog = false">
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn color="error" rounded variant="flat" :disabled="!isDeleteFormValid" @click="confirmDelete">
                    {{ deleteBranchMode === 'new-branch' ? $t('SkillSaveDialog.createPR') : $t('common.delete') }}
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
import CommitMessageGenerator from '@/components/ai/CommitMessageGenerator';
import { hasInheritanceDirective } from '@/utils/skillMdParser';

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
        },
        selectedBranch: {
            type: String,
            default: ''
        },
        defaultBranch: {
            type: String,
            default: 'main'
        },
        isOwner: {
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

            saveDialog: false,

            deleteDialog: false,
            deleteCommitMessage: '',
            deleteBranchMode: 'current',   // 'current' | 'new-branch'
            deletePrBranchName: '',
            deletePrTitle: '',
            generatingDeleteCommitMsg: false,

            isLoading: false,
            markdownPreview: false,
            wasChildSkill: false
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
        isOnFeatureBranch() {
            return !!(this.selectedBranch && this.selectedBranch !== this.defaultBranch);
        },
        isDeleteFormValid() {
            if (!this.deleteCommitMessage.trim()) return false;
            if (this.isOnFeatureBranch && this.deleteBranchMode === 'new-branch') {
                return !!(this.deletePrBranchName.trim() && this.deletePrTitle.trim());
            }
            return true;
        },
        directiveRemoved() {
            return this.wasChildSkill && this.fileName === 'SKILL.md' && !hasInheritanceDirective(this.skillContent);
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
                    this.wasChildSkill = this.fileName === 'SKILL.md' && hasInheritanceDirective(newVal.content);
                } else {
                    this.skillName = '';
                    this.fileName = '';
                    this.filePath = '';
                    this.skillContent = '';
                    this.wasChildSkill = false;
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
        }
    },
    methods: {
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
        generateDeleteCommitMessage() {
            if (this.generatingDeleteCommitMsg) return;
            this.generatingDeleteCommitMsg = true;
            const language = window.countryCode === 'ko' ? 'Korean' : 'English';
            const generator = new CommitMessageGenerator(
                {
                    onGenerationFinished: (result) => {
                        this.deleteCommitMessage = (result || '').trim();
                        this.generatingDeleteCommitMsg = false;
                    },
                    onError: () => { this.generatingDeleteCommitMsg = false; }
                },
                {
                    originalContent: this.skillContent,
                    currentContent: '',
                    fileName: this.fileName,
                    language
                }
            );
            generator.generate();
        },
        openDeleteDialog() {
            if (this.selectedBranch === this.defaultBranch && !this.isOwner) {
                this.$try({
                    context: this,
                    action: () => {},
                    warningMsg: '기본 브랜치에 직접 커밋할 수 없습니다. 스킬 소유자만 기본 브랜치에 삭제할 수 있습니다.'
                });
                return;
            }
            this.deleteCommitMessage = `Delete ${this.fileName}`;
            this.deleteBranchMode = 'current';
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const base = (this.fileName || 'file').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
            this.deletePrBranchName = `feature/delete-${base}-${date}`;
            this.deletePrTitle = `Delete ${this.fileName}`;
            this.deleteDialog = true;
        },
        confirmDelete() {
            if (!this.isDeleteFormValid) return;
            this.deleteDialog = false;
            this.deleteSkillFile();
        },
        async deleteSkillFile() {
            this.isLoading = true;
            try {
                if (this.isOnFeatureBranch && this.deleteBranchMode === 'new-branch') {
                    await this.backend.createSkillBranch(this.skillName, this.deletePrBranchName, this.defaultBranch);
                    await this.backend.deleteSkillFile(
                        this.skillName, this.fileName,
                        this.deleteCommitMessage, this.deletePrBranchName
                    );
                    const pr = await this.backend.createSkillPullRequest(
                        this.skillName, this.deletePrTitle, '',
                        this.deletePrBranchName, this.defaultBranch
                    );
                    try {
                        const userInfo = await this.backend.getUserInfo();
                        const requesterId = userInfo?.uid || userInfo?.id || null;
                        if (requesterId) {
                            await this.backend.createResourcePrRecord('skill', {
                                resourceId: this.skillName,
                                branchName: this.deletePrBranchName,
                                baseBranch: this.defaultBranch,
                                title: this.deletePrTitle,
                                requesterId,
                                gitPrNumber: pr?.number ?? undefined,
                                gitPrUrl: pr?.html_url ?? undefined
                            });
                        }
                    } catch (_) {}
                    this.$try({
                        context: this,
                        action: () => { this.$emit('file-deleted'); },
                        successMsg: 'PR이 성공적으로 생성되었습니다.'
                    });
                } else {
                    await this.backend.deleteSkillFile(
                        this.skillName, this.fileName,
                        this.deleteCommitMessage, this.selectedBranch || this.defaultBranch
                    );
                    this.$try({
                        context: this,
                        action: () => { this.$emit('file-deleted'); },
                        successMsg: '스킬 파일이 성공적으로 삭제되었습니다.'
                    });
                }
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
