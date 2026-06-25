<template>
    <!-- AI 답변 메시지에 다는 👍/👎 피드백. uuid 없는(스트리밍 중) 메시지엔 미표시. -->
    <span v-if="targetUuid" class="cf-wrap" @click.stop>
        <v-btn
            icon
            size="small"
            variant="text"
            :color="myRating === 1 ? 'success' : ''"
            :title="myRating === 1 ? '도움됨 (해제)' : '도움됨'"
            @click="onUp"
        >
            <v-icon size="20">{{ myRating === 1 ? 'mdi-thumb-up' : 'mdi-thumb-up-outline' }}</v-icon>
        </v-btn>

        <v-menu v-model="menu" :close-on-content-click="false" location="top end" offset="6">
            <template #activator="{ props }">
                <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    :color="myRating === -1 ? 'error' : ''"
                    title="개선 필요"
                >
                    <v-icon size="20">{{ myRating === -1 ? 'mdi-thumb-down' : 'mdi-thumb-down-outline' }}</v-icon>
                </v-btn>
            </template>
            <v-card min-width="320" class="pa-3 cf-card">
                <div class="text-body-2 font-weight-medium mb-2">이 답변, 무엇이 문제였나요?</div>
                <div class="cf-cats">
                    <v-chip
                        v-for="c in categories"
                        :key="c.value"
                        size="small"
                        :color="category === c.value ? 'error' : undefined"
                        :variant="category === c.value ? 'flat' : 'outlined'"
                        @click="category = category === c.value ? '' : c.value"
                    >
                        {{ c.label }}
                    </v-chip>
                </div>
                <v-textarea
                    v-model="comment"
                    rows="3"
                    auto-grow
                    max-rows="8"
                    variant="outlined"
                    density="compact"
                    hide-details
                    placeholder="구체적으로 무엇이 틀렸는지 적어주세요"
                    class="mt-2"
                    autofocus
                />
                <div class="d-flex align-center mt-3" style="gap: 6px">
                    <v-btn v-if="myRating" size="small" variant="text" color="grey" :loading="saving" @click="onRemove">피드백 삭제</v-btn>
                    <v-spacer />
                    <v-btn size="small" variant="text" @click="menu = false">취소</v-btn>
                    <v-btn size="small" color="error" variant="flat" :loading="saving" @click="onSubmitDown">제출</v-btn>
                </div>
            </v-card>
        </v-menu>
    </span>
</template>

<script>
import { reactive } from 'vue';

// ── 방별 피드백 공유 캐시 (메시지마다 쿼리 안 나가게 1회 로드) ──
const _cache = reactive({}); // roomId -> { loaded: bool, byTarget: { [uuid]: {rating, category, comment} } }
const _loading = {}; // roomId -> Promise

function _ensureRoom(roomId) {
    if (!_cache[roomId]) _cache[roomId] = { loaded: false, byTarget: {} };
    return _cache[roomId];
}

async function _loadRoom(roomId) {
    if (!roomId || !window.$supabase) return;
    const room = _ensureRoom(roomId);
    if (room.loaded) return;
    if (_loading[roomId]) return _loading[roomId];
    _loading[roomId] = (async () => {
        try {
            const uid = localStorage.getItem('uid') || '';
            const { data } = await window.$supabase
                .from('chat_feedback')
                .select('target_uuid,rating,category,comment')
                .eq('conversation_id', roomId)
                .eq('user_uid', uid);
            const bt = {};
            (data || []).forEach((r) => {
                bt[r.target_uuid] = { rating: r.rating, category: r.category, comment: r.comment };
            });
            room.byTarget = bt;
            room.loaded = true;
        } catch (e) {
            // 조회 실패해도 버튼은 동작(빈 상태) — 무해
            console.warn('[chat_feedback] load fail', e);
        } finally {
            delete _loading[roomId];
        }
    })();
    return _loading[roomId];
}

export default {
    name: 'ChatFeedback',
    props: {
        message: { type: Object, required: true },
        roomId: { type: String, default: '' }
    },
    data() {
        return {
            menu: false,
            category: '',
            comment: '',
            saving: false,
            categories: [
                { value: 'wrong', label: '틀린 정보' },
                { value: 'insufficient', label: '정보 부족' },
                { value: 'other', label: '기타' }
            ]
        };
    },
    computed: {
        targetUuid() {
            return (this.message && (this.message.uuid || this.message.id)) || '';
        },
        myFeedback() {
            const room = _cache[this.roomId];
            return (room && room.byTarget[this.targetUuid]) || null;
        },
        myRating() {
            return this.myFeedback ? this.myFeedback.rating : 0;
        }
    },
    watch: {
        menu(open) {
            if (open) {
                // 팝오버 열릴 때 기존 피드백 프리필
                const f = this.myFeedback;
                this.category = f && f.rating === -1 ? f.category || '' : '';
                this.comment = f ? f.comment || '' : '';
            }
        }
    },
    created() {
        if (this.roomId && this.targetUuid) _loadRoom(this.roomId);
    },
    methods: {
        async onUp() {
            if (this.saving) return;
            if (this.myRating === 1) {
                await this.remove(); // 토글 해제
            } else {
                await this.save(1, null, null);
            }
        },
        async onSubmitDown() {
            await this.save(-1, this.category || null, (this.comment || '').trim() || null);
            this.menu = false;
        },
        async onRemove() {
            await this.remove();
            this.menu = false;
        },
        async save(rating, category, comment) {
            const sb = window.$supabase;
            if (!sb || !this.targetUuid) return;
            this.saving = true;
            try {
                const row = {
                    conversation_id: this.roomId,
                    target_uuid: this.targetUuid,
                    rating,
                    category,
                    comment,
                    user_uid: localStorage.getItem('uid') || '',
                    user_email: localStorage.getItem('email') || '',
                    user_name: localStorage.getItem('userName') || localStorage.getItem('email') || '',
                    tenant_id: window.$tenantName || localStorage.getItem('tenantId') || 'process-gpt'
                };
                const { error } = await sb.from('chat_feedback').upsert(row, { onConflict: 'target_uuid,user_uid' });
                if (error) throw error;
                _ensureRoom(this.roomId).byTarget[this.targetUuid] = { rating, category, comment };
            } catch (e) {
                console.error('[chat_feedback] save fail', e);
            } finally {
                this.saving = false;
            }
        },
        async remove() {
            const sb = window.$supabase;
            if (!sb || !this.targetUuid) return;
            this.saving = true;
            try {
                const uid = localStorage.getItem('uid') || '';
                const { error } = await sb.from('chat_feedback').delete().eq('target_uuid', this.targetUuid).eq('user_uid', uid);
                if (error) throw error;
                const room = _ensureRoom(this.roomId);
                delete room.byTarget[this.targetUuid];
            } catch (e) {
                console.error('[chat_feedback] remove fail', e);
            } finally {
                this.saving = false;
            }
        }
    }
};
</script>

<style scoped>
.cf-wrap {
    display: inline-flex;
    align-items: center;
}
.cf-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.cf-card {
    border-radius: 10px;
}
</style>
