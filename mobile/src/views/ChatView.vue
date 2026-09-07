<template>
    <div class="m-screen">
        <header class="m-appbar">
            <h1>채팅</h1>
            <button type="button" aria-label="지난 대화" @click="router.push('/chat/history')"><Icon name="history" /></button>
        </header>

        <!-- 빈 화면. 무엇을 물어도 되는지 예시로 알려 준다. -->
        <div class="start">
            <div class="start__hello">
                <img class="start__logo" src="/process-gpt-favicon.png" alt="Process-GPT" />
                <h2 class="start__title">무엇을 도와드릴까요?</h2>
                <p class="m-muted">프로세스 생성 · 실행 · 조회를 말로 요청하세요.</p>
            </div>

            <div class="start__examples">
                <button
                    v-for="ex in EXAMPLES"
                    :key="ex"
                    type="button"
                    class="start__example"
                    @click="draft = ex"
                >
                    {{ ex }}
                </button>
            </div>
        </div>

        <p v-if="error" class="m-note m-note--danger start__error">{{ error }}</p>

        <MobileComposer
            v-model="draft"
            :docs="docs"
            :busy="starting"
            placeholder="예: 휴가 신청 프로세스 만들어줘"
            @send="start"
            @pick-knowledge="knowledgeOpen = true"
            @remove-doc="removeDoc"
            @voice-error="(m: string) => (error = m)"
        />

        <KnowledgePicker v-if="knowledgeOpen" :selected="docs" @close="knowledgeOpen = false" @confirm="pickDocs" />
    </div>
</template>

<script setup lang="ts">
/**
 * 채팅 첫 화면.
 *
 * 목록이 아니라 **빈 입력창**이 먼저 나온다. 앱을 여는 이유의 대부분은
 * 무언가를 물어보려는 것이지 지난 대화를 뒤지려는 것이 아니다.
 * 지난 대화는 오른쪽 위 버튼으로 간다.
 */

import Icon from '../components/Icon.vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import KnowledgePicker from '../components/KnowledgePicker.vue';
import MobileComposer from '../components/MobileComposer.vue';
import { backend } from '../lib/backend.js';
import { stash } from '../lib/handoff.js';
import { buildRoom } from '../lib/newChat.js';
import { currentSession } from '../lib/session.js';

/** 포털 메인 채팅과 같은 예시. 무엇을 물어도 되는지 알려 주는 역할이다. */
const EXAMPLES = [
    '휴가 신청 프로세스를 만들어줘',
    '프로세스 실행',
    '내 휴가 신청 현황 알려줘',
    '우리 회사 조직도 알려줘'
];

const router = useRouter();
const draft = ref('');
const docs = ref<any[]>([]);
const knowledgeOpen = ref(false);
const starting = ref(false);
const error = ref('');

function uuid() {
    return (crypto as any).randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickDocs(selected: any[]) {
    docs.value = selected || [];
    knowledgeOpen.value = false;
}

function removeDoc(doc: any) {
    docs.value = docs.value.filter((d) => d !== doc);
}

/**
 * 방을 만들고 그 방으로 넘어간다. 첫 메시지는 방 화면이 보낸다.
 *
 * 여기서 보내지 않는 이유: 보내는 도중에 화면을 옮기면 스트리밍 응답을 받을
 * 곳이 사라진다. 방을 먼저 열고 그 안에서 보내야 답이 그대로 쌓인다.
 */
async function start({
    text,
    orchestration,
    attachments = []
}: {
    text: string;
    orchestration: string;
    attachments?: File[];
}) {
    starting.value = true;
    error.value = '';
    try {
        const session = await currentSession();
        const room = buildRoom(
            {
                id: localStorage.getItem('uid'),
                email: session?.user?.email,
                username: localStorage.getItem('userName')
            },
            orchestration,
            { id: uuid() }
        );
        if (!room) {
            error.value = '로그인 정보를 확인하지 못했습니다.';
            return;
        }

        await backend().putObject('db://chat_rooms', room);

        // 파일은 주소에 실을 수 없다. 방 화면이 찾아가도록 맡겨 둔다.
        stash(attachments);

        router.push({
            path: `/chat/${encodeURIComponent(room.id)}`,
            // 방 화면이 열리자마자 이 말을 보낸다.
            query: { say: text, orchestration }
        });
    } catch (e: any) {
        error.value = '대화를 시작하지 못했습니다. 다시 시도해 주세요.';
        console.error('[chat] 방 생성 실패', e);
    } finally {
        starting.value = false;
    }
}
</script>

<style scoped>
.start {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 28px;
    padding: 24px 20px;
    overflow-y: auto;
}

.start__hello {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.start__logo {
    width: 40px;
    height: 40px;
    margin: 0 auto;
    display: block;
}

.start__title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
}

.start__examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.start__example {
    text-align: left;
    min-height: var(--tap);
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.92rem;
    color: var(--ink-soft);
}

.start__error {
    margin: 0 12px;
}
</style>
