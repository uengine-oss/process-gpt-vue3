<template>
    <!-- 대화 목록 -->
    <div style="font-size:14px;" class="text-medium-emphasis cp-menu mt-3 ml-2">
        {{ $t('VerticalSidebar.chatList')}}
    </div>
    <div class="chat-room-list">
        <div v-if="isLoadingChatRooms" class="d-flex align-center pl-4 pr-4 py-2 text-caption text-grey">
            <v-progress-circular indeterminate color="primary" :size="16" />
            <span class="ml-2">{{ $t('VerticalSidebar.chatLoading')}}</span>
        </div>
        <div v-else-if="chatRooms.length === 0" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ $t('VerticalSidebar.chatEmpty')}}
        </div>
        <ExpandableList
            v-else
            :items="chatRooms"
            :limit="5"
            :incremental="true"
            :step="10"
        >
            <template #items="{ displayedItems }">
                <v-list density="compact" class="pa-0">
                    <v-list-item
                        v-for="room in displayedItems"
                        :key="room.id"
                        class="chat-room-item sidebar-list-hover-bg"
                        :class="{
                            'sidebar-list-hover-bg--active': room.id === currentChatRoomId,
                            'chat-room-item--unread': isUnreadRoom(room) && room.id !== currentChatRoomId
                        }"
                        @click="openChatRoom(room)"
                    >
                        <template v-slot:prepend>
                            <v-avatar size="28" color="grey-lighten-3" class="chat-room-avatar">
                                <template v-if="isHumanPrimaryRoom(room)">
                                    <v-icon size="16" color="primary">mdi-chat-outline</v-icon>
                                </template>
                                <template v-else>
                                    <v-icon size="16" color="primary">mdi-robot-outline</v-icon>
                                </template>
                            </v-avatar>
                        </template>
                        <v-list-item-title class="chat-room-title">
                            {{ room.name || '새 대화' }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="chat-room-subtitle">
                            {{ truncateMessage(room.message?.msg) }}
                        </v-list-item-subtitle>
                        <template v-slot:append>
                            <span class="chat-room-date text-caption">
                                {{ formatDate(room.message?.createdAt) }}
                            </span>
                        </template>
                    </v-list-item>
                </v-list>
            </template>
        </ExpandableList>
    </div>

    <!-- 다중 에이전트 채팅: 라우팅 대상 선택 -->
    <v-dialog v-model="agentSelectDialog" max-width="420">
        <v-card class="pa-2">
            <v-card-title class="d-flex align-center">
                <span class="text-subtitle-1 font-weight-bold">어느 에이전트 화면으로 열까요?</span>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" @click="agentSelectDialog = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider></v-divider>
            <v-card-text class="pa-2">
                <v-list density="compact">
                    <v-list-item
                        v-for="agent in agentCandidates"
                        :key="agent.id"
                        @click="selectAgentForRoom(agent.id)"
                    >
                        <template v-slot:prepend>
                            <v-avatar size="28" color="grey-lighten-3">
                                <v-img :src="agent.profile || '/images/chat-icon.png'" cover />
                            </v-avatar>
                        </template>
                        <v-list-item-title>{{ agent.username || agent.id }}</v-list-item-title>
                        <v-list-item-subtitle>{{ agent.role || agent.description || '' }}</v-list-item-subtitle>
                    </v-list-item>
                </v-list>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';
import { useDefaultSetting } from '@/stores/defaultSetting';

const backend = BackendFactory.createBackend();

export default {
    name: 'ChatList',
    components: { ExpandableList },
    data: () => ({
        defaultSetting: useDefaultSetting(),
        chatRooms: [],
        isLoadingChatRooms: false,
        currentChatRoomId: null,
        userInfo: null,
        // 다중 에이전트 채팅 라우팅 선택 다이얼로그
        agentSelectDialog: false,
        agentCandidates: [],
        pendingRoomToOpen: null,
        _onChatRoomsUpdated: null,
        _onChatRoomSelected: null,
        _onChatRoomUnselected: null,
        chatsWatchRef: null,
    }),
    async created() {
        try {
            this.userInfo = await backend.getUserInfo();
        } catch (e) {
            this.userInfo = null;
        }
        await this.loadChatRooms();
    },
    async mounted() {
        this._onChatRoomsUpdated = async () => {
            await this.loadChatRooms();
        };
        this.EventBus.on('chat-rooms-updated', this._onChatRoomsUpdated);

        this._onChatRoomSelected = async (roomId) => {
            this.currentChatRoomId = roomId || null;
            // 실제로 해당 방이 열려 선택된 시점에만 unread 해제
            if (roomId) {
                await this.markRoomReadById(roomId);
            }
        };
        this._onChatRoomUnselected = () => {
            this.currentChatRoomId = null;
        };
        this.EventBus.on('chat-room-selected', this._onChatRoomSelected);
        this.EventBus.on('chat-room-unselected', this._onChatRoomUnselected);
    },
    beforeUnmount() {
        if (this._onChatRoomsUpdated) this.EventBus.off('chat-rooms-updated', this._onChatRoomsUpdated);
        if (this._onChatRoomSelected) this.EventBus.off('chat-room-selected', this._onChatRoomSelected);
        if (this._onChatRoomUnselected) this.EventBus.off('chat-room-unselected', this._onChatRoomUnselected);
        try {
            if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                this.chatsWatchRef.unsubscribe();
            }
        } catch (e) {}
    },
    methods: {
        isHumanPrimaryRoom(room) {
            const participants = Array.isArray(room?.participants) ? room.participants : [];
            const hasSystem = participants.some((p) => p?.id === 'system_id' || p?.email === 'system@uengine.org');
            if (hasSystem) return false;
            const primaryAgentId = room?.primary_agent_id || room?.primaryAgentId || null;
            if (primaryAgentId) return false;

            const meEmail = this.userInfo?.email || null;
            const meId = this.userInfo?.id || this.userInfo?.uid || null;
            const others = participants.filter((p) => {
                if (!p) return false;
                if (meEmail && p.email && p.email === meEmail) return false;
                if (meId && p.id && p.id === meId) return false;
                return true;
            });
            if (others.length === 0) return false;
            const hasNonAgentUser = others.some((p) => !this.defaultSetting?.getAgentById?.(p?.id));
            return !!hasNonAgentUser;
        },
        saveChatRoomIndexToLocalStorage() {
            try {
                const index = {};
                (this.chatRooms || []).forEach((r) => {
                    if (!r || !r.id) return;
                    index[r.id] = {
                        id: r.id,
                        name: r.name || null,
                        primary_agent_id: r.primary_agent_id || r.primaryAgentId || null,
                        participants: Array.isArray(r.participants) ? r.participants : []
                    };
                });
                localStorage.setItem('chatRoomIndex', JSON.stringify(index));
            } catch (e) {}
        },
        getMyParticipant(room) {
            const parts = Array.isArray(room?.participants) ? room.participants : [];
            const meEmail = this.userInfo?.email || null;
            const meId = this.userInfo?.id || this.userInfo?.uid || null;
            return parts.find((p) => (meEmail && p?.email === meEmail) || (meId && p?.id === meId)) || null;
        },
        isUnreadRoom(room) {
            if (!room) return false;
            if (room?.message?.msg === 'NEW') return true;
            const me = this.getMyParticipant(room);
            return !!me?.isExistUnReadMessage;
        },
        async markRoomRead(room) {
            try {
                if (!room || !room.id) return;
                const me = this.getMyParticipant(room);
                if (me && me.isExistUnReadMessage) {
                    me.isExistUnReadMessage = false;
                    await backend.putObject('db://chat_rooms', room);
                }
                window.dispatchEvent(new CustomEvent('update-notification-badge', {
                    detail: { type: 'chat', value: false, id: room.id }
                }));
            } catch (e) {}
        },
        async markRoomReadById(roomId) {
            if (!roomId) return;
            const idx = this.chatRooms.findIndex((r) => r.id === roomId);
            if (idx === -1) {
                window.dispatchEvent(new CustomEvent('update-notification-badge', {
                    detail: { type: 'chat', value: false, id: roomId }
                }));
                return;
            }
            await this.markRoomRead(this.chatRooms[idx]);
        },
        async refreshChatsWatch() {
            try {
                if (!this.userInfo) return;
                if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                    await this.chatsWatchRef.unsubscribe();
                }
                this.chatsWatchRef = null;
                const roomIds = (this.chatRooms || []).map(r => r?.id).filter(Boolean);
                if (roomIds.length === 0) return;
                this.chatsWatchRef = await backend.watchChats((payload) => {
                    this.handleChatsRealtime(payload);
                }, {
                    filter: `id=in.(${roomIds.join(',')})`
                });
            } catch (e) {}
        },
        async handleChatsRealtime(payload) {
            try {
                if (!payload || !payload.new) return;
                if (!this.userInfo) return;
                const roomId = payload.new.id;
                const msg = payload.new.messages || null;
                if (!roomId || !msg) return;
                const idx = this.chatRooms.findIndex(r => r.id === roomId);
                if (idx === -1) return;
                const room = this.chatRooms[idx];
                room.message = room.message || {};
                room.message.msg = msg.messageForUser ? msg.messageForUser : msg.content;
                room.message.createdAt = msg.timeStamp;

                const isMine = (msg.email && this.userInfo?.email) ? (msg.email === this.userInfo.email) : false;
                if (!isMine && roomId !== this.currentChatRoomId) {
                    const me = this.getMyParticipant(room);
                    if (me) me.isExistUnReadMessage = true;
                    try { await backend.putObject('db://chat_rooms', room); } catch (e) {}
                    window.dispatchEvent(new CustomEvent('update-notification-badge', {
                        detail: { type: 'chat', value: true, id: roomId }
                    }));
                }

                this.chatRooms.sort((a, b) => {
                    const timeA = new Date(a.message?.createdAt || 0).getTime();
                    const timeB = new Date(b.message?.createdAt || 0).getTime();
                    return timeB - timeA;
                });
                this.saveChatRoomIndexToLocalStorage();
            } catch (e) {}
        },
        async loadChatRooms() {
            this.isLoadingChatRooms = true;
            try {
                if (!this.userInfo) {
                    this.userInfo = await backend.getUserInfo();
                }
                const rooms = await backend.getChatRoomList('chat_rooms');
                if (rooms && rooms.length > 0) {
                    const myRooms = rooms.filter((room) => {
                        if (!room.participants || room.participants.length < 2) return false;
                        const hasMe =
                            (!!this.userInfo?.email && room.participants.some((p) => p.email === this.userInfo.email)) ||
                            (!!this.userInfo?.uid && room.participants.some((p) => p.id === this.userInfo.uid)) ||
                            (!!this.userInfo?.id && room.participants.some((p) => p.id === this.userInfo.id));
                        return hasMe;
                    });
                    this.chatRooms = myRooms.sort((a, b) => {
                        const timeA = new Date(a.message?.createdAt || 0).getTime();
                        const timeB = new Date(b.message?.createdAt || 0).getTime();
                        return timeB - timeA;
                    });
                    this.saveChatRoomIndexToLocalStorage();
                } else {
                    this.chatRooms = [];
                    this.saveChatRoomIndexToLocalStorage();
                }
            } catch (error) {
                this.chatRooms = [];
            } finally {
                this.isLoadingChatRooms = false;
                await this.refreshChatsWatch();
            }
        },
        async openChatRoom(room) {
            if (!room || !room.id) return;
            try {
                await this.markRoomRead(room);
                const participants = Array.isArray(room.participants) ? room.participants : [];
                const hasSystem = participants.some((p) => p?.id === 'system_id' || p?.email === 'system@uengine.org');
                if (hasSystem) {
                    const path = this.$route?.path || '';
                    if (!path.startsWith('/definition-map')) {
                        await this.$router.push({ path: '/definition-map' });
                        setTimeout(() => this.EventBus.emit('open-history-room', room), 0);
                    } else {
                        this.EventBus.emit('open-history-room', room);
                    }
                    return;
                }
                const explicitPrimaryAgentId = room.primary_agent_id || room.primaryAgentId || null;
                if (explicitPrimaryAgentId) {
                    await this.$router.push({
                        path: `/agent-chat/${explicitPrimaryAgentId}`,
                        query: { roomId: room.id },
                        hash: '#chat'
                    });
                    return;
                }
                const agentIds = participants
                    .map((p) => p?.id)
                    .filter(Boolean)
                    .filter((id) => !!this.defaultSetting?.getAgentById?.(id));
                if (agentIds.length === 1) {
                    await this.$router.push({
                        path: `/agent-chat/${agentIds[0]}`,
                        query: { roomId: room.id },
                        hash: '#chat'
                    });
                    return;
                }
                if (agentIds.length > 1) {
                    this.pendingRoomToOpen = room;
                    this.agentCandidates = agentIds.map((id) => this.defaultSetting.getAgentById(id)).filter(Boolean);
                    this.agentSelectDialog = true;
                    return;
                }
                const meEmail = this.userInfo?.email || null;
                const meId = this.userInfo?.id || this.userInfo?.uid || null;
                const others = participants.filter((p) => {
                    if (!p) return false;
                    if (meEmail && p.email && p.email === meEmail) return false;
                    if (meId && p.id && p.id === meId) return false;
                    return true;
                });
                if (others.length === 1 && !this.defaultSetting?.getAgentById?.(others[0]?.id)) {
                    let targetUser = others[0];
                    if (!targetUser.profile && targetUser.email) {
                        try {
                            const userList = await backend.getUserList(null);
                            const foundUser = userList?.find(u => u.email === targetUser.email);
                            if (foundUser?.profile) {
                                targetUser = { ...targetUser, profile: foundUser.profile };
                            }
                        } catch (e) {}
                    }
                    const path = this.$route?.path || '';
                    const payload = { user: targetUser, roomId: room.id };
                    if (!path.startsWith('/definition-map')) {
                        await this.$router.push({ path: '/definition-map' });
                        setTimeout(() => this.EventBus.emit('open-user-conversation', payload), 0);
                    } else {
                        this.EventBus.emit('open-user-conversation', payload);
                    }
                    return;
                }
                const path = this.$route?.path || '';
                if (!path.startsWith('/definition-map')) {
                    await this.$router.push({ path: '/definition-map' });
                    setTimeout(() => this.EventBus.emit('open-history-room', room), 0);
                } else {
                    this.EventBus.emit('open-history-room', room);
                }
            } catch (e) {}
        },
        async selectAgentForRoom(agentId) {
            const room = this.pendingRoomToOpen;
            this.agentSelectDialog = false;
            this.pendingRoomToOpen = null;
            this.agentCandidates = [];
            if (!room || !agentId) return;
            await this.$router.push({
                path: `/agent-chat/${agentId}`,
                query: { roomId: room.id },
                hash: '#chat'
            });
        },
        truncateMessage(msg) {
            if (!msg) return '';
            if (msg === 'NEW') return '새 대화';
            const maxLength = 30;
            return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
        },
        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            if (diff < 60 * 1000) return '방금';
            if (diff < 60 * 60 * 1000) {
                const minutes = Math.floor(diff / (60 * 1000));
                return `${minutes}분 전`;
            }
            if (diff < 24 * 60 * 60 * 1000) {
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        },
    }
};
</script>

<style scoped>
.chat-room-item {
    cursor: pointer;
}
.chat-room-item--unread :deep(.chat-room-title),
.chat-room-item--unread :deep(.chat-room-subtitle),
.chat-room-item--unread :deep(.chat-room-date) {
    font-weight: 700;
    color: rgba(0, 0, 0, 0.87);
}
.chat-room-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.62);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chat-room-subtitle {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.52);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chat-room-date {
    font-size: 11px;
    white-space: nowrap;
    color: rgba(0, 0, 0, 0.45);
}
.chat-room-item :deep(.v-list-item__prepend) {
    margin-inline-end: 8px !important;
}
.chat-room-item :deep(.v-list-item__append) {
    margin-inline-start: 8px !important;
}
.chat-room-item :deep(.v-list-item__content) {
    padding-inline-end: 0 !important;
}
</style>
