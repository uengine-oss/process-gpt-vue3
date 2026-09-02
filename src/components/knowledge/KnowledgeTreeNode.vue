<template>
    <div class="ktn-node">
        <div class="ktn-folder-row" :style="{ paddingLeft: `${8 + depth * 16}px` }" @click="$emit('toggle-folder', node.path)">
            <v-icon size="14" class="ktn-caret">{{ isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
            <v-checkbox
                :modelValue="folderState.checked"
                :indeterminate="folderState.indeterminate"
                :disabled="folderLocked"
                @update:modelValue="(v) => $emit('toggle-folder-select', { node, select: !!v })"
                @click.stop
                density="compact"
                hide-details
                color="primary"
                class="ktn-checkbox"
            />
            <v-icon size="16" :color="isOpen ? '#FFA726' : '#8D8D8D'">
                {{ isOpen ? 'mdi-folder-open' : 'mdi-folder' }}
            </v-icon>
            <span class="ktn-folder-name">{{ node.name }}</span>
            <span class="ktn-folder-count">{{ node.descendantCount }}</span>
        </div>

        <div v-if="isOpen" class="ktn-children">
            <KnowledgeTreeNode
                v-for="child in node.children"
                :key="child.path"
                :node="child"
                :depth="depth + 1"
                :expanded="expanded"
                :selectedKeysSet="selectedKeysSet"
                :selCountMap="selCountMap"
                :folderScope="folderScope"
                @toggle-folder="(p) => $emit('toggle-folder', p)"
                @toggle-file="(f) => $emit('toggle-file', f)"
                @toggle-folder-select="(p) => $emit('toggle-folder-select', p)"
                @open-file="(f) => $emit('open-file', f)"
            />
            <div
                v-for="f in node.files"
                :key="f.key"
                class="ktn-file-row"
                :class="{ 'is-selected': isFileSelected(f) }"
                :style="{ paddingLeft: `${8 + (depth + 1) * 16 + 14}px` }"
                @click="coveredByScope ? null : $emit('toggle-file', f)"
            >
                <v-checkbox
                    :modelValue="isFileSelected(f)"
                    :disabled="coveredByScope"
                    @update:modelValue="$emit('toggle-file', f)"
                    @click.stop
                    density="compact"
                    hide-details
                    color="primary"
                    class="ktn-checkbox"
                />
                <v-icon size="16" :color="iconOf(f.name).color">{{ iconOf(f.name).icon }}</v-icon>
                <span class="ktn-file-name">{{ f.name }}</span>
                <span v-if="f.docRole && f.docRole !== 'content'" class="ktn-role-badge" :class="`is-${f.docRole}`">
                    {{ roleShort(f.docRole) }}
                </span>
                <span v-if="f.indexStatus && f.indexStatus !== 'indexed'" class="ktn-status-badge" :class="`is-${f.indexStatus}`">
                    {{ statusLabel(f.indexStatus) }}
                </span>
                <v-tooltip :text="f.sourceType === 'drive' ? 'Drive에서 보기' : '다운로드'" location="top">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="x-small"
                            class="ktn-file-action"
                            @click.stop="$emit('open-file', f)"
                        >
                            <v-icon size="14">
                                {{ f.sourceType === 'drive' ? 'mdi-open-in-new' : 'mdi-download-outline' }}
                            </v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>
    </div>
</template>

<script>
import { mimeIcon } from '@/utils/fileIcon';

function extToMime(name) {
    const ext = (name || '').split('.').pop()?.toLowerCase() || '';
    const map = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        hwp: 'application/x-hwp',
        hwpx: 'application/vnd.hancom.hwpx',
        md: 'text/markdown',
        txt: 'text/plain'
    };
    return map[ext] || '';
}

export default {
    name: 'KnowledgeTreeNode',
    props: {
        node: { type: Object, required: true },
        depth: { type: Number, default: 0 },
        expanded: { type: Set, required: true },
        selectedKeysSet: { type: Set, required: true },
        // 폴더경로 → 그 하위에서 선택된 파일 수. 부모(picker)가 한 번에 집계해 내려준다.
        // 이게 없던 시절엔 노드마다 collectFilesUnder 로 서브트리를 재귀 순회해
        // 전체선택 시 O(파일수 × 폴더수) 로 폭발했다. 이제 O(1) 조회.
        selCountMap: { type: Object, required: true },
        // 폴더째 선택된 경로들(Set). 이 안(또는 조상)에 들면 그 폴더/파일은 '폴더 스코프'로 커버됨
        // → 개별 file_id 를 안 들고도 체크 상태 표시(재오픈 시 수천 파일 재조회 회피).
        folderScope: { type: Set, default: () => new Set() }
    },
    emits: ['toggle-folder', 'toggle-file', 'toggle-folder-select', 'open-file'],
    computed: {
        isOpen() {
            return this.expanded.has(this.node.path);
        },
        // 이 폴더(또는 조상)가 폴더째 선택 스코프 안인가
        coveredByScope() {
            const p = this.node.path;
            for (const r of this.folderScope) {
                if (p === r || p.startsWith(r + '/')) return true;
            }
            return false;
        },
        // 조상 폴더가 스코프라 여기선 개별 해제 불가(그 조상을 풀어야 함) → 체크박스 잠금
        folderLocked() {
            return this.coveredByScope && !this.folderScope.has(this.node.path);
        },
        folderState() {
            // 자신 또는 조상이 폴더 스코프면 '전체 선택'으로 표시
            if (this.coveredByScope) return { checked: true, indeterminate: false };
            const total = this.node.descendantCount || 0;
            if (total === 0) return { checked: false, indeterminate: false };
            const sel = this.selCountMap[this.node.path] || 0;
            return {
                checked: sel === total,
                indeterminate: sel > 0 && sel < total
            };
        }
    },
    methods: {
        // 파일 체크 상태 — 개별 선택됐거나, 이 폴더가 폴더 스코프로 커버되면 체크
        isFileSelected(f) {
            return this.selectedKeysSet.has(f.key) || this.coveredByScope;
        },
        iconOf(name) {
            return mimeIcon(extToMime(name));
        },
        statusLabel(s) {
            return (
                {
                    pending: '대기',
                    processing: '처리중',
                    failed: '실패',
                    excluded: '제외'
                }[s] || ''
            );
        },
        roleShort(r) {
            return { glossary: '사전', template: '양식', reference: '참조', legal_review: '검토' }[r] || '';
        }
    }
};
</script>

<style scoped>
.ktn-folder-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
}

.ktn-folder-row:hover {
    background: rgba(0, 0, 0, 0.04);
}

.ktn-caret {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.45);
}

.ktn-checkbox {
    flex: 0 0 auto;
}

.ktn-checkbox :deep(.v-selection-control) {
    min-height: 22px;
}

.ktn-folder-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ktn-folder-count {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
    padding: 1px 7px;
}

.ktn-file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
}

.ktn-file-row:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}

.ktn-file-row.is-selected {
    background: rgba(var(--v-theme-primary), 0.08);
    border-color: rgba(var(--v-theme-primary), 0.2);
}

.ktn-file-name {
    flex: 1;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ktn-status-badge {
    flex: 0 0 auto;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 500;
}

.ktn-status-badge.is-pending {
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.55);
}

.ktn-status-badge.is-processing {
    background: rgba(33, 150, 243, 0.12);
    color: hsl(var(--accent-brand));
}

.ktn-status-badge.is-failed {
    background: rgba(244, 67, 54, 0.12);
    color: var(--cds-text-danger);
}

.ktn-status-badge.is-excluded {
    background: rgba(158, 158, 158, 0.18);
    color: var(--cds-text-secondary);
}

/* doc_role badge — 트리 모드 파일 행에서 역할 시각화 */
.ktn-role-badge {
    flex: 0 0 auto;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: 500;
}

.ktn-role-badge.is-glossary {
    background: rgba(123, 31, 162, 0.12);
    color: #7b1fa2;
}
.ktn-role-badge.is-template {
    background: rgba(239, 108, 0, 0.12);
    color: var(--cds-text-warning);
}
.ktn-role-badge.is-reference {
    background: rgba(56, 142, 60, 0.12);
    color: var(--cds-text-success);
}
.ktn-role-badge.is-dataset {
    background: rgba(0, 137, 123, 0.12);
    color: #00897b;
}

.ktn-file-action {
    flex: 0 0 auto;
    opacity: 0;
    transition: opacity 0.12s;
}

.ktn-file-row:hover .ktn-file-action,
.ktn-file-row.is-selected .ktn-file-action {
    opacity: 1;
}
</style>
