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
                <!-- 소유자: 기존 direct/PR 토글 -->
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

                <!-- 비소유자 안내 메시지 -->
                <v-alert v-if="!isOwner" type="info" variant="tonal" density="compact" class="mb-3">
                    {{
                        showFeatureBranchModeSelector
                            ? $t('SkillSaveDialog.notOwnerFeatureBranchNotice')
                            : $t('SkillSaveDialog.notOwnerNotice')
                    }}
                </v-alert>

                <!-- 비소유자 + feature 브랜치: 저장 방식 선택 -->
                <v-radio-group
                    v-if="showFeatureBranchModeSelector"
                    v-model="featureBranchSaveMode"
                    class="mb-3"
                    hide-details
                    density="compact"
                >
                    <v-radio value="direct-to-branch" :label="$t('SkillSaveDialog.featureBranchModeDirect')" />
                    <v-radio value="new-branch" :label="$t('SkillSaveDialog.featureBranchModeNew')" />
                </v-radio-group>

                <!-- 소유자 모드 설명 텍스트 -->
                <p v-if="isOwner && (mode !== 'pr' || openPRs.length === 0)" class="text-body-2 text-medium-emphasis mb-3">
                    {{ mode === 'direct' ? $t('SkillSaveDialog.modeDirectDesc') : $t('SkillSaveDialog.modePRDesc') }}
                </p>

                <!-- PR 모드 필드: 소유자 또는 default 브랜치의 비소유자 -->
                <template v-if="mode === 'pr' && !showFeatureBranchModeSelector">
                    <!-- 변경 요청된 PR이 있으면 선택 UI 표시 -->
                    <template v-if="openPRs.length > 0">
                        <v-radio-group v-model="prCommitMode" class="mb-3" hide-details density="compact">
                            <v-radio value="existing" :label="$t('SkillSaveDialog.addToExistingPR')" />
                            <v-radio value="new" :label="$t('SkillSaveDialog.createNewPR')" />
                        </v-radio-group>

                        <v-select
                            v-if="prCommitMode === 'existing'"
                            v-model="selectedExistingPR"
                            :items="openPRs"
                            item-title="title"
                            item-value="id"
                            :label="$t('SkillSaveDialog.selectExistingPR')"
                            return-object
                            hide-details="auto"
                            density="compact"
                            class="mb-3"
                        >
                            <template #item="{ props, item }">
                                <v-list-item v-bind="props">
                                    <template #subtitle>
                                        <span class="text-caption text-medium-emphasis">{{ item.raw.branch_name }}</span>
                                    </template>
                                </v-list-item>
                            </template>
                        </v-select>

                        <!-- 선택된 PR의 변경 요청 코멘트 표시 -->
                        <v-alert
                            v-if="prCommitMode === 'existing' && selectedExistingPR && latestReviewComment"
                            type="warning"
                            variant="tonal"
                            density="compact"
                            class="mb-3"
                            icon="mdi-alert-circle-outline"
                        >
                            <div class="text-caption font-weight-medium mb-0-5">검토 의견</div>
                            <div class="text-caption">{{ latestReviewComment }}</div>
                        </v-alert>

                        <v-text-field
                            v-if="prCommitMode === 'new'"
                            v-model="prBranchName"
                            :label="$t('SkillSaveDialog.branchNameLabel')"
                            hide-details="auto"
                            density="compact"
                            class="mb-3"
                        />
                    </template>

                    <!-- 변경 요청된 PR 없으면 브랜치 이름 입력 -->
                    <v-text-field
                        v-else
                        v-model="prBranchName"
                        :label="$t('SkillSaveDialog.branchNameLabel')"
                        hide-details="auto"
                        density="compact"
                        class="mb-3"
                    />
                </template>

                <!-- 비소유자 + feature 브랜치 + 새 브랜치 모드: 브랜치 이름 입력 -->
                <v-text-field
                    v-if="showFeatureBranchModeSelector && featureBranchSaveMode === 'new-branch'"
                    v-model="prBranchName"
                    :label="$t('SkillSaveDialog.branchNameLabel')"
                    hide-details="auto"
                    density="compact"
                    class="mb-3"
                />

                <v-text-field
                    v-model="commitMessage"
                    :label="$t('SkillSaveDialog.commitMessageLabel')"
                    :placeholder="$t('SkillSaveDialog.commitMessagePlaceholder')"
                    hide-details="auto"
                    density="compact"
                    class="mb-3"
                    autofocus
                    @keyup.enter="
                        (mode === 'direct' || (showFeatureBranchModeSelector && featureBranchSaveMode === 'direct-to-branch')) &&
                            isFormValid &&
                            submit()
                    "
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

                <!-- PR 제목/설명: 새 PR 생성 시 -->
                <template v-if="showPrTitleFields">
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

            <!-- PR / commit success -->
            <v-card-text v-else-if="step === 'success'" class="pa-4 pt-2 text-center">
                <v-icon size="48" color="success" class="mb-3">mdi-check-circle</v-icon>
                <p class="text-body-1 mb-1">{{ successMessage }}</p>
                <p class="text-body-2 text-medium-emphasis mb-4">{{ successHint }}</p>
                <a v-if="prResultUrl" :href="prResultUrl" target="_blank" class="text-caption text-primary"> PR 보기 → </a>
            </v-card-text>

            <v-card-actions class="d-flex justify-end align-center pa-4 pt-0">
                <v-btn v-if="step !== 'checking'" variant="text" @click="close">
                    {{ step === 'success' ? $t('common.close') : $t('common.cancel') }}
                </v-btn>
                <v-btn v-if="step === 'no-repo'" color="primary" rounded variant="flat" :loading="loading" @click="createRepo">
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
                    {{ submitLabel }}
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
        },
        currentBranch: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'saved'],
    data() {
        return {
            backend: null,
            step: 'checking', // 'checking' | 'no-repo' | 'form' | 'success'
            mode: 'pr', // 'pr' | 'direct'
            prCommitMode: 'new', // 'new' | 'existing'
            featureBranchSaveMode: 'direct-to-branch', // 'direct-to-branch' | 'new-branch'
            openPRs: [],
            selectedExistingPR: null,
            commitMessage: '',
            prBranchName: '',
            prTitle: '',
            prDescription: '',
            prResultUrl: '',
            successMessage: '',
            successHint: '',
            errorMsg: '',
            loading: false,
            defaultBranch: 'main',
            isOwner: true,
            repoUrl: null,
            originalContent: '',
            generatingCommitMsg: false,
            selectedPrReviews: []
        };
    },
    computed: {
        isOnFeatureBranch() {
            return !!(this.currentBranch && this.currentBranch !== this.defaultBranch);
        },
        showFeatureBranchModeSelector() {
            return !this.isOwner && this.isOnFeatureBranch;
        },
        showPrTitleFields() {
            if (this.showFeatureBranchModeSelector) {
                return this.featureBranchSaveMode === 'new-branch';
            }
            return this.mode === 'pr' && this.prCommitMode === 'new';
        },
        latestReviewComment() {
            if (!this.selectedPrReviews.length) return null;
            const last = this.selectedPrReviews[this.selectedPrReviews.length - 1];
            return last?.comment || null;
        },
        isFormValid() {
            if (!this.commitMessage.trim()) return false;
            if (this.showFeatureBranchModeSelector) {
                if (this.featureBranchSaveMode === 'new-branch') {
                    return !!(this.prBranchName.trim() && this.prTitle.trim());
                }
                return true;
            }
            if (this.mode === 'pr') {
                if (this.prCommitMode === 'existing') {
                    return !!this.selectedExistingPR;
                }
                return !!(this.prBranchName.trim() && this.prTitle.trim());
            }
            return true;
        },
        submitLabel() {
            if (this.showFeatureBranchModeSelector) {
                return this.featureBranchSaveMode === 'new-branch' ? this.$t('SkillSaveDialog.createPR') : this.$t('common.save');
            }
            if (this.mode === 'direct') return this.$t('common.save');
            if (this.prCommitMode === 'existing') return this.$t('SkillSaveDialog.addCommitAndReview');
            return this.$t('SkillSaveDialog.createPR');
        },
        titleText() {
            const map = {
                checking: this.$t('SkillSaveDialog.titleChecking'),
                'no-repo': this.$t('SkillSaveDialog.titleNoRepo'),
                form: this.$t('SkillSaveDialog.title'),
                success:
                    this.prCommitMode === 'existing'
                        ? this.$t('SkillSaveDialog.addCommitSuccessTitle')
                        : this.$t('SkillSaveDialog.prSuccessTitle')
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
            if (this.mode === 'pr' && this.prCommitMode === 'new' && !this.prTitle) this.prTitle = val;
        },
        featureBranchSaveMode(val) {
            if (val === 'new-branch') {
                if (!this.prBranchName) this.prBranchName = this.buildDefaultBranchName();
                if (!this.prTitle && this.commitMessage.trim()) this.prTitle = this.commitMessage.trim();
            }
        },
        prCommitMode(val) {
            if (val === 'new' && !this.prBranchName) this.prBranchName = this.buildDefaultBranchName();
            if (val === 'existing' && !this.selectedExistingPR && this.openPRs.length > 0) {
                this.selectedExistingPR = this.openPRs[0];
            }
        },
        selectedExistingPR(pr) {
            this.selectedPrReviews = [];
            if (pr?.id) {
                this.backend
                    .getResourcePrReviews(pr.id)
                    .then((reviews) => {
                        this.selectedPrReviews = reviews || [];
                    })
                    .catch(() => {});
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    methods: {
        async init() {
            this.step = 'checking';
            this.mode = 'pr';
            this.prCommitMode = 'new';
            this.featureBranchSaveMode = 'direct-to-branch';
            this.openPRs = [];
            this.selectedExistingPR = null;
            this.commitMessage = '';
            this.prBranchName = '';
            this.prTitle = '';
            this.prDescription = '';
            this.prResultUrl = '';
            this.successMessage = '';
            this.successHint = '';
            this.errorMsg = '';
            this.loading = false;
            this.isOwner = true;
            this.originalContent = '';
            this.generatingCommitMsg = false;
            this.selectedPrReviews = [];

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
                    if (!this.isOwner && this.currentBranch && this.currentBranch !== this.defaultBranch) {
                        this.featureBranchSaveMode = 'direct-to-branch';
                    }

                    // 멀티 git 설정 환경에서 PR 필터링용 URL prefix 결정
                    try {
                        const configs = await this.backend.getGitConfigs();
                        if (configs && configs.length > 1) {
                            const def = configs.find((c) => c.is_default) || null;
                            if (def) {
                                const base = (def.base_url || 'https://github.com').replace(/\/$/, '');
                                this.repoUrl = `${base}/${def.username}/`;
                            }
                        }
                    } catch (_) {}

                    // MERGED/CLOSED 제외한 열린 PR 전체 조회
                    try {
                        const allPRs = await this.backend.getResourcePrRecords(
                            'skill',
                            this.skillName,
                            undefined,
                            this.repoUrl || undefined
                        );
                        this.openPRs = allPRs.filter((pr) => pr.status !== 'MERGED' && pr.status !== 'CLOSED');
                        if (this.openPRs.length > 0 && !this.showFeatureBranchModeSelector) {
                            const matchingPR = this.currentBranch ? this.openPRs.find((pr) => pr.branch_name === this.currentBranch) : null;
                            this.prCommitMode = 'existing';
                            this.selectedExistingPR = matchingPR || this.openPRs[0];
                            this.backend
                                .getResourcePrReviews(this.selectedExistingPR.id)
                                .then((reviews) => {
                                    this.selectedPrReviews = reviews || [];
                                })
                                .catch(() => {});
                        } else if (this.currentBranch && this.currentBranch !== this.defaultBranch && this.isOwner) {
                            // 소유자가 feature 브랜치에서 편집 중이면 해당 브랜치명을 pre-fill
                            this.prBranchName = this.currentBranch;
                        }
                    } catch (_) {
                        this.openPRs = [];
                    }

                    this.step = 'form';

                    const branchForContent =
                        this.currentBranch && this.currentBranch !== this.defaultBranch ? this.currentBranch : this.defaultBranch;
                    this.backend
                        .getSkillBranchFile(this.skillName, branchForContent, this.filePath)
                        .then((result) => {
                            this.originalContent = result?.content ?? result ?? '';
                        })
                        .catch(() => {
                            this.originalContent = '';
                        });
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
                await this.backend.createSkillRepo(this.skillName, {
                    initialContent: this.content,
                    filePath: this.filePath
                });
                this.$emit('saved', { mode: 'direct' });
                this.close();
            } catch (err) {
                this.errorMsg = (err && err.response && err.response.data && err.response.data.error) || err?.message || String(err);
            } finally {
                this.loading = false;
            }
        },
        async submit() {
            if (!this.isFormValid) return;
            this.loading = true;
            this.errorMsg = '';
            try {
                if (this.showFeatureBranchModeSelector && this.featureBranchSaveMode === 'direct-to-branch') {
                    await this.submitDirectToBranch(this.currentBranch);
                } else if (this.mode === 'direct') {
                    await this.submitDirect();
                } else if (this.prCommitMode === 'existing') {
                    await this.submitAddCommit();
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
                        if (this.mode === 'pr' && this.prCommitMode === 'new' && !this.prTitle) this.prTitle = this.commitMessage;
                        this.generatingCommitMsg = false;
                    },
                    onError: () => {
                        this.generatingCommitMsg = false;
                    }
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
            await this.backend.putSkillFile(this.skillName, this.filePath, this.content, this.commitMessage, this.defaultBranch);
            await this.backend.syncSkill(this.skillName).catch(() => {});
            this.$emit('saved', { mode: 'direct' });
            this.close();
        },
        async submitDirectToBranch(branch) {
            await this.backend.putSkillFile(this.skillName, this.filePath, this.content, this.commitMessage, branch);
            await this.backend.syncSkill(this.skillName).catch(() => {});
            this.$emit('saved', { mode: 'direct' });
            this.close();
        },
        async submitAddCommit() {
            const pr = this.selectedExistingPR;
            await this.backend.addCommitToSkillPrBranch(this.skillName, pr.branch_name, this.filePath, this.content, this.commitMessage);
            // PR 상태를 OPEN(재검토 요청)으로 복귀
            await this.backend.updateResourcePrStatus(pr, 'OPEN');

            this.prResultUrl = pr.git_pr_url || '';
            this.successMessage = this.$t('SkillSaveDialog.addCommitSuccessMessage');
            this.successHint = this.$t('SkillSaveDialog.addCommitSuccessHint');
            this.step = 'success';
            this.$emit('saved', { mode: 'pr', prUrl: this.prResultUrl });
        },
        async submitPR() {
            // currentBranch와 동일한 브랜치명이면 이미 존재하는 브랜치이므로 생성 생략
            if (this.prBranchName !== this.currentBranch) {
                await this.backend.createSkillBranch(this.skillName, this.prBranchName, this.defaultBranch);
            }
            await this.backend.putSkillFile(this.skillName, this.filePath, this.content, this.commitMessage, this.prBranchName);
            const pr = await this.backend.createSkillPullRequest(
                this.skillName,
                this.prTitle,
                this.prDescription,
                this.prBranchName,
                this.defaultBranch
            );
            this.prResultUrl = pr?.html_url || '';

            // DB에 PR 워크플로우 레코드 저장
            try {
                const userInfo = await this.backend.getUserInfo();
                const requesterId = userInfo?.uid || userInfo?.id || null;
                const requesterName = localStorage.getItem('userName') || userInfo?.username || userInfo?.name || undefined;
                if (requesterId) {
                    const gitRepoUrl = pr?.html_url ? pr.html_url.replace(/\/pull\/\d+.*$/, '') : undefined;
                    await this.backend.createResourcePrRecord('skill', {
                        resourceId: this.skillName,
                        branchName: this.prBranchName,
                        baseBranch: this.defaultBranch,
                        title: this.prTitle,
                        description: this.prDescription || undefined,
                        requesterId,
                        requesterName,
                        gitPrNumber: pr?.number ?? undefined,
                        gitPrUrl: pr?.html_url ?? undefined,
                        gitRepoUrl
                    });
                }
            } catch (_) {
                // DB 저장 실패해도 GitHub PR 생성은 성공으로 처리
            }

            this.successMessage = this.$t('SkillSaveDialog.prSuccessMessage');
            this.successHint = this.$t('SkillSaveDialog.prSuccessHint');
            this.step = 'success';
            this.$emit('saved', { mode: 'pr', prUrl: this.prResultUrl });
        }
    }
};
</script>

<style scoped>
.mb-0-5 {
    margin-bottom: 2px;
}
</style>
