<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { loadPrChanges, buildPlainFileView, type PrChanges } from '@/composables/usePrChanges';
import { t } from '@/composables/i18nText';
import PrDefinitionCompare from '@/components/pr/PrDefinitionCompare.vue';

const props = withDefaults(defineProps<{ pr: any; showSummary?: boolean; businessView?: boolean }>(), {
    showSummary: true,
    businessView: false
});
const emit = defineEmits<{
    (e: 'summary', value: { summary: string; count: number; shape: 'files' | 'items'; unavailable: string }): void;
}>();

const backend = BackendFactory.createBackend() as any;

const loading = ref(false);
const error = ref('');
const changes = ref<PrChanges | null>(null);
const activeFile = ref('');

const files = computed(() => changes.value?.files || []);
/**
 * 기본 화면은 '요약 비교' — 변경 전/후 문장을 좌우로 세운 쪽이다.
 * diff 기호와 헝크 머리글은 무엇이 업무적으로 달라지는지 말해 주지 않으므로,
 * 그 형태는 '상세 Diff' 로 한 번 더 눌러야 나오게 둔다.
 */
const view = ref<'plain' | 'diff'>(props.businessView ? 'plain' : 'diff');
/**
 * 보기를 나눌 수 있는가.
 * 스킬은 늘 나뉘고, 프로세스·의사결정은 비교할 정의 원본을 받아 왔을 때만 나뉜다 —
 * 원본이 없으면 '상세 비교' 를 눌러도 빈 화면이 나온다.
 */
const showViewBar = computed(() => {
    if (!changes.value || changes.value.unavailable) return false;
    if (changes.value.shape === 'files') return true;
    return !!changes.value.snapshots?.headXml;
});
const plainBlocks = computed(() => (changes.value?.shape === 'files' ? buildPlainFileView(files.value) : []));
/** 파일 단위로 묶은 업무 관점 보기. 파일 하나가 한 덩어리로 읽혀야 한다. */
const plainFiles = computed(() => {
    const groups: { filename: string; label: string; status: string; blocks: typeof plainBlocks.value }[] = [];
    for (const block of plainBlocks.value) {
        let group = groups.find((g) => g.filename === block.filename);
        if (!group) {
            group = { filename: block.filename, label: block.label, status: block.status, blocks: [] };
            groups.push(group);
        }
        group.blocks.push(block);
    }
    return groups;
});
const items = computed(() => changes.value?.items || []);
const activeFileObj = computed(() => files.value.find((file) => file.filename === activeFile.value) || null);

/** 변경 항목의 동작 이름. 로케일 파일이 말을 갖는다. */
function kindLabel(kind: string): string {
    return t(`pr.changes.kind.${kind}`);
}

async function load() {
    loading.value = true;
    error.value = '';
    changes.value = null;
    activeFile.value = '';
    try {
        const result = await loadPrChanges(backend, props.pr, undefined, { withSnapshots: true });
        changes.value = result;
        // 패치가 담긴 파일을 먼저 연다. 첫 파일이 이름만 바뀐 파일이면 빈 화면으로 시작한다.
        activeFile.value = (result.files.find((file) => file.patch) || result.files[0])?.filename || '';
        emit('summary', {
            summary: result.summary,
            count: result.files.length + result.items.length,
            shape: result.shape,
            unavailable: result.unavailable
        });
    } catch (e: any) {
        error.value = e?.message || t('pr.changes.loadFailed');
        emit('summary', { summary: '', count: 0, shape: 'files', unavailable: error.value });
    } finally {
        loading.value = false;
    }
}

watch(
    () => props.pr?.id,
    () => {
        view.value = props.businessView ? 'plain' : 'diff';
        load();
    },
    { immediate: true }
);

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
    return item.category === 'flow' && /^[A-Za-z0-9_.-]+$/.test(item.name);
}

/**
 * 본문 줄이 하나도 잡히지 않은 파일에 세울 한 마디.
 * 여기서 침묵하면 "바뀐 게 없다" 로 읽히므로, 왜 보여줄 것이 없는지를 말해 준다.
 */
function noBodyText(status: string): string {
    const known = ['added', 'removed', 'renamed'];
    return t(`pr.changes.noBody.${known.includes(status) ? status : 'modified'}`);
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
            <v-btn class="ml-2" size="x-small" variant="text" color="primary" @click="load">{{ $t('pr.changes.retry') }}</v-btn>
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

            <!-- 요약 비교 ↔ 상세 비교. 기본은 사람이 읽는 쪽이다. -->
            <div v-if="showViewBar" class="pc-viewbar">
                <button :class="['pc-viewbtn', { on: view === 'plain' }]" @click="view = 'plain'">{{ $t('pr.changes.viewPlain') }}</button>
                <button :class="['pc-viewbtn', { on: view === 'diff' }]" @click="view = 'diff'">{{ $t('pr.changes.viewDiff') }}</button>
            </div>

            <!-- 스킬(업무 관점): 문단마다 무엇이 빠지고 무엇이 들어오는지 -->
            <div v-if="!changes.unavailable && changes.shape === 'files' && view === 'plain'" class="pc-plain overflow-y-auto flex-grow-1">
                <div v-for="group in plainFiles" :key="group.filename" class="pc-plain-file">
                    <div class="pc-plain-head">
                        <span :class="['ftag', fileTagClass(group.status)]">{{ fileTag(group.status) }}</span>
                        <span class="pc-plain-label">{{ group.label }}</span>
                        <span v-if="group.label !== group.filename" class="pc-plain-path">{{ group.filename }}</span>
                    </div>
                    <div v-for="(block, i) in group.blocks" :key="i" class="pc-plain-block">
                        <div v-if="block.section" class="pc-plain-section">{{ block.section }}</div>
                        <div v-if="!block.before.length && !block.after.length" class="pc-plain-none">
                            {{ noBodyText(block.status) }}
                        </div>
                        <div v-else class="pc-plain-cols">
                            <div class="pc-plain-col before">
                                <div class="pc-plain-coltitle">{{ $t('pr.changes.before') }}</div>
                                <div v-if="!block.before.length" class="pc-plain-empty">{{ $t('pr.changes.emptyBefore') }}</div>
                                <p v-for="(line, li) in block.before" :key="li" class="pc-plain-line">{{ line }}</p>
                            </div>
                            <div class="pc-plain-col after">
                                <div class="pc-plain-coltitle">{{ $t('pr.changes.after') }}</div>
                                <div v-if="!block.after.length" class="pc-plain-empty">{{ $t('pr.changes.emptyAfter') }}</div>
                                <p v-for="(line, li) in block.after" :key="li" class="pc-plain-line">{{ line }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 스킬(상세): 파일 목록 + 깃 패치 -->
            <div v-else-if="!changes.unavailable && changes.shape === 'files'" class="pc-diff-wrap d-flex flex-grow-1">
                <div class="pc-file-sidebar overflow-y-auto flex-shrink-0">
                    <div class="pc-sidebar-label">{{ $t('pr.changes.fileList') }}</div>
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
                        <div v-else class="pc-note">{{ $t('pr.changes.noPatch') }}</div>
                    </template>
                    <div v-else class="pc-note">{{ $t('pr.changes.selectFile') }}</div>
                </div>
            </div>

            <!-- 프로세스·의사결정(상세): 다이어그램·규칙표 비교 -->
            <PrDefinitionCompare
                v-else-if="!changes.unavailable && changes.shape === 'items' && view === 'diff'"
                :resource-type="pr.resource_type || 'bpmn'"
                :base-xml="changes.snapshots?.baseXml || ''"
                :head-xml="changes.snapshots?.headXml || ''"
                :diff-activities-base="changes.snapshots?.diffActivitiesBase || {}"
                :diff-activities-head="changes.snapshots?.diffActivitiesHead || {}"
                class="flex-grow-1"
            />

            <!-- 프로세스·의사결정(요약): 무엇이 업무적으로 달라지는가 -->
            <div v-else-if="!changes.unavailable" class="pc-items overflow-y-auto flex-grow-1">
                <div v-for="(item, i) in items" :key="i" :class="['pc-item', 'pc-item--' + item.kind]">
                    <span :class="['pc-kind', 'pc-kind--' + item.kind]">{{ kindLabel(item.kind) }}</span>
                    <div class="pc-item-body">
                        <div class="pc-item-title">
                            <span :class="['pc-item-name', { 'pc-item-name--id': isRawId(item) }]">{{ item.name }}</span>
                            <span class="pc-item-cat">{{ $t('pr.changes.category.' + item.category) }}</span>
                        </div>
                        <div v-if="item.detail" class="pc-item-detail">{{ item.detail }}</div>
                        <!--
                            "속성 변경" 이라고만 하면 무엇이 어떻게 달라지는지는 결국 다이어그램을
                            열어 봐야 안다. 값이 잡히는 항목은 그 자리에서 좌우로 보여 준다.
                        -->
                        <div v-if="(item.fields || []).length" class="pc-item-fields">
                            <div v-for="(field, fi) in item.fields" :key="fi" class="pc-field">
                                <span class="pc-field-label">{{ field.label }}</span>
                                <span class="pc-field-before">{{ field.before || $t('pr.changes.compare.empty') }}</span>
                                <span class="pc-field-arrow">→</span>
                                <span class="pc-field-after">{{ field.after || $t('pr.changes.compare.empty') }}</span>
                            </div>
                        </div>
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

/* ── 항목 카드의 값 짝 ── */
.pc-item-fields {
    margin-top: 5px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.pc-field {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 11.5px;
    line-height: 1.5;
}
.pc-field-label {
    color: rgba(var(--v-theme-on-surface), 0.42);
    flex: none;
}
.pc-field-before {
    color: rgb(var(--v-theme-error));
    text-decoration: line-through;
    text-decoration-color: rgba(var(--v-theme-error), 0.4);
    overflow-wrap: anywhere;
}
.pc-field-arrow {
    color: rgba(var(--v-theme-on-surface), 0.3);
}
.pc-field-after {
    color: #2e6b16;
    font-weight: 600;
    overflow-wrap: anywhere;
}

/* ── 보기 전환 막대 ── */
.pc-viewbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 7px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    flex: none;
}
.pc-viewbtn {
    border: none;
    background: none;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 7px;
    cursor: pointer;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.pc-viewbtn.on {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
}
.pc-viewbar-note {
    margin-left: auto;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ── 업무 관점 보기 ── */
.pc-plain {
    min-height: 0;
    padding: 10px 12px 16px;
}
.pc-plain-file + .pc-plain-file {
    margin-top: 14px;
}
.pc-plain-head {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 0 8px;
}
.pc-plain-label {
    font-size: 12.5px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.85);
}
.pc-plain-path {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10.5px;
    color: rgba(var(--v-theme-on-surface), 0.4);
    overflow-wrap: anywhere;
}
.pc-plain-block + .pc-plain-block {
    margin-top: 10px;
}
.pc-plain-section {
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.5);
    margin-bottom: 5px;
}
.pc-plain-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
@media (max-width: 720px) {
    .pc-plain-cols {
        grid-template-columns: 1fr;
    }
}
.pc-plain-col {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 8px 10px;
    min-width: 0;
}
.pc-plain-col.before {
    background: rgba(var(--v-theme-error), 0.04);
}
.pc-plain-col.after {
    background: rgba(46, 107, 22, 0.05);
}
.pc-plain-coltitle {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: rgba(var(--v-theme-on-surface), 0.45);
    margin-bottom: 5px;
}
.pc-plain-line {
    margin: 0 0 4px;
    font-size: 12.5px;
    line-height: 1.55;
    color: rgba(var(--v-theme-on-surface), 0.8);
    overflow-wrap: anywhere;
}
.pc-plain-line:last-child {
    margin-bottom: 0;
}
.pc-plain-empty,
.pc-plain-none {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.42);
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
