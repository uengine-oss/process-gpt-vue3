<template>
    <div class="skill-git-history d-flex flex-column h-100">

        <!-- 브랜치 로딩 -->
        <div v-if="branchesLoading" class="d-flex justify-center py-10">
            <v-progress-circular indeterminate color="primary" size="28" />
        </div>

        <!-- 레포 없음 -->
        <div v-else-if="hasRepo === false" class="d-flex flex-column align-center justify-center py-10 px-6 text-center">
            <v-icon size="44" color="grey-lighten-1" class="mb-3">mdi-git</v-icon>
            <div class="text-body-2 font-weight-medium mb-1">{{ $t('SkillGitHistory.noRepoTitle') }}</div>
            <div class="text-caption text-medium-emphasis mb-4">{{ $t('SkillGitHistory.noRepoDesc') }}</div>
            <v-btn color="primary" variant="flat" size="small" rounded :loading="creatingRepo" @click="createRepo">
                {{ $t('SkillGitHistory.createRepo') }}
            </v-btn>
            <v-alert v-if="createRepoError" type="error" density="compact" class="mt-3 w-100" closable @click:close="createRepoError = ''">
                {{ createRepoError }}
            </v-alert>
        </div>

        <!-- PR 상세 뷰 (컴포넌트 전환) -->
        <SkillPrDetail
            v-else-if="selectedPr"
            :pr="selectedPr"
            :files="prFiles[selectedPr.id] || []"
            :files-loading="!!prFilesLoading[selectedPr.id]"
            :reviews="prReviewsMap[selectedPr.id] || []"
            :is-owner="isOwner"
            :review-loading="reviewLoading"
            :review-error="reviewError"
            :merge-loading="mergeLoading"
            :merge-error="mergeError"
            :comment-loading="commentLoading"
            :comment-error="commentError"
            :requester-profile="requesterProfileMap[selectedPr.requester_id] || null"
            @back="closePr"
            @submit-review="submitReview"
            @submit-merge="submitMerge"
            @submit-comment="submitComment"
        />

        <!-- 메인 목록 뷰 -->
        <template v-else>

            <!-- 헤더 + 세그먼트 컨트롤 -->
            <div class="gh-header flex-shrink-0">
                <span class="gh-title">{{ $t('SkillGitHistory.title') }}</span>
                <div class="seg-ctrl">
                    <button :class="['seg-btn', { active: activeTab === 'commits' }]" @click="switchTab('commits')">
                        <svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/></svg>
                        {{ $t('SkillGitHistory.commitsTab') }}
                    </button>
                    <button :class="['seg-btn', { active: activeTab === 'prs' }]" @click="switchTab('prs')">
                        <svg class="ico" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V14a4 4 0 0 0 4 4h5"/></svg>
                        {{ $t('SkillGitHistory.prsTab') }}
                        <span v-if="openPrCount > 0" class="pr-pill">{{ openPrCount }}</span>
                    </button>
                </div>
            </div>

            <!-- ══════ PR 탭 ══════ -->
            <template v-if="activeTab === 'prs'">
                <!-- 필터 칩 -->
                <div class="fbar flex-shrink-0">
                    <span v-for="f in prFilterOptions" :key="f.key"
                          :class="['fchip', { active: prFilter === f.key }]"
                          @click="prFilter = f.key">
                        {{ f.label }}<span v-if="f.count != null" class="fchip-ct">{{ f.count }}</span>
                    </span>
                </div>

                <!-- 로딩 -->
                <div v-if="prsLoading" class="d-flex justify-center py-8">
                    <v-progress-circular indeterminate color="primary" size="24" />
                </div>

                <!-- PR 목록 -->
                <div v-else class="gh-body flex-grow-1 overflow-y-auto">

                    <!-- 내 리뷰 필요 -->
                    <template v-if="needsMyReviewPrs.length">
                        <div class="sec-h">
                            {{ $t('SkillGitHistory.needsMyReview') }}
                            <span class="sec-n">· {{ isOwner ? $t('SkillGitHistory.roleOwner') : $t('SkillGitHistory.roleAuthor') }}</span>
                        </div>
                        <div v-for="pr in needsMyReviewPrs" :key="pr.id" class="prc" @click="openPr(pr)">
                            <span :class="['pr-accent', prAccentClass(pr.status)]"></span>
                            <span class="pr-ava" :style="{ background: requesterProfileMap[pr.requester_id] ? 'transparent' : authorColor(pr.requester_name) }">
                                <img v-if="requesterProfileMap[pr.requester_id]" :src="requesterProfileMap[pr.requester_id]" class="pr-ava-img" @error="clearProfile(pr.requester_id)" />
                                <template v-else>{{ authorInitials(pr.requester_name || '') }}</template>
                            </span>
                            <div class="prc-body">
                                <div class="prc-title">
                                    {{ pr.title }}
                                    <span :class="['st-badge', prBadgeClass(pr.status)]">{{ prStatusLabel(pr.status) }}</span>
                                </div>
                                <div class="prc-byline">
                                    <b>{{ pr.requester_name || $t('SkillGitHistory.unknownUser') }}</b>
                                    <span class="dot-sep">·</span>
                                    <span class="pr-time">{{ relativeTime(pr.updated_at || pr.created_at) }}</span>
                                    <template v-if="prActionText(pr)">
                                        <span class="dot-sep">·</span>
                                        <span class="pr-action">{{ prActionText(pr) }}</span>
                                    </template>
                                </div>
                                <div class="prc-branchline">
                                    <span class="bchip">{{ shortBranch(pr.branch_name) }}</span>
                                    <span class="arrow">→</span>
                                    <span class="bchip">{{ pr.base_branch }}</span>
                                    <span v-if="pr.git_pr_number" class="pr-num">#{{ pr.git_pr_number }}</span>
                                </div>
                            </div>
                            <div class="prc-actions">
                                <button v-if="isOwner" class="rbtn" @click="openPr(pr)">{{ $t('SkillGitHistory.reviewAction') }}</button>
                                <button v-else-if="!isOwner && pr.status === 'CHANGES_REQUESTED'"
                                        class="rbtn ghost"
                                        :disabled="resubmittingPR === pr.id"
                                        @click.stop="resubmitPR(pr)">
                                    {{ $t('SkillGitHistory.resubmitAction') }}
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- 다른 활성 PR -->
                    <template v-if="otherActivePrs.length">
                        <div class="sec-h">
                            {{ needsMyReviewPrs.length ? $t('SkillGitHistory.waitingReview') : $t('SkillGitHistory.activePr') }}
                            <span class="sec-n">· {{ $t('SkillGitHistory.otherReviewer') }}</span>
                        </div>
                        <div v-for="pr in otherActivePrs" :key="pr.id" class="prc" @click="openPr(pr)">
                            <span :class="['pr-accent', prAccentClass(pr.status)]"></span>
                            <span class="pr-ava" :style="{ background: requesterProfileMap[pr.requester_id] ? 'transparent' : authorColor(pr.requester_name) }">
                                <img v-if="requesterProfileMap[pr.requester_id]" :src="requesterProfileMap[pr.requester_id]" class="pr-ava-img" @error="clearProfile(pr.requester_id)" />
                                <template v-else>{{ authorInitials(pr.requester_name || '') }}</template>
                            </span>
                            <div class="prc-body">
                                <div class="prc-title">
                                    {{ pr.title }}
                                    <span :class="['st-badge', prBadgeClass(pr.status)]">{{ prStatusLabel(pr.status) }}</span>
                                </div>
                                <div class="prc-byline">
                                    <b>{{ pr.requester_name || $t('SkillGitHistory.unknownUser') }}</b>
                                    <span class="dot-sep">·</span>
                                    <span class="pr-time">{{ relativeTime(pr.updated_at || pr.created_at) }}</span>
                                    <template v-if="prActionText(pr)">
                                        <span class="dot-sep">·</span>
                                        <span class="pr-action">{{ prActionText(pr) }}</span>
                                    </template>
                                </div>
                                <div class="prc-branchline">
                                    <span class="bchip">{{ shortBranch(pr.branch_name) }}</span>
                                    <span class="arrow">→</span>
                                    <span class="bchip">{{ pr.base_branch }}</span>
                                    <span v-if="pr.git_pr_number" class="pr-num">#{{ pr.git_pr_number }}</span>
                                </div>
                            </div>
                            <div class="prc-actions">
                                <button v-if="isOwner && pr.status === 'APPROVED'" class="rbtn rbtn-merge">{{ $t('SkillGitHistory.mergeAction') }}</button>
                                <svg v-else class="ico chev-ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>
                    </template>

                    <!-- 최근 병합됨 -->
                    <template v-if="filteredMergedPrs.length">
                        <div class="sec-h">
                            {{ $t('SkillGitHistory.recentlyMerged') }}
                            <span class="sec-n">· {{ $t('SkillGitHistory.mergedCount', { count: filteredMergedPrs.length }) }}</span>
                        </div>
                        <div v-for="pr in filteredMergedPrs" :key="pr.id" class="prc merged" @click="openPr(pr)">
                            <span class="pr-accent pr-accent-merged"></span>
                            <span class="pr-ava pr-ava-merged" :style="{ background: requesterProfileMap[pr.requester_id] ? 'transparent' : authorColor(pr.requester_name) }">
                                <img v-if="requesterProfileMap[pr.requester_id]" :src="requesterProfileMap[pr.requester_id]" class="pr-ava-img pr-ava-img-merged" @error="clearProfile(pr.requester_id)" />
                                <template v-else>{{ authorInitials(pr.requester_name || '') }}</template>
                            </span>
                            <div class="prc-body">
                                <div class="prc-title">
                                    {{ pr.title }}
                                    <span class="st-badge st-merged">{{ $t('SkillGitHistory.mergedBadge') }}</span>
                                </div>
                                <div class="prc-byline">
                                    <b>{{ pr.requester_name || $t('SkillGitHistory.unknownUser') }}</b>
                                    <span class="dot-sep">·</span>
                                    <span class="pr-time">{{ relativeTime(pr.merged_at || pr.updated_at) }}</span>
                                </div>
                                <div v-if="prMergedByName(pr)" class="prc-mergedby">
                                    <span class="merger-chip">
                                        <svg class="ico-xs" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M8.4 7.4 15.6 7.6M18 11.5c0 3-3 4-6 4"/></svg>
                                        {{ $t('SkillGitHistory.mergedBy', { name: prMergedByName(pr) }) }}
                                    </span>
                                </div>
                                <div class="prc-branchline">
                                    <span class="bchip">{{ shortBranch(pr.branch_name) }}</span>
                                    <span class="arrow">→</span>
                                    <span class="bchip">{{ pr.base_branch }}</span>
                                    <span v-if="pr.git_pr_number" class="pr-num">#{{ pr.git_pr_number }}</span>
                                    <a v-if="pr.git_pr_url" :href="pr.git_pr_url" target="_blank" class="gh-link" @click.stop>
                                        GitHub <svg class="ico-xs" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                </div>
                            </div>
                            <div class="prc-actions">
                                <svg class="ico chev-ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>
                    </template>

                    <!-- 빈 상태 -->
                    <div v-if="!needsMyReviewPrs.length && !otherActivePrs.length && !filteredMergedPrs.length"
                         class="d-flex flex-column align-center justify-center py-8">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" stroke-width="1.5"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V14a4 4 0 0 0 4 4h5"/></svg>
                        <div class="text-caption text-medium-emphasis mt-2">{{ $t('SkillGitHistory.noPrs') }}</div>
                    </div>
                </div>
            </template>

            <!-- ══════ 커밋 탭 ══════ -->
            <template v-else>
                <div v-if="commitsLoading" class="d-flex justify-center py-8">
                    <v-progress-circular indeterminate color="primary" size="24" />
                </div>
                <div v-else-if="commits.length === 0" class="d-flex flex-column align-center justify-center py-8">
                    <v-icon size="36" color="grey-lighten-1" class="mb-2">mdi-history</v-icon>
                    <div class="text-caption text-medium-emphasis">{{ $t('SkillGitHistory.noCommits') }}</div>
                </div>
                <div v-else class="gh-body flex-grow-1 overflow-y-auto">
                    <div v-for="(group, date) in groupedCommits" :key="date" class="commit-daygrp">
                        <div class="commit-dayh">{{ date }}</div>
                        <div v-for="commit in group" :key="commit.sha" class="commit-row">
                            <div class="commit-ava" :style="{ background: authorColor(commit.author) }">{{ authorInitials(commit.author) }}</div>
                            <div class="commit-main">
                                <div class="commit-msg">{{ firstLine(commit.message) }}</div>
                                <div class="commit-sub">
                                    <b>{{ commit.author }}</b>
                                    <code class="sha-chip">{{ commit.sha.slice(0, 7) }}</code>
                                    <span>{{ formatTime(commit.date) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>

<script>
import BackendFactory from './api/BackendFactory';
import SkillPrDetail from './SkillPrDetail.vue';
import { prStatusLabel as _prStatusLabel, prAccentClass as _prAccentClass, prBadgeClass as _prBadgeClass, getInitial, getAvatarColor, shortBranch as _shortBranch, formatRelativeTime } from '@/composables/usePrUtils';

export default {
    name: 'SkillGitHistory',
    components: { SkillPrDetail },
    props: {
        skillName: { type: String, required: true },
        selectedBranch: { type: String, default: '' }
    },
    data() {
        return {
            activeTab: 'commits',
            isOwner: true,
            currentUserId: null,
            currentUserName: '',

            hasRepo: null,
            repoUrl: null,
            branches: [],
            defaultBranch: 'main',
            branchesLoading: false,
            creatingRepo: false,
            createRepoError: '',

            commits: [],
            commitsLoading: false,

            prRecords: [],
            prReviewsMap: {},
            requesterProfileMap: {},
            prFiles: {},
            prFilesLoading: {},
            prsLoading: false,
            openPrCount: 0,
            prFilter: 'all',

            selectedPr: null,
            reviewLoading: false,
            reviewError: '',
            mergeLoading: false,
            mergeError: '',
            commentLoading: false,
            commentError: '',

            resubmittingPR: null
        };
    },
    computed: {
        activePrRecords() {
            return this.prRecords.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED');
        },
        mergedPrRecords() {
            return this.prRecords.filter(pr => pr.status === 'MERGED' || pr.status === 'CLOSED');
        },
        filteredActive() {
            if (this.prFilter === 'MERGED') return [];
            if (this.prFilter === 'all') return this.activePrRecords;
            return this.activePrRecords.filter(pr => pr.status === this.prFilter);
        },
        filteredMergedPrs() {
            if (this.prFilter !== 'all' && this.prFilter !== 'MERGED') return [];
            return this.mergedPrRecords;
        },
        needsMyReviewPrs() {
            return this.filteredActive.filter(pr =>
                this.isOwner
                    ? pr.status === 'OPEN' || pr.status === 'CHANGES_REQUESTED'
                    : pr.status === 'CHANGES_REQUESTED'
            );
        },
        otherActivePrs() {
            const ids = new Set(this.needsMyReviewPrs.map(p => p.id));
            return this.filteredActive.filter(pr => !ids.has(pr.id));
        },
        prFilterOptions() {
            const all = this.prRecords;
            return [
                { key: 'all',               label: this.$t('SkillGitHistory.filterAll'),               count: all.length },
                { key: 'OPEN',              label: this.$t('SkillGitHistory.filterOpen'),              count: all.filter(p => p.status === 'OPEN').length },
                { key: 'CHANGES_REQUESTED', label: this.$t('SkillGitHistory.filterChangesRequested'),  count: all.filter(p => p.status === 'CHANGES_REQUESTED').length },
                { key: 'APPROVED',          label: this.$t('SkillGitHistory.filterApproved'),          count: all.filter(p => p.status === 'APPROVED').length },
                { key: 'MERGED',            label: this.$t('SkillGitHistory.filterMerged'),            count: all.filter(p => p.status === 'MERGED' || p.status === 'CLOSED').length }
            ].filter(f => f.key === 'all' || f.count > 0);
        },
        groupedCommits() {
            const groups = {};
            for (const c of this.commits) {
                const key = this.formatDateHeader(c.date);
                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
            }
            return groups;
        }
    },
    watch: {
        skillName(newVal) {
            this.resetState();
            if (newVal) this.fetchBranches();
        },
        selectedBranch(newVal) {
            if (newVal && this.hasRepo) this.fetchCommits();
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        if (this.skillName) this.fetchBranches();
    },
    methods: {
        resetState() {
            this.activeTab = 'commits';
            this.prRecords = [];
            this.prReviewsMap = {};
            this.requesterProfileMap = {};
            this.prFiles = {};
            this.prFilesLoading = {};
            this.openPrCount = 0;
            this.prFilter = 'all';
            this.selectedPr = null;
            this.reviewLoading = false;
            this.reviewError = '';
            this.mergeLoading = false;
            this.mergeError = '';
            this.commentLoading = false;
            this.commentError = '';
            this.isOwner = true;
            this.currentUserId = null;
            this.currentUserName = '';
            this.repoUrl = null;
        },

        async fetchBranches() {
            this.branchesLoading = true;
            this.branches = [];
            this.commits = [];
            this.hasRepo = null;
            try {
                const result = await this.backend.getSkillBranches(this.skillName);
                this.branches = result.branches ?? [];
                this.defaultBranch = result.default_branch || 'main';
                if (this.branches.length > 0) {
                    this.hasRepo = true;
                    await Promise.all([this.checkOwnership(), this.fetchGitUrlPrefix()]);
                    await this.fetchPrRecords();
                    this.fetchCommits();
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
                const uid = userInfo?.uid || null;
                this.currentUserId = uid;
                this.currentUserName = localStorage.getItem('userName') || userInfo?.username || userInfo?.name || '';
                this.isOwner = !ownerId || !uid || ownerId === uid;
            } catch (_) {
                this.isOwner = true;
            }
        },

        async fetchCommits() {
            this.commitsLoading = true;
            this.commits = [];
            try {
                const result = await this.backend.getSkillCommits(this.skillName, this.selectedBranch || this.defaultBranch);
                this.commits = result?.commits ?? (Array.isArray(result) ? result : []);
            } finally {
                this.commitsLoading = false;
            }
        },

        async fetchGitUrlPrefix() {
            try {
                const configs = await this.backend.getGitConfigs();
                if (!configs || configs.length <= 1) return;
                const def = configs.find(c => c.is_default) || null;
                if (!def) return;
                const base = (def.base_url || 'https://github.com').replace(/\/$/, '');
                this.repoUrl = `${base}/${def.username}/`;
            } catch (_) {}
        },

        async fetchPrRecords() {
            this.prsLoading = true;
            this.prRecords = [];
            this.prReviewsMap = {};
            try {
                this.prRecords = await this.backend.getResourcePrRecords('skill', this.skillName, undefined, this.repoUrl || undefined);
                this.openPrCount = this.prRecords.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED').length;
                await Promise.all([
                    ...this.prRecords.map(async (pr) => {
                        try { this.prReviewsMap[pr.id] = await this.backend.getResourcePrReviews(pr.id); }
                        catch (_) { this.prReviewsMap[pr.id] = []; }
                    }),
                    this.fetchRequesterProfiles(this.prRecords)
                ]);
            } finally {
                this.prsLoading = false;
            }
        },

        async fetchRequesterProfiles(prRecords) {
            const uniqueIds = [...new Set(prRecords.map(pr => pr.requester_id).filter(Boolean))];
            const results = await Promise.allSettled(
                uniqueIds.map(id => this.backend.getUserById(id))
            );
            const map = { ...this.requesterProfileMap };
            results.forEach((r, i) => {
                if (r.status === 'fulfilled' && r.value?.profile && !r.value.profile.includes('defaultUser')) {
                    map[uniqueIds[i]] = r.value.profile;
                }
            });
            this.requesterProfileMap = map;
        },

        clearProfile(userId) {
            const map = { ...this.requesterProfileMap };
            delete map[userId];
            this.requesterProfileMap = map;
        },

        async loadPrFiles(pr) {
            if (!pr.git_pr_number || this.prFilesLoading[pr.id]) return;
            this.prFilesLoading = { ...this.prFilesLoading, [pr.id]: true };
            try {
                const files = await this.backend.getSkillPrFiles(this.skillName, pr.git_pr_number);
                this.prFiles = { ...this.prFiles, [pr.id]: files };
            } catch (_) {
                this.prFiles = { ...this.prFiles, [pr.id]: [] };
            } finally {
                this.prFilesLoading = { ...this.prFilesLoading, [pr.id]: false };
            }
        },

        openPr(pr) {
            this.selectedPr = pr;
            this.reviewError = '';
            this.mergeError = '';
            if (pr.git_pr_number && !this.prFiles[pr.id]) this.loadPrFiles(pr);
        },

        closePr() {
            this.selectedPr = null;
            this.reviewError = '';
            this.mergeError = '';
        },

        async submitReview(action, comment) {
            if (!this.selectedPr) return;
            const pr = this.selectedPr;
            if (action === 'CHANGES_REQUESTED' && !comment.trim()) return;
            this.reviewLoading = true;
            this.reviewError = '';
            try {
                const newStatus = action === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';
                await Promise.all([
                    this.backend.updateResourcePrStatus(pr, newStatus, { reviewerId: this.currentUserId }),
                    this.backend.addResourcePrReview(pr.id, action, comment, this.currentUserId, this.currentUserName)
                ]);
                this.selectedPr = null;
                await this.fetchPrRecords();
            } catch (err) {
                this.reviewError = err?.message || String(err);
            } finally {
                this.reviewLoading = false;
            }
        },

        async submitMerge() {
            if (!this.selectedPr) return;
            const pr = this.selectedPr;
            this.mergeLoading = true;
            this.mergeError = '';
            try {
                if (pr.git_pr_number) await this.backend.mergeSkillPullRequest(this.skillName, pr.git_pr_number);
                await this.backend.updateResourcePrStatus(pr, 'MERGED', { mergedAt: new Date().toISOString() });
                this.selectedPr = null;
                await Promise.all([this.fetchPrRecords(), this.fetchCommits()]);
            } catch (err) {
                this.mergeError = err?.message || String(err);
            } finally {
                this.mergeLoading = false;
            }
        },

        async submitComment(comment) {
            if (!this.selectedPr || !comment.trim()) return;
            const pr = this.selectedPr;
            this.commentLoading = true;
            this.commentError = '';
            try {
                await this.backend.addResourcePrReview(pr.id, 'COMMENT', comment, this.currentUserId, this.currentUserName);
                this.selectedPr = null;
                await this.fetchPrRecords();
            } catch (err) {
                this.commentError = err?.message || String(err);
            } finally {
                this.commentLoading = false;
            }
        },

        async resubmitPR(pr) {
            this.resubmittingPR = pr.id;
            try {
                await this.backend.updateResourcePrStatus(pr, 'OPEN');
                await this.fetchPrRecords();
            } catch (_) {
            } finally {
                this.resubmittingPR = null;
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

        switchTab(tab) {
            this.activeTab = tab;
            if (tab === 'commits' && this.commits.length === 0 && !this.commitsLoading) this.fetchCommits();
        },

        // ── 유틸 (공통 composable) ──
        prStatusLabel: _prStatusLabel,
        prAccentClass: _prAccentClass,
        prBadgeClass: _prBadgeClass,
        shortBranch: _shortBranch,
        relativeTime: formatRelativeTime,
        authorInitials: getInitial,
        authorColor: getAvatarColor,
        prActionText(pr) {
            const reviews = this.prReviewsMap[pr.id] || [];
            if (pr.status === 'OPEN') return this.$t('SkillGitHistory.actionRequestedReview');
            if (pr.status === 'CHANGES_REQUESTED') {
                const last = [...reviews].reverse().find(r => r.action === 'CHANGES_REQUESTED');
                return last?.reviewer_name
                    ? this.$t('SkillGitHistory.actionChangesRequestedBy', { name: last.reviewer_name })
                    : this.$t('SkillGitHistory.actionChangesRequested');
            }
            if (pr.status === 'APPROVED') {
                const last = [...reviews].reverse().find(r => r.action === 'APPROVED');
                return last?.reviewer_name
                    ? this.$t('SkillGitHistory.actionApprovedBy', { name: last.reviewer_name })
                    : this.$t('SkillGitHistory.actionApproved');
            }
            return '';
        },
        prMergedByName(pr) {
            const reviews = this.prReviewsMap[pr.id] || [];
            const last = [...reviews].reverse().find(r => r.action === 'APPROVED');
            return last?.reviewer_name || null;
        },
        formatDateHeader(d) {
            if (!d) return this.$t('SkillGitHistory.noDate');
            const locale = this.$i18n.locale === 'ko' ? 'ko-KR' : 'en-US';
            try { return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }); }
            catch { return d; }
        },
        formatTime(d) {
            if (!d) return '';
            const locale = this.$i18n.locale === 'ko' ? 'ko-KR' : 'en-US';
            try { return new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
            catch { return ''; }
        },
        firstLine(msg) { return (msg || '').split('\n')[0].trim(); }
    }
};
</script>

<style scoped>
.skill-git-history { height: 100%; overflow: hidden; }

.ico { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.ico-xs { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }

/* ── 헤더 ── */
.gh-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px 0; }
.gh-title { font-weight: 600; font-size: 14px; flex: 1; color: rgba(var(--v-theme-on-surface), 0.87); }
.seg-ctrl { display: flex; background: rgba(var(--v-theme-on-surface), 0.06); border-radius: 10px; padding: 3px; }
.seg-btn { display: flex; align-items: center; gap: 6px; border: none; background: none; padding: 5px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 500; color: rgba(var(--v-theme-on-surface), 0.5); cursor: pointer; font-family: inherit; transition: all 0.12s; }
.seg-btn.active { background: rgb(var(--v-theme-surface)); color: rgba(var(--v-theme-on-surface), 0.87); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.pr-pill { background: rgb(var(--v-theme-primary)); color: #fff; font-size: 10px; font-weight: 700; min-width: 17px; height: 17px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; }

/* ── 필터 ── */
.fbar { display: flex; align-items: center; gap: 7px; padding: 10px 16px 8px; flex-wrap: wrap; }
.fchip { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgb(var(--v-theme-surface)); border-radius: 999px; padding: 4px 11px; font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.55); display: flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.1s; user-select: none; }
.fchip.active { background: rgba(var(--v-theme-primary), 0.1); border-color: rgba(var(--v-theme-primary), 0.35); color: rgb(var(--v-theme-primary)); font-weight: 500; }
.fchip-ct { font-size: 10.5px; opacity: 0.7; }

/* ── 섹션 ── */
.sec-h { font-size: 11.5px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.45); padding: 12px 16px 6px; display: flex; align-items: center; gap: 6px; }
.sec-n { font-weight: 400; }
.gh-body { padding: 2px 14px 14px; }

/* ── PR 카드 ── */
.prc { display: flex; gap: 11px; align-items: flex-start; padding: 13px 12px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 13px; margin-bottom: 8px; background: rgb(var(--v-theme-surface)); position: relative; cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
.prc:hover { border-color: rgba(var(--v-theme-primary), 0.3); box-shadow: 0 3px 12px rgba(0,0,0,.06); }
.prc.merged:hover { border-color: rgba(var(--v-theme-on-surface), 0.2); box-shadow: 0 1px 4px rgba(0,0,0,.04); }

/* 작성자 아바타 */
.pr-ava { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex: none; margin-top: 1px; overflow: hidden; }
.pr-ava-merged { opacity: 0.75; }
.pr-ava-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.pr-ava-img-merged { opacity: 0.75; }

.pr-accent { position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 3px; }
.ac-open { background: rgb(var(--v-theme-primary)); }
.ac-chg { background: #E0A12B; }
.ac-app { background: #3E9A3E; }
.ac-merged { background: #7C6BD6; }
.pr-accent-merged { background: #7C6BD6; }

.prc-body { flex: 1; min-width: 0; padding-left: 4px; }
.prc-title { font-size: 13.5px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.87); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; line-height: 1.4; }
.prc-byline { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; flex-wrap: wrap; color: rgba(var(--v-theme-on-surface), 0.6); }
.prc-byline b { color: rgba(var(--v-theme-on-surface), 0.87); font-weight: 600; }
.prc-branchline { display: flex; align-items: center; gap: 6px; margin-top: 7px; flex-wrap: wrap; }

.bchip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: rgba(var(--v-theme-on-surface), 0.07); border-radius: 5px; padding: 1px 7px; color: rgba(var(--v-theme-on-surface), 0.6); }
.arrow { color: rgba(var(--v-theme-on-surface), 0.35); font-size: 12px; }
.pr-num { color: rgba(var(--v-theme-on-surface), 0.35); font-size: 11.5px; }
.dot-sep { color: rgba(var(--v-theme-on-surface), 0.25); }
.pr-time { font-size: 11.5px; }
.pr-action { font-size: 11.5px; }

.prc-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: none; padding-top: 2px; }
.chev-ico { color: rgba(var(--v-theme-on-surface), 0.35); }

/* ── 배지 ── */
.st-badge { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
.st-open   { background: rgba(var(--v-theme-primary), 0.1); color: rgb(var(--v-theme-primary)); }
.st-chg    { background: #FBF0DA; color: #92610A; }
.st-app    { background: #E7F4DF; color: #2E6B16; }
.st-merged { background: #EFEAFB; color: #5b46b8; }

.gh-link { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.45); text-decoration: none; }
.gh-link:hover { color: rgb(var(--v-theme-primary)); }

.prc-mergedby { margin-top: 6px; }
.merger-chip { display: inline-flex; align-items: center; gap: 4px; background: rgba(124,107,214,0.12); color: #5b46b8; border: 1px solid rgba(124,107,214,0.3); border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; }

/* ── 버튼 ── */
.rbtn { border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; transition: opacity 0.1s; display: inline-flex; align-items: center; gap: 5px; background: rgb(var(--v-theme-primary)); border: 1px solid rgb(var(--v-theme-primary)); color: #fff; }
.rbtn:hover { opacity: 0.88; }
.rbtn.ghost { background: rgb(var(--v-theme-surface)); border: 1px solid rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-primary)); }
.rbtn:disabled { opacity: 0.45; cursor: not-allowed; }
.rbtn-merge { background: #7C6BD6; border-color: #7C6BD6; }

/* ── 커밋 ── */
.commit-daygrp { margin-bottom: 4px; }
.commit-dayh { font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.4); font-weight: 600; padding: 10px 4px 6px; position: sticky; top: 0; background: rgb(var(--v-theme-surface)); }
.commit-row { display: flex; gap: 10px; padding: 9px 6px; border-radius: 10px; align-items: center; transition: background 0.1s; }
.commit-row:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.commit-ava { width: 28px; height: 28px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; }
.commit-main { flex: 1; min-width: 0; }
.commit-msg { font-size: 13px; font-weight: 500; color: rgba(var(--v-theme-on-surface), 0.87); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.commit-sub { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.5); margin-top: 3px; }
.commit-sub b { color: rgba(var(--v-theme-on-surface), 0.7); font-weight: 600; }
.sha-chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: rgba(var(--v-theme-on-surface), 0.07); padding: 1px 6px; border-radius: 5px; color: rgba(var(--v-theme-on-surface), 0.5); }
</style>
