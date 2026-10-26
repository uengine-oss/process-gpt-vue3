<template>
    <div v-if="sections.length" class="handover-history e2e-handover-history">
        <div class="handover-history__head">
            <v-tooltip :text="$t('Handover.history')" location="bottom">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        variant="text"
                        density="compact"
                        size="small"
                        class="handover-history__toggle e2e-handover-history-toggle"
                        :aria-label="$t('Handover.history')"
                        @click="open = !open"
                    >
                        <v-icon size="16">mdi-history</v-icon>
                        <span class="handover-history__count">{{ sections.length }}</span>
                        <v-icon size="16" class="ml-1">{{ open ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
        </div>

        <div v-show="open">
            <section
                v-for="s in sections"
                :key="s.roomId"
                class="handover-history__room e2e-handover-history-room"
                :data-room-id="s.roomId"
            >
                <div class="handover-history__room-head">
                    <span class="handover-history__room-name">{{ s.roomName }}</span>
                    <span v-if="s.handedTo" class="handover-history__route text-medium-emphasis">
                        {{ s.handedBy }} <v-icon size="12">mdi-arrow-right</v-icon> {{ s.handedTo }}
                    </span>
                    <v-tooltip :text="$t('Handover.openRoom')" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                variant="text"
                                density="compact"
                                size="small"
                                class="ml-auto e2e-handover-history-open"
                                @click="openRoom(s.roomId)"
                            >
                                <v-icon size="16">mdi-open-in-new</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>

                <div v-for="m in s.messages" :key="m.key" class="handover-history__msg" :class="`is-${m.role}`">
                    <div class="handover-history__meta">
                        <span class="handover-history__sender">{{ m.sender }}</span>
                        <span class="text-medium-emphasis">{{ m.time }}</span>
                    </div>
                    <div class="handover-history__body" v-html="m.html"></div>
                </div>
                <div v-if="!s.messages.length" class="handover-history__empty text-medium-emphasis">—</div>
            </section>
        </div>

        <div class="handover-history__divider">
            <v-divider />
        </div>
    </div>
</template>

<script>
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 인계 체인이 순환하거나 비정상적으로 길어도 화면이 멈추지 않게 거슬러 오를 단계 수를 제한한다.
const MAX_DEPTH = 20;
// 넘긴 방에서 인계 직후에 남는 "~님에게 인계했습니다" 알림까지 함께 보이도록 인계 시각 뒤로 약간 여유를 둔다.
const AFTER_HANDOVER_MS = 10 * 1000;

/**
 * 인계받은 방 위쪽에, 이 업무가 거쳐 온 앞선 방들의 대화를 읽기 전용으로 보여 준다.
 *
 * 인계받은 사람은 새 방에서 일하지만, 무엇을 넘겨받았는지는 앞선 방의 대화에 있다.
 * 대화를 파일로 옮겨 받는 대신 원래 대화를 그대로 보여 준다. 각 방은 그 방에서 다음 방으로
 * 인계된 시각까지만 보인다 — 인계 뒤 그 방에서 이어진 다른 일은 이 업무의 맥락이 아니다.
 */
export default {
    name: 'HandoverHistory',
    props: {
        room: { type: Object, default: null }
    },
    data() {
        return { open: true, sections: [], loadedFor: null };
    },
    watch: {
        'room.id': {
            immediate: true,
            handler() {
                this.load();
            }
        }
    },
    methods: {
        async load() {
            const room = this.room;
            const roomId = room?.id || null;
            this.loadedFor = roomId;
            this.sections = [];
            if (!roomId || !room?.context?.handover) return;
            try {
                const chain = await this.resolveChain(roomId, room);
                const sections = [];
                for (const link of chain) {
                    sections.push(await this.buildSection(link));
                }
                if (this.loadedFor === roomId) this.sections = sections;
            } catch (e) {
                console.warn('[handover] 이전 대화를 불러오지 못함:', e);
            }
        },

        /** 이 방에서 거슬러 올라가 시작 방까지, 시작 방 → 바로 앞 방 순서로 인계 고리를 돌려준다. */
        async resolveChain(roomId, room) {
            const sb = window.$supabase;
            const chain = [];
            const seen = new Set([roomId]);
            let toRoomId = roomId;
            let fallbackFrom = room?.context?.handover?.from_room_id || null;
            for (let i = 0; i < MAX_DEPTH; i++) {
                const { data } = await sb
                    .from('handover_events')
                    .select('from_room_id, to_room_id, occurred_at, from_user_name, to_user_name')
                    .eq('tenant_id', window.$tenantName)
                    .eq('to_room_id', toRoomId)
                    .order('occurred_at', { ascending: true })
                    .limit(1);
                const ev = Array.isArray(data) && data.length ? data[0] : null;
                const fromRoomId = ev?.from_room_id || fallbackFrom;
                if (!fromRoomId || seen.has(fromRoomId)) break;
                seen.add(fromRoomId);
                chain.unshift({
                    roomId: fromRoomId,
                    until: ev?.occurred_at || null,
                    handedBy: ev?.from_user_name || '',
                    handedTo: ev?.to_user_name || ''
                });
                toRoomId = fromRoomId;
                fallbackFrom = null;
            }
            return chain;
        },

        async buildSection(link) {
            const sb = window.$supabase;
            const [{ data: r }, { data: rows }] = await Promise.all([
                sb.from('chat_rooms').select('id, name, context').eq('id', link.roomId).maybeSingle(),
                sb.from('chats').select('uuid, messages').eq('id', link.roomId)
            ]);
            const until = link.until ? new Date(link.until).getTime() + AFTER_HANDOVER_MS : Infinity;
            const messages = (Array.isArray(rows) ? rows : [])
                .map((row) => ({ row: row.uuid, m: row.messages || {} }))
                .filter(({ m }) => typeof m.content === 'string' && m.content.trim())
                .filter(({ m }) => !m.timeStamp || new Date(m.timeStamp).getTime() <= until)
                .sort((a, b) => new Date(a.m.timeStamp || 0).getTime() - new Date(b.m.timeStamp || 0).getTime())
                .map(({ row, m }) => ({
                    key: row,
                    role: m.role || 'user',
                    sender: m.name || m.email || '',
                    time: this.formatTime(m.timeStamp),
                    html: this.render(m.content)
                }));
            return {
                roomId: link.roomId,
                roomName: r?.name || '',
                handedBy: link.handedBy,
                handedTo: link.handedTo,
                messages
            };
        },

        render(text) {
            return DOMPurify.sanitize(marked.parse(String(text || ''), { breaks: true, gfm: true }));
        },

        formatTime(ts) {
            if (!ts) return '';
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        },

        openRoom(roomId) {
            this.$router.push({ path: '/chat', query: { roomId } });
        }
    }
};
</script>

<style scoped>
.handover-history {
    padding: 8px 12px 0;
}
.handover-history__head {
    display: flex;
    align-items: center;
}
.handover-history__toggle {
    text-transform: none;
    letter-spacing: 0;
    color: var(--cds-text-secondary);
}
.handover-history__count {
    margin-left: 6px;
    font-size: 11px;
    padding: 0 6px;
    border-radius: 8px;
    background: rgba(var(--v-theme-on-surface), 0.08);
}
.handover-history__room {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    background: rgba(var(--v-theme-on-surface), 0.02);
}
.handover-history__room-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 4px;
}
.handover-history__room-name {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.handover-history__route {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    white-space: nowrap;
}
.handover-history__msg {
    padding: 6px 0;
    border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.06);
}
.handover-history__msg:first-of-type {
    border-top: none;
}
.handover-history__meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
}
.handover-history__sender {
    font-weight: 600;
}
.handover-history__body {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
}
.handover-history__body :deep(h1),
.handover-history__body :deep(h2),
.handover-history__body :deep(h3) {
    font-size: 13px;
    margin: 6px 0 2px;
}
.handover-history__body :deep(p),
.handover-history__body :deep(ul) {
    margin: 0 0 4px;
}
.handover-history__msg.is-system .handover-history__body {
    color: var(--cds-text-secondary);
}
.handover-history__empty {
    font-size: 12px;
}
.handover-history__divider {
    padding: 12px 0 4px;
}
</style>
