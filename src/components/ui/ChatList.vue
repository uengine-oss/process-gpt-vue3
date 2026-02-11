<template>
    <!-- 대화 목록 -->
    <div class="d-flex align-center mt-3 ml-2">
        <div style="font-size:14px;" class="text-medium-emphasis cp-menu">
            {{ $t('VerticalSidebar.chatList') || '채팅' }}
        </div>
        <div class="sidebar-title-icon" @click.stop="toggleSearch">
            <Icons
                :icon="searchOpen ? 'close' : 'search'"
                :size="14"
                :color="'#808080'"
                style="width: 14px; height: 14px;"
            />
        </div>
        <div class="sidebar-title-icon" @click.stop="openCreateDialog">
            <Icons
                :icon="'plus'"
                :size="14"
                :color="'#808080'"
                style="width: 14px; height: 14px;"
            />
        </div>
    </div>

    <v-expand-transition>
        <div v-show="searchOpen" class="px-3 pt-2">
            <v-text-field
                v-model="searchText"
                variant="solo-filled"
                density="compact"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                style="margin-bottom: 10px;"
                :placeholder="$t('chatListing.search') || '검색'"
                ref="searchInput"
            />
        </div>
    </v-expand-transition>
    <div class="chat-room-list">
        <div v-if="isLoadingChatRooms" class="d-flex align-center pl-4 pr-4 py-2 text-caption text-grey">
            <v-progress-circular indeterminate color="primary" :size="16" />
            <span class="ml-2">{{ $t('VerticalSidebar.chatLoading') || '불러오는 중...' }}</span>
        </div>
        <div v-else-if="filteredChatRooms.length === 0" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ (searchText && searchText.trim()) ? ($t('VerticalSidebar.chatEmpty') || '검색 결과가 없습니다.') : ($t('VerticalSidebar.chatEmpty') || '대화가 없습니다.') }}
        </div>
        <ExpandableList
            v-else
            :items="filteredChatRooms"
            :limit="5"
            :incremental="true"
            :step="10"
        >
            <template #items="{ displayedItems }">
                <v-list density="compact" class="pa-0">
                    <v-list-item
                        v-for="room in displayedItems"
                        :key="room.id"
                        class="chat-room-item"
                        :class="{
                            'chat-room-item--active': room.id === currentChatRoomId,
                            'chat-room-item--unread': isUnreadRoom(room) && room.id !== currentChatRoomId
                        }"
                        @click="openChatRoom(room)"
                    >
                        <template v-slot:prepend>
                            <v-avatar size="28" color="grey-lighten-3" class="chat-room-avatar">
                                <template v-if="getDisplayParticipants(room).length === 1">
                                    <img
                                        :src="getParticipantProfile(getDisplayParticipants(room)[0])"
                                        :alt="getParticipantAlt(getDisplayParticipants(room)[0])"
                                        class="avatar-img"
                                    />
                                </template>
                                <template v-else-if="getDisplayParticipants(room).length > 1">
                                    <div class="avatar-grid">
                                        <div
                                            v-for="(p, idx) in getDisplayParticipants(room).slice(0, 4)"
                                            :key="(p && (p.id || p.email)) || idx"
                                            class="avatar-grid__cell"
                                        >
                                            <img
                                                :src="getParticipantProfile(p)"
                                                :alt="getParticipantAlt(p)"
                                                class="avatar-img"
                                            />
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    <v-icon size="16" color="primary">mdi-account-multiple</v-icon>
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

    <!-- 새 채팅방 생성 -->
    <v-dialog v-model="createDialog" persistent max-width="600px">
        <v-card class="pa-4">
            <v-row class="ma-0 pa-0">
                <v-card-title class="pa-0">
                    {{ $t('chatListing.create') || '새 채팅방' }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="createDialog = false" icon variant="text" density="comfortable" style="margin-top:-8px;">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>
            <v-card-text class="ma-0 pa-0 pb-2 pt-4">
                <v-text-field
                    v-model="createObj.name"
                    :label="$t('chatListing.chatRoomName') || '채팅방 이름'"
                    density="compact"
                />
                <v-autocomplete
                    v-model="createObj.participants"
                    :items="userList"
                    chips
                    closable-chips
                    color="blue-grey-lighten-2"
                    item-title="username"
                    :item-value="item => item"
                    multiple
                    :label="$t('chatListing.selectParticipants') || '참여자 선택'"
                    small-chips
                    :loading="isLoadingUsers"
                >
                    <template v-slot:chip="{ props, item }">
                        <v-chip v-if="item.raw.profile" v-bind="props" :prepend-avatar="item.raw.profile" :text="item.raw.username ? item.raw.username:item.raw.email"></v-chip>
                        <v-chip v-else-if="item.raw.id == 'system_id'" v-bind="props" prepend-avatar="/images/chat-icon.png" text="System"></v-chip>
                        <v-chip v-else v-bind="props" prepend-icon="mdi-account-circle" :text="item.raw.username ? item.raw.username:item.raw.email"></v-chip>
                    </template>

                    <template v-slot:item="{ props, item }">
                        <v-list-item v-if="item.raw.profile" v-bind="props" :prepend-avatar="item.raw.profile" :title="item.raw.username ? item.raw.username:item.raw.email"
                            :subtitle="item.raw.email"></v-list-item>
                        <v-list-item v-else-if="item.raw.id == 'system_id'" v-bind="props" prepend-avatar="/images/chat-icon.png" title="System"></v-list-item>
                        <v-list-item v-else v-bind="props" :title="item.raw.username ? item.raw.username:item.raw.email"
                            :subtitle="item.raw.email">
                            <template v-slot:prepend>
                                <v-icon style="position: relative; margin-right: 10px; margin-left: -3px;" size="48">mdi-account-circle</v-icon>
                            </template>
                        </v-list-item>
                    </template>
                </v-autocomplete>
                <div class="text-caption text-grey mt-2">
                    - 내 계정은 자동으로 포함됩니다.
                </div>
            </v-card-text>
            <v-row class="ma-0 pa-0">
                <v-spacer></v-spacer>
                <v-btn color="primary" rounded @click="createChatRoom" variant="flat">
                    {{ $t('chatListing.create') || '생성' }}
                </v-btn>
            </v-row>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';
import { useDefaultSetting } from '@/stores/defaultSetting';
import { processGptAgent } from '@/constants/processGptAgent';

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
        // 상대시간(~분 전) UI 갱신용 tick (1분 단위로 업데이트)
        nowTick: Date.now(),
        _nowTickTimeout: null,
        _nowTickInterval: null,
        // 검색/생성
        searchOpen: false,
        searchText: '',
        createDialog: false,
        createObj: {
            name: '',
            participants: []
        },
        userList: [],
        isLoadingUsers: false,
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
        // 1분 경계에 맞춰 nowTick 갱신(분/시간/날짜 표시가 새로고침 없이 바뀌도록)
        try {
            const schedule = () => {
                // 다음 분 시작까지 남은 ms
                const now = new Date();
                const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
                this._nowTickTimeout = setTimeout(() => {
                    this.nowTick = Date.now();
                    // 이후엔 매 60초마다 갱신
                    this._nowTickInterval = setInterval(() => {
                        this.nowTick = Date.now();
                    }, 60 * 1000);
                }, Math.max(50, msToNextMinute));
            };
            schedule();
        } catch (e) {}

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
            if (this._nowTickTimeout) clearTimeout(this._nowTickTimeout);
            if (this._nowTickInterval) clearInterval(this._nowTickInterval);
        } catch (e) {}
        try {
            if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                this.chatsWatchRef.unsubscribe();
            }
        } catch (e) {}
    },
    computed: {
        filteredChatRooms() {
            const q = (this.searchText || '').toString().trim().toLowerCase();
            const rooms = Array.isArray(this.chatRooms) ? this.chatRooms : [];
            if (!q) return rooms;
            return rooms.filter((room) => {
                if (!room) return false;
                const name = (room.name || '').toString().toLowerCase();
                const msg = (room.message?.msg || '').toString().toLowerCase();
                const participants = Array.isArray(room.participants) ? room.participants : [];
                const parts = participants
                    .map((p) => `${p?.username || ''} ${p?.name || ''} ${p?.email || ''} ${p?.id || ''}`.toLowerCase())
                    .join(' ');
                return name.includes(q) || msg.includes(q) || parts.includes(q);
            });
        }
    },
    methods: {
        toggleSearch() {
            this.searchOpen = !this.searchOpen;
            if (this.searchOpen) {
                this.$nextTick(() => {
                    try {
                        this.$refs.searchInput?.focus?.();
                    } catch (e) {}
                });
            } else {
                this.searchText = '';
            }
        },
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        normalizeParticipant(p) {
            if (!p) return null;
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null,
                agent_type: p?.agent_type || p?.agentType || null,
                is_agent: p?.is_agent ?? p?.isAgent ?? null
            };
        },
        participantMatches(a, b) {
            if (!a || !b) return false;
            if (a.email && b.email && a.email === b.email) return true;
            if (a.id && b.id && a.id === b.id) return true;
            return false;
        },
        async loadUserList() {
            this.isLoadingUsers = true;
            try {
                const list = await backend.getUserList(null);
                const base = Array.isArray(list) ? list : [];
                const meEmail = this.userInfo?.email || null;
                const meId = this.userInfo?.id || this.userInfo?.uid || null;
                const withoutMe = base.filter((u) => {
                    const id = u?.id || u?.uid || null;
                    const email = u?.email || null;
                    if (meId && id && meId === id) return false;
                    if (meEmail && email && meEmail === email) return false;
                    return true;
                });

                // Process GPT Agent 최상단 고정
                const merged = [
                    processGptAgent,
                    ...withoutMe.filter(u => (u?.id || u?.uid) !== processGptAgent.id)
                ];
                this.userList = merged;
            } catch (e) {
                this.userList = [processGptAgent];
            } finally {
                this.isLoadingUsers = false;
            }
        },
        async openCreateDialog() {
            if (!this.userInfo) {
                try { this.userInfo = await backend.getUserInfo(); } catch (e) {}
            }
            if (!this.userList || this.userList.length === 0) {
                await this.loadUserList();
            }
            this.createObj = { name: '', participants: [] };
            this.createDialog = true;
        },
        async createChatRoom() {
            try {
                if (!this.userInfo) {
                    this.userInfo = await backend.getUserInfo();
                }
                const me = this.normalizeParticipant(this.userInfo);
                const selected = (this.createObj?.participants || []).map(this.normalizeParticipant).filter(Boolean);
                const participants = me && !selected.some(p => this.participantMatches(p, me))
                    ? [...selected, me].filter(Boolean)
                    : selected;

                if (!participants || participants.length < 2) return;

                const roomId = this.uuid();
                const now = Date.now();
                const roomName = (this.createObj?.name || '').toString().trim().substring(0, 50) || '새 대화';

                const agentIds = participants
                    .map((p) => p?.id)
                    .filter(Boolean)
                    .filter((id) => !!this.defaultSetting?.getAgentById?.(id));
                const primaryAgentId = agentIds.length > 0 ? agentIds[0] : null;

                const room = {
                    id: roomId,
                    name: roomName,
                    primary_agent_id: primaryAgentId,
                    participants,
                    message: { msg: 'NEW', type: 'text', createdAt: now }
                };

                await backend.putObject('db://chat_rooms', room);
                this.createDialog = false;

                // 즉시 목록/인덱스 반영 후 열기
                this.chatRooms = [room, ...(this.chatRooms || [])];
                this.saveChatRoomIndexToLocalStorage();
                this.EventBus.emit('chat-rooms-updated');
                await this.openChatRoom(room);
            } catch (e) {
                // ignore
            }
        },
        getBasePath() {
            try {
                return window.location.port === '' ? window.location.origin : '';
            } catch (e) {
                return '';
            }
        },
        isMeParticipant(p) {
            const meEmail = this.userInfo?.email || null;
            const meId = this.userInfo?.id || this.userInfo?.uid || null;
            if (!p) return false;
            if (meEmail && p.email && p.email === meEmail) return true;
            if (meId && p.id && p.id === meId) return true;
            return false;
        },
        getDisplayParticipants(room) {
            const participants = Array.isArray(room?.participants) ? room.participants : [];
            const others = participants.filter((p) => !this.isMeParticipant(p));
            // 기본: 내 제외 참여자(상대/에이전트/시스템)
            if (others.length > 0) return others;
            // 예외: 참여자 정보가 비정상인 경우라도 최소 1개는 보여주기
            return participants.filter(Boolean);
        },
        getParticipantProfile(participant) {
            const basePath = this.getBasePath();
            if (!participant) return `${basePath}/images/defaultUser.png`;

            // system
            if (participant?.id === 'system_id' || participant?.email === 'system@uengine.org') {
                return `${basePath}/images/chat-icon.png`;
            }

            // agent (id 기반)
            const agent = participant?.id ? this.defaultSetting?.getAgentById?.(participant.id) : null;
            const agentProfile = agent?.profile || null;

            // explicit profile
            const profile = participant?.profile || agentProfile || null;
            if (profile) {
                if (String(profile).includes('defaultUser.png')) return `${basePath}/images/defaultUser.png`;
                return profile;
            }

            return `${basePath}/images/defaultUser.png`;
        },
        getParticipantAlt(participant) {
            if (!participant) return 'participant';
            return participant?.username || participant?.name || participant?.email || participant?.id || 'participant';
        },
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
                // 에이전트 화면에서 넘어올 때 남아있는 hash(#chat) 제거
                try { if (window.location.hash) window.location.hash = ''; } catch (e) {}
                await this.$router.push({ path: '/chat', query: { roomId: room.id }, hash: '' });
            } catch (e) {
                console.log(e)
            }
        },
        truncateMessage(msg) {
            if (!msg) return '';
            if (msg === 'NEW') return '새 대화';
            const maxLength = 30;
            return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
        },
        formatDate(timestamp) {
            if (!timestamp) return '';
            // nowTick을 참조해 렌더를 강제로 갱신(상대시간 자동 업데이트)
            void this.nowTick;
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
.chat-room-item:hover {
    background: #f8fafc;
}
.chat-room-item--active {
    background: rgba(var(--v-theme-primary), 0.10);
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

.avatar-grid {
    width: 100%;
    height: 100%;
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    border-radius: 9999px;
}
.avatar-grid__cell {
    width: 50%;
    height: 50%;
}
.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
</style>
