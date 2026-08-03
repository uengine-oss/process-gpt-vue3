<template>
    <PgField :label="label" :hint="hint" :error="error" :required="required">
        <div class="pg-radios" :class="{ 'pg-radios--inline': inline }" role="radiogroup" :aria-label="label">
            <label
                v-for="opt in normalized"
                :key="String(opt.value)"
                class="pg-radio"
                :class="{ 'pg-radio--disabled': disabled || opt.disabled }"
            >
                <input
                    class="pg-radio__input"
                    type="radio"
                    :name="groupName"
                    :value="opt.value"
                    :checked="modelValue === opt.value"
                    :disabled="disabled || opt.disabled"
                    @change="$emit('update:modelValue', opt.value)"
                />
                <span class="pg-radio__dot" aria-hidden="true" />
                <span class="pg-radio__label">{{ opt.label }}</span>
            </label>
        </div>
    </PgField>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PgField from './PgField.vue';
import { nextFieldId } from '../useFieldId';

type Option = { label: string; value: string | number; disabled?: boolean };

const props = withDefaults(
    defineProps<{
        modelValue?: string | number;
        items?: Array<string | number | Option>;
        label?: string;
        hint?: string;
        error?: string;
        disabled?: boolean;
        required?: boolean;
        inline?: boolean;
    }>(),
    { items: () => [], disabled: false, required: false, inline: false }
);

defineEmits<{ (e: 'update:modelValue', v: string | number): void }>();

const groupName = nextFieldId('pg-radio-group');

const normalized = computed<Option[]>(() =>
    (props.items || []).map((it) =>
        typeof it === 'object' && it !== null ? (it as Option) : { label: String(it), value: it as string | number }
    )
);
</script>

<script lang="ts">
export default { name: 'PgRadioGroup' };
</script>

<style scoped>
.pg-radios {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.pg-radios--inline {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
}

.pg-radio {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}
.pg-radio--disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.pg-radio__input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
}

.pg-radio__dot {
    position: relative;
    display: inline-block;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    border-radius: 50%;
    background: var(--cds-surface-2);
    box-shadow: 0 0 0 1px var(--cds-border-strong);
    transition: box-shadow 120ms var(--cds-ease-out);
}
.pg-radio__dot::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: var(--cds-surface-2);
    transform: scale(0);
    transition: transform 140ms var(--cds-ease-overshoot);
}
.pg-radio__input:checked + .pg-radio__dot {
    background: var(--cds-text-primary);
    box-shadow: 0 0 0 1px var(--cds-text-primary);
}
.pg-radio__input:checked + .pg-radio__dot::after {
    transform: scale(1);
}
.pg-radio__input:focus-visible + .pg-radio__dot {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 2px;
}

.pg-radio__label {
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
}

@media (prefers-reduced-motion: reduce) {
    .pg-radio__dot::after {
        transition: none;
    }
}
</style>
