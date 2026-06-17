<template>
    <div class="skill-git-history d-flex flex-column h-100">
        <!-- header -->
        <div class="d-flex align-center px-4 py-3 flex-shrink-0 gap-2">
            <v-icon size="20" color="primary">mdi-source-branch</v-icon>
            <span class="text-subtitle-1 font-weight-medium">Git 변경 이력</span>
            <span v-if="repoName" class="text-caption text-medium-emphasis">— {{ repoName }}</span>
        </div>

        <v-divider />

        <!-- tabs (레포 있을 때만) -->
        <template v-if="hasRepo">
            <v-tabs v-model="activeTab" density="compact" class="flex-shrink-0">
                <v-tab value="commits">커밋 이력</v-tab>
                <v-tab v-if="isOwner" value="prs">
                    PR 목록
                    <v-badge
                        v-if="openPrCount > 0"
                        :content="openPrCount"
                        color="primary"
                        inline
                        class="ml-1"
                    />
                </v-tab>
            </v-tabs>
            <v-divider />
        </template>

        <!-- content -->
        <div class="flex-grow-1 overflow-y-auto">

            <!-- 초기 브랜치 로딩 -->
            <div v-if="branchesLoading" class="d-flex justify-center py-8">
                <v-progress-circular indeterminate color="primary" size="32" />
            </div>

            <!-- 레포 없음 -->
            <div v-else-if="hasRepo === false" class="d-flex flex-column align-center justify-center py-8 px-6 text-center">
                <v-icon size="52" color="grey-lighten-1" class="mb-3">mdi-git</v-icon>
                <div class="text-body-1 font-weight-medium mb-1">Git 레포지토리 없음</div>
                <div class="text-body-2 text-medium-emphasis mb-5">
                    이 스킬에 연결된 Git 레포가 없습니다.<br>
                    레포를 생성하면 변경 이력을 관리할 수 있습니다.
                </div>
                <v-btn
                    color="primary"
                    variant="flat"
                    rounded
                    prepend-icon="mdi-plus"
                    :loading="creatingRepo"
                    @click="createRepo"
                >
                    레포지토리 생성
                </v-btn>
                <v-alert v-if="createRepoError" type="error" density="compact" class="mt-4 w-100" closable @click:close="createRepoError = ''">
                    {{ createRepoError }}
                </v-alert>
            </div>

            <!-- 커밋 탭 -->
            <template v-else-if="activeTab === 'commits'">
                <!-- branch selector -->
                <div class="px-4 pt-3 pb-2">
                    <v-select
                        v-model="selectedBranch"
                        :items="branches"
                        item-title="name"
                        item-value="name"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :loading="branchesLoading"
                        placeholder="브랜치 선택"
                        @update:modelValue="fetchCommits"
                    />
                </div>

                <div v-if="commitsLoading" class="d-flex justify-center py-8">
                    <v-progress-circular indeterminate color="primary" size="32" />
                </div>

                <div v-else-if="commits.length === 0" class="d-flex flex-column align-center justify-center py-8">
                    <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-history</v-icon>
                    <div class="text-body-2 text-medium-emphasis">변경 이력이 없습니다.</div>
                </div>

                <v-timeline v-else density="compact" side="end" class="commit-timeline px-3 py-4">
                    <v-timeline-item
                        v-for="commit in commits"
                        :key="commit.sha"
                        size="x-small"
                        dot-color="primary"
                        class="commit-item"
                    >
                        <template #opposite>
                            <div class="text-caption text-medium-emphasis commit-date">
                                {{ formatDate(commit.date) }}
                            </div>
                        </template>
                        <v-card variant="outlined" class="commit-card">
                            <div class="d-flex align-start pa-3 gap-3">
                                <v-avatar size="28" class="flex-shrink-0 mt-1">
                                    <v-icon size="20">mdi-account-circle-outline</v-icon>
                                </v-avatar>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="text-body-2 font-weight-medium commit-message">
                                        {{ firstLine(commit.message) }}
                                    </div>
                                    <div v-if="bodyLines(commit.message)" class="text-caption text-medium-emphasis mt-1 commit-body">
                                        {{ bodyLines(commit.message) }}
                                    </div>
                                    <div class="d-flex align-center gap-2 mt-1 flex-wrap">
                                        <span class="text-caption text-medium-emphasis">{{ commit.author }}</span>
                                        <v-chip size="x-small" variant="tonal" color="default" class="font-mono commit-sha">
                                            {{ commit.sha.slice(0, 7) }}
                                        </v-chip>
                                    </div>
                                </div>
                            </div>
                        </v-card>
                    </v-timeline-item>
                </v-timeline>
            </template>

            <!-- PR 탭 -->
            <template v-else-if="activeTab === 'prs'">
                <div v-if="prsLoading" class="d-flex justify-center py-8">
                    <v-progress-circular indeterminate color="primary" size="32" />
                </div>

                <div v-else-if="pullRequests.length === 0" class="d-flex flex-column align-center justify-center py-8">
                    <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-source-pull</v-icon>
                    <div class="text-body-2 text-medium-emphasis">열린 PR이 없습니다.</div>
                </div>

                <div v-else class="pa-3 d-flex flex-column gap-2">
                    <v-card
                        v-for="pr in pullRequests"
                        :key="pr.number"
                        variant="outlined"
                        class="pr-card"
                    >
                        <div class="d-flex align-start pa-3 gap-3">
                            <v-icon size="20" color="success" class="mt-1 flex-shrink-0">mdi-source-pull</v-icon>
                            <div class="flex-grow-1 min-w-0">
                                <div class="d-flex align-center gap-2 flex-wrap mb-1">
                                    <span class="text-body-2 font-weight-medium pr-title">{{ pr.title }}</span>
                                    <v-chip size="x-small" variant="tonal" color="default" class="font-mono">#{{ pr.number }}</v-chip>
                                </div>
                                <div class="d-flex align-center gap-1 text-caption text-medium-emphasis">
                                    <v-chip size="x-small" variant="tonal" color="primary">{{ pr.head }}</v-chip>
                                    <v-icon size="14">mdi-arrow-right</v-icon>
                                    <v-chip size="x-small" variant="tonal" color="default">{{ pr.base }}</v-chip>
                                </div>
                            </div>
                            <div class="d-flex flex-column gap-1 flex-shrink-0 align-end">
                                <v-btn
                                    color="primary"
                                    size="small"
                                    variant="flat"
                                    rounded
                                    :loading="mergingPR === pr.number"
                                    :disabled="mergingPR !== null"
                                    @click="openMergeDialog(pr)"
                                >
                                    반영
                                </v-btn>
                                <a
                                    v-if="pr.html_url"
                                    :href="pr.html_url"
                                    target="_blank"
                                    class="text-caption text-medium-emphasis pr-link"
                                >
                                    PR 보기
                                </a>
                            </div>
                        </div>
                    </v-card>
                </div>
            </template>
        </div>

        <!-- merge confirm dialog -->
        <v-dialog v-model="mergeDialog" max-width="440px" persistent>
            <v-card v-if="prToMerge">
                <v-card-title class="d-flex justify-space-between pa-4 pb-0">
                    PR 반영
                    <v-btn variant="text" density="compact" icon @click="mergeDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0">
                    <p class="text-body-2 mb-3">
                        <strong>{{ prToMerge.title }}</strong> (#{{ prToMerge.number }}) PR을 main에 merge하고 에이전트에 즉시 반영합니다.
                    </p>
                    <v-alert type="info" variant="tonal" density="compact">
                        merge 후 로컬 디스크에 자동 sync됩니다.
                    </v-alert>
                    <v-alert v-if="mergeError" type="error" density="compact" class="mt-3" closable @click:close="mergeError = ''">
                        {{ mergeError }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="d-flex justify-end pa-4">
                    <v-btn variant="text" @click="mergeDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        rounded
                        variant="flat"
                        :loading="mergingPR === prToMerge.number"
                        @click="confirmMerge"
                    >
                        반영
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from './api/BackendFactory';

export default {
    name: 'SkillGitHistory',
    props: {
        skillName: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            activeTab: 'commits',
            isOwner: true,

            // repo state
            hasRepo: null,          // null=checking, true=exists, false=no repo
            branches: [],
            selectedBranch: null,
            defaultBranch: 'main',
            branchesLoading: false,
            creatingRepo: false,
            createRepoError: '',

            // commits
            commits: [],
            commitsLoading: false,

            // PRs
            pullRequests: [],
            prsLoading: false,
            openPrCount: 0,

            // merge
            mergeDialog: false,
            prToMerge: null,
            mergingPR: null,
            mergeError: ''
        };
    },
    computed: {
        repoName() {
            return this.skillName || '';
        }
    },
    watch: {
        skillName(newVal, oldVal) {
            if (newVal && newVal !== oldVal) {
                this.activeTab = 'commits';
                this.pullRequests = [];
                this.openPrCount = 0;
                this.isOwner = true;
                this.fetchBranches();
            }
        },
        activeTab(tab) {
            if (tab === 'prs' && this.isOwner && this.pullRequests.length === 0 && !this.prsLoading) {
                this.fetchPullRequests();
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        if (this.skillName) this.fetchBranches();
    },
    methods: {
        async fetchBranches() {
            this.branchesLoading = true;
            this.branches = [];
            this.selectedBranch = null;
            this.commits = [];
            this.hasRepo = null;
            try {
                const result = await this.backend.getSkillBranches(this.skillName);
                this.branches = result.branches ?? [];
                this.defaultBranch = result.default_branch || 'main';
                if (this.branches.length > 0) {
                    this.hasRepo = true;
                    this.selectedBranch = this.defaultBranch;
                    await Promise.all([this.fetchCommits(), this.checkOwnership()]);
                    if (this.isOwner) this.fetchOpenPrCount();
                } else {
                    this.hasRepo = false;
                }
            } catch (_) {
                this.hasRepo = false;
            } finally {
                this.branchesLoading = false;
            }
        },

        async checkOwnership() {
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
        },

        async fetchCommits() {
            this.commitsLoading = true;
            this.commits = [];
            try {
                const result = await this.backend.getSkillCommits(this.skillName, this.selectedBranch);
                this.commits = (result && result.commits) ? result.commits : (Array.isArray(result) ? result : []);
            } finally {
                this.commitsLoading = false;
            }
        },

        async fetchOpenPrCount() {
            if (!this.isOwner) return;
            try {
                const result = await this.backend.getSkillPullRequests(this.skillName, 'open');
                const prs = result?.pull_requests ?? [];
                this.openPrCount = prs.length;
            } catch (_) {}
        },

        async fetchPullRequests() {
            if (!this.isOwner) return;
            this.prsLoading = true;
            this.pullRequests = [];
            try {
                const result = await this.backend.getSkillPullRequests(this.skillName, 'open');
                this.pullRequests = result?.pull_requests ?? [];
                this.openPrCount = this.pullRequests.length;
            } finally {
                this.prsLoading = false;
            }
        },

        openMergeDialog(pr) {
            this.prToMerge = pr;
            this.mergeError = '';
            this.mergeDialog = true;
        },

        async confirmMerge() {
            if (!this.prToMerge) return;
            this.mergingPR = this.prToMerge.number;
            this.mergeError = '';
            try {
                await this.backend.mergeSkillPullRequest(this.skillName, this.prToMerge.number);
                this.mergeDialog = false;
                this.prToMerge = null;
                // PR 목록과 커밋 이력 갱신
                await Promise.all([this.fetchPullRequests(), this.fetchCommits()]);
                // merge 완료 후 커밋 탭으로 이동
                this.activeTab = 'commits';
            } catch (err) {
                this.mergeError = err?.message || String(err);
            } finally {
                this.mergingPR = null;
            }
        },

        async createRepo() {
            this.creatingRepo = true;
            this.createRepoError = '';
            try {
                await this.backend.createSkillRepo(this.skillName);
                await this.fetchBranches();
            } catch (err) {
                this.createRepoError = err?.message || String(err);
            } finally {
                this.creatingRepo = false;
            }
        },

        formatDate(dateString) {
            if (!dateString) return '';
            try {
                return new Date(dateString).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return dateString;
            }
        },

        firstLine(message) {
            return (message || '').split('\n')[0].trim();
        },

        bodyLines(message) {
            const lines = (message || '').split('\n').slice(1).join('\n').trim();
            return lines.length > 120 ? lines.slice(0, 120) + '…' : lines;
        }
    }
};
</script>

<style scoped>
.skill-git-history {
    height: 100%;
    overflow: hidden;
}

.commit-timeline {
    width: 100%;
}

.commit-card,
.pr-card {
    transition: box-shadow 0.15s;
}

.commit-card:hover,
.pr-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
}

.commit-message,
.pr-title {
    word-break: break-word;
    line-height: 1.4;
}

.commit-body {
    white-space: pre-line;
    word-break: break-word;
    max-height: 60px;
    overflow: hidden;
}

.commit-sha {
    font-family: 'Courier New', monospace;
    font-size: 11px;
}

.commit-date {
    min-width: 110px;
    text-align: right;
    font-size: 11px;
}

.font-mono {
    font-family: 'Courier New', monospace;
}

.min-w-0 {
    min-width: 0;
}

.pr-link {
    text-decoration: none;
    font-size: 11px;
}

.pr-link:hover {
    text-decoration: underline;
}
</style>
