<template>
    <v-dialog
        v-model="localOpen"
        :scrim="false"
        persistent
        width="auto"
    >
        <div class="ai-chat-overlay">
            <v-card
                ref="dialogCard"
                class="ai-chat-card"
                :style="dialogStyle"
                :elevation="10"
                @mousedown.stop
            >
                <div class="ai-chat-header" @mousedown="startDrag">
                    <div class="ai-chat-title">
                        Voice Agent
                        <span v-if="connected" class="ai-chat-status success">연결됨</span>
                        <span v-else class="ai-chat-status warn">{{ connecting ? '연결 중' : '연결 안 됨' }}</span>
                        <span v-if="assistantStreaming" class="ai-chat-status">응답 중</span>
                        <span v-if="isMicOn" class="ai-chat-status">마이크 ON</span>
                    </div>
                    <v-btn icon density="comfortable" variant="text" @click="closeDialog">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
                <v-divider />
                <div class="ai-chat-body" ref="chatBody">
                    <div
                        v-for="(msg, index) in messages"
                        :key="msg.id || index"
                        :class="['ai-chat-message', msg.role === 'user' ? 'ai-chat-message--user' : 'ai-chat-message--assistant']"
                    >
                        <div class="ai-chat-bubble">
                            <span v-if="msg.text">{{ msg.text }}</span>
                            <span v-else-if="msg.isStreaming" class="ai-chat-typing">...</span>
                        </div>
                    </div>
                </div>
                <v-divider />
                <div class="ai-chat-input">
                    <v-textarea
                        v-model="userInput"
                        auto-grow
                        rows="1"
                        density="compact"
                        variant="outlined"
                        placeholder="메시지를 입력하거나 마이크로 말해보세요."
                        :disabled="sending"
                        @keydown.enter.prevent="sendUserMessage"
                    />
                    <div class="ai-chat-actions">
                        <v-btn
                            v-if="!isMicOn"
                            icon
                            density="comfortable"
                            variant="outlined"
                            size="small"
                            @click="toggleMic"
                            :disabled="sending || micLoading || !connected"
                            :loading="micLoading"
                        >
                            <v-icon>mdi-microphone</v-icon>
                        </v-btn>
                        <v-btn
                            v-else
                            icon
                            density="comfortable"
                            variant="outlined"
                            size="small"
                            @click="toggleMic"
                            :disabled="sending || micLoading"
                            :loading="micLoading"
                        >
                            <v-icon>mdi-stop</v-icon>
                        </v-btn>
                        <v-btn
                            icon
                            density="comfortable"
                            variant="outlined"
                            size="small"
                            color="primary"
                            @click="sendUserMessage"
                            :disabled="sending || !userInput.trim()"
                            :loading="sending"
                        >
                            <v-icon>mdi-send</v-icon>
                        </v-btn>
                    </div>
                </div>
            </v-card>
        </div>
    </v-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false,
    },
    formSchema: {
        type: Array,
        default: () => [],
    },
    formDataSnapshot: {
        type: Object,
        default: () => ({}),
    },
    currentUserName: {
        type: String,
        default: '',
    },
    currentUserEmail: {
        type: String,
        default: '',
    },
    currentUserUid: {
        type: String,
        default: '',
    },
    wsUrl: {
        type: String,
        default: '',
    },
    processName: {
        type: String,
        default: '',
    },
    activityName: {
        type: String,
        default: '',
    },
    activityInstruction: {
        type: String,
        default: '',
    },
    referenceForms: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits(['update:modelValue', 'apply', 'submit']);

const localOpen = ref(props.modelValue);
const ws = ref(null);
const connecting = ref(false);
const connected = ref(false);
const sending = ref(false);
const sessionReady = ref(false);
const initialPromptSent = ref(false);
const initialResponsePending = ref(false);
const assistantStreaming = ref(false);
const errorMessage = ref('');
const userInput = ref('');
const messages = ref([]);
const isMicOn = ref(false);
const micLoading = ref(false);
const micLevel = ref(0);
const isPlayingAudio = ref(false);
const isMobile = computed(() => window.innerWidth <= 768);
const dragDelta = ref({ x: 0, y: 0 });
const dragStart = ref({ x: 0, y: 0 });
const dragStartDelta = ref({ x: 0, y: 0 });
const dialogStyle = computed(() => ({
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${dragDelta.value.x}px), calc(-50% + ${dragDelta.value.y}px))`,
}));

let messageSeq = 0;
let assistantBuffer = '';

const targetWsUrl = computed(() => {
    if (props.wsUrl) return props.wsUrl;
    const envUrl = import.meta.env.VITE_REALTIME_ASSIST_WS;
    if (envUrl) return envUrl;
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.host;
    return `${isHttps ? 'wss' : 'ws'}://${host}/voice/ws/realtime`;
});
const audioContext = ref(null);
const processor = ref(null);
const mediaStream = ref(null);
const playbackContext = ref(null);
let playbackQueue = [];
let currentSource = null;
let pendingSubmitCallId = null;

const cancelCurrentResponse = () => {
    // 중간 끊기: 모델 응답 취소 + 오디오 재생 중단
    assistantStreaming.value = false;
    assistantBuffer = '';
    playbackQueue = [];
    if (currentSource) {
        try {
            currentSource.stop();
        } catch (_) {
            // ignore
        }
        currentSource = null;
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        try {
            ws.value.send(JSON.stringify({ type: 'response.cancel' }));
        } catch (_) {
            // ignore
        }
    }
};

watch(
    () => props.modelValue,
    (val) => {
        localOpen.value = val;
        if (val) {
            nextTick(() => connectAndBootstrap());
        } else {
            cleanupWs();
        }
    }
);

watch(
    () => localOpen.value,
    (val) => {
        emit('update:modelValue', val);
        if (!val) {
            cleanupWs();
        }
    }
);

const chatBody = ref(null);

const scrollToBottom = () => {
    nextTick(() => {
        if (chatBody.value) {
            chatBody.value.scrollTop = chatBody.value.scrollHeight;
        }
    });
};

watch(
    () => messages.value,
    () => {
        scrollToBottom();
    },
    { deep: true }
);

onMounted(() => {
    dragDelta.value = clampDragDelta(0, 0);
});

onBeforeUnmount(() => {
    cleanupWs();
    stopMic();
});

const pushMessage = (role, text) => {
    messages.value = [...messages.value, { id: messageSeq += 1, role, text }];
};

const sendUserInfo = (socket) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const payload = {
        type: 'user_info',
        email: props.currentUserEmail || localStorage.getItem('email') || '',
        user_name: props.currentUserName || '',
        user_uid: props.currentUserUid || '',
        process_name: props.processName || '',
        activity_name: props.activityName || '',
        tenant_id: window.$tenantName || '',
    };
    try {
        socket.send(JSON.stringify(payload));
    } catch (e) {
        console.error('user_info 전송 실패', e);
    }
};

const connectAndBootstrap = async () => {
    cleanupWs();
    errorMessage.value = '';
    connecting.value = true;
    assistantBuffer = '';
    sessionReady.value = false;
    initialPromptSent.value = false;
    assistantStreaming.value = false;
    try {
        const socket = new WebSocket(targetWsUrl.value);
        socket.onopen = () => {
            connected.value = true;
            connecting.value = false;
            sendUserInfo(socket);
            bootstrapSession(socket);
        };
        socket.onclose = () => {
            connected.value = false;
            connecting.value = false;
        };
        socket.onerror = (e) => {
            console.error('WS error', e);
            errorMessage.value = '웹소켓 연결 중 오류가 발생했습니다.';
        };
        socket.onmessage = (event) => handleIncoming(event);
        ws.value = socket;
    } catch (e) {
        console.error(e);
        errorMessage.value = '웹소켓을 초기화하지 못했습니다.';
        connecting.value = false;
    }
};

const bootstrapSession = (socket) => {
    const now = new Date();
    const localIsoDate = now.toISOString().slice(0, 10);
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const tzOffsetMin = now.getTimezoneOffset();
    const tzSign = tzOffsetMin > 0 ? '-' : '+';
    const tzAbs = Math.abs(tzOffsetMin);
    const tz = `${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;
    const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const refFormsForPrompt = (props.referenceForms || []).map((item) => ({
        name: item?.name || '',
        values: item?.formData || {},
    }));
    const activityInstruction = props.activityInstruction || '';
    const instructions = [
        '너는 프로세스 작업 폼 작성 보조 어시스턴트다.',
        '필수 규칙: 아래 스키마에 없는 필드는 언급/질문/제안하지 말 것. 임의 필드 추가 금지.',
        '필수 규칙: 개인정보/민감정보 생성 금지. 모르면 질문 후 빈 값 유지.',
        'JSON 패치 제안 형식: {"fields":[{"name":"필드명","value":"값","reason":"설명"}]} (name은 스키마의 name만 사용)',
        '문장은 한국어로 간결하게 답하고, 숫자/날짜 포맷은 스키마 힌트를 따름.',
        `프로세스: ${props.processName || 'N/A'}, 활동: ${props.activityName || 'N/A'}`,
        activityInstruction ? `지침: ${activityInstruction}` : '지침: 없음',
        props.currentUserName || props.currentUserEmail || props.currentUserUid
            ? `사용자 정보: ${[
                  props.currentUserName ? `이름=${props.currentUserName}` : null,
                  props.currentUserEmail ? `이메일=${props.currentUserEmail}` : null,
                  props.currentUserUid ? `uid=${props.currentUserUid}` : null,
              ]
                  .filter(Boolean)
                  .join(', ')}`
            : '사용자 정보: 미제공',
        `현재 로컬 날짜/시간: ${localIsoDate} ${localTime} (timezone ${tz})`,
        '제출 규칙: 사용자가 "제출", "완료", "등록" 등 명시적으로 제출을 요청한 경우에만 submit_form을 호출한다.',
        `폼 스키마(JSON): ${JSON.stringify(props.formSchema || [])}`,
        `현재 값(JSON): ${JSON.stringify(props.formDataSnapshot || {})}`,
        `참조 폼 데이터(JSON): ${JSON.stringify(refFormsForPrompt)}`,
    ].join('\n');

    const sessionUpdate = {
        type: 'session.update',
        session: {
            instructions,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            voice: 'alloy',
            modalities: ['text', 'audio'],
            tools: buildToolsFromSchema(props.formSchema || []),
            tool_choice: 'auto',
        },
    };
    socket.send(JSON.stringify(sessionUpdate));
    // intro는 session.updated 수신 후 전송
};

const handleIncoming = (event) => {
    if (event.data instanceof ArrayBuffer) {
        enqueuePcmForPlayback(event.data);
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(event.data);
    } catch (e) {
        return;
    }
    const { type } = parsed;
    if (type === 'error') {
        errorMessage.value = parsed.error?.message || '모델 오류';
        return;
    }
    if (type === 'input_audio_buffer.speech_started') {
        // 사용자가 말하기 시작 → 서버에서 응답을 취소하므로 클라이언트 재생도 즉시 중단
        cancelCurrentResponse();
        return;
    }
    if (type === 'session.updated') {
        sessionReady.value = true;
        return;
    }
    if (type === 'response.output_text.delta' && parsed.delta) {
        assistantStreaming.value = true;
        assistantBuffer += parsed.delta;
        ensureAssistantStreamingMessage();
        updateAssistantStreamingMessage(assistantBuffer);
        return;
    }
    if (type === 'response.output_text.done') {
        finalizeAssistantMessage(assistantBuffer);
        assistantBuffer = '';
        return;
    }
    if (type === 'response.audio.delta' && parsed.delta) {
        if (initialResponsePending.value) {
            // ignore audio playback for the very first response
            return;
        }
        enqueuePcmForPlayback(base64ToArrayBuffer(parsed.delta));
        return;
    }
    if (type === 'response.audio_transcript.delta' && parsed.delta) {
        assistantStreaming.value = true;
        assistantBuffer += parsed.delta;
        ensureAssistantStreamingMessage();
        updateAssistantStreamingMessage(assistantBuffer);
        return;
    }
    if (type === 'response.audio_transcript.done') {
        finalizeAssistantMessage(assistantBuffer);
        assistantBuffer = '';
        return;
    }
    if (type === 'response.content_part.done') {
        const part = parsed.part || {};
        if (part.type === 'audio' && part.transcript) {
            finalizeAssistantMessage(part.transcript);
            assistantBuffer = '';
        }
        return;
    }
    if (type === 'response.created') {
        assistantBuffer = '';
        assistantStreaming.value = true;
        return;
    }
    if (type === 'response.done') {
        handleFunctionCalls(parsed);
        if (initialResponsePending.value) {
            initialResponsePending.value = false;
        }
        return;
    }
};

const sendUserMessage = () => {
    if (!connected.value || !ws.value || !userInput.value.trim()) return;
    cancelCurrentResponse();
    const text = userInput.value.trim();
    pushMessage('user', text);
    sending.value = true;
    try {
        ws.value.send(
            JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text }],
                },
            })
        );
        ws.value.send(JSON.stringify({ type: 'response.create' }));
    } catch (e) {
        errorMessage.value = '메시지 전송에 실패했습니다.';
    } finally {
        userInput.value = '';
        sending.value = false;
    }
};

const resetSession = () => {
    cleanupWs();
    messages.value = [];
    userInput.value = '';
    sessionReady.value = false;
    initialPromptSent.value = false;
    initialResponsePending.value = false;
    connectAndBootstrap();
};

const cleanupWs = () => {
    if (ws.value) {
        try {
            ws.value.close();
        } catch (_) {
            // ignore
        }
    }
    ws.value = null;
    connected.value = false;
    connecting.value = false;
    assistantStreaming.value = false;
    assistantBuffer = '';
    stopMic();
};

const closeDialog = () => {
    localOpen.value = false;
};

const applyFromLastAssistant = () => {
    const last = [...messages.value].reverse().find((m) => m.role === 'assistant');
    if (!last) {
        errorMessage.value = '적용할 어시스턴트 메시지가 없습니다.';
        return;
    }
    const patch = extractPatch(last.text);
    if (!patch || Object.keys(patch).length === 0) {
        errorMessage.value = 'JSON 패치 형식을 찾지 못했습니다. 모델에게 JSON 패치를 요청하세요.';
        return;
    }
    emit('apply', patch);
};

const extractPatch = (text) => {
    if (!text) return null;
    const codeMatch = text.match(/```json([\s\S]*?)```/i);
    let payload = text;
    if (codeMatch && codeMatch[1]) {
        payload = codeMatch[1];
    }
    try {
        const parsed = JSON.parse(payload.trim());
        if (parsed.fields && Array.isArray(parsed.fields)) {
            return parsed.fields.reduce((acc, cur) => {
                if (cur && cur.name) acc[cur.name] = cur.value;
                return acc;
            }, {});
        }
        return parsed;
    } catch (e) {
        return null;
    }
};

const sendInitialPrompt = () => {
    if (!ws.value || !connected.value || !sessionReady.value || initialPromptSent.value) return;
    const intro =
        '현재 폼을 검토하고 채워야 할 항목을 파악한 뒤, 필요한 질문이 있으면 먼저 물어보고, 바로 채울 수 있는 값은 JSON 패치로 제안해줘.';
    ws.value.send(
        JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: intro }],
            },
        })
    );
    ws.value.send(JSON.stringify({ type: 'response.create' }));
    initialPromptSent.value = true;
    initialResponsePending.value = true;
};

const ensureAssistantStreamingMessage = () => {
    const last = messages.value[messages.value.length - 1];
    if (!last || last.role !== 'assistant' || !last.isStreaming) {
        messages.value = [
            ...messages.value,
            { id: messageSeq += 1, role: 'assistant', text: '', isStreaming: true },
        ];
    }
};

const updateAssistantStreamingMessage = (text) => {
    const idx = messages.value.length - 1;
    if (idx < 0) return;
    const last = messages.value[idx];
    if (last.role !== 'assistant') return;
    messages.value = [
        ...messages.value.slice(0, idx),
        { ...last, text, isStreaming: true },
    ];
};

const finalizeAssistantMessage = (text) => {
    // Prevent double-finalize when both content_part.done and output_text.done arrive
    const last = messages.value[messages.value.length - 1];
    const alreadyFinal =
        !assistantStreaming.value &&
        last &&
        last.role === 'assistant' &&
        last.isStreaming === false;
    if (alreadyFinal) {
        assistantBuffer = '';
        return;
    }

    assistantStreaming.value = false;
    const trimmed = (text || '').trim();
    if (!trimmed) {
        assistantBuffer = '';
        return;
    }
    const idx = messages.value.length - 1;
    if (idx >= 0 && messages.value[idx].role === 'assistant' && messages.value[idx].isStreaming) {
        messages.value = [
            ...messages.value.slice(0, idx),
            { ...messages.value[idx], text: trimmed, isStreaming: false },
        ];
    } else {
        messages.value = [
            ...messages.value,
            { id: messageSeq += 1, role: 'assistant', text: trimmed, isStreaming: false },
        ];
    }
    // 자동 패치 적용 (function call 없이 텍스트로 패치 제안 시)
    autoApplyFromText(trimmed);
};

const parseFieldsFromText = (text) => {
    if (!text) return [];
    const codeMatch = text.match(/```json([\s\S]*?)```/i);
    let payload = text;
    if (codeMatch && codeMatch[1]) {
        payload = codeMatch[1];
    }
    try {
        const parsed = JSON.parse(payload.trim());
        if (parsed.fields && Array.isArray(parsed.fields)) {
            return parsed.fields.filter((f) => f && f.name);
        }
    } catch (e) {
        return [];
    }
    return [];
};

const autoApplyFromText = (text) => {
    const fields = parseFieldsFromText(text);
    if (!fields.length) return;
    applyFields(fields);
};

// --------- Function calling helpers ---------
const buildToolsFromSchema = (schema) => {
    const fieldNames = (schema || []).map((f) => f.name).filter(Boolean);
    return [
        {
            type: 'function',
            name: 'update_form_fields',
            description:
                '현재 화면의 폼 필드를 채운다. 스키마에 없는 name은 금지. 문자열 외 타입은 문자열로 직렬화.',
            parameters: {
                type: 'object',
                properties: {
                    fields: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    enum: fieldNames.length ? fieldNames : undefined,
                                    description: '스키마에 존재하는 필드 name',
                                },
                                value: { type: 'string', description: '채울 값 (문자열로 전달)' },
                                reason: { type: 'string', description: '선택: 값 제안 이유' },
                            },
                            required: ['name', 'value'],
                        },
                    },
                },
                required: ['fields'],
            },
        },
        {
            type: 'function',
            name: 'submit_form',
            description:
                '사용자가 "제출/완료/등록"을 명시적으로 요청한 경우에만 호출해 폼을 제출한다. 필요한 값/체크포인트가 채워졌는지 확인한 뒤 호출한다.',
            parameters: {
                type: 'object',
                properties: {
                    confirm: {
                        type: 'boolean',
                        description: '제출 진행 여부(반드시 true로 명시)',
                    },
                    note: {
                        type: 'string',
                        description: '제출 사유나 코멘트(선택)',
                    },
                },
                required: ['confirm'],
            },
        },
    ];
};

const handleFunctionCalls = (event) => {
    if (!event || !event.response || !event.response.output) return;
    const outputs = event.response.output || [];
    outputs
        .filter((item) => item.type === 'function_call')
        .forEach((call) => {
            try {
                const args = JSON.parse(call.arguments || '{}');
                if (call.name === 'update_form_fields') {
                    const fields = Array.isArray(args.fields) ? args.fields : [];
                    if (!fields.length) return;
                    applyFields(fields);
                    sendFunctionCallOutput(call.call_id, { status: 'ok', applied_fields: fields.map((f) => f.name).filter(Boolean) });
                } else if (call.name === 'submit_form') {
                    const confirm = args.confirm !== false;
                    if (confirm) {
                        pendingSubmitCallId = call.call_id;
                        emit('submit', { callId: call.call_id });
                    } else {
                        sendFunctionCallOutput(call.call_id, { status: 'skipped', submitted: false });
                    }
                }
            } catch (e) {
                // ignore parse errors
            }
        });
};

const applyFields = (fields) => {
    const patch = {};
    const nameVariants = (name) => {
        if (!name || typeof name !== 'string') return [];
        const kebab = name.replace(/_/g, '-');
        const camel = name.replace(/[-_](.)/g, (_, g1) => g1.toUpperCase());
        return Array.from(new Set([name, kebab, camel]));
    };
    fields.forEach((f) => {
        if (f && f.name) {
            nameVariants(f.name).forEach((n) => {
                patch[n] = f.value;
            });
        }
    });
    if (Object.keys(patch).length) {
        emit('apply', patch);
    }
};

const sendFunctionCallOutput = (callId, payload) => {
    if (!ws.value || !connected.value) return;
    const output = payload || { status: 'ok' };
    ws.value.send(
        JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(output),
            },
        })
    );
    ws.value.send(JSON.stringify({ type: 'response.create' }));
};

const reportSubmitResult = (ok, message, callIdOverride) => {
    const callId = callIdOverride || pendingSubmitCallId;
    if (!callId) return;
    sendFunctionCallOutput(callId, { status: ok ? 'ok' : 'error', message: message || undefined, submitted: ok });
    pendingSubmitCallId = null;
};

defineExpose({ reportSubmitResult });

const startDrag = (event) => {
    if (event.button !== 0) return;
    dragStart.value = { x: event.clientX, y: event.clientY };
    dragStartDelta.value = { ...dragDelta.value };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};

const onDrag = (event) => {
    const nextX = dragStartDelta.value.x + (event.clientX - dragStart.value.x);
    const nextY = dragStartDelta.value.y + (event.clientY - dragStart.value.y);
    dragDelta.value = clampDragDelta(nextX, nextY);
};

const stopDrag = () => {
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
};

const clampDragDelta = (deltaX, deltaY) => {
    const card = document.querySelector('.ai-chat-card');
    const width = card?.offsetWidth || 420;
    const height = card?.offsetHeight || 520;
    const baseX = window.innerWidth / 2;
    const baseY = window.innerHeight / 2;
    const minX = 16 + width / 2 - baseX;
    const maxX = window.innerWidth - 16 - width / 2 - baseX;
    const minY = 16 + height / 2 - baseY;
    const maxY = window.innerHeight - 16 - height / 2 - baseY;
    return {
        x: Math.min(Math.max(deltaX, minX), maxX),
        y: Math.min(Math.max(deltaY, minY), maxY),
    };
};

const toggleMic = async () => {
    if (isMicOn.value) {
        stopMic();
        return;
    }
    // 마이크 시작 시 현재 모델 응답/오디오를 끊어 버퍼 비우기
    cancelCurrentResponse();
    micLoading.value = true;
    try {
        await startMic();
        isMicOn.value = true;
    } catch (e) {
        errorMessage.value = '마이크를 시작하지 못했습니다.';
    } finally {
        micLoading.value = false;
    }
};

const startMic = async () => {
    if (processor.value) return;
    mediaStream.value = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const source = audioContext.value.createMediaStreamSource(mediaStream.value);
    processor.value = audioContext.value.createScriptProcessor(2048, 1, 1);
    processor.value.onaudioprocess = (event) => {
        if (!connected.value || !ws.value || ws.value.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i += 1) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.value.send(
            JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: arrayBufferToBase64(pcm.buffer),
            })
        );
    };
    source.connect(processor.value);
    processor.value.connect(audioContext.value.destination);
};

const stopMic = () => {
    if (processor.value) {
        processor.value.disconnect();
        processor.value.onaudioprocess = null;
        processor.value = null;
    }
    if (mediaStream.value) {
        mediaStream.value.getTracks().forEach((t) => t.stop());
        mediaStream.value = null;
    }
    if (audioContext.value) {
        audioContext.value.close();
        audioContext.value = null;
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
    isMicOn.value = false;
    micLevel.value = 0;
};

const ensurePlaybackContext = () => {
    if (!playbackContext.value) {
        playbackContext.value = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (playbackContext.value.state === 'suspended') {
        playbackContext.value.resume();
    }
    return playbackContext.value;
};

const enqueuePcmForPlayback = (arrayBuffer) => {
    const ctx = ensurePlaybackContext();
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i += 1) {
        float32[i] = int16[i] / 0x8000;
    }
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    playbackQueue.push(buffer);
    if (!isPlayingAudio.value) {
        playNextInQueue();
    }
};

const playNextInQueue = () => {
    if (!playbackQueue.length) {
        isPlayingAudio.value = false;
        currentSource = null;
        return;
    }
    const ctx = ensurePlaybackContext();
    const buffer = playbackQueue.shift();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = playNextInQueue;
    currentSource = source;
    isPlayingAudio.value = true;
    source.start();
};

const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};
</script>

<style scoped>
.assistant-log {
    max-height: 360px;
    overflow-y: auto;
    background: #f8f9fb;
    border: 1px solid #eceff3;
    border-radius: 8px;
    padding: 12px;
}

.ai-chat-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2000;
}

.ai-chat-card {
    width: 420px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.ai-chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: move;
    user-select: none;
}

.ai-chat-title {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ai-chat-status {
    font-size: 12px;
    color: #666;
    padding: 2px 6px;
    border-radius: 8px;
    background: #f0f0f0;
}

.ai-chat-status.success {
    color: #0a7d47;
    background: #e4f4eb;
}

.ai-chat-status.warn {
    color: #9a5b00;
    background: #fff1d6;
}

.ai-chat-body {
    flex: 1;
    min-height: 0;
    max-height: 400px;
    overflow-y: auto;
    padding: 12px;
    background: #fafafa;
}

.ai-chat-message {
    display: flex;
    margin-bottom: 10px;
}

.ai-chat-message--user {
    justify-content: flex-end;
}

.ai-chat-message--assistant {
    justify-content: flex-start;
}

.ai-chat-bubble {
    max-width: 75%;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 0.9rem;
    white-space: pre-wrap;
    word-break: break-word;
}

.ai-chat-message--user .ai-chat-bubble {
    background: rgb(var(--v-theme-primary));
    color: white;
}

.ai-chat-message--assistant .ai-chat-bubble {
    background: white;
    border: 1px solid #e0e0e0;
}

.ai-chat-typing {
    opacity: 0.7;
}

.ai-chat-input {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ai-chat-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
}
</style>
