<template>
    <div class="scenario-script-wrapper">
        <!-- 대본 입력/재생 버튼 툴바 -->
        <div class="scenario-toolbar">
            <v-btn
                size="small"
                variant="flat"
                color="primary"
                @click="openDialog"
                :disabled="scenarioState.isPlaying"
            >
                대본 입력
            </v-btn>
            <v-btn
                size="small"
                variant="flat"
                color="primary"
                :disabled="scenarioState.isPlaying || !hasScenarioParsed || !chatRoomId"
                @click="startPlayback"
            >
                재생
            </v-btn>
            <v-btn
                size="small"
                variant="text"
                color="secondary"
                :disabled="!scenarioState.isPlaying"
                @click="stopPlayback(false)"
            >
                중단
            </v-btn>
            <div class="scenario-progress text-caption" v-if="scenarioState.isPlaying || scenarioLineCount">
                <span v-if="scenarioLineCount"
                    >{{ Math.min(scenarioState.currentIndex + 1, scenarioLineCount) }}/{{ scenarioLineCount }}</span
                >
                <span v-if="scenarioState.isPlaying" class="ml-2">{{ scenarioState.progress }}%</span>
            </div>
        </div>

        <!-- 대본 입력 다이얼로그 -->
        <v-dialog v-model="isDialogOpen" max-width="720" persistent>
            <v-card>
                <v-card-title class="d-flex align-center justify-space-between">
                    <div>대본 입력</div>
                    <div class="text-caption text-medium-emphasis">형식: 이름: 내용</div>
                </v-card-title>
                <v-card-text>
                    <v-textarea
                        v-model="scenarioInputText"
                        rows="10"
                        auto-grow
                        clearable
                        label="대본을 붙여넣어 주세요 (예: 김서연: 다들 왔죠?)"
                        hint="각 줄에 '이름: 내용' 형태로 입력"
                        persistent-hint
                    ></v-textarea>
                    <div class="text-caption mt-2 text-medium-emphasis">
                        현재 줄 수: {{ scenarioLineCount }} · 채팅방 참가자 이름과 일치하면 자동 매핑, 없으면 임시 사용자로 전송합니다.
                    </div>
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="text" @click="resetDialog" :disabled="scenarioState.isPlaying">초기화</v-btn>
                    <v-btn color="secondary" variant="text" @click="stopPlayback(false)" :disabled="!scenarioState.isPlaying"
                        >중단</v-btn
                    >
                    <v-btn
                        color="primary"
                        variant="text"
                        @click="saveScript"
                        :disabled="scenarioState.isPlaying || !scenarioInputText"
                    >
                        저장
                    </v-btn>
                    <v-btn variant="text" @click="isDialogOpen = false" :disabled="scenarioState.isPlaying">닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    name: 'ScenarioScript',
    props: {
        currentChatRoom: {
            type: Object,
            default: null
        },
        chatRoomId: {
            type: String,
            default: null
        },
        messages: {
            type: Array,
            default: () => []
        }
    },
    emits: ['message-sent', 'scroll-to-bottom'],
    data() {
        return {
            isDialogOpen: false,
            scenarioInputText: '',
            parsedScenarioLines: [],
            scenarioState: {
                isPlaying: false,
                currentIndex: 0,
                progress: 0,
                timers: [],
                lastChatRoomId: null
            }
        };
    },
    computed: {
        scenarioLineCount() {
            return this.parsedScenarioLines.length;
        },
        hasScenarioParsed() {
            return this.parsedScenarioLines && this.parsedScenarioLines.length > 0;
        }
    },
    watch: {
        currentChatRoom: {
            handler(newVal, oldVal) {
                if (this.scenarioState.isPlaying && oldVal && newVal && newVal.id !== oldVal.id) {
                    this.stopPlayback(true);
                }
            },
            deep: true
        }
    },
    beforeUnmount() {
        this.stopPlayback(true);
    },
    methods: {
        openDialog() {
            this.isDialogOpen = true;
        },
        resetDialog() {
            if (this.scenarioState.isPlaying) {
                return;
            }
            this.scenarioInputText = '';
            this.parsedScenarioLines = [];
            this.scenarioState.currentIndex = 0;
            this.scenarioState.progress = 0;
        },
        saveScript() {
            const parsed = this.parseScenarioInput();
            if (!parsed || parsed.length === 0) {
                console.warn('저장할 대사가 없습니다.');
                return;
            }
            this.scenarioState.currentIndex = 0;
            this.scenarioState.progress = 0;
            this.isDialogOpen = false;
        },
        parseScenarioInput() {
            const lines = (this.scenarioInputText || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            const parsed = [];
            lines.forEach((line) => {
                const match = line.match(/^\s*([^:]+):\s*(.+)$/);
                if (!match) {
                    return;
                }
                const senderName = match[1].trim();
                const text = match[2].trim();
                if (!text) {
                    return;
                }
                const participant = this.resolveScenarioParticipantByName(senderName);
                parsed.push({ senderName, text, participant });
            });
            this.parsedScenarioLines = parsed;
            return parsed;
        },
        resolveScenarioParticipantByName(name) {
            const normalized = (name || '').trim().toLowerCase();
            const participants = this.currentChatRoom?.participants || [];
            const found =
                participants.find((p) => {
                    const username = (p.username || '').trim().toLowerCase();
                    const emailLocal = (p.email || '').split('@')[0].toLowerCase();
                    const fullEmail = (p.email || '').trim().toLowerCase();
                    const displayName = (p.name || '').trim().toLowerCase();
                    return username === normalized || emailLocal === normalized || fullEmail === normalized || displayName === normalized;
                }) || {};

            const displayName = found.username || found.name || found.email || name || '시나리오 사용자';
            const email = found.email || `${normalized || 'scenario'}@example.com`;
            return {
                name: displayName,
                email: email,
                role: found.role || 'user',
                profile: found.profile || '/images/chat-icon.png'
            };
        },
        calcScenarioDelay(text) {
            const base = 900;
            const factor = 25;
            const maxDelay = 4000;
            const len = text ? text.length : 0;
            return Math.min(maxDelay, base + len * factor);
        },
        startPlayback() {
            if (!this.currentChatRoom || !this.currentChatRoom.id) {
                console.warn('시나리오 재생을 위해 채팅방을 선택하세요.');
                return;
            }

            // 이미 저장된 대본이 없으면 즉시 파싱
            if (!this.parsedScenarioLines || this.parsedScenarioLines.length === 0) {
                const parsed = this.parseScenarioInput();
                if (!parsed || parsed.length === 0) {
                    console.warn('파싱된 대사가 없습니다.');
                    return;
                }
            }

            if (!this.hasScenarioParsed) {
                console.warn('재생할 대사가 없습니다.');
                return;
            }

            // 이미 재생 중이었다면 진행 상태를 유지하고, 아니면 처음부터 시작
            const wasPlaying = this.scenarioState.isPlaying;
            this.stopPlayback(false);
            this.scenarioState.isPlaying = true;
            
            // 재생 중이 아니었고, 진행 상태가 0인 경우에만 처음부터 시작
            // (중단 후 재생인 경우 currentIndex가 유지되므로 그대로 사용)
            if (!wasPlaying && this.scenarioState.currentIndex === 0) {
                this.scenarioState.currentIndex = 0;
                this.scenarioState.progress = 0;
            } else if (!wasPlaying && this.scenarioState.currentIndex > 0) {
                // 중단 후 재생: 진행 상태는 이미 유지되어 있음, progress만 업데이트
                this.updateProgress();
            }
            
            this.scenarioState.lastChatRoomId = this.currentChatRoom.id;
            this.scheduleLine();
            this.isDialogOpen = false;
            this.$emit('scroll-to-bottom', 'start');
        },
        stopPlayback(resetProgress = false) {
            if (this.scenarioState.timers && this.scenarioState.timers.length > 0) {
                this.scenarioState.timers.forEach((timerId) => clearTimeout(timerId));
            }
            this.scenarioState.timers = [];
            this.scenarioState.isPlaying = false;
            this.scenarioState.lastChatRoomId = null;
            if (resetProgress) {
                this.scenarioState.currentIndex = 0;
                this.scenarioState.progress = 0;
            }
        },
        finishPlayback() {
            this.stopPlayback(false);
            this.scenarioState.progress = 100;
        },
        scheduleLine() {
            if (!this.parsedScenarioLines || this.parsedScenarioLines.length === 0) {
                this.stopPlayback(true);
                return;
            }

            const currentIndex = this.scenarioState.currentIndex;
            if (!this.scenarioState.isPlaying || currentIndex >= this.parsedScenarioLines.length) {
                this.finishPlayback();
                return;
            }

            const line = this.parsedScenarioLines[currentIndex];
            const delay = this.calcScenarioDelay(line.text);

            const timerId = window.setTimeout(async () => {
                await this.sendScenarioLine(line);
                if (!this.scenarioState.isPlaying) {
                    return;
                }
                this.scenarioState.currentIndex += 1;
                this.updateProgress();
                this.$emit('scroll-to-bottom', 'after-index');
                this.scheduleLine();
            }, delay);

            this.scenarioState.timers.push(timerId);
        },
        updateProgress() {
            if (!this.parsedScenarioLines?.length) {
                this.scenarioState.progress = 0;
                return;
            }
            const ratio = Math.min(this.scenarioState.currentIndex / this.parsedScenarioLines.length, 1);
            this.scenarioState.progress = Math.round(ratio * 100);
        },
        async sendScenarioLine(line) {
            if (!this.currentChatRoom || !this.currentChatRoom.id) {
                this.stopPlayback();
                return;
            }

            const sender = line.participant || this.resolveScenarioParticipantByName(line.senderName);
            const chatRoomId = this.currentChatRoom.id;
            const scenarioMessage = {
                name: sender.name,
                email: sender.email,
                role: sender.role || 'user',
                profile: sender.profile,
                content: line.text,
                timeStamp: Date.now(),
                uuid: this.uuid()
            };

            console.log('📝 [sendScenarioLine] 대본 메시지 생성 및 이벤트 발생', {
                senderEmail: sender.email,
                content: line.text?.substring(0, 50),
                uuid: scenarioMessage.uuid,
                chatRoomId: chatRoomId
            });

            // 부모 컴포넌트에 DB 저장 요청 (한 번만 호출)
            this.$emit('message-sent', {
                message: scenarioMessage,
                chatRoomId: chatRoomId,
                text: line.text,
                userId: sender.email || sender.id,
                userMessageUuid: scenarioMessage.uuid
            });
        },
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = (Math.random() * 16) | 0;
                const v = c == 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }
    }
};
</script>

<style scoped>
.scenario-script-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.scenario-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
}

.scenario-progress {
    margin-left: 8px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>