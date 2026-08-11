<template>
    <div ref="root" class="pg-menu">
        <span class="pg-menu__trigger" @click="toggle">
            <slot name="trigger" :open="open" />
        </span>

        <Transition name="pg-menu">
            <div v-if="open" class="pg-menu__panel" :class="`pg-menu__panel--${align}`" role="menu">
                <slot :close="close" />
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

withDefaults(defineProps<{ align?: 'start' | 'end' }>(), { align: 'start' });
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);

function toggle() {
    open.value = !open.value;
    emit('update:open', open.value);
}
function close() {
    open.value = false;
    emit('update:open', false);
}

function onDocClick(ev: MouseEvent) {
    if (!open.value) return;
    if (root.value && !root.value.contains(ev.target as Node)) close();
}
function onEsc(ev: KeyboardEvent) {
    if (ev.key === 'Escape') close();
}

onMounted(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
});

defineExpose({ close });
</script>

<script lang="ts">
export default { name: 'PgMenu' };
</script>

<style scoped>
.pg-menu {
    position: relative;
    display: inline-flex;
}
.pg-menu__trigger {
    display: inline-flex;
}

.pg-menu__panel {
    position: absolute;
    top: calc(100% + 4px);
    z-index: 2500;
    min-width: 180px;
    padding: 4px;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-popover);
    box-shadow: var(--cds-shadow-popover);
    border: 0.5px solid var(--cds-border);
}
.pg-menu__panel--start {
    left: 0;
}
.pg-menu__panel--end {
    right: 0;
}

.pg-menu-enter-active,
.pg-menu-leave-active {
    transition: opacity 120ms var(--cds-ease-out), transform 120ms var(--cds-ease-out);
}
.pg-menu-enter-from,
.pg-menu-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
    .pg-menu-enter-active,
    .pg-menu-leave-active {
        transition: none;
    }
}
</style>
