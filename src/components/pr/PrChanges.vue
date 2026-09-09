<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { loadPrChanges, type PrChanges } from '@/composables/usePrChanges';

const props = withDefaults(defineProps<{ pr: any; showSummary?: boolean }>(), { showSummary: true });
const emit = defineEmits<{ (e: 'summary', value: { summary: string; count: number }): void }>();

const backend = BackendFactory.createBackend() as any;

const loading = ref(false);
const error = ref('');
const changes = ref<PrChanges | null>(null);
const activeFile = ref('');

const files = computed(() => changes.value?.files || []);
const items = computed(() => changes.value?.items || []);
const activeFileObj = computed(() => files.value.find((file) => file.filename === activeFile.value) || null);

const KIND_LABEL: Record<string, string> = { added: '추가', modified: '변경', removed: '삭제' };

async function load() {
    loading.value = true;
    error.value = '';
    changes.value = null;
    activeFile.value = '';
    try {
        const result = await loadPrChanges(backend, props.pr);
        changes.value = result;
        // 패치가 담긴 파일을 먼저 연다. 첫 파일이 이름만 바뀐 파일이면 빈 화면으로 시작한다.
        activeFile.value = (result.files.find((file) => file.patch) || result.files[0])?.filename || '';
        emit('summary', { summary: result.summary, count: result.files.length + result.items.length });
    } catch (e: any) {
        error.value = e?.message || '변경 내역을 불러오지 못했습니다.';
        emit('summary', { summary: '', count: 0 });
    } finally {
        loading.value = false;
    }
}

watch(() => props.pr?.id, load, { immediate: true });

function fileTag(status: string): string {
    return { added: 'A', removed: 'D', modified: 'M', renamed: 'R' }[status] || '~';
}

function fileTagClass(status: string): string {
    return { added: 'ftag-add', removed: 'ftag-del', modified: 'ftag-mod', renamed: 'ftag-ren' }[status] || 'ftag-mod';
}

/**
 * 이름 없는 연결선은 내부 id 가 그대로 이름 자리에 온다.
 * 사람이 붙인 이름과 같은 굵기로 두면 어느 쪽이 실제 업무 용어인지 구분이 안 된다.
 */
function isRawId(item: { name: string; category: string }): boolean {
    return item.category === '연결' && /^[A-Za-z0-9_.-]+$/.test(item.name);
}

function diffLineClass(line: string): string {
    if (line.startsWith('+++') || line.startsWith('---')) return 'dl-header';
    if (line.startsWith('@@')) return 'dl-hunk';
    if (line.startsWith('+')) return 'dl-add';
    if (line.startsWith('-')) return 'dl-del';
    return 'dl-ctx';
}
</script>

<template>
    <div class="pc-root d-flex flex-column">
        <div v-if="loading" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate size="22" color="primary" />
        </div>

        <div v-else-if="error" class="pc-note">
            <v-icon size="18" color="grey-lighten-1" class="mr-1">mdi-alert-circle-outline</v-icon>
            {{ error }}
            <v-btn class="ml-2" size="x-small" variant="text" color="primary" @click="load">다시 시도</v-btn>
        </div>

        <template v-else-if="changes">
            <!-- 무엇이 바뀌는지 한 줄로 먼저 알린다. -->
            <div v-if="props.showSummary && changes.summary" class="pc-summary">
                <v-icon size="15" class="mr-1">mdi-text-short</v-icon>
                <span>{{ changes.summary }}</span>
            </div>

            <div v-if="changes.unavailable" class="pc-note">
                <v-icon size="18" color="grey-lighten-1" class="mr-1">mdi-information-outline</v-icon>
                {{ changes.unavailable }}
            </div>

            <!-- 스킬: 파일 목록 + 깃 패치 -->
            <div v-else-if="changes.shape === 'files'" class="pc-diff-wrap d-flex flex-grow-1">
                <div class="pc-file-sidebar overflow-y-auto flex-shrink-0">
                    <div class="pc-sidebar-label">변경 파일</div>
                    <div
                        v-for="file in files"
                        :key="file.filename"
                        :class="['pc-file-row', { on: activeFile === file.filename }]"
                        @click="activeFile = file.filename"
                    >
                        <span :class="['ftag', fileTagClass(file.status)]">{{ fileTag(file.status) }}</span>
                        <span class="pc-fname">{{ file.filename }}</span>
                        <span class="pc-fstats">
                            <span v-if="file.additions" class="plus">+{{ file.additions }}</span>
                            <span v-if="file.deletions" class="minus">-{{ file.deletions }}</span>
                        </span>
                    </div>
                </div>
                <div class="pc-diff-view overflow-y-auto flex-grow-1">
                    <template v-if="activeFileObj">
                        <div class="pc-diff-header">{{ activeFileObj.filename }}</div>
                        <div v-if="activeFileObj.patch" class="diff-block">
                            <div v-for="(line, i) in (activeFileObj.patch || '').split('\n')" :key="i" :class="['dl', diffLineClass(line)]">
                                {{ line }}
                            </div>
                        </div>
                        <div v-else class="pc-note">이 파일은 패치 데이터가 없습니다.</div>
                    </template>
                    <div v-else class="pc-note">← 파일을 선택하세요</div>
                </div>
            </div>

            <!-- 프로세스·의사결정: 구조 비교 결과 -->
            <div v-else class="pc-items overflow-y-auto flex-grow-1">
                <div v-for="(item, i) in items" :key="i" :class="['pc-item', 'pc-item--' + item.kind]">
                    <span :class="['pc-kind', 'pc-kind--' + item.kind]">{{ KIND_LABEL[item.kind] }}</span>
                    <div class="pc-item-body">
                        <div class="pc-item-title">
                            <span :class="['pc-item-name', { 'pc-item-name--id': isRawId(item) }]">{{ item.name }}</span>
                            <span class="pc-item-cat">{{ item.category }}</span>
                        </div>
                        <div v-if="item.detail" class="pc-item-detail">{{ item.detail }}</div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.pc-root {
    min-height: 0;
    flex: 1;
}

.pc-summary {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 9px 14px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.8);
    background: rgba(var(--v-theme-primary), 0.05);
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.pc-note {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 20px;
    font-size: 12px;
    text-align: center;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

/* ── 스킬 파일 diff ── */
.pc-diff-wrap {
    min-height: 0;
    max-width: 100%;
    overflow: hidden;
}
.pc-file-sidebar {
    width: 200px;
    border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 6px 0;
}
.pc-sidebar-label {
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 12px 5px;
}
.pc-file-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12.5px;
    transition: background 0.1s;
}
.pc-file-row:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.pc-file-row.on {
    background: rgba(var(--v-theme-primary), 0.08);
}
.pc-fname {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.pc-fstats {
    font-size: 11px;
    flex: none;
    display: flex;
    gap: 3px;
}
.pc-fstats .plus {
    color: #2e6b16;
}
.pc-fstats .minus {
    color: #a32d2d;
}
.pc-diff-view {
    /* flex-basis 를 0 으로 묶지 않으면 긴 패치 줄이 패널 밖으로 밀고 나간다. */
    flex: 1 1 0;
    min-width: 0;
}
.pc-diff-header {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    padding: 9px 14px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-on-surface), 0.02);
    position: sticky;
    top: 0;
}

.ftag {
    font-size: 10px;
    font-weight: 700;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
}
.ftag-add {
    background: #e7f4df;
    color: #2e6b16;
}
.ftag-del {
    background: #fcebeb;
    color: #a32d2d;
}
.ftag-mod {
    background: #fbf0da;
    color: #92610a;
}
.ftag-ren {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}

.diff-block {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    background: #1a1d2e;
    padding: 6px 0;
    white-space: pre;
    overflow-x: auto;
}
.dl {
    display: block;
    padding: 0 13px;
}
.dl-add {
    background: rgba(70, 149, 74, 0.2);
    color: #89d185;
}
.dl-del {
    background: rgba(220, 80, 80, 0.2);
    color: #f48771;
}
.dl-hunk {
    color: #569cd6;
}
.dl-header {
    color: #6a737d;
}
.dl-ctx {
    color: #d4d4d4;
}

/* ── 프로세스·의사결정 변경 항목 ── */
.pc-items {
    padding: 6px 0;
    min-height: 0;
}
.pc-item {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 8px 14px;
    border-left: 3px solid transparent;
}
.pc-item--added {
    border-left-color: #2e6b16;
}
.pc-item--modified {
    border-left-color: #b8860b;
}
.pc-item--removed {
    border-left-color: #a32d2d;
}
.pc-kind {
    flex: none;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 1px;
}
.pc-kind--added {
    background: #e7f4df;
    color: #2e6b16;
}
.pc-kind--modified {
    background: #fbf0da;
    color: #92610a;
}
.pc-kind--removed {
    background: #fcebeb;
    color: #a32d2d;
}
.pc-item-body {
    min-width: 0;
    flex: 1;
}
.pc-item-title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
}
.pc-item-name {
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.85);
    word-break: break-all;
}
.pc-item-name--id {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    font-weight: 400;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.pc-item-cat {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}
.pc-item-detail {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-top: 2px;
}
</style>
