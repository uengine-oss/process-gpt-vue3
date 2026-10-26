<template>
    <div class="handover-flow-diagram e2e-handover-flow">
        <div class="handover-flow-diagram__head">
            <div class="handover-flow-diagram__title">
                <div class="text-subtitle-1 font-weight-bold">{{ title }}</div>
                <div v-if="startedAt" class="text-caption text-medium-emphasis">{{ startedAt }}</div>
            </div>
            <v-tooltip :text="$t('Handover.refresh')" location="bottom">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon variant="text" density="comfortable" size="small" :loading="loading" @click="load">
                        <v-icon size="18">mdi-refresh</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
        </div>

        <div class="handover-flow-diagram__scroll">
            <div
                v-if="nodes.length"
                class="handover-flow-diagram__canvas"
                :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
            >
                <svg class="handover-flow-diagram__edges" :width="layout.width" :height="layout.height">
                    <defs>
                        <marker id="hf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                            <path d="M0,0 L10,5 L0,10 z" class="handover-flow-diagram__arrow" />
                        </marker>
                    </defs>
                    <path
                        v-for="(e, i) in edgePaths"
                        :key="i"
                        :d="e.d"
                        class="handover-flow-diagram__edge e2e-handover-flow-edge"
                        :class="{ 'is-join': e.join }"
                        :data-from="e.from"
                        :data-to="e.to"
                        marker-end="url(#hf-arrow)"
                    />
                </svg>
                <div
                    v-for="l in edgeLabels"
                    :key="l.to"
                    class="handover-flow-diagram__label e2e-handover-flow-label"
                    :style="{ left: `${l.x}px`, top: `${l.y}px` }"
                >
                    {{ l.text }}
                </div>

                <div
                    v-for="n in nodes"
                    :key="n.id"
                    class="handover-flow-diagram__card e2e-handover-flow-node"
                    :class="{ 'is-here': n.roomId === roomId }"
                    :style="cardStyle(n)"
                    :data-room-id="n.roomId"
                    :data-status="n.status"
                    :data-node-id="n.id"
                >
                    <div class="handover-flow-diagram__card-top">
                        <v-icon size="18" class="handover-flow-diagram__card-icon">
                            {{ n.isAgent ? 'mdi-robot-outline' : 'mdi-account-outline' }}
                        </v-icon>
                        <div class="handover-flow-diagram__activity">{{ n.activity }}</div>
                        <span class="handover-flow-diagram__status" :class="`is-${n.status}`">
                            <v-icon size="13">{{ statusIcon(n.status) }}</v-icon>
                            {{ $t('Handover.status_' + n.status) }}
                        </span>
                    </div>
                    <div class="handover-flow-diagram__who">
                        <span class="handover-flow-diagram__avatar">{{ (n.who || '?').slice(0, 1) }}</span>
                        {{ n.who }}<template v-if="n.department"> · {{ n.department }}</template>
                    </div>
                    <div v-if="n.instruction" class="handover-flow-diagram__quote">“{{ n.instruction }}”</div>
                    <div v-if="n.result" class="handover-flow-diagram__result e2e-handover-flow-result">{{ n.result }}</div>
                    <div v-if="n.history.length" class="handover-flow-diagram__history">
                        <div v-for="(h, i) in n.history" :key="i" class="handover-flow-diagram__history-item">
                            <span class="handover-flow-diagram__dot"></span>
                            <span class="handover-flow-diagram__time">{{ time(h.at) }}</span>
                            <span>{{ h.text }}</span>
                        </div>
                    </div>
                    <v-tooltip v-if="n.roomId !== roomId" :text="$t('Handover.openRoom')" location="top">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                variant="text"
                                density="compact"
                                size="x-small"
                                class="handover-flow-diagram__open e2e-handover-flow-open-room"
                                @click="openRoom(n.roomId)"
                            >
                                <v-icon size="14">mdi-open-in-new</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </div>
            <div v-else-if="!loading" class="pa-6 text-caption text-medium-emphasis">—</div>
        </div>

        <div class="handover-flow-diagram__legend text-caption text-medium-emphasis">
            <span><span class="handover-flow-diagram__legend-card"></span>{{ $t('Handover.legendCard') }}</span>
            <span><span class="handover-flow-diagram__legend-line"></span>{{ $t('Handover.legendLine') }}</span>
            <span><span class="handover-flow-diagram__legend-label">abc</span>{{ $t('Handover.legendLabel') }}</span>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { CARD_WIDTH, buildFlow, layoutFlow } from '@/utils/handoverFlow';

const backend = BackendFactory.createBackend();

/**
 * 인계 스레드 한 건의 작업 흐름 그림. 카드 = 임무, 연결선 = 전달, 이름 붙은 연결선 = 배분 조건(인계 사유).
 * 스레드에 참여한 어느 방에서 열어도 같은 그림이다(시작 방 기준). 계산은 utils/handoverFlow 가 한다.
 */
export default {
    name: 'HandoverFlowDiagram',
    props: {
        roomId: { type: String, default: null }
    },
    data() {
        return { loading: false, nodes: [], edges: [], title: '', startedAt: '', loadedFor: null };
    },
    computed: {
        layout() {
            return layoutFlow(this.nodes, this.edges);
        },
        edgePaths() {
            const P = this.layout.positions;
            return this.edges
                .filter((e) => P[e.from] && P[e.to])
                .map((e) => {
                    const a = P[e.from];
                    const b = P[e.to];
                    const sx = a.x + CARD_WIDTH / 2;
                    const sy = a.y + a.height;
                    const tx = b.x + CARD_WIDTH / 2;
                    const ty = b.y;
                    const midY = ty - 24;
                    return { d: `M${sx},${sy} V${midY} H${tx} V${ty - 2}`, join: e.join, from: e.from, to: e.to };
                });
        },
        /** 인계 사유는 받는 카드 위에 한 번만 적는다(합류면 들어오는 선이 여럿이라). */
        edgeLabels() {
            const P = this.layout.positions;
            const seen = new Set();
            const out = [];
            for (const e of this.edges) {
                if (!e.label || seen.has(e.to) || !P[e.to]) continue;
                seen.add(e.to);
                out.push({ to: e.to, text: e.label, x: P[e.to].x + 12, y: P[e.to].y - 46 });
            }
            return out;
        }
    },
    watch: {
        roomId: {
            immediate: true,
            handler() {
                this.load();
            }
        }
    },
    methods: {
        async load() {
            const roomId = this.roomId;
            this.loadedFor = roomId;
            if (!roomId) return;
            this.loading = true;
            try {
                const sb = window.$supabase;
                const { originRoomId } = await backend.resolveOriginRoomId(roomId);
                const rows = (await backend.getHandoverThread(originRoomId)).filter((r) => r.source === 'chat_handover');
                const taskIds = rows.map((r) => r.to_task_id).filter(Boolean);
                const roomIds = [originRoomId, ...rows.map((r) => r.to_room_id).filter(Boolean)];
                const userIds = Array.from(new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]).filter(Boolean)));
                const [tasksRes, roomsRes, usersRes, chatsRes] = await Promise.all([
                    taskIds.length ? sb.from('todolist').select('id, status, end_date, updated_at').in('id', taskIds) : { data: [] },
                    sb.from('chat_rooms').select('id, name, participants').in('id', roomIds),
                    userIds.length ? sb.from('users').select('id, department_name').in('id', userIds) : { data: [] },
                    sb.from('chats').select('id, messages').in('id', roomIds)
                ]);
                const tasks = {};
                for (const t of tasksRes.data || []) tasks[t.id] = { status: t.status, end_date: t.end_date || t.updated_at };
                const unread = {};
                const rooms = {};
                for (const r of roomsRes.data || []) rooms[r.id] = r;
                for (const row of rows) {
                    const room = rooms[row.to_room_id];
                    const me = (room?.participants || []).find((p) => p?.id === row.to_user_id);
                    if (me?.isExistUnReadMessage === true) unread[row.to_room_id] = true;
                }
                const departments = {};
                for (const u of usersRes.data || []) if (u.department_name) departments[u.id] = u.department_name;
                // 그 방에서 마지막으로 남은 사람·에이전트 메시지 — 결과 요약에 쓴다
                const lastMessage = {};
                const lastAt = {};
                for (const c of chatsRes.data || []) {
                    const m = c.messages || {};
                    if (m.role === 'system' || typeof m.content !== 'string' || !m.content.trim()) continue;
                    const at = String(m.timeStamp || '');
                    if (!lastAt[c.id] || at > lastAt[c.id]) {
                        lastAt[c.id] = at;
                        lastMessage[c.id] = m.content;
                    }
                }
                const flow = buildFlow(originRoomId, rows, { tasks, unread, departments, lastMessage });
                if (this.loadedFor !== roomId) return;
                this.nodes = flow.nodes;
                this.edges = flow.edges;
                this.title = rooms[originRoomId]?.name || flow.nodes[0]?.activity || '';
                this.startedAt = rows.length ? this.date(rows[0].occurred_at) : '';
            } catch (e) {
                console.warn('[handover] 작업 흐름 그림을 불러오지 못함:', e);
            } finally {
                this.loading = false;
            }
        },
        cardStyle(n) {
            const p = this.layout.positions[n.id];
            return p ? { left: `${p.x}px`, top: `${p.y}px`, width: `${CARD_WIDTH}px`, height: `${p.height}px` } : {};
        },
        statusIcon(s) {
            return { done: 'mdi-check-circle', progress: 'mdi-progress-clock', waiting: 'mdi-dots-horizontal-circle-outline' }[s];
        },
        time(at) {
            const d = new Date(at);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
        },
        date(at) {
            const d = new Date(at);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        },
        openRoom(roomId) {
            if (!roomId || roomId === this.roomId) return;
            this.$router.push({ path: '/chat', query: { roomId } });
        }
    }
};
</script>

<style scoped>
.handover-flow-diagram {
    /* 세로 스크롤은 산출물 패널 하나만 쓴다 — 여기서 높이를 잡고 안쪽에 또 스크롤을 두면 이중 스크롤이 된다 */
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: rgba(var(--v-theme-on-surface), 0.015);
}
.handover-flow-diagram__head {
    display: flex;
    align-items: center;
    padding: 12px 16px 4px;
}
.handover-flow-diagram__title {
    flex: 1;
    min-width: 0;
}
.handover-flow-diagram__scroll {
    flex: 1;
    overflow-x: auto;
    padding: 16px 16px 24px;
}
.handover-flow-diagram__canvas {
    position: relative;
    margin: 0 auto;
}
.handover-flow-diagram__edges {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
}
.handover-flow-diagram__edge {
    fill: none;
    stroke: rgb(var(--v-theme-primary));
    stroke-width: 1.6;
    opacity: 0.75;
}
.handover-flow-diagram__arrow {
    fill: rgb(var(--v-theme-primary));
}
.handover-flow-diagram__label {
    position: absolute;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    white-space: nowrap;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.handover-flow-diagram__card {
    position: absolute;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgb(var(--v-theme-surface));
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}
.handover-flow-diagram__card.is-here {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.15);
}
.handover-flow-diagram__card-top {
    display: flex;
    align-items: center;
    gap: 6px;
}
.handover-flow-diagram__card-icon {
    color: rgb(var(--v-theme-primary));
}
.handover-flow-diagram__activity {
    flex: 1;
    min-width: 0;
    font-weight: 700;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.handover-flow-diagram__status {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
}
.handover-flow-diagram__status.is-done {
    color: rgb(var(--v-theme-success));
    background: rgba(var(--v-theme-success), 0.1);
}
.handover-flow-diagram__status.is-progress {
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}
.handover-flow-diagram__status.is-waiting {
    color: var(--cds-text-secondary);
    background: rgba(var(--v-theme-on-surface), 0.06);
}
.handover-flow-diagram__who {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--cds-text-secondary);
}
.handover-flow-diagram__avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    background: rgba(var(--v-theme-primary), 0.15);
    color: rgb(var(--v-theme-primary));
}
.handover-flow-diagram__quote {
    margin-top: 8px;
    /* 넘친 셋째 줄이 아래 여백에 비치지 않게 — 아래 여백은 투명 테두리로 둔다(내용은 테두리 안쪽에서 잘린다) */
    padding: 6px 8px 0;
    border-bottom: 6px solid transparent;
    box-sizing: border-box;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    background: rgba(var(--v-theme-on-surface), 0.04);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    /* 줄 수 제한이 안이 넘치는 것까지 막지는 않아 셋째 줄이 비친다 — 두 줄 높이로 자른다 */
    max-height: calc(2 * 1.4em + 12px);
}
.handover-flow-diagram__result {
    margin-top: 8px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.handover-flow-diagram__history {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.handover-flow-diagram__history-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    height: 20px;
    white-space: nowrap;
    overflow: hidden;
}
.handover-flow-diagram__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
    flex-shrink: 0;
}
.handover-flow-diagram__time {
    color: var(--cds-text-secondary);
}
.handover-flow-diagram__open {
    position: absolute;
    right: 6px;
    bottom: 6px;
}
.handover-flow-diagram__legend {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding: 8px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.handover-flow-diagram__legend > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.handover-flow-diagram__legend-card {
    width: 14px;
    height: 10px;
    border-radius: 3px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.3);
}
.handover-flow-diagram__legend-line {
    width: 18px;
    height: 0;
    border-top: 2px solid rgb(var(--v-theme-primary));
}
.handover-flow-diagram__legend-label {
    font-size: 10px;
    padding: 0 6px;
    border-radius: 8px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
}
</style>
