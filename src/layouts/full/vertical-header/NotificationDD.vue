<template>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <v-menu v-model="menuOpen" :close-on-content-click="true" class="notification_popup">
        <template v-slot:activator="{ props }">
            <v-btn icon flat v-bind="props" size="small" @click="isConfirm = true">
                <div class="position-realtive">
                    <div class="notify" v-if="!isConfirm && notiCount > 0">
                        <span class="heartbit"></span>
                        <span class="point"></span>
                    </div>
                    <Icons :icon="'bell-bing-line-duotone'" />
                </div>
            </v-btn>
        </template>

        <v-sheet class="mt-5 dropdown-box notification-dd-box"
            rounded="lg"
            elevation="10" 
        >
            <div class="d-flex align-center pa-3">
                <h6 class="text-h5 font-weight-semibold">{{ $t('NotificationDD.notification') }}</h6>
                <v-chip color="primary" variant="flat" size="x-small" class="text-white ml-4" rounded="xl">
                    {{ notiCount }} New
                </v-chip>
            </div>
            <v-divider></v-divider>
            <div style="height: 300px; overflow: auto !important;">
                <v-list lines="one">
                    <v-list-item v-for="item in notifications" :key="item.id" @click="checkNotification(item)">
                        <template v-slot:prepend>
                            <div class="mr-2">
                                <v-chip color="primary" variant="tonal" size="x-small" label>
                                    {{ item.type.includes('workitem') ? 'To-Do' : 'Chat' }}
                                </v-chip>
                            </div>
                        </template>
                        <v-list-item-subtitle class="d-flex">
                            <div>{{ item.description }}</div>
                            <div class="ml-auto">{{ item.timeStamp }} ago</div>
                        </v-list-item-subtitle>
                        <v-list-item-title class="d-flex mt-1">
                            <div style="word-wrap: break-word; white-space: normal; width: 100%;">{{ item.title }}</div>
                            <div class="ml-auto">
                                <v-badge v-if="item.count > 1" color="primary" :content="item.count" inline></v-badge>
                            </div>
                        </v-list-item-title>
                        <v-divider class="mt-1"></v-divider>
                    </v-list-item>
                </v-list>
            </div>
        </v-sheet>
    </v-menu>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { useDefaultSetting } from '@/stores/defaultSetting';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        menuOpen: false,
        isConfirm: false,
        notifications: [],
        defaultSetting: useDefaultSetting(),
    }),
    computed: {
        notiCount() {
            if (this.notifications.length > 0) {
                return this.notifications.length;
            }
            return 0;
        },
    },
    watch: {
        notiCount(newVal, oldVal) {
            if (newVal > 0 && newVal !== oldVal) {
                this.isConfirm = false;
            }
        }
    },
    async mounted() {
        this.fetchNotifications();

        await backend.watchNotifications((noti) => {
            if (noti && noti.new && noti.new.is_checked === false) {
                this.fetchNotifications();
                if(localStorage.getItem('email') && noti.new.user_id === localStorage.getItem('email')) {
                    this.$emit('newNotification', noti.new.type);
                }
                if(noti.eventType === 'INSERT') {
                    this.EventBus.emit('show-notification', noti.new);
                }
            }
        });
    },
    methods: {
        async fetchNotifications() {
            this.notifications = await backend.fetchNotifications();
        },
        getChatRoomIdFromUrl(url) {
            if (!url || typeof url !== 'string') return null;
            try {
                const parsed = new URL(url, window.location.origin);
                const id = parsed.searchParams.get('id');
                return id ? decodeURIComponent(id) : null;
            } catch (e) {
                const match = url.match(/[?&]id=([^&]+)/);
                return match ? decodeURIComponent(match[1]) : null;
            }
        },
        async checkNotification(value) {
            // 클릭 순간 즉시 닫기(UX)
            this.menuOpen = false;
            if (value.type == 'workitem') {
                this.$router.push('/todolist');
            } else {
                // chat 알림은 방 타입에 맞게 라우팅 (메인/에이전트/유저)
                if (value.type === 'chat') {
                    const roomId = this.getChatRoomIdFromUrl(value.url) || value.url?.replace('/chats?id=', '');
                    if (roomId) {
                        // 가능하면 로컬 캐시(chatRoomIndex) 사용 (불필요한 재조회 방지)
                        let room = null;
                        try {
                            const idx = JSON.parse(localStorage.getItem('chatRoomIndex') || '{}');
                            room = idx && idx[roomId] ? idx[roomId] : null;
                        } catch (e) {}
                        if (!room) {
                            room = await backend.getChatRoom(roomId);
                        }
                        if (room && room.id) {
                            const participants = Array.isArray(room.participants) ? room.participants : [];
                            const myEmail = localStorage.getItem('email');
                            const myId = localStorage.getItem('uid') || localStorage.getItem('id');

                            const hasSystem = participants.some((p) => p?.id === 'system_id' || p?.email === 'system@uengine.org');
                            if (hasSystem) {
                                const path = this.$route?.path || '';
                                if (!path.startsWith('/definition-map')) {
                                    await this.$router.push({ path: '/definition-map' });
                                    setTimeout(() => this.EventBus.emit('open-history-room', room), 0);
                                } else {
                                    this.EventBus.emit('open-history-room', room);
                                }
                            } else {
                                const explicitPrimaryAgentId = room.primary_agent_id || room.primaryAgentId || null;
                                if (explicitPrimaryAgentId) {
                                    await this.$router.push({
                                        path: `/agent-chat/${explicitPrimaryAgentId}`,
                                        query: { roomId: room.id },
                                        hash: '#chat'
                                    });
                                } else {
                                    const agentIds = participants
                                        .map((p) => p?.id)
                                        .filter(Boolean)
                                        .filter((id) => {
                                            const agent = this.defaultSetting?.getAgentById?.(id);
                                            return !!agent;
                                        });
                                    if (agentIds.length === 1) {
                                        await this.$router.push({
                                            path: `/agent-chat/${agentIds[0]}`,
                                            query: { roomId: room.id },
                                            hash: '#chat'
                                        });
                                    } else {
                                        const others = participants.filter((p) => {
                                            if (!p) return false;
                                            if (myEmail && p.email && p.email === myEmail) return false;
                                            if (myId && p.id && p.id === myId) return false;
                                            return true;
                                        });
                                        // 1:1 유저 채팅
                                        if (others.length === 1 && !this.defaultSetting?.getAgentById?.(others[0]?.id)) {
                                            const path = this.$route?.path || '';
                                            const payload = { user: others[0], roomId: room.id };
                                            if (!path.startsWith('/definition-map')) {
                                                await this.$router.push({ path: '/definition-map' });
                                                setTimeout(() => this.EventBus.emit('open-user-conversation', payload), 0);
                                            } else {
                                                this.EventBus.emit('open-user-conversation', payload);
                                            }
                                        } else {
                                            // 다중 에이전트/그룹은 일단 메인 패널로 열기
                                            const path = this.$route?.path || '';
                                            if (!path.startsWith('/definition-map')) {
                                                await this.$router.push({ path: '/definition-map' });
                                                setTimeout(() => this.EventBus.emit('open-history-room', room), 0);
                                            } else {
                                                this.EventBus.emit('open-history-room', room);
                                            }
                                        }
                                    }
                                }
                            }

                            // 상단 채팅 noti badge에서 제거
                            window.dispatchEvent(new CustomEvent('update-notification-badge', {
                                detail: { type: 'chat', value: false, id: room.id }
                            }));
                            // NOTE: new 해제는 실제로 방이 열려 선택(chat-room-selected)된 시점에만 처리
                        } else {
                            // 방 조회 실패 시 기존 url로 fallback
                            this.$router.push(value.url);
                        }
                    } else {
                        this.$router.push(value.url);
                    }
                } else {
                    this.$router.push(value.url);
                }
            }
            await backend.setNotifications(value);
            // 즉시 UI에서 제거(체감 개선) 후 재조회
            this.notifications = this.notifications.filter(n => n.id !== value.id);
            this.fetchNotifications();
        }
    }
}
</script>