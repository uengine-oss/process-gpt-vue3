<template>
    <PgField :label="label" :hint="hint" :error="error" :required="required">
        <template #default="{ id, describedBy }">
            <div class="pg-textarea" :class="{ 'pg-textarea--error': !!error, 'pg-textarea--disabled': disabled }">
                <textarea
                    :id="id"
                    ref="el"
                    class="pg-textarea__el"
                    :value="modelValue"
                    :placeholder="placeholder"
                    :disabled="disabled"
                    :readonly="readonly"
                    :required="required"
                    :rows="autoGrow ? 1 : rows"
                    :aria-describedby="describedBy"
                    :aria-invalid="error ? 'true' : undefined"
                    v-bind="$attrs"
                    @input="onInput"
                />
            </div>
        </template>
    </PgField>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import PgField from './PgField.vue';

const props = withDefaults(
    defineProps<{
        modelValue?: string;
        label?: string;
        hint?: string;
        error?: string;
        placeholder?: string;
        rows?: number;
        maxRows?: number;
        disabled?: boolean;
        readonly?: boolean;
        required?: boolean;
        /** 내용에 따라 높이 자동 확장 */
        autoGrow?: boolean;
    }>(),
    { modelValue: '', rows: 3, maxRows: 12, disabled: false, readonly: false, required: false, autoGrow: false }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
const el = ref<HTMLTextAreaElement | null>(null);

function resize() {
    if (!props.autoGrow || !el.value) return;
    const node = el.value;
    node.style.height = 'auto';

    const line = parseFloat(getComputedStyle(node).lineHeight) || 20;
    const max = line * props.maxRows;
    node.style.height = `${Math.min(node.scrollHeight, max)}px`;
    node.style.overflowY = node.scrollHeight > max ? 'auto' : 'hidden';
}

function onInput(ev: Event) {
    emit('update:modelValue', (ev.target as HTMLTextAreaElement).value);
    resize();
}

onMounted(resize);
watch(() => props.modelValue, () => nextTick(resize));

defineExpose({ focus: () => el.value?.focus() });
</script>

<script lang="ts">
export default { name: 'PgTextarea', inheritAttrs: false };
</script>

<style scoped>
.pg-textarea {
    display: flex;
    padding: 8px 10px;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-2);
    box-shadow: 0 0 0 0.5px var(--cds-border-strong);
    transition: box-shadow 120ms var(--cds-ease-out);
}
.pg-textarea:hover:not(.pg-textarea--disabled) {
    box-shadow: 0 0 0 0.5px var(--cds-border-stronger);
}
.pg-textarea:focus-within {
    box-shadow: 0 0 0 1.5px hsl(var(--accent-100));
}
.pg-textarea--error {
    box-shadow: 0 0 0 1px var(--cds-border-danger);
}
.pg-textarea--disabled {
    background: var(--cds-bg-neutral);
    opacity: 0.65;
}

.pg-textarea__el {
    width: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    resize: vertical;
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    font-weight: 430;
    line-height: var(--cds-leading-body);
}
</style>
