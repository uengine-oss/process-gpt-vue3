<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>{{ roomName }}</h1>
            <button type="button" aria-label="대화 설정" @click="menuOpen = true"><Icon name="more" /></button>
            <button type="button" aria-label="지난 대화" @click="router.push('/chat/history')"><Icon name="history" /></button>
        </header>

        <div ref="scroller" class="m-body chat">
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <div v-for="msg in messages" :key="msg.id" class="bubble" :class="{ 'bubble--mine': msg.mine }">
                <span v-if="!msg.mine && msg.name" class="bubble__who">{{ msg.name }}</span>

                <!-- 붙어 온 사진 -->
                <template v-for="img in msg.images" :key="img.url">
                    <a
                        v-if="!brokenImages.has(img.url)"
                        class="bubble__image"
                        :href="img.url"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img :src="img.url" alt="첨부 이미지" loading="lazy" @error="markBroken(img.url)" />
                    </a>
                    <!--
                        못 불러온 사진. 깨진 그림 아이콘만 남기면 사용자는 자기가
                        잘못 보낸 줄 안다. 무슨 일인지 말하고, 원본으로 갈 길을 준다.
                    -->
                    <a
                        v-else
                        class="bubble__file bubble__file--broken"
                        :href="img.url"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Icon name="image" :size="16" />
                        <span class="bubble__filename">이미지를 불러오지 못했습니다 — 눌러서 열기</span>
                    </a>
                </template>

                <!-- 붙어 온 파일 -->
                <button
                    v-for="f in msg.files"
                    :key="f.url || f.name"
                    type="button"
                    class="bubble__file"
                    @click="saveFile(f)"
                >
                    <Icon name="paperclip" :size="16" />
                    <span class="bubble__filename">{{ f.name }}</span>
                    <span v-if="f.size" class="bubble__filesize">{{ sizeText(f.size) }}</span>
                    <Icon name="download" :size="16" />
                </button>

                <!-- 내가 쓴 글은 그대로, 답변은 마크다운을 그려서. -->
                <p v-if="msg.mine && msg.text" class="bubble__text">{{ msg.text }}</p>
                <div
                    v-else-if="msg.text"
                    class="bubble__text md"
                    @click="openLink"
                    v-html="renderMarkdown(msg.text)"
                ></div>

                <!--
                    대화 속 입력 양식(OpenUI). 포털과 **같은 컴포넌트**를 쓴다 —
                    다시 만들면 웹에서 되는 양식이 앱에서 깨진다.
                -->
                <div v-if="msg.openuiLang" class="bubble__openui">
                    <OpenUiRenderer :response="msg.openuiLang" @action="(e) => onOpenUiAction(msg, e)" />
                </div>

                <!-- 만들어진 산출물. 앱에서 볼 수 있으면 여기서 펼친다. -->
                <ArtifactCard v-if="msg.artifact" :artifact="msg.artifact" @save="saveFile" />

                <!--
                    만들어진 것을 따라갈 길. 프로세스 생성은 답을 준 뒤에도
                    뒤에서 계속 진행되므로, 결과를 보러 갈 곳이 필요하다.
                -->
                <button
                    v-if="msg.follow"
                    type="button"
                    class="bubble__follow"
                    @click="router.push(msg.follow.route)"
                >
                    {{ msg.follow.label }}
                </button>
            </div>

            <!-- 지금 답하는 중. 도착한 만큼 바로 보여 준다. -->
            <div v-if="streaming || busy" class="bubble">
                <!--
                    지금 무엇을 하는 중인지. 오래 걸리는 질의에서 빈 화면만 보이면
                    멈춘 것처럼 보인다. 포털과 같은 이름표를 쓴다.
                -->
                <ul v-if="steps.length" class="steps">
                    <li v-for="(t, i) in steps" :key="`${t}-${i}`" class="steps__row">
                        <span class="steps__dot" aria-hidden="true"></span>{{ t }}
                    </li>
                </ul>
                <div v-if="streaming" class="bubble__text md" v-html="streamingHtml"></div>
                <span v-if="streaming" class="cursor" aria-hidden="true">▋</span>
            </div>


            <!-- 답을 기다리는 질문이면 대화 안에서 바로 답하게 한다. -->
            <HitlPanel v-if="panel" :panel="panel" :busy="busy" @answer="(t: string) => send({ text: t, orchestration })" />
        </div>

        <!--
            오류는 입력창 바로 위에 둔다. 목록 맨 위에 두면 대화가 길어졌을 때
            화면 밖으로 밀려나, 첨부가 실패해도 사용자는 보냈다고 믿는다.
        -->
        <p v-if="error" class="m-note m-note--danger chat__error">{{ error }}</p>

        <MobileComposer
            :participants="participants"
            :docs="docs"
            :busy="busy"
            :can-talk="canTalk"
            :talking="talking"
            @send="send"
            @pick-knowledge="knowledgeOpen = true"
            @remove-doc="removeDoc"
            @stop="stop"
            @toggle-voice="talking = !talking"
            @voice-error="(m: string) => (error = m)"
        />

        <!--
            말로 하는 대화. 오디오·연결은 포털과 같은 부품을 그대로 쓰고,
            화면만 휴대폰에 맞춘다.
        -->
        <VoiceSession
            :active="talking"
            :origin="apiBase.origin"
            :room-id="roomId"
            :agent="voiceAgent"
            :history="voiceContext"
            @user-said="onVoiceUser"
            @agent-delta="onVoiceAgentDelta"
            @agent-said="onVoiceAgentDone"
            @agent-interrupted="onVoiceAgentInterrupted"
            @close="talking = false"
        />

        <!-- 대화 설정. 포털의 설정 메뉴와 같은 것들이다. -->
        <div v-if="menuOpen" class="sheet" @click.self="menuOpen = false">
            <div class="sheet__panel" role="dialog" aria-label="대화 설정">
                <h2 class="sheet__title">대화</h2>
                <button type="button" class="sheet__item" @click="startRename">
                    <strong>이름 바꾸기</strong>
                    <span class="m-muted">{{ roomName }}</span>
                </button>
                <button type="button" class="sheet__item sheet__item--danger" @click="confirmDelete">
                    <strong>대화 삭제</strong>
                    <span class="m-muted">주고받은 내용이 모두 지워집니다</span>
                </button>
                <button type="button" class="m-btn m-btn--block" @click="menuOpen = false">닫기</button>
            </div>
        </div>

        <div v-if="renaming" class="sheet" @click.self="renaming = false">
            <div class="sheet__panel" role="dialog" aria-label="이름 바꾸기">
                <h2 class="sheet__title">이름 바꾸기</h2>
                <div class="m-field">
                    <input v-model="renameDraft" type="text" maxlength="50" aria-label="대화 이름" />
                </div>
                <button
                    type="button"
                    class="m-btn m-btn--primary m-btn--block"
                    :disabled="!renameDraft.trim()"
                    @click="applyRename"
                >
                    저장
                </button>
                <button type="button" class="m-btn m-btn--block" @click="renaming = false">취소</button>
            </div>
        </div>

        <KnowledgePicker
            v-if="knowledgeOpen"
            :selected="docs"
            @close="knowledgeOpen = false"
            @confirm="pickDocs"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import OpenUiRenderer from '@/components/openui/OpenUiRenderer.vue';
import ArtifactCard from '../components/ArtifactCard.vue';
import HitlPanel from '../components/HitlPanel.vue';
import Icon from '../components/Icon.vue';
import KnowledgePicker from '../components/KnowledgePicker.vue';
import MobileComposer from '../components/MobileComposer.vue';
import VoiceSession from '../components/VoiceSession.vue';
import { buildParams, streamUrl } from '../lib/agentChat.js';
import { sizeText, uploadAll } from '../lib/attachments.js';
import { download, reasonText } from '../lib/download.js';
import { formatToolName } from '@/shared/toolNames/index.js';
import { backend } from '../lib/backend.js';
import { take } from '../lib/handoff.js';
import { render as renderMarkdown } from '../lib/markdown.js';
import { outgoingMessage, pendingPanel, toConversation } from '../lib/chat.js';
import { touchDevice } from '../lib/push.js';
import {
    canUseVoice,
    placeUserMessage,
    voiceAgentMessage,
    voiceHistory,
    voiceUserMessage
} from '@/shared/voice/index.js';
import { withPreview } from '../lib/rooms.js';
import { isFirstUserMessage, shouldGenerateChatRoomName } from '@/shared/chatRoom/index.js';
import { currentSession } from '../lib/session.js';
import { apiBase } from '../main';

import FixedBaseWorkAssistantAgentService from '@/services/FixedBaseWorkAssistantAgentService';
import { getValidToken } from '@/utils/supabaseAuth';

const route = useRoute();
const router = useRouter();

const roomId = decodeURIComponent(String(route.params.id || ''));
const roomName = ref('대화');
// 목록 미리보기를 갱신하려면 방 전체가 필요하다. 일부만 쓰면 나머지 칸이 지워진다.
const room = ref<any>(null);
const rows = ref<any[]>([]);
const streaming = ref('');
const docs = ref<any[]>([]);
const knowledgeOpen = ref(false);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const orchestration = ref('langchain-react');
const scroller = ref<HTMLElement | null>(null);

let subscription: any = null;
let session: any = null;
let controller: AbortController | null = null;

const messages = computed(() => toConversation(rows.value));

/** 못 불러온 사진들. 한 번 실패한 것을 계속 다시 시도하면 화면이 깜빡인다. */
const brokenImages = ref<Set<string>>(new Set());

function markBroken(url: string) {
    brokenImages.value = new Set([...brokenImages.value, url]);
}

/**
 * 이 대화에서 지금까지 오간 파일 전체.
 *
 * 매 턴 다시 실어 보내지 않으면 에이전트가 바로 다음 질문에서 "첨부된 문서가
 * 없습니다" 라고 답한다 — 실제로 그랬다. 포털도 같은 것을 보낸다.
 */
/**
 * 이 방에 들어와 있는 에이전트들. @ 후보로 쓴다.
 *
 * 방 정보의 participants 에서 에이전트만 고른다 — 사람에게 멘션해도
 * 답하지 않으므로 후보에 두면 헷갈린다.
 */
const participants = computed(() => {
    const list = Array.isArray(room.value?.participants) ? room.value.participants : [];
    return list
        .filter((p: any) => p && (p.is_agent === true || p.agent_type === 'agent' || p.id === 'process_gpt_agent'))
        .map((p: any) => ({ id: p.id, username: p.username || p.email || p.id, alias: p.alias || '' }));
});

/**
 * 말로 대화할 수 있는 방인가.
 *
 * 나와 에이전트 단둘일 때만 연다 — 포털과 같은 규칙이다. 사람이 여럿인 방에서는
 * 마이크가 잡은 말이 누구 것인지 모호해지고, 남의 발화까지 내 이름으로 남는다.
 */
const canTalk = computed(() => canUseVoice(room.value?.participants));

/** 지금 말로 대화하는 중인가. */
const talking = ref(false);

/** 이 세션에서 말을 주고받을 상대. 방에 있는 에이전트다. */
const voiceAgent = computed(() => participants.value[0] || null);

/** 세션을 시작할 때 넘길 지난 대화. 없으면 같은 설명을 두 번 하게 된다. */
const voiceContext = computed(() => voiceHistory(messages.value));

// 지금 만들어지는 중인 에이전트 말. 조각으로 오므로 한 줄을 잡아 두고 이어 붙인다.
const voiceAgentRow = ref<any>(null);

/** 말로 오간 것도 글로 남긴다. 안 남기면 대화를 다시 열었을 때 빈 방이 된다. */
async function saveVoiceMessage(message: any) {
    try {
        await backend().putObject(`db://chats/${message.uuid}`, {
            uuid: message.uuid,
            id: roomId,
            messages: message
        });
    } catch (e) {
        // 저장에 실패해도 대화는 이어져야 한다. 화면에는 이미 보인다.
        console.warn('[voice] 저장 실패', e);
    }
}

/** 사용자가 한 말. */
async function onVoiceUser(text: string) {
    const message = voiceUserMessage({
        text,
        user: { email: session?.user?.email, username: localStorage.getItem('userName') },
        uuid: uuid()
    });
    if (!message) return;

    // 에이전트 말이 먼저 들어와 있으면 그 앞에 끼운다 — OpenAI 는 답변 전사가
    // 질문 전사보다 먼저 온다. 그대로 붙이면 대화가 뒤집혀 보인다.
    rows.value = placeUserMessage(rows.value, voiceRow(message), voiceAgentRow.value?.uuid);
    await scrollToEnd();

    void savePreview(message.content);
    void saveVoiceMessage(message);
}

/** 에이전트 말이 조각으로 온다. 오는 대로 이어 붙여 보여 준다. */
function onVoiceAgentDelta(delta: string) {
    if (!delta) return;

    if (!voiceAgentRow.value) {
        const message = voiceAgentMessage({ text: delta, agent: voiceAgent.value, uuid: uuid() });
        if (!message) return;
        voiceAgentRow.value = message;
        rows.value = [...rows.value, voiceRow(message)];
    } else {
        voiceAgentRow.value = {
            ...voiceAgentRow.value,
            content: (voiceAgentRow.value.content || '') + delta
        };
        replaceVoiceRow(voiceAgentRow.value);
    }
    void scrollToEnd();
}

/** 에이전트 말이 끝났다. 최종 글로 확정하고 남긴다. */
async function onVoiceAgentDone(text: string) {
    const finalText = (text || '').trim() || voiceAgentRow.value?.content || '';
    if (!finalText) {
        voiceAgentRow.value = null;
        return;
    }

    // 사용자 말(먼저 저장됨)보다 뒤 시각이어야 다시 열었을 때 순서가 유지된다.
    const message = voiceAgentRow.value
        ? { ...voiceAgentRow.value, content: finalText, timeStamp: new Date().toISOString() }
        : voiceAgentMessage({ text: finalText, agent: voiceAgent.value, uuid: uuid() });
    if (!message) return;

    replaceVoiceRow(message);
    voiceAgentRow.value = null;

    void savePreview(finalText);
    await saveVoiceMessage(message);
}

/**
 * 사용자가 말을 끊어 에이전트 응답이 중단됐다.
 *
 * 여기까지 온 말은 실제로 들린 말이므로 그대로 남긴다. 지우면 대화 기록에
 * 구멍이 생겨, 왜 이런 대답이 나왔는지 나중에 알 수 없다.
 */
function onVoiceAgentInterrupted() {
    if (!voiceAgentRow.value) return;
    void onVoiceAgentDone(voiceAgentRow.value.content || '');
}

/** 화면 목록은 `chats` 행 모양을 다룬다. 말로 만든 메시지도 같은 옷을 입힌다. */
function voiceRow(message: any) {
    return { uuid: message.uuid, id: roomId, messages: message };
}

function replaceVoiceRow(message: any) {
    const at = rows.value.findIndex((r: any) => r.uuid === message.uuid);
    const row = voiceRow(message);
    if (at >= 0) rows.value.splice(at, 1, row);
    else rows.value.push(row);
}

const sessionFiles = computed(() =>
    messages.value.filter((m: any) => m.mine).flatMap((m: any) => m.files || [])
);

/** 오는 대로 그린다. 다 온 뒤에 그리면 답이 한참 뒤에 나타나는 것처럼 보인다. */
const streamingHtml = computed(() => renderMarkdown(streaming.value));

/** 이번 답을 만드는 동안 에이전트가 쓴 도구들. */
const steps = ref<string[]>([]);

/** 마지막 메시지가 답을 기다리는 것이면 패널을 붙인다. */
const panel = computed(() => {
    if (busy.value) return null;
    const last = messages.value[messages.value.length - 1];
    return last ? pendingPanel(last) : null;
});

function uuid() {
    return (crypto as any).randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function scrollToEnd() {
    await nextTick();
    const el = scroller.value;
    if (el) el.scrollTop = el.scrollHeight;
}

function pickDocs(selected: any[]) {
    docs.value = selected || [];
    knowledgeOpen.value = false;
}

function removeDoc(doc: any) {
    docs.value = docs.value.filter((d) => d !== doc);
}

async function load() {
    try {
        room.value = await backend().getChatRoom(roomId);
        roomName.value = room.value?.name || '대화';
        // 방에 적힌 에이전트를 그대로 이어 쓴다. 매번 기본값으로 돌아가면
        // 사용자가 고른 것이 조용히 무시된다.
        const ctx =
            typeof room.value?.context === 'string' ? safeParse(room.value.context) : room.value?.context;
        orchestration.value = (ctx?.orchestration || route.query.orchestration || 'langchain-react').toString();

        // 최근 것부터 오므로 뒤집어 시간순으로 만든다.
        rows.value = ((await backend().getMessages(roomId, { size: 100 })) || []).slice().reverse();
        await scrollToEnd();
    } catch (e: any) {
        error.value = '대화를 불러오지 못했습니다.';
        console.error('[chat] 조회 실패', e);
    } finally {
        loading.value = false;
    }
}

/**
 * 첫 마디로 대화방 이름을 짓는다.
 *
 * 포털과 **같은 방법**이다 — 판단 규칙은 @/shared/chatRoom, 이름 생성은
 * backend.generateSemanticName('chat', ...). 앱만 따로 만들면 같은 대화가
 * 웹에서는 이름이 붙고 앱에서는 "새 대화" 로 남는다. 실제로 그랬다.
 *
 * 이름이 늦게 와도 대화를 막지 않는다. 오는 대로 반영한다.
 */
async function autoName(text: string) {
    if (!shouldGenerateChatRoomName(room.value)) return;

    try {
        const generated = await backend().generateSemanticName('chat', text);
        if (!generated) return;

        const next = {
            ...room.value,
            name: generated,
            context: { ...(room.value?.context || {}), auto_name_pending: false }
        };
        await backend().putObject('db://chat_rooms', next);
        room.value = next;
        roomName.value = generated;
    } catch (e) {
        console.warn('[chat] 대화방 이름 생성 실패', e);
    }
}

/**
 * 만들어진 문서를 기기에 저장한다.
 *
 * 앱 화면은 내부 서버 위에 있어 여기서 바로 내려받을 수 없다.
 * 기기 브라우저로 넘겨 사용자가 아는 방식으로 저장되게 한다.
 */
/**
 * 양식에서 누른 것을 그대로 대화로 보낸다.
 *
 * 포털은 구조화된 제출(openuiFormSubmission)까지 보내지만, 앱에서는 먼저
 * 사용자가 고른 값을 말로 전달한다 — 그래야 에이전트가 다음 단계를 이어 간다.
 */
function onOpenUiAction(_msg: any, event: any) {
    const label = String(event?.label || event?.value || event?.action || '').trim();
    if (!label) return;
    void send({ text: label, orchestration: orchestration.value });
}

/**
 * 답변 속 링크를 기기 브라우저로 넘긴다.
 *
 * 딥 에이전트가 만든 문서는 답변에 내려받기 링크로 실려 온다. 앱 화면은
 * Capacitor 의 내부 서버 위에 있어서, 그냥 두면 눌러도 앱 안에서 열리려다
 * 아무 일도 일어나지 않는다 — 실패조차 조용하다.
 *
 * 첨부 파일 내려받기와 **같은 길**로 보낸다(기기 브라우저). 그쪽은 이미
 * 동작을 확인한 경로다.
 */
function openLink(event: MouseEvent) {
    const target = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    const href = target?.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return;

    event.preventDefault();
    const result = download({ url: href, name: target?.textContent || '' });
    if (!result.ok) error.value = reasonText(result.reason);
}

function saveFile(file: any) {
    const result = download(file);
    if (!result.ok) error.value = reasonText(result.reason);
}

const menuOpen = ref(false);
const renaming = ref(false);
const renameDraft = ref('');

function startRename() {
    renameDraft.value = roomName.value === '대화' ? '' : roomName.value;
    menuOpen.value = false;
    renaming.value = true;
}

/** 이름을 바꾼다. 포털과 같이 방 전체를 다시 쓴다 — 일부만 쓰면 나머지가 지워진다. */
async function applyRename() {
    const next = String(renameDraft.value || '').trim().slice(0, 50);
    if (!next) return;

    renaming.value = false;
    try {
        const updated = { ...room.value, name: next };
        await backend().putObject('db://chat_rooms', updated);
        room.value = updated;
        roomName.value = next;
    } catch (e) {
        error.value = '이름을 바꾸지 못했습니다.';
        console.error('[chat] 이름 변경 실패', e);
    }
}

/**
 * 대화를 지운다.
 *
 * 포털과 같은 순서다 — 내용(chats)을 먼저, 방(chat_rooms)을 나중에.
 * 되돌릴 수 없으므로 한 번 더 묻는다.
 */
async function confirmDelete() {
    menuOpen.value = false;
    if (!window.confirm('이 대화를 삭제할까요? 주고받은 내용이 모두 지워집니다.')) return;

    try {
        await backend().delete(`db://chats/${roomId}`, { key: 'id' });
        await backend().delete(`db://chat_rooms/${roomId}`, { key: 'id' });
        await router.replace('/chat');
    } catch (e) {
        error.value = '대화를 삭제하지 못했습니다.';
        console.error('[chat] 삭제 실패', e);
    }
}

/** 목록 미리보기를 갱신한다. 실패해도 대화는 계속된다 — 목록만 조금 늦어진다. */
async function savePreview(text: string) {
    const next = withPreview(room.value, text);
    if (!next) return;
    try {
        await backend().putObject('db://chat_rooms', next);
        room.value = next;
    } catch (e) {
        console.warn('[chat] 목록 미리보기 갱신 실패', e);
    }
}

function safeParse(text: string) {
    try {
        return JSON.parse(text);
    } catch (_e) {
        return null;
    }
}

/**
 * 새 메시지를 실시간으로 받는다.
 *
 * 없으면 사용자가 직접 새로고침해야 한다. 스트리밍이 끝난 뒤 서버가 저장한
 * 최종본도 이 경로로 들어온다.
 */
/**
 * 한 줄을 목록에 넣는다. 같은 uuid 가 이미 있으면 갈아 끼운다.
 *
 * 실시간으로 들어온 것과 내가 방금 올린 것이 같은 줄일 수 있다. 그때 두 번
 * 쌓이면 같은 말이 두 번 보인다.
 */
function showLocally(row: any) {
    if (!row?.uuid) return;
    const at = rows.value.findIndex((r) => r.uuid && r.uuid === row.uuid);
    if (at >= 0) rows.value.splice(at, 1, row);
    else rows.value.push(row);
}

async function watch() {
    try {
        subscription = await backend().watchChats(
            (payload: any) => {
                const row = payload?.new;
                if (!row || row.id !== roomId) return;
                const at = rows.value.findIndex((r) => r.uuid && r.uuid === row.uuid);
                if (at >= 0) rows.value.splice(at, 1, row);
                else rows.value.push(row);
                void scrollToEnd();
            },
            { filter: `id=eq.${roomId}` }
        );
    } catch (e) {
        console.warn('[chat] 실시간 구독 실패 — 새로고침으로 확인해야 합니다', e);
    }
}

/**
 * 보낸다.
 *
 * 두 가지를 한다.
 *   1) 사용자 메시지를 저장한다 — 화면에 바로 뜨고, 웹에서도 보인다
 *   2) 에이전트를 부른다 — 이것이 없으면 저장만 되고 답이 영원히 안 온다
 */
async function send({
    text,
    orchestration: chosen,
    attachments = [],
    mentioned = []
}: {
    text: string;
    orchestration?: string;
    attachments?: File[];
    mentioned?: any[];
}) {
    const value = (text || '').trim();
    // 사진만 보내는 일도 흔하다. 글이 없다고 막지 않는다.
    if ((!value && !attachments.length) || busy.value) return;

    if (chosen) orchestration.value = chosen;
    busy.value = true;
    error.value = '';
    streaming.value = '';

    // 보내기 전에 판단해야 한다 — 보낸 뒤에는 내 메시지가 이미 들어가 있다.
    const firstMessage = isFirstUserMessage(messages.value);

    steps.value = [];

    const messageUuid = uuid();
    const responseUuid = uuid();

    try {
        // 먼저 올린다. 주소가 나와야 메시지에 실을 수 있고, 웹에서도 같은 것이 보인다.
        const uploaded = attachments.length
            ? await uploadAll(attachments, {
                  uuid,
                  roomId,
                  uploadImage: (path: string, f: File) => backend().uploadImage(path, f),
                  getImageUrl: (path: string) => backend().getImageUrl(path),
                  uploadFileToStorage: (f: File, options: any) => backend().uploadFileToStorage(f, options)
              })
            : { images: [], files: [], errors: [] };

        // 실패한 것은 조용히 넘기지 않는다 — 보냈다고 믿는 쪽이 더 나쁘다.
        if (uploaded.errors.length) error.value = `첨부 실패 — ${uploaded.errors.join(' / ')}`;

        const message = outgoingMessage({
            text: value,
            name: localStorage.getItem('userName') || '',
            email: session?.user?.email || '',
            images: uploaded.images,
            files: uploaded.files
        });
        if (!message) return;

        await backend().updateInstanceChat(roomId, message, null, messageUuid);

        // 내가 쓴 것을 바로 화면에 올린다.
        //
        // 실시간 구독으로도 같은 줄이 들어오지만, 방을 막 만들고 첫 마디를 보낼
        // 때는 구독이 붙기 전에 저장이 끝나 그 알림을 놓친다. 그러면 **내가 보낸
        // 말이 화면에서 사라지고** 답만 떠 있다가, 방을 나갔다 들어와야 보였다.
        // 같은 uuid 로 다시 들어오면 아래 구독이 이 줄을 갈아 끼운다.
        showLocally({ uuid: messageUuid, id: roomId, messages: message });
        await scrollToEnd();

        // 목록은 방의 message 칸을 읽는다. 갱신하지 않으면 대화가 쌓여도
        // 목록에는 계속 "아직 대화 없음" 으로 남는다.
        void savePreview(value || uploaded.files[0]?.fileName || '첨부');

        // 첫 마디면 이름을 지어 준다. 두 번째부터는 사용자가 바꿨을 수 있어 두지 않는다.
        if (value && firstMessage) void autoName(value);

        const service = new FixedBaseWorkAssistantAgentService(
            streamUrl(apiBase.origin, orchestration.value)
        );
        controller = new AbortController();

        await service.sendMessageStream(
            buildParams({
                text: value,
                roomId,
                session,
                tenantId: (window as any).$tenantName,
                jwt: (await getValidToken()) || '',
                docs: docs.value,
                files: uploaded.files,
                images: uploaded.images,
                sessionFiles: sessionFiles.value,
                mentioned,
                ids: { message: messageUuid, response: responseUuid }
            }),
            {
                onToken: (token: string) => {
                    streaming.value += token;
                    void scrollToEnd();
                },
                onToolStart: (tool: any) => {
                    // 같은 도구를 잇달아 쓰면 한 줄로 둔다.
                    const label = formatToolName(tool?.name || tool);
                    if (label && steps.value[steps.value.length - 1] !== label) {
                        steps.value = [...steps.value, label].slice(-6);
                    }
                    void scrollToEnd();
                },
                onError: (e: any) => {
                    console.error('[chat] 스트림 오류', e);
                    error.value = '답변을 받지 못했습니다. 다시 시도해 주세요.';
                }
            },
            { signal: controller.signal }
        );
    } catch (e: any) {
        if (e?.name !== 'AbortError') {
            error.value = '보내지 못했습니다. 다시 시도해 주세요.';
            console.error('[chat] 전송 실패', e);
        }
    } finally {
        // 최종본은 서버가 저장하고 실시간 구독으로 들어온다. 여기서 남겨 두면
        // 같은 답이 두 번 보인다.
        streaming.value = '';
        busy.value = false;
        controller = null;
    }
}

function stop() {
    controller?.abort();
}

/**
 * 이 방을 보고 있다고 남긴다.
 *
 * 데이터베이스 트리거(handle_chat_insert)가 이 값을 보고 알림을 만들지 정한다.
 * 남기지 않으면 **읽고 있는 화면의 답변에 대고 알림이 울린다** — 실제로
 * 그랬다. 방을 떠날 때는 비워야 한다. 안 그러면 떠난 뒤에도 그 방의 알림이
 * 영영 오지 않는다.
 */
async function markViewing(page: string) {
    try {
        if (!session) return;
        await touchDevice({ supabase: (window as any).$supabase, session, accessPage: page });
    } catch (_e) {
        // 알림 억제는 부가 기능이다. 실패해도 대화를 막지 않는다.
    }
}

onMounted(async () => {
    session = await currentSession();
    void markViewing(`chat:${roomId}`);
    await load();
    await watch();

    // 첫 화면에서 넘어온 첫 메시지. 방을 연 직후 바로 보낸다.
    // 붙인 파일은 주소에 실을 수 없어 따로 맡겨 두었다(handoff).
    const say = (route.query.say as string) || '';
    const carried = take();
    if (say.trim() || carried.length) {
        // 주소에서 먼저 지운다.
        //
        // 지우지 않으면 이 화면을 떠났다가 돌아올 때마다 같은 말이 다시 나간다 —
        // 프로세스 생성 요청이 되풀이되어 똑같은 작업이 계속 쌓였다.
        await router.replace({ path: route.path, query: { orchestration: route.query.orchestration } });
        void send({ text: say, orchestration: orchestration.value, attachments: carried });
    }
});

onUnmounted(() => {
    void markViewing('');
    controller?.abort();
    // 구독을 끊지 않으면 방을 옮길 때마다 쌓여 한 메시지가 여러 번 들어온다.
    try {
        subscription?.unsubscribe?.();
    } catch (_e) {}
});
</script>

<style scoped>
/* 되돌릴 수 없는 것은 색으로도 알린다. */
.sheet__item--danger strong {
    color: var(--danger);
}

.chat {
    gap: 8px;
}

.chat__error {
    margin: 0 12px 4px;
    flex: none;
}

.bubble {
    max-width: 84%;
    align-self: flex-start;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: 14px 14px 14px 4px;
    padding: 10px 13px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.bubble--mine {
    align-self: flex-end;
    background: var(--brand-wash);
    border-color: transparent;
    border-radius: 14px 14px 4px 14px;
}

.bubble__who {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ink-faint);
}

.bubble__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
}

.steps {
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.steps__row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.82rem;
    color: var(--ink-faint);
}

.steps__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--brand);
    flex: none;
}

.cursor {
    opacity: 0.5;
    margin-left: 1px;
}

/* --- 첨부 --- */

.bubble__openui {
    width: 100%;
}

.bubble__image img {
    max-width: 100%;
    border-radius: 10px;
    display: block;
}

.bubble__file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    border: 1px solid var(--rule);
    border-radius: 10px;
    font-size: 0.83rem;
    color: var(--ink-soft);
    text-decoration: none;
}

.bubble__filename {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bubble__follow {
    align-self: flex-start;
    margin-top: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--brand);
    color: var(--brand);
    font-size: 0.84rem;
    font-weight: 600;
    min-height: 34px;
}

.bubble__file--broken {
    color: var(--ink-faint);
}

.bubble__filesize {
    color: var(--ink-faint);
    flex: none;
}

/*
 * --- 마크다운 ---
 *
 * 그린 HTML 은 v-html 로 들어오므로 scoped 속성이 붙지 않는다. :deep 으로
 * 감싸지 않으면 이 규칙이 하나도 걸리지 않아, 표도 코드도 맨 글씨로 보인다.
 *
 * 폭은 좁고 스크롤은 세로뿐이다. 표와 코드처럼 넓어지는 것은 자기 안에서
 * 가로로 굴러야 한다 — 그러지 않으면 화면 전체가 옆으로 밀려 읽을 수 없다.
 */
.md {
    white-space: normal;
    line-height: 1.6;
}

.md :deep(> *:first-child) {
    margin-top: 0;
}

.md :deep(> *:last-child) {
    margin-bottom: 0;
}

.md :deep(p) {
    margin: 0 0 8px;
}

.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4) {
    margin: 14px 0 6px;
    font-weight: 700;
    line-height: 1.35;
}

.md :deep(h1) {
    font-size: 1.15rem;
}
.md :deep(h2) {
    font-size: 1.06rem;
}
.md :deep(h3),
.md :deep(h4) {
    font-size: 1rem;
}

.md :deep(ul),
.md :deep(ol) {
    margin: 0 0 8px;
    padding-left: 20px;
}

.md :deep(li) {
    margin: 2px 0;
}

.md :deep(a) {
    color: var(--brand);
    word-break: break-all;
}

.md :deep(code) {
    background: var(--ground);
    border: 1px solid var(--rule);
    border-radius: 5px;
    padding: 1px 4px;
    font-size: 0.86em;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.md :deep(pre) {
    background: var(--ground);
    border: 1px solid var(--rule);
    border-radius: 10px;
    padding: 10px 12px;
    margin: 0 0 8px;
    overflow-x: auto;
}

.md :deep(pre code) {
    background: none;
    border: none;
    padding: 0;
    white-space: pre;
}

.md :deep(table) {
    display: block;
    width: max-content;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 0 0 8px;
    font-size: 0.86rem;
}

.md :deep(th),
.md :deep(td) {
    border: 1px solid var(--rule);
    padding: 5px 9px;
    text-align: left;
}

.md :deep(th) {
    background: var(--ground);
    font-weight: 600;
}

.md :deep(blockquote) {
    margin: 0 0 8px;
    padding-left: 10px;
    border-left: 3px solid var(--rule);
    color: var(--ink-soft);
}

.md :deep(hr) {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 12px 0;
}

.md :deep(img) {
    max-width: 100%;
    border-radius: 8px;
}
</style>
