<template>
    <PgField :label="label" :hint="hint" :error="error" :required="required">
        <template #default="{ id, describedBy }">
            <div class="pg-input" :class="{ 'pg-input--error': !!error, 'pg-input--disabled': disabled }">
                <span v-if="$slots.prepend" class="pg-input__affix"><slot name="prepend" /></span>
                <input
                    :id="id"
                    ref="inputEl"
                    class="pg-input__el"
                    :type="type"
                    :value="modelValue"
                    :placeholder="placeholder"
                    :disabled="disabled"
                    :readonly="readonly"
                    :required="required"
                    :aria-describedby="describedBy"
                    :aria-invalid="error ? 'true' : undefined"
                    v-bind="$attrs"
                    @input="onInput"
                    @keyup.enter="$emit('enter', $event)"
                />
                <button
                    v-if="clearable && modelValue"
                    class="pg-input__clear"
                    type="button"
                    aria-label="지우기"
                    @click="clear"
                >
                    <PgIcon name="mdi-close-circle" :size="14" />
                </button>
                <span v-if="$slots.append" class="pg-input__affix"><slot name="append" /></span>
            </div>
        </template>
    </PgField>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PgField from './PgField.vue';
import PgIcon from './PgIcon.vue';

withDefaults(
    defineProps<{
        modelValue?: string | number;
        label?: string;
        hint?: string;
        error?: string;
        placeholder?: string;
        type?: string;
        disabled?: boolean;
        readonly?: boolean;
        required?: boolean;
        clearable?: boolean;
    }>(),
    { modelValue: '', type: 'text', disabled: false, readonly: false, required: false, clearable: false }
);

const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void;
    (e: 'enter', ev: KeyboardEvent): void;
}>();

const inputEl = ref<HTMLInputElement | null>(null);

function onInput(ev: Event) {
    emit('update:modelValue', (ev.target as HTMLInputElement).value);
}
function clear() {
    emit('update:modelValue', '');
    inputEl.value?.focus();
}

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<script lang="ts">
export default { name: 'PgTextField', inheritAttrs: false };
</script>

<style scoped>
.pg-input {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-2);
    box-shadow: 0 0 0 0.5px var(--cds-border-strong);
    transition: box-shadow 120ms var(--cds-ease-out);
}
.pg-input:hover:not(.pg-input--disabled) {
    box-shadow: 0 0 0 0.5px var(--cds-border-stronger);
}
.pg-input:focus-within {
    box-shadow: 0 0 0 1.5px hsl(var(--accent-100));
}
.pg-input--error {
    box-shadow: 0 0 0 1px var(--cds-border-danger);
}
.pg-input--error:focus-within {
    box-shadow: 0 0 0 1.5px hsl(var(--danger-100));
}
.pg-input--disabled {
    background: var(--cds-bg-neutral);
    opacity: 0.65;
}

.pg-input__el {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    font-weight: 430;
    line-height: var(--cds-leading-body);
}
.pg-input__el:disabled {
    cursor: not-allowed;
}

.pg-input__affix {
    display: inline-flex;
    align-items: center;
    color: var(--cds-text-muted);
    flex: 0 0 auto;
}

.pg-input__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--cds-text-muted);
    cursor: pointer;
    flex: 0 0 auto;
}
.pg-input__clear:hover {
    color: var(--cds-text-secondary);
}
</style>
