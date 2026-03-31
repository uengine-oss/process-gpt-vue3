<template>
    <div class="history-panel">
        <div class="history-panel__header">
            <div class="history-panel__title">
                <v-icon size="16" class="mr-2">mdi-history</v-icon>
                Version History
            </div>
            <v-btn icon variant="text" size="x-small" @click="$emit('close')">
                <v-icon size="16">mdi-close</v-icon>
            </v-btn>
        </div>

        <div class="history-panel__body">
            <aside class="history-panel__versions">
                <div class="history-panel__versions-header">저장 버전</div>
                <div v-if="loading" class="history-panel__empty">
                    <v-progress-circular indeterminate size="18" width="2" color="primary" class="mr-2" />
                    버전 정보를 불러오는 중입니다.
                </div>
                <div v-else-if="versions.length === 0" class="history-panel__empty">
                    저장된 버전이 없습니다.
                </div>
                <button
                    v-for="version in versions"
                    :key="version.version"
                    type="button"
                    class="history-version-card"
                    :class="{ 'history-version-card--active': String(selectedVersion) === String(version.version) }"
                    @click="$emit('selectVersion', version.version)"
                >
                    <div class="history-version-card__top">
                        <div class="history-version-card__title">v{{ version.version }}</div>
                        <v-chip
                            size="x-small"
                            variant="tonal"
                            :color="version.version_tag === 'published' ? 'success' : 'primary'"
                        >
                            {{ version.version_tag || 'draft' }}
                        </v-chip>
                    </div>
                    <div class="history-version-card__message">
                        {{ version.message || '변경 메모 없음' }}
                    </div>
                    <div class="history-version-card__meta">
                        {{ version.owner || '시스템' }} · {{ formatTimestamp(version.timeStamp || version.updated_at || version.created_at) }}
                    </div>
                </button>
            </aside>

            <section class="history-panel__detail">
                <div class="history-panel__toolbar">
                    <div>
                        <div class="history-panel__detail-title">
                            v{{ selectedVersion || '-' }} 상세 변경점
                        </div>
                        <div class="history-panel__detail-subtitle">
                            {{ compareLabel }}
                        </div>
                    </div>
                    <div class="history-panel__toolbar-actions">
                        <v-btn
                            variant="outlined"
                            size="small"
                            color="primary"
                            :disabled="!selectedVersion || !currentBpmnXml"
                            class="history-panel__visual-diff-btn"
                            @click="openVisualDiffDialog"
                        >
                            <v-icon start size="14">mdi-compare-horizontal</v-icon>
                            버전비교
                        </v-btn>
                        <span class="history-panel__toolbar-label">비교 버전</span>
                        <v-select
                            :model-value="compareVersion"
                            :items="compareVersionOptions"
                            item-title="title"
                            item-value="value"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="history-panel__compare-select"
                            @update:model-value="$emit('update:compareVersion', $event)"
                        />
                    </div>
                </div>

                <div v-if="selectedVersionMeta?.message" class="history-panel__summary">
                    {{ selectedVersionMeta.message }}
                </div>

                <div class="history-panel__table-shell">
                    <table class="history-panel__table">
                        <thead>
                            <tr>
                                <th>TASK 명칭</th>
                                <th>변경 내용</th>
                                <th>섹션</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="diffRows.length === 0">
                                <td colspan="3" class="history-panel__empty-row">
                                    비교 가능한 변경점이 없습니다.
                                </td>
                            </tr>
                            <tr v-for="row in diffRows" :key="row.key">
                                <td>{{ row.label }}</td>
                                <td>{{ row.description }}</td>
                                <td>{{ row.section }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>

    <SktVersionComparisonDialog
        v-model="visualDiffDialogOpen"
        :selectedVersionLabel="selectedVersion"
        :selectedVersionXml="visualDiffSelectedXml"
        :currentBpmnXml="currentBpmnXml"
        :versions="versions"
        @rollback="(payload) => $emit('rollback', payload)"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SktVersionComparisonDialog from './SktVersionComparisonDialog.vue';

type VersionItem = Record<string, any>;
type DiffRow = {
    key: string;
    label: string;
    description: string;
    section: string;
};

const props = defineProps<{
    loading: boolean;
    versions: VersionItem[];
    selectedVersion: string;
    compareVersion: string;
    compareVersionOptions: Array<{ title: string; value: string }>;
    selectedVersionMeta: VersionItem | null;
    diffRows: DiffRow[];
    compareLabel: string;
    currentBpmnXml: string;
}>();

defineEmits<{
    (e: 'close'): void;
    (e: 'selectVersion', version: string): void;
    (e: 'update:compareVersion', version: string): void;
    (e: 'rollback', payload: { xml: string; versionLabel: string }): void;
}>();

const visualDiffDialogOpen = ref(false);
const visualDiffSelectedXml = ref('');

function openVisualDiffDialog() {
    if (!props.selectedVersion || !props.currentBpmnXml) return;

    const matched = props.versions.find(
        (v) => String(v.version) === String(props.selectedVersion)
    );
    const selectedXml = matched?.snapshot || '';
    if (!selectedXml) return;

    visualDiffSelectedXml.value = selectedXml;
    visualDiffDialogOpen.value = true;
}

function formatTimestamp(value: string) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
}
</script>

<style scoped>
.history-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #ffffff;
}

.history-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.history-panel__title {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
}

.history-panel__body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
}

.history-panel__versions {
    min-width: 0;
    padding: 12px;
    border-right: 1px solid #eef2f7;
    overflow-y: auto;
    background: #fbfcfe;
}

.history-panel__versions-header {
    margin-bottom: 10px;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.history-panel__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 96px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
}

.history-version-card {
    width: 100%;
    margin-bottom: 10px;
    padding: 14px;
    text-align: left;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.history-version-card:hover {
    border-color: #bfdbfe;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
}

.history-version-card--active {
    border-color: #60a5fa;
    background: #eff6ff;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
}

.history-version-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.history-version-card__title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
}

.history-version-card__message {
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.55;
    color: #334155;
}

.history-version-card__meta {
    margin-top: 8px;
    font-size: 11px;
    color: #64748b;
}

.history-panel__detail {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 14px 16px 16px;
    overflow: hidden;
}

.history-panel__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.history-panel__detail-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
}

.history-panel__detail-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
}

.history-panel__toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.history-panel__toolbar-label {
    font-size: 12px;
    color: #6b7280;
}

.history-panel__compare-select {
    width: 180px;
}

.history-panel__summary {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-size: 12px;
    line-height: 1.6;
    color: #334155;
}

.history-panel__table-shell {
    flex: 1;
    min-height: 0;
    margin-top: 14px;
    overflow: auto;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
}

.history-panel__table {
    width: 100%;
    border-collapse: collapse;
    background: #ffffff;
}

.history-panel__table th,
.history-panel__table td {
    padding: 12px 14px;
    border-bottom: 1px solid #eef2f7;
    text-align: left;
    vertical-align: top;
    font-size: 12px;
    color: #1f2937;
}

.history-panel__table th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f8fafc;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.history-panel__empty-row {
    text-align: center;
    color: #64748b;
}

/* 버전비교 버튼 */
.history-panel__visual-diff-btn {
    font-size: 12px;
    letter-spacing: 0;
}

@media (max-width: 1100px) {
    .history-panel__body {
        grid-template-columns: 220px minmax(0, 1fr);
    }
}
</style>
