<template>
    <div class="agent-chat-rooms">
        <div class="tabs-container">
            <v-tabs v-model="currentTabIndex" class="room-tabs">
                <v-tab
                    v-for="(tab, index) in tabs"
                    :key="tab.id"
                    :value="index"
                    @mouseenter="hoveredTabIndex = index"
                    @mouseleave="hoveredTabIndex = null"
                >
                    <div class="tab-content-wrapper">
                        <span class="tab-title">{{ tab.title }}</span>
                        <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            class="tab-close-btn"
                            @click.stop="removeRoom(index)"
                            v-show="hoveredTabIndex === index && tabs.length > 1"
                        >
                            <v-icon size="small">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </v-tab>
            </v-tabs>
            <div>
                <v-btn
                    icon
                    variant="text"
                    size="small"
                    class="participants-btn"
                    @click="openParticipantsDialog"
                >
                    <v-icon>mdi-account-multiple-plus-outline</v-icon>
                </v-btn>
                <v-btn
                    icon
                    variant="text"
                    size="small"
                    class="add-tab-btn"
                    @click="addNewRoom()"
                >
                    <v-icon>mdi-plus</v-icon>
                </v-btn>
                <v-tooltip activator="parent" location="bottom">
                    <span>새 대화 시작</span>
                </v-tooltip>
            </div>
        </div>

        <div class="chat-body">
            <Chat
                :messages="messages"
                :userInfo="userInfo"
                :userList="userList"
                :currentChatRoom="currentChatRoom"
                :chatRoomId="currentRoomId || ''"
                type="chats"
                :disableChat="false"
                @sendMessage="beforeSendMessage"
            />
        </div>

        <!-- 참가자(초대) 관리 -->
        <v-dialog v-model="participantsDialog" persistent max-width="600px">
            <v-card class="pa-4">
                <v-row class="ma-0 pa-0">
                    <v-card-title class="pa-0">참가자 관리</v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="participantsDialog = false" icon variant="text" density="comfortable"
                        style="margin-top:-8px;"
                    >
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-card-text class="ma-0 pa-0 pb-2 pt-4">
                    <v-autocomplete
                        v-model="participantsDraft"
                        :items="userList"
                        chips
                        closable-chips
                        item-title="username"
                        :item-value="item => item"
                        multiple
                        label="참가자 선택"
                        small-chips
                        :loading="isLoadingUsers"
                    >
                        <template v-slot:chip="{ props, item }">
                            <v-chip
                                v-bind="props"
                                :text="item.raw.username ? item.raw.username : item.raw.email"
                            />
                        </template>
                        <template v-slot:item="{ props, item }">
                            <v-list-item
                                v-bind="props"
                                :title="item.raw.username ? item.raw.username : item.raw.email"
                                :subtitle="item.raw.email || ('ID: ' + item.raw.id)"
                            />
                        </template>
                    </v-autocomplete>
                    <div class="text-caption text-grey mt-2">
                        - 내 계정은 항상 참가자로 유지됩니다.
                    </div>
                </v-card-text>
                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" rounded @click="saveParticipants" variant="flat">
                        저장
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Chat from '@/components/ui/Chat.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'AgentChatRooms',
    components: { Chat },
    props: {
        agentInfo: {
            type: Object,
            required: true
        }
    },
    data() {
        return {
            userInfo: null,
            agentUser: null,
            userList: [],
            isLoadingUsers: false,
            chatsWatchRef: null,

            chatRooms: [],
            tabs: [],
            currentTabIndex: 0,
            hoveredTabIndex: null,

            currentRoomId: null,
            messages: [],
            currentChatRoom: null,
            isLoadingRooms: false,

            participantsDialog: false,
            participantsDraft: [],
        };
    },
    watch: {
        '$route.query.roomId': {
            async handler(newRoomId) {
                if (newRoomId) {
                    await this.openRoomFromRoute(newRoomId);
                }
            }
        },
        currentTabIndex: {
            async handler(newIdx) {
                const tab = this.tabs[newIdx];
                if (!tab) return;
                if (!tab.roomId) {
                    // 드래프트 탭: 아직 DB에 방이 없음
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants || [] };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                    return;
                }
                await this.selectRoomById(tab.roomId);
            }
        }
    },
    async mounted() {
        await this.bootstrap();
    },
    beforeUnmount() {
        try {
            if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                this.chatsWatchRef.unsubscribe();
            }
        } catch (e) {}
        this.EventBus.emit('chat-room-unselected');
    },
    methods: {
        async subscribeToCurrentRoom(roomId) {
            try {
                if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                    await this.chatsWatchRef.unsubscribe();
                }
            } catch (e) {}
            this.chatsWatchRef = null;
            if (!roomId) return;
            this.chatsWatchRef = await backend.watchChats((payload) => {
                this.handleRealtimeMessage(payload);
            }, { filter: `id=eq.${roomId}` });
        },
        handleRealtimeMessage(payload) {
            try {
                if (!payload || !payload.new) return;
                if (payload.eventType === 'DELETE') {
                    const oldUuid = payload.old?.uuid;
                    if (!oldUuid) return;
                    const idx = this.messages.findIndex(m => m.uuid === oldUuid);
                    if (idx !== -1) this.messages.splice(idx, 1);
                    return;
                }

                const roomId = payload.new.id;
                if (!this.currentRoomId || roomId !== this.currentRoomId) return;
                const incoming = payload.new.messages;
                if (!incoming) return;
                const uuid = payload.new.uuid || incoming.uuid;
                if (!uuid) return;

                const exists = this.messages.findIndex(m => m.uuid === uuid);
                if (exists !== -1) {
                    this.messages[exists] = incoming;
                    return;
                }
                this.messages.push(incoming);
                this.messages.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
            } catch (e) {
                // ignore
            }
        },
        async bootstrap() {
            this.userInfo = await backend.getUserInfo();
            // agentInfo에 email/username이 없을 수 있어 보완
            try {
                this.agentUser = this.agentInfo?.email ? this.agentInfo : await backend.getUserById(this.agentInfo?.id);
            } catch (e) {
                this.agentUser = this.agentInfo;
            }

            await this.loadUserList();
            await this.loadChatRooms();
            if (this.tabs.length === 0) {
                // 최초 진입 시: 방을 만들지 않고 드래프트 탭만 생성
                this.addDraftTab();
            }
            const roomIdFromRoute = this.$route?.query?.roomId;
            if (roomIdFromRoute) {
                await this.openRoomFromRoute(roomIdFromRoute);
                return;
            }

            const tab = this.tabs[this.currentTabIndex];
            if (tab?.roomId) await this.selectRoomById(tab.roomId);
            else {
                this.currentRoomId = null;
                this.currentChatRoom = { id: null, name: tab?.title || '새 대화', participants: tab?.participants || [] };
            }
        },

        async openRoomFromRoute(roomId) {
            if (!roomId) return;
            // 로드된 탭 중에 있으면 해당 탭 선택
            const idx = this.tabs.findIndex(t => t.roomId === roomId);
            if (idx !== -1) {
                this.currentTabIndex = idx;
                await this.selectRoomById(roomId);
                return;
            }
            // 없으면 직접 로드 시도
            try {
                const rooms = await backend.getChatRoomList('chat_rooms');
                const found = (rooms || []).find(r => r.id === roomId);
                if (found) {
                    // 내/에이전트 매칭되는 방이면 탭에 추가
                    const parts = Array.isArray(found.participants) ? found.participants : [];
                    const hasMe = parts.some(p => this.participantMatches(p, this.userInfo));
                    const hasAgent = parts.some(p => this.participantMatches(p, this.agentUser));
                    if (hasMe && hasAgent) {
                        this.tabs.unshift({
                            id: found.id,
                            roomId: found.id,
                            title: found.name || '새 대화',
                            participants: parts
                        });
                        this.chatRooms.unshift(found);
                        this.currentTabIndex = 0;
                        await this.selectRoomById(found.id);
                    }
                }
            } catch (e) {
                // ignore
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
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null
            };
        },

        participantMatches(participant, user) {
            const pId = participant?.id || null;
            const pEmail = participant?.email || null;
            const uId = user?.id || user?.uid || null;
            const uEmail = user?.email || null;
            return (pId && uId && pId === uId) || (pEmail && uEmail && pEmail === uEmail);
        },

        truncateText(text, max = 20) {
            const t = (text || '').toString().trim();
            if (!t) return '';
            return t.length > max ? t.slice(0, max) + '...' : t;
        },

        async putObject(path, obj, options) {
            await backend.putObject(`db://${path}`, obj, options);
        },

        async loadUserList() {
            this.isLoadingUsers = true;
            try {
                const list = await backend.getUserList({});
                this.userList = Array.isArray(list) ? list : [];
            } catch (e) {
                this.userList = [];
            } finally {
                this.isLoadingUsers = false;
            }
        },

        defaultParticipants() {
            const me = this.normalizeParticipant(this.userInfo);
            const agent = this.normalizeParticipant(this.agentUser);
            // 기본: 나 + 선택 에이전트
            const participants = [];
            if (agent && (agent.id || agent.email)) participants.push(agent);
            if (me && (me.id || me.email)) participants.push(me);
            return participants;
        },

        async loadChatRooms() {
            this.isLoadingRooms = true;
            try {
                const rooms = await backend.getChatRoomList('chat_rooms');
                const me = this.userInfo;
                const agent = this.agentUser;

                const filtered = (rooms || []).filter((room) => {
                    const parts = Array.isArray(room.participants) ? room.participants : [];
                    const hasMe = parts.some((p) => this.participantMatches(p, me));
                    const hasAgent = parts.some((p) => this.participantMatches(p, agent));
                    return hasMe && hasAgent;
                });

                // 최신순
                filtered.sort((a, b) => {
                    const timeA = new Date(a.message?.createdAt || 0).getTime();
                    const timeB = new Date(b.message?.createdAt || 0).getTime();
                    return timeB - timeA;
                });

                this.chatRooms = filtered;
                this.tabs = filtered.map((r) => ({
                    id: r.id,
                    roomId: r.id,
                    title: (r.name || '새 대화'),
                    participants: Array.isArray(r.participants) ? r.participants : []
                }));
            } finally {
                this.isLoadingRooms = false;
            }
        },

        async selectRoomById(roomId) {
            if (!roomId) return;
            this.currentRoomId = roomId;
            this.EventBus.emit('chat-room-selected', roomId);
            const room = this.chatRooms.find((r) => r.id === roomId) || { id: roomId };
            this.currentChatRoom = room;
            await this.loadMessages(roomId);
            await this.subscribeToCurrentRoom(roomId);
        },

        async loadMessages(roomId) {
            this.messages = [];
            try {
                const rows = await backend.getMessages(roomId);
                if (rows && rows.length > 0) {
                    const all = rows.map((row) => {
                        const m = row.messages || {};
                        m.uuid = row.uuid || m.uuid || this.uuid();
                        return m;
                    });
                    all.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                    this.messages = all;
                }
            } finally {
            }
        },

        addDraftTab() {
            const tabId = this.uuid();
            const title = '새 대화';
            this.tabs.unshift({
                id: tabId,
                roomId: null,
                title,
                participants: this.defaultParticipants()
            });
            this.currentTabIndex = 0;
        },

        async addNewRoom() {
            // 탭 추가 시에는 방을 만들지 않고 드래프트 탭만 생성
            this.addDraftTab();
            this.currentRoomId = null;
            this.currentChatRoom = { id: null, name: this.tabs[0].title, participants: this.tabs[0].participants };
            this.messages = [];
            this.EventBus.emit('chat-room-unselected');
        },

        async removeRoom(tabIndex) {
            if (this.tabs.length <= 1) return;
            const tab = this.tabs[tabIndex];
            if (!tab) return;

            this.tabs.splice(tabIndex, 1);
            if (tab.roomId) {
                const roomId = tab.roomId;
                await backend.delete(`chats/${roomId}`, { key: 'id' });
                await backend.delete(`chat_rooms/${roomId}`, { key: 'id' });
                this.chatRooms = this.chatRooms.filter((r) => r.id !== roomId);
            }

            if (this.currentRoomId && tab.roomId && this.currentRoomId === tab.roomId) {
                if (this.tabs.length > 0) {
                    this.currentTabIndex = Math.min(this.currentTabIndex, this.tabs.length - 1);
                    const next = this.tabs[this.currentTabIndex];
                    if (next.roomId) {
                        await this.selectRoomById(next.roomId);
                    } else {
                        this.currentRoomId = null;
                        this.currentChatRoom = { id: null, name: next.title, participants: next.participants || [] };
                        this.messages = [];
                        this.EventBus.emit('chat-room-unselected');
                    }
                } else {
                    this.currentRoomId = null;
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                }
            }

            this.EventBus.emit('chat-rooms-updated');
        },

        openParticipantsDialog() {
            const tab = this.tabs[this.currentTabIndex];
            if (!tab) return;
            const current = tab.roomId
                ? (this.chatRooms.find((r) => r.id === tab.roomId)?.participants || [])
                : (tab.participants || []);
            this.participantsDraft = [...current];
            this.participantsDialog = true;
        },

        async saveParticipants() {
            const tab = this.tabs[this.currentTabIndex];
            if (!tab) return;

            // 내 계정은 항상 포함
            const me = this.normalizeParticipant(this.userInfo);
            const hasMe = (this.participantsDraft || []).some((p) => this.participantMatches(p, me));
            const nextParticipants = hasMe ? this.participantsDraft : [...(this.participantsDraft || []), me];

            tab.participants = nextParticipants;
            this.participantsDialog = false;

            // 이미 생성된 방이면 DB 업데이트
            if (tab.roomId) {
                const room = this.chatRooms.find((r) => r.id === tab.roomId);
                if (room) {
                    room.participants = nextParticipants;
                    await this.putObject('chat_rooms', room);
                    this.currentChatRoom = room;
                    this.EventBus.emit('chat-rooms-updated');
                }
            } else {
                // 드래프트 탭: 메모리만 업데이트
                this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants };
            }
        },

        async ensureRoomCreatedOnFirstMessage() {
            const tab = this.tabs[this.currentTabIndex];
            if (!tab) return null;
            if (tab.roomId) return tab.roomId;

            const roomId = this.uuid();
            const now = Date.now();
            const participants = Array.isArray(tab.participants) && tab.participants.length > 0
                ? tab.participants
                : this.defaultParticipants();

            const room = {
                id: roomId,
                name: '새 대화',
                // 라우팅/대표 에이전트 식별용 (좌측 채팅 목록에서 사용)
                primary_agent_id: this.agentUser?.id || null,
                participants,
                message: {
                    msg: 'NEW',
                    type: 'text',
                    createdAt: now
                }
            };

            await this.putObject('chat_rooms', room);

            // 탭/상태 반영
            tab.roomId = roomId;
            this.currentRoomId = roomId;
            this.currentChatRoom = room;
            this.chatRooms.unshift(room);

            this.EventBus.emit('chat-rooms-updated');
            this.EventBus.emit('chat-room-selected', roomId);
            await this.subscribeToCurrentRoom(roomId);
            return roomId;
        },

        async beforeSendMessage(payload) {
            // payload: { text, images, file }
            const text = (payload?.text || '').trim();
            const hasImages = Array.isArray(payload?.images) && payload.images.length > 0;
            const hasFile = !!payload?.file;
            if (!text && !hasImages && !hasFile) return;

            const roomId = await this.ensureRoomCreatedOnFirstMessage();
            if (!roomId) return;

            const nowIso = new Date().toISOString();
            const msgUuid = this.uuid();

            const msg = {
                uuid: msgUuid,
                role: 'user',
                content: text || (hasFile ? '첨부된 파일을 확인해주세요.' : '첨부된 내용을 확인해주세요.'),
                timeStamp: nowIso,
                email: this.userInfo?.email || null,
                // notifications 트리거/기존 UI 호환 (NEW.messages->>'name')
                name: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                userName: this.userInfo?.username || this.userInfo?.name || this.userInfo?.email || '',
                images: payload?.images || [],
                pdfFile: payload?.file || null
            };

            await this.putObject(`chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

            // room last message + name 업데이트
            const room = this.chatRooms.find((r) => r.id === roomId) || this.currentChatRoom;
            if (room) {
                room.message = {
                    msg: (msg.content || '').substring(0, 50),
                    type: 'text',
                    createdAt: nowIso
                };
                const currentName = (room.name || '').trim();
                const isDefaultName = !currentName || currentName === '새 대화';
                if (isDefaultName && text) {
                    room.name = this.truncateText(text, 20);
                    const t = this.tabs.find((x) => x.roomId === roomId);
                    if (t) t.title = room.name;
                }
                await this.putObject('chat_rooms', room);
            }

            this.messages.push(msg);
            this.EventBus.emit('chat-rooms-updated');
        }
    }
};
</script>

<style scoped>
.agent-chat-rooms {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.tabs-container {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    padding: 8px 8px 0 8px;
}

.room-tabs {
    flex: 1;
}

.tab-content-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
}

.tab-title {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-close-btn {
    opacity: 0.7;
}

.chat-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}
</style>
