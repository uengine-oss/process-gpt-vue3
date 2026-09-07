<template>
    <div class="composer">
        <!-- 고를 때만 열리는 숨은 입력들. 화면에는 안 보인다. -->
        <input ref="cameraInput" type="file" :accept="IMAGE_ACCEPT" capture="environment" hidden @change="onPick" />
        <input ref="photoInput" type="file" :accept="IMAGE_ACCEPT" multiple hidden @change="onPick" />
        <input ref="fileInput" type="file" :accept="FILE_ACCEPT" multiple hidden @change="onPick" />

        <!-- 붙인 것들 -->
        <div v-if="attached.length" class="composer__attached">
            <div v-for="(f, i) in attached" :key="`${f.name}-${f.size}-${i}`" class="attach">
                <img v-if="previews[i]" class="attach__thumb" :src="previews[i]" :alt="f.name" />
                <Icon v-else class="attach__kind" name="paperclip" :size="16" />
                <span class="attach__name">{{ f.name }}</span>
                <span class="attach__size">{{ sizeText(f.size) }}</span>
                <button type="button" class="attach__x" :aria-label="`${f.name} 빼기`" @click="drop(i)">
                    <Icon name="close" :size="14" />
                </button>
            </div>
        </div>

        <p v-if="attachError" class="composer__error">{{ attachError }}</p>

        <!-- 고른 지식 문서 -->
        <div v-if="docs.length" class="composer__docs">
            <button
                v-for="doc in docs"
                :key="doc.key || doc.id || doc.name"
                type="button"
                class="composer__doc"
                @click="removeDoc(doc)"
            >
                {{ doc.name || doc.key }}
                <Icon name="close" :size="13" />
                <span class="sr-only">빼기</span>
            </button>
        </div>

        <div class="composer__box">
            <textarea
                ref="input"
                v-model="text"
                class="composer__text"
                :placeholder="placeholder"
                rows="1"
                :disabled="busy"
                @input="grow(); updateMention();"
                @keyup="updateMention"
                @paste="onPaste"
                @keydown.enter.exact.prevent="submit"
            ></textarea>

            <div class="composer__row">
                <!-- 첨부 -->
                <button
                    type="button"
                    class="composer__icon"
                    aria-label="첨부"
                    :disabled="busy"
                    @click="attachOpen = true"
                >
                    <Icon name="paperclip" :size="20" />
                </button>

                <!-- 에이전트 고르기 -->
                <button type="button" class="composer__chip" :disabled="busy" @click="agentOpen = true">
                    {{ currentAgentLabel }}
                    <Icon class="composer__caret" name="chevron-down" :size="16" />
                </button>

                <!-- 지식 베이스 -->
                <button type="button" class="composer__chip" :disabled="busy" @click="$emit('pick-knowledge')">
                    지식 베이스<span v-if="docs.length"> {{ docs.length }}</span>
                </button>

                <span class="composer__spacer"></span>

                <VoiceButton v-model="text" :busy="busy" @error="onVoiceError" />

                <button
                    v-if="busy"
                    type="button"
                    class="composer__send composer__send--stop"
                    aria-label="중지"
                    @click="$emit('stop')"
                >
                    <Icon name="stop" :size="14" />
                </button>
                <button
                    v-else
                    type="button"
                    class="composer__send"
                    aria-label="보내기"
                    :disabled="!text.trim() && !attached.length"
                    @click="submit"
                >
                    <Icon name="send" :size="20" />
                </button>
            </div>
        </div>

        <!--
            @ 를 치면 뜨는 후보. 좁은 화면에서 이름을 정확히 치게 하면
            오타 한 글자로 엉뚱한 에이전트가 답하거나 아무도 답하지 않는다.
        -->
        <div v-if="mentionOpen && mentionList.length" class="mention">
            <button
                v-for="c in mentionList"
                :key="c.id"
                type="button"
                class="mention__item"
                @click="chooseMention(c)"
            >
                {{ c.username || c.alias || c.id }}
            </button>
        </div>

        <!-- 첨부 방법. 휴대폰에서는 "지금 찍기" 가 가장 잦다. -->
        <div v-if="attachOpen" class="sheet" @click.self="attachOpen = false">
            <div class="sheet__panel" role="dialog" aria-label="첨부">
                <h2 class="sheet__title">첨부</h2>
                <button type="button" class="sheet__item" @click="pick('camera')">
                    <strong>사진 찍기</strong>
                    <span class="m-muted">카메라로 바로 찍어 붙입니다</span>
                </button>
                <button type="button" class="sheet__item" @click="pick('photo')">
                    <strong>사진 선택</strong>
                    <span class="m-muted">사진첩에서 고릅니다</span>
                </button>
                <button type="button" class="sheet__item" @click="pick('file')">
                    <strong>파일 선택</strong>
                    <span class="m-muted">문서·PDF 등. 에이전트가 내용을 읽습니다</span>
                </button>
                <button type="button" class="m-btn m-btn--block" @click="attachOpen = false">닫기</button>
            </div>
        </div>

        <!-- 에이전트 목록. 화면 아래에서 올라온다 — 위쪽은 손이 닿지 않는다. -->
        <div v-if="agentOpen" class="sheet" @click.self="agentOpen = false">
            <div class="sheet__panel" role="dialog" aria-label="에이전트 선택">
                <h2 class="sheet__title">에이전트</h2>
                <button
                    v-for="opt in AGENTS"
                    :key="opt.value"
                    type="button"
                    class="sheet__item"
                    :class="{ 'sheet__item--on': opt.value === agent }"
                    @click="chooseAgent(opt.value)"
                >
                    <strong>{{ opt.label }}</strong>
                    <span class="m-muted">{{ opt.hint }}</span>
                </button>
                <button type="button" class="m-btn m-btn--block" @click="agentOpen = false">닫기</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 메시지 입력창.
 *
 * 포털의 입력창(UnifiedChatInput → Chat.vue, 8,093줄)을 그대로 쓰지 않는다.
 * 그쪽은 넓은 화면 배치를 전제로 하고 편집기·미리보기까지 함께 끌어온다.
 * 여기서는 같은 기능만 골라 세로로 쌓는다 — 에이전트 고르기, 지식 베이스, 보내기.
 *
 * 고른 값은 위로 넘긴다. 실제 전송은 화면이 한다.
 */

import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

import {
    FILE_ACCEPT,
    IMAGE_ACCEPT,
    dedupe,
    imagesFromClipboard,
    isImage,
    sizeText,
    tooBig
} from '../lib/attachments.js';
import { applyMention, mentionDraft, resolveMentions, suggest } from '@/shared/mentions/index.js';
import Icon from './Icon.vue';
import VoiceButton from './VoiceButton.vue';

/**
 * 고를 수 있는 에이전트.
 *
 * 포털의 AgentSelectField 와 같은 값이어야 한다. 다른 값을 보내면 서버가 모르는
 * 엔진이 되어 답이 오지 않는다.
 */
const AGENTS = [
    { value: 'langchain-react', label: '기본', hint: '일반적인 질문과 조회' },
    { value: 'deepagents', label: '딥 에이전트', hint: '여러 단계를 스스로 밟는 작업' }
] as const;

const props = defineProps<{
    modelValue?: string;
    docs?: any[];
    busy?: boolean;
    placeholder?: string;
    /** 이 방에 들어와 있는 에이전트들. @ 후보로 쓴다. */
    participants?: any[];
}>();

const emit = defineEmits<{
    (e: 'send', payload: {
        text: string;
        orchestration: string;
        attachments: File[];
        mentioned: any[];
    }): void;
    (e: 'pick-knowledge'): void;
    (e: 'remove-doc', doc: any): void;
    (e: 'stop'): void;
    (e: 'update:modelValue', value: string): void;
    (e: 'voice-error', message: string): void;
}>();

const text = ref(props.modelValue || '');
const agent = ref<string>(props.modelValue ? 'langchain-react' : 'langchain-react');
const agentOpen = ref(false);
const input = ref<HTMLTextAreaElement | null>(null);

// 붙인 파일들. 올리는 것은 화면이 한다 — 입력창은 무엇을 붙였는지만 안다.
const attached = ref<File[]>([]);
const previews = ref<(string | null)[]>([]);
const attachOpen = ref(false);
const attachError = ref('');
const cameraInput = ref<HTMLInputElement | null>(null);
const photoInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const docs = computed(() => props.docs || []);
const placeholder = computed(() => props.placeholder || '무엇을 도와드릴까요?');
const currentAgentLabel = computed(
    () => AGENTS.find((a) => a.value === agent.value)?.label || '기본'
);

watch(
    () => props.modelValue,
    (next) => {
        if (typeof next === 'string' && next !== text.value) text.value = next;
    }
);

watch(text, (next) => emit('update:modelValue', next));

/** 여러 줄을 쓰면 입력창이 따라 커진다. 고정 높이면 쓴 내용이 안 보인다. */
async function grow() {
    await nextTick();
    const el = input.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

/** 지금 @ 를 치는 중인가. 그렇다면 후보를 띄운다. */
const mentionQuery = ref<string | null>(null);
const mentionOpen = computed(() => mentionQuery.value !== null);
const mentionList = computed(() => suggest(props.participants || [], mentionQuery.value || '').slice(0, 6));

function updateMention() {
    const el = input.value;
    mentionQuery.value = mentionDraft(text.value, el ? el.selectionStart : null);
}

function chooseMention(candidate: any) {
    const el = input.value;
    text.value = applyMention(text.value, el ? el.selectionStart : null, candidate);
    mentionQuery.value = null;
    void nextTick(() => el?.focus());
}

function onVoiceError(message: string) {
    // 조용히 실패하면 사용자는 자기 말이 안 들린 줄 안다.
    emit('voice-error', message);
}

function pick(which: 'camera' | 'photo' | 'file') {
    attachOpen.value = false;
    const el = which === 'camera' ? cameraInput.value : which === 'photo' ? photoInput.value : fileInput.value;
    // 같은 파일을 다시 고를 수 있어야 한다. 값을 비우지 않으면 change 가 안 뜬다.
    if (el) {
        el.value = '';
        el.click();
    }
}

function onPick(event: Event) {
    const input = event.target as HTMLInputElement;
    add(Array.from(input.files || []));
}

/** 화면을 캡처해 그대로 붙여넣는 쓰임이 잦다. */
function onPaste(event: ClipboardEvent) {
    const images = imagesFromClipboard(event.clipboardData);
    if (!images.length) return;
    event.preventDefault();
    add(images);
}

function add(files: File[]) {
    attachError.value = '';
    const big = files.filter((f) => tooBig(f));
    if (big.length) attachError.value = `${big[0].name} 은(는) 너무 큽니다 (${sizeText(big[0].size)}).`;

    const next = dedupe([...attached.value, ...files.filter((f) => !tooBig(f))]);
    attached.value = next;
    rebuildPreviews();
}

function drop(index: number) {
    attached.value = attached.value.filter((_f, i) => i !== index);
    attachError.value = '';
    rebuildPreviews();
}

/**
 * 사진은 작게 미리 보여 준다.
 *
 * 이름만 보이면 무엇을 붙였는지 알 수 없어, 엉뚱한 사진을 보내고 나서야 안다.
 * 만든 주소는 반드시 되돌려 준다 — 안 그러면 고를수록 메모리가 쌓인다.
 */
function rebuildPreviews() {
    releasePreviews();
    previews.value = attached.value.map((f) => (isImage(f) ? URL.createObjectURL(f) : null));
}

function releasePreviews() {
    for (const url of previews.value) if (url) URL.revokeObjectURL(url);
    previews.value = [];
}

onUnmounted(releasePreviews);

function chooseAgent(value: string) {
    agent.value = value;
    agentOpen.value = false;
}

function removeDoc(doc: any) {
    emit('remove-doc', doc);
}

function submit() {
    const value = text.value.trim();
    // 사진만 보내는 일도 흔하다. 글이 없다고 막지 않는다.
    if ((!value && !attached.value.length) || props.busy) return;

    emit('send', {
        text: value,
        orchestration: agent.value,
        attachments: attached.value,
        // 지목한 상대. 없으면 라우터가 고른다.
        mentioned: resolveMentions(value, props.participants || [])
    });
    mentionQuery.value = null;
    text.value = '';
    attached.value = [];
    releasePreviews();
    attachError.value = '';
    void grow();
}

defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.composer {
    flex: none;
    padding: 8px 12px calc(8px + var(--safe-bottom));
    background: var(--ground);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.composer__box {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: 20px;
    padding: 10px 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.composer__text {
    border: none;
    background: none;
    resize: none;
    outline: none;
    width: 100%;
    max-height: 160px;
    line-height: 1.5;
    padding: 2px 2px 4px;
}

.composer__row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.composer__spacer {
    flex: 1;
}

.composer__chip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--rule);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-soft);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--ground);
}

.composer__caret {
    font-size: 0.7rem;
    opacity: 0.7;
}

.composer__send {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--brand);
    color: var(--brand-ink);
    font-size: 1rem;
    display: grid;
    place-items: center;
    flex: none;
}

.composer__send:disabled {
    opacity: 0.35;
}

.composer__send--stop {
    background: var(--danger);
    font-size: 0.7rem;
}

.mention {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.mention__item {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--brand);
    color: var(--brand);
    background: var(--brand-wash);
    font-size: 0.84rem;
    font-weight: 600;
}

.composer__icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    color: var(--ink-soft);
}

.composer__icon:disabled {
    opacity: 0.4;
}

.composer__attached {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.attach {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.82rem;
}

.attach__thumb {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    object-fit: cover;
    flex: none;
}

.attach__kind {
    color: var(--ink-faint);
}

.attach__name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attach__size {
    color: var(--ink-faint);
    flex: none;
}

.attach__x {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    color: var(--ink-faint);
    flex: none;
}

.composer__error {
    margin: 0;
    font-size: 0.8rem;
    color: var(--danger);
}

.composer__docs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.composer__doc {
    font-size: 0.78rem;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--brand-wash);
    color: var(--brand);
    font-weight: 600;
    min-height: 30px;
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
}
</style>
