<template>
    <div class="browser-agent">
        <div class="header">
            <h3>Browser Agent</h3>
            <div class="status-indicators">
                <v-btn style="margin-right: -10px" icon size="small" @click="openConfigDialog" class="config-icon" title="API 키 설정">
                    <v-icon size="16">mdi-cog</v-icon>
                </v-btn>
                <div class="status-item">
                    <!-- 설정 아이콘 추가 -->
                    <span class="label">연결 상태:</span>
                    <span :class="['status', connectionStatus]">
                        {{ connectionStatusText }}
                    </span>
                </div>
                <v-progress-circular
                    v-if="isProcessing"
                    indeterminate
                    color="primary"
                    size="20"
                    width="2"
                    style="margin-top: 7px"
                ></v-progress-circular>
            </div>
        </div>

        <!-- 로그 출력 영역 -->
        <div class="log-container" ref="logContainer">
            <div v-for="(log, index) in logs" :key="index" :class="['log-entry', log.type]">
                <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
                <span class="content" v-html="formatLogContent(log.content)"></span>
            </div>
            <div v-if="logs.length === 0" class="no-logs">로그가 없습니다. 명령을 입력해주세요.</div>
        </div>

        <!-- 입력 영역 -->
        <div class="input-area">
            <div v-if="connectionStatus === 'connected'" class="input-group">
                <input
                    v-model="command"
                    @keyup.enter="sendCommand"
                    placeholder="브라우저 에이전트에게 명령을 입력하세요."
                    class="command-input"
                />
                <button v-if="!isProcessing" @click="sendCommand" :disabled="!command.trim()" class="send-button">실행</button>
                <button v-if="isProcessing" @click="stopProcessing" class="stop-button">중지</button>
            </div>
            <div v-if="connectionStatus !== 'connected'" class="control-buttons">
                <button v-if="connectionStatus === 'disconnected' && !tryConnect" @click="connectBrowserAgent" class="start-agent-button">
                    {{ hasTriedConnection ? '재시도' : '연결' }}
                </button>
                <div v-else-if="connectionStatus === 'connecting' || tryConnect" class="loading-container">
                    <v-progress-circular indeterminate color="primary" size="24"></v-progress-circular>
                    <span class="loading-text">
                        {{ tryConnect ? '브라우저 에이전트 시작 중...' : '연결 중...' }}
                    </span>
                </div>
            </div>
        </div>

        <!-- API 키 설정 다이얼로그 -->
        <v-dialog v-model="configDialog" max-width="500" persistent>
            <v-card>
                <v-card-title class="config-header">
                    <v-icon class="mr-2">mdi-cog</v-icon>
                    API 키 설정
                </v-card-title>

                <v-card-text class="config-content">
                    <v-form ref="configForm" v-model="configFormValid">
                        <!-- 필수 항목 섹션 -->
                        <div class="config-section">
                            <div class="section-header">
                                <h4 class="section-title">필수 항목</h4>
                            </div>
                            <v-divider class="mb-4"></v-divider>

                            <!-- OpenAI API Key (필수) -->
                            <v-text-field
                                v-model="configData.OPENAI_API_KEY"
                                label="OpenAI API Key"
                                placeholder="sk-proj-..."
                                :rules="[(v) => !!v || 'OpenAI API Key는 필수입니다']"
                                required
                                :type="showOpenAIKey ? 'text' : 'password'"
                                hint="기본적인 Browser use 기능을 사용하기 위해 반드시 필요합니다"
                                persistent-hint
                                class="mb-4"
                            >
                                <template v-slot:prepend-inner>
                                    <v-icon color="primary">mdi-key</v-icon>
                                </template>
                                <template v-slot:append-inner>
                                    <v-btn icon size="small" @click="showOpenAIKey = !showOpenAIKey" class="password-toggle">
                                        <v-icon :color="showOpenAIKey ? 'primary' : 'grey'">
                                            {{ showOpenAIKey ? 'mdi-eye' : 'mdi-eye-off' }}
                                        </v-icon>
                                    </v-btn>
                                </template>
                            </v-text-field>
                        </div>

                        <!-- 선택 항목 섹션 -->
                        <div class="config-section">
                            <div class="section-header">
                                <h4 class="section-title">선택 항목</h4>
                                <span class="section-subtitle">Google 로그인이 필요한 작업에 사용됩니다</span>
                            </div>
                            <v-divider class="mb-4"></v-divider>

                            <!-- Google Email (선택사항) -->
                            <v-text-field
                                v-model="configData.GOOGLE_EMAIL"
                                label="Google Email"
                                placeholder="example@gmail.com"
                                type="email"
                                persistent-hint
                                class="mb-3"
                            >
                                <template v-slot:prepend-inner>
                                    <v-icon color="orange">mdi-email</v-icon>
                                </template>
                            </v-text-field>

                            <!-- Google Password (선택사항) -->
                            <v-text-field
                                v-model="configData.GOOGLE_PASSWORD"
                                label="Google Password"
                                placeholder="Google 계정 비밀번호"
                                :type="showGooglePassword ? 'text' : 'password'"
                                persistent-hint
                                class="mb-3"
                            >
                                <template v-slot:prepend-inner>
                                    <v-icon color="orange">mdi-lock</v-icon>
                                </template>
                                <template v-slot:append-inner>
                                    <v-btn icon size="small" @click="showGooglePassword = !showGooglePassword" class="password-toggle">
                                        <v-icon :color="showGooglePassword ? 'orange' : 'grey'">
                                            {{ showGooglePassword ? 'mdi-eye' : 'mdi-eye-off' }}
                                        </v-icon>
                                    </v-btn>
                                </template>
                            </v-text-field>
                        </div>
                    </v-form>
                </v-card-text>

                <v-card-actions class="config-actions">
                    <v-spacer></v-spacer>
                    <v-btn text @click="closeConfigDialog" :disabled="configSaving"> 취소 </v-btn>
                    <v-btn color="primary" @click="saveConfig" :loading="configSaving" :disabled="!configFormValid"> 저장 </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    name: 'BrowserAgent',
    props: {
        // html: {
        //   type: String,
        //   required: true
        // },
        workItem: {
            type: Object,
            required: true
        },
        doneWorkItemList: {
            type: Array,
            required: true
        }
    },
    data() {
        return {
            // WebSocket 연결
            ws: null,

            // 상태 관리 (영어로 변경)
            connectionStatus: 'disconnected',
            taskStatus: 'waiting',
            isProcessing: false,

            // 입력 및 로그
            command: '',
            logs: [],

            // 설정
            wsUrl: 'ws://localhost:8999/ws',
            reconnectInterval: 5000,
            maxLogs: 1000,
            retryCount: 0,
            hasTriedConnection: false,

            tryConnect: false,

            // API 키 설정 관련
            configDialog: false,
            configFormValid: false,
            configSaving: false,
            configData: {
                OPENAI_API_KEY: '',
                GOOGLE_EMAIL: '',
                GOOGLE_PASSWORD: ''
            },
            // 비밀번호 표시 토글
            showOpenAIKey: false,
            showGooglePassword: false
        };
    },
    computed: {
        // 한글 표시를 위한 computed 속성들
        connectionStatusText() {
            const statusMap = {
                connecting: '연결 중',
                connected: '연결됨',
                disconnected: '연결 끊김',
                error: '연결 오류',
                failed: '연결 실패'
            };
            return statusMap[this.connectionStatus] || this.connectionStatus;
        }
    },
    mounted() {
        this.connectBrowserAgent();
    },
    beforeUnmount() {
        this.disconnectWebSocket();
    },
    methods: {
        // API 키 설정 관련 메서드들
        async loadConfig() {
            try {
                const response = await fetch('http://localhost:8999/api/config');
                const result = await response.json();

                if (result.success && result.config) {
                    this.configData.OPENAI_API_KEY = result.config.OPENAI_API_KEY || '';
                    this.configData.GOOGLE_EMAIL = result.config.GOOGLE_EMAIL || '';
                    this.configData.GOOGLE_PASSWORD = result.config.GOOGLE_PASSWORD || '';
                }
            } catch (error) {
                console.error('설정 로드 실패:', error);
            }
        },

        openConfigDialog() {
            this.loadConfig();
            this.configDialog = true;
        },

        closeConfigDialog() {
            this.configDialog = false;
            // 비밀번호 표시 토글 상태 초기화
            this.showOpenAIKey = false;
            this.showGooglePassword = false;
        },

        async saveConfig() {
            if (!this.configFormValid) {
                return;
            }

            this.configSaving = true;

            try {
                const response = await fetch('http://localhost:8999/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.configData)
                });

                const result = await response.json();

                if (result.success) {
                    this.addLog('info', '✅ API 키 설정이 저장되었습니다.');
                    this.closeConfigDialog();
                } else {
                    this.addLog('error', '❌ 설정 저장에 실패했습니다.');
                }
            } catch (error) {
                this.addLog('error', `설정 저장 오류: ${error.message}`);
            } finally {
                this.configSaving = false;
            }
        },

        checkRequiredConfig() {
            if (!this.configData.OPENAI_API_KEY || this.configData.OPENAI_API_KEY.trim() === '') {
                this.addLog('error', '⚠️ OpenAI API Key가 설정되지 않았습니다. 설정 아이콘을 클릭하여 API 키를 입력해주세요.');
                setTimeout(() => {
                    this.openConfigDialog();
                }, 1000);
                return false;
            }
            return true;
        },

        // 백엔드 상태를 먼저 확인하는 메소드 (WebSocket 연결 시도)
        async checkBackendStatus() {
            return new Promise((resolve) => {
                try {
                    const testWs = new WebSocket(this.wsUrl);

                    const timeout = setTimeout(() => {
                        testWs.close();
                        resolve(false);
                    }, 1000);

                    testWs.onopen = () => {
                        clearTimeout(timeout);
                        testWs.close();
                        resolve(true);
                    };

                    testWs.onerror = () => {
                        clearTimeout(timeout);
                        resolve(false);
                    };
                } catch (error) {
                    resolve(false);
                }
            });
        },

        async connectBrowserAgent() {
            this.connectionStatus = 'connecting';
            this.hasTriedConnection = true;
            this.retryCount = 0;

            // 먼저 백엔드가 실행 중인지 확인
            const isBackendRunning = await this.checkBackendStatus();

            if (isBackendRunning) {
                // 백엔드가 이미 실행 중이면 바로 WebSocket 연결
                this.addLog('info', '브라우저 에이전트가 이미 실행 중입니다. 연결 중...');
                this.connectWebSocket();
            } else {
                // 백엔드가 실행되지 않은 경우에만 새 탭 열기
                this.tryConnect = true;
                this.addLog('info', '브라우저 에이전트를 시작합니다.');

                const protocolUrl = 'browser-use-agent://start';
                const newTab = window.open(protocolUrl, '_blank');

                if (!newTab) {
                    // 팝업이 차단되었거나 실패한 경우
                    this.connectionStatus = 'disconnected';
                    this.tryConnect = false;
                    this.addLog('error', '브라우저 에이전트 시작에 실패했습니다. 팝업 차단을 해제해주세요.');
                    return;
                }

                // 새탭 모니터링 - 사용자가 확인/취소할 때까지 기다림
                const startTime = Date.now();
                const checkTab = setInterval(() => {
                    if (newTab.closed) {
                        clearInterval(checkTab);
                        const elapsed = Date.now() - startTime;

                        if (elapsed < 1000) {
                            // 1초 미만으로 빠르게 닫힌 경우 - 취소로 간주
                            this.connectionStatus = 'disconnected';
                            this.tryConnect = false;
                            this.addLog('error', '브라우저 에이전트 시작이 취소되었습니다.');
                        } else {
                            // 1초 이상 후에 닫힌 경우 - 확인으로 간주
                            this.addLog('info', '브라우저 에이전트 시작 중...');
                            this.connectWebSocket();
                        }
                    }
                }, 100);

                // 10초 후에도 탭이 닫히지 않으면 타임아웃
                setTimeout(() => {
                    if (!newTab.closed) {
                        clearInterval(checkTab);
                        this.connectionStatus = 'disconnected';
                        this.tryConnect = false;
                        this.addLog('error', '연결 시도 시간이 초과되었습니다.');
                    }
                }, 10000);
            }
        },
        // WebSocket 연결
        connectWebSocket() {
            try {
                this.tryConnect = true;
                this.connectionStatus = 'connecting';
                this.addLog('info', 'WebSocket 연결을 시도합니다.');

                this.ws = new WebSocket(this.wsUrl);

                this.ws.onopen = () => {
                    this.connectionStatus = 'connected';
                    this.tryConnect = false;
                    this.retryCount = 0;
                    this.addLog('info', '✅ 브라우저 에이전트에 연결되었습니다!');
                    if (
                        this.workItem &&
                        this.workItem.activity &&
                        this.workItem.activity.instruction &&
                        this.workItem.activity.instruction != '' &&
                        this.workItem.activity.instruction != null
                    ) {
                        setTimeout(() => {
                            this.command = this.workItem.activity.instruction;
                            // this.sendCommand()
                        }, 500);
                    }
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onclose = () => {
                    if (this.connectionStatus === 'connected') {
                        this.connectionStatus = 'disconnected';
                        this.tryConnect = false;
                        this.addLog('error', '연결이 끊어졌습니다. 재시도 버튼을 눌러주세요.');
                    }
                };

                this.ws.onerror = (error) => {
                    if (this.retryCount < 10) {
                        this.retryCount++;
                        this.addLog('info', `연결 시도 중... (${this.retryCount}/10)`);

                        // 재시도 중에는 connecting 상태와 tryConnect = true 유지
                        setTimeout(() => {
                            if (this.connectionStatus === 'connecting') {
                                this.connectWebSocket();
                            }
                        }, 5000);
                    } else {
                        // 모든 재시도가 실패했을 때만 disconnected로 변경
                        this.connectionStatus = 'disconnected';
                        this.tryConnect = false;
                        this.addLog('error', '❌ 연결에 실패했습니다. 브라우저 에이전트가 실행되지 않았거나 시간이 더 필요할 수 있습니다.');
                        this.retryCount = 0;
                    }
                };
            } catch (error) {
                this.connectionStatus = 'disconnected';
                this.tryConnect = false;
                this.addLog('error', `연결 실패: ${error.message}`);
            }
        },

        // WebSocket 연결 해제
        disconnectWebSocket() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        },

        // 메시지 처리
        handleMessage(data) {
            try {
                const message = JSON.parse(data);

                // 디버그 메시지 필터링
                if (
                    (message.content && message.content.includes('🔍 Raw WebSocket message')) ||
                    (message.content && message.content.includes('🔍 Parsed command_data')) ||
                    (message.content && message.content.includes('🔍 Message type'))
                ) {
                    return; // 디버그 메시지는 로그에 추가하지 않음
                }

                // Starting task 메시지 간소화
                if (message.content && message.content.startsWith('Starting task:')) {
                    this.addLog('info', '📋 작업을 처리하고 있습니다.');
                } else if (message.content === 'No result') {
                    // 중지 시 No result 대신 적절한 메시지 표시 (이미 stopProcessing에서 처리하므로 무시)
                    return;
                } else {
                    this.addLog(message.type, message.content);
                }

                switch (message.type) {
                    case 'info':
                        if (message.content.includes('Agent ready')) {
                            this.taskStatus = 'ready';
                        }
                        break;
                    case 'error':
                        this.taskStatus = 'error';
                        this.isProcessing = false;
                        break;
                    case 'end':
                        this.taskStatus = 'completed';
                        this.isProcessing = false;
                        break;
                    default:
                        break;
                }
            } catch (error) {
                // JSON 파싱 실패시 일반 텍스트로 처리
                if (data === 'No result') {
                    return; // 중지 시 No result 메시지 무시
                }
                this.addLog('info', data);
            }
        },

        // 로그 추가
        addLog(type, content) {
            const log = {
                type,
                content,
                timestamp: Date.now()
            };

            this.logs.push(log);

            // 로그 개수 제한
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }

            // 스크롤을 맨 아래로
            this.$nextTick(() => {
                this.scrollToBottom();
                console.log(this.logs);
            });
        },

        // 명령 전송
        sendCommand() {
            if (this.configData.OPENAI_API_KEY == '' || this.configData.OPENAI_API_KEY == null) {
                this.openConfigDialog();
                return;
            }
            if (!this.command.trim() || !this.ws) {
                return;
            }

            // 필수 설정 확인
            if (!this.checkRequiredConfig()) {
                return;
            }

            const command = this.command.trim();

            // 사용자 입력 로그 추가 (간단하게)
            this.addLog('command', `> ${command}`);
            this.addLog('info', '작업을 시작합니다.');

            const prompt = `전달해준 정보를 기반하여 결과를 생성
현재 작업 정보(workItem): ${JSON.stringify(this.workItem)},
이전 작업 정보(doneWorkItemList): ${JSON.stringify(this.doneWorkItemList)}
사용자 요청 사항(command): ${command}`;

            // WebSocket으로 명령 전송
            this.ws.send(
                JSON.stringify({
                    prompt,
                    type: 'execute'
                })
            );

            // 상태 업데이트
            this.isProcessing = true;
            this.taskStatus = 'running';
            this.command = '';
        },

        // HTTP API 호출 방식 (WebSocket 대신 사용 가능)
        async sendCommandHTTP() {
            if (!this.command.trim() || this.isProcessing) {
                return;
            }

            const command = this.command.trim();
            this.addLog('command', `> ${command}`);

            try {
                this.isProcessing = true;
                this.taskStatus = 'running';

                const response = await fetch('http://localhost:8999/api/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ command })
                });

                const result = await response.json();

                if (result.success) {
                    this.addLog('result', result.result);
                    this.taskStatus = 'completed';
                } else {
                    this.addLog('error', result.detail || '실행 오류');
                    this.taskStatus = 'error';
                }
            } catch (error) {
                this.addLog('error', `HTTP 요청 오류: ${error.message}`);
                this.taskStatus = 'error';
            } finally {
                this.isProcessing = false;
                this.command = '';
            }
        },

        // 유틸리티 함수들
        formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString();
        },

        formatLogContent(content) {
            // URL을 링크로 변환
            return content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        },

        scrollToBottom() {
            const container = this.$refs.logContainer;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        },

        // 로그 지우기
        clearLogs() {
            this.logs = [];
        },

        // 중지 버튼 클릭 시 호출될 메서드
        async stopProcessing() {
            try {
                this.addLog('info', '🛑 작업 중지를 요청합니다.');

                const response = await fetch('http://localhost:8999/api/task/stop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();
                console.log('Stop result:', result);

                if (result.success) {
                    console.log('✅ Task stopped successfully');
                    this.addLog('info', '⏹️ 작업이 성공적으로 중지되었습니다.');
                } else {
                    console.log('ℹ️ No active task to stop');
                    this.addLog('info', '⏹️ 중지할 활성 작업이 없습니다.');
                }

                // 로컬 상태 즉시 변경
                this.isProcessing = false;
                this.taskStatus = 'stopped';
            } catch (error) {
                this.addLog('error', `중지 실패: ${error.message}`);
                // 에러가 발생해도 로컬 상태는 변경
                this.isProcessing = false;
                this.taskStatus = 'error';
            }
        }
    }
};
</script>

<style scoped>
.browser-agent {
    display: flex;
    flex-direction: column;
    height: 600px;
    max-height: 80vh;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px 12px 0 0;
}

.header h3 {
    margin: 0;
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
}

.status-indicators {
    display: flex;
    gap: 16px;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.1);
    padding: 6px 12px;
    border-radius: 20px;
    backdrop-filter: blur(10px);
}

.config-icon {
    background: rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    margin-right: 8px;
}

.config-icon:hover {
    background: rgba(255, 255, 255, 0.3) !important;
}

.label {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
}

.status {
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.status.connected {
    background: #10b981;
    color: #ffffff;
}
.status.connecting {
    background: #f59e0b;
    color: #ffffff;
}
.status.disconnected {
    background: #ef4444;
    color: #ffffff;
}
.status.error {
    background: #ef4444;
    color: #ffffff;
}
.status.failed {
    background: #ef4444;
    color: #ffffff;
}
.status.ready {
    background: #10b981;
    color: #ffffff;
}
.status.running {
    background: #3b82f6;
    color: #ffffff;
}
.status.completed {
    background: #10b981;
    color: #ffffff;
}
.status.waiting {
    background: #6b7280;
    color: #ffffff;
}

.log-container {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    background: #f8fafc;
}

.log-entry {
    display: flex;
    align-items: flex-start;
    margin: 0;
    padding: 12px 20px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
    line-height: 1.5;
    transition: background-color 0.2s ease;
    position: relative;
}

.log-entry:hover {
    background: #f1f5f9;
}

.log-entry:last-child {
    border-bottom: none;
}

.log-entry::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 0 2px 2px 0;
}

.log-entry.command {
    background: #fefefe;
}

.log-entry.command::before {
    background: #3b82f6;
}

.log-entry.info {
    background: #fefefe;
}

.log-entry.info::before {
    background: #8b5cf6;
}

.log-entry.result {
    background: #fefefe;
}

.log-entry.result::before {
    background: #10b981;
}

.log-entry.error {
    background: #fefefe;
}

.log-entry.error::before {
    background: #ef4444;
}

.log-entry.log {
    background: #fefefe;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 13px;
}

.log-entry.log::before {
    background: #6b7280;
}

.timestamp {
    min-width: 70px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 500;
    margin-right: 16px;
    margin-top: 2px;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

.content {
    flex: 1;
    word-break: break-word;
    color: #374151;
}

.log-entry.command .content {
    color: #1e40af;
    font-weight: 500;
}

.log-entry.error .content {
    color: #dc2626;
}

.log-entry.result .content {
    color: #059669;
}

.no-logs {
    text-align: center;
    color: #9ca3af;
    font-style: italic;
    padding: 60px 20px;
    font-size: 16px;
}

.input-area {
    border-top: 1px solid #e5e7eb;
    padding: 20px;
    background: #ffffff;
    border-radius: 0 0 12px 12px;
}

.input-group {
    display: flex;
    gap: 12px;
    align-items: stretch;
}

.command-input {
    flex: 1;
    padding: 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: all 0.2s ease;
    background: #f9fafb;
}

.command-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    background: #ffffff;
}

.command-input:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.7;
}

.send-button {
    padding: 16px 28px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.send-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
}

.send-button:active:not(:disabled) {
    transform: translateY(0);
}

.send-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.stop-button {
    padding: 16px 28px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.stop-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
}

.stop-button:active:not(:disabled) {
    transform: translateY(0);
}

.stop-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.control-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 12px;
}

.loading-container {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    padding: 12px 24px;
}

.loading-text {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
}

.start-agent-button {
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.start-agent-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
}

.start-agent-button:active:not(:disabled) {
    transform: translateY(0);
}

.start-agent-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.retry-button {
    padding: 12px 24px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.retry-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.15);
}

.retry-button:active:not(:disabled) {
    transform: translateY(0);
}

.retry-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* 설정 다이얼로그 스타일 */
.config-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white !important;
    padding: 20px 24px;
}

.config-content {
    padding: 24px;
    max-height: 70vh;
    overflow-y: auto;
}

.config-actions {
    padding: 12px 24px 24px 24px;
}

/* 설정 섹션 스타일 */
.config-section {
    margin-bottom: 32px;
}

.config-section:last-child {
    margin-bottom: 16px;
}

.section-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}

.section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    flex: 1;
}

.section-subtitle {
    font-size: 12px;
    color: #6b7280;
    font-style: italic;
    margin-left: auto;
}

/* 비밀번호 토글 버튼 스타일 */
.password-toggle {
    opacity: 0.7;
    transition: opacity 0.2s ease;
}

.password-toggle:hover {
    opacity: 1;
}

/* 필수 항목 섹션 스타일링 */
.config-section:first-child {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, rgba(239, 68, 68, 0.01) 100%);
    border: 1px solid rgba(239, 68, 68, 0.1);
    border-radius: 12px;
    padding: 20px;
    position: relative;
}

.config-section:first-child::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border-radius: 12px 12px 0 0;
}

/* 선택 항목 섹션 스타일링 */
.config-section:last-child {
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.02) 0%, rgba(251, 146, 60, 0.01) 100%);
    border: 1px solid rgba(251, 146, 60, 0.1);
    border-radius: 12px;
    padding: 20px;
    position: relative;
}

.config-section:last-child::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border-radius: 12px 12px 0 0;
}

/* 스크롤바 스타일 */
.log-container::-webkit-scrollbar {
    width: 6px;
}

.log-container::-webkit-scrollbar-track {
    background: transparent;
}

.log-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}

/* 링크 스타일 */
.content a {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
}

.content a:hover {
    text-decoration: underline;
}
</style>
