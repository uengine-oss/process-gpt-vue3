<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { useNotificationsStore } from '@/stores/notifications';

const store = useNotificationsStore();

// realtime 이 끊겼을 때를 대비해 탭이 다시 보일 때 한 번 재조회한다.
const onVisible = () => {
    if (document.visibilityState === 'visible') void store.refreshUnreadCount();
};

onMounted(() => {
    void store.ensureWatching();
    document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible);
});
</script>
<template>
    <v-chip
        v-if="store.unreadCount > 0"
        size="x-small"
        color="error"
        variant="flat"
        :aria-label="`읽지 않은 알림 ${store.unreadCount}건`"
    >
        {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
    </v-chip>
</template>
