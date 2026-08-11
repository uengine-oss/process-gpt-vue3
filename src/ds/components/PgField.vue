<template>
    <div class="pg-field" :class="{ 'pg-field--error': !!error }">
        <label v-if="label" class="pg-field__label" :for="id">
            {{ label }}
            <span v-if="required" class="pg-field__required" aria-hidden="true">*</span>
        </label>
        <slot :id="id" :described-by="describedBy" />
        <p v-if="error" :id="`${id}-error`" class="pg-field__error" role="alert">{{ error }}</p>
        <p v-else-if="hint" :id="`${id}-hint`" class="pg-field__hint">{{ hint }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nextFieldId } from '../useFieldId';

/**
 * 라벨 / 힌트 / 에러 메시지를 담당하는 래퍼.
 * 입력 요소 자체는 슬롯으로 받아 `id` 와 `aria-describedby` 를 넘겨준다.
 */
const props = withDefaults(
    defineProps<{
        label?: string;
        hint?: string;
        error?: string;
        required?: boolean;
        /** 지정하지 않으면 자동 생성 */
        fieldId?: string;
    }>(),
    { required: false }
);

const autoId = nextFieldId();
const id = computed(() => props.fieldId || autoId);
const describedBy = computed(() => {
    if (props.error) return `${id.value}-error`;
    if (props.hint) return `${id.value}-hint`;
    return undefined;
});
</script>

<script lang="ts">
export default { name: 'PgField' };
</script>

<style scoped>
.pg-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}
.pg-field__label {
    color: var(--cds-text-secondary);
    font-size: var(--cds-font-size-footnote);
    line-height: var(--cds-leading-footnote);
    font-weight: var(--cds-font-weight-medium);
}
.pg-field__required {
    color: var(--cds-text-danger);
    margin-left: 2px;
}
.pg-field__hint,
.pg-field__error {
    margin: 0;
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
}
.pg-field__hint {
    color: var(--cds-text-muted);
}
.pg-field__error {
    color: var(--cds-text-danger);
}
</style>
