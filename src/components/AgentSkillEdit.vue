<template>
    <v-card flat v-if="skillFile">
        <v-card-title class="d-flex align-center">
            <span class="text-h6">{{ skillName }}: {{ fileName }}</span>
            <v-spacer></v-spacer>
            <v-btn @click="saveSkillFile" variant="text" icon color="primary" :loading="isLoading">
                <v-icon>mdi-content-save</v-icon>
            </v-btn>
            <v-btn v-if="isDeleteable" @click="deleteDialog = true" variant="text" icon color="error">
                <v-icon>mdi-delete</v-icon>
            </v-btn>
        </v-card-title>
        <v-card-text class="h-100">
            <!-- <v-textarea 
                v-model="skillContent"
                rows="19"
            ></v-textarea> -->
            <vue-monaco-editor
                v-model:value="skillContent"
                :language="editorLanguage"
                :options="MONACO_EDITOR_OPTIONS"
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
                    {{ $t('Common.cancel') }}
                </v-btn>
                <v-btn @click="deleteSkillFile" variant="flat" color="primary" rounded>
                    {{ $t('Common.delete') }}
                </v-btn>
            </v-card-actions>

        </v-card>
    </v-dialog>
</template>

<script>
export default {
    name: 'AgentSkillEdit',
    props: {
        skillFile: {
            type: Object,
            default: () => ({})
        },
        isLoading: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            skillName: '',
            fileName: '',
            skillContent: '',
            MONACO_EDITOR_OPTIONS: {
                automaticLayout: true,
                formatOnType: true,
                formatOnPaste: true
            },
            deleteDialog: false
        }
    },
    computed: {
        isDeleteable() {
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
                if (newVal) {
                    this.skillName = newVal.skill_name;
                    this.fileName = newVal.file_path;
                    this.skillContent = newVal.content;
                } else {
                    this.skillName = '';
                    this.fileName = '';
                    this.skillContent = '';
                }
            },
            deep: true
        }
    },
    mounted() {
        if (this.skillFile) {
            this.skillName = this.skillFile.skill_name;
            this.fileName = this.skillFile.file_path;
            this.skillContent = this.skillFile.content;
        }
    },
    methods: {
        saveSkillFile() {
            this.$emit('saveSkillFile', this.skillName, this.fileName, this.skillContent);
        },
        deleteSkillFile() {
            this.$emit('deleteSkillFile', this.skillName, this.fileName);
            this.deleteDialog = false;
        },
        handleMount(editor) {
            // Monaco Editor 마운트 후 높이 설정
            if (editor) {
                editor.layout({ height: 200, width: editor.getLayoutInfo().width });
            }
        }
    }
}
</script>