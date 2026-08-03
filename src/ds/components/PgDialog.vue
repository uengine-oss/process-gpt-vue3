<template>
    <Teleport to="body">
        <Transition name="pg-dialog">
            <div
                v-if="modelValue"
                class="pg-dialog__scrim"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
                @mousedown.self="onScrim"
            >
                <div ref="panel" class="pg-dialog" :class="`pg-dialog--${size}`" @keydown.esc.stop="close">
                    <header v-if="title || $slots.header" class="pg-dialog__header">
                        <slot name="header">
                            <h2 class="pg-dialog__title">{{ title }}</h2>
                            <PgButton v-if="closable" icon size="sm" variant="ghost" aria-label="닫기" @click="close">
                                <PgIcon name="mdi-close" :size="16" />
                            </PgButton>
                        </slot>
                    </header>

                    <div class="pg-dialog__body"><slot /></div>

                    <footer v-if="$slots.footer" class="pg-dialog__footer"><slot name="footer" /></footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import PgButton from './PgButton.vue';
import PgIcon from './PgIcon.vue';

const props = withDefaults(
    defineProps<{
        modelValue?: boolean;
        title?: string;
        size?: 'sm' | 'md' | 'lg' | 'full';
        closable?: boolean;
        /** 스크림 클릭으로 닫히지 않게 */
        persistent?: boolean;
    }>(),
    { modelValue: false, size: 'md', closable: true, persistent: false }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'close'): void }>();

const panel = ref<HTMLElement | null>(null);
let prevOverflow = '';

function close() {
    if (!props.closable) return;
    emit('update:modelValue', false);
    emit('close');
}

function onScrim() {
    if (props.persistent) return;
    close();
}

function onKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') close();
}

watch(
    () => props.modelValue,
    async (open) => {
        if (open) {
            prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', onKeydown);
            await nextTick();
            panel.value?.focus?.();
        } else {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeydown);
        }
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKeydown);
});
</script>

<script lang="ts">
export default { name: 'PgDialog' };
</script>

<style scoped>
.pg-dialog__scrim {
    position: fixed;
    inset: 0;
    z-index: 2400;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: hsl(0 0% 4.3% / 32%);
    backdrop-filter: blur(2px);
}

.pg-dialog {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: calc(100vh - 48px);
    border-radius: var(--cds-radius--lg);
    background: var(--cds-surface-panel);
    box-shadow: var(--cds-shadow-popover);
    outline: none;
    overflow: hidden;
}
.pg-dialog--sm {
    max-width: 400px;
}
.pg-dialog--md {
    max-width: 560px;
}
.pg-dialog--lg {
    max-width: 880px;
}
.pg-dialog--full {
    max-width: none;
    width: calc(100vw - 48px);
    height: calc(100vh - 48px);
}

.pg-dialog__header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 0;
}
.pg-dialog__title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--cds-font-size-body--lg);
    line-height: var(--cds-leading-heading);
    font-weight: var(--cds-font-weight-semibold);
}

.pg-dialog__body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
}

.pg-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 16px;
}

/* 진입/이탈 — 원본 cds-um-enter 의 오버슈트 이징 사용 */
.pg-dialog-enter-active .pg-dialog,
.pg-dialog-leave-active .pg-dialog {
    transition: transform 200ms var(--cds-ease-overshoot), opacity 160ms var(--cds-ease-out);
}
.pg-dialog-enter-active,
.pg-dialog-leave-active {
    transition: opacity 160ms var(--cds-ease-out);
}
.pg-dialog-enter-from,
.pg-dialog-leave-to {
    opacity: 0;
}
.pg-dialog-enter-from .pg-dialog,
.pg-dialog-leave-to .pg-dialog {
    transform: scale(0.96) translateY(8px);
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .pg-dialog-enter-active,
    .pg-dialog-leave-active,
    .pg-dialog-enter-active .pg-dialog,
    .pg-dialog-leave-active .pg-dialog {
        transition: none;
    }
}
</style>
