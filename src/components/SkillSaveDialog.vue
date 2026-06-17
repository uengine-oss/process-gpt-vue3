<template>
    <v-dialog :model-value="modelValue" max-width="560px" persistent @update:model-value="$emit('update:modelValue', $event)">
        <v-card>
            <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-2">
                <span>{{ titleText }}</span>
                <v-btn variant="text" density="compact" icon @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <!-- checking repo -->
            <v-card-text v-if="step === 'checking'" class="pa-6 d-flex justify-center align-center">
                <v-progress-circular indeterminate color="primary" />
            </v-card-text>

            <!-- no repo -->
            <v-card-text v-else-if="step === 'no-repo'" class="pa-4 pt-2">
                <v-alert type="warning" variant="tonal" class="mb-4">
                    <div class="text-body-2">{{ $t('SkillSaveDialog.noRepoMessage') }}</div>
                </v-alert>
                <p class="text-body-2 text-medium-emphasis">{{ $t('SkillSaveDialog.noRepoHint') }}</p>
                <v-alert v-if="errorMsg" type="error" density="compact" class="mt-3" closable @click:close="errorMsg = ''">
                    {{ errorMsg }}
                </v-alert>
            </v-card-text>

            <!-- save form -->
            <v-card-text v-else-if="step === 'form'" class="pa-4 pt-2">
                <v-btn-toggle v-if="isOwner" v-model="mode" mandatory color="primary" rounded="lg" class="mb-4 w-100" density="compact">
                    <v-btn value="pr" class="flex-1 text-none">
                        <v-icon start size="18">mdi-source-pull</v-icon>
                        {{ $t('SkillSaveDialog.modePR') }}
                    </v-btn>
                    <v-btn value="direct" class="flex-1 text-none">
                        <v-icon start size="18">mdi-source-commit</v-icon>
                        {{ $t('SkillSaveDialog.modeDirect') }}
                    </v-btn>
                </v-btn-toggle>

                <v-alert v-if="!isOwner" type="info" variant="tonal" density="compact" class="mb-4">
                    {{ $t('SkillSaveDialog.notOwnerNotice') }}
                </v-alert>

                <p class="text-body-2 text-medium-emphasis mb-4">
                    {{ mode === 'direct' ? $t('SkillSaveDialog.modeDirectDesc') : $t('SkillSaveDialog.modePRDesc') }}
                </p>

                <v-text-field
                    v-if="mode === 'pr'"
                    v-model="prBranchName"
                    :label="$t('SkillSaveDialog.branchNameLabel')"
                    hide-details="auto"
                    density="compact"
                    class="mb-3"
                ></v-text-field>

                <v-text-field
                    v-model="commitMessage"
                    :label="$t('SkillSaveDialog.commitMessageLabel')"
                    :placeholder="$t('SkillSaveDialog.commitMessagePlaceholder')"
                    hide-details="auto"
                    density="compact"
                    class="mb-3"
                    autofocus
                    @keyup.enter="mode === 'direct' && isFormValid && submit()"
                >
                    <template #append-inner>
                        <v-tooltip :text="$t('SkillSaveDialog.generateCommitMsg')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    :loading="generatingCommitMsg"
                                    :disabled="generatingCommitMsg"
                                    icon
                                    variant="text"
                                    size="x-small"
                                    color="primary"
                                    @click.stop="generateCommitMessage"
                                >
                                    <v-icon size="16">mdi-auto-fix</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </template>
                </v-text-field>

                <template v-if="mode === 'pr'">
                    <v-text-field
                        v-model="prTitle"
                        :label="$t('SkillSaveDialog.prTitleLabel')"
                        hide-details="auto"
                        density="compact"
                        class="mb-3"
                    ></v-text-field>
                    <v-textarea
                        v-model="prDescription"
                        :label="$t('SkillSaveDialog.prDescriptionLabel')"
                        hide-details="auto"
                        density="compact"
                        rows="3"
                        auto-grow
                    ></v-textarea>
                </template>

                <v-alert v-if="errorMsg" type="error" density="compact" class="mt-3" closable @click:close="errorMsg = ''">
                    {{ errorMsg }}
                </v-alert>
            </v-card-text>

            <!-- PR success -->
            <v-card-text v-else-if="step === 'success'" class="pa-4 pt-2 text-center">
                <v-icon size="48" color="success" class="mb-3">mdi-check-circle</v-icon>
                <p class="text-body-1 mb-1">{{ $t('SkillSaveDialog.prSuccessMessage') }}</p>
                <p class="text-body-2 text-medium-emphasis mb-4">{{ $t('SkillSaveDialog.prSuccessHint') }}</p>
            </v-card-text>

            <v-card-actions class="d-flex justify-end align-center pa-4 pt-0">
                <v-btn v-if="step !== 'checking'" variant="text" @click="close">
                    {{ step === 'success' ? $t('common.close') : $t('common.cancel') }}
                </v-btn>
                <v-btn
                    v-if="step === 'no-repo'"
                    color="primary"
                    rounded
                    variant="flat"
                    :loading="loading"
                    @click="createRepo"
                >
                    {{ $t('SkillSaveDialog.createRepo') }}
                </v-btn>
                <v-btn
                    v-if="step === 'form'"
                    color="primary"
                    rounded
                    variant="flat"
                    :disabled="!isFormValid"
                    :loading="loading"
                    @click="submit"
                >
                    {{ mode === 'direct' ? $t('common.save') : $t('SkillSaveDialog.createPR') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import CommitMessageGenerator from '@/components/ai/CommitMessageGenerator';

export default {
    name: 'SkillSaveDialog',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        skillName: {
            type: String,
            required: true
        },
        filePath: {
            type: String,
            required: true
        },
        content: {
            type: String,
            default: ''
        },
        fileName: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'saved'],
    data() {
        return {
            backend: null,
            step: 'checking',   // 'checking' | 'no-repo' | 'form' | 'success'
            mode: 'pr',         // 'pr' | 'direct'
            commitMessage: '',
            prBranchName: '',
            prTitle: '',
            prDescription: '',
            prResultUrl: '',
            errorMsg: '',
            loading: false,
            defaultBranch: 'main',
            isOwner: true,
            originalContent: '',
            generatingCommitMsg: false
        };
    },
    computed: {
        isFormValid() {
            if (!this.commitMessage.trim()) return false;
            if (this.mode === 'pr') {
                return !!(this.prBranchName.trim() && this.prTitle.trim());
            }
            return true;
        },
        titleText() {
            const map = {
                checking: this.$t('SkillSaveDialog.titleChecking'),
                'no-repo': this.$t('SkillSaveDialog.titleNoRepo'),
                form: this.$t('SkillSaveDialog.title'),
                success: this.$t('SkillSaveDialog.prSuccessTitle')
            };
            return map[this.step] || '';
        }
    },
    watch: {
        modelValue(val) {
            if (val) this.init();
        },
        mode(newMode) {
            if (newMode === 'pr') {
                if (!this.prBranchName) this.prBranchName = this.buildDefaultBranchName();
                if (!this.prTitle && this.commitMessage.trim()) this.prTitle = this.commitMessage.trim();
            }
        },
        commitMessage(val) {
            if (this.mode === 'pr' && !this.prTitle) this.prTitle = val;
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    methods: {
        async init() {
            this.step = 'checking';
            this.mode = 'pr';
            this.commitMessage = '';
            this.prBranchName = '';
            this.prTitle = '';
            this.prDescription = '';
            this.prResultUrl = '';
            this.errorMsg = '';
            this.loading = false;
            this.isOwner = true;
            this.originalContent = '';
            this.generatingCommitMsg = false;

            try {
                const result = await this.backend.getSkillBranches(this.skillName);
                if (result.branches.length > 0) {
                    this.defaultBranch = result.default_branch || 'main';
                    this.prBranchName = this.buildDefaultBranchName();

                    try {
                        const [ownerId, userInfo] = await Promise.all([
                            this.backend.getSkillOwner(this.skillName),
                            this.backend.getUserInfo()
                        ]);
                        const currentUid = userInfo?.uid || null;
                        this.isOwner = !ownerId || !currentUid || ownerId === currentUid;
                    } catch (_) {
                        this.isOwner = true;
                    }
                    if (!this.isOwner) this.mode = 'pr';

                    this.step = 'form';

                    this.backend.getSkillBranchFile(this.skillName, this.defaultBranch, this.filePath)
                        .then(result => { this.originalContent = result?.content ?? result ?? ''; })
                        .catch(() => { this.originalContent = ''; });
                } else {
                    this.step = 'no-repo';
                }
            } catch (_) {
                this.step = 'no-repo';
            }
        },
        buildDefaultBranchName() {
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const base = (this.fileName || 'file')
                .replace(/\.[^.]+$/, '')
                .replace(/[^a-z0-9]/gi, '-')
                .toLowerCase();
            return `feature/edit-${base}-${date}`;
        },
        close() {
            this.$emit('update:modelValue', false);
        },
        async createRepo() {
            this.loading = true;
            this.errorMsg = '';
            try {
                await this.backend.createSkillRepo(this.skillName);
                this.prBranchName = this.buildDefaultBranchName();
                this.step = 'form';
            } catch (err) {
                this.errorMsg = err?.message || String(err);
            } finally {
                this.loading = false;
            }
        },
        async submit() {
            if (!this.isFormValid) return;
            this.loading = true;
            this.errorMsg = '';
            try {
                if (this.mode === 'direct') {
                    await this.submitDirect();
                } else {
                    await this.submitPR();
                }
            } catch (err) {
                this.errorMsg = err?.message || String(err);
            } finally {
                this.loading = false;
            }
        },
        generateCommitMessage() {
            if (this.generatingCommitMsg) return;
            this.generatingCommitMsg = true;
            const language = window.countryCode === 'ko' ? 'Korean' : 'English';
            const generator = new CommitMessageGenerator(
                {
                    onGenerationFinished: (result) => {
                        this.commitMessage = (result || '').trim();
                        if (this.mode === 'pr' && !this.prTitle) this.prTitle = this.commitMessage;
                        this.generatingCommitMsg = false;
                    },
                    onError: () => { this.generatingCommitMsg = false; }
                },
                {
                    originalContent: this.originalContent,
                    currentContent: this.content,
                    fileName: this.fileName,
                    language
                }
            );
            generator.generate();
        },
        async submitDirect() {
            await this.backend.putSkillFile(
                this.skillName, this.filePath, this.content,
                this.commitMessage, this.defaultBranch
            );
            await this.backend.syncSkill(this.skillName).catch(() => {});
            this.$emit('saved', { mode: 'direct' });
            this.close();
        },
        async submitPR() {
            await this.backend.createSkillBranch(this.skillName, this.prBranchName, this.defaultBranch);
            await this.backend.putSkillFile(
                this.skillName, this.filePath, this.content,
                this.commitMessage, this.prBranchName
            );
            const pr = await this.backend.createSkillPullRequest(
                this.skillName, this.prTitle, this.prDescription,
                this.prBranchName, this.defaultBranch
            );
            this.prResultUrl = pr?.html_url || '';
            this.step = 'success';
            this.$emit('saved', { mode: 'pr', prUrl: this.prResultUrl });
        }
    }
};
</script>
