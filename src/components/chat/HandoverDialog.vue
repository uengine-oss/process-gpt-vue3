<template>
    <v-card elevation="10" class="handover-dialog">
        <v-row class="ma-0 pa-4 pb-2 align-center">
            <v-card-title class="pa-0">{{ $t('Handover.title') }}</v-card-title>
            <v-spacer></v-spacer>
            <v-btn @click="close" variant="text" density="compact" icon>
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-row>

        <v-card-text class="pa-4 pt-0 handover-dialog__body">
            <!-- 1) 인계할 산출물 -->
            <v-card elevation="10" class="mb-3">
                <v-card-text class="pa-4">
                    <div class="d-flex align-center mb-2">
                        <div class="text-subtitle-2 font-weight-bold">{{ $t('Handover.artifacts') }}</div>
                        <v-spacer></v-spacer>
                        <v-btn variant="text" density="compact" size="small" @click="toggleAllArtifacts">
                            {{ allArtifactsSelected ? $t('Handover.deselectAll') : $t('Handover.selectAll') }}
                        </v-btn>
                    </div>
                    <div v-if="artifactCandidates.length === 0" class="text-caption text-medium-emphasis">
                        {{ $t('Handover.noArtifacts') }}
                    </div>
                    <v-checkbox
                        v-for="(a, i) in artifactCandidates"
                        :key="artifactKey(a, i)"
                        v-model="selectedArtifactKeys"
                        :value="artifactKey(a, i)"
                        density="compact"
                        hide-details
                    >
                        <template v-slot:label>
                            <v-icon size="16" class="mr-2">{{ artifactIcon(a.type) }}</v-icon>
                            <span class="text-body-2">{{ a.name || a.ref || a.type }}</span>
                            <v-chip size="x-small" variant="tonal" class="ml-2">{{ $t('Handover.artifactType_' + a.type) }}</v-chip>
                        </template>
                    </v-checkbox>
                </v-card-text>
            </v-card>

            <!-- 2) 다음 단계 -->
            <v-card elevation="10" class="mb-3">
                <v-card-text class="pa-4">
                    <div class="d-flex align-center mb-2">
                        <div class="text-subtitle-2 font-weight-bold">{{ $t('Handover.nextStep') }}</div>
                        <v-spacer></v-spacer>
                        <v-btn
                            variant="text"
                            density="compact"
                            size="small"
                            prepend-icon="mdi-auto-fix"
                            :loading="isSuggesting"
                            @click="requestSuggestion"
                        >
                            {{ $t('Handover.suggest') }}
                        </v-btn>
                    </div>
                    <v-text-field
                        v-model="doneLabel"
                        :label="$t('Handover.doneLabel')"
                        :placeholder="$t('Handover.doneLabelPlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-3"
                    ></v-text-field>
                    <v-text-field
                        v-model="nextActivityLabel"
                        :label="$t('Handover.nextActivityLabel')"
                        :placeholder="$t('Handover.nextActivityLabelPlaceholder')"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-3"
                    ></v-text-field>
                    <v-textarea
                        v-model="instruction"
                        :label="$t('Handover.instruction')"
                        :placeholder="$t('Handover.instructionPlaceholder')"
                        variant="outlined"
                        density="compact"
                        rows="3"
                        auto-grow
                        hide-details
                    ></v-textarea>
                    <div v-if="suggestError" class="text-caption text-error mt-2">{{ suggestError }}</div>
                </v-card-text>
            </v-card>

            <!-- 3) 담당자 (사람 / 에이전트 공통) -->
            <v-card elevation="10" class="mb-3">
                <v-card-text class="pa-4">
                    <div class="text-subtitle-2 font-weight-bold mb-2">{{ $t('Handover.assignee') }}</div>

                    <div v-if="selectedUser" class="d-flex align-center mb-3 pa-2 rounded selected-assignee">
                        <v-avatar size="36">
                            <v-img :src="selectedUser.profile || '/images/defaultUser.png'" />
                        </v-avatar>
                        <div class="ml-3">
                            <div class="font-weight-medium d-flex align-center">
                                {{ displayName(selectedUser) }}
                                <v-chip v-if="selectedUser.is_agent" color="primary" size="x-small" variant="tonal" class="ml-2">
                                    {{ $t('Handover.agentBadge') }}
                                </v-chip>
                            </div>
                            <div class="text-caption text-medium-emphasis">{{ subLabel(selectedUser) }}</div>
                        </div>
                        <v-spacer></v-spacer>
                        <v-btn variant="text" density="compact" icon size="small" @click="selectedUser = null">
                            <v-icon size="18">mdi-close</v-icon>
                        </v-btn>
                    </div>

                    <!-- 전체 / 사람 / 에이전트 탭 -->
                    <v-tabs v-model="resourceFilter" density="compact" class="mb-2 e2e-assignee-tabs">
                        <v-tab value="all" size="small">{{ $t('Handover.filterAll') }} ({{ counts.all }})</v-tab>
                        <v-tab value="human" size="small">{{ $t('Handover.filterHuman') }} ({{ counts.human }})</v-tab>
                        <v-tab value="agent" size="small">{{ $t('Handover.filterAgent') }} ({{ counts.agent }})</v-tab>
                    </v-tabs>

                    <div class="d-flex align-center border border-borderColor rounded-pill px-3 mb-2">
                        <v-icon size="18">mdi-magnify</v-icon>
                        <v-text-field
                            v-model="searchText"
                            variant="plain"
                            density="compact"
                            class="ml-2 pt-0"
                            :placeholder="$t('Handover.searchAssignee')"
                            single-line
                            hide-details
                            clearable
                        ></v-text-field>
                    </div>

                    <v-list density="compact" class="assignee-list">
                        <v-list-item
                            v-for="u in filteredUsers"
                            :key="u.id"
                            class="e2e-assignee-item"
                            :active="selectedUser && selectedUser.id === u.id"
                            @click="selectedUser = u"
                        >
                            <template v-slot:prepend>
                                <v-avatar size="28">
                                    <v-img :src="u.profile || '/images/defaultUser.png'" />
                                </v-avatar>
                            </template>
                            <v-list-item-title class="d-flex align-center">
                                {{ displayName(u) }}
                                <v-chip v-if="u.is_agent" color="primary" size="x-small" variant="tonal" class="ml-2">
                                    {{ $t('Handover.agentBadge') }}
                                </v-chip>
                                <!-- 이 단계에 필요한 역량을 가진 사람은 추천으로 표시한다 -->
                                <v-chip v-if="u.__eligible" color="success" size="x-small" variant="tonal" class="ml-2">
                                    {{ $t('Handover.eligible') }}
                                </v-chip>
                            </v-list-item-title>
                            <v-list-item-subtitle>{{ subLabel(u) }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item v-if="!isUserLoading && filteredUsers.length === 0">
                            <v-list-item-title class="text-caption text-medium-emphasis">
                                {{ $t('Handover.noAssigneeFound') }}
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>

            <!-- 4) 옵션 -->
            <v-card elevation="10" class="mb-3">
                <v-card-text class="pa-4">
                    <v-text-field
                        v-model="dueDate"
                        :label="$t('Handover.dueDate')"
                        type="date"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mb-3"
                    ></v-text-field>
                    <v-textarea
                        v-model="reason"
                        :label="$t('Handover.reason')"
                        :placeholder="$t('Handover.reasonPlaceholder')"
                        variant="outlined"
                        density="compact"
                        rows="2"
                        auto-grow
                        hide-details
                        class="mb-2"
                    ></v-textarea>
                    <v-checkbox
                        v-model="carryAgents"
                        :label="$t('Handover.carryAgents')"
                        density="compact"
                        hide-details
                        :disabled="roomAgentCount === 0"
                    ></v-checkbox>
                    <div v-if="roomAgentCount === 0" class="text-caption text-medium-emphasis ml-8">
                        {{ $t('Handover.noRoomAgents') }}
                    </div>
                </v-card-text>
            </v-card>

            <!-- 인계 체인 -->
            <v-card v-if="chain.length > 0" elevation="10">
                <v-card-text class="pa-4">
                    <div class="text-subtitle-2 font-weight-bold mb-2">{{ $t('Handover.chain') }}</div>
                    <v-timeline density="compact" side="end" truncate-line="both">
                        <v-timeline-item v-for="ev in chain" :key="ev.id" :dot-color="ev.to_is_agent ? 'primary' : 'grey'" size="x-small">
                            <div class="text-body-2">
                                <span class="font-weight-bold">{{ ev.from_user_name || ev.from_user_id || '—' }}</span>
                                <v-icon size="14" class="mx-1">mdi-arrow-right</v-icon>
                                <span class="font-weight-bold">{{ ev.to_user_name || ev.to_user_id }}</span>
                                <v-chip v-if="!ev.is_explicit" size="x-small" variant="tonal" class="ml-1">
                                    {{ $t('Handover.implicit') }}
                                </v-chip>
                            </div>
                            <div v-if="ev.next_activity_label || ev.activity_label" class="text-caption text-medium-emphasis">
                                {{ ev.next_activity_label || ev.activity_label }}
                            </div>
                            <div class="text-caption text-medium-emphasis">{{ formatDateTime(ev.occurred_at) }}</div>
                        </v-timeline-item>
                    </v-timeline>
                </v-card-text>
            </v-card>
        </v-card-text>

        <v-row class="ma-0 pa-4 pt-2 align-center">
            <div v-if="validationMessage" class="text-caption text-medium-emphasis">{{ validationMessage }}</div>
            <v-spacer></v-spacer>
            <!-- 에이전트에게 넘긴 방: 더 이어 줄 일 없이 업무를 끝낸다(에이전트 할 일 완료만으로는 끝을 알 수 없다) -->
            <v-tooltip v-if="canCloseThread" :text="$t('Handover.closeThread')" location="top">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        class="e2e-handover-close-thread mr-2"
                        variant="text"
                        density="comfortable"
                        icon
                        :disabled="isSubmitting"
                        @click="$emit('close-thread')"
                    >
                        <v-icon>mdi-flag-checkered</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-btn variant="text" density="compact" class="rounded-pill mr-2" @click="close">
                {{ $t('Handover.cancel') }}
            </v-btn>
            <v-btn
                color="primary"
                variant="elevated"
                density="compact"
                class="rounded-pill"
                :disabled="!!validationMessage || isSubmitting"
                :loading="isSubmitting"
                @click="submit"
            >
                {{ $t('Handover.submit') }}
            </v-btn>
        </v-row>
    </v-card>
</template>

<script>
import axios from 'axios';
import BackendFactory from '@/components/api/BackendFactory';
import { useDefaultSetting } from '@/stores/defaultSetting';

const backend = BackendFactory.createBackend();

export default {
    name: 'HandoverDialog',
    props: {
        // 인계를 시작하는 채팅방
        roomId: { type: String, required: true },
        sourceRoom: { type: Object, default: null },
        // ChatRoomPage 가 모아 준 산출물 후보
        // [{ type, ref, name, content?, storagePath? }]
        artifactCandidates: { type: Array, default: () => [] },
        // 최근 대화 (AI 제안 입력용)
        recentMessages: { type: Array, default: () => [] },
        // 에이전트에게 인계할 때 쓸 오케스트레이션.
        // users 테이블에는 오케스트레이션 컬럼이 없으므로(agent_type 은 'agent' 리터럴이다)
        // 지금 방이 쓰고 있는 런타임을 물려받는다. 잘못된 값을 넣으면
        // fetch_pending_task 가 그 작업을 영영 집어가지 않는다.
        defaultOrchestration: { type: String, default: 'deepagents' },
        isSubmitting: { type: Boolean, default: false },
        // 에이전트에게 넘긴 방이고 에이전트가 일을 마쳤으면 업무 종료를 보인다
        canCloseThread: { type: Boolean, default: false }
    },
    emits: ['close', 'submit', 'close-thread'],
    data() {
        return {
            selectedArtifactKeys: [],
            doneLabel: '',
            nextActivityLabel: '',
            instruction: '',
            reason: '',
            dueDate: null,
            carryAgents: true,
            selectedUser: null,
            searchText: '',
            resourceFilter: 'all',
            userList: [],
            isUserLoading: false,
            // 이 단계에 필요한 역량을 가진 사람(자격 보유자) id 집합
            eligibleIds: [],
            isSuggesting: false,
            suggestError: '',
            chain: [],
            caseId: null
        };
    },
    computed: {
        allArtifactsSelected() {
            return this.artifactCandidates.length > 0 && this.selectedArtifactKeys.length === this.artifactCandidates.length;
        },
        roomAgentCount() {
            const participants = Array.isArray(this.sourceRoom?.participants) ? this.sourceRoom.participants : [];
            return participants.filter((p) => p?.isAgent || p?.is_agent).length;
        },
        currentUserId() {
            return localStorage.getItem('uid');
        },
        counts() {
            return {
                all: this.userList.length,
                human: this.userList.filter((u) => !u.is_agent).length,
                agent: this.userList.filter((u) => u.is_agent).length
            };
        },
        filteredUsers() {
            const q = (this.searchText || '').trim().toLowerCase();
            const eligible = new Set(this.eligibleIds);
            return this.userList
                .filter((u) => {
                    if (this.resourceFilter === 'human' && u.is_agent) return false;
                    if (this.resourceFilter === 'agent' && !u.is_agent) return false;
                    if (!q) return true;
                    return [u.username, u.name, u.email, u.alias].some((v) => (v || '').toString().toLowerCase().includes(q));
                })
                .map((u) => ({ ...u, __eligible: eligible.has(u.id) }))
                // 자격 보유자를 위로 올린다
                .sort((a, b) => Number(b.__eligible) - Number(a.__eligible));
        },
        validationMessage() {
            if (!this.nextActivityLabel || !this.nextActivityLabel.trim()) return this.$t('Handover.validationActivity');
            if (!this.selectedUser) return this.$t('Handover.validationAssignee');
            return null;
        }
    },
    created() {
        this.selectedArtifactKeys = this.artifactCandidates.map((a, i) => this.artifactKey(a, i));
        this.loadUsers();
        this.loadChain();
    },
    methods: {
        close() {
            this.$emit('close');
        },
        artifactKey(a, i) {
            return `${a.type}:${a.ref || a.name || ''}:${i}`;
        },
        artifactIcon(type) {
            const map = {
                workspace_file: 'mdi-file-document-outline',
                attachment: 'mdi-paperclip',
                knowledge: 'mdi-bookshelf',
                chat_summary: 'mdi-message-text-outline'
            };
            return map[type] || 'mdi-file-outline';
        },
        toggleAllArtifacts() {
            this.selectedArtifactKeys = this.allArtifactsSelected ? [] : this.artifactCandidates.map((a, i) => this.artifactKey(a, i));
        },
        displayName(u) {
            return u.username || u.name || u.alias || u.email || u.id;
        },
        formatDateTime(value) {
            if (!value) return '';
            const d = new Date(value);
            if (isNaN(d.getTime())) return value;
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        subLabel(u) {
            return [u.email, u.department_name, u.role].filter(Boolean).join(' · ');
        },
        async loadUsers() {
            this.isUserLoading = true;
            try {
                // users 테이블의 사람·에이전트에 더해, users 에 없는 내장 기본 에이전트도 합친다.
                const users = (await backend.getUserList({ orderBy: 'username' })) || [];
                let builtin = [];
                try {
                    builtin = (useDefaultSetting().getAgentList || []).filter((a) => a && a.alias !== 'default');
                } catch (e) {
                    builtin = [];
                }
                const me = localStorage.getItem('uid');
                const seen = new Set();
                this.userList = [...users, ...builtin].filter((u) => {
                    if (!u?.id || u.id === me || seen.has(u.id)) return false;
                    seen.add(u.id);
                    return true;
                });
            } catch (e) {
                console.error('[handover] 사용자 목록 로딩 실패:', e);
                this.userList = [];
            } finally {
                this.isUserLoading = false;
            }
        },
        /** 다음 단계에 필요한 역량을 가진 사람을 표시한다(조직 마이닝 결과 활용). */
        async loadEligibility(activityName) {
            if (!activityName) {
                this.eligibleIds = [];
                return;
            }
            try {
                const res = await fetch(`/process-miner/eligibility?activity=${encodeURIComponent(activityName)}&tenant_id=${window.$tenantName}`);
                if (!res.ok) throw new Error(String(res.status));
                const d = await res.json();
                this.eligibleIds = (d.candidates || []).map((c) => c.user_id);
            } catch (e) {
                this.eligibleIds = [];
            }
        },
        async loadChain() {
            try {
                this.caseId = await backend.resolveHandoverCaseId(this.roomId);
                this.chain = await backend.getHandoverChain(this.caseId);
            } catch (e) {
                console.warn('[handover] 인계 체인 로딩 실패:', e);
                this.chain = [];
            }
        },
        selectedArtifacts() {
            const keys = new Set(this.selectedArtifactKeys);
            return this.artifactCandidates.filter((a, i) => keys.has(this.artifactKey(a, i)));
        },
        async requestSuggestion() {
            this.isSuggesting = true;
            this.suggestError = '';
            try {
                const artifacts = this.selectedArtifacts().map((a) => ({
                    type: a.type,
                    name: a.name || a.ref || '',
                    // 본문은 프롬프트 크기를 위해 잘라서 보낸다.
                    excerpt: (a.content || '').toString().slice(0, 2000)
                }));
                const response = await axios.post('/completion/handover-suggest', {
                    tenant_id: window.$tenantName,
                    room_id: this.roomId,
                    artifacts,
                    recent_messages: (this.recentMessages || []).slice(-10).map((m) => ({
                        role: m.role || 'user',
                        content: (m.content || '').toString().slice(0, 2000)
                    }))
                });
                const data = response?.data || {};
                if (data.doneLabel && !this.doneLabel) this.doneLabel = data.doneLabel;
                if (data.nextActivityLabel) this.nextActivityLabel = data.nextActivityLabel;
                if (data.instruction) this.instruction = data.instruction;
                // 후보 담당자가 있으면 피커 목록에서 찾아 선택해 준다(사람/에이전트 구분 없음).
                // 자격 보유자를 함께 표시해 왜 이 사람이 후보인지 드러낸다.
                const candidates = Array.isArray(data.candidateAssignees) ? data.candidateAssignees : [];
                if (data.nextActivityLabel) await this.loadEligibility(data.nextActivityLabel);
                if (!this.selectedUser && candidates.length > 0) {
                    const first = candidates[0];
                    const matched = this.userList.find((u) => u.id === first.id || (first.email && u.email === first.email));
                    if (matched) this.selectedUser = matched;
                }
            } catch (e) {
                this.suggestError = e?.response?.data?.detail || e?.message || this.$t('Handover.suggestFailed');
            } finally {
                this.isSuggesting = false;
            }
        },
        submit() {
            if (this.validationMessage) return;
            const u = this.selectedUser;
            this.$emit('submit', {
                fromRoomId: this.roomId,
                caseId: this.caseId,
                toUser: {
                    id: u.id,
                    name: this.displayName(u),
                    email: u.email,
                    isAgent: !!u.is_agent,
                    agentOrch: this.defaultOrchestration || 'deepagents',
                    agentMode: 'COMPLETE',
                    role: u.role || null
                },
                doneLabel: this.doneLabel?.trim() || null,
                nextActivityLabel: this.nextActivityLabel.trim(),
                instruction: this.instruction?.trim() || null,
                reason: this.reason?.trim() || null,
                dueDate: this.dueDate || null,
                artifacts: this.selectedArtifacts(),
                carryAgents: this.carryAgents,
                sourceRoom: this.sourceRoom
            });
        }
    }
};
</script>

<style scoped>
.assignee-list {
    max-height: 260px;
    overflow-y: auto;
}
.selected-assignee {
    background: rgba(var(--v-theme-primary), 0.06);
}
.handover-dialog__body {
    max-height: calc(100vh - 220px);
    overflow-y: auto;
}
</style>
