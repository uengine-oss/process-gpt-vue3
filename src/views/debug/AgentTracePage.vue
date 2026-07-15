<template>
    <!-- 레이아웃 없는 독립 전체화면 트레이스 디버거. 주소: /agent-trace -->
    <div class="atp-root">
        <!-- ── 상단바 ── -->
        <div class="atp-topbar">
            <span class="atp-logo">에이전트 디버그</span>
            <div class="atp-breadcrumb">
                <template v-if="selectedRoomId">
                    <v-icon size="15" class="mr-1">mdi-forum-outline</v-icon>
                    <span class="atp-bc-room">{{ currentRoomName }}</span>
                    <template v-if="turnDetail.runId">
                        <v-icon size="14" class="mx-1">mdi-chevron-right</v-icon>
                        <span class="atp-bc-turn">{{ statusIcon2(turnDetail.status) }} {{ (turnDetail.userMessage || '').slice(0, 60) }}</span>
                    </template>
                </template>
                <span v-else class="text-medium-emphasis">채팅방을 선택하세요</span>
            </div>
            <v-spacer />
            <v-tooltip text="선택 턴 자동 새로고침(4s)" location="bottom">
                <template #activator="{ props }">
                    <v-btn v-bind="props" size="small" variant="text" :color="autoRefresh ? 'primary' : ''" :icon="autoRefresh ? 'mdi-autorenew' : 'mdi-autorenew-off'" @click="toggleAuto" />
                </template>
            </v-tooltip>
            <v-btn size="small" variant="text" :prepend-icon="rawMode ? 'mdi-format-list-bulleted' : 'mdi-code-json'" :disabled="!selectedRunId" @click="rawMode = !rawMode">{{ rawMode ? '트리' : 'Raw' }}</v-btn>
            <v-btn size="small" variant="text" prepend-icon="mdi-refresh" :loading="loadingRooms || loadingEvents" @click="refreshAll">새로고침</v-btn>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="ma-2">{{ error }}</v-alert>

        <!-- ── 3-pane ── -->
        <div class="atp-main">
            <!-- 좌: 턴 레일 -->
            <div class="atp-rail" :style="{ width: railWidth + 'px' }">
                <!-- ① 채팅방 목록 (방 미선택) -->
                <template v-if="!selectedRoomId">
                    <div class="atp-rail-head">
                        <span>채팅방 ({{ filteredRooms.length }})</span>
                        <v-spacer />
                        <v-btn size="x-small" variant="text" icon :loading="loadingRooms" @click="refreshAll"><v-icon size="16">mdi-refresh</v-icon></v-btn>
                    </div>
                    <input v-model="roomSearch" class="atp-roomsearch" placeholder="채팅방 검색" />
                    <div v-if="!filteredRooms.length" class="atp-empty">{{ loadingRooms ? '불러오는 중…' : '트레이스 있는 방 없음' }}</div>
                    <div
                        v-for="room in filteredRooms"
                        :key="room.conversation_id"
                        class="atp-room"
                        @click="onSelectRoom(room.conversation_id)"
                    >
                        <div class="atp-room-top">
                            <v-icon size="16" :color="room.fbDown ? 'error' : room.errorCount ? 'warning' : 'primary'">
                                {{ room.fbDown ? 'mdi-comment-alert-outline' : 'mdi-forum-outline' }}
                            </v-icon>
                            <span class="atp-room-name">{{ room.name }}</span>
                            <span v-if="room.fbDown" class="atp-fb-badge">👎{{ room.fbDown }}</span>
                            <span v-if="room.fbUp" class="atp-fb-badge">👍{{ room.fbUp }}</span>
                        </div>
                        <div class="atp-room-sub">
                            턴 {{ room.turnCount }}
                            <span v-if="room.errorCount" class="text-error"> · 에러 {{ room.errorCount }}</span>
                            · {{ formatRel(room.lastTs) }}
                        </div>
                    </div>
                </template>

                <!-- ② 선택한 방의 턴 목록 -->
                <template v-else>
                    <div class="atp-rail-head">
                        <button class="atp-back" title="채팅방 목록" @click="backToRooms"><v-icon size="16">mdi-arrow-left</v-icon></button>
                        <span class="atp-rail-room" :title="currentRoomName">{{ currentRoomName }}</span>
                        <v-spacer />
                        <button
                            v-if="feedbackCount"
                            class="atp-fbtoggle"
                            :class="{ 'is-on': onlyFeedback }"
                            title="피드백 있는 턴만 보기"
                            @click="onlyFeedback = !onlyFeedback"
                        >
                            💬 {{ feedbackCount }}
                        </button>
                    </div>
                    <div v-if="!railTurns.length" class="atp-empty">{{ onlyFeedback ? '피드백 있는 턴 없음' : '기록된 턴 없음' }}</div>
                    <div
                        v-for="t in railTurns"
                        :key="t.runId"
                        class="atp-turn"
                        :class="{ 'is-active': selectedRunId === t.runId }"
                        @click="onTurnChange(t.runId)"
                    >
                        <div class="atp-turn-top">
                            <v-icon size="15" :color="statusColor(t.status)">{{ statusIcon(t.status) }}</v-icon>
                            <span class="atp-turn-msg">{{ t.userMessage || '(빈 메시지)' }}</span>
                            <span v-if="t.feedback" class="atp-fb-badge">{{ t.feedback.rating === -1 ? '👎' : '👍' }}</span>
                        </div>
                        <div class="atp-turn-sub">
                            <span v-if="t.userName || t.userEmail" class="atp-turn-user">{{ t.userName || t.userEmail }} · </span>
                            {{ formatRel(t.startTs) }}
                            <span v-if="t.totalTokens"> · {{ shortNum(t.totalTokens) }} tok</span>
                            <span v-if="t.durationMs"> · {{ formatDur(t.durationMs) }}</span>
                        </div>
                    </div>
                </template>
            </div>
            <div class="atp-split" @mousedown.prevent="startRailResize"></div>

            <!-- 중: 타임라인 -->
            <div class="atp-center">
                <div v-if="!selectedRunId" class="atp-placeholder">
                    <v-icon size="44" color="grey-lighten-1">mdi-timeline-text-outline</v-icon>
                    <div class="mt-2">왼쪽에서 턴을 선택하세요.</div>
                </div>
                <template v-else>
                    <!-- run 헤더 -->
                    <div class="atp-runhead">
                        <v-chip v-if="turnDetail.userName || turnDetail.userEmail || turnDetail.userUid" size="small" variant="tonal" color="blue-grey" :title="turnDetail.userEmail || turnDetail.userUid"><v-icon start size="14">mdi-account-outline</v-icon>{{ turnDetail.userName || turnDetail.userEmail || turnDetail.userUid }}</v-chip>
                        <v-chip size="small" :color="statusColor(turnDetail.status)" variant="tonal"><v-icon start size="14">{{ statusIcon(turnDetail.status) }}</v-icon>{{ turnDetail.status || 'running' }}</v-chip>
                        <v-chip v-if="turnDetail.durationMs" size="small" variant="text">{{ formatDur(turnDetail.durationMs) }}</v-chip>
                        <v-chip v-if="turnDetail.totalTokens" size="small" variant="text">{{ turnDetail.totalTokens.toLocaleString() }} tok</v-chip>
                        <v-chip v-if="turnDetail.model" size="small" variant="text">{{ turnDetail.model }}</v-chip>
                        <v-chip v-for="a in agentTokens" :key="a.agent" size="x-small" variant="tonal" :color="a.heavy ? 'deep-orange' : 'grey'">{{ a.agent }} {{ shortNum(a.tokens) }}</v-chip>
                    </div>
                    <!-- 사용자 피드백 배너 (이 답변에 달린 👍/👎 + 코멘트) -->
                    <div v-if="turnDetail.feedback" class="atp-fb-banner" :class="turnDetail.feedback.rating === -1 ? 'is-down' : 'is-up'">
                        <span class="atp-fb-ic">{{ turnDetail.feedback.rating === -1 ? '👎' : '👍' }}</span>
                        <span v-if="turnDetail.feedback.category" class="atp-fb-cat">[{{ fbCategoryLabel(turnDetail.feedback.category) }}]</span>
                        <span class="atp-fb-cmt">{{ turnDetail.feedback.comment || '(코멘트 없음)' }}</span>
                        <span v-if="turnDetail.feedback.user_name" class="atp-fb-user">— {{ turnDetail.feedback.user_name }}</span>
                    </div>
                    <!-- 필터바 -->
                    <div class="atp-filter">
                        <v-text-field
                            ref="searchField"
                            v-model="searchText"
                            density="compact"
                            variant="outlined"
                            hide-details
                            placeholder="검색 ( / )"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            class="atp-search"
                        />
                        <button class="atp-kind" :class="{ 'is-on': kindFilter === 'all' }" @click="kindFilter = 'all'">전체 {{ allNodes.length }}</button>
                        <button class="atp-kind" :class="{ 'is-on': kindFilter === 'llm' }" @click="kindFilter = 'llm'">LLM {{ counts.llm }}</button>
                        <button class="atp-kind" :class="{ 'is-on': kindFilter === 'tool' }" @click="kindFilter = 'tool'">도구 {{ counts.tool }}</button>
                        <button v-if="counts.error" class="atp-kind is-err" :class="{ 'is-on': kindFilter === 'error' }" @click="kindFilter = 'error'">에러 {{ counts.error }}</button>
                        <button v-if="counts.empty" class="atp-kind is-warn" :class="{ 'is-on': kindFilter === 'empty' }" @click="kindFilter = 'empty'">빈응답 {{ counts.empty }}</button>
                        <v-spacer />
                        <v-btn v-if="!filterActive" size="x-small" variant="text" icon :title="allCollapsed ? '전체 펼치기' : '전체 접기'" @click="allCollapsed ? expandAll() : collapseAll()">
                            <v-icon size="18">{{ allCollapsed ? 'mdi-unfold-more-horizontal' : 'mdi-unfold-less-horizontal' }}</v-icon>
                        </v-btn>
                    </div>
                    <!-- 트리 -->
                    <div class="atp-timeline">
                        <div v-if="loadingEvents" class="atp-empty"><v-progress-circular indeterminate size="20" /></div>
                        <div v-else-if="!displayRows.length" class="atp-empty">{{ filterActive ? '검색 결과 없음' : '실행 이벤트 없음' }}</div>
                        <div
                            v-for="row in displayRows"
                            :key="row.node.key"
                            :data-key="row.node.key"
                            class="atp-node"
                            :class="{ 'is-error': row.node.error, 'is-active': selectedSpanKey === row.node.key }"
                            @click="selectSpan(row.node.key)"
                        >
                            <template v-if="!filterActive">
                                <span v-for="g in row.node.depth" :key="g" class="atp-guide"></span>
                                <span class="atp-caret" @click.stop="row.node.children.length && toggleCollapse(row.node.key)">
                                    <v-icon v-if="row.node.children.length" size="16">{{ collapsed.has(row.node.key) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
                                    <span v-else class="atp-dot"></span>
                                </span>
                            </template>
                            <span v-else class="atp-depth">d{{ row.node.depth }}</span>

                            <v-icon size="15" :color="kindMeta(row.node).color" class="atp-nicon">{{ kindMeta(row.node).icon }}</v-icon>
                            <span class="atp-ntitle" v-html="hl(row.node.title)"></span>
                            <span v-if="row.node.children.length && !filterActive" class="atp-ccount">{{ row.node.children.length }}</span>
                            <span v-if="row.node.toolCallNames && row.node.toolCallNames.length" class="atp-tcalls">→ {{ row.node.toolCallNames.join(', ') }}</span>
                            <v-chip v-if="row.node.agent" size="x-small" variant="tonal" class="atp-agent">{{ row.node.agent }}</v-chip>
                            <span class="atp-meta">
                                <span v-if="row.node.durationMs != null" class="atp-bar"><span class="atp-bar-fill" :class="durationClass(row.node.durationMs)" :style="{ width: barPct(row.node.durationMs) }"></span></span>
                                <span v-if="row.node.durationMs != null" class="atp-dur" :class="durationClass(row.node.durationMs)">{{ formatDur(row.node.durationMs) }}</span>
                                <span v-if="row.node.tokens" class="atp-tok">{{ shortNum(row.node.tokens) }}</span>
                            </span>
                        </div>
                    </div>
                </template>
            </div>
            <div v-if="selectedRunId" class="atp-split" @mousedown.prevent="startDetailResize"></div>

            <!-- 우: 상세 -->
            <div v-if="selectedRunId" class="atp-detail" :style="{ width: detailWidth + 'px' }">
                <div v-if="rawMode" class="atp-dbody"><pre class="atp-pre">{{ rawJson }}</pre></div>

                <div v-else-if="!selectedSpan" class="atp-dbody">
                    <div class="atp-dhead"><v-icon size="18" class="mr-1">mdi-information-outline</v-icon>턴 개요</div>
                    <!-- 누가 이 턴을 보냈는지 -->
                    <div v-if="turnDetail.userName || turnDetail.userEmail || turnDetail.userUid" class="atp-user">
                        <v-icon size="15" class="mr-1">mdi-account-circle-outline</v-icon>
                        <span class="atp-user-name">{{ turnDetail.userName || turnDetail.userEmail || turnDetail.userUid }}</span>
                        <span v-if="turnDetail.userEmail && turnDetail.userEmail !== turnDetail.userName" class="atp-user-sub">{{ turnDetail.userEmail }}</span>
                        <span v-if="turnDetail.userUid" class="atp-user-uid" :title="turnDetail.userUid">{{ turnDetail.userUid }}</span>
                    </div>
                    <div class="atp-label mt-2">사용자 메시지</div>
                    <pre class="atp-pre">{{ turnDetail.userMessage || '(없음)' }}</pre>
                    <!-- 이 턴에 선택된 지식베이스 폴더/파일 + 채팅 첨부 -->
                    <template v-if="(turnDetail.metaFolders && turnDetail.metaFolders.length) || (turnDetail.metaDocs && turnDetail.metaDocs.length) || (turnDetail.metaFiles && turnDetail.metaFiles.length)">
                        <div class="atp-label mt-3">선택 지식베이스</div>
                        <ul v-if="turnDetail.metaFolders && turnDetail.metaFolders.length" class="atp-kb-list">
                            <li v-for="(f, i) in turnDetail.metaFolders" :key="'fd' + i">
                                <v-icon size="14" color="amber-darken-2" class="mr-1">mdi-folder-outline</v-icon>{{ f }}
                            </li>
                        </ul>
                        <ul v-if="turnDetail.metaDocs && turnDetail.metaDocs.length" class="atp-kb-list">
                            <li v-for="(d, i) in turnDetail.metaDocs" :key="'dc' + i" class="atp-kb-doc">
                                <v-icon size="14" :color="mimeIconOf(d.fileName).color" class="mr-1">{{ mimeIconOf(d.fileName).icon }}</v-icon>
                                <span class="atp-kb-fname" :title="d.folderPath ? d.folderPath + '/' + d.fileName : d.fileName">{{ d.fileName }}</span>
                                <span v-if="d.folderPath" class="atp-kb-fpath">{{ d.folderPath }}</span>
                                <v-btn
                                    v-if="d.id"
                                    class="atp-kb-dl"
                                    size="x-small"
                                    variant="text"
                                    icon
                                    :loading="downloadingIds.has(d.id)"
                                    title="다운로드"
                                    @click="downloadKnowledgeDoc(d)"
                                ><v-icon size="15">mdi-download-outline</v-icon></v-btn>
                            </li>
                        </ul>
                        <template v-if="turnDetail.metaFiles && turnDetail.metaFiles.length">
                            <div class="text-caption text-medium-emphasis mt-2 mb-1">채팅 첨부 {{ turnDetail.metaFiles.length }}개</div>
                            <ul class="atp-kb-list">
                                <li v-for="(n, i) in turnDetail.metaFiles" :key="'af' + i" class="atp-kb-doc">
                                    <v-icon size="14" :color="mimeIconOf(n).color" class="mr-1">{{ mimeIconOf(n).icon }}</v-icon>
                                    <span class="atp-kb-fname" :title="n">{{ n }}</span>
                                </li>
                            </ul>
                        </template>
                    </template>
                    <template v-if="turnDetail.finalAnswer">
                        <div class="atp-label mt-3">최종 답변</div>
                        <pre class="atp-pre atp-answer">{{ turnDetail.finalAnswer }}</pre>
                    </template>
                    <template v-if="turnDetail.error">
                        <div class="atp-label mt-3 text-error">에러</div>
                        <pre class="atp-pre atp-err">{{ turnDetail.error }}</pre>
                    </template>
                    <div class="atp-hint mt-4">← 타임라인 노드를 클릭(또는 ↑/↓)하면 그 단계의 프롬프트·응답·도구 입출력이 여기 표시됩니다.</div>
                </div>

                <div v-else class="atp-dbody">
                    <div class="atp-dhead">
                        <v-icon size="18" :color="kindMeta(selectedSpan).color" class="mr-1">{{ kindMeta(selectedSpan).icon }}</v-icon>
                        <span v-html="hl(selectedSpan.title)"></span>
                        <v-chip v-if="selectedSpan.agent" size="x-small" variant="tonal" class="ml-2">{{ selectedSpan.agent }}</v-chip>
                        <v-chip v-if="selectedSpan.durationMs != null" size="x-small" variant="text" :class="durationClass(selectedSpan.durationMs)">{{ formatDur(selectedSpan.durationMs) }}</v-chip>
                        <v-chip v-if="selectedSpan.tokens" size="x-small" variant="text">{{ selectedSpan.tokens.toLocaleString() }} tok</v-chip>
                        <v-spacer />
                        <v-btn size="x-small" variant="text" icon @click="selectedSpanKey = ''"><v-icon size="18">mdi-close</v-icon></v-btn>
                    </div>

                    <template v-if="selectedSpan.kind === 'llm_call'">
                        <div class="atp-label mt-1">model: {{ selectedSpan.payload.model_name || '-' }} · finish: {{ selectedSpan.payload.finish_reason || '-' }}</div>
                        <template v-if="selectedSpan.payload.tool_calls">
                            <div class="atp-label mt-3">tool_calls (라우팅/도구 호출)</div>
                            <pre class="atp-pre" v-html="hl(pretty(selectedSpan.payload.tool_calls))"></pre>
                        </template>
                        <div class="atp-label mt-3">system prompt</div>
                        <pre class="atp-pre" v-html="hl(selectedSpan.payload.system_prompt || '(없음)')"></pre>
                        <div class="atp-label mt-3">user prompt</div>
                        <pre class="atp-pre" v-html="hl(selectedSpan.payload.user_prompt || '(없음)')"></pre>
                        <div class="atp-label mt-3">응답 (raw_response)</div>
                        <pre class="atp-pre atp-answer" v-html="hl(selectedSpan.payload.raw_response || '(텍스트 응답 없음 — 위 tool_calls 참고)')"></pre>
                        <details class="mt-3"><summary class="atp-label">messages (전체 컨텍스트)</summary><pre class="atp-pre" v-html="hl(pretty(selectedSpan.payload.messages))"></pre></details>
                    </template>
                    <template v-else-if="selectedSpan.kind === 'tool'">
                        <div class="atp-label mt-3">input (args)</div>
                        <pre class="atp-pre" v-html="hl(pretty(selectedSpan.input))"></pre>
                        <div class="atp-label mt-3">output</div>
                        <pre class="atp-pre" :class="{ 'atp-err': selectedSpan.error }" v-html="hl(selectedSpan.output || '(진행 중 / 출력 없음)')"></pre>
                    </template>
                    <template v-else>
                        <pre class="atp-pre" v-html="hl(pretty(selectedSpan.payload))"></pre>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';
import { mimeIcon } from '@/utils/fileIcon';

// 파일명 확장자 → mime (fileIcon.mimeIcon 이 mime 를 받으므로 매핑). KnowledgeFilesTab 과 동일.
function extToMime(name) {
    const ext = (name || '').split('.').pop()?.toLowerCase() || '';
    const map = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        hwp: 'application/x-hwp',
        hwpx: 'application/vnd.hancom.hwpx',
        md: 'text/markdown',
        txt: 'text/plain',
    };
    return map[ext] || '';
}

export default {
    name: 'AgentTracePage',
    data() {
        return {
            tenantId: window.$tenantName || localStorage.getItem('tenantId') || 'process-gpt',
            rooms: [],
            roomSearch: '',
            loadingRooms: false,
            selectedRoomId: '',
            turns: [],
            selectedRunId: '',
            events: [],
            loadingEvents: false,
            error: '',
            collapsed: new Set(),
            selectedSpanKey: '',
            rawMode: false,
            searchText: '',
            kindFilter: 'all',
            autoRefresh: false,
            _autoTimer: null,
            _runMarkers: [],
            feedbackByTarget: {}, // chat_feedback: target_uuid(=답변 response_uuid) → {rating,category,comment,user_name}
            onlyFeedback: false,
            downloadingIds: new Set(), // 다운로드 URL 조회 중인 knowledge_doc id
            // 리사이즈
            railWidth: Number(localStorage.getItem('att_railW')) || 260,
            detailWidth: Number(localStorage.getItem('att_detailW')) || 560,
            _rz: null,
            _restoring: false
        };
    },
    computed: {
        sb() {
            return window.$supabase;
        },
        filteredRooms() {
            const q = (this.roomSearch || '').toLowerCase().trim();
            if (!q) return this.rooms;
            return this.rooms.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.conversation_id || '').toLowerCase().includes(q));
        },
        railTurns() {
            return this.onlyFeedback ? this.turns.filter((t) => t.feedback) : this.turns;
        },
        feedbackCount() {
            return this.turns.filter((t) => t.feedback).length;
        },
        currentRoomName() {
            const r = this.rooms.find((x) => x.conversation_id === this.selectedRoomId);
            return r ? r.name : this.selectedRoomId;
        },
        turnDetail() {
            const t = this.turns.find((x) => x.runId === this.selectedRunId);
            if (!t) return {};
            const meta = t.meta || {};
            // 채팅 첨부(업로드 파일) — run_start 에는 이름만 저장됨(다운로드 URL 없음)
            const metaFiles = (meta.selected_files || []).filter((n) => typeof n === 'string' && n.trim());
            // 이 턴에 선택된 지식베이스 — 폴더(폴더째 선택) + 개별 파일(다운로드 가능)
            const metaFolders = Array.isArray(meta.knowledge_folders)
                ? meta.knowledge_folders.filter((p) => typeof p === 'string' && p.trim())
                : [];
            const metaDocs = (Array.isArray(meta.knowledge_docs) ? meta.knowledge_docs : [])
                .filter((d) => d && typeof d === 'object')
                .map((d) => ({
                    id: d.id || d.source_ref || '',
                    sourceType: d.source_type || 'drive',
                    fileName: d.file_name || d.name || d.id || '(이름 없음)',
                    folderPath: d.folder_path || '',
                }));
            return { ...t, metaFiles, metaFolders, metaDocs };
        },
        tree() {
            return this.buildTree(this.events);
        },
        allNodes() {
            const out = [];
            const walk = (ns) => ns.forEach((n) => { out.push(n); if (n.children.length) walk(n.children); });
            walk(this.tree);
            return out;
        },
        treeRows() {
            const out = [];
            const walk = (ns) => ns.forEach((node) => { out.push({ node }); if (node.children.length && !this.collapsed.has(node.key)) walk(node.children); });
            walk(this.tree);
            return out;
        },
        filterActive() {
            return (this.searchText || '').trim() !== '' || this.kindFilter !== 'all';
        },
        filteredRows() {
            const q = (this.searchText || '').toLowerCase().trim();
            return this.allNodes.filter((n) => this.kindPred(n) && (!q || (n._search || '').includes(q))).map((node) => ({ node }));
        },
        displayRows() {
            return this.filterActive ? this.filteredRows : this.treeRows;
        },
        selectedSpan() {
            if (!this.selectedSpanKey) return null;
            return this.allNodes.find((n) => n.key === this.selectedSpanKey) || null;
        },
        counts() {
            const n = this.allNodes;
            return {
                llm: n.filter((x) => x.kind === 'llm_call').length,
                tool: n.filter((x) => x.kind === 'tool').length,
                error: n.filter((x) => x.error).length,
                empty: n.filter((x) => x.isEmptyLlm).length
            };
        },
        maxDur() {
            return this.allNodes.reduce((m, n) => (n.durationMs > m ? n.durationMs : m), 0);
        },
        parentKeys() {
            return this.allNodes.filter((n) => n.children.length).map((n) => n.key);
        },
        allCollapsed() {
            return this.parentKeys.length > 0 && this.parentKeys.every((k) => this.collapsed.has(k));
        },
        agentTokens() {
            const by = {};
            for (const ev of this.events) {
                if (ev.kind !== 'llm_call') continue;
                by[ev.agent || 'unknown'] = (by[ev.agent || 'unknown'] || 0) + Number((ev.payload || {}).total_tokens || 0);
            }
            const arr = Object.entries(by).map(([agent, tokens]) => ({ agent, tokens })).filter((x) => x.tokens > 0).sort((a, b) => b.tokens - a.tokens);
            const max = arr.length ? arr[0].tokens : 0;
            arr.forEach((x) => (x.heavy = max > 0 && x.tokens >= max * 0.5));
            return arr;
        },
        rawJson() {
            return this.pretty(this.events);
        }
    },
    created() {
        this.init();
    },
    mounted() {
        window.addEventListener('keydown', this.onKey);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKey);
        this.stopAuto();
        this.cleanupResize();
    },
    methods: {
        async init() {
            await this.fetchRooms();
            // URL 딥링크 복원
            const { room, run } = this.$route.query;
            if (room && this.rooms.some((r) => r.conversation_id === room)) {
                this._restoring = true;
                this.selectedRoomId = String(room);
                this.buildTurns(this.selectedRoomId);
                if (run && this.turns.some((t) => t.runId === run)) {
                    this.selectedRunId = String(run);
                    await this.loadEvents(this.selectedRunId);
                }
                this._restoring = false;
            }
        },
        async ensureSb(tries = 20) {
            for (let i = 0; i < tries; i++) {
                if (window.$supabase) return true;
                await new Promise((r) => setTimeout(r, 150));
            }
            return !!window.$supabase;
        },
        async fetchRooms() {
            if (!(await this.ensureSb())) {
                this.error = 'Supabase 클라이언트가 준비되지 않았습니다. 새로고침해 주세요.';
                return;
            }
            this.loadingRooms = true;
            this.error = '';
            try {
                const { data: markers, error: mErr } = await this.sb
                    .from('agent_trace')
                    .select('id,run_id,conversation_id,ts,kind,payload')
                    .eq('tenant_id', this.tenantId)
                    .in('kind', ['run_start', 'run_end'])
                    .order('ts', { ascending: false })
                    .limit(3000);
                if (mErr) throw mErr;
                this._runMarkers = markers || [];

                // 사용자 피드백 로드 (답변 response_uuid ↔ chat_feedback.target_uuid)
                this.feedbackByTarget = {};
                try {
                    const { data: fb } = await this.sb
                        .from('chat_feedback')
                        .select('target_uuid,rating,category,comment,user_name,created_at')
                        .eq('tenant_id', this.tenantId)
                        .order('created_at', { ascending: false })
                        .limit(3000);
                    (fb || []).forEach((f) => {
                        if (!this.feedbackByTarget[f.target_uuid]) this.feedbackByTarget[f.target_uuid] = f;
                    });
                } catch (e) {
                    /* 피드백 조회 실패해도 트레이스는 보여줌 — 무해 */
                }

                const convIds = [...new Set(this._runMarkers.map((m) => m.conversation_id).filter(Boolean))];
                const roomMeta = {};
                if (convIds.length) {
                    const { data: cr } = await this.sb.from('chat_rooms').select('id,name,updated_at').in('id', convIds.slice(0, 300));
                    (cr || []).forEach((r) => { roomMeta[r.id] = r; });
                }
                const byRoom = {};
                for (const m of this._runMarkers) {
                    const cid = m.conversation_id;
                    if (!cid) continue;
                    if (!byRoom[cid]) byRoom[cid] = { conversation_id: cid, turnCount: 0, errorCount: 0, fbDown: 0, fbUp: 0, lastTs: m.ts };
                    const b = byRoom[cid];
                    if (m.ts > b.lastTs) b.lastTs = m.ts;
                    if (m.kind === 'run_start') {
                        b.turnCount += 1;
                        const fb = this.feedbackByTarget[(m.payload || {}).response_uuid];
                        if (fb) fb.rating === -1 ? (b.fbDown += 1) : (b.fbUp += 1);
                    }
                    if (m.kind === 'run_end' && (m.payload || {}).status === 'error') b.errorCount += 1;
                }
                const rooms = Object.values(byRoom).map((b) => {
                    const meta = roomMeta[b.conversation_id] || {};
                    return { ...b, name: meta.name || b.conversation_id, updatedAt: meta.updated_at || b.lastTs };
                });
                rooms.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
                this.rooms = rooms;
                if (this.selectedRoomId && byRoom[this.selectedRoomId]) this.buildTurns(this.selectedRoomId);
            } catch (e) {
                this.error = '트레이스 조회 실패: ' + (e.message || e);
            } finally {
                this.loadingRooms = false;
            }
        },
        refreshAll() {
            if (this.selectedRunId) this.loadEvents(this.selectedRunId);
            this.fetchRooms();
        },
        onSelectRoom(cid) {
            this.selectedRoomId = cid;
            this.selectedRunId = '';
            this.events = [];
            this.selectedSpanKey = '';
            this.onlyFeedback = false;
            if (cid) this.buildTurns(cid);
            else this.turns = [];
            this.syncUrl();
        },
        backToRooms() {
            this.selectedRoomId = '';
            this.selectedRunId = '';
            this.events = [];
            this.selectedSpanKey = '';
            this.turns = [];
            this.onlyFeedback = false;
            this.syncUrl();
        },
        buildTurns(convId) {
            const starts = this._runMarkers.filter((m) => m.conversation_id === convId && m.kind === 'run_start');
            const ends = {};
            this._runMarkers.filter((m) => m.conversation_id === convId && m.kind === 'run_end').forEach((m) => { ends[m.run_id] = m; });
            const turns = starts.map((s) => {
                const sp = s.payload || {};
                const e = ends[s.run_id];
                const ep = (e && e.payload) || {};
                return {
                    runId: s.run_id,
                    startTs: s.ts,
                    userMessage: sp.user_message || '',
                    userName: sp.user_name || '',
                    userEmail: sp.user_email || '',
                    userUid: sp.user_uid || '',
                    model: sp.model || '',
                    profile: sp.profile || '',
                    meta: sp.meta || {},
                    responseUuid: sp.response_uuid || '',
                    feedback: this.feedbackByTarget[sp.response_uuid] || null,
                    status: ep.status || 'running',
                    finalAnswer: ep.final_answer || '',
                    error: ep.error || '',
                    totalTokens: ep.total_tokens || null,
                    durationMs: e ? new Date(e.ts).getTime() - new Date(s.ts).getTime() : null
                };
            });
            turns.sort((a, b) => String(b.startTs).localeCompare(String(a.startTs)));
            this.turns = turns;
        },
        onTurnChange(runId) {
            this.selectedRunId = runId;
            this.selectedSpanKey = '';
            this.searchText = '';
            this.kindFilter = 'all';
            this.rawMode = false;
            if (runId) this.loadEvents(runId);
            else this.events = [];
            this.syncUrl();
        },
        async loadEvents(runId) {
            if (!this.sb) return;
            this.loadingEvents = true;
            try {
                const { data, error } = await this.sb.from('agent_trace').select('*').eq('run_id', runId).order('seq', { ascending: true });
                if (error) throw error;
                this.events = data || [];
                const def = new Set();
                (this.events || []).forEach((ev) => { if (ev.kind === 'tool_start' && ev.tool === 'task') def.add('n' + ev.id); });
                this.collapsed = def;
                this.selectedSpanKey = '';
            } catch (e) {
                this.error = '이벤트 조회 실패: ' + (e.message || e);
            } finally {
                this.loadingEvents = false;
            }
        },
        syncUrl() {
            if (this._restoring) return;
            const q = {};
            if (this.selectedRoomId) q.room = this.selectedRoomId;
            if (this.selectedRunId) q.run = this.selectedRunId;
            this.$router.replace({ query: q }).catch(() => {});
        },
        buildTree(events) {
            const root = [];
            const stack = [];
            const push = (node) => (stack.length ? stack[stack.length - 1].children : root).push(node);
            const tcNames = (tcs) => (Array.isArray(tcs) ? tcs : []).map((tc) => (tc && (tc.name || (tc.function && tc.function.name))) || '?').filter(Boolean);
            for (const ev of events) {
                const k = ev.kind;
                if (k === 'run_start' || k === 'run_end') continue;
                const p = ev.payload || {};
                if (k === 'tool_start') {
                    const node = { key: 'n' + ev.id, kind: 'tool', depth: stack.length, title: ev.title || ev.tool || 'tool', agent: ev.agent, tool: ev.tool, input: p.input, output: '', startTs: ev.ts, tokens: null, durationMs: null, error: false, isEmptyLlm: false, children: [] };
                    node._search = [node.title, node.agent, node.tool, this.pretty(node.input)].join(' ').toLowerCase();
                    push(node);
                    stack.push(node);
                } else if (k === 'tool_end') {
                    if (stack.length) {
                        const node = stack.pop();
                        node.output = p.output || '';
                        node.durationMs = node.startTs && ev.ts ? new Date(ev.ts).getTime() - new Date(node.startTs).getTime() : ev.duration_ms;
                        node.error = ev.success === false;
                        node._search += ' ' + String(node.output).toLowerCase();
                    } else {
                        const node = { key: 'n' + ev.id, kind: 'tool', depth: 0, title: ev.title || ev.tool || 'tool_end', agent: ev.agent, tool: ev.tool, input: null, output: p.output || '', durationMs: ev.duration_ms, error: ev.success === false, tokens: null, isEmptyLlm: false, children: [] };
                        node._search = [node.title, node.agent, node.tool, String(node.output)].join(' ').toLowerCase();
                        push(node);
                    }
                } else {
                    const tcn = k === 'llm_call' ? tcNames(p.tool_calls) : [];
                    const hasResp = k === 'llm_call' && !!(p.raw_response && String(p.raw_response).trim());
                    const node = { key: 'n' + ev.id, kind: k, depth: stack.length, title: ev.title || k, agent: ev.agent, payload: p, toolCallNames: tcn, tokens: k === 'llm_call' ? p.total_tokens || null : null, durationMs: ev.duration_ms, error: ev.success === false, isEmptyLlm: k === 'llm_call' && !hasResp && tcn.length === 0, children: [] };
                    node._search = [node.title, node.agent, k === 'llm_call' ? p.system_prompt : '', k === 'llm_call' ? p.user_prompt : '', k === 'llm_call' ? p.raw_response : '', this.pretty(k === 'llm_call' ? p.tool_calls : p)].filter(Boolean).join(' ').toLowerCase();
                    push(node);
                }
            }
            return root;
        },
        kindPred(n) {
            switch (this.kindFilter) {
                case 'llm': return n.kind === 'llm_call';
                case 'tool': return n.kind === 'tool';
                case 'error': return !!n.error;
                case 'empty': return !!n.isEmptyLlm;
                default: return true;
            }
        },
        selectSpan(key) {
            this.selectedSpanKey = this.selectedSpanKey === key ? '' : key;
        },
        toggleCollapse(key) {
            const s = new Set(this.collapsed);
            s.has(key) ? s.delete(key) : s.add(key);
            this.collapsed = s;
        },
        collapseAll() { this.collapsed = new Set(this.parentKeys); },
        expandAll() { this.collapsed = new Set(); },
        // ── 키보드 ──
        onKey(e) {
            const tag = (e.target && e.target.tagName || '').toLowerCase();
            const typing = tag === 'input' || tag === 'textarea';
            if (e.key === '/' && !typing) {
                e.preventDefault();
                const el = this.$el.querySelector('.atp-search input');
                el && el.focus();
                return;
            }
            if (e.key === 'Escape') {
                if (this.selectedSpanKey) this.selectedSpanKey = '';
                else if (typing && e.target) e.target.blur();
                return;
            }
            if (!this.selectedRunId || typing) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.moveSelection(e.key === 'ArrowDown' ? 1 : -1);
            }
        },
        moveSelection(dir) {
            const rows = this.displayRows;
            if (!rows.length) return;
            let idx = rows.findIndex((r) => r.node.key === this.selectedSpanKey);
            idx = idx < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, idx + dir));
            this.selectedSpanKey = rows[idx].node.key;
            this.$nextTick(() => {
                const el = this.$el.querySelector(`[data-key="${rows[idx].node.key}"]`);
                el && el.scrollIntoView({ block: 'nearest' });
            });
        },
        // ── 자동 새로고침 ──
        toggleAuto() {
            this.autoRefresh = !this.autoRefresh;
            if (this.autoRefresh) this._autoTimer = setInterval(() => { if (this.selectedRunId) this.loadEvents(this.selectedRunId); }, 4000);
            else this.stopAuto();
        },
        stopAuto() {
            if (this._autoTimer) { clearInterval(this._autoTimer); this._autoTimer = null; }
        },
        // ── 리사이즈 (ChatRoomPage 패턴) ──
        startRailResize(e) {
            this._rz = { kind: 'rail', startX: e.clientX, startW: this.railWidth };
            window.addEventListener('mousemove', this.onResizeMove);
            window.addEventListener('mouseup', this.stopResize);
        },
        startDetailResize(e) {
            this._rz = { kind: 'detail', startX: e.clientX, startW: this.detailWidth };
            window.addEventListener('mousemove', this.onResizeMove);
            window.addEventListener('mouseup', this.stopResize);
        },
        onResizeMove(e) {
            if (!this._rz) return;
            if (this._rz.kind === 'rail') {
                this.railWidth = Math.max(180, Math.min(480, this._rz.startW + (e.clientX - this._rz.startX)));
            } else {
                this.detailWidth = Math.max(320, Math.min(960, this._rz.startW + (this._rz.startX - e.clientX)));
            }
        },
        stopResize() {
            if (!this._rz) return;
            localStorage.setItem(this._rz.kind === 'rail' ? 'att_railW' : 'att_detailW', String(this._rz.kind === 'rail' ? this.railWidth : this.detailWidth));
            this.cleanupResize();
        },
        cleanupResize() {
            this._rz = null;
            window.removeEventListener('mousemove', this.onResizeMove);
            window.removeEventListener('mouseup', this.stopResize);
        },
        // ── 표시 헬퍼 ──
        barPct(ms) {
            if (!this.maxDur || ms == null) return '0%';
            return Math.max(4, Math.min(100, (ms / this.maxDur) * 100)).toFixed(0) + '%';
        },
        toolMeta(tool) {
            const m = {
                task: { icon: 'mdi-account-arrow-right-outline', color: 'indigo' },
                survey_folders: { icon: 'mdi-folder-search-outline', color: 'amber-darken-2' },
                open_folder: { icon: 'mdi-folder-open-outline', color: 'amber-darken-2' },
                grep_in_document: { icon: 'mdi-text-search', color: 'cyan-darken-1' },
                read_document_page: { icon: 'mdi-file-document-outline', color: 'teal' },
                retrieve_and_stage: { icon: 'mdi-magnify-scan', color: 'teal-darken-1' },
                retrieve_scoped: { icon: 'mdi-magnify-scan', color: 'teal-darken-1' },
                run_python: { icon: 'mdi-language-python', color: 'blue-darken-1' },
                summarize_document: { icon: 'mdi-text-box-outline', color: 'blue-grey' },
                list_documents: { icon: 'mdi-format-list-bulleted', color: 'blue-grey' },
                write_todos: { icon: 'mdi-checkbox-marked-outline', color: 'grey-darken-1' }
            };
            return m[tool] || { icon: 'mdi-tools', color: 'teal' };
        },
        kindMeta(node) {
            if (node.kind === 'llm_call') return { icon: 'mdi-brain', color: node.isEmptyLlm ? 'warning' : 'deep-purple' };
            if (node.kind === 'tool') { const tm = this.toolMeta(node.tool); return { icon: tm.icon, color: node.error ? 'error' : tm.color }; }
            if (node.kind === 'pipeline') return { icon: 'mdi-flag-outline', color: 'blue-grey' };
            if (node.error) return { icon: 'mdi-alert-circle-outline', color: 'error' };
            return { icon: 'mdi-circle-small', color: 'grey' };
        },
        durationClass(ms) {
            if (ms == null) return '';
            if (ms >= 3000) return 'is-slow';
            if (ms >= 1000) return 'is-med';
            return '';
        },
        statusColor(s) { return s === 'completed' ? 'success' : s === 'error' ? 'error' : 'warning'; },
        statusIcon(s) { return s === 'completed' ? 'mdi-check-circle-outline' : s === 'error' ? 'mdi-alert-circle-outline' : 'mdi-progress-clock'; },
        statusIcon2(s) { return s === 'completed' ? '✅' : s === 'error' ? '⛔' : '⏳'; },
        pretty(v) {
            if (v === null || v === undefined) return '(없음)';
            if (typeof v === 'string') return v;
            try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
        },
        escapeHtml(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },
        hl(text) {
            const esc = this.escapeHtml(text);
            const q = (this.searchText || '').trim();
            if (!q) return esc;
            const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return esc.replace(rx, '<mark>$1</mark>');
        },
        shortNum(n) {
            n = Number(n || 0);
            return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
        },
        fbCategoryLabel(c) {
            return { wrong: '틀린 정보', insufficient: '정보 부족', irrelevant: '엉뚱함', other: '기타' }[c] || c;
        },
        mimeIconOf(name) {
            return mimeIcon(extToMime(name));
        },
        // 지식베이스 개별 파일 다운로드 — KnowledgeFilesTab 과 동일 엔드포인트 재사용.
        async downloadKnowledgeDoc(doc) {
            if (!doc || !doc.id) return;
            const next = new Set(this.downloadingIds);
            next.add(doc.id);
            this.downloadingIds = next;
            try {
                const { data } = await axios.get('/memento/knowledge/files/url', {
                    params: {
                        tenant_id: this.tenantId,
                        source_type: doc.sourceType || 'drive',
                        source_ref: doc.id,
                        file_name: doc.fileName || '',
                    },
                });
                if (data && data.url) window.open(data.url, '_blank', 'noopener');
                else this.error = '다운로드 URL을 가져오지 못했습니다: ' + (doc.fileName || doc.id);
            } catch (e) {
                this.error = '다운로드 실패: ' + (e?.response?.data?.detail || e?.message || e);
            } finally {
                const after = new Set(this.downloadingIds);
                after.delete(doc.id);
                this.downloadingIds = after;
            }
        },
        formatRel(ts) {
            if (!ts) return '';
            const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
            if (s < 60) return '방금';
            const m = Math.floor(s / 60);
            if (m < 60) return `${m}분 전`;
            const h = Math.floor(m / 60);
            if (h < 24) return `${h}시간 전`;
            const day = Math.floor(h / 24);
            return day < 30 ? `${day}일 전` : new Date(ts).toLocaleDateString();
        },
        formatDur(ms) {
            if (ms == null) return '';
            return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
        }
    }
};
</script>

<style scoped>
.atp-root {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-on-surface));
    overflow: hidden;
}
.atp-topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.14);
    flex: 0 0 auto;
}
.atp-logo {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
}
.atp-breadcrumb {
    display: flex;
    align-items: center;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    overflow: hidden;
    white-space: nowrap;
}
.atp-bc-room { font-weight: 600; }
.atp-bc-turn { overflow: hidden; text-overflow: ellipsis; max-width: 360px; }

.atp-main {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
}
.atp-rail {
    flex: 0 0 auto;
    overflow-y: auto;
    border-right: 1px solid rgba(var(--v-border-color), 0.14);
}
.atp-rail-head {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.55);
    padding: 8px 12px 4px;
    position: sticky;
    top: 0;
    background: rgb(var(--v-theme-surface));
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 1;
}
.atp-fbtoggle {
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 10px;
    border: 1px solid rgba(var(--v-border-color), 0.3);
    cursor: pointer;
}
.atp-fbtoggle.is-on {
    background: #f9a825;
    color: #3e2723;
    border-color: #f9a825;
}
.atp-fb-badge {
    margin-left: 4px;
    font-size: 12px;
    flex: 0 0 auto;
}
.atp-fb-banner {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    margin: 0 12px 6px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12.5px;
}
.atp-fb-banner.is-down {
    background: rgba(var(--v-theme-error), 0.1);
    border: 1px solid rgba(var(--v-theme-error), 0.35);
}
.atp-fb-banner.is-up {
    background: rgba(var(--v-theme-success, 76 175 80), 0.1);
    border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}
.atp-fb-ic {
    font-size: 14px;
}
.atp-fb-cat {
    font-weight: 700;
    color: rgb(var(--v-theme-error));
}
.atp-fb-cmt {
    font-weight: 500;
}
.atp-fb-user {
    color: rgba(var(--v-theme-on-surface), 0.5);
    font-size: 11px;
}
.atp-turn {
    padding: 7px 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
}
.atp-turn:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.atp-turn.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
    border-left-color: rgb(var(--v-theme-primary));
}
.atp-turn-top { display: flex; align-items: center; gap: 5px; }
.atp-turn-msg {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.atp-turn-sub { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.5); margin-top: 2px; padding-left: 20px; }

/* 채팅방 목록 (master) */
.atp-roomsearch {
    width: calc(100% - 16px);
    margin: 2px 8px 6px;
    padding: 5px 9px;
    font-size: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.25);
    border-radius: 6px;
    background: rgba(var(--v-theme-on-surface), 0.03);
    color: rgb(var(--v-theme-on-surface));
    outline: none;
}
.atp-roomsearch:focus { border-color: rgb(var(--v-theme-primary)); }
.atp-room {
    padding: 8px 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
}
.atp-room:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.atp-room-top { display: flex; align-items: center; gap: 6px; }
.atp-room-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atp-room-sub { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.5); margin-top: 2px; padding-left: 22px; }
.atp-back {
    display: inline-flex;
    align-items: center;
    border: none;
    background: transparent;
    cursor: pointer;
    color: rgb(var(--v-theme-primary));
    padding: 0 2px;
}
.atp-rail-room { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }

.atp-split {
    flex: 0 0 5px;
    cursor: col-resize;
    background: transparent;
}
.atp-split:hover { background: rgba(var(--v-theme-primary), 0.3); }

.atp-center {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.atp-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(var(--v-theme-on-surface), 0.4);
    font-size: 14px;
}
.atp-runhead {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.1);
    flex: 0 0 auto;
}
.atp-filter {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    padding: 8px 12px;
    flex: 0 0 auto;
}
.atp-search { max-width: 240px; flex: 1 1 160px; }
.atp-kind {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.25);
    color: rgba(var(--v-theme-on-surface), 0.7);
    cursor: pointer;
    line-height: 1.6;
    white-space: nowrap;
}
.atp-kind:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.atp-kind.is-on { background: rgb(var(--v-theme-primary)); color: #fff; border-color: rgb(var(--v-theme-primary)); }
.atp-kind.is-err.is-on { background: rgb(var(--v-theme-error)); border-color: rgb(var(--v-theme-error)); }
.atp-kind.is-warn.is-on { background: #f9a825; border-color: #f9a825; }

.atp-timeline {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 4px 8px 16px;
}
.atp-empty { padding: 24px 12px; text-align: center; color: rgba(var(--v-theme-on-surface), 0.4); font-size: 13px; }
.atp-node {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 3px 4px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 13px;
}
.atp-node:hover { background: rgba(var(--v-theme-on-surface), 0.05); }
.atp-node.is-error { background: rgba(var(--v-theme-error), 0.07); }
.atp-node.is-active { background: rgba(var(--v-theme-primary), 0.14); }
.atp-guide { width: 14px; flex: 0 0 14px; align-self: stretch; border-left: 1px solid rgba(var(--v-border-color), 0.2); margin-left: 7px; }
.atp-caret { width: 18px; flex: 0 0 18px; display: inline-flex; justify-content: center; cursor: pointer; }
.atp-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(var(--v-theme-on-surface), 0.3); }
.atp-depth { font-size: 9px; color: rgba(var(--v-theme-on-surface), 0.45); border: 1px solid rgba(var(--v-border-color), 0.25); border-radius: 4px; padding: 0 3px; margin-right: 4px; flex: 0 0 auto; }
.atp-nicon { flex: 0 0 auto; margin-right: 4px; }
.atp-ntitle { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atp-ccount { font-size: 10px; color: rgba(var(--v-theme-on-surface), 0.45); background: rgba(var(--v-theme-on-surface), 0.08); border-radius: 8px; padding: 0 5px; margin-left: 5px; flex: 0 0 auto; }
.atp-tcalls { font-size: 11px; color: rgb(var(--v-theme-primary)); margin-left: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atp-agent { font-size: 10px !important; margin-left: 6px; flex: 0 0 auto; }
.atp-meta { margin-left: auto; display: flex; align-items: center; gap: 6px; padding-left: 8px; flex: 0 0 auto; }
.atp-bar { width: 46px; height: 5px; border-radius: 3px; background: rgba(var(--v-theme-on-surface), 0.08); overflow: hidden; }
.atp-bar-fill { display: block; height: 100%; background: rgba(var(--v-theme-primary), 0.55); }
.atp-bar-fill.is-med { background: #ef6c00; }
.atp-bar-fill.is-slow { background: rgb(var(--v-theme-error)); }
.atp-dur { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.5); white-space: nowrap; }
.atp-dur.is-med { color: #ef6c00; font-weight: 600; }
.atp-dur.is-slow { color: rgb(var(--v-theme-error)); font-weight: 700; }
.atp-tok { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.5); }

.atp-detail {
    flex: 0 0 auto;
    overflow-y: auto;
    border-left: 1px solid rgba(var(--v-border-color), 0.14);
}
.atp-dbody { padding: 12px 14px 28px; }
.atp-dhead {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
    position: sticky;
    top: 0;
    background: rgb(var(--v-theme-surface));
    padding: 4px 0 6px;
    z-index: 1;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.1);
}
.atp-label { font-size: 11px; font-weight: 700; color: rgba(var(--v-theme-on-surface), 0.55); margin-bottom: 3px; }
.atp-kb-list { list-style: none; margin: 0; padding: 0; }
.atp-kb-list li { display: flex; align-items: center; font-size: 12px; padding: 2px 0; color: rgba(var(--v-theme-on-surface), 0.8); word-break: break-all; }
.atp-kb-doc { gap: 2px; }
.atp-kb-fname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.atp-kb-fpath { flex: 0 0 auto; margin-left: 6px; font-size: 10.5px; color: rgba(var(--v-theme-on-surface), 0.45); white-space: nowrap; }
.atp-kb-dl { margin-left: auto; flex: 0 0 auto; }
.atp-user {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin: 4px 0 2px;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.85);
}
.atp-user-name { font-weight: 600; }
.atp-user-sub { color: rgba(var(--v-theme-on-surface), 0.6); }
.atp-user-uid {
    font-size: 10.5px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    color: rgba(var(--v-theme-on-surface), 0.45);
    background: rgba(var(--v-theme-on-surface), 0.05);
    border-radius: 4px;
    padding: 0 5px;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.atp-turn-user { color: rgba(var(--v-theme-primary), 0.85); font-weight: 600; }
.atp-pre {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12.5px;
    line-height: 1.55;
    background: rgba(var(--v-theme-on-surface), 0.04);
    border-radius: 6px;
    padding: 8px 10px;
    margin: 0;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
}
.atp-answer { background: rgba(var(--v-theme-primary), 0.08); }
.atp-err { background: rgba(var(--v-theme-error), 0.1); color: rgb(var(--v-theme-error)); }
.atp-hint { font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.4); }
.atp-pre :deep(mark) { background: #ffe082; color: #5d4037; border-radius: 2px; padding: 0 1px; }
.atp-ntitle :deep(mark), .atp-dhead :deep(mark) { background: #ffe082; border-radius: 2px; }
details > summary { cursor: pointer; }

@media (max-width: 960px) {
    .atp-main { flex-direction: column; }
    .atp-rail, .atp-detail { width: 100% !important; max-height: 32vh; border: none; border-bottom: 1px solid rgba(var(--v-border-color), 0.14); }
    .atp-split { display: none; }
}
</style>
