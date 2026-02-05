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
import agentRouterService from '@/services/AgentRouterService';
import { getValidToken } from '@/utils/supabaseAuth';

const backend = BackendFactory.createBackend();

export default {
    name: 'AgentChatRooms',
    components: { Chat, UnifiedChatInput },
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
            agentStatuses: {}, // { [agentId]: { state, message, updatedAt } }

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
            chatRoomDeleteDialog: false,
        };
    },
    computed: {
        agentParticipants() {
            const parts = Array.isArray(this.currentChatRoom?.participants) ? this.currentChatRoom.participants : [];
            // 참가자 중 "agent" 타입만 대상으로 상태를 보여줌 (내 계정은 제외)
            const agents = parts
                .map(p => this.normalizeParticipant(p))
                .filter(p => p && (p.id || p.email))
                .filter(p => p.agent_type === 'agent' || p.is_agent === true || p.isAgent === true);

            // 중복 제거(id 기준)
            const uniq = new Map();
            agents.forEach(a => {
                const key = a.id || a.email;
                if (!uniq.has(key)) uniq.set(key, a);
            });

            // 기본적으로 "현재 화면의 agentUser"를 가장 앞에 오도록 정렬
            const primaryId = this.agentUser?.id || this.agentInfo?.id || null;
            return Array.from(uniq.values()).sort((a, b) => {
                if (primaryId && a.id === primaryId) return -1;
                if (primaryId && b.id === primaryId) return 1;
                return (a.username || '').localeCompare((b.username || ''), 'ko');
            });
        },
        primaryAgentId() {
            return this.agentUser?.id || this.agentInfo?.id || null;
        },
        primaryStatus() {
            const id = this.primaryAgentId;
            if (!id) return { state: 'unknown', message: '' };
            return this.getAgentStatus(id);
        }
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
            // 탭/현재방 이름 반영
            tab.title = this.truncateText(nextName, 20);
            if (this.currentChatRoom) this.currentChatRoom.name = nextName;

            // 실제 방이면 DB 업데이트
            if (roomId) {
                const room = this.chatRooms.find((r) => r.id === roomId);
                if (room) {
                    room.name = nextName;
                    await this.putObject('chat_rooms', room);
                    this.currentChatRoom = room;
                }
                this.EventBus.emit('chat-rooms-updated');
            }
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
            await this.deleteRoom(roomId);
        },
        async deleteRoom(roomId) {
            const idx = this.currentTabIndex ?? 0;
            const tab = this.tabs?.[idx] || null;
            if (!tab) return;

            // 드래프트 탭 삭제: 방이 없으므로 탭만 정리
            if (!roomId) {
                if (this.tabs.length === 1) {
                    // 마지막이면 "새 대화" 상태로 리셋
                    tab.title = '새 대화';
                    tab.participants = this.defaultParticipants();
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                    return;
                }
                this.tabs.splice(idx, 1);
            } else {
                // 실제 방 삭제(DB + 탭/목록 정리)
                try {
                    await backend.delete(`chats/${roomId}`, { key: 'id' });
                    await backend.delete(`chat_rooms/${roomId}`, { key: 'id' });
                } catch (e) {
                    // ignore
                }
                this.chatRooms = (this.chatRooms || []).filter(r => r.id !== roomId);
                const tabIdx = this.tabs.findIndex(t => t.roomId === roomId);
                if (tabIdx !== -1) this.tabs.splice(tabIdx, 1);
            }

            // 다음 탭/상태 조정
            if (!this.tabs || this.tabs.length === 0) {
                this.addDraftTab();
                this.currentRoomId = null;
                this.currentChatRoom = { id: null, name: this.tabs[0].title, participants: this.tabs[0].participants };
                this.messages = [];
                this.EventBus.emit('chat-room-unselected');
            } else {
                if (this.currentTabIndex >= this.tabs.length) {
                    this.currentTabIndex = this.tabs.length - 1;
                }
                const next = this.tabs[this.currentTabIndex];
                if (next?.roomId) {
                    await this.selectRoomById(next.roomId);
                } else {
                    this.currentRoomId = null;
                    this.currentChatRoom = { id: null, name: next?.title || '새 대화', participants: next?.participants || [] };
                    this.messages = [];
                    this.EventBus.emit('chat-room-unselected');
                }
            }

            this.EventBus.emit('chat-rooms-updated');
        },
        statusLabel(state) {
            switch (state) {
                case 'warming': return '준비 중 (파드 생성/시작)';
                case 'streaming': return '응답 생성 중';
                case 'ready': return '연결됨';
                case 'error': return '연결 오류';
                case 'unknown':
                default: return '대기';
            }
        },
        statusColor(state) {
            switch (state) {
                case 'warming': return 'warning';
                case 'streaming': return 'primary';
                case 'ready': return 'success';
                case 'error': return 'error';
                case 'unknown':
                default: return 'grey';
            }
        },
        getAgentStatus(agentId) {
            const v = this.agentStatuses?.[agentId];
            return v || { state: 'unknown', message: '' };
        },
        setAgentStatus(agentId, next) {
            if (!agentId) return;
            const prev = this.agentStatuses?.[agentId] || {};
            this.agentStatuses = {
                ...(this.agentStatuses || {}),
                [agentId]: {
                    ...prev,
                    ...next,
                    updatedAt: new Date().toISOString()
                }
            };
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
        async bootstrap() {
            this.userInfo = await backend.getUserInfo();
            // agentInfo에 email/username이 없을 수 있어 보완
            try {
                if (!this.agentInfo?.id && !this.agentInfo?.uid) {
                    this.agentUser = this.agentInfo;
                } else {
                    const agentId = this.agentInfo?.id || this.agentInfo?.uid;
                    this.agentUser = this.agentInfo?.email ? this.agentInfo : await backend.getUserById(agentId);
                }
            } catch (e) {
                this.agentUser = this.agentInfo;
            }

            await this.loadUserList();
            await this.loadChatRooms();
            if (this.tabs.length === 0) {
                // 최초 진입 시: 방을 만들지 않고 드래프트 탭만 생성
                this.addDraftTab();
            }

            // 방/탭과 무관하게: 에이전트 화면 접속 시 즉시 warmup 시작(상단 배너에 표시)
            this.warmupAgentsForCurrentRoom();

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

        async warmupAgent(agentId) {
            if (!agentId) return;
            // 이미 warming/ready/streaming이면 중복 warmup 스킵
            const current = this.getAgentStatus(agentId);
            if (current.state === 'warming' || current.state === 'ready' || current.state === 'streaming') return;

            this.setAgentStatus(agentId, { state: 'warming', message: '' });
            try {
                await agentRouterService.warmup(agentId);
                this.setAgentStatus(agentId, { state: 'ready', message: '' });
            } catch (e) {
                // warmup 실패해도 UI가 멈추지 않게만 처리 (전송 시 재시도)
                this.setAgentStatus(agentId, { state: 'error', message: '에이전트 준비 실패 (재시도 가능)' });
            }
        },

        warmupAgentsForCurrentRoom() {
            // currentChatRoom이 없으면 primary agent만 warmup
            const primaryId = this.primaryAgentId;
            if (!this.currentChatRoom) {
                if (primaryId) this.warmupAgent(primaryId);
                return;
            }
            // 참가자 중 agent 타입들 warmup (primary 포함)
            const ids = this.agentParticipants
                .map(p => p.id)
                .filter(Boolean);
            if (ids.length === 0 && primaryId) ids.push(primaryId);
            ids.forEach(id => this.warmupAgent(id));
        },

        async ensureAgentReady(agentId) {
            if (!agentId) return null;
            await this.warmupAgent(agentId);
            return agentId;
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
                profile: p?.profile || null,
                // 에이전트 판별/상태 표시용(가능한 값 보존)
                agent_type: p?.agent_type || p?.agentType || null,
                is_agent: p?.is_agent ?? p?.isAgent ?? null
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
            this.warmupAgentsForCurrentRoom();
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
            this.$nextTick(() => this.scrollToBottomSafe());
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
                    this.warmupAgentsForCurrentRoom();
                }
            } else {
                // 드래프트 탭: 메모리만 업데이트
                this.currentChatRoom = { id: null, name: tab.title, participants: tab.participants };
                this.warmupAgentsForCurrentRoom();
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
            this.$nextTick(() => this.scrollToBottomSafe());

            // ---- Multi-agent response (mentions / all) ----
            // 첨부 정보는 [InputData]로 전달(WorkAssistantChatPanel과 동일 방식)
            const buildMessageForAgent = (userText, policy) => {
                let messageForAgent = userText || '';
                if ((payload?.images && payload.images.length > 0) || payload?.file) {
                    const inputData = {};
                    if (payload?.images && payload.images.length > 0) inputData.images = payload.images;
                    if (payload?.file) inputData.file = payload.file;
                    messageForAgent += `\n\n[InputData]\n${JSON.stringify(inputData)}`;
                }
                return messageForAgent;
            };

            const parseMentions = (t) => {
                const s = (t || '').toString();
                const out = [];
                const re = /@([0-9A-Za-z가-힣._-]+)/g;
                let m;
                while ((m = re.exec(s)) !== null) {
                    const raw = (m[1] || '').trim();
                    if (raw) out.push(raw);
                }
                return Array.from(new Set(out));
            };

            const mentions = parseMentions(msg.content || '');
            const norm = (v) => (v || '').toString().toLowerCase().replace(/\s+/g, '');

            // 후보 에이전트: 현재 방의 agentParticipants + primary(누락 시)
            const candidates = Array.isArray(this.agentParticipants) ? [...this.agentParticipants] : [];
            const primaryId = this.primaryAgentId;
            if (primaryId && !candidates.some(p => p?.id === primaryId)) {
                candidates.unshift({ id: primaryId, username: this.agentUser?.username || 'Agent', email: this.agentUser?.email || null });
            }

            const targets =
                mentions.length > 0
                    ? candidates
                        .filter(p => p?.id && [p?.username, p?.name, p?.email, p?.id].filter(Boolean).map(norm).some(k => mentions.map(norm).includes(k)))
                        .map(p => ({ ...p, policy: 'must_reply' }))
                    : candidates
                        .filter(p => p?.id)
                        .map(p => ({ ...p, policy: 'must_reply' }));

            if (!targets || targets.length === 0) return;

            const userJwt = await getValidToken() || '';
            const tenantId = window.$tenantName || localStorage.getItem('tenantId') || '';

            await Promise.all(targets.map(async (t) => {
                const agentId = t.id;
                if (!agentId) return;
                await this.ensureAgentReady(agentId);

                const assistantUuid = this.uuid();
                const assistantMsg = {
                    uuid: assistantUuid,
                    role: 'assistant',
                    content: '...',
                    contentType: 'markdown',
                    isLoading: true,
                    timeStamp: new Date().toISOString(),
                    email: t.email || `agent:${agentId}`,
                    name: t.username || t.name || t.email || agentId,
                    userName: t.username || t.name || t.email || agentId,
                    agentId
                };
                this.messages.push(assistantMsg);
                const assistantIndex = this.messages.length - 1;

                let full = '';
                this.setAgentStatus(agentId, { state: 'streaming', message: '' });
                await agentRouterService.sendMessageStream(
                    agentId,
                    {
                        message: buildMessageForAgent(msg.content || '', t.policy),
                        tenant_id: tenantId,
                        user_uid: this.userInfo?.uid || this.userInfo?.id,
                        user_email: this.userInfo?.email,
                        user_name: this.userInfo?.name || this.userInfo?.username,
                        user_jwt: userJwt,
                        conversation_id: roomId
                    },
                    {
                        onToken: (token) => {
                            full += token;
                            if (this.messages[assistantIndex]) {
                                this.messages[assistantIndex].content = full;
                            }
                        },
                        onDone: async (content) => {
                            const finalContent = (content || full || '').toString().trim();
                            const safeFinal = finalContent === 'NO_RESPONSE' ? '' : finalContent;

                            if (this.messages[assistantIndex]) {
                                this.messages[assistantIndex].content = safeFinal || full || '';
                                this.messages[assistantIndex].isLoading = false;
                            }
                            this.setAgentStatus(agentId, { state: 'ready', message: '' });

                            await this.putObject(`chats/${assistantUuid}`, {
                                uuid: assistantUuid,
                                id: roomId,
                                messages: { ...(this.messages[assistantIndex] || assistantMsg), content: safeFinal || full || '', isLoading: false }
                            });

                            const r = this.chatRooms.find((x) => x.id === roomId) || this.currentChatRoom;
                            if (r) {
                                r.message = {
                                    msg: (safeFinal || '').substring(0, 50),
                                    type: 'text',
                                    createdAt: new Date().toISOString()
                                };
                                await this.putObject('chat_rooms', r);
                            }
                            this.EventBus.emit('chat-rooms-updated');
                        },
                        onError: async () => {
                            this.setAgentStatus(agentId, { state: 'error', message: '응답 오류' });
                            if (this.messages[assistantIndex]) {
                                const current = (this.messages[assistantIndex].content || '').toString();
                                this.messages[assistantIndex].content = current && current !== '...' ? current : '(에이전트 연결/응답 오류)';
                                this.messages[assistantIndex].isLoading = false;
                            }
                        }
                    }
                );
            }));
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

.settings-btn {
    margin-right: 2px;
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

.input-area {
    padding: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: white;
    flex-shrink: 0;
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

.agent-connection-banner {
    padding: 12px 12px 10px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.06) 0%, rgba(255, 255, 255, 1) 100%);
}

.banner-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.banner-title {
    display: flex;
    align-items: center;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.75);
    white-space: nowrap;
}

.banner-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.status-message {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
}

.agent-status-chips {
    display: flex;
    flex-wrap: wrap;
    margin-top: 8px;
}

.chip-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chip-dot {
    margin: 0 6px;
    opacity: 0.6;
}
</style>
