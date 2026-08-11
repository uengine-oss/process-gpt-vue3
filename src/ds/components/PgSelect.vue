<template>
    <PgField :label="label" :hint="hint" :error="error" :required="required">
        <template #default="{ id, describedBy }">
            <div class="pg-select" :class="{ 'pg-select--error': !!error, 'pg-select--disabled': disabled }">
                <select
                    :id="id"
                    class="pg-select__el"
                    :value="modelValue"
                    :disabled="disabled"
                    :required="required"
                    :aria-describedby="describedBy"
                    :aria-invalid="error ? 'true' : undefined"
                    v-bind="$attrs"
                    @change="onChange"
                >
                    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
                    <option v-for="opt in normalized" :key="String(opt.value)" :value="opt.value" :disabled="opt.disabled">
                        {{ opt.label }}
                    </option>
                </select>
                <PgIcon name="mdi-chevron-down" :size="16" class="pg-select__caret" />
            </div>
        </template>
    </PgField>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PgField from './PgField.vue';
import PgIcon from './PgIcon.vue';

type Option = { label: string; value: string | number; disabled?: boolean };

const props = withDefaults(
    defineProps<{
        modelValue?: string | number;
        /** 문자열 배열 또는 {label,value} 배열 */
        items?: Array<string | number | Option>;
        label?: string;
        hint?: string;
        error?: string;
        placeholder?: string;
        disabled?: boolean;
        required?: boolean;
    }>(),
    { modelValue: '', items: () => [], disabled: false, required: false }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>();

const normalized = computed<Option[]>(() =>
    (props.items || []).map((it) =>
        typeof it === 'object' && it !== null ? (it as Option) : { label: String(it), value: it as string | number }
    )
);

function onChange(ev: Event) {
    emit('update:modelValue', (ev.target as HTMLSelectElement).value);
}
</script>

<script lang="ts">
export default { name: 'PgSelect', inheritAttrs: false };
</script>

<style scoped>
.pg-select {
    position: relative;
    display: flex;
    align-items: center;
    height: 34px;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-2);
    box-shadow: 0 0 0 0.5px var(--cds-border-strong);
    transition: box-shadow 120ms var(--cds-ease-out);
}
.pg-select:hover:not(.pg-select--disabled) {
    box-shadow: 0 0 0 0.5px var(--cds-border-stronger);
}
.pg-select:focus-within {
    box-shadow: 0 0 0 1.5px hsl(var(--accent-100));
}
.pg-select--error {
    box-shadow: 0 0 0 1px var(--cds-border-danger);
}
.pg-select--disabled {
    background: var(--cds-bg-neutral);
    opacity: 0.65;
}

.pg-select__el {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0 30px 0 10px;
    border: 0;
    outline: 0;
    appearance: none;
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
    cursor: pointer;
}
.pg-select__el:disabled {
    cursor: not-allowed;
}

.pg-select__caret {
    position: absolute;
    right: 8px;
    color: var(--cds-text-muted);
    pointer-events: none;
}
</style>
