<template>
    <div class="pg-composer-wrap">
        <div class="pg-composer">
            <textarea
                ref="el"
                class="pg-composer__input"
                :value="modelValue"
                :placeholder="placeholder"
                :disabled="disabled"
                rows="1"
                @input="onInput"
                @keydown.enter.exact.prevent="submit"
            />
            <div class="pg-composer__bar">
                <slot name="left" />
                <div class="pg-composer__bar-right">
                    <slot name="right" />
                    <button
                        class="pg-composer__send"
                        type="button"
                        :disabled="disabled || busy || !modelValue.trim()"
                        :aria-label="busy ? '생성 중지' : '보내기'"
                        @click="busy ? $emit('stop') : submit()"
                    >
                        <PgIcon :name="busy ? 'mdi-stop' : 'mdi-arrow-up'" :size="16" />
                    </button>
                </div>
            </div>
        </div>
        <p v-if="disclaimer" class="pg-composer__disclaimer">{{ disclaimer }}</p>
    </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import PgIcon from './PgIcon.vue';

const props = withDefaults(
    defineProps<{
        modelValue?: string;
        placeholder?: string;
        disclaimer?: string;
        disabled?: boolean;
        /** 응답 생성 중 — 전송 버튼이 중지 버튼으로 바뀐다 */
        busy?: boolean;
        maxRows?: number;
    }>(),
    { modelValue: '', placeholder: '메시지를 입력하세요...', disabled: false, busy: false, maxRows: 12 }
);

const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void;
    (e: 'submit', v: string): void;
    (e: 'stop'): void;
}>();

const el = ref<HTMLTextAreaElement | null>(null);

function resize() {
    const node = el.value;
    if (!node) return;
    node.style.height = 'auto';
    const line = parseFloat(getComputedStyle(node).lineHeight) || 22;
    const max = line * props.maxRows;
    node.style.height = `${Math.min(node.scrollHeight, max)}px`;
    node.style.overflowY = node.scrollHeight > max ? 'auto' : 'hidden';
}

function onInput(ev: Event) {
    emit('update:modelValue', (ev.target as HTMLTextAreaElement).value);
    resize();
}

function submit() {
    const text = props.modelValue.trim();
    if (!text || props.disabled || props.busy) return;
    emit('submit', text);
}

onMounted(resize);
watch(() => props.modelValue, () => nextTick(resize));

defineExpose({ focus: () => el.value?.focus() });
</script>

<script lang="ts">
export default { name: 'PgComposer' };
</script>

<style scoped>
.pg-composer-wrap {
    width: 100%;
    max-width: var(--app-content-max);
    margin: 0 auto;
    padding: 0 16px 8px;
}

/* 실측: radius 20, max-width 768, 아주 옅은 확산 그림자 + 0.5px 헤어라인 */
.pg-composer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 12px 8px;
    border-radius: var(--cds-radius-composer);
    background: var(--cds-surface-2);
    box-shadow: var(--cds-shadow-composer);
    transition: box-shadow 160ms var(--cds-ease-out);
}
.pg-composer:focus-within {
    box-shadow: var(--cds-shadow-composer), var(--cds-shadow-md);
}

.pg-composer__input {
    width: 100%;
    max-height: 40vh;
    padding: 0 4px;
    border: 0;
    outline: 0;
    resize: none;
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body--lg);
    font-weight: 430;
    line-height: 22px;
}

.pg-composer__bar {
    display: flex;
    align-items: center;
    gap: 4px;
}
.pg-composer__bar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* 전송 버튼 — 원형, 브랜드 컬러 */
.pg-composer__send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: hsl(var(--accent-brand));
    color: #fff;
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out);
}
.pg-composer__send:hover:not(:disabled) {
    background: color-mix(in srgb, hsl(var(--accent-brand)) 88%, #000);
}
.pg-composer__send:disabled {
    background: color-mix(in srgb, hsl(var(--accent-brand)) 35%, transparent);
    cursor: default;
}

.pg-composer__disclaimer {
    margin: 6px 0 0;
    text-align: center;
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
}
</style>
