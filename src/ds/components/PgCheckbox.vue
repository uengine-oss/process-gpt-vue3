<template>
    <label class="pg-check" :class="{ 'pg-check--disabled': disabled }">
        <input
            class="pg-check__input"
            type="checkbox"
            :checked="isChecked"
            :disabled="disabled"
            :indeterminate.prop="indeterminate"
            v-bind="$attrs"
            @change="onChange"
        />
        <span class="pg-check__box" aria-hidden="true">
            <PgIcon v-if="indeterminate" name="mdi-minus" :size="12" />
            <PgIcon v-else-if="isChecked" name="mdi-check" :size="12" />
        </span>
        <span v-if="label || $slots.default" class="pg-check__label"><slot>{{ label }}</slot></span>
    </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PgIcon from './PgIcon.vue';

const props = withDefaults(
    defineProps<{
        /** boolean 이거나, value 가 있으면 배열 다중 선택 */
        modelValue?: boolean | Array<string | number>;
        value?: string | number;
        label?: string;
        disabled?: boolean;
        indeterminate?: boolean;
    }>(),
    { modelValue: false, disabled: false, indeterminate: false }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean | Array<string | number>): void }>();

const isArrayMode = computed(() => Array.isArray(props.modelValue) && props.value !== undefined);

const isChecked = computed(() =>
    isArrayMode.value
        ? (props.modelValue as Array<string | number>).includes(props.value as string | number)
        : !!props.modelValue
);

function onChange(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;

    if (!isArrayMode.value) {
        emit('update:modelValue', checked);
        return;
    }

    const next = [...(props.modelValue as Array<string | number>)];
    const idx = next.indexOf(props.value as string | number);
    if (checked && idx === -1) next.push(props.value as string | number);
    if (!checked && idx !== -1) next.splice(idx, 1);
    emit('update:modelValue', next);
}
</script>

<script lang="ts">
export default { name: 'PgCheckbox', inheritAttrs: false };
</script>

<style scoped>
.pg-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}
.pg-check--disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.pg-check__input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
}

.pg-check__box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    border-radius: 4px;
    background: var(--cds-surface-2);
    box-shadow: 0 0 0 1px var(--cds-border-strong);
    color: var(--cds-surface-2);
    transition: background-color 120ms var(--cds-ease-out), box-shadow 120ms var(--cds-ease-out);
}
.pg-check:hover:not(.pg-check--disabled) .pg-check__box {
    box-shadow: 0 0 0 1px var(--cds-border-stronger);
}
.pg-check__input:checked + .pg-check__box,
.pg-check__input:indeterminate + .pg-check__box {
    background: var(--cds-text-primary);
    box-shadow: 0 0 0 1px var(--cds-text-primary);
}
.pg-check__input:focus-visible + .pg-check__box {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 1px;
}

.pg-check__label {
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
    color: var(--cds-text-primary);
}
</style>
