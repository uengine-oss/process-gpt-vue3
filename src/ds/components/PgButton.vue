<template>
    <component
        :is="tag"
        class="pg-btn"
        :class="[
            `pg-btn--${variant}`,
            `pg-btn--${size}`,
            { 'pg-btn--icon': icon, 'pg-btn--block': block, 'pg-btn--loading': loading }
        ]"
        :type="tag === 'button' ? type : undefined"
        :disabled="tag === 'button' ? disabled || loading : undefined"
        :aria-disabled="disabled || loading ? 'true' : undefined"
        :aria-busy="loading ? 'true' : undefined"
        v-bind="$attrs"
        @click="onClick"
    >
        <PgSpinner v-if="loading" :size="size === 'sm' ? 13 : 15" class="pg-btn__spinner" />
        <slot name="prepend" />
        <span v-if="$slots.default" class="pg-btn__label"><slot /></span>
        <slot name="append" />
    </component>
</template>

<script setup lang="ts">
import PgSpinner from './PgSpinner.vue';

const props = withDefaults(
    defineProps<{
        /** 시각적 강조 단계 */
        variant?: 'default' | 'primary' | 'ghost' | 'outline' | 'danger' | 'brand';
        size?: 'sm' | 'md' | 'lg';
        /** 정사각형 아이콘 버튼 */
        icon?: boolean;
        block?: boolean;
        loading?: boolean;
        disabled?: boolean;
        type?: 'button' | 'submit' | 'reset';
        /** 지정하면 <a> 로 렌더 */
        href?: string;
    }>(),
    {
        variant: 'default',
        size: 'md',
        icon: false,
        block: false,
        loading: false,
        disabled: false,
        type: 'button',
        href: undefined
    }
);

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>();

const tag = props.href ? 'a' : 'button';

function onClick(ev: MouseEvent) {
    if (props.disabled || props.loading) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
    }
    emit('click', ev);
}
</script>

<script lang="ts">
export default { name: 'PgButton', inheritAttrs: false };
</script>

<style scoped>
.pg-btn {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--cds-radius);
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    font-weight: var(--cds-font-weight-medium);
    line-height: var(--cds-leading-body);
    white-space: nowrap;
    text-decoration: none;
    user-select: none;
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out), color 120ms var(--cds-ease-out),
        border-color 120ms var(--cds-ease-out), opacity 120ms var(--cds-ease-out);
}

.pg-btn:hover {
    background: var(--cds-bg-neutral);
    text-decoration: none;
}
.pg-btn:active {
    background: var(--cds-bg-neutral-hover);
}
.pg-btn:focus-visible {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 1px;
}
.pg-btn:disabled,
.pg-btn[aria-disabled='true'] {
    opacity: 0.4;
    cursor: default;
}

/* --- 크기 --- */
.pg-btn--sm {
    height: 28px;
    padding: 0 10px;
    border-radius: var(--cds-radius--sm);
}
.pg-btn--lg {
    height: 38px;
    padding: 0 16px;
    border-radius: var(--cds-radius--lg);
    font-size: var(--cds-font-size-body--lg);
}

.pg-btn--icon {
    width: 32px;
    padding: 0;
    border-radius: var(--cds-radius);
    color: var(--cds-text-secondary);
}
.pg-btn--icon.pg-btn--sm {
    width: 28px;
}
.pg-btn--icon.pg-btn--lg {
    width: 38px;
}
.pg-btn--icon:hover {
    color: var(--cds-text-primary);
}

.pg-btn--block {
    display: flex;
    width: 100%;
}

/* --- 변형 --- */
.pg-btn--primary {
    background: var(--cds-text-primary);
    color: var(--cds-surface-2);
}
.pg-btn--primary:hover {
    background: color-mix(in srgb, var(--cds-text-primary) 88%, #fff);
}
.pg-btn--primary:active {
    background: color-mix(in srgb, var(--cds-text-primary) 78%, #fff);
}

.pg-btn--brand {
    background: hsl(var(--accent-brand));
    color: #fff;
}
.pg-btn--brand:hover {
    background: color-mix(in srgb, hsl(var(--accent-brand)) 88%, #000);
}
.pg-btn--brand:active {
    background: color-mix(in srgb, hsl(var(--accent-brand)) 80%, #000);
}

.pg-btn--ghost {
    color: var(--cds-text-secondary);
}

.pg-btn--outline {
    border: 0.5px solid var(--cds-border-strong);
}
.pg-btn--outline:hover {
    border-color: var(--cds-border-stronger);
}

.pg-btn--danger {
    color: var(--cds-text-danger);
}
.pg-btn--danger:hover {
    background: var(--cds-bg-danger);
}

.pg-btn--loading {
    cursor: progress;
}
.pg-btn__label {
    display: inline-flex;
    align-items: center;
}
.pg-btn__spinner {
    flex: 0 0 auto;
}
</style>
