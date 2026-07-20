<template>
    <div v-if="canMerge" class="pr-merge-section">
        <div class="prm-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3E9A3E" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
            </svg>
            승인됨 — <b>{{ baseBranch }}</b
            >{{ mergeDescription }}
        </div>
        <div v-if="mergeError" class="prm-error">{{ mergeError }}</div>
        <div class="prm-footer">
            <button class="prm-btn" :disabled="mergeLoading" @click="$emit('merge')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="6" cy="6" r="2.5" />
                    <circle cx="6" cy="18" r="2.5" />
                    <circle cx="18" cy="9" r="2.5" />
                    <path d="M6 8.5v7M8.4 7.4 15.6 7.6M18 11.5c0 3-3 4-6 4" />
                </svg>
                <span v-if="mergeLoading">병합 중…</span>
                <span v-else>{{ mergeLabel }}</span>
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PrMergeSection',
    props: {
        canMerge: { type: Boolean, default: false },
        mergeLoading: { type: Boolean, default: false },
        mergeError: { type: String, default: '' },
        baseBranch: { type: String, default: 'main' },
        mergeLabel: { type: String, default: '병합 확인' },
        mergeDescription: { type: String, default: '으로 병합하면 즉시 반영됩니다.' }
    },
    emits: ['merge']
};
</script>

<style scoped>
.pr-merge-section {
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.prm-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    background: #f0faf0;
    border-radius: 8px;
    padding: 10px 12px;
    line-height: 1.45;
}
.prm-banner b {
    color: rgba(var(--v-theme-on-surface), 0.87);
}

.prm-error {
    margin-top: 8px;
    font-size: 12px;
    color: #d32f2f;
}

.prm-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
}

.prm-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    padding: 7px 18px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    color: #fff;
    background: #6b46c1;
    transition: opacity 0.12s;
}
.prm-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
.prm-btn:hover:not(:disabled) {
    opacity: 0.9;
}
</style>
