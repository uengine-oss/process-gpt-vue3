<template>
    <div class="user-chat-rooms">
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
                <v-menu
                    v-model="chatRoomSettingsMenu"
                    location="bottom end"
                    :close-on-content-click="true"
                >
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="small"
                            class="settings-btn"
                            :disabled="!tabs || tabs.length === 0"
                        >
                            <v-icon>mdi-cog-outline</v-icon>
                        </v-btn>
                    </template>
                    <v-card min-width="260" class="pa-2">
                        <div class="text-caption text-medium-emphasis px-2 pt-1 pb-1">
                            {{ $t('chatListing.setting') || '설정' }}
                        </div>
                        <v-list density="compact" class="pa-0">
                            <v-list-item @click="openChatRoomRenameDialog">
                                <template v-slot:prepend>
                                    <v-icon size="18">mdi-pencil-outline</v-icon>
                                </template>
                                <v-list-item-title>
                                    {{ $t('chatListing.chatRoomName') || '채팅방 이름 변경' }}
                                </v-list-item-title>
                            </v-list-item>
                            <v-list-item @click="openChatRoomParticipantsFromSettings">
                                <template v-slot:prepend>
                                    <v-icon size="18">mdi-account-multiple-plus-outline</v-icon>
                                </template>
                                <v-list-item-title>
                                    {{ $t('chatListing.selectParticipants') || '참가자 변경' }}
                                </v-list-item-title>
                            </v-list-item>
                            <v-divider class="my-1" />
                            <v-list-item @click="openChatRoomDeleteConfirm">
                                <template v-slot:prepend>
                                    <v-icon size="18" color="error">mdi-delete-outline</v-icon>
                                </template>
                                <v-list-item-title class="text-error">
                                    {{ $t('chatListing.delete') || '삭제' }}
                                </v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-card>
                </v-menu>
                <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="small"
                            class="add-tab-btn"
                            @click="addNewRoom()"
                        >
                            <v-icon>mdi-plus</v-icon>
                        </v-btn>
                    </template>
                    <span>새 대화 시작</span>
                </v-tooltip>
            </div>
        </div>

        <div class="chat-body">
            <Chat
                ref="chatView"
                :messages="messages"
                :userInfo="userInfo"
                :userList="userList"
                :currentChatRoom="currentChatRoom"
                :chatRoomId="currentRoomId || ''"
                type="chats"
                :disableChat="false"
                :hideInput="true"
                @sendMessage="beforeSendMessage"
            />
        </div>

        <div class="input-area">
            <UnifiedChatInput
                variant="inline"
                :showExamples="false"
                :disableChat="false"
                :userList="userList"
                :currentChatRoom="currentChatRoom"
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

        <!-- 채팅방 설정: 이름 변경 -->
        <v-dialog v-model="chatRoomRenameDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px;">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('chatListing.chatRoomName') || '채팅방 이름' }}
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="chatRoomRenameDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    <v-text-field
                        v-model="chatRoomRenameDraft"
                        :label="$t('chatListing.chatRoomName') || '채팅방 이름'"
                        density="compact"
                        variant="outlined"
                        hide-details
                        autofocus
                    />
                    <div class="text-caption text-medium-emphasis mt-2">
                        - 최대 50자까지 저장됩니다.
                    </div>
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="chatRoomRenameDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" rounded @click="confirmChatRoomRename">
                        {{ $t('chatListing.save') || '저장' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 채팅방 설정: 삭제 확인 -->
        <v-dialog v-model="chatRoomDeleteDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px;">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('chatListing.deleteChatRoom') || '채팅방 삭제' }}
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="chatRoomDeleteDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    "{{ getCurrentChatRoomName() }}" {{ $t('chatListing.confirmDeleteChatRoom') || '채팅방을 삭제하시겠습니까?' }}
                    <div class="text-caption text-medium-emphasis mt-2">
                        - 삭제하면 복구할 수 없습니다.
                    </div>
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="chatRoomDeleteDialog = false">취소</v-btn>
                    <v-btn color="error" variant="flat" rounded @click="confirmChatRoomDelete">
                        {{ $t('chatListing.delete') || '삭제' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Chat from '@/components/ui/Chat.vue';
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'UserChatRooms',
    components: { Chat, UnifiedChatInput },
    props: {
        targetUser: {
            type: Object,
            required: true
        },
        initialRoomId: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            userInfo: null,
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

            // 채팅방 설정 메뉴/다이얼로그
            chatRoomSettingsMenu: false,
            chatRoomRenameDialog: false,
            chatRoomRenameDraft: '',
            chatRoomDeleteDialog: false
        };
    },
    watch: {
        initialRoomId: {
            immediate: true,
            async handler(newRoomId) {
                if (newRoomId) {
                    await this.openRoomById(newRoomId);
                }
            }
        },
        currentTabIndex: {
            async handler(newIdx) {
                const tab = this.tabs[newIdx];
                if (!tab) return;
                if (!tab.roomId) {
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants || [] };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                    return;
                }
                await this.selectRoomById(tab.roomId);
            }
        },
        targetUser: {
            async handler() {
                await this.bootstrap();
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
        scrollToBottomSafe() {
            try {
                this.$refs.chatView?.scrollToBottom?.();
            } catch (e) {}
        },
        getCurrentTab() {
            const idx = this.currentTabIndex ?? 0;
            return (Array.isArray(this.tabs) && this.tabs[idx]) ? this.tabs[idx] : null;
        },
        getCurrentChatRoomName() {
            const tab = this.getCurrentTab();
            const name = (this.currentChatRoom?.name || tab?.title || '').toString().trim();
            return name || '새 대화';
        },
        openChatRoomRenameDialog() {
            this.chatRoomSettingsMenu = false;
            this.chatRoomRenameDraft = this.getCurrentChatRoomName();
            this.chatRoomRenameDialog = true;
        },
        async confirmChatRoomRename() {
            const tab = this.getCurrentTab();
            const roomId = tab?.roomId || null;
            const nextName = String(this.chatRoomRenameDraft || '').trim().substring(0, 50);
            if (!nextName || !tab) {
                this.chatRoomRenameDialog = false;
                return;
            }
            // 드래프트/실방 모두 renameRoom로 통일
            await this.renameRoom(roomId, nextName);
            this.chatRoomRenameDialog = false;
        },
        openChatRoomParticipantsFromSettings() {
            this.chatRoomSettingsMenu = false;
            this.openParticipantsDialog();
        },
        openChatRoomDeleteConfirm() {
            this.chatRoomSettingsMenu = false;
            this.chatRoomDeleteDialog = true;
        },
        async confirmChatRoomDelete() {
            this.chatRoomDeleteDialog = false;
            const tab = this.getCurrentTab();
            const roomId = tab?.roomId || null;
            // 드래프트면 탭만 제거, 실제 방이면 기존 deleteRoom 사용
            if (!roomId) {
                if (this.tabs.length === 1) {
                    tab.title = '새 대화';
                    tab.participants = this.defaultParticipants();
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                    return;
                }
                this.tabs.splice(this.currentTabIndex, 1);
                if (this.currentTabIndex >= this.tabs.length) this.currentTabIndex = this.tabs.length - 1;
                const next = this.tabs[this.currentTabIndex];
                if (next?.roomId) await this.selectRoomById(next.roomId);
                else {
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: next?.title || '새 대화', participants: next?.participants || [] };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                }
                this.EventBus.emit('chat-rooms-updated');
                return;
            }
            await this.deleteRoom(roomId);
        },
        async renameRoom(roomId, newName) {
            const trimmed = String(newName || '').trim();
            if (!trimmed) return;
            const nextName = trimmed.substring(0, 50);

            // 탭 타이틀 업데이트
            const tabIdx = roomId ? this.tabs.findIndex(t => t.roomId === roomId) : this.currentTabIndex;
            const tab = tabIdx !== -1 ? this.tabs[tabIdx] : null;
            if (tab) {
                tab.title = this.truncateText(nextName);
            }

            // 현재 채팅방 상태 업데이트
            if (this.currentChatRoom && (!roomId || this.currentChatRoom.id === roomId)) {
                this.currentChatRoom.name = nextName;
            }

            // 실제 방이면 DB 저장
            if (roomId) {
                const room = this.chatRooms.find(r => r.id === roomId);
                if (room) {
                    room.name = nextName;
                    await this.putObject('chat_rooms', room);
                }
                this.EventBus.emit('chat-rooms-updated');
            }
        },
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
                this.$nextTick(() => this.scrollToBottomSafe());
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
        participantMatches(participant, user) {
            const pId = participant?.id || null;
            const pEmail = participant?.email || null;
            const uId = user?.id || user?.uid || null;
            const uEmail = user?.email || null;
            return (pId && uId && pId === uId) || (pEmail && uEmail && pEmail === uEmail);
        },
        normalizeParticipant(p) {
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null
            };
        },
        truncateText(text, maxLen = 18) {
            if (!text) return '';
            return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
        },
        async putObject(path, obj) {
            await backend.putObject(`db://${path}`, obj);
        },

        async bootstrap() {
            this.userInfo = await backend.getUserInfo();
            await this.loadInviteUserList();
            await this.loadChatRooms();

            if (this.tabs.length === 0) {
                this.addDraftTab();
            }

            if (this.initialRoomId) {
                await this.openRoomById(this.initialRoomId);
                return;
            }

            const tab = this.tabs[this.currentTabIndex];
            if (tab?.roomId) await this.selectRoomById(tab.roomId);
            else {
                this.currentRoomId = null;
                this.currentChatRoom = { id: null, name: tab?.title || '새 대화', participants: tab?.participants || [] };
            }
        },

        async loadInviteUserList() {
            this.isLoadingUsers = true;
            try {
                // 초대 목록은 유저+에이전트 모두 포함
                const list = await backend.getUserList(null);
                this.userList = Array.isArray(list) ? list : [];
            } catch (e) {
                this.userList = [];
            } finally {
                this.isLoadingUsers = false;
            }
        },

        defaultParticipants() {
            return [
                this.normalizeParticipant(this.targetUser),
                this.normalizeParticipant(this.userInfo)
            ];
        },

        async loadChatRooms() {
            this.isLoadingRooms = true;
            try {
                const rooms = await backend.getChatRoomList('chat_rooms');
                const me = this.userInfo;
                const target = this.targetUser;
                const filtered = (rooms || []).filter((room) => {
                    const participants = Array.isArray(room.participants) ? room.participants : [];
                    if (participants.length < 2) return false;
                    const hasMe = participants.some(p => this.participantMatches(p, me));
                    const hasTarget = participants.some(p => this.participantMatches(p, target));
                    return hasMe && hasTarget;
                });

                filtered.sort((a, b) => {
                    const timeA = new Date(a.message?.createdAt || 0).getTime();
                    const timeB = new Date(b.message?.createdAt || 0).getTime();
                    return timeB - timeA;
                });

                this.chatRooms = filtered;
                this.tabs = filtered.map((room) => ({
                    id: room.id,
                    roomId: room.id,
                    title: this.truncateText(room.name || '대화'),
                    participants: room.participants || []
                }));
            } catch (e) {
                this.chatRooms = [];
                this.tabs = [];
            } finally {
                this.isLoadingRooms = false;
            }
        },

        addDraftTab() {
            const tabId = this.uuid();
            const participants = this.defaultParticipants();
            this.tabs.unshift({
                id: tabId,
                roomId: null,
                title: '새 대화',
                participants
            });
            this.currentTabIndex = 0;
        },

        addNewRoom() {
            // DB에 즉시 생성하지 않고 드래프트만 추가
            this.addDraftTab();
            const tab = this.tabs[this.currentTabIndex];
            this.currentRoomId = null;
            this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants || [] };
            this.messages = [];
            this.EventBus.emit('chat-room-unselected');
        },

        async openRoomById(roomId) {
            if (!roomId) return;
            const idx = this.tabs.findIndex(t => t.roomId === roomId);
            if (idx !== -1) {
                this.currentTabIndex = idx;
                await this.selectRoomById(roomId);
                return;
            }
            // 탭에 없으면 새로 로드
            await this.loadChatRooms();
            const idx2 = this.tabs.findIndex(t => t.roomId === roomId);
            if (idx2 !== -1) {
                this.currentTabIndex = idx2;
                await this.selectRoomById(roomId);
            }
        },

        async selectRoomById(roomId) {
            this.currentRoomId = roomId;
            const room = this.chatRooms.find(r => r.id === roomId) || null;
            if (room) {
                this.currentChatRoom = room;
            } else {
                this.currentChatRoom = { id: roomId, name: '대화', participants: [] };
            }
            await this.loadMessages(roomId);
            await this.subscribeToCurrentRoom(roomId);
            this.EventBus.emit('chat-room-selected', roomId);
        },

        async loadMessages(roomId) {
            this.messages = [];
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
            this.$nextTick(() => this.scrollToBottomSafe());
        },

        openParticipantsDialog() {
            const tab = this.tabs[this.currentTabIndex];
            const parts = tab?.participants || this.defaultParticipants();
            // 내 계정은 항상 포함되도록
            const withMe = [...parts];
            const hasMe = withMe.some(p => this.participantMatches(p, this.userInfo));
            if (!hasMe) withMe.push(this.normalizeParticipant(this.userInfo));
            this.participantsDraft = withMe.map(p => {
                // autocomplete items와 shape 맞추기
                const u = this.userList.find(x => this.participantMatches(x, p));
                return u || p;
            });
            this.participantsDialog = true;
        },

        async saveParticipants() {
            const tab = this.tabs[this.currentTabIndex];
            if (!tab) return;

            const normalized = (this.participantsDraft || []).map(this.normalizeParticipant);
            const ensureMe = normalized.some(p => this.participantMatches(p, this.userInfo))
                ? normalized
                : [...normalized, this.normalizeParticipant(this.userInfo)];

            tab.participants = ensureMe;

            if (tab.roomId) {
                const room = this.chatRooms.find(r => r.id === tab.roomId);
                if (room) {
                    room.participants = ensureMe;
                    await this.putObject('chat_rooms', room);
                    this.currentChatRoom = room;
                    this.EventBus.emit('chat-rooms-updated');
                }
            }
            this.participantsDialog = false;
        },

        async ensureRoomCreatedOnFirstMessage(firstText) {
            const tab = this.tabs[this.currentTabIndex];
            if (!tab || tab.roomId) return tab?.roomId || null;

            const roomId = this.uuid();
            const now = Date.now();
            const participants = Array.isArray(tab.participants) && tab.participants.length >= 2
                ? tab.participants
                : this.defaultParticipants();

            const room = {
                id: roomId,
                name: '새 대화',
                participants,
                message: { msg: 'NEW', type: 'text', createdAt: now }
            };

            await this.putObject('chat_rooms', room);

            // 탭/상태 업데이트
            tab.roomId = roomId;
            tab.id = roomId;
            this.chatRooms.unshift(room);
            this.currentRoomId = roomId;
            this.currentChatRoom = room;
            this.EventBus.emit('chat-rooms-updated');
            this.EventBus.emit('chat-room-selected', roomId);
            await this.subscribeToCurrentRoom(roomId);

            // 첫 메시지 기반으로 방 이름 갱신(AgentChatRooms와 동일 정책)
            const trimmed = (firstText || '').trim();
            if (trimmed) {
                room.name = trimmed.substring(0, 50);
                tab.title = this.truncateText(room.name);
                await this.putObject('chat_rooms', room);
            }

            return roomId;
        },

        async beforeSendMessage(payload) {
            const text = (payload?.text || '').trim();
            const hasImages = Array.isArray(payload?.images) && payload.images.length > 0;
            const hasFile = !!payload?.file;
            if (!text && !hasImages && !hasFile) return;

            const roomId = await this.ensureRoomCreatedOnFirstMessage(text);
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

            // last message 업데이트
            const room = this.currentChatRoom;
            if (room) {
                room.message = { msg: (msg.content || '').substring(0, 50), type: 'text', createdAt: nowIso };
                await this.putObject('chat_rooms', room);
                // 탭 타이틀 최신화(이름이 바뀐 경우)
                const tab = this.tabs[this.currentTabIndex];
                if (tab && room.name) tab.title = this.truncateText(room.name);
            }

            this.messages.push(msg);
            this.EventBus.emit('chat-rooms-updated');
            this.$nextTick(() => this.scrollToBottomSafe());
        },

        async removeRoom(index) {
            if (this.tabs.length <= 1) return;
            const tab = this.tabs[index];
            const deletingRoomId = tab?.roomId || null;
            this.tabs.splice(index, 1);

            // 현재 탭 조정
            if (this.currentTabIndex >= this.tabs.length) {
                this.currentTabIndex = this.tabs.length - 1;
            }

            const next = this.tabs[this.currentTabIndex];
            if (next?.roomId) await this.selectRoomById(next.roomId);
            else {
                this.currentRoomId = null;
                this.currentChatRoom = { id: null, name: next?.title || '새 대화', participants: next?.participants || [] };
                this.messages = [];
                this.EventBus.emit('chat-room-unselected');
            }

            // 에이전트 대화모드와 동일하게: 탭 닫기=채팅방 삭제(드래프트는 제외)
            if (deletingRoomId) {
                try {
                    await backend.delete(`db://chats/${deletingRoomId}`, { key: 'id' });
                    await backend.delete(`db://chat_rooms/${deletingRoomId}`, { key: 'id' });
                    this.chatRooms = this.chatRooms.filter(r => r.id !== deletingRoomId);
                    this.EventBus.emit('chat-rooms-updated');
                } catch (e) {
                    // ignore
                }
            }
        }
        ,
        async deleteRoom(roomId) {
            if (!roomId) return;
            const idx = this.tabs.findIndex(t => t.roomId === roomId);
            // 헤더의 삭제 버튼은 "현재 방 삭제"이므로, 탭이 1개여도 삭제가 가능해야 함
            try {
                await backend.delete(`db://chats/${roomId}`, { key: 'id' });
                await backend.delete(`db://chat_rooms/${roomId}`, { key: 'id' });
            } catch (e) {
                // ignore
            }

            this.chatRooms = this.chatRooms.filter(r => r.id !== roomId);

            if (idx !== -1) {
                if (this.tabs.length === 1) {
                    // 마지막 탭이면 드래프트로 대체
                    this.tabs.splice(0, 1);
                    this.addDraftTab();
                } else {
                    // 2개 이상이면 기존 흐름대로 탭 제거
                    await this.removeRoom(idx);
                }
            }

            this.currentRoomId = null;
            this.currentChatRoom = { id: null, name: '새 대화', participants: this.defaultParticipants() };
            this.messages = [];
            this.EventBus.emit('chat-rooms-updated');
            this.EventBus.emit('chat-room-unselected');
        }
    }
};
</script>

<style scoped>
.user-chat-rooms {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.tabs-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
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

.chat-body {
    flex: 1;
    overflow: hidden;
    background: #f8fafc;
    min-height: 0;
}

.input-area {
    padding: 12px;
    border-top: 1px solid #e2e8f0;
    background: white;
    flex-shrink: 0;
}

.settings-btn,
.add-tab-btn {
    margin-left: 4px;
}
</style>
