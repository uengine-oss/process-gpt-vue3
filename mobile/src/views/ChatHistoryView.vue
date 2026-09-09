<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>지난 대화</h1>
            <button type="button" aria-label="새 대화" @click="router.replace('/chat')"><Icon name="plus" /></button>
        </header>

        <div class="m-body">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <template v-else-if="rooms.length">
                <button
                    v-for="room in rooms"
                    :key="room.id"
                    type="button"
                    class="m-card room"
                    @click="router.push(`/chat/${encodeURIComponent(room.id)}`)"
                >
                    <span class="room__title">{{ roomTitle(room) }}</span>
                    <span class="room__last">{{ isEmptyRoom(room) ? '아직 대화 없음' : preview(room) }}</span>
                </button>
            </template>

            <div v-else class="m-empty">
                <p>지난 대화가 없습니다.</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import Icon from '../components/Icon.vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { backend } from '../lib/backend.js';
import { isEmptyRoom } from '../lib/newChat.js';
import { preview, roomTitle, sortRooms } from '../lib/rooms.js';

const router = useRouter();
const rooms = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
    try {
        // message 컬럼은 {msg, type, createdAt} 객체다. 화면에 그대로 내면
        // `{ "msg": ... }` 가 뜨므로 rooms.js 가 본문만 꺼낸다.
        rooms.value = sortRooms((await backend().getChatRoomList('chat_rooms')) || []);
    } catch (e: any) {
        error.value = '대화 목록을 불러오지 못했습니다.';
        console.error('[chat] 목록 조회 실패', e);
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.room {
    gap: 3px;
}

.room__title {
    font-weight: 600;
    line-height: 1.4;
}

/* 마지막 메시지는 한 줄만. 길면 카드 높이가 제각각이 되어 훑기 어렵다. */
.room__last {
    font-size: 0.85rem;
    color: var(--ink-faint);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
