<template>
    <label class="pg-switch" :class="{ 'pg-switch--disabled': disabled }">
        <input
            class="pg-switch__input"
            type="checkbox"
            role="switch"
            :checked="modelValue"
            :disabled="disabled"
            v-bind="$attrs"
            @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
        />
        <span class="pg-switch__track" aria-hidden="true"><span class="pg-switch__thumb" /></span>
        <span v-if="label || $slots.default" class="pg-switch__label"><slot>{{ label }}</slot></span>
    </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ modelValue?: boolean; label?: string; disabled?: boolean }>(), {
    modelValue: false,
    disabled: false
});
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
</script>

<script lang="ts">
export default { name: 'PgSwitch', inheritAttrs: false };
</script>

<style scoped>
.pg-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}
.pg-switch--disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.pg-switch__input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
}

.pg-switch__track {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 34px;
    height: 20px;
    flex: 0 0 34px;
    padding: 2px;
    border-radius: 999px;
    background: var(--cds-border-strong);
    transition: background-color 160ms var(--cds-ease-out);
}
.pg-switch__thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
    transition: transform 160ms var(--cds-ease-snap);
}
.pg-switch__input:checked + .pg-switch__track {
    background: hsl(var(--accent-brand));
}
.pg-switch__input:checked + .pg-switch__track .pg-switch__thumb {
    transform: translateX(14px);
}
.pg-switch__input:focus-visible + .pg-switch__track {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 2px;
}

.pg-switch__label {
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
}

@media (prefers-reduced-motion: reduce) {
    .pg-switch__track,
    .pg-switch__thumb {
        transition: none;
    }
}
</style>
